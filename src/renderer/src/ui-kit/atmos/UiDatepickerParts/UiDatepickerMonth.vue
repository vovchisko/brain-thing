<template>
  <div class="ui-datepicker-month">
    <div class="ui-datepicker-month_header">
      <slot />
    </div>

    <div class="ui-datepicker-month_grid">
      <ui-datepicker-btn
          v-for="(month, index) in months"
          :key="index"
          :active="isSelectedMonth(index)"
          @click="selectMonth(index)"
      >
        {{ month }}
      </ui-datepicker-btn>
    </div>
  </div>
</template>

<script setup>
import { computed }    from 'vue'
import UiDatepickerBtn from './UiDatepickerBtn.vue'

const props = defineProps({
  modelValue: {
    type: Date,
    required: true,
  },
})

const emit = defineEmits([ 'update:modelValue' ])

const currentMonth = computed(() => props.modelValue.getMonth())

const months = computed(() => {
  const formatter = new Intl.DateTimeFormat(navigator.language, { month: 'short' })
  const date = new Date()

  return Array.from({ length: 12 }, (_, i) => {
    date.setMonth(i)
    return formatter.format(date)
  })
})

function isSelectedMonth (monthIndex) {
  return currentMonth.value === monthIndex
}

function selectMonth (monthIndex) {
  const newDate = new Date(props.modelValue)
  newDate.setMonth(monthIndex, newDate.getDate())
  emit('update:modelValue', newDate)
}
</script>

<style lang="scss" scoped>
.ui-datepicker-month {
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
