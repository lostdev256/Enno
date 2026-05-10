<script setup lang="ts">
import {ref, onMounted, onUnmounted, computed} from "vue";
import CharacterSidebar from "./CharacterSidebar.vue";
import LinksBoard from "./LinksBoard.vue";
import LinkModesManager from "./LinkModesManager.vue";
import ContextMenu, {ContextMenuItem} from "./ContextMenu.vue";
import PromptDialog from "./PromptDialog.vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

const groups = ref([]);
const ungrouped = ref([]);
const charactersList = ref<any[]>([]);

const boardNodes = ref<any[]>([]);
const boardLinks = ref<any[]>([]);
const linkModes = ref<any[]>([]);

const currentModeId = ref("");
const showModesManager = ref(false);

// Context Menu State
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxItems = ref<ContextMenuItem[]>([]);
let pendingLinkAction: any = null; // { modeId, sourceId, targetId }
let pendingNodeId: string | null = null;
let pendingLinkId: string | null = null;

// Prompt State
const promptVisible = ref(false);
let pendingTextLink: any = null;

async function loadCharacters() {
    const data = await window.ennoAPI.getCharactersList();
    groups.value = data.groups;
    ungrouped.value = data.ungrouped;

    const allChars = [];
    for (const g of data.groups) {
        allChars.push(...g.characters);
    }
    allChars.push(...data.ungrouped);
    charactersList.value = allChars;
}

async function loadBoard() {
    const data = await window.ennoAPI.getBoardData();
    boardNodes.value = data.nodes;
    boardLinks.value = data.links;
    linkModes.value = data.modes;

    if (!currentModeId.value && data.modes.length > 0) {
        currentModeId.value = data.modes[0].id;
    } else if (data.modes.length > 0) {
        const exists = data.modes.find((m: any) => m.id === currentModeId.value);
        if (!exists) currentModeId.value = data.modes[0].id;
    }
}

const currentMode = computed(() => linkModes.value.find((m: any) => m.id === currentModeId.value) || null);

onMounted(async () => {
    await loadCharacters();
    await loadBoard();

    window.ennoAPI.onProjectStateChange(async (state: any) => {
        if (state.isOpen) {
            await loadCharacters();
            await loadBoard();
        }
    });
});

onUnmounted(() => {
    window.ennoAPI.offProjectStateChange();
});

// ── Board Handlers ──

async function onAddNode(charId: string, x: number, y: number) {
    const exists = boardNodes.value.find(n => n.characterId === charId);
    if (exists) {
        await window.ennoAPI.updateBoardNode(charId, x, y);
    } else {
        await window.ennoAPI.addBoardNode(charId, x, y);
    }
    await loadBoard();
}

async function onUpdateNode(charId: string, x: number, y: number) {
    await window.ennoAPI.updateBoardNode(charId, x, y);
    await loadBoard();
}

async function onCreateLink(modeId: string, sourceId: string, targetId: string, value: string) {
    await window.ennoAPI.createLink(modeId, sourceId, targetId, value);
    await loadBoard();
}

function onShowEnumMenu(evt: MouseEvent, modeId: string, sourceId: string, targetId: string) {
    const mode = linkModes.value.find((m: any) => m.id === modeId);
    if (!mode) return;
    let settings: any = {};
    try {
        settings = JSON.parse(mode.settings);
    } catch {
    }

    if (settings.enumValues) {
        ctxItems.value = settings.enumValues.map((val: any) => ({
            label: val.label,
            action: val.id
        }));
        pendingLinkAction = {modeId, sourceId, targetId};
        ctxX.value = evt.clientX;
        ctxY.value = evt.clientY;
        ctxVisible.value = true;
    }
}

function onBoardContextMenu(evt: MouseEvent, type: "node" | "link", id: string) {
    ctxX.value = evt.clientX;
    ctxY.value = evt.clientY;

    if (type === "node") {
        pendingNodeId = id;
        ctxItems.value = [
            {label: t("links.removeFromBoard"), action: "remove-node", icon: "✕"}
        ];
    } else if (type === "link") {
        pendingLinkId = id;
        ctxItems.value = [
            {label: t("links.deleteLink"), action: "delete-link", icon: "✕"}
        ];
    }
    ctxVisible.value = true;
}

async function onCtxAction(action: string) {
    if (pendingLinkAction && action !== "remove-node" && action !== "delete-link") {
        // It's an enum selection
        await window.ennoAPI.createLink(
            pendingLinkAction.modeId,
            pendingLinkAction.sourceId,
            pendingLinkAction.targetId,
            action
        );
        await loadBoard();
        pendingLinkAction = null;
    } else if (action === "remove-node" && pendingNodeId) {
        await window.ennoAPI.removeBoardNode(pendingNodeId);
        await loadBoard();
        pendingNodeId = null;
    } else if (action === "delete-link" && pendingLinkId) {
        await window.ennoAPI.deleteLink(pendingLinkId);
        await loadBoard();
        pendingLinkId = null;
    }
}

function onCtxClose() {
    ctxVisible.value = false;
    pendingLinkAction = null;
    pendingNodeId = null;
    pendingLinkId = null;
}

function onShowTextPrompt(modeId: string, sourceId: string, targetId: string) {
    pendingTextLink = {modeId, sourceId, targetId};
    promptVisible.value = true;
}

async function onPromptConfirm(value: string) {
    promptVisible.value = false;
    if (pendingTextLink) {
        await window.ennoAPI.createLink(
            pendingTextLink.modeId,
            pendingTextLink.sourceId,
            pendingTextLink.targetId,
            value || "Connected"
        );
        await loadBoard();
        pendingTextLink = null;
    }
}

function onPromptCancel() {
    promptVisible.value = false;
    pendingTextLink = null;
}
</script>

<template>
    <div class="links-page">
        <CharacterSidebar
            :groups="groups"
            :ungrouped="ungrouped"
            :selected-id="null"
            @select="() => {}"
        />

        <div class="board-area">
            <header class="board-header">
                <div class="mode-selector">
                    <label>{{ t("links.linkMode") }}</label>
                    <select v-model="currentModeId" class="mode-select">
                        <option v-for="mode in linkModes" :key="mode.id" :value="mode.id">
                            {{ mode.name }}
                        </option>
                    </select>
                    <button class="icon-btn" @click="showModesManager = true" :title="t('links.manageModesTitle')">⚙️
                    </button>
                </div>
            </header>

            <div class="board-wrapper">
                <LinksBoard
                    :nodes="boardNodes"
                    :links="boardLinks"
                    :characters="charactersList"
                    :current-mode="currentMode"
                    @add-node="onAddNode"
                    @update-node="onUpdateNode"
                    @create-link="onCreateLink"
                    @show-enum-menu="onShowEnumMenu"
                    @show-text-prompt="onShowTextPrompt"
                    @context-menu="onBoardContextMenu"
                />
            </div>
        </div>

        <LinkModesManager
            :visible="showModesManager"
            @close="showModesManager = false"
            @changed="loadBoard"
        />

        <ContextMenu
            :visible="ctxVisible"
            :x="ctxX"
            :y="ctxY"
            :items="ctxItems"
            @action="onCtxAction"
            @close="onCtxClose"
        />

        <PromptDialog
            :visible="promptVisible"
            :title="t('links.enterConnectionDesc')"
            @confirm="onPromptConfirm"
            @cancel="onPromptCancel"
        />
    </div>
</template>

<style scoped>
.links-page {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.board-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #1e1e24;
}

.board-header {
    padding: 12px 20px;
    background: rgba(0, 0, 0, 0.2);
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    display: flex;
    align-items: center;
}

.mode-selector {
    display: flex;
    align-items: center;
    gap: 12px;
}

.mode-selector label {
    color: #888;
    font-size: 13px;
}

.mode-select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
}

.mode-select:focus {
    border-color: #646cff;
}

.icon-btn {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 6px;
    cursor: pointer;
    color: #ccc;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
}

.icon-btn:hover {
    background: rgba(255, 255, 255, 0.1);
}

.board-wrapper {
    flex: 1;
    position: relative;
}
</style>
