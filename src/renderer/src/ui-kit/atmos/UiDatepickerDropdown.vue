<template>
  <ui-dropdown ref="dropdown" class="ui-datepicker-dropdown" hug @close="handleClose" @open="handleOpen">
    <template #default="slotProps">
      <ui-button :hollow="!slotProps.isOpen" class="ui-datepicker-dropdown_trigger">
        <slot
            v-bind="{
            ...slotProps,
            onOpen: handleOpen,
            onClose: handleClose,
            formattedDate,
          }"
        >
          {{ formattedDate }}
        </slot>
        <ui-icon :name="ICON.CALENDAR" />
      </ui-button>
    </template>

    <template #content="{ dropdownClose }">
      <div class="ui-datepicker-dropdown_content">
        <ui-datepicker
            v-model="tempDate"
            :first-day-of-week="firstDayOfWeek"
            :show-time="showTime"
            :time-format="timeFormat"
            @update:modelValue="handleValueChange"
        />

        <div class="ui-datepicker-dropdown_actions">
          <div class="ui-datepicker-dropdown_actions-group">
            <ui-button @click="setToday">
              {{ showTime ? 'Now' : 'Today' }}
            </ui-button>
            <ui-button v-if="nullable" hollow @click="handleClear(dropdownClose)">Clear</ui-button>
          </div>

          <div v-if="!instant" class="ui-datepicker-dropdown_actions-group">
            <ui-button v-if="isDateChanged" hollow @click="handleUndo">Undo</ui-button>
            <ui-button v-else hollow @click="dropdownClose">Cancel</ui-button>
            <ui-button :disabled="!isDateChanged" @click="handleApply(dropdownClose)">Apply</ui-button>
          </div>
        </div>
      </div>
    </template>
  </ui-dropdown>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import UiDropdown               from './UiDropdown.vue'
import UiDatepicker             from './UiDatepicker.vue'
import UiButton                 from './UiButton.vue'
import UiIcon                   from './UiIcon.vue'
import { WEEK_START }           from './UiDatepickerParts/constants.js'
import { ICON }                 from './UiIconParts/icon-names.js'

const props = defineProps({
  modelValue: {
    type: [ Date, null, undefined ],
    required: true,
  },
  firstDayOfWeek: {
    type: String,
    default: null,
    validator: value => !value || [ WEEK_START.SUNDAY, WEEK_START.MONDAY ].includes(String(value).toLowerCase()),
  },
  timeFormat: {
    type: [ String, Number, null ],
    default: null,
    validator: value => !value || [ 12, 24 ].includes(Number(value)),
  },
  showTime: {
    type: Boolean,
    default: false,
  },
  instant: {
    type: Boolean,
    default: false,
  },
  dayPoint: {
    type: String,
    default: null,
    validator: value => !value || [ 'start', 'end' ].includes(value),
  },
  nullable: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([ 'update:modelValue' ])
const dropdown = ref(null)

const initialDate = ref(props.modelValue ? new Date(props.modelValue) : new Date())
const tempDate = ref(props.modelValue ? new Date(props.modelValue) : new Date())

const isDateChanged = computed(() => {
  if (props.instant) {
    const currentTime = props.modelValue ? props.modelValue.getTime() : null
    return initialDate.value.getTime() !== currentTime
  }
  return initialDate.value.getTime() !== tempDate.value.getTime()
})

watch(
    () => props.modelValue,
    newValue => {
      if (!props.instant) {
        tempDate.value = newValue ? new Date(newValue) : new Date()
      }
    },
)

function handleOpen () {
  const newDate = props.modelValue ? new Date(props.modelValue) : new Date()
  initialDate.value = newDate
  tempDate.value = newDate
}

function handleClose () {
  if (!props.instant && isDateChanged.value) {
    emit('update:modelValue', initialDate.value)
  }
}

const formattedDate = computed(() => {
  if (!props.modelValue) {
    return 'Select date'
  }

  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }

  if (props.showTime) {
    options.hour = 'numeric'
    options.minute = 'numeric'
  }

  return props.modelValue.toLocaleDateString(undefined, options)
})

function applyTimePoint (date) {
  if (!props.showTime && props.dayPoint && date) {
    const adjusted = new Date(date)
    if (props.dayPoint === 'start') {
      adjusted.setHours(0, 0, 0, 0)
    } else if (props.dayPoint === 'end') {
      adjusted.setHours(23, 59, 59, 999)
    }
    return adjusted
  }
  return date
}

function handleValueChange (value) {
  tempDate.value = value
  if (props.instant) {
    emit('update:modelValue', applyTimePoint(value))
    if (!props.showTime) {
      dropdown.value?.close()
    }
  }
}

async function handleApply (closeDropdown) {
  emit('update:modelValue', applyTimePoint(tempDate.value))
  initialDate.value = tempDate.value
  closeDropdown()
}

function handleUndo () {
  tempDate.value = new Date(initialDate.value)
}

function handleInstantUndo () {
  tempDate.value = new Date(initialDate.value)
  emit('update:modelValue', tempDate.value)
}

function setToday () {
  const now = new Date()

  if (!props.showTime) {
    tempDate.value = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        tempDate.value.getHours(),
        tempDate.value.getMinutes(),
    )
  } else {
    tempDate.value = now
  }

  if (props.instant) {
    emit('update:modelValue', tempDate.value)
  }
}

function handleClear (closeDropdown) {
  emit('update:modelValue', null)
  closeDropdown()
}

defineExpose({
  close: () => dropdown.value?.close(),
})
</script>

<style lang="scss" scoped>
.ui-datepicker-dropdown {
  display: inline-flex;
  --ui-dropdown-min-width: 0;
  --ui-dropdown-max-height: auto;

  &_trigger {
    flex: 1;
    justify-content: space-between;
    white-space: nowrap;
    --ui-pal: var(--ui-pal-lateral);
    background: var(--bg-input) !important;
    color: var(--text) !important;

    &:not(._hollow) {
      --ui-pal: var(--accent);
      background: var(--ui-pal) !important;
      color: var(--text) !important;
    }
  }

  &_content {
    display: flex;
    flex-direction: column;
    padding: spacing(200);
  }

  &_actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: spacing(100, 100, 0);
    border-top: 1px solid var(--border);
    margin-top: spacing(100);

    &-group {
      display: flex;
      gap: spacing(100);
    }
  }
}
</style>

