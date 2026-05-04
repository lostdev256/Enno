<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import SceneSidebar from './SceneSidebar.vue'
import PromptDialog from './PromptDialog.vue'
import ContextMenu from './ContextMenu.vue'
import type { ContextMenuItem } from './ContextMenu.vue'

interface SidebarScene { id: string; name: string }
interface SidebarGroup { id: string; name: string; expanded: boolean; scenes: SidebarScene[] }

const groups = ref<SidebarGroup[]>([])
const ungrouped = ref<SidebarScene[]>([])
const selectedId = ref<string | null>(null)

const emit = defineEmits<{
  (e: 'open-scene', id: string): void
}>()

const promptVisible = ref(false)
const promptTitle = ref('')
const promptPlaceholder = ref('')
const promptInitialValue = ref('')
const promptResolve = ref<((value: string | null) => void) | null>(null)

function showPrompt(title: string, placeholder = '', initialValue = ''): Promise<string | null> {
  return new Promise((resolve) => {
    promptTitle.value = title; promptPlaceholder.value = placeholder
    promptInitialValue.value = initialValue; promptResolve.value = resolve
    promptVisible.value = true
  })
}
function onPromptConfirm(value: string) { promptVisible.value = false; promptResolve.value?.(value); promptResolve.value = null }
function onPromptCancel() { promptVisible.value = false; promptResolve.value?.(null); promptResolve.value = null }

async function loadList() {
  const expandedState = new Map<string, boolean>()
  for (const g of groups.value) expandedState.set(g.id, g.expanded)
  const data = await window.ennoAPI.getScenesList()
  for (const g of data.groups) { if (expandedState.has(g.id)) g.expanded = expandedState.get(g.id)! }
  groups.value = data.groups; ungrouped.value = data.ungrouped
}
async function createScene() { const r = await window.ennoAPI.createScene(); if (r) await loadList() }
async function deleteScene(id: string) { await window.ennoAPI.deleteScene(id); await loadList() }
async function createGroup() { const name = await showPrompt('Create Group', 'Enter group name...'); if (!name) return; await window.ennoAPI.createSceneGroup(name); await loadList() }
async function deleteGroup(id: string) { await window.ennoAPI.deleteSceneGroup(id); await loadList() }
async function renameGroup(id: string) {
  const g = groups.value.find(gr => gr.id === id)
  const n = await showPrompt('Rename Group', 'Enter new name...', g?.name || '')
  if (!n) return; await window.ennoAPI.renameSceneGroup(id, n); await loadList()
}
async function handleReorder(data: { groups: SidebarGroup[], ungrouped: SidebarScene[] }) {
  await window.ennoAPI.reorderScenes({ groups: data.groups.map(g => ({ id: g.id, sceneIds: g.scenes.map(s => s.id) })), ungroupedIds: data.ungrouped.map(s => s.id) })
}
function collapseAll() { groups.value.forEach(g => g.expanded = false) }
function expandAll() { groups.value.forEach(g => g.expanded = true) }

// ── Board State ──
const boardRef = ref<HTMLElement | null>(null)
const transform = ref({ x: 0, y: 0, scale: 1 })
const storylineData = ref<any>({ nodes: [], connections: [], groupPositions: [] })

// Local mutable positions (for drag without DB roundtrip)
const nodePositions = ref<Map<string, { x: number; y: number }>>(new Map())
const framePositions = ref<Map<string, { x: number; y: number; width: number; height: number }>>(new Map())

async function loadStoryline() {
  const data = await window.ennoAPI.getStorylineData()
  if (data) {
    storylineData.value = data
    nodePositions.value = new Map()
    for (const n of data.nodes) nodePositions.value.set(n.id, { x: n.x, y: n.y })
    framePositions.value = new Map()
    for (const gp of data.groupPositions) framePositions.value.set(gp.groupId, { x: gp.x, y: gp.y, width: gp.width, height: gp.height })
    // Auto-create default frame positions for groups without one
    let offsetX = 0
    for (const g of groups.value) {
      if (!framePositions.value.has(g.id)) {
        const def = { x: 50 + offsetX, y: 50, width: 400, height: 300 }
        framePositions.value.set(g.id, def)
        await window.ennoAPI.updateStorylineGroupPosition(g.id, def.x, def.y, def.width, def.height)
        offsetX += 450
      }
    }
  }
}

function clientToCanvas(clientX: number, clientY: number) {
  if (!boardRef.value) return { x: 0, y: 0 }
  const rect = boardRef.value.getBoundingClientRect()
  return { x: (clientX - rect.left - transform.value.x) / transform.value.scale, y: (clientY - rect.top - transform.value.y) / transform.value.scale }
}

// ── Pan/Zoom ──
const isPanning = ref(false)
let panSP = { x: 0, y: 0 }, panST = { x: 0, y: 0 }
function onBoardMouseDown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (e.button === 1 || (e.button === 0 && !target.closest('.storyline-node, .group-frame-header, .resize-handle, .snode-pin'))) {
    isPanning.value = true; panSP = { x: e.clientX, y: e.clientY }; panST = { x: transform.value.x, y: transform.value.y }
    window.addEventListener('mousemove', onPanMove); window.addEventListener('mouseup', onPanEnd)
  }
}
function onPanMove(e: MouseEvent) { if (!isPanning.value) return; transform.value.x = panST.x + (e.clientX - panSP.x); transform.value.y = panST.y + (e.clientY - panSP.y) }
function onPanEnd() { isPanning.value = false; window.removeEventListener('mousemove', onPanMove); window.removeEventListener('mouseup', onPanEnd) }
function onWheel(e: WheelEvent) {
  const d = e.deltaY < 0 ? 1 : -1; let ns = transform.value.scale * (1 + d * 0.05); ns = Math.max(0.1, Math.min(5, ns))
  if (!boardRef.value) return; const r = boardRef.value.getBoundingClientRect()
  const mx = e.clientX - r.left, my = e.clientY - r.top
  transform.value.x = mx - ((mx - transform.value.x) / transform.value.scale) * ns
  transform.value.y = my - ((my - transform.value.y) / transform.value.scale) * ns
  transform.value.scale = ns
}

// ── Frame Dragging ──
let dragFrame: { groupId: string; startX: number; startY: number; startMX: number; startMY: number } | null = null
function startFrameDrag(e: MouseEvent, groupId: string) {
  if (e.button !== 0) return; e.stopPropagation()
  const fp = framePositions.value.get(groupId)!
  dragFrame = { groupId, startX: fp.x, startY: fp.y, startMX: e.clientX, startMY: e.clientY }
  window.addEventListener('mousemove', onFrameDrag); window.addEventListener('mouseup', stopFrameDrag)
}
function onFrameDrag(e: MouseEvent) {
  if (!dragFrame) return
  const fp = framePositions.value.get(dragFrame.groupId)!
  fp.x = dragFrame.startX + (e.clientX - dragFrame.startMX) / transform.value.scale
  fp.y = dragFrame.startY + (e.clientY - dragFrame.startMY) / transform.value.scale
  pathTick.value++
}
async function stopFrameDrag() {
  if (dragFrame) { const fp = framePositions.value.get(dragFrame.groupId)!; await window.ennoAPI.updateStorylineGroupPosition(dragFrame.groupId, fp.x, fp.y, fp.width, fp.height) }
  dragFrame = null; window.removeEventListener('mousemove', onFrameDrag); window.removeEventListener('mouseup', stopFrameDrag)
}

// ── Frame Resizing ──
let resizeFrame: { groupId: string; startW: number; startH: number; startMX: number; startMY: number } | null = null
function startFrameResize(e: MouseEvent, groupId: string) {
  if (e.button !== 0) return; e.stopPropagation(); e.preventDefault()
  const fp = framePositions.value.get(groupId)!
  resizeFrame = { groupId, startW: fp.width, startH: fp.height, startMX: e.clientX, startMY: e.clientY }
  window.addEventListener('mousemove', onFrameResize); window.addEventListener('mouseup', stopFrameResize)
}
function onFrameResize(e: MouseEvent) {
  if (!resizeFrame) return
  const fp = framePositions.value.get(resizeFrame.groupId)!
  fp.width = Math.max(300, resizeFrame.startW + (e.clientX - resizeFrame.startMX) / transform.value.scale)
  fp.height = Math.max(200, resizeFrame.startH + (e.clientY - resizeFrame.startMY) / transform.value.scale)
  pathTick.value++
}
async function stopFrameResize() {
  if (resizeFrame) { const fp = framePositions.value.get(resizeFrame.groupId)!; await window.ennoAPI.updateStorylineGroupPosition(resizeFrame.groupId, fp.x, fp.y, fp.width, fp.height) }
  resizeFrame = null; window.removeEventListener('mousemove', onFrameResize); window.removeEventListener('mouseup', stopFrameResize)
}

// ── Node Dragging ──
let dragNode: { id: string; startX: number; startY: number; startMX: number; startMY: number } | null = null
function startNodeDrag(e: MouseEvent, nodeId: string) {
  if (e.button !== 0) return; e.stopPropagation()
  const pos = nodePositions.value.get(nodeId)!
  dragNode = { id: nodeId, startX: pos.x, startY: pos.y, startMX: e.clientX, startMY: e.clientY }
  window.addEventListener('mousemove', onNodeDrag); window.addEventListener('mouseup', stopNodeDrag)
}
function onNodeDrag(e: MouseEvent) {
  if (!dragNode) return
  const pos = nodePositions.value.get(dragNode.id)!
  let nx = dragNode.startX + (e.clientX - dragNode.startMX) / transform.value.scale
  let ny = dragNode.startY + (e.clientY - dragNode.startMY) / transform.value.scale
  
  const nodeData = storylineData.value.nodes.find((n: any) => n.id === dragNode!.id)
  if (nodeData && nodeData.groupId) {
    const fp = framePositions.value.get(nodeData.groupId) || { width: 400, height: 300 }
    nx = Math.max(0, Math.min(nx, fp.width - 150))
    ny = Math.max(0, Math.min(ny, fp.height - 50))
  }
  pos.x = nx
  pos.y = ny
  pathTick.value++
}
async function stopNodeDrag() {
  if (dragNode) { const pos = nodePositions.value.get(dragNode.id)!; await window.ennoAPI.updateStorylineNode(dragNode.id, pos.x, pos.y) }
  dragNode = null; window.removeEventListener('mousemove', onNodeDrag); window.removeEventListener('mouseup', stopNodeDrag)
}

// ── Connections (DOM Based) ──
const pathTick = ref(0)
const drawing = ref(false)
const drawSourceId = ref('')
const drawSourcePin = ref('')
const mousePos = ref({ x: 0, y: 0 })

// DOM Pin Tracking
const pinPositions = ref<Map<string, { x: number; y: number }>>(new Map())

function updateAllPinPositions() {
  if (!boardRef.value) return
  const boardRect = boardRef.value.getBoundingClientRect()
  const s = transform.value.scale
  const tx = transform.value.x
  const ty = transform.value.y
  const map = new Map<string, { x: number; y: number }>()
  boardRef.value.querySelectorAll('[data-pin-key]').forEach(el => {
    const key = (el as HTMLElement).dataset.pinKey!
    const r = el.getBoundingClientRect()
    const cx = (r.left + r.width / 2 - boardRect.left - tx) / s
    const cy = (r.top + r.height / 2 - boardRect.top - ty) / s
    map.set(key, { x: cx, y: cy })
  })
  pinPositions.value = map
}

import { watch } from 'vue'
watch(pathTick, () => { requestAnimationFrame(updateAllPinPositions) })

function startDrawConn(e: MouseEvent, nodeId: string, pin: string) {
  if (e.button !== 0) return; e.stopPropagation()
  drawing.value = true; drawSourceId.value = nodeId; drawSourcePin.value = pin
  mousePos.value = clientToCanvas(e.clientX, e.clientY)
  window.addEventListener('mousemove', onDrawMove); window.addEventListener('mouseup', stopDrawConn)
}
function onDrawMove(e: MouseEvent) { mousePos.value = clientToCanvas(e.clientX, e.clientY) }
async function stopDrawConn(e: MouseEvent) {
  window.removeEventListener('mousemove', onDrawMove); window.removeEventListener('mouseup', stopDrawConn)
  if (!drawing.value) return

  const pinKeyEl = (e.target as HTMLElement).closest('[data-pin-key]') as HTMLElement | null
  const pinKey = pinKeyEl?.dataset.pinKey || ''
  const isInputPin = pinKey.endsWith(':in:in')

  if (isInputPin && pinKeyEl) {
    const tid = pinKey.split(':')[0]
    if (tid && tid !== drawSourceId.value) {
      await window.ennoAPI.createStorylineConnection(drawSourceId.value, drawSourcePin.value, tid, 'in')
      await loadStoryline()
    }
  }
  drawing.value = false
}

const connectionPaths = computed(() => {
  void pathTick.value // dependency
  return (storylineData.value.connections || []).map((c: any) => {
    const from = pinPositions.value.get(`${c.sourceNodeId}:${c.sourcePin}:out`)
    const to = pinPositions.value.get(`${c.targetNodeId}:in:in`)
    if (!from || !to) return { id: c.id, d: '' }
    const dx = Math.abs(to.x - from.x) * 0.5
    return { id: c.id, d: `M ${from.x} ${from.y} C ${from.x+dx} ${from.y}, ${to.x-dx} ${to.y}, ${to.x} ${to.y}` }
  })
})

const drawingPath = computed(() => {
  if (!drawing.value) return ''
  void pathTick.value
  const from = pinPositions.value.get(`${drawSourceId.value}:${drawSourcePin.value}:out`)
  if (!from) return ''
  const to = mousePos.value
  const dx = Math.abs(to.x - from.x) * 0.5
  return `M ${from.x} ${from.y} C ${from.x+dx} ${from.y}, ${to.x-dx} ${to.y}, ${to.x} ${to.y}`
})

// ── Drop from sidebar ──
async function onDrop(e: DragEvent) {
  if (!e.dataTransfer) return
  const sceneId = e.dataTransfer.getData('application/enno-scene-id')
  if (!sceneId) return
  // Prevent duplicates
  if (storylineData.value.nodes.some((n: any) => n.refId === sceneId)) return
  const pos = clientToCanvas(e.clientX, e.clientY)
  // For grouped scenes: store relative to frame
  const scene = [...groups.value.flatMap(g => g.scenes.map(s => ({ ...s, groupId: g.id }))), ...ungrouped.value.map(s => ({ ...s, groupId: null as string | null }))].find(s => s.id === sceneId)
  const groupId = scene ? (scene as any).groupId : null
  let nx = pos.x, ny = pos.y
  if (groupId) {
    const fp = framePositions.value.get(groupId) || { x: 0, y: 0, width: 400, height: 300 }
    nx = pos.x - fp.x; ny = pos.y - fp.y
    nx = Math.max(0, Math.min(nx, fp.width - 150))
    ny = Math.max(0, Math.min(ny, fp.height - 50))
  }
  await window.ennoAPI.addStorylineNode('scene', sceneId, groupId, nx, ny)
  await loadStoryline()
  requestAnimationFrame(updateAllPinPositions)
}

// ── Context Menu ──
const ctxVisible = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)
const ctxItems = ref<ContextMenuItem[]>([])
let ctxCanvasPos = { x: 0, y: 0 }
let ctxNodeId: string | null = null
let ctxConnId: string | null = null

function onBoardContextMenu(e: MouseEvent) {
  e.preventDefault()
  if ((e.target as HTMLElement).closest('.storyline-node')) return
  ctxCanvasPos = clientToCanvas(e.clientX, e.clientY)
  ctxX.value = e.clientX; ctxY.value = e.clientY; ctxNodeId = null; ctxConnId = null
  ctxItems.value = [{ label: 'Global Action', action: 'add:global_action', icon: '📝' }]
  ctxVisible.value = true
}

function onNodeContextMenu(e: MouseEvent, nodeId: string) {
  e.preventDefault(); e.stopPropagation()
  ctxX.value = e.clientX; ctxY.value = e.clientY; ctxNodeId = nodeId; ctxConnId = null
  ctxItems.value = [{ label: 'Delete Node', action: 'delete-node', icon: '🗑' }]
  ctxVisible.value = true
}

function onConnContextMenu(e: MouseEvent, connId: string) {
  e.preventDefault(); e.stopPropagation()
  ctxX.value = e.clientX; ctxY.value = e.clientY; ctxConnId = connId; ctxNodeId = null
  ctxItems.value = [{ label: 'Delete Connection', action: 'delete-conn', icon: '✕' }]
  ctxVisible.value = true
}

async function onCtxAction(action: string) {
  if (action === 'add:global_action') {
    await window.ennoAPI.addStorylineNode('global_action', null, null, ctxCanvasPos.x, ctxCanvasPos.y, JSON.stringify({ description: '' }))
    await loadStoryline()
  } else if (action === 'delete-node' && ctxNodeId) {
    await window.ennoAPI.deleteStorylineNode(ctxNodeId); await loadStoryline()
  } else if (action === 'delete-conn' && ctxConnId) {
    await window.ennoAPI.deleteStorylineConnection(ctxConnId); await loadStoryline()
  }
}

function getSceneName(refId: string | null): string {
  if (!refId) return 'Global Action'
  for (const g of groups.value) { const s = g.scenes.find(sc => sc.id === refId); if (s) return s.name }
  return ungrouped.value.find(s => s.id === refId)?.name || 'Unknown'
}

function getNodeExitPins(node: any): { id: string; label: string }[] {
  if (node.nodeType === 'scene') {
    if (!node.refId) return [{ id: 'out', label: '' }]
    for (const g of groups.value) {
      const s = (g.scenes as any[]).find((sc: any) => sc.id === node.refId)
      if (s && s.exitPins) {
        try { const pins = JSON.parse(s.exitPins); if (pins.length) return pins } catch {}
      }
    }
    const us = (ungrouped.value as any[]).find((s: any) => s.id === node.refId)
    if (us && us.exitPins) {
      try { const pins = JSON.parse(us.exitPins); if (pins.length) return pins } catch {}
    }
    return [{ id: 'out', label: '' }]
  } else if (node.nodeType === 'global_action') {
    let data: any = {}
    try { data = JSON.parse(node.data) } catch {}
    const pins: { id: string; label: string }[] = [{ id: 'out', label: '' }]
    if (data.choices && data.choices.length) {
      for (const ch of data.choices) pins.push({ id: ch.id, label: ch.label })
    }
    return pins
  }
  return [{ id: 'out', label: '' }]
}


function getNodePos(nodeId: string) {
  return nodePositions.value.get(nodeId) || { x: 0, y: 0 }
}

function getFramePos(groupId: string) {
  return framePositions.value.get(groupId) || { x: 0, y: 0, width: 400, height: 300 }
}

// ── Interaction Logic ──
function openScene(node: any) {
  if (node.nodeType === 'scene' && node.refId) {
    emit('open-scene', node.refId)
  }
}

const editingNodeId = ref<string | null>(null)
const editDesc = ref('')

function startEditNode(node: any) {
  if (node.nodeType !== 'global_action') return
  editingNodeId.value = node.id
  try { editDesc.value = JSON.parse(node.data).description || '' } catch { editDesc.value = '' }
}

async function saveEditNode(node: any) {
  if (editingNodeId.value === node.id) {
    let d: any = {}
    try { d = JSON.parse(node.data) } catch {}
    d.description = editDesc.value
    await window.ennoAPI.updateStorylineNodeData(node.id, JSON.stringify(d))
    editingNodeId.value = null
    await loadStoryline()
    requestAnimationFrame(updateAllPinPositions)
  }
}

function cancelEditNode() {
  editingNodeId.value = null
}

async function addGlobalChoice(node: any) {
  let d: any = {}
  try { d = JSON.parse(node.data) } catch {}
  if (!d.choices) d.choices = []
  const id = 'ch_' + Math.random().toString(36).slice(2, 8)
  d.choices.push({ id, label: 'Choice ' + (d.choices.length + 1) })
  await window.ennoAPI.updateStorylineNodeData(node.id, JSON.stringify(d))
  await loadStoryline()
  requestAnimationFrame(updateAllPinPositions)
}

async function removeGlobalChoice(node: any, choiceId: string) {
  let d: any = {}
  try { d = JSON.parse(node.data) } catch {}
  if (!d.choices) return
  d.choices = d.choices.filter((c: any) => c.id !== choiceId)
  await window.ennoAPI.updateStorylineNodeData(node.id, JSON.stringify(d))
  await loadStoryline()
  requestAnimationFrame(updateAllPinPositions)
}

async function updateGlobalChoice(node: any, choiceId: string, label: string) {
  let d: any = {}
  try { d = JSON.parse(node.data) } catch {}
  const ch = d.choices?.find((c: any) => c.id === choiceId)
  if (ch) {
    ch.label = label
    await window.ennoAPI.updateStorylineNodeData(node.id, JSON.stringify(d))
    await loadStoryline()
  }
}

onMounted(async () => {
  await loadList(); await loadStoryline()
  requestAnimationFrame(updateAllPinPositions)
  window.ennoAPI.onProjectStateChange(async (state) => {
    if (state.isOpen) { await loadList(); await loadStoryline(); requestAnimationFrame(updateAllPinPositions) }
    else { groups.value = []; ungrouped.value = []; storylineData.value = { nodes: [], connections: [], groupPositions: [] }; nodePositions.value = new Map(); framePositions.value = new Map(); pinPositions.value = new Map() }
  })
})
</script>

<template>
  <div class="storyline-page">
    <SceneSidebar
      :groups="groups" :ungrouped="ungrouped" :selected-id="selectedId"
      @select="(id) => selectedId = id" @create-scene="createScene" @create-group="createGroup"
      @delete-scene="deleteScene" @delete-group="deleteGroup" @rename-group="renameGroup"
      @reorder="handleReorder" @collapse-all="collapseAll" @expand-all="expandAll"
    />

    <div class="board-area" ref="boardRef" @mousedown="onBoardMouseDown" @wheel.prevent="onWheel" @contextmenu="onBoardContextMenu" @drop="onDrop" @dragover.prevent>
      <div class="board-canvas" :style="{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }">
        <div class="board-grid"></div>

        <!-- SVG connections -->
        <svg class="conn-layer">
          <g v-for="c in connectionPaths" :key="c.id">
            <path :d="c.d" stroke="transparent" stroke-width="12" fill="none" class="conn-hit" @contextmenu="onConnContextMenu($event, c.id)" />
            <path :d="c.d" stroke="#a5b4fc" stroke-width="2" fill="none" style="pointer-events:none" />
          </g>
          <path v-if="drawing" :d="drawingPath" stroke="#888" stroke-width="2" stroke-dasharray="5,5" fill="none" />
        </svg>

        <!-- Group frames — nodes rendered INSIDE as children -->
        <div v-for="group in groups" :key="group.id"
          class="group-frame"
          :style="{ left: getFramePos(group.id).x + 'px', top: getFramePos(group.id).y + 'px', width: getFramePos(group.id).width + 'px', height: getFramePos(group.id).height + 'px' }"
        >
          <div class="group-frame-header" @mousedown="startFrameDrag($event, group.id)">{{ group.name }}</div>
          <div class="resize-handle" @mousedown="startFrameResize($event, group.id)"></div>
          <!-- Grouped nodes inside frame -->
          <div
            v-for="node in storylineData.nodes.filter((n: any) => n.groupId === group.id)"
            :key="node.id"
            class="storyline-node"
            :style="{ left: getNodePos(node.id).x + 'px', top: (getNodePos(node.id).y + 36) + 'px' }"
            @contextmenu.prevent.stop="onNodeContextMenu($event, node.id)"
          >
            <div class="snode-pin in" :data-pin-key="`${node.id}:in:in`"></div>
            <div class="snode-body">
              <div class="snode-header" :class="{ scene: node.nodeType === 'scene', global: node.nodeType === 'global_action' }" @mousedown="startNodeDrag($event, node.id)" @dblclick.stop="openScene(node)">
                {{ node.nodeType === 'scene' ? '🎬' : '📝' }} {{ getSceneName(node.refId) }}
              </div>
              <template v-if="node.nodeType === 'global_action'">
                <div class="global-content">
                  <div v-if="editingNodeId !== node.id" class="block-text editable" @dblclick.stop="startEditNode(node)">
                    {{ (function(){ try{ return JSON.parse(node.data).description || '(dblclick to edit)' } catch{ return '' } })() }}
                  </div>
                  <textarea v-else class="block-input" v-model="editDesc" @blur="saveEditNode(node)" @keydown.escape="cancelEditNode" @keydown.ctrl.enter="saveEditNode(node)" rows="2" @click.stop></textarea>
                  
                  <div class="choices-area" v-if="(function(){ try{ return JSON.parse(node.data).choices?.length } catch{ return false } })()">
                    <div v-for="ch in (function(){ try{ return JSON.parse(node.data).choices || [] } catch{ return [] } })()" :key="ch.id" class="choice-row-inline">
                      <input class="choice-input" :value="ch.label" @change="updateGlobalChoice(node, ch.id, ($event.target as HTMLInputElement).value)" @click.stop />
                      <button class="icon-btn red" @click.stop="removeGlobalChoice(node, ch.id)">✕</button>
                    </div>
                  </div>
                  <button class="add-choice-btn" @click.stop="addGlobalChoice(node)">+ Choice</button>
                </div>
              </template>
            </div>
            <!-- Exit pins column -->
            <div class="snode-out-pins">
              <div
                v-for="pin in getNodeExitPins(node)" :key="pin.id"
                class="snode-pin out" :title="pin.label" :data-pin-key="`${node.id}:${pin.id}:out`"
                @mousedown="startDrawConn($event, node.id, pin.id)"
              ></div>
            </div>
          </div>
        </div>

        <!-- Ungrouped nodes + Global Actions (in canvas space) -->
        <div
          v-for="node in storylineData.nodes.filter((n: any) => !n.groupId)"
          :key="node.id"
          class="storyline-node"
          :style="{ left: getNodePos(node.id).x + 'px', top: getNodePos(node.id).y + 'px' }"
          @contextmenu.prevent.stop="onNodeContextMenu($event, node.id)"
        >
          <div class="snode-pin in" :data-pin-key="`${node.id}:in:in`"></div>
          <div class="snode-body">
            <div class="snode-header" :class="{ scene: node.nodeType === 'scene', global: node.nodeType === 'global_action' }" @mousedown="startNodeDrag($event, node.id)" @dblclick.stop="openScene(node)">
              {{ node.nodeType === 'scene' ? '🎬' : '📝' }} {{ getSceneName(node.refId) }}
            </div>
            <template v-if="node.nodeType === 'global_action'">
              <div class="global-content">
                <div v-if="editingNodeId !== node.id" class="block-text editable" @dblclick.stop="startEditNode(node)">
                  {{ (function(){ try{ return JSON.parse(node.data).description || '(dblclick to edit)' } catch{ return '' } })() }}
                </div>
                <textarea v-else class="block-input" v-model="editDesc" @blur="saveEditNode(node)" @keydown.escape="cancelEditNode" @keydown.ctrl.enter="saveEditNode(node)" rows="2" @click.stop></textarea>
                
                <div class="choices-area" v-if="(function(){ try{ return JSON.parse(node.data).choices?.length } catch{ return false } })()">
                  <div v-for="ch in (function(){ try{ return JSON.parse(node.data).choices || [] } catch{ return [] } })()" :key="ch.id" class="choice-row-inline">
                    <input class="choice-input" :value="ch.label" @change="updateGlobalChoice(node, ch.id, ($event.target as HTMLInputElement).value)" @click.stop />
                    <button class="icon-btn red" @click.stop="removeGlobalChoice(node, ch.id)">✕</button>
                  </div>
                </div>
                <button class="add-choice-btn" @click.stop="addGlobalChoice(node)">+ Choice</button>
              </div>
            </template>
          </div>
          <div class="snode-out-pins">
            <div
              v-for="pin in getNodeExitPins(node)" :key="pin.id"
              class="snode-pin out" :title="pin.label" :data-pin-key="`${node.id}:${pin.id}:out`"
              @mousedown="startDrawConn($event, node.id, pin.id)"
            ></div>
          </div>
        </div>
      </div>

      <ContextMenu :items="ctxItems" :x="ctxX" :y="ctxY" :visible="ctxVisible" @action="onCtxAction" @close="ctxVisible = false" />
    </div>

    <PromptDialog :visible="promptVisible" :title="promptTitle" :placeholder="promptPlaceholder" :initial-value="promptInitialValue" @confirm="onPromptConfirm" @cancel="onPromptCancel" />
  </div>
</template>

<style scoped>
.storyline-page { display:flex; height:100%; width:100%; overflow:hidden; }
.board-area { flex:1; position:relative; background:#1a1a20; overflow:hidden; cursor:grab; }
.board-area:active { cursor:grabbing; }
.board-canvas { position:absolute; top:0; left:0; width:100%; height:100%; transform-origin:0 0; pointer-events:none; }
.board-grid { position:absolute; inset:-100000px; background:radial-gradient(circle,rgba(255,255,255,0.03) 1px,transparent 1px); background-size:20px 20px; pointer-events:none; z-index:0; }

.conn-layer { position:absolute; top:0; left:0; width:1px; height:1px; overflow:visible; pointer-events:none; z-index:1; }
.conn-hit { pointer-events:stroke; cursor:pointer; }

.group-frame { position:absolute; pointer-events:auto; background:rgba(100,108,255,0.04); border:1px dashed rgba(100,108,255,0.2); border-radius:12px; z-index:0; }
.group-frame-header { padding:8px 14px; font-size:12px; font-weight:700; color:#818cf8; text-transform:uppercase; letter-spacing:.5px; border-bottom:1px solid rgba(100,108,255,0.1); cursor:grab; user-select:none; }
.group-frame-header:active { cursor:grabbing; }
.resize-handle { position:absolute; right:0; bottom:0; width:16px; height:16px; cursor:nwse-resize; pointer-events:auto; background:linear-gradient(135deg,transparent 50%,rgba(100,108,255,0.3) 50%); border-radius:0 0 12px 0; }

.storyline-node { position:absolute; pointer-events:auto; display:flex; align-items:center; z-index:2; }
.snode-body { display:flex; flex-direction:column; background:rgba(30,30,40,0.9); border-radius:8px; border:1px solid rgba(100,108,255,0.2); backdrop-filter:blur(10px); }
.snode-header { padding:8px 14px; border-radius:8px 8px 0 0; font-size:12px; font-weight:600; cursor:grab; box-shadow:0 4px 12px rgba(0,0,0,0.3); user-select:none; min-width:120px; text-align:center; }
.snode-header.scene { background:#252540; color:#c0c0e0; }
.snode-header.scene:last-child { border-radius:8px; }
.snode-header.global { background:#302520; color:#e0d0c0; border-bottom:1px solid rgba(245,158,11,0.2); }
.snode-header:hover { filter:brightness(1.15); }

.snode-pin { width:12px; height:12px; border-radius:50%; cursor:crosshair; flex-shrink:0; transition:all .15s; }
.snode-pin.in { border:2px solid #a5b4fc; background:transparent; margin-right:4px; }
.snode-pin.out { border:2px solid #f59e0b; background:transparent; margin-left:4px; }
.snode-pin:hover { background:rgba(255,255,255,0.3); transform:scale(1.3); }

.snode-out-pins { display:flex; flex-direction:column; gap:8px; justify-content:flex-start; margin-left:4px; padding-top:8px; }

/* Global action content */
.global-content { padding:8px; min-width:140px; }
.block-text { font-size:11px; color:#aaa; line-height:1.4; white-space:pre-wrap; word-break:break-word; min-height:20px; }
.editable { cursor:text; border:1px solid transparent; border-radius:4px; padding:2px 4px; margin:-2px -4px; transition:border-color .15s; }
.editable:hover { border-color:rgba(255,255,255,0.1); }
.block-input { width:100%; background:rgba(255,255,255,0.06); border:1px solid rgba(100,108,255,0.4); border-radius:4px; padding:4px 6px; color:#e0e0f0; font-size:11px; font-family:inherit; outline:none; resize:none; box-sizing:border-box; }
.block-input:focus { border-color:#818cf8; }

.choices-area { margin-top:6px; padding-top:4px; border-top:1px solid rgba(255,255,255,0.06); }
.choice-row-inline { display:flex; align-items:center; gap:4px; margin-bottom:4px; }
.choice-input { flex:1; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:4px; padding:2px 6px; color:#ccc; font-size:10px; font-family:inherit; outline:none; min-width:0; }
.choice-input:focus { border-color:rgba(100,108,255,0.4); }
.add-choice-btn { background:none; border:none; color:#666; cursor:pointer; font-size:10px; padding:3px 0; font-family:inherit; transition:color .15s; display:block; }
.add-choice-btn:hover { color:#818cf8; }
.icon-btn { background:none; border:none; cursor:pointer; font-size:10px; padding:2px 3px; border-radius:3px; transition:color .15s; color:#555; }
.icon-btn.red:hover { color:#ef4444; }
</style>
