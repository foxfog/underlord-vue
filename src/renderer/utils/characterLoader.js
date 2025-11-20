/**
 * Utility functions for loading and managing character data
 */

// Cache for loaded characters
let characterCache = {}
let allCharactersCache = {}

/**
 * Check if we're running in Electron
 * @returns {boolean}
 */
function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * Initialize character data (does not preload, just sets up)
 * @returns {Promise<void>}
 */
export async function initCharacterData() {
  // No preloading needed, characters will be loaded on demand
  // This function exists to maintain API compatibility
  return Promise.resolve()
}

/**
 * Preload specific character data
 * @param {string[]} characterIds - Array of character IDs to preload
 * @returns {Promise<void>}
 */
export async function preloadCharacterData(characterIds = ['mc']) {
  try {
    // Preload specified characters
    const loadPromises = characterIds.map(id => loadCharacterById(id))
    await Promise.all(loadPromises)
    
    // Populate allCharactersCache with loaded characters
    allCharactersCache = {}
    for (const id of characterIds) {
      if (characterCache[id]) {
        allCharactersCache[id] = characterCache[id]
      }
    }
  } catch (error) {
    console.error('Failed to preload character data:', error)
  }
}

/**
 * Load a specific character by ID
 * @param {string} id - The ID of the character to load
 * @returns {Promise<Object|null>} The character data or null if not found
 */
export async function loadCharacterById(id) {
  try {
    // Check if already cached
    if (characterCache[id]) {
      return characterCache[id]
    }
    
    let characterData = null
    
    // Try to load using Electron IPC if available
    if (isElectron() && window.electronAPI.loadCharacter) {
      try {
        characterData = await window.electronAPI.loadCharacter(id);
      } catch (error) {
        console.warn(`Failed to load character ${id} via IPC, trying fetch:`, error);
      }
    }
    
    // Fallback to fetch for web/dev environments
    if (!characterData) {
      try {
        const response = await fetch(`/data/characters/${id}.json`)
        if (!response.ok) {
          console.warn(`Character ${id} not found via fetch at /data/characters/${id}.json. Status: ${response.status}`);
          return null;
        }
        const jsonData = await response.json()
        // Extract the character data (the JSON has the character ID as the key)
        characterData = jsonData[id] || jsonData
      } catch (error) {
        console.warn(`Failed to load character data for ${id} via fetch:`, error)
        return null
      }
    }
    
    characterCache[id] = characterData
    // Also add to allCharactersCache if it's not already there
    if (!allCharactersCache[id]) {
      allCharactersCache[id] = characterData
    }
    return characterData
  } catch (error) {
    console.error(`Failed to load character data for ${id}:`, error)
    return null
  }
}

/**
 * Get character data by ID (synchronous access to cached data)
 * @param {string} id - The ID of the character to retrieve
 * @returns {Object|null} The character data or null if not found
 */
export function getCharacterById(id) {
  // Return cached data if available
  if (characterCache[id]) {
    return characterCache[id]
  }
  
  // If not cached, return null
  return null
}

/**
 * Get character data by ID, loading it if necessary
 * @param {string} id - The ID of the character to retrieve
 * @returns {Promise<Object|null>} The character data or null if not found
 */
export async function getCharacterByIdAsync(id) {
  // Return cached data if available
  if (characterCache[id]) {
    return characterCache[id]
  }
  
  // Load the character data
  return await loadCharacterById(id)
}

/**
 * Get all characters (synchronous access to cached data)
 * @returns {Object} All character data keyed by ID
 */
export function getAllCharacters() {
  return allCharactersCache
}

/**
 * Get character image path by ID
 * @param {string} id - The ID of the character
 * @returns {string|null} The image path or null if not found
 */
export function getCharacterImagePath(id) {
  const characterData = getCharacterById(id)
  if (characterData && characterData.tile && characterData.tile.front && characterData.tile.front.body && characterData.tile.front.body.torso) {
    return characterData.tile.front.body.torso
  }
  return null
}

export default {
  getCharacterById,
  getCharacterByIdAsync,
  getAllCharacters,
  initCharacterData,
  preloadCharacterData,
  loadCharacterById,
  getCharacterImagePath
}