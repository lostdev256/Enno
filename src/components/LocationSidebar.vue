<script setup lang="ts">
import { ref, defineProps, defineEmits, watch } from 'vue'
import LocationSidebarTree from './LocationSidebarTree.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface LocationTreeItem {
  id: string
  name: string
  mapX: number | null
  mapY: number | null
  children: LocationTreeItem[]
}

const props = defineProps<{
  tree: LocationTreeItem[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'update-structure', newTree: LocationTreeItem[]): void
  (e: 'select', id: string): void
  (e: 'create-root'): void
  (e: 'create-child', parentId: string): void
  (e: 'delete', id: string): void
}>()

const localTree = ref<LocationTreeItem[]>([])

watch(() => props.tree, (newTree) => {
  // Deep clone to allow vuedraggable to mutate locally before emitting
  localTree.value = JSON.parse(JSON.stringify(newTree))
}, { immediate: true, deep: true })

function onTreeUpdate(newTree: LocationTreeItem[]) {
  emit('update-structure', newTree)
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h2>{{ t('menu.locations') }}</h2>
      <button class="add-root-btn" @click="$emit('create-root')" :title="t('locations.addRootLocation')">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div class="sidebar-content">
      <LocationSidebarTree
        :list="localTree"
        @update:list="onTreeUpdate"
        :selectedId="selectedId"
        @select="$emit('select', $event)"
        @add-child="$emit('create-child', $event)"
        @delete="$emit('delete', $event)"
      />
      
      <div v-if="localTree.length === 0" class="empty-state">
        <p>{{ t('locations.selectLocationToViewMap') }}</p>
        <button class="add-root-btn-large" @click="$emit('create-root')">{{ t('locations.addRootLocation') }}</button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 280px;
  background: #1e1e24;
  border-right: 1px solid rgba(255,255,255,0.05);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.sidebar-header h2 {
  font-size: 14px;
  font-weight: 600;
  color: #e0e0f0;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin: 0;
}

.add-root-btn {
  background: transparent;
  border: none;
  color: #a5b4fc;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.add-root-btn:hover {
  background: rgba(100, 108, 255, 0.15);
  color: #c7d2fe;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
}
.sidebar-content::-webkit-scrollbar { width: 6px; }
.sidebar-content::-webkit-scrollbar-track { background: transparent; }
.sidebar-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
  font-size: 13px;
}
.add-root-btn-large {
  margin-top: 12px;
  background: rgba(100, 108, 255, 0.1);
  border: 1px solid rgba(100, 108, 255, 0.2);
  color: #a5b4fc;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}
.add-root-btn-large:hover {
  background: rgba(100, 108, 255, 0.2);
}
</style>
