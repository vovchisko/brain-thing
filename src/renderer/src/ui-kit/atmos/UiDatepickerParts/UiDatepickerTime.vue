<template>
  <div class="ui-datepicker-time">
    <div class="ui-datepicker-time_column">
      <div ref="hoursListRef" class="ui-datepicker-time_list">
        <ui-datepicker-btn
            v-for="hour in displayHours"
            :key="`hour-${hour.value}`"
            :active="hour.value === displayHour"
            :data-selected="hour.value === displayHour"
            @click="selectHour(hour.value)"
        >
          {{ hour.label }}
        </ui-datepicker-btn>
      </div>
      <ui-text
          v-model="hourInput"
          :max="use12HourFormat ? 12 : 23"
          :min="use12HourFormat ? 1 : 0"
          class="ui-datepicker-time_input"
          type="number"
          @input="validateHourInput"
      />
    </div>

    <div class="ui-datepicker-time_column">
      <div ref="minutesListRef" class="ui-datepicker-time_list">
        <ui-datepicker-btn
            v-for="minute in minutes"
            :key="`minute-${minute}`"
            :active="minute === currentMinute"
            :data-selected="minute === currentMinute"
            @click="selectMinute(minute)"
        >
          {{ formatTimeValue(minute) }}
        </ui-datepicker-btn>
      </div>
      <ui-text
          v-model="minuteInput"
          class="ui-datepicker-time_input"
          max="59"
          min="0"
          type="number"
          @input="validateMinuteInput"
      />
    </div>

    <div v-if="use12HourFormat" class="ui-datepicker-time_column">
      <div class="ui-datepicker-time_list">
        <ui-datepicker-btn :active="!isPM" @click="toggleAMPM(false)">AM</ui-datepicker-btn>
        <ui-datepicker-btn :active="isPM" @click="toggleAMPM(true)">PM</ui-datepicker-btn>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import UiText                                        from '../UiText.vue'
import UiDatepickerBtn                               from './UiDatepickerBtn.vue'

const props = defineProps({
  modelValue: {
    type: Date,
    required: true,
  },
  minuteStep: {
    type: Number,
    default: 1,
  },
  timeFormat: {
    type: [ String, Number, null ],
    default: null,
  },
})

const emit = defineEmits([ 'update:modelValue' ])

const use12HourFormat = computed(() => {
  const format = props.timeFormat !== null ? Number(props.timeFormat) : null

  if (format === 24) return false
  if (format === 12) return true

  const sample = new Date(2000, 0, 1, 13, 0, 0).toLocaleTimeString()
  return sample.indexOf('1:') >= 0 || sample.indexOf('PM') >= 0 || sample.indexOf('pm') >= 0
})

const currentHour = computed(() => props.modelValue.getHours())
const currentMinute = computed(() => props.modelValue.getMinutes())

const isPM = computed(() => currentHour.value >= 12)

const displayHour = computed(() => {
  if (!use12HourFormat.value) return currentHour.value

  let hour = currentHour.value % 12
  return hour === 0 ? 12 : hour
})

const hourInput = ref(displayHour.value.toString())
const minuteInput = ref(currentMinute.value.toString())

const hoursListRef = ref(null)
const minutesListRef = ref(null)

watch([ displayHour, currentMinute ], ([ newHour, newMinute ]) => {
  hourInput.value = newHour.toString()
  minuteInput.value = newMinute.toString()
})

const displayHours = computed(() => {
  if (!use12HourFormat.value) {
    return Array.from({ length: 24 }, (_, i) => ({
      value: i,
      label: formatTimeValue(i),
    }))
  } else {
    return Array.from({ length: 12 }, (_, i) => ({
      value: i + 1,
      label: (i + 1).toString().padStart(2, '0'),
    }))
  }
})

const minutes = computed(() => {
  const minuteArray = []
  for (let i = 0; i < 60; i += props.minuteStep) {
    minuteArray.push(i)
  }
  return minuteArray
})

function formatTimeValue (value) {
  return value.toString().padStart(2, '0')
}

function selectHour (hour) {
  const newDate = new Date(props.modelValue)

  if (use12HourFormat.value) {
    const is12 = hour === 12
    if (isPM.value) {
      newDate.setHours(is12 ? 12 : hour + 12)
    } else {
      newDate.setHours(is12 ? 0 : hour)
    }
  } else {
    newDate.setHours(hour)
  }

  emit('update:modelValue', newDate)
}

function selectMinute (minute) {
  const newDate = new Date(props.modelValue)
  newDate.setMinutes(minute)
  emit('update:modelValue', newDate)
}

function toggleAMPM (pm) {
  if (pm === isPM.value) return

  const newDate = new Date(props.modelValue)
  const hour = newDate.getHours()

  if (pm) {
    newDate.setHours(hour + 12)
  } else {
    newDate.setHours(hour - 12)
  }

  emit('update:modelValue', newDate)
}

function validateHourInput () {
  let hour = parseInt(hourInput.value, 10)

  if (isNaN(hour)) {
    hourInput.value = displayHour.value.toString()
    return
  }

  if (use12HourFormat.value) {
    hour = Math.max(1, Math.min(12, hour))
    hourInput.value = hour.toString()

    if (hour !== displayHour.value) {
      selectHour(hour)
    }
  } else {
    hour = Math.max(0, Math.min(23, hour))
    hourInput.value = hour.toString()

    if (hour !== currentHour.value) {
      selectHour(hour)
    }
  }
}

function validateMinuteInput () {
  let minute = parseInt(minuteInput.value, 10)

  if (isNaN(minute)) {
    minuteInput.value = currentMinute.value.toString()
    return
  }

  minute = Math.max(0, Math.min(59, minute))
  minuteInput.value = minute.toString()

  if (minute !== currentMinute.value) {
    selectMinute(minute)
  }
}

onMounted(() => {
  scrollToCurrentTime(true)
})

watch([ displayHour, currentMinute ], () => {
  scrollToCurrentTime()
})

function scrollToCurrentTime (noAnimation = false) {
  nextTick(() => {
    if (hoursListRef.value) {
      const hourElement = hoursListRef.value.querySelector('[data-selected=true]')
      const hoursContainer = hoursListRef.value
      if (hourElement) {
        const elementTop = hourElement.offsetTop - hoursContainer.offsetTop
        const centerOffset = (hoursContainer.clientHeight - hourElement.offsetHeight) / 2
        hoursContainer.scrollTo({
          top: elementTop - centerOffset,
          behavior: noAnimation ? 'auto' : 'smooth',
        })
      }
    }

    if (minutesListRef.value) {
      const minuteElement = minutesListRef.value.querySelector('[data-selected=true]')
      const minutesContainer = minutesListRef.value
      if (minuteElement) {
        const elementTop = minuteElement.offsetTop - minutesContainer.offsetTop
        const centerOffset = (minutesContainer.clientHeight - minuteElement.offsetHeight) / 2
        minutesContainer.scrollTo({
          top: elementTop - centerOffset,
          behavior: noAnimation ? 'auto' : 'smooth',
        })
      }
    }
  })
}
</script>

<style lang="scss" scoped>
.ui-datepicker-time {
  display: flex;
  flex-direction: row;
  gap: spacing(300);
  height: calc(var(--ctl-h) * 8 + #{spacing(200)} + #{spacing(200)});

  &_column {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: spacing(300);
    width: calc(var(--ctl-h) * 2);
  }

  &_list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow-y: auto;
    flex: 1;
    padding: spacing(0, 100);


    @include scroll-styled();
  }

  &_input {
    & :deep(input) {
      text-align: center;
    }
  }
}
</style>
