/**
 * Hexagonal Map Data Loader and Normalizer
 */

import {
	getCanonicalEdgeKey,
	getHexNeighbor,
	HEX_EDGES,
	DEFAULT_HEX_RADIUS,
	DEFAULT_HEX_TILT,
	hashString
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
 * Standard preset styling for major New World factions/nations (Civilization style).
 */
export const FACTION_PRESETS = Object.freeze({
	're-estize': {
		id: 're-estize',
		name: 'Королевство Ре-Эстиз',
		icon: '👑',
		borderColor: '#2563eb', // Royal Blue
		fillColor: 'rgba(37, 99, 235, 0.16)'
	},
	'baharuth': {
		id: 'baharuth',
		name: 'Империя Бахарут',
		icon: '🦅',
		borderColor: '#dc2626', // Imperial Crimson
		fillColor: 'rgba(220, 38, 38, 0.16)'
	},
	'slane-theocracy': {
		id: 'slane-theocracy',
		name: 'Слейновская Теократия',
		icon: '☀️',
		borderColor: '#eab308', // Solar Gold
		fillColor: 'rgba(234, 179, 8, 0.16)'
	},
	'roble': {
		id: 'roble',
		name: 'Святое Королевство Робл',
		icon: '🕊️',
		borderColor: '#94a3b8', // Holy White/Silver
		fillColor: 'rgba(241, 245, 249, 0.20)'
	},
	'sorcerer-kingdom': {
		id: 'sorcerer-kingdom',
		name: 'Колдовское Королевство',
		icon: '👑',
		borderColor: '#a855f7', // Sorcerer Purple
		fillColor: 'rgba(168, 85, 247, 0.18)'
	},
	'nazarick': {
		id: 'nazarick',
		name: 'Великая Гробница Назарик',
		icon: '🏰',
		borderColor: '#6366f1', // Indigo Dark
		fillColor: 'rgba(99, 102, 241, 0.18)'
	},
	'ainz-ooal-gown': {
		id: 'ainz-ooal-gown',
		name: 'Аинз Оал Гоун',
		icon: '⚔️',
		borderColor: '#6366f1',
		fillColor: 'rgba(99, 102, 241, 0.18)'
	},
	'agrand-council': {
		id: 'agrand-council',
		name: 'Союз Агранд',
		icon: '🐉',
		borderColor: '#06b6d4', // Dragon Azure
		fillColor: 'rgba(6, 182, 212, 0.16)'
	},
	'dragon-kingdom': {
		id: 'dragon-kingdom',
		name: 'Драконье Королевство',
		icon: '🐲',
		borderColor: '#10b981', // Emerald
		fillColor: 'rgba(16, 185, 129, 0.16)'
	},
	'dwarven-kingdom': {
		id: 'dwarven-kingdom',
		name: 'Королевство гномов',
		icon: '⚒️',
		borderColor: '#d97706', // Dwarven Bronze
		fillColor: 'rgba(217, 119, 6, 0.16)'
	},
	'great-tribe': {
		id: 'great-tribe',
		name: 'Большое племя',
		icon: '🦎',
		borderColor: '#14b8a6', // Teal
		fillColor: 'rgba(20, 184, 166, 0.16)'
	},
	'demi-human-alliance': {
		id: 'demi-human-alliance',
		name: 'Альянс полулюдей',
		icon: '🐺',
		borderColor: '#f97316', // Ochre Orange
		fillColor: 'rgba(249, 115, 22, 0.16)'
	},
	'carne-village': {
		id: 'carne-village',
		name: 'Деревня Карн',
		icon: '🏡',
		borderColor: '#84cc16', // Lime green
		fillColor: 'rgba(132, 204, 22, 0.18)'
	}
})

/**
 * Converts a hex or rgb string into an rgba string with custom alpha.
 */
export function hexToRgba(hexStr, alpha = 0.16) {
	if (!hexStr) return `rgba(56, 189, 248, ${alpha})`
	if (hexStr.startsWith('rgba')) {
		return hexStr.replace(/[\d.]+\s*\)$/, `${alpha})`)
	}
	if (hexStr.startsWith('rgb(')) return hexStr.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`)
	let c = hexStr.replace('#', '')
	if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]
	const num = parseInt(c, 16)
	if (isNaN(num)) return `rgba(56, 189, 248, ${alpha})`
	const r = (num >> 16) & 255
	const g = (num >> 8) & 255
	const b = num & 255
	return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * Resolves visual properties (name, icon, borderColor, fillColor) for a faction ID.
 */
export function getFactionVisuals(factionId, customFactions = null) {
	if (!factionId) return null
	if (customFactions) {
		const f = Array.isArray(customFactions)
			? customFactions.find(x => x.id === factionId)
			: customFactions[factionId]
		if (f) {
			const preset = FACTION_PRESETS[factionId] || {}
			const bColor = f.borderColor || f.color || preset.borderColor || '#38bdf8'
			let fColor = f.fillColor
			if (!fColor) {
				if (f.color && f.color.startsWith('rgba')) fColor = f.color
				else if (f.color) fColor = hexToRgba(f.color, 0.16)
				else fColor = preset.fillColor || 'rgba(56, 189, 248, 0.16)'
			}
			return {
				id: f.id,
				name: f.name || preset.name || factionId,
				icon: f.icon || preset.icon || '🏳️',
				borderColor: bColor,
				fillColor: fColor
			}
		}
	}
	if (FACTION_PRESETS[factionId]) {
		return FACTION_PRESETS[factionId]
	}
	const h = hashString(factionId)
	const hue = ((h % 360) + 360) % 360
	return {
		id: factionId,
		name: factionId,
		icon: '🏳️',
		borderColor: `hsl(${hue}, 70%, 50%)`,
		fillColor: `hsla(${hue}, 70%, 50%, 0.16)`
	}
}

/**
 * Normalizes hex map data ensuring robust arrays/objects for cells, rivers, and roads.
 */
export function normalizeHexMapData(raw) {
	if (!raw) return null

	const data = JSON.parse(JSON.stringify(raw))
	const rawCols = Number(data.cols) || 20
	const rawRows = Number(data.rows) || 15

	const minCol = data.bounds?.minCol !== undefined ? Number(data.bounds.minCol) : 0
	const maxCol = data.bounds?.maxCol !== undefined ? Number(data.bounds.maxCol) : (rawCols - 1)
	const minRow = data.bounds?.minRow !== undefined ? Number(data.bounds.minRow) : 0
	const maxRow = data.bounds?.maxRow !== undefined ? Number(data.bounds.maxRow) : (rawRows - 1)

	const bounds = {
		minCol: Math.min(minCol, maxCol),
		maxCol: Math.max(minCol, maxCol),
		minRow: Math.min(minRow, maxRow),
		maxRow: Math.max(minRow, maxRow)
	}

	const cols = bounds.maxCol - bounds.minCol + 1
	const rows = bounds.maxRow - bounds.minRow + 1
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
				faction: c.faction || c.fraction || null,
				borderColor: c.borderColor || null,
				fillColor: c.fillColor || null,
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

	// Ensure all grid cells within bounds are populated
	const baseTerrain = (data.baseTerrain && BIOMES[data.baseTerrain]) ? data.baseTerrain : 'water'
	for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
		for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
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
					faction: null,
					borderColor: null,
					fillColor: null,
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
		bounds,
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
export function createDefaultHexMap(cols = 20, rows = 15, baseTerrain = 'grass', bounds = null) {
	const b = bounds || {
		minCol: 0,
		maxCol: cols - 1,
		minRow: 0,
		maxRow: rows - 1
	}
	const cells = {}
	for (let c = b.minCol; c <= b.maxCol; c++) {
		for (let r = b.minRow; r <= b.maxRow; r++) {
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
		cols: b.maxCol - b.minCol + 1,
		rows: b.maxRow - b.minRow + 1,
		bounds: b,
		hexRadius: DEFAULT_HEX_RADIUS,
		tilt: DEFAULT_HEX_TILT,
		cells,
		rivers: {},
		roads: {}
	})
}

/**
 * Loads hex map JSON dynamically in runtime (via electronAPI or fetch).
 *
 * @param {string} mapIdOrPath - map ID (e.g. 'newworld_hex') or relative path ('data/hexmaps/newworld_hex.json')
 * @returns {Promise<Object|null>} Normalized hex map data
 */
export async function loadHexMap(mapIdOrPath = 'newworld_hex') {
	const relPath = mapIdOrPath.endsWith('.json')
		? mapIdOrPath.replace(/^(\/)?(data\/)?/, '')
		: `hexmaps/${mapIdOrPath}.json`

	// 1. Try Electron IPC (native file read from data directory)
	if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
		try {
			const res = await window.electronAPI.dataEditor.readFile(relPath)
			if (res && res.success && res.data) {
				return normalizeHexMapData(res.data)
			}
		} catch (e) {
			console.warn('[hexLoader] Electron IPC read failed for', relPath, e)
		}
	}

	// 2. Try HTTP fetch (for Vite dev server / web browser)
	try {
		const basePath = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
		const cleanBase = basePath ? basePath.replace(/\/+$/, '') : ''
		const fullUrl = cleanBase ? `${cleanBase}/data/${relPath}` : `/data/${relPath}`
		const response = await fetch(fullUrl)
		if (response.ok) {
			const json = await response.json()
			return normalizeHexMapData(json)
		}
	} catch (e) {
		console.warn('[hexLoader] Fetch failed for', relPath, e)
	}

	return null
}

/**
 * Loads factions data dynamically in runtime (via electronAPI or fetch).
 * Falls back to built-in FACTION_PRESETS.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function loadFactionsData() {
	// 1. Try Electron IPC
	if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
		try {
			const res = await window.electronAPI.dataEditor.readFile('fractions/fractions.json')
			if (res && res.success && res.data) {
				return Array.isArray(res.data) ? res.data : Object.values(res.data)
			}
		} catch (e) {
			console.warn('[hexLoader] Electron IPC read failed for fractions.json', e)
		}
	}

	// 2. Try HTTP fetch
	try {
		const basePath = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
		const cleanBase = basePath ? basePath.replace(/\/+$/, '') : ''
		const fullUrl = cleanBase ? `${cleanBase}/data/fractions/fractions.json` : '/data/fractions/fractions.json'
		const response = await fetch(fullUrl)
		if (response.ok) {
			const json = await response.json()
			return Array.isArray(json) ? json : Object.values(json)
		}
	} catch (e) {
		console.warn('[hexLoader] Fetch failed for fractions.json', e)
	}

	// 3. Fallback to FACTION_PRESETS
	return Object.values(FACTION_PRESETS)
}

