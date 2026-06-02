<script setup>
import StatusLabel from './StatusLabel.vue'

const props = defineProps({ modelValue: String })
const emit = defineEmits([ 'update:modelValue' ])

const tabs = [
  { id: 'stats', label: 'Stats' },
  { id: 'dataset', label: 'Data' },
  { id: 'settings', label: 'Settings' },
]
</script>

<template>
  <header class="app-header">
    <span class="app-header_title">Brain Thing</span>
    <nav class="app-header_tabs">
      <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ _active: modelValue === tab.id }"
          @click="emit('update:modelValue', tab.id)"
      >{{ tab.label }}
      </button>
    </nav>
    <div class="app-header_separator" />
    <StatusLabel />
  </header>
</template>

<style scoped lang="scss">
.app-header {
  height: 48px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;
  border-bottom: 1px solid var(--bg-btn);
  flex-shrink: 0;

  &_title {
    font-size: var(--font-ui);
    font-weight: 600;
    color: var(--text);
  }

  &_tabs {
    display: flex;
    gap: 4px;

    button {
      all: unset;
      cursor: pointer;
      padding: 6px 12px;
      font-size: var(--font-ui);
      color: var(--text-dim);
      border-radius: 4px;

      &:hover {
        color: var(--text-soft);
      }

      &._active {
        color: var(--text);
        background: var(--bg-btn);
      }
    }
  }

  &_separator {
    width: 1px;
    height: 20px;
    background: var(--border);
  }
}
</style>
