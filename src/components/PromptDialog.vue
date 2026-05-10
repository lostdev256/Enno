<script setup lang="ts">
import {ref, watch, nextTick} from "vue";
import {useI18n} from "vue-i18n";

const {t} = useI18n();

const props = defineProps<{
    visible: boolean
    title: string
    placeholder?: string
    initialValue?: string
}>();

const emit = defineEmits<{
    (e: "confirm", value: string): void
    (e: "cancel"): void
}>();

const inputValue = ref(props.initialValue || "");
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.visible, (val) => {
    if (val) {
        inputValue.value = props.initialValue || "";
        nextTick(() => {
            inputRef.value?.focus();
            inputRef.value?.select();
        });
    }
});

function confirm() {
    const trimmed = inputValue.value.trim();
    if (trimmed) {
        emit("confirm", trimmed);
    }
}

function cancel() {
    emit("cancel");
}

function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") cancel();
}
</script>

<template>
    <Teleport to="body">
        <Transition name="prompt">
            <div v-if="visible" class="prompt-overlay" @click.self="cancel" @keydown="onKeyDown">
                <div class="prompt-dialog">
                    <div class="prompt-title">{{ title }}</div>
                    <input
                        ref="inputRef"
                        v-model="inputValue"
                        class="prompt-input"
                        :placeholder="placeholder || ''"
                        @keydown.enter="confirm"
                        @keydown.escape="cancel"
                    />
                    <div class="prompt-actions">
                        <button class="prompt-btn prompt-cancel" @click="cancel">{{ t("shared.cancel") }}</button>
                        <button class="prompt-btn prompt-confirm" @click="confirm" :disabled="!inputValue.trim()">
                            {{ t("shared.confirm") }}
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.prompt-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(4px);
    z-index: 9000;
    display: flex;
    align-items: center;
    justify-content: center;
}

.prompt-dialog {
    background: #2a2a32;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px 24px;
    min-width: 340px;
    max-width: 440px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
}

.prompt-title {
    font-size: 14px;
    font-weight: 600;
    color: #d0d0e0;
    margin-bottom: 12px;
}

.prompt-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 10px 14px;
    color: #e0e0f0;
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
}

.prompt-input:focus {
    border-color: #818cf8;
    box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.12);
}

.prompt-input::placeholder {
    color: #555;
}

.prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
}

.prompt-btn {
    padding: 7px 18px;
    border-radius: 7px;
    font-size: 13px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
}

.prompt-cancel {
    background: rgba(255, 255, 255, 0.06);
    color: #999;
    border-color: rgba(255, 255, 255, 0.08);
}

.prompt-cancel:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ccc;
}

.prompt-confirm {
    background: rgba(100, 108, 255, 0.2);
    color: #a5b4fc;
    border-color: rgba(100, 108, 255, 0.3);
}

.prompt-confirm:hover:not(:disabled) {
    background: rgba(100, 108, 255, 0.3);
    color: #c7d2fe;
}

.prompt-confirm:disabled {
    opacity: 0.4;
    cursor: default;
}

/* Transition */
.prompt-enter-active {
    transition: opacity 0.15s ease;
}

.prompt-enter-active .prompt-dialog {
    transition: transform 0.15s ease, opacity 0.15s ease;
}

.prompt-leave-active {
    transition: opacity 0.1s ease;
}

.prompt-enter-from {
    opacity: 0;
}

.prompt-enter-from .prompt-dialog {
    transform: scale(0.95);
    opacity: 0;
}

.prompt-leave-to {
    opacity: 0;
}
</style>
