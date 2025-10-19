/**
 * Utility functions for loading and managing object data
 */

// Dynamically import object data
const objectModules = import.meta.glob('../components/game/tiles/objects.json', { eager: true, import: 'default' })
const objectsData = objectModules['../components/game/tiles/objects.json']

/**
 * Get object data by ID
 * @param {string} id - The ID of the object to retrieve
 * @returns {Object|null} The object data or null if not found
 */
export function getObjectById(id) {
  return objectsData.objects[id] || null
}

/**
 * Get all objects
 * @returns {Object} All object data
 */
export function getAllObjects() {
  return objectsData.objects
}

/**
 * Get objects by type
 * @param {string} type - The type of objects to filter by
 * @returns {Array} Array of objects with the specified type
 */
export function getObjectsByType(type) {
  return Object.entries(objectsData.objects)
    .filter(([id, obj]) => obj.type === type)
    .map(([id, obj]) => ({ id, ...obj }))
}

/**
 * Get objects by tag
 * @param {string} tag - The tag to filter by
 * @returns {Array} Array of objects with the specified tag
 */
export function getObjectsByTag(tag) {
  return Object.entries(objectsData.objects)
    .filter(([id, obj]) => obj.tags && obj.tags.includes(tag))
    .map(([id, obj]) => ({ id, ...obj }))
}

/**
 * Get object image URL by ID
 * @param {string} id - The ID of the object
 * @returns {string|null} The image URL or null if not found
 */
export function getObjectImageUrl(id) {
  const object = getObjectById(id)
  return object ? object.image.url : null
}

export default {
  getObjectById,
  getAllObjects,
  getObjectsByType,
  getObjectsByTag,
  getObjectImageUrl
}