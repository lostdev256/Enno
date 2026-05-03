<script setup lang="ts">
import MenuBar from './components/MenuBar.vue'
import CharacterCards from './components/CharacterCards.vue'
import { ref, onMounted } from 'vue'

type PageName = 'welcome' | 'characters-cards' | 'characters-links'

const currentPage = ref<PageName>('welcome')

onMounted(() => {
  // Listen for menu actions from the native Electron menu
  window.ennoAPI.onMenuAction((action: string) => {
    console.log(`[App] Received menu action: ${action}`)

    switch (action) {
      case 'characters:cards':
        currentPage.value = 'characters-cards'
        break
      case 'characters:links':
        currentPage.value = 'characters-links'
        break
      default:
        // Call the corresponding IPC handler for non-navigation actions
        window.ennoAPI.invokeMenuAction(action)
    }
  })
})
</script>

<template>
  <div id="app-root">
    <MenuBar @navigate="(page: string) => currentPage = page as PageName" />
    <main class="app-content">
      <!-- Welcome -->
      <div v-if="currentPage === 'welcome'" class="welcome-area">
        <h1 class="app-title">Enno</h1>
        <p class="app-subtitle">Character & Story Editor</p>
        <p class="app-hint">Open <strong>Characters → Cards</strong> to get started</p>
      </div>

      <!-- Characters: Cards -->
      <CharacterCards v-else-if="currentPage === 'characters-cards'" />

      <!-- Characters: Links (placeholder) -->
      <div v-else-if="currentPage === 'characters-links'" class="welcome-area">
        <h1 class="app-title" style="font-size: 2rem;">Links</h1>
        <p class="app-subtitle">Coming soon</p>
      </div>
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
  background:
    radial-gradient(ellipse at 20% 50%, rgba(100, 108, 255, 0.04) 0%, transparent 60%),
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
