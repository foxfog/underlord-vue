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
import { BORDER_STATE_TYPES, BORDER_STATE_TAGS } from './hexConfig.js'

export const BIOMES = Object.freeze({
	grass: { id: 'grass', name: 'Трава', color: '#8eaf4f', edgeColor: '#6b8e3d', icon: '🌿' },
	plains: { id: 'plains', name: 'Равнина', color: '#bbab70', edgeColor: '#9e8e56', icon: '🌾' },
	desert: { id: 'desert', name: 'Пустыня', color: '#e3ab5f', edgeColor: '#b88230', icon: '🏜️' },
	snow: { id: 'snow', name: 'Снег', color: '#d6e0e4', edgeColor: '#cbd5e1', icon: '❄️' },
	tundra: { id: 'tundra', name: 'Тундра', color: '#848173', edgeColor: '#68665a', icon: '❄️' },
	water: { id: 'water', name: 'Побережье', color: '#0284c7', edgeColor: '#0369a1', isWater: true, icon: '🌊' },
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
	dirt: { id: 'dirt', name: 'Гравийная дорога', color: '#8d6e63', width: 1.8, dash: [4, 2] },
	stone: { id: 'stone', name: 'Каменная дорога', color: '#94a3b8', width: 3.0 }
})

/**
 * Standard preset styling for major New World factions/nations (Civilization style).
 */
export const FACTION_PRESETS = Object.freeze({
	're-estize': {
		id: 're-estize',
		isState: true,
		name: 'Королевство Ре-Эстиз',
		icon: '👑',
		borderColor: '#2563eb', // Royal Blue
		fillColor: 'rgba(37, 99, 235, 0.16)'
	},
	'baharuth': {
		id: 'baharuth',
		isState: true,
		name: 'Империя Бахарут',
		icon: '🦅',
		borderColor: '#dc2626', // Imperial Crimson
		fillColor: 'rgba(220, 38, 38, 0.16)'
	},
	'slane-theocracy': {
		id: 'slane-theocracy',
		isState: true,
		name: 'Слейновская Теократия',
		icon: '☀️',
		borderColor: '#eab308', // Solar Gold
		fillColor: 'rgba(234, 179, 8, 0.16)'
	},
	'roble': {
		id: 'roble',
		isState: true,
		name: 'Святое Королевство Робл',
		icon: '🕊️',
		borderColor: '#94a3b8', // Holy White/Silver
		fillColor: 'rgba(241, 245, 249, 0.20)'
	},
	'sorcerer-kingdom': {
		id: 'sorcerer-kingdom',
		isState: true,
		name: 'Колдовское Королевство',
		icon: '👑',
		borderColor: '#a855f7', // Sorcerer Purple
		fillColor: 'rgba(168, 85, 247, 0.18)'
	},
	'nazarick': {
		id: 'nazarick',
		isState: false,
		name: 'Великая Гробница Назарик',
		icon: '🏰',
		borderColor: '#6366f1', // Indigo Dark
		fillColor: 'rgba(99, 102, 241, 0.18)'
	},
	'ainz-ooal-gown': {
		id: 'ainz-ooal-gown',
		isState: false,
		name: 'Аинз Оал Гоун',
		icon: '⚔️',
		borderColor: '#6366f1',
		fillColor: 'rgba(99, 102, 241, 0.18)'
	},
	'agrand-council': {
		id: 'agrand-council',
		isState: true,
		name: 'Союз Агранд',
		icon: '🐉',
		borderColor: '#06b6d4', // Dragon Azure
		fillColor: 'rgba(6, 182, 212, 0.16)'
	},
	'dragon-kingdom': {
		id: 'dragon-kingdom',
		isState: true,
		name: 'Драконье Королевство',
		icon: '🐲',
		borderColor: '#10b981', // Emerald
		fillColor: 'rgba(16, 185, 129, 0.16)'
	},
	'dwarven-kingdom': {
		id: 'dwarven-kingdom',
		isState: true,
		name: 'Королевство гномов',
		icon: '⚒️',
		borderColor: '#d97706', // Dwarven Bronze
		fillColor: 'rgba(217, 119, 6, 0.16)'
	},
	'great-tribe': {
		id: 'great-tribe',
		isState: false,
		name: 'Большое племя',
		icon: '🦎',
		borderColor: '#14b8a6', // Teal
		fillColor: 'rgba(20, 184, 166, 0.16)'
	},
	'demi-human-alliance': {
		id: 'demi-human-alliance',
		isState: false,
		name: 'Альянс полулюдей',
		icon: '🐺',
		borderColor: '#f97316', // Ochre Orange
		fillColor: 'rgba(249, 115, 22, 0.16)'
	},
	'carne-village': {
		id: 'carne-village',
		isState: false,
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
	if (c.length === 8) c = c.slice(0, 6)
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
 * Determines whether a faction ID refers to a state (nation) that may own political borders.
 * Priority: explicit `isState` boolean in data → `type` in BORDER_STATE_TYPES → tag in BORDER_STATE_TAGS → preset `isState`.
 * Guilds, clans, religious orders, settlements and internal factions never get borders.
 */
export function isStateFaction(factionId, customFactions = null) {
	if (!factionId) return false
	let record = null
	if (customFactions) {
		record = Array.isArray(customFactions)
			? customFactions.find(x => x && x.id === factionId)
			: customFactions[factionId]
	}
	if (record) {
		if (typeof record.isState === 'boolean') return record.isState
		if (record.type && BORDER_STATE_TYPES.includes(record.type)) return true
		if (Array.isArray(record.tags) && record.tags.some(t => BORDER_STATE_TAGS.includes(t))) return true
	}
	return FACTION_PRESETS[factionId]?.isState === true
}

/**
 * Unpacks an RLE-encoded hex terrain definition with palette, overrides, and optional territory RLE layer.
 *
 * @param {Object} bounds - { minCol, maxCol, minRow, maxRow }
 * @param {Object|string} terrainDef - { palette: Array<string|Object>, rle: string }
 * @param {Object} [overrides={}] - Sparse cell overrides keyed by "col,row"
 * @param {string} [baseTerrain='grass'] - Default terrain fallback
 * @param {Object|string} [territoriesDef=null] - { palette: Array<string|null>, rle: string } for political factions
 * @returns {Record<string, Object>} Cells dictionary keyed by "col,row"
 */
export function unpackHexTerrain(bounds, terrainDef, overrides = {}, baseTerrain = 'grass', territoriesDef = null) {
	if (!bounds) {
		bounds = { minCol: -10, maxCol: 10, minRow: -10, maxRow: 10 }
	}

	const palette = Array.isArray(terrainDef?.palette) ? terrainDef.palette : [baseTerrain]
	const rleStr = typeof terrainDef === 'string' ? terrainDef : (terrainDef?.rle || '')

	const overridesMap = overrides && typeof overrides === 'object' ? overrides : {}

	const parsedRuns = []
	const tokenRegex = /([a-zA-Z0-9_-]+)(?::(\d+))?/g
	let match
	while ((match = tokenRegex.exec(rleStr)) !== null) {
		const rawKey = match[1]
		const count = match[2] !== undefined ? parseInt(match[2], 10) : 1
		if (count <= 0) continue

		let val = baseTerrain
		const numIdx = parseInt(rawKey, 10)
		if (!isNaN(numIdx) && String(numIdx) === rawKey && numIdx >= 0 && numIdx < palette.length) {
			val = palette[numIdx]
		} else {
			const byPal = palette.find(
				p => (typeof p === 'string' ? p === rawKey : p?.terrain === rawKey || p?.id === rawKey)
			)
			val = byPal || rawKey
		}
		parsedRuns.push({ val, count })
	}

	// Parse Territory RLE layer if present
	const territoryPalette = Array.isArray(territoriesDef?.palette) ? territoriesDef.palette : [null]
	const territoryRleStr = typeof territoriesDef === 'string' ? territoriesDef : (territoriesDef?.rle || '')
	const parsedTerritoryRuns = []
	if (territoryRleStr) {
		tokenRegex.lastIndex = 0
		let tMatch
		while ((tMatch = tokenRegex.exec(territoryRleStr)) !== null) {
			const rawKey = tMatch[1]
			const count = tMatch[2] !== undefined ? parseInt(tMatch[2], 10) : 1
			if (count <= 0) continue

			let val = null
			const numIdx = parseInt(rawKey, 10)
			if (!isNaN(numIdx) && String(numIdx) === rawKey && numIdx >= 0 && numIdx < territoryPalette.length) {
				val = territoryPalette[numIdx]
			} else {
				val = territoryPalette.includes(rawKey) ? rawKey : null
			}
			parsedTerritoryRuns.push({ val, count })
		}
	}

	const cells = {}
	let runIdx = 0
	let runRem = parsedRuns.length > 0 ? parsedRuns[0].count : 0

	let territoryRunIdx = 0
	let territoryRunRem = parsedTerritoryRuns.length > 0 ? parsedTerritoryRuns[0].count : 0

	for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
		for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
			let cellDef = null
			if (runIdx < parsedRuns.length) {
				cellDef = parsedRuns[runIdx].val
				runRem--
				if (runRem <= 0) {
					runIdx++
					if (runIdx < parsedRuns.length) {
						runRem = parsedRuns[runIdx].count
					}
				}
			}

			let terrain = baseTerrain
			let elevation = 0
			let feature = 'none'

			if (typeof cellDef === 'string') {
				terrain = BIOMES[cellDef] ? cellDef : baseTerrain
			} else if (cellDef && typeof cellDef === 'object') {
				terrain = BIOMES[cellDef.terrain] ? cellDef.terrain : (cellDef.id || baseTerrain)
				elevation = Number(cellDef.elevation) || 0
				feature = cellDef.feature || 'none'
			}

			let faction = null
			if (parsedTerritoryRuns.length > 0 && territoryRunIdx < parsedTerritoryRuns.length) {
				faction = parsedTerritoryRuns[territoryRunIdx].val
				territoryRunRem--
				if (territoryRunRem <= 0) {
					territoryRunIdx++
					if (territoryRunIdx < parsedTerritoryRuns.length) {
						territoryRunRem = parsedTerritoryRuns[territoryRunIdx].count
					}
				}
			}

			const key = `${c},${r}`
			const ov = overridesMap[key] || null

			const cellObj = {
				col: c,
				row: r,
				terrain: (ov && ov.terrain !== undefined && BIOMES[ov.terrain]) ? ov.terrain : terrain,
				elevation: (ov && ov.elevation !== undefined) ? Number(ov.elevation) : elevation,
				feature: (ov && ov.feature !== undefined) ? ov.feature : feature,
				mountainRadius: (ov && ov.mountainRadius !== undefined) ? Number(ov.mountainRadius) : 1,
				road: (ov && ov.road && ROAD_TYPES[ov.road]) ? ov.road : 'none',
				faction: (ov && ov.faction !== undefined) ? ov.faction : faction,
				borderColor: (ov && ov.borderColor !== undefined) ? ov.borderColor : null,
				fillColor: (ov && ov.fillColor !== undefined) ? ov.fillColor : null,
				settlement: (ov && ov.settlement) ? ov.settlement : null
			}

			if (ov) {
				for (const [k, v] of Object.entries(ov)) {
					if (!['col', 'row', 'terrain', 'elevation', 'feature', 'mountainRadius', 'road', 'faction', 'borderColor', 'fillColor', 'settlement'].includes(k)) {
						cellObj[k] = v
					}
				}
			}

			cells[key] = cellObj
		}
	}

	return cells
}

/**
 * Packs a flat cells dictionary/array into compact RLE terrain, territories layer, and sparse overrides.
 *
 * @param {Object} bounds - { minCol, maxCol, minRow, maxRow }
 * @param {Record<string, Object>|Array<Object>} cells - Cells dictionary or array
 * @param {string} [baseTerrain='grass'] - Default terrain fallback
 * @returns {{ terrain: { palette: Array<string|Object>, rle: string }, territories?: { palette: Array<string|null>, rle: string }, overrides: Object }}
 */
export function packHexTerrain(bounds, cells = {}, baseTerrain = 'grass') {
	const cellMap = Array.isArray(cells)
		? Object.fromEntries(cells.filter(c => c).map(c => [`${c.col},${c.row}`, c]))
		: (cells || {})

	if (!bounds) {
		let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity
		for (const k of Object.keys(cellMap)) {
			const [c, r] = k.split(',').map(Number)
			if (!isNaN(c) && !isNaN(r)) {
				if (c < minC) minC = c
				if (c > maxC) maxC = c
				if (r < minR) minR = r
				if (r > maxR) maxR = r
			}
		}
		bounds = {
			minCol: minC === Infinity ? -10 : minC,
			maxCol: maxC === -Infinity ? 10 : maxC,
			minRow: minR === Infinity ? -10 : minR,
			maxRow: maxR === -Infinity ? 10 : maxR
		}
	}

	const paletteMap = new Map()
	const palette = []
	function getPaletteIdx(def) {
		const key = typeof def === 'string' ? def : JSON.stringify(def)
		if (!paletteMap.has(key)) {
			paletteMap.set(key, palette.length)
			palette.push(def)
		}
		return paletteMap.get(key)
	}

	// Territories palette: 0 is always null (neutral territory)
	const territoryPaletteMap = new Map()
	territoryPaletteMap.set(null, 0)
	const territoryPalette = [null]
	function getTerritoryIdx(fId) {
		if (!fId) return 0
		if (!territoryPaletteMap.has(fId)) {
			territoryPaletteMap.set(fId, territoryPalette.length)
			territoryPalette.push(fId)
		}
		return territoryPaletteMap.get(fId)
	}

	const overrides = {}
	const runs = []
	let prevIdx = null
	let count = 0

	const territoryRuns = []
	let prevTerritoryIdx = null
	let territoryCount = 0

	for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
		for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
			const key = `${c},${r}`
			const cell = cellMap[key]
			const terrain = cell?.terrain || baseTerrain
			const elevation = Number(cell?.elevation) || 0
			const feature = cell?.feature || 'none'

			let baseDef = terrain
			if (elevation !== 0 || (feature && feature !== 'none')) {
				baseDef = { terrain }
				if (elevation !== 0) baseDef.elevation = elevation
				if (feature && feature !== 'none') baseDef.feature = feature
			}

			const idx = getPaletteIdx(baseDef)
			if (idx === prevIdx) {
				count++
			} else {
				if (prevIdx !== null) {
					runs.push(count > 1 ? `${prevIdx}:${count}` : String(prevIdx))
				}
				prevIdx = idx
				count = 1
			}

			// Faction territory tracking
			const fId = cell?.faction || null
			const fIdx = getTerritoryIdx(fId)
			if (fIdx === prevTerritoryIdx) {
				territoryCount++
			} else {
				if (prevTerritoryIdx !== null) {
					territoryRuns.push(territoryCount > 1 ? `${prevTerritoryIdx}:${territoryCount}` : String(prevTerritoryIdx))
				}
				prevTerritoryIdx = fIdx
				territoryCount = 1
			}

			if (cell) {
				const ov = {}
				if (cell.road && cell.road !== 'none') ov.road = cell.road
				if (cell.borderColor) ov.borderColor = cell.borderColor
				if (cell.fillColor) ov.fillColor = cell.fillColor
				if (cell.settlement) ov.settlement = cell.settlement
				if (cell.mountainRadius && Number(cell.mountainRadius) !== 1) ov.mountainRadius = cell.mountainRadius

				for (const [k, v] of Object.entries(cell)) {
					if (!['col', 'row', 'terrain', 'elevation', 'feature', 'road', 'faction', 'borderColor', 'fillColor', 'settlement', 'mountainRadius'].includes(k)) {
						ov[k] = v
					}
				}

				if (Object.keys(ov).length > 0) {
					overrides[key] = ov
				}
			}
		}
	}
	if (prevIdx !== null) {
		runs.push(count > 1 ? `${prevIdx}:${count}` : String(prevIdx))
	}
	if (prevTerritoryIdx !== null) {
		territoryRuns.push(territoryCount > 1 ? `${prevTerritoryIdx}:${territoryCount}` : String(prevTerritoryIdx))
	}

	const result = {
		terrain: {
			palette,
			rle: runs.join(' ')
		},
		overrides
	}

	if (territoryPalette.length > 1) {
		result.territories = {
			palette: territoryPalette,
			rle: territoryRuns.join(' ')
		}
	}

	return result
}

/**
 * Converts a hex map data object into the compact hybrid format (reducing file size by 95-99%).
 *
 * @param {Object} mapData - Full hex map data
 * @returns {Object} Compact hybrid map object
 */
export function packHexMapData(mapData) {
	if (!mapData) return null
	// Strip Vue reactivity proxies so the resulting object is 100% cloneable by Electron IPC
	const cleanData = JSON.parse(JSON.stringify(mapData))
	const bounds = cleanData.bounds || {
		minCol: 0,
		maxCol: (cleanData.cols || 20) - 1,
		minRow: 0,
		maxRow: (cleanData.rows || 15) - 1
	}

	const baseTerrain = cleanData.baseTerrain || 'grass'
	const { terrain, territories, overrides } = packHexTerrain(bounds, cleanData.cells || {}, baseTerrain)

	const hybrid = {
		id: cleanData.id || 'hexmap',
		name: cleanData.name || 'Гексагональная карта',
		description: cleanData.description || '',
		cols: bounds.maxCol - bounds.minCol + 1,
		rows: bounds.maxRow - bounds.minRow + 1,
		bounds,
		hexRadius: Number(cleanData.hexRadius) || DEFAULT_HEX_RADIUS,
		tilt: Number(cleanData.tilt) || DEFAULT_HEX_TILT,
		pitch: Number(cleanData.pitch) || 45,
		terrain
	}

	if (territories) {
		hybrid.territories = territories
	}

	if (overrides && Object.keys(overrides).length > 0) {
		hybrid.overrides = overrides
	}

	if (cleanData.rivers && Object.keys(cleanData.rivers).length > 0) {
		hybrid.rivers = cleanData.rivers
	}

	if (cleanData.roads && Object.keys(cleanData.roads).length > 0) {
		hybrid.roads = cleanData.roads
	}

	if (cleanData.factions) {
		hybrid.factions = cleanData.factions
	}

	return JSON.parse(JSON.stringify(hybrid))
}

/**
 * Normalizes hex map data ensuring robust arrays/objects for cells, rivers, and roads.
 * Seamlessly supports both the legacy flat 'cells' format and the modern hybrid (RLE terrain + territories + overrides) format.
 */
export function normalizeHexMapData(raw) {
	if (!raw) return null

	const data = JSON.parse(JSON.stringify(raw))
	const rawCols = Number(data.cols) || 20
	const rawRows = Number(data.rows) || 15

	let minCol = data.bounds?.minCol !== undefined ? Number(data.bounds.minCol) : undefined
	let maxCol = data.bounds?.maxCol !== undefined ? Number(data.bounds.maxCol) : undefined
	let minRow = data.bounds?.minRow !== undefined ? Number(data.bounds.minRow) : undefined
	let maxRow = data.bounds?.maxRow !== undefined ? Number(data.bounds.maxRow) : undefined

	// If bounds not explicitly provided, infer from cell coordinates to support negative centered coordinates
	if (minCol === undefined || maxCol === undefined || minRow === undefined || maxRow === undefined) {
		if (data.cells && typeof data.cells === 'object') {
			for (const key of Object.keys(data.cells)) {
				const [c, r] = key.split(',').map(Number)
				if (!isNaN(c) && !isNaN(r)) {
					if (minCol === undefined || c < minCol) minCol = c
					if (maxCol === undefined || c > maxCol) maxCol = c
					if (minRow === undefined || r < minRow) minRow = r
					if (maxRow === undefined || r > maxRow) maxRow = r
				}
			}
		}
	}

	const halfW = Math.floor(rawCols / 2)
	const halfH = Math.floor(rawRows / 2)
	minCol = minCol !== undefined ? minCol : -halfW
	maxCol = maxCol !== undefined ? maxCol : (rawCols - 1 - halfW)
	minRow = minRow !== undefined ? minRow : -halfH
	maxRow = maxRow !== undefined ? maxRow : (rawRows - 1 - halfH)

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
	const baseTerrain = (data.baseTerrain && BIOMES[data.baseTerrain]) ? data.baseTerrain : 'grass'

	// If hybrid terrain is present and cells is not provided or empty, unpack hybrid terrain
	if ((!data.cells || Object.keys(data.cells).length === 0) && data.terrain) {
		data.cells = unpackHexTerrain(bounds, data.terrain, data.overrides, baseTerrain, data.territories)
	}

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
	const fillTerrain = (data.baseTerrain && BIOMES[data.baseTerrain]) ? data.baseTerrain : 'water'
	for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
		for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
			const k = `${c},${r}`
			if (!cells[k]) {
				cells[k] = {
					col: c,
					row: r,
					terrain: fillTerrain,
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
			// A connection is stone only if both adjacent cells are stone; connecting stone to dirt yields dirt
			const connectionType = (currentCell.road === 'stone' && neighborCell.road === 'stone') ? 'stone' : 'dirt'
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
 * Prunes any obsolete or non-adjacent road keys.
 *
 * @param {Object} mapData - Normalized hex map data
 */
export function rebuildAllRoadConnections(mapData) {
	if (!mapData || !mapData.cells) return
	mapData.roads = {}

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
	const halfW = Math.floor(cols / 2)
	const halfH = Math.floor(rows / 2)
	const b = bounds || {
		minCol: -halfW,
		maxCol: cols - 1 - halfW,
		minRow: -halfH,
		maxRow: rows - 1 - halfH
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

