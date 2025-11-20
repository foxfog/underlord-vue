/**
 * Utility functions for loading and managing object data
 */

import { resolveImagePath } from './imageLoader.js'

// Cache for loaded objects
let objectsData = { objects: {} }
let config = { objectFiles: ['objects.json'] }

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
 * Process object data to resolve image paths for Electron compatibility
 * @param {Object} objects - The objects data to process
 */
function processObjectImages(objects) {
  if (!objects) return objects;
  
  for (const objectId in objects) {
    const obj = objects[objectId];
    if (obj.image) {
      // Process main image URL
      if (obj.image.url) {
        obj.image.url = resolveImagePath(obj.image.url);
      }
      // Process open image URL (for doors/windows)
      if (obj.image['url-open']) {
        obj.image['url-open'] = resolveImagePath(obj.image['url-open']);
      }
    }
  }
  
  return objects;
}

/**
 * Preload all object data
 * @returns {Promise<void>}
 */
export async function preloadObjectData() {
  try {
    // Load configuration
    try {
      const configData = await loadTileFile('tiles-config.json')
      if (configData) {
        config = configData
      }
    } catch (error) {
      console.warn('Failed to load tiles configuration, using default:', error)
      config = { objectFiles: ['objects.json'] }
    }
    
    // Load objects from all configured files
    const objectFiles = config.objectFiles || ['objects.json']
    const mergedObjects = {}
    
    for (const fileName of objectFiles) {
      try {
        const module = await loadTileFile(fileName)
        if (module && module.objects) {
          // Process image paths for Electron compatibility
          processObjectImages(module.objects);
          Object.assign(mergedObjects, module.objects)
        }
      } catch (error) {
        console.error(`Failed to load object file ${fileName}:`, error)
      }
    }
    
    objectsData = { objects: mergedObjects }
  } catch (error) {
    console.error('Failed to preload objects data:', error)
    objectsData = { objects: {} }
  }
}

/**
 * Get object data by ID (synchronous access to cached data)
 * @param {string} id - The ID of the object to retrieve
 * @returns {Object|null} The object data or null if not found
 */
export function getObjectById(id) {
  return objectsData.objects[id] || null
}

/**
 * Get all objects (synchronous access to cached data)
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

/**
 * Get object image URL for open state by ID
 * @param {string} id - The ID of the object
 * @returns {string|null} The open image URL or null if not found
 */
export function getObjectOpenImageUrl(id) {
  const object = getObjectById(id)
  return object && object.image['url-open'] ? object.image['url-open'] : null
}

/**
 * Get object type by ID
 * @param {string} id - The ID of the object
 * @returns {string|null} The type of the object or null if not found
 */
export function getObjectType(id) {
  const object = getObjectById(id)
  return object ? object.type : null
}

/**
 * Get object tags by ID
 * @param {string} id - The ID of the object
 * @returns {Array|null} The tags of the object or null if not found
 */
export function getObjectTags(id) {
  const object = getObjectById(id)
  return object ? object.tags : null
}

/**
 * Get object status by ID
 * @param {string} id - The ID of the object
 * @returns {string|null} The status of the object or null if not found
 */
export function getObjectStatus(id) {
  const object = getObjectById(id)
  return object ? object.status : null
}

export default {
  getObjectById,
  getAllObjects,
  getObjectsByType,
  getObjectsByTag,
  getObjectImageUrl,
  getObjectOpenImageUrl,
  getObjectType,
  getObjectTags,
  getObjectStatus,
  preloadObjectData
}