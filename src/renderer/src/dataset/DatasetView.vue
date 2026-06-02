<script setup>
import { ref, onMounted } from 'vue'
import { net }            from '@/dataset/modules/net.js'
import { schemas }        from '@/dataset/modules/schemas.js'
import { UI }             from '@/dataset/modules/ui.js'

import AlertSystem        from '@/ui-kit/components/AlertSystem.vue'
import SchemasScreen      from '@/dataset/screens/SchemasScreen.vue'
import CollectionScreen   from '@/dataset/screens/CollectionScreen.vue'
import EmptyScreen        from '@/dataset/screens/EmptyScreen.vue'

const ready = ref(false)
const view  = ref('empty')
const active = ref('')

function go (name, collection = '') {
  view.value = name
  active.value = collection
}

onMounted(async () => {
  UI.init()
  await net.connect()
  await schemas.loadAll()
  if (schemas.state.list.length === 0) view.value = 'empty'
  else go('collection', schemas.state.list[0].name)
  ready.value = true
})
</script>

<template>
  <div class="dataset-app">
    <aside class="ds-side">
      <button
          v-for="s in schemas.state.list"
          :key="s.name"
          :class="{ _active: view === 'collection' && active === s.name }"
          class="ds-side_item"
          @click="go('collection', s.name)"
      >
        {{ s.name }}
      </button>
      <hr />
      <button
          :class="{ _active: view === 'schemas' }"
          class="ds-side_item"
          @click="go('schemas')"
      >
        Schemas
      </button>
    </aside>

    <main class="ds-main">
      <SchemasScreen v-if="view === 'schemas'" />
      <CollectionScreen v-else-if="view === 'collection' && active" :collection="active" :key="active" />
      <EmptyScreen v-else />
    </main>

    <AlertSystem />
  </div>
</template>
