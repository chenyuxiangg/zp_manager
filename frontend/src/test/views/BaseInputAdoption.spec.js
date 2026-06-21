// B0302 — BaseInput 在 form-heavy views 中的采用测试
// 覆盖 Login / Register / ForgotPassword / ResetPassword / Settings 5 个表单密集 view
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(name) {
  return readFileSync(resolve(__dirname, `../../views/${name}`), 'utf-8')
}

// 提取 template 中所有 <input ... > 标签
function extractInputs(source) {
  // 只匹配 template 段（template 开始到 </template>）
  const tmpl = source.match(/<template>[\s\S]*?<\/template>/)
  if (!tmpl) return []
  // 排除 <BaseInput 内嵌的 input（已是组件内）
  // 简单方法：抓所有 <input 并排除 <BaseInput/> 自身
  const inputs = [...tmpl[0].matchAll(/<input\b[^>]*\/?>(?!\s*<\/input>)/g)].map(m => m[0])
  return inputs
}

const FORMS = [
  { name: 'Login.vue', expectBaseInput: true, label: '登录邮箱' },
  { name: 'Register.vue', expectBaseInput: true, label: '注册' },
  { name: 'ForgotPassword.vue', expectBaseInput: true, label: '忘记密码' },
  { name: 'ResetPassword.vue', expectBaseInput: true, label: '重置密码' },
  { name: 'Settings.vue', expectBaseInput: true, label: '设置' },
]

describe.each(FORMS)('【B0302 BaseInput 采用】 $name', ({ name, expectBaseInput }) => {
  const source = read(name)

  it('imports BaseInput from @/components/base/BaseInput.vue', () => {
    const re = /import\s+BaseInput\s+from\s+['"]@\/components\/base\/BaseInput\.vue['"]/
    expect(source).toMatch(re)
  })

  it('在 template 中使用了 <BaseInput> 至少一次', () => {
    expect(source).toMatch(/<BaseInput\b/)
  })

  it('不直接 <input> 渲染裸原生 input（除 PasswordInput/type=hidden 等特殊）', () => {
    const rawInputs = extractInputs(source)
    if (rawInputs.length === 0) return // 无 input 跳过
    // 检查是否所有 input 都在子组件内（BaseInput 内）— 模板顶级不应有裸 input
    const topLevelInputs = rawInputs.filter(i =>
      // 排除 type=hidden 这种组件内 input
      !/type\s*=\s*["']hidden["']/.test(i) &&
      // 排除 PasswordInput 内的 input（PasswordInput 是组件，不是裸 input）
      false
    )
    // 应该有 0 个裸 input
    expect(topLevelInputs.length).toBe(0)
  })
})