<template>
  <div
      :class="{
      _interactive: interactive || autoClose,
      _active: active,
    }"
      class="ui-dropdown-item"
      @click="handleClick"
  >
    <slot />
  </div>
</template>

<script setup>
import { inject } from 'vue'

const props = defineProps({
  autoClose: { type: Boolean, default: false },
  interactive: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
})

// Find parent dropdown component
const parentClose = inject('dropdownClose', null)

const handleClick = () => {
  if (props.autoClose && parentClose) {
    parentClose()
  }
}
</script>

<style lang="scss" scoped>
.ui-dropdown-item {
  padding: spacing(200, 400);
  display: flex;
  align-items: center;
  min-height: var(--ctl-h);
  white-space: nowrap;

  &._interactive {
    color: var(--text);
    cursor: pointer;

    &:hover {
      color: var(--ui-pal);
    }

    &:focus,
    &:active {
      outline: none;
    }
  }

  &._active {
    outline: none;
    color: var(--ui-pal);

    &:hover {
    }
  }
}
</style>
