<script setup>
import { onMounted, ref }  from 'vue'
import { settings }        from './state.js'
import GeneralSettings     from './GeneralSettings.vue'
import AttributeSettings   from './AttributeSettings.vue'
import IgnoreSettings      from './IgnoreSettings.vue'
import OrganizeSettings    from './OrganizeSettings.vue'
import NarrateSettings     from './NarrateSettings.vue'
import ToolsSettings       from './ToolsSettings.vue'

const sections = [
  { id: 'general', label: 'General' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'ignore', label: 'Ignore' },
  { id: 'organize', label: 'Organize' },
  { id: 'narrate', label: 'Narrate' },
  { id: 'tools', label: 'Tools' },
]

const active = ref('general')

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
        <AttributeSettings v-if="active === 'attributes'" />
        <IgnoreSettings   v-if="active === 'ignore'" />
        <OrganizeSettings v-if="active === 'organize'" />
        <NarrateSettings  v-if="active === 'narrate'" />
        <ToolsSettings    v-if="active === 'tools'" />
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
      font-size: var(--font-ui);
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
