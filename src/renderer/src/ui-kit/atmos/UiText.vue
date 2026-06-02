<template>
  <div
      :class="{
      _disabled: disabled || $attrs.readOnly !== undefined,
      'ui-text': !naked,
      _with_left: Boolean($slots.left || $slots.default),
      _with_right: Boolean($slots.right),
    }"
      v-bind="{ class: $attrs.class }"
  >
    <slot />
    <slot name="left" />
    <input
        ref="inputRef"
        :class="{
        _naked: naked,
        _with_left: Boolean($slots.left || $slots.default),
        _with_right: Boolean($slots.right),
      }"
        :type="type"
        :value="modelValue"
        class="ui-text_input"
        v-bind="{ ...$attrs, disabled, class: undefined }"
        @blur="$emit('blur', $event)"
        @focus="handleFocus"
        @input="$emit('update:modelValue', $event.target.value)"
    />
    <slot name="right" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  autoSelect: { type: Boolean, default: false },
  naked: { type: Boolean, default: false },
  type: { type: String, default: 'text' },
  modelValue: {
    type: [ String, Number ],
    default: '',
  },
})

const emit = defineEmits([ 'update:modelValue', 'focus', 'blur' ])
defineExpose({ focus })

const inputRef = ref(null)

function focus () {
  inputRef.value?.focus()
}

function handleFocus (event) {
  emit('focus', event)
  if (props.autoSelect && inputRef.value) {
    inputRef.value.select()
  }
}
</script>

<style lang="scss" scoped>
.ui-text {
  font-size: var(--font-ui);

  padding: 0;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: stretch;
  //gap: var(--ui-input-gap, #{spacing(300)});
  border-style: solid;
  border-width: 1px;
  border-color: var(--ui-pal-lateral);
  border-radius: var(--radius-md);
  transition: box-shadow var(--transition);
  height: var(--ctl-h);
  background: var(--bg-input);

  &._with_left {
    padding-left: spacing(300);
  }

  &._with_right {
    padding-right: spacing(300);
  }

  &_input {
    padding: spacing(0, 300);
    font-family: inherit;
    font-size: var(--font-ui);
    color: var(--text);
    caret-color: var(--ui-pal);
    min-height: min(100%);
    border: none;
    border-radius: 0;
    outline: none;
    background: transparent;
    box-sizing: border-box;
    flex: 1;
    display: block;
    min-width: 0;
    margin: 0;

    &::selection {
      background-color: var(--ui-pal);
      color: var(--text);
    }

    &::placeholder {
      color: var(--text-dim);
    }

    &[type='date'],
    &[type='datetime-local'] {
      position: relative;
      overflow: hidden;
      padding-right: var(--ctl-h);

      &::-webkit-calendar-picker-indicator {
        --icon-border-radius: calc(var(--radius-md) - 1px);
        min-width: var(--ctl-h);
        height: 100%;
        position: absolute;
        right: 0;
        top: 0;
        bottom: 0;
        border: 4px solid transparent;
        box-sizing: border-box;
        border-radius: 0 var(--icon-border-radius) var(--icon-border-radius) 0;
        background-color: transparent;

        &:hover {
          background-color: var(--ui-pal-lateral);
        }
      }
    }

    &[disabled],
    &[read-only] {
      cursor: not-allowed;
    }

    &._naked {
      padding: 0;
    }

    &._with_left {
      padding-left: spacing(300);
    }

    &._with_right {
      padding-right: spacing(300);
    }
  }

  &:hover {
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
    background: var(--bg-btn);
    box-shadow: none;
  }
}
</style>
