<template>
  <ui-modal :is-open="isOpen" :style="{ '--ui-modal-widht': '460px' }" @close="$emit('close')">
    <template #header>New schema</template>

    <div class="lt-form">
      <div class="lt-grid">
        <label>Name</label>
        <ui-input v-model="name" placeholder="snake_case_name" @keyup.enter="onCreate" />

        <label>Id prefix</label>
        <ui-input v-model="prefix" placeholder="TASK" @keyup.enter="onCreate" />

        <label>Description</label>
        <ui-input v-model="description" placeholder="What this collection is for" />
      </div>

      <p class="lt-muted">Row ids are <code class="lt-code">{{ prefix || 'PREFIX' }}-1</code>, <code class="lt-code">{{ prefix || 'PREFIX' }}-2</code>… Create the collection, then add fields on its screen.</p>

      <div class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="$emit('close')">Cancel</ui-button>
        <hr />
        <ui-button @click="onCreate">Create</ui-button>
      </div>
    </div>
  </ui-modal>
</template>

<script setup>
import { ref, watch } from 'vue'

import { schemas } from '@/dataset/modules/schemas.js'
import { alerts }  from '@/dataset/modules/alert.js'
import { ids }     from '@shared/ids.js'

const props = defineProps({
  isOpen: { type: Boolean, default: false },
})

const emit = defineEmits([ 'close', 'created' ])

const name         = ref('')
const prefix       = ref('')
const prefixTouched = ref(false)
const description  = ref('')

watch(() => props.isOpen, (open) => {
  if (open) { name.value = ''; prefix.value = ''; prefixTouched.value = false; description.value = '' }
}, { immediate: true })

// Suggest a prefix from the name until the user edits it themselves (an explicit,
// editable suggestion — the backend still requires the prefix, no silent default).
watch(prefix, (v) => { if (props.isOpen && v !== suggestPrefix(name.value)) prefixTouched.value = true })
watch(name, (n) => { if (!prefixTouched.value) prefix.value = suggestPrefix(n) })

function suggestPrefix (n) {
  return (n || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^\d+/, '')
}

function validate () {
  if (!/^[a-z][a-z0-9_]*$/.test(name.value)) return 'Name must be lowercase, start with a letter, only letters/digits/underscores.'
  if (schemas.get(name.value)) return `Schema "${ name.value }" already exists.`
  if (!ids.isValidPrefix(prefix.value)) return 'Id prefix is required: no spaces, no leading digit (e.g. "TASK").'
  return null
}

async function onCreate () {
  const err = validate()
  if (err) return alerts.alert(err)
  try {
    await schemas.create(name.value, { prefix: prefix.value, description: description.value, props: [] })
    emit('created', name.value)
    emit('close')
  } catch (e) {
    alerts.alert(e)
  }
}
</script>
