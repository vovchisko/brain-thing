<template>
  <div class="ui-datepicker-navigation">
    <ui-datepicker-btn
        :control="currentView === DATEPICKER_VIEWS.D"
        class="ui-datepicker-navigation_tab"
        @click="emit('view', DATEPICKER_VIEWS.D)"
    >
      {{ dayLabel }}
    </ui-datepicker-btn>

    <ui-datepicker-btn
        :control="currentView === DATEPICKER_VIEWS.M"
        class="ui-datepicker-navigation_tab"
        @click="emit('view', DATEPICKER_VIEWS.M)"
    >
      {{ monthLabel }}
    </ui-datepicker-btn>

    <ui-datepicker-btn
        :control="currentView === DATEPICKER_VIEWS.Y"
        class="ui-datepicker-navigation_tab"
        @click="emit('view', DATEPICKER_VIEWS.Y)"
    >
      {{ yearLabel }}
    </ui-datepicker-btn>
  </div>
</template>

<script setup>
import { computed }         from 'vue'
import UiDatepickerBtn      from './UiDatepickerBtn.vue'
import { DATEPICKER_VIEWS } from './constants.js'

const props = defineProps({
  currentView: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
})

const emit = defineEmits([ 'view' ])

const dayLabel = computed(() => {
  return props.date.getDate().toString()
})

const monthLabel = computed(() => {
  const formatter = new Intl.DateTimeFormat(navigator.language, { month: 'short' })
  return formatter.format(props.date)
})

const yearLabel = computed(() => {
  return props.date.getFullYear().toString()
})
</script>

<style lang="scss" scoped>
.ui-datepicker-navigation {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  gap: spacing(100);

  &_tab {
    min-width: 4em;
    font-weight: bold;
  }
}
</style>
