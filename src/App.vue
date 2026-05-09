<script setup lang="ts">
import MenuBar from "./components/MenuBar.vue";
import CharacterCards from "./components/CharacterCards.vue";
import CharacterLinks from "./components/CharacterLinks.vue";
import LocationsMap from "./components/LocationsMap.vue";
import ScenesPage from "./components/ScenesPage.vue";
import StorylinePage from "./components/StorylinePage.vue";
import QuestsPage from "./components/QuestsPage.vue";
import SettingsWindow from "./components/SettingsWindow.vue";
import {ref, onMounted} from "vue";
import {useI18n} from "vue-i18n";

type PageName =
    "welcome"
    | "characters-cards"
    | "characters-links"
    | "locations-map"
    | "scenes-editor"
    | "scenes-storyline"
    | "quests-cards"

const currentPage = ref<PageName>("welcome");
const projectOpen = ref(false);
const projectName = ref<string | null>(null);
const targetSceneId = ref<string | null>(null);
const showSettings = ref(false);

const {t} = useI18n();

function handleOpenScene(id: string) {
    targetSceneId.value = id;
    currentPage.value = "scenes-editor";
}

onMounted(() => {
    // Listen for project state changes from backend
    window.ennoAPI.onProjectStateChange((state) => {
        projectOpen.value = state.isOpen;
        projectName.value = state.projectName;

        // If project just opened and we're on welcome, stay — user navigates via menu
        // If project closed, go back to welcome
        if (!state.isOpen) {
            currentPage.value = "welcome";
        }
    });

    // Listen for menu actions from the native Electron menu
    window.ennoAPI.onMenuAction((action: string) => {
        console.log(`[App] Received menu action: ${action}`);

        switch (action) {
            // File actions — delegate to IPC
            case "file:create":
                window.ennoAPI.createProject();
                break;
            case "file:open":
                window.ennoAPI.openProject();
                break;
            case "file:save":
                window.ennoAPI.saveProject();
                break;
            case "file:save-as":
                window.ennoAPI.saveProjectAs();
                break;

            // Navigation actions
            case "characters:cards":
                if (projectOpen.value) currentPage.value = "characters-cards";
                break;
            case "characters:links":
                if (projectOpen.value) currentPage.value = "characters-links";
                break;
            case "locations:map":
                if (projectOpen.value) currentPage.value = "locations-map";
                break;
            case "scenes:editor":
                if (projectOpen.value) currentPage.value = "scenes-editor";
                break;
            case "scenes:storyline":
                if (projectOpen.value) currentPage.value = "scenes-storyline";
                break;
            case "quests:cards":
                if (projectOpen.value) currentPage.value = "quests-cards";
                break;

            default:
                window.ennoAPI.invokeMenuAction(action);
        }
    });
});

function handleNavigate(page: string) {
    // File actions from MenuBar
    if (page.startsWith("file:")) return; // handled via IPC above

    if (!projectOpen.value && page !== "welcome") {
        return; // Can't navigate to data pages without a project
    }
    currentPage.value = page as PageName;
}

function createProject() {
    window.ennoAPI.createProject();
}

function openProject() {
    window.ennoAPI.openProject();
}
</script>

<template>
    <div id="app-root">
        <MenuBar @navigate="handleNavigate" @open-settings="showSettings = true"/>
        <SettingsWindow :is-open="showSettings" @close="showSettings = false"/>
        <main class="app-content">
            <!-- Welcome -->
            <div v-if="currentPage === 'welcome'" class="welcome-area">
                <h1 class="app-title">{{ t("app.title") }}</h1>
                <p class="app-subtitle">{{ t("app.subtitle") }}</p>

                <div v-if="!projectOpen" class="welcome-actions">
                    <button class="welcome-btn primary" @click="createProject">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M9 3v12M3 9h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                        {{ t("app.createProject") }}
                    </button>
                    <button class="welcome-btn" @click="openProject">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <path d="M3 7V5a2 2 0 012-2h3l2 2h3a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                                  stroke-linejoin="round"/>
                        </svg>
                        {{ t("app.openProject") }}
                    </button>
                </div>

                <p v-else class="app-hint">
                    {{ t("app.hintPrefix") }}<strong>{{ projectName }}</strong>{{ t("app.hintSuffix") }}
                </p>
            </div>

            <!-- Characters: Cards -->
            <CharacterCards v-else-if="currentPage === 'characters-cards'"/>

            <!-- Characters: Links -->
            <CharacterLinks v-else-if="currentPage === 'characters-links'"/>

            <!-- Locations: Map -->
            <LocationsMap v-else-if="currentPage === 'locations-map'"/>

            <!-- Scenes: Editor -->
            <ScenesPage v-else-if="currentPage === 'scenes-editor'" :initial-scene-id="targetSceneId"
                        @loaded="targetSceneId = null"/>

            <!-- Scenes: Storyline -->
            <StorylinePage v-else-if="currentPage === 'scenes-storyline'" @open-scene="handleOpenScene"/>

            <!-- Quests: Cards -->
            <QuestsPage v-else-if="currentPage === 'quests-cards'"/>
        </main>
    </div>
</template>

<style scoped>
#app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}

.app-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    background: radial-gradient(ellipse at 20% 50%, rgba(100, 108, 255, 0.04) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 50%, rgba(120, 80, 220, 0.03) 0%, transparent 60%),
    #1a1a1f;
}

.welcome-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    animation: fadeIn 0.6s ease-out;
}

.app-title {
    font-size: 3.5rem;
    font-weight: 800;
    letter-spacing: -1px;
    background: linear-gradient(135deg, #c0c0ff 0%, #a78bfa 50%, #818cf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 8px;
}

.app-subtitle {
    font-size: 1rem;
    color: #6b6b80;
    font-weight: 400;
    letter-spacing: 0.5px;
    margin: 0;
}

.app-hint {
    margin-top: 24px;
    color: #4a4a60;
    font-size: 13px;
}

.app-hint strong {
    color: #818cf8;
}

/* Welcome action buttons */
.welcome-actions {
    margin-top: 32px;
    display: flex;
    gap: 12px;
}

.welcome-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 22px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #999;
}

.welcome-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.12);
    color: #ccc;
}

.welcome-btn.primary {
    background: rgba(100, 108, 255, 0.15);
    border-color: rgba(100, 108, 255, 0.25);
    color: #a5b4fc;
}

.welcome-btn.primary:hover {
    background: rgba(100, 108, 255, 0.25);
    border-color: rgba(100, 108, 255, 0.4);
    color: #c7d2fe;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(12px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
