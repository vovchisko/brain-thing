<template>
  <span class="highlight-display">
    <template v-for="(text, idx) in fields" :key="idx">
      <span :class="{ '_primary': idx === 0, '_secondary': idx > 0 }">{{ text }}</span><span v-if="idx < fields.length - 1" class="_secondary">, </span>
    </template>
  </span>
</template>

<script setup>
const props = defineProps({
  fields: { type: Array, required: true },
})
</script>

<style lang="scss" scoped>
.highlight-display {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  ._primary {
    color: var(--text);
  }

  ._secondary {
    color: var(--text-soft);
  }
}
</style>
