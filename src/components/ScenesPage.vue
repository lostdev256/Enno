<script setup lang="ts">
import {ref, onMounted} from "vue";
import SceneSidebar from "./SceneSidebar.vue";
import SceneBoard from "./SceneBoard.vue";
import PromptDialog from "./PromptDialog.vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

interface SidebarScene {
    id: string;
    name: string;
}

interface SidebarGroup {
    id: string;
    name: string;
    expanded: boolean;
    scenes: SidebarScene[];
}

const groups = ref<SidebarGroup[]>([]);
const ungrouped = ref<SidebarScene[]>([]);
const selectedId = ref<string | null>(null);
const sceneData = ref<any | null>(null);

const props = defineProps<{ initialSceneId?: string | null }>();
const emit = defineEmits(["loaded"]);


const promptVisible = ref(false);
const promptTitle = ref("");
const promptPlaceholder = ref("");
const promptInitialValue = ref("");
const promptResolve = ref<((value: string | null) => void) | null>(null);

function showPrompt(title: string, placeholder = "", initialValue = ""): Promise<string | null> {
    return new Promise((resolve) => {
        promptTitle.value = title;
        promptPlaceholder.value = placeholder;
        promptInitialValue.value = initialValue;
        promptResolve.value = resolve;
        promptVisible.value = true;
    });
}

function onPromptConfirm(value: string) {
    promptVisible.value = false;
    promptResolve.value?.(value);
    promptResolve.value = null;
}

function onPromptCancel() {
    promptVisible.value = false;
    promptResolve.value?.(null);
    promptResolve.value = null;
}

async function loadList() {
    const expandedState = new Map<string, boolean>();
    for (const g of groups.value) expandedState.set(g.id, g.expanded);
    const data = await window.ennoAPI.getScenesList();
    for (const g of data.groups) {
        if (expandedState.has(g.id)) g.expanded = expandedState.get(g.id)!;
    }
    groups.value = data.groups;
    ungrouped.value = data.ungrouped;
}

async function loadScene(id: string) {
    selectedId.value = id;
    sceneData.value = await window.ennoAPI.getScene(id);
}

async function reloadScene() {
    if (selectedId.value) {
        sceneData.value = await window.ennoAPI.getScene(selectedId.value);
    }
}

async function createScene() {
    const result = await window.ennoAPI.createScene();
    if (result) {
        await loadList();
        await loadScene(result.id);
    }
}

async function deleteScene(id: string) {
    await window.ennoAPI.deleteScene(id);
    if (selectedId.value === id) {
        selectedId.value = null;
        sceneData.value = null;
    }
    await loadList();
}

async function createGroup() {
    const name = await showPrompt(t("scenes.createGroup"), t("scenes.enterGroupName"));
    if (!name) return;
    await window.ennoAPI.createSceneGroup(name);
    await loadList();
}

async function deleteGroup(id: string) {
    await window.ennoAPI.deleteSceneGroup(id);
    await loadList();
}

async function renameGroup(id: string) {
    const group = groups.value.find(g => g.id === id);
    const newName = await showPrompt(t("scenes.renameGroup"), t("scenes.enterNewName"), group?.name || "");
    if (!newName) return;
    await window.ennoAPI.renameSceneGroup(id, newName);
    await loadList();
}

async function handleReorder(data: { groups: SidebarGroup[], ungrouped: SidebarScene[] }) {
    const order = {
        groups: data.groups.map(g => ({id: g.id, sceneIds: g.scenes.map(s => s.id)})),
        ungroupedIds: data.ungrouped.map(s => s.id)
    };
    await window.ennoAPI.reorderScenes(order);
}

function collapseAll() {
    groups.value.forEach(g => g.expanded = false);
}

function expandAll() {
    groups.value.forEach(g => g.expanded = true);
}

async function handleUpdateName(name: string) {
    if (!sceneData.value) return;
    await window.ennoAPI.updateScene(sceneData.value.id, "name", name);
    await loadList();
    await reloadScene();
}

onMounted(async () => {
    await loadList();
    if (props.initialSceneId) {
        await loadScene(props.initialSceneId);
        emit("loaded");
    }
    window.ennoAPI.onProjectStateChange((state) => {
        if (state.isOpen) {
            loadList();
        } else {
            groups.value = [];
            ungrouped.value = [];
            selectedId.value = null;
            sceneData.value = null;
        }
    });
});
</script>

<template>
    <div class="scenes-page">
        <SceneSidebar
            :groups="groups"
            :ungrouped="ungrouped"
            :selected-id="selectedId"
            @select="loadScene"
            @create-scene="createScene"
            @create-group="createGroup"
            @delete-scene="deleteScene"
            @delete-group="deleteGroup"
            @rename-group="renameGroup"
            @reorder="handleReorder"
            @collapse-all="collapseAll"
            @expand-all="expandAll"
        />

        <div class="board-area" v-if="sceneData">
            <SceneBoard
                :scene="sceneData"
                @reload="reloadScene"
                @update-name="handleUpdateName"
            />
        </div>

        <div v-else class="detail-empty">
            <div class="empty-icon">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="6" y="8" width="36" height="32" rx="4" stroke="currentColor" stroke-width="2"/>
                    <path d="M6 16h36" stroke="currentColor" stroke-width="1.5"/>
                    <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.3"/>
                    <circle cx="18" cy="12" r="2" fill="currentColor" opacity="0.3"/>
                    <circle cx="24" cy="12" r="2" fill="currentColor" opacity="0.3"/>
                    <path d="M14 28l6-4v8l-6-4z" fill="currentColor" opacity="0.3"/>
                </svg>
            </div>
            <p class="empty-text">{{ t("scenes.selectToEdit") }}</p>
        </div>

        <PromptDialog :visible="promptVisible" :title="promptTitle" :placeholder="promptPlaceholder"
                      :initial-value="promptInitialValue" @confirm="onPromptConfirm" @cancel="onPromptCancel"/>
    </div>
</template>

<style scoped>
.scenes-page {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
}

.board-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    position: relative;
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

.empty-icon {
    opacity: .3;
}

.empty-text {
    font-size: 14px;
    color: #555;
}
</style>
