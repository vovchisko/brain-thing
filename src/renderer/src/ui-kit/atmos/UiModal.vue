<template>
  <div :class="{'_shown':isOpen, '_sidebar': sidebar}" class="ui-modal" @mousedown.self="!blocking && emit('close')">
    <transition :name="sidebar ? 'slide' : 'bounce'">
      <div v-if="isOpen" class="ui-modal_window">
        <div v-if="$slots.header || !blocking" class="ui-modal_header">
          <div class="ui-modal_header-title">
            <slot name="header">Hey!</slot>
          </div>
          <ui-button v-if="!blocking" class="ui-modal_window-close ui-secondary" naked @click="emit('close')">
            <ui-icon :name="ICON.CROSS" />
          </ui-button>
        </div>
        <slot />
      </div>
    </transition>
  </div>
</template>
<script setup>
import { watch } from 'vue'
import { ICON }  from '@/ui-kit/atmos/UiIconParts/icon-names.js'

const emit = defineEmits([ 'close' ])

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  blocking: { type: Boolean, default: false },
  sidebar: { type: Boolean, default: false },
})

watch(() => props.isOpen, (val) => {
  if (val) document.body.style.overflow = 'hidden'
  else document.body.style.overflow = 'visible'
})

</script>

<style lang="scss" scoped>
.ui-modal {
  --pad: #{spacing(500)};

  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: var(--z-modal-backdrop);
  background-color: transparent;
  transition: background-color var(--transition), visibility var(--transition);
  pointer-events: none;
  visibility: hidden;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  overflow: auto;
  padding: calc(var(--pad) * 2);

  @include scroll-styled();

  &._shown {
    background-color: rgba(0, 0, 0, 0.6);
    visibility: visible;
    pointer-events: unset;
    backdrop-filter: blur(2px);
  }

  &._sidebar {
    justify-content: flex-end;
    align-items: stretch;
    padding: 0;
    backdrop-filter: none !important;

    .ui-modal_window {
      margin: 0;
      border-radius: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      overflow: auto;

      @include scroll-styled();
    }

    .ui-modal_window-close {
      position: static;
      transform: none;
    }
  }

  &_window {
    position: relative;
    margin: auto;
    border-radius: var(--radius-sm);
    background-color: var(--bg-raised);
    padding: var(--pad);
    max-width: calc(100% - (var(--pad) * 5));
    width: 480px;
    user-select: text;

    &-close {
      position: relative;
      transform: translateX(200%) translateY(-200%);
      font-size: calc(var(--pad) * 0.75);
      min-width: var(--pad);
      --ctl-h: var(--pad);
    }
  }

  &_header {
    display: flex;
    align-items: center;
    padding-bottom: spacing(500);

    &-title {
      font-size: var(--font-heading);
      font-weight: bold;
      flex: 1;
    }
  }
}

.bounce-enter-active {
  animation: slide-down 200ms;
}

.bounce-leave-active {
  animation: slide-down 200ms reverse;
}

@keyframes slide-down {
  0% {
    transform: translateY(-20px);
    opacity: 0;
  }
  100% {
    transform: translateX(0);
    opacity: 1;
  }
}

.slide-enter-active {
  animation: slide-in 200ms;
}

.slide-leave-active {
  animation: slide-in 200ms reverse;
}

@keyframes slide-in {
  0% {
    clip-path: inset(0 0 0 100%);
  }
  100% {
    clip-path: inset(0 0 0 0);
  }
}
</style>
