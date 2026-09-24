/**
 * Hexagonal Map Data Loader and Normalizer
 */

import {
	getCanonicalEdgeKey,
	getHexNeighbor,
	HEX_EDGES,
	DEFAULT_HEX_RADIUS,
	DEFAULT_HEX_TILT
} from './hexCoords.js'

export const BIOMES = Object.freeze({
	grass: { id: 'grass', name: 'Трава', color: '#3d8b40', edgeColor: '#2b692e', icon: '🌿' },
	plains: { id: 'plains', name: 'Равнина', color: '#7cb342', edgeColor: '#558b2f', icon: '🌾' },
	desert: { id: 'desert', name: 'Пустыня', color: '#e0a94b', edgeColor: '#b88230', icon: '🏜️' },
	snow: { id: 'snow', name: 'Снег', color: '#e2e8f0', edgeColor: '#cbd5e1', icon: '❄️' },
	water: { id: 'water', name: 'Вода / Озеро', color: '#0284c7', edgeColor: '#0369a1', isWater: true, icon: '🌊' },
	ocean: { id: 'ocean', name: 'Океан', color: '#1e3a8a', edgeColor: '#172554', isWater: true, icon: '🌊' }
})

export const SETTLEMENT_TYPES = Object.freeze({
	camp: { id: 'camp', name: 'Лагерь', icon: '⛺', color: '#f59e0b' },
	village: { id: 'village', name: 'Деревня', icon: '🏡', color: '#10b981' },
	town: { id: 'town', name: 'Городок', icon: '🏘️', color: '#3b82f6' },
	fortress: { id: 'fortress', name: 'Крепость', icon: '🏰', color: '#8b5cf6' },
	walled_city: { id: 'walled_city', name: 'Город со стенами', icon: '👑', color: '#ef4444' }
})

export const ROAD_TYPES = Object.freeze({
	dirt: { id: 'dirt', name: 'Гравийная дорога', color: '#8d6e63', width: 2.5, dash: [4, 2] },
	stone: { id: 'stone', name: 'Каменная дорога', color: '#cbd5e1', width: 3.5, border: '#475569' }
})

/**
 * Normalizes hex map data ensuring robust arrays/objects for cells, rivers, and roads.
 */
export function normalizeHexMapData(raw) {
	if (!raw) return null

	const data = JSON.parse(JSON.stringify(raw))
	const cols = Number(data.cols) || 20
	const rows = Number(data.rows) || 15
	const hexRadius = Number(data.hexRadius) || DEFAULT_HEX_RADIUS
	const tilt = Number(data.tilt) || DEFAULT_HEX_TILT
	const pitch = Number(data.pitch) || 45

	const cells = {}
	if (data.cells && typeof data.cells === 'object') {
		for (const [key, c] of Object.entries(data.cells)) {
			if (!c) continue
			const parts = key.split(',')
			const col = Number(c.col ?? parts[0])
			const row = Number(c.row ?? parts[1])
			if (isNaN(col) || isNaN(row)) continue

			cells[`${col},${row}`] = {
				col,
				row,
				terrain: BIOMES[c.terrain] ? c.terrain : 'grass',
				elevation: Number(c.elevation) || 0,
				feature: c.feature || 'none', // 'none' | 'hills' | 'mountain'
				mountainRadius: Number(c.mountainRadius) || 1, // 1..3
				road: (c.road && ROAD_TYPES[c.road]) ? c.road : 'none',
				settlement: c.settlement ? {
					id: c.settlement.id || `settlement_${col}_${row}`,
					name: c.settlement.name || 'Поселение',
					type: SETTLEMENT_TYPES[c.settlement.type] ? c.settlement.type : 'village',
					hasLocalMap: Boolean(c.settlement.hasLocalMap),
					localMapId: c.settlement.localMapId || null,
					sceneId: c.settlement.sceneId || null,
					description: c.settlement.description || ''
				} : null
			}
		}
	}

	// Ensure all grid cells within cols x rows bounds are populated
	const baseTerrain = (data.baseTerrain && BIOMES[data.baseTerrain]) ? data.baseTerrain : 'water'
	for (let c = 0; c < cols; c++) {
		for (let r = 0; r < rows; r++) {
			const k = `${c},${r}`
			if (!cells[k]) {
				cells[k] = {
					col: c,
					row: r,
					terrain: baseTerrain,
					elevation: 0,
					feature: 'none',
					mountainRadius: 1,
					road: 'none',
					settlement: null
				}
			}
		}
	}

	// Canonical rivers map: { [canonicalKey]: { width: 1..3, flowDir: 1 } }
	const rivers = {}
	if (Array.isArray(data.rivers)) {
		for (const r of data.rivers) {
			if (r && r.col !== undefined && r.row !== undefined && r.edge) {
				const key = getCanonicalEdgeKey(r.col, r.row, r.edge)
				rivers[key] = {
					col: r.col,
					row: r.row,
					edge: r.edge,
					width: Math.min(3, Math.max(1, Number(r.width) || 1)),
					flowDir: r.flowDir === -1 ? -1 : 1
				}
			}
		}
	} else if (data.rivers && typeof data.rivers === 'object') {
		for (const [k, r] of Object.entries(data.rivers)) {
			if (!r) continue
			const parts = k.split(':')
			const coords = parts[0]?.split(',')
			if (coords && coords.length === 2 && parts[1]) {
				const col = Number(coords[0])
				const row = Number(coords[1])
				const edge = parts[1]
				const canonKey = getCanonicalEdgeKey(col, row, edge)
				rivers[canonKey] = {
					col,
					row,
					edge,
					width: Math.min(3, Math.max(1, Number(r.width) || 1)),
					flowDir: r.flowDir === -1 ? -1 : 1
				}
			}
		}
	}

	// Canonical roads map: { ["c1,r1:c2,r2"]: { from, to, type: 'dirt'|'stone' } }
	// Populates cell.road from legacy data.roads if cell road not set
	const roads = {}
	if (Array.isArray(data.roads)) {
		for (const road of data.roads) {
			if (road?.from && road?.to) {
				const fKey = `${road.from.col},${road.from.row}`
				const tKey = `${road.to.col},${road.to.row}`
				const rType = ROAD_TYPES[road.type] ? road.type : 'dirt'
				if (cells[fKey] && (!cells[fKey].road || cells[fKey].road === 'none')) {
					cells[fKey].road = rType
				}
				if (cells[tKey] && (!cells[tKey].road || cells[tKey].road === 'none')) {
					cells[tKey].road = rType
				}
				const k = getCanonicalRoadKey(road.from.col, road.from.row, road.to.col, road.to.row)
				roads[k] = {
					from: { col: road.from.col, row: road.from.row },
					to: { col: road.to.col, row: road.to.row },
					type: rType
				}
			}
		}
	} else if (data.roads && typeof data.roads === 'object') {
		for (const [k, road] of Object.entries(data.roads)) {
			if (road?.from && road?.to) {
				const fKey = `${road.from.col},${road.from.row}`
				const tKey = `${road.to.col},${road.to.row}`
				const rType = ROAD_TYPES[road.type] ? road.type : 'dirt'
				if (cells[fKey] && (!cells[fKey].road || cells[fKey].road === 'none')) {
					cells[fKey].road = rType
				}
				if (cells[tKey] && (!cells[tKey].road || cells[tKey].road === 'none')) {
					cells[tKey].road = rType
				}
				roads[k] = {
					from: { col: road.from.col, row: road.from.row },
					to: { col: road.to.col, row: road.to.row },
					type: rType
				}
			}
		}
	}

	const normalizedMap = {
		id: data.id || 'hexmap',
		name: data.name || 'Гексагональная карта',
		description: data.description || '',
		cols,
		rows,
		hexRadius,
		tilt,
		pitch,
		cells,
		rivers,
		roads
	}

	// Civilization-style per-cell road model: automatically connect all adjacent road cells
	rebuildAllRoadConnections(normalizedMap)

	return normalizedMap
}

/**
 * Synchronizes road connections for a cell and its 6 neighbors in Civ-style per-cell road model.
 * If both cell A and adjacent cell B have roads, a connection is added to mapData.roads.
 * If either cell does not have a road, the connection is removed.
 *
 * @param {Object} mapData - Normalized hex map data
 * @param {number} col
 * @param {number} row
 */
export function syncRoadsForCell(mapData, col, row) {
	if (!mapData || !mapData.cells) return
	if (!mapData.roads) mapData.roads = {}

	const currentCell = mapData.cells[`${col},${row}`]
	const hasRoad = currentCell && currentCell.road && currentCell.road !== 'none'

	for (const edge of HEX_EDGES) {
		const neighborCoord = getHexNeighbor(col, row, edge)
		const neighborKey = `${neighborCoord.col},${neighborCoord.row}`
		const neighborCell = mapData.cells[neighborKey]
		const neighborHasRoad = neighborCell && neighborCell.road && neighborCell.road !== 'none'

		const roadKey = getCanonicalRoadKey(col, row, neighborCoord.col, neighborCoord.row)

		if (hasRoad && neighborHasRoad) {
			// When connecting cells with different road tiers, stone takes priority
			const connectionType = (currentCell.road === 'stone' || neighborCell.road === 'stone') ? 'stone' : 'dirt'
			mapData.roads[roadKey] = {
				from: { col, row },
				to: { col: neighborCoord.col, row: neighborCoord.row },
				type: connectionType
			}
		} else {
			delete mapData.roads[roadKey]
		}
	}
}

/**
 * Rebuilds all road connections between adjacent cells that have roads across the entire map.
 *
 * @param {Object} mapData - Normalized hex map data
 */
export function rebuildAllRoadConnections(mapData) {
	if (!mapData || !mapData.cells) return
	if (!mapData.roads) mapData.roads = {}

	for (const cell of Object.values(mapData.cells)) {
		if (cell.road && cell.road !== 'none') {
			syncRoadsForCell(mapData, cell.col, cell.row)
		}
	}
}

/**
 * Returns canonical key for a road connecting two hexes.
 */
export function getCanonicalRoadKey(c1, r1, c2, r2) {
	if (c1 < c2 || (c1 === c2 && r1 < r2)) {
		return `${c1},${r1}:${c2},${r2}`
	}
	return `${c2},${r2}:${c1},${r1}`
}

/**
 * Checks if a river exists along the shared edge between two adjacent hexes.
 *
 * @param {Object} riversMap - Normalized rivers object
 * @param {number} c1
 * @param {number} r1
 * @param {string} edge
 * @returns {number} river width 1..3, or 0 if no river
 */
export function getRiverOnEdge(riversMap, c1, r1, edge) {
	if (!riversMap) return 0
	const key = getCanonicalEdgeKey(c1, r1, edge)
	return riversMap[key]?.width || 0
}

/**
 * Gets full river data along an edge (width, flowDir, key).
 *
 * @param {Object} riversMap
 * @param {number} c1
 * @param {number} r1
 * @param {string} edge
 * @returns {{ key: string, width: number, flowDir: number } | null}
 */
export function getRiverDataOnEdge(riversMap, c1, r1, edge) {
	if (!riversMap) return null
	const key = getCanonicalEdgeKey(c1, r1, edge)
	const r = riversMap[key]
	if (!r || !r.width) return null
	return {
		key,
		col: r.col,
		row: r.row,
		edge: r.edge,
		width: r.width,
		flowDir: r.flowDir === -1 ? -1 : 1
	}
}

/**
 * Finds if a bridge should exist between two adjacent hexes.
 * A bridge exists when there is a road between them AND a river along their shared edge!
 *
 * @param {Object} mapData - Normalized hex map data
 * @param {number} c1
 * @param {number} r1
 * @param {number} c2
 * @param {number} r2
 * @param {string} sharedEdge
 * @returns {{ hasBridge: boolean, roadType: string, riverWidth: number }}
 */
export function checkBridgeBetweenHexes(mapData, c1, r1, c2, r2, sharedEdge) {
	const roadKey = getCanonicalRoadKey(c1, r1, c2, r2)
	const road = mapData?.roads?.[roadKey]
	if (!road) {
		return { hasBridge: false, roadType: 'none', riverWidth: 0 }
	}

	const riverWidth = getRiverOnEdge(mapData?.rivers, c1, r1, sharedEdge)
	if (riverWidth > 0) {
		return {
			hasBridge: true,
			roadType: road.type || 'dirt',
			riverWidth
		}
	}

	return { hasBridge: false, roadType: road.type || 'dirt', riverWidth: 0 }
}

/**
 * Creates an empty default hex map.
 */
export function createDefaultHexMap(cols = 20, rows = 15, baseTerrain = 'grass') {
	const cells = {}
	for (let c = 0; c < cols; c++) {
		for (let r = 0; r < rows; r++) {
			cells[`${c},${r}`] = {
				col: c,
				row: r,
				terrain: baseTerrain,
				elevation: 0,
				feature: 'none',
				mountainRadius: 1,
				road: 'none',
				settlement: null
			}
		}
	}

	return normalizeHexMapData({
		id: 'new_hexmap',
		name: 'Новая гексагональная карта',
		description: '',
		cols,
		rows,
		hexRadius: DEFAULT_HEX_RADIUS,
		tilt: DEFAULT_HEX_TILT,
		cells,
		rivers: {},
		roads: {}
	})
}
