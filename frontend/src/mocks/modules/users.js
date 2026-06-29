// B0310 — Users / notify-config / points / profile mock 模块
// B0320: updateNotifyConfig / setOnboarded 接收到 {notify_config: {...}} 嵌套形状（与真后端契约一致）
// PR0025: notify_config 增加 current_step 字段（KPI-3 续走语义）
export const mockApi = {
  updateNotifyConfig(data) {
    // B0320: 嵌套形状 → 展平
    const incoming = data?.notify_config || data || {}
    return { success: true, data: { notify_config: { ...incoming } } }
  },
  setOnboarded(data) {
    const nested = data?.notify_config || {}
    const onboarded = typeof nested.onboarded === 'boolean' ? nested.onboarded : false
    return { success: true, data: { notify_config: { onboarded } } }
  },
  previewFrequency() {
    return { success: true, data: { estimated_per_week: 5 } }
  },
  fetchPointsHistory(_params) {
    return { success: true, data: { logs: [] } }
  },
  fetchUserProfile() {
    // PR0025: current_step 默认 null（KPI-3 续走判定）
    return { success: true, data: { id: 1, username: 'demo', email: 'demo@zpersion.app', points: 100, is_admin: false, notify_config: { onboarded: false, current_step: null } } }
  },
}
