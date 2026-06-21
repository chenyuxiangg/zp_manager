// v2.18.1 — restartOnboarding 业务闭环契约
// v2.17 漏报：Settings.vue 调 setOnboarded(false) + router.push('/dashboard') 后，
// App.vue 没 watch onboarded 变化，引导不会自启
// 修复：抽 useOnboardingWatcher() composable 合并两个 watch（v2.18.1 改进 a）

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const APP = readFileSync(resolve(__dirname, '../../App.vue'), 'utf-8')
const COMPOSABLE = readFileSync(resolve(__dirname, '../../composables/useOnboardingWatcher.js'), 'utf-8')

describe('【v2.18.1 restartOnboarding 业务闭环】', () => {
  describe('App.vue 契约', () => {
    it('导入 useOnboardingGuide', () => {
      expect(APP).toMatch(/import\s*\{[^}]*useOnboardingGuide[^}]*\}\s*from\s*['"]@\/composables\/useOnboardingGuide['"]/)
    })

    it('导入 useAuthStore', () => {
      expect(APP).toMatch(/import\s*\{[^}]*useAuthStore[^}]*\}\s*from\s*['"]@\/stores\/auth['"]/)
    })

    it('v2.18.1 抽到 composable：调用 useOnboardingWatcher()', () => {
      expect(APP).toMatch(/useOnboardingWatcher\s*\(/)
      expect(APP).toMatch(/import\s*\{[^}]*useOnboardingWatcher[^}]*\}\s*from\s+['"]@\/composables\/useOnboardingWatcher['"]/)
    })
  })

  describe('useOnboardingWatcher.js 契约', () => {
    it('watch auth.user（登出清 onboarded）', () => {
      // 第一个 watch 处理 user 变化（prev && !u → 清 onboarded）
      expect(COMPOSABLE).toMatch(/watch[\s\S]*?auth\.user/)
      expect(COMPOSABLE).toMatch(/prev\s*&&\s*!u/)
      expect(COMPOSABLE).toMatch(/removeItem\s*\(/)
    })

    it('watch auth.user?.notify_config?.onboarded（restartOnboarding 启动）', () => {
      expect(COMPOSABLE).toMatch(/notify_config\?\.onboarded/)
    })

    it('onboarded 从 true 变 false 时调 startTour', () => {
      expect(COMPOSABLE).toMatch(/startTour\s*\(/)
      expect(COMPOSABLE).toMatch(/oldVal\s*===\s*true/)
      expect(COMPOSABLE).toMatch(/newVal\s*===\s*false/)
    })
  })
})