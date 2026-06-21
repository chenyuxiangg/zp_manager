// PR0014 — 7 个基元组件 + AppLayout/AuthLayout 冒烟测试
// 目标: 锁定每个基元的最小 API 契约，避免后续重构破坏调用方
// PR0014 阶段 2 的最小通过线

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// 1) BaseButton
describe('PR0014 — BaseButton', () => {
  it('【variant】4 种 variant 渲染不同类名', async () => {
    const { default: BaseButton } = await import('@/components/base/BaseButton.vue')
    for (const v of ['primary', 'secondary', 'ghost', 'danger']) {
      const w = mount(BaseButton, { props: { variant: v }, slots: { default: 'OK' } })
      expect(w.classes().join(' ')).toMatch(new RegExp(`base-button.*--${v}|--${v}`))
    }
  })

  it('【loading】loading=true 时禁用 + 显示 spinner 占位', async () => {
    const { default: BaseButton } = await import('@/components/base/BaseButton.vue')
    const w = mount(BaseButton, { props: { loading: true }, slots: { default: 'OK' } })
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.find('.base-button__spinner').exists()).toBe(true)
  })

  it('【click】click 事件向上抛', async () => {
    const { default: BaseButton } = await import('@/components/base/BaseButton.vue')
    const w = mount(BaseButton)
    await w.trigger('click')
    expect(w.emitted('click')).toBeTruthy()
  })
})

// 2) BaseCard
describe('PR0014 — BaseCard', () => {
  it('【elevation】3 种 elevation 渲染类名', async () => {
    const { default: BaseCard } = await import('@/components/base/BaseCard.vue')
    for (const e of ['flat', 'raised', 'floating']) {
      const w = mount(BaseCard, { props: { elevation: e } })
      expect(w.classes().join(' ')).toContain(`base-card--${e}`)
    }
  })

  it('【slot】默认 slot 渲染内容', async () => {
    const { default: BaseCard } = await import('@/components/base/BaseCard.vue')
    const w = mount(BaseCard, { slots: { default: '<p>hello</p>' } })
    expect(w.html()).toContain('<p>hello</p>')
  })
})

// 3) BaseInput
describe('PR0014 — BaseInput', () => {
  it('【v-model】双向绑定', async () => {
    const { default: BaseInput } = await import('@/components/base/BaseInput.vue')
    const w = mount(BaseInput, { props: { modelValue: 'abc' } })
    expect(w.find('input').element.value).toBe('abc')
    await w.find('input').setValue('xyz')
    expect(w.emitted('update:modelValue')[0]).toEqual(['xyz'])
  })

  it('【error】error=true 时加 error 类', async () => {
    const { default: BaseInput } = await import('@/components/base/BaseInput.vue')
    const w = mount(BaseInput, { props: { modelValue: '', error: true } })
    expect(w.find('.base-input').classes()).toContain('base-input--error')
  })
})

// 4) BaseModal
describe('PR0014 — BaseModal', () => {
  it('【v-model】open/close 双向绑定 + Teleport to body', async () => {
    const { default: BaseModal } = await import('@/components/base/BaseModal.vue')
    const w = mount(BaseModal, {
      props: { modelValue: true, title: 'test' },
      slots: { default: 'content' },
      attachTo: document.body,
    })
    await flushPromises()
    expect(document.body.querySelector('.base-modal')).toBeTruthy()
    await w.setProps({ modelValue: false })
    await flushPromises()
    expect(document.body.querySelector('.base-modal')).toBeFalsy()
  })
})

// 5) BaseTabs
describe('PR0014 — BaseTabs', () => {
  it('【v-model:active】点击 tab 切换 emit', async () => {
    const { default: BaseTabs } = await import('@/components/base/BaseTabs.vue')
    const w = mount(BaseTabs, {
      props: { tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }], active: 'a' },
    })
    await w.findAll('.base-tab').at(1).trigger('click')
    expect(w.emitted('update:active')[0]).toEqual(['b'])
  })
})

// 6) BaseTag
describe('PR0014 — BaseTag', () => {
  it('【variant】4 种 variant 渲染类名', async () => {
    const { default: BaseTag } = await import('@/components/base/BaseTag.vue')
    for (const v of ['neutral', 'success', 'warning', 'error']) {
      const w = mount(BaseTag, { props: { variant: v } })
      expect(w.classes().join(' ')).toContain(`base-tag--${v}`)
    }
  })
})

// 7) BaseSpinner
describe('PR0014 — BaseSpinner', () => {
  it('【size】3 种 size 渲染类名', async () => {
    const { default: BaseSpinner } = await import('@/components/base/BaseSpinner.vue')
    for (const s of ['sm', 'md', 'lg']) {
      const w = mount(BaseSpinner, { props: { size: s } })
      expect(w.classes().join(' ')).toContain(`base-spinner--${s}`)
    }
  })
})
