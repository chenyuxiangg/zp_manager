"""
PR0001 §6 — reminder_worker 入口脚本

被 cron 每 5 分钟调用一次：
    */5 * * * * cd /opt/zpersion/backend && /usr/bin/python -m worker.reminder_worker >> /var/log/zpersion/reminder.log 2>&1

入口逻辑：
1. acquire MySQL GET_LOCK('reminder_dispatch', 240)  跨机互斥
2. 失败 → 退出 0（让下一次 cron 接手）
3. 成功 → 调 services/reminder.dispatch_pending()
4. 写 worker_runs 一行
"""
import argparse
import logging
import os
import sys

# 把 backend/ 加到 sys.path（worker 脚本需独立运行）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

log = logging.getLogger('reminder_worker')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)


def main():
    parser = argparse.ArgumentParser(description='Reminder dispatch worker (PR0001)')
    parser.add_argument('--dry-run', action='store_true',
                        help='扫到 pending 但不发邮件，仅打印日志')
    parser.add_argument('--batch-size', type=int, default=200,
                        help='单次最多派发多少条（默认 200）')
    args = parser.parse_args()

    from app import create_app
    from services.scheduler_lock import WorkerLock
    from services.reminder import dispatch_pending

    app = create_app()
    with app.app_context():
        # 跨机互斥：cron 间隔 5min，锁 240s 足够
        with WorkerLock('reminder_dispatch', timeout=240) as acquired:
            if not acquired:
                log.info('[reminder_worker] lock not acquired, another worker running. Skip.')
                return 0

            stats = dispatch_pending(
                dry_run=args.dry_run,
                batch_size=args.batch_size,
            )
            log.info(
                f'[reminder_worker] picked={stats["picked"]} sent={stats["sent"]} failed={stats["failed"]}'
                + (' (DRY-RUN)' if args.dry_run else '')
            )
    return 0


if __name__ == '__main__':
    sys.exit(main())
