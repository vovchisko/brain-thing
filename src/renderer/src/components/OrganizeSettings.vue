<script setup>
import { computed, onMounted, ref, toRaw } from 'vue'

const organize = ref({
  useOrganize: false,
  default: 'Input',
  scopes: [],
  noScopeRules: [],
})
const original = ref(null)
const saved = ref(false)
const expanded = ref(new Set())

const dirty = computed(() => JSON.stringify(organize.value) !== JSON.stringify(original.value))

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

function addScope () {
  organize.value.scopes.push({
    name: '',
    folder: '',
    match: { tag: '', field: '', value: '' },
    rules: [],
  })
}

function removeScope (i) { organize.value.scopes.splice(i, 1) }

function addRule (list) {
  list.push({ tag: '', field: '', value: '', folder: '' })
}

function removeRule (list, i) { list.splice(i, 1) }

function toggleCollapse (i) {
  if (expanded.value.has(i)) expanded.value.delete(i)
  else expanded.value.add(i)
}
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

    <!-- Scopes -->
    <div class="org_block">
      <div class="org_block_head">
        <span class="org_block_title">Scopes</span>
        <button class="g-btn" @click="addScope">Add scope</button>
      </div>

      <div v-for="(scope, si) in organize.scopes" :key="si" class="org_scope">
        <div class="org_scope_header" @click="toggleCollapse(si)">
          <span class="org_scope_chevron">{{ expanded.has(si) ? '&#9660;' : '&#9654;' }}</span>
          <span class="org_scope_title">{{ scope.name || 'unnamed' }}</span>
          <span class="org_scope_info">{{ scope.folder || '—' }} &middot; {{ scope.rules.length }} rules</span>
          <button class="org_x" @click.stop="removeScope(si)">&times;</button>
        </div>

        <template v-if="expanded.has(si)">
        <div class="org_scope_row">
          <div class="org_scope_labeled">
            <span class="org_lbl">id</span>
            <input v-model="scope.name" class="g-input org_scope_name" placeholder="scope name" spellcheck="false" />
          </div>
          <div class="org_scope_labeled org_scope_labeled._grow">
            <span class="org_lbl">folder</span>
            <input v-model="scope.folder" class="g-input" placeholder="base folder" spellcheck="false" />
          </div>
        </div>

        <div class="org_scope_section">
          <span class="org_lbl">Match (entry belongs to this scope when)</span>
          <div class="org_cond">
            <input v-model="scope.match.tag" class="g-input org_cond_cell" placeholder="tag prefix" spellcheck="false" />
            <input v-model="scope.match.field" class="g-input org_cond_cell" placeholder="field" spellcheck="false" />
            <span class="org_cond_eq">=</span>
            <input v-model="scope.match.value" class="g-input org_cond_cell" placeholder="value" spellcheck="false" />
          </div>
        </div>

        <div class="org_scope_section">
          <div class="org_lbl">Rules (first match wins)</div>
          <div v-for="(rule, ri) in scope.rules" :key="ri" class="org_rule">
            <div class="org_rule_conds">
              <input v-model="rule.tag" class="g-input" placeholder="tag" spellcheck="false" />
              <input v-model="rule.field" class="g-input" placeholder="field" spellcheck="false" />
              <span class="org_rule_eq">=</span>
              <input v-model="rule.value" class="g-input" placeholder="value" spellcheck="false" />
            </div>
            <div class="org_rule_dest">
              <span class="org_rule_arrow">&rarr;</span>
              <input v-model="rule.folder" class="g-input" placeholder="subfolder" spellcheck="false" />
              <button class="org_x" @click="removeRule(scope.rules, ri)">&times;</button>
            </div>
          </div>
          <button class="g-btn" @click="addRule(scope.rules)">Add rule</button>
        </div>
        </template>
      </div>
    </div>

    <!-- Fallback -->
    <div class="org_block">
      <div class="org_block_head">
        <span class="org_block_title">Fallback rules</span>
        <button class="g-btn" @click="addRule(organize.noScopeRules)">Add rule</button>
      </div>
      <div v-for="(rule, i) in organize.noScopeRules" :key="i" class="org_rule">
        <div class="org_rule_conds">
          <input v-model="rule.tag" class="g-input" placeholder="tag" spellcheck="false" />
          <input v-model="rule.field" class="g-input" placeholder="field" spellcheck="false" />
          <span class="org_rule_eq">=</span>
          <input v-model="rule.value" class="g-input" placeholder="value" spellcheck="false" />
        </div>
        <div class="org_rule_dest">
          <span class="org_rule_arrow">&rarr;</span>
          <input v-model="rule.folder" class="g-input" placeholder="folder" spellcheck="false" />
          <button class="org_x" @click="removeRule(organize.noScopeRules, i)">&times;</button>
        </div>
      </div>
    </div>

    <div class="org_footer">
      <div>
        <div v-if="saved" class="g-saved">Saved</div>
        <div class="g-hint">Scopes match entries by condition. Rules place matched entries into subfolders.</div>
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

  & .g-input {
    width: 140px;
  }

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

        &:hover {
          background: var(--positive-hover);
        }
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

  &_scope {
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
      margin-bottom: var(--gap-xs);
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
    &_row {
      display: flex;
      align-items: flex-end;
      gap: var(--gap-sm);
      margin-bottom: var(--gap-sm);
    }
    &_name {
      font-weight: 600;
    }

    &_labeled {
      display: flex;
      flex-direction: column;
      gap: 2px;

      &._grow {
        flex: 1;
      }
    }

    &_section {
      margin-bottom: var(--gap-sm);
    }
  }

  &_cond {
    display: flex;
    align-items: center;
    gap: var(--gap-xs);
    margin-top: var(--gap-xs);

    &_cell {
      flex: 1;
      font-size: var(--font-xs);
    }

    &_eq {
      color: var(--text-dim);
      font-size: var(--font-xs);
      flex-shrink: 0;
    }
  }

  &_rule {
    margin-bottom: var(--gap-sm);
    padding-bottom: var(--gap-sm);
    border-bottom: 1px solid var(--bg-btn);
    display: flex;

    &_conds {
      display: flex;
      align-items: center;
      gap: var(--gap-xs);
      margin-bottom: var(--gap-xs);
    }

    &_eq {
      color: var(--text-dim);
      font-size: var(--font-xs);
      flex-shrink: 0;
    }

    &_dest {
      display: flex;
      align-items: center;
      gap: var(--gap-xs);
    }

    &_arrow {
      color: var(--text-dim);
      flex-shrink: 0;
    }
  }

  &_x {
    all: unset;
    cursor: pointer;
    color: var(--text-dim);
    font-size: var(--font-md);
    width: 20px;
    text-align: center;
    flex-shrink: 0;

    &:hover {
      color: var(--negative);
    }
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
