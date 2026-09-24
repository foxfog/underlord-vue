import { describe, it, expect } from 'vitest'
import {
	getWallPolygon,
	getObjectScreenPos,
	DEFAULT_WALL_HEIGHT,
	WALL_EDGES,
	LEGACY_WALL_EDGES,
	normalizeWallEdge,
	toLegacyWallEdge,
	percentToSubTile,
	subTileToPercent
} from '../isometric/isoCoords'
import {
	isStepBlockedByWall,
	findPath,
	getReachableTiles
} from '../isometric/isoPathfinding'

describe('Isometric Tile Layers & Walls Geometry', () => {
	it('defines standard wall edges', () => {
		expect(WALL_EDGES).toEqual(['N', 'E', 'S', 'W'])
		expect(LEGACY_WALL_EDGES).toEqual(['NW', 'NE', 'SW', 'SE'])
		expect(DEFAULT_WALL_HEIGHT).toBe(1.5)
		expect(normalizeWallEdge('NW')).toBe('W')
		expect(normalizeWallEdge('NE')).toBe('N')
		expect(toLegacyWallEdge('W')).toBe('NW')
		expect(toLegacyWallEdge('N')).toBe('NE')
	})

	it('calculates 4 vertices for W and NW wall edge with height', () => {
		// Tile at (0, 0, 0), tileWidth=64, tileHeight=32, heightStep=16, wallHeight=2 -> wallH=32
		// Center = (0, 0).
		// Left = (-32, 0), Top = (0, -16).
		// W / NW edge runs from Left to Top.
		// baseA = (-32, 0), baseB = (0, -16)
		// TopLeft = (-32, -32), TopRight = (0, -48), BottomRight = (0, -16), BottomLeft = (-32, 0)
		const polyLegacy = getWallPolygon(0, 0, 0, 'NW', 2, 0, 0, 64, 32, 16)
		const polyCanonical = getWallPolygon(0, 0, 0, 'W', 2, 0, 0, 64, 32, 16)
		expect(polyLegacy).toEqual(polyCanonical)
		expect(polyCanonical).toHaveLength(4)
		expect(polyCanonical[0]).toEqual({ x: -32, y: -32 })
		expect(polyCanonical[1]).toEqual({ x: 0, y: -48 })
		expect(polyCanonical[2]).toEqual({ x: 0, y: -16 })
		expect(polyCanonical[3]).toEqual({ x: -32, y: 0 })
	})

	it('calculates 4 vertices for N and NE wall edge with height', () => {
		// Tile at (0, 0, 0), tileWidth=64, tileHeight=32, heightStep=16, wallHeight=2 -> wallH=32
		// Center = (0, 0).
		// Top = (0, -16), Right = (32, 0).
		// N / NE edge runs from Top to Right.
		// baseA = (0, -16), baseB = (32, 0)
		// TopLeft = (0, -48), TopRight = (32, -32), BottomRight = (32, 0), BottomLeft = (0, -16)
		const polyLegacy = getWallPolygon(0, 0, 0, 'NE', 2, 0, 0, 64, 32, 16)
		const polyCanonical = getWallPolygon(0, 0, 0, 'N', 2, 0, 0, 64, 32, 16)
		expect(polyLegacy).toEqual(polyCanonical)
		expect(polyCanonical).toHaveLength(4)
		expect(polyCanonical[0]).toEqual({ x: 0, y: -48 })
		expect(polyCanonical[1]).toEqual({ x: 32, y: -32 })
		expect(polyCanonical[2]).toEqual({ x: 32, y: 0 })
		expect(polyCanonical[3]).toEqual({ x: 0, y: -16 })
	})

	it('calculates screen positions for nested object attachments with sub-tile offsets', () => {
		const parentScreen = { x: 100, y: 200 }
		// Zero offset
		expect(getObjectScreenPos(parentScreen, 0, 0, 0)).toEqual({ x: 100, y: 200 })

		// offsetZ only (elevated vertically by 16px)
		expect(getObjectScreenPos(parentScreen, 0, 0, 16, 64, 32, 16)).toEqual({ x: 100, y: 184 })

		// Sub-tile X offset (moves down-right along isometric axis)
		// dx = 8 * (64/64) = 8, dy = 8 * (32/64) = 4
		const moved = getObjectScreenPos(parentScreen, 8, 0, 0, 64, 32, 16)
		expect(moved.x).toBe(108)
		expect(moved.y).toBe(204)

		// Nested child: plate on table
		const tableScreen = getObjectScreenPos(parentScreen, 0, 0, 0)
		const plateScreen = getObjectScreenPos(tableScreen, 4, 4, 12, 64, 32, 16)
		// dx = (4 - 4) = 0, dy = (4 + 4) * (32 / 64) - 12 = 4 - 12 = -8
		expect(plateScreen).toEqual({ x: 100, y: 192 })
	})
})

describe('Wall-based Pathfinding & Collision', () => {
	it('blocks movement when moving through a solid wall', () => {
		const tileA = { x: 0, y: 0, z: 0, walls: { NW: { type: 'stone_wall', solid: true } } }
		const tileB = { x: -1, y: 0, z: 0 } // Moving NW

		expect(isStepBlockedByWall(tileA, tileB)).toBe(true)
		// Opposite direction: from tileB to tileA, crossing tileA.NW
		expect(isStepBlockedByWall(tileB, tileA)).toBe(true)
	})

	it('blocks movement when moving through a solid wall with canonical edge keys (W, N, S, E)', () => {
		const tileA = { x: 0, y: 0, z: 0, walls: { W: { type: 'stone_wall', solid: true } } }
		const tileB = { x: -1, y: 0, z: 0 } // Moving W / NW
		expect(isStepBlockedByWall(tileA, tileB)).toBe(true)
		expect(isStepBlockedByWall(tileB, tileA)).toBe(true)

		const tileNorth = { x: 0, y: 0, z: 0, walls: { N: { type: 'stone_wall', solid: true } } }
		const tileAbove = { x: 0, y: -1, z: 0 } // Moving N / NE
		expect(isStepBlockedByWall(tileNorth, tileAbove)).toBe(true)
		expect(isStepBlockedByWall(tileAbove, tileNorth)).toBe(true)
	})

	it('allows movement when door is open and blocks when closed', () => {
		const tileA = {
			x: 0,
			y: 0,
			z: 0,
			walls: {
				NE: { type: 'wood_wall', door: true, open: false, solid: true }
			}
		}
		const tileB = { x: 0, y: -1, z: 0 } // Moving NE

		// Closed door blocks
		expect(isStepBlockedByWall(tileA, tileB)).toBe(true)

		// Open door allows passage
		tileA.walls.NE.open = true
		expect(isStepBlockedByWall(tileA, tileB)).toBe(false)
	})

	it('finds path around walls or through open doors', () => {
		const tiles = [
			{ x: 0, y: 0, z: 0, walkable: true, walls: { NE: { type: 'stone_wall', solid: true } } },
			{ x: 0, y: -1, z: 0, walkable: true },
			{ x: 1, y: 0, z: 0, walkable: true },
			{ x: 1, y: -1, z: 0, walkable: true }
		]

		// Direct step from (0,0) to (0,-1) is blocked by (0,0).NE wall.
		// Path should go around via (1,0) -> (1,-1) -> (0,-1)
		const path = findPath({
			start: { x: 0, y: 0 },
			target: { x: 0, y: -1 },
			tiles
		})

		expect(path).not.toBeNull()
		expect(path.length).toBe(3)
		expect(path).toEqual([
			{ x: 1, y: 0, z: 0 },
			{ x: 1, y: -1, z: 0 },
			{ x: 0, y: -1, z: 0 }
		])
	})

	it('constrains reachable tiles by maxRange and walls', () => {
		const tiles = [
			{ x: 0, y: 0, z: 0, walkable: true, walls: { NW: { solid: true } } },
			{ x: -1, y: 0, z: 0, walkable: true },
			{ x: 1, y: 0, z: 0, walkable: true },
			{ x: 0, y: 1, z: 0, walkable: true }
		]

		const reachable = getReachableTiles({
			start: { x: 0, y: 0 },
			tiles,
			maxRange: 1
		})

		// (-1, 0) is blocked by NW wall, so only (1, 0) and (0, 1) are reachable
		const reachableCoords = reachable.map(r => `${r.x},${r.y}`)
		expect(reachableCoords).toContain('1,0')
		expect(reachableCoords).toContain('0,1')
		expect(reachableCoords).not.toContain('-1,0')
	})
})

describe('Percentage Offset Conversions & Hierarchy Operations', () => {
	it('converts percentage offsets (-100%..+100%) to sub-tile units and back', () => {
		// Zero percent = center
		expect(percentToSubTile(0, 0, 32, 16)).toEqual({ offsetX: 0, offsetY: 0 })
		expect(subTileToPercent(0, 0, 32, 16)).toEqual({ percentX: 0, percentY: 0 })

		// +50% on X (radius 32) -> offsetX = 16
		const pos = percentToSubTile(50, -50, 32, 16)
		expect(pos.offsetX).toBe(16)
		expect(pos.offsetY).toBe(-8)

		const restored = subTileToPercent(pos.offsetX, pos.offsetY, 32, 16)
		expect(restored.percentX).toBe(50)
		expect(restored.percentY).toBe(-50)

		// Full range -100% to +100%
		expect(percentToSubTile(-100, 100, 32, 16)).toEqual({ offsetX: -32, offsetY: 16 })
	})

	it('supports finding and removing deeply nested child nodes in hierarchy trees', () => {
		function findNodeById(id, list) {
			for (const item of list) {
				if (item.id === id) return item
				if (Array.isArray(item.children) && item.children.length > 0) {
					const found = findNodeById(id, item.children)
					if (found) return found
				}
			}
			return null
		}

		function removeNodeById(id, list) {
			for (let i = 0; i < list.length; i++) {
				if (list[i].id === id) {
					list.splice(i, 1)
					return true
				}
				if (Array.isArray(list[i].children) && list[i].children.length > 0) {
					const removed = removeNodeById(id, list[i].children)
					if (removed) {
						if (list[i].children.length === 0) {
							delete list[i].children
						}
						return true
					}
				}
			}
			return false
		}

		const tree = [
			{
				id: 'table_1',
				name: 'Стол',
				children: [
					{
						id: 'plate_1',
						name: 'Тарелка',
						children: [
							{ id: 'food_1', name: 'Жареная птица' }
						]
					},
					{ id: 'candle_1', name: 'Подсвечник' }
				]
			}
		]

		// Find grandchild
		const food = findNodeById('food_1', tree)
		expect(food).not.toBeNull()
		expect(food.name).toBe('Жареная птица')

		// Remove grandchild
		expect(removeNodeById('food_1', tree)).toBe(true)
		expect(findNodeById('food_1', tree)).toBeNull()
		// Plate children should now be deleted because array became empty
		const plate = findNodeById('plate_1', tree)
		expect(plate.children).toBeUndefined()

		// Remove top level table
		expect(removeNodeById('table_1', tree)).toBe(true)
		expect(tree).toHaveLength(0)
	})
})

