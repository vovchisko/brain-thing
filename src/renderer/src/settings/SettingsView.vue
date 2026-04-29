<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { settings }        from './state.js'
import GeneralSettings     from './GeneralSettings.vue'
import FieldSettings       from './FieldSettings.vue'
import IgnoreSettings      from './IgnoreSettings.vue'
import OrganizeSettings    from './OrganizeSettings.vue'
import NarrateSettings     from './NarrateSettings.vue'

const ttsOn = computed(() => !!settings.vault.value?.features?.tts)

const sections = computed(() => {
  const list = [
    { id: 'general', label: 'General' },
    { id: 'fields', label: 'Fields' },
    { id: 'ignore', label: 'Ignore' },
    { id: 'organize', label: 'Organize' },
  ]
  if (ttsOn.value) list.push({ id: 'narrate', label: 'Narrate' })
  return list
})

const active = ref('general')

watch(ttsOn, (on) => { if (!on && active.value === 'narrate') active.value = 'general' })

onMounted(settings.load)
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
        <NarrateSettings  v-if="active === 'narrate' && ttsOn" />
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
      max-width: 900px;
    }
  }
}
</style>
