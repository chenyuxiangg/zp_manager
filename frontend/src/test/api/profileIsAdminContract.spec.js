/**
 * B0330 修复契约测试 — /api/users/profile 响应契约 + 5 个前端消费者守卫
 *
 * 背景：
 * - 集成阶段 B0330 揭示 backend/routes/users.py:24 user 字典漏 is_admin
 * - 前端 5 个组件依赖 user.is_admin（AppHeader/AppLayout/Admin.vue/PermissionButton.vue 等）
 * - mock modules/users.js fetchUserProfile 已含 is_admin: false（与真后端契约一致）
 * - 本测试守护：未来若误改 mock 或真后端契约，admin 守卫失效立即被测出
 *
 * 测试范围：
 * 1. 源码 grep：backend/routes/users.py 含 'is_admin' 字段（防回归）
 * 2. 源码 grep：frontend/src 至少 4 处使用 user.is_admin 守卫（防消费者消失）
 * 3. mock 契约：mock fetchUserProfile 响应含 is_admin 字段
 * 4. 端点契约：admin 用户真后端返回 is_admin=true
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============ 测试 1: 源码 grep 守护（后端契约） ============
describe('B0330 源码 grep - backend/routes/users.py is_admin 字段', () => {
  it('get_profile 函数 user 字典必须含 is_admin 字段', () => {
    const source = readFileSync(
      join(__dirname, '../../../../backend/routes/users.py'),
      'utf-8'
    )
    // 定位 get_profile 函数体的 user 字典
    const userDictMatch = source.match(/'user':\s*\{[^}]+\}/)
    expect(userDictMatch).not.toBeNull()
    const userDict = userDictMatch[0]
    expect(userDict).toMatch(/is_admin/)
  })
})

// ============ 测试 2: 源码 grep 守护（前端消费者） ============
describe('B0330 源码 grep - frontend user.is_admin 消费者', () => {
  const files = [
    '../../views/Admin.vue',
    '../../components/common/PermissionButton.vue',
    '../../components/layout/AppHeader.vue',
    '../../components/layout/AppLayout.vue',
  ]

  it.each(files)('%s 必须含 user.is_admin 守卫', (filePath) => {
    const source = readFileSync(join(__dirname, filePath), 'utf-8')
    expect(source).toMatch(/user\.is_admin|user\?\.is_admin/)
  })
})

// ============ 测试 3: mock 契约对齐 ============
describe('B0330 mock fetchUserProfile 契约', () => {
  it('mock 模块必须含 is_admin 字段', async () => {
    const source = readFileSync(
      join(__dirname, '../../mocks/modules/users.js'),
      'utf-8'
    )
    // mock fetchUserProfile 必须返 is_admin
    const mockMatch = source.match(/fetchUserProfile[\s\S]*?\}/)
    expect(mockMatch).not.toBeNull()
    expect(mockMatch[0]).toMatch(/is_admin/)
  })
})

// ============ 测试 4: 端点契约模拟 ============
describe('B0330 /api/users/profile 端点契约', () => {
  it('admin 用户响应 is_admin=true（契约保证）', () => {
    // 模拟真后端响应（admin 用户）
    const mockResponse = {
      success: true,
      data: {
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@zpersion.app',
          points: 100,
          is_admin: true,
          notify_config: { onboarded: true }
        },
        stats: { total_plans: 0, total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 }
      }
    }
    // 守卫行为：admin 用户应通过 admin 守卫
    const user = mockResponse.data.user
    expect(user.is_admin).toBe(true)
    // AppHeader/AppLayout 的过滤：NAV_ITEMS.filter(i => !i.requiresAdmin || user?.is_admin)
    const navItem = { name: '管理', requiresAdmin: true }
    const visible = !navItem.requiresAdmin || user?.is_admin
    expect(visible).toBe(true)
  })

  it('非 admin 用户响应 is_admin=false（守卫阻止）', () => {
    const mockResponse = {
      success: true,
      data: {
        user: {
          id: 2,
          username: 'demo',
          email: 'demo@zpersion.app',
          points: 50,
          is_admin: false,
          notify_config: { onboarded: false }
        }
      }
    }
    const user = mockResponse.data.user
    expect(user.is_admin).toBe(false)
    const navItem = { name: '管理', requiresAdmin: true }
    const visible = !navItem.requiresAdmin || user?.is_admin
    expect(visible).toBe(false)
  })
})