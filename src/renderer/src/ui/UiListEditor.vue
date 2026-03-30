<script setup>
import { ref } from 'vue'

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  placeholder: { type: String, default: 'Add item...' },
})

const emit = defineEmits(['update:modelValue'])
const input = ref('')

function add() {
  const val = input.value.trim()
  if (!val || props.modelValue.includes(val)) return
  emit('update:modelValue', [...props.modelValue, val])
  input.value = ''
}

function remove(index) {
  const next = [...props.modelValue]
  next.splice(index, 1)
  emit('update:modelValue', next)
}

function onKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); add() }
}
</script>

<template>
  <div class="list-editor">
    <div v-if="modelValue.length" class="list-editor_items">
      <span v-for="(item, i) in modelValue" :key="i" class="list-editor_chip">
        {{ item }}
        <button class="list-editor_remove" @click="remove(i)">&times;</button>
      </span>
    </div>
    <div class="list-editor_add">
      <input v-model="input" class="g-input list-editor_input" :placeholder="placeholder" spellcheck="false" @keydown="onKeydown" />
      <button class="g-btn" :disabled="!input.trim()" @click="add">Add</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.list-editor {
  width: 100%;

  &_items {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }
  &_chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    background: var(--bg-btn);
    color: var(--text);
    font-size: var(--font-xs);
    font-family: monospace;
  }
  &_remove {
    all: unset;
    cursor: pointer;
    color: var(--text-dim);
    font-size: var(--font-sm);
    line-height: 1;
    padding: 0 2px;
    &:hover { color: var(--negative); }
  }
  &_add {
    display: flex;
    gap: 8px;
  }
  &_input {
    flex: 1;
    padding: 6px 8px;
    font-size: var(--font-xs);
  }
}
</style>
