<script setup lang="ts">
import {useI18n} from "vue-i18n";

defineProps<{
    isOpen: boolean
}>();

const emit = defineEmits<{
    (e: "close"): void
}>();

const {t, locale} = useI18n();

function changeLanguage(event: Event) {
    const target = event.target as HTMLSelectElement;
    const newLang = target.value;
    locale.value = newLang;
    localStorage.setItem("enno_lang", newLang);
}

function close() {
    emit("close");
}
</script>

<template>
    <div v-if="isOpen" class="settings-overlay" @click.self="close">
        <div class="settings-modal">
            <header class="settings-header">
                <h2>{{ t("settings.title") }}</h2>
                <button class="close-btn" @click="close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            </header>

            <div class="settings-content">
                <div class="settings-group">
                    <label for="language-select">{{ t("settings.language") }}</label>
                    <select id="language-select" class="form-select" :value="locale" @change="changeLanguage">
                        <option value="en">{{ t("settings.english") }}</option>
                        <option value="ru">{{ t("settings.russian") }}</option>
                    </select>
                </div>
            </div>

            <footer class="settings-footer">
                <button class="btn primary" @click="close">{{ t("settings.close") }}</button>
            </footer>
        </div>
    </div>
</template>

<style scoped>
.settings-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    animation: fadeIn 0.2s ease-out;
}

.settings-modal {
    background: #1e1e24;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.settings-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.settings-header h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: #e0e0e0;
}

.close-btn {
    background: none;
    border: none;
    color: #888;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}

.close-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
}

.settings-content {
    padding: 20px;
    flex: 1;
}

.settings-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.settings-group label {
    font-size: 13px;
    color: #a0a0b0;
    font-weight: 500;
}

.form-select {
    background: #2a2a32;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e0e0e0;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 14px;
    outline: none;
    transition: border-color 0.2s;
    appearance: none;
}

.form-select:focus {
    border-color: #646cff;
}

.settings-footer {
    padding: 16px 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    justify-content: flex-end;
}

.btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
}

.btn.primary {
    background: #646cff;
    color: white;
}

.btn.primary:hover {
    background: #747bff;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }
    to {
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        opacity: 0;
        transform: translateY(16px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
