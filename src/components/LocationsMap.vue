<script setup lang="ts">
import { ref, onMounted } from 'vue'
import LocationSidebar from './LocationSidebar.vue'
import LocationDetail from './LocationDetail.vue'
// TODO: import LocationDetail

interface LocationTreeItem {
  id: string
  name: string
  mapX: number | null
  mapY: number | null
  children: LocationTreeItem[]
}

const locationsTree = ref<LocationTreeItem[]>([])
const selectedId = ref<string | null>(null)
const selectedLocation = ref<any | null>(null)

async function loadTree() {
  locationsTree.value = await window.ennoAPI.getLocationsTree()
}

async function selectLocation(id: string) {
  selectedId.value = id
  selectedLocation.value = await window.ennoAPI.getLocation(id)
}

async function createRootLocation() {
  try {
    const id = await window.ennoAPI.createLocation(null)
    if (!id) throw new Error("API returned null ID")
    await loadTree()
    await selectLocation(id)
  } catch (err: any) {
    alert("Error creating root location: " + err.message)
  }
}

async function createChildLocation(parentId: string) {
  try {
    const id = await window.ennoAPI.createLocation(parentId)
    if (!id) throw new Error("API returned null ID")
    await loadTree()
    await selectLocation(id)
  } catch (err: any) {
    alert("Error creating child location: " + err.message)
  }
}

async function deleteLocation(id: string) {
  if (confirm('Are you sure you want to delete this location? All child locations will also be deleted.')) {
    await window.ennoAPI.deleteLocation(id)
    if (selectedId.value === id) {
      selectedId.value = null
      selectedLocation.value = null
    }
    await loadTree()
  }
}

function flattenTreeAndAssignSort(tree: LocationTreeItem[], parentId: string | null = null, result: any[] = []): any[] {
  tree.forEach((item, index) => {
    result.push({ id: item.id, parentId, sortOrder: index })
    if (item.children && item.children.length > 0) {
      flattenTreeAndAssignSort(item.children, item.id, result)
    }
  })
  return result
}

async function handleUpdateStructure(newTree: LocationTreeItem[]) {
  // Optimistic update
  locationsTree.value = newTree
  
  // Calculate new parentIds and sortOrders
  const updates = flattenTreeAndAssignSort(newTree)
  await window.ennoAPI.updateLocationsStructure(updates)
  
  // Reload tree to be sure
  await loadTree()
  if (selectedId.value) {
    selectedLocation.value = await window.ennoAPI.getLocation(selectedId.value)
  }
}

async function updateLocationField(id: string, field: string, value: any) {
  await window.ennoAPI.updateLocation(id, field, value)
  await loadTree()
  if (selectedId.value === id) {
    selectedLocation.value = await window.ennoAPI.getLocation(id)
  }
}

async function handleUploadMapImage(id: string) {
  const success = await window.ennoAPI.uploadLocationMapImage(id)
  if (success) {
    selectedLocation.value = await window.ennoAPI.getLocation(id)
  }
}

onMounted(() => {
  loadTree()
})
</script>

<template>
  <div class="locations-map-page">
    <LocationSidebar
      :tree="locationsTree"
      :selectedId="selectedId"
      @select="selectLocation"
      @create-root="createRootLocation"
      @create-child="createChildLocation"
      @delete="deleteLocation"
      @update-structure="handleUpdateStructure"
    />
    
    <LocationDetail
      v-if="selectedLocation"
      :location="selectedLocation"
      :tree="locationsTree"
      @update="updateLocationField"
      @upload-map="handleUploadMapImage"
      @create-child="createChildLocation"
      @select="selectLocation"
      @reload-tree="loadTree"
    />
    <div v-else class="detail-empty">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><path d="M24 6c-8 0-14 6-14 14 0 10 14 22 14 22s14-12 14-22c0-8-6-14-14-14zm0 20a6 6 0 110-12 6 6 0 010 12z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <p class="empty-text">Select a location to view its map</p>
    </div>
  </div>
</template>

<style scoped>
.locations-map-page {
  display: flex;
  flex: 1;
  height: 100%;
  overflow: hidden;
}

.detail-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #444;
  background: #1a1a1f;
}
.empty-icon { opacity: 0.3; }
.empty-text { font-size: 14px; color: #555; }
</style>
