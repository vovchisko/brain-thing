<template>
  <ui-modal :is-open="isOpen" :style="{ '--ui-modal-widht': '460px' }" @close="$emit('close')">
    <template #header>{{ mode === 'add' ? 'Add field' : `Edit field — ${ field?.key }` }}</template>

    <div class="lt-form">
      <div class="lt-grid">
        <label>Key</label>
        <ui-input v-if="mode === 'add'" v-model="f.key" placeholder="snake_case_key" />
        <code v-else class="lt-code">{{ f.key }}</code>

        <label>Type</label>
        <ui-select :model-value="f.type" @update:model-value="onTypeChange($event)">
          <option v-for="t in fielddef.TYPE_LIST" :key="t" :value="t">{{ t }}</option>
        </ui-select>

        <template v-if="fielddef.formatsFor(f.type).length">
          <label>Format</label>
          <ui-select :model-value="f.format" @update:model-value="onFormatChange($event)">
            <option v-for="fmt in fielddef.formatsFor(f.type)" :key="fmt" :value="fmt">{{ fmt }}</option>
          </ui-select>
        </template>

        <template v-if="fielddef.needsRef(f)">
          <label>References</label>
          <ui-select v-model="f.rules.referenceTo">
            <option value="">(collection)</option>
            <option v-for="s in schemas.state.list" :key="s.name" :value="s.name">{{ s.name }}</option>
          </ui-select>
        </template>

        <template v-else-if="f.type === 'enum'">
          <label>Options</label>
          <ui-input
              :model-value="fielddef.optionsToText(f.rules?.options)"
              placeholder="one,two,three"
              @update:model-value="setOptions($event)"
          />
        </template>

        <template v-if="f.type === 'date'">
          <label>Precision</label>
          <ui-select v-model="precision">
            <option value="day">day</option>
            <option value="minute">minute</option>
            <option value="second">second</option>
          </ui-select>
        </template>

        <label>Required</label>
        <ui-check v-model="required" />

        <template v-if="fielddef.canEditDef(f)">
          <label>Default</label>
          <ui-input v-if="f.type === 'string'" v-model="f.def" />
          <ui-input
              v-else-if="f.type === 'number'"
              :model-value="String(f.def ?? '')"
              @update:model-value="f.def = $event === '' ? null : Number($event)"
          />
          <ui-check v-else-if="f.type === 'boolean'" v-model="f.def" />
          <ui-select v-else-if="f.type === 'enum'" v-model="f.def">
            <option value="">(none)</option>
            <option v-for="opt in fielddef.optionsList(f)" :key="opt" :value="opt">{{ opt }}</option>
          </ui-select>
        </template>
      </div>

      <div class="lt-form_actions-buttons">
        <ui-button class="ui-secondary" @click="$emit('close')">Cancel</ui-button>
        <hr />
        <ui-button @click="onSave">{{ mode === 'add' ? 'Add' : 'Save' }}</ui-button>
      </div>
    </div>
  </ui-modal>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'

import { schemas }  from '@/dataset/modules/schemas.js'
import { alerts }   from '@/dataset/modules/alert.js'
import { fielddef } from '@/dataset/modules/fielddef.js'
import { TYPES, SCHEMA_EDIT } from '@shared/dictionary.js'

const props = defineProps({
  isOpen:     { type: Boolean, default: false },
  mode:       { type: String,  default: 'add' },   // 'add' | 'edit'
  schemaName: { type: String,  default: '' },
  field:      { type: Object,  default: null },     // existing field (edit mode)
  takenKeys:  { type: Array,   default: () => [] }, // sibling keys (add-mode dedup)
})

const emit = defineEmits([ 'close', 'saved' ])

const f         = reactive(fielddef.blankField())
const required  = ref(false)
const precision = ref('day')

watch(() => [ props.isOpen, props.field ], () => {
  if (!props.isOpen) return
  const src = props.field ? JSON.parse(JSON.stringify(props.field)) : fielddef.blankField()
  Object.keys(f).forEach(k => delete f[k])
  Object.assign(f, src)
  if (!f.rules) f.rules = {}
  required.value  = !!f.rules?.required
  precision.value = f.rules?.precision || 'day'
}, { immediate: true })

function onTypeChange (type) {
  f.type   = type
  f.format = fielddef.formatsFor(type)[0]
  f.def    = structuredClone(fielddef.DEFAULTS_BY_TYPE[type])
  if (type === TYPES.ENUM) f.rules = { options: [] }
  else if (type === TYPES.REFERENCE || type === TYPES.SUBSET) f.rules = { referenceTo: '' }
  else f.rules = {}
}

function onFormatChange (fmt) {
  f.format = fmt
}

function setOptions (text) {
  if (!f.rules) f.rules = {}
  f.rules.options = fielddef.optionsToArray(text)
}

/** Collect the rules object actually worth persisting (drop empties). */
function buildRules () {
  const r = {}
  if (fielddef.needsRef(f) && f.rules?.referenceTo) r.referenceTo = f.rules.referenceTo
  if (f.type === TYPES.ENUM) r.options = f.rules?.options || []
  if (f.type === TYPES.DATE && precision.value !== 'day') r.precision = precision.value
  if (required.value) r.required = true
  return Object.keys(r).length ? r : undefined
}

function validate () {
  if (props.mode === 'add') {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(f.key)) return 'Key must be a valid identifier (letters, digits, underscore; not starting with a digit).'
    if (props.takenKeys.includes(f.key)) return `Field "${ f.key }" already exists.`
  }
  if (fielddef.needsRef(f) && !f.rules?.referenceTo) return 'Pick a collection to reference.'
  if (f.type === TYPES.ENUM && !(f.rules?.options?.length)) return 'Enum needs at least one option.'
  return null
}

async function onSave () {
  const err = validate()
  if (err) return alerts.alert(err)

  const rules = buildRules()
  const field = { key: f.key, type: f.type, format: f.format || null, def: f.def }
  if (rules) field.rules = rules

  try {
    if (props.mode === 'add') {
      await schemas.edit(props.schemaName, { op: SCHEMA_EDIT.ADD_FIELD, field })
    } else {
      const { key, ...changes } = field
      await schemas.edit(props.schemaName, { op: SCHEMA_EDIT.UPDATE_FIELD, key, changes })
    }
    emit('saved')
    emit('close')
  } catch (e) {
    alerts.alert(e)
  }
}
</script>
