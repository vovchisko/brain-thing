<template>
  <button
      v-bind="{
      ...$attrs,
      type: $attrs.type || 'button',
      class: 'ui-button-link',
    }"
      @mouseup="mUp"
  >
    <slot />
  </button>
</template>

<script setup>
defineProps({
  hollow: { type: Boolean, default: false },
})

const mUp = e => e.target.blur()
</script>

<style lang="scss" scoped>
.ui-button-link {
  font-size: var(--font-ui);
  padding: spacing(0, 0);

  display: inline-block;
  box-sizing: border-box;
  cursor: pointer;
  font-family: inherit;
  border: 0 none;
  transition: all var(--transition);
  background: transparent;
  color: var(--accent);
  will-change: box-shadow, transform;
  outline: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  text-decoration: none;

  &:hover {
    text-decoration: underline;
  }

  &:focus {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  &:active {
    color: var(--accent-hover);
    text-decoration: underline;
  }

  &:disabled {
    cursor: default;
    color: var(--bg-btn);
  }
}
</style>
