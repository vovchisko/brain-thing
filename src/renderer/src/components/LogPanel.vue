<script setup>
import { nextTick, watch, ref, computed } from 'vue'
import { logs, state }                   from '../state.js'

const el = ref(null)

const filtered = computed(() =>
  state.verboseConsole ? logs.value : logs.value.filter(e => !e.system),
)

function scrollDown () {
  nextTick(() => { if (el.value) el.value.scrollTop = el.value.scrollHeight })
}

watch(filtered, scrollDown, { deep: true })
</script>

<template>
  <div class="log-panel">
    <div ref="el" class="log-panel_list">
      <div v-if="!filtered.length" class="log-panel_empty">No logs yet</div>
      <div v-for="entry in filtered" :key="entry.id" class="log-panel_entry" :class="['_' + entry.state, { _system: entry.system, _brain: entry.module === 'brain', _tts: entry.module === 'tts' }]">
        <span v-if="entry.module" class="log-panel_entry_module">{{ entry.module }}</span>
        <div class="log-panel_entry_body">
          <div class="log-panel_entry_text">
            {{ entry.text }}
            <span v-if="entry.secondary" class="log-panel_entry_secondary">{{ entry.secondary }}</span>
          </div>
          <div v-for="(line, li) in entry.lines" :key="li" class="log-panel_entry_line">{{ line }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
$system-badge: #3a3f48;
$system-text: #6a6e7a;
$tool-badge: #1a5a8a;
$brain-badge: #5a4a20;
$tts-badge: #1a5a5a;

.log-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  line-height: 14px;

  &_list {
    flex: 1;
    overflow-y: auto;
    border-radius: 6px;
    padding: 4px 8px;
    font-family: monospace;
  }

  &_empty { color: var(--text-dim); }

  &_entry {
    display: flex;
    gap: 6px;
    margin: 2px 0;

    &._pending .log-panel_entry_text { color: var(--text-dim); }
    &._warn .log-panel_entry_text    { color: var(--warning); }
    &._error .log-panel_entry_text   { color: var(--negative); }

    &_module {
      flex-shrink: 0;
      padding: 0 5px;
      border-radius: 3px;
      font-size: var(--font-label);
      font-weight: 600;
      min-width: 68px;
      text-align: center;
      align-self: flex-start;
      background: $tool-badge;
      color: var(--text);
    }

    &._system .log-panel_entry_module { background: $system-badge; color: $system-text; }
    &._system .log-panel_entry_text { color: $system-text; }

    &._brain .log-panel_entry_module { background: $brain-badge; }
    &._tts .log-panel_entry_module { background: $tts-badge; }

    &_body { min-width: 0; }

    &_text {
      color: var(--text-soft);
      word-break: break-word;
    }

    &_secondary {
      color: var(--text-dim);
      margin-left: 6px;
    }

    &_line {
      color: var(--text-dim);
      word-break: break-word;
      white-space: pre-wrap;
      min-height: 14px;
    }

    &._warn .log-panel_entry_line { color: var(--warning); }
    &._error .log-panel_entry_line { color: var(--negative); }
  }
}
</style>
