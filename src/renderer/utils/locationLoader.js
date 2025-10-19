/**
 * Utility functions for loading and managing location data
 */

import { getObjectById } from './objectLoader.js'

// Dynamically import location data
const locationModules = import.meta.glob('../components/game/locations/*.json', { eager: true, import: 'default' })

/**
 * Get location data by ID
 * @param {string} id - The ID of the location to retrieve
 * @returns {Object|null} The location data or null if not found
 */
export function getLocationById(id) {
  const modulePath = `../components/game/locations/${id}.json`
  return locationModules[modulePath] || null
}

/**
 * Get all locations
 * @returns {Object} All location data keyed by ID
 */
export function getAllLocations() {
  const locations = {}
  for (const [path, data] of Object.entries(locationModules)) {
    const fileName = path.split('/').pop().replace('.json', '')
    locations[fileName] = data
  }
  return locations
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

export default {
  getLocationById,
  getAllLocations,
  getLocationTiles,
  getLocationObjects,
  getAllLocationObjects,
  getLocationSpawnPoints
}