<template>
  <div
      :class="{'_disabled': disabled || $attrs.readOnly !== undefined, 'ui-input': !naked }"
      v-bind="{ class: $attrs.class }"
  >
    <slot />
    <slot name="left" />
    <input
        ref="inputRef"
        :class="{ _naked: naked }"
        :value="modelValue"
        class="ui-input_input"
        v-bind="{...$attrs, disabled, class: undefined}"
        @focus="handleFocus"
        @input="$emit('update:modelValue', $event.target.value)"
    >
    <slot name="right" />
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'ui-input',
  props: {
    disabled: { type: Boolean, default: false },
    autoSelect: { type: Boolean, default: false },
    autoFocus: { type: Boolean, default: false },
    naked: { type: Boolean, default: false },
    modelValue: {
      type: [ String, Number ],
      default: '',
    },
  },
  emits: [ 'update:modelValue' ],
  expose: [ 'focus' ],
  mounted () {
    if (this.autoFocus) {
      this.$nextTick(() => {
        this.focus()
      })
    }
  },
  methods: {
    focus () {
      this.$refs.inputRef.focus()
    },
    handleFocus () {
      if (this.autoSelect) this.$refs.inputRef.select()
    },
  },
})
</script>
<style lang="scss" scoped>
.ui-input {
  font-size: var(--font-ui);

  padding: 0;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: stretch;
  border: 1px solid var(--ui-pal-lateral);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
  height: var(--ctl-h);
  background: var(--bg-input);

  &_input {
    font-size: var(--font-ui);

    padding: spacing(100) spacing(400);
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

    &::selection {
      background-color: var(--ui-pal);
      color: var(--text);
    }

    &::placeholder {
      color: var(--text-dim);
    }

    &[disabled], &[read-only] {
      cursor: not-allowed;
      color: var(--text-dim);
    }

    &._naked {
      padding: 0;
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
    background: var(--bg-input);
    box-shadow: none;
  }
}
</style>
