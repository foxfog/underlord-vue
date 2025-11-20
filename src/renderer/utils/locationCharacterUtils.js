/**
 * Utility functions for working with characters in locations
 */

import { getLocationById } from './locationLoader.js'

/**
 * Get all characters in a location
 * @param {string} locationId - The ID of the location
 * @returns {Array|null} Array of characters or null if location not found
 */
export function getLocationCharacters(locationId) {
  const location = getLocationById(locationId)
  return location ? location.characters : null
}

/**
 * Get characters on a specific tile in a location
 * @param {string} locationId - The ID of the location
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {Array} Array of characters on the specified tile
 */
export function getCharactersOnTile(locationId, x, y) {
  const location = getLocationById(locationId)
  
  if (!location || !location.characters) {
    return []
  }
  
  // Filter characters that are on the specified tile
  return location.characters.filter(char => 
    char.cord && 
    char.cord[0] === x && 
    char.cord[1] === y
  )
}

/**
 * Get character by ID in a location
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

/**
 * Get all unique character IDs in a location
 * @param {string} locationId - The ID of the location
 * @returns {Array} Array of unique character IDs
 */
export function getUniqueCharacterIds(locationId) {
  const location = getLocationById(locationId)
  
  if (!location || !location.characters) {
    return []
  }
  
  const uniqueIds = new Set(location.characters.map(char => char.id))
  return Array.from(uniqueIds)
}

export default {
  getLocationCharacters,
  getCharactersOnTile,
  getLocationCharacterById,
  getUniqueCharacterIds
}