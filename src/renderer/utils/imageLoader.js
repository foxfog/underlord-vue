/**
 * Utility functions for loading images in both development and production environments
 */

/**
 * Check if we're running in Electron
 * @returns {boolean}
 */
export function isElectron() {
  return typeof window !== 'undefined' && window.electronAPI
}

/**
 * Resolve image path for both development and production environments
 * @param {string} imagePath - The image path from JSON data (e.g., /images/tiles/grass-01.png)
 * @returns {string} The resolved image path
 */
export function resolveImagePath(imagePath) {
  // In Electron builds, we need to adjust the path
  if (isElectron()) {
    // For Electron, we can use relative paths
    // Remove the leading slash and prefix with ./ to make it relative
    if (imagePath.startsWith('/')) {
      return `.${imagePath}`
    }
    return imagePath
  }
  
  // In development, use the path as is
  return imagePath
}

export default {
  isElectron,
  resolveImagePath
}