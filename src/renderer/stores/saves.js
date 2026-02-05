import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { extractCharacterDataDelta, createCharacterDefaults } from '../utils/saveGameUtils'

export const useSavesStore = defineStore('saves', () => {
  const saves = ref(new Map()) // Map<slotNumber, saveData>
  const currentSlotNumber = ref(null)
  const pendingLoad = ref(null)
  const characterDefaults = ref({}) // Сохраняем дефолтные значения персонажей

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

  // Deep clone an object ensuring it's JSON-serializable
  const deepClone = (obj) => {
    try {
      return JSON.parse(JSON.stringify(obj))
    } catch (err) {
      console.warn('Failed to deep clone object:', err)
      return obj
    }
  }

  // Сохраняем дефолтные значения персонажей (нужно вызвать один раз при загрузке персонажей)
  const setCharacterDefaults = (characterData) => {
    characterDefaults.value = createCharacterDefaults(characterData)
    console.log('✔ Character defaults set:', Object.keys(characterDefaults.value))
  }

  // Serialize game state for saving (store only essential data, load story from disk on restore)
  // Теперь сохраняем только дельту (изменения от дефолтов)
  const serializeGameState = (gameState) => {
    // Извлекаем только измененные значения из characterData
    const characterDataDelta = extractCharacterDataDelta(
      gameState.characterData,
      characterDefaults.value
    )

    return {
      storyId: gameState.storyData?.id || 'start',  // Only store story ID, not full data
      stepIndex: gameState.stepIndex,
      callStack: deepClone(gameState.callStack),
      globalData: deepClone(gameState.globalData),
      characterDataDelta: characterDataDelta,  // Теперь только дельта
      visibleCharacters: deepClone(gameState.visibleCharacters),
      currentScene: gameState.currentScene,
    }
  }

  // Create a save file with metadata
  const createSaveFile = (slotNumber, gameState, mcName) => {
    const now = new Date()
    return {
      slot: slotNumber,
      timestamp: now.getTime(),
      timestampFormatted: formatTimestamp(now),
      mcName: mcName || 'Unknown',
      gameState: serializeGameState(gameState),
    }
  }

  // Save game state to slot
  const saveGame = async (slotNumber, gameState, mcName) => {
    try {
      const saveFile = createSaveFile(slotNumber, gameState, mcName)

      // Diagnostic: ensure saveFile is cloneable / serializable before IPC
      function findNonSerializable(obj, path = '') {
        const visited = new Set()
        function helper(o, p) {
          if (o === null || typeof o !== 'object') {
            try {
              if (typeof structuredClone === 'function') structuredClone(o)
              else JSON.stringify(o)
              return null
            } catch (e) {
              return { path: p || '[root]', error: e }
            }
          }
          if (visited.has(o)) return null
          visited.add(o)
          try {
            if (typeof structuredClone === 'function') structuredClone(o)
            else JSON.stringify(o)
            return null
          } catch (err) {
            // Try to inspect children
            for (const key of Object.keys(o)) {
              const val = o[key]
              const subPath = p ? `${p}.${key}` : key
              try {
                if (typeof structuredClone === 'function') structuredClone(val)
                else JSON.stringify(val)
              } catch (e2) {
                if (val && typeof val === 'object') {
                  const found = helper(val, subPath)
                  if (found) return found
                } else {
                  return { path: subPath, error: e2 }
                }
              }
            }
            return { path: p || '[root]', error: err }
          }
        }
        return helper(obj, path)
      }

      const nonSerial = findNonSerializable(saveFile)
      if (nonSerial) {
        console.error('Save file is NOT serializable/cloneable:', nonSerial.error)
        console.error('Problematic path inside save file:', nonSerial.path)
        // Log top-level property types for quick inspection
        for (const key of Object.keys(saveFile)) {
          const val = saveFile[key]
          console.log(`saveFile property: ${key} - type: ${typeof val} - constructor: ${val && val.constructor ? val.constructor.name : 'n/a'}`)
        }
        return { success: false, error: `Save file not serializable, problematic path: ${nonSerial.path}` }
      }

      const result = await window.api.saveGame(slotNumber, saveFile)

      if (result.success) {
        saves.value.set(slotNumber, saveFile)
        currentSlotNumber.value = slotNumber
        console.log('✔ Save added to store, slot:', slotNumber)
        console.log('✔ Saves map now contains:', Array.from(saves.value.keys()))
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
        // update pendingLoad for consumers that navigate to game
        pendingLoad.value = saveFile
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
      console.log('listSaves IPC result:', result)

      if (result.success) {
        saves.value.clear()
        result.data.forEach((saveFile) => {
          console.log('Loading save from disk - slot:', saveFile.slot, 'mcName:', saveFile.mcName)
          saves.value.set(saveFile.slot, saveFile)
        })
        console.log('✔ Saves list updated, total:', saves.value.size)
        console.log('✔ Saves map keys:', Array.from(saves.value.keys()))
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

  const getPendingLoad = () => pendingLoad.value
  const takePendingLoad = () => {
    const val = pendingLoad.value
    pendingLoad.value = null
    return val
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
    setCharacterDefaults,
    pendingLoad,
    getPendingLoad,
    takePendingLoad,
  }
})
