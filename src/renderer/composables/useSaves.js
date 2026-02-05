import { computed } from 'vue'
import { useSavesStore } from '@/stores/saves'

export function useSaves() {
  const store = useSavesStore()

  const saves = computed(() => store.allSaves)
  const hasSave = (slot) => store.hasSave(slot)
  const getSave = (slot) => store.getSave(slot)

  return {
    saves,
    hasSave,
    getSave,
    listSaves: store.listSaves,
    saveGame: store.saveGame,
    loadGame: store.loadGame,
    deleteSave: store.deleteSave,
    setCharacterDefaults: store.setCharacterDefaults,
    pendingLoad: store.pendingLoad,
    getPendingLoad: store.getPendingLoad,
    takePendingLoad: store.takePendingLoad
  }
}
