/**
 * Isometric Location and Catalog Loader
 * Loads and caches tiles.json and objects.json, and normalizes location data
 * supporting both the multi-level prototype format (levels, cord, containedObjects, pos)
 * and the modern flat format (tiles, objects, children).
 */

import { buildAssetUrl } from './isoSprites.js'
import defaultTilesCatalog from '../../data/isometric/tiles.json'
import defaultObjectsCatalog from '../../data/isometric/objects.json'

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
 * Parses compact loot string (e.g. "gold:25, amulet_ancient:1; key:1") or array
 * into an array of { id, count }.
 *
 * @param {string|Array} lootInput
 * @returns {Array<{ id: string, count: number }>}
 */
export function parseLootString(lootInput) {
	if (!lootInput) return []
	if (Array.isArray(lootInput)) {
		return lootInput
			.map((item) => {
				if (typeof item === 'string') {
					const parts = item.split(':').map((s) => s.trim())
					return { id: parts[0], count: parts[1] ? (parseInt(parts[1], 10) || 1) : 1 }
				}
				return { id: item.id || item.item || 'item', count: item.count || 1 }
			})
			.filter((item) => Boolean(item.id))
	}
	if (typeof lootInput !== 'string') return []

	const tokens = lootInput.split(/[,;]+/).map((s) => s.trim()).filter(Boolean)
	return tokens
		.map((token) => {
			const parts = token.split(':').map((s) => s.trim())
			const id = parts[0]
			const count = parts[1] ? (parseInt(parts[1], 10) || 1) : 1
			return { id, count }
		})
		.filter((item) => Boolean(item.id))
}

/**
 * Formats an array of loot items [{ id, count }] into a compact string e.g. "gold:25, amulet:1".
 *
 * @param {Array<{ id: string, count: number }>} lootList
 * @returns {string}
 */
export function formatLootString(lootList) {
	if (!Array.isArray(lootList) || lootList.length === 0) return ''
	return lootList.map((item) => `${item.id}:${item.count ?? 1}`).join(', ')
}

/**
 * Unpacks an RLE-encoded terrain string with palette and overrides into a flat tiles array.
 *
 * @param {Object} bounds - { minX, maxX, minY, maxY }
 * @param {Object|string} terrain - { palette: Array<string|Object>, rle: string }
 * @param {Object|Array} [overrides={}] - Sparse tile overrides keyed by "x,y" or array of tile patches
 * @returns {Array<Object>} Flat array of normalized tile objects
 */
export function unpackRleTerrain(bounds, terrain, overrides = {}) {
	if (!bounds) {
		bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
	}

	const palette = Array.isArray(terrain?.palette) ? terrain.palette : ['empty']
	const rleStr = typeof terrain === 'string' ? terrain : (terrain?.rle || '')

	// Normalize overrides into a map keyed by "gx,gy"
	const overridesMap = {}
	if (Array.isArray(overrides)) {
		for (const ov of overrides) {
			if (ov && ov.x !== undefined && ov.y !== undefined) {
				overridesMap[`${ov.x},${ov.y}`] = ov
			}
		}
	} else if (overrides && typeof overrides === 'object') {
		Object.assign(overridesMap, overrides)
	}

	// Parse RLE tokens: e.g. "1:6, 3:2, 5:3" or "1:6 3:2 5:3"
	// Supports comma, semicolon, space, newline separators
	const runs = []
	const tokenRegex = /([a-zA-Z0-9_\-]+)(?::(\d+))?/g
	let match
	while ((match = tokenRegex.exec(rleStr)) !== null) {
		const rawKey = match[1]
		const count = match[2] !== undefined ? parseInt(match[2], 10) : 1
		if (count <= 0) continue

		let val = null
		const numIdx = parseInt(rawKey, 10)
		if (!isNaN(numIdx) && String(numIdx) === rawKey && numIdx >= 0 && numIdx < palette.length) {
			val = palette[numIdx]
		} else {
			// Search in palette by string match or type
			const byPalette = palette.find(
				(p) => (typeof p === 'string' ? p === rawKey : p?.type === rawKey || p?.id === rawKey)
			)
			val = byPalette || rawKey
		}
		runs.push({ val, count })
	}

	const tiles = []
	let currentRunIdx = 0
	let currentRunRem = runs.length > 0 ? runs[0].count : 0

	for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
		for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
			let cellDef = null
			if (currentRunIdx < runs.length) {
				cellDef = runs[currentRunIdx].val
				currentRunRem--
				if (currentRunRem <= 0) {
					currentRunIdx++
					if (currentRunIdx < runs.length) {
						currentRunRem = runs[currentRunIdx].count
					}
				}
			}

			const key = `${gx},${gy}`
			const override = overridesMap[key] || null

			let type = 'empty'
			let z = 0
			let walkable = undefined
			let texture = undefined
			let walls = {}
			const extraProps = {}

			if (cellDef) {
				if (typeof cellDef === 'string') {
					type = cellDef
				} else if (typeof cellDef === 'object') {
					type = cellDef.type || cellDef.id || 'empty'
					z = cellDef.z !== undefined ? cellDef.z : 0
					if (cellDef.walkable !== undefined) walkable = cellDef.walkable
					if (cellDef.texture !== undefined) texture = cellDef.texture
					if (cellDef.walls) walls = { ...cellDef.walls }
					for (const [k, v] of Object.entries(cellDef)) {
						if (!['type', 'id', 'z', 'walkable', 'texture', 'walls'].includes(k)) {
							extraProps[k] = v
						}
					}
				}
			}

			if (override) {
				if (override.type !== undefined) type = override.type
				if (override.z !== undefined) z = override.z
				if (override.walkable !== undefined) walkable = override.walkable
				if (override.texture !== undefined) texture = override.texture
				if (override.walls) walls = { ...walls, ...override.walls }
				for (const [k, v] of Object.entries(override)) {
					if (!['x', 'y', 'type', 'z', 'walkable', 'texture', 'walls'].includes(k)) {
						extraProps[k] = v
					}
				}
			}

			const isVoid = type === 'empty' || type === 'void'
			const hasWalls = walls && Object.keys(walls).length > 0

			// Skip pure void cell if it has no walls and no override to keep tiles sparse
			if (isVoid && !hasWalls && !override) {
				continue
			}

			const def = getTileDef(type)
			const tile = {
				x: gx,
				y: gy,
				z,
				type: type === 'void' ? 'empty' : type,
				texture: texture !== undefined ? texture : (def?.id || null),
				walkable: walkable !== undefined ? walkable : (def?.walkable !== undefined ? def.walkable : !isVoid),
				walls,
				...extraProps
			}
			tiles.push(tile)
		}
	}

	return tiles
}

/**
 * Packs a flat tiles array into compact RLE terrain (palette + rle) and sparse overrides.
 *
 * @param {Object} bounds - { minX, maxX, minY, maxY }
 * @param {Array<Object>} tiles - Full tiles array
 * @returns {{ terrain: { palette: Array<string|Object>, rle: string }, overrides: Object }}
 */
export function packRleTerrain(bounds, tiles = []) {
	if (!bounds) {
		if (tiles.length > 0) {
			const xs = tiles.map((t) => t.x)
			const ys = tiles.map((t) => t.y)
			bounds = { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
		} else {
			bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
		}
	}

	const tileMap = new Map()
	for (const t of tiles) {
		tileMap.set(`${t.x},${t.y}`, t)
	}

	const overrides = {}
	const cellEntries = []

	// Step 1: scan all cells in row-major order, isolate overrides, build base terrain entries
	for (let gy = bounds.minY; gy <= bounds.maxY; gy++) {
		for (let gx = bounds.minX; gx <= bounds.maxX; gx++) {
			const key = `${gx},${gy}`
			const t = tileMap.get(key)

			if (!t || t.type === 'void' || t.type === 'empty') {
				if (t && t.walls && Object.keys(t.walls).length > 0) {
					overrides[key] = { walls: t.walls }
				}
				cellEntries.push('empty')
				continue
			}

			const z = t.z || 0
			const def = getTileDef(t.type)
			const defaultWalkable = def?.walkable !== undefined ? def.walkable : true
			const defaultTexture = def?.id || null

			const hasWalls = t.walls && Object.keys(t.walls).length > 0
			const customWalkable = t.walkable !== undefined && t.walkable !== defaultWalkable
			const customTexture = t.texture && t.texture !== defaultTexture && t.texture !== t.type

			// If tile has walls or other non-base properties, place in overrides
			const ov = {}
			if (hasWalls) ov.walls = t.walls
			if (customWalkable) ov.walkable = t.walkable
			if (customTexture) ov.texture = t.texture

			// Copy any extra custom props
			for (const [k, v] of Object.entries(t)) {
				if (!['x', 'y', 'z', 'type', 'texture', 'walkable', 'walls', 'id'].includes(k)) {
					ov[k] = v
				}
			}

			if (Object.keys(ov).length > 0) {
				overrides[key] = ov
			}

			// Base terrain representation
			if (z === 0) {
				cellEntries.push(t.type)
			} else {
				cellEntries.push(JSON.stringify({ type: t.type, z }))
			}
		}
	}

	// Step 2: Build palette (always put 'empty' at index 0)
	const paletteMap = new Map()
	paletteMap.set('empty', 0)
	const palette = ['empty']

	for (const entry of cellEntries) {
		if (!paletteMap.has(entry)) {
			const idx = palette.length
			paletteMap.set(entry, idx)
			if (entry.startsWith('{')) {
				palette.push(JSON.parse(entry))
			} else {
				palette.push(entry)
			}
		}
	}

	// Step 3: Run-Length Encode indices
	const runs = []
	let prevIdx = null
	let count = 0

	for (const entry of cellEntries) {
		const idx = paletteMap.get(entry)
		if (idx === prevIdx) {
			count++
		} else {
			if (prevIdx !== null) {
				runs.push(count > 1 ? `${prevIdx}:${count}` : `${prevIdx}`)
			}
			prevIdx = idx
			count = 1
		}
	}
	if (prevIdx !== null) {
		runs.push(count > 1 ? `${prevIdx}:${count}` : `${prevIdx}`)
	}

	return {
		terrain: {
			palette,
			rle: runs.join(', ')
		},
		overrides
	}
}

/**
 * Recursively compacts a contained object tree for export by removing fields
 * that match the catalog default and condensing coordinates to pos: [ox, oy, oz].
 */
export function compactContainedObjectsForExport(containedList) {
	if (!Array.isArray(containedList) || containedList.length === 0) return undefined

	return containedList.map((item) => {
		const def = getObjectDef(item.id, item.type)
		const out = {}

		if (item.id && !item.id.startsWith('obj_')) out.id = item.id
		out.type = item.type || def?.type || 'prop'

		// Compact pos
		const ox = item.offsetX || (item.pos ? item.pos[0] : 0)
		const oy = item.offsetY || (item.pos ? item.pos[1] : 0)
		const oz = item.offsetZ !== undefined ? item.offsetZ : (item.pos && item.pos.length > 2 ? item.pos[2] : 0)
		if (ox !== 0 || oy !== 0 || oz !== 0) {
			out.pos = oz !== 0 ? [ox, oy, oz] : [ox, oy]
		}

		if (item.name && item.name !== def?.name && item.name !== item.type) out.name = item.name
		if (item.icon && item.icon !== def?.icon && item.icon !== '📦') out.icon = item.icon
		if (item.solid !== undefined && item.solid !== def?.solid) out.solid = item.solid
		if (item.interactive !== undefined && item.interactive !== def?.interactive) out.interactive = item.interactive
		if (item.action && item.action !== def?.action) out.action = item.action

		if (item.loot) {
			const lootStr = typeof item.loot === 'string' ? item.loot : formatLootString(item.loot)
			if (lootStr) out.loot = lootStr
		}

		const compactChildren = compactContainedObjectsForExport(item.children || item.containedObjects)
		if (compactChildren && compactChildren.length > 0) {
			out.children = compactChildren
		}

		return out
	})
}

/**
 * Compacts a top-level map object for export by stripping catalog redundant fields
 * and using pos: [x, y, z] and compact loot.
 */
export function compactObjectForExport(obj) {
	const def = getObjectDef(obj.id, obj.type)
	const out = {}

	if (obj.id) out.id = obj.id
	out.type = obj.type || def?.type || 'prop'

	const gx = obj.x !== undefined ? obj.x : (obj.pos ? obj.pos[0] : 0)
	const gy = obj.y !== undefined ? obj.y : (obj.pos ? obj.pos[1] : 0)
	const gz = obj.z !== undefined ? obj.z : (obj.pos && obj.pos.length > 2 ? obj.pos[2] : 0)
	out.pos = gz !== 0 ? [gx, gy, gz] : [gx, gy]

	if (obj.name && obj.name !== def?.name && obj.name !== obj.type) out.name = obj.name
	if (obj.icon && obj.icon !== def?.icon && obj.icon !== '📦') out.icon = obj.icon
	if (obj.solid !== undefined && obj.solid !== def?.solid) out.solid = obj.solid
	if (obj.interactive !== undefined && obj.interactive !== def?.interactive) out.interactive = obj.interactive
	if (obj.action && obj.action !== def?.action) out.action = obj.action
	if (obj.size && (obj.size[0] !== 1 || obj.size[1] !== 1) && (!def?.size || def.size[0] !== obj.size[0] || def.size[1] !== obj.size[1])) {
		out.size = obj.size
	}
	if (obj.description && obj.description !== def?.description) out.description = obj.description

	if (obj.loot) {
		const lootStr = typeof obj.loot === 'string' ? obj.loot : formatLootString(obj.loot)
		if (lootStr) out.loot = lootStr
	}

	const compactChildren = compactContainedObjectsForExport(obj.children || obj.containedObjects)
	if (compactChildren && compactChildren.length > 0) {
		out.children = compactChildren
	}

	return out
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
		const pos = Array.isArray(item.pos) ? item.pos : null
		const loot = item.loot ? parseLootString(item.loot) : (item.containedItems || [])

		return {
			id: item.id || `obj_${idx}`,
			name: item.name || def?.name || item.id,
			type: item.type || def?.type || 'prop',
			icon: item.icon || def?.icon || '📦',
			solid: item.solid !== undefined ? item.solid : (def?.solid !== undefined ? def.solid : false),
			interactive: item.interactive !== undefined ? item.interactive : (def?.interactive !== undefined ? def.interactive : false),
			action: item.action || def?.action,
			offsetX: item.offsetX !== undefined ? item.offsetX : (pos ? pos[0] : 0),
			offsetY: item.offsetY !== undefined ? item.offsetY : (pos ? pos[1] : 0),
			offsetZ: item.offsetZ !== undefined ? item.offsetZ : (pos && pos.length > 2 ? pos[2] : 0),
			zIndex: item.zIndex || idx + 1,
			loot: loot.length > 0 ? loot : undefined,
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

	// Case 0: Hybrid RLE format with `terrain`
	if (data.terrain && (data.terrain.rle !== undefined || typeof data.terrain === 'string')) {
		let bounds = data.bounds
		if (!bounds && (data.gridWidth || data.gridHeight)) {
			const gw = data.gridWidth || 11
			const gh = data.gridHeight || 11
			const halfW = Math.floor(gw / 2)
			const halfH = Math.floor(gh / 2)
			bounds = { minX: -halfW, maxX: gw - 1 - halfW, minY: -halfH, maxY: gh - 1 - halfH }
		} else if (!bounds) {
			bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
		}

		tiles = unpackRleTerrain(bounds, data.terrain, data.overrides)

		if (Array.isArray(data.objects)) {
			objects = data.objects
				.map((obj, idx) => {
					const pos = Array.isArray(obj.pos) ? obj.pos : null
					const gx = obj.cord ? obj.cord[0] : (pos ? pos[0] : obj.x)
					const gy = obj.cord ? obj.cord[1] : (pos ? pos[1] : obj.y)
					const gz = pos && pos.length > 2 ? pos[2] : (obj.z || 0)
					const def = getObjectDef(obj.id, obj.type)
					const children = normalizeContainedObjects(obj.containedObjects || obj.children)
					const loot = obj.loot ? parseLootString(obj.loot) : (obj.containedItems || [])

					const isDoor = def?.type === 'door' || obj.id?.startsWith('door') || obj.type === 'door'
					const isWall = def?.type === 'wall' || obj.id?.startsWith('wall') || obj.type === 'wall'
					const edge = def?.edge || obj.edge || (isDoor ? 'NE' : 'NW')

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
								texture: obj.id || def?.id
							}
						}
					}

					return {
						...obj,
						id: obj.id || `obj_${idx}`,
						name: obj.name || def?.name || obj.type,
						type: obj.type || def?.type || 'prop',
						x: gx,
						y: gy,
						z: gz,
						icon: obj.icon || def?.icon || '📦',
						solid: obj.solid !== undefined ? obj.solid : (def?.solid !== undefined ? def.solid : false),
						interactive: obj.interactive !== undefined ? Boolean(obj.interactive) : Boolean(def?.interactive),
						action: obj.action || def?.action,
						loot: loot.length > 0 ? loot : undefined,
						children
					}
				})
				.filter((o) => {
					const def = getObjectDef(o.id, o.type)
					const isDoor = def?.type === 'door' || o.id?.startsWith('door') || o.type === 'door'
					const isWall = def?.type === 'wall' || o.id?.startsWith('wall') || o.type === 'wall'
					return !isDoor && !isWall
				})
		}
	} else if (data.levels && typeof data.levels === 'object') {
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
				const pos = Array.isArray(obj.pos) ? obj.pos : null
				const gx = obj.cord ? obj.cord[0] : (pos ? pos[0] : obj.x)
				const gy = obj.cord ? obj.cord[1] : (pos ? pos[1] : obj.y)
				const gz = pos && pos.length > 2 ? pos[2] : (obj.z || 0)
				const def = getObjectDef(obj.id, obj.type)
				const children = normalizeContainedObjects(obj.containedObjects || obj.children)
				const loot = obj.loot ? parseLootString(obj.loot) : (obj.containedItems || [])
				return {
					...obj,
					id: obj.id || `obj_${idx}`,
					name: obj.name || def?.name || obj.type,
					type: obj.type || def?.type || 'prop',
					x: gx,
					y: gy,
					z: gz,
					icon: obj.icon || def?.icon || '📦',
					solid: def?.solid !== undefined ? def.solid : (obj.solid !== undefined ? obj.solid : false),
					interactive: def?.interactive !== undefined ? def.interactive : Boolean(obj.interactive),
					action: obj.action || def?.action,
					loot: loot.length > 0 ? loot : undefined,
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
		exits: data.exits || (data.levels && data.levels[activeLevelId]?.exits) || [],
		levels: data.levels || null
	}
}
