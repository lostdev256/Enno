<script setup lang="ts">
import { ref, onMounted } from 'vue'
import CharacterSidebar from './CharacterSidebar.vue'
import CharacterDetail from './CharacterDetail.vue'
import PromptDialog from './PromptDialog.vue'

// --- Sidebar data types (light versions for sidebar) ---
interface SidebarCharacter {
  id: string
  name: string
  avatarUrl: string | null
}

interface SidebarGroup {
  id: string
  name: string
  expanded: boolean
  characters: SidebarCharacter[]
}

// --- Full character data ---
interface CharacterFull {
  id: string
  name: string
  description: string
  avatarUrl: string | null
  gallery: string[]
}

// --- State ---
const groups = ref<SidebarGroup[]>([])
const ungrouped = ref<SidebarCharacter[]>([])
const selectedId = ref<string | null>(null)
const selectedCharacter = ref<CharacterFull | null>(null)

// --- Prompt Dialog state ---
const promptVisible = ref(false)
const promptTitle = ref('')
const promptPlaceholder = ref('')
const promptInitialValue = ref('')
const promptResolve = ref<((value: string | null) => void) | null>(null)

function showPrompt(title: string, placeholder = '', initialValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    promptTitle.value = title
    promptPlaceholder.value = placeholder
    promptInitialValue.value = initialValue
    promptResolve.value = resolve
    promptVisible.value = true
  })
}

function onPromptConfirm(value: string) {
  promptVisible.value = false
  promptResolve.value?.(value)
  promptResolve.value = null
}

function onPromptCancel() {
  promptVisible.value = false
  promptResolve.value?.(null)
  promptResolve.value = null
}

// --- Load list (preserving expanded state) ---
async function loadList() {
  // Save current expanded state before reload
  const expandedState = new Map<string, boolean>()
  for (const g of groups.value) {
    expandedState.set(g.id, g.expanded)
  }

  const data = await window.ennoAPI.getCharactersList()

  // Restore expanded state
  for (const g of data.groups) {
    if (expandedState.has(g.id)) {
      g.expanded = expandedState.get(g.id)!
    }
  }

  groups.value = data.groups
  ungrouped.value = data.ungrouped
}

// --- Load character detail ---
async function loadCharacter(id: string) {
  selectedId.value = id
  const result = await window.ennoAPI.getCharacter(id)
  if (result.success) {
    selectedCharacter.value = result.character
  }
}

// --- Create character ---
async function createCharacter() {
  const result = await window.ennoAPI.createCharacter()
  if (result.success) {
    await loadList()
    await loadCharacter(result.character.id)
  }
}

// --- Delete character ---
async function deleteCharacter(id: string) {
  await window.ennoAPI.deleteCharacter(id)
  if (selectedId.value === id) {
    selectedId.value = null
    selectedCharacter.value = null
  }
  await loadList()
}

// --- Create group ---
async function createGroup() {
  const name = await showPrompt('Create Group', 'Enter group name...')
  if (!name) return
  await window.ennoAPI.createGroup(name)
  await loadList()
}

// --- Delete group ---
async function deleteGroup(id: string) {
  await window.ennoAPI.deleteGroup(id)
  await loadList()
}

// --- Rename group ---
async function renameGroup(id: string) {
  const group = groups.value.find(g => g.id === id)
  const newName = await showPrompt('Rename Group', 'Enter new name...', group?.name || '')
  if (!newName) return
  await window.ennoAPI.renameGroup(id, newName)
  await loadList()
}

// --- Reorder ---
async function handleReorder(data: { groups: SidebarGroup[], ungrouped: SidebarCharacter[] }) {
  const order = {
    groups: data.groups.map(g => ({ id: g.id, characterIds: g.characters.map(c => c.id) })),
    ungroupedIds: data.ungrouped.map(c => c.id),
  }
  await window.ennoAPI.reorderCharacters(order)
}

// --- Collapse / Expand all ---
function collapseAll() {
  groups.value.forEach(g => g.expanded = false)
}

function expandAll() {
  groups.value.forEach(g => g.expanded = true)
}

// --- Update character fields ---
async function updateCharacter(id: string, field: string, value: string) {
  await window.ennoAPI.updateCharacter(id, field, value)
  // Refresh both sidebar and detail
  await loadList()
  if (selectedId.value === id) {
    await loadCharacter(id)
  }
}

// --- Avatar upload ---
async function uploadAvatar(id: string) {
  const result = await window.ennoAPI.uploadAvatar(id)
  if (result.success) {
    await loadList()
    if (selectedId.value === id) {
      await loadCharacter(id)
    }
  }
}

// --- Gallery ---
async function addGalleryImages(id: string) {
  const result = await window.ennoAPI.addGalleryImages(id)
  if (result.success && selectedId.value === id) {
    await loadCharacter(id)
  }
}

async function removeGalleryImage(id: string, index: number) {
  await window.ennoAPI.removeGalleryImage(id, index)
  if (selectedId.value === id) {
    await loadCharacter(id)
  }
}

// --- Init ---
onMounted(() => {
  loadList()
})
</script>

<template>
  <div class="cards-page">
    <CharacterSidebar
      :groups="groups"
      :ungrouped="ungrouped"
      :selected-id="selectedId"
      @select="loadCharacter"
      @create-character="createCharacter"
      @create-group="createGroup"
      @delete-character="deleteCharacter"
      @delete-group="deleteGroup"
      @rename-group="renameGroup"
      @reorder="handleReorder"
      @collapse-all="collapseAll"
      @expand-all="expandAll"
    />
    <CharacterDetail
      :character="selectedCharacter"
      @update="updateCharacter"
      @upload-avatar="uploadAvatar"
      @add-gallery="addGalleryImages"
      @remove-gallery="removeGalleryImage"
    />

    <!-- Prompt Dialog (replaces window.prompt which doesn't work in Electron) -->
    <PromptDialog
      :visible="promptVisible"
      :title="promptTitle"
      :placeholder="promptPlaceholder"
      :initial-value="promptInitialValue"
      @confirm="onPromptConfirm"
      @cancel="onPromptCancel"
    />
  </div>
</template>

<style scoped>
.cards-page {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
