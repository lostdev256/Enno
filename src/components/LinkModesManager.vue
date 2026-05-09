<script setup lang="ts">
import {ref, watch} from "vue";
import {useI18n} from "vue-i18n";

interface LinkMode {
    id: string;
    name: string;
    maxLinksPerPair: number;
    dataType: "text" | "enum";
    settings: string;
    sortOrder: number;
}

interface EnumValue {
    id: string;
    label: string;
    color: string;
}

interface ModeSettings {
    lineType: "line" | "arrow" | "double_arrow";
    lineColor?: string;
    enumValues?: EnumValue[];
}

const props = defineProps<{
    visible: boolean
}>();

const emit = defineEmits<{
    (e: "close"): void
    (e: "changed"): void
}>();

const modes = ref<LinkMode[]>([]);
const selectedIndex = ref<number>(-1);
const {t} = useI18n();

// Form state
const formName = ref("");
const formMaxLinks = ref(1);
const formDataType = ref<"text" | "enum">("text");
const formLineType = ref<"line" | "arrow" | "double_arrow">("line");
const formLineColor = ref("#a5b4fc");
const formEnumValues = ref<EnumValue[]>([]);

async function loadModes() {
    const data = await window.ennoAPI.getBoardData();
    modes.value = data.modes;
    if (modes.value.length > 0 && selectedIndex.value === -1) {
        selectMode(0);
    }
}

watch(() => props.visible, (val) => {
    if (val) loadModes();
});

function selectMode(index: number) {
    selectedIndex.value = index;
    const mode = modes.value[index];
    if (!mode) return;

    formName.value = mode.name;
    formMaxLinks.value = mode.maxLinksPerPair;
    formDataType.value = mode.dataType;

    try {
        const s = JSON.parse(mode.settings) as ModeSettings;
        formLineType.value = s.lineType || "line";
        formLineColor.value = s.lineColor || "#a5b4fc";
        formEnumValues.value = s.enumValues || [];
    } catch {
        formLineType.value = "line";
        formLineColor.value = "#a5b4fc";
        formEnumValues.value = [];
    }
}

function addEnumValue() {
    formEnumValues.value.push({
        id: `val_${Date.now()}`,
        label: t("links.newValue"),
        color: "#888888"
    });
}

function removeEnumValue(index: number) {
    formEnumValues.value.splice(index, 1);
}

async function saveMode() {
    const mode = modes.value[selectedIndex.value];
    if (!mode) return;

    const settings: ModeSettings = {
        lineType: formLineType.value
    };
    if (formDataType.value === "text") {
        settings.lineColor = formLineColor.value;
    } else {
        settings.enumValues = formEnumValues.value;
    }

    await window.ennoAPI.updateLinkMode(
        mode.id,
        formName.value,
        formMaxLinks.value,
        formDataType.value,
        JSON.stringify(settings)
    );

    await loadModes();
    emit("changed");
}

async function createMode() {
    const settings: ModeSettings = {lineType: "line", lineColor: "#a5b4fc"};
    await window.ennoAPI.createLinkMode(t("links.newMode"), 1, "text", JSON.stringify(settings));
    await loadModes();
    selectMode(modes.value.length - 1);
    emit("changed");
}

async function deleteMode() {
    const mode = modes.value[selectedIndex.value];
    if (!mode) return;
    if (confirm(t("links.deleteModeConfirm"))) {
        await window.ennoAPI.deleteLinkMode(mode.id);
        selectedIndex.value = Math.max(0, selectedIndex.value - 1);
        await loadModes();
        emit("changed");
    }
}

// Drag to reorder
function moveUp() {
    if (selectedIndex.value <= 0) return;
    const ids = modes.value.map(m => m.id)
    ;[ids[selectedIndex.value - 1], ids[selectedIndex.value]] = [ids[selectedIndex.value], ids[selectedIndex.value - 1]];
    window.ennoAPI.reorderLinkModes(ids).then(() => {
        selectedIndex.value--;
        loadModes();
        emit("changed");
    });
}

function moveDown() {
    if (selectedIndex.value >= modes.value.length - 1 || selectedIndex.value < 0) return;
    const ids = modes.value.map(m => m.id)
    ;[ids[selectedIndex.value + 1], ids[selectedIndex.value]] = [ids[selectedIndex.value], ids[selectedIndex.value + 1]];
    window.ennoAPI.reorderLinkModes(ids).then(() => {
        selectedIndex.value++;
        loadModes();
        emit("changed");
    });
}
</script>

<template>
    <div v-if="visible" class="modal-overlay" @click="emit('close')">
        <div class="modal-container" @click.stop>
            <header class="modal-header">
                <h2>{{ t("links.manageModes") }}</h2>
                <button class="close-btn" @click="emit('close')">✕</button>
            </header>

            <div class="modal-body">
                <!-- Sidebar -->
                <div class="modes-sidebar">
                    <div class="modes-list">
                        <div
                            v-for="(mode, index) in modes"
                            :key="mode.id"
                            class="mode-item"
                            :class="{ active: index === selectedIndex }"
                            @click="selectMode(index)"
                        >
                            {{ mode.name }}
                        </div>
                    </div>
                    <div class="sidebar-actions">
                        <button class="action-btn" @click="createMode">+ {{ t("links.newMode") }}</button>
                        <div class="sort-actions" v-if="modes.length > 0">
                            <button class="icon-btn" @click="moveUp" :disabled="selectedIndex <= 0">↑</button>
                            <button class="icon-btn" @click="moveDown" :disabled="selectedIndex >= modes.length - 1">↓
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Editor -->
                <div class="mode-editor" v-if="modes.length > 0 && selectedIndex >= 0">
                    <div class="form-group">
                        <label>{{ t("links.modeName") }}</label>
                        <input type="text" v-model="formName" class="form-input"/>
                    </div>

                    <div class="form-row">
                        <div class="form-group">
                            <label>{{ t("links.dataType") }}</label>
                            <select v-model="formDataType" class="form-select">
                                <option value="text">{{ t("links.typeText") }}</option>
                                <option value="enum">{{ t("links.typeEnum") }}</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label title="0 means unlimited">{{ t("links.maxLinks") }}</label>
                            <input type="number" v-model="formMaxLinks" class="form-input" min="0"/>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>{{ t("links.lineType") }}</label>
                        <select v-model="formLineType" class="form-select">
                            <option value="line">{{ t("links.lineSimple") }}</option>
                            <option value="arrow">{{ t("links.lineArrow") }}</option>
                            <option value="double_arrow">{{ t("links.lineDoubleArrow") }}</option>
                        </select>
                    </div>

                    <!-- Text settings -->
                    <div class="settings-group" v-if="formDataType === 'text'">
                        <label>{{ t("links.lineColor") }}</label>
                        <div class="color-picker-row">
                            <input type="color" v-model="formLineColor" class="color-input"/>
                            <input type="text" v-model="formLineColor" class="form-input color-text"/>
                        </div>
                    </div>

                    <!-- Enum settings -->
                    <div class="settings-group" v-if="formDataType === 'enum'">
                        <label>{{ t("links.enumValues") }}</label>
                        <div class="enum-list">
                            <div v-for="(val, i) in formEnumValues" :key="val.id" class="enum-item">
                                <input type="color" v-model="val.color" class="color-input"/>
                                <input type="text" v-model="val.label" class="form-input"
                                       :placeholder="t('links.label')"/>
                                <button class="icon-btn danger" @click="removeEnumValue(i)">✕</button>
                            </div>
                        </div>
                        <button class="action-btn sm" @click="addEnumValue">+ {{ t("links.addValue") }}</button>
                    </div>

                    <div class="editor-actions">
                        <button class="action-btn danger" @click="deleteMode">{{ t("links.deleteMode") }}</button>
                        <div class="spacer"></div>
                        <button class="action-btn primary" @click="saveMode">{{ t("links.saveChanges") }}</button>
                    </div>
                </div>
                <div class="mode-editor empty" v-else>
                    <p>{{ t("links.createModeToEdit") }}</p>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-container {
    background: #1e1e24;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 700px;
    max-width: 90vw;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
    overflow: hidden;
}

.modal-header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(0, 0, 0, 0.2);
}

.modal-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
}

.close-btn {
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    font-size: 16px;
}

.close-btn:hover {
    color: #fff;
}

.modal-body {
    display: flex;
    flex: 1;
    min-height: 400px;
}

.modes-sidebar {
    width: 220px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    background: rgba(0, 0, 0, 0.1);
}

.modes-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.mode-item {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    color: #ccc;
    font-size: 14px;
    transition: all 0.2s;
}

.mode-item:hover {
    background: rgba(255, 255, 255, 0.04);
}

.mode-item.active {
    background: rgba(100, 108, 255, 0.15);
    color: #fff;
}

.sidebar-actions {
    padding: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.sort-actions {
    display: flex;
    gap: 4px;
    justify-content: center;
}

.mode-editor {
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.mode-editor.empty {
    align-items: center;
    justify-content: center;
    color: #666;
}

.form-row {
    display: flex;
    gap: 16px;
}

.form-row .form-group {
    flex: 1;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.form-group label {
    font-size: 13px;
    color: #888;
}

.form-input, .form-select {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #fff;
    padding: 8px 12px;
    border-radius: 6px;
    font-family: inherit;
    font-size: 14px;
    outline: none;
}

.form-input:focus, .form-select:focus {
    border-color: #646cff;
}

.settings-group {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    padding: 16px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.color-picker-row {
    display: flex;
    align-items: center;
    gap: 12px;
}

.color-input {
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
}

.color-text {
    width: 100px;
}

.enum-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.enum-item {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgba(0, 0, 0, 0.15);
    padding: 8px;
    border-radius: 6px;
}

.enum-item .form-input {
    flex: 1;
}

.editor-actions {
    margin-top: auto;
    padding-top: 20px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.spacer {
    flex: 1;
}

.action-btn {
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #ccc;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
}

.action-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.action-btn.sm {
    padding: 6px 12px;
    font-size: 12px;
}

.action-btn.primary {
    background: #646cff;
    border-color: #747bff;
    color: #fff;
}

.action-btn.primary:hover {
    background: #747bff;
}

.action-btn.danger {
    color: #ff6b6b;
    border-color: rgba(255, 107, 107, 0.2);
}

.action-btn.danger:hover {
    background: rgba(255, 107, 107, 0.1);
}

.icon-btn {
    background: rgba(255, 255, 255, 0.06);
    border: none;
    color: #aaa;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}

.icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
}

.icon-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}

.icon-btn.danger:hover {
    background: rgba(255, 107, 107, 0.15);
    color: #ff6b6b;
}
</style>
