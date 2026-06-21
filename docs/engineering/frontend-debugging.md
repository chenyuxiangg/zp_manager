# Frontend Debugging 指南 (B0144)

> 联调/集成测试期间高频问题排查清单

## 一、Vue DevTools 推荐

- 安装 [Vue DevTools](https://devtools.vuejs.org/) 浏览器扩展
- 主要功能：
  - 组件树检视（查看 props/state）
  - Pinia store 实时数据（auth/tasks/plans/streak）
  - 路由历史
  - Performance 火焰图

## 二、Pinia State 实时查看

```js
// 在浏览器 console:
const { useAuthStore } = await import('/src/stores/auth.js')
useAuthStore()  // 查看 user/token/isRedirecting

// 或在 Vue DevTools > Pinia tab
```

## 三、401 复现步骤

1. 打开 DevTools > Application > Local Storage
2. 删除 `token` 字段
3. 任意点击触发 API 调用（如访问 /api/users/profile）
4. 预期：软跳 `/login?reason=expired` + 红色 toast
5. 验证：URL 带 `?reason=expired`，Login.vue 显示 banner

## 四、Token 模拟工具

```js
// 在 DevTools Console 注入测试用 token（已过期）
localStorage.setItem('token', 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE2MDAwMDAwMDB9.invalidsignature')
location.reload()  // 应触发 401 → 软跳
```

## 五、Network Throttling（调试 Pomodoro 计时）

- DevTools > Network > Throttling: Slow 3G
- 验证 Pomodoro session 表记录正确性
- 离线测试：Offline → 倒计时是否本地继续

## 六、移动端 Safari 调试

1. iOS Safari > Settings > Advanced > Web Inspector 开启
2. Mac Safari > Develop > [iPhone Name] > 选页面
3. 特别注意：
   - `100vh` 在 iOS Safari 含 URL 栏
   - `localStorage` 5MB 限制
   - `matchMedia` API 支持
   - 横屏/竖屏切换触发 `resize`

## 七、ECharts 调试

- 打开 ECharts 实例：`echarts.getInstanceByDom(document.querySelector('.chart'))`
- 查看当前 option：`getOption()`
- 重设主题：调用 `chart.setOption({...})`
- 销毁：`chart.dispose()`

## 八、driver.js 引导调试

```js
// 重置引导状态
localStorage.removeItem('zpersion.onboarded')
// 重新登录触发 onMounted 检测 shouldShow
```

## 九、mock 模式（VITE_USE_MOCK=true）

- `frontend/src/mocks/index.js` 路由分发
- 单 endpoint mock：在 `if (m === 'post' && url === '...')` 块加 mock 数据
- 缺 endpoint 默认 fallthrough（不 mock）→ 真实 API 失败时不会被 catch
- 注意：`VITE_USE_MOCK` 是构建时变量，dev 修改后需 `npm run dev` 重启

## 十、Performance Profiling

- DevTools > Performance > 录制 5s
- 检查：长任务（>50ms）、重复渲染、内存泄漏
- 重点关注：Dashboard 加载、Reports 图表切换、Pomodoro 倒计时

## 十一、常见问题速查

| 现象 | 排查 |
|---|---|
| toggle 完成后无礼花 | DevTools 看 feedback.event 是否触发；检查 `<CelebrationEffect>` 挂载 |
| 401 不跳登录 | 看 `isRedirecting` flag 是否被占；检查 `auth.setRedirecting(false)` 调用点 |
| 引导 popover 空 | DevTools 查 `[data-guide="..."]` 元素是否存在 |
| 主题切换不生效 | 查 `document.documentElement.dataset.theme`；清除 `:root.auto-theme` 旧选择器 |
| Pomodoro 计时不准 | 检查 `useCountdown` 清理 timer；浏览器后台 throttle |
| mock 模式无效 | `VITE_USE_MOCK=true` 在 `.env.development`；`npm run dev` 重启 |
