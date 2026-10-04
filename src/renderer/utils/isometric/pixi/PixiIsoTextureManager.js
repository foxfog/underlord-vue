/**
 * PixiJS Isometric Texture and Asset Manager
 *
 * Caches WebGL textures for tiles, walls, objects, and characters.
 * Preloads and converts assets into GPU-friendly textures for batch rendering.
 */

import { Texture } from 'pixi.js'
import {
	buildAssetUrl,
	getTileSpritePath,
	getWallSpritePath,
	getCharacterSpriteCandidates,
	normalizeSpriteName
} from '../isoSprites.js'

export class PixiIsoTextureManager {
	constructor() {
		// Cache of resolved relativeUrl -> PIXI.Texture
		this.textureCache = new Map()
		// Cache of character textures
		this.characterTextureCache = new Map()
	}

	/**
	 * Returns or creates a Pixi Texture from a relative asset path.
	 *
	 * @param {string} relativePath
	 * @returns {Texture|null}
	 */
	getTexture(relativePath) {
		if (!relativePath) return null
		if (this.textureCache.has(relativePath)) {
			return this.textureCache.get(relativePath)
		}

		const fullUrl = buildAssetUrl(relativePath)
		try {
			const texture = Texture.from(fullUrl)
			this.textureCache.set(relativePath, texture)
			return texture
		} catch (e) {
			console.warn('[PixiIsoTextureManager] Failed to create texture:', relativePath, e)
			return null
		}
	}

	/**
	 * Resolves texture for a floor tile.
	 *
	 * @param {Object} tile
	 * @returns {Texture|null}
	 */
	getTileTexture(tile) {
		const path = getTileSpritePath(tile)
		if (!path) return null
		return this.getTexture(path)
	}

	/**
	 * Resolves texture for an edge wall quad.
	 *
	 * @param {'NW'|'NE'|'SW'|'SE'} edge
	 * @param {Object} wall
	 * @returns {Texture|null}
	 */
	getWallTexture(edge, wall) {
		const path = getWallSpritePath(edge, wall)
		if (!path) return null
		return this.getTexture(path)
	}

	/**
	 * Resolves texture for an actor / character sprite.
	 *
	 * @param {string} characterId
	 * @returns {Texture|null}
	 */
	getCharacterTexture(characterId = 'mc') {
		const id = normalizeSpriteName(characterId) || 'mc'
		if (this.characterTextureCache.has(id)) {
			return this.characterTextureCache.get(id)
		}

		const candidates = getCharacterSpriteCandidates(id, { includeFallback: true })
		for (const path of candidates) {
			const tex = this.getTexture(path)
			if (tex) {
				this.characterTextureCache.set(id, tex)
				return tex
			}
		}

		return null
	}

	/**
	 * Clears texture caches and releases GPU memory.
	 */
	clear() {
		for (const texture of this.textureCache.values()) {
			try {
				texture.destroy(true)
			} catch (_) {}
		}
		this.textureCache.clear()
		this.characterTextureCache.clear()
	}
}
