/**
 * Utility functions for loading and managing tile data
 */

import { resolveImagePath } from './imageLoader.js'

// Cache for loaded tiles
let tilesData = { tiles: {} }

/**
 * Check if we're running in Electron
 * @returns {boolean}
 */
function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * Load a file either using fetch (in browser/dev) or IPC (in Electron)
 * @param {string} fileName - The name of the file to load
 * @returns {Promise<Object|null>} The parsed JSON data or null if failed
 */
async function loadTileFile(fileName) {
  try {
    // In Electron, use IPC to read files directly
    if (isElectron()) {
      try {
        return await window.electronAPI.loadTileData(fileName)
      } catch (error) {
        console.error(`Failed to load ${fileName} via IPC:`, error)
      }
    }
    
    // Fallback to fetch for web/dev environments
    const response = await fetch(`/data/tiles/${fileName}`)
    if (!response.ok) {
      return null
    }
    return await response.json()
  } catch (error) {
    console.error(`Failed to load ${fileName}:`, error)
    return null
  }
}

/**
 * Preload tile data
 * @returns {Promise<void>}
 */
export async function preloadTileData() {
  try {
    const data = await loadTileFile('tiles.json')
    if (data) {
      // Process image paths for Electron compatibility
      if (data.tiles) {
        for (const tileId in data.tiles) {
          const tile = data.tiles[tileId]
          if (tile.image && tile.image.url) {
            tile.image.url = resolveImagePath(tile.image.url)
          }
        }
      }
      tilesData = data
    } else {
      throw new Error('Failed to load tiles data')
    }
  } catch (error) {
    console.error('Failed to preload tiles data:', error)
    tilesData = { tiles: {} }
  }
}

/**
 * Get tile data by ID (synchronous access to cached data)
 * @param {string|number} id - The ID of the tile to retrieve
 * @returns {Object|null} The tile data or null if not found
 */
export function getTileById(id) {
  // Convert numeric IDs to strings since JSON keys are strings
  const stringId = typeof id === 'number' ? id.toString() : id
  return tilesData.tiles[stringId] || null
}

/**
 * Get all tiles with a specific tag
 * @param {string} tag - The tag to filter by
 * @returns {Array} Array of tiles that have the specified tag
 */
export function getTilesByTag(tag) {
  return Object.values(tilesData.tiles).filter(tile => 
    tile.tags && tile.tags.includes(tag)
  )
}

/**
 * Get all tile data (synchronous access to cached data)
 * @returns {Object} All tile data
 */
export function getAllTiles() {
  return tilesData.tiles
}

/**
 * Get tile image URL by ID
 * @param {string|number} id - The ID of the tile
 * @returns {string|null} The image URL or null if not found
 */
export function getTileImageUrl(id) {
  const tile = getTileById(id)
  return tile ? tile.image.url : null
}

/**
 * Get tile dimensions by ID
 * @param {string|number} id - The ID of the tile
 * @returns {Object|null} The dimensions object or null if not found
 */
export function getTileDimensions(id) {
  const tile = getTileById(id)
  
  if (!tile) return null
  
  // Return dimensions with default values
  return { 
    width: tile.image.width || "100%", 
    height: tile.image.height || "auto",
    top: tile.image.top || "0"
  }
}

/**
 * Get tile type by ID
 * @param {string|number} id - The ID of the tile
 * @returns {string|null} The type of the tile or null if not found
 */
export function getTileType(id) {
  const tile = getTileById(id)
  return tile ? tile.type : null
}

/**
 * Get tile tags by ID
 * @param {string|number} id - The ID of the tile
 * @returns {Array|null} The tags of the tile or null if not found
 */
export function getTileTags(id) {
  const tile = getTileById(id)
  return tile ? tile.tags : null
}

export default {
  getTileById,
  getTilesByTag,
  getAllTiles,
  getTileImageUrl,
  getTileDimensions,
  getTileType,
  getTileTags,
  preloadTileData
}