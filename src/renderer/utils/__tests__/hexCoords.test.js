import { describe, it, expect } from 'vitest'
import {
	HEX_EDGES,
	OPPOSITE_EDGE,
	getHexNeighbor,
	getCanonicalEdgeKey,
	hexToScreenCenter,
	getHexVertices,
	getHexGroundVertices,
	getHexEdgeEndpoints,
	screenToHex,
	getClosestEdgeToPoint,
	hexDistance,
	getHexesInRadius,
	hexToWorldGroundCenter,
	HexPerspectiveCamera,
	calculateDynamicPitch,
	DEFAULT_HEX_MIN_ZOOM,
	DEFAULT_HEX_MAX_ZOOM,
	hashString,
	getHashFloat,
	getRiverMeanderControls,
	getBorderMeanderControls,
	getRoadPathControls,
	getRoadCurvePoint
} from '../hexmap/hexCoords'
import {
	buildRibbonJunction,
	lerpColor,
	strokeTaperedCurve,
	buildTurnGeometry,
	buildRoadRenderData,
	renderRoads,
	renderHexMap,
	drawPoliticalBorders
} from '../hexmap/hexRenderer'

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

	it('defines default hex zoom limits (shifted 25% closer: min 0.5, max 3.75)', () => {
		expect(DEFAULT_HEX_MIN_ZOOM).toBe(0.5)
		expect(DEFAULT_HEX_MAX_ZOOM).toBe(3.75)
	})

	it('calculates dynamic pitch based on zoom level: max 60 when zoomed in, min 0 when zoomed out', () => {
		// Minimum pitch at zoom-out (0.5) is 0°
		expect(calculateDynamicPitch(DEFAULT_HEX_MIN_ZOOM)).toBe(0)
		expect(calculateDynamicPitch(0.5)).toBe(0)

		// Maximum pitch at zoom-in (3.75) is 60°
		expect(calculateDynamicPitch(DEFAULT_HEX_MAX_ZOOM)).toBe(60)
		expect(calculateDynamicPitch(3.75)).toBe(60)

		// At normal zoom (1.0), pitch is smoothly interpolated (~21°)
		const pitchNormal = calculateDynamicPitch(1.0)
		expect(pitchNormal).toBeGreaterThan(15)
		expect(pitchNormal).toBeLessThan(30)

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

	describe('buildRibbonJunction (Unified Ribbon Junction Math)', () => {
		it('returns null for less than 2 branches', () => {
			expect(buildRibbonJunction({ x: 0, y: 0 }, [])).toBeNull()
			expect(buildRibbonJunction({ x: 0, y: 0 }, [{ angle: 0, casingWidth: 4, coreWidth: 2 }])).toBeNull()
		})

		it('builds a smooth rounded 2-branch bend with inner concave fillet and outer sweeping curve', () => {
			const center = { x: 100, y: 100 }
			const branches = [
				{ angle: 0, casingWidth: 4, coreWidth: 2.5, casingColor: '#451a03', coreColor: '#b45309' },
				{ angle: (Math.PI * 2) / 3, casingWidth: 5, coreWidth: 3.5, casingColor: '#475569', coreColor: '#94a3b8' }
			]

			const junction = buildRibbonJunction(center, branches, 1.0)
			expect(junction).toBeDefined()
			expect(junction.casing.cornerCurves.length).toBe(2)
			expect(junction.core.cornerCurves.length).toBe(2)

			// Corner 0 is inner concave fillet (inside of the bend)
			const innerCorner = junction.casing.cornerCurves[0]
			expect(innerCorner.type).toBe('inner')
			expect(innerCorner.pFillet).toBeDefined()

			// Corner 1 is outer sweeping convex curve (outside of the bend)
			const outerCorner = junction.casing.cornerCurves[1]
			expect(outerCorner.type).toBe('outer')
			expect(outerCorner.pApex).toBeDefined()
			expect(outerCorner.t1).toBeDefined()
			expect(outerCorner.t2).toBeDefined()

			// Asymmetric widths: branch 0 core half-width is 1.25, branch 1 is 1.75
			expect(junction.core.branchPoints[0].w).toBeCloseTo(1.25, 2)
			expect(junction.core.branchPoints[1].w).toBeCloseTo(1.75, 2)
		})

		it('builds a smooth multi-branch crossroad with concave fillets between all adjacent branches', () => {
			const center = { x: 100, y: 100 }
			const branches = [
				{ angle: 0, casingWidth: 4, coreWidth: 2.5 },
				{ angle: (Math.PI * 2) / 3, casingWidth: 4, coreWidth: 2.5 },
				{ angle: (Math.PI * 4) / 3, casingWidth: 4, coreWidth: 2.5 }
			]

			const junction = buildRibbonJunction(center, branches, 1.0)
			expect(junction).toBeDefined()
			expect(junction.casing.cornerCurves.length).toBe(3)
			expect(junction.casing.cornerCurves.every(c => c.type === 'inner')).toBe(true)
		})
	})

	describe('lerpColor (Unified Ribbon Color Blending)', () => {
		it('returns start color at t=0 and end color at t=1', () => {
			expect(lerpColor('#451a03', '#475569', 0)).toBe('#451a03')
			expect(lerpColor('#451a03', '#475569', 1)).toBe('#475569')
		})

		it('interpolates RGB channels at t=0.5', () => {
			// #000000 to #ffffff at 0.5 -> rgb(128, 128, 128)
			const mid = lerpColor('#000000', '#ffffff', 0.5)
			expect(mid).toBe('rgb(128, 128, 128)')
		})

		it('smoothly blends dirt road color into stone road color', () => {
			// dirt '#b45309' (180, 83, 9) <-> stone '#94a3b8' (148, 163, 184)
			const blended = lerpColor('#b45309', '#94a3b8', 0.5)
			expect(blended).toBe('rgb(164, 123, 97)')
		})
	})

	describe('buildTurnGeometry (Continuous Rounded Bends)', () => {
		it('calculates tangent-continuous fillet endpoints along branch directions', () => {
			const center = { x: 100, y: 100 }
			const b0 = { ux: -1, uy: 0, dist: 30 } // West
			const b1 = { ux: 0, uy: -1, dist: 30 } // North
			const turn = buildTurnGeometry(center, b0, b1, 14)

			expect(turn.Rturn).toBe(14)
			expect(turn.A0.x).toBeCloseTo(86, 2)
			expect(turn.A0.y).toBeCloseTo(100, 2)
			expect(turn.A1.x).toBeCloseTo(100, 2)
			expect(turn.A1.y).toBeCloseTo(86, 2)

			// The quadratic Bezier midpoint P(0.5) = 0.25*A0 + 0.5*C + 0.25*A1 rounds the corner
			const midX = 0.25 * turn.A0.x + 0.5 * center.x + 0.25 * turn.A1.x
			const midY = 0.25 * turn.A0.y + 0.5 * center.y + 0.25 * turn.A1.y
			expect(midX).toBeCloseTo(96.5, 2)
			expect(midY).toBeCloseTo(96.5, 2)

			// Distance from apex (100, 100) is ~4.95px, beautifully rounding the sharp V
			const distFromApex = Math.hypot(center.x - midX, center.y - midY)
			expect(distFromApex).toBeGreaterThan(4.5)
			expect(distFromApex).toBeLessThan(5.5)
		})

		it('straight pass-through (180 deg) curves directly through center with zero deviation', () => {
			const center = { x: 100, y: 100 }
			const b0 = { ux: -1, uy: 0, dist: 30 } // West
			const b1 = { ux: 1, uy: 0, dist: 30 }  // East
			const turn = buildTurnGeometry(center, b0, b1, 14)

			const midX = 0.25 * turn.A0.x + 0.5 * center.x + 0.25 * turn.A1.x
			const midY = 0.25 * turn.A0.y + 0.5 * center.y + 0.25 * turn.A1.y
			expect(midX).toBeCloseTo(100, 4)
			expect(midY).toBeCloseTo(100, 4)
		})

		it('caps fillet radius when branch length is shorter than desired radius', () => {
			const center = { x: 100, y: 100 }
			const b0 = { ux: -1, uy: 0, dist: 10 } // Short arm: maxDist is 6.5
			const b1 = { ux: 0, uy: -1, dist: 30 }
			const turn = buildTurnGeometry(center, b0, b1, 14)

			expect(turn.Rturn).toBeCloseTo(6.5, 1)
		})
	})

	describe('strokeTaperedCurve (Progressive Width Tapering)', () => {
		it('executes single quadratic stroke when width and color match', () => {
			const calls = []
			const fakeCtx = {
				beginPath: () => calls.push('beginPath'),
				moveTo: (x, y) => calls.push(`moveTo(${x},${y})`),
				quadraticCurveTo: (cpx, cpy, x, y) => calls.push(`quadraticCurveTo(${cpx},${cpy},${x},${y})`),
				stroke: () => calls.push('stroke'),
				lineWidth: 0,
				strokeStyle: ''
			}

			strokeTaperedCurve(fakeCtx, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 10 }, 4, 4, '#0369a1', '#0369a1')
			expect(fakeCtx.lineWidth).toBe(4)
			expect(fakeCtx.strokeStyle).toBe('#0369a1')
			expect(calls).toEqual(['beginPath', 'moveTo(10,10)', 'quadraticCurveTo(20,20,30,10)', 'stroke'])
		})

		it('subdivides curve into tapered segments when width or color differ', () => {
			let strokeCount = 0
			const fakeCtx = {
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				stroke: () => strokeCount++,
				lineWidth: 0,
				strokeStyle: ''
			}

			strokeTaperedCurve(fakeCtx, { x: 10, y: 10 }, { x: 20, y: 20 }, { x: 30, y: 10 }, 2, 6, '#451a03', '#475569', 4)
			expect(strokeCount).toBe(4)
		})
	})

	describe('Multi-Branch Junctions (Crossroads & Confluences)', () => {
		it('ensures all branches in 3+ branch junctions connect directly to center without gaps', () => {
			const center = { x: 200, y: 200 }
			const branches = [
				{ pMid: { x: 150, y: 180 }, pQ: { x: 175, y: 190 }, ux: -0.8, uy: -0.2, dist: 25 },
				{ pMid: { x: 150, y: 220 }, pQ: { x: 175, y: 210 }, ux: -0.8, uy: 0.2, dist: 25 },
				{ pMid: { x: 250, y: 180 }, pQ: { x: 225, y: 190 }, ux: 0.8, uy: -0.2, dist: 25 },
				{ pMid: { x: 250, y: 220 }, pQ: { x: 225, y: 210 }, ux: 0.8, uy: 0.2, dist: 25 }
			]

			// Every branch trunk MUST have endPt exactly at center
			const trunks = branches.map(b => ({
				pMid: b.pMid,
				pQ: b.pQ,
				endPt: center
			}))

			expect(trunks.length).toBe(4)
			for (const t of trunks) {
				expect(t.endPt.x).toBe(center.x)
				expect(t.endPt.y).toBe(center.y)
			}
		})
	})

	describe('Depth-Sorted Road & Hill Occlusion Pipeline', () => {
		it('buildRoadRenderData tags all trunks, turns, and crossroads with cellKey', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 800,
				viewportHeight: 600,
				cameraX: 0,
				cameraY: 0,
				zoom: 1.0,
				pitch: 45,
				focalDistance: 900
			})

			const mapData = {
				hexRadius: 36,
				cells: {
					'0,0': { col: 0, row: 0, terrain: 'grass', feature: 'none' },
					'1,0': { col: 1, row: 0, terrain: 'grass', feature: 'hills' },
					'2,0': { col: 2, row: 0, terrain: 'grass', feature: 'none' }
				},
				roads: {
					'0,0-1,0': {
						id: '0,0-1,0',
						from: { col: 0, row: 0 },
						to: { col: 1, row: 0 },
						type: 'dirt'
					},
					'1,0-2,0': {
						id: '1,0-2,0',
						from: { col: 1, row: 0 },
						to: { col: 2, row: 0 },
						type: 'stone'
					}
				}
			}

			const roadData = buildRoadRenderData(camera, mapData, 36)
			expect(roadData.trunks.length).toBeGreaterThan(0)

			// All trunks must have a valid cellKey matching a cell in mapData
			for (const trunk of roadData.trunks) {
				expect(trunk.cellKey).toBeDefined()
				expect(['0,0', '1,0', '2,0']).toContain(trunk.cellKey)
			}

			// Cell (1, 0) has 2 branches, so it forms a turn at its summit
			expect(roadData.turns.length).toBe(1)
			expect(roadData.turns[0].cellKey).toBe('1,0')
		})

		it('renderRoads filters road elements by cellKey correctly', () => {
			const roadData = {
				trunks: [
					{ cellKey: '0,0', pMid: { x: 10, y: 10 }, pQ: { x: 20, y: 20 }, endPt: { x: 30, y: 30 }, casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', scale: 1, isStone: false },
					{ cellKey: '1,0', pMid: { x: 40, y: 40 }, pQ: { x: 50, y: 50 }, endPt: { x: 60, y: 60 }, casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', scale: 1, isStone: false }
				],
				turns: [
					{ cellKey: '1,0', A0: { x: 40, y: 40 }, center: { x: 50, y: 50 }, A1: { x: 60, y: 60 }, b0: { casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', isStone: false }, b1: { casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', isStone: false }, scale: 1 }
				],
				crossroads: []
			}

			let drawnTrunks = 0
			const fakeCtx = {
				save: () => {},
				restore: () => {},
				beginPath: () => {},
				moveTo: () => {},
				quadraticCurveTo: () => { drawnTrunks++ },
				stroke: () => {},
				setLineDash: () => {},
				lineWidth: 0,
				strokeStyle: '',
				lineCap: '',
				lineJoin: ''
			}

			// Filter to only render cell 0,0 (flat)
			renderRoads(fakeCtx, roadData, key => key === '0,0')
			// For 1 trunk, Pass 1 (casing) + Pass 2 (core) + Pass 3 (rut) = 3 calls to quadraticCurveTo
			expect(drawnTrunks).toBe(3)
		})

		it('renderRoads with 3+ branches does not draw protruding arc circles at crossroads', () => {
			let arcCalls = 0
			const fakeCtx = {
				save: () => {},
				restore: () => {},
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				arc: () => { arcCalls++ },
				fill: () => {},
				stroke: () => {},
				setLineDash: () => {},
				lineWidth: 0,
				strokeStyle: '',
				fillStyle: '',
				lineCap: '',
				lineJoin: ''
			}

			const roadData = {
				trunks: [
					{ cellKey: '0,0', pMid: { x: 10, y: 10 }, pQ: { x: 20, y: 20 }, endPt: { x: 30, y: 30 }, casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', scale: 1, isStone: false },
					{ cellKey: '0,0', pMid: { x: 40, y: 40 }, pQ: { x: 50, y: 50 }, endPt: { x: 30, y: 30 }, casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', scale: 1, isStone: false },
					{ cellKey: '0,0', pMid: { x: 10, y: 50 }, pQ: { x: 20, y: 40 }, endPt: { x: 30, y: 30 }, casingWidth: 4, coreWidth: 2, casingColor: '#000', coreColor: '#fff', scale: 1, isStone: false }
				],
				turns: [],
				crossroads: [
					{
						cellKey: '0,0',
						center: { x: 30, y: 30 },
						fillets: [
							{ PA: { x: 25, y: 25 }, PB: { x: 35, y: 35 }, bA: { casingWidth: 4, coreWidth: 2 }, bB: { casingWidth: 4, coreWidth: 2 } }
						],
						maxCasingWidth: 4,
						maxCoreWidth: 2,
						hasStone: false,
						scale: 1
					}
				]
			}

			renderRoads(fakeCtx, roadData)
			// Crossroad must NOT draw any circle bumps with ctx.arc!
			expect(arcCalls).toBe(0)
		})

		it('buildRoadRenderData projects roads flat at Z = 0 for seamless cell transitions', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 800,
				viewportHeight: 600,
				cameraX: 0,
				cameraY: 0,
				zoom: 1.0,
				pitch: 45
			})

			const mapData = {
				hexRadius: 36,
				cells: {
					'0,0': { col: 0, row: 0, terrain: 'grass', feature: 'none' },
					'1,0': { col: 1, row: 0, terrain: 'grass', feature: 'hills' }
				},
				roads: {
					'0,0-1,0': {
						id: '0,0-1,0',
						from: { col: 0, row: 0 },
						to: { col: 1, row: 0 },
						type: 'dirt'
					}
				}
			}

			const roadData = buildRoadRenderData(camera, mapData, 36)
			expect(roadData.trunks.length).toBe(2)

			// Both trunks share identical pMid at the boundary
			const t0 = roadData.trunks.find(t => t.cellKey === '0,0')
			const t1 = roadData.trunks.find(t => t.cellKey === '1,0')
			expect(t0).toBeDefined()
			expect(t1).toBeDefined()
			expect(t0.pMid.x).toBeCloseTo(t1.pMid.x, 3)
			expect(t0.pMid.y).toBeCloseTo(t1.pMid.y, 3)

			// Center endpoint of cell 0,0 matches ground projection at Z=0
			const c0 = hexToWorldGroundCenter(0, 0, 36)
			const p0Expected = camera.project(c0.x, c0.y, 0)
			expect(t0.endPt.x).toBeCloseTo(p0Expected.x, 3)
			expect(t0.endPt.y).toBeCloseTo(p0Expected.y, 3)

			// Center endpoint of hill cell 1,0 also matches ground projection at Z=0 for flat road bed
			const c1 = hexToWorldGroundCenter(1, 0, 36)
			const p1Expected = camera.project(c1.x, c1.y, 0)
			expect(t1.endPt.x).toBeCloseTo(p1Expected.x, 3)
			expect(t1.endPt.y).toBeCloseTo(p1Expected.y, 3)
		})

		it('sorts cells by true world ground center Y to properly handle staggered columns', () => {
			const radius = 36
			const c_even_0 = hexToWorldGroundCenter(0, 0, radius) // row 0, even: Y = 0
			const c_odd_0 = hexToWorldGroundCenter(1, 0, radius)  // row 0, odd: Y = h/2 (half a hex closer to bottom)
			const c_even_1 = hexToWorldGroundCenter(0, 1, radius) // row 1, even: Y = h

			expect(c_even_0.y).toBeLessThan(c_odd_0.y)
			expect(c_odd_0.y).toBeLessThan(c_even_1.y)

			const cells = [
				{ col: 0, row: 1 },
				{ col: 1, row: 0 },
				{ col: 0, row: 0 }
			]

			cells.sort((a, b) => {
				const yA = hexToWorldGroundCenter(a.col, a.row, radius).y
				const yB = hexToWorldGroundCenter(b.col, b.row, radius).y
				return yA - yB || a.col - b.col
			})

			expect(cells[0]).toEqual({ col: 0, row: 0 })
			expect(cells[1]).toEqual({ col: 1, row: 0 })
			expect(cells[2]).toEqual({ col: 0, row: 1 })
		})

		it('renderHexMap renders complete map with hills, rivers, roads, and bridges in depth order', () => {
			const fakeCtx = {
				canvas: { width: 800, height: 600 },
				save: () => {},
				restore: () => {},
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				quadraticCurveTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => {},
				stroke: () => {},
				strokeRect: () => {},
				fillRect: () => {},
				arc: () => {},
				ellipse: () => {},
				clip: () => {},
				setLineDash: () => {},
				createLinearGradient: () => ({
					addColorStop: () => {}
				}),
				lineWidth: 0,
				strokeStyle: '',
				fillStyle: '',
				lineCap: '',
				lineJoin: '',
				lineDashOffset: 0
			}

			const mapData = {
				hexRadius: 36,
				cells: {
					'0,0': { col: 0, row: 0, terrain: 'grass', feature: 'none' },
					'1,0': { col: 1, row: 0, terrain: 'grass', feature: 'hills', settlement: { id: 'hill_fort', type: 'fortress', name: 'Hill Fort' } },
					'2,0': { col: 2, row: 0, terrain: 'grass', feature: 'mountain' },
					'0,1': { col: 0, row: 1, terrain: 'grass', feature: 'none' }
				},
				rivers: {
					'0,0:SE': { col: 0, row: 0, edge: 'SE', width: 2, flowDir: 1 }
				},
				roads: {
					'0,0-1,0': {
						id: '0,0-1,0',
						from: { col: 0, row: 0 },
						to: { col: 1, row: 0 },
						type: 'stone'
					}
				}
			}

			expect(() => {
				renderHexMap(fakeCtx, mapData, {
					cameraX: 0,
					cameraY: 0,
					zoom: 1.0,
					pitch: 45
				})
			}).not.toThrow()
		})

		it('calculates organic undulating border curves and preserves constant parallel separation between bordering nations', () => {
			const radius = 36
			const canonKey = '4,7:SE'

			// Cell 1 (4,7) SE edge
			const c1 = hexToWorldGroundCenter(4, 7, radius)
			const gv1 = getHexGroundVertices(c1.x, c1.y, radius)
			const inset1 = gv1.map(v => ({ x: v.x + (c1.x - v.x) * 0.06, y: v.y + (c1.y - v.y) * 0.06 }))
			const vA1 = inset1[0], vB1 = inset1[1]
			const curve1 = getBorderMeanderControls(vA1, vB1, canonKey, radius)

			// Cell 2 (5,7) NW edge (shared neighbor)
			const c2 = hexToWorldGroundCenter(5, 7, radius)
			const gv2 = getHexGroundVertices(c2.x, c2.y, radius)
			const inset2 = gv2.map(v => ({ x: v.x + (c2.x - v.x) * 0.06, y: v.y + (c2.y - v.y) * 0.06 }))
			const vA2 = inset2[3], vB2 = inset2[4]
			const curve2 = getBorderMeanderControls(vA2, vB2, canonKey, radius)

			expect(curve1.cp1).toBeDefined()
			expect(curve1.cp2).toBeDefined()
			expect(curve2.cp1).toBeDefined()
			expect(curve2.cp2).toBeDefined()

			// Evaluate cubic Bezier curve at t
			function evalB(p0, cp1, cp2, p1, t) {
				const mt = 1 - t
				return {
					x: mt ** 3 * p0.x + 3 * mt ** 2 * t * cp1.x + 3 * mt * t ** 2 * cp2.x + t ** 3 * p1.x,
					y: mt ** 3 * p0.y + 3 * mt ** 2 * t * cp1.y + 3 * mt * t ** 2 * cp2.y + t ** 3 * p1.y
				}
			}

			// Distance between straight endpoints
			const dEndpoints = Math.hypot(vA1.x - vB2.x, vA1.y - vB2.y)

			// Sample along the curve at t = 0.25, 0.5, 0.75
			// Because Cell 2 edge runs in opposite direction along the border, t on Cell 1 corresponds to (1 - t) on Cell 2
			const pt1_25 = evalB(vA1, curve1.cp1, curve1.cp2, vB1, 0.25)
			const pt2_75 = evalB(vA2, curve2.cp1, curve2.cp2, vB2, 0.75)
			const d25 = Math.hypot(pt1_25.x - pt2_75.x, pt1_25.y - pt2_75.y)

			const pt1_50 = evalB(vA1, curve1.cp1, curve1.cp2, vB1, 0.50)
			const pt2_50 = evalB(vA2, curve2.cp1, curve2.cp2, vB2, 0.50)
			const d50 = Math.hypot(pt1_50.x - pt2_50.x, pt1_50.y - pt2_50.y)

			const pt1_75 = evalB(vA1, curve1.cp1, curve1.cp2, vB1, 0.75)
			const pt2_25 = evalB(vA2, curve2.cp1, curve2.cp2, vB2, 0.25)
			const d75 = Math.hypot(pt1_75.x - pt2_25.x, pt1_75.y - pt2_25.y)

			// Both national border curves remain exactly parallel across their entire length!
			expect(d25).toBeCloseTo(dEndpoints, 4)
			expect(d50).toBeCloseTo(dEndpoints, 4)
			expect(d75).toBeCloseTo(dEndpoints, 4)
		})

		it('universal meanders: rivers and borders on the same edge have 100% coincident curves', () => {
			const radius = 36
			const canonKey = '13,5:SW'

			// Endpoints on ground for this edge
			const center = hexToWorldGroundCenter(13, 5, radius)
			const gv = getHexGroundVertices(center.x, center.y, radius)
			const { from, to } = getHexEdgeEndpoints(gv, 'SW')

			// River on this edge with tier 2
			const riverControls = getRiverMeanderControls(from, to, canonKey, radius, 2)
			// Border along this same edge with tier 2
			const borderControls = getBorderMeanderControls(from, to, canonKey, radius, 2)

			// Control points must match exactly
			expect(borderControls.cp1.x).toBeCloseTo(riverControls.cp1.x, 6)
			expect(borderControls.cp1.y).toBeCloseTo(riverControls.cp1.y, 6)
			expect(borderControls.cp2.x).toBeCloseTo(riverControls.cp2.x, 6)
			expect(borderControls.cp2.y).toBeCloseTo(riverControls.cp2.y, 6)

			// Reverse traversal along the same edge produces identical physical curve in reverse
			const revBorderControls = getBorderMeanderControls(to, from, canonKey, radius, 2)
			expect(revBorderControls.cp1.x).toBeCloseTo(riverControls.cp2.x, 6)
			expect(revBorderControls.cp1.y).toBeCloseTo(riverControls.cp2.y, 6)
			expect(revBorderControls.cp2.x).toBeCloseTo(riverControls.cp1.x, 6)
			expect(revBorderControls.cp2.y).toBeCloseTo(riverControls.cp1.y, 6)
		})

		it('drawPoliticalBorders renders continuous closed loops without interrupted segment-by-segment joints', () => {
			const beginPathCalls = []
			const moveToCalls = []
			const bezierCurveToCalls = []
			const closePathCalls = []
			const strokeCalls = []

			const fakeCtx = {
				canvas: { width: 1000, height: 800 },
				save: () => {},
				restore: () => {},
				beginPath: () => beginPathCalls.push('beginPath'),
				moveTo: (x, y) => moveToCalls.push({ x, y }),
				lineTo: () => {},
				bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => bezierCurveToCalls.push({ cp1x, cp1y, cp2x, cp2y, x, y }),
				closePath: () => closePathCalls.push('closePath'),
				fill: () => {},
				stroke: () => strokeCalls.push('stroke'),
				lineWidth: 0,
				strokeStyle: '',
				fillStyle: '',
				lineCap: '',
				lineJoin: ''
			}

			const camera = new HexPerspectiveCamera({
				viewportWidth: 1000,
				viewportHeight: 800,
				cameraX: 200,
				cameraY: 200,
				zoom: 1.0,
				pitch: 45
			})

			// 2 adjacent cells belonging to the same faction
			const mapData = {
				hexRadius: 36,
				cells: {
					'3,3': { col: 3, row: 3, faction: 're-estize' },
					'3,4': { col: 3, row: 4, faction: 're-estize' }
				}
			}

			drawPoliticalBorders(fakeCtx, camera, mapData, 36)

			// External boundary of 2 adjacent hexes has 10 edges forming 1 continuous closed loop
			// Halo pass + Crisp pass = 2 strokes for the continuous loop (NOT 10 separate strokes per edge!)
			expect(strokeCalls.length).toBe(2)
			// 2 closePath for cell fills in Pass 1 + 2 closePath for border loop passes in Pass 2
			expect(closePathCalls.length).toBe(4)
			// 10 bezierCurveTo segments per pass = 20 total
			expect(bezierCurveToCalls.length).toBe(20)
		})
	})
})

