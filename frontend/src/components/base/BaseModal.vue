<template>
  <Teleport to="body">
    <Transition name="base-modal">
      <div v-if="modelValue" class="base-modal" :class="`base-modal--${size}`" @keydown.esc="onEsc">
        <div class="base-modal__overlay" @click.self="onOutside" />
        <div class="base-modal__panel" role="dialog" aria-modal="true">
          <header v-if="title || $slots.header" class="base-modal__header">
            <slot name="header">
              <h3 class="base-modal__title">{{ title }}</h3>
            </slot>
            <button v-if="closable" class="base-modal__close" aria-label="关闭" @click="close">×</button>
          </header>
          <div class="base-modal__body"><slot /></div>
          <footer v-if="$slots.footer" class="base-modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
const props = defineProps({
  modelValue: { type: Boolean, required: true },
  title:      { type: String, default: '' },
  size:       { type: String, default: 'md' }, // sm | md | lg | full
  closeOnEsc: { type: Boolean, default: true },
  closeOnOutside: { type: Boolean, default: true },
  closable:   { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue', 'close'])
function close() {
  emit('update:modelValue', false)
  emit('close')
}
function onEsc(e) {
  if (props.closeOnEsc && e.key === 'Escape') close()
}
function onOutside() {
  if (props.closeOnOutside) close()
}
</script>
