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
