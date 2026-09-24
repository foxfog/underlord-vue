/**
 * Isometric Sprite Manager
 * Handles caching, path resolution, character fallback chain, tile texture mapping,
 * and wall sprite selection for the 2.5D isometric engine.
 */

const imageCache = new Map()

// Normalize file names (e.g. replace Cyrillic 'с' with Latin 'c' or vice versa)
export function normalizeSpriteName(name) {
	if (!name) return ''
	return name.trim().toLowerCase()
}

/**
 * Returns the base path prefix for public assets.
 */
export function getAssetBasePath() {
	if (typeof window !== 'undefined' && window.__APP_BASE__) {
		return window.__APP_BASE__.endsWith('/')
			? window.__APP_BASE__
			: `${window.__APP_BASE__}/`
	}
	return '/'
}

/**
 * Builds a clean asset URL without double slashes.
 */
export function buildAssetUrl(relativePath) {
	const base = getAssetBasePath()
	const cleanRel = relativePath.replace(/^\/+/, '')
	return `${base}${cleanRel}`
}

/**
 * Synchronously retrieves a cached Image element or initiates its background loading.
 * Returns the HTMLImageElement if in browser environment, or null during SSR/Node tests without mock.
 */
const spriteLoadedListeners = new Set()

export function onSpriteLoaded(listener) {
	spriteLoadedListeners.add(listener)
	return () => spriteLoadedListeners.delete(listener)
}

function notifySpriteLoaded(url) {
	for (const listener of spriteLoadedListeners) {
		try {
			listener(url)
		} catch (e) {
			console.error(e)
		}
	}
}

export function loadSprite(src) {
	if (!src) return null
	const fullUrl = buildAssetUrl(src)

	if (imageCache.has(fullUrl)) {
		return imageCache.get(fullUrl)
	}

	if (typeof Image === 'undefined') {
		return null
	}

	const img = new Image()
	img.onload = () => notifySpriteLoaded(fullUrl)
	img.src = fullUrl
	imageCache.set(fullUrl, img)
	return img
}

export const CHARACTER_ALIASES = {
	ainz: 'momonga'
}

/**
 * Generates the prioritized candidate sprite paths for a given character ID.
 * Follows the fallback rule:
 * 1. Specific character (isometric or icometric)
 * 2. Alias character (e.g. ainz -> momonga)
 * 3. Default char fallback (isometric or icometric)
 *
 * @param {string} characterId - e.g. 'mc', 'momonga', 'ainz', 'char'
 * @param {Object} options
 * @param {boolean} [options.includeFallback=true]
 * @returns {string[]} List of relative asset paths in priority order
 */
export function getCharacterSpriteCandidates(characterId = 'mc', { includeFallback = true } = {}) {
	const id = normalizeSpriteName(characterId) || 'mc'
	const candidates = []

	// 1. Character specific paths
	if (id !== 'char') {
		candidates.push(`images/sprites/characters/${id}/isometric/char.png`)
		candidates.push(`images/sprites/characters/${id}/icometric/char.png`)

		const alias = CHARACTER_ALIASES[id]
		if (alias) {
			candidates.push(`images/sprites/characters/${alias}/isometric/char.png`)
			candidates.push(`images/sprites/characters/${alias}/icometric/char.png`)
		}
	}

	// 2. Default char fallback paths
	if (includeFallback) {
		candidates.push('images/sprites/characters/char/isometric/char.png')
		candidates.push('images/sprites/characters/char/icometric/char.png')
	}

	return candidates
}

/**
 * State tracking for character sprite resolution so fallback occurs smoothly.
 */
const resolvedCharacterUrls = new Map()

/**
 * Retrieves the best available character sprite Image object with automatic fallback.
 *
 * @param {string} characterId
 * @param {Object} [options]
 * @param {boolean} [options.allowFallback=true]
 * @returns {HTMLImageElement|null}
 */
export function resolveCharacterSprite(characterId = 'mc', { allowFallback = true } = {}) {
	const id = normalizeSpriteName(characterId) || 'mc'
	const cacheKey = `${id}_fb_${allowFallback}`

	// If already resolved to a working URL, return that image
	if (resolvedCharacterUrls.has(cacheKey)) {
		const cachedUrl = resolvedCharacterUrls.get(cacheKey)
		return cachedUrl ? loadSprite(cachedUrl) : null
	}

	const candidates = getCharacterSpriteCandidates(id, { includeFallback: allowFallback })

	for (const path of candidates) {
		const img = loadSprite(path)
		if (img && img.complete && img.naturalWidth > 0) {
			resolvedCharacterUrls.set(cacheKey, path)
			return img
		}
	}

	// If no candidate paths available (e.g. no fallback requested and character has no sprite)
	if (candidates.length === 0) {
		return null
	}

	const primaryPath = candidates[0]
	const primaryImg = loadSprite(primaryPath)

	if (primaryImg) {
		primaryImg.onload = () => {
			resolvedCharacterUrls.set(cacheKey, primaryPath)
			notifySpriteLoaded(primaryPath)
		}
		primaryImg.onerror = () => {
			// Find next fallback in chain
			for (let i = 1; i < candidates.length; i++) {
				const fallbackPath = candidates[i]
				const fallbackImg = loadSprite(fallbackPath)
				if (fallbackImg) {
					fallbackImg.onload = () => {
						resolvedCharacterUrls.set(cacheKey, fallbackPath)
						notifySpriteLoaded(fallbackPath)
					}
				}
			}
		}
	}

	return primaryImg
}


/**
 * Mapping of tile types to texture filenames in `images/sprites/isometric/tiles/bot/`.
 */
export const TILE_TEXTURE_MAP = {
	grass: 'grass',
	water: 'watter',
	watter: 'watter',
	soil: null, // Soil remains vector or custom texture
	stone_terrace: 'slab',
	stone_tile: 'slab',
	slab: 'slab',
	'slab-dark': 'slab-dark',
	'slab-cube': 'slab-cube',
	'slab-cube-dark': 'slab-cube-dark',
	'slab-flat': 'slab-flat',
	'slab-flat-dark': 'slab-flat-dark',
	'slab-half': 'slab-half',
	'slab-half-dark': 'slab-half-dark',
	stairs: 'steps',
	steps: 'steps',
	'steps-e': 'steps-e',
	'steps-dark': 'steps-dark',
	'steps-dark-e': 'steps-dark-e',
	'steps-half': 'steps-half',
	'steps-half-e': 'steps-half-e',
	'steps-half-dark': 'steps-half-dark',
	'steps-half-dark-e': 'steps-half-dark-e',
	'steps-corner': 'steps-сorner',
	'steps-corner-half': 'steps-сorner-half',
	'steps-corner-dark': 'steps-сorner-dark',
	'steps-corner-half-dark': 'steps-сorner-half-dark',
	step: 'step',
	'step-e': 'step-e',
	'step-dark': 'step-dark',
	'step-dark-e': 'step-dark-e',
	'step-corner': 'step-corner',
	'step-corner-dark': 'step-corner-dark',
	stone_wall: 'slab-cube'
}

/**
 * Resolves the relative sprite path for a floor tile.
 * Supports Cyrillic/Latin keyboard layout aliases.
 *
 * @param {Object} tile
 * @returns {string|null} Relative path or null if no sprite available
 */
export function getTileSpritePath(tile) {
	if (!tile) return null

	// Explicit texture takes precedence
	let textureKey = tile.texture || TILE_TEXTURE_MAP[tile.type] || null
	if (!textureKey) return null

	// Normalize key
	textureKey = normalizeSpriteName(textureKey)

	// Map Cyrillic / Latin variants if needed
	const resolvedKey = TILE_TEXTURE_MAP[textureKey] || textureKey

	return `images/sprites/isometric/tiles/bot/${resolvedKey}.png`
}

/**
 * Retrieves the loaded Image object for a floor tile.
 *
 * @param {Object} tile
 * @returns {HTMLImageElement|null}
 */
export function resolveTileSprite(tile) {
	const path = getTileSpritePath(tile)
	if (!path) return null
	return loadSprite(path)
}

/**
 * Resolves the relative sprite path for a wall quad on a specific edge.
 *
 * Edge mappings:
 * - NW: wall.png / wall-dark.png
 * - NE: wall-e.png / wall-dark-e.png (or door-e.png / door-e-open.png)
 * - SE: wall-s.png / wall-dark-s.png
 * - SW: wall-w.png / wall-dark-w.png
 *
 * @param {'NW'|'NE'|'SW'|'SE'} edge
 * @param {Object} wall
 * @returns {string|null} Relative path or null if no sprite available (e.g. fence)
 */
export function getWallSpritePath(edge, wall) {
	if (!wall) return null

	// Fences or special types can use vector fallback
	if (wall.type === 'fence') {
		return null
	}

	const isDark = wall.dark || wall.theme === 'dark' || wall.type === 'stone_wall'

	// Doors are placed on the NE edge in the asset pack
	if (wall.door) {
		return wall.open
			? 'images/sprites/isometric/tiles/wall/door-e-open.png'
			: 'images/sprites/isometric/tiles/wall/door-e.png'
	}

	switch (edge) {
		case 'W':
		case 'NW':
			return isDark
				? 'images/sprites/isometric/tiles/wall/wall-dark.png'
				: 'images/sprites/isometric/tiles/wall/wall.png'
		case 'N':
		case 'NE':
			return isDark
				? 'images/sprites/isometric/tiles/wall/wall-dark-e.png'
				: 'images/sprites/isometric/tiles/wall/wall-e.png'
		case 'E':
		case 'SE':
			return isDark
				? 'images/sprites/isometric/tiles/wall/wall-dark-s.png'
				: 'images/sprites/isometric/tiles/wall/wall-s.png'
		case 'S':
		case 'SW':
			return isDark
				? 'images/sprites/isometric/tiles/wall/wall-dark-w.png'
				: 'images/sprites/isometric/tiles/wall/wall-w.png'
		default:
			return null
	}
}

/**
 * Retrieves the loaded Image object for a wall on a specific edge.
 *
 * @param {'N'|'E'|'S'|'W'|'NW'|'NE'|'SW'|'SE'} edge
 * @param {Object} wall
 * @returns {HTMLImageElement|null}
 */
export function resolveWallSprite(edge, wall) {
	const path = getWallSpritePath(edge, wall)
	if (!path) return null
	return loadSprite(path)
}

/**
 * Clears the image cache (useful for testing or hot reload).
 */
export function clearSpriteCache() {
	imageCache.clear()
	resolvedCharacterUrls.clear()
}
