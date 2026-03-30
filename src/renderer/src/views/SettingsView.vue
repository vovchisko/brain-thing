<script setup>
import { ref }             from 'vue'
import GeneralSettings     from '../components/GeneralSettings.vue'
import FieldSettings       from '../components/FieldSettings.vue'
import IgnoreSettings      from '../components/IgnoreSettings.vue'
import OrganizeSettings    from '../components/OrganizeSettings.vue'
import FeatureToggles      from '../components/FeatureToggles.vue'

const sections = [
  { id: 'general', label: 'General' },
  { id: 'fields', label: 'Fields' },
  { id: 'ignore', label: 'Ignore' },
  { id: 'organize', label: 'Organize' },
  { id: 'features', label: 'Features' },
]

const active = ref('general')
</script>

<template>
  <div class="settings screen">
    <nav class="settings_nav">
      <button
          v-for="s in sections"
          :key="s.id"
          :class="{ _active: active === s.id }"
          @click="active = s.id"
      >{{ s.label }}
      </button>
    </nav>
    <div class="settings_scroll">
      <div class="settings_scroll_content">
        <GeneralSettings  v-if="active === 'general'" />
        <FieldSettings    v-if="active === 'fields'" />
        <IgnoreSettings   v-if="active === 'ignore'" />
        <OrganizeSettings v-if="active === 'organize'" />
        <FeatureToggles   v-if="active === 'features'" />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.settings {
  flex-direction: column;

  &_nav {
    display: flex;
    gap: var(--gap-xs);
    padding-top: var(--gap-xs);

    button {
      all: unset;
      cursor: pointer;
      padding: var(--gap-sm) var(--gap-sm);
      font-size: var(--font-sm);
      color: var(--text-dim);
      border-radius: var(--radius-sm);
      text-align: left;

      &:hover { color: var(--text-soft); }
      &._active {
        color: var(--text);
        background: var(--bg-btn);
      }
    }
  }

  &_scroll {
    overflow-y: auto;
    flex: 1;
    display: flex;
    padding: 0 10px;

    &_content {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2em;
      max-width: 640px;
    }
  }
}
</style>
