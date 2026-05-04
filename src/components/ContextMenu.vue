<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

export interface ContextMenuItem {
  label: string
  action?: string
  icon?: string
  separator?: boolean
  disabled?: boolean
}

const props = defineProps<{
  items: ContextMenuItem[]
  x: number
  y: number
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'action', action: string): void
  (e: 'close'): void
}>()

const menuRef = ref<HTMLElement | null>(null)
const adjustedX = ref(props.x)
const adjustedY = ref(props.y)

watch(() => [props.x, props.y, props.visible], () => {
  if (props.visible) {
    nextTick(() => {
      if (!menuRef.value) return
      const rect = menuRef.value.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      adjustedX.value = props.x + rect.width > vw ? vw - rect.width - 4 : props.x
      adjustedY.value = props.y + rect.height > vh ? vh - rect.height - 4 : props.y
    })
  }
})

function handleClick(item: ContextMenuItem) {
  if (item.disabled || item.separator) return
  if (item.action) emit('action', item.action)
  emit('close')
}

function onClickOutside(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) {
    emit('close')
  }
}

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside, true)
  document.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside, true)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="ctx">
      <div
        v-if="visible"
        ref="menuRef"
        class="context-menu"
        :style="{ left: adjustedX + 'px', top: adjustedY + 'px' }"
      >
        <template v-for="(item, i) in items" :key="i">
          <div v-if="item.separator" class="ctx-separator"></div>
          <button
            v-else
            class="ctx-item"
            :class="{ disabled: item.disabled }"
            @click="handleClick(item)"
          >
            <span v-if="item.icon" class="ctx-icon">{{ item.icon }}</span>
            <span class="ctx-label">{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.context-menu {
  position: fixed;
  min-width: 180px;
  background: #2c2c34;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.5),
    0 2px 8px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  z-index: 9999;
  user-select: none;
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  color: #d0d0e0;
  font-size: 12.5px;
  font-family: inherit;
  padding: 6px 14px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  text-align: left;
}

.ctx-item:hover:not(.disabled) {
  background: rgba(100, 108, 255, 0.18);
  color: #fff;
}

.ctx-item.disabled {
  opacity: 0.4;
  cursor: default;
}

.ctx-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.ctx-label {
  flex: 1;
}

.ctx-separator {
  height: 1px;
  margin: 4px 8px;
  background: rgba(255, 255, 255, 0.08);
}

/* Transition */
.ctx-enter-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.ctx-leave-active {
  transition: opacity 0.08s ease, transform 0.08s ease;
}
.ctx-enter-from {
  opacity: 0;
  transform: scale(0.95);
}
.ctx-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
