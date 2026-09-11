import { describe, it, expect, beforeEach } from 'vitest'
import {
	normalizeSpriteName,
	buildAssetUrl,
	getCharacterSpriteCandidates,
	getTileSpritePath,
	getWallSpritePath,
	TILE_TEXTURE_MAP,
	clearSpriteCache
} from '../isometric/isoSprites'

describe('isoSprites', () => {
	beforeEach(() => {
		clearSpriteCache()
	})

	describe('normalizeSpriteName', () => {
		it('converts to lowercase and trims whitespace', () => {
			expect(normalizeSpriteName('  MC  ')).toBe('mc')
			expect(normalizeSpriteName('Grass ')).toBe('grass')
		})

		it('handles empty or null gracefully', () => {
			expect(normalizeSpriteName('')).toBe('')
			expect(normalizeSpriteName(null)).toBe('')
		})
	})

	describe('buildAssetUrl', () => {
		it('builds clean URL with single leading slash when window.__APP_BASE__ is not set', () => {
			const url = buildAssetUrl('images/sprites/test.png')
			expect(url).toBe('/images/sprites/test.png')
		})

		it('strips redundant leading slashes in relative path', () => {
			const url = buildAssetUrl('///images/sprites/test.png')
			expect(url).toBe('/images/sprites/test.png')
		})
	})

	describe('getCharacterSpriteCandidates', () => {
		it('returns candidate list with specific character first and char fallback second for mc', () => {
			const candidates = getCharacterSpriteCandidates('mc')
			expect(candidates).toEqual([
				'images/sprites/characters/mc/isometric/char.png',
				'images/sprites/characters/mc/icometric/char.png',
				'images/sprites/characters/char/isometric/char.png',
				'images/sprites/characters/char/icometric/char.png'
			])
		})

		it('returns candidate list for momonga with char fallback', () => {
			const candidates = getCharacterSpriteCandidates('momonga')
			expect(candidates).toEqual([
				'images/sprites/characters/momonga/isometric/char.png',
				'images/sprites/characters/momonga/icometric/char.png',
				'images/sprites/characters/char/isometric/char.png',
				'images/sprites/characters/char/icometric/char.png'
			])
		})

		it('returns char paths directly when characterId is char', () => {
			const candidates = getCharacterSpriteCandidates('char')
			expect(candidates).toEqual([
				'images/sprites/characters/char/isometric/char.png',
				'images/sprites/characters/char/icometric/char.png'
			])
		})

		it('defaults to mc when no character ID is provided', () => {
			const candidates = getCharacterSpriteCandidates()
			expect(candidates[0]).toContain('/mc/')
		})
	})

	describe('getTileSpritePath', () => {
		it('resolves grass tile sprite', () => {
			const path = getTileSpritePath({ type: 'grass' })
			expect(path).toBe('images/sprites/isometric/tiles/bot/grass.png')
		})

		it('resolves water / watter tile sprite', () => {
			expect(getTileSpritePath({ type: 'water' })).toBe(
				'images/sprites/isometric/tiles/bot/watter.png'
			)
			expect(getTileSpritePath({ type: 'watter' })).toBe(
				'images/sprites/isometric/tiles/bot/watter.png'
			)
		})

		it('resolves stone_terrace to slab sprite', () => {
			expect(getTileSpritePath({ type: 'stone_terrace' })).toBe(
				'images/sprites/isometric/tiles/bot/slab.png'
			)
		})

		it('resolves stairs to steps sprite', () => {
			expect(getTileSpritePath({ type: 'stairs' })).toBe(
				'images/sprites/isometric/tiles/bot/steps.png'
			)
		})

		it('resolves stone_wall tile to slab-cube sprite', () => {
			expect(getTileSpritePath({ type: 'stone_wall' })).toBe(
				'images/sprites/isometric/tiles/bot/slab-cube.png'
			)
		})

		it('prioritizes explicit tile.texture over tile.type', () => {
			const path = getTileSpritePath({ type: 'grass', texture: 'slab-cube-dark' })
			expect(path).toBe('images/sprites/isometric/tiles/bot/slab-cube-dark.png')
		})

		it('resolves steps-corner with Cyrillic or Latin spelling', () => {
			const pathLatin = getTileSpritePath({ texture: 'steps-corner' })
			expect(pathLatin).toContain('steps-')
			expect(pathLatin).toContain('png')
		})

		it('returns null for soil without texture', () => {
			expect(getTileSpritePath({ type: 'soil' })).toBeNull()
		})
	})

	describe('getWallSpritePath', () => {
		it('resolves NW wall sprite', () => {
			expect(getWallSpritePath('NW', { type: 'wood_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall.png'
			)
			expect(getWallSpritePath('NW', { type: 'stone_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-dark.png'
			)
		})

		it('resolves NE wall sprite', () => {
			expect(getWallSpritePath('NE', { type: 'wood_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-e.png'
			)
			expect(getWallSpritePath('NE', { type: 'stone_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-dark-e.png'
			)
		})

		it('resolves SE wall sprite', () => {
			expect(getWallSpritePath('SE', { type: 'wood_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-s.png'
			)
			expect(getWallSpritePath('SE', { type: 'stone_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-dark-s.png'
			)
		})

		it('resolves SW wall sprite', () => {
			expect(getWallSpritePath('SW', { type: 'wood_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-w.png'
			)
			expect(getWallSpritePath('SW', { type: 'stone_wall' })).toBe(
				'images/sprites/isometric/tiles/wall/wall-dark-w.png'
			)
		})

		it('resolves closed door and open door', () => {
			expect(getWallSpritePath('NE', { type: 'door', door: true, open: false })).toBe(
				'images/sprites/isometric/tiles/wall/door-e.png'
			)
			expect(getWallSpritePath('NE', { type: 'door', door: true, open: true })).toBe(
				'images/sprites/isometric/tiles/wall/door-e-open.png'
			)
		})

		it('returns null for fence to use vector fallback', () => {
			expect(getWallSpritePath('NW', { type: 'fence' })).toBeNull()
		})
	})
})
