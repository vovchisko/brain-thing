<script setup>
import { computed, ref, toRaw, watch } from 'vue'
import { FIELD_TYPE }  from '../../../shared/field-types.js'
import { state }       from '../state.js'
import { settings }    from './state.js'

const TYPES = Object.values(FIELD_TYPE)

const fields = ref([])
const original = ref([])
const saved = ref(false)

const dirty = computed(() => JSON.stringify(fields.value) !== JSON.stringify(original.value))

watch(() => settings.vault.value?.fields, (f) => {
  if (f) {
    original.value = f.map(x => ({ ...x }))
    fields.value = f.map(x => ({ ...x }))
  }
}, { immediate: true })

const unconfigured = computed(() => {
  const configured = new Set(fields.value.map(f => f.name))
  return Object.keys(state.fields).filter(n => !configured.has(n))
})

async function save () {
  await settings.saveVaultAndSwap({ fields: toRaw(fields.value).map(f => ({ ...f })) })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

function cancel () {
  fields.value = original.value.map(f => ({ ...f }))
}

function addEmpty () {
  fields.value.push({ name: '', type: FIELD_TYPE.STRING, desc: '' })
}

function addFromVault (name) {
  if (fields.value.some(f => f.name === name)) return
  fields.value.push({ name, type: FIELD_TYPE.STRING, desc: '' })
}

function removeField (index) {
  if (fields.value[index]?.core) return
  fields.value.splice(index, 1)
}
</script>

<template>
  <div class="fields">
    <label class="g-label">Fields</label>

    <div class="fields_list">
      <div v-for="(def, i) in fields" :key="i" class="fields_item">
        <input v-model="def.name" class="g-input fields_item_name" placeholder="name" spellcheck="false" :disabled="def.core" />
        <select v-model="def.type" class="g-input fields_item_type" :disabled="def.core">
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model="def.desc" class="g-input fields_item_desc" placeholder="description" spellcheck="false"
               :disabled="def.core" />
        <button v-if="!def.core" class="fields_item_remove" @click="removeField(i)">&times;</button>
        <span v-else class="fields_item_remove" />
      </div>
    </div>

    <div class="fields_actions">
      <button class="g-btn" @click="addEmpty">Add field</button>

      <div v-if="unconfigured.length" class="fields_found">
        <span class="fields_found_label">In vault:</span>
        <button v-for="name in unconfigured" :key="name" class="fields_found_btn" @click="addFromVault(name)">
          + {{ name }}
        </button>
      </div>
    </div>

    <div class="fields_footer">
      <div>
        <div v-if="saved" class="g-saved">Saved</div>
        <div class="g-hint">Fields define typed metadata for search and display.</div>
      </div>
      <div class="fields_footer_btns">
        <button class="g-btn" :disabled="!dirty" @click="cancel">Cancel</button>
        <button class="g-btn _primary" :disabled="!dirty" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.fields {
  &_list {
    display: flex;
    flex-direction: column;
    gap: var(--gap-xs);
    margin-bottom: var(--gap-sm);
  }

  &_item {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);

    &_name {
      flex: 0 0 100px;
      font-family: var(--font-mono);
      font-size: var(--font-sm);
      color: var(--text);
    }

    &_type {
      flex: 0 0 80px;
      font-size: var(--font-xs);
      color: var(--text-dim);
    }

    &_desc {
      flex: 1;
      font-size: var(--font-xs);
      font-family: inherit;
    }

    &_remove {
      all: unset;
      cursor: pointer;
      color: var(--text-dim);
      font-size: var(--font-md);
      width: 20px;
      text-align: center;

      &:hover {
        color: var(--negative);
      }
    }
  }

  &_actions {
    display: flex;
    align-items: center;
    gap: var(--gap-md);
    margin-bottom: var(--gap-sm);
  }

  &_found {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--gap-xs);

    &_label {
      font-size: var(--font-xs);
      color: var(--text-dim);
    }

    &_btn {
      all: unset;
      cursor: pointer;
      font-size: var(--font-xs);
      color: var(--accent);
      padding: 1px var(--gap-sm);
      border-radius: var(--radius-sm);
      background: var(--bg-btn);

      &:hover {
        background: var(--bg-btn-hover);
      }
    }
  }

  &_footer {
    display: flex;
    align-items: center;
    justify-content: space-between;

    &_btns {
      display: flex;
      gap: var(--gap-sm);
    }
  }
}
</style>
