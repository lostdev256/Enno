<script setup lang="ts">
import { ref, computed } from 'vue'
import defaultAvatar from '../assets/default-avatar.svg'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface BoardNode { characterId: string; x: number; y: number }
interface LinkMode { id: string; name: string; maxLinksPerPair: number; dataType: 'text' | 'enum'; settings: string }
interface CharacterLink { id: string; modeId: string; sourceId: string; targetId: string; value: string }
interface Character { id: string; name: string; avatarUrl: string | null }

const props = defineProps<{
  nodes: BoardNode[]
  links: CharacterLink[]
  characters: Character[]
  currentMode: LinkMode | null
}>()

const emit = defineEmits<{
  (e: 'add-node', charId: string, x: number, y: number): void
  (e: 'update-node', charId: string, x: number, y: number): void
  (e: 'remove-node', charId: string): void
  (e: 'create-link', modeId: string, sourceId: string, targetId: string, value: string): void
  (e: 'update-link', linkId: string, value: string): void
  (e: 'remove-link', linkId: string): void
  (e: 'context-menu', evt: MouseEvent, type: 'node' | 'link', id: string): void
  (e: 'show-enum-menu', evt: MouseEvent, modeId: string, sourceId: string, targetId: string): void
  (e: 'show-text-prompt', modeId: string, sourceId: string, targetId: string): void
}>()

const boardRef = ref<HTMLElement | null>(null)

// ── Pan & Zoom State ──
const transform = ref({ x: 0, y: 0, scale: 1 })
const canvasStyle = computed(() => ({
  transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.scale})`
}))

function clientToCanvas(clientX: number, clientY: number) {
  if (!boardRef.value) return { x: 0, y: 0 }
  const rect = boardRef.value.getBoundingClientRect()
  return {
    x: (clientX - rect.left - transform.value.x) / transform.value.scale,
    y: (clientY - rect.top - transform.value.y) / transform.value.scale
  }
}

// ── Pan & Zoom Handlers ──
const isPanning = ref(false)
let panStartPointer = { x: 0, y: 0 }
let panStartTransform = { x: 0, y: 0 }

function onPanStart(e: MouseEvent) {
  // Only pan on left or middle click
  if (e.button === 0 || e.button === 1) {
    isPanning.value = true
    panStartPointer = { x: e.clientX, y: e.clientY }
    panStartTransform = { x: transform.value.x, y: transform.value.y }
    window.addEventListener('mousemove', onPanMove)
    window.addEventListener('mouseup', onPanEnd)
  }
}

function onPanMove(e: MouseEvent) {
  if (!isPanning.value) return
  transform.value.x = panStartTransform.x + (e.clientX - panStartPointer.x)
  transform.value.y = panStartTransform.y + (e.clientY - panStartPointer.y)
}

function onPanEnd() {
  isPanning.value = false
  window.removeEventListener('mousemove', onPanMove)
  window.removeEventListener('mouseup', onPanEnd)
}

function onWheel(e: WheelEvent) {
  const zoomFactor = 0.05
  const direction = e.deltaY < 0 ? 1 : -1
  const scaleChange = 1 + direction * zoomFactor
  
  let newScale = transform.value.scale * scaleChange
  if (newScale < 0.1) newScale = 0.1
  if (newScale > 5) newScale = 5

  if (!boardRef.value) return
  const rect = boardRef.value.getBoundingClientRect()
  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const canvasX = (mouseX - transform.value.x) / transform.value.scale
  const canvasY = (mouseY - transform.value.y) / transform.value.scale

  transform.value.x = mouseX - canvasX * newScale
  transform.value.y = mouseY - canvasY * newScale
  transform.value.scale = newScale
}

// ── Node Rendering ──
function getChar(id: string) {
  return props.characters.find(c => c.id === id)
}

function getAvatarSrc(url: string | null | undefined): string {
  if (!url) return defaultAvatar
  return `enno://${url}`
}

// ── Dragging Nodes ──
let draggedNode: BoardNode | null = null
let dragStartPointer = { x: 0, y: 0 }
let dragStartNodePos = { x: 0, y: 0 }

function startNodeDrag(e: MouseEvent, node: BoardNode) {
  if (e.button !== 0) return // Only left click
  e.stopPropagation() // prevent pan
  draggedNode = node
  dragStartPointer = { x: e.clientX, y: e.clientY }
  dragStartNodePos = { x: node.x, y: node.y }
  window.addEventListener('mousemove', onNodeDrag)
  window.addEventListener('mouseup', stopNodeDrag)
}

function onNodeDrag(e: MouseEvent) {
  if (!draggedNode) return
  const dx = (e.clientX - dragStartPointer.x) / transform.value.scale
  const dy = (e.clientY - dragStartPointer.y) / transform.value.scale
  draggedNode.x = dragStartNodePos.x + dx
  draggedNode.y = dragStartNodePos.y + dy
}

function stopNodeDrag() {
  if (draggedNode) {
    emit('update-node', draggedNode.characterId, draggedNode.x, draggedNode.y)
    draggedNode = null
  }
  window.removeEventListener('mousemove', onNodeDrag)
  window.removeEventListener('mouseup', stopNodeDrag)
}

// ── Drop from Sidebar ──
function onDrop(e: DragEvent) {
  if (!e.dataTransfer) return
  const charId = e.dataTransfer.getData('application/enno-character-id')
  if (charId) {
    const pos = clientToCanvas(e.clientX, e.clientY)
    const x = pos.x - 40 // ~ half card width
    const y = pos.y - 40 // ~ half card height
    emit('add-node', charId, x, y)
  }
}

// ── Drawing Links ──
const drawing = ref(false)
const drawingSource = ref<BoardNode | null>(null)
const mousePos = ref({ x: 0, y: 0 })

function startDrawing(e: MouseEvent, node: BoardNode) {
  if (e.button !== 0 || !props.currentMode) return
  e.stopPropagation() // prevent pan
  drawing.value = true
  drawingSource.value = node
  updateMousePos(e)
  window.addEventListener('mousemove', updateMousePos)
  window.addEventListener('mouseup', stopDrawing)
}

function updateMousePos(e: MouseEvent) {
  mousePos.value = clientToCanvas(e.clientX, e.clientY)
}

function stopDrawing(e: MouseEvent) {
  window.removeEventListener('mousemove', updateMousePos)
  window.removeEventListener('mouseup', stopDrawing)

  if (!drawingSource.value || !props.currentMode) {
    drawing.value = false
    drawingSource.value = null
    return
  }

  // Find if we dropped on another node
  const dropTarget = getHoveredNode(e.clientX, e.clientY)
  
  if (dropTarget && dropTarget.characterId !== drawingSource.value.characterId) {
    // We have a source and target. Determine value via prompt/menu depending on mode type.
    handleCreateLink(drawingSource.value.characterId, dropTarget.characterId)
  }

  drawing.value = false
  drawingSource.value = null
}

function getHoveredNode(clientX: number, clientY: number): BoardNode | null {
  // Simple hit test using elements
  const els = document.elementsFromPoint(clientX, clientY)
  const nodeEl = els.find(el => el.classList.contains('board-node')) as HTMLElement
  if (nodeEl) {
    const id = nodeEl.dataset.id
    return props.nodes.find(n => n.characterId === id) || null
  }
  return null
}

async function handleCreateLink(sourceId: string, targetId: string) {
  const mode = props.currentMode
  if (!mode) return

  // Check max_links_per_pair
  const existingCount = props.links.filter(l => 
    l.modeId === mode.id &&
    ((l.sourceId === sourceId && l.targetId === targetId) || 
     (l.sourceId === targetId && l.targetId === sourceId))
  ).length

  if (mode.maxLinksPerPair > 0 && existingCount >= mode.maxLinksPerPair) {
    alert(`Maximum links (${mode.maxLinksPerPair}) reached for this pair in the current mode.`)
    return
  }

  if (mode.dataType === 'text') {
    emit('show-text-prompt', mode.id, sourceId, targetId)
    return
  } else if (mode.dataType === 'enum') {
    try {
      const s = JSON.parse(mode.settings)
      if (s.enumValues && s.enumValues.length > 0) {
        const rect = boardRef.value?.getBoundingClientRect()
        const evt = new MouseEvent('contextmenu', { 
          clientX: (rect?.left || 0) + mousePos.value.x, 
          clientY: (rect?.top || 0) + mousePos.value.y 
        })
        emit('show-enum-menu', evt, mode.id, sourceId, targetId)
        return
      }
    } catch {}
  }
}

// ── Rendering Links (SVG) ──
function getCenter(nodeId: string) {
  const node = props.nodes.find(n => n.characterId === nodeId)
  if (!node) return { x: 0, y: 0 }
  return { x: node.x + 45, y: node.y + 32 } // center of the 64x64 avatar
}

function getPointOnLine(p1: {x: number, y: number}, p2: {x: number, y: number}, dist: number) {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const d = Math.sqrt(dx*dx + dy*dy) || 1
  return {
    x: p1.x + (dx / d) * dist,
    y: p1.y + (dy / d) * dist
  }
}

const renderedLinks = computed(() => {
  if (!props.currentMode) return []

  const modeId = props.currentMode.id
  // Only render links for the current mode
  const currentModeLinks = props.links.filter(l => l.modeId === modeId)
  
  const result: any[] = []

  // Group by pair to detect multiple links
  const pairMap = new Map<string, CharacterLink[]>()
  for (const link of currentModeLinks) {
    const pairId = [link.sourceId, link.targetId].sort().join('-')
    if (!pairMap.has(pairId)) pairMap.set(pairId, [])
    pairMap.get(pairId)!.push(link)
  }

  let settings: any = {}
  try { settings = JSON.parse(props.currentMode.settings) } catch {}

  for (const linksArray of pairMap.values()) {
    const count = linksArray.length
    const isCurved = count > 1

    linksArray.forEach((link, index) => {
      const source = getCenter(link.sourceId)
      const target = getCenter(link.targetId)

      // Calculate path
      let d = ''
      const avatarRadius = 38 // 32 (half of 64) + 6 padding
      
      if (isCurved) {
        // We want to curve it. To make them distinct, we vary the offset.
        // If A->B and B->A, the normal vector direction flips, so a constant positive offset
        // relative to the normal vector will naturally push them apart.
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx*dx + dy*dy) || 1
        
        const mx = (source.x + target.x) / 2
        const my = (source.y + target.y) / 2
        
        const nx = -dy / dist
        const ny = dx / dist
        
        // Offset logic: if A->B and B->A are the two links, index 0 is A->B, index 1 is B->A.
        // A fixed offset will push A->B "right" and B->A "right" (which is opposite in absolute terms).
        // If there are 3 links all A->B, we need to spread them.
        const offset = (index - (count - 1) / 2) * 40 + 30 // base curve + spread
        
        const cx = mx + nx * offset
        const cy = my + ny * offset
        
        const startPt = getPointOnLine(source, { x: cx, y: cy }, avatarRadius)
        const endPt = getPointOnLine(target, { x: cx, y: cy }, avatarRadius)

        d = `M ${startPt.x} ${startPt.y} Q ${cx} ${cy} ${endPt.x} ${endPt.y}`
      } else {
        const startPt = getPointOnLine(source, target, avatarRadius)
        const endPt = getPointOnLine(target, source, avatarRadius)
        d = `M ${startPt.x} ${startPt.y} L ${endPt.x} ${endPt.y}`
      }

      // Determine color
      let color = '#a5b4fc'
      if (props.currentMode!.dataType === 'text') {
        color = settings.lineColor || color
      } else if (props.currentMode!.dataType === 'enum') {
        const valDef = settings.enumValues?.find((v: any) => v.id === link.value)
        if (valDef) color = valDef.color
      }

      result.push({
        id: link.id,
        d,
        color,
        markerEnd: settings.lineType === 'arrow' || settings.lineType === 'double_arrow' ? `url(#arrowhead-${link.id})` : '',
        markerStart: settings.lineType === 'double_arrow' ? `url(#arrowhead-start-${link.id})` : '',
        valueLabel: props.currentMode!.dataType === 'enum' 
          ? settings.enumValues?.find((v: any) => v.id === link.value)?.label 
          : link.value
      })
    })
  }

  return result
})

const drawingLinePath = computed(() => {
  if (!drawingSource.value) return ''
  const source = getCenter(drawingSource.value.characterId)
  const target = mousePos.value
  const startPt = getPointOnLine(source, target, 38)
  return `M ${startPt.x} ${startPt.y} L ${target.x} ${target.y}`
})
</script>

<template>
  <div class="board-container" ref="boardRef" 
       @drop="onDrop" @dragover.prevent 
       @wheel.prevent="onWheel" 
       @mousedown="onPanStart">
    
    <div class="board-canvas" :style="canvasStyle">
      <!-- Background grid for visual reference on canvas -->
      <div class="board-grid"></div>

      <svg class="links-layer">
      <defs>
        <!-- Dynamic markers for colors -->
        <template v-for="link in renderedLinks" :key="link.id">
          <marker :id="`arrowhead-${link.id}`" markerWidth="8" markerHeight="6" refX="28" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" :fill="link.color" />
          </marker>
          <marker :id="`arrowhead-start-${link.id}`" markerWidth="8" markerHeight="6" refX="-20" refY="3" orient="auto">
            <polygon points="8 0, 0 3, 8 6" :fill="link.color" />
          </marker>
        </template>
        
        <marker id="drawing-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" fill="#888" />
        </marker>
      </defs>

      <!-- Draw links -->
      <g v-for="link in renderedLinks" :key="link.id">
        <!-- Invisible thick path for easier hovering/clicking -->
        <path 
          :d="link.d" 
          stroke="transparent" 
          stroke-width="15" 
          fill="none" 
          class="link-hitbox"
          @contextmenu.stop="emit('context-menu', $event, 'link', link.id)"
        >
          <title>{{ link.valueLabel }}</title>
        </path>
        
        <!-- Visible path -->
        <path 
          :d="link.d" 
          :stroke="link.color" 
          stroke-width="2" 
          fill="none" 
          class="link-path"
          :marker-end="link.markerEnd"
          :marker-start="link.markerStart"
          style="pointer-events: none;"
        />
      </g>

      <!-- Drawing line -->
      <path 
        v-if="drawing" 
        :d="drawingLinePath" 
        stroke="#888" 
        stroke-width="2" 
        stroke-dasharray="5,5" 
        fill="none" 
        marker-end="url(#drawing-arrow)"
      />
    </svg>

    <div class="nodes-layer">
      <div 
        v-for="node in nodes" 
        :key="node.characterId"
        class="board-node" 
        :style="{ left: node.x + 'px', top: node.y + 'px' }"
        :data-id="node.characterId"
        @mousedown="startNodeDrag($event, node)"
        @contextmenu.stop="emit('context-menu', $event, 'node', node.characterId)"
      >
        <img :src="getAvatarSrc(getChar(node.characterId)?.avatarUrl)" class="node-avatar" draggable="false" />
        <span class="node-name">{{ getChar(node.characterId)?.name || t('links.unknown') }}</span>
        
        <div 
          class="node-connector" 
          :title="t('links.dragToCreateLink')"
          @mousedown.stop="startDrawing($event, node)"
        ></div>
      </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-container {
  position: relative;
  width: 100%;
  height: 100%;
  background: #1e1e24; /* Base background */
  overflow: hidden;
  cursor: grab;
}
.board-container:active {
  cursor: grabbing;
}

.board-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform-origin: 0 0;
  /* Disable pointer events on canvas so background clicks bubble to container */
  pointer-events: none;
}

/* Reactivate pointer events for interactive layers */
.board-grid, .links-layer, .nodes-layer {
  pointer-events: auto;
}

.board-grid {
  position: absolute;
  /* Make it very large so it covers the canvas even when panned far */
  inset: -100000px;
  background: radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0;
  z-index: 0;
  pointer-events: none; /* Let clicks pass to container */
}

.links-layer {
  position: absolute;
  top: 0; left: 0;
  width: 1px; height: 1px;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
}

.link-hitbox {
  pointer-events: stroke;
  cursor: pointer;
}
.link-hitbox:hover + .link-path {
  stroke-width: 3;
  filter: brightness(1.2);
}

.nodes-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.board-node {
  position: absolute;
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 90px;
  cursor: grab;
  user-select: none;
}
.board-node:active { cursor: grabbing; }

.node-avatar {
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  background: #2a2a33;
  border: 2px solid rgba(255,255,255,0.1);
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  transition: border-color 0.2s;
}
.board-node:hover .node-avatar {
  border-color: rgba(255,255,255,0.3);
}

.node-name {
  font-size: 12px;
  color: #fff;
  text-align: center;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.node-connector {
  position: absolute;
  right: -6px;
  top: 26px;
  width: 12px;
  height: 12px;
  background: #646cff;
  border: 2px solid #1e1e24;
  border-radius: 50%;
  cursor: crosshair;
  opacity: 0;
  transition: opacity 0.2s, transform 0.2s;
}
.board-node:hover .node-connector {
  opacity: 1;
}
.node-connector:hover {
  transform: scale(1.3);
}
</style>
