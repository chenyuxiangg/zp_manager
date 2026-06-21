// B0310 — Admin mock 模块
export const mockApi = {
  listUsers(_params) {
    return { success: true, data: { users: [] } }
  },
  deleteUser(userId) {
    return { success: true, data: { deleted_id: userId } }
  },
}