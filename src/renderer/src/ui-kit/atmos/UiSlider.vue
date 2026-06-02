<template>
  <div
      :class="{
      _disabled: disabled,
      '_with-tip-always': withTip === 'always',
      '_with-tip-hover': withTip === 'hover',
      _dragging: state.isDragging,
    }"
      class="ui-slider"
      v-bind="{ class: $attrs.class }"
  >
    <div class="ui-slider_wrapper" @mousedown="handleMouseDown" @touchstart="handleTouchStart">
      <div ref="trackRef" class="ui-slider_track">
        <div :style="{ width: fillWidth + '%' }" class="ui-slider_fill"></div>
        <div
            ref="thumbRef"
            :style="{ left: fillWidth + '%' }"
            class="ui-slider_thumb"
            tabindex="0"
            @keydown="handleKeyDown"
        >
          <div v-if="withTip" class="ui-slider_tip">
            {{ currentValue }}
          </div>
        </div>
      </div>
    </div>
    <ui-text
        v-if="withInput"
        v-model="inputValue"
        :disabled="disabled"
        :max="max"
        :min="min"
        :step="step"
        class="ui-slider_input"
        type="number"
        @blur="handleInputBlur"
    />
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import UiText                      from './UiText.vue'
import { roundToStep }             from '@/common/round-to-step.js'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  min: { type: [ String, Number ], default: 0 },
  max: { type: [ String, Number ], default: 100 },
  step: { type: [ String, Number ], default: 1 },
  withTip: { type: [ String, Boolean ], default: false },
  withInput: { type: Boolean, default: false },
  int: { type: Boolean, default: false },
  modelValue: {
    type: [ String, Number ],
    default: 50,
  },
})

const emit = defineEmits([ 'update:modelValue' ])
defineExpose({ focus })

const trackRef = ref(null)
const thumbRef = ref(null)

const state = reactive({
  isDragging: false,
})

const minValue = computed(() => Number(props.min))
const maxValue = computed(() => Number(props.max))
const stepValue = computed(() => Number(props.step))
const currentValue = computed(() => Number(props.modelValue))

const inputValue = computed({
  get: () => props.modelValue,
  set: value => {
    let numValue = Number(value)
    if (!isNaN(numValue)) {
      if (props.int) {
        numValue = Math.round(numValue)
      }
      const roundedValue = roundToStep(numValue, stepValue.value, minValue.value, maxValue.value)
      emit('update:modelValue', roundedValue)
    }
  },
})

const fillWidth = computed(() => {
  const range = maxValue.value - minValue.value
  const value = currentValue.value - minValue.value
  return Math.max(0, Math.min(100, (value / range) * 100))
})

function focus () {
  thumbRef.value?.focus()
}

function updateValue (clientX) {
  if (props.disabled || !trackRef.value) return

  const rect = trackRef.value.getBoundingClientRect()
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const range = maxValue.value - minValue.value
  const rawValue = minValue.value + percentage * range
  const finalValue = props.int ? Math.round(rawValue) : rawValue
  const roundedValue = roundToStep(finalValue, stepValue.value, minValue.value, maxValue.value)

  emit('update:modelValue', roundedValue)
}

function handleMouseDown (event) {
  if (props.disabled || state.isDragging) return

  state.isDragging = true
  updateValue(event.clientX)
  thumbRef.value?.focus()

  const handleMouseMove = e => updateValue(e.clientX)
  const handleMouseUp = () => {
    state.isDragging = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

function handleTouchStart (event) {
  if (props.disabled || state.isDragging) return

  event.preventDefault()
  state.isDragging = true

  const touch = event.touches[0]
  updateValue(touch.clientX)
  thumbRef.value?.focus()

  const handleTouchMove = e => {
    e.preventDefault()
    const touch = e.touches[0]
    updateValue(touch.clientX)
  }
  const handleTouchEnd = () => {
    state.isDragging = false
    document.removeEventListener('touchmove', handleTouchMove)
    document.removeEventListener('touchend', handleTouchEnd)
  }

  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
}

function handleKeyDown (event) {
  if (props.disabled) return

  let newValue = currentValue.value

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      newValue = Math.max(minValue.value, currentValue.value - stepValue.value)
      break
    case 'ArrowRight':
    case 'ArrowUp':
      newValue = Math.min(maxValue.value, currentValue.value + stepValue.value)
      break
    default:
      return
  }

  event.preventDefault()
  const roundedValue = roundToStep(newValue, stepValue.value, minValue.value, maxValue.value)
  emit('update:modelValue', roundedValue)
}

function handleInputBlur (event) {
  const inputValue = event.target.value
  let numValue = Number(inputValue)
  if (!isNaN(numValue)) {
    if (props.int) {
      numValue = Math.round(numValue)
    }
    const roundedValue = roundToStep(numValue, stepValue.value, minValue.value, maxValue.value)
    if (roundedValue !== Number(inputValue)) {
      emit('update:modelValue', roundedValue)
      event.target.value = roundedValue
    }
  }
}
</script>

<style lang="scss" scoped>
.ui-slider {
  display: flex;
  align-items: center;
  height: var(--ctl-h);
  padding: 0 calc(16px / 2);
  user-select: none;
  gap: spacing(300);

  &_wrapper {
    display: flex;
    align-items: center;
    height: var(--ctl-h);
    flex: 1;
  }

  &_track {
    position: relative;
    width: 100%;
    height: 6px;
    background: var(--ui-pal-lateral);
    border-radius: calc(6px / 2);
    cursor: pointer;
  }

  &_fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--ui-pal, var(--accent));
    border-radius: calc(6px / 2);
  }

  &_thumb {
    position: absolute;
    top: 50%;
    width: var(--ctl-h);
    height: var(--ctl-h);
    transform: translate(-50%, -50%);
    cursor: pointer;
    outline: none;

    &::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 16px;
      height: 16px;
      background: var(--ui-pal, var(--accent));
      border: 2px solid var(--bg-input);
      border-radius: 50%;
      transform: translate(-50%, -50%);
    }

    &:focus::before {
      outline: 2px solid var(--ui-pal, var(--accent));
      outline-offset: 0px;
    }
  }

  &_tip {
    position: absolute;
    top: calc(100% / 2);
    left: 50%;
    transform: translateX(-50%);
    padding: spacing(200, 300);
    margin-top: spacing(300);
    background: var(--bg-raised);
    color: var(--text);
    border-radius: var(--radius-md);
    font-size: var(--font-label);
    white-space: nowrap;
    pointer-events: none;
    display: none;
  }

  &._with-tip-always &_tip {
    display: block;
  }

  &._with-tip-hover:hover &_tip,
  &._with-tip-hover:focus-within &_tip,
  &._with-tip-hover._dragging &_tip {
    display: block;
  }

  &_input {
    flex-shrink: 0;
    width: 5em;
  }

  &._disabled {
    opacity: 0.6;
    pointer-events: none;

    .ui-slider_track {
      cursor: not-allowed;
    }

    .ui-slider_thumb {
      cursor: not-allowed;

      &::before {
        background: var(--text-dim);
      }
    }

    .ui-slider_fill {
      background: var(--text-dim);
    }
  }
}
</style>
