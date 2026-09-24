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
	checkBridgeBetweenHexes,
	getFactionVisuals,
	hexToRgba
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
	getBorderMeanderControls,
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
		showBorders = true,
		factionsMap = null,
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

	// 1. Draw all hex base cells (flat ground plane, sorted North to South by true ground center Y)
	const cellEntries = Object.values(mapData.cells || {})
	cellEntries.sort((a, b) => {
		const yA = hexToWorldGroundCenter(a.col, a.row, radius).y
		const yB = hexToWorldGroundCenter(b.col, b.row, radius).y
		return yA - yB || a.col - b.col
	})

	for (const cell of cellEntries) {
		drawHexCell(ctx, camera, cell, radius, animTime)
	}

	// 1.5. Political borders & territory tint (Civilization style)
	if (showBorders) {
		drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap)
	}

	// 2. Draw rivers along edges (with animated flowing water on ground plane Z = 0)
	drawRivers(ctx, camera, mapData, radius, animTime)

	// 3. Draw 2.5D Hill relief sprites (biome-adaptive rolling mounds, inside hexes)
	for (const cell of cellEntries) {
		if (cell.feature === 'hills') {
			drawHills(ctx, camera, cell, radius)
		}
	}

	// 4. Draw roads across all cells (on top of ground and hill sprites, seamless multi-pass)
	const roadData = buildRoadRenderData(camera, mapData, radius)
	renderRoads(ctx, roadData)

	// 5. Draw bridges where roads cross rivers
	drawBridges(ctx, camera, mapData, radius)

	// 6. Draw 2.5D Pop-Up Objects (Mountains and Settlements)
	// Rendered back-to-front (depth sorted by true ground Y)
	for (const cell of cellEntries) {
		if (cell.feature === 'mountain') {
			drawMountain(ctx, camera, cell, radius)
		}

		if (cell.settlement) {
			const isDiscovered = !discoveredLocations || discoveredLocations.has(cell.settlement.id)
			drawSettlement(ctx, camera, cell, radius, isDiscovered, drawCanvasBadges)
		}
	}

	// 7. Draw hovered/selected hex highlights
	if (hoveredHex) {
		const hCell = mapData.cells?.[`${hoveredHex.col},${hoveredHex.row}`]
		drawHexHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, radius, '#38bdf8', 0.25, 2, hCell)
	}
	if (selectedHex) {
		const sCell = mapData.cells?.[`${selectedHex.col},${selectedHex.row}`]
		drawHexHighlight(ctx, camera, selectedHex.col, selectedHex.row, radius, '#f6c445', 0.35, 3, sCell)
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
 * Draws a single flat-topped hex cell on the 3D perspective ground plane.
 */
function drawHexCell(ctx, camera, cell, radius, animTime) {
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
 * Draws political borders and territory fills (Civilization style).
 *
 * Pass 1: Territory Fill
 * - Fills hex cells with a subtle translucent tint (fillColor) representing the controlling faction.
 *
 * Pass 2: Outer National Borders
 * - Computes external edges where the adjacent hex belongs to a different faction (or no faction/map edge).
 * - Border lines are inset towards the cell center by 6% of the radius (0.06 * R).
 * - Because inset vertices for adjacent edges meet at the exact same vertex inset point,
 *   borders form continuous closed ribbons without gaps or overlaps.
 * - When two nations border each other, each draws an inset line on its own side,
 *   creating the classic dual-ribbon border seen in Civilization.
 * - Rendered in two passes: soft glowing halo ribbon + crisp heraldic inner stroke.
 */
export function drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap = null) {
	if (!ctx || !mapData || !mapData.cells) return

	const cells = mapData.cells
	const cellEntries = Object.values(cells)
	if (cellEntries.length === 0) return

	// Group cells by faction
	// Map: factionId -> { visuals, borderColor, fillColor, cells: Array<cell>, cellSet: Set<"col,row"> }
	const factionGroups = new Map()

	for (const cell of cellEntries) {
		const fId = cell.faction || cell.fraction
		if (!fId) continue

		let group = factionGroups.get(fId)
		if (!group) {
			const visuals = getFactionVisuals(fId, factionsMap) || {}
			const borderColor = cell.borderColor || visuals.borderColor || '#38bdf8'
			const fillColor = cell.fillColor || visuals.fillColor || hexToRgba(borderColor, 0.16)
			group = {
				factionId: fId,
				visuals,
				borderColor,
				fillColor,
				cells: [],
				cellSet: new Set()
			}
			factionGroups.set(fId, group)
		}
		group.cells.push(cell)
		group.cellSet.add(`${cell.col},${cell.row}`)
	}

	if (factionGroups.size === 0) return

	ctx.save()

	// PASS 1: Territory Fills (Translucent colored background per cell)
	for (const group of factionGroups.values()) {
		if (!group.fillColor) continue

		ctx.fillStyle = group.fillColor
		for (const cell of group.cells) {
			const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
			const groundVerts = getHexGroundVertices(center.x, center.y, radius)
			const screenVerts = groundVerts.map(v => camera.project(v.x, v.y, 0))

			if (!screenVerts.some(v => v.visible)) continue

			ctx.beginPath()
			ctx.moveTo(screenVerts[0].x, screenVerts[0].y)
			for (let i = 1; i < screenVerts.length; i++) {
				ctx.lineTo(screenVerts[i].x, screenVerts[i].y)
			}
			ctx.closePath()
			ctx.fill()
		}
	}

	// PASS 2: External Boundary Chains (Continuous Smooth Polylines / Loops)
	// Edge vertex indices for flat-topped hex (clockwise around hex):
	// N: [4, 5], NE: [5, 0], SE: [0, 1], S: [1, 2], SW: [2, 3], NW: [3, 4]
	const EDGE_VERTEX_INDICES = {
		N: [4, 5],
		NE: [5, 0],
		SE: [0, 1],
		S: [1, 2],
		SW: [2, 3],
		NW: [3, 4]
	}

	function vertexKey(pt) {
		return `${Math.round(pt.x * 10)},${Math.round(pt.y * 10)}`
	}

	// Build quick lookup for river tiers by canonical edge key
	const riverMap = new Map()
	if (mapData.rivers) {
		for (const r of Object.values(mapData.rivers)) {
			const cKey = getCanonicalEdgeKey(r.col, r.row, r.edge)
			riverMap.set(cKey, r)
		}
	}

	// Group continuous chains by border color
	// Map: borderColor -> Array<Chain>
	const chainsByColor = new Map()

	for (const group of factionGroups.values()) {
		const borderEdges = []

		for (const cell of group.cells) {
			const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
			const groundVerts = getHexGroundVertices(center.x, center.y, radius)

			for (const edge of HEX_EDGES) {
				const nCoord = getHexNeighbor(cell.col, cell.row, edge)
				const nKey = `${nCoord.col},${nCoord.row}`

				// External boundary edge if neighbor cell is not in this faction
				if (!group.cellSet.has(nKey)) {
					const [iA, iB] = EDGE_VERTEX_INDICES[edge]
					const vFrom = groundVerts[iA]
					const vTo = groundVerts[iB]
					const canonKey = getCanonicalEdgeKey(cell.col, cell.row, edge)
					const river = riverMap.get(canonKey)
					const riverTier = river ? (river.width || 1) : 1

					borderEdges.push({
						fromKey: vertexKey(vFrom),
						toKey: vertexKey(vTo),
						vFrom,
						vTo,
						canonKey,
						riverTier
					})
				}
			}
		}

		if (borderEdges.length === 0) continue

		// Build adjacency graph to assemble border edges into continuous connected loops/chains
		const outgoing = new Map()
		const incoming = new Map()
		for (const e of borderEdges) {
			if (!outgoing.has(e.fromKey)) outgoing.set(e.fromKey, [])
			outgoing.get(e.fromKey).push(e)

			if (!incoming.has(e.toKey)) incoming.set(e.toKey, [])
			incoming.get(e.toKey).push(e)
		}

		const visited = new Set()
		const factionChains = []

		for (const startEdge of borderEdges) {
			if (visited.has(startEdge)) continue

			visited.add(startEdge)
			const chain = [startEdge]
			let curr = startEdge

			// Walk forward along adjacent edges
			while (true) {
				const nextList = outgoing.get(curr.toKey) || []
				const nextEdge = nextList.find(e => !visited.has(e))
				if (!nextEdge) break

				visited.add(nextEdge)
				chain.push(nextEdge)
				curr = nextEdge

				if (curr.toKey === chain[0].fromKey) {
					chain.isClosed = true
					break
				}
			}

			// If not closed, walk backwards from chain start to prepend any incoming edges
			if (!chain.isClosed) {
				let head = chain[0]
				while (true) {
					const prevList = incoming.get(head.fromKey) || []
					const prevEdge = prevList.find(e => !visited.has(e))
					if (!prevEdge) break

					visited.add(prevEdge)
					chain.unshift(prevEdge)
					head = prevEdge

					if (head.fromKey === chain[chain.length - 1].toKey) {
						chain.isClosed = true
						break
					}
				}
			}

			// Project segments in chain to camera screen coordinates
			let scaleSum = 0
			let visibleCount = 0

			const projectedChain = []
			for (const seg of chain) {
				const { cp1, cp2 } = getRiverMeanderControls(seg.vFrom, seg.vTo, seg.canonKey, radius, seg.riverTier)
				const pFrom = camera.project(seg.vFrom.x, seg.vFrom.y, 0)
				const pCP1 = camera.project(cp1.x, cp1.y, 0)
				const pCP2 = camera.project(cp2.x, cp2.y, 0)
				const pTo = camera.project(seg.vTo.x, seg.vTo.y, 0)

				if (pFrom.visible || pTo.visible) visibleCount++
				scaleSum += (pFrom.scale + pTo.scale) / 2

				projectedChain.push({
					pFrom,
					pCP1,
					pCP2,
					pTo
				})
			}

			// Only render if at least one vertex is visible in camera frustum
			if (visibleCount > 0 && projectedChain.length > 0) {
				projectedChain.isClosed = chain.isClosed
				projectedChain.avgScale = scaleSum / projectedChain.length

				let list = chainsByColor.get(group.borderColor)
				if (!list) {
					list = []
					chainsByColor.set(group.borderColor, list)
				}
				list.push(projectedChain)
			}
		}
	}

	// Render borders grouped by color
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'

	for (const [color, chains] of chainsByColor.entries()) {
		if (chains.length === 0) continue

		// PASS 2A: Soft halo ribbon glow
		ctx.strokeStyle = hexToRgba(color, 0.38)
		for (const chain of chains) {
			const avgScale = chain.avgScale || 1.0
			ctx.lineWidth = Math.max(2.4, 5.0 * avgScale)
			ctx.beginPath()
			ctx.moveTo(chain[0].pFrom.x, chain[0].pFrom.y)
			for (let i = 0; i < chain.length; i++) {
				const seg = chain[i]
				ctx.bezierCurveTo(seg.pCP1.x, seg.pCP1.y, seg.pCP2.x, seg.pCP2.y, seg.pTo.x, seg.pTo.y)
			}
			if (chain.isClosed) {
				ctx.closePath()
			}
			ctx.stroke()
		}

		// PASS 2B: Crisp heraldic inner stroke
		ctx.strokeStyle = color
		for (const chain of chains) {
			const avgScale = chain.avgScale || 1.0
			ctx.lineWidth = Math.max(1.3, 2.4 * avgScale)
			ctx.beginPath()
			ctx.moveTo(chain[0].pFrom.x, chain[0].pFrom.y)
			for (let i = 0; i < chain.length; i++) {
				const seg = chain[i]
				ctx.bezierCurveTo(seg.pCP1.x, seg.pCP1.y, seg.pCP2.x, seg.pCP2.y, seg.pTo.x, seg.pTo.y)
			}
			if (chain.isClosed) {
				ctx.closePath()
			}
			ctx.stroke()
		}
	}

	ctx.restore()
}

/**
 * Helper to parse hex and rgb/rgba color strings into RGBA components.
 */
function parseColor(str) {
	if (!str) return { r: 0, g: 0, b: 0, a: 1.0 }
	if (str.startsWith('#')) {
		let hex = str.slice(1)
		if (hex.length === 3) {
			hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
		}
		const num = parseInt(hex, 16) || 0
		return {
			r: (num >> 16) & 255,
			g: (num >> 8) & 255,
			b: num & 255,
			a: 1.0
		}
	}
	const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
	if (m) {
		return {
			r: parseInt(m[1], 10),
			g: parseInt(m[2], 10),
			b: parseInt(m[3], 10),
			a: m[4] !== undefined ? parseFloat(m[4]) : 1.0
		}
	}
	return { r: 0, g: 0, b: 0, a: 1.0 }
}

/**
 * Linearly interpolates between two colors (hex or rgba).
 */
export function lerpColor(c1, c2, t) {
	if (c1 === c2 || t <= 0) return c1
	if (t >= 1) return c2
	const col1 = parseColor(c1)
	const col2 = parseColor(c2)
	const r = Math.round(col1.r + (col2.r - col1.r) * t)
	const g = Math.round(col1.g + (col2.g - col1.g) * t)
	const b = Math.round(col1.b + (col2.b - col1.b) * t)
	const a = col1.a + (col2.a - col1.a) * t
	return a < 0.99 ? `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})` : `rgb(${r}, ${g}, ${b})`
}

/**
 * Strokes a quadratic Bezier curve with progressive width tapering and color interpolation.
 * If start and end width/color match, executes a single native quadraticCurveTo for peak performance.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} p0 - Start point
 * @param {{ x: number, y: number }} p1 - Quadratic control point (junction center)
 * @param {{ x: number, y: number }} p2 - End point
 * @param {number} w0 - Start stroke width
 * @param {number} w1 - End stroke width
 * @param {string} c0 - Start color
 * @param {string} c1 - End color
 * @param {number} steps - Number of subdivision segments for tapering
 */
export function strokeTaperedCurve(ctx, p0, p1, p2, w0, w1, c0, c1, steps = 4) {
	if (Math.abs(w0 - w1) < 0.05 && c0 === c1) {
		ctx.beginPath()
		ctx.moveTo(p0.x, p0.y)
		ctx.quadraticCurveTo(p1.x, p1.y, p2.x, p2.y)
		ctx.lineWidth = w0
		ctx.strokeStyle = c0
		ctx.stroke()
		return
	}

	function bezierPt(t) {
		const mt = 1 - t
		return {
			x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
			y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y
		}
	}

	let prevPt = p0
	for (let i = 0; i < steps; i++) {
		const tB = (i + 1) / steps
		const tMid = (i + 0.5) / steps
		const pB = bezierPt(tB)
		const w = w0 + tMid * (w1 - w0)
		const color = (c0 === c1) ? c0 : lerpColor(c0, c1, tMid)

		ctx.beginPath()
		ctx.moveTo(prevPt.x, prevPt.y)
		ctx.lineTo(pB.x, pB.y)
		ctx.lineWidth = w
		ctx.strokeStyle = color
		ctx.stroke()
		prevPt = pB
	}
}

/**
 * Calculates smooth rounded turn geometry between two branches at a junction node.
 * Eliminates angular kinks via a tangent-continuous quadratic Bezier fillet: A0 -> center -> A1.
 * Shared by both roads (at hex centers) and rivers (at hex vertices).
 *
 * @param {{ x: number, y: number }} center - Junction node (hex center or river vertex)
 * @param {Object} b0 - Branch 0 { ux, uy, dist }
 * @param {Object} b1 - Branch 1 { ux, uy, dist }
 * @param {number} maxRadius - Desired fillet radius
 * @returns {{ center: Object, A0: Object, A1: Object, Rturn: number }}
 */
export function buildTurnGeometry(center, b0, b1, maxRadius = 14) {
	const maxDist0 = (b0.dist || maxRadius * 2) * 0.65
	const maxDist1 = (b1.dist || maxRadius * 2) * 0.65
	const Rturn = Math.max(1, Math.min(maxRadius, maxDist0, maxDist1))

	const A0 = {
		x: center.x + b0.ux * Rturn,
		y: center.y + b0.uy * Rturn
	}
	const A1 = {
		x: center.x + b1.ux * Rturn,
		y: center.y + b1.uy * Rturn
	}

	return { center, A0, A1, Rturn }
}

/**
 * Common ribbon network junction geometry builder for both roads and rivers.
 * Unifies the treatment of turns, forks, and confluences:
 * - Smooth, rounded inner fillets and sweeping convex outer contours (eliminates angular kinks).
 * - Asymmetric width support (smooth tapering when connecting different road types or river tiers).
 * - Linear gradient blending for junctions connecting different material colors (e.g. dirt <-> stone).
 *
 * @param {Object} center - { x, y, scale }
 * @param {Array<Object>} branches - [{ angle, casingWidth, coreWidth, casingColor, coreColor, isStone }]
 * @param {number} scale - Perspective scale factor
 * @returns {Object|null}
 */
export function buildRibbonJunction(center, branches, scale = 1.0) {
	if (!branches || branches.length < 2) return null
	const sorted = [...branches].sort((a, b) => a.angle - b.angle)
	const k = sorted.length

	function buildLayer(isCasing) {
		const branchPoints = []
		const cornerCurves = []

		for (let i = 0; i < k; i++) {
			const b = sorted[i]
			const ux = Math.cos(b.angle)
			const uy = Math.sin(b.angle)
			const nx = -uy
			const ny = ux
			const w = (isCasing ? b.casingWidth : b.coreWidth) / 2
			const D = Math.max(w * 1.8, 5 * scale)

			const pL = { x: center.x + ux * D + nx * w, y: center.y + uy * D + ny * w }
			const pR = { x: center.x + ux * D - nx * w, y: center.y + uy * D - ny * w }
			branchPoints.push({ pL, pR, ux, uy, nx, ny, w, D })
		}

		for (let i = 0; i < k; i++) {
			const next = (i + 1) % k
			const b = branchPoints[i]
			const bNext = branchPoints[next]

			let deltaAngle = sorted[next].angle - sorted[i].angle
			if (deltaAngle < 0) deltaAngle += Math.PI * 2

			const midAngle = sorted[i].angle + deltaAngle / 2
			const umx = Math.cos(midAngle)
			const umy = Math.sin(midAngle)
			const wAvg = (b.w + bNext.w) / 2

			if (deltaAngle <= Math.PI) {
				// Inner concave rounded fillet ("слипание/перепонка")
				const dDip = Math.max(wAvg * 0.85, Math.min(b.D, bNext.D) * (0.24 + 0.38 * Math.cos(deltaAngle / 2)))
				const pFillet = { x: center.x + umx * dDip, y: center.y + umy * dDip }
				cornerCurves.push({ type: 'inner', pStart: b.pR, pFillet, pEnd: bNext.pL })
			} else {
				// Outer sweeping convex curve for bends (makes the outer elbow completely rounded!)
				const innerDelta = Math.PI * 2 - deltaAngle
				const cosHalf = Math.max(0.2, Math.cos((Math.PI - innerDelta) / 2))
				const dOuter = Math.min((wAvg / cosHalf) * 1.05, Math.max(b.D, bNext.D) * 1.05)
				const pApex = { x: center.x + umx * dOuter, y: center.y + umy * dOuter }
				const t1 = { x: b.pR.x - b.ux * (b.D * 0.45), y: b.pR.y - b.uy * (b.D * 0.45) }
				const t2 = { x: bNext.pL.x - bNext.ux * (bNext.D * 0.45), y: bNext.pL.y - bNext.uy * (bNext.D * 0.45) }
				cornerCurves.push({ type: 'outer', pStart: b.pR, t1, pApex, t2, pEnd: bNext.pL })
			}
		}

		return { branchPoints, cornerCurves }
	}

	return {
		casing: buildLayer(true),
		core: buildLayer(false),
		branches: sorted,
		center
	}
}

/**
 * Traces the closed polygon path of a ribbon junction layer.
 */
export function traceRibbonJunction(ctx, layerData) {
	ctx.beginPath()
	const k = layerData.branchPoints.length
	for (let i = 0; i < k; i++) {
		const bp = layerData.branchPoints[i]
		const corner = layerData.cornerCurves[i]

		if (i === 0) {
			ctx.moveTo(bp.pL.x, bp.pL.y)
		} else {
			ctx.lineTo(bp.pL.x, bp.pL.y)
		}
		ctx.lineTo(bp.pR.x, bp.pR.y)

		if (corner.type === 'inner') {
			ctx.quadraticCurveTo(corner.pFillet.x, corner.pFillet.y, corner.pEnd.x, corner.pEnd.y)
		} else {
			ctx.quadraticCurveTo(corner.t1.x, corner.t1.y, corner.pApex.x, corner.pApex.y)
			ctx.quadraticCurveTo(corner.t2.x, corner.t2.y, corner.pEnd.x, corner.pEnd.y)
		}
	}
	ctx.closePath()
}

/**
 * Fills a ribbon junction layer with solid color or smooth gradient for mixed types.
 */
export function fillRibbonJunction(ctx, junction, layer) {
	const layerData = layer === 'casing' ? junction.casing : junction.core
	traceRibbonJunction(ctx, layerData)

	const branches = junction.branches
	const colorProp = layer === 'casing' ? 'casingColor' : 'coreColor'
	const firstColor = branches[0][colorProp]
	const isMixed = branches.some(b => b[colorProp] !== firstColor)

	if (!isMixed) {
		ctx.fillStyle = firstColor
		ctx.fill()
	} else if (branches.length === 2) {
		// Mixed 2-branch junction (e.g. dirt road <-> stone road transition):
		// create a linear gradient between the two branch endpoints
		const b0 = layerData.branchPoints[0]
		const b1 = layerData.branchPoints[1]
		const grad = ctx.createLinearGradient(
			(b0.pL.x + b0.pR.x) / 2,
			(b0.pL.y + b0.pR.y) / 2,
			(b1.pL.x + b1.pR.x) / 2,
			(b1.pL.y + b1.pR.y) / 2
		)
		grad.addColorStop(0, branches[0][colorProp])
		grad.addColorStop(1, branches[1][colorProp])
		ctx.fillStyle = grad
		ctx.fill()
	} else {
		// 3+ branches with mixed types: stone paving takes priority for the central crossroad square
		const stoneBranch = branches.find(b => b.isStone)
		ctx.fillStyle = stoneBranch ? stoneBranch[colorProp] : firstColor
		ctx.fill()
	}
}

/**
 * Draws rivers flowing along edges with perspective scaling and animated currents.
 * Uses organic procedural cubic Bezier meanders with adaptive curvature per tier (Civilization style).
 * Multi-pass rendering pipeline with unified rounded junction fillets, width tapering, and confluence discs.
 * Guaranteed ZERO needle/spike artifacts on river banks!
 */
function drawRivers(ctx, camera, mapData, radius, animTime) {
	if (!mapData.rivers) return

	const rivers = Object.values(mapData.rivers)
	if (rivers.length === 0) return

	ctx.save()

	const preparedRivers = []
	const vertexBranches = new Map()

	function getVertexKey(pt) {
		return `${Math.round(pt.x * 10)},${Math.round(pt.y * 10)}`
	}

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
		const casingWidth = baseWidth + shoreExtra
		const flowDir = river.flowDir === -1 ? -1 : 1

		const rObj = {
			pFrom, pCP1, pCP2, pTo,
			startPt: pFrom,
			endPt: pTo,
			casingWidth, baseWidth, currentDashW,
			tier, avgScale, flowDir,
			gFrom, gTo
		}
		preparedRivers.push(rObj)

		// Direction into edge from pFrom towards pCP1
		const d1x = pCP1.x - pFrom.x
		const d1y = pCP1.y - pFrom.y
		const len1 = Math.hypot(d1x, d1y) || 1
		const u1x = d1x / len1
		const u1y = d1y / len1

		// Direction into edge from pTo towards pCP2
		const d2x = pCP2.x - pTo.x
		const d2y = pCP2.y - pTo.y
		const len2 = Math.hypot(d2x, d2y) || 1
		const u2x = d2x / len2
		const u2y = d2y / len2

		const keyFrom = getVertexKey(gFrom)
		let entryFrom = vertexBranches.get(keyFrom)
		if (!entryFrom) {
			entryFrom = { pCenter: pFrom, branches: [] }
			vertexBranches.set(keyFrom, entryFrom)
		}
		entryFrom.branches.push({
			river: rObj,
			isFrom: true,
			pt: pFrom,
			ux: u1x,
			uy: u1y,
			dist: len1,
			casingWidth,
			baseWidth,
			currentDashW,
			tier,
			flowDir
		})

		const keyTo = getVertexKey(gTo)
		let entryTo = vertexBranches.get(keyTo)
		if (!entryTo) {
			entryTo = { pCenter: pTo, branches: [] }
			vertexBranches.set(keyTo, entryTo)
		}
		entryTo.branches.push({
			river: rObj,
			isFrom: false,
			pt: pTo,
			ux: u2x,
			uy: u2y,
			dist: len2,
			casingWidth,
			baseWidth,
			currentDashW,
			tier,
			flowDir
		})
	}

	// Calculate rounded turn fillets (2 branches) and confluence discs (3+ branches)
	const riverTurns = []
	const riverConfluences = []

	for (const vData of vertexBranches.values()) {
		if (!vData.pCenter.visible) continue
		const k = vData.branches.length

		if (k === 2) {
			const b0 = vData.branches[0]
			const b1 = vData.branches[1]
			const turn = buildTurnGeometry(vData.pCenter, b0, b1, 7 * vData.pCenter.scale)

			if (b0.isFrom) b0.river.startPt = turn.A0
			else b0.river.endPt = turn.A0

			if (b1.isFrom) b1.river.startPt = turn.A1
			else b1.river.endPt = turn.A1

			riverTurns.push({
				center: vData.pCenter,
				A0: turn.A0,
				A1: turn.A1,
				b0,
				b1,
				scale: vData.pCenter.scale,
				currentDashW: (b0.currentDashW + b1.currentDashW) / 2
			})
		} else if (k >= 3) {
			let maxCasing = 0
			let maxBase = 0
			for (const b of vData.branches) {
				maxCasing = Math.max(maxCasing, b.casingWidth)
				maxBase = Math.max(maxBase, b.baseWidth)
				// Rivers must meet directly at the confluence vertex center!
				if (b.isFrom) b.river.startPt = vData.pCenter
				else b.river.endPt = vData.pCenter
			}

			// Sort branches by angle around confluence
			const sorted = [...vData.branches].sort((a, b) => {
				const angA = Math.atan2(a.uy, a.ux)
				const angB = Math.atan2(b.uy, b.ux)
				return angA - angB
			})

			const fillets = []
			for (let i = 0; i < sorted.length; i++) {
				const next = (i + 1) % sorted.length
				const bA = sorted[i]
				const bB = sorted[next]
				const D = Math.min(6 * vData.pCenter.scale, bA.dist * 0.35, bB.dist * 0.35)
				const PA = { x: vData.pCenter.x + bA.ux * D, y: vData.pCenter.y + bA.uy * D }
				const PB = { x: vData.pCenter.x + bB.ux * D, y: vData.pCenter.y + bB.uy * D }
				fillets.push({ PA, PB, bA, bB })
			}

			riverConfluences.push({
				center: vData.pCenter,
				fillets,
				maxCasingWidth: maxCasing,
				maxBaseWidth: maxBase,
				scale: vData.pCenter.scale
			})
		}
	}

	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'

	// --- PASS 1: Riverbed Shore Strokes, Rounded Junction Fillets, and Confluence Shore Pools ---
	for (const r of preparedRivers) {
		ctx.beginPath()
		ctx.moveTo(r.startPt.x, r.startPt.y)
		ctx.bezierCurveTo(r.pCP1.x, r.pCP1.y, r.pCP2.x, r.pCP2.y, r.endPt.x, r.endPt.y)
		ctx.lineWidth = r.casingWidth
		ctx.strokeStyle = '#0369a1'
		ctx.stroke()
	}

	for (const turn of riverTurns) {
		strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.casingWidth, turn.b1.casingWidth, '#0369a1', '#0369a1', 4)
	}

	for (const conf of riverConfluences) {
		for (const f of conf.fillets) {
			strokeTaperedCurve(ctx, f.PA, conf.center, f.PB, f.bA.casingWidth, f.bB.casingWidth, '#0369a1', '#0369a1', 3)
		}
	}

	// --- PASS 2: Main River Water Ribbon, Width-Tapered Turn Fillets, and Confluence Pools ---
	for (const r of preparedRivers) {
		ctx.beginPath()
		ctx.moveTo(r.startPt.x, r.startPt.y)
		ctx.bezierCurveTo(r.pCP1.x, r.pCP1.y, r.pCP2.x, r.pCP2.y, r.endPt.x, r.endPt.y)
		ctx.lineWidth = r.baseWidth
		ctx.strokeStyle = '#38bdf8'
		ctx.stroke()
	}

	for (const turn of riverTurns) {
		strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.baseWidth, turn.b1.baseWidth, '#38bdf8', '#38bdf8', 4)
	}

	for (const conf of riverConfluences) {
		for (const f of conf.fillets) {
			strokeTaperedCurve(ctx, f.PA, conf.center, f.PB, f.bA.baseWidth, f.bB.baseWidth, '#38bdf8', '#38bdf8', 3)
		}
	}

	// --- PASS 3: Animated Flow Currents ---
	for (const r of preparedRivers) {
		ctx.beginPath()
		ctx.moveTo(r.startPt.x, r.startPt.y)
		ctx.bezierCurveTo(r.pCP1.x, r.pCP1.y, r.pCP2.x, r.pCP2.y, r.endPt.x, r.endPt.y)
		ctx.lineWidth = r.currentDashW
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
		const dashLen = (r.tier === 1 ? 4 : (r.tier === 2 ? 5 : 6)) * r.avgScale
		ctx.setLineDash([dashLen, dashLen])
		ctx.lineDashOffset = -r.flowDir * (animTime * 22 * r.avgScale)
		ctx.stroke()
		ctx.setLineDash([])
	}

	for (const turn of riverTurns) {
		ctx.beginPath()
		ctx.moveTo(turn.A0.x, turn.A0.y)
		ctx.quadraticCurveTo(turn.center.x, turn.center.y, turn.A1.x, turn.A1.y)
		ctx.lineWidth = turn.currentDashW
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
		const dashLen = 5 * turn.scale
		ctx.setLineDash([dashLen, dashLen])
		ctx.lineDashOffset = -(animTime * 22 * turn.scale)
		ctx.stroke()
		ctx.setLineDash([])
	}

	ctx.restore()
}

/**
 * Pre-computes renderable road geometry (trunks, rounded turns, and crossroads)
 * tagged with their cellKey for depth-sorted 2.5D rendering.
 */
export function buildRoadRenderData(camera, mapData, radius) {
	if (!mapData.roads) return { trunks: [], turns: [], crossroads: [] }

	const roads = Object.values(mapData.roads)
	if (roads.length === 0) return { trunks: [], turns: [], crossroads: [] }

	const cellBranches = new Map()

	for (const road of roads) {
		const c1 = hexToWorldGroundCenter(road.from.col, road.from.row, radius)
		const c2 = hexToWorldGroundCenter(road.to.col, road.to.row, radius)
		const canonKey = getCanonicalRoadKey(road.from.col, road.from.row, road.to.col, road.to.row)

		const { mid, cp1, cp2 } = getRoadPathControls(c1, c2, canonKey, radius)

		const p1 = camera.project(c1.x, c1.y, 0)
		const pQ1 = camera.project(cp1.x, cp1.y, 0)
		const pMid = camera.project(mid.x, mid.y, 0)
		const pQ2 = camera.project(cp2.x, cp2.y, 0)
		const p2 = camera.project(c2.x, c2.y, 0)

		if (!p1.visible && !p2.visible && !pMid.visible) continue

		const avgScale = (p1.scale + p2.scale) / 2
		const isStone = road.type === 'stone'
		const casingWidth = (isStone ? 5 : 4) * avgScale
		const coreWidth = (isStone ? 3 : 2.5) * avgScale
		const casingColor = isStone ? '#475569' : '#451a03'
		const coreColor = isStone ? '#94a3b8' : '#b45309'

		// Direction into cell 1 road from p1 towards pQ1
		const d1x = pQ1.x - p1.x
		const d1y = pQ1.y - p1.y
		const len1 = Math.hypot(d1x, d1y) || 1
		const u1x = d1x / len1
		const u1y = d1y / len1

		// Direction into cell 2 road from p2 towards pQ2
		const d2x = pQ2.x - p2.x
		const d2y = pQ2.y - p2.y
		const len2 = Math.hypot(d2x, d2y) || 1
		const u2x = d2x / len2
		const u2y = d2y / len2

		const key1 = `${road.from.col},${road.from.row}`
		let entry1 = cellBranches.get(key1)
		if (!entry1) {
			entry1 = { cellKey: key1, pCenter: p1, branches: [] }
			cellBranches.set(key1, entry1)
		}
		entry1.branches.push({
			cellKey: key1,
			pMid,
			pQ: pQ1,
			ux: u1x,
			uy: u1y,
			dist: len1,
			isStone,
			casingWidth,
			coreWidth,
			casingColor,
			coreColor,
			scale: p1.scale
		})

		const key2 = `${road.to.col},${road.to.row}`
		let entry2 = cellBranches.get(key2)
		if (!entry2) {
			entry2 = { cellKey: key2, pCenter: p2, branches: [] }
			cellBranches.set(key2, entry2)
		}
		entry2.branches.push({
			cellKey: key2,
			pMid,
			pQ: pQ2,
			ux: u2x,
			uy: u2y,
			dist: len2,
			isStone,
			casingWidth,
			coreWidth,
			casingColor,
			coreColor,
			scale: p2.scale
		})
	}

	const roadTrunks = []
	const roadTurns = []
	const roadCrossroads = []

	for (const [cellKey, cData] of cellBranches.entries()) {
		if (!cData.pCenter.visible) continue
		const k = cData.branches.length

		if (k === 1) {
			const b0 = cData.branches[0]
			roadTrunks.push({
				cellKey,
				pMid: b0.pMid,
				pQ: b0.pQ,
				endPt: cData.pCenter,
				isStone: b0.isStone,
				casingWidth: b0.casingWidth,
				coreWidth: b0.coreWidth,
				casingColor: b0.casingColor,
				coreColor: b0.coreColor,
				scale: b0.scale
			})
		} else if (k === 2) {
			const b0 = cData.branches[0]
			const b1 = cData.branches[1]
			// Generous rounded corner radius at cell center (e.g. 14px * scale)
			const turn = buildTurnGeometry(cData.pCenter, b0, b1, 14 * cData.pCenter.scale)

			roadTrunks.push({
				cellKey,
				pMid: b0.pMid,
				pQ: b0.pQ,
				endPt: turn.A0,
				isStone: b0.isStone,
				casingWidth: b0.casingWidth,
				coreWidth: b0.coreWidth,
				casingColor: b0.casingColor,
				coreColor: b0.coreColor,
				scale: b0.scale
			})

			roadTrunks.push({
				cellKey,
				pMid: b1.pMid,
				pQ: b1.pQ,
				endPt: turn.A1,
				isStone: b1.isStone,
				casingWidth: b1.casingWidth,
				coreWidth: b1.coreWidth,
				casingColor: b1.casingColor,
				coreColor: b1.coreColor,
				scale: b1.scale
			})

			roadTurns.push({
				cellKey,
				center: cData.pCenter,
				A0: turn.A0,
				A1: turn.A1,
				b0,
				b1,
				scale: cData.pCenter.scale
			})
		} else if (k >= 3) {
			let maxCasing = 0
			let maxCore = 0
			const hasStone = cData.branches.some(b => b.isStone)

			for (const b of cData.branches) {
				maxCasing = Math.max(maxCasing, b.casingWidth)
				maxCore = Math.max(maxCore, b.coreWidth)
				// Trunks must go all the way into cell center!
				roadTrunks.push({
					cellKey,
					pMid: b.pMid,
					pQ: b.pQ,
					endPt: cData.pCenter,
					isStone: b.isStone,
					casingWidth: b.casingWidth,
					coreWidth: b.coreWidth,
					casingColor: b.casingColor,
					coreColor: b.coreColor,
					scale: b.scale
				})
			}

			// Sort branches by angle around center to build inner corner fillets
			const sorted = [...cData.branches].sort((a, b) => {
				const angA = Math.atan2(a.uy, a.ux)
				const angB = Math.atan2(b.uy, b.ux)
				return angA - angB
			})

			const fillets = []
			for (let i = 0; i < sorted.length; i++) {
				const next = (i + 1) % sorted.length
				const bA = sorted[i]
				const bB = sorted[next]
				const D = Math.min(10 * cData.pCenter.scale, bA.dist * 0.45, bB.dist * 0.45)
				const PA = { x: cData.pCenter.x + bA.ux * D, y: cData.pCenter.y + bA.uy * D }
				const PB = { x: cData.pCenter.x + bB.ux * D, y: cData.pCenter.y + bB.uy * D }
				fillets.push({ PA, PB, bA, bB })
			}

			roadCrossroads.push({
				cellKey,
				center: cData.pCenter,
				fillets,
				maxCasingWidth: maxCasing,
				maxCoreWidth: maxCore,
				hasStone,
				scale: cData.pCenter.scale
			})
		}
	}

	return {
		trunks: roadTrunks,
		turns: roadTurns,
		crossroads: roadCrossroads
	}
}

/**
 * Renders prepared road geometry with optional filter function (e.g. for cell-by-cell depth sorting).
 * Multi-pass pipeline:
 * - PASS 1: All Road Casings, Smooth Rounded Turns, and Crossroad Hubs
 * - PASS 2: All Road Cores (Surfaces), Smooth Rounded Turns, and Crossroad Hubs
 * - PASS 3: Dirt Ruts
 */
export function renderRoads(ctx, roadData, filterFn = null) {
	if (!roadData) return
	const trunks = filterFn ? roadData.trunks.filter(t => filterFn(t.cellKey)) : roadData.trunks
	const turns = filterFn ? roadData.turns.filter(t => filterFn(t.cellKey)) : roadData.turns
	const crossroads = filterFn ? roadData.crossroads.filter(c => filterFn(c.cellKey)) : roadData.crossroads

	if (trunks.length === 0 && turns.length === 0 && crossroads.length === 0) return

	ctx.save()
	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'

	// --- PASS 1: All Road Casings, Smooth Rounded Turns, and Crossroad Hubs ---
	for (const t of trunks) {
		ctx.beginPath()
		ctx.moveTo(t.pMid.x, t.pMid.y)
		ctx.quadraticCurveTo(t.pQ.x, t.pQ.y, t.endPt.x, t.endPt.y)
		ctx.lineWidth = t.casingWidth
		ctx.strokeStyle = t.casingColor
		ctx.stroke()
	}

	for (const turn of turns) {
		strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.casingWidth, turn.b1.casingWidth, turn.b0.casingColor, turn.b1.casingColor, 4)
	}

	for (const cr of crossroads) {
		const casingColor = cr.hasStone ? '#475569' : '#451a03'
		for (const f of cr.fillets) {
			strokeTaperedCurve(ctx, f.PA, cr.center, f.PB, f.bA.casingWidth, f.bB.casingWidth, casingColor, casingColor, 3)
		}
	}

	// --- PASS 2: All Road Cores (Surfaces), Smooth Rounded Turns, and Crossroad Hubs ---
	for (const t of trunks) {
		ctx.beginPath()
		ctx.moveTo(t.pMid.x, t.pMid.y)
		ctx.quadraticCurveTo(t.pQ.x, t.pQ.y, t.endPt.x, t.endPt.y)
		ctx.lineWidth = t.coreWidth
		ctx.strokeStyle = t.coreColor
		ctx.stroke()
	}

	for (const turn of turns) {
		strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.coreWidth, turn.b1.coreWidth, turn.b0.coreColor, turn.b1.coreColor, 4)
	}

	for (const cr of crossroads) {
		const coreColor = cr.hasStone ? '#94a3b8' : '#b45309'
		for (const f of cr.fillets) {
			strokeTaperedCurve(ctx, f.PA, cr.center, f.PB, f.bA.coreWidth, f.bB.coreWidth, coreColor, coreColor, 3)
		}
	}

	// --- PASS 3: Dirt Ruts ---
	for (const t of trunks) {
		if (!t.isStone) {
			ctx.beginPath()
			ctx.moveTo(t.pMid.x, t.pMid.y)
			ctx.quadraticCurveTo(t.pQ.x, t.pQ.y, t.endPt.x, t.endPt.y)
			ctx.lineWidth = 1 * t.scale
			ctx.strokeStyle = 'rgba(254, 243, 199, 0.4)'
			ctx.setLineDash([3 * t.scale, 4 * t.scale])
			ctx.stroke()
			ctx.setLineDash([])
		}
	}

	for (const turn of turns) {
		if (!turn.b0.isStone && !turn.b1.isStone) {
			ctx.beginPath()
			ctx.moveTo(turn.A0.x, turn.A0.y)
			ctx.quadraticCurveTo(turn.center.x, turn.center.y, turn.A1.x, turn.A1.y)
			ctx.lineWidth = 1 * turn.scale
			ctx.strokeStyle = 'rgba(254, 243, 199, 0.4)'
			ctx.setLineDash([3 * turn.scale, 4 * turn.scale])
			ctx.stroke()
			ctx.setLineDash([])
		}
	}

	ctx.restore()
}

/**
 * Draws roads connecting adjacent hex centers on the perspective terrain surface.
 * Roads strictly hug the terrain relief: at the shared hex boundary, elevation is 0 (ground level),
 * ascending the slopes to hill plateau summits (Z ~ 16) without hovering in mid-air.
 * Multi-pass rendering pipeline with unified rounded turns at cell centers, width tapering, and color gradients.
 */
export function drawRoads(ctx, camera, mapData, radius, filterFn = null) {
	const roadData = buildRoadRenderData(camera, mapData, radius)
	renderRoads(ctx, roadData, filterFn)
}

/**
 * Draws bridges where roads cross rivers on shared edges.
 * Supports optional filterFn and drawnBridges tracking set.
 */
function drawBridges(ctx, camera, mapData, radius, filterFn = null, drawnBridges = null) {
	if (!mapData.roads || !mapData.rivers) return

	const roads = Object.values(mapData.roads)
	if (roads.length === 0) return

	const drawn = drawnBridges || new Set()

	for (const road of roads) {
		const c1 = road.from
		const c2 = road.to

		for (const edge of HEX_EDGES) {
			const neighbor = getHexNeighbor(c1.col, c1.row, edge)
			if (neighbor.col === c2.col && neighbor.row === c2.row) {
				const canonRoadKey = getCanonicalRoadKey(c1.col, c1.row, c2.col, c2.row)
				if (drawn.has(canonRoadKey)) break

				const key1 = `${c1.col},${c1.row}`
				const key2 = `${c2.col},${c2.row}`
				if (filterFn && !filterFn(key1, key2)) break

				drawn.add(canonRoadKey)

				const bridgeInfo = checkBridgeBetweenHexes(mapData, c1.col, c1.row, c2.col, c2.row, edge)
				if (bridgeInfo.hasBridge) {
					const c1Ground = hexToWorldGroundCenter(c1.col, c1.row, radius)
					const c2Ground = hexToWorldGroundCenter(c2.col, c2.row, radius)
					const canonRoadKey = getCanonicalRoadKey(c1.col, c1.row, c2.col, c2.row)
					const { mid, cp1, cp2 } = getRoadPathControls(c1Ground, c2Ground, canonRoadKey, radius)

					// Bridge sits on the boundary crossing on the ground at Z = 0
					const pMid = camera.project(mid.x, mid.y, 0)
					const pQ1 = camera.project(cp1.x, cp1.y, 0)
					const pQ2 = camera.project(cp2.x, cp2.y, 0)

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
 * Draws hills as 2.5D relief sprites (organic cluster of rolling mounds).
 * Features:
 * - Biome-adaptive: colors adapt naturally to grass, desert, snow, volcanic, etc.
 * - Confined strictly within hex bounds (~0.55-0.68 R) so edge rivers are never clipped.
 * - Rendered in Step 3, allowing roads (Step 4) and settlements (Step 6) to render cleanly on top.
 * - Directional lighting (sun from NW, shadow on SE, warm crest rim highlight).
 * - Soft ground footprint shadow.
 */
function drawHills(ctx, camera, cell, radius) {
	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	const p = camera.project(center.x, center.y, 0)
	if (!p.visible) return

	const sc = p.scale
	const cx = p.x
	const drawY = p.y
	const biome = BIOMES[cell.terrain] || BIOMES.grass
	const h = hashString(`${cell.col},${cell.row}:hills`)

	// Lateral perspective parallax
	const dx = center.x - camera.cameraX
	const parallaxX = (dx / camera.focalDistance) * (10 * sc)

	ctx.save()

	// 1. Soft cluster footprint shadow on ground
	const shadowW = radius * 0.58 * sc
	const shadowH = radius * 0.22 * sc * Math.max(0.3, camera.cosT)
	ctx.beginPath()
	ctx.ellipse(cx + 2 * sc, drawY + 2 * sc * camera.cosT, shadowW, shadowH, 0, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(15, 23, 42, 0.26)'
	ctx.fill()

	// Helper to draw a single rounded mound with sunlit/shaded gradient and crest highlight
	function drawMound(moundX, baseY, w, hMound, sunBoost = 18, shadowDrop = -20) {
		const crestY = baseY - hMound
		const curveTopY = baseY - hMound * 1.04

		// Mound body path
		ctx.beginPath()
		ctx.moveTo(moundX - w, baseY)
		ctx.bezierCurveTo(
			moundX - w * 0.65, curveTopY,
			moundX - w * 0.18, curveTopY,
			moundX, crestY
		)
		ctx.bezierCurveTo(
			moundX + w * 0.18, curveTopY,
			moundX + w * 0.65, curveTopY,
			moundX + w, baseY
		)
		// Flat/slight arc base
		ctx.bezierCurveTo(
			moundX + w * 0.5, baseY + 1.5 * sc * camera.cosT,
			moundX - w * 0.5, baseY + 1.5 * sc * camera.cosT,
			moundX - w, baseY
		)
		ctx.closePath()

		// Directional sunlight gradient (sun from NW at 315°)
		const grad = ctx.createLinearGradient(
			moundX - w * 0.7, crestY - 2 * sc,
			moundX + w * 0.7, baseY
		)
		grad.addColorStop(0, shadeHexColor(biome.color, sunBoost))
		grad.addColorStop(0.42, biome.color)
		grad.addColorStop(1, shadeHexColor(biome.color, shadowDrop))

		ctx.fillStyle = grad
		ctx.fill()

		// Silhouette outline
		ctx.lineWidth = Math.max(0.7, 1.1 * sc)
		ctx.strokeStyle = shadeHexColor(biome.color, -38)
		ctx.stroke()

		// Sunlit crest rim highlight along upper ridge
		ctx.beginPath()
		ctx.moveTo(moundX - w * 0.8, baseY - hMound * 0.28)
		ctx.bezierCurveTo(
			moundX - w * 0.6, curveTopY,
			moundX - w * 0.18, curveTopY,
			moundX, crestY
		)
		ctx.bezierCurveTo(
			moundX + w * 0.18, curveTopY,
			moundX + w * 0.52, baseY - hMound * 0.85,
			moundX + w * 0.7, baseY - hMound * 0.42
		)
		ctx.lineWidth = Math.max(0.5, 0.9 * sc)
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.40)'
		ctx.stroke()

		// Subtle organic contour line on the slope for cartographic texture
		ctx.beginPath()
		ctx.moveTo(moundX - w * 0.5, baseY - hMound * 0.22)
		ctx.quadraticCurveTo(moundX, baseY - hMound * 0.52, moundX + w * 0.5, baseY - hMound * 0.22)
		ctx.lineWidth = Math.max(0.4, 0.6 * sc)
		ctx.strokeStyle = shadeHexColor(biome.color, 12)
		ctx.stroke()
	}

	// Mound 1 (Back-Left): drawn first
	const wL = radius * 0.34 * sc
	const hL = (10 + (getHashFloat(h, 1) + 1) * 1.2) * sc
	const cxL = cx - radius * 0.20 * sc + parallaxX * 0.75 + getHashFloat(h, 2) * (2 * sc)
	const baseYL = drawY - radius * 0.08 * sc * camera.cosT
	drawMound(cxL, baseYL, wL, hL, 16, -18)

	// Mound 2 (Back-Right): drawn second
	const wR = radius * 0.32 * sc
	const hR = (9 + (getHashFloat(h, 3) + 1) * 1.0) * sc
	const cxR = cx + radius * 0.22 * sc + parallaxX * 0.70 + getHashFloat(h, 4) * (2 * sc)
	const baseYR = drawY - radius * 0.06 * sc * camera.cosT
	drawMound(cxR, baseYR, wR, hR, 14, -22)

	// Mound 3 (Main Front-Center): drawn last on top of back mounds
	const wC = radius * 0.42 * sc
	const hC = (13 + (getHashFloat(h, 5) + 1) * 1.5) * sc
	const cxC = cx + parallaxX + getHashFloat(h, 6) * (2.5 * sc)
	const baseYC = drawY + 2 * sc * camera.cosT + getHashFloat(h, 7) * (1.5 * sc)
	drawMound(cxC, baseYC, wC, hC, 20, -22)

	ctx.restore()
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
	const zOffset = cell.feature === 'hills' ? 10 * (radius / 36) : 0
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
function drawHexHighlight(ctx, camera, col, row, radius, color, fillOpacity = 0.2, lineWidth = 2, cell = null) {
	const center = hexToWorldGroundCenter(col, row, radius)
	const groundVerts = getHexGroundVertices(center.x, center.y, radius)
	const screenVerts = groundVerts.map(v => camera.projectTerrain(v.x, v.y, 0))

	if (!screenVerts.some(v => v.visible)) return

	ctx.save()

	const rgbaFill = color
		.replace(')', `, ${fillOpacity})`)
		.replace('rgb', 'rgba')
		.replace('#38bdf8', `rgba(56, 189, 248, ${fillOpacity})`)
		.replace('#f6c445', `rgba(246, 196, 69, ${fillOpacity})`)

	ctx.beginPath()
	ctx.moveTo(screenVerts[0].x, screenVerts[0].y)
	for (let i = 1; i < screenVerts.length; i++) {
		ctx.lineTo(screenVerts[i].x, screenVerts[i].y)
	}
	ctx.closePath()

	ctx.fillStyle = rgbaFill
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
