/**
 * Isometric Location and Catalog Loader
 * Loads and caches tiles.json and objects.json, and normalizes location data
 * supporting both the multi-level prototype format (levels, cord, containedObjects, pos)
 * and the modern flat format (tiles, objects, children).
 */

import { buildAssetUrl } from './isoSprites.js'
import defaultTilesCatalog from '../../public/data/isometric/tiles.json'
import defaultObjectsCatalog from '../../public/data/isometric/objects.json'

let tilesCatalog = defaultTilesCatalog.tiles || {}
let objectsCatalog = defaultObjectsCatalog.objects || {}
let catalogLoaded = false

/**
 * Loads tiles and objects catalog files (via fetch in runtime or uses imported defaults).
 */
export async function loadCatalogs() {
	if (catalogLoaded) {
		return { tiles: tilesCatalog, objects: objectsCatalog }
	}

	try {
		const [tilesRes, objectsRes] = await Promise.all([
			fetch(buildAssetUrl('data/isometric/tiles.json')).catch(() => null),
			fetch(buildAssetUrl('data/isometric/objects.json')).catch(() => null)
		])

		if (tilesRes && tilesRes.ok) {
			const data = await tilesRes.json()
			if (data.tiles) tilesCatalog = data.tiles
		}

		if (objectsRes && objectsRes.ok) {
			const data = await objectsRes.json()
			if (data.objects) objectsCatalog = data.objects
		}
	} catch (e) {
		console.warn('Using bundled isometric catalogs fallback:', e)
	}

	catalogLoaded = true
	return { tiles: tilesCatalog, objects: objectsCatalog }
}

export function getTileCatalog() {
	return tilesCatalog
}

export function getObjectsCatalog() {
	return objectsCatalog
}

export function getTileDef(idOrKey) {
	if (idOrKey === undefined || idOrKey === null) return null
	const key = String(idOrKey)
	if (tilesCatalog[key]) return tilesCatalog[key]
	// Search by id property
	return Object.values(tilesCatalog).find((t) => t.id === key) || null
}

export function getObjectDef(idOrKey, type = null) {
	if (idOrKey !== undefined && idOrKey !== null) {
		const key = String(idOrKey)
		if (objectsCatalog[key]) return objectsCatalog[key]
		const byId = Object.values(objectsCatalog).find((o) => o.id === key)
		if (byId) return byId
	}
	if (type) {
		const typeKey = String(type)
		if (objectsCatalog[typeKey]) return objectsCatalog[typeKey]
		return Object.values(objectsCatalog).find((o) => o.type === typeKey) || null
	}
	return null
}

/**
 * Recursively normalizes child/contained objects.
 */
export function normalizeContainedObjects(containedList) {
	if (!Array.isArray(containedList) || containedList.length === 0) {
		return []
	}

	return containedList.map((item, idx) => {
		const def = getObjectDef(item.id, item.type)
		const children = normalizeContainedObjects(item.containedObjects || item.children)

		return {
			id: item.id || `obj_${idx}`,
			name: def?.name || item.name || item.id,
			type: def?.type || item.type || 'prop',
			icon: def?.icon || item.icon || '📦',
			solid: def?.solid !== undefined ? def.solid : item.solid,
			interactive: def?.interactive !== undefined ? def.interactive : item.interactive,
			action: def?.action || item.action,
			offsetX: item.offsetX || (item.pos ? item.pos[0] : 0),
			offsetY: item.offsetY || (item.pos ? item.pos[1] : 0),
			offsetZ: item.offsetZ || 0,
			zIndex: item.zIndex || idx + 1,
			children
		}
	})
}

/**
 * Normalizes location data from either:
 * 1. Prototype format:
 *    { dimensions: { width, height }, levels: { 'level-1': { floor: [[...]], objects: [...] } }, characters: [...] }
 * 2. Modern flat format:
 *    { tiles: [...], objects: [...], bounds: {...}, defaultSpawn: {...} }
 *
 * @param {Object} raw
 * @param {string} [activeLevelId='level-1']
 * @returns {Object} Normalized location data compatible with IsoCanvas and editor
 */
export function normalizeLocationData(raw, activeLevelId = 'level-1') {
	if (!raw) return null

	// Clone to avoid mutating original
	const data = JSON.parse(JSON.stringify(raw))

	let tiles = []
	let objects = []
	let characters = []

	// Case 1: Prototype format with `levels`
	if (data.levels && typeof data.levels === 'object') {
		const level = data.levels[activeLevelId] || Object.values(data.levels)[0] || {}

		// Flatten 2D or 1D floor array
		if (Array.isArray(level.floor)) {
			level.floor.forEach((row) => {
				if (Array.isArray(row)) {
					row.forEach((cell) => {
						const gx = cell.cord ? cell.cord[0] : cell.x
						const gy = cell.cord ? cell.cord[1] : cell.y
						const def = getTileDef(cell.id)
						tiles.push({
							x: gx,
							y: gy,
							z: cell.z || 0,
							id: cell.id,
							type: def?.id || cell.type || 'slab',
							texture: def?.id || cell.texture || null,
							walkable: def?.walkable !== undefined ? def.walkable : cell.walkable !== false,
							walls: cell.walls || {}
						})
					})
				} else if (row && typeof row === 'object') {
					const gx = row.cord ? row.cord[0] : row.x
					const gy = row.cord ? row.cord[1] : row.y
					const def = getTileDef(row.id)
					tiles.push({
						x: gx,
						y: gy,
						z: row.z || 0,
						id: row.id,
						type: def?.id || row.type || 'slab',
						texture: def?.id || row.texture || null,
						walkable: def?.walkable !== undefined ? def.walkable : row.walkable !== false,
						walls: row.walls || {}
					})
				}
			})
		}

		// Process objects
		if (Array.isArray(level.objects)) {
			level.objects.forEach((obj, idx) => {
				const gx = obj.cord ? obj.cord[0] : obj.x
				const gy = obj.cord ? obj.cord[1] : obj.y
				const def = getObjectDef(obj.id, obj.type)
				const children = normalizeContainedObjects(obj.containedObjects || obj.children)

				const isDoor = def?.type === 'door' || obj.id?.startsWith('door')
				const isWall = def?.type === 'wall' || obj.id?.startsWith('wall')
				const edge = def?.edge || obj.edge || (isDoor ? 'NE' : 'NW')

				// If object is a wall or door, attach to the corresponding tile's walls object
				if (isWall || isDoor) {
					const targetTile = tiles.find((t) => t.x === gx && t.y === gy)
					if (targetTile) {
						if (!targetTile.walls) targetTile.walls = {}
						targetTile.walls[edge] = {
							id: obj.id,
							type: isDoor ? 'door' : def?.type || 'stone_wall',
							door: isDoor,
							open: obj.status === 'open',
							solid: isDoor ? obj.status !== 'open' : true,
							height: 1.5,
							texture: obj.id
						}
					}
				}

				// Also keep as prop object if it is furniture or prop
				if (!isWall && !isDoor) {
					objects.push({
						id: obj.id || `obj_${idx}`,
						name: def?.name || obj.name || obj.id,
						type: def?.type || obj.type || 'prop',
						x: gx,
						y: gy,
						z: obj.z || 0,
						icon: def?.icon || obj.icon || '📦',
						solid: def?.solid !== undefined ? def.solid : obj.solid !== false,
						interactive: def?.interactive !== undefined ? def.interactive : Boolean(obj.interactive),
						action: def?.action || obj.action,
						offsetX: obj.offsetX || (obj.pos ? obj.pos[0] : 0),
						offsetY: obj.offsetY || (obj.pos ? obj.pos[1] : 0),
						offsetZ: obj.offsetZ || 0,
						children
					})
				}
			})
		}
	} else if (Array.isArray(data.tiles)) {
		// Case 2: Modern flat format
		tiles = data.tiles.map((t) => {
			const gx = t.cord ? t.cord[0] : t.x
			const gy = t.cord ? t.cord[1] : t.y
			const def = getTileDef(t.id || t.type || t.texture)
			return {
				...t,
				x: gx,
				y: gy,
				z: t.z || 0,
				type: t.type || def?.id || 'grass',
				texture: t.texture || def?.id || null,
				walkable: def?.walkable !== undefined ? def.walkable : t.walkable !== false
			}
		})

		if (Array.isArray(data.objects)) {
			objects = data.objects.map((obj, idx) => {
				const gx = obj.cord ? obj.cord[0] : obj.x
				const gy = obj.cord ? obj.cord[1] : obj.y
				const def = getObjectDef(obj.id, obj.type)
				const children = normalizeContainedObjects(obj.containedObjects || obj.children)
				return {
					...obj,
					id: obj.id || `obj_${idx}`,
					name: obj.name || def?.name || obj.type,
					type: obj.type || def?.type || 'prop',
					x: gx,
					y: gy,
					z: obj.z || 0,
					icon: obj.icon || def?.icon || '📦',
					solid: def?.solid !== undefined ? def.solid : obj.solid !== false,
					interactive: def?.interactive !== undefined ? def.interactive : Boolean(obj.interactive),
					children
				}
			})
		}
	}

	// Process characters list
	if (Array.isArray(data.characters)) {
		characters = data.characters.map((c) => ({
			id: c.id,
			name: c.name || c.id,
			x: c.cord ? c.cord[0] : c.x,
			y: c.cord ? c.cord[1] : c.y,
			z: c.z || 0,
			facing: c.facing || 'SE'
		}))
	}

	// Calculate bounds if not set
	let bounds = data.bounds
	if (!bounds && tiles.length > 0) {
		const xs = tiles.map((t) => t.x)
		const ys = tiles.map((t) => t.y)
		bounds = {
			minX: Math.min(...xs),
			maxX: Math.max(...xs),
			minY: Math.min(...ys),
			maxY: Math.max(...ys)
		}
	} else if (!bounds) {
		bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
	}

	// Default spawn point
	let defaultSpawn = data.defaultSpawn
	if (!defaultSpawn) {
		if (characters.length > 0) {
			defaultSpawn = { x: characters[0].x, y: characters[0].y, z: characters[0].z || 0, facing: 'SE' }
		} else {
			defaultSpawn = { x: 0, y: 0, z: 0, facing: 'SE' }
		}
	}

	return {
		id: data.id || 'location',
		name: data.name || 'Изометрическая локация',
		description: data.description || '',
		tileWidth: data.tileWidth || 64,
		tileHeight: data.tileHeight || 32,
		heightStep: data.heightStep || 16,
		gridWidth: data.gridWidth || (bounds.maxX - bounds.minX + 1),
		gridHeight: data.gridHeight || (bounds.maxY - bounds.minY + 1),
		bounds,
		defaultSpawn,
		tiles,
		objects,
		characters,
		levels: data.levels || null
	}
}
