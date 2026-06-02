<script setup>
import { computed, onMounted, ref } from 'vue'
import { settings } from './state.js'
import { ACCESS, TOOL_GROUP } from '../../../shared/specs.js'

const catalog = ref([])

onMounted(async () => {
  catalog.value = await window.api.tools.list()
})

const tools = computed(() => settings.vault.value?.tools || {})

const isOn = (name) => tools.value[name] !== false

const GROUP_ORDER = [TOOL_GROUP.CORE, TOOL_GROUP.SETTINGS, TOOL_GROUP.DATABASE]

const groups = computed(() => {
  const byGroup = {}
  for (const t of catalog.value) (byGroup[t.group] ||= []).push(t)
  return GROUP_ORDER
      .filter(g => byGroup[g]?.length)
      .map(g => ({ id: g, tools: byGroup[g] }))
})

const enabledCount = computed(() => catalog.value.filter(t => isOn(t.name)).length)

async function commit (next) {
  await settings.saveVault({ tools: next })
}

function toggle (name) {
  commit({ ...tools.value, [name]: !isOn(name) })
}

function setGroup (groupTools, on) {
  const next = { ...tools.value }
  for (const t of groupTools) next[t.name] = on
  commit(next)
}

function readOnly () {
  const next = { ...tools.value }
  for (const t of catalog.value) next[t.name] = t.access !== ACCESS.WRITE
  commit(next)
}
</script>

<template>
  <div class="tools">
    <label class="g-label">MCP Tools</label>
    <div class="g-hint tools_intro">
      Disabled tools are hidden from the MCP client entirely. After changing toggles,
      restart the MCP server in your client (Claude, LM Studio) to apply.
      <br />{{ enabledCount }} of {{ catalog.length }} enabled.
    </div>

    <div class="tools_quick">
      <button class="g-btn" @click="readOnly">Read-only (disable all write tools)</button>
    </div>

    <div v-for="grp in groups" :key="grp.id" class="tools_block">
      <div class="tools_block_head">
        <span class="tools_block_title">{{ grp.id }}</span>
        <div class="tools_block_actions">
          <button class="g-btn" @click="setGroup(grp.tools, true)">Enable all</button>
          <button class="g-btn" @click="setGroup(grp.tools, false)">Disable all</button>
        </div>
      </div>

      <div v-for="t in grp.tools" :key="t.name" class="tools_row">
        <div class="tools_row_info">
          <span class="tools_row_name">{{ t.name }}</span>
          <span class="tools_row_badge" :class="`_${ t.access }`">{{ t.access }}</span>
        </div>
        <button class="g-btn tools_row_toggle" :class="{ _on: isOn(t.name) }" @click="toggle(t.name)">
          {{ isOn(t.name) ? 'ON' : 'OFF' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.tools {
  &_intro {
    margin-bottom: var(--gap-md);
  }

  &_quick {
    margin-bottom: var(--gap-md);
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
      font-size: var(--font-label);
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    &_actions {
      display: flex;
      gap: var(--gap-xs);
    }
  }

  &_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--gap-md);
    background: var(--bg);
    border: 1px solid var(--bg-btn);
    border-radius: var(--radius-md);
    padding: var(--gap-sm) var(--gap-md);
    margin-bottom: var(--gap-xs);

    &_info {
      display: flex;
      align-items: center;
      gap: var(--gap-sm);
    }

    &_name {
      font-size: var(--font-ui);
      color: var(--text);
    }

    &_badge {
      font-size: var(--font-label);
      padding: 1px 6px;
      border-radius: var(--radius-sm);
      background: var(--bg-btn);
      color: var(--text-dim);

      &._write {
        color: var(--negative);
      }
    }

    &_toggle {
      padding: 4px 14px;
      font-size: var(--font-label);
      font-weight: 600;
      min-width: 48px;
      flex-shrink: 0;

      &._on {
        background: var(--positive);
        color: var(--text);
        &:hover { background: var(--positive-hover); }
      }
    }
  }
}
</style>
