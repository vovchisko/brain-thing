<script setup>
import { computed } from 'vue'
import { state }    from '../state'
import LogPanel     from '../components/LogPanel.vue'

const topFields = computed(() =>
    Object.entries(state.fields)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
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

      <div v-if="topFields.length" class="fields">
        <h5>Fields</h5>
        <div class="fields-list">
          <div v-for="[name, count] in topFields" :key="name" class="fields_item">
            <span class="fields_item-name">{{ name }}</span>
            <span class="fields_item-count">{{ count }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="state.scopes.scopes.length" class="scopes">
      <div v-for="s in state.scopes.scopes" :key="s.name" class="scopes_item">
        <h3 class="scopes_item-count">{{ s.count }}</h3>
        <div class="scopes_item-name">{{ s.name }}</div>
        <div class="scopes_item-summary">{{ s.summary || 'no summary' }}</div>
      </div>
      <div v-if="state.scopes.unscoped" class="scopes_item _dim">
        <h3 class="scopes_item-count">{{ state.scopes.unscoped }}</h3>
        <div class="scopes_item-name">No Scope</div>
        <div class="scopes_item-summary">Entries not matching any scope</div>
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
  font-size: var(--font-xs);
  color: var(--text-dim);

  &_n {
    color: var(--text-soft);
    font-weight: 600;
    margin: 0;
    padding: 0;
    line-height: 1;
  }
}

.fields {
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
    font-size: var(--font-xs);

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
    font-size: var(--font-sm);
    color: var(--text-dim);
  }
}

.scopes {
  display: flex;
  gap: var(--gap-sm);
  flex-wrap: wrap;

  &_item {
    flex: 0 0 140px;
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
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--text-soft);
      margin-top: var(--gap-xs);
    }

    &-summary {
      font-size: var(--font-xs);
      color: var(--text-dim);
      margin-top: var(--gap-xs);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
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
