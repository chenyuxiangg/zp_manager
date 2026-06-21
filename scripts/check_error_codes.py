#!/usr/bin/env python3
"""
PR0017 §11 CI 错误码检查

检查：
1. backend/routes/*.py 中不应有错误码字面量（除注释）
2. error_codes.py 与 frontend constants/errorCodes.js 已同步

CI 集成：在 release.sh 阶段 0 跑；本地手动：python scripts/check_error_codes.py
"""
import re
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ROUTES_DIR = PROJECT_ROOT / 'backend' / 'routes'

# 已知错误码字面量模式（CI 拒绝）
PATTERNS = [
    (r"'VALIDATION_ERROR'", 'VALIDATION_ERROR'),
    (r"'AUTH_ERROR'", 'AUTH_ERROR'),
    (r"'NOT_FOUND'", 'NOT_FOUND'),
    (r"'FORBIDDEN'", 'FORBIDDEN'),
    (r"'UNAUTHORIZED'", 'UNAUTHORIZED'),
]


def check_routes():
    """routes/ 中错误码字面量应 0 命中"""
    issues = []
    for f in ROUTES_DIR.glob('*.py'):
        content = f.read_text(encoding='utf-8')
        for lineno, line in enumerate(content.splitlines(), 1):
            # 跳过注释
            stripped = line.strip()
            if stripped.startswith('#'):
                continue
            for pat, name in PATTERNS:
                if re.search(pat, line):
                    issues.append(f'{f.name}:{lineno}: 字面量 {name}: {line.strip()[:80]}')
    return issues


def check_sync():
    """error_codes.py 与 frontend constants/errorCodes.js 已同步"""
    result = subprocess.run(
        ['python3', str(PROJECT_ROOT / 'scripts' / 'sync_error_codes.py'), '--check'],
        capture_output=True, text=True
    )
    return result.returncode == 0, result.stderr


def main():
    issues = check_routes()
    sync_ok, sync_err = check_sync()

    if issues:
        print('[check_error_codes] FAILED: routes/ 中存在错误码字面量：', file=sys.stderr)
        for i in issues:
            print(f'  {i}', file=sys.stderr)
        print('修复: 改用 ec.XXX 常量 + 工厂函数', file=sys.stderr)
        sys.exit(1)

    if not sync_ok:
        print('[check_error_codes] FAILED: 前后端错误码失同步', file=sys.stderr)
        print(sync_err, file=sys.stderr)
        sys.exit(1)

    print('[check_error_codes] OK: routes/ 0 字面量 + 前后端已同步')


if __name__ == '__main__':
    main()
