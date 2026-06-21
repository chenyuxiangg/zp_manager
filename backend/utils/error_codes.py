"""
PR0017 — 错误码枚举与工厂函数

设计目标：
- 单一事实来源：所有错误码定义在 ErrorCode 常量表
- 路由不得绕过工厂函数硬编码字符串（CI grep 检查）
- 响应体结构向后兼容（success/error 字段保留，新增 code 字段）

响应体：
{
  "success": false,
  "error": {"code": "INVALID_CREDENTIALS", "message": "用户名或密码不正确"},
  ... 额外透传字段（PR0003 retry_after_seconds 等）
}
"""
from typing import NamedTuple, List
import math  # B0243：retry_after_minutes 占位替换
from flask import jsonify


class ErrorCode(NamedTuple):
    code: str           # 全大写下划线
    message: str        # 中文文案
    http_status: int    # 4xx / 5xx


# ── 认证类 401/403 ─────────────────────────────────────────
INVALID_CREDENTIALS  = ErrorCode('INVALID_CREDENTIALS',  '用户名或密码不正确',       401)
TOKEN_EXPIRED        = ErrorCode('TOKEN_EXPIRED',        '登录已过期，请重新登录',   401)
TOKEN_REVOKED        = ErrorCode('TOKEN_REVOKED',        '登录凭证已失效',           401)
PERMISSION_DENIED    = ErrorCode('PERMISSION_DENIED',    '无权限访问',               403)
NOT_ADMIN            = ErrorCode('NOT_ADMIN',            '需要管理员权限',           403)
NOT_OWNER            = ErrorCode('NOT_OWNER',            '只能操作自己的资源',       403)
UNAUTHORIZED         = ErrorCode('UNAUTHORIZED',         '请先登录',                 401)

# ── 资源类 404 ────────────────────────────────────────────
RESOURCE_NOT_FOUND   = ErrorCode('RESOURCE_NOT_FOUND',   '资源不存在',               404)

# ── 业务规则类 409 ─────────────────────────────────────────
TASK_ALREADY_COMPLETED = ErrorCode('TASK_ALREADY_COMPLETED', '已完成任务不可删除，请先撤销完成', 409)
POMODORO_ALREADY_RUNNING = ErrorCode('POMODORO_ALREADY_RUNNING', '该任务已有专注进行中', 409)
TITLE_DUPLICATED     = ErrorCode('TITLE_DUPLICATED',     '名称已存在',               409)
PLAN_NOT_ARCHIVABLE  = ErrorCode('PLAN_NOT_ARCHIVABLE',  '存在未完成的阶段，无法归档', 409)
STAGE_NOT_COMPLETABLE = ErrorCode('STAGE_NOT_COMPLETABLE', '存在未完成的任务，无法完成阶段', 409)
RATE_LIMITED         = ErrorCode('RATE_LIMITED',         '{retry_after_minutes} 分钟内不可重复操作，请稍后再试', 409)
PLAN_HAS_COMPLETED_TASKS = ErrorCode('PLAN_HAS_COMPLETED_TASKS', '计划下存在已完成的任务，无法删除', 409)

# ── 输入类 400/422 ────────────────────────────────────────
INVALID_INPUT        = ErrorCode('INVALID_INPUT',        '输入不合法',               400)
RESET_TOKEN_INVALID  = ErrorCode('RESET_TOKEN_INVALID',  '重置链接无效或已过期',     400)

# ── 基础设施类 5xx ────────────────────────────────────────
INTERNAL_ERROR       = ErrorCode('INTERNAL_ERROR',       '服务内部错误',             500)
DB_ERROR             = ErrorCode('DB_ERROR',             '数据存储错误',             500)
EMAIL_SEND_FAILED    = ErrorCode('EMAIL_SEND_FAILED',    '邮件发送失败，请稍后重试', 500)


ALL_CODES: List[ErrorCode] = [
    # 401
    INVALID_CREDENTIALS, TOKEN_EXPIRED, TOKEN_REVOKED, UNAUTHORIZED,
    # 403
    PERMISSION_DENIED, NOT_ADMIN, NOT_OWNER,
    # 404
    RESOURCE_NOT_FOUND,
    # 409
    TASK_ALREADY_COMPLETED, POMODORO_ALREADY_RUNNING, TITLE_DUPLICATED,
    PLAN_NOT_ARCHIVABLE, STAGE_NOT_COMPLETABLE, RATE_LIMITED, PLAN_HAS_COMPLETED_TASKS,
    # 400
    INVALID_INPUT, RESET_TOKEN_INVALID,
    # 500
    INTERNAL_ERROR, DB_ERROR, EMAIL_SEND_FAILED,
]


def _make_response(err: ErrorCode, **kwargs):
    """构造错误响应体。kwargs 透传至 body 顶层（PR0003 retry_after_seconds 等）

    B0243：若 message 含 `{retry_after_minutes}` 占位且 kwargs 提供 retry_after_seconds，
    自动用 ceil(seconds/60) 替换占位；否则保留原 message 不做替换。
    """
    message = err.message
    if '{retry_after_minutes}' in message and 'retry_after_seconds' in kwargs:
        secs = int(kwargs['retry_after_seconds'])
        message = message.format(retry_after_minutes=math.ceil(secs / 60))
    body = {
        'success': False,
        'error': {'code': err.code, 'message': message},
    }
    if kwargs:
        body.update(kwargs)
    return jsonify(body), err.http_status


def unauthorized(err: ErrorCode, **kwargs):
    """401 响应"""
    return _make_response(err, **kwargs)


def forbidden(err: ErrorCode, **kwargs):
    """403 响应"""
    return _make_response(err, **kwargs)


def not_found(err: ErrorCode = RESOURCE_NOT_FOUND, **kwargs):
    """404 响应"""
    return _make_response(err, **kwargs)


def conflict(err: ErrorCode, **kwargs):
    """409 响应"""
    return _make_response(err, **kwargs)


def bad_request(err: ErrorCode, **kwargs):
    """400 响应"""
    return _make_response(err, **kwargs)


def server_error(err: ErrorCode, **kwargs):
    """500 响应"""
    return _make_response(err, **kwargs)
