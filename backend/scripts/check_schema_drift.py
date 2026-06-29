"""
B0338 R-A: SQLAlchemy model vs live MySQL DB schema drift checker

RR2 部署观察期发现 B0338（`point_logs` 缺 PR0003 5 列 / `reminders` 缺 B0239 2 列 /
`worker_runs` 表缺失）—— 根因是 RR1→RR2 schema 演进从未被 alembic 跟踪，stamped 到
head 但表结构停留在 RR1。本脚本在 CI 启动时跑，阻断同类漂移再次发生。

**用法**：
    # 默认：从环境变量 DATABASE_URL 读 DB URL
    python -m scripts.check_schema_drift

    # 自定义 URL（CI 也可用）
    python -m scripts.check_schema_drift --url mysql+pymysql://user:pwd@host:3306/db

    # 严格模式：DB 多余列也 fail（默认只 warn 兼容 RR3 保守迁移）
    python -m scripts.check_schema_drift --strict

    # JSON 输出（CI 解析）
    python -m scripts.check_schema_drift --json

**退出码**：
    0 = schema 对齐（pass）
    1 = 漂移：缺表 或 缺列
    2 = 连接错误 / 配置缺失

**检测项**：
    1. 缺表（model 有，DB 无）—— fail
    2. 缺列（model 有，DB 无）—— fail（这是 B0338 的核心）
    3. 多余列（DB 有，model 无）—— warn only（保留 RR1 遗留字段如 retry_count）
    4. 类型不匹配（best-effort）—— warn（MySQL DDL 类型映射复杂，不阻塞）

**CI 集成建议**：
    - 在 release.sh 流水线第一步跑（早于 pytest）
    - 在 PR 合并前跑（block merge）
    - 配置 `ZP_SKIP_DRIFT_CHECK=1` 跳过（紧急 release 兜底）

**已知限制**：
    - MySQL ENUM 类型比较时大小写敏感，可能误报；如需严格可用 --strict
    - VARCHAR(N) N 变化（255→500）会被判为 type mismatch，但不影响功能，仅 warn
    - 大表 ALTER COLUMN 在生产期可能锁表；本脚本只做 inspection，不改 schema
"""
import argparse
import json
import os
import sys
import time
from typing import Dict, List, Set, Tuple

# 把 backend 根目录加到 path（支持 `python -m scripts.check_schema_drift`）
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from sqlalchemy import create_engine, inspect, text  # noqa: E402
from sqlalchemy.exc import OperationalError, SQLAlchemyError  # noqa: E402


# 一些列类型归一化（MySQL 显示可能与 model 不同）
# 例：model 写 BigInteger().with_variant(Integer, "sqlite") 在 MySQL 渲染成 bigint，
#     SQLite 是 integer —— 比较时需双 driver 容差
_TYPE_NORMALIZE = {
    ('bigint', 'integer'),
    ('tinyint', 'bool', 'boolean'),  # MySQL bool → tinyint(1)
    ('datetime', 'timestamp'),
    ('text', 'longtext', 'mediumtext'),
}


def _types_compatible(db_type: str, model_type: str) -> bool:
    """Best-effort 类型兼容性判断（大小写不敏感 + 类型族归一化）"""
    db = db_type.lower()
    model = model_type.lower()
    if db == model:
        return True
    # 取类型主族（去掉括号内参数，如 enum('a','b') → enum）
    db_main = db.split('(')[0].strip()
    model_main = model.split('(')[0].strip()
    if db_main == model_main:
        return True
    # 类型族匹配（任何顺序包含）
    for family in _TYPE_NORMALIZE:
        if db_main in family and model_main in family:
            return True
    return False


def load_model_metadata():
    """从 models 模块加载 SQLAlchemy metadata（延迟 import 避免无 DB 时崩）"""
    from models import db
    return db.metadata


def collect_model_columns(metadata) -> Dict[str, Dict[str, str]]:
    """返回 {table_name: {col_name: col_type_str}}"""
    result = {}
    for table in metadata.sorted_tables:
        result[table.name] = {
            col.name: str(col.type) for col in table.columns
        }
    return result


def collect_db_columns(engine) -> Dict[str, Dict[str, str]]:
    """通过 inspector 拉取 live DB 的列信息"""
    inspector = inspect(engine)
    result = {}
    for table_name in inspector.get_table_names():
        result[table_name] = {
            col['name']: col['type'].__class__.__name__ + (
                f"({col['type'].length})" if hasattr(col['type'], 'length') and col['type'].length else ""
            )
            for col in inspector.get_columns(table_name)
        }
    return result


def detect_drift(
    model_cols: Dict[str, Dict[str, str]],
    db_cols: Dict[str, Dict[str, str]],
    strict: bool = False,
) -> Tuple[List[str], List[str], List[str]]:
    """返回 (errors, warnings, info) — errors 必阻断，warnings 仅告警"""
    errors = []
    warnings = []
    info = []

    # 1. 缺表
    for tname in sorted(model_cols.keys() - db_cols.keys()):
        errors.append(f"MISSING TABLE: model declares `{tname}` but DB does not have it")

    # 2. 多余表（DB 有，model 无）—— 严格模式才报
    if strict:
        for tname in sorted(db_cols.keys() - model_cols.keys()):
            errors.append(f"EXTRA TABLE: DB has `{tname}` but model does not declare it")
    else:
        for tname in sorted(db_cols.keys() - model_cols.keys()):
            info.append(f"extra table in DB (ignored, not in model): `{tname}`")

    # 3. 列差异（仅检查 model 中有的表）
    for tname in sorted(model_cols.keys() & db_cols.keys()):
        model_c = model_cols[tname]
        db_c = db_cols[tname]
        # 缺列
        for col in sorted(model_c.keys() - db_c.keys()):
            errors.append(f"MISSING COLUMN: `{tname}.{col}` (model declares, DB missing — likely B0338-class drift)")
        # 多余列
        if strict:
            for col in sorted(db_c.keys() - model_c.keys()):
                errors.append(f"EXTRA COLUMN: `{tname}.{col}` (DB has, model doesn't)")
        else:
            for col in sorted(db_c.keys() - model_c.keys()):
                info.append(f"extra column (ignored): `{tname}.{col}`")
        # 类型不匹配（best-effort）
        for col in sorted(model_c.keys() & db_c.keys()):
            if not _types_compatible(db_c[col], model_c[col]):
                warnings.append(
                    f"TYPE MISMATCH: `{tname}.{col}` model={model_c[col]} db={db_c[col]}"
                )

    return errors, warnings, info


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Compare SQLAlchemy model metadata vs live DB schema (B0338 R-A CI guard)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        '--url',
        default=os.environ.get('DATABASE_URL'),
        help='SQLAlchemy URL (default: $DATABASE_URL)',
    )
    parser.add_argument(
        '--strict',
        action='store_true',
        help='Also fail on extra columns/tables (default: warn only)',
    )
    parser.add_argument(
        '--json',
        action='store_true',
        help='Emit machine-readable JSON report (CI integration)',
    )
    parser.add_argument(
        '--skip-env',
        action='store_true',
        help='Respect ZP_SKIP_DRIFT_CHECK=1 environment override',
    )
    args = parser.parse_args()

    if args.skip_env and os.environ.get('ZP_SKIP_DRIFT_CHECK') == '1':
        print('ZP_SKIP_DRIFT_CHECK=1, skipping drift check')
        return 0

    if not args.url:
        print('FATAL: DATABASE_URL not set and --url not provided', file=sys.stderr)
        return 2

    # 加载 model metadata
    try:
        metadata = load_model_metadata()
        model_cols = collect_model_columns(metadata)
    except Exception as e:
        print(f'FATAL: failed to load model metadata: {e}', file=sys.stderr)
        return 2

    # 连接 DB
    try:
        engine = create_engine(args.url, pool_pre_ping=True)
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        db_cols = collect_db_columns(engine)
    except OperationalError as e:
        print(f'FATAL: cannot connect to DB: {e}', file=sys.stderr)
        return 2
    except SQLAlchemyError as e:
        print(f'FATAL: DB error: {e}', file=sys.stderr)
        return 2

    # 检测
    errors, warnings, info = detect_drift(model_cols, db_cols, strict=args.strict)

    # 输出
    if args.json:
        report = {
            'timestamp': time.time(),
            'strict': args.strict,
            'tables_compared': len(model_cols & db_cols),
            'errors': errors,
            'warnings': warnings,
            'info': info,
            'exit_code': 1 if errors else 0,
        }
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print('=' * 70)
        print(f'Schema drift check ({"STRICT" if args.strict else "default"})')
        print('=' * 70)
        print(f'Tables compared: {len(model_cols & db_cols)}')
        print()
        if errors:
            print(f'❌ ERRORS ({len(errors)}):')
            for e in errors:
                print(f'  {e}')
            print()
        if warnings:
            print(f'⚠️  WARNINGS ({len(warnings)}):')
            for w in warnings:
                print(f'  {w}')
            print()
        if info and args.strict is False:
            print(f'ℹ️  INFO ({len(info)}):')
            for i in info[:20]:  # 限 20 条避免刷屏
                print(f'  {i}')
            if len(info) > 20:
                print(f'  ... and {len(info) - 20} more')
            print()

        if errors:
            print('❌ DRIFT DETECTED — schema must be aligned before deploy')
            print('   Run: cd backend && flask db upgrade')
            print('   Or:  cd backend && python -m scripts.check_schema_drift --json  (for CI logs)')
        else:
            print('✅ Schema aligned')

    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())