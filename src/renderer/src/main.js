import './ui-kit/main.scss'      // tokens + resets + theme classes
import './ui-kit/classes.scss'   // global cross-cutting classes (.g-*, .screen)
import './ui-kit/dataset.scss'   // dataset-tab layout classes (.lt-*, .ds-*)

import { createApp }      from 'vue'
import { initState }      from './state.js'
import App                from './App.vue'

import UiButton             from '@/ui-kit/atmos/UiButton.vue'
import UiButtonLink         from '@/ui-kit/atmos/UiButtonLink.vue'
import UiCheck              from '@/ui-kit/atmos/UiCheck.vue'
import UiDatepicker         from '@/ui-kit/atmos/UiDatepicker.vue'
import UiDatepickerDropdown from '@/ui-kit/atmos/UiDatepickerDropdown.vue'
import UiDropdown           from '@/ui-kit/atmos/UiDropdown.vue'
import UiDropdownItem       from '@/ui-kit/atmos/UiDropdownItem.vue'
import UiInput              from '@/ui-kit/atmos/UiInput.vue'
import UiModal              from '@/ui-kit/atmos/UiModal.vue'
import UiSelect             from '@/ui-kit/atmos/UiSelect.vue'
import UiSlider             from '@/ui-kit/atmos/UiSlider.vue'
import UiSliderRange        from '@/ui-kit/atmos/UiSliderRange.vue'
import UiText               from '@/ui-kit/atmos/UiText.vue'
import UiTextarea           from '@/ui-kit/atmos/UiTextarea.vue'
import UiIcon               from '@/ui-kit/atmos/UiIcon.vue'

initState().then(() => {
  const app = createApp(App)
  app.component('ui-button', UiButton)
  app.component('ui-button-link', UiButtonLink)
  app.component('ui-check', UiCheck)
  app.component('ui-datepicker', UiDatepicker)
  app.component('ui-datepicker-dropdown', UiDatepickerDropdown)
  app.component('ui-dropdown', UiDropdown)
  app.component('ui-dropdown-item', UiDropdownItem)
  app.component('ui-input', UiInput)
  app.component('ui-modal', UiModal)
  app.component('ui-select', UiSelect)
  app.component('ui-slider', UiSlider)
  app.component('ui-slider-range', UiSliderRange)
  app.component('ui-text', UiText)
  app.component('ui-textarea', UiTextarea)
  app.component('ui-icon', UiIcon)
  app.mount('#app')
})
