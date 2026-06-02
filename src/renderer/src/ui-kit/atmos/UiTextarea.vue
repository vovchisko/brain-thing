<template>
  <div
      :class="{ _disabled: disabled || $attrs.readOnly !== undefined }"
      class="ui-textarea"
      v-bind="{ class: $attrs.class }"
  >
    <textarea
        ref="textarea"
        :value="modelValue"
        class="ui-textarea_textarea"
        v-bind="{ ...$attrs, disabled, class: undefined }"
        @input="handleInput"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  modelValue: {
    type: [ String, Number ],
    default: '',
  },
  autoResize: { type: Boolean, default: false },
})

const emit = defineEmits([ 'update:modelValue' ])
const textarea = ref(null)

const handleInput = e => {
  emit('update:modelValue', e.target.value)
  resize(e.target)
}

const resize = elm => {
  if (!props.autoResize) return
  elm.style.height = 'auto'
  elm.style.height = `${ elm.scrollHeight }px`
}

onMounted(() => resize(textarea.value))
</script>

<style lang="scss" scoped>
.ui-textarea {
  font-size: var(--font-ui);

  padding: 0;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: stretch;
  border: 1px solid var(--ui-pal-lateral);
  border-radius: var(--radius-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
  min-height: var(--ctl-h);
  background: var(--bg-input);

  &_textarea {
    @include scroll-styled();
    padding: spacing(300);
    margin: spacing(100, 100, 100, 0);

    color: var(--text);
    caret-color: var(--ui-pal);
    border: 0 none;
    outline: none;
    background: transparent;
    box-sizing: border-box;
    flex: 1;
    display: block;
    min-width: 0;
    max-width: unset;
    resize: vertical;
    min-height: 4em;
    max-height: 400px;
    height: var(--ctl-h);
    font-family: inherit;
    font-size: var(--font-ui);

    &::selection {
      background-color: var(--ui-pal);
      color: var(--text);
    }

    &[disabled],
    &[read-only] {
      cursor: text;
      color: var(--text-dim);
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
    box-shadow: none;
  }
}
</style>
