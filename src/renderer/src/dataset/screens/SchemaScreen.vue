<template>
  <div class="lt-screen">
    <div class="lt-screen_header">
      <div class="schema-screen_head">
        <ui-button class="ui-secondary" naked @click="$emit('back')">
          <ui-icon :name="ICON.CHEVRON_LEFT" />
        </ui-button>
        <div class="lt-titles">
          <div class="lt-titles_name">{{ name }}</div>
          <div v-if="schema?.description" class="lt-titles_desc">{{ schema.description }}</div>
          <div class="lt-titles_meta">{{ props_.length }} fields · ids: {{ schema?.idgen?.prefix }}-N · display: {{ schema?.displayProp || '(auto)' }}</div>
        </div>
      </div>
      <div class="schema-screen_head-actions">
        <ui-button class="ui-secondary" hollow @click="modal = { kind: 'meta' }">Settings</ui-button>
        <ui-button class="ui-negative" hollow @click="onDeleteSchema">
          <ui-icon :name="ICON.TRASH" /> Delete
        </ui-button>
      </div>
    </div>

    <div class="lt-toolbar">
      <ui-button @click="modal = { kind: 'add' }">+ Add field</ui-button>
    </div>

    <div class="lt-screen_content">
      <table v-if="props_.length" class="lt-table _fixed">
        <colgroup>
          <col style="width: 2.5em" />
          <col style="width: 12em" />
          <col style="width: 7em" />
          <col style="width: 8em" />
          <col style="width: 16em" />
          <col style="width: 9em" />
          <col style="width: 10em" />
        </colgroup>
        <thead>
          <tr>
            <th>#</th><th>key</th><th>type</th><th>format</th><th>rules</th><th>default</th><th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(p, idx) in props_" :key="p.key">
            <td class="lt-muted">{{ idx + 1 }}</td>
            <td>
              <code>{{ p.key }}</code>
              <span v-if="schema.displayProp === p.key" class="lt-badge">display</span>
            </td>
            <td>{{ p.type }}</td>
            <td class="lt-muted">{{ p.format || '—' }}</td>
            <td class="lt-muted">{{ fielddef.describeRules(p) }}</td>
            <td class="lt-muted">{{ fielddef.describeDefault(p) }}</td>
            <td class="schema-screen_row-actions">
              <ui-button class="ui-secondary" naked @click="modal = { kind: 'rename', field: p }">rename</ui-button>
              <ui-button class="ui-secondary" naked @click="modal = { kind: 'edit', field: p }">edit</ui-button>
              <ui-button class="ui-negative" naked @click="onRemoveField(p)">
                <ui-icon :name="ICON.TRASH" />
              </ui-button>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-else class="lt-muted">No fields yet. Add the first one.</p>
    </div>

    <field-modal
        :is-open="modal?.kind === 'add' || modal?.kind === 'edit'"
        :mode="modal?.kind === 'edit' ? 'edit' : 'add'"
        :schema-name="name"
        :field="modal?.field || null"
        :taken-keys="props_.map(p => p.key)"
        @close="modal = null"
    />
    <rename-field-modal
        :is-open="modal?.kind === 'rename'"
        :schema-name="name"
        :field-key="modal?.field?.key || ''"
        :taken-keys="props_.map(p => p.key).filter(k => k !== modal?.field?.key)"
        @close="modal = null"
    />
    <schema-meta-modal
        :is-open="modal?.kind === 'meta'"
        :schema-name="name"
        @close="modal = null"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'

import { schemas }  from '@/dataset/modules/schemas.js'
import { alerts }   from '@/dataset/modules/alert.js'
import { fielddef } from '@/dataset/modules/fielddef.js'
import { ICON }     from '@/ui-kit/atmos/UiIconParts/icon-names.js'
import { SCHEMA_EDIT } from '@shared/dictionary.js'

import FieldModal       from '@/dataset/screens/FieldModal.vue'
import RenameFieldModal from '@/dataset/screens/RenameFieldModal.vue'
import SchemaMetaModal  from '@/dataset/screens/SchemaMetaModal.vue'

const props = defineProps({
  name: { type: String, required: true },
})

const emit = defineEmits([ 'back' ])

const modal = ref(null)   // { kind: 'add'|'edit'|'rename'|'meta', field? }

const schema = computed(() => schemas.get(props.name))
const props_ = computed(() => schema.value?.props || [])

// the collection was deleted out from under us → go back to the list
watch(schema, (s) => { if (!s) emit('back') })

async function onRemoveField (p) {
  const confirmed = await alerts.confirm(`Remove field "${ p.key }" and its data from "${ props.name }"?`, 'Remove field')
  if (!confirmed) return
  try {
    await schemas.edit(props.name, { op: SCHEMA_EDIT.REMOVE_FIELD, key: p.key })
  } catch (e) {
    alerts.alert(e)
  }
}

async function onDeleteSchema () {
  const confirmed = await alerts.confirm(`Delete schema "${ props.name }" and ALL its data? This cannot be undone.`, 'Delete schema')
  if (!confirmed) return
  try {
    await schemas.remove(props.name)
    emit('back')
  } catch (e) {
    alerts.alert(e)
  }
}
</script>

<style lang="scss" scoped>
// layout-only; visuals live in global .lt-* classes
.schema-screen {
  &_head {
    display: flex;
    align-items: center;
    gap: spacing(300);
    min-width: 0;
  }

  &_head-actions {
    display: flex;
    gap: spacing(200);
    flex-shrink: 0;
  }

  &_row-actions {
    display: flex;
    gap: spacing(100);
    justify-content: flex-end;
  }
}
</style>
