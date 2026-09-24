/**
 * Hexagonal 2.5D Canvas Rendering Engine with True 3D Perspective Projection
 *
 * Features:
 * - 3D Perspective ground plane tilted into the distance (with customizable pitch angle).
 * - Lateral Perspective Parallax: mountain peaks (Z > 0) lean outward as the camera pans sideways,
 *   revealing settlements and objects behind them.
 * - Don't Starve-style Upright 2.5D Billboards: settlements, cottages, tents, towers, and hills
 *   face the camera directly and scale naturally with distance.
 * - Dynamic Rivers with directional flow animation and chevron arrows along hex edges.
 * - Roads and auto-generated bridges across rivers.
 * - Atmospheric horizon sky mist.
 */

import {
	BIOMES,
	SETTLEMENT_TYPES,
	ROAD_TYPES,
	getCanonicalRoadKey,
	checkBridgeBetweenHexes
} from './hexLoader.js'
import {
	hexToWorldGroundCenter,
	getHexGroundVertices,
	getHexEdgeEndpoints,
	getHexNeighbor,
	getCanonicalEdgeKey,
	HEX_EDGES,
	HexPerspectiveCamera,
	getRiverMeanderControls,
	getRoadPathControls,
	getRoadCurvePoint,
	hashString,
	getHashFloat
} from './hexCoords.js'

/**
 * Adjusts color brightness by percent for 3D directional facet shading.
 */
function shadeHexColor(hex, percent) {
	if (!hex) return '#3d8b40'
	const num = parseInt(hex.replace('#', ''), 16)
	if (isNaN(num)) return hex
	let r = (num >> 16) + Math.round(255 * (percent / 100))
	let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100))
	let b = (num & 0x0000ff) + Math.round(255 * (percent / 100))
	r = Math.min(255, Math.max(0, r))
	g = Math.min(255, Math.max(0, g))
	b = Math.min(255, Math.max(0, b))
	return `rgb(${r},${g},${b})`
}

/**
 * Main render function for the hex map canvas.
 */
export function renderHexMap(ctx, mapData, options = {}) {
	if (!ctx || !mapData) return

	const {
		cameraX = 0,
		cameraY = 0,
		zoom = 1.0,
		pitch = 45, // Perspective angle in degrees (15..75)
		focalDistance = 900,
		hoveredHex = null,
		selectedHex = null,
		hoveredEdge = null,
		activeTool = null,
		activeRiverWidth = 1,
		discoveredLocations = null, // Set of discovered settlement IDs
		drawCanvasBadges = false,
		animTime = 0 // Seconds for animated rivers
	} = options

	const radius = mapData.hexRadius || 36

	const camera = new HexPerspectiveCamera({
		viewportWidth: ctx.canvas.width,
		viewportHeight: ctx.canvas.height,
		cameraX,
		cameraY,
		zoom,
		pitch,
		focalDistance
	})

	ctx.save()

	// 0. Atmospheric horizon sky & mist at the top of the canvas
	drawAtmosphere(ctx, camera)

	// 1. Draw all hex base cells (flat ground plane, sorted North to South)
	const cellEntries = Object.values(mapData.cells || {})
	cellEntries.sort((a, b) => a.row - b.row || a.col - b.col)

	for (const cell of cellEntries) {
		drawHexCell(ctx, camera, cell, radius, animTime)
	}

	// 2. Draw rivers along edges (with animated flowing water)
	drawRivers(ctx, camera, mapData, radius, animTime)

	// 3. Draw roads connecting hex centers
	drawRoads(ctx, camera, mapData, radius)

	// 4. Draw bridges where roads cross rivers
	drawBridges(ctx, camera, mapData, radius)

	// 5. Draw 2.5D Pop-Up Objects (Mountains, Settlements)
	// Rendered back-to-front (depth sorted by row, then col)
	// Hills are rendered directly as 3D deformed hex terrain cells in drawHexCell
	for (const cell of cellEntries) {
		if (cell.feature === 'mountain') {
			drawMountain(ctx, camera, cell, radius)
		}

		if (cell.settlement) {
			const isDiscovered = !discoveredLocations || discoveredLocations.has(cell.settlement.id)
			drawSettlement(ctx, camera, cell, radius, isDiscovered, drawCanvasBadges)
		}
	}

	// 6. Draw hovered/selected hex highlights
	if (hoveredHex) {
		drawHexHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, radius, '#38bdf8', 0.25, 2)
	}
	if (selectedHex) {
		drawHexHighlight(ctx, camera, selectedHex.col, selectedHex.row, radius, '#f6c445', 0.35, 3)
	}

	// 7. Draw hovered edge highlight for River tool
	if (activeTool === 'river' && hoveredHex && hoveredEdge) {
		drawEdgeHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, hoveredEdge, radius, activeRiverWidth)
	}

	ctx.restore()
}

/**
 * Atmospheric gradient haze where the tilted ground plane meets the horizon sky.
 */
function drawAtmosphere(ctx, camera) {
	const horizonY = camera.getHorizonY()
	if (horizonY > -120 && horizonY < ctx.canvas.height) {
		const topY = Math.max(0, horizonY - 140)
		const bottomY = Math.min(ctx.canvas.height, horizonY + 90)
		if (bottomY > topY) {
			const grad = ctx.createLinearGradient(0, topY, 0, bottomY)
			grad.addColorStop(0, '#090d16')
			grad.addColorStop(0.5, '#0f172a')
			grad.addColorStop(0.85, 'rgba(30, 41, 59, 0.65)')
			grad.addColorStop(1, 'rgba(15, 23, 42, 0)')
			ctx.fillStyle = grad
			ctx.fillRect(0, topY, ctx.canvas.width, bottomY - topY)
		}
	}
}

/**
 * Draws a 3D-deformed relief hex cell for hills with a flat plateau summit
 * and organically randomized slope facets.
 */
function drawHillHexCell(ctx, camera, cell, radius) {
	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	const groundVerts = getHexGroundVertices(center.x, center.y, radius)
	const pBase = groundVerts.map(v => camera.projectTerrain(v.x, v.y, 0))

	if (!pBase.some(v => v.visible)) return

	const biome = BIOMES[cell.terrain] || BIOMES.grass
	const h = hashString(`${cell.col},${cell.row}:hills`)

	// 1. Deterministic organic randomization parameters per cell
	const shiftX = getHashFloat(h, 1) * (radius * 0.08)
	const shiftY = getHashFloat(h, 2) * (radius * 0.08)
	const zHill = (14 + (getHashFloat(h, 3) + 1) * 1.5) * (radius / 36)
	const baseTopRadius = radius * (0.36 + getHashFloat(h, 4) * 0.06)

	const topCenterX = center.x + shiftX
	const topCenterY = center.y + shiftY

	// 2. Generate 6 randomized vertices for the flat plateau top
	const pTop = []
	for (let i = 0; i < 6; i++) {
		// Angles: 0, 60, 120, 180, 240, 300 degrees + angular & radial jitter
		const angleJitter = getHashFloat(h, 10 + i) * 0.12 // ±7 degrees
		const radJitter = 1 + getHashFloat(h, 20 + i) * 0.16 // ±16% radius variation
		const angle = (i * Math.PI) / 3 + angleJitter
		const r_i = baseTopRadius * radJitter

		const wx = topCenterX + Math.cos(angle) * r_i
		const wy = topCenterY + Math.sin(angle) * r_i
		pTop.push(camera.projectTerrain(wx, wy, zHill))
	}

	const avgScale = (pTop[0].scale + pBase[0].scale) / 2

	// 3. Directional sun lighting modifiers for the 6 side slope facets
	// Sun comes from NW (315°): NW/N facets are sunlit, SE/S facets are shaded
	const baseFacetLightMods = [-18, -12, 6, 24, 16, 0]

	// 4. Draw the 6 sloping trapezoidal facets connecting flat plateau to outer base
	for (let i = 0; i < 6; i++) {
		const next = (i + 1) % 6
		const facetRand = getHashFloat(h, 30 + i) * 3
		const lightMod = Math.round(baseFacetLightMods[i] + facetRand)

		ctx.beginPath()
		ctx.moveTo(pBase[i].x, pBase[i].y)
		ctx.lineTo(pBase[next].x, pBase[next].y)
		ctx.lineTo(pTop[next].x, pTop[next].y)
		ctx.lineTo(pTop[i].x, pTop[i].y)
		ctx.closePath()

		ctx.fillStyle = shadeHexColor(biome.color, lightMod)
		ctx.fill()

		// Subtle facet rib stroke separating adjacent slope facets
		ctx.beginPath()
		ctx.moveTo(pBase[i].x, pBase[i].y)
		ctx.lineTo(pTop[i].x, pTop[i].y)
		ctx.lineWidth = Math.max(0.6, 0.8 * avgScale)
		ctx.strokeStyle = lightMod >= 0 ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.14)'
		ctx.stroke()
	}

	// 5. Draw the FLAT TOP PLATEAU polygon (плоская верхушка)
	ctx.beginPath()
	ctx.moveTo(pTop[0].x, pTop[0].y)
	for (let i = 1; i < 6; i++) {
		ctx.lineTo(pTop[i].x, pTop[i].y)
	}
	ctx.closePath()

	// Flat top receives direct overhead sun: gentle warm summit tint
	const topLightMod = Math.round(8 + getHashFloat(h, 5) * 4)
	ctx.fillStyle = shadeHexColor(biome.color, topLightMod)
	ctx.fill()

	// Plateau perimeter edge highlight rim
	ctx.lineWidth = Math.max(0.6, 1.2 * avgScale)
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.32)'
	ctx.stroke()

	// 6. Subtle organic mid-slope contour loop around the hill
	ctx.save()
	ctx.beginPath()
	ctx.moveTo(pBase[0].x, pBase[0].y)
	for (let i = 1; i < 6; i++) ctx.lineTo(pBase[i].x, pBase[i].y)
	ctx.closePath()
	ctx.clip()

	ctx.beginPath()
	for (let i = 0; i < 6; i++) {
		const next = (i + 1) % 6
		const mid1X = (pBase[i].x + pTop[i].x) / 2
		const mid1Y = (pBase[i].y + pTop[i].y) / 2
		const mid2X = (pBase[next].x + pTop[next].x) / 2
		const mid2Y = (pBase[next].y + pTop[next].y) / 2
		if (i === 0) ctx.moveTo(mid1X, mid1Y)
		ctx.lineTo(mid2X, mid2Y)
	}
	ctx.closePath()
	ctx.lineWidth = Math.max(0.5, 0.8 * avgScale)
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
	ctx.stroke()

	ctx.restore()

	// 7. Outer perimeter hex border stroke
	ctx.beginPath()
	ctx.moveTo(pBase[0].x, pBase[0].y)
	for (let i = 1; i < 6; i++) {
		ctx.lineTo(pBase[i].x, pBase[i].y)
	}
	ctx.closePath()
	ctx.lineWidth = Math.max(0.6, 1 * avgScale)
	ctx.strokeStyle = biome.edgeColor || 'rgba(0, 0, 0, 0.15)'
	ctx.stroke()
}

/**
 * Draws a single flat-topped hex cell on the 3D perspective ground plane.
 */
function drawHexCell(ctx, camera, cell, radius, animTime) {
	if (cell.feature === 'hills') {
		drawHillHexCell(ctx, camera, cell, radius)
		return
	}

	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	const groundVerts = getHexGroundVertices(center.x, center.y, radius)
	const screenVerts = groundVerts.map(v => camera.project(v.x, v.y, 0))

	if (!screenVerts.some(v => v.visible)) return

	const biome = BIOMES[cell.terrain] || BIOMES.grass

	// Draw main hex polygon on perspective ground plane
	ctx.beginPath()
	ctx.moveTo(screenVerts[0].x, screenVerts[0].y)
	for (let i = 1; i < screenVerts.length; i++) {
		ctx.lineTo(screenVerts[i].x, screenVerts[i].y)
	}
	ctx.closePath()

	ctx.fillStyle = biome.color
	ctx.fill()

	// Hex border stroke (scaled by perspective)
	const avgScale = screenVerts[0].scale
	ctx.lineWidth = Math.max(0.6, 1 * avgScale)
	ctx.strokeStyle = biome.edgeColor || 'rgba(0, 0, 0, 0.15)'
	ctx.stroke()

	// Water waves animation for water/ocean
	if (biome.isWater) {
		drawWaterShimmer(ctx, camera, center.x, center.y, radius, animTime, cell.terrain === 'ocean')
	}
}

/**
 * Subtle water shimmer for ocean and lakes on the ground plane.
 */
function drawWaterShimmer(ctx, camera, cx, cy, radius, animTime, isOcean) {
	const pCenter = camera.project(cx, cy, 0)
	if (!pCenter.visible) return

	ctx.save()
	const waveOffset = Math.sin(animTime * 2 + cx * 0.05 + cy * 0.05) * (radius * 0.15)
	const pLeft = camera.project(cx - radius * 0.4, cy + waveOffset, 0)
	const pMid = camera.project(cx, cy + waveOffset - 2, 0)
	const pRight = camera.project(cx + radius * 0.4, cy + waveOffset, 0)

	ctx.strokeStyle = isOcean ? 'rgba(96, 165, 250, 0.28)' : 'rgba(255, 255, 255, 0.32)'
	ctx.lineWidth = Math.max(0.8, 1.4 * pCenter.scale)
	ctx.beginPath()
	ctx.moveTo(pLeft.x, pLeft.y)
	ctx.quadraticCurveTo(pMid.x, pMid.y, pRight.x, pRight.y)
	ctx.stroke()
	ctx.restore()
}

/**
 * Draws rivers flowing along edges with perspective scaling and animated currents.
 * Uses organic procedural cubic Bezier meanders with adaptive curvature per tier (Civilization style).
 * Thinner rivers (brooks/creeks) have tighter, more winding micro-meanders.
 */
function drawRivers(ctx, camera, mapData, radius, animTime) {
	if (!mapData.rivers) return

	const rivers = Object.values(mapData.rivers)
	if (rivers.length === 0) return

	ctx.save()

	for (const river of rivers) {
		const center = hexToWorldGroundCenter(river.col, river.row, radius)
		const groundVerts = getHexGroundVertices(center.x, center.y, radius)
		const { from: gFrom, to: gTo } = getHexEdgeEndpoints(groundVerts, river.edge)
		const canonKey = getCanonicalEdgeKey(river.col, river.row, river.edge)
		const tier = river.width || 1
		const { cp1, cp2 } = getRiverMeanderControls(gFrom, gTo, canonKey, radius, tier)

		const pFrom = camera.project(gFrom.x, gFrom.y, 0)
		const pCP1 = camera.project(cp1.x, cp1.y, 0)
		const pCP2 = camera.project(cp2.x, cp2.y, 0)
		const pTo = camera.project(gTo.x, gTo.y, 0)

		if (!pFrom.visible && !pTo.visible) continue

		const avgScale = (pFrom.scale + pTo.scale) / 2
		let baseWidth
		let shoreExtra
		let currentDashW
		if (tier === 3) {
			baseWidth = Math.max(2.6, 6.2 * avgScale)
			shoreExtra = 1.8 * avgScale
			currentDashW = Math.max(1.2, baseWidth * 0.35)
		} else if (tier === 2) {
			baseWidth = Math.max(1.8, 3.6 * avgScale)
			shoreExtra = 1.4 * avgScale
			currentDashW = Math.max(0.9, baseWidth * 0.38)
		} else {
			// Tier 1: fine mountain creek/brook
			baseWidth = Math.max(1.0, 1.9 * avgScale)
			shoreExtra = 1.0 * avgScale
			currentDashW = Math.max(0.6, baseWidth * 0.40)
		}
		const flowDir = river.flowDir === -1 ? -1 : 1

		function traceRiver() {
			ctx.beginPath()
			ctx.moveTo(pFrom.x, pFrom.y)
			ctx.bezierCurveTo(pCP1.x, pCP1.y, pCP2.x, pCP2.y, pTo.x, pTo.y)
		}

		// 1. Riverbed shadow / shore blending
		traceRiver()
		ctx.lineWidth = baseWidth + shoreExtra
		ctx.strokeStyle = '#0369a1'
		ctx.lineCap = 'round'
		ctx.stroke()

		// 2. Main river water ribbon
		traceRiver()
		ctx.lineWidth = baseWidth
		ctx.strokeStyle = '#38bdf8'
		ctx.stroke()

		// 3. Animated flowing current highlight (flow direction is clearly visible through motion)
		traceRiver()
		ctx.lineWidth = currentDashW
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
		const dashLen = (tier === 1 ? 4 : (tier === 2 ? 5 : 6)) * avgScale
		ctx.setLineDash([dashLen, dashLen])
		ctx.lineDashOffset = -flowDir * (animTime * 22 * avgScale)
		ctx.stroke()
		ctx.setLineDash([])
	}

	ctx.restore()
}

/**
 * Draws roads connecting adjacent hex centers on the perspective terrain surface.
 * Roads strictly hug the terrain relief: at the shared hex boundary, elevation is 0 (ground level),
 * ascending the slopes to hill plateau summits (Z ~ 16) without hovering in mid-air.
 * For junctions with 3+ road connections, renders organic webbed fillets ("слипание как угол перепонок").
 */
function drawRoads(ctx, camera, mapData, radius) {
	if (!mapData.roads) return

	const roads = Object.values(mapData.roads)
	if (roads.length === 0) return

	ctx.save()

	// 1. Track connected road branches per cell to identify crossroads junctions
	const cellBranches = new Map()

	function registerBranch(cFrom, cTo, roadType) {
		const key = `${cFrom.col},${cFrom.row}`
		let list = cellBranches.get(key)
		if (!list) {
			list = []
			cellBranches.set(key, list)
		}
		list.push({ toCol: cTo.col, toRow: cTo.row, roadType })
	}

	for (const road of roads) {
		registerBranch(road.from, road.to, road.type)
		registerBranch(road.to, road.from, road.type)
	}

	// 2. Draw each road segment with terrain surface profiling
	for (const road of roads) {
		const c1 = hexToWorldGroundCenter(road.from.col, road.from.row, radius)
		const c2 = hexToWorldGroundCenter(road.to.col, road.to.row, radius)
		const canonKey = getCanonicalRoadKey(road.from.col, road.from.row, road.to.col, road.to.row)

		// 3D elevation profiling over hills:
		// Base perimeter of every hex is at Z = 0.
		// The road boundary crossing M is strictly at ground level (Z = 0), climbing hill slopes to the plateau.
		const fCell1 = mapData.cells?.[`${road.from.col},${road.from.row}`]
		const fCell2 = mapData.cells?.[`${road.to.col},${road.to.row}`]
		const z1 = (fCell1?.feature === 'hills') ? 16 * (radius / 36) : 0
		const z2 = (fCell2?.feature === 'hills') ? 16 * (radius / 36) : 0
		const zQ1 = z1 * 0.85
		const zQ2 = z2 * 0.85

		const { mid, cp1, cp2 } = getRoadPathControls(c1, c2, canonKey, radius)

		const p1 = camera.projectTerrain(c1.x, c1.y, z1)
		const pQ1 = camera.projectTerrain(cp1.x, cp1.y, zQ1)
		const pMid = camera.projectTerrain(mid.x, mid.y, 0) // Ground level at boundary
		const pQ2 = camera.projectTerrain(cp2.x, cp2.y, zQ2)
		const p2 = camera.projectTerrain(c2.x, c2.y, z2)

		if (!p1.visible && !p2.visible && !pMid.visible) continue

		const avgScale = (p1.scale + p2.scale) / 2
		const isStone = road.type === 'stone'

		function traceRoad() {
			ctx.beginPath()
			ctx.moveTo(p1.x, p1.y)
			ctx.quadraticCurveTo(pQ1.x, pQ1.y, pMid.x, pMid.y)
			ctx.quadraticCurveTo(pQ2.x, pQ2.y, p2.x, p2.y)
		}

		// Road border outline (casing)
		traceRoad()
		ctx.lineWidth = (isStone ? 5 : 4) * avgScale
		ctx.strokeStyle = isStone ? '#475569' : '#451a03'
		ctx.lineCap = 'round'
		ctx.stroke()

		// Road main surface
		traceRoad()
		ctx.lineWidth = (isStone ? 3 : 2.5) * avgScale
		ctx.strokeStyle = isStone ? '#94a3b8' : '#b45309'
		ctx.stroke()

		if (!isStone) {
			// Dirt ruts
			traceRoad()
			ctx.lineWidth = 1 * avgScale
			ctx.strokeStyle = 'rgba(254, 243, 199, 0.4)'
			ctx.setLineDash([3 * avgScale, 4 * avgScale])
			ctx.stroke()
			ctx.setLineDash([])
		}
	}

	// 3. Draw organic webbed crossroads ("слипание как угол перепонок") for cells with 3+ road connections
	for (const [cellKey, branches] of cellBranches.entries()) {
		if (branches.length < 3) continue // 1 (dead end) and 2 (passing bend) need no webbing!

		const [colStr, rowStr] = cellKey.split(',')
		const col = parseInt(colStr, 10)
		const row = parseInt(rowStr, 10)
		const cell = mapData.cells?.[cellKey]
		const center = hexToWorldGroundCenter(col, row, radius)
		const zCell = (cell?.feature === 'hills') ? 16 * (radius / 36) : 0

		const pCenter = camera.projectTerrain(center.x, center.y, zCell)
		if (!pCenter.visible) continue

		const isStone = branches.some(b => b.roadType === 'stone') || cell?.road === 'stone'
		const sc = pCenter.scale

		// Calculate branch angles around the cell center and sort cyclically
		const branchData = branches.map(b => {
			const nCenter = hexToWorldGroundCenter(b.toCol, b.toRow, radius)
			const angle = Math.atan2(nCenter.y - center.y, nCenter.x - center.x)
			return { angle, roadType: b.roadType }
		})
		branchData.sort((a, b) => a.angle - b.angle)

		const k = branchData.length
		const dBranch = radius * 0.35
		const halfRoadW = (isStone ? 2.5 : 2.0) * (radius / 36)

		// Build outer webbed polygon points
		// For each branch: left shoulder -> right shoulder -> concave fillet to next branch left shoulder
		function traceWebbedPolygon(insetScale = 1.0) {
			ctx.beginPath()
			const wRoad = halfRoadW * insetScale

			for (let i = 0; i < k; i++) {
				const b = branchData[i]
				const bNext = branchData[(i + 1) % k]

				const ux = Math.cos(b.angle)
				const uy = Math.sin(b.angle)
				const nx = -uy
				const ny = ux

				// Shoulders along branch axis
				const bx = center.x + ux * dBranch
				const by = center.y + uy * dBranch

				const lx = bx + nx * wRoad
				const ly = by + ny * wRoad
				const rx = bx - nx * wRoad
				const ry = by - ny * wRoad

				// Project to screen
				const pL = camera.projectTerrain(lx, ly, zCell)
				const pR = camera.projectTerrain(rx, ry, zCell)

				if (i === 0) {
					ctx.moveTo(pL.x, pL.y)
				} else {
					ctx.lineTo(pL.x, pL.y)
				}
				ctx.lineTo(pR.x, pR.y)

				// Inward webbed fillet to next branch
				let deltaAngle = bNext.angle - b.angle
				if (deltaAngle < 0) deltaAngle += Math.PI * 2
				const midAngle = b.angle + deltaAngle / 2

				// Web dip distance: tight angle -> stretches further out; wide angle -> deeper dip
				const dWeb = radius * Math.max(0.10, 0.26 - (deltaAngle / (Math.PI * 2)) * 0.22) * insetScale
				const wx = center.x + Math.cos(midAngle) * dWeb
				const wy = center.y + Math.sin(midAngle) * dWeb
				const pWeb = camera.projectTerrain(wx, wy, zCell)

				// Next branch left shoulder
				const uxNext = Math.cos(bNext.angle)
				const uyNext = Math.sin(bNext.angle)
				const nxNext = -uyNext
				const nyNext = uxNext
				const bxNext = center.x + uxNext * dBranch
				const byNext = center.y + uyNext * dBranch
				const pLNext = camera.projectTerrain(bxNext + nxNext * wRoad, byNext + nyNext * wRoad, zCell)

				// Concave webbed curve
				ctx.quadraticCurveTo(pWeb.x, pWeb.y, pLNext.x, pLNext.y)
			}
			ctx.closePath()
		}

		// Draw webbed outer casing
		traceWebbedPolygon(1.25)
		ctx.fillStyle = isStone ? '#475569' : '#451a03'
		ctx.fill()
		ctx.lineWidth = 1.0 * sc
		ctx.strokeStyle = isStone ? '#475569' : '#451a03'
		ctx.stroke()

		// Draw webbed inner road surface
		traceWebbedPolygon(0.85)
		ctx.fillStyle = isStone ? '#94a3b8' : '#b45309'
		ctx.fill()
	}

	ctx.restore()
}

/**
 * Draws bridges where roads cross rivers on shared edges.
 */
function drawBridges(ctx, camera, mapData, radius) {
	if (!mapData.roads || !mapData.rivers) return

	const roads = Object.values(mapData.roads)
	if (roads.length === 0) return

	for (const road of roads) {
		const c1 = road.from
		const c2 = road.to

		for (const edge of HEX_EDGES) {
			const neighbor = getHexNeighbor(c1.col, c1.row, edge)
			if (neighbor.col === c2.col && neighbor.row === c2.row) {
				const bridgeInfo = checkBridgeBetweenHexes(mapData, c1.col, c1.row, c2.col, c2.row, edge)
				if (bridgeInfo.hasBridge) {
					const c1Ground = hexToWorldGroundCenter(c1.col, c1.row, radius)
					const c2Ground = hexToWorldGroundCenter(c2.col, c2.row, radius)
					const canonRoadKey = getCanonicalRoadKey(c1.col, c1.row, c2.col, c2.row)
					const { mid, cp1, cp2 } = getRoadPathControls(c1Ground, c2Ground, canonRoadKey, radius)

					// Bridge sits on the boundary crossing on the ground at Z = 0
					const pMid = camera.projectTerrain(mid.x, mid.y, 0)
					const pQ1 = camera.projectTerrain(cp1.x, cp1.y, 0)
					const pQ2 = camera.projectTerrain(cp2.x, cp2.y, 0)

					if (!pMid.visible) continue

					const midX = pMid.x
					const midY = pMid.y
					const rdx = pQ2.x - pQ1.x
					const rdy = pQ2.y - pQ1.y
					const rLen = Math.hypot(rdx, rdy) || 1
					const ux = rdx / rLen
					const uy = rdy / rLen

					const avgScale = pMid.scale
					// Span scaled to thinner river tiers
					const rTier = bridgeInfo.riverWidth || 1
					const bridgeSpan = (rTier === 3 ? 6.5 : (rTier === 2 ? 4.5 : 3.2)) * avgScale
					const bWidth = (bridgeInfo.roadType === 'stone' ? 5.0 : 4.0) * avgScale

					ctx.save()
					// Shadow
					ctx.beginPath()
					ctx.moveTo(midX - ux * bridgeSpan, midY - uy * bridgeSpan + 2 * avgScale)
					ctx.lineTo(midX + ux * bridgeSpan, midY + uy * bridgeSpan + 2 * avgScale)
					ctx.lineWidth = bWidth + 2 * avgScale
					ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)'
					ctx.lineCap = 'butt'
					ctx.stroke()

					// Bridge deck
					ctx.beginPath()
					ctx.moveTo(midX - ux * bridgeSpan, midY - uy * bridgeSpan)
					ctx.lineTo(midX + ux * bridgeSpan, midY + uy * bridgeSpan)
					ctx.lineWidth = bWidth
					ctx.strokeStyle = bridgeInfo.roadType === 'stone' ? '#e2e8f0' : '#8d6e63'
					ctx.lineCap = 'butt'
					ctx.stroke()

					// Parapets
					const perpX = -uy * (bWidth / 2 + 1 * avgScale)
					const perpY = ux * (bWidth / 2 + 1 * avgScale)
					ctx.lineWidth = Math.max(0.8, 1 * avgScale)
					ctx.strokeStyle = bridgeInfo.roadType === 'stone' ? '#475569' : '#4e342e'

					ctx.beginPath()
					ctx.moveTo(midX - ux * bridgeSpan + perpX, midY - uy * bridgeSpan + perpY)
					ctx.lineTo(midX + ux * bridgeSpan + perpX, midY + uy * bridgeSpan + perpY)
					ctx.stroke()

					ctx.beginPath()
					ctx.moveTo(midX - ux * bridgeSpan - perpX, midY - uy * bridgeSpan - perpY)
					ctx.lineTo(midX + ux * bridgeSpan - perpX, midY + uy * bridgeSpan - perpY)
					ctx.stroke()

					ctx.restore()
				}
				break
			}
		}
	}
}

/**
 * Legacy hill billboard renderer (deprecated, hills are now rendered in drawHillHexCell).
 */
function drawHills(ctx, camera, cell, radius) {
	// No-op: hills are now rendered directly as 3D deformed hex terrain cells in drawHexCell
}

/**
 * Draws mountains as upright 2.5D billboard illustrations facing the camera (like settlements).
 * Features:
 * - Upright vertical projection: stands tall facing the screen regardless of pitch angle.
 * - Never squashes or disappears at pitch = 0° or max zoom-out.
 * - Crisp Alpine silhouette with slate rock faces, jagged central ridge, dark outlines, and snow caps.
 * - Lateral perspective parallax: peak leans slightly outward when camera pans sideways.
 * - Multi-peak massifs for radius >= 2 and >= 3.
 */
function drawMountain(ctx, camera, cell, radius) {
	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	const p = camera.project(center.x, center.y, 0)
	if (!p.visible) return

	const sc = p.scale
	const cx = p.x
	const drawY = p.y
	const mRadius = cell.mountainRadius || 1

	// Lateral perspective parallax: peak leans outward when panning sideways
	const dx = center.x - camera.cameraX
	const parallaxX = (dx / camera.focalDistance) * (20 * sc)

	// Main peak dimensions (upright billboard facing camera)
	const h = (46 + (mRadius - 1) * 22) * sc
	const w = radius * (0.80 + (mRadius - 1) * 0.22) * sc

	ctx.save()

	// 1. Soft footprint shadow on ground
	ctx.beginPath()
	const shadowW = w * 1.15
	const shadowH = w * 0.26 * Math.max(0.3, camera.cosT)
	ctx.ellipse(cx + 3 * sc, drawY + 2 * sc * camera.cosT, shadowW, shadowH, 0, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(15, 23, 42, 0.38)'
	ctx.fill()

	// Helper to draw an upright mountain peak with rock shading and snow cap
	function drawPeak(peakX, peakY, baseLeftX, baseRightX, baseY, ridgeX, scaleFactor = 1) {
		const ridgeKinkX = (peakX * 0.55 + ridgeX * 0.45) + (3 * sc * scaleFactor)
		const ridgeKinkY = (peakY * 0.55 + baseY * 0.45)

		// A. Left face (lit by morning sun)
		ctx.beginPath()
		ctx.moveTo(peakX, peakY)
		ctx.lineTo(baseLeftX, baseY)
		ctx.lineTo(ridgeX, baseY)
		ctx.lineTo(ridgeKinkX, ridgeKinkY)
		ctx.closePath()
		ctx.fillStyle = '#94a3b8'
		ctx.fill()
		ctx.strokeStyle = '#334155'
		ctx.lineWidth = Math.max(0.8, 1.2 * sc)
		ctx.stroke()

		// B. Right face (shaded slope)
		ctx.beginPath()
		ctx.moveTo(peakX, peakY)
		ctx.lineTo(ridgeKinkX, ridgeKinkY)
		ctx.lineTo(ridgeX, baseY)
		ctx.lineTo(baseRightX, baseY)
		ctx.closePath()
		ctx.fillStyle = '#475569'
		ctx.fill()
		ctx.strokeStyle = '#1e293b'
		ctx.lineWidth = Math.max(0.8, 1.2 * sc)
		ctx.stroke()

		// C. Snow cap on top (top 35%)
		const snowT = 0.35
		const sLeftX = peakX + (baseLeftX - peakX) * snowT
		const sLeftY = peakY + (baseY - peakY) * snowT
		const sRightX = peakX + (baseRightX - peakX) * snowT
		const sRightY = peakY + (baseY - peakY) * snowT
		const sMidX = peakX + (ridgeKinkX - peakX) * (snowT * 1.1)
		const sMidY = peakY + (ridgeKinkY - peakY) * (snowT * 1.1)

		// Left snow cap
		ctx.beginPath()
		ctx.moveTo(peakX, peakY)
		ctx.lineTo(sLeftX, sLeftY)
		ctx.lineTo(sMidX, sMidY)
		ctx.closePath()
		ctx.fillStyle = '#ffffff'
		ctx.fill()
		ctx.strokeStyle = '#475569'
		ctx.lineWidth = Math.max(0.6, 0.9 * sc)
		ctx.stroke()

		// Right snow cap
		ctx.beginPath()
		ctx.moveTo(peakX, peakY)
		ctx.lineTo(sMidX, sMidY)
		ctx.lineTo(sRightX, sRightY)
		ctx.closePath()
		ctx.fillStyle = '#e2e8f0'
		ctx.fill()
		ctx.strokeStyle = '#334155'
		ctx.lineWidth = Math.max(0.6, 0.9 * sc)
		ctx.stroke()
	}

	// 2. Secondary peaks for radius >= 2 and >= 3 (drawn behind main peak)
	if (mRadius >= 2) {
		const hL = h * 0.72
		const wL = w * 0.58
		const cxL = cx - w * 0.52 + parallaxX * 0.65
		const drawYL = drawY - radius * 0.08 * sc * camera.cosT
		drawPeak(
			cxL,
			drawYL - hL,
			cxL - wL,
			cxL + wL,
			drawYL,
			cxL + (wL * 0.08),
			0.7
		)
	}

	if (mRadius >= 3) {
		const hR = h * 0.64
		const wR = w * 0.52
		const cxR = cx + w * 0.50 + parallaxX * 0.60
		const drawYR = drawY - radius * 0.06 * sc * camera.cosT
		drawPeak(
			cxR,
			drawYR - hR,
			cxR - wR,
			cxR + wR,
			drawYR,
			cxR + (wR * 0.06),
			0.65
		)
	}

	// 3. Main Peak (Front and center, upright facing the camera)
	const mainPeakX = cx + parallaxX
	const mainPeakY = drawY - h
	const mainBaseY = drawY + 2 * sc * camera.cosT
	const mainRidgeX = cx + parallaxX * 0.25

	drawPeak(
		mainPeakX,
		mainPeakY,
		cx - w,
		cx + w,
		mainBaseY,
		mainRidgeX,
		1.0
	)

	ctx.restore()
}

/**
 * Draws settlements of different types: camp, village, town, fortress, walled_city.
 * All buildings stand vertically upright towards the camera (Don't Starve billboarding).
 */
function drawSettlement(ctx, camera, cell, radius, isDiscovered, drawCanvasBadges = false) {
	const settlement = cell.settlement
	if (!settlement) return

	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	// If cell also has a mountain, offset the settlement slightly forward on ground
	const yOffset = cell.feature === 'mountain' ? radius * 0.22 : 0
	const zOffset = cell.feature === 'hills' ? 16 * (radius / 36) : 0
	const p = camera.projectTerrain(center.x, center.y + yOffset, zOffset)
	if (!p.visible) return

	const sc = p.scale
	const cx = p.x
	const drawY = p.y
	const typeDef = SETTLEMENT_TYPES[settlement.type] || SETTLEMENT_TYPES.village

	ctx.save()

	// Ground footprint shadow
	ctx.beginPath()
	ctx.ellipse(cx, drawY + 2 * sc * camera.cosT, radius * 0.44 * sc, radius * 0.22 * sc * camera.cosT, 0, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(15, 23, 42, 0.45)'
	ctx.fill()

	// Specific settlement visual rendering (UPRIGHT BILLBOARD FACING CAMERA)
	switch (settlement.type) {
		case 'camp': {
			// Camp with upright tents and fire
			drawTent(ctx, cx - 12 * sc, drawY - 16 * sc, 13 * sc, 16 * sc, '#d97706', sc)
			drawTent(ctx, cx + 2 * sc, drawY - 13 * sc, 11 * sc, 13 * sc, '#b45309', sc)
			// Campfire with stones and flame
			ctx.beginPath()
			ctx.arc(cx - 1 * sc, drawY + 1 * sc, 2.5 * sc, 0, Math.PI * 2)
			ctx.fillStyle = '#475569'
			ctx.fill()
			// Flame
			ctx.beginPath()
			ctx.moveTo(cx - 2.5 * sc, drawY + 1 * sc)
			ctx.lineTo(cx - 1 * sc, drawY - 6 * sc)
			ctx.lineTo(cx + 0.5 * sc, drawY + 1 * sc)
			ctx.closePath()
			ctx.fillStyle = '#f97316'
			ctx.fill()
			ctx.beginPath()
			ctx.arc(cx - 1 * sc, drawY - 1 * sc, 1.2 * sc, 0, Math.PI * 2)
			ctx.fillStyle = '#facc15'
			ctx.fill()
			break
		}
		case 'village': {
			// Upright timber cottages with thatched roofs and stone chimney
			drawCottage(ctx, cx - 13 * sc, drawY - 18 * sc, 14 * sc, 18 * sc, '#78350f', '#f59e0b', true, sc)
			drawCottage(ctx, cx + 2 * sc, drawY - 15 * sc, 12 * sc, 15 * sc, '#78350f', '#d97706', false, sc)
			break
		}
		case 'town': {
			// 3 upright townhouses of varying heights
			drawCottage(ctx, cx - 14 * sc, drawY - 20 * sc, 12 * sc, 19 * sc, '#475569', '#3b82f6', true, sc)
			drawCottage(ctx, cx - 4 * sc, drawY - 23 * sc, 13 * sc, 22 * sc, '#334155', '#ef4444', false, sc)
			drawCottage(ctx, cx + 6 * sc, drawY - 16 * sc, 11 * sc, 15 * sc, '#475569', '#10b981', false, sc)
			break
		}
		case 'fortress': {
			// Upright stone keep with 2 tall watchtowers and battlements
			drawTower(ctx, cx - 13 * sc, drawY - 24 * sc, 9 * sc, 24 * sc, '#64748b', sc)
			drawTower(ctx, cx + 4 * sc, drawY - 24 * sc, 9 * sc, 24 * sc, '#64748b', sc)
			// Center keep
			ctx.fillStyle = '#475569'
			ctx.fillRect(cx - 6 * sc, drawY - 16 * sc, 12 * sc, 16 * sc)
			ctx.strokeStyle = '#334155'
			ctx.lineWidth = Math.max(0.6, 0.8 * sc)
			ctx.strokeRect(cx - 6 * sc, drawY - 16 * sc, 12 * sc, 16 * sc)
			// Arched gate
			ctx.beginPath()
			ctx.arc(cx, drawY - 4 * sc, 2.5 * sc, Math.PI, 0)
			ctx.lineTo(cx + 2.5 * sc, drawY)
			ctx.lineTo(cx - 2.5 * sc, drawY)
			ctx.closePath()
			ctx.fillStyle = '#1e293b'
			ctx.fill()
			// Red flag on left tower
			ctx.fillStyle = '#ef4444'
			ctx.beginPath()
			ctx.moveTo(cx - 9 * sc, drawY - 28 * sc)
			ctx.lineTo(cx - 2 * sc, drawY - 25 * sc)
			ctx.lineTo(cx - 9 * sc, drawY - 22 * sc)
			ctx.closePath()
			ctx.fill()
			break
		}
		case 'walled_city': {
			// City wall ring around dense buildings
			ctx.beginPath()
			ctx.ellipse(cx, drawY, radius * 0.46 * sc, radius * 0.22 * sc * camera.cosT, 0, 0, Math.PI * 2)
			ctx.lineWidth = 2.5 * sc
			ctx.strokeStyle = '#94a3b8'
			ctx.stroke()

			// Cathedral / Citadel in center with towering spire
			drawTower(ctx, cx - 6 * sc, drawY - 24 * sc, 12 * sc, 24 * sc, '#cbd5e1', sc)
			// Spire
			ctx.beginPath()
			ctx.moveTo(cx, drawY - 32 * sc)
			ctx.lineTo(cx - 6 * sc, drawY - 24 * sc)
			ctx.lineTo(cx + 6 * sc, drawY - 24 * sc)
			ctx.closePath()
			ctx.fillStyle = '#f59e0b'
			ctx.fill()
			ctx.strokeStyle = '#b45309'
			ctx.lineWidth = Math.max(0.6, 0.8 * sc)
			ctx.stroke()

			// Houses inside walls
			drawCottage(ctx, cx - 14 * sc, drawY - 11 * sc, 9 * sc, 11 * sc, '#475569', '#3b82f6', false, sc)
			drawCottage(ctx, cx + 5 * sc, drawY - 11 * sc, 9 * sc, 11 * sc, '#475569', '#ef4444', false, sc)
			break
		}
	}

	// Name banner label (placed below settlement buildings) - rendered only if drawCanvasBadges is enabled
	if (drawCanvasBadges) {
		const nameText = settlement.name || typeDef.name
		const fontSize = Math.max(8, Math.round(9 * sc))
		ctx.font = `bold ${fontSize}px sans-serif`
		const textWidth = ctx.measureText(nameText).width
		const badgeH = 14 * sc
		const badgeW = textWidth + 12 * sc
		const badgeX = cx - badgeW / 2
		const badgeY = drawY + radius * 0.26 * sc * camera.cosT + 4 * sc

		// Badge pill
		ctx.beginPath()
		ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3 * sc)
		ctx.fillStyle = isDiscovered ? 'rgba(15, 23, 42, 0.88)' : 'rgba(71, 85, 105, 0.8)'
		ctx.fill()
		ctx.lineWidth = Math.max(0.6, 1 * sc)
		ctx.strokeStyle = isDiscovered ? typeDef.color : '#94a3b8'
		ctx.stroke()

		// Badge text
		ctx.fillStyle = isDiscovered ? '#f8fafc' : '#cbd5e1'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(nameText, cx, badgeY + badgeH / 2)

		// If has local map, add pin icon
		if (settlement.hasLocalMap) {
			ctx.font = `${Math.max(7, Math.round(8 * sc))}px sans-serif`
			ctx.fillText('📍', badgeX + badgeW - 4 * sc, badgeY + badgeH / 2)
		}
	}

	ctx.restore()
}

function drawTent(ctx, x, y, w, h, color, sc = 1) {
	ctx.beginPath()
	ctx.moveTo(x + w / 2, y)
	ctx.lineTo(x, y + h)
	ctx.lineTo(x + w, y + h)
	ctx.closePath()
	ctx.fillStyle = color
	ctx.fill()
	ctx.strokeStyle = '#451a03'
	ctx.lineWidth = Math.max(0.5, 0.8 * sc)
	ctx.stroke()

	// Shaded right panel
	ctx.beginPath()
	ctx.moveTo(x + w / 2, y)
	ctx.lineTo(x + w / 2, y + h)
	ctx.lineTo(x + w, y + h)
	ctx.closePath()
	ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
	ctx.fill()

	// Entrance triangle
	ctx.beginPath()
	ctx.moveTo(x + w / 2, y + h * 0.45)
	ctx.lineTo(x + w * 0.35, y + h)
	ctx.lineTo(x + w * 0.65, y + h)
	ctx.closePath()
	ctx.fillStyle = '#1c1917'
	ctx.fill()
}

function drawCottage(ctx, x, y, w, h, wallColor, roofColor, hasChimney = false, sc = 1) {
	const roofH = h * 0.5
	const wallH = h - roofH

	// Chimney
	if (hasChimney) {
		ctx.fillStyle = '#64748b'
		ctx.fillRect(x + w - 3 * sc, y + 2 * sc, 2.5 * sc, 6 * sc)
	}

	// Wall
	ctx.fillStyle = wallColor
	ctx.fillRect(x + 1 * sc, y + roofH, w - 2 * sc, wallH)
	ctx.strokeStyle = '#27272a'
	ctx.lineWidth = Math.max(0.5, 0.6 * sc)
	ctx.strokeRect(x + 1 * sc, y + roofH, w - 2 * sc, wallH)

	// Door
	ctx.fillStyle = '#18181b'
	ctx.fillRect(x + w / 2 - 1.5 * sc, y + h - 5 * sc, 3 * sc, 5 * sc)

	// Window
	ctx.fillStyle = '#fef08a'
	ctx.fillRect(x + 2 * sc, y + roofH + 2 * sc, 2.5 * sc, 2.5 * sc)

	// Pitched Roof
	ctx.beginPath()
	ctx.moveTo(x + w / 2, y)
	ctx.lineTo(x - 1 * sc, y + roofH)
	ctx.lineTo(x + w + 1 * sc, y + roofH)
	ctx.closePath()
	ctx.fillStyle = roofColor
	ctx.fill()
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
	ctx.lineWidth = Math.max(0.5, 0.8 * sc)
	ctx.stroke()
}

function drawTower(ctx, x, y, w, h, color, sc = 1) {
	// Tower body
	ctx.fillStyle = color
	ctx.fillRect(x, y, w, h)
	ctx.strokeStyle = '#1e293b'
	ctx.lineWidth = Math.max(0.5, 0.8 * sc)
	ctx.strokeRect(x, y, w, h)

	// Shading on right side
	ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
	ctx.fillRect(x + w / 2, y, w / 2, h)

	// Battlements / Crenellations at top
	ctx.fillStyle = color
	ctx.fillRect(x - 1 * sc, y - 3 * sc, 3 * sc, 3 * sc)
	ctx.fillRect(x + w - 2 * sc, y - 3 * sc, 3 * sc, 3 * sc)
	ctx.strokeRect(x - 1 * sc, y - 3 * sc, 3 * sc, 3 * sc)
	ctx.strokeRect(x + w - 2 * sc, y - 3 * sc, 3 * sc, 3 * sc)

	// Arrow slit
	ctx.fillStyle = '#0f172a'
	ctx.fillRect(x + w / 2 - 0.75 * sc, y + 6 * sc, 1.5 * sc, 4 * sc)
}

/**
 * Highlights a hex with a glowing outline on the 3D perspective ground plane.
 */
function drawHexHighlight(ctx, camera, col, row, radius, color, fillOpacity = 0.2, lineWidth = 2) {
	const center = hexToWorldGroundCenter(col, row, radius)
	const groundVerts = getHexGroundVertices(center.x, center.y, radius)
	const screenVerts = groundVerts.map(v => camera.project(v.x, v.y, 0))

	if (!screenVerts.some(v => v.visible)) return

	ctx.save()
	ctx.beginPath()
	ctx.moveTo(screenVerts[0].x, screenVerts[0].y)
	for (let i = 1; i < screenVerts.length; i++) {
		ctx.lineTo(screenVerts[i].x, screenVerts[i].y)
	}
	ctx.closePath()

	ctx.fillStyle = color.replace(')', `, ${fillOpacity})`).replace('rgb', 'rgba').replace('#38bdf8', `rgba(56, 189, 248, ${fillOpacity})`).replace('#f6c445', `rgba(246, 196, 69, ${fillOpacity})`)
	ctx.fill()

	const avgScale = screenVerts[0].scale
	ctx.lineWidth = Math.max(1, lineWidth * avgScale)
	ctx.strokeStyle = color
	ctx.stroke()
	ctx.restore()
}

/**
 * Highlights a specific hex edge (for river drawing).
 */
function drawEdgeHighlight(ctx, camera, col, row, edge, radius, riverWidth = 1) {
	const center = hexToWorldGroundCenter(col, row, radius)
	const groundVerts = getHexGroundVertices(center.x, center.y, radius)
	const { from, to } = getHexEdgeEndpoints(groundVerts, edge)
	const canonKey = getCanonicalEdgeKey(col, row, edge)
	const tier = riverWidth || 1
	const { cp1, cp2 } = getRiverMeanderControls(from, to, canonKey, radius, tier)

	const pFrom = camera.project(from.x, from.y, 0)
	const pCP1 = camera.project(cp1.x, cp1.y, 0)
	const pCP2 = camera.project(cp2.x, cp2.y, 0)
	const pTo = camera.project(to.x, to.y, 0)

	if (!pFrom.visible && !pTo.visible) return

	const avgScale = (pFrom.scale + pTo.scale) / 2
	let highlightW
	if (tier === 3) highlightW = Math.max(2.6, 6.2 * avgScale)
	else if (tier === 2) highlightW = Math.max(1.8, 3.6 * avgScale)
	else highlightW = Math.max(1.0, 1.9 * avgScale)

	ctx.save()
	ctx.beginPath()
	ctx.moveTo(pFrom.x, pFrom.y)
	ctx.bezierCurveTo(pCP1.x, pCP1.y, pCP2.x, pCP2.y, pTo.x, pTo.y)
	ctx.lineWidth = highlightW + 1.8 * avgScale
	ctx.strokeStyle = '#38bdf8'
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}
