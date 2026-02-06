import { extractCharacterDataDelta } from '../utils/saveGameUtils'

// Small helper to format timestamp as YYYY-MM-DD_HHMMSS
function formatTimestamp(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}`
}

function deepClone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (err) {
    console.warn('saveService.deepClone failed:', err)
    return obj
  }
}

// Remove Vue-specific attributes from HTML strings (data-v-*, __v_*, etc)
function cleanHTMLFromVueAttributes(html) {
  if (!html || typeof html !== 'string') return html
  // Remove data-v-* attributes and other Vue internals
  return html
    .replace(/\s*data-v-[a-f0-9]{0,8}="[^"]*"/g, '')
    .replace(/\s*data-v-[a-f0-9]{0,8}[^\s>]*/g, '')
    .replace(/\s*__v[a-zA-Z0-9]*[^\s>]*/g, '')
}

// Returns problematic path if not serializable
export function findNonSerializable(obj, path = '') {
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

// Create a normalized save file object (serializable)
export function serializeGameState(gameState, characterDefaults = {}) {
  const characterDataDelta = extractCharacterDataDelta(
    gameState.characterData,
    characterDefaults
  )

  // Compact history to reduce save size: remove empty speaker and stepIndex, clean Vue attributes
  const rawHistory = deepClone(gameState.history || [])
  const compactHistory = rawHistory.map(entry => {
    const e = { ...entry }
    // Clean HTML from Vue attributes
    if (e.text && typeof e.text === 'string') {
      e.text = cleanHTMLFromVueAttributes(e.text)
    }
    if (e.speaker === '') delete e.speaker
    if (e.stepIndex !== undefined) delete e.stepIndex
    return e
  })

  const serialized = {
    storyId: gameState.storyData?.id || 'start',
    stepIndex: gameState.stepIndex,
    callStack: deepClone(gameState.callStack),
    globalData: deepClone(gameState.globalData),
    characterDataDelta,
    visibleCharacters: deepClone(gameState.visibleCharacters),
    currentScene: gameState.currentScene,
    history: compactHistory,
    audioStreams: deepClone(gameState.audioStreams || {})
  }
  console.log('💾 serializeGameState - audioStreams:', Object.keys(serialized.audioStreams))
  return serialized
}

export function createSaveFile(slotNumber, gameState, mcName, characterDefaults = {}) {
  const now = new Date()

  return {
    slot: slotNumber,
    timestamp: now.getTime(),
    timestampFormatted: formatTimestamp(now),
    mcName: mcName || 'Unknown',
    gameState: serializeGameState(gameState, characterDefaults)
  }
}

// IPC wrappers and helpers. Keep these tiny so they are easy to mock in tests.
export const saveService = {
  async saveGame(slotNumber, saveFile) {
    // Ensure serializable
    const nonSerial = findNonSerializable(saveFile)
    if (nonSerial) {
      return { success: false, error: `Save file not serializable: ${nonSerial.path}` }
    }

    try {
      console.log('💾 saveService.saveGame - audioStreams in saveFile:', Object.keys(saveFile.gameState.audioStreams || {}))
      const result = await window.api.saveGame(slotNumber, saveFile)
      return result
    } catch (err) {
      console.error('saveService.saveGame IPC failed:', err)
      return { success: false, error: err.message }
    }
  },

  async loadGame(slotNumber) {
    try {
      const result = await window.api.loadGame(slotNumber)
      return result
    } catch (err) {
      console.error('saveService.loadGame IPC failed:', err)
      return { success: false, error: err.message }
    }
  },

  async deleteSave(slotNumber) {
    try {
      const result = await window.api.deleteSave(slotNumber)
      return result
    } catch (err) {
      console.error('saveService.deleteSave IPC failed:', err)
      return { success: false, error: err.message }
    }
  },

  async listSaves() {
    try {
      const result = await window.api.listSaves()
      return result
    } catch (err) {
      console.error('saveService.listSaves IPC failed:', err)
      return { success: false, error: err.message }
    }
  }
}
