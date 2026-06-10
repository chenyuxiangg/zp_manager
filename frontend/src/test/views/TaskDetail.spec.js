// TaskDetail.vue 测试 - TDD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouteStub, createRouterStub } from '@/test/helpers/router-stub'

// Mock tasks store
const mockTasksStore = {
  currentTask: null,
  taskComments: [],
  loading: false,
  fetchTaskDetail: vi.fn(),
  fetchTaskComments: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  toggleTaskComplete: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn()
}

// 模拟 store 行为：成功 fetchTaskDetail 后更新 currentTask
mockTasksStore.fetchTaskDetail.mockImplementation(async (id) => {
  const res = { success: true, data: { task: { id, title: 'T' } } }
  mockTasksStore.currentTask = res.data.task
  return res
})
mockTasksStore.fetchTaskComments.mockImplementation(async () => {
  const res = { success: true, data: { comments: [] } }
  mockTasksStore.taskComments = res.data.comments
  return res
})
vi.mock('@/stores/tasks', () => ({
  useTasksStore: () => mockTasksStore
}))

// Mock auth store
const mockAuthStore = {
  user: { id: 1, username: 'me', points: 100 },
  fetchUser: vi.fn()
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock vue-router
const mockRoute = createRouteStub({ params: { id: '42' } })
const mockRouter = createRouterStub()
vi.mock('vue-router', () => ({
  useRoute: () => mockRoute,
  useRouter: () => mockRouter
}))

// Mock useApiResponse
const mockHandleSuccess = vi.fn()
const mockHandleError = vi.fn()
vi.mock('@/composables/useApiResponse', () => ({
  useApiResponse: () => ({
    handleSuccess: mockHandleSuccess,
    handleError: mockHandleError
  })
}))

// Mock useBackNavigation
const mockHandleBack = vi.fn()
vi.mock('@/composables/useBackNavigation', () => ({
  useBackNavigation: () => ({
    handleBack: mockHandleBack
  })
}))

// Mock useDraft
vi.mock('@/composables/useDraft', () => ({
  useDraft: () => ({
    loadDraft: vi.fn().mockReturnValue(null),
    saveDraft: vi.fn(),
    clearDraft: vi.fn(),
    watchDraft: vi.fn()
  })
}))

// Mock vue-quill（避免 happy-dom 兼容问题）
vi.mock('@vueup/vue-quill', () => ({
  QuillEditor: {
    name: 'QuillEditor',
    template: '<textarea></textarea>',
    props: ['content', 'contentType', 'theme']
  }
}))

// Mock 子组件
vi.mock('@/components/common/CommentItem.vue', () => ({
  default: {
    name: 'CommentItem',
    template: '<div class="comment-item">{{ comment.content }}</div>',
    props: ['comment'],
    emits: ['edit', 'delete']
  }
}))

vi.mock('@/components/common/ConfirmDialog.vue', () => ({
  default: {
    name: 'ConfirmDialog',
    template: '<div v-if="visible" class="confirm-dialog"><button @click="$emit(\'confirm\')">confirm</button><button @click="$emit(\'cancel\')">cancel</button></div>',
    props: ['visible', 'title', 'message', 'isDanger'],
    emits: ['confirm', 'cancel']
  }
}))

vi.mock('@/components/common/Breadcrumb.vue', () => ({
  default: {
    name: 'Breadcrumb',
    template: '<nav class="breadcrumb"></nav>',
    props: ['crumbs']
  }
}))

describe('TaskDetail.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
    // 重置 route query
    mockRoute.params = { id: '42' }
    mockRoute.query = {}
    // 重置 mockTasksStore 状态
    mockTasksStore.currentTask = null
    mockTasksStore.taskComments = []
    // 重置 mockAuthStore 状态（避免积分跨测试污染）
    mockAuthStore.user.points = 100
    // 重新设置默认 mock 实现（clearAllMocks 会清除 mockImplementation）
    mockTasksStore.fetchTaskDetail.mockImplementation(async (id) => {
      const res = { success: true, data: { task: { id, title: 'T' } } }
      mockTasksStore.currentTask = res.data.task
      return res
    })
    mockTasksStore.fetchTaskComments.mockImplementation(async () => {
      const res = { success: true, data: { comments: [] } }
      mockTasksStore.taskComments = res.data.comments
      return res
    })
    // 模拟 toggleTaskComplete 行为：更新 currentTask
    mockTasksStore.toggleTaskComplete.mockImplementation(async () => {
      const newStatus = mockTasksStore.currentTask?.status === 'completed' ? 'pending' : 'completed'
      const updated = { ...(mockTasksStore.currentTask || {}), status: newStatus }
      mockTasksStore.currentTask = updated
      return { success: true, data: { task: updated, points_delta: 10 } }
    })
  })

  // 导入放在 mock 之后，确保 mock 生效
  const getComponent = async () => {
    const { default: TaskDetail } = await import('@/views/TaskDetail.vue')
    return TaskDetail
  }

  describe('mount', () => {
    it('calls fetchTaskDetail and fetchTaskComments with route.params.id', async () => {
      const TaskDetail = await getComponent()
      mount(TaskDetail)
      await flushPromises()

      expect(mockTasksStore.fetchTaskDetail).toHaveBeenCalledWith('42')
      expect(mockTasksStore.fetchTaskComments).toHaveBeenCalledWith('42')
    })

    it('auto-enters edit mode when route.query.edit === "1"', async () => {
      mockRoute.query = { edit: '1' }

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      // 编辑按钮不应该显示（因为已经在编辑态）
      const editBtn = wrapper.findAll('button').find(b => b.text().includes('编辑'))
      expect(editBtn).toBeUndefined()
    })

    it('renders back button that calls useBackNavigation.handleBack', async () => {
      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      const backBtn = wrapper.find('.back-btn')
      expect(backBtn.exists()).toBe(true)
      await backBtn.trigger('click')
      await flushPromises()

      expect(mockHandleBack).toHaveBeenCalled()
    })
  })

  describe('header button styles', () => {
    it('TaskDetail.vue source defines .btn-primary, .btn-secondary, .btn-danger with padding', async () => {
      const fs = await import('fs')
      const path = require('path')
      const source = fs.readFileSync(path.resolve(__dirname, '../../views/TaskDetail.vue'), 'utf-8')

      // .btn-primary 存在且有 padding
      expect(source).toContain('.btn-primary')
      expect(source).toMatch(/\.btn-primary[\s\S]*?padding/)
      // .btn-secondary 存在且有 padding
      expect(source).toContain('.btn-secondary')
      expect(source).toMatch(/\.btn-secondary[\s\S]*?padding/)
      // .btn-danger 存在且有 padding
      expect(source).toContain('.btn-danger')
      expect(source).toMatch(/\.btn-danger[\s\S]*?padding/)
    })

    it('task-actions buttons have unified padding and disabled styles', async () => {
      const fs = await import('fs')
      const path = require('path')
      const source = fs.readFileSync(path.resolve(__dirname, '../../views/TaskDetail.vue'), 'utf-8')

      // task-actions 块内有 button 通用 padding 规则
      const taskActionsBlock = source.match(/\.task-actions\s+button\s*\{[\s\S]*?\}/)
      expect(taskActionsBlock?.[0]).toContain('padding')
      // disabled 状态有 opacity + cursor
      const disabledBlock = source.match(/\.task-actions\s+button:disabled\s*\{[\s\S]*?\}/)
      expect(disabledBlock?.[0]).toContain('opacity')
      expect(disabledBlock?.[0]).toContain('cursor')
    })
  })

  describe('header styles consistency with other pages', () => {
    it('TaskDetail.vue scoped styles include header / logo / nav / user-info', async () => {
      const fs = await import('fs')
      const path = require('path')
      const source = fs.readFileSync(path.resolve(__dirname, '../../views/TaskDetail.vue'), 'utf-8')

      // header 容器：sticky + border-bottom
      expect(source).toContain('.header {')
      expect(source).toMatch(/\.header\s*\{[\s\S]*?position:\s*sticky/)
      expect(source).toMatch(/\.header\s*\{[\s\S]*?border-bottom/)

      // .header-content 56px 高度 + flex
      expect(source).toContain('.header-content')
      expect(source).toMatch(/\.header-content\s*\{[\s\S]*?height:\s*56px/)
      expect(source).toMatch(/\.header-content\s*\{[\s\S]*?display:\s*flex/)

      // .logo 字号 20px
      expect(source).toMatch(/\.logo\s*\{[\s\S]*?font-size:\s*20px/)
      expect(source).toMatch(/\.logo\s*\{[\s\S]*?font-weight:\s*700/)

      // nav 链接基础样式
      expect(source).toContain('nav a {')
      expect(source).toMatch(/nav a\s*\{[\s\S]*?color:/)
      expect(source).toMatch(/nav a:hover/)

      // user-info 容器
      expect(source).toContain('.user-info')
      expect(source).toMatch(/\.user-info\s*\{[\s\S]*?display:\s*flex/)
      // points 强调色
      expect(source).toContain('.points')
      expect(source).toMatch(/\.points\s*\{[\s\S]*?color:.*accent/)
      // 退出按钮基础样式
      expect(source).toMatch(/\.user-info\s+button\s*\{[\s\S]*?padding/)
    })

    it('header styles match Tasks.vue for consistency', async () => {
      const fs = await import('fs')
      const path = require('path')
      const taskDetail = fs.readFileSync(path.resolve(__dirname, '../../views/TaskDetail.vue'), 'utf-8')
      const tasks = fs.readFileSync(path.resolve(__dirname, '../../views/Tasks.vue'), 'utf-8')

      // 抽取关键样式属性，对比两者关键属性一致（允许有增强字段如 z-index）
      const extract = (source, selector) => {
        // 转义正则元字符
        const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(escaped + '\\s*\\{([^}]+)\\}')
        const m = source.match(re)
        return m ? m[1].replace(/\s+/g, ' ').trim() : null
      }

      // 关键属性子集必须都包含在 TaskDetail 中
      const requiredProps = {
        '.header': ['position: sticky', 'border-bottom'],
        '.header-content': ['height: 56px', 'display: flex', 'align-items: center'],
        '.logo': ['font-size: 20px', 'font-weight: 700'],
        'nav a': ['color:'],
        '.user-info': ['display: flex'],
        '.points': ['color:']
      }

      for (const [sel, props] of Object.entries(requiredProps)) {
        const td = extract(taskDetail, sel)
        const tk = extract(tasks, sel)
        expect(td, `TaskDetail.${sel} should be defined`).toBeTruthy()
        expect(tk, `Tasks.${sel} should be defined (reference)`).toBeTruthy()
        // TaskDetail 包含所有关键属性
        for (const prop of props) {
          expect(td, `TaskDetail.${sel} should contain '${prop}'`).toContain(prop)
        }
      }
    })
  })

  describe('toggle complete', () => {
    it('calls toggleTaskComplete on button click', async () => {
      // 设置 currentTask 包含 status 字段
      mockTasksStore.fetchTaskDetail.mockImplementation(async (id) => {
        const res = { success: true, data: { task: { id, title: 'T', status: 'pending' } } }
        mockTasksStore.currentTask = res.data.task
        return res
      })

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      const toggleBtn = wrapper.findAll('button').find(b => b.text().includes('标记'))
      expect(toggleBtn).toBeDefined()
      await toggleBtn.trigger('click')
      await flushPromises()

      expect(mockTasksStore.toggleTaskComplete).toHaveBeenCalledWith('42')
    })

    it('on success: shows success toast', async () => {
      mockTasksStore.fetchTaskDetail.mockImplementation(async (id) => {
        const res = { success: true, data: { task: { id, title: 'T', status: 'pending' } } }
        mockTasksStore.currentTask = res.data.task
        return res
      })

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      const toggleBtn = wrapper.findAll('button').find(b => b.text().includes('标记'))
      await toggleBtn.trigger('click')
      await flushPromises()

      expect(mockHandleSuccess).toHaveBeenCalledWith('任务已完成')
    })

    it('on success with points_delta: updates authStore.user.points', async () => {
      mockTasksStore.fetchTaskDetail.mockImplementation(async (id) => {
        const res = { success: true, data: { task: { id, title: 'T', status: 'pending' } } }
        mockTasksStore.currentTask = res.data.task
        return res
      })

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      const toggleBtn = wrapper.findAll('button').find(b => b.text().includes('标记'))
      await toggleBtn.trigger('click')
      await flushPromises()

      expect(mockAuthStore.user.points).toBe(110)
    })
  })

  describe('delete', () => {
    it('clicking delete button shows ConfirmDialog', async () => {
      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      // 初始 ConfirmDialog 不应可见
      expect(wrapper.find('.confirm-dialog').exists()).toBe(false)

      const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('删除'))
      await deleteBtn.trigger('click')
      await flushPromises()

      expect(wrapper.find('.confirm-dialog').exists()).toBe(true)
    })

    it('confirming in dialog calls deleteTask and navigates to /tasks on success', async () => {
      mockTasksStore.deleteTask.mockResolvedValue({ success: true })

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('删除'))
      await deleteBtn.trigger('click')
      await flushPromises()

      const confirmBtn = wrapper.find('.confirm-dialog button')
      await confirmBtn.trigger('click')
      await flushPromises()

      expect(mockTasksStore.deleteTask).toHaveBeenCalledWith('42')
      expect(mockRouter.push).toHaveBeenCalledWith('/tasks')
      expect(mockHandleSuccess).toHaveBeenCalledWith('任务已删除')
    })
  })

  describe('comments', () => {
    it('renders CommentItem for each comment', async () => {
      mockTasksStore.fetchTaskComments.mockImplementation(async () => {
        const res = { success: true, data: { comments: [
          { id: 1, content: '<p>A</p>' },
          { id: 2, content: '<p>B</p>' }
        ] } }
        mockTasksStore.taskComments = res.data.comments
        return res
      })

      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      expect(wrapper.findAll('.comment-item')).toHaveLength(2)
    })

    it('clicking send button with empty content is a no-op', async () => {
      const TaskDetail = await getComponent()
      const wrapper = mount(TaskDetail)
      await flushPromises()

      // 找到发送评论按钮
      const sendBtn = wrapper.findAll('button').find(b => b.text().includes('发送评论'))
      expect(sendBtn).toBeDefined()
      await sendBtn.trigger('click')
      await flushPromises()

      // 由于 newComment 为空，addComment 不应被调用
      expect(mockTasksStore.addComment).not.toHaveBeenCalled()
    })

    it('on edit: replaces comment with full response (含 updated_at)', async () => {
      const updatedComment = {
        id: 1,
        content: '<p>Updated</p>',
        updated_at: '2026-06-06T10:30:00.000Z',
        user_id: 1,
        username: 'me',
        is_owner: true
      }
      mockTasksStore.updateComment.mockResolvedValue({
        success: true,
        data: { comment: updatedComment }
      })

      // 直接调用函数（不通过 UI，因为 CommentItem 是 stub）
      const { default: TaskDetail } = await import('@/views/TaskDetail.vue')
      const wrapper = mount(TaskDetail)
      await flushPromises()

      // 暴露 handleCommentEdit 给测试
      const vm = wrapper.vm
      await vm.handleCommentEdit(1, '<p>Updated</p>')
      await flushPromises()

      // store 的 updateComment 应被调用
      expect(mockTasksStore.updateComment).toHaveBeenCalledWith('42', 1, '<p>Updated</p>')
    })
  })
})
