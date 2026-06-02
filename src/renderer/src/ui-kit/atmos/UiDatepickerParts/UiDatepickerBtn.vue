<template>
  <button :class="btnClass" class="ui-datepicker-btn">
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  active: { type: Boolean, default: false },
  dimmed: { type: Boolean, default: false },
  control: { type: Boolean, default: false },
})

const btnClass = computed(() => {
  return {
    _active: props.active,
    _dimmed: props.dimmed,
    _control: props.control,
  }
})
</script>

<style lang="scss" scoped>
.ui-datepicker-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  border: 0 none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  outline: none;
  padding: spacing(0, 100);
  margin: 0;
  font-size: inherit;
  line-height: inherit;
  min-height: var(--ctl-h);
  min-width: var(--ctl-h);
  border-radius: var(--radius-sm);
  transition: none;

  &:hover {
    background-color: var(--bg-btn);
  }

  &._dimmed {
    opacity: 0.5;
    color: var(--text-soft);
  }

  &._active {
    background: var(--accent);
    color: var(--text);
  }

  &._active:hover {
    background: var(--accent);
    color: var(--text);
    opacity: 0.9;
  }

  &._control {
    background: var(--bg-raised);
  }
}
</style>
