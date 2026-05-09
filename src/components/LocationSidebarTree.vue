<script setup lang="ts">
import {defineProps, defineEmits} from "vue";
import draggable from "vuedraggable";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

interface LocationTreeItem {
    id: string;
    name: string;
    mapX: number | null;
    mapY: number | null;
    children: LocationTreeItem[];
}

const props = defineProps<{
    list: LocationTreeItem[]
    selectedId: string | null
}>();

const emit = defineEmits<{
    (e: "update:list", value: LocationTreeItem[]): void
    (e: "select", id: string): void
    (e: "add-child", parentId: string): void
    (e: "delete", id: string): void
}>();

function onUpdate(newList: LocationTreeItem[]) {
    emit("update:list", newList);
}

function handleSelect(id: string) {
    emit("select", id);
}
</script>

<template>
    <draggable
        :list="props.list"
        @update:list="onUpdate"
        group="locations"
        item-key="id"
        class="tree-draggable"
        handle=".drag-handle"
    >
        <template #item="{ element }">
            <div class="tree-node-wrapper">
                <div class="tree-node" :class="{ selected: selectedId === element.id }"
                     @click="handleSelect(element.id)">
                    <div class="drag-handle">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M4 3h4M4 6h4M4 9h4" stroke="currentColor" stroke-width="1.5"
                                  stroke-linecap="round"/>
                        </svg>
                    </div>
                    <span class="node-name">{{ element.name }}</span>
                    <div class="node-actions" @click.stop>
                        <button class="action-btn" :title="t('locations.addChild')"
                                @click="$emit('add-child', element.id)">+
                        </button>
                        <button class="action-btn danger" :title="t('locations.deleteLocation')"
                                @click="$emit('delete', element.id)">×
                        </button>
                    </div>
                </div>

                <!-- Recursive children -->
                <div class="tree-children">
                    <LocationSidebarTree
                        :list="element.children"
                        @update:list="element.children = $event; onUpdate(props.list)"
                        :selectedId="selectedId"
                        @select="handleSelect"
                        @add-child="$emit('add-child', $event)"
                        @delete="$emit('delete', $event)"
                    />
                </div>
            </div>
        </template>
    </draggable>
</template>

<style scoped>
.tree-draggable {
    min-height: 10px; /* Allows dropping into empty lists */
}

.tree-node-wrapper {
    display: flex;
    flex-direction: column;
}

.tree-node {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    margin-bottom: 2px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    transition: all 0.15s;
}

.tree-node:hover {
    background: rgba(255, 255, 255, 0.04);
}

.tree-node.selected {
    background: rgba(100, 108, 255, 0.15);
    box-shadow: inset 2px 0 0 #a5b4fc;
}

.drag-handle {
    cursor: grab;
    color: #555;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    opacity: 0.3;
    transition: opacity 0.2s;
}

.tree-node:hover .drag-handle {
    opacity: 1;
}

.drag-handle:active {
    cursor: grabbing;
}

.node-name {
    flex: 1;
    font-size: 13px;
    color: #d0d0d0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tree-node.selected .node-name {
    color: #fff;
    font-weight: 500;
}

.node-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.2s;
}

.tree-node:hover .node-actions {
    opacity: 1;
}

.action-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    line-height: 1;
    padding: 0;
    transition: all 0.15s;
}

.action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #eee;
}

.action-btn.danger:hover {
    background: rgba(255, 50, 50, 0.2);
    color: #ff8888;
}

.tree-children {
    padding-left: 18px;
    border-left: 1px solid rgba(255, 255, 255, 0.05);
    margin-left: 14px;
}
</style>
