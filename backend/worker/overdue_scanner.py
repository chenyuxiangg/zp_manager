"""
PR0002 §6 — overdue_scanner 入口脚本

被 cron 每日 00:05 调用一次：
    5 0 * * * cd /opt/zpersion/backend && /usr/bin/python -m worker.overdue_scanner >> /var/log/zpersion/overdue.log 2>&1
"""
import argparse
import logging
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

log = logging.getLogger('overdue_scanner')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)


def main():
    parser = argparse.ArgumentParser(description='Overdue task scanner (PR0002)')
    parser.add_argument('--batch-size', type=int, default=None,
                        help='单批条数（默认读 OVERDUE_BATCH_SIZE 环境变量，200）')
    args = parser.parse_args()

    from app import create_app
    from services.scheduler_lock import WorkerLock
    from services.overdue import scan_overdue, mark_pending_recovery

    app = create_app()
    with app.app_context():
        with WorkerLock('overdue_scan', timeout=240) as acquired:
            if not acquired:
                log.info('[overdue_scanner] lock not acquired, skip.')
                return 0

            stats = scan_overdue(batch_size=args.batch_size or 200)
            recovery_count = mark_pending_recovery()
            log.info(
                f'[overdue_scanner] scanned={stats["scanned"]} '
                f'marked={stats["marked"]} recovered={recovery_count}'
            )
    return 0


if __name__ == '__main__':
    sys.exit(main())
