// Tasks.vue 测试 - TDD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouterStub } from '@/test/helpers/router-stub'

// Mock tasks store
const mockTasksStore = {
  todayTasks: [],
  overdueTasks: [],
  allTasks: [],
  loading: false,
  fetchTasks: vi.fn().mockResolvedValue({ success: true }),
  toggleTaskComplete: vi.fn().mockResolvedValue({ success: true, data: { points_delta: 10 } })
}

vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => mockTasksStore
}))

// Mock auth store
const mockAuthStore = {
  user: { id: 1, username: 'me', points: 100 },
  fetchUser: vi.fn().mockResolvedValue({ success: true }),
  logout: vi.fn().mockResolvedValue({ success: true })
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock vue-router
const mockRouter = createRouterStub()
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {}, query: {} }),
  useRouter: () => mockRouter,
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>', props: ['to'] }
}))

// Mock useToast
const mockToast = {
  success: vi.fn(),
  error: vi.fn()
}
vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast
}))

const getComponent = async () => {
  const { default: Tasks } = await import('@/views/Tasks.vue')
  return Tasks
}

describe('Tasks.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
    mockTasksStore.todayTasks = []
    mockTasksStore.overdueTasks = []
    mockTasksStore.allTasks = []
    // 重置 auth store 状态（避免积分跨测试污染）
    mockAuthStore.user.points = 100
    // 重新设置默认 mock 实现（clearAllMocks 会清除 mockImplementation）
    mockTasksStore.fetchTasks.mockResolvedValue({ success: true })
    mockTasksStore.toggleTaskComplete.mockResolvedValue({ success: true, data: { points_delta: 10 } })
  })

  describe('task card click', () => {
    it('clicking a task card calls router.push with /tasks/:id', async () => {
      mockTasksStore.todayTasks = [{ id: 7, title: 'Task 7', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const card = wrapper.find('.task-card')
      await card.trigger('click')
      await flushPromises()

      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/7')
    })

    it('clicking the 完成 button in overlay does NOT trigger navigation (event.stop)', async () => {
      mockTasksStore.todayTasks = [{ id: 7, title: 'Task 7', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      // 找到悬停覆盖层中的 ✓ 按钮
      const overlay = wrapper.find('.task-actions-overlay')
      const completeBtn = overlay.findAll('button').find(b => b.text().includes('✓'))
      expect(completeBtn).toBeDefined()
      await completeBtn.trigger('click')
      await flushPromises()

      // 路由不应被 push
      expect(mockRouter.push).not.toHaveBeenCalled()
      // store 的 toggleTaskComplete 应被调用（统一走 toggle 接口）
      expect(mockTasksStore.toggleTaskComplete).toHaveBeenCalledWith(7)
    })

    it('clicking the 完成 button updates authStore.user.points via points_delta', async () => {
      mockTasksStore.todayTasks = [{ id: 7, title: 'Task 7', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const overlay = wrapper.find('.task-actions-overlay')
      const completeBtn = overlay.findAll('button').find(b => b.text().includes('✓'))
      await completeBtn.trigger('click')
      await flushPromises()

      // mockAuthStore.user.points 初始 100，+10 = 110
      expect(mockAuthStore.user.points).toBe(110)
    })

    it('card no longer contains the standalone 完成 button (replaced by overlay)', async () => {
      mockTasksStore.todayTasks = [{ id: 1, title: 'T1', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      // 直接子元素中不应有独立的"完成"按钮
      const card = wrapper.find('.task-card')
      // 直接子级 button 列表（覆盖层按钮不在内，因为有 .task-actions-overlay 包裹）
      const directButtons = card.findAll(':scope > button')
      expect(directButtons).toHaveLength(0)
    })
  })

  describe('hover overlay actions', () => {
    it('has 4 overlay buttons: complete, edit, comment, delete', async () => {
      mockTasksStore.todayTasks = [{ id: 1, title: 'T1', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const overlay = wrapper.find('.task-actions-overlay')
      expect(overlay.exists()).toBe(true)
      expect(overlay.findAll('button')).toHaveLength(4)
    })

    it('completed tasks: overlay shows 4 buttons (including ↶ 撤销完成)', async () => {
      mockTasksStore.todayTasks = [{ id: 1, title: 'T1', scheduled_date: '2026-06-06', points: 10, status: 'completed' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const overlay = wrapper.find('.task-actions-overlay')
      // 完成后仍显示 4 个按钮：撤销完成（↶）/编辑/评论/删除
      expect(overlay.findAll('button')).toHaveLength(4)
      // 包含 ↶ 撤销按钮
      expect(overlay.text()).toContain('↶')
    })

    it('clicking edit button navigates to /tasks/:id', async () => {
      mockTasksStore.todayTasks = [{ id: 5, title: 'T5', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const overlay = wrapper.find('.task-actions-overlay')
      const editBtn = overlay.findAll('button').find(b => b.text().includes('✎'))
      await editBtn.trigger('click')
      await flushPromises()

      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/5')
    })

    it('clicking comment button navigates to /tasks/:id#comments', async () => {
      mockTasksStore.todayTasks = [{ id: 5, title: 'T5', scheduled_date: '2026-06-06', points: 10, status: 'pending' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      const overlay = wrapper.find('.task-actions-overlay')
      const commentBtn = overlay.findAll('button').find(b => b.text().includes('💬'))
      await commentBtn.trigger('click')
      await flushPromises()

      expect(mockRouter.push).toHaveBeenCalledWith('/tasks/5#comments')
    })
  })

  describe('completed badge regression', () => {
    it('completed task shows completed-badge', async () => {
      mockTasksStore.todayTasks = [{ id: 1, title: 'T1', scheduled_date: '2026-06-06', points: 10, status: 'completed' }]

      const Tasks = await getComponent()
      const wrapper = mount(Tasks)
      await flushPromises()

      expect(wrapper.find('.completed-badge').exists()).toBe(true)
    })
  })

  describe('mobile CSS — @media (hover: none)', () => {
    // CSS @media query 验证：直接读取源文件（scoped 样式在 happy-dom 中不会被注入 DOM）
    it('Tasks.vue source contains @media (hover: none) for always-visible overlay', async () => {
      const fs = await import('fs')
      const source = fs.readFileSync(require('path').resolve(__dirname, '../../views/Tasks.vue'), 'utf-8')
      expect(source).toContain('@media (hover: none)')
      expect(source).toContain('.task-actions-overlay')
      // 移动端：opacity 强制为 1
      const mediaBlock = source.match(/@media \(hover: none\)\s*\{[\s\S]*?\}/)
      expect(mediaBlock?.[0]).toContain('opacity: 1')
    })

    it('TaskDetail.vue source contains @media (max-width: 640px) for mobile layout', async () => {
      const fs = await import('fs')
      const path = require('path')
      const source = fs.readFileSync(path.resolve(__dirname, '../../views/TaskDetail.vue'), 'utf-8')
      expect(source).toContain('@media (max-width: 640px)')
      const mediaBlock = source.match(/@media \(max-width: 640px\)\s*\{[\s\S]*?\}/)
      expect(mediaBlock?.[0]).toContain('flex-direction: column')
    })
  })
})
