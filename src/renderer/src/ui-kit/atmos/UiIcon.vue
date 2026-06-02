<template>
  <span class="ui-icon" v-bind="$attrs">{{ EMOJI[name] || '◆' }}</span>
</template>

<script setup>
const EMOJI = {
  'calendar':      '📅',
  'chevron-down':  '▼',
  'chevron-left':  '◀',
  'chevron-right': '▶',
  'chevron-up':    '▲',
  'cross':         '✕',
  'filter':        '🔍',
  'pen-frame':     '✏️',
  'trash':         '🗑️',
  'profile':       '👤',
  'menu':          '☰',
}

defineProps({
  name: { type: String, required: true },
})
</script>

<style lang="scss" scoped>
.ui-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: var(--icon-size, 1em);
  line-height: 1;
}
</style>
