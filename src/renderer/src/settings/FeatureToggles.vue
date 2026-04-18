<script setup>
import { settings } from './state.js'

async function toggle (key) {
  const features = { ...settings.vault.value.features, [key]: !settings.vault.value.features[key] }
  await settings.saveVault({ features })
}
</script>

<template>
  <div v-if="settings.vault.value" class="features">
    <label class="g-label">Features</label>
    <div class="features_row">
      <span class="features_name">TTS Narration</span>
      <button class="g-btn features_toggle" :class="{ _on: settings.vault.value.features.tts }" @click="toggle('tts')">
        {{ settings.vault.value.features.tts ? 'ON' : 'OFF' }}
      </button>
    </div>
    <div class="g-hint">Optional features. Changes require MCP restart.</div>
  </div>
</template>

<style scoped lang="scss">
.features {
  &_row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 0;
  }
  &_name {
    font-size: var(--font-sm);
    color: var(--text);
  }
  &_toggle {
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
</style>
