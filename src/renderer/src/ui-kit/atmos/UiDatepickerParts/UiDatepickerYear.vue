<template>
  <div class="ui-datepicker-year">
    <div class="ui-datepicker-year_header">
      <ui-datepicker-btn @click.stop="prevYearPage">
        <ui-icon :name="ICON.CHEVRON_LEFT" />
      </ui-datepicker-btn>
      <slot>
        <b>{{ defaultDisplayHeader }}</b>
      </slot>
      <ui-datepicker-btn @click.stop="nextYearPage">
        <ui-icon :name="ICON.CHEVRON_RIGHT" />
      </ui-datepicker-btn>
    </div>

    <div class="ui-datepicker-year_grid">
      <ui-datepicker-btn v-for="year in years" :key="year" :active="isSelectedYear(year)" @click="selectYear(year)">
        {{ year }}
      </ui-datepicker-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import UiDatepickerBtn          from './UiDatepickerBtn.vue'
import UiIcon                   from '../UiIcon.vue'
import { ICON }                 from '../UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: {
    type: Date,
    required: true,
  },
  range: {
    type: Number,
    default: 12,
  },
})

const emit = defineEmits([ 'update:modelValue' ])

const currentYear = computed(() => props.modelValue.getFullYear())
const startYear = ref(Math.floor(currentYear.value / props.range) * props.range)

watch(currentYear, newYear => {
  const currentPage = Math.floor(startYear.value / props.range)
  const yearPage = Math.floor(newYear / props.range)

  if (currentPage !== yearPage) {
    startYear.value = yearPage * props.range
  }
})

const defaultDisplayHeader = computed(() => {
  const start = startYear.value
  const end = start + props.range - 1
  return `${ start } - ${ end }`
})

const years = computed(() => {
  const start = startYear.value
  return Array.from({ length: props.range }, (_, i) => start + i)
})

function isSelectedYear (year) {
  return currentYear.value === year
}

function selectYear (year) {
  const newDate = new Date(props.modelValue)
  newDate.setFullYear(year)
  emit('update:modelValue', newDate)
}

function nextYearPage (e) {
  e.stopPropagation()
  startYear.value += props.range
}

function prevYearPage (e) {
  e.stopPropagation()
  startYear.value -= props.range
}
</script>

<style lang="scss" scoped>
.ui-datepicker-year {
  height: var(--ui-datepicker-size);
  width: var(--ui-datepicker-size);

  &_header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &_grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: spacing(200);
    margin: auto 0;
  }
}
</style>
