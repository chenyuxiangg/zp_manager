// Mock 路由分发：将 axios 请求路由到对应的 mock 函数
// 用于 VITE_USE_MOCK=true 时替代真实 API

import * as tasks from './tasks'
import * as auth from './auth'

const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 路由 mock 请求
 * @param {string} method - HTTP 方法
 * @param {string} url - 请求 URL（不含 baseURL）
 * @param {object} data - 请求体（POST/PUT/PATCH）
 * @returns {Promise<object>|null} 成功返回 mock 响应，null 表示未匹配
 */
export async function handleMock(method, url, data) {
  const m = method.toLowerCase()

  // ==================== Auth ====================
  if (m === 'post' && url === '/auth/login') {
    return auth.mockAuth.login(data?.email, data?.password)
  }
  if (m === 'post' && url === '/auth/register') {
    return auth.mockAuth.register(data?.username, data?.email, data?.password)
  }
  if (m === 'get' && url === '/auth/me') {
    return auth.mockAuth.fetchUser()
  }
  if (m === 'post' && url === '/auth/logout') {
    return auth.mockAuth.logout()
  }

  // ==================== Tasks 列表 ====================
  if (m === 'get' && url === '/tasks/today') return tasks.mockApi.fetchTodayTasks()
  if (m === 'get' && url === '/tasks/overdue') return tasks.mockApi.fetchOverdueTasks()
  if (m === 'get' && url === '/tasks') return tasks.mockApi.fetchAllTasks()

  // ==================== Task 详情/操作（路径含数字 id） ====================
  const taskDetailMatch = url.match(/^\/tasks\/(\d+)$/)
  if (taskDetailMatch) {
    const id = parseInt(taskDetailMatch[1])
    if (m === 'get') return tasks.mockApi.getTaskDetail(id)
    if (m === 'put') return tasks.mockApi.updateTask(id, data)
    if (m === 'delete') return tasks.mockApi.deleteTask(id)
  }

  // PUT /tasks/:id/complete（旧接口，保留向后兼容）
  const completeMatch = url.match(/^\/tasks\/(\d+)\/complete$/)
  if (completeMatch && m === 'put') {
    return tasks.mockApi.completeTask(parseInt(completeMatch[1]))
  }

  // PATCH /tasks/:id/toggle（新接口）
  const toggleMatch = url.match(/^\/tasks\/(\d+)\/toggle$/)
  if (toggleMatch && m === 'patch') {
    return tasks.mockApi.toggleTask(parseInt(toggleMatch[1]))
  }

  // ==================== Comments ====================
  const commentsMatch = url.match(/^\/tasks\/(\d+)\/comments$/)
  if (commentsMatch) {
    const taskId = parseInt(commentsMatch[1])
    if (m === 'get') return tasks.mockApi.getComments(taskId)
    if (m === 'post') return tasks.mockApi.addComment(taskId, data?.content)
  }

  const commentItemMatch = url.match(/^\/tasks\/(\d+)\/comments\/(\d+)$/)
  if (commentItemMatch) {
    const taskId = parseInt(commentItemMatch[1])
    const commentId = parseInt(commentItemMatch[2])
    if (m === 'put') return tasks.mockApi.updateComment(taskId, commentId, data?.content)
    if (m === 'delete') return tasks.mockApi.deleteComment(taskId, commentId)
  }

  // 未匹配
  return null
}
