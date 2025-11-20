/**
 * Utility functions for loading and managing location data
 */

import { getObjectById } from './objectLoader.js'

// Cache for loaded locations
let locationCache = {}
let allLocationsCache = {}

/**
 * Check if we're running in Electron
 * @returns {boolean}
 */
function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * Preload all location data
 * @returns {Promise<void>}
 */
export async function preloadLocationData() {
  try {
    let locationIds = ['mc-apartment']; // Default location
    
    // In Electron, we can list available locations
    if (isElectron()) {
      try {
        const locations = await window.electronAPI.listLocations()
        if (locations && locations.length > 0) {
          locationIds = locations
        }
      } catch (error) {
        console.warn('Could not list locations, using default:', error)
      }
    }
    
    // Preload all known locations
    const loadPromises = locationIds.map(id => loadLocationById(id))
    await Promise.all(loadPromises)
    
    // Populate allLocationsCache with loaded locations
    allLocationsCache = {}
    for (const id of locationIds) {
      if (locationCache[id]) {
        allLocationsCache[id] = locationCache[id]
      }
    }
  } catch (error) {
    console.error('Failed to preload location data:', error)
  }
}

/**
 * Load a specific location by ID
 * @param {string} id - The ID of the location to load
 * @returns {Promise<Object|null>} The location data or null if not found
 */
export async function loadLocationById(id) {
  try {
    // Check if already cached
    if (locationCache[id]) {
      return locationCache[id]
    }
    
    let locationData = null
    
    // In Electron, use IPC to read files directly
    if (isElectron()) {
      try {
        locationData = await window.electronAPI.loadLocation(id)
      } catch (error) {
        console.error(`Failed to load location ${id} via IPC:`, error)
      }
    }
    
    // Fallback to fetch for web/dev environments
    if (!locationData) {
      const response = await fetch(`/data/locations/${id}.json`)
      if (!response.ok) {
        return null
      }
      locationData = await response.json()
    }
    
    locationCache[id] = locationData
    // Also add to allLocationsCache if it's not already there
    if (!allLocationsCache[id]) {
      allLocationsCache[id] = locationData
    }
    return locationData
  } catch (error) {
    console.error(`Failed to load location data for ${id}:`, error)
    return null
  }
}

/**
 * Get location data by ID (synchronous access to cached data)
 * @param {string} id - The ID of the location to retrieve
 * @returns {Object|null} The location data or null if not found
 */
export function getLocationById(id) {
  // Return cached data if available
  if (locationCache[id]) {
    return locationCache[id]
  }
  
  // If not cached, return null (data should have been preloaded)
  return null
}

/**
 * Get all locations (synchronous access to cached data)
 * @returns {Object} All location data keyed by ID
 */
export function getAllLocations() {
  return allLocationsCache
}

/**
 * Get tile data for a specific location and level
 * @param {string} locationId - The ID of the location
 * @param {string} levelId - The ID of the level (default: 'level-1')
 * @returns {Array|null} Array of tile data or null if location/level not found
 */
export function getLocationTiles(locationId, levelId = 'level-1') {
  const location = getLocationById(locationId)
  if (!location || !location.levels || !location.levels[levelId]) return null
  return location.levels[levelId].floor
}

/**
 * Get objects in a specific location and level
 * @param {string} locationId - The ID of the location
 * @param {string} levelId - The ID of the level (default: 'level-1')
 * @returns {Array|null} Array of objects or null if location/level not found
 */
export function getLocationObjects(locationId, levelId = 'level-1') {
  const location = getLocationById(locationId)
  if (!location || !location.levels || !location.levels[levelId]) return null
  return location.levels[levelId].objects || []
}

/**
 * Get all objects including nested objects in a specific location and level with detailed data
 * @param {string} locationId - The ID of the location
 * @param {string} levelId - The ID of the level (default: 'level-1')
 * @returns {Array|null} Flattened array of all objects with detailed data or null if location/level not found
 */
export function getAllLocationObjects(locationId, levelId = 'level-1') {
  const objects = getLocationObjects(locationId, levelId)
  if (!objects) return null
  
  const allObjects = []
  
  function processObject(obj, parentPosition = null) {
    // Get detailed object data from objects.json
    const detailedObject = getObjectById(obj.id)
    if (detailedObject) {
      // Merge location-specific data with object template data
      const mergedObject = {
        ...detailedObject,
        ...obj,
        id: obj.id // Ensure the ID from location data is preserved
      }
      
      // If this is a contained object, inherit parent position
      if (parentPosition && !obj.position) {
        mergedObject.position = parentPosition
      }
      
      allObjects.push(mergedObject)
      
      if (obj.containedObjects && obj.containedObjects.length > 0) {
        // Pass down the position to contained objects
        const currentPosition = obj.position || parentPosition
        obj.containedObjects.forEach(child => processObject(child, currentPosition))
      }
    }
  }
  
  objects.forEach(obj => processObject(obj))
  return allObjects
}

/**
 * Get spawn points for a specific location
 * @param {string} locationId - The ID of the location
 * @returns {Array|null} Array of spawn points or null if location not found
 */
export function getLocationSpawnPoints(locationId) {
  const location = getLocationById(locationId)
  return location ? location.spawnPoints : null
}

/**
 * Get characters for a specific location
 * @param {string} locationId - The ID of the location
 * @returns {Array|null} Array of characters or null if location not found
 */
export function getLocationCharacters(locationId) {
  const location = getLocationById(locationId)
  return location ? location.characters : null
}

/**
 * Get character by ID in a specific location
 * @param {string} locationId - The ID of the location
 * @param {string} characterId - The ID of the character
 * @returns {Object|null} Character object or null if not found
 */
export function getLocationCharacterById(locationId, characterId) {
  const location = getLocationById(locationId)
  
  if (!location || !location.characters) {
    return null
  }
  
  return location.characters.find(char => char.id === characterId) || null
}

export default {
  getLocationById,
  getAllLocations,
  getLocationTiles,
  getLocationObjects,
  getAllLocationObjects,
  getLocationSpawnPoints,
  getLocationCharacters,
  getLocationCharacterById,
  preloadLocationData,
  loadLocationById
}