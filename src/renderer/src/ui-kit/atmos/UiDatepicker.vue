<template>
  <div :class="{ '_with-time': showTime }" class="ui-datepicker">
    <ui-datepicker-year
        v-if="view === DATEPICKER_VIEWS.Y"
        v-model="date"
        class="ui-datepicker_date"
        @update:modelValue="view = DATEPICKER_VIEWS.M"
    >
      <ui-datepicker-navigation
          :current-view="DATEPICKER_VIEWS.Y"
          :date="date"
          class="ui-datepicker_date-nav"
          @view="handleViewChange"
      />
    </ui-datepicker-year>

    <ui-datepicker-month
        v-else-if="view === DATEPICKER_VIEWS.M"
        v-model="date"
        class="ui-datepicker_date"
        @update:modelValue="view = DATEPICKER_VIEWS.D"
    >
      <ui-datepicker-navigation
          :current-view="DATEPICKER_VIEWS.M"
          :date="date"
          class="ui-datepicker_date-nav"
          @view="handleViewChange"
      />
    </ui-datepicker-month>

    <ui-datepicker-day
        v-else-if="view === DATEPICKER_VIEWS.D"
        v-model="date"
        :first-day-of-week="firstDayOfWeek"
        class="ui-datepicker_date"
    >
      <ui-datepicker-navigation
          :current-view="DATEPICKER_VIEWS.D"
          :date="date"
          class="ui-datepicker_date-nav"
          @view="handleViewChange"
      />
    </ui-datepicker-day>

    <ui-datepicker-time v-if="showTime" v-model="date" :time-format="timeFormat" class="ui-datepicker_time" />
  </div>
</template>

<script setup>
import { computed, ref }                from 'vue'
import UiDatepickerDay                  from './UiDatepickerParts/UiDatepickerDay.vue'
import UiDatepickerMonth                from './UiDatepickerParts/UiDatepickerMonth.vue'
import UiDatepickerYear                 from './UiDatepickerParts/UiDatepickerYear.vue'
import UiDatepickerNavigation           from './UiDatepickerParts/UiDatepickerNavigation.vue'
import UiDatepickerTime                 from './UiDatepickerParts/UiDatepickerTime.vue'
import { DATEPICKER_VIEWS, WEEK_START } from './UiDatepickerParts/constants.js'

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
})

const emit = defineEmits([ 'update:modelValue' ])

const date = computed({
  get: () => props.modelValue || new Date(),
  set: value => emit('update:modelValue', value),
})

const view = ref(DATEPICKER_VIEWS.D)

function handleViewChange (newView) {
  view.value = newView
}
</script>

<style lang="scss" scoped>
.ui-datepicker {
  display: flex;
  flex-direction: row;
  gap: spacing(300);

  --transition: 0 none !important;
  --ui-datepicker-size: calc(var(--ctl-h) * 8 + #{spacing(200)} + #{spacing(200)});

  &_date {
    display: flex;
    flex-direction: column;
    height: var(--ui-datepicker-size);
    flex: 1;
    min-width: 0;
  }

  &_time {
    flex: 0 0 auto;
    min-height: var(--ui-datepicker-size);
    width: auto;
    border-left: 1px solid var(--border);
    padding-left: spacing(300);
  }
}
</style>
