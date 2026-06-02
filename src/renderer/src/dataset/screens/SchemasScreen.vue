<template>
  <schema-screen v-if="selected" :name="selected" @back="selected = null" />

  <div v-else class="lt-screen">
    <div class="lt-screen_header">
      <div class="lt-titles">
        <div class="lt-titles_name">Schemas</div>
        <div class="lt-titles_meta">{{ schemas.state.list.length }} collections</div>
      </div>
    </div>

    <div class="lt-toolbar">
      <ui-button @click="createOpen = true">+ New schema</ui-button>
    </div>

    <div class="lt-screen_content">
      <table v-if="schemas.state.list.length" class="lt-table _rows">
        <thead>
          <tr>
            <th>name</th>
            <th>description</th>
            <th>fields</th>
            <th>display</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in schemas.state.list" :key="entry.name" @click="open(entry.name)">
            <td><code>{{ entry.name }}</code></td>
            <td class="lt-muted">{{ entry.schema.description || '—' }}</td>
            <td>{{ entry.schema.props?.length || 0 }}</td>
            <td><code v-if="entry.schema.displayProp">{{ entry.schema.displayProp }}</code><span v-else>—</span></td>
          </tr>
        </tbody>
      </table>
      <p v-else class="lt-muted">No schemas yet. Create one to get started.</p>
    </div>

    <new-schema-modal :is-open="createOpen" @created="open" @close="createOpen = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

import { schemas }    from '@/dataset/modules/schemas.js'
import SchemaScreen   from '@/dataset/screens/SchemaScreen.vue'
import NewSchemaModal from '@/dataset/screens/NewSchemaModal.vue'

const selected   = ref(null)
const createOpen = ref(false)

function open (name) { selected.value = name }
</script>
