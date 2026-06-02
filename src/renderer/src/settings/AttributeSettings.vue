<script setup>
import { computed, ref, toRaw, watch } from 'vue'
import { ATTRIBUTE_TYPE }  from '../../../shared/attribute-types.js'
import { state }       from '../state.js'
import { settings }    from './state.js'

const TYPES = Object.values(ATTRIBUTE_TYPE)

const attributes = ref([])
const original = ref([])
const saved = ref(false)

const dirty = computed(() => JSON.stringify(attributes.value) !== JSON.stringify(original.value))

watch(() => settings.vault.value?.attributes, (a) => {
  if (a) {
    original.value = a.map(x => ({ ...x }))
    attributes.value = a.map(x => ({ ...x }))
  }
}, { immediate: true })

const unconfigured = computed(() => {
  const configured = new Set(attributes.value.map(a => a.name))
  return Object.keys(state.attributes).filter(n => !configured.has(n))
})

async function save () {
  await settings.saveVaultAndSwap({ attributes: toRaw(attributes.value).map(a => ({ ...a })) })
  saved.value = true
  setTimeout(() => (saved.value = false), 1500)
}

function cancel () {
  attributes.value = original.value.map(a => ({ ...a }))
}

function addEmpty () {
  attributes.value.push({ name: '', type: ATTRIBUTE_TYPE.STRING, desc: '' })
}

function addFromVault (name) {
  if (attributes.value.some(a => a.name === name)) return
  attributes.value.push({ name, type: ATTRIBUTE_TYPE.STRING, desc: '' })
}

function removeAttribute (index) {
  if (attributes.value[index]?.core) return
  attributes.value.splice(index, 1)
}
</script>

<template>
  <div class="attributes">
    <label class="g-label">Attributes</label>

    <div class="attributes_list">
      <div v-for="(def, i) in attributes" :key="i" class="attributes_item">
        <input v-model="def.name" class="g-input attributes_item_name" placeholder="name" spellcheck="false" :disabled="def.core" />
        <select v-model="def.type" class="g-input attributes_item_type" :disabled="def.core">
          <option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
        <input v-model="def.desc" class="g-input attributes_item_desc" placeholder="description" spellcheck="false"
               :disabled="def.core" />
        <button v-if="!def.core" class="attributes_item_remove" @click="removeAttribute(i)">&times;</button>
        <span v-else class="attributes_item_remove" />
      </div>
    </div>

    <div class="attributes_actions">
      <button class="g-btn" @click="addEmpty">Add attribute</button>

      <div v-if="unconfigured.length" class="attributes_found">
        <span class="attributes_found_label">In vault:</span>
        <button v-for="name in unconfigured" :key="name" class="attributes_found_btn" @click="addFromVault(name)">
          + {{ name }}
        </button>
      </div>
    </div>

    <div class="attributes_footer">
      <div>
        <div v-if="saved" class="g-saved">Saved</div>
        <div class="g-hint">Attributes define typed metadata for search and display.</div>
      </div>
      <div class="attributes_footer_btns">
        <button class="g-btn" :disabled="!dirty" @click="cancel">Cancel</button>
        <button class="g-btn _primary" :disabled="!dirty" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.attributes {
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
      font-size: var(--font-ui);
      color: var(--text);
    }

    &_type {
      flex: 0 0 80px;
      font-size: var(--font-label);
      color: var(--text-dim);
    }

    &_desc {
      flex: 1;
      font-size: var(--font-label);
      font-family: inherit;
    }

    &_remove {
      all: unset;
      cursor: pointer;
      color: var(--text-dim);
      font-size: var(--font-heading);
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
      font-size: var(--font-label);
      color: var(--text-dim);
    }

    &_btn {
      all: unset;
      cursor: pointer;
      font-size: var(--font-label);
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
