<template>
  <div class="layout">
    <main class="main-content">
      <div class="settings-page">
        <h1>设置</h1>
        <div class="settings-section glass">
          <h2>个人信息</h2>
          <div class="info-row">
            <span class="label">用户名</span>
            <span>{{ authStore.user?.username }}</span>
          </div>
          <div class="info-row">
            <span class="label">邮箱</span>
            <span>{{ authStore.user?.email }}</span>
          </div>
        </div>
        <div class="settings-section glass">
          <h2>提醒设置</h2>
          <div class="form-group">
            <label>学习提醒</label>
            <select v-model="notifyConfig.learn_reminder.timing">
              <option value="1 day">提前1天</option>
              <option value="2 days">提前2天</option>
              <option value="1 hour">提前1小时</option>
            </select>
          </div>
          <div class="form-group">
            <label>验收提醒</label>
            <select v-model="notifyConfig.verify_reminder.timing">
              <option value="on due">到期当天</option>
              <option value="1 day">提前1天</option>
            </select>
          </div>
          <button @click="saveNotifyConfig" :disabled="saving">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>

        <!-- B0253: 番茄钟设置 (PR0022 §3 共享 Settings 入口) -->
        <div class="settings-section glass">
          <h2>番茄钟</h2>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.pomodoro.break_enabled" />
              专注后开启休息
            </label>
          </div>
          <div class="form-group">
            <!-- B0302: 迁 BaseInput (number 类型) -->
            <BaseInput
              type="number"
              label="休息时长（分钟）"
              :model-value="notifyConfig.pomodoro.break_minutes"
              @update:model-value="(v) => notifyConfig.pomodoro.break_minutes = Number(v)"
              :min="1"
              :max="30"
            />
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.pomodoro.background_keep_alive" />
              后台运行时继续计时
            </label>
          </div>
        </div>

        <!-- B0253: Streak 里程碑 (PR0009) -->
        <div class="settings-section glass">
          <h2>Streak 里程碑</h2>
          <div class="form-group">
            <label>当前目标</label>
            <select v-model.number="notifyConfig.streak.next_milestone">
              <option :value="7">7 天</option>
              <option :value="30">30 天</option>
              <option :value="100">100 天</option>
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.streak.flame_visible" />
              仪表盘显示火焰图标
            </label>
          </div>
        </div>

        <!-- B0253: 引导与新功能 (PR0012) -->
        <div class="settings-section glass">
          <h2>引导与新功能</h2>
          <button @click="restartOnboarding">重新观看 5 步引导</button>
        </div>

        <!-- B0341: 账号 section（PR0013 §9 承诺的 Settings 登出入口） -->
        <div class="settings-section glass">
          <h2>账号</h2>
          <button
            class="btn-logout"
            :disabled="loading"
            data-testid="settings-logout-btn"
            @click="handleLogout"
          >{{ loading ? '退出中...' : '退出登录' }}</button>
        </div>

        <div class="settings-section glass">
          <h2>积分历史</h2>
          <div v-if="pointsHistory.length" class="points-history">
            <div v-for="log in pointsHistory" :key="log.id" class="points-log-item">
              <div class="log-info">
                <span :class="log.delta > 0 ? 'delta-positive' : 'delta-negative'">
                  {{ log.delta > 0 ? '+' : '' }}{{ log.delta }}
                </span>
                <span class="log-reason">{{ log.reason }}</span>
              </div>
              <div class="log-time">{{ log.created_at }}</div>
            </div>
          </div>
          <div v-else class="empty-state">暂无积分记录</div>
          <button v-if="hasMore" @click="loadMorePoints" class="btn-load-more">加载更多</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
// B0303: 通过 store action 调用 notify-config / points-history
// B0253: 替换 alert 为 useToast
import { useToast } from '@/composables/useToast'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'
// B0341: 复用 useLogout composable 替代原死代码 handleLogout
import { useLogout } from '@/composables/useLogout'
// B0348: 重新观看引导直接调 useOnboardingGuide().startTour()，不依赖 watcher
import { useOnboardingGuide } from '@/composables/useOnboardingGuide'
const toast = useToast()
const { handleLogout, loading } = useLogout()
const RESTART_TOUR_DELAY_MS = 1500  // 与 App.vue onMounted 节奏一致，等锚点入 DOM

const router = useRouter()
const authStore = useAuthStore()
const saving = ref(false)

// B0331: 抽 4 段默认值（含 pomodoro/streak）— 后端可能返回部分 notify_config
// （例：mock 端仅 {onboarded:false, current_step:null}，或老用户创建于这些段加入前）。
// onMounted 用 deepMerge 合并，确保缺失段回退到默认值，避免模板读 .break_enabled 崩溃。
const DEFAULT_NOTIFY_CONFIG = {
  learn_reminder: { enabled: true, timing: '1 day', channels: ['email'] },
  verify_reminder: { enabled: true, timing: 'on due', channels: ['email'] },
  email: '',
  onboarded: false,
  pomodoro: {
    break_enabled: true,
    break_minutes: 5,
    background_keep_alive: true,
  },
  streak: {
    next_milestone: 7,
    flame_visible: true,
  },
}

// 深合并：对 plain-object 段，用 defaults 兜底缺字段；其他值（boolean/string/number）以 user 为准
function deepMergeNotifyConfig(defaults, user) {
  if (!user || typeof user !== 'object' || Array.isArray(user)) return { ...defaults }
  const out = { ...defaults }
  for (const key of Object.keys(user)) {
    const u = user[key]
    const d = defaults[key]
    if (
      d && typeof d === 'object' && !Array.isArray(d) &&
      u && typeof u === 'object' && !Array.isArray(u)
    ) {
      out[key] = { ...d, ...u }
    } else {
      out[key] = u
    }
  }
  return out
}

const notifyConfig = ref(deepMergeNotifyConfig(DEFAULT_NOTIFY_CONFIG, null))
const pointsHistory = ref([])
const currentPage = ref(1)
const hasMore = ref(false)

onMounted(async () => {
  // B0331: 深合并兜底 — 后端 notify_config 缺段（pomodoro/streak/learn_reminder）时
  // 保留 DEFAULT_NOTIFY_CONFIG 缺字段，避免模板访问 undefined.x 崩溃
  notifyConfig.value = deepMergeNotifyConfig(
    DEFAULT_NOTIFY_CONFIG,
    authStore.user?.notify_config,
  )
  await loadPointsHistory()
})

async function loadPointsHistory() {
  const res = await authStore.fetchPointsHistory({ page: 1, limit: 20 })
  if (res.success) {
    pointsHistory.value = res.data.logs || []
    hasMore.value = pointsHistory.value.length >= 20
  }
}

async function loadMorePoints() {
  currentPage.value++
  const res = await authStore.fetchPointsHistory({ page: currentPage.value, limit: 20 })
  if (res.success) {
    pointsHistory.value.push(...(res.data.logs || []))
    hasMore.value = res.data.logs?.length >= 20
  }
}

async function saveNotifyConfig() {
  saving.value = true
  // B0304: 统一 payload 形状 { onboarded, learn_reminder, ... }
  const res = await authStore.updateNotifyConfig(notifyConfig.value)
  saving.value = false
  if (res.success) {
    // B0253: 替换 alert 为 useToast.success
    toast.success('设置已保存')
  } else {
    toast.error(res.error || '保存失败')
  }
}

// B0341: 移除原死代码 handleLogout 函数（改由 useLogout composable 提供）

// B0253: 重新观看引导 (PR0012 入口)
// B0348: 直接调 useOnboardingGuide().startTour()，不再依赖 useOnboardingWatcher
// 理由：v2.18.1 引入的 watcher gate `oldVal===true && newVal===false` 在用户
//       初值 onboarded=false（mock 模式 / 从未完成引导 / 5min 窗口已过）时
//       不 fire；App.vue onMounted 不重跑——故 Settings.vue 主动启动最可靠
async function restartOnboarding() {
  try {
    // B0304: 统一端点 — setOnboarded(false) 走 PUT /users/notify-config {onboarded: false}
    await authStore.setOnboarded(false)
    // 跳 /dashboard（首步锚点 data-guide="welcome" 在 Dashboard.vue）
    router.push('/dashboard')
    // B0348: 1500ms 后启动 tour（等 Dashboard 组件渲染 + 锚点入 DOM）
    const guide = useOnboardingGuide()
    setTimeout(() => guide.startTour(), RESTART_TOUR_DELAY_MS)
  } catch (e) {
    toast.error('重启引导失败')
  }
}
</script>

<style scoped>
.layout { min-height: 100vh; background: var(--color-surface); }
.header { position: sticky; top: 0; border-bottom: 1px solid var(--color-border); }
.header-content { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-lg); height: 56px; display: flex; align-items: center; gap: var(--space-lg); }
.logo { font-size: 20px; font-weight: 700; }
nav { display: flex; gap: var(--space-md); flex: 1; }
nav a { color: var(--color-secondary); text-decoration: none; font-size: 14px; }
nav a:hover, nav a.router-link-active { color: var(--color-primary); }
.user-info { display: flex; align-items: center; gap: var(--space-md); font-size: 14px; }
.points { color: var(--color-accent); font-weight: 600; }
.user-info button { padding: 6px 12px; border: 1px solid var(--color-border); background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; }
.main-content { max-width: 800px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }
.settings-page h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-lg); }
.settings-section { padding: var(--space-lg); border-radius: 12px; border: 1px solid var(--color-card-border); margin-bottom: var(--space-lg); }
.settings-section h2 { font-size: 16px; font-weight: 600; margin-bottom: var(--space-md); }
.info-row { display: flex; gap: var(--space-md); padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border); }
.info-row:last-of-type { border-bottom: none; }
.info-row .label { color: var(--color-secondary); width: 80px; }
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: var(--space-xs); }
.form-group select { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; outline: none; }
.settings-section button { padding: 10px 20px; background: var(--color-accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.settings-section button:disabled { opacity: 0.6; }
.points-history { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md); }
.points-log-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) var(--space-md); background: var(--color-surface); border-radius: 6px; }
.log-info { display: flex; align-items: center; gap: var(--space-md); }
.delta-positive { color: var(--color-success); font-weight: 600; }
.delta-negative { color: var(--color-error); font-weight: 600; }
.log-reason { font-size: 13px; color: var(--color-secondary); }
.log-time { font-size: 12px; color: var(--color-secondary); }
.btn-load-more { margin-top: var(--space-sm); background: transparent; border: 1px solid var(--color-border); color: var(--color-secondary); }
.empty-state { text-align: center; padding: var(--space-md); color: var(--color-secondary); font-size: 13px; }

/* B0341: 账号 section 登出按钮 */
.btn-logout {
  width: 100%;
  padding: 10px 20px;
  background: transparent;
  color: var(--text-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.btn-logout:hover:not(:disabled) {
  color: var(--color-error, #dc3545);
  border-color: var(--color-error, #dc3545);
}
.btn-logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* B0342: 复合选择器覆盖 .settings-section button 的 accent 样式。
   特异性 (0,0,2,0) + Vue scoped data-v attr = 完胜 (0,0,2,2) */
.settings-section .btn-logout {
  background: transparent;
  color: var(--text-primary);
}
.settings-section .btn-logout:hover:not(:disabled) {
  color: var(--color-error, #dc3545);
  border-color: var(--color-error, #dc3545);
}
</style>