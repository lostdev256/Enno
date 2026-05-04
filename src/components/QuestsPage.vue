<script setup lang="ts">
import { ref, onMounted } from 'vue'
import QuestSidebar from './QuestSidebar.vue'
import QuestDetail from './QuestDetail.vue'
import PromptDialog from './PromptDialog.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface SidebarQuest {
  id: string
  name: string
  iconUrl: string | null
  parentId: string | null
}

interface SidebarGroup {
  id: string
  name: string
  expanded: boolean
  quests: SidebarQuest[]
}

interface QuestFull {
  id: string
  name: string
  description: string
  iconUrl: string | null
  parentId: string | null
  groupId: string | null
  gallery: { id: string; path: string }[]
}

const groups = ref<SidebarGroup[]>([])
const ungrouped = ref<SidebarQuest[]>([])
const selectedId = ref<string | null>(null)
const selectedQuest = ref<QuestFull | null>(null)

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

async function loadList() {
  const expandedState = new Map<string, boolean>()
  for (const g of groups.value) expandedState.set(g.id, g.expanded)

  const data = await window.ennoAPI.getQuestsList()
  for (const g of data.groups) {
    if (expandedState.has(g.id)) g.expanded = expandedState.get(g.id)!
  }
  groups.value = data.groups
  ungrouped.value = data.ungrouped
}

async function loadQuest(id: string) {
  selectedId.value = id
  const result = await window.ennoAPI.getQuest(id)
  if (result) selectedQuest.value = result
}

async function createQuest() {
  const result = await window.ennoAPI.createQuest()
  if (result) {
    await loadList()
    await loadQuest(result.id)
  }
}

async function deleteQuest(id: string) {
  await window.ennoAPI.deleteQuest(id)
  if (selectedId.value === id) {
    selectedId.value = null
    selectedQuest.value = null
  }
  await loadList()
}

async function createGroup() {
  const name = await showPrompt(t('scenes.createGroup'), t('scenes.enterGroupName'))
  if (!name) return
  await window.ennoAPI.createQuestGroup(name)
  await loadList()
}

async function deleteGroup(id: string) {
  await window.ennoAPI.deleteQuestGroup(id)
  await loadList()
}

async function renameGroup(id: string) {
  const group = groups.value.find(g => g.id === id)
  const newName = await showPrompt(t('scenes.renameGroup'), t('scenes.enterNewName'), group?.name || '')
  if (!newName) return
  await window.ennoAPI.renameQuestGroup(id, newName)
  await loadList()
}

async function handleReorder(data: { groups: SidebarGroup[], ungrouped: SidebarQuest[] }) {
  const order = {
    groups: data.groups.map(g => ({ id: g.id, questIds: g.quests.map(q => q.id) })),
    ungroupedIds: data.ungrouped.map(q => q.id),
  }
  await window.ennoAPI.reorderQuests(order)
}

function collapseAll() { groups.value.forEach(g => g.expanded = false) }
function expandAll() { groups.value.forEach(g => g.expanded = true) }

async function updateQuest(id: string, field: string, value: string) {
  await window.ennoAPI.updateQuest(id, field, value)
  await loadList()
  if (selectedId.value === id) await loadQuest(id)
}

async function uploadIcon(id: string) {
  const result = await window.ennoAPI.uploadQuestIcon(id)
  if (result.success) {
    await loadList()
    if (selectedId.value === id) await loadQuest(id)
  }
}

async function addGalleryImages(id: string) {
  const result = await window.ennoAPI.addQuestGallery(id)
  if (result.success && selectedId.value === id) await loadQuest(id)
}

async function removeGalleryImage(questId: string, imageId: string) {
  await window.ennoAPI.removeQuestGallery(imageId)
  if (selectedId.value === questId) await loadQuest(questId)
}

onMounted(() => {
  loadList()
  window.ennoAPI.onProjectStateChange((state) => {
    if (state.isOpen) {
      loadList()
    } else {
      groups.value = []
      ungrouped.value = []
      selectedId.value = null
      selectedQuest.value = null
    }
  })
})
</script>

<template>
  <div class="quests-page">
    <QuestSidebar
      :groups="groups"
      :ungrouped="ungrouped"
      :selected-id="selectedId"
      @select="loadQuest"
      @create-quest="createQuest"
      @create-group="createGroup"
      @delete-quest="deleteQuest"
      @delete-group="deleteGroup"
      @rename-group="renameGroup"
      @reorder="handleReorder"
      @collapse-all="collapseAll"
      @expand-all="expandAll"
    />
    <QuestDetail
      :quest="selectedQuest"
      @update="updateQuest"
      @upload-icon="uploadIcon"
      @add-gallery="addGalleryImages"
      @remove-gallery="removeGalleryImage"
    />
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
.quests-page {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
</style>
