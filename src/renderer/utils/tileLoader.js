/**
 * Utility functions for loading and managing tile data
 */

// Dynamically import the tiles data
const tilesModules = import.meta.glob('../components/game/tiles/tiles.json', { eager: true, import: 'default' })
const tilesData = tilesModules['../components/game/tiles/tiles.json']

/**
 * Get tile data by ID
 * @param {string|number} id - The ID of the tile to retrieve
 * @returns {Object|null} The tile data or null if not found
 */
export function getTileById(id) {
  // Convert numeric IDs to strings since JSON keys are strings
  const stringId = typeof id === 'number' ? id.toString() : id;
  return tilesData.tiles[stringId] || null;
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
 * Get all tile data
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
  const stringId = typeof id === 'number' ? id.toString() : id;
  const tile = getTileById(stringId);
  return tile ? tile.image.url : null;
}

/**
 * Get tile dimensions by ID
 * @param {string|number} id - The ID of the tile
 * @returns {Object|null} The dimensions object or null if not found
 */
export function getTileDimensions(id) {
  const stringId = typeof id === 'number' ? id.toString() : id;
  const tile = getTileById(stringId);
  
  if (!tile) return null;
  
  // Return dimensions with default values
  return { 
    width: tile.image.width || "100%", 
    height: tile.image.height || "auto",
    top: tile.image.top || "0"
  };
}

/**
 * Get tile type by ID
 * @param {string|number} id - The ID of the tile
 * @returns {string|null} The type of the tile or null if not found
 */
export function getTileType(id) {
  const stringId = typeof id === 'number' ? id.toString() : id;
  const tile = getTileById(stringId);
  return tile ? tile.type : null;
}

/**
 * Get tile tags by ID
 * @param {string|number} id - The ID of the tile
 * @returns {Array|null} The tags of the tile or null if not found
 */
export function getTileTags(id) {
  const stringId = typeof id === 'number' ? id.toString() : id;
  const tile = getTileById(stringId);
  return tile ? tile.tags : null;
}

export default {
  getTileById,
  getTilesByTag,
  getAllTiles,
  getTileImageUrl,
  getTileDimensions,
  getTileType,
  getTileTags
}