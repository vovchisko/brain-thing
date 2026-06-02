<script setup>
import { computed }  from 'vue'
import { STATUS }    from '../../../shared/status.js'
import { state }     from '../state.js'

const LABELS = {
  [STATUS.IDLE]:        'No vault',
  [STATUS.STARTUP]:     'Starting...',
  [STATUS.DOWNLOADING]: 'Downloading model',
  [STATUS.SCANNING]:    'Scanning...',
  [STATUS.INDEXING]:    'Building vectors...',
  [STATUS.REINDEXING]:  'Re-indexing...',
  [STATUS.READY]:       'Ready',
  [STATUS.ERROR]:       'Failed',
}

const label = computed(() => LABELS[state.status.phase] || '...')
const isReady = computed(() => state.status.phase === STATUS.READY)
const isError = computed(() => state.status.phase === STATUS.ERROR)
</script>

<template>
  <span class="status-label" :class="{ _ready: isReady, _error: isError }">
    {{ label }}
    <span v-if="state.status.progress != null" class="status-label_progress">{{ state.status.progress }}%</span>
    <span v-if="isError && state.status.message" class="status-label_message">— {{ state.status.message }}</span>
  </span>
</template>

<style scoped lang="scss">
.status-label {
  font-size: var(--font-label);
  color: var(--text-dim);
  white-space: nowrap;

  &._ready { color: var(--positive); }
  &._error { color: var(--negative); }

  &_progress {
    color: var(--positive);
    font-weight: 600;
  }

  &_message {
    color: var(--negative);
    margin-left: 4px;
  }
}
</style>
