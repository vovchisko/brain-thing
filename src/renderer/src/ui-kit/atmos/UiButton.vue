<template>
  <button v-bind="{
        ...$attrs,
        disabled,
        type: $attrs.type || 'button',
        class: [
            'ui-button',
            (!hollow && !naked ? ' _solid' : ''),
            (hollow ? ' _hollow' : ''),
            (naked ? ' _naked' : ''),
            (isLoading ? ' _loading' : '')
        ].join(''),
      }" @mouseup="mUp">
    <slot />
    <span v-if="isLoading" class="ui-button_loader">🍪</span>

  </button>
</template>

<script setup>
defineProps({
  disabled: { type: Boolean, default: false },
  hollow: { type: Boolean, default: false },
  naked: { type: Boolean, default: false },
  isLoading: { type: Boolean, default: false },
})

const mUp = e => e.target.blur()
</script>

<style lang="scss" scoped>
.ui-button {
  font-size: var(--font-ui);

  -webkit-tap-highlight-color: transparent;
  outline: none;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  cursor: pointer;
  will-change: box-shadow, transform;
  transition: all var(--transition);
  font-family: inherit;

  &._solid {
    padding: spacing(200, 400);
    min-height: var(--ctl-h);
    border: 1px solid var(--ui-pal);
    border-radius: var(--radius-sm);
    background: var(--ui-pal);
    color: var(--text);
    gap: spacing(300);
  }

  &._hollow {
    background: transparent;
    padding: spacing(200, 400);
    color: var(--ui-pal);
    border: 1px solid var(--ui-pal);
    border-radius: var(--radius-sm);
    gap: spacing(300);
    min-height: var(--ctl-h);

    &:hover { box-shadow: 0 3px 10px -4px var(--ui-pal); }
    &:focus { box-shadow: 0 3px 10px -4px var(--ui-pal); }
    &:active { box-shadow: 0 1px 4px -2px var(--ui-pal); }

    &:disabled {
      cursor: default;
      color: var(--text-dim);
      box-shadow: none;
    }
  }

  &._naked {
    background: transparent;
    color: var(--ui-pal);
    border: 1px solid transparent;
    padding: spacing(300, 400);
    gap: spacing(300);
    min-height: var(--ctl-h);

    &:hover { box-shadow: none; }
    &:focus { box-shadow: none; }
    &:active { box-shadow: none; }

    &:disabled {
      color: var(--text-dim);
      box-shadow: none;
      cursor: default;
    }
  }

  &:hover {
    text-decoration: none;
    box-shadow: 0 4px 12px -4px var(--ui-pal);
  }

  &:focus {
    box-shadow: 0 4px 12px -4px var(--ui-pal);
  }

  &:active {
    transition-duration: 20ms;
    box-shadow: 0 3px 4px -2px var(--ui-pal);
  }

  &:disabled {
    cursor: default;
    background: var(--bg-btn);
    border-color: var(--text-dim);
    border-style: dashed;
    color: var(--text-dim);
    box-shadow: none;
  }

  &._loading {
    color: transparent !important;
  }

  &_loader {
    font-size: 1em;
    position: absolute;
    animation: fx-spin 2s infinite;
  }

  &._hollow > &_loader, &._naked > &_loader {
    position: absolute;
    animation: fx-spin 2s infinite;
  }
}
</style>
