# Feature Flags 约定 (B0141)

> 来源：PR0022 notify_config 改造 + PR0012/0018 跨 PR 共享设置入口

## 一、总则

- **单一真相**：`User.notify_config` (后端) 是 feature flag 的唯一来源
- **前端消费**：通过 `useNotifyConfig` composable（`src/composables/useNotifyConfig.js`）
- **变更流程**：FE PR 修改 → 提交方案评审 → 后端 schema merge → release.sh 同步

## 二、当前 flags 列表

| Key | 类型 | 默认 | 关联 PR | 备注 |
|---|---|---|---|---|
| `learn_reminder.timing` | string | `'1 day'` | PR0001 | 提醒时机 |
| `learn_reminder.channels` | string[] | `['email']` | PR0001 | 提醒渠道 |
| `verify_reminder.timing` | string | `'3 days'` | PR0001 | 验收提醒 |
| `verify_reminder.channels` | string[] | `['email']` | PR0001 | 验收渠道 |
| `onboarded` | boolean | `false` | PR0012 | 是否已观看引导 |
| `pomodoro.break_enabled` | boolean | `true` | PR0008/PR0022 | 专注后自动开休息 |
| `pomodoro.break_minutes` | number | `5` | PR0008/PR0022 | 休息时长 |
| `pomodoro.background_keep_alive` | boolean | `true` | PR0022 | 后台运行时继续 |
| `streak.next_milestone` | number | `7` | PR0009/PR0022 | 当前目标（7/30/100） |
| `streak.flame_visible` | boolean | `true` | PR0009/PR0022 | 火焰图标可见 |

## 三、临时 dev-only 开关（RR3 框架化）

- 在 `localStorage` 写入 `VITE_FEATURE_<key>=1` 启用 dev 调试（不进生产）
- 例：`localStorage.setItem('VITE_FEATURE_NEW_ONBOARDING', '1')`
- 注意：这是**临时约定**，RR3 会替换为统一的 feature flag 服务

## 四、添加新 flag 的检查清单

- [ ] `backend/utils/error_codes.py` 类似，添加 `backend/services/notify_config.py` schema
- [ ] 前端 `useNotifyConfig` 暴露对应 field
- [ ] 单元测试覆盖 default + get + update 路径
- [ ] 联调：PUT `/api/users/notify-config` 验证
- [ ] 文档：本表加一行
- [ ] release.sh: `flask db migrate` 包含 schema 变更（如有）
