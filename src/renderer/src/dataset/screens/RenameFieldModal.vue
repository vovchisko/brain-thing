<template>
  <ui-modal :is-open="isOpen" :style="{ '--ui-modal-widht': '420px' }" @close="$emit('close')">
    <template #header>Rename field</template>

    <div class="lt-form">
      <div class="lt-grid">
        <label>From</label>
        <code class="lt-code">{{ fieldKey }}</code>

        <label>To</label>
        <ui-input v-model="to" placeholder="new_key" @keyup.enter="onSave" />
      </div>

      <p class="lt-muted">Renaming preserves every row's value.</p>

      <div class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="$emit('close')">Cancel</ui-button>
        <hr />
        <ui-button @click="onSave">Rename</ui-button>
      </div>
    </div>
  </ui-modal>
</template>

<script setup>
import { ref, watch } from 'vue'

import { schemas } from '@/dataset/modules/schemas.js'
import { alerts }  from '@/dataset/modules/alert.js'
import { SCHEMA_EDIT } from '@shared/dictionary.js'

const props = defineProps({
  isOpen:     { type: Boolean, default: false },
  schemaName: { type: String,  default: '' },
  fieldKey:   { type: String,  default: '' },
  takenKeys:  { type: Array,   default: () => [] },
})

const emit = defineEmits([ 'close', 'saved' ])

const to = ref('')

watch(() => props.isOpen, (open) => { if (open) to.value = props.fieldKey }, { immediate: true })

function validate () {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(to.value)) return 'New key must be a valid identifier.'
  if (to.value === props.fieldKey) return 'New key is the same as the old one.'
  if (props.takenKeys.includes(to.value)) return `Field "${ to.value }" already exists.`
  return null
}

async function onSave () {
  const err = validate()
  if (err) return alerts.alert(err)
  try {
    await schemas.edit(props.schemaName, { op: SCHEMA_EDIT.RENAME_FIELD, key: props.fieldKey, to: to.value })
    emit('saved')
    emit('close')
  } catch (e) {
    alerts.alert(e)
  }
}
</script>
