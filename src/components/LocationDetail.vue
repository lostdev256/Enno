<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import RichTextEditor from './RichTextEditor.vue'
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
  location: any
  tree: LocationTreeItem[]
}>()

const emit = defineEmits<{
  (e: 'update', id: string, field: string, value: any): void
  (e: 'upload-map', id: string): void
  (e: 'create-child', parentId: string): void
  (e: 'select', id: string): void
  (e: 'reload-tree'): void
}>()

// --- Name ---
const editingName = ref(false)
const nameInput = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startEditName() {
  nameInput.value = props.location.name
  editingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function saveName() {
  editingName.value = false
  if (nameInput.value.trim() && nameInput.value !== props.location.name) {
    emit('update', props.location.id, 'name', nameInput.value.trim())
  }
}

// --- Description ---
function updateDescription(val: string) {
  emit('update', props.location.id, 'description', val)
}

// --- Map Logic ---
const mapEditMode = ref(false)
const mapOverlayRef = ref<HTMLElement | null>(null)

function getMapSrc(path: string | null) {
  if (!path) return ''
  return `enno://${path}`
}

// Find children from tree
const childLocations = computed<LocationTreeItem[]>(() => {
  function findNode(nodes: LocationTreeItem[], id: string): LocationTreeItem | null {
    for (const node of nodes) {
      if (node.id === id) return node
      if (node.children) {
        const found = findNode(node.children, id)
        if (found) return found
      }
    }
    return null
  }
  const node = findNode(props.tree, props.location.id)
  return node ? node.children : []
})

const placedChildren = computed(() => {
  return childLocations.value.filter(c => c.mapX !== null && c.mapY !== null)
})

const unplacedChildren = computed(() => {
  return childLocations.value.filter(c => c.mapX === null || c.mapY === null)
})

// --- Map Dragging ---
const draggingChildId = ref<string | null>(null)

function startDrag(e: MouseEvent, childId: string) {
  if (!mapEditMode.value) return
  e.preventDefault()
  e.stopPropagation()
  draggingChildId.value = childId
}

function onDrag(e: MouseEvent) {
  if (!mapEditMode.value || !draggingChildId.value || !mapOverlayRef.value) return
  
  const rect = mapOverlayRef.value.getBoundingClientRect()
  let x = ((e.clientX - rect.left) / rect.width) * 100
  let y = ((e.clientY - rect.top) / rect.height) * 100
  
  // Clamp
  x = Math.max(0, Math.min(100, x))
  y = Math.max(0, Math.min(100, y))

  const child = childLocations.value.find(c => c.id === draggingChildId.value)
  if (child) {
    child.mapX = x
    child.mapY = y
  }
}

async function stopDrag() {
  if (draggingChildId.value) {
    const child = childLocations.value.find(c => c.id === draggingChildId.value)
    if (child && child.mapX !== null && child.mapY !== null) {
      await window.ennoAPI.updateLocationMapCoords(child.id, child.mapX, child.mapY)
      emit('reload-tree')
    }
    draggingChildId.value = null
  }
}

async function placeChild(childId: string) {
  // Place at center initially
  await window.ennoAPI.updateLocationMapCoords(childId, 50, 50)
  emit('reload-tree')
}

// Reset state on location change
watch(() => props.location.id, () => {
  editingName.value = false
  mapEditMode.value = false
  stopDrag()
})
</script>

<template>
  <div class="location-detail">
    <!-- Header: Name -->
    <div class="detail-header">
      <div v-if="!editingName" class="name-display" @dblclick="startEditName">
        <h1 class="loc-name">{{ location.name }}</h1>
        <button class="edit-btn" @click="startEditName" :title="t('common.rename')">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3V9l7-7z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
      <div v-else class="name-edit">
        <input 
          ref="nameInputRef" 
          v-model="nameInput" 
          class="name-input" 
          @blur="saveName" 
          @keydown.enter="saveName" 
          @keydown.escape="editingName = false" 
        />
      </div>
    </div>

    <!-- Description -->
    <div class="detail-section desc-section">
      <RichTextEditor 
        :modelValue="location.description || ''"
        @update:modelValue="updateDescription"
        :title="t('common.description')"
        :placeholder="t('locations.writeDescription')"
        :emptyText="t('characters.noDescriptionYet')"
      />
    </div>

    <!-- Map Section -->
    <div class="detail-section map-section">
      <div class="section-header">
        <span class="section-title">{{ t('locations.map') }}</span>
        <div class="map-actions">
          <button v-if="location.mapImagePath" class="edit-btn" :class="{ 'save-btn': mapEditMode }" @click="mapEditMode = !mapEditMode">
            {{ mapEditMode ? t('locations.doneEditing') : t('locations.editMap') }}
          </button>
          <button class="edit-btn" @click="$emit('upload-map', location.id)" :title="t('locations.uploadMapImage')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>

      <div v-if="location.mapImagePath" class="map-container">
        <!-- The interactive Map -->
        <div class="map-wrapper" 
             ref="mapOverlayRef" 
             @mousemove="onDrag" 
             @mouseup="stopDrag" 
             @mouseleave="stopDrag"
             :class="{ 'edit-mode': mapEditMode }"
        >
          <img :src="getMapSrc(location.mapImagePath)" class="map-img" draggable="false" />
          
          <div 
            v-for="child in placedChildren" 
            :key="child.id"
            class="map-dot"
            :class="{ dragging: draggingChildId === child.id, editable: mapEditMode }"
            :style="{ left: child.mapX + '%', top: child.mapY + '%' }"
            @mousedown="startDrag($event, child.id)"
            @click="!mapEditMode && $emit('select', child.id)"
          >
            <div class="dot-core"></div>
            <span class="dot-tooltip">{{ child.name }}</span>
          </div>
        </div>

        <!-- Edit Tools -->
        <div v-if="mapEditMode" class="map-edit-tools">
          <div class="tools-header">{{ t('locations.unplacedSubLocations') }}</div>
          <div v-if="unplacedChildren.length === 0" class="no-unplaced">{{ t('locations.allChildrenPlaced') }}</div>
          <div class="unplaced-list">
            <button 
              v-for="child in unplacedChildren" 
              :key="child.id" 
              class="place-btn"
              @click="placeChild(child.id)"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
              {{ child.name }}
            </button>
          </div>
          <button class="create-child-btn" @click="$emit('create-child', location.id)">
            + {{ t('locations.createNewSubLocation') }}
          </button>
        </div>
      </div>
      
      <div v-else class="no-map">
        <p>{{ t('locations.noMapUploaded') }}</p>
        <button class="upload-map-btn" @click="$emit('upload-map', location.id)">{{ t('locations.uploadMap') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.location-detail {
  flex: 1;
  overflow-y: auto;
  padding: 28px 36px;
  background: radial-gradient(ellipse at 80% 30%, rgba(120, 80, 220, 0.03) 0%, transparent 60%), #1a1a1f;
  display: flex;
  flex-direction: column;
}
.location-detail::-webkit-scrollbar { width: 6px; }
.location-detail::-webkit-scrollbar-track { background: transparent; }
.location-detail::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 4px; }

/* Header */
.detail-header { margin-bottom: 24px; }
.name-display { display: flex; align-items: center; gap: 12px; }
.loc-name { font-size: 28px; font-weight: 700; color: #e0e0f0; margin: 0; line-height: 1.2; }
.edit-btn { background: none; border: 1px solid transparent; color: #666; cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 13px;}
.edit-btn:hover { background: rgba(255,255,255,0.06); color: #aaa; }
.save-btn { color: #a5b4fc; background: rgba(100, 108, 255, 0.1); }
.name-input { font-size: 28px; font-weight: 700; color: #e0e0f0; background: rgba(255,255,255,0.04); border: 1px solid rgba(100,108,255,0.3); border-radius: 8px; padding: 4px 12px; width: 100%; font-family: inherit; outline: none; }
.name-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(100,108,255,0.1); }

/* Sections */
.detail-section { margin-bottom: 32px; }
.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
.section-title { font-size: 13px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: 1px; }
.map-actions { display: flex; gap: 8px; }

/* Map */
.map-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.map-wrapper {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.05);
  background: #111;
  user-select: none;
}
.map-img {
  display: block;
  width: 100%;
  height: auto;
  pointer-events: none; /* Let overlay handle events */
}

/* Dots */
.map-dot {
  position: absolute;
  width: 24px;
  height: 24px;
  margin-left: -12px;
  margin-top: -12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  z-index: 10;
}
.dot-core {
  width: 10px;
  height: 10px;
  background: #a5b4fc;
  border-radius: 50%;
  box-shadow: 0 0 0 2px rgba(26, 26, 31, 0.8), 0 2px 4px rgba(0,0,0,0.5);
  transition: transform 0.2s, background 0.2s;
}
.map-dot:hover .dot-core {
  transform: scale(1.4);
  background: #fff;
}
.map-dot.editable {
  cursor: grab;
}
.map-dot.editable:active {
  cursor: grabbing;
}
.map-dot.dragging .dot-core {
  transform: scale(1.6);
  background: #4ade80;
}

.dot-tooltip {
  position: absolute;
  top: -28px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0,0,0,0.5);
}
.map-dot:hover .dot-tooltip, .map-dot.dragging .dot-tooltip {
  opacity: 1;
  transform: translateY(0);
}

/* Edit Tools */
.map-edit-tools {
  background: rgba(255,255,255,0.03);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 8px;
  padding: 16px;
}
.tools-header {
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
  font-weight: 600;
}
.unplaced-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.place-btn {
  background: rgba(100, 108, 255, 0.1);
  border: 1px solid rgba(100, 108, 255, 0.2);
  color: #c7d2fe;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.place-btn:hover {
  background: rgba(100, 108, 255, 0.2);
}
.no-unplaced {
  font-size: 13px;
  color: #666;
  margin-bottom: 16px;
  font-style: italic;
}
.create-child-btn {
  background: transparent;
  border: 1px solid rgba(255,255,255,0.1);
  color: #aaa;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
  width: 100%;
}
.create-child-btn:hover {
  background: rgba(255,255,255,0.05);
  color: #eee;
}

/* No Map */
.no-map {
  padding: 40px;
  text-align: center;
  background: rgba(255,255,255,0.02);
  border: 1px dashed rgba(255,255,255,0.1);
  border-radius: 8px;
  color: #666;
}
.upload-map-btn {
  margin-top: 12px;
  background: rgba(100, 108, 255, 0.1);
  border: 1px solid rgba(100, 108, 255, 0.2);
  color: #a5b4fc;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-map-btn:hover {
  background: rgba(100, 108, 255, 0.2);
}
</style>
