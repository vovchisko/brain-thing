<script setup>
import { ref, onMounted }  from 'vue'
import { state }           from '../state'
import FolderPicker        from './FolderPicker.vue'
import GuidelineName       from './GuidelineName.vue'

const normTypo = ref(false)

onMounted(async () => {
  const cfg = await window.api.config.get()
  normTypo.value = cfg.normalizeTypography || false
})

const normChanged = ref(false)

async function toggleNormTypo() {
  normTypo.value = !normTypo.value
  await window.api.config.set({ normalizeTypography: normTypo.value })
  normChanged.value = true
}

function applyNormTypo() {
  window.api.brainSwap()
  normChanged.value = false
}

async function toggleVerbose() {
  state.verboseConsole = !state.verboseConsole
  await window.api.config.set({ verboseConsole: state.verboseConsole })
}
</script>

<template>
  <FolderPicker />
  <GuidelineName />
  <div class="general_row">
    <div>
      <div class="general_row_name">Normalize typography</div>
      <div class="g-hint">Replace curly quotes, em/en dashes, ellipsis with plain ASCII on import. Disable for literature.</div>
      <div v-if="normChanged" class="g-hint">
        Requires re-index.
        <button class="g-btn general_row_reindex" @click="applyNormTypo">Re-index now</button>
      </div>
    </div>
    <button class="g-btn general_row_toggle" :class="{ _on: normTypo }" @click="toggleNormTypo">
      {{ normTypo ? 'ON' : 'OFF' }}
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

  &_reindex {
    padding: 2px 8px;
    font-size: var(--font-xs);
    margin-left: var(--gap-sm);
  }
}
</style>
