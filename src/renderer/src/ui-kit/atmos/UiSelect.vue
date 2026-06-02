<template>
  <label class="ui-select" v-bind="{ class: $attrs.class }">
    <select
        :value="modelValue"
        class="ui-select_select"
        v-bind="{ ...$attrs, class: undefined }"
        @input="$emit('update:modelValue', $event.target.value)"
    >
      <slot />
    </select>
    <ui-icon :name="ICON.CHEVRON_DOWN" class="ui-select_icon" />
  </label>
</template>

<script setup>
import UiIcon   from './UiIcon.vue'
import { ICON } from './UiIconParts/icon-names.js'

defineProps({
  modelValue: {
    type: [ String, Number ],
    default: '',
  },
})

defineEmits([ 'update:modelValue' ])
</script>

<style lang="scss" scoped>
.ui-select {
  font-size: var(--font-label);

  position: relative;
  padding: 0;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: stretch;
  border-style: solid;
  border-width: 1px;
  border-color: var(--ui-pal-lateral);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition),  box-shadow var(--transition);
  height: var(--ctl-h);
  background: var(--bg-input);

  &_select {
    font-size: var(--font-label);
    -webkit-appearance: none;
    appearance: none;
    padding: spacing(200, 100, 200, 400);
    font-family: inherit;
    color: var(--text);
    caret-color: var(--ui-pal);
    min-height: min(100%);
    border: none;
    outline: none;
    background: transparent;
    box-sizing: border-box;
    flex: 1;
    display: block;
    min-width: 0;
    margin: 0;

    &[disabled] {
      cursor: not-allowed;
      background: var(--bg-btn);
    }

    &:deep(option) {
      line-height: var(--ctl-h);
      background: var(--bg-input);
      color: var(--text);
    }
  }

  &_icon {
    position: absolute;
    right: spacing(400);
    pointer-events: none;
    --icon-size: 16px;
  }

  &:hover:not([disabled]) {
    outline: none;
    box-shadow: 0 5px 12px -4px rgb(var(--rgb-text), 0.2);
  }

  &:focus-within {
    outline: none;
    box-shadow: 0 0 0 0 var(--ui-pal);
    border-color: var(--ui-pal);
  }

  &._disabled {
    border: 1px dashed var(--text-dim);
    background: var(--bg-input);
    box-shadow: none;
  }
}
</style>
