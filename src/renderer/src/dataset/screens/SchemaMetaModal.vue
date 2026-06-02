<template>
  <ui-modal :is-open="isOpen" :style="{ '--ui-modal-widht': '460px' }" @close="$emit('close')">
    <template #header>Schema settings — {{ schemaName }}</template>

    <div class="lt-form">
      <div class="lt-grid">
        <label>Description</label>
        <ui-input v-model="description" placeholder="What this collection is for" />

        <label>Display field</label>
        <ui-select v-model="displayProp">
          <option value="">(auto: first string)</option>
          <option v-for="p in stringProps" :key="p.key" :value="p.key">{{ p.key }}</option>
        </ui-select>

        <label>Id prefix</label>
        <ui-input v-model="prefix" placeholder="TASK" />
      </div>

      <p v-if="prefix !== (schema.idgen?.prefix || '')" class="lt-muted">
        Changing the prefix rewrites every row id and every reference to this collection.
      </p>

      <div class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="$emit('close')">Cancel</ui-button>
        <hr />
        <ui-button @click="onSave">Save</ui-button>
      </div>
    </div>
  </ui-modal>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { schemas } from '@/dataset/modules/schemas.js'
import { alerts }  from '@/dataset/modules/alert.js'
import { ids }     from '@shared/ids.js'
import { TYPES, SCHEMA_EDIT } from '@shared/dictionary.js'

const props = defineProps({
  isOpen:     { type: Boolean, default: false },
  schemaName: { type: String,  default: '' },
})

const emit = defineEmits([ 'close', 'saved' ])

const description = ref('')
const displayProp = ref('')
const prefix      = ref('')

const schema      = computed(() => schemas.get(props.schemaName) || {})
const stringProps = computed(() => (schema.value.props || []).filter(p => p.type === TYPES.STRING))

watch(() => props.isOpen, (open) => {
  if (!open) return
  description.value = schema.value.description || ''
  displayProp.value = schema.value.displayProp || ''
  prefix.value      = schema.value.idgen?.prefix || ''
}, { immediate: true })

async function onSave () {
  const prefixChanged = prefix.value !== (schema.value.idgen?.prefix || '')
  if (prefixChanged) {
    if (!ids.isValidPrefix(prefix.value)) return alerts.alert('Id prefix: no spaces, no leading digit (e.g. "TASK").')
    const go = await alerts.confirm(
        `Re-prefix all ids in "${ props.schemaName }" to "${ prefix.value }-"? This rewrites every row id and every reference to this collection.`,
        'Change id prefix')
    if (!go) return
  }
  const ops = []
  if ((schema.value.description || '') !== description.value) {
    ops.push({ op: SCHEMA_EDIT.SET_DESCRIPTION, value: description.value })
  }
  if ((schema.value.displayProp || '') !== displayProp.value) {
    ops.push({ op: SCHEMA_EDIT.SET_DISPLAY_PROP, value: displayProp.value })
  }
  if (prefixChanged) ops.push({ op: SCHEMA_EDIT.SET_IDGEN, prefix: prefix.value })
  try {
    if (ops.length) await schemas.edit(props.schemaName, ops)
    emit('saved')
    emit('close')
  } catch (e) {
    alerts.alert(e)
  }
}
</script>
