<script setup lang="ts">
import {ref, computed, watch, nextTick, onMounted} from "vue";
import ContextMenu from "./ContextMenu.vue";
import type {ContextMenuItem} from "./ContextMenu.vue";
import defaultAvatar from "../assets/default-avatar.svg";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

const props = defineProps<{ scene: any }>();
const emit = defineEmits<{
    (e: "reload"): void
    (e: "update-name", name: string): void
}>();

const boardRef = ref<HTMLElement | null>(null);

// ── Pan & Zoom ──
const transform = ref({x: 0, y: 0, scale: 1});
const canvasStyle = computed(() => ({
    transform: `translate(${transform.value.x}px, ${transform.value.y}px) scale(${transform.value.scale})`
}));

function clientToCanvas(clientX: number, clientY: number) {
    if (!boardRef.value) return {x: 0, y: 0};
    const rect = boardRef.value.getBoundingClientRect();
    return {
        x: (clientX - rect.left - transform.value.x) / transform.value.scale,
        y: (clientY - rect.top - transform.value.y) / transform.value.scale
    };
}

const isPanning = ref(false);
let panStartPointer = {x: 0, y: 0};
let panStartTransform = {x: 0, y: 0};

function onBoardMouseDown(e: MouseEvent) {
    if (e.button === 1 || (e.button === 0 && !(e.target as HTMLElement).closest(".action-block"))) {
        isPanning.value = true;
        panStartPointer = {x: e.clientX, y: e.clientY};
        panStartTransform = {x: transform.value.x, y: transform.value.y};
        window.addEventListener("mousemove", onPanMove);
        window.addEventListener("mouseup", onPanEnd);
    }
}

function onPanMove(e: MouseEvent) {
    if (!isPanning.value) return;
    transform.value.x = panStartTransform.x + (e.clientX - panStartPointer.x);
    transform.value.y = panStartTransform.y + (e.clientY - panStartPointer.y);
}

function onPanEnd() {
    isPanning.value = false;
    window.removeEventListener("mousemove", onPanMove);
    window.removeEventListener("mouseup", onPanEnd);
}

function onWheel(e: WheelEvent) {
    const zoomFactor = 0.05;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = transform.value.scale * (1 + direction * zoomFactor);
    newScale = Math.max(0.1, Math.min(5, newScale));
    if (!boardRef.value) return;
    const rect = boardRef.value.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const cx = (mx - transform.value.x) / transform.value.scale;
    const cy = (my - transform.value.y) / transform.value.scale;
    transform.value.x = mx - cx * newScale;
    transform.value.y = my - cy * newScale;
    transform.value.scale = newScale;
}

// ── Action colors ──
const actionColors: Record<string, string> = {
    entry: "#22c55e",
    exit: "#ef4444",
    scene: "#3b82f6",
    character: "#f59e0b",
    dialog: "#a855f7"
};

const actionLabels = computed(() => ({
    entry: t("scenes.entry"),
    exit: t("scenes.exit"),
    scene: t("scenes.sceneEvent"),
    character: t("scenes.characterAction"),
    dialog: t("scenes.dialog")
}));

// ── Dragging Blocks ──
let draggedAction: any = null;
let dragStartPointer = {x: 0, y: 0};
let dragStartPos = {x: 0, y: 0};

function startBlockDrag(e: MouseEvent, action: any) {
    if (e.button !== 0) return;
    e.stopPropagation();
    draggedAction = action;
    dragStartPointer = {x: e.clientX, y: e.clientY};
    dragStartPos = {x: action.x, y: action.y};
    window.addEventListener("mousemove", onBlockDrag);
    window.addEventListener("mouseup", stopBlockDrag);
}

function onBlockDrag(e: MouseEvent) {
    if (!draggedAction) return;
    draggedAction.x = dragStartPos.x + (e.clientX - dragStartPointer.x) / transform.value.scale;
    draggedAction.y = dragStartPos.y + (e.clientY - dragStartPointer.y) / transform.value.scale;
    requestAnimationFrame(updateAllPinPositions);
}

async function stopBlockDrag() {
    if (draggedAction) {
        await window.ennoAPI.moveSceneAction(draggedAction.id, draggedAction.x, draggedAction.y);
        draggedAction = null;
    }
    window.removeEventListener("mousemove", onBlockDrag);
    window.removeEventListener("mouseup", stopBlockDrag);
}

// ── Drawing Connections ──
const drawing = ref(false);
const drawSourceId = ref("");
const drawSourcePin = ref("");
const mousePos = ref({x: 0, y: 0});

function startDrawing(e: MouseEvent, actionId: string, pinId: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    drawing.value = true;
    drawSourceId.value = actionId;
    drawSourcePin.value = pinId;
    updateDrawMouse(e);
    window.addEventListener("mousemove", updateDrawMouse);
    window.addEventListener("mouseup", stopDrawing);
}

function updateDrawMouse(e: MouseEvent) {
    mousePos.value = clientToCanvas(e.clientX, e.clientY);
}

let pendingAutoConnect: { sourceId: string; sourcePin: string } | null = null;

async function stopDrawing(e: MouseEvent) {
    window.removeEventListener("mousemove", updateDrawMouse);
    window.removeEventListener("mouseup", stopDrawing);
    if (!drawing.value) return;

    // Check drop on an input pin (old selector or new data-pin-key :in)
    const pinKeyEl = (e.target as HTMLElement).closest("[data-pin-key]") as HTMLElement | null;
    const pinKey = pinKeyEl?.dataset.pinKey || "";
    const isInputPin = pinKey.endsWith(":in");

    const legacyTarget = (e.target as HTMLElement).closest("[data-input-pin]") as HTMLElement | null;

    if (isInputPin && pinKeyEl) {
        const parts = pinKey.split(":");
        const targetActionId = parts[0];
        const targetPin = parts[1];
        if (targetActionId && targetActionId !== drawSourceId.value) {
            await window.ennoAPI.createSceneConnection(props.scene.id, drawSourceId.value, drawSourcePin.value, targetActionId, targetPin);
            emit("reload");
        }
    } else if (legacyTarget) {
        const targetActionId = legacyTarget.getAttribute("data-action-id") || "";
        const targetPin = legacyTarget.getAttribute("data-input-pin") || "in";
        if (targetActionId && targetActionId !== drawSourceId.value) {
            await window.ennoAPI.createSceneConnection(props.scene.id, drawSourceId.value, drawSourcePin.value, targetActionId, targetPin);
            emit("reload");
        }
    } else {
        // Dropped on empty space — show add menu and auto-connect
        pendingAutoConnect = {sourceId: drawSourceId.value, sourcePin: drawSourcePin.value};
        ctxCanvasPos = clientToCanvas(e.clientX, e.clientY);
        ctxX.value = e.clientX;
        ctxY.value = e.clientY;
        ctxConnectionId = null;
        ctxItems.value = [
            {label: t("scenes.sceneEvent"), action: "add:scene", icon: "📝"},
            {label: t("scenes.characterAction"), action: "add:character", icon: "🧑"},
            {label: t("scenes.dialog"), action: "add:dialog", icon: "💬"}
        ];
        ctxVisible.value = true;
    }
    drawing.value = false;
}

// ── DOM-based pin positions ──
// key = 'actionId:pinId:in' or 'actionId:pinId:out'
const pinPositions = ref<Map<string, { x: number; y: number }>>(new Map());
const pathTick = ref(0);

function findAction(id: string) {
    return props.scene?.actions?.find((a: any) => a.id === id);
}

function updateAllPinPositions() {
    if (!boardRef.value) return;
    const boardRect = boardRef.value.getBoundingClientRect();
    const s = transform.value.scale;
    const tx = transform.value.x;
    const ty = transform.value.y;
    const map = new Map<string, { x: number; y: number }>();
    boardRef.value.querySelectorAll("[data-pin-key]").forEach(el => {
        const key = (el as HTMLElement).dataset.pinKey!;
        const r = el.getBoundingClientRect();
        const cx = (r.left + r.width / 2 - boardRect.left - tx) / s;
        const cy = (r.top + r.height / 2 - boardRect.top - ty) / s;
        map.set(key, {x: cx, y: cy});
    });
    pinPositions.value = map;
    pathTick.value++;
}

function getPinPos(actionId: string, pinId: string, side: "in" | "out"): { x: number; y: number } {
    void pathTick.value;
    return pinPositions.value.get(`${actionId}:${pinId}:${side}`) || {x: 0, y: 0};
}

const connectionPaths = computed(() => {
    void pathTick.value;
    if (!props.scene) return [];
    return props.scene.connections.map((conn: any) => {
        const from = getPinPos(conn.sourceActionId, conn.sourcePin, "out");
        const to = getPinPos(conn.targetActionId, conn.targetPin, "in");
        const dx = Math.abs(to.x - from.x) * 0.5;
        const d = `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
        return {id: conn.id, d};
    });
});

const drawingPath = computed(() => {
    if (!drawing.value) return "";
    void pathTick.value;
    const from = getPinPos(drawSourceId.value, drawSourcePin.value, "out");
    const to = mousePos.value;
    const dx = Math.abs(to.x - from.x) * 0.5;
    return `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`;
});

// ── Context Menu ──
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxItems = ref<ContextMenuItem[]>([]);
let ctxCanvasPos = {x: 0, y: 0};
let ctxConnectionId: string | null = null;

function onBoardContextMenu(e: MouseEvent) {
    e.preventDefault();
    const target = (e.target as HTMLElement).closest(".action-block");
    if (target) return; // let block handle its own context menu

    ctxCanvasPos = clientToCanvas(e.clientX, e.clientY);
    ctxX.value = e.clientX;
    ctxY.value = e.clientY;
    ctxConnectionId = null;
    ctxItems.value = [
        {label: t("scenes.sceneEvent"), action: "add:scene", icon: "📝"},
        {label: t("scenes.characterAction"), action: "add:character", icon: "🧑"},
        {label: t("scenes.dialog"), action: "add:dialog", icon: "💬"}
    ];
    ctxVisible.value = true;
}

function onConnectionContextMenu(e: MouseEvent, connId: string) {
    e.preventDefault();
    e.stopPropagation();
    ctxX.value = e.clientX;
    ctxY.value = e.clientY;
    ctxConnectionId = connId;
    ctxItems.value = [{label: t("storyline.deleteConnection"), action: "delete-connection", icon: "✕"}];
    ctxVisible.value = true;
}

function onBlockContextMenu(e: MouseEvent, action: any) {
    e.preventDefault();
    e.stopPropagation();
    if (action.actionType === "entry" || action.actionType === "exit") return;
    ctxX.value = e.clientX;
    ctxY.value = e.clientY;
    ctxConnectionId = null;
    ctxItems.value = [{label: t("scenes.deleteScene"), action: `delete-action:${action.id}`, icon: "🗑"}];
    ctxVisible.value = true;
}

async function onCtxAction(action: string) {
    if (action.startsWith("add:")) {
        const type = action.replace("add:", "");
        const newAction = await window.ennoAPI.createSceneAction(props.scene.id, type, ctxCanvasPos.x, ctxCanvasPos.y);
        // Auto-connect if triggered from pin drop
        if (pendingAutoConnect && newAction) {
            await window.ennoAPI.createSceneConnection(props.scene.id, pendingAutoConnect.sourceId, pendingAutoConnect.sourcePin, newAction.id, "in");
            pendingAutoConnect = null;
        }
        emit("reload");
    } else if (action === "delete-connection" && ctxConnectionId) {
        await window.ennoAPI.deleteSceneConnection(ctxConnectionId);
        emit("reload");
    } else if (action.startsWith("delete-action:")) {
        const id = action.replace("delete-action:", "");
        await window.ennoAPI.deleteSceneAction(id);
        emit("reload");
    }
    pendingAutoConnect = null;
}

// ── Action Data Helpers ──
function parseData(dataStr: string): any {
    try {
        return JSON.parse(dataStr);
    } catch {
        return {};
    }
}


function getCharacter(charId: string | null) {
    if (!charId || !props.scene.characters) return null;
    return props.scene.characters.find((c: any) => c.characterId === charId);
}

function getAvatarSrc(url: string | null | undefined): string {
    if (!url) return defaultAvatar;
    return `enno://${url}`;
}

// ── Inline Editing ──
const editingActionId = ref<string | null>(null);
const editingField = ref("");
const editText = ref("");

function startEdit(action: any, field: string) {
    const data = parseData(action.data);
    editingActionId.value = action.id;
    editingField.value = field;
    editText.value = field === "text" ? (data.text || "") : (data.description || "");
}

async function saveEdit(action: any) {
    if (!editingActionId.value) return;
    const data = parseData(action.data);
    if (editingField.value === "text") data.text = editText.value;
    else data.description = editText.value;
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    editingActionId.value = null;
    emit("reload");
}

function cancelEdit() {
    editingActionId.value = null;
}

// Character selection for CharacterAction / DialogAction
const charPickerForAction = ref<string | null>(null);

function openCharPickerForAction(actionId: string) {
    charPickerForAction.value = actionId;
}

async function selectCharForAction(charId: string) {
    if (!charPickerForAction.value) return;
    const action = findAction(charPickerForAction.value);
    if (!action) return;
    const data = parseData(action.data);
    data.characterId = charId;
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    charPickerForAction.value = null;
    emit("reload");
}

// Quest picker for Entry action
const questPickerForAction = ref<string | null>(null);
const allQuests = ref<any[]>([]);

async function openQuestPicker(action: any) {
    questPickerForAction.value = action.id;
    const data = await window.ennoAPI.getQuestsList();
    const flat: any[] = [];
    for (const g of data.groups) flat.push(...g.quests);
    flat.push(...data.ungrouped);
    allQuests.value = flat;
}

async function selectQuest(quest: any) {
    if (!questPickerForAction.value) return;
    const action = findAction(questPickerForAction.value);
    if (!action) return;
    const data = parseData(action.data);
    data.questId = quest.id;
    data.questName = quest.name;
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    questPickerForAction.value = null;
    emit("reload");
}


// Choice management
async function addChoice(action: any) {
    const data = parseData(action.data);
    if (!data.choices) data.choices = [];
    const id = "ch_" + Math.random().toString(36).slice(2, 8);
    data.choices.push({id, label: "Choice " + (data.choices.length + 1)});
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    emit("reload");
}

async function removeChoice(action: any, choiceId: string) {
    const data = parseData(action.data);
    data.choices = (data.choices || []).filter((c: any) => c.id !== choiceId);
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    // Also delete connections from this pin
    const conns = props.scene.connections.filter((c: any) => c.sourceActionId === action.id && c.sourcePin === choiceId);
    for (const c of conns) await window.ennoAPI.deleteSceneConnection(c.id);
    emit("reload");
}

async function updateChoiceLabel(action: any, choiceId: string, label: string) {
    const data = parseData(action.data);
    const ch = (data.choices || []).find((c: any) => c.id === choiceId);
    if (ch) ch.label = label;
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
}

// Exit pin management
async function addExitPin(action: any) {
    const data = parseData(action.data);
    if (!data.pins) data.pins = [];
    const id = "ep_" + Math.random().toString(36).slice(2, 8);
    data.pins.push({id, label: "Exit " + (data.pins.length + 1), description: ""});
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    emit("reload");
}

async function removeExitPin(action: any, pinId: string) {
    const data = parseData(action.data);
    data.pins = (data.pins || []).filter((p: any) => p.id !== pinId);
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
    emit("reload");
}

async function updateExitPinLabel(action: any, pinId: string, label: string) {
    const data = parseData(action.data);
    const pin = (data.pins || []).find((p: any) => p.id === pinId);
    if (pin) pin.label = label;
    await window.ennoAPI.updateSceneAction(action.id, JSON.stringify(data));
}

// ── Characters Panel ──
const showCharPanel = ref(true);
const showCharPicker = ref(false);
const allCharacters = ref<any[]>([]);

async function openCharPicker() {
    const data = await window.ennoAPI.getCharactersList();
    const all: any[] = [];
    for (const g of data.groups) all.push(...g.characters);
    all.push(...data.ungrouped);
    allCharacters.value = all;
    showCharPicker.value = true;
}

async function addCharacterToScene(charId: string) {
    await window.ennoAPI.addSceneCharacter(props.scene.id, charId);
    showCharPicker.value = false;
    emit("reload");
}

async function removeCharFromScene(charId: string) {
    await window.ennoAPI.removeSceneCharacter(props.scene.id, charId);
    emit("reload");
}

// ── Editing name ──
const editingName = ref(false);
const nameInput = ref("");

function startEditName() {
    nameInput.value = props.scene.name;
    editingName.value = true;
    nextTick(() => {
        const el = document.querySelector(".scene-name-input") as HTMLInputElement;
        el?.focus();
    });
}

function saveName() {
    editingName.value = false;
    if (nameInput.value.trim() && nameInput.value !== props.scene.name) {
        emit("update-name", nameInput.value.trim());
    }
}

// Force re-render connection paths on scene change and mount
watch(() => props.scene, () => {
    nextTick(() => updateAllPinPositions());
}, {deep: true});

onMounted(() => nextTick(() => updateAllPinPositions()));
</script>

<template>
    <div class="scene-board" ref="boardRef" @mousedown="onBoardMouseDown" @wheel.prevent="onWheel"
         @contextmenu="onBoardContextMenu">
        <!-- Scene title bar -->
        <div class="scene-title-bar">
            <div v-if="!editingName" class="scene-title" @dblclick="startEditName">
                🎬 {{ scene.name }}
                <button class="title-edit-btn" @click="startEditName" :title="t('scenes.renameScene')">✏️</button>
            </div>
            <input v-else class="scene-name-input" v-model="nameInput" @blur="saveName" @keydown.enter="saveName"
                   @keydown.escape="editingName = false"/>
        </div>

        <!-- Characters panel (floating) -->
        <div v-if="showCharPanel" class="char-panel">
            <div class="char-panel-header">
                <span>{{ t("scenes.characters") }}</span>
                <button class="char-panel-btn" @click="openCharPicker" :title="t('scenes.addCharacter')">＋</button>
            </div>
            <div class="char-panel-list">
                <div v-for="ch in scene.characters" :key="ch.characterId" class="char-panel-item">
                    <img :src="getAvatarSrc(ch.avatarUrl)" class="char-panel-avatar"/>
                    <span class="char-panel-name">{{ ch.name }}</span>
                    <button class="char-panel-remove" @click="removeCharFromScene(ch.characterId)"
                            :title="t('shared.close')">✕
                    </button>
                </div>
                <div v-if="!scene.characters || scene.characters.length === 0" class="char-panel-empty">
                    {{ t("scenes.noCharacters") }}
                </div>
            </div>
        </div>

        <!-- Character picker dialog -->
        <Teleport to="body">
            <div v-if="showCharPicker" class="picker-overlay" @click.self="showCharPicker = false">
                <div class="picker-dialog">
                    <h3>{{ t("scenes.selectCharacter") }}</h3>
                    <div class="picker-list">
                        <div v-for="ch in allCharacters" :key="ch.id" class="picker-item"
                             @click="addCharacterToScene(ch.id)">
                            <img :src="getAvatarSrc(ch.avatarUrl)" class="picker-avatar"/>
                            <span>{{ ch.name }}</span>
                        </div>
                    </div>
                    <button class="picker-cancel" @click="showCharPicker = false">{{ t("shared.cancel") }}</button>
                </div>
            </div>
        </Teleport>

        <!-- Canvas -->
        <div class="board-canvas" :style="canvasStyle">
            <div class="board-grid"></div>

            <!-- SVG connections layer -->
            <svg class="connections-layer">
                <g v-for="conn in connectionPaths" :key="conn.id">
                    <path :d="conn.d" stroke="transparent" stroke-width="12" fill="none" class="conn-hitbox"
                          @contextmenu="onConnectionContextMenu($event, conn.id)"/>
                    <path :d="conn.d" stroke="#a5b4fc" stroke-width="2" fill="none" class="conn-path"
                          style="pointer-events:none;"/>
                </g>
                <path v-if="drawing" :d="drawingPath" stroke="#888" stroke-width="2" stroke-dasharray="5,5"
                      fill="none"/>
            </svg>

            <!-- Action blocks -->
            <div
                v-for="action in scene.actions"
                :key="action.id"
                class="action-block"
                :style="{ left: action.x + 'px', top: action.y + 'px' }"
                @contextmenu="onBlockContextMenu($event, action)"
            >
                <!-- Header (drag handle) -->
                <div class="block-header" :style="{ background: actionColors[action.actionType] || '#555' }"
                     @mousedown="startBlockDrag($event, action)">
                    <span class="block-title">{{ (actionLabels as any)[action.actionType] || action.actionType }}</span>
                    <span v-if="action.actionType === 'character' || action.actionType === 'dialog'"
                          class="block-char-name" @click.stop="openCharPickerForAction(action.id)"
                          style="cursor:pointer;">
            {{ getCharacter(parseData(action.data).characterId)?.name || t("scenes.selectCharacterSmall") }}
          </span>
                </div>

                <!-- Body: left input pin | content | right output area -->
                <div class="block-body">

                    <!-- Left: single input pin (all except entry) -->
                    <div class="pins-left">
                        <template v-if="action.actionType !== 'entry'">
                            <div class="pin-wrap" :data-input-pin="'in'" :data-action-id="action.id">
                                <div class="pin-dot input" :data-pin-key="`${action.id}:in:in`"></div>
                            </div>
                        </template>
                    </div>

                    <!-- Center content -->
                    <div class="block-content">

                        <!-- ENTRY -->
                        <template v-if="action.actionType === 'entry'">
                            <div v-if="editingActionId !== action.id" class="block-text editable"
                                 @dblclick.stop="startEdit(action, 'description')">
                                {{ parseData(action.data).description || t("scenes.entryPoint") }}
                            </div>
                            <textarea v-else class="block-input" v-model="editText" @blur="saveEdit(action)"
                                      @keydown.escape="cancelEdit" @keydown.ctrl.enter="saveEdit(action)" rows="3"
                                      @click.stop></textarea>
                            <!-- Quest link -->
                            <div class="quest-link" @click.stop="openQuestPicker(action)">
                                🗺 {{
                                    parseData(action.data).questId ? (parseData(action.data).questName || t("scenes.questSelected")) : t("scenes.linkQuest")
                                }}
                            </div>
                        </template>

                        <!-- EXIT: each pin has its own row with label input -->
                        <template v-else-if="action.actionType === 'exit'">
                            <div class="exit-pins-list">
                                <div v-for="pin in (parseData(action.data).pins || [])" :key="pin.id" class="exit-row">
                                    <input class="exit-pin-input" :value="pin.label"
                                           @change="updateExitPinLabel(action, pin.id, ($event.target as HTMLInputElement).value)"
                                           @click.stop :placeholder="t('scenes.exitLabel')"/>
                                    <button class="icon-btn red" @click.stop="removeExitPin(action, pin.id)"
                                            :title="t('shared.close')">✕
                                    </button>
                                </div>
                                <button class="add-choice-btn" @click.stop="addExitPin(action)">+ {{
                                        t("scenes.addExit")
                                    }}
                                </button>
                            </div>
                        </template>

                        <!-- DIALOG -->
                        <template v-else-if="action.actionType === 'dialog'">
                            <div v-if="editingActionId !== action.id" class="block-text editable"
                                 @dblclick.stop="startEdit(action, 'text')">
                                {{ parseData(action.data).text || t("scenes.dblclickToEditDialog") }}
                            </div>
                            <textarea v-else class="block-input" v-model="editText" @blur="saveEdit(action)"
                                      @keydown.escape="cancelEdit" @keydown.ctrl.enter="saveEdit(action)" rows="3"
                                      @click.stop></textarea>
                            <!-- Choices with inline output pins -->
                            <div v-if="(parseData(action.data).choices || []).length" class="choices-area">
                                <div v-for="ch in (parseData(action.data).choices || [])" :key="ch.id"
                                     class="choice-row-inline">
                                    <input class="choice-input" :value="ch.label"
                                           @change="updateChoiceLabel(action, ch.id, ($event.target as HTMLInputElement).value)"
                                           @click.stop/>
                                    <button class="icon-btn red" @click.stop="removeChoice(action, ch.id)">✕</button>
                                    <div class="pin-dot output choice-pin" :data-pin-key="`${action.id}:${ch.id}:out`"
                                         @mousedown="startDrawing($event, action.id, ch.id)"
                                         :title="t('shared.confirm')"></div>
                                </div>
                            </div>
                            <button class="add-choice-btn" @click.stop="addChoice(action)">+ {{
                                    t("scenes.addChoice")
                                }}
                            </button>
                        </template>

                        <!-- SCENE / CHARACTER -->
                        <template v-else>
                            <div v-if="editingActionId !== action.id" class="block-text editable"
                                 @dblclick.stop="startEdit(action, 'description')">
                                {{ parseData(action.data).description || t("scenes.dblclickToEdit") }}
                            </div>
                            <textarea v-else class="block-input" v-model="editText" @blur="saveEdit(action)"
                                      @keydown.escape="cancelEdit" @keydown.ctrl.enter="saveEdit(action)" rows="3"
                                      @click.stop></textarea>
                            <!-- Choices with inline output pins -->
                            <div v-if="(parseData(action.data).choices || []).length" class="choices-area">
                                <div v-for="ch in (parseData(action.data).choices || [])" :key="ch.id"
                                     class="choice-row-inline">
                                    <input class="choice-input" :value="ch.label"
                                           @change="updateChoiceLabel(action, ch.id, ($event.target as HTMLInputElement).value)"
                                           @click.stop/>
                                    <button class="icon-btn red" @click.stop="removeChoice(action, ch.id)">✕</button>
                                    <div class="pin-dot output choice-pin" :data-pin-key="`${action.id}:${ch.id}:out`"
                                         @mousedown="startDrawing($event, action.id, ch.id)"
                                         :title="t('shared.confirm')"></div>
                                </div>
                            </div>
                            <button class="add-choice-btn" @click.stop="addChoice(action)">+ {{
                                    t("scenes.addChoice")
                                }}
                            </button>
                        </template>

                    </div>

                    <!-- Right: output pins column -->
                    <div class="pins-right">
                        <!-- For EXIT: one output dot per exit-pin row, aligned to rows -->
                        <template v-if="action.actionType === 'exit'">
                            <div v-for="pin in (parseData(action.data).pins || [])" :key="pin.id" class="pin-wrap"
                                 @mousedown="startDrawing($event, action.id, pin.id)">
                                <div class="pin-dot output" :data-pin-key="`${action.id}:${pin.id}:out`"
                                     :title="pin.label"></div>
                            </div>
                        </template>
                        <!-- For ENTRY / plain actions (no choices): single out pin -->
                        <template
                            v-else-if="action.actionType === 'entry' || !(parseData(action.data).choices || []).length">
                            <div class="pin-wrap" @mousedown="startDrawing($event, action.id, 'out')">
                                <div class="pin-dot output" :data-pin-key="`${action.id}:out:out`"></div>
                            </div>
                        </template>
                        <!-- If has choices: no right column pins (they're inline) -->
                    </div>

                </div>
            </div>
        </div>

        <!-- Character picker for action blocks -->
        <Teleport to="body">
            <div v-if="charPickerForAction" class="picker-overlay" @click.self="charPickerForAction = null">
                <div class="picker-dialog">
                    <h3>{{ t("scenes.selectCharacterForAction") }}</h3>
                    <div class="picker-list">
                        <div v-for="ch in scene.characters" :key="ch.characterId" class="picker-item"
                             @click="selectCharForAction(ch.characterId)">
                            <img :src="getAvatarSrc(ch.avatarUrl)" class="picker-avatar"/>
                            <span>{{ ch.name }}</span>
                        </div>
                        <div v-if="!scene.characters?.length" class="char-panel-empty">
                            {{ t("scenes.addCharactersToSceneFirst") }}
                        </div>
                    </div>
                    <button class="picker-cancel" @click="charPickerForAction = null">{{ t("shared.cancel") }}</button>
                </div>
            </div>
        </Teleport>

        <ContextMenu :items="ctxItems" :x="ctxX" :y="ctxY" :visible="ctxVisible" @action="onCtxAction"
                     @close="ctxVisible = false"/>

        <!-- Quest picker -->
        <Teleport to="body">
            <div v-if="questPickerForAction" class="picker-overlay" @click.self="questPickerForAction = null">
                <div class="picker-dialog">
                    <h3>{{ t("scenes.linkQuestToEntry") }}</h3>
                    <div class="picker-list">
                        <div v-for="q in allQuests" :key="q.id" class="picker-item" @click="selectQuest(q)">
                            <span style="font-size:18px">🗺</span>
                            <span>{{ q.name }}</span>
                        </div>
                        <div v-if="!allQuests.length" class="char-panel-empty">{{ t("scenes.noQuestsFound") }}</div>
                    </div>
                    <button class="picker-cancel" @click="questPickerForAction = null">{{ t("shared.cancel") }}</button>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.scene-board {
    position: relative;
    width: 100%;
    height: 100%;
    background: #1a1a20;
    overflow: hidden;
    cursor: grab;
}

.scene-board:active {
    cursor: grabbing;
}

.scene-title-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    padding: 8px 16px;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(10px);
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.scene-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0f0;
    display: flex;
    align-items: center;
    gap: 8px;
}

.title-edit-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    opacity: 0.5;
    transition: opacity .2s;
}

.title-edit-btn:hover {
    opacity: 1;
}

.scene-name-input {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(100, 108, 255, 0.4);
    border-radius: 6px;
    padding: 4px 8px;
    color: #e0e0f0;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    outline: none;
}

/* Characters panel */
.char-panel {
    position: absolute;
    top: 48px;
    left: 12px;
    background: rgba(30, 30, 38, 0.9);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    z-index: 15;
    min-width: 180px;
    max-width: 240px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.char-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    font-size: 11px;
    font-weight: 600;
    color: #8888a0;
    text-transform: uppercase;
    letter-spacing: .5px;
}

.char-panel-btn {
    background: none;
    border: none;
    color: #818cf8;
    cursor: pointer;
    font-size: 16px;
    padding: 2px;
    transition: color .2s;
}

.char-panel-btn:hover {
    color: #c7d2fe;
}

.char-panel-list {
    padding: 6px;
    max-height: 200px;
    overflow-y: auto;
}

.char-panel-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 6px;
    border-radius: 6px;
    transition: background .12s;
}

.char-panel-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.char-panel-avatar {
    width: 24px;
    height: 24px;
    border-radius: 5px;
    object-fit: cover;
    background: #2a2a3e;
}

.char-panel-name {
    font-size: 12px;
    color: #c0c0d8;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.char-panel-remove {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 10px;
    padding: 2px;
    opacity: 0;
    transition: opacity .15s;
}

.char-panel-item:hover .char-panel-remove {
    opacity: 1;
}

.char-panel-remove:hover {
    color: #ef4444;
}

.char-panel-empty {
    font-size: 11px;
    color: #555;
    padding: 8px;
    text-align: center;
}

/* Picker dialog */
.picker-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
}

.picker-dialog {
    background: #2c2c34;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    min-width: 300px;
    max-width: 400px;
    max-height: 60vh;
    display: flex;
    flex-direction: column;
}

.picker-dialog h3 {
    margin: 0 0 12px;
    font-size: 16px;
    color: #e0e0f0;
}

.picker-list {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.picker-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: background .12s;
}

.picker-item:hover {
    background: rgba(100, 108, 255, 0.15);
}

.picker-avatar {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    object-fit: cover;
    background: #2a2a3e;
}

.picker-item span {
    font-size: 14px;
    color: #d0d0e0;
}

.picker-cancel {
    margin-top: 12px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 8px;
    color: #999;
    cursor: pointer;
    font-family: inherit;
    transition: all .15s;
}

.picker-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
}

/* Canvas */
.board-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    transform-origin: 0 0;
    pointer-events: none;
}

.board-grid {
    position: absolute;
    inset: -100000px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    pointer-events: none;
    z-index: 0;
}

.connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 1px;
    height: 1px;
    overflow: visible;
    pointer-events: none;
    z-index: 1;
}

.conn-hitbox {
    pointer-events: stroke;
    cursor: pointer;
}

.conn-hitbox:hover + .conn-path {
    stroke-width: 3;
    stroke: #c7d2fe;
}

/* Action blocks */
.action-block {
    position: absolute;
    pointer-events: auto;
    min-width: 200px;
    max-width: 320px;
    background: #252530;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    user-select: none;
    z-index: 2;
}

.block-header {
    padding: 6px 12px;
    border-radius: 7px 7px 0 0;
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: grab;
}

.block-header:active {
    cursor: grabbing;
}

.block-title {
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: .5px;
}

.block-char-name {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.7);
    font-weight: 400;
}

/* Block auto-height */
.block-body {
    display: flex;
    align-items: flex-start;
    padding: 8px 0;
}

.block-content {
    flex: 1;
    padding: 0 8px;
    font-size: 12px;
    color: #aaa;
    line-height: 1.5;
    word-break: break-word;
}

.block-text {
    white-space: pre-wrap;
    word-break: break-word;
}

/* Pin layout */
.pins-left, .pins-right {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 4px 0;
    gap: 0;
}

.pins-left {
    padding-left: 0;
    width: 14px;
    align-items: center;
}

.pins-right {
    padding-right: 0;
    width: 14px;
    align-items: center;
}

.pin-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    cursor: crosshair;
}

.pin-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.3);
    background: #1a1a20;
    transition: all .15s;
    flex-shrink: 0;
    cursor: crosshair;
}

.pin-dot.input {
    border-color: #a5b4fc;
}

.pin-dot.output {
    border-color: #f59e0b;
}

.pin-dot:hover {
    transform: scale(1.3);
    background: rgba(255, 255, 255, 0.2);
}

.pin-dot.choice-pin {
    margin-left: 4px;
    cursor: crosshair;
}

/* Editing */
.editable {
    cursor: text;
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 2px 4px;
    margin: -2px -4px;
    transition: border-color .15s;
    white-space: pre-wrap;
}

.editable:hover {
    border-color: rgba(255, 255, 255, 0.1);
}

.block-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(100, 108, 255, 0.4);
    border-radius: 4px;
    padding: 4px 6px;
    color: #e0e0f0;
    font-size: 12px;
    font-family: inherit;
    outline: none;
    resize: none;
    box-sizing: border-box;
}

.block-input:focus {
    border-color: #818cf8;
}

/* Quest link */
.quest-link {
    margin-top: 6px;
    padding: 3px 6px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 4px;
    font-size: 11px;
    color: #f59e0b;
    cursor: pointer;
    transition: background .15s;
}

.quest-link:hover {
    background: rgba(245, 158, 11, 0.2);
}

/* Choices inline */
.choices-area {
    margin-top: 6px;
    padding-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.choice-row-inline {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 4px;
}

.choice-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    color: #ccc;
    font-size: 11px;
    font-family: inherit;
    outline: none;
    min-width: 0;
}

.choice-input:focus {
    border-color: rgba(100, 108, 255, 0.4);
}

.add-choice-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 11px;
    padding: 3px 0;
    font-family: inherit;
    transition: color .15s;
    display: block;
}

.add-choice-btn:hover {
    color: #818cf8;
}

/* Exit pins */
.exit-pins-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.exit-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

.exit-pin-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 4px;
    padding: 2px 6px;
    color: #ccc;
    font-size: 11px;
    font-family: inherit;
    outline: none;
}

.exit-pin-input:focus {
    border-color: rgba(239, 68, 68, 0.4);
}

/* Icon buttons */
.icon-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 10px;
    padding: 2px 3px;
    border-radius: 3px;
    transition: color .15s;
    color: #555;
}

.icon-btn.red:hover {
    color: #ef4444;
}
</style>
