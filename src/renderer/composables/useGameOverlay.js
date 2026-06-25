import { ref } from 'vue'

export function useGameOverlay() {
  const menuVisible = ref(false)
  const currentView = ref('main-menu')
  const savesTab = ref('load')

  function showMainMenu() {
    menuVisible.value = true
    currentView.value = 'main-menu'
  }

  function openSettings() {
    menuVisible.value = true
    currentView.value = 'settings'
  }

  function openSave() {
    savesTab.value = 'save'
    menuVisible.value = true
    currentView.value = 'saves'
  }

  function openLoad() {
    savesTab.value = 'load'
    menuVisible.value = true
    currentView.value = 'saves'
  }

  function navigateImmediate(view) {
    switch (view) {
      case 'settings':
        openSettings()
        break
      case 'save':
        openSave()
        break
      case 'load':
        openLoad()
        break
      case 'saves':
        menuVisible.value = true
        currentView.value = 'saves'
        break
      case 'main-menu':
        showMainMenu()
        break
      case 'home-screen':
        // route navigation should be handled by the caller
        break
      default:
        console.warn('Unknown menu view:', view)
    }
  }

  function onSavesTabChange(tab) {
    savesTab.value = tab
  }

  return {
    menuVisible,
    currentView,
    savesTab,
    showMainMenu,
    openSettings,
    openSave,
    openLoad,
    navigateImmediate,
    onSavesTabChange
  }
}
