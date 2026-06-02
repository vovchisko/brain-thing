<template>
  <label
      :class="{'_disabled': isDisabled,  '_checked': modelValue }"
      class="ui-check"
      v-bind="{ class: $attrs.class, style: $attrs.style }"
      @mouseup="mouseUp"
  >
    <input
        ref="inputRef"
        :checked="modelValue"
        class="ui-check_input"
        v-bind="{...$attrs, disabled: isDisabled, type: 'checkbox', class: undefined, style: undefined}"
        @change="handleChange"
    >
    <span
        :class="{
          'ui-check_switch': switchLike,
          'ui-check_check': !switchLike,
          _loading: isLoading
        }"
        class="ui-check_box"
    >
        <svg v-if="!switchLike" class="ui-check_check-icon" viewBox="0 0 24 24">
          <path d="m7.5 12.5 4 3 5.5-8" stroke="var(--ui-pal, currentColor)" stroke-linecap="round" stroke-width="2" />
        </svg>
    </span>
    <slot />
  </label>
</template>

<script>
import { computed, defineComponent, ref } from 'vue'

export default defineComponent({
  name: 'ui-check',
  props: {
    modelValue: { type: Boolean, default: false },
    switchLike: { type: Boolean, default: false },
    thin: { type: Boolean, default: false },
    isLoading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  emits: [ 'update:modelValue', 'change', 'input' ],
  setup (props, { emit }) {
    const inputRef = ref(null)
    const isDisabled = computed(() => props.disabled || props.disabled === '')

    const mouseUp = () => {
      // oof
      setTimeout(() => inputRef.value.blur(), 0)
    }

    const handleChange = (event) => {
      event.stopPropagation()
      emit('update:modelValue', event.target.checked)
      emit('change', event)
      emit('input', event)
    }

    return { isDisabled, inputRef, mouseUp, handleChange }
  },
})
</script>
<style lang="scss" scoped>
.ui-check {
  font-size: var(--font-ui);

  user-select: none;
  display: flex;
  box-sizing: border-box;
  align-items: center;
  justify-content: stretch;
  height: var(--ctl-h);
  position: relative;
  outline: none;
  color: var(--text-soft);
  font-family: inherit;
  cursor: pointer;

  &_input {
    opacity: 0; // weird, but it's working inside the label
    position: absolute;
    left: 0;
    top: 0;
    pointer-events: none;
  }

  &_check {
    border-style: solid;
    border-width: 2px;
    border-color: var(--text-soft);
    height: 20px;
    width: 20px;
    border-radius: var(--radius-sm);
    display: flex;
    justify-content: stretch;
    align-items: stretch;
    margin-right: spacing(200);
    transition: all var(--transition);

    &-icon {
      transition: all var(--transition);
      transform: scale(0);
      width: 100%;
    }
  }

  &._checked &_check {
    border-color: var(--ui-pal);
  }

  &._checked &_check-icon {
    transform: scale(1.4);
  }

  &_switch {
    width: 38px;
    border-radius: 24px;
    background-color: var(--text-soft);
    border: 1px solid var(--text-soft);
    margin-right: spacing(200);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    height: 24px;

    --switch-left: 0;

    &:before {
      transform: translateX(var(--switch-left));
      content: "";
      display: block;
      background-color: white;
      border: 1px solid transparent;
      border-radius: 24px;
      height: calc(100% - 1px * 2);
      aspect-ratio: 1;
      transition: all var(--transition);
    }
  }

  &._checked &_switch {
    background-color: var(--ui-pal);
    border-color: var(--ui-pal);
  }

  &._checked &_switch:before {
    --switch-left: calc(38px - 24px);
    transform: translateX(var(--switch-left));
  }

  &._checked {
    color: var(--text);
  }

  &:hover:not(&._disabled) &_box {
    box-shadow: 0 5px 12px -4px rgb(var(--rgb-text), 0.2);
  }

  &:hover {
    color: var(--text);
  }

  &:focus-within &_box {
    box-shadow: 0 0 2px 4px rgba(var(--ui-rgb), 0.3);
  }

  &._disabled {
    color: var(--text-dim);
    cursor: not-allowed;
  }

  &._disabled &_check {
    border: 1px dashed var(--text-dim);
    box-shadow: none;
  }

  &._disabled &_switch {
    background-color: rgba(var(--rgb-soft), 0.25);
    border-color: transparent;
  }

  &._disabled._checked &_switch {
    background-color: rgba(var(--ui-rgb), 0.3);
  }
}

._loading {
  animation: pulse 1000ms infinite;
}

@keyframes pulse {
  40% {
    transform: scale(1.1);
    box-shadow: 0 0 0 5px rgba(var(--ui-rgb), 0.3);
  }

  80% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(var(--ui-rgb), 0);
  }

  100% {
    box-shadow: 0 0 0 0 rgba(var(--ui-rgb), 0)
  }
}
</style>
