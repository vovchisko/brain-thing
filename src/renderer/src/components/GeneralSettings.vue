<script setup>
import { ref, computed, onMounted } from 'vue'
import { state }           from '../state'
import FolderPicker        from './FolderPicker.vue'
import GuidelineName       from './GuidelineName.vue'

const mcpStatus = ref([])
const openAtLogin = ref(false)
const startMinimized = ref(false)

onMounted(async () => {
  mcpStatus.value = await window.api.mcp.status()
  openAtLogin.value = await window.api.autostart.get()
  const cfg = await window.api.config.get()
  startMinimized.value = cfg.startMinimized || false
})

const mcpRegistered = computed(() => mcpStatus.value.some(c => c.registered))
const mcpError = ref(null)

async function toggleMcp () {
  mcpError.value = null
  const results = mcpRegistered.value
    ? await window.api.mcp.unregister()
    : await window.api.mcp.register()
  const failed = results.filter(r => !r.ok)
  if (failed.length) mcpError.value = failed.map(r => `${ r.label }: ${ r.error }`).join('; ')
  mcpStatus.value = await window.api.mcp.status()
}

async function toggleAutostart () {
  openAtLogin.value = !openAtLogin.value
  await window.api.autostart.set(openAtLogin.value)
}

async function toggleStartMinimized () {
  startMinimized.value = !startMinimized.value
  await window.api.config.set({ startMinimized: startMinimized.value })
}

async function toggleVerbose () {
  state.verboseConsole = !state.verboseConsole
  await window.api.config.set({ verboseConsole: state.verboseConsole })
}
</script>

<template>
  <FolderPicker />
  <GuidelineName />
  <div class="general_row">
    <div>
      <div class="general_row_name">MCP for Claude</div>
      <div class="g-hint">Register Brain Thing as MCP server in Claude Desktop &amp; Claude Code.</div>
      <div v-if="mcpStatus.length" class="g-hint">
        <span v-for="c in mcpStatus" :key="c.label" class="general_row_mcp_badge" :class="{ _on: c.registered }">
          {{ c.label }}
        </span>
      </div>
      <div v-if="mcpRegistered" class="g-hint">Restart Claude to apply changes.</div>
      <div v-if="mcpError" class="general_row_error">{{ mcpError }}</div>
    </div>
    <button class="g-btn general_row_toggle" :class="{ _on: mcpRegistered }" @click="toggleMcp">
      {{ mcpRegistered ? 'ON' : 'OFF' }}
    </button>
  </div>
  <div class="general_row">
    <div>
      <div class="general_row_name">Start with system</div>
      <div class="g-hint">Launch Brain Thing when you log in.</div>
    </div>
    <button class="g-btn general_row_toggle" :class="{ _on: openAtLogin }" @click="toggleAutostart">
      {{ openAtLogin ? 'ON' : 'OFF' }}
    </button>
  </div>
  <div class="general_row">
    <div>
      <div class="general_row_name">Start minimized</div>
      <div class="g-hint">Start in system tray without opening the window.</div>
    </div>
    <button class="g-btn general_row_toggle" :class="{ _on: startMinimized }" @click="toggleStartMinimized">
      {{ startMinimized ? 'ON' : 'OFF' }}
    </button>
  </div>
  <div class="general_row">
    <div>
      <div class="general_row_name">Verbose console</div>
      <div class="g-hint">Show internal system events (import, watcher, diagnostics) in the log panel.</div>
    </div>
    <button class="g-btn general_row_toggle" :class="{ _on: state.verboseConsole }" @click="toggleVerbose">
      {{ state.verboseConsole ? 'ON' : 'OFF' }}
    </button>
  </div>
</template>

<style scoped lang="scss">
.general_row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--gap-md);

  &_name {
    font-size: var(--font-sm);
    color: var(--text);
    margin-bottom: var(--gap-xs);
  }

  &_toggle {
    padding: 4px 14px;
    font-size: var(--font-xs);
    font-weight: 600;
    min-width: 48px;
    flex-shrink: 0;

    &._on {
      background: var(--positive);
      color: var(--text);
      &:hover { background: var(--positive-hover); }
    }
  }

  &_error {
    font-size: var(--font-xs);
    color: var(--negative);
    margin-top: var(--gap-xs);
  }

  &_mcp_badge {
    display: inline-block;
    padding: 1px 6px;
    margin-right: var(--gap-xs);
    border-radius: var(--radius-sm);
    font-size: var(--font-xs);
    background: var(--bg-btn);
    color: var(--text-dim);

    &._on {
      background: var(--positive);
      color: var(--text);
    }
  }
}
</style>
