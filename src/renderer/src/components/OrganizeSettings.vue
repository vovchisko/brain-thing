<script setup>
import { computed, onMounted, ref, toRaw } from 'vue'

const organize = ref({
  useOrganize: false,
  default: 'Input',
  projects: {},
  rules: [],
})
const original = ref(null)
const saved = ref(false)
const expanded = ref(new Set())

const dirty = computed(() => JSON.stringify(organize.value) !== JSON.stringify(original.value))
const projectList = computed(() => Object.entries(organize.value.projects || {}))

onMounted(async () => {
  const cfg = await window.api.config.get()
  if (cfg.organize) {
    organize.value = JSON.parse(JSON.stringify(cfg.organize))
    original.value = JSON.parse(JSON.stringify(cfg.organize))
  }
})

async function save () {
  const raw = JSON.parse(JSON.stringify(toRaw(organize.value)))
  await window.api.config.set({ organize: raw })
  original.value = JSON.parse(JSON.stringify(raw))
  saved.value = true
  window.api.brainSwap()
  setTimeout(() => (saved.value = false), 1500)
}

function cancel () {
  organize.value = JSON.parse(JSON.stringify(original.value))
}

function addProject () {
  if (!organize.value.projects) organize.value.projects = {}
  organize.value.projects[''] = { folder: '', rules: [] }
}

function removeProject (key) {
  delete organize.value.projects[key]
  expanded.value.delete(key)
}

function renameProject (oldKey, newKey) {
  const val = organize.value.projects[oldKey]
  delete organize.value.projects[oldKey]
  organize.value.projects[newKey] = val
  if (expanded.value.has(oldKey)) {
    expanded.value.delete(oldKey)
    expanded.value.add(newKey)
  }
}

function toggleExpand (key) {
  if (expanded.value.has(key)) expanded.value.delete(key)
  else expanded.value.add(key)
}

function addProjectRule (proj) { proj.rules.push({ tag: '', field: '', value: '', folder: '' }) }
function removeProjectRule (proj, i) { proj.rules.splice(i, 1) }

function addRule () { organize.value.rules.push({ tag: '', field: '', value: '', folder: '' }) }
function removeRule (i) { organize.value.rules.splice(i, 1) }
</script>

<template>
  <div class="org">
    <label class="g-label">Organize</label>

    <div class="org_toggle">
      <span>Auto-organize files into folders</span>
      <button class="g-btn org_toggle_btn" :class="{ _on: organize.useOrganize }"
              @click="organize.useOrganize = !organize.useOrganize">
        {{ organize.useOrganize ? 'ON' : 'OFF' }}
      </button>
    </div>

    <div class="org_row">
      <span class="org_lbl">Default folder</span>
      <input v-model="organize.default" class="g-input" placeholder="Input" spellcheck="false" />
    </div>

    <!-- Projects -->
    <div class="org_block">
      <div class="org_block_head">
        <span class="org_block_title">Projects</span>
        <button class="g-btn" @click="addProject">Add project</button>
      </div>

      <div v-for="[key, proj] in projectList" :key="key" class="org_proj">
        <div class="org_proj_header" @click="toggleExpand(key)">
          <span class="org_proj_chevron">{{ expanded.has(key) ? '&#9660;' : '&#9654;' }}</span>
          <span class="org_proj_title">{{ key || 'unnamed' }}</span>
          <span class="org_proj_info">{{ proj.folder || '—' }} &middot; {{ (proj.rules || []).length }} rules</span>
          <button class="org_x" @click.stop="removeProject(key)">&times;</button>
        </div>

        <template v-if="expanded.has(key)">
          <div class="org_proj_fields">
            <div class="org_proj_labeled">
              <span class="org_lbl">project</span>
              <input :value="key" class="g-input" placeholder="project name" spellcheck="false"
                     @change="renameProject(key, $event.target.value)" />
            </div>
            <div class="org_proj_labeled _grow">
              <span class="org_lbl">base folder</span>
              <input v-model="proj.folder" class="g-input" placeholder="folder" spellcheck="false" />
            </div>
          </div>

          <div class="org_proj_section">
            <div v-for="(rule, ri) in proj.rules" :key="ri" class="org_rule">
              <input v-model="rule.tag" class="g-input" placeholder="tag" spellcheck="false" />
              <input v-model="rule.field" class="g-input" placeholder="field" spellcheck="false" />
              <span class="org_eq">=</span>
              <input v-model="rule.value" class="g-input" placeholder="value" spellcheck="false" />
              <span class="org_arrow">&rarr;</span>
              <input v-model="rule.folder" class="g-input" placeholder="subfolder" spellcheck="false" />
              <button class="org_x" @click="removeProjectRule(proj, ri)">&times;</button>
            </div>
            <button class="g-btn" @click="addProjectRule(proj)">Add rule</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Fallback rules -->
    <div class="org_block">
      <div class="org_block_head">
        <div class="org_block_title">Fallback rules</div>
        <button class="g-btn" @click="addRule">Add rule</button>
      </div>
      <div v-for="(rule, i) in organize.rules" :key="i" class="org_rule">
        <input v-model="rule.tag" class="g-input" placeholder="tag" spellcheck="false" />
        <input v-model="rule.field" class="g-input" placeholder="field" spellcheck="false" />
        <span class="org_eq">=</span>
        <input v-model="rule.value" class="g-input" placeholder="value" spellcheck="false" />
        <span class="org_arrow">&rarr;</span>
        <input v-model="rule.folder" class="g-input" placeholder="folder" spellcheck="false" />
        <button class="org_x" @click="removeRule(i)">&times;</button>
      </div>
    </div>

    <div class="org_footer">
      <div>
        <div v-if="saved" class="g-saved">Saved</div>
        <div class="g-hint">Each project maps to a base folder. Rules sort entries into subfolders by tag or field.</div>
      </div>
      <div class="org_footer_btns">
        <button class="g-btn" :disabled="!dirty" @click="cancel">Cancel</button>
        <button class="g-btn _primary" :disabled="!dirty" @click="save">Save</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.org {
  & .g-input { width: 140px; }

  &_toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--gap-md);

    &_btn {
      padding: 4px 14px;
      font-size: var(--font-xs);
      font-weight: 600;
      min-width: 48px;

      &._on {
        background: var(--positive);
        color: var(--text);
        &:hover { background: var(--positive-hover); }
      }
    }
  }

  &_row {
    display: flex;
    align-items: center;
    gap: var(--gap-sm);
    margin-bottom: var(--gap-md);
  }

  &_lbl {
    font-size: var(--font-xs);
    color: var(--text-dim);
    white-space: nowrap;
  }

  &_block {
    margin-bottom: var(--gap-md);

    &_head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--gap-sm);
    }

    &_title {
      font-size: var(--font-xs);
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  &_proj {
    background: var(--bg);
    border: 1px solid var(--bg-btn);
    border-radius: var(--radius-md);
    padding: var(--gap-sm) var(--gap-md);
    margin-bottom: var(--gap-sm);

    &_header {
      display: flex;
      align-items: center;
      gap: var(--gap-sm);
      cursor: pointer;
      padding: var(--gap-xs) 0;
      user-select: none;
    }

    &_chevron {
      font-size: 10px;
      color: var(--text-dim);
      width: 14px;
      flex-shrink: 0;
    }

    &_title {
      font-weight: 600;
      color: var(--text);
    }

    &_info {
      flex: 1;
      font-size: var(--font-xs);
      color: var(--text-dim);
    }

    &_fields {
      display: flex;
      align-items: flex-end;
      gap: var(--gap-sm);
      margin: var(--gap-sm) 0;
    }

    &_labeled {
      display: flex;
      flex-direction: column;
      gap: 2px;
      &._grow { flex: 1; }
    }

    &_section {
      margin-bottom: var(--gap-sm);
    }
  }

  &_rule {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    margin-bottom: var(--gap-sm);
    & .g-input {
      flex: 1;
    }
  }

  &_arrow, &_eq {
    color: var(--text-dim);
    font-size: var(--font-xs);
    flex-shrink: 0;
  }

  &_x {
    all: unset;
    cursor: pointer;
    color: var(--text-dim);
    font-size: var(--font-md);
    width: 20px;
    text-align: center;
    flex-shrink: 0;
    &:hover { color: var(--negative); }
  }

  &_footer {
    position: sticky;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg);
    padding: var(--gap-sm) 0;
    border-top: 1px solid var(--bg-btn);
    margin-top: auto;

    &_btns {
      display: flex;
      gap: var(--gap-sm);
    }
  }
}
</style>
