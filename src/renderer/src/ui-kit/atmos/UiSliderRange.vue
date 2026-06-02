<template>
  <div
      :class="{
      _disabled: disabled,
      '_with-tip-always': withTip === 'always',
      '_with-tip-hover': withTip === 'hover',
      _dragging: state.isDragging,
    }"
      class="ui-slider-range"
      v-bind="{ class: $attrs.class }"
  >
    <div class="ui-slider-range_wrapper" @mousedown="handlePointerDown" @touchstart="handlePointerDown">
      <div ref="trackRef" class="ui-slider-range_track">
        <div :style="fillStyle" class="ui-slider-range_fill"></div>
        <div
            ref="fromThumbRef"
            :style="{ left: getPosition(values.from) + '%' }"
            class="ui-slider-range_thumb"
            data-thumb="from"
            tabindex="0"
            @keydown="handleKeyDown"
        >
          <div v-if="withTip" class="ui-slider-range_tip">{{ values.from }}</div>
        </div>
        <div
            ref="toThumbRef"
            :style="{ left: getPosition(values.to) + '%' }"
            class="ui-slider-range_thumb"
            data-thumb="to"
            tabindex="0"
            @keydown="handleKeyDown"
        >
          <div v-if="withTip" class="ui-slider-range_tip">{{ values.to }}</div>
        </div>
      </div>
    </div>
    <div v-if="withInput" class="ui-slider-range_inputs">
      <ui-text
          :disabled="disabled"
          :max="max"
          :min="min"
          :model-value="values.from"
          :step="step"
          class="ui-slider-range_input"
          type="number"
          @blur="handleInputBlur"
          @update:model-value="updateThumbValue('from', $event)"
      />
      <ui-text
          :disabled="disabled"
          :max="max"
          :min="min"
          :model-value="values.to"
          :step="step"
          class="ui-slider-range_input"
          type="number"
          @blur="handleInputBlur"
          @update:model-value="updateThumbValue('to', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import UiText                      from './UiText.vue'
import { roundToStep }             from '@/common/round-to-step.js'

const props = defineProps({
  disabled: { type: Boolean, default: false },
  min: { type: [ String, Number ], required: true },
  max: { type: [ String, Number ], required: true },
  step: { type: [ String, Number ], default: 1 },
  minRange: { type: [ String, Number ], default: 0 },
  withTip: { type: [ String, Boolean ], default: false },
  withInput: { type: Boolean, default: false },
  int: { type: Boolean, default: false },
  modelValue: {
    type: Object,
    default: () => ({ from: 0, to: 100 }),
  },
  from: { type: [ String, Number ], default: undefined },
  to: { type: [ String, Number ], default: undefined },
})

const emit = defineEmits([ 'update:modelValue', 'update:from', 'update:to' ])
defineExpose({ focus })

const trackRef = ref(null)
const fromThumbRef = ref(null)
const toThumbRef = ref(null)

const state = reactive({ isDragging: false, draggingThumb: null })

const bounds = computed(() => ({
  min: Number(props.min),
  max: Number(props.max),
  step: Number(props.step),
  minRange: Number(props.minRange),
}))

const values = computed(() => ({
  from: props.from !== undefined ? Number(props.from) : Number(props.modelValue.from),
  to: props.to !== undefined ? Number(props.to) : Number(props.modelValue.to),
}))

const fillStyle = computed(() => ({
  left: getPosition(values.value.from) + '%',
  width: getPosition(values.value.to) - getPosition(values.value.from) + '%',
}))

function getPosition (value) {
  const range = bounds.value.max - bounds.value.min
  const position = ((value - bounds.value.min) / range) * 100
  return Math.max(0, Math.min(100, position))
}

function getValueFromPosition (clientX) {
  if (!trackRef.value) return bounds.value.min
  const rect = trackRef.value.getBoundingClientRect()
  const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  const range = bounds.value.max - bounds.value.min
  const rawValue = bounds.value.min + percentage * range
  const finalValue = props.int ? Math.round(rawValue) : rawValue
  return roundToStep(finalValue, bounds.value.step, bounds.value.min, bounds.value.max)
}

function getClosestThumb (clientX) {
  const value = getValueFromPosition(clientX)
  const fromDistance = Math.abs(value - values.value.from)
  const toDistance = Math.abs(value - values.value.to)
  if (fromDistance === toDistance) return value <= values.value.from ? 'from' : 'to'
  return fromDistance < toDistance ? 'from' : 'to'
}

function updateThumbValue (thumbType, value) {
  let numValue = Number(value)
  if (props.int) numValue = Math.round(numValue)

  let newFrom = values.value.from
  let newTo = values.value.to

  if (thumbType === 'from') {
    newFrom = Math.max(bounds.value.min, Math.min(bounds.value.max, numValue))
    if (newFrom + bounds.value.minRange > newTo) {
      newTo = Math.min(bounds.value.max, newFrom + bounds.value.minRange)
      if (newTo === bounds.value.max && newFrom + bounds.value.minRange > bounds.value.max) {
        newFrom = bounds.value.max - bounds.value.minRange
      }
    }
  } else {
    newTo = Math.max(bounds.value.min, Math.min(bounds.value.max, numValue))
    if (newTo - bounds.value.minRange < newFrom) {
      newFrom = Math.max(bounds.value.min, newTo - bounds.value.minRange)
      if (newFrom === bounds.value.min && newTo - bounds.value.minRange < bounds.value.min) {
        newTo = bounds.value.min + bounds.value.minRange
      }
    }
  }

  newFrom = roundToStep(newFrom, bounds.value.step, bounds.value.min, bounds.value.max)
  newTo = roundToStep(newTo, bounds.value.step, bounds.value.min, bounds.value.max)

  if (props.from !== undefined) emit('update:from', newFrom)
  if (props.to !== undefined) emit('update:to', newTo)
  emit('update:modelValue', { from: newFrom, to: newTo })
}

function handlePointerDown (event) {
  if (props.disabled || state.isDragging) return

  const clientX = event.type === 'touchstart' ? event.touches[0].clientX : event.clientX
  const thumb = getClosestThumb(clientX)

  if (event.type === 'touchstart') event.preventDefault()

  state.isDragging = true
  state.draggingThumb = thumb

  updateThumbValue(thumb, getValueFromPosition(clientX))

  if (thumb === 'from') {
    fromThumbRef.value?.focus()
  } else {
    toThumbRef.value?.focus()
  }

  const moveEvent = event.type === 'touchstart' ? 'touchmove' : 'mousemove'
  const endEvent = event.type === 'touchstart' ? 'touchend' : 'mouseup'

  const handleMove = e => {
    if (event.type === 'touchstart') e.preventDefault()
    const moveClientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX
    updateThumbValue(state.draggingThumb, getValueFromPosition(moveClientX))
  }

  const handleEnd = () => {
    state.isDragging = false
    state.draggingThumb = null
    document.removeEventListener(moveEvent, handleMove)
    document.removeEventListener(endEvent, handleEnd)
  }

  document.addEventListener(moveEvent, handleMove, event.type === 'touchstart' ? { passive: false } : undefined)
  document.addEventListener(endEvent, handleEnd)
}

function handleKeyDown (event) {
  if (props.disabled) return
  const thumb = event.target.dataset.thumb
  const currentValue = values.value[thumb]
  let newValue = currentValue

  switch (event.key) {
    case 'ArrowLeft':
    case 'ArrowDown':
      newValue = Math.max(bounds.value.min, currentValue - bounds.value.step)
      break
    case 'ArrowRight':
    case 'ArrowUp':
      newValue = Math.min(bounds.value.max, currentValue + bounds.value.step)
      break
    default:
      return
  }

  event.preventDefault()
  const roundedValue = roundToStep(newValue, bounds.value.step, bounds.value.min, bounds.value.max)
  updateThumbValue(thumb, roundedValue)
}

function handleInputBlur (event) {
  let numValue = Number(event.target.value)
  if (!isNaN(numValue)) {
    if (props.int) numValue = Math.round(numValue)
    const roundedValue = roundToStep(numValue, bounds.value.step, bounds.value.min, bounds.value.max)
    if (roundedValue !== Number(event.target.value)) event.target.value = roundedValue
  }
}

function focus () {
  fromThumbRef.value?.focus()
}
</script>

<style lang="scss" scoped>
.ui-slider-range {
  display: flex;
  align-items: center;
  height: var(--ctl-h);
  padding: 0 calc(16px / 2);
  user-select: none;
  gap: spacing(300);
  min-width: calc(var(--ctl-h) * 4);

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
    height: 100%;
    background: var(--ui-pal, var(--accent));
    border-radius: calc(6px / 2);
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
  &._with-tip-hover._dragging &_tip {
    display: block;
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

  &_inputs {
    display: flex;
    gap: spacing(200);
    flex-shrink: 0;
  }

  &_input {
    flex-shrink: 0;
    width: 5em;
  }

  &._disabled {
    opacity: 0.6;
    pointer-events: none;

    .ui-slider-range_track {
      cursor: not-allowed;
    }

    .ui-slider-range_thumb {
      cursor: not-allowed;

      &::before {
        background: var(--text-dim);
      }
    }

    .ui-slider-range_fill {
      background: var(--text-dim);
    }
  }
}
</style>
