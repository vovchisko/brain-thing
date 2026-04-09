<script setup>
import { ref }      from 'vue'
import AppHeader    from './components/AppHeader.vue'
import StatsView    from './views/StatsView.vue'
import SettingsView from './settings/SettingsView.vue'

const activeTab = ref('stats')
</script>

<template>
  <AppHeader v-model="activeTab" />
  <StatsView v-if="activeTab === 'stats'" />
  <SettingsView v-if="activeTab === 'settings'" />
</template>
