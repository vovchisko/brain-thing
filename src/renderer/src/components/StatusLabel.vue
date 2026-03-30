<script setup>
import { computed }  from 'vue'
import { STATUS }    from '../../../shared/status'
import { state }     from '../state'

const LABELS = {
  [STATUS.IDLE]:        'No vault',
  [STATUS.STARTUP]:     'Starting...',
  [STATUS.DOWNLOADING]: 'Downloading model',
  [STATUS.SCANNING]:    'Scanning...',
  [STATUS.INDEXING]:    'Building vectors...',
  [STATUS.REINDEXING]:  'Re-indexing...',
  [STATUS.READY]:       'Ready',
}

const label = computed(() => LABELS[state.status.phase] || '...')
const isReady = computed(() => state.status.phase === STATUS.READY)
</script>

<template>
  <span class="status-label" :class="{ _ready: isReady }">
    {{ label }}
    <span v-if="state.status.progress != null" class="status-label_progress">{{ state.status.progress }}%</span>
  </span>
</template>

<style scoped lang="scss">
.status-label {
  font-size: var(--font-xs);
  color: var(--text-dim);
  white-space: nowrap;

  &._ready { color: var(--positive); }

  &_progress {
    color: var(--positive);
    font-weight: 600;
  }
}
</style>
