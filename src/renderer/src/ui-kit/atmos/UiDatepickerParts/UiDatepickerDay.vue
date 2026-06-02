<template>
  <div class="ui-datepicker-day">
    <div class="ui-datepicker-day_header">
      <ui-datepicker-btn @click="prevMonth">
        <ui-icon :name="ICON.CHEVRON_LEFT" />
      </ui-datepicker-btn>
      <slot>
        <b>{{ defaultDisplayHeader }}</b>
      </slot>
      <ui-datepicker-btn @click="nextMonth">
        <ui-icon :name="ICON.CHEVRON_RIGHT" />
      </ui-datepicker-btn>
    </div>

    <div class="ui-datepicker-day_weekdays">
      <div v-for="(day, index) in weekDays" :key="index" class="ui-datepicker-day_weekdays-item">
        {{ day }}
      </div>
    </div>

    <div class="ui-datepicker-day_grid">
      <ui-datepicker-btn
          v-for="day in calendarDays"
          :key="day.key"
          :active="isSelectedDay(day)"
          :dimmed="!day.currentMonth"
          @click="selectDay(day)"
      >
        {{ day.number }}
      </ui-datepicker-btn>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import UiIcon                   from '../UiIcon.vue'
import UiDatepickerBtn          from './UiDatepickerBtn.vue'
import { WEEK_START }           from '../UiDatepickerParts/constants.js'
import { ICON }                 from '../UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: {
    type: Date,
    required: true,
  },
  showOutsideDays: {
    type: Boolean,
    default: true,
  },
  firstDayOfWeek: {
    type: String,
    default: null,
  },
})

const emit = defineEmits([ 'update:modelValue' ])

const displayDate = ref(new Date(props.modelValue))

watch(
    () => props.modelValue,
    newDate => {
      if (
          newDate.getMonth() !== displayDate.value.getMonth() ||
          newDate.getFullYear() !== displayDate.value.getFullYear()
      ) {
        displayDate.value = new Date(newDate)
      }
    },
    { deep: true },
)

const defaultDisplayHeader = computed(() => {
  const formatter = new Intl.DateTimeFormat(navigator.language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return formatter.format(displayDate.value)
})

const weekDays = computed(() => {
  const formatter = new Intl.DateTimeFormat(navigator.language, { weekday: 'short' })
  // First day of 2023 is used as a reference date for generating weekday names
  // January 1, 2023 was a Sunday
  const dateObj = new Date(2023, 0, 1)
  const days = []
  const firstDay = getFirstDayOfWeek()

  for (let i = 0; i < 7; i++) {
    const dayIndex = (firstDay + i) % 7
    dateObj.setDate(1 + dayIndex)
    days.push(formatter.format(dateObj))
  }

  return days
})

const calendarDays = computed(() => {
  const year = displayDate.value.getFullYear()
  const month = displayDate.value.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()

  const firstDay = getFirstDayOfWeek()
  const firstDayWeekday = (firstDayOfMonth.getDay() - firstDay + 7) % 7

  const daysFromPrevMonth = firstDayWeekday
  const prevMonth = month === 0 ? 11 : month - 1
  const prevMonthYear = month === 0 ? year - 1 : year
  const daysInPrevMonth = new Date(prevMonthYear, prevMonth + 1, 0).getDate()

  const days = []

  if (props.showOutsideDays) {
    for (let i = 0; i < daysFromPrevMonth; i++) {
      const day = daysInPrevMonth - daysFromPrevMonth + i + 1
      days.push({
        number: day,
        date: new Date(prevMonthYear, prevMonth, day),
        currentMonth: false,
        key: `prev-${ day }`,
      })
    }
  } else {
    for (let i = 0; i < daysFromPrevMonth; i++) {
      days.push({
        number: '',
        date: null,
        currentMonth: false,
        key: `empty-prev-${ i }`,
      })
    }
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      number: day,
      date: new Date(year, month, day),
      currentMonth: true,
      key: `current-${ day }`,
    })
  }

  const totalSpots = 6 * 7 // six weeks on page vertically to fit any month weeks wrap
  const remainingSpots = totalSpots - days.length

  if (props.showOutsideDays && remainingSpots > 0) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextMonthYear = month === 11 ? year + 1 : year

    for (let day = 1; day <= remainingSpots; day++) {
      days.push({
        number: day,
        date: new Date(nextMonthYear, nextMonth, day),
        currentMonth: false,
        key: `next-${ day }`,
      })
    }
  } else if (remainingSpots > 0) {
    for (let i = 0; i < remainingSpots; i++) {
      days.push({
        number: '',
        date: null,
        currentMonth: false,
        key: `empty-next-${ i }`,
      })
    }
  }

  return days
})

function getFirstDayOfWeek () {
  if (!props.firstDayOfWeek) return navigator.language.startsWith('en-US') ? 0 : 1
  return props.firstDayOfWeek.toLowerCase() === WEEK_START.MONDAY ? 1 : 0
}

function isSelectedDay (day) {
  if (!day.date) return false

  const selected = props.modelValue
  return (
      day.date.getDate() === selected.getDate() &&
      day.date.getMonth() === selected.getMonth() &&
      day.date.getFullYear() === selected.getFullYear()
  )
}

function selectDay (day) {
  if (!day.date) return
  const newDate = new Date(props.modelValue)
  newDate.setFullYear(day.date.getFullYear(), day.date.getMonth(), day.date.getDate())
  emit('update:modelValue', newDate)
}

function nextMonth () {
  const newDate = new Date(displayDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  displayDate.value = newDate
}

function prevMonth () {
  const newDate = new Date(displayDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  displayDate.value = newDate
}
</script>

<style lang="scss" scoped>
.ui-datepicker-day {
  &_header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &-title {
      flex: 1;
    }
  }

  &_weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    text-align: center;
    min-height: var(--ctl-h);
    margin: spacing(200, 0);

    &-item {
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-soft);
      font-size: var(--font-label);
    }
  }

  &_grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
  }
}
</style>
