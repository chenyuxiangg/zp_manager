<template>
  <div class="password-input">
    <input
      :type="showPassword ? 'text' : 'password'"
      :value="modelValue"
      :placeholder="placeholder"
      :class="{ 'has-error': error }"
      @input="$emit('update:modelValue', $event.target.value)"
      @blur="$emit('blur', $event)"
    />
    <button
      type="button"
      class="toggle-visibility"
      @click="showPassword = !showPassword"
      :aria-label="showPassword ? '隐藏密码' : '显示密码'"
    >
      <!-- 眼睛图标 -->
      <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-icon">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
      <!-- 眼睛划掉图标 -->
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="eye-icon">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c7 0 11-8 11-8"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      </svg>
    </button>
  </div>
  <div v-if="error" class="field-error">{{ error }}</div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  modelValue: String,
  placeholder: String,
  error: String
})

defineEmits(['update:modelValue', 'blur'])

const showPassword = ref(false)
</script>

<style scoped>
.password-input {
  position: relative;
  width: 100%;
}

.password-input input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 44px 12px 16px;
  border: 1px solid var(--color-border, #d2d2d7);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.password-input input:focus {
  border-color: var(--color-accent, #0071e3);
  box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.15);
}

.password-input input.has-error {
  border-color: var(--color-error, #ff3b30);
}

.toggle-visibility {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px;
  color: var(--color-secondary, #6e6e73);
  display: flex;
  align-items: center;
  justify-content: center;
}

.eye-icon {
  width: 20px;
  height: 20px;
  overflow: hidden;
  flex-shrink: 0;
}

.toggle-visibility:hover {
  color: var(--color-primary, #000);
}

.field-error {
  color: var(--color-error, #ff3b30);
  font-size: 12px;
  margin-top: 4px;
}
</style>