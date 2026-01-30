import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSavesStore = defineStore('saves', () => {
  const saves = ref(new Map()) // Map<slotNumber, saveData>
  const currentSlotNumber = ref(null)

  // Format timestamp as YYYY-MM-DD_HHMMSS
  const formatTimestamp = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day}_${hours}${minutes}${seconds}`
  }

  // Serialize game state for saving
  const serializeGameState = (gameState) => {
    return {
      storyData: gameState.storyData,
      stepIndex: gameState.stepIndex,
      callStack: gameState.callStack,
      globalData: gameState.globalData,
      characterData: gameState.characterData,
      visibleCharacters: gameState.visibleCharacters,
      currentScene: gameState.currentScene,
    }
  }

  // Create a save file with metadata
  const createSaveFile = (gameState, mcName) => {
    const now = new Date()
    return {
      slot: currentSlotNumber.value,
      timestamp: now.getTime(),
      timestampFormatted: formatTimestamp(now),
      mcName: mcName || 'Unknown',
      gameState: serializeGameState(gameState),
    }
  }

  // Save game state to slot
  const saveGame = async (slotNumber, gameState, mcName) => {
    try {
      const saveFile = createSaveFile(gameState, mcName)
      const result = await window.api.saveGame(slotNumber, saveFile)

      if (result.success) {
        saves.value.set(slotNumber, saveFile)
        currentSlotNumber.value = slotNumber
        return { success: true, data: saveFile }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Failed to save game:', error)
      return { success: false, error: error.message }
    }
  }

  // Load game state from slot
  const loadGame = async (slotNumber) => {
    try {
      const result = await window.api.loadGame(slotNumber)

      if (result.success) {
        const saveFile = result.data
        saves.value.set(slotNumber, saveFile)
        currentSlotNumber.value = slotNumber
        return { success: true, data: saveFile }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Failed to load game:', error)
      return { success: false, error: error.message }
    }
  }

  // Delete save file
  const deleteSave = async (slotNumber) => {
    try {
      const result = await window.api.deleteSave(slotNumber)

      if (result.success) {
        saves.value.delete(slotNumber)
        if (currentSlotNumber.value === slotNumber) {
          currentSlotNumber.value = null
        }
        return { success: true }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Failed to delete save:', error)
      return { success: false, error: error.message }
    }
  }

  // List all saves
  const listSaves = async () => {
    try {
      const result = await window.api.listSaves()

      if (result.success) {
        saves.value.clear()
        result.data.forEach((saveFile) => {
          saves.value.set(saveFile.slot, saveFile)
        })
        return { success: true, data: Array.from(saves.value.values()) }
      } else {
        return { success: false, error: result.error }
      }
    } catch (error) {
      console.error('Failed to list saves:', error)
      return { success: false, error: error.message }
    }
  }

  // Get save by slot number
  const getSave = (slotNumber) => {
    return saves.value.get(slotNumber)
  }

  // Get all saves sorted by slot
  const allSaves = computed(() => {
    return Array.from(saves.value.values()).sort((a, b) => a.slot - b.slot)
  })

  // Check if slot has save
  const hasSave = (slotNumber) => {
    return saves.value.has(slotNumber)
  }

  return {
    saves,
    currentSlotNumber,
    saveGame,
    loadGame,
    deleteSave,
    listSaves,
    getSave,
    allSaves,
    hasSave,
    serializeGameState,
    createSaveFile,
  }
})
