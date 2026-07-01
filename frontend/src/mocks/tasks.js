// 任务相关 mock 数据
// 用于 VITE_USE_MOCK=true 时替代真实 API
// 与 SE/API契约.md 保持一致

export const MOCK_TASK = {
  id: 1,
  stage_id: 5,
  plan_id: 3,
  title: '完成数学练习册第三章',
  description: '<p>包括课后习题 1-20，重点是函数部分</p>',
  scheduled_date: '2026-06-06',
  completed_at: null,
  points: 10,
  status: 'pending',
  plan: { id: 3, title: '高考数学冲刺计划' },
  stage: { id: 5, title: '第一阶段：基础复习', plan_id: 3 }
}

export const MOCK_COMMENTS = [
  {
    id: 1,
    user_id: 5,
    user: 'alice',
    username: 'alice',
    content: '<p>看起来不错，加油！</p>',
    created_at: '2026-06-05T10:00:00.000Z',
    updated_at: null,
    is_owner: false
  },
  {
    id: 2,
    user_id: 1,
    user: 'me',
    username: 'me',
    content: '<p>我正在做，预计 1 小时完成</p>',
    created_at: '2026-06-05T14:00:00.000Z',
    updated_at: null,
    is_owner: true
  }
]

export const MOCK_TOGGLE_RESPONSE = {
  task: { ...MOCK_TASK, status: 'completed', completed_at: '2026-06-06T10:00:00.000Z' },
  points_delta: 10
}

const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms))

// 模拟内存中的任务列表（用于 fetchTodayTasks / fetchOverdueTasks / fetchAllTasks）
// PR0025: 扩充超期任务到 7 条覆盖 4 个日期，便于肉眼验证 Dashboard 堆叠卡片分组
const MOCK_TASKS_LIST = [
  // 今天 (2026-06-06) — 今日任务
  { id: 1, title: '完成数学练习册第三章', scheduled_date: '2026-06-06', points: 10, status: 'pending', plan_id: 3, stage_id: 5 },
  { id: 2, title: '英语单词背诵 50 个', scheduled_date: '2026-06-06', points: 5, status: 'pending', plan_id: 3, stage_id: 5 },

  // --- 超期：2026-06-05 (1 天前) — warning ---
  { id: 3, title: '物理习题第二章', scheduled_date: '2026-06-05', description: '<p>包括牛顿定律部分</p>', points: 8, status: 'overdue', plan_id: 3, stage_id: 5 },
  { id: 4, title: '生物复习笔记整理', scheduled_date: '2026-06-05', description: '<p>细胞分裂章节</p>', points: 6, status: 'overdue', plan_id: 3, stage_id: 5 },

  // --- 超期：2026-06-03 (3 天前) — warning ---
  { id: 5, title: '化学实验报告', scheduled_date: '2026-06-03', description: '<p>酸碱中和实验</p>', points: 12, status: 'overdue', plan_id: 3, stage_id: 6 },
  { id: 6, title: '数学错题本整理', scheduled_date: '2026-06-03', points: 6, status: 'overdue', plan_id: 3, stage_id: 5 },

  // --- 超期：2026-05-30 (7 天前) — severe ---
  { id: 7, title: '历史时间轴绘制', scheduled_date: '2026-05-30', description: '<p>近代史部分</p>', points: 15, status: 'overdue', plan_id: 4, stage_id: 7 },
  { id: 8, title: '政治时事整理', scheduled_date: '2026-05-30', points: 8, status: 'overdue', plan_id: 4, stage_id: 7 },

  // --- 超期：2026-05-23 (14 天前) — severe，堆叠最顶的卡片 ---
  { id: 9, title: '语文古诗背诵', scheduled_date: '2026-05-23', description: '<p>将进酒 / 静夜思</p>', points: 5, status: 'overdue', plan_id: 4, stage_id: 7 },

  // 已完成任务（上下文）
  { id: 10, title: '已完成任务示例', scheduled_date: '2026-06-04', points: 5, status: 'completed', completed_at: '2026-06-04T18:00:00Z', plan_id: 3, stage_id: 6 }
]

export const mockApi = {
  async fetchTodayTasks() {
    await delay()
    const today = '2026-06-06'
    return { success: true, data: { tasks: MOCK_TASKS_LIST.filter(t => t.scheduled_date === today) } }
  },

  async fetchOverdueTasks() {
    await delay()
    return { success: true, data: { tasks: MOCK_TASKS_LIST.filter(t => t.status === 'overdue') } }
  },

  async fetchAllTasks() {
    await delay()
    return { success: true, data: { tasks: MOCK_TASKS_LIST } }
  },

  async completeTask(taskId) {
    await delay()
    return {
      success: true,
      data: { task: { ...MOCK_TASK, id: taskId, status: 'completed', completed_at: new Date().toISOString() } }
    }
  },

  async getTaskDetail(taskId) {
    await delay()
    return { success: true, data: { task: { ...MOCK_TASK, id: taskId } } }
  },

  async updateTask(taskId, data) {
    await delay()
    return { success: true, data: { task: { ...MOCK_TASK, id: taskId, ...data } } }
  },

  async deleteTask(taskId) {
    await delay()
    return { success: true, data: {} }
  },

  async toggleTask(taskId) {
    await delay()
    return {
      success: true,
      data: {
        task: { ...MOCK_TASK, id: taskId, status: 'completed', completed_at: new Date().toISOString() },
        points_delta: 10
      },
      message: 'Task toggled successfully'
    }
  },

  async getComments(taskId) {
    await delay()
    return { success: true, data: { comments: MOCK_COMMENTS } }
  },

  async addComment(taskId, content) {
    await delay()
    return {
      success: true,
      data: {
        comment: {
          id: Date.now(),
          user_id: 1,
          user: 'me',
          username: 'me',
          content,
          created_at: new Date().toISOString(),
          updated_at: null,
          is_owner: true
        }
      },
      message: 'Comment added'
    }
  },

  async updateComment(taskId, commentId, content) {
    await delay()
    return {
      success: true,
      data: {
        comment: {
          ...MOCK_COMMENTS[0],
          id: commentId,
          content,
          updated_at: new Date().toISOString()
        }
      },
      message: 'Comment updated'
    }
  },

  async deleteComment(taskId, commentId) {
    await delay()
    return { success: true, data: {}, message: 'Comment deleted' }
  }
}
