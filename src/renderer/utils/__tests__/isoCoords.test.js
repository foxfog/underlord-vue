import { describe, it, expect } from 'vitest'
import {
	gridToScreen,
	screenToGrid,
	getTilePolygon,
	isPointInPolygon,
	pickTileAtScreen,
	manhattanDistance,
	chebyshevDistance,
	isAdjacent,
	createCenteredGrid,
	pickGridCellAtScreen,
	getBrushOffsets,
	getBrushGridCells,
	getIsoWorldExtremes,
	calculateCameraClamping,
	calculateDirectionalBounds,
	calculateAnchorBounds
} from '../isometric/isoCoords'

describe('isoCoords', () => {
	it('converts (0,0,0) to origin correctly', () => {
		const screen = gridToScreen(0, 0, 0, 100, 200, 64, 32, 16)
		expect(screen.x).toBe(100)
		expect(screen.y).toBe(200)
	})

	it('computes grid (1,0,0) with half tile width and height', () => {
		const screen = gridToScreen(1, 0, 0, 100, 200, 64, 32, 16)
		expect(screen.x).toBe(100 + 32)
		expect(screen.y).toBe(200 + 16)
	})

	it('computes grid (0,1,0) with negative half tile width and positive half height', () => {
		const screen = gridToScreen(0, 1, 0, 100, 200, 64, 32, 16)
		expect(screen.x).toBe(100 - 32)
		expect(screen.y).toBe(200 + 16)
	})

	it('subtracts elevation z * heightStep from screenY', () => {
		const screenZ0 = gridToScreen(2, 2, 0, 0, 0, 64, 32, 16)
		const screenZ2 = gridToScreen(2, 2, 2, 0, 0, 64, 32, 16)
		expect(screenZ2.x).toBe(screenZ0.x)
		expect(screenZ2.y).toBe(screenZ0.y - 32)
	})

	it('converts screenToGrid round-trip at z=0', () => {
		const originX = 500
		const originY = 300
		const testPoints = [
			{ x: 0, y: 0 },
			{ x: 3, y: 4 },
			{ x: 7, y: 2 }
		]

		for (const pt of testPoints) {
			const screen = gridToScreen(pt.x, pt.y, 0, originX, originY, 64, 32, 16)
			const grid = screenToGrid(screen.x, screen.y, 0, originX, originY, 64, 32, 16)
			expect(grid.x).toBe(pt.x)
			expect(grid.y).toBe(pt.y)
		}
	})

	it('tests point in polygon for rhombus', () => {
		const poly = getTilePolygon(0, 0, 0, 100, 100, 64, 32, 16)
		expect(poly.length).toBe(4)
		// Center should be inside
		expect(isPointInPolygon(100, 100, poly)).toBe(true)
		// Far point outside
		expect(isPointInPolygon(200, 200, poly)).toBe(false)
	})

	it('picks correct front-most elevated tile', () => {
		const tiles = [
			{ x: 2, y: 2, z: 0 },
			{ x: 2, y: 2, z: 1 } // Elevated tile directly above
		]
		// Screen coords of elevated tile center
		const elevatedScreen = gridToScreen(2, 2, 1, 0, 0, 64, 32, 16)
		const picked = pickTileAtScreen(elevatedScreen.x, elevatedScreen.y, tiles, 0, 0, 64, 32, 16)
		expect(picked).toBeDefined()
		expect(picked.z).toBe(1)
	})

	it('checks adjacency', () => {
		expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(true)
		expect(isAdjacent({ x: 2, y: 2 }, { x: 3, y: 3 })).toBe(false) // diagonal without flag
		expect(isAdjacent({ x: 2, y: 2 }, { x: 3, y: 3 }, true)).toBe(true) // diagonal allowed
		expect(isAdjacent({ x: 2, y: 2 }, { x: 2, y: 5 })).toBe(false)
	})

	it('creates centered grid with odd dimensions and center at (0,0)', () => {
		const grid = createCenteredGrid({ width: 5, height: 5, defaultTileType: 'grass' })
		expect(grid.length).toBe(25)
		// Center tile exists at (0,0)
		const center = grid.find((t) => t.x === 0 && t.y === 0)
		expect(center).toBeDefined()
		expect(center.type).toBe('grass')

		// Minimum and maximum bounds are -2 and +2
		const minX = Math.min(...grid.map((t) => t.x))
		const maxX = Math.max(...grid.map((t) => t.x))
		const minY = Math.min(...grid.map((t) => t.y))
		const maxY = Math.max(...grid.map((t) => t.y))
		expect(minX).toBe(-2)
		expect(maxX).toBe(2)
		expect(minY).toBe(-2)
		expect(maxY).toBe(2)
	})

	it('converts screenToGrid round-trip with negative coordinates centered at (0,0)', () => {
		const originX = 600
		const originY = 400
		const negativePoints = [
			{ x: -5, y: -5 },
			{ x: -3, y: 2 },
			{ x: 4, y: -4 },
			{ x: 0, y: 0 }
		]

		for (const pt of negativePoints) {
			const screen = gridToScreen(pt.x, pt.y, 0, originX, originY, 64, 32, 16)
			const grid = screenToGrid(screen.x, screen.y, 0, originX, originY, 64, 32, 16)
			expect(grid.x).toBe(pt.x)
			expect(grid.y).toBe(pt.y)
		}
	})

	it('returns empty array when createCenteredGrid defaultTileType is void or empty', () => {
		const voidGrid = createCenteredGrid({ width: 7, height: 7, defaultTileType: 'void' })
		expect(voidGrid).toEqual([])
		const emptyGrid = createCenteredGrid({ width: 5, height: 5, defaultTileType: 'empty' })
		expect(emptyGrid).toEqual([])
	})

	it('picks grid cell at screen even when no tile exists (void cells)', () => {
		const screen = gridToScreen(3, -2, 0, 0, 0, 64, 32, 16)
		const bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
		const cell = pickGridCellAtScreen(screen.x, screen.y, bounds, 0, 0, 64, 32, 16)
		expect(cell).toBeDefined()
		expect(cell.x).toBe(3)
		expect(cell.y).toBe(-2)

		// Outside bounds returns null
		const outScreen = gridToScreen(10, 10, 0, 0, 0, 64, 32, 16)
		const outCell = pickGridCellAtScreen(outScreen.x, outScreen.y, bounds, 0, 0, 64, 32, 16)
		expect(outCell).toBeNull()
	})

	it('computes brush offsets for square and round shapes from size 1 to 11', () => {
		// Size 1: only center
		expect(getBrushOffsets(1, 'square')).toEqual([{ dx: 0, dy: 0 }])
		expect(getBrushOffsets(1, 'round')).toEqual([{ dx: 0, dy: 0 }])

		// Size 3 square: 9 tiles
		const sq3 = getBrushOffsets(3, 'square')
		expect(sq3.length).toBe(9)

		// Size 3 round: 5 tiles (cross / diamond)
		const rd3 = getBrushOffsets(3, 'round')
		expect(rd3.length).toBe(5)
		expect(rd3).toContainEqual({ dx: 0, dy: 0 })
		expect(rd3).toContainEqual({ dx: 1, dy: 0 })
		expect(rd3).toContainEqual({ dx: -1, dy: 0 })
		expect(rd3).toContainEqual({ dx: 0, dy: 1 })
		expect(rd3).toContainEqual({ dx: 0, dy: -1 })
		// Diagonal corners excluded
		expect(rd3).not.toContainEqual({ dx: 1, dy: 1 })

		// Size 5 square: 25 tiles
		expect(getBrushOffsets(5, 'square').length).toBe(25)

		// Size 5 round: 21 tiles
		expect(getBrushOffsets(5, 'round').length).toBe(21)

		// Size 11 square: 121 tiles
		expect(getBrushOffsets(11, 'square').length).toBe(121)
		// Size 11 round: rounded circle
		expect(getBrushOffsets(11, 'round').length).toBeLessThan(121)
		expect(getBrushOffsets(11, 'round').length).toBeGreaterThan(80)
	})

	it('computes absolute brush grid cells clamped by map bounds', () => {
		const bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
		// Center at (0, 0), size 3 square: 9 cells within bounds
		const centerCells = getBrushGridCells(0, 0, 3, 'square', bounds)
		expect(centerCells.length).toBe(9)

		// Near edge (5, 5), size 3 square: cells beyond maxX/maxY are clamped
		const edgeCells = getBrushGridCells(5, 5, 3, 'square', bounds)
		expect(edgeCells.length).toBe(4) // only (4,4), (5,4), (4,5), (5,5)
	})

	describe('camera extremes and half-screen clamping', () => {
		it('computes world extremes from tiles correctly', () => {
			const tiles = [
				{ x: -2, y: 0, z: 0 },
				{ x: 2, y: 0, z: 0 },
				{ x: 0, y: -3, z: 0 },
				{ x: 0, y: 3, z: 1 }
			]
			// tileWidth = 64, tileHeight = 32, heightStep = 16
			// wx = (x - y) * 32
			// wy = (x + y) * 16 - z * 16
			// t0: (-2,0) => wx = -64, wy = -32
			// t1: (2,0)  => wx = 64, wy = 32
			// t2: (0,-3) => wx = 96, wy = -48
			// t3: (0,3,1) => wx = -96, wy = 48 - 16 = 32
			const extremes = getIsoWorldExtremes(tiles, null, 64, 32, 16)
			expect(extremes.minWX).toBe(-96)
			expect(extremes.maxWX).toBe(96)
			expect(extremes.minWY).toBe(-48)
			expect(extremes.maxWY).toBe(32)
		})

		it('includes mapBounds in extremes calculation when bounds are specified', () => {
			const bounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 }
			const extremes = getIsoWorldExtremes([], bounds, 64, 32, 16)
			// Corners:
			// (-5, -5) -> wx = 0, wy = -160
			// (5, -5)  -> wx = 320, wy = 0
			// (-5, 5)  -> wx = -320, wy = 0
			// (5, 5)   -> wx = 0, wy = 160
			expect(extremes.minWX).toBe(-320)
			expect(extremes.maxWX).toBe(320)
			expect(extremes.minWY).toBe(-160)
			expect(extremes.maxWY).toBe(160)
		})

		it('calculates camera clamping limits so edge tile reaches center of screen at zoom 1', () => {
			const worldExtremes = {
				minWX: -200,
				maxWX: 200,
				minWY: -150,
				maxWY: 150
			}
			const viewportWidth = 1000
			const viewportHeight = 800
			const clamping = calculateCameraClamping(worldExtremes, viewportWidth, viewportHeight, 1)

			// cx = 500, cy = 400
			// minCameraX = 500 - 200 = 300
			// maxCameraX = 500 - (-200) = 700
			// minCameraY = 400 - 150 = 250
			// maxCameraY = 400 - (-150) = 550
			expect(clamping.minCameraX).toBe(300)
			expect(clamping.maxCameraX).toBe(700)
			expect(clamping.minCameraY).toBe(250)
			expect(clamping.maxCameraY).toBe(550)

			// Verify screen positions at clamp edges:
			// When camera.x = maxCameraX (700), leftmost tile (-200) is at screen center (500):
			expect(-200 * 1 + clamping.maxCameraX).toBe(viewportWidth / 2)
			// When camera.x = minCameraX (300), rightmost tile (200) is at screen center (500):
			expect(200 * 1 + clamping.minCameraX).toBe(viewportWidth / 2)
			// When camera.y = maxCameraY (550), topmost tile (-150) is at screen center (400):
			expect(-150 * 1 + clamping.maxCameraY).toBe(viewportHeight / 2)
			// When camera.y = minCameraY (250), bottommost tile (150) is at screen center (400):
			expect(150 * 1 + clamping.minCameraY).toBe(viewportHeight / 2)
		})

		it('scales camera clamping proportionally with zoom (e.g. zoom 2 and zoom 0.5)', () => {
			const worldExtremes = {
				minWX: -100,
				maxWX: 100,
				minWY: -50,
				maxWY: 50
			}
			const viewportWidth = 800
			const viewportHeight = 600

			// Zoom 2:
			const clampingZ2 = calculateCameraClamping(worldExtremes, viewportWidth, viewportHeight, 2)
			// cx = 400, cy = 300
			// minCameraX = 400 - 100 * 2 = 200
			// maxCameraX = 400 - (-100) * 2 = 600
			expect(clampingZ2.minCameraX).toBe(200)
			expect(clampingZ2.maxCameraX).toBe(600)
			// Rightmost tile at minCameraX: 100 * 2 + 200 = 400 (screen center)
			expect(100 * 2 + clampingZ2.minCameraX).toBe(400)

			// Zoom 0.5:
			const clampingZ05 = calculateCameraClamping(worldExtremes, viewportWidth, viewportHeight, 0.5)
			// minCameraX = 400 - 100 * 0.5 = 350
			// maxCameraX = 400 - (-100) * 0.5 = 450
			expect(clampingZ05.minCameraX).toBe(350)
			expect(clampingZ05.maxCameraX).toBe(450)
			// Leftmost tile at maxCameraX: -100 * 0.5 + 450 = 400 (screen center)
			expect(-100 * 0.5 + clampingZ05.maxCameraX).toBe(400)
		})

		it('handles single-tile map or zero dimensions without inverted bounds', () => {
			const extremes = getIsoWorldExtremes([], null, 64, 32, 16)
			const clamping = calculateCameraClamping(extremes, 1920, 1080, 1.5)
			expect(clamping.minCameraX).toBe(1920 / 2)
			expect(clamping.maxCameraX).toBe(1920 / 2)
			expect(clamping.minCameraY).toBe(1080 / 2)
			expect(clamping.maxCameraY).toBe(1080 / 2)
		})
	})

	describe('directional and anchor bounds calculation', () => {
		const baseBounds = { minX: -5, maxX: 5, minY: -5, maxY: 5 } // 11x11

		it('expands bounds in specific directions preserving world origin (0, 0)', () => {
			// Expand 5 tiles to the East (+X): only maxX increases
			const eastExpanded = calculateDirectionalBounds(baseBounds, { east: 5 })
			expect(eastExpanded.minX).toBe(-5)
			expect(eastExpanded.maxX).toBe(10)
			expect(eastExpanded.minY).toBe(-5)
			expect(eastExpanded.maxY).toBe(5)
			expect(eastExpanded.gridWidth).toBe(16)
			expect(eastExpanded.gridHeight).toBe(11)

			// Expand 3 tiles to the North (-Y): only minY decreases
			const northExpanded = calculateDirectionalBounds(baseBounds, { north: 3 })
			expect(northExpanded.minX).toBe(-5)
			expect(northExpanded.maxX).toBe(5)
			expect(northExpanded.minY).toBe(-8)
			expect(northExpanded.maxY).toBe(5)
			expect(northExpanded.gridWidth).toBe(11)
			expect(northExpanded.gridHeight).toBe(14)

			// Shrink 2 tiles from West (-X): minX increases
			const westShrunk = calculateDirectionalBounds(baseBounds, { west: -2 })
			expect(westShrunk.minX).toBe(-3)
			expect(westShrunk.maxX).toBe(5)
			expect(westShrunk.gridWidth).toBe(9)
		})

		it('calculates anchor bounds for top-left anchor', () => {
			// Top-left fixes minX and minY, expands rightward and downward
			const res = calculateAnchorBounds(baseBounds, 15, 13, 'top-left')
			expect(res.minX).toBe(-5)
			expect(res.maxX).toBe(9) // -5 + 15 - 1
			expect(res.minY).toBe(-5)
			expect(res.maxY).toBe(7) // -5 + 13 - 1
			expect(res.gridWidth).toBe(15)
			expect(res.gridHeight).toBe(13)
		})

		it('calculates anchor bounds for bottom-right anchor', () => {
			// Bottom-right fixes maxX and maxY, expands leftward and upward
			const res = calculateAnchorBounds(baseBounds, 15, 13, 'bottom-right')
			expect(res.maxX).toBe(5)
			expect(res.minX).toBe(-9) // 5 - 15 + 1
			expect(res.maxY).toBe(5)
			expect(res.minY).toBe(-7) // 5 - 13 + 1
			expect(res.gridWidth).toBe(15)
			expect(res.gridHeight).toBe(13)
		})

		it('calculates anchor bounds for center anchor (symmetric expansion)', () => {
			const res = calculateAnchorBounds(baseBounds, 15, 15, 'center')
			expect(res.minX).toBe(-7)
			expect(res.maxX).toBe(7)
			expect(res.minY).toBe(-7)
			expect(res.maxY).toBe(7)
			expect(res.gridWidth).toBe(15)
			expect(res.gridHeight).toBe(15)
		})

		it('supports even and odd dimensions seamlessly', () => {
			const res = calculateAnchorBounds(baseBounds, 12, 10, 'top-left')
			expect(res.gridWidth).toBe(12)
			expect(res.gridHeight).toBe(10)
			expect(res.minX).toBe(-5)
			expect(res.maxX).toBe(6) // 6 - (-5) + 1 = 12
			expect(res.minY).toBe(-5)
			expect(res.maxY).toBe(4) // 4 - (-5) + 1 = 10
		})
	})
})


