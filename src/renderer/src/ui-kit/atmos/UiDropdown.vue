<template>
  <div :class="{ '_is-open': !disabled && isOpen }" class="ui-dropdown">
    <div ref="trigger" class="ui-dropdown_trigger" @click="toggle">
      <slot :isOpen="!disabled && isOpen" />
    </div>

    <teleport to="body">
      <div v-if="!disabled && isOpen" class="ui-dropdown_overlay" @click="close">
        <div
            ref="slotWrap"
            :class="{ '_auto-scroll': autoScroll }"
            :style="dropdownStyles"
            class="ui-dropdown_content"
            @click.stop
        >
          <slot :dropdownClose="close" name="content" />
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'

const VIEWPORT_MARGIN = 8
const DROPDOWN_GAP = 4

const props = defineProps({
  disabled: { type: Boolean, default: false },
  autoScroll: { type: Boolean, default: false },
  modelValue: { type: Boolean, default: undefined },
})

const emit = defineEmits([ 'open', 'close', 'update:modelValue' ])

const internalIsOpen = ref(false)
const slotWrap = ref(null)
const trigger = ref(null)
const position = ref({ top: 0, left: 0 })
const triggerWidth = ref(0)

const isOpen = computed(() => {
  return props.modelValue !== undefined ? props.modelValue : internalIsOpen.value
})

watch(isOpen, value => {
  emit(value ? 'open' : 'close')
  if (value) {
    nextTick(() => calculatePlacement())
  }
})

const calculatePlacement = () => {
  if (!trigger.value || !slotWrap.value) return

  const triggerRect = trigger.value.getBoundingClientRect()
  const dropdownRect = slotWrap.value.getBoundingClientRect()
  const viewport = {
    width: window.innerWidth,
    height: window.innerHeight,
  }

  triggerWidth.value = triggerRect.width

  const spaceBelow = viewport.height - triggerRect.bottom
  const spaceAbove = triggerRect.top
  const spaceRight = viewport.width - triggerRect.left
  const spaceLeft = triggerRect.right

  // Determine vertical placement
  let top = triggerRect.bottom + DROPDOWN_GAP

  if (spaceBelow < dropdownRect.height && spaceAbove > spaceBelow) {
    top = triggerRect.top - dropdownRect.height - DROPDOWN_GAP
  }

  // Determine horizontal placement
  let left = triggerRect.left

  if (spaceRight < dropdownRect.width && spaceLeft > spaceRight) {
    left = triggerRect.right - dropdownRect.width
  }

  // Ensure dropdown doesn't go outside viewport
  if (left < 0) left = VIEWPORT_MARGIN
  if (left + dropdownRect.width > viewport.width) {
    left = viewport.width - dropdownRect.width - VIEWPORT_MARGIN
  }

  if (top < 0) top = VIEWPORT_MARGIN
  if (top + dropdownRect.height > viewport.height) {
    top = viewport.height - dropdownRect.height - VIEWPORT_MARGIN
  }

  position.value = { top, left }
}

const dropdownStyles = computed(() => {
  return {
    position: 'fixed',
    top: `${ position.value.top }px`,
    left: `${ position.value.left }px`,
    zIndex: 'var(--z-pop)',
    '--ui-dropdown-trigger-width': `${ triggerWidth.value }px`,
  }
})

const handleKeydown = e => {
  if (e.key === 'Escape' && isOpen.value) {
    close()
  }
}

const toggle = () => {
  if (props.disabled) return
  const newValue = !isOpen.value

  if (props.modelValue !== undefined) {
    emit('update:modelValue', newValue)
  } else {
    internalIsOpen.value = newValue
  }
}

const close = () => {
  if (props.modelValue !== undefined) {
    emit('update:modelValue', false)
  } else {
    internalIsOpen.value = false
  }
}

const handleResize = () => {
  if (isOpen.value) {
    requestAnimationFrame(calculatePlacement)
  }
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
  window.addEventListener('scroll', handleResize, true)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('scroll', handleResize, true)
  document.removeEventListener('keydown', handleKeydown)
})

// Provide close method to child components
provide('dropdownClose', close)

defineExpose({ close })
</script>

<style lang="scss" scoped>
.ui-dropdown {
  font-size: var(--font-label);

  padding: 0;
  box-sizing: border-box;
  position: relative;
  display: inline-flex;

  &_trigger {
    display: flex;
    align-items: center;
    flex: 1;
    max-width: 100%;
  }

  &_overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-pop);
    background: transparent;
  }

  &_content {
    max-width: 100vw;
    flex-direction: column;
    border-style: solid;
    border-width: 1px;
    border-color: var(--border);
    border-radius: var(--radius-md);
    background: var(--bg);
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    overflow: visible;
    max-height: none;
    width: max-content;
    min-width: auto;

    &._auto-scroll {
      @include scroll-styled();
      overflow: auto;
      min-width: var(--ui-dropdown-trigger-width);
      max-height: var(--ui-dropdown-max-height);
    }
  }
}
</style>
