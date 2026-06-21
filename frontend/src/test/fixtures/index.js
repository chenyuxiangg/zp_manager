// B0129 — 公共测试 fixture (vitest 复用)
// 集中管理 user/task/plan/comment mock 对象，避免每个 spec 重复

export const fakeUser = (overrides = {}) => ({
  id: 1,
  username: 'testuser',
  email: 'test@zpersion.app',
  points: 100,
  is_admin: false,
  created_at: '2026-06-15T12:00:00Z',
  notify_config: {
    onboarded: false,
    learn_reminder: { timing: '1 day', channels: ['email'] },
    verify_reminder: { timing: '3 days', channels: ['email'] },
    pomodoro: { break_enabled: true, break_minutes: 5, background_keep_alive: true },
    streak: { next_milestone: 7, flame_visible: true },
  },
  ...overrides,
})

export const fakeTask = (overrides = {}) => ({
  id: 1,
  title: 'Test task',
  description: '',
  status: 'pending',
  points: 10,
  scheduled_date: '2026-06-15',
  stage_id: 1,
  user_id: 1,
  created_at: '2026-06-15T12:00:00Z',
  ...overrides,
})

export const fakePlan = (overrides = {}) => ({
  id: 1,
  title: 'Test plan',
  description: 'A test plan',
  status: 'active',
  start_date: '2026-06-01',
  end_date: '2026-12-31',
  user_id: 1,
  ...overrides,
})

export const fakeStage = (overrides = {}) => ({
  id: 1,
  title: 'Test stage',
  description: '',
  status: 'active',
  start_date: '2026-06-01',
  end_date: '2026-07-31',
  order_num: 0,
  plan_id: 1,
  ...overrides,
})

export const fakeComment = (overrides = {}) => ({
  id: 1,
  content: '<p>Test comment</p>',
  user: 'testuser',
  is_owner: true,
  task_id: 1,
  created_at: '2026-06-15T12:00:00Z',
  ...overrides,
})
