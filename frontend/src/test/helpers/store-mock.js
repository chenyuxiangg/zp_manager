// Pinia 测试工具：创建并激活一个全新的 Pinia 实例
import { setActivePinia, createPinia } from 'pinia'

export function setupTestPinia() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return pinia
}
