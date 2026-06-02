<script setup>
import { computed } from 'vue'
import { state }    from '../state.js'
import LogPanel     from '../components/LogPanel.vue'

const topAttributes = computed(() =>
    Object.entries(state.attributes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
)

const projectList = computed(() =>
    Object.entries(state.projects.projects || {})
        .sort((a, b) => b[1] - a[1]),
)
</script>

<template>
  <div class="stat-view screen">
    <div class="main">
      <div class="big">
        <h2>{{ state.entries }}</h2>
        <p>documents in brain</p>
      </div>

      <div class="missing">
        <div class="missing_row">
          <div class="missing_n">{{ state.issues.summary }}</div>
          missing summary
        </div>
        <div class="missing_row">
          <div class="missing_n">{{ state.issues.links }}</div>
          empty links
        </div>
      </div>

      <div v-if="topAttributes.length" class="attributes">
        <h5>Attributes</h5>
        <div class="attributes-list">
          <div v-for="[name, count] in topAttributes" :key="name" class="attributes_item">
            <span class="attributes_item-name">{{ name }}</span>
            <span class="attributes_item-count">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="projectList.length" class="projects">
      <div v-for="[name, count] in projectList" :key="name" class="projects_item">
        <h3 class="projects_item-count">{{ count }}</h3>
        <div class="projects_item-name">{{ name }}</div>
      </div>
      <div v-if="state.projects.noProject" class="projects_item _dim">
        <h3 class="projects_item-count">{{ state.projects.noProject }}</h3>
        <div class="projects_item-name">No Project</div>
      </div>
    </div>

    <LogPanel class="log-panel" />

  </div>
</template>

<style scoped lang="scss">
.stat-view {
  gap: var(--gap-md);
  display: flex;
  flex-direction: column;

}

.main {
  display: flex;
  gap: 32px;
  align-items: start;
}

.missing {
  display: flex;
  gap: var(--gap-sm);
  flex-direction: column;
  font-size: var(--font-label);
  color: var(--text-dim);

  &_n {
    color: var(--text-soft);
    font-weight: 600;
    margin: 0;
    padding: 0;
    line-height: 1;
  }
}

.attributes {
  &-list {
    display: flex;
    gap: var(--gap-sm);
    flex: 1;
    flex-wrap: wrap;
  }

  &_item {
    display: inline-flex;
    align-items: center;
    gap: var(--gap-xs);
    padding: 1px 6px;
    border-radius: var(--radius-sm);
    background: var(--bg-btn);
    font-size: var(--font-label);

    &-name {
      color: var(--text-soft);
    }

    &-count {
      color: var(--text-dim);
    }
  }
}



.big {
  h2 {
    font-size: 48px;
    font-weight: 700;
    color: var(--text);
    line-height: 1;
  }

  p {
    font-size: var(--font-ui);
    color: var(--text-dim);
  }
}


.projects {
  display: flex;
  gap: var(--gap-sm);
  flex-wrap: wrap;

  &_item {
    flex: 0 0 120px;
    padding: var(--gap-sm);
    border-radius: var(--radius-md);
    background: var(--bg-input);

    &._dim { opacity: 0.5; }

    &-count {
      font-size: 28px;
      font-weight: 700;
      color: var(--text);
      line-height: 1;
      margin: 0;
    }

    &-name {
      font-size: var(--font-ui);
      font-weight: 600;
      color: var(--text-soft);
      margin-top: var(--gap-xs);
    }
  }
}

.log-panel {
  display: flex;
  flex-direction: column;
  min-height: 100px;
  margin-bottom: 0;
  flex: 1;
}
</style>
