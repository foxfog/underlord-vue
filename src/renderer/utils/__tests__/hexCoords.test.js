import { describe, it, expect } from 'vitest'
import {
	HEX_EDGES,
	OPPOSITE_EDGE,
	getHexNeighbor,
	getCanonicalEdgeKey,
	hexToScreenCenter,
	getHexVertices,
	getHexEdgeEndpoints,
	screenToHex,
	getClosestEdgeToPoint,
	hexDistance,
	getHexesInRadius,
	hexToWorldGroundCenter,
	HexPerspectiveCamera,
	calculateDynamicPitch,
	hashString,
	getHashFloat,
	getRiverMeanderControls,
	getRoadPathControls,
	getRoadCurvePoint
} from '../hexmap/hexCoords'

describe('HexCoords Flat-Topped Math & Geometry', () => {
	it('defines 6 canonical flat-topped edges', () => {
		expect(HEX_EDGES).toEqual(['N', 'NE', 'SE', 'S', 'SW', 'NW'])
		expect(OPPOSITE_EDGE.N).toBe('S')
		expect(OPPOSITE_EDGE.S).toBe('N')
		expect(OPPOSITE_EDGE.NE).toBe('SW')
		expect(OPPOSITE_EDGE.SW).toBe('NE')
		expect(OPPOSITE_EDGE.SE).toBe('NW')
		expect(OPPOSITE_EDGE.NW).toBe('SE')
	})

	it('computes neighbors for even columns correctly', () => {
		const col = 2, row = 2
		expect(getHexNeighbor(col, row, 'N')).toEqual({ col: 2, row: 1 })
		expect(getHexNeighbor(col, row, 'S')).toEqual({ col: 2, row: 3 })
		expect(getHexNeighbor(col, row, 'NE')).toEqual({ col: 3, row: 1 })
		expect(getHexNeighbor(col, row, 'SE')).toEqual({ col: 3, row: 2 })
		expect(getHexNeighbor(col, row, 'SW')).toEqual({ col: 1, row: 2 })
		expect(getHexNeighbor(col, row, 'NW')).toEqual({ col: 1, row: 1 })
	})

	it('computes neighbors for odd columns correctly', () => {
		const col = 3, row = 2
		expect(getHexNeighbor(col, row, 'N')).toEqual({ col: 3, row: 1 })
		expect(getHexNeighbor(col, row, 'S')).toEqual({ col: 3, row: 3 })
		expect(getHexNeighbor(col, row, 'NE')).toEqual({ col: 4, row: 2 })
		expect(getHexNeighbor(col, row, 'SE')).toEqual({ col: 4, row: 3 })
		expect(getHexNeighbor(col, row, 'SW')).toEqual({ col: 2, row: 3 })
		expect(getHexNeighbor(col, row, 'NW')).toEqual({ col: 2, row: 2 })
	})

	it('canonical edge keys match symmetrically from either side of an edge', () => {
		const c1 = 2, r1 = 2
		const neighbor = getHexNeighbor(c1, r1, 'NE')
		const c2 = neighbor.col, r2 = neighbor.row

		const keyFrom1 = getCanonicalEdgeKey(c1, r1, 'NE')
		const keyFrom2 = getCanonicalEdgeKey(c2, r2, 'SW')
		expect(keyFrom1).toBe(keyFrom2)
	})

	it('calculates flat-topped vertices with horizontal N and S edges', () => {
		const radius = 30
		const tilt = 0.7
		const vertices = getHexVertices(100, 100, radius, tilt)

		expect(vertices).toHaveLength(6)

		// N edge connects vertex 4 (Top-Left) and vertex 5 (Top-Right)
		const nEdge = getHexEdgeEndpoints(vertices, 'N')
		expect(nEdge.from.y).toBeCloseTo(nEdge.to.y, 4) // Strictly horizontal!

		// S edge connects vertex 2 (Bottom-Left) and vertex 1 (Bottom-Right)
		const sEdge = getHexEdgeEndpoints(vertices, 'S')
		expect(sEdge.from.y).toBeCloseTo(sEdge.to.y, 4) // Strictly horizontal!
	})

	it('round-trips screenToHex accurately', () => {
		const radius = 36
		const tilt = 0.7
		for (let c = 0; c <= 4; c++) {
			for (let r = 0; r <= 4; r++) {
				const center = hexToScreenCenter(c, r, radius, tilt)
				const recovered = screenToHex(center.x, center.y, radius, tilt)
				expect(recovered).toEqual({ col: c, row: r })
			}
		}
	})

	it('calculates hex distance correctly', () => {
		expect(hexDistance(0, 0, 0, 0)).toBe(0)
		expect(hexDistance(0, 0, 0, 1)).toBe(1)
		expect(hexDistance(0, 0, 1, 0)).toBe(1)
		expect(hexDistance(0, 0, 0, 3)).toBe(3)
	})

	it('expands hexes in radius for mountain massifs', () => {
		// Radius 1: exactly 1 hex (center only)
		const r1 = getHexesInRadius(2, 2, 1)
		expect(r1).toHaveLength(1)
		expect(r1[0]).toEqual({ col: 2, row: 2, distance: 0 })

		// Radius 2: 1 center + 6 neighbors = 7 hexes
		const r2 = getHexesInRadius(2, 2, 2)
		expect(r2).toHaveLength(7)
		const centerInR2 = r2.find((h) => h.col === 2 && h.row === 2)
		expect(centerInR2.distance).toBe(0)
		const dist1Count = r2.filter((h) => h.distance === 1).length
		expect(dist1Count).toBe(6)

		// Radius 3: 1 + 6 + 12 = 19 hexes
		const r3 = getHexesInRadius(2, 2, 3)
		expect(r3).toHaveLength(19)
	})
})

describe('HexPerspectiveCamera 3D Perspective Projection & Parallax', () => {
	it('projects ground point at camera focus to viewport center', () => {
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 200,
			cameraY: 300,
			pitch: 45,
			zoom: 1.0
		})

		const p = camera.project(200, 300, 0)
		expect(p.x).toBeCloseTo(500, 2)
		expect(p.y).toBeCloseTo(400, 2)
		expect(p.scale).toBeCloseTo(1.0, 2)
	})

	it('round-trips project and unproject on ground plane', () => {
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1200,
			viewportHeight: 900,
			cameraX: 100,
			cameraY: 200,
			pitch: 45,
			zoom: 1.2
		})

		const testPoints = [
			{ wx: 100, wy: 200 },
			{ wx: 250, wy: 150 },
			{ wx: -50, wy: 280 },
			{ wx: 180, wy: 350 }
		]

		for (const pt of testPoints) {
			const proj = camera.project(pt.wx, pt.wy, 0)
			const unproj = camera.unproject(proj.x, proj.y)
			expect(unproj).not.toBeNull()
			expect(unproj.x).toBeCloseTo(pt.wx, 1)
			expect(unproj.y).toBeCloseTo(pt.wy, 1)
		}
	})

	it('mountain peak stands directly above base when centered, occluding object behind it', () => {
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 500,
			cameraY: 500,
			pitch: 45
		})

		const mountainGroundX = 500
		const mountainGroundY = 500
		const peakHeight = 40

		// Mountain base and peak
		const base = camera.project(mountainGroundX, mountainGroundY, 0)
		const peak = camera.project(mountainGroundX, mountainGroundY, peakHeight)

		// Base and peak have identical X when centered!
		expect(base.x).toBeCloseTo(peak.x, 2)
		// Peak is higher on screen (smaller Y)
		expect(peak.y).toBeLessThan(base.y)

		// Object directly behind the mountain on the ground (further North, Y = 460)
		const objectBehind = camera.project(mountainGroundX, 460, 0)
		// Object behind also has identical X, directly occluded behind the peak/base line!
		expect(objectBehind.x).toBeCloseTo(peak.x, 2)
		expect(objectBehind.y).toBeGreaterThanOrEqual(peak.y)
		expect(objectBehind.y).toBeLessThanOrEqual(base.y)
	})

	it('camera panning sideways tilts peak outward via lateral parallax, revealing object behind', () => {
		// Camera panned to the left (cameraX = 250), so mountain (X = 500) is on the right side of the screen
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 250,
			cameraY: 500,
			pitch: 45
		})

		const mountainGroundX = 500
		const mountainGroundY = 500
		const peakHeight = 40

		const base = camera.project(mountainGroundX, mountainGroundY, 0)
		const peak = camera.project(mountainGroundX, mountainGroundY, peakHeight)
		const objectBehind = camera.project(mountainGroundX, 460, 0)

		// Peak leans to the right (peak.x > base.x) because it has height Z > 0
		expect(peak.x).toBeGreaterThan(base.x)

		// Object behind has smaller X than the peak, revealing it from behind the mountain!
		expect(objectBehind.x).toBeLessThan(peak.x)
		const separationX = peak.x - objectBehind.x
		expect(separationX).toBeGreaterThan(5) // Clearly separated and visible!
	})

	it('mountain peak maintains upright billboard height and does not squash when pitch is 0', () => {
		const camera0 = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 500,
			cameraY: 500,
			pitch: 0
		})

		const camera60 = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 500,
			cameraY: 500,
			pitch: 60
		})

		const base0 = camera0.project(500, 500, 0)
		const peak0 = camera0.project(500, 500, 40)
		const height0 = base0.y - peak0.y

		const base60 = camera60.project(500, 500, 0)
		const peak60 = camera60.project(500, 500, 40)
		const height60 = base60.y - peak60.y

		// When pitch is 0, mountain has full upright elevation (height ~ 40px)
		expect(height0).toBeGreaterThan(35)
		// Mountain does not squash at pitch 0 compared to pitch 60
		expect(Math.abs(height0 - height60)).toBeLessThan(5)
	})

	it('adjusting pitch angle updates projection tilt correctly', () => {
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 0,
			cameraY: 0,
			pitch: 30
		})

		const p30 = camera.project(0, -100, 0)
		camera.setPitch(60)
		const p60 = camera.project(0, -100, 0)

		// Higher pitch foreshortens ground distances along Y (flatter view towards horizon)
		expect(Math.abs(p60.y - 400)).toBeLessThan(Math.abs(p30.y - 400))
	})

	it('calculates dynamic pitch based on zoom level: max 60 when zoomed in, min 0 when zoomed out', () => {
		// Minimum pitch at zoom-out (0.4) is 0°
		expect(calculateDynamicPitch(0.4)).toBe(0)

		// Maximum pitch at zoom-in (3.0) is 60°
		expect(calculateDynamicPitch(3.0)).toBe(60)

		// At normal zoom (1.0), pitch is smoothly interpolated (~27°)
		const pitchNormal = calculateDynamicPitch(1.0)
		expect(pitchNormal).toBeGreaterThan(20)
		expect(pitchNormal).toBeLessThan(35)

		// Clamps cleanly within [0, 60]
		expect(calculateDynamicPitch(0.1)).toBe(0)
		expect(calculateDynamicPitch(5.0)).toBe(60)
	})

	it('projectTerrain projects elevated terrain relief points with sin(pitch) scaling', () => {
		const camera = new HexPerspectiveCamera({
			viewportWidth: 1000,
			viewportHeight: 800,
			cameraX: 0,
			cameraY: 0,
			pitch: 0
		})

		// At pitch = 0 (top-down view), elevated terrain apex (Z = 16) stays at center (Y matches ground point)
		const ground0 = camera.projectTerrain(0, 0, 0)
		const hill0 = camera.projectTerrain(0, 0, 16)
		expect(hill0.x).toBeCloseTo(ground0.x, 2)
		expect(hill0.y).toBeCloseTo(ground0.y, 2)

		// At pitch = 45, elevated terrain point rises upward into the distance (smaller Y)
		camera.setPitch(45)
		const ground45 = camera.projectTerrain(0, 0, 0)
		const hill45 = camera.projectTerrain(0, 0, 16)
		expect(hill45.y).toBeLessThan(ground45.y)
	})

	it('hashString and getHashFloat produce deterministic pseudo-random values', () => {
		const key = '2,3:SE'
		const h1 = hashString(key)
		const h2 = hashString(key)
		expect(h1).toBe(h2)
		expect(typeof h1).toBe('number')

		const f1 = getHashFloat(h1, 1)
		const f2 = getHashFloat(h2, 1)
		expect(f1).toBe(f2)
		expect(f1).toBeGreaterThanOrEqual(-1.0)
		expect(f1).toBeLessThanOrEqual(1.0)

		// Different seed produces different pseudo-random value
		const fOther = getHashFloat(h1, 2)
		expect(f1).not.toBe(fOther)
	})

	it('getRiverMeanderControls calculates organic cubic Bezier control points', () => {
		const from = { x: 100, y: 100 }
		const to = { x: 136, y: 100 } // horizontal edge of length 36
		const canonKey = '2,3:N'
		const radius = 36

		const { cp1, cp2 } = getRiverMeanderControls(from, to, canonKey, radius)
		expect(cp1).toBeDefined()
		expect(cp2).toBeDefined()

		// Control points should be situated along the segment
		expect(cp1.x).toBeGreaterThan(from.x)
		expect(cp2.x).toBeGreaterThan(cp1.x)
		expect(cp2.x).toBeLessThan(to.x)

		// Control points should have lateral displacement (meander)
		const hasDisplacement = Math.abs(cp1.y - 100) > 0.5 || Math.abs(cp2.y - 100) > 0.5
		expect(hasDisplacement).toBe(true)

		// Calling again with same canonKey returns identical control points (determinism)
		const repeat = getRiverMeanderControls(from, to, canonKey, radius)
		expect(repeat.cp1.x).toBeCloseTo(cp1.x, 4)
		expect(repeat.cp1.y).toBeCloseTo(cp1.y, 4)
		expect(repeat.cp2.x).toBeCloseTo(cp2.x, 4)
		expect(repeat.cp2.y).toBeCloseTo(cp2.y, 4)
	})

	it('getRoadCurvePoint calculates organic quadratic Bezier midpoint with lateral bend', () => {
		const c1 = { x: 100, y: 100 }
		const c2 = { x: 160, y: 100 }
		const roadKey = '2,2:3,2'
		const radius = 36

		const mid = getRoadCurvePoint(c1, c2, roadKey, radius)
		expect(mid).toBeDefined()
		// Midpoint X is around half-way
		expect(mid.x).toBeCloseTo(130, 1)

		// Repeat returns identical midpoint (determinism)
		const repeatMid = getRoadCurvePoint(c1, c2, roadKey, radius)
		expect(repeatMid.x).toBeCloseTo(mid.x, 4)
		expect(repeatMid.y).toBeCloseTo(mid.y, 4)
	})

	it('getRiverMeanderControls scales meander amplitude inversely with tier (smaller tier = stronger winding)', () => {
		const from = { x: 100, y: 100 }
		const to = { x: 136, y: 100 }
		const canonKey = '4,5:SE'
		const radius = 36

		const tier1 = getRiverMeanderControls(from, to, canonKey, radius, 1)
		const tier2 = getRiverMeanderControls(from, to, canonKey, radius, 2)
		const tier3 = getRiverMeanderControls(from, to, canonKey, radius, 3)

		const disp1 = Math.abs(tier1.cp1.y - 100)
		const disp2 = Math.abs(tier2.cp1.y - 100)
		const disp3 = Math.abs(tier3.cp1.y - 100)

		// Tier 1 (brook) meanders more strongly than Tier 2, which meanders more than Tier 3 (broad river)
		expect(disp1).toBeGreaterThan(disp2)
		expect(disp2).toBeGreaterThan(disp3)
	})

	it('getRoadPathControls calculates C1-continuous shoulder controls and boundary midpoint', () => {
		const c1 = { x: 100, y: 100 }
		const c2 = { x: 160, y: 100 }
		const roadKey = '3,3:4,3'
		const radius = 36

		const { mid, cp1, cp2, tangent } = getRoadPathControls(c1, c2, roadKey, radius)
		expect(mid).toBeDefined()
		expect(cp1).toBeDefined()
		expect(cp2).toBeDefined()
		expect(tangent).toBeDefined()

		// Midpoint X is around half-way between 100 and 160
		expect(mid.x).toBeCloseTo(130, 1)

		// Shoulder control points cp1 and cp2 are collinear with mid directly in the middle
		const expectedMidX = (cp1.x + cp2.x) / 2
		const expectedMidY = (cp1.y + cp2.y) / 2
		expect(mid.x).toBeCloseTo(expectedMidX, 4)
		expect(mid.y).toBeCloseTo(expectedMidY, 4)

		// Determinism
		const repeat = getRoadPathControls(c1, c2, roadKey, radius)
		expect(repeat.mid.x).toBeCloseTo(mid.x, 4)
		expect(repeat.cp1.x).toBeCloseTo(cp1.x, 4)
	})
})

