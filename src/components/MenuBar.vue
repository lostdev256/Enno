<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// --- Menu data structure ---
interface MenuItem {
  label: string
  action?: string
  shortcut?: string
  separator?: boolean
}

interface MenuGroup {
  label: string
  items: MenuItem[]
}

const menus: MenuGroup[] = [
  {
    label: 'File',
    items: [
      { label: 'Create', action: 'file:create', shortcut: '⌘N' },
      { label: 'Open', action: 'file:open', shortcut: '⌘O' },
      { separator: true, label: '' },
      { label: 'Save', action: 'file:save', shortcut: '⌘S' },
      { label: 'Save As', action: 'file:save-as', shortcut: '⇧⌘S' },
    ],
  },
  {
    label: 'Characters',
    items: [
      { label: 'Cards', action: 'characters:cards' },
      { label: 'Links', action: 'characters:links' },
    ],
  },
  {
    label: 'Locations',
    items: [
      { label: 'Map', action: 'locations:map' },
    ],
  },
  {
    label: 'Help',
    items: [
      { label: 'About', action: 'help:about' },
    ],
  },
]

const emit = defineEmits<{
  (e: 'navigate', page: string): void
}>()

const openMenu = ref<string | null>(null)

const navigationActions: Record<string, string> = {
  'characters:cards': 'characters-cards',
  'characters:links': 'characters-links',
  'locations:map': 'locations-map',
}

function toggleMenu(label: string) {
  openMenu.value = openMenu.value === label ? null : label
}

function handleAction(action?: string) {
  openMenu.value = null
  if (!action) return
  console.log(`[MenuBar] action: ${action}`)

  // Navigation actions — emit to App.vue
  if (action in navigationActions) {
    emit('navigate', navigationActions[action])
    return
  }

  // Backend actions — send via IPC
  window.ennoAPI.invokeMenuAction(action)
}

function closeMenu(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.menubar')) {
    openMenu.value = null
  }
}

onMounted(() => {
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
})
</script>

<template>
  <nav class="menubar" id="app-menubar">
    <div class="menubar-brand">Enno</div>
    <div
      v-for="menu in menus"
      :key="menu.label"
      class="menubar-item"
    >
      <button
        :id="`menu-${menu.label.toLowerCase()}`"
        class="menubar-trigger"
        :class="{ active: openMenu === menu.label }"
        @click.stop="toggleMenu(menu.label)"
        @mouseenter="openMenu && (openMenu = menu.label)"
      >
        {{ menu.label }}
      </button>
      <Transition name="dropdown">
        <div
          v-if="openMenu === menu.label"
          class="menubar-dropdown"
        >
          <template v-for="item in menu.items" :key="item.label">
            <div v-if="item.separator" class="dropdown-separator"></div>
            <button
              v-else
              :id="`menu-action-${item.action}`"
              class="dropdown-item"
              @click="handleAction(item.action)"
            >
              <span class="dropdown-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="dropdown-shortcut">{{ item.shortcut }}</span>
            </button>
          </template>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
  height: 36px;
  background: linear-gradient(180deg, #2a2a2e 0%, #1e1e22 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding: 0 8px;
  user-select: none;
  -webkit-app-region: drag;
  position: relative;
  z-index: 1000;
  flex-shrink: 0;
}

.menubar-brand {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #b8b8cc;
  padding: 0 12px 0 8px;
  margin-right: 4px;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  -webkit-app-region: no-drag;
}

.menubar-item {
  position: relative;
  -webkit-app-region: no-drag;
}

.menubar-trigger {
  background: none;
  border: none;
  color: #c0c0d0;
  font-size: 12.5px;
  font-weight: 500;
  font-family: inherit;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  line-height: 1;
}

.menubar-trigger:hover,
.menubar-trigger.active {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
}

.menubar-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  background: #2c2c32;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 4px 0;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.45),
    0 2px 8px rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(20px);
  z-index: 1001;
}

.dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.dropdown-item:hover {
  background: rgba(100, 108, 255, 0.18);
  color: #ffffff;
}

.dropdown-label {
  flex: 1;
}

.dropdown-shortcut {
  margin-left: 24px;
  font-size: 11px;
  color: #777790;
  font-weight: 400;
}

.dropdown-separator {
  height: 1px;
  margin: 4px 8px;
  background: rgba(255, 255, 255, 0.08);
}

/* --- Dropdown transition --- */
.dropdown-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
