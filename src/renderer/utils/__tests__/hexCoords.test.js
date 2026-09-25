import { describe, it, expect, vi } from 'vitest'
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
	getHexEdgeCurve,
	getOrganicCellPolygon,
	clearOrganicPolygonCache,
	getOrganicCellPerimeter,
	HEX_PERIMETER_EDGES,
	getOrganicGroundVertex,
	getOrganicHexGroundVertices,
	isCoastEdge,
	getBiomeTextureVariant,
	DEFAULT_TEXTURE_BLEED_RATIO,
	getRoadPathControls,
	getRoadCurvePoint,
	calculateDirectionalBounds,
	calculateAnchorBounds,
	getVisibleHexGridBounds
} from '../hexmap/hexCoords'
import {
	buildRibbonJunction,
	lerpColor,
	strokeTaperedCurve,
	buildTurnGeometry,
	buildRoadRenderData,
	renderRoads,
	renderHexMap,
	drawPoliticalBorders,
	isCellVisible
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

		it('getRiverMeanderControls maintains 100% strict mathematical symmetry in reverse traversal', () => {
			const radius = 36
			const canonKey = '13,5:SW'

			// Endpoints on ground for this edge
			const center = hexToWorldGroundCenter(13, 5, radius)
			const gv = getHexGroundVertices(center.x, center.y, radius)
			const { from, to } = getHexEdgeEndpoints(gv, 'SW')

			// River on this edge with tier 2
			const riverControls = getRiverMeanderControls(from, to, canonKey, radius, 2)
			const revRiverControls = getRiverMeanderControls(to, from, canonKey, radius, 2)

			// Reverse traversal along the same edge produces identical physical curve in reverse
			expect(revRiverControls.cp1.x).toBeCloseTo(riverControls.cp2.x, 6)
			expect(revRiverControls.cp1.y).toBeCloseTo(riverControls.cp2.y, 6)
			expect(revRiverControls.cp2.x).toBeCloseTo(riverControls.cp1.x, 6)
			expect(revRiverControls.cp2.y).toBeCloseTo(riverControls.cp1.y, 6)
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

			// 2 adjacent cells belonging to the same faction (tested with organic: true)
			const mapData = {
				hexRadius: 36,
				organic: true,
				cells: {
					'3,3': { col: 3, row: 3, faction: 're-estize' },
					'3,4': { col: 3, row: 4, faction: 're-estize' }
				}
			}

			drawPoliticalBorders(fakeCtx, camera, mapData, 36)

			// External boundary of 2 adjacent hexes has 10 edges forming 1 continuous closed loop
			// 2 inward halo passes (wide + mid) + 1 crisp pass = 3 strokes for the continuous loop
			expect(strokeCalls.length).toBe(3)
			// 2 closePath for cell fills in Pass 1 + 3 closePath for border loop passes in Pass 2
			expect(closePathCalls.length).toBe(5)
			// Multi-bend curves: 2 cells * 6 edges * 3 subsegments = 36 in Pass 1,
			// plus 10 external boundary edges * 3 subsegments * 3 passes = 90 in Pass 2 => 126 total
			expect(bezierCurveToCalls.length).toBe(126)
		})

		it('drawPoliticalBorders renders strict straight hexagonal grid when organic is false', () => {
			const beginPathCalls = []
			const moveToCalls = []
			const lineToCalls = []
			const bezierCurveToCalls = []
			const closePathCalls = []
			const strokeCalls = []

			const fakeCtx = {
				canvas: { width: 1000, height: 800 },
				save: () => {},
				restore: () => {},
				beginPath: () => beginPathCalls.push('beginPath'),
				moveTo: (x, y) => moveToCalls.push({ x, y }),
				lineTo: (x, y) => lineToCalls.push({ x, y }),
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

			// 2 adjacent cells belonging to the same faction (organic: false explicitly specified)
			const mapData = {
				hexRadius: 36,
				organic: false,
				cells: {
					'3,3': { col: 3, row: 3, faction: 're-estize' },
					'3,4': { col: 3, row: 4, faction: 're-estize' }
				}
			}

			drawPoliticalBorders(fakeCtx, camera, mapData, 36)

			// 2 inward halo passes (wide + mid) + 1 crisp pass = 3 strokes
			expect(strokeCalls.length).toBe(3)
			// 2 closePath for cell fills in Pass 1 + 3 closePath for border loop passes in Pass 2
			expect(closePathCalls.length).toBe(5)
			// Strict straight grid: zero bezier curves evaluated, only straight lines
			expect(bezierCurveToCalls.length).toBe(0)
			expect(lineToCalls.length).toBeGreaterThan(0)
		})

		it('drawPoliticalBorders supports separate pass 1 (fills only) and pass 2 (ribbons only)', () => {
			const strokeCalls = []
			const fillCalls = []

			const fakeCtx = {
				canvas: { width: 1000, height: 800 },
				save: () => {},
				restore: () => {},
				beginPath: () => {},
				moveTo: () => {},
				lineTo: () => {},
				bezierCurveTo: () => {},
				closePath: () => {},
				fill: () => fillCalls.push('fill'),
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

			const mapData = {
				hexRadius: 36,
				cells: {
					'3,3': { col: 3, row: 3, faction: 're-estize' },
					'3,4': { col: 3, row: 4, faction: 're-estize' }
				}
			}

			// Pass 1 only: fills only, zero strokes
			drawPoliticalBorders(fakeCtx, camera, mapData, 36, null, null, 1)
			expect(fillCalls.length).toBe(2) // 2 cells filled
			expect(strokeCalls.length).toBe(0) // 0 strokes

			// Pass 2 only: strokes only, zero fills
			fillCalls.length = 0
			strokeCalls.length = 0
			drawPoliticalBorders(fakeCtx, camera, mapData, 36, null, null, 2)
			expect(fillCalls.length).toBe(0) // 0 fills
			expect(strokeCalls.length).toBe(3) // 3 border ribbon strokes (wide halo + mid halo + crisp)
		})

		it('drawPoliticalBorders insets border ribbons inward into each nation creating dual parallel ribbons with semi-transparency', () => {
			const strokeStyles = []
			const curvesByColor = new Map()
			let currentSegments = []

			const fakeCtx = {
				canvas: { width: 1000, height: 800 },
				save: () => {},
				restore: () => {},
				beginPath: () => { currentSegments = [] },
				moveTo: (x, y) => { currentSegments.push({ type: 'move', x, y }) },
				lineTo: (x, y) => { currentSegments.push({ type: 'line', x, y }) },
				bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => {
					currentSegments.push({ type: 'bezier', cp1x, cp1y, cp2x, cp2y, x, y })
				},
				closePath: () => {},
				fill: () => {},
				stroke: () => {
					strokeStyles.push(fakeCtx.strokeStyle)
					let list = curvesByColor.get(fakeCtx.strokeStyle)
					if (!list) {
						list = []
						curvesByColor.set(fakeCtx.strokeStyle, list)
					}
					list.push([...currentSegments])
				},
				lineWidth: 0,
				strokeStyle: '',
				fillStyle: '',
				lineCap: '',
				lineJoin: ''
			}

			// Flat camera (pitch = 0) so projected screen coords map directly to ground coords
			const camera = new HexPerspectiveCamera({
				viewportWidth: 1000,
				viewportHeight: 800,
				cameraX: 200,
				cameraY: 200,
				zoom: 1.0,
				pitch: 0
			})

			// 2 adjacent cells belonging to DIFFERENT nations:
			// (3,3) in re-estize (blue), (4,3) in baharuth (red)
			const mapData = {
				hexRadius: 36,
				cells: {
					'3,3': { col: 3, row: 3, faction: 're-estize' },
					'4,3': { col: 4, row: 3, faction: 'baharuth' }
				}
			}

			drawPoliticalBorders(fakeCtx, camera, mapData, 36, null, null, 2)

			// Strokes contain semi-transparent colors (0.12 for wide halo, 0.22 for mid halo, 0.78 for crisp stroke)
			expect(strokeStyles.some(s => s.includes('0.12'))).toBe(true)
			expect(strokeStyles.some(s => s.includes('0.22'))).toBe(true)
			expect(strokeStyles.some(s => s.includes('0.78'))).toBe(true)

			// Both nations should have had their border ribbons drawn (3 strokes each: wide halo + mid halo + crisp)
			expect(strokeStyles.length).toBe(6)

			// Check that the shared boundary curves for the two nations are distinct and offset from each other
			const reEstizeStrokes = [...curvesByColor.entries()].filter(([k]) => k.includes('37, 99, 235'))
			const baharuthStrokes = [...curvesByColor.entries()].filter(([k]) => k.includes('220, 38, 38'))

			expect(reEstizeStrokes.length).toBeGreaterThan(0)
			expect(baharuthStrokes.length).toBeGreaterThan(0)
		})
	})

	describe('Hex Edge Curves, Organic Polygons & Texture Pipeline', () => {
		it('getHexEdgeCurve generates varied harmonic profile types across different edges', () => {
			const from = { x: 100, y: 100 }
			const to = { x: 136, y: 100 }
			const radius = 36

			const profilesFound = new Set()
			for (let i = 0; i < 20; i++) {
				const curve = getHexEdgeCurve(from, to, `${i},${i * 2}:SE`, radius, 1)
				profilesFound.add(curve.profileType)
			}

			// Must produce multiple diverse profiles (C-arc, S-meander, serpentine, compound lobe)
			expect(profilesFound.size).toBeGreaterThanOrEqual(3)
		})

		it('getHexEdgeCurve scales protrusion depth and generates organic amplitudes up to 0.40 * radius', () => {
			const from = { x: 100, y: 100 }
			const to = { x: 136, y: 100 }
			const radius = 36

			const protrusions = []
			for (let i = 0; i < 15; i++) {
				const curve = getHexEdgeCurve(from, to, `${i},${i + 5}:N`, radius, 1)
				protrusions.push(curve.protrusion)
				// Protrusions must be non-zero and bounded by realistic organic terrain range
				expect(curve.protrusion).toBeGreaterThan(radius * 0.08)
				expect(curve.protrusion).toBeLessThanOrEqual(radius * 0.45)
			}

			// Protrusions must not be identical across all edges
			const minP = Math.min(...protrusions)
			const maxP = Math.max(...protrusions)
			expect(maxP - minP).toBeGreaterThan(radius * 0.1)
		})

		it('getHexEdgeCurve guarantees at least 1 prominent intermediate point with significant offset between the 2 main vertices', () => {
			const from = { x: 100, y: 100 }
			const to = { x: 136, y: 100 }
			const radius = 36

			for (let i = 0; i < 30; i++) {
				const curve = getHexEdgeCurve(from, to, `${i},${i * 3}:SE`, radius, 1)
				expect(curve.mid).toBeDefined()

				// Distance of mid from the straight chord connecting from and to:
				// Line from (100, 100) to (136, 100) is horizontal (y = 100)
				// Perpendicular distance is |mid.y - 100|
				const perpDist = Math.abs(curve.mid.y - 100)
				expect(perpDist).toBeGreaterThanOrEqual(radius * 0.10) // at least ~3.6px
			}
		})

		it('getHexEdgeCurve applies smooth vertex tangents without lateral beaks at endpoints', () => {
			const from = { x: 100, y: 100 }
			const to = { x: 136, y: 100 }
			const radius = 36

			// Inward turning tangent from a previous edge (angle 45 deg)
			const tangentFrom = { x: Math.cos(Math.PI / 4), y: Math.sin(Math.PI / 4) }
			const tangentTo = { x: 1, y: 0 }

			const curve = getHexEdgeCurve(from, to, '4,5:SE', radius, 1, { tangentFrom, tangentTo })

			// CP1 should lean along tangentFrom
			const dX = curve.cp1.x - from.x
			const dY = curve.cp1.y - from.y
			expect(dX).toBeGreaterThan(0)
			expect(dY).toBeGreaterThan(0)
		})

		it('getHexEdgeCurve maintains 100% strict mathematical symmetry in reverse traversal', () => {
			const from = { x: 80, y: 120 }
			const to = { x: 116, y: 156 }
			const canonKey = '9,12:SE'
			const radius = 36

			const fwd = getHexEdgeCurve(from, to, canonKey, radius, 1)
			const rev = getHexEdgeCurve(to, from, canonKey, radius, 1)

			expect(rev.cp1.x).toBeCloseTo(fwd.cp2.x, 6)
			expect(rev.cp1.y).toBeCloseTo(fwd.cp2.y, 6)
			expect(rev.cp2.x).toBeCloseTo(fwd.cp1.x, 6)
			expect(rev.cp2.y).toBeCloseTo(fwd.cp1.y, 6)
		})

		it('getOrganicCellPolygon generates 6-sided organic boundary with coincident shared edges', () => {
			const radius = 36
			const cellPoly1 = getOrganicCellPolygon(2, 2, radius)
			const nCoord = getHexNeighbor(2, 2, 'NE')
			const cellPoly2 = getOrganicCellPolygon(nCoord.col, nCoord.row, radius)

			expect(cellPoly1.edges).toHaveLength(6)
			expect(cellPoly2.edges).toHaveLength(6)

			// Shared edge between (2,2) and its NE neighbor
			const edge1 = cellPoly1.edges.find(e => e.edge === 'NE')
			const edge2 = cellPoly2.edges.find(e => e.edge === 'SW')

			expect(edge1.canonKey).toBe(edge2.canonKey)
			// Coincident endpoints and control points
			expect(edge1.from.x).toBeCloseTo(edge2.from.x, 5)
			expect(edge1.from.y).toBeCloseTo(edge2.from.y, 5)
			expect(edge1.to.x).toBeCloseTo(edge2.to.x, 5)
			expect(edge1.to.y).toBeCloseTo(edge2.to.y, 5)
			expect(edge1.cp1.x).toBeCloseTo(edge2.cp1.x, 5)
			expect(edge1.cp1.y).toBeCloseTo(edge2.cp1.y, 5)
		})

		it('isCoastEdge accurately classifies land vs water edges', () => {
			const grassCell = { col: 1, row: 1, terrain: 'grass' }
			const oceanCell = { col: 1, row: 2, terrain: 'ocean' }
			const waterCell = { col: 1, row: 3, terrain: 'water' }
			const desertCell = { col: 2, row: 1, terrain: 'desert' }

			expect(isCoastEdge(grassCell, oceanCell)).toBe(true)
			expect(isCoastEdge(desertCell, waterCell)).toBe(true)
			expect(isCoastEdge(oceanCell, waterCell)).toBe(false) // Both water
			expect(isCoastEdge(grassCell, desertCell)).toBe(false) // Both land
		})

		it('getBiomeTextureVariant provides deterministic bounded variant indexing', () => {
			const v1 = getBiomeTextureVariant(4, 5, 4, 100)
			const v1Repeat = getBiomeTextureVariant(4, 5, 4, 100)
			const v2 = getBiomeTextureVariant(4, 6, 4, 100)

			expect(v1).toBe(v1Repeat)
			expect(v1).toBeGreaterThanOrEqual(0)
			expect(v1).toBeLessThan(4)
			expect(DEFAULT_TEXTURE_BLEED_RATIO).toBeGreaterThan(1.1)
		})

		it('getOrganicGroundVertex and getOrganicHexGroundVertices displace vertices organically with strict shared-edge determinism', () => {
			const radius = 36
			const seed = 42

			// Center 1 and neighbor
			const c1 = hexToWorldGroundCenter(3, 4, radius)
			const idealVerts1 = getHexGroundVertices(c1.x, c1.y, radius)
			const organicVerts1 = getOrganicHexGroundVertices(c1.x, c1.y, radius, seed)

			// 1. Ensure organic vertices are not pinned to rigid lattice
			let totalDisplacement = 0
			for (let i = 0; i < 6; i++) {
				const dist = Math.hypot(organicVerts1[i].x - idealVerts1[i].x, organicVerts1[i].y - idealVerts1[i].y)
				totalDisplacement += dist
				// Max jitter offset is bounded by sqrt(2) * 0.16 * radius ≈ 8.14px
				expect(dist).toBeLessThanOrEqual(Math.SQRT2 * 0.16 * radius + 0.01)
			}
			expect(totalDisplacement).toBeGreaterThan(1.0) // Vertices genuinely jitter!

			// 2. Neighbor sharing edge SE (edge vertices [0, 1] on (3,4) vs [3, 4] on (4,4))
			const nCoord = getHexNeighbor(3, 4, 'SE')
			const c2 = hexToWorldGroundCenter(nCoord.col, nCoord.row, radius)
			const organicVerts2 = getOrganicHexGroundVertices(c2.x, c2.y, radius, seed)

			// Vertex 0 of hex 1 should equal Vertex 4 of hex 2
			expect(organicVerts1[0].x).toBeCloseTo(organicVerts2[4].x, 5)
			expect(organicVerts1[0].y).toBeCloseTo(organicVerts2[4].y, 5)

			// Vertex 1 of hex 1 should equal Vertex 3 of hex 2
			expect(organicVerts1[1].x).toBeCloseTo(organicVerts2[3].x, 5)
			expect(organicVerts1[1].y).toBeCloseTo(organicVerts2[3].y, 5)
		})

		it('border and river on shared edge with opposite traversals form 100% coincident curves', () => {
			const radius = 36
			const seed = 99
			const canonKey = '5,6:S'

			const c1 = hexToWorldGroundCenter(5, 6, radius)
			const gv1 = getOrganicHexGroundVertices(c1.x, c1.y, radius, seed)
			// River endpoints from getHexEdgeEndpoints: [2, 1] (West -> East)
			const { from: rFrom, to: rTo } = getHexEdgeEndpoints(gv1, 'S')

			// Faction 1 boundary edge (Hex 1, edge S: clockwise is [1, 2] East -> West)
			const f1From = gv1[1]
			const f1To = gv1[2]

			// Faction 2 boundary edge (Neighbor Hex 2, edge N: clockwise is [4, 5] West -> East)
			const nCoord = getHexNeighbor(5, 6, 'S')
			const c2 = hexToWorldGroundCenter(nCoord.col, nCoord.row, radius)
			const gv2 = getOrganicHexGroundVertices(c2.x, c2.y, radius, seed)
			const f2From = gv2[4]
			const f2To = gv2[5]

			// Verify shared corner points match
			expect(f1From.x).toBeCloseTo(f2To.x, 5)
			expect(f1From.y).toBeCloseTo(f2To.y, 5)
			expect(f1To.x).toBeCloseTo(f2From.x, 5)
			expect(f1To.y).toBeCloseTo(f2From.y, 5)
			expect(rFrom.x).toBeCloseTo(f2From.x, 5)
			expect(rFrom.y).toBeCloseTo(f2From.y, 5)

			// River running along canonical edge
			const riverCurve = getRiverMeanderControls(rFrom, rTo, canonKey, radius, 2, { seed })
			const revRiverCurve = getRiverMeanderControls(rTo, rFrom, canonKey, radius, 2, { seed })
			// Faction 1 border along S edge (traversing East -> West)
			const f1Curve = getHexEdgeCurve(f1From, f1To, canonKey, radius, 2, { seed })
			// Faction 2 border along N edge (traversing West -> East)
			const f2Curve = getHexEdgeCurve(f2From, f2To, canonKey, radius, 2, { seed })

			function evalCubic(p0, cp1, cp2, p1, t) {
				const mt = 1 - t
				return {
					x: mt ** 3 * p0.x + 3 * mt ** 2 * t * cp1.x + 3 * mt * t ** 2 * cp2.x + t ** 3 * p1.x,
					y: mt ** 3 * p0.y + 3 * mt ** 2 * t * cp1.y + 3 * mt * t ** 2 * cp2.y + t ** 3 * p1.y
				}
			}

			// Borders on both sides of shared edge trace the exact same physical curve
			// River meander also preserves exact reverse symmetry
			for (const t of [0, 0.15, 0.35, 0.5, 0.65, 0.85, 1.0]) {
				const ptF2 = evalCubic(f2From, f2Curve.cp1, f2Curve.cp2, f2To, t)
				const ptF1 = evalCubic(f1From, f1Curve.cp1, f1Curve.cp2, f1To, 1 - t)

				expect(ptF2.x).toBeCloseTo(ptF1.x, 5)
				expect(ptF2.y).toBeCloseTo(ptF1.y, 5)

				const ptRiver = evalCubic(rFrom, riverCurve.cp1, riverCurve.cp2, rTo, t)
				const ptRiverRev = evalCubic(rTo, revRiverCurve.cp1, revRiverCurve.cp2, rFrom, 1 - t)
				expect(ptRiver.x).toBeCloseTo(ptRiverRev.x, 5)
				expect(ptRiver.y).toBeCloseTo(ptRiverRev.y, 5)
			}
		})

		it('getOrganicCellPerimeter produces a continuous watertight closed loop of 6 curved edges', () => {
			const perimeter = getOrganicCellPerimeter(4, 5, 36, 12345)
			expect(perimeter).toHaveLength(6)

			// Verify clockwise continuity: edge[i].to strictly equals edge[(i+1)%6].from
			for (let i = 0; i < 6; i++) {
				const curr = perimeter[i]
				const next = perimeter[(i + 1) % 6]

				expect(curr.to.x).toBeCloseTo(next.from.x, 5)
				expect(curr.to.y).toBeCloseTo(next.from.y, 5)

				// Each edge contains multi-bend controls with at least 2 intermediate apex points
				expect(curr.mid).toBeDefined()
				expect(curr.mid1).toBeDefined()
				expect(curr.mid2).toBeDefined()
				expect(curr.midPoints).toHaveLength(2)
				expect(curr.cp1A).toBeDefined()
				expect(curr.cp2A).toBeDefined()
				expect(curr.cp1B).toBeDefined()
				expect(curr.cp2B).toBeDefined()
				expect(curr.cp1C).toBeDefined()
				expect(curr.cp2C).toBeDefined()
			}
		})

		it('180-degree collinear handles across corners eliminate sharp kinks at hex boundary joints', () => {
			const vCorner = { x: 200, y: 300 }
			const vPrev = { x: 170, y: 260 }
			const vNext = { x: 240, y: 310 }

			// Chord directions
			const d1x = vCorner.x - vPrev.x
			const d1y = vCorner.y - vPrev.y
			const l1 = Math.hypot(d1x, d1y)
			const u1 = { x: d1x / l1, y: d1y / l1 }

			const d2x = vNext.x - vCorner.x
			const d2y = vNext.y - vCorner.y
			const l2 = Math.hypot(d2x, d2y)
			const u2 = { x: d2x / l2, y: d2y / l2 }

			// Bisector tangent at corner
			const sx = u1.x + u2.x
			const sy = u1.y + u2.y
			const sl = Math.hypot(sx, sy)
			const tCorner = { x: sx / sl, y: sy / sl }

			// Incoming segment ends at vCorner with tangentTo = tCorner
			const seg1 = getHexEdgeCurve(vPrev, vCorner, '1,1:SE', 36, 1, { tangentTo: tCorner })
			// Outgoing segment starts at vCorner with tangentFrom = tCorner
			const seg2 = getHexEdgeCurve(vCorner, vNext, '2,1:N', 36, 1, { tangentFrom: tCorner })

			// Vector entering vCorner from cp2C of seg1
			const inDx = vCorner.x - seg1.cp2C.x
			const inDy = vCorner.y - seg1.cp2C.y
			const inLen = Math.hypot(inDx, inDy)
			const uIn = { x: inDx / inLen, y: inDy / inLen }

			// Vector leaving vCorner towards cp1A of seg2
			const outDx = seg2.cp1A.x - vCorner.x
			const outDy = seg2.cp1A.y - vCorner.y
			const outLen = Math.hypot(outDx, outDy)
			const uOut = { x: outDx / outLen, y: outDy / outLen }

			// Both unit vectors point along tCorner: their dot product must be 1.0 (angle = 0 deg, handles 180 deg collinear)
			const dot = uIn.x * uOut.x + uIn.y * uOut.y
			expect(dot).toBeCloseTo(1.0, 5)

			expect(uIn.x).toBeCloseTo(tCorner.x, 5)
			expect(uIn.y).toBeCloseTo(tCorner.y, 5)
			expect(uOut.x).toBeCloseTo(tCorner.x, 5)
			expect(uOut.y).toBeCloseTo(tCorner.y, 5)
		})

		it('guarantees at least 2 intermediate apex points with minimum protrusion and collinear through-tangents', () => {
			const from = { x: 50, y: 50 }
			const to = { x: 120, y: 70 }
			const radius = 36

			// Test all canonical profile archetypes
			const testEdges = ['0,0:N', '1,0:NE', '2,1:SE', '3,2:S', '0,2:SW', '1,3:NW']
			for (const canonKey of testEdges) {
				const curve = getHexEdgeCurve(from, to, canonKey, radius, 1)

				// 1. Must have mid1 and mid2
				expect(curve.mid1).toBeDefined()
				expect(curve.mid2).toBeDefined()
				expect(curve.midPoints).toHaveLength(2)
				expect(curve.mid).toBe(curve.mid1)

				// Chord vector and normal
				const cdx = to.x - from.x
				const cdy = to.y - from.y
				const clen = Math.hypot(cdx, cdy)
				const cnx = -cdy / clen
				const cny = cdx / clen

				// Perpendicular distance of mid1 and mid2 from chord line
				const distM1 = Math.abs((curve.mid1.x - from.x) * cnx + (curve.mid1.y - from.y) * cny)
				const distM2 = Math.abs((curve.mid2.x - from.x) * cnx + (curve.mid2.y - from.y) * cny)

				// Both intermediate points must have noticeable lateral protrusion (> 0.08 * radius)
				expect(distM1).toBeGreaterThanOrEqual(0.08 * radius)
				expect(distM2).toBeGreaterThanOrEqual(0.08 * radius)

				// 2. Collinear 180° through-tangents at mid1: vector(mid1 - cp2A) and vector(cp1B - mid1)
				const vIn1 = { x: curve.mid1.x - curve.cp2A.x, y: curve.mid1.y - curve.cp2A.y }
				const lenIn1 = Math.hypot(vIn1.x, vIn1.y)
				const uIn1 = { x: vIn1.x / lenIn1, y: vIn1.y / lenIn1 }

				const vOut1 = { x: curve.cp1B.x - curve.mid1.x, y: curve.cp1B.y - curve.mid1.y }
				const lenOut1 = Math.hypot(vOut1.x, vOut1.y)
				const uOut1 = { x: vOut1.x / lenOut1, y: vOut1.y / lenOut1 }

				const dotM1 = uIn1.x * uOut1.x + uIn1.y * uOut1.y
				expect(dotM1).toBeCloseTo(1.0, 5)

				// 3. Collinear 180° through-tangents at mid2: vector(mid2 - cp2B) and vector(cp1C - mid2)
				const vIn2 = { x: curve.mid2.x - curve.cp2B.x, y: curve.mid2.y - curve.cp2B.y }
				const lenIn2 = Math.hypot(vIn2.x, vIn2.y)
				const uIn2 = { x: vIn2.x / lenIn2, y: vIn2.y / lenIn2 }

				const vOut2 = { x: curve.cp1C.x - curve.mid2.x, y: curve.cp1C.y - curve.mid2.y }
				const lenOut2 = Math.hypot(vOut2.x, vOut2.y)
				const uOut2 = { x: vOut2.x / lenOut2, y: vOut2.y / lenOut2 }

				const dotM2 = uIn2.x * uOut2.x + uIn2.y * uOut2.y
				expect(dotM2).toBeCloseTo(1.0, 5)

				// 4. Reverse traversal symmetry across all 3 subsegments
				const rev = getHexEdgeCurve(to, from, canonKey, radius, 1)
				expect(rev.mid1.x).toBeCloseTo(curve.mid2.x, 5)
				expect(rev.mid1.y).toBeCloseTo(curve.mid2.y, 5)
				expect(rev.mid2.x).toBeCloseTo(curve.mid1.x, 5)
				expect(rev.mid2.y).toBeCloseTo(curve.mid1.y, 5)

				expect(rev.cp1A.x).toBeCloseTo(curve.cp2C.x, 5)
				expect(rev.cp1A.y).toBeCloseTo(curve.cp2C.y, 5)
				expect(rev.cp2A.x).toBeCloseTo(curve.cp1C.x, 5)
				expect(rev.cp2A.y).toBeCloseTo(curve.cp1C.y, 5)

				expect(rev.cp1B.x).toBeCloseTo(curve.cp2B.x, 5)
				expect(rev.cp1B.y).toBeCloseTo(curve.cp2B.y, 5)
				expect(rev.cp2B.x).toBeCloseTo(curve.cp1B.x, 5)
				expect(rev.cp2B.y).toBeCloseTo(curve.cp1B.y, 5)

				expect(rev.cp1C.x).toBeCloseTo(curve.cp2A.x, 5)
				expect(rev.cp1C.y).toBeCloseTo(curve.cp2A.y, 5)
				expect(rev.cp2C.x).toBeCloseTo(curve.cp1A.x, 5)
				expect(rev.cp2C.y).toBeCloseTo(curve.cp1A.y, 5)
			}
		})

		it('100% geometric coincidence between hex cell boundary, river, and political border on the same edge', () => {
			const col = 4
			const row = 5
			const edge = 'SE'
			const radius = 36
			const seed = 98765
			const canonKey = getCanonicalEdgeKey(col, row, edge)
			const riverMap = new Map()
			riverMap.set(canonKey, { col, row, edge, width: 2 })

			// 1. Organic hex cell boundary for (4, 5)
			const perimeter = getOrganicCellPerimeter(col, row, radius, seed, riverMap)
			const cellEdge = perimeter.find(e => e.edge === edge)
			expect(cellEdge).toBeDefined()

			// 2. River curve along this edge
			const center = hexToWorldGroundCenter(col, row, radius)
			const groundVerts = getOrganicHexGroundVertices(center.x, center.y, radius, seed)
			const { from: rFrom, to: rTo } = getHexEdgeEndpoints(groundVerts, edge)
			const riverCurve = getRiverMeanderControls(rFrom, rTo, canonKey, radius, 2, { seed })

			// 3. Political border curve along this edge
			const borderCurve = getHexEdgeCurve(rFrom, rTo, canonKey, radius, 2, { seed })

			// Verify all 10 multi-bend control points match identically between cell boundary and political border
			for (const prop of ['from', 'cp1A', 'cp2A', 'mid1', 'cp1B', 'cp2B', 'mid2', 'cp1C', 'cp2C', 'to']) {
				expect(cellEdge[prop].x).toBeCloseTo(borderCurve[prop].x, 5)
				expect(cellEdge[prop].y).toBeCloseTo(borderCurve[prop].y, 5)
			}

			// Sub-pixel curve evaluation: lobe A (from -> mid1), lobe B (mid1 -> mid2), lobe C (mid2 -> to)
			function evalCubic(p0, cp1, cp2, p1, t) {
				const mt = 1 - t
				return {
					x: mt ** 3 * p0.x + 3 * mt ** 2 * t * cp1.x + 3 * mt * t ** 2 * cp2.x + t ** 3 * p1.x,
					y: mt ** 3 * p0.y + 3 * mt ** 2 * t * cp1.y + 3 * mt * t ** 2 * cp2.y + t ** 3 * p1.y
				}
			}

			for (const t of [0, 0.2, 0.5, 0.8, 1.0]) {
				const ptCellA = evalCubic(cellEdge.from, cellEdge.cp1A, cellEdge.cp2A, cellEdge.mid1, t)
				const ptBorderA = evalCubic(borderCurve.from, borderCurve.cp1A, borderCurve.cp2A, borderCurve.mid1, t)

				expect(ptCellA.x).toBeCloseTo(ptBorderA.x, 5)
				expect(ptCellA.y).toBeCloseTo(ptBorderA.y, 5)

				const ptCellB = evalCubic(cellEdge.mid1, cellEdge.cp1B, cellEdge.cp2B, cellEdge.mid2, t)
				const ptBorderB = evalCubic(borderCurve.mid1, borderCurve.cp1B, borderCurve.cp2B, borderCurve.mid2, t)

				expect(ptCellB.x).toBeCloseTo(ptBorderB.x, 5)
				expect(ptCellB.y).toBeCloseTo(ptBorderB.y, 5)

				const ptCellC = evalCubic(cellEdge.mid2, cellEdge.cp1C, cellEdge.cp2C, cellEdge.to, t)
				const ptBorderC = evalCubic(borderCurve.mid2, borderCurve.cp1C, borderCurve.cp2C, borderCurve.to, t)

				expect(ptCellC.x).toBeCloseTo(ptBorderC.x, 5)
				expect(ptCellC.y).toBeCloseTo(ptBorderC.y, 5)
			}

			// River has dedicated S-meander control points
			expect(riverCurve.cp1).toBeDefined()
			expect(riverCurve.cp2).toBeDefined()
			expect(riverCurve.from.x).toBeCloseTo(rFrom.x, 5)
			expect(riverCurve.to.x).toBeCloseTo(rTo.x, 5)
		})
	})

	describe('Hex Map Resizing & Bounds Calculation', () => {
		const baseBounds = {
			minCol: 0,
			maxCol: 23,
			minRow: 0,
			maxRow: 15,
			cols: 24,
			rows: 16
		}

		it('calculates directional bounds expansion correctly for all 4 directions', () => {
			// East (+cols to the right)
			const eastExp = calculateDirectionalBounds(baseBounds, { east: 6 })
			expect(eastExp).toEqual({
				minCol: 0,
				maxCol: 29,
				minRow: 0,
				maxRow: 15,
				cols: 30,
				rows: 16
			})

			// North (+rows to the top, minRow becomes negative)
			const northExp = calculateDirectionalBounds(baseBounds, { north: 4 })
			expect(northExp).toEqual({
				minCol: 0,
				maxCol: 23,
				minRow: -4,
				maxRow: 15,
				cols: 24,
				rows: 20
			})

			// West (+cols to the left, minCol becomes negative)
			const westExp = calculateDirectionalBounds(baseBounds, { west: 5 })
			expect(westExp).toEqual({
				minCol: -5,
				maxCol: 23,
				minRow: 0,
				maxRow: 15,
				cols: 29,
				rows: 16
			})

			// South (+rows to the bottom)
			const southExp = calculateDirectionalBounds(baseBounds, { south: 8 })
			expect(southExp).toEqual({
				minCol: 0,
				maxCol: 23,
				minRow: 0,
				maxRow: 23,
				cols: 24,
				rows: 24
			})

			// All 4 directions simultaneously
			const allExp = calculateDirectionalBounds(baseBounds, { north: 2, south: 3, west: 4, east: 5 })
			expect(allExp).toEqual({
				minCol: -4,
				maxCol: 28,
				minRow: -2,
				maxRow: 18,
				cols: 33,
				rows: 21
			})
		})

		it('handles shrinking directional bounds correctly', () => {
			const shrunk = calculateDirectionalBounds(baseBounds, { west: -2, east: -3, north: -1, south: -4 })
			expect(shrunk).toEqual({
				minCol: 2,
				maxCol: 20,
				minRow: 1,
				maxRow: 11,
				cols: 19,
				rows: 11
			})
		})

		it('calculates anchor bounds correctly for 3x3 positions', () => {
			// Center expansion
			const centerExp = calculateAnchorBounds(baseBounds, 30, 20, 'center')
			expect(centerExp).toEqual({
				minCol: -3,
				maxCol: 26,
				minRow: -2,
				maxRow: 17,
				cols: 30,
				rows: 20
			})

			// Top-Left anchor (fixes minCol, minRow, expands right and down)
			const topLeftExp = calculateAnchorBounds(baseBounds, 30, 20, 'top-left')
			expect(topLeftExp).toEqual({
				minCol: 0,
				maxCol: 29,
				minRow: 0,
				maxRow: 19,
				cols: 30,
				rows: 20
			})

			// Bottom-Right anchor (fixes maxCol, maxRow, expands left and up)
			const bottomRightExp = calculateAnchorBounds(baseBounds, 30, 20, 'bottom-right')
			expect(bottomRightExp).toEqual({
				minCol: -6,
				maxCol: 23,
				minRow: -4,
				maxRow: 15,
				cols: 30,
				rows: 20
			})

			// Top anchor (fixes minRow, centers horizontally)
			const topExp = calculateAnchorBounds(baseBounds, 30, 20, 'top')
			expect(topExp).toEqual({
				minCol: -3,
				maxCol: 26,
				minRow: 0,
				maxRow: 19,
				cols: 30,
				rows: 20
			})

			// Bottom anchor (fixes maxRow, centers horizontally)
			const bottomExp = calculateAnchorBounds(baseBounds, 30, 20, 'bottom')
			expect(bottomExp).toEqual({
				minCol: -3,
				maxCol: 26,
				minRow: -4,
				maxRow: 15,
				cols: 30,
				rows: 20
			})

			// Left anchor (fixes minCol, centers vertically)
			const leftExp = calculateAnchorBounds(baseBounds, 30, 20, 'left')
			expect(leftExp).toEqual({
				minCol: 0,
				maxCol: 29,
				minRow: -2,
				maxRow: 17,
				cols: 30,
				rows: 20
			})

			// Right anchor (fixes maxCol, centers vertically)
			const rightExp = calculateAnchorBounds(baseBounds, 30, 20, 'right')
			expect(rightExp).toEqual({
				minCol: -6,
				maxCol: 23,
				minRow: -2,
				maxRow: 17,
				cols: 30,
				rows: 20
			})
		})
	})

	describe('Rendering Optimizations: Frustum Culling and Geometry Caching', () => {
		it('caches organic cell polygons and clears cache on clearOrganicPolygonCache', () => {
			clearOrganicPolygonCache()
			const poly1 = getOrganicCellPolygon(5, 5, 36, 42)
			const poly2 = getOrganicCellPolygon(5, 5, 36, 42)
			expect(poly1).toBe(poly2) // Same instance from cache

			clearOrganicPolygonCache()
			const poly3 = getOrganicCellPolygon(5, 5, 36, 42)
			expect(poly3).not.toBe(poly1) // New instance after clear
			expect(poly3.edges.length).toBe(6)
			expect(poly3.perimeter.length).toBe(6)
		})

		it('isCellVisible accurately identifies on-screen and off-screen hexes', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 1000,
				viewportHeight: 800,
				cameraX: 500,
				cameraY: 500,
				zoom: 1.0,
				pitch: 45
			})

			// Cell near camera center (col 10, row 10 has center ~ (540, 571))
			const isNearVisible = isCellVisible(camera, 10, 10, 36)
			expect(isNearVisible).toBe(true)

			// Cell very far away (col 100, row 100)
			const isFarVisible = isCellVisible(camera, 100, 100, 36)
			expect(isFarVisible).toBe(false)

			// Cell behind camera / horizon
			const isBehindVisible = isCellVisible(camera, -100, -100, 36)
			expect(isBehindVisible).toBe(false)
		})

		it('isCellVisible returns true if camera is not provided', () => {
			expect(isCellVisible(null, 10, 10, 36)).toBe(true)
		})

		it('getVisibleHexGridBounds calculates tight window and culls 100x100 map by >90%', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 960,
				viewportHeight: 540,
				cameraX: 2500,
				cameraY: 2500,
				zoom: 1.0,
				pitch: 45
			})

			const mapBounds = { minCol: 0, maxCol: 99, minRow: 0, maxRow: 99, cols: 100, rows: 100 }
			const vBounds = getVisibleHexGridBounds(camera, 36, mapBounds)

			expect(vBounds.minCol).toBeGreaterThanOrEqual(0)
			expect(vBounds.maxCol).toBeLessThanOrEqual(99)
			expect(vBounds.minRow).toBeGreaterThanOrEqual(0)
			expect(vBounds.maxRow).toBeLessThanOrEqual(99)

			const colsCount = vBounds.maxCol - vBounds.minCol + 1
			const rowsCount = vBounds.maxRow - vBounds.minRow + 1
			const visibleCandidateCells = colsCount * rowsCount

			// 100x100 map has 10,000 cells. Visible window must be under 1,000 cells (>90% reduction!)
			expect(visibleCandidateCells).toBeLessThan(1000)
			expect(visibleCandidateCells).toBeGreaterThan(100)
		})

		it('getVisibleHexGridBounds handles flat pitch=0 and respects custom map bounds', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 960,
				viewportHeight: 540,
				cameraX: 1000,
				cameraY: 1000,
				zoom: 1.0,
				pitch: 0
			})

			const mapBounds = { minCol: -10, maxCol: 40, minRow: -5, maxRow: 30 }
			const vBounds = getVisibleHexGridBounds(camera, 36, mapBounds)

			expect(vBounds.minCol).toBeGreaterThanOrEqual(-10)
			expect(vBounds.maxCol).toBeLessThanOrEqual(40)
			expect(vBounds.minRow).toBeGreaterThanOrEqual(-5)
			expect(vBounds.maxRow).toBeLessThanOrEqual(30)
		})

		it('getVisibleHexGridBounds prevents column explosion on huge 1000x1000 map with tilted camera', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 960,
				viewportHeight: 540,
				cameraX: 25000,
				cameraY: 25000,
				zoom: 0.5,
				pitch: 50
			})

			// 1,000 x 1,000 map = 1,000,000 cells!
			const mapBounds = { minCol: 0, maxCol: 999, minRow: 0, maxRow: 999, cols: 1000, rows: 1000 }
			const vBounds = getVisibleHexGridBounds(camera, 36, mapBounds)

			expect(vBounds.minCol).toBeGreaterThanOrEqual(0)
			expect(vBounds.maxCol).toBeLessThanOrEqual(999)

			// Column count must NOT explode across the entire 1,000 columns!
			const colsCount = vBounds.maxCol - vBounds.minCol + 1
			expect(colsCount).toBeLessThan(300)

			const rowsCount = vBounds.maxRow - vBounds.minRow + 1
			expect(rowsCount).toBeLessThan(200)

			// Total visible candidates must cull at least 95% of the 1,000,000 cells
			const totalVisible = colsCount * rowsCount
			expect(totalVisible).toBeLessThan(50000)
		})

		it('buildRoadRenderData culls minor dirt roads at LOD 2 while retaining stone roads', () => {
			const camera = new HexPerspectiveCamera({
				viewportWidth: 960,
				viewportHeight: 540,
				cameraX: 500,
				cameraY: 500,
				zoom: 0.25,
				pitch: 0
			})

			const mapData = {
				hexRadius: 36,
				roads: {
					'dirt_1': { from: { col: 5, row: 5 }, to: { col: 6, row: 5 }, type: 'dirt' },
					'stone_1': { from: { col: 7, row: 5 }, to: { col: 8, row: 5 }, type: 'stone' }
				}
			}

			// At LOD 0, both roads are built (2 roads * 2 cell endpoints = 4 trunks)
			const roadDataLOD0 = buildRoadRenderData(camera, mapData, 36, { lodLevel: 0 })
			expect(roadDataLOD0.trunks.length).toBe(4)

			// At LOD 2, dirt roads are culled, only stone roads are built (1 road * 2 cell endpoints = 2 trunks)
			const roadDataLOD2 = buildRoadRenderData(camera, mapData, 36, { lodLevel: 2 })
			expect(roadDataLOD2.trunks.length).toBe(2)
			expect(roadDataLOD2.trunks[0].isStone).toBe(true)
		})

		it('renderHexMap renders successfully across all LOD levels (LOD 0, LOD 1, LOD 2)', () => {
			const mockCtx = {
				canvas: { width: 960, height: 540 },
				save: vi.fn(),
				restore: vi.fn(),
				beginPath: vi.fn(),
				closePath: vi.fn(),
				moveTo: vi.fn(),
				lineTo: vi.fn(),
				bezierCurveTo: vi.fn(),
				quadraticCurveTo: vi.fn(),
				arc: vi.fn(),
				ellipse: vi.fn(),
				fill: vi.fn(),
				stroke: vi.fn(),
				fillRect: vi.fn(),
				clearRect: vi.fn(),
				clip: vi.fn(),
				createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
				createPattern: vi.fn(() => ({ setTransform: vi.fn() })),
				setLineDash: vi.fn()
			}

			const mapData = {
				hexRadius: 36,
				cols: 10,
				rows: 10,
				bounds: { minCol: 0, maxCol: 9, minRow: 0, maxRow: 9 },
				cells: {
					'5,5': { col: 5, row: 5, terrain: 'grass', feature: 'hills', faction: 'kingdom' },
					'5,6': { col: 5, row: 6, terrain: 'water' },
					'6,5': { col: 6, row: 5, terrain: 'plains', feature: 'mountain', mountainRadius: 1 }
				},
				rivers: {
					'5,5:S': { col: 5, row: 5, edge: 'S', width: 1 },
					'6,5:S': { col: 6, row: 5, edge: 'S', width: 2 }
				},
				roads: {
					'5,5-6,5': { from: { col: 5, row: 5 }, to: { col: 6, row: 5 }, type: 'dirt' }
				}
			}

			// LOD 0 (Close-up: zoom = 1.0, screenRadius = 36)
			expect(() => renderHexMap(mockCtx, mapData, { cameraX: 300, cameraY: 300, zoom: 1.0 })).not.toThrow()

			// LOD 1 (Medium: zoom = 0.45, screenRadius = 16.2)
			expect(() => renderHexMap(mockCtx, mapData, { cameraX: 300, cameraY: 300, zoom: 0.45 })).not.toThrow()

			// LOD 2 (Strategic overview: zoom = 0.25, screenRadius = 9)
			expect(() => renderHexMap(mockCtx, mapData, { cameraX: 300, cameraY: 300, zoom: 0.25 })).not.toThrow()
		})
	})
})


