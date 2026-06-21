#!/usr/bin/env python3
"""
PR0017 §6 错误码同步脚本

读 backend/utils/error_codes.py，提取所有 ErrorCode 常量，
生成 frontend/src/constants/errorCodes.js 同步文件。

用法：
    python scripts/sync_error_codes.py              # 默认相对项目根
    python scripts/sync_error_codes.py --check      # 只检查同步状态（CI 用）

CI 集成：
    release.sh 阶段 0 自动跑此脚本；
    husky pre-commit 钩子强制跑（PR0017 R1 风险缓解）。
"""
import argparse
import ast
import re
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_EC = PROJECT_ROOT / 'backend' / 'utils' / 'error_codes.py'
FRONTEND_OUT = PROJECT_ROOT / 'frontend' / 'src' / 'constants' / 'errorCodes.js'


def extract_error_codes(source: str):
    """解析 error_codes.py 顶层 ErrorCode 赋值语句。"""
    tree = ast.parse(source)
    codes = []
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1:
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id.isupper():
                value = node.value
                # ErrorCode('CODE', 'message', status)
                if isinstance(value, ast.Call) and getattr(value.func, 'id', '') == 'ErrorCode':
                    if len(value.args) >= 3:
                        code = value.args[0].value if isinstance(value.args[0], ast.Constant) else ''
                        message = value.args[1].value if isinstance(value.args[1], ast.Constant) else ''
                        status = value.args[2].value if isinstance(value.args[2], ast.Constant) else 0
                        codes.append({
                            'name': target.id,
                            'code': code,
                            'message': message,
                            'http_status': status,
                        })
    return codes


def render_js(codes):
    """生成 ES module JS：const ERROR_CODES = {...}; export default; export const XXX = 'XXX'; ..."""
    lines = [
        '// @generated DO NOT EDIT — 由 scripts/sync_error_codes.py 生成',
        '// Source: backend/utils/error_codes.py',
        '',
        'export const ERROR_CODES = {',
    ]
    for c in codes:
        # 简单转义反斜杠与单引号
        msg = c['message'].replace('\\', '\\\\').replace("'", "\\'")
        lines.append(f"  {c['name']}: '{c['code']}',")
    lines.append('};')
    lines.append('')
    lines.append('export const ERROR_MESSAGES = {')
    for c in codes:
        msg = c['message'].replace('\\', '\\\\').replace("'", "\\'")
        lines.append(f"  {c['name']}: '{msg}',")
    lines.append('};')
    lines.append('')
    lines.append('export const ERROR_HTTP_STATUS = {')
    for c in codes:
        lines.append(f"  {c['name']}: {c['http_status']},")
    lines.append('};')
    lines.append('')
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(description='Sync backend error codes to frontend.')
    parser.add_argument('--check', action='store_true',
                        help='Only check if files are in sync (exit 1 if not).')
    args = parser.parse_args()

    if not BACKEND_EC.exists():
        print(f'[sync_error_codes] FATAL: {BACKEND_EC} not found', file=sys.stderr)
        sys.exit(1)

    codes = extract_error_codes(BACKEND_EC.read_text(encoding='utf-8'))
    if not codes:
        print(f'[sync_error_codes] FATAL: no ErrorCode instances found in {BACKEND_EC}', file=sys.stderr)
        sys.exit(1)

    rendered = render_js(codes)
    if args.check:
        if not FRONTEND_OUT.exists():
            print(f'[sync_error_codes] MISSING: {FRONTEND_OUT}', file=sys.stderr)
            sys.exit(1)
        existing = FRONTEND_OUT.read_text(encoding='utf-8')
        if existing != rendered:
            print(f'[sync_error_codes] OUT OF SYNC: {FRONTEND_OUT}', file=sys.stderr)
            print('Run: python scripts/sync_error_codes.py', file=sys.stderr)
            sys.exit(1)
        print(f'[sync_error_codes] OK: {len(codes)} codes in sync.')
        return

    FRONTEND_OUT.parent.mkdir(parents=True, exist_ok=True)
    FRONTEND_OUT.write_text(rendered, encoding='utf-8')
    print(f'[sync_error_codes] WROTE {FRONTEND_OUT} with {len(codes)} codes.')


if __name__ == '__main__':
    main()
