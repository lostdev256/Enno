<script setup lang="ts">
import {ref} from "vue";
import draggable from "vuedraggable";
import ContextMenu from "./ContextMenu.vue";
import type {ContextMenuItem} from "./ContextMenu.vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

interface SidebarQuest {
    id: string;
    name: string;
    iconUrl: string | null;
    parentId: string | null;
}

interface SidebarGroup {
    id: string;
    name: string;
    expanded: boolean;
    quests: SidebarQuest[];
}

const props = defineProps<{
    groups: SidebarGroup[]
    ungrouped: SidebarQuest[]
    selectedId: string | null
}>();

const emit = defineEmits<{
    (e: "select", id: string): void
    (e: "create-quest"): void
    (e: "create-group"): void
    (e: "delete-quest", id: string): void
    (e: "delete-group", id: string): void
    (e: "rename-group", id: string): void
    (e: "reorder", data: { groups: SidebarGroup[], ungrouped: SidebarQuest[] }): void
    (e: "collapse-all"): void
    (e: "expand-all"): void
}>();

const showAddDropdown = ref(false);

function toggleAddDropdown() {
    showAddDropdown.value = !showAddDropdown.value;
}

function addQuest() {
    showAddDropdown.value = false;
    emit("create-quest");
}

function addGroup() {
    showAddDropdown.value = false;
    emit("create-group");
}

function onDocClick(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest(".add-dropdown-wrap")) {
        showAddDropdown.value = false;
    }
}

function onDragEnd() {
    emit("reorder", {groups: props.groups, ungrouped: props.ungrouped});
}

function toggleGroup(group: SidebarGroup) {
    group.expanded = !group.expanded;
}

// Context menu
const ctxVisible = ref(false);
const ctxX = ref(0);
const ctxY = ref(0);
const ctxItems = ref<ContextMenuItem[]>([]);
const ctxTargetId = ref<string | null>(null);

function onContextMenu(e: MouseEvent, type: "quest" | "group" | "empty", id?: string) {
    e.preventDefault();
    ctxX.value = e.clientX;
    ctxY.value = e.clientY;
    ctxTargetId.value = id || null;
    if (type === "quest") {
        ctxItems.value = [{label: t("quests.deleteQuest"), action: "delete-quest", icon: "🗑"}];
    } else if (type === "group") {
        ctxItems.value = [
            {label: t("scenes.renameGroup"), action: "rename-group", icon: "✏️"},
            {label: t("scenes.deleteGroup"), action: "delete-group", icon: "🗑"}
        ];
    } else {
        ctxItems.value = [
            {label: t("menu.quests"), action: "add-quest", icon: "➕"},
            {label: t("scenes.addGroup"), action: "add-group", icon: "📁"}
        ];
    }
    ctxVisible.value = true;
}

function onCtxAction(action: string) {
    switch (action) {
        case "delete-quest":
            if (ctxTargetId.value) emit("delete-quest", ctxTargetId.value);
            break;
        case "rename-group":
            if (ctxTargetId.value) emit("rename-group", ctxTargetId.value);
            break;
        case "delete-group":
            if (ctxTargetId.value) emit("delete-group", ctxTargetId.value);
            break;
        case "add-quest":
            emit("create-quest");
            break;
        case "add-group":
            emit("create-group");
            break;
    }
}

import defaultIcon from "../assets/default-avatar.svg";

function getIconSrc(url: string | null): string {
    if (!url) return defaultIcon;
    return `enno://${url}`;
}
</script>

<template>
    <aside class="sidebar" @contextmenu="onContextMenu($event, 'empty')" @click="onDocClick">
        <div class="sidebar-toolbar">
            <div class="add-dropdown-wrap">
                <button class="tb-btn" :class="{ active: showAddDropdown }" @click.stop="toggleAddDropdown"
                        :title="t('shared.confirm')">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                    </svg>
                </button>
                <Transition name="dropdown">
                    <div v-if="showAddDropdown" class="add-dropdown">
                        <button class="add-dropdown-item" @click="addQuest"><span>📜</span> {{ t("menu.quests") }}
                        </button>
                        <button class="add-dropdown-item" @click="addGroup"><span>📁</span> {{ t("scenes.addGroup") }}
                        </button>
                    </div>
                </Transition>
            </div>

            <button class="tb-btn" @click="selectedId && emit('delete-quest', selectedId)" :disabled="!selectedId"
                    :title="t('quests.deleteQuest')">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                        d="M2.5 3.5h9M5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M3.5 3.5l.5 8a1 1 0 001 1h4a1 1 0 001-1l.5-8"
                        stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </button>
            <div class="tb-spacer"></div>
            <button class="tb-btn" @click="emit('collapse-all')" title="Collapse all">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                          stroke-linejoin="round" transform="rotate(180 7 7)"/>
                </svg>
            </button>
            <button class="tb-btn" @click="emit('expand-all')" title="Expand all">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                          stroke-linejoin="round"/>
                </svg>
            </button>
        </div>

        <div class="sidebar-list">
            <draggable :list="groups" item-key="id" handle=".group-drag-handle" :animation="200"
                       ghost-class="drag-ghost" chosen-class="drag-chosen" @end="onDragEnd">
                <template #item="{ element: group }">
                    <div class="group">
                        <div class="group-header group-drag-handle" @click="toggleGroup(group)"
                             @contextmenu.stop="onContextMenu($event, 'group', group.id)">
                            <span class="group-chevron" :class="{ expanded: group.expanded }">▸</span>
                            <span class="group-name">{{ group.name }}</span>
                            <span class="group-count">{{ group.quests.length }}</span>
                        </div>
                        <div v-show="group.expanded" class="group-content">
                            <draggable :list="group.quests" group="quests" item-key="id" :animation="200"
                                       ghost-class="drag-ghost" chosen-class="drag-chosen" @end="onDragEnd">
                                <template #item="{ element }">
                                    <div class="card-item" :class="{ selected: selectedId === element.id }"
                                         @click="emit('select', element.id)"
                                         @contextmenu.stop="onContextMenu($event, 'quest', element.id)">
                                        <img :src="getIconSrc(element.iconUrl)" class="card-avatar" alt=""/>
                                        <span class="card-name">{{ element.name }}</span>
                                    </div>
                                </template>
                            </draggable>
                        </div>
                    </div>
                </template>
            </draggable>

            <div v-if="ungrouped.length > 0" class="ungrouped-section">
                <div class="group-header ungrouped-header">
                    <span class="group-name" style="opacity: 0.5; font-style: italic;">{{ t("menu.ungrouped") }}</span>
                </div>
                <draggable :list="ungrouped" group="quests" item-key="id" :animation="200" ghost-class="drag-ghost"
                           chosen-class="drag-chosen" @end="onDragEnd">
                    <template #item="{ element }">
                        <div class="card-item" :class="{ selected: selectedId === element.id }"
                             @click="emit('select', element.id)"
                             @contextmenu.stop="onContextMenu($event, 'quest', element.id)">
                            <img :src="getIconSrc(element.iconUrl)" class="card-avatar" alt=""/>
                            <span class="card-name">{{ element.name }}</span>
                        </div>
                    </template>
                </draggable>
            </div>
        </div>

        <ContextMenu :items="ctxItems" :x="ctxX" :y="ctxY" :visible="ctxVisible" @action="onCtxAction"
                     @close="ctxVisible = false"/>
    </aside>
</template>

<style scoped>
.sidebar {
    width: 260px;
    min-width: 260px;
    height: 100%;
    background: #1e1e24;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    user-select: none;
}

.sidebar-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    flex-shrink: 0;
}

.tb-btn {
    background: none;
    border: 1px solid transparent;
    color: #888;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all .15s;
}

.tb-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    color: #ccc;
}

.tb-btn.active {
    background: rgba(100, 108, 255, 0.15);
    color: #818cf8;
}

.tb-btn:disabled {
    opacity: .3;
    cursor: default;
}

.tb-spacer {
    flex: 1;
}

.add-dropdown-wrap {
    position: relative;
}

.add-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    min-width: 160px;
    background: #2c2c34;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 4px 0;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 100;
}

.add-dropdown-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    background: none;
    border: none;
    color: #d0d0e0;
    font-size: 12.5px;
    font-family: inherit;
    padding: 6px 14px;
    cursor: pointer;
    transition: background .12s;
    text-align: left;
}

.add-dropdown-item:hover {
    background: rgba(100, 108, 255, 0.18);
    color: #fff;
}

.sidebar-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
}

.sidebar-list::-webkit-scrollbar {
    width: 5px;
}

.sidebar-list::-webkit-scrollbar-track {
    background: transparent;
}

.sidebar-list::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 4px;
}

.group {
    margin-bottom: 2px;
}

.group-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    cursor: pointer;
    transition: background .12s;
    font-size: 11.5px;
    font-weight: 600;
    color: #8888a0;
    text-transform: uppercase;
    letter-spacing: .5px;
}

.group-header:hover {
    background: rgba(255, 255, 255, 0.03);
}

.group-chevron {
    display: inline-block;
    transition: transform .2s;
    font-size: 10px;
    width: 12px;
}

.group-chevron.expanded {
    transform: rotate(90deg);
}

.group-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.group-count {
    font-size: 10px;
    color: #555;
    background: rgba(255, 255, 255, 0.05);
    padding: 1px 6px;
    border-radius: 8px;
}

.group-content {
    padding-left: 4px;
}

.card-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 12px 6px 20px;
    cursor: pointer;
    transition: background .12s;
}

.card-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.card-item.selected {
    background: rgba(100, 108, 255, 0.12);
    border-right: 2px solid #818cf8;
}

.card-avatar {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: cover;
    flex-shrink: 0;
    background: #2a2a3e;
}

.card-name {
    font-size: 13px;
    color: #c0c0d8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.card-item.selected .card-name {
    color: #e0e0f0;
}

.drag-ghost {
    opacity: .4;
    background: rgba(100, 108, 255, 0.08) !important;
}

.drag-chosen {
    background: rgba(100, 108, 255, 0.12) !important;
}

.dropdown-enter-active {
    transition: opacity .12s ease, transform .12s ease;
}

.dropdown-leave-active {
    transition: opacity .08s ease;
}

.dropdown-enter-from {
    opacity: 0;
    transform: translateY(-4px);
}

.dropdown-leave-to {
    opacity: 0;
}

.ungrouped-section {
    margin-top: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    padding-top: 4px;
}

.ungrouped-header {
    cursor: default;
}

.ungrouped-header:hover {
    background: transparent;
}
</style>
