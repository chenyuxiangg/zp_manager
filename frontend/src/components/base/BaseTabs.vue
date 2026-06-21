<template>
  <div class="base-tabs" :class="`base-tabs--${direction}`">
    <div class="base-tabs__nav" role="tablist">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="base-tab"
        :class="{ 'base-tab--active': t.id === active }"
        :aria-selected="t.id === active"
        role="tab"
        @click="select(t.id)"
      >
        {{ t.label }}
      </button>
    </div>
    <div class="base-tabs__panels">
      <slot :active="active" />
    </div>
  </div>
</template>

<script setup>
defineProps({
  tabs:    { type: Array, required: true }, // [{id, label}]
  active:  { type: [String, Number], default: null },
  direction: { type: String, default: 'horizontal' }, // horizontal | vertical
})
const emit = defineEmits(['update:active'])
function select(id) { emit('update:active', id) }
</script>
