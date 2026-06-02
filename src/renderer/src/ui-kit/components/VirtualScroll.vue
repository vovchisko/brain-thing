<template>
  <div ref="scrollContainer" class="virtual-scroll" @scroll="handleScroll">
    <div :style="{ height: `${totalHeight}px` }" class="virtual-scroll_viewport">
      <div :style="{ transform: `translateY(${offsetY}px)` }" class="virtual-scroll_item-container">
        <slot v-for="item in visibleItems" :key="getItemKey(item)" :item="item" name="item"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },
  itemHeight: { type: Number, default: 32 },
  bufferSize: { type: Number, default: 5 },
  maxHeight: { type: Number, default: 300 },
  keyField: { type: String, default: 'id' },
})

const emit = defineEmits([ 'scroll' ])

const scrollContainer = ref(null)

const state = reactive({
  scrollTop: 0,
  containerHeight: props.maxHeight,
})

const getItemKey = item => {
  if (typeof item === 'object' && item !== null) {
    return item[props.keyField] || JSON.stringify(item)
  }
  return item
}

const totalHeight = computed(() => {
  return props.items.length * props.itemHeight
})

const visibleRange = computed(() => {
  const start = Math.floor(state.scrollTop / props.itemHeight) - props.bufferSize
  const visibleCount = Math.ceil(state.containerHeight / props.itemHeight) + props.bufferSize * 2

  return {
    start: Math.max(0, start),
    end: Math.min(props.items.length, start + visibleCount),
  }
})

const offsetY = computed(() => visibleRange.value.start * props.itemHeight)

const visibleItems = computed(() => props.items.slice(visibleRange.value.start, visibleRange.value.end))

const handleScroll = event => {
  state.scrollTop = event.target.scrollTop
  emit('scroll', {
    scrollTop: state.scrollTop,
    visibleItems: visibleItems.value,
    visibleRange: visibleRange.value,
  })
}

const updateContainerSize = () => {
  if (scrollContainer.value) {
    state.containerHeight = Math.min(props.maxHeight, scrollContainer.value.clientHeight)
  }
}

const scrollTo = position => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = position
    state.scrollTop = position
  }
}

const scrollToTop = () => {
  scrollTo(0)
}

const scrollToIndex = index => {
  if (index >= 0 && index < props.items.length) {
    scrollTo(index * props.itemHeight)
  }
}

defineExpose({
  scrollTo,
  scrollToTop,
  scrollToIndex,
})

onMounted(() => {
  updateContainerSize()
  window.addEventListener('resize', updateContainerSize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateContainerSize)
})

watch(
    () => props.items.length,
    () => {
      if (scrollContainer.value) {
        const maxScrollTop = Math.max(0, totalHeight.value - state.containerHeight)
        if (state.scrollTop > maxScrollTop) {
          scrollTo(maxScrollTop)
        }
      }
    },
)
</script>

<style lang="scss" scoped>
.virtual-scroll {
  @include scroll-styled();
  overflow-x: hidden;
  overflow-y: auto;
  max-height: v-bind('props.maxHeight + "px"');
  position: relative;

  &_viewport {
    position: relative;
    width: 100%;
  }

  &_item-container {
    position: absolute;
    width: 100%;
    will-change: transform;
  }
}
</style>
