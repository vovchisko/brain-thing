<template>
  <div class="empty-screen">
    <h1>No collections yet</h1>
    <p>Open <strong>Schemas</strong> in the left panel and create one.</p>
  </div>
</template>

<style lang="scss" scoped>
.empty-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: spacing(200);
  color: var(--text-soft);
}
</style>
