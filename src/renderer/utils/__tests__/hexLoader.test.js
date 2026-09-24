import { describe, it, expect } from 'vitest'
import {
	BIOMES,
	SETTLEMENT_TYPES,
	ROAD_TYPES,
	FACTION_PRESETS,
	getFactionVisuals,
	hexToRgba,
	normalizeHexMapData,
	getCanonicalRoadKey,
	getRiverOnEdge,
	checkBridgeBetweenHexes,
	createDefaultHexMap,
	syncRoadsForCell,
	rebuildAllRoadConnections
} from '../hexmap/hexLoader'
import {
	hexToWorldGroundCenter,
	getHexGroundVertices,
	getHexEdgeEndpoints
} from '../hexmap/hexCoords'
import {
	drawPoliticalBorders,
	renderHexMap
} from '../hexmap/hexRenderer'
import rawNewWorldHex from '@data/hexmaps/newworld_hex.json'

describe('HexLoader & Map Data', () => {
	it('defines supported biomes, settlements, and roads', () => {
		expect(BIOMES.grass).toBeDefined()
		expect(BIOMES.plains).toBeDefined()
		expect(BIOMES.desert).toBeDefined()
		expect(BIOMES.snow).toBeDefined()
		expect(BIOMES.water).toBeDefined()
		expect(BIOMES.ocean).toBeDefined()

		expect(SETTLEMENT_TYPES.camp).toBeDefined()
		expect(SETTLEMENT_TYPES.village).toBeDefined()
		expect(SETTLEMENT_TYPES.town).toBeDefined()
		expect(SETTLEMENT_TYPES.fortress).toBeDefined()
		expect(SETTLEMENT_TYPES.walled_city).toBeDefined()

		expect(ROAD_TYPES.dirt).toBeDefined()
		expect(ROAD_TYPES.stone).toBeDefined()
	})

	it('normalizes raw map data correctly', () => {
		const raw = {
			cols: 10,
			rows: 8,
			cells: {
				'2,3': { col: 2, row: 3, terrain: 'grass', feature: 'hills' },
				'3,3': {
					col: 3,
					row: 3,
					terrain: 'plains',
					settlement: { id: 'village_1', name: 'Село', type: 'village' }
				}
			},
			rivers: [
				{ col: 2, row: 3, edge: 'SE', width: 2 }
			],
			roads: [
				{ from: { col: 2, row: 3 }, to: { col: 3, row: 3 }, type: 'dirt' }
			]
		}

		const map = normalizeHexMapData(raw)
		expect(map.cols).toBe(10)
		expect(map.rows).toBe(8)
		expect(map.cells['2,3']).toBeDefined()
		expect(map.cells['2,3'].feature).toBe('hills')
		expect(map.cells['3,3'].settlement.name).toBe('Село')

		// Canonical river check
		const riverWidth = getRiverOnEdge(map.rivers, 2, 3, 'SE')
		expect(riverWidth).toBe(2)

		// Canonical road key
		const roadKey = getCanonicalRoadKey(2, 3, 3, 3)
		expect(map.roads[roadKey]).toBeDefined()
		expect(map.roads[roadKey].type).toBe('dirt')
	})

	it('detects a bridge when a road crosses a river on their shared edge', () => {
		const map = normalizeHexMapData({
			cols: 10,
			rows: 8,
			rivers: [
				{ col: 2, row: 2, edge: 'SE', width: 2 }
			],
			roads: [
				// In odd-q flat-topped, neighbor of (2,2) across SE is (3,2)
				{ from: { col: 2, row: 2 }, to: { col: 3, row: 2 }, type: 'stone' }
			]
		})

		const bridgeInfo = checkBridgeBetweenHexes(map, 2, 2, 3, 2, 'SE')
		expect(bridgeInfo.hasBridge).toBe(true)
		expect(bridgeInfo.roadType).toBe('stone')
		expect(bridgeInfo.riverWidth).toBe(2)

		// If no river on edge, no bridge
		const noRiverBridge = checkBridgeBetweenHexes(map, 2, 2, 2, 1, 'N')
		expect(noRiverBridge.hasBridge).toBe(false)
	})

	it('creates default empty hex map', () => {
		const emptyMap = createDefaultHexMap(5, 5, 'plains')
		expect(emptyMap.cols).toBe(5)
		expect(emptyMap.rows).toBe(5)
		expect(Object.keys(emptyMap.cells).length).toBe(25)
		expect(emptyMap.cells['0,0'].terrain).toBe('plains')
	})

	it('loads and normalizes newworld_hex.json without errors', () => {
		const map = normalizeHexMapData(rawNewWorldHex)
		expect(map.id).toBe('newworld_hex')
		expect(map.cells['11,7']?.settlement?.id).toBe('carne_village')
		expect(map.cells['12,10']?.settlement?.id).toBe('e_rantel')
		expect(map.cells['9,8']?.settlement?.id).toBe('great_tomb_nazarick')
		expect(map.cells['4,7']?.settlement?.id).toBe('re_estize_capital')
		expect(Object.keys(map.rivers).length).toBeGreaterThan(0)
		expect(Object.keys(map.roads).length).toBeGreaterThan(0)
	})

	it('supports Civilization-style per-cell road network and auto-crossroads', () => {
		const map = createDefaultHexMap(5, 5, 'grass')

		// Initially no roads
		expect(Object.keys(map.roads).length).toBe(0)

		// Set road on (1,1)
		map.cells['1,1'].road = 'stone'
		syncRoadsForCell(map, 1, 1)
		// Single isolated road cell has 0 connections
		expect(Object.keys(map.roads).length).toBe(0)

		// In flat-topped odd-q, (1,1) neighbor along SE is (2,1)
		map.cells['2,1'].road = 'dirt'
		syncRoadsForCell(map, 2, 1)
		// Now (1,1) and (2,1) are automatically connected!
		const roadKey1 = getCanonicalRoadKey(1, 1, 2, 1)
		expect(map.roads[roadKey1]).toBeDefined()
		expect(map.roads[roadKey1].type).toBe('stone') // Stone priority

		// Set road on another neighbor: (1,2) is neighbor along S
		map.cells['1,2'].road = 'dirt'
		syncRoadsForCell(map, 1, 2)
		// Crossroads at (1,1): connected to both (2,1) and (1,2)
		const roadKey2 = getCanonicalRoadKey(1, 1, 1, 2)
		expect(map.roads[roadKey2]).toBeDefined()
		expect(Object.keys(map.roads).length).toBe(2)

		// Remove road from (1,1)
		map.cells['1,1'].road = 'none'
		syncRoadsForCell(map, 1, 1)
		// All connections through (1,1) are severed automatically
		expect(map.roads[roadKey1]).toBeUndefined()
		expect(map.roads[roadKey2]).toBeUndefined()
		expect(Object.keys(map.roads).length).toBe(0)
	})

	it('newworld_hex has a continuous, unbroken river chain from source to mouth', () => {
		const map = normalizeHexMapData(rawNewWorldHex)
		const riverEntries = Object.values(map.rivers)
		expect(riverEntries.length).toBe(17)

		// Map vertices to verify that every internal joint is shared by exactly 2 river edges
		const vertexMap = new Map()
		for (const r of riverEntries) {
			const center = hexToWorldGroundCenter(r.col, r.row)
			const gv = getHexGroundVertices(center.x, center.y)
			const ep = getHexEdgeEndpoints(gv, r.edge)
			const kFrom = `${Math.round(ep.from.x * 10)},${Math.round(ep.from.y * 10)}`
			const kTo = `${Math.round(ep.to.x * 10)},${Math.round(ep.to.y * 10)}`
			vertexMap.set(kFrom, (vertexMap.get(kFrom) || 0) + 1)
			vertexMap.set(kTo, (vertexMap.get(kTo) || 0) + 1)
		}

		let endpointsCount = 0
		let jointCount = 0
		for (const count of vertexMap.values()) {
			if (count === 1) endpointsCount++
			if (count >= 2) jointCount++
		}

		// Single continuous river with 1 source, 1 mouth, and 16 seamless internal joints
		expect(endpointsCount).toBe(2)
		expect(jointCount).toBe(16)
	})

	it('provides Civilization-style faction presets and resolves visuals accurately', () => {
		expect(FACTION_PRESETS['re-estize']).toBeDefined()
		expect(FACTION_PRESETS['re-estize'].borderColor).toBe('#2563eb')
		expect(FACTION_PRESETS['baharuth'].borderColor).toBe('#dc2626')
		expect(FACTION_PRESETS['slane-theocracy'].borderColor).toBe('#eab308')
		expect(FACTION_PRESETS['roble'].borderColor).toBe('#94a3b8')
		expect(FACTION_PRESETS['sorcerer-kingdom'].borderColor).toBe('#a855f7')
		expect(FACTION_PRESETS['nazarick'].borderColor).toBe('#6366f1')

		// Resolves known preset
		const reEstize = getFactionVisuals('re-estize')
		expect(reEstize.name).toBe('Королевство Ре-Эстиз')
		expect(reEstize.icon).toBe('👑')
		expect(reEstize.borderColor).toBe('#2563eb')
		expect(reEstize.fillColor).toContain('rgba(37, 99, 235')

		// Resolves custom faction object
		const customFactions = [
			{ id: 'custom-clan', name: 'Клан Теней', icon: '🗡️', color: '#10b981' }
		]
		const clan = getFactionVisuals('custom-clan', customFactions)
		expect(clan.name).toBe('Клан Теней')
		expect(clan.icon).toBe('🗡️')
		expect(clan.borderColor).toBe('#10b981')
		expect(clan.fillColor).toContain('rgba(16, 185, 129')

		// Fallback for unknown ID
		const unknown = getFactionVisuals('mysterious-realm')
		expect(unknown.name).toBe('mysterious-realm')
		expect(unknown.icon).toBe('🏳️')
		expect(unknown.borderColor).toContain('hsl(')

		// Returns null for empty faction
		expect(getFactionVisuals(null)).toBeNull()
	})

	it('normalizes hex cells preserving faction, borderColor, and fillColor', () => {
		const raw = {
			cols: 3,
			rows: 3,
			cells: {
				'0,0': { col: 0, row: 0, terrain: 'grass', faction: 're-estize' },
				'1,0': { col: 1, row: 0, terrain: 'plains', fraction: 'baharuth', borderColor: '#ff0000', fillColor: 'rgba(255,0,0,0.3)' }
			}
		}

		const map = normalizeHexMapData(raw)
		expect(map.cells['0,0'].faction).toBe('re-estize')
		expect(map.cells['0,0'].borderColor).toBeNull()

		// Legacy 'fraction' converted to 'faction', custom colors preserved
		expect(map.cells['1,0'].faction).toBe('baharuth')
		expect(map.cells['1,0'].borderColor).toBe('#ff0000')
		expect(map.cells['1,0'].fillColor).toBe('rgba(255,0,0,0.3)')

		// Unassigned cell has null faction
		expect(map.cells['0,1'].faction).toBeNull()
	})

	it('newworld_hex.json contains canon factions across major nations', () => {
		const map = normalizeHexMapData(rawNewWorldHex)
		const factionCounts = {}
		for (const cell of Object.values(map.cells)) {
			if (cell.faction) {
				factionCounts[cell.faction] = (factionCounts[cell.faction] || 0) + 1
			}
		}

		expect(factionCounts['re-estize']).toBeGreaterThan(50)
		expect(factionCounts['baharuth']).toBeGreaterThan(50)
		expect(factionCounts['slane-theocracy']).toBeGreaterThan(40)
		expect(factionCounts['roble']).toBeGreaterThan(20)
		expect(factionCounts['nazarick']).toBeGreaterThan(0)
		expect(factionCounts['carne-village']).toBeGreaterThan(0)
	})

	it('renders political borders and honors showBorders toggle without errors', () => {
		const map = normalizeHexMapData({
			cols: 4,
			rows: 4,
			cells: {
				'1,1': { col: 1, row: 1, terrain: 'grass', faction: 're-estize' },
				'2,1': { col: 2, row: 1, terrain: 'grass', faction: 'baharuth' }
			}
		})

		const mockCtx = {
			canvas: { width: 800, height: 600 },
			save: () => {},
			restore: () => {},
			beginPath: () => {},
			closePath: () => {},
			moveTo: () => {},
			lineTo: () => {},
			stroke: () => {},
			fill: () => {},
			clearRect: () => {},
			setLineDash: () => {},
			createLinearGradient: () => ({ addColorStop: () => {} }),
			quadraticCurveTo: () => {},
			bezierCurveTo: () => {}
		}

		// Renders cleanly with showBorders = true
		expect(() => {
			renderHexMap(mockCtx, map, { showBorders: true })
		}).not.toThrow()

		// Renders cleanly with showBorders = false (hidden filter)
		expect(() => {
			renderHexMap(mockCtx, map, { showBorders: false })
		}).not.toThrow()
	})
})
