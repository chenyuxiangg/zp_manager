<template>
  <div class="base-input" :class="{ 'base-input--error': error, 'base-input--disabled': disabled }">
    <label v-if="label" :for="inputId" class="base-input__label">{{ label }}</label>
    <div class="base-input__wrap">
      <span v-if="$slots.prefix" class="base-input__prefix"><slot name="prefix" /></span>
      <input
        :id="inputId"
        class="base-input__field"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
        @blur="$emit('blur', $event)"
      />
      <span v-if="$slots.suffix" class="base-input__suffix"><slot name="suffix" /></span>
    </div>
    <p v-if="errorMessage" class="base-input__error-msg">{{ errorMessage }}</p>
  </div>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  type:    { type: String, default: 'text' },
  label:   { type: String, default: '' },
  placeholder: { type: String, default: '' },
  error:   { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  disabled:{ type: Boolean, default: false },
  id:      { type: String, default: '' },
})
const emit = defineEmits(['update:modelValue', 'blur'])
const inputId = computed(() => props.id || `bi-${Math.random().toString(36).slice(2, 8)}`)
function onInput(e) { emit('update:modelValue', e.target.value) }
</script>

<style scoped>
/* B0302: BaseInput 视觉规范 — 与 PasswordInput 对齐 */
.base-input {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.base-input__label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--space-xs);
  color: var(--color-secondary, #6e6e73);
}

.base-input__wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.base-input__field {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--color-border, #d2d2d7);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  background: var(--color-background, #fff);
  color: var(--text-primary, #000);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.base-input__field::placeholder {
  color: var(--text-placeholder, #a1a1a6);
}

.base-input__field:focus {
  border-color: var(--color-accent, #0071e3);
  box-shadow: 0 0 0 3px var(--color-accent-alpha);
}

.base-input--error .base-input__field {
  border-color: var(--color-error, #ff3b30);
}

.base-input--error .base-input__field:focus {
  box-shadow: 0 0 0 3px var(--color-error-alpha);
}

.base-input--disabled .base-input__field {
  background: var(--color-surface, #f5f5f7);
  color: var(--text-disabled, #c7c7cc);
  cursor: not-allowed;
}

.base-input__prefix,
.base-input__suffix {
  position: absolute;
  display: flex;
  align-items: center;
  color: var(--color-secondary, #6e6e73);
  pointer-events: none;
}

.base-input__prefix {
  left: 12px;
}

.base-input__suffix {
  right: 12px;
}

.base-input__prefix + .base-input__field {
  padding-left: 36px;
}

.base-input__field + .base-input__suffix ~ .base-input__field,
.base-input__wrap:has(.base-input__suffix) .base-input__field {
  padding-right: 36px;
}

.base-input__error-msg {
  color: var(--color-error, #ff3b30);
  font-size: 12px;
  margin: 4px 0 0;
}
</style>
