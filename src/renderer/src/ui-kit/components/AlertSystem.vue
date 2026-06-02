<template>
  <template v-for="alertItem in alerts.state.alerts" :key="alertItem.id">
    <ui-modal
        :is-open="true"
        blocking
        @close="handleClose(alertItem)"
    >
      <template v-if="alertItem.title" #header>
        {{ alertItem.title }}
      </template>

      <div :class="alertItem.class">
        {{ alertItem.message }}
      </div>

      <br/>
      <hr/>
      <br/>

      <div v-if="alertItem.isError" class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="handleClose(alertItem)">Close</ui-button>
      </div>

      <div v-else-if="alertItem.isConfirm" class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="handleConfirm(alertItem, false)">Cancel</ui-button>
        <ui-button class="ui-negative" @click="handleConfirm(alertItem, true)">
          {{ alertItem.deleteButtonLabel || 'Delete' }}
        </ui-button>
      </div>

      <div v-else-if="alertItem.actions.length" class="lt-form_actions-buttons">
        <ui-button
            v-for="(action, index) in alertItem.actions"
            :key="index"
            :class="action.class"
            @click="handleAction(alertItem, action)"
        >
          {{ action.label }}
        </ui-button>
      </div>
    </ui-modal>
  </template>
</template>

<script setup>
import { alerts } from '@/dataset/modules/alert.js'

function handleClose (alertItem) {
  alerts.close(alertItem.id)
}

function handleConfirm (alertItem, confirmed) {
  if (alertItem.resolve) {
    alertItem.resolve(confirmed)
  }
  alerts.close(alertItem.id)
}

function handleAction (alertItem, action) {
  if (action.onClick && typeof action.onClick === 'function') {
    action.onClick(alertItem.id)
  } else {
    alerts.close(alertItem.id)
  }
}
</script>