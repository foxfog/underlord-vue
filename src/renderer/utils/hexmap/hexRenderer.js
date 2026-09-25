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
	getOrganicGroundVertex,
	getOrganicHexGroundVertices,
	getHexEdgeEndpoints,
	getHexNeighbor,
	getCanonicalEdgeKey,
	HEX_EDGES,
	HexPerspectiveCamera,
	getVisibleHexGridBounds,
	getHexEdgeCurve,
	getOrganicCellPolygon,
	getOrganicCellPerimeter,
	getRiverMeanderControls,
	getBorderMeanderControls,
	getRoadPathControls,
	getRoadCurvePoint,
	hashString,
	getHashFloat
} from './hexCoords.js'

// ── Biome Texture Cache ────────────────────────────────────────────────────────
// Maps biome IDs to their texture image paths (256×256 tileable textures).
// Only land biomes have textures; water biomes use animated shimmer instead.
// Texture rendering toggle: disabled for maximum performance.
export let ENABLE_BIOME_TEXTURES = true

export function setEnableBiomeTextures(enabled) {
	ENABLE_BIOME_TEXTURES = !!enabled
}

// Toggle for organic multi-bend curves vs strict hexagonal grid geometry.
export let ENABLE_ORGANIC_EDGES = true

export function setEnableOrganicEdges(enabled) {
	ENABLE_ORGANIC_EDGES = !!enabled
}

const BIOME_TEXTURE_PATH = {
	grass: '/images/sprites/hexagon/meadow.jpg',
	plains: '/images/sprites/hexagon/plain.jpg',
	desert: '/images/sprites/hexagon/desert.jpg',
	snow: '/images/sprites/hexagon/snow.jpg',
	tundra: '/images/sprites/hexagon/tundra.jpg'
}

// Singleton image cache: biomeId -> HTMLImageElement (loaded) | 'loading' | undefined
const _biomeTextureCache = new Map()

/**
 * Returns a loaded HTMLImageElement for a biome texture, or null if not yet ready.
 * Triggers background loading on first call for each biome.
 *
 * @param {string} biomeId
 * @returns {HTMLImageElement|null}
 */
function getBiomeTexture(biomeId) {
	if (!ENABLE_BIOME_TEXTURES) return null
	const path = BIOME_TEXTURE_PATH[biomeId]
	if (!path) return null
	// Gracefully degrade in Node.js test environments where Image/HTMLImageElement don't exist
	if (typeof Image === 'undefined') return null

	const cached = _biomeTextureCache.get(biomeId)
	if (typeof HTMLImageElement !== 'undefined' && cached instanceof HTMLImageElement) return cached
	if (cached === 'loading') return null

	// Kick off load
	_biomeTextureCache.set(biomeId, 'loading')
	const img = new Image()
	img.onload = () => _biomeTextureCache.set(biomeId, img)
	img.onerror = () => _biomeTextureCache.delete(biomeId)
	img.src = path
	return null
}

// Singleton pattern cache: biomeId -> { img, pattern }
const _biomePatternCache = new Map()

/**
 * Returns a CanvasPattern for a loaded biome texture image.
 */
function getOrCreateBiomePattern(ctx, biomeId, img) {
	if (!ctx || typeof ctx.createPattern !== 'function' || !img) return null
	const cached = _biomePatternCache.get(biomeId)
	if (cached && cached.img === img) return cached.pattern

	try {
		const pattern = ctx.createPattern(img, 'repeat')
		if (pattern) {
			_biomePatternCache.set(biomeId, { img, pattern })
		}
		return pattern
	} catch (e) {
		return null
	}
}

/**
 * Synchronizes the 2D repeating CanvasPattern transform with camera world translation,
 * scale, and 3D perspective ground-plane foreshortening (cosT).
 *
 * @param {CanvasPattern} pattern
 * @param {HexPerspectiveCamera} camera
 * @param {number} worldSize - Size of 1 texture tile in world units
 */
function applyPatternWorldTransform(pattern, camera, worldSize = 160) {
	if (!pattern || typeof pattern.setTransform !== 'function') return
	const DomMat = typeof DOMMatrix !== 'undefined' ? DOMMatrix : (typeof window !== 'undefined' ? window.DOMMatrix : null)
	if (!DomMat) return

	try {
		// 1 texture repeat (256 texels) corresponds to worldSize ground units
		const sx = (worldSize / 256) * camera.zoom
		const sy = (worldSize / 256) * camera.zoom * camera.cosT

		const periodX = 256 * sx
		const periodY = 256 * sy

		// Shift texture in sync with camera world translation
		let tx = camera.cx0 - camera.cameraX * camera.zoom
		let ty = camera.cy0 - camera.cameraY * camera.zoom * camera.cosT

		if (periodX > 0) {
			tx = ((tx % periodX) + periodX) % periodX
		}
		if (periodY > 0) {
			ty = ((ty % periodY) + periodY) % periodY
		}

		const mat = new DomMat()
		mat.translateSelf(tx, ty)
		mat.scaleSelf(sx, sy)
		pattern.setTransform(mat)
	} catch (e) {
		// Ignore any matrix transformation error
	}
}

/**
 * Frustum culling check: returns true if the hex cell's projected bounding circle
 * intersects the camera viewport (including horizon culling).
 */
export function isCellVisible(camera, col, row, radius, marginMultiplier = 2.5) {
	if (!camera) return true
	const h = 1.7320508075688772 * radius
	const wx = col * 1.5 * radius
	const wy = row * h + (Math.abs(col % 2) === 1 ? h * 0.5 : 0)

	const dx = wx - camera.cameraX
	const dy = wy - camera.cameraY

	const distZ = camera.focalDistance - dy * camera.sinT
	if (distZ <= 100) return false

	const scale = (camera.focalDistance / distZ) * camera.zoom
	const x = camera.cx0 + dx * scale
	const y = camera.cy0 + (dy * camera.cosT) * scale

	const maxScreenR = radius * scale * marginMultiplier
	const horizonY = camera.getHorizonY ? camera.getHorizonY() : -999999
	if (y + maxScreenR < horizonY) return false
	if (x + maxScreenR < 0 || x - maxScreenR > camera.viewportWidth) return false
	if (y + maxScreenR < 0 || y - maxScreenR > camera.viewportHeight) return false
	return true
}

// ──────────────────────────────────────────────────────────────────────────────

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
	if (ctx.imageSmoothingEnabled !== undefined) {
		ctx.imageSmoothingEnabled = false
	}

	// 0. Build canonical river lookup map once per frame
	const riverMap = new Map()
	if (mapData.rivers) {
		for (const r of Object.values(mapData.rivers)) {
			const cKey = getCanonicalEdgeKey(r.col, r.row, r.edge)
			riverMap.set(cKey, r)
		}
	}

	// 0.05. Check organic edges setting & calculate dynamic LOD level
	const mapOrganic = options.organic !== undefined ? options.organic : (mapData?.organic !== undefined ? mapData.organic : ENABLE_ORGANIC_EDGES)

	// Level-Of-Detail (LOD) & Far-Plane Culling Architecture:
	// screenRadius is the projected radius of a hex cell on screen in pixels
	const screenRadius = radius * camera.zoom
	let lodLevel = 0
	if (screenRadius < 12) {
		lodLevel = 2 // Strategic Overview (Civilization/Total War style: solid biomes, no cell borders, bold frontiers/rivers)
	} else if (screenRadius < 20) {
		lodLevel = 1 // Medium Distance (straight hexes, batched patterns, fading borders)
	} else {
		lodLevel = 0 // Close-up (Full fidelity: organic Bezier curves, per-cell random UV textures, water shimmer)
	}

	// At LOD 1 and 2, force straight hex geometry for a 10x-50x speedup
	const useOrganic = lodLevel === 0 && mapOrganic

	// 0.1. Atmospheric horizon sky & mist at the top of the canvas
	drawAtmosphere(ctx, camera)

	// 0.2. Fast Frustum Grid Bounding Box Culling (cuts 10,000 cells down to ~300 visible cells)
	const mapBounds = mapData.bounds || {
		minCol: 0,
		maxCol: (mapData.cols || 20) - 1,
		minRow: 0,
		maxRow: (mapData.rows || 15) - 1
	}
	const vBounds = getVisibleHexGridBounds(camera, radius, mapBounds)

	// Collect visible cells directly from mapData.cells in O(N_visible) time
	const visibleCells = []
	const visibleReliefCells = []
	const cellsMap = mapData.cells || {}

	for (let c = vBounds.minCol; c <= vBounds.maxCol; c++) {
		for (let r = vBounds.minRow; r <= vBounds.maxRow; r++) {
			const cell = cellsMap[`${c},${r}`]
			if (cell && isCellVisible(camera, c, r, radius)) {
				visibleCells.push(cell)
				if (cell.feature === 'mountain' || cell.settlement || (lodLevel < 2 && cell.feature === 'hills')) {
					visibleReliefCells.push(cell)
				}
			}
		}
	}

	// 1. Draw all hex base cells as batched continuous biome layers (flat ground plane)
	drawBaseCellsBatched(ctx, camera, mapData, radius, animTime, mapData.seed || 0, riverMap, {
		organic: useOrganic,
		lodLevel,
		screenRadius,
		visibleCells
	})

	// 1.5. Political territory fill (Civilization style, ground tint)
	if (showBorders) {
		drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap, riverMap, 1, {
			organic: useOrganic,
			lodLevel,
			screenRadius,
			visibleCells,
			vBounds
		})
	}

	// 2. Draw rivers along edges (with animated flowing water on ground plane Z = 0)
	drawRivers(ctx, camera, mapData, radius, animTime, {
		organic: useOrganic,
		lodLevel,
		screenRadius
	})

	// Sort ONLY the visible relief cells (hills, mountains, settlements) by Y back-to-front
	// (0-20 items instead of 10,000 cells!)
	if (visibleReliefCells.length > 1) {
		visibleReliefCells.sort((a, b) => {
			const yA = a.row + (a.col % 2 !== 0 ? 0.5 : 0)
			const yB = b.row + (b.col % 2 !== 0 ? 0.5 : 0)
			return yA - yB || a.col - b.col
		})
	}

	// 3. Draw 2.5D Hill relief sprites (biome-adaptive rolling mounds, inside hexes; skipped at LOD 2)
	if (lodLevel < 2) {
		for (const cell of visibleReliefCells) {
			if (cell.feature === 'hills') {
				drawHills(ctx, camera, cell, radius)
			}
		}
	}

	// 4. Draw roads across all cells (on top of ground and hill sprites, seamless multi-pass)
	const roadData = buildRoadRenderData(camera, mapData, radius, { lodLevel })
	renderRoads(ctx, roadData)

	// 5. Draw bridges where roads cross rivers
	drawBridges(ctx, camera, mapData, radius)

	// 5.5. Political border ribbons (drawn on top of rivers, roads, and bridges)
	if (showBorders) {
		drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap, riverMap, 2, {
			organic: useOrganic,
			lodLevel,
			screenRadius,
			visibleCells,
			vBounds
		})
	}

	// 6. Draw 2.5D Pop-Up Objects (Mountains and Settlements)
	// Rendered back-to-front (depth sorted by true ground Y)
	for (const cell of visibleReliefCells) {
		if (cell.feature === 'mountain') {
			const mRad = cell.mountainRadius || 1
			if (isCellVisible(camera, cell.col, cell.row, radius, mRad * 2.8)) {
				drawMountain(ctx, camera, cell, radius)
			}
		}

		if (cell.settlement) {
			const isDiscovered = !discoveredLocations || discoveredLocations.has(cell.settlement.id)
			drawSettlement(ctx, camera, cell, radius, isDiscovered, drawCanvasBadges)
		}
	}

	// 7. Draw hovered/selected hex highlights
	if (hoveredHex) {
		const hCell = mapData.cells?.[`${hoveredHex.col},${hoveredHex.row}`]
		drawHexHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, radius, '#38bdf8', 0.25, 2, hCell, mapData.seed || 0, riverMap, useOrganic)
	}
	if (selectedHex) {
		const sCell = mapData.cells?.[`${selectedHex.col},${selectedHex.row}`]
		drawHexHighlight(ctx, camera, selectedHex.col, selectedHex.row, radius, '#f6c445', 0.35, 3, sCell, mapData.seed || 0, riverMap, useOrganic)
	}

	// 7. Draw hovered edge highlight for River tool
	if (activeTool === 'river' && hoveredHex && hoveredEdge) {
		drawEdgeHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, hoveredEdge.edge, radius, activeRiverWidth, mapData.seed || 0, useOrganic)
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
 * Draws all visible base hex cells grouped by biome in batched compound passes:
 *   1. Solid biome base color fill across the compound path of all cells in the biome
 *   2. Infinite repeating pattern texture layer (single clip + transformed CanvasPattern per biome)
 *   3. Organic hex edge strokes (single compound stroke per biome)
 *   4. Water shimmer animation for water/ocean biomes
 *
 * This reduces GPU clipping stencil switches and draw calls by ~99% (from 500-1000 down to 3-5),
 * while creating a continuous, seamless landscape across adjacent hexes of the same biome.
 */
function drawBaseCellsBatched(ctx, camera, mapData, radius, animTime, seed = 0, riverMap = null, options = {}) {
	const useOrganic = options.organic !== undefined ? options.organic : (mapData?.organic !== undefined ? mapData.organic : ENABLE_ORGANIC_EDGES)
	const screenRadius = options.screenRadius ?? (radius * camera.zoom)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : (screenRadius < 12 ? 2 : (screenRadius < 20 ? 1 : 0))

	let visibleCells = options.visibleCells
	if (!visibleCells) {
		const cellEntries = Object.values(mapData.cells || {})
		if (cellEntries.length === 0) return
		visibleCells = []
		for (const cell of cellEntries) {
			if (isCellVisible(camera, cell.col, cell.row, radius)) {
				visibleCells.push(cell)
			}
		}
	}
	if (visibleCells.length === 0) return

	// 2. Group visible cells by terrain
	const biomeGroups = new Map()
	for (const cell of visibleCells) {
		const terrain = cell.terrain || 'grass'
		let group = biomeGroups.get(terrain)
		if (!group) {
			group = []
			biomeGroups.set(terrain, group)
		}
		group.push(cell)
	}

	// 3. Render each biome group in batches
	for (const [terrain, cells] of biomeGroups.entries()) {
		const biome = BIOMES[terrain] || BIOMES.grass

		const projectedList = []
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

		for (const cell of cells) {
			const center = hexToWorldGroundCenter(cell.col, cell.row, radius)

			if (!useOrganic) {
				const groundVerts = getHexGroundVertices(center.x, center.y, radius)
				let cellHasVisible = false
				const pVerts = []
				for (let i = 0; i < 6; i++) {
					const pv = camera.project(groundVerts[i].x, groundVerts[i].y, 0)
					pVerts.push(pv)
					if (pv.visible) cellHasVisible = true
					if (pv.x < minX) minX = pv.x
					if (pv.x > maxX) maxX = pv.x
					if (pv.y < minY) minY = pv.y
					if (pv.y > maxY) maxY = pv.y
				}
				if (cellHasVisible) {
					projectedList.push({ cell, pVerts, center })
				}
			} else {
				const perimeter = getOrganicCellPerimeter(cell.col, cell.row, radius, seed, riverMap)
				const pStart = camera.project(perimeter[0].from.x, perimeter[0].from.y, 0)
				let cellHasVisible = pStart.visible

				const edges = perimeter.map(e => {
					const m1 = e.mid1 || e.mid
					const m2 = e.mid2 || e.to
					const cp1C = e.cp1C || e.cp2B
					const cp2C = e.cp2C || e.to

					const pCP1A = camera.project(e.cp1A.x, e.cp1A.y, 0)
					const pCP2A = camera.project(e.cp2A.x, e.cp2A.y, 0)
					const pMid1 = camera.project(m1.x, m1.y, 0)
					const pCP1B = camera.project(e.cp1B.x, e.cp1B.y, 0)
					const pCP2B = camera.project(e.cp2B.x, e.cp2B.y, 0)
					const pMid2 = camera.project(m2.x, m2.y, 0)
					const pCP1C = camera.project(cp1C.x, cp1C.y, 0)
					const pCP2C = camera.project(cp2C.x, cp2C.y, 0)
					const pTo = camera.project(e.to.x, e.to.y, 0)

					if (pTo.visible || pMid1.visible || pMid2.visible) cellHasVisible = true

					if (pStart.x < minX) minX = pStart.x; if (pStart.x > maxX) maxX = pStart.x
					if (pStart.y < minY) minY = pStart.y; if (pStart.y > maxY) maxY = pStart.y
					if (pTo.x < minX) minX = pTo.x; if (pTo.x > maxX) maxX = pTo.x
					if (pTo.y < minY) minY = pTo.y; if (pTo.y > maxY) maxY = pTo.y

					return { pCP1A, pCP2A, pMid1, pCP1B, pCP2B, pMid2, pCP1C, pCP2C, pTo }
				})

				if (cellHasVisible) {
					projectedList.push({ cell, pStart, edges, center })
				}
			}
		}

		if (projectedList.length === 0) continue

		function traceGroupPath() {
			ctx.beginPath()
			if (!useOrganic) {
				for (const pc of projectedList) {
					ctx.moveTo(pc.pVerts[0].x, pc.pVerts[0].y)
					for (let i = 1; i < 6; i++) {
						ctx.lineTo(pc.pVerts[i].x, pc.pVerts[i].y)
					}
					ctx.closePath()
				}
			} else {
				for (const pc of projectedList) {
					ctx.moveTo(pc.pStart.x, pc.pStart.y)
					for (const pe of pc.edges) {
						ctx.bezierCurveTo(pe.pCP1A.x, pe.pCP1A.y, pe.pCP2A.x, pe.pCP2A.y, pe.pMid1.x, pe.pMid1.y)
						ctx.bezierCurveTo(pe.pCP1B.x, pe.pCP1B.y, pe.pCP2B.x, pe.pCP2B.y, pe.pMid2.x, pe.pMid2.y)
						ctx.bezierCurveTo(pe.pCP1C.x, pe.pCP1C.y, pe.pCP2C.x, pe.pCP2C.y, pe.pTo.x, pe.pTo.y)
					}
					ctx.closePath()
				}
			}
		}

		// 3.1. Base solid color fill (1 call for all cells of this biome)
		traceGroupPath()
		ctx.fillStyle = biome.color
		ctx.fill()

		// 3.2. Biome Texture Layer:
		// - LOD 0: Distinct random UV sampling per cell (close-up handcrafted feel)
		// - LOD 1: Batched repeating CanvasPattern (1 clip + 1 fill for entire biome layer!)
		// - LOD 2: Solid biome fill only (0 texture overhead, clean strategic atlas style)
		if (ENABLE_BIOME_TEXTURES && !biome.isWater) {
			const tex = getBiomeTexture(terrain)
			if (tex) {
				if (lodLevel === 0) {
					for (const pc of projectedList) {
						drawSingleCellRandomTexture(ctx, pc, tex, seed)
					}
				} else if (lodLevel === 1) {
					const pattern = getOrCreateBiomePattern(ctx, terrain, tex)
					if (pattern) {
						ctx.save()
						traceGroupPath()
						ctx.clip()
						applyPatternWorldTransform(pattern, camera, 160)
						ctx.fillStyle = pattern
						ctx.fillRect(minX, minY, maxX - minX, maxY - minY)
						ctx.restore()
					}
				}
			}
		}

		// 3.3. Hex edge stroke:
		// - LOD 0: Full border stroke
		// - LOD 1: Smoothly fade border alpha from 0.4 down to 0 as screenRadius approaches 12
		// - LOD 2: Completely suppress cell border strokes (eliminates dark moiré grid)
		if (lodLevel === 0) {
			traceGroupPath()
			ctx.lineWidth = Math.max(0.6, 1 * camera.zoom)
			ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', 0.4)
			ctx.stroke()
		} else if (lodLevel === 1) {
			const fadeAlpha = 0.4 * Math.max(0, Math.min(1, (screenRadius - 12) / 8))
			if (fadeAlpha > 0.02) {
				traceGroupPath()
				ctx.lineWidth = Math.max(0.5, 0.8 * camera.zoom)
				ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', fadeAlpha)
				ctx.stroke()
			}
		}

		// 3.4. Water shimmer animation for water/ocean (LOD 0 only)
		if (biome.isWater && lodLevel === 0) {
			for (const pc of projectedList) {
				drawWaterShimmer(ctx, camera, pc.center.x, pc.center.y, radius, animTime, pc.cell.terrain === 'ocean')
			}
		}
	}
}

/**
 * Draws a single hex cell's texture sampled from a deterministic pseudo-random UV offset,
 * clipped to either the organic multi-bend contour or strict straight hex geometry.
 */
function drawSingleCellRandomTexture(ctx, pc, tex, seed = 0) {
	let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
	if (pc.pVerts) {
		for (const pv of pc.pVerts) {
			if (pv.x < minX) minX = pv.x
			if (pv.x > maxX) maxX = pv.x
			if (pv.y < minY) minY = pv.y
			if (pv.y > maxY) maxY = pv.y
		}
	} else {
		minX = pc.pStart.x
		maxX = pc.pStart.x
		minY = pc.pStart.y
		maxY = pc.pStart.y
		for (const pe of pc.edges) {
			if (pe.pCP1A.x < minX) minX = pe.pCP1A.x; if (pe.pCP1A.x > maxX) maxX = pe.pCP1A.x
			if (pe.pCP1A.y < minY) minY = pe.pCP1A.y; if (pe.pCP1A.y > maxY) maxY = pe.pCP1A.y
			if (pe.pMid1.x < minX) minX = pe.pMid1.x; if (pe.pMid1.x > maxX) maxX = pe.pMid1.x
			if (pe.pMid1.y < minY) minY = pe.pMid1.y; if (pe.pMid1.y > maxY) maxY = pe.pMid1.y
			if (pe.pMid2.x < minX) minX = pe.pMid2.x; if (pe.pMid2.x > maxX) maxX = pe.pMid2.x
			if (pe.pMid2.y < minY) minY = pe.pMid2.y; if (pe.pMid2.y > maxY) maxY = pe.pMid2.y
			if (pe.pTo.x < minX) minX = pe.pTo.x; if (pe.pTo.x > maxX) maxX = pe.pTo.x
			if (pe.pTo.y < minY) minY = pe.pTo.y; if (pe.pTo.y > maxY) maxY = pe.pTo.y
		}
	}

	const boundW = maxX - minX
	const boundH = maxY - minY
	const sCx = (minX + maxX) / 2
	const sCy = (minY + maxY) / 2
	const BLEED = 1.25
	const drawSize = Math.max(boundW, boundH) * BLEED

	const CROP_PX = 128
	const srcW = tex.naturalWidth || 256
	const srcH = tex.naturalHeight || 256
	const cropPx = Math.min(CROP_PX, srcW, srcH)

	// Deterministic random UV offset: each cell samples a unique random crop
	const cellHash = hashString(`${pc.cell.col},${pc.cell.row}:texOfs:${seed}`)
	const maxOx = Math.max(0, srcW - cropPx)
	const maxOy = Math.max(0, srcH - cropPx)
	const ox = ((getHashFloat(cellHash, 0) * 0.5 + 0.5) * maxOx) | 0
	const oy = ((getHashFloat(cellHash, 1) * 0.5 + 0.5) * maxOy) | 0

	ctx.save()
	ctx.beginPath()
	if (pc.pVerts) {
		ctx.moveTo(pc.pVerts[0].x, pc.pVerts[0].y)
		for (let i = 1; i < 6; i++) {
			ctx.lineTo(pc.pVerts[i].x, pc.pVerts[i].y)
		}
	} else {
		ctx.moveTo(pc.pStart.x, pc.pStart.y)
		for (const pe of pc.edges) {
			ctx.bezierCurveTo(pe.pCP1A.x, pe.pCP1A.y, pe.pCP2A.x, pe.pCP2A.y, pe.pMid1.x, pe.pMid1.y)
			ctx.bezierCurveTo(pe.pCP1B.x, pe.pCP1B.y, pe.pCP2B.x, pe.pCP2B.y, pe.pMid2.x, pe.pMid2.y)
			ctx.bezierCurveTo(pe.pCP1C.x, pe.pCP1C.y, pe.pCP2C.x, pe.pCP2C.y, pe.pTo.x, pe.pTo.y)
		}
	}
	ctx.closePath()
	ctx.clip()

	if (ctx.imageSmoothingEnabled !== undefined) {
		ctx.imageSmoothingEnabled = false
	}

	const destX = Math.round(sCx - drawSize / 2)
	const destY = Math.round(sCy - drawSize / 2)
	const destW = Math.round(drawSize)
	const destH = Math.round(drawSize)

	ctx.drawImage(
		tex,
		ox, oy, cropPx, cropPx,
		destX, destY,
		destW, destH
	)
	ctx.restore()
}

/**
 * Draws a single flat-topped hex cell on the 3D perspective ground plane,
 * following organic multi-bend edge curves matching borders and rivers.
 *
 * Rendering layers (back-to-front):
 *   1. Solid biome fill color (fallback / base, always visible)
 *   2. Biome terrain texture sampled at a deterministic random UV offset
 *      (clips to the organic hex outline with a slight bleed margin)
 *   3. Thin edge stroke for visual separation
 *   4. Animated water shimmer (water/ocean biomes only)
 */
function drawHexCell(ctx, camera, cell, radius, animTime, seed = 0, riverMap = null, useOrganic = ENABLE_ORGANIC_EDGES) {
	const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
	const biome = BIOMES[cell.terrain] || BIOMES.grass

	if (!useOrganic) {
		const groundVerts = getHexGroundVertices(center.x, center.y, radius)
		const pVerts = groundVerts.map(v => camera.project(v.x, v.y, 0))
		if (!pVerts.some(v => v.visible)) return

		ctx.beginPath()
		ctx.moveTo(pVerts[0].x, pVerts[0].y)
		for (let i = 1; i < 6; i++) {
			ctx.lineTo(pVerts[i].x, pVerts[i].y)
		}
		ctx.closePath()
		ctx.fillStyle = biome.color
		ctx.fill()

		ctx.lineWidth = Math.max(0.6, 1 * camera.zoom)
		ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', 0.4)
		ctx.stroke()

		if (biome.isWater) {
			drawWaterShimmer(ctx, camera, center.x, center.y, radius, animTime, cell.terrain === 'ocean')
		}
		return
	}

	const perimeter = getOrganicCellPerimeter(cell.col, cell.row, radius, seed, riverMap)
	const pStart = camera.project(perimeter[0].from.x, perimeter[0].from.y, 0)
	let hasVisible = pStart.visible

	const projectedEdges = perimeter.map(e => {
		const m1 = e.mid1 || e.mid
		const m2 = e.mid2 || e.to
		const cp1C = e.cp1C || e.cp2B
		const cp2C = e.cp2C || e.to

		const pCP1A = camera.project(e.cp1A.x, e.cp1A.y, 0)
		const pCP2A = camera.project(e.cp2A.x, e.cp2A.y, 0)
		const pMid1 = camera.project(m1.x, m1.y, 0)
		const pCP1B = camera.project(e.cp1B.x, e.cp1B.y, 0)
		const pCP2B = camera.project(e.cp2B.x, e.cp2B.y, 0)
		const pMid2 = camera.project(m2.x, m2.y, 0)
		const pCP1C = camera.project(cp1C.x, cp1C.y, 0)
		const pCP2C = camera.project(cp2C.x, cp2C.y, 0)
		const pTo = camera.project(e.to.x, e.to.y, 0)
		if (pTo.visible || pMid1.visible || pMid2.visible) hasVisible = true
		return { pCP1A, pCP2A, pMid1, pCP1B, pCP2B, pMid2, pCP1C, pCP2C, pTo }
	})

	if (!hasVisible) return

	// Helper: trace the organic outline path (reused for fill and clip)
	function traceOutlinePath() {
		ctx.beginPath()
		ctx.moveTo(pStart.x, pStart.y)
		for (const pe of projectedEdges) {
			ctx.bezierCurveTo(pe.pCP1A.x, pe.pCP1A.y, pe.pCP2A.x, pe.pCP2A.y, pe.pMid1.x, pe.pMid1.y)
			ctx.bezierCurveTo(pe.pCP1B.x, pe.pCP1B.y, pe.pCP2B.x, pe.pCP2B.y, pe.pMid2.x, pe.pMid2.y)
			ctx.bezierCurveTo(pe.pCP1C.x, pe.pCP1C.y, pe.pCP2C.x, pe.pCP2C.y, pe.pTo.x, pe.pTo.y)
		}
		ctx.closePath()
	}

	// 1. Solid biome fill (always visible as a base / fallback)
	traceOutlinePath()
	ctx.fillStyle = biome.color
	ctx.fill()

	// Scale derived from perspective projection of the first vertex (shared by all steps)
	const avgScale = pStart.scale

	// 2. Biome terrain texture (disabled when ENABLE_BIOME_TEXTURES is false)
	if (ENABLE_BIOME_TEXTURES && !biome.isWater) {
		const tex = getBiomeTexture(cell.terrain)
		if (tex) {
			// Compute true screen-space bounding box across all organic perimeter points and Bezier handles
			// to guarantee full texture coverage without clipping even on heavily expanded hexes.
			let minX = pStart.x
			let maxX = pStart.x
			let minY = pStart.y
			let maxY = pStart.y

			const includePt = (p) => {
				if (p.x < minX) minX = p.x
				if (p.x > maxX) maxX = p.x
				if (p.y < minY) minY = p.y
				if (p.y > maxY) maxY = p.y
			}

			for (const pe of projectedEdges) {
				includePt(pe.pCP1A)
				includePt(pe.pCP2A)
				includePt(pe.pMid1)
				includePt(pe.pCP1B)
				includePt(pe.pCP2B)
				includePt(pe.pMid2)
				includePt(pe.pCP1C)
				includePt(pe.pCP2C)
				includePt(pe.pTo)
			}

			const boundW = maxX - minX
			const boundH = maxY - minY
			const sCx = (minX + maxX) / 2
			const sCy = (minY + maxY) / 2

			// Texture draw size in screen pixels: cover the bounding box plus a 25% bleed margin
			// ensuring organic curves, multi-bend Bezier protrusions, and jitter never run out of texture.
			const BLEED = 1.25
			const drawSize = Math.max(boundW, boundH) * BLEED

			// PIXELATED LOOK: sample only a small crop of the texture (CROP_PX×CROP_PX texels)
			// and magnify it to fill the hex. With 2x canvas downscaling, 44 texels
			// map ~1:1 to canvas pixels, creating perfectly unified 2×2 retro screen pixels.
			const CROP_PX = 128
			const srcW = tex.naturalWidth || 256
			const srcH = tex.naturalHeight || 256
			const cropPx = Math.min(CROP_PX, srcW, srcH)

			// Deterministic random UV offset: each cell samples a different region
			const cellHash = hashString(`${cell.col},${cell.row}:texOfs:${seed}`)
			const maxOx = Math.max(0, srcW - cropPx)
			const maxOy = Math.max(0, srcH - cropPx)
			const ox = ((getHashFloat(cellHash, 0) * 0.5 + 0.5) * maxOx) | 0
			const oy = ((getHashFloat(cellHash, 1) * 0.5 + 0.5) * maxOy) | 0

			ctx.save()
			traceOutlinePath()
			ctx.clip()

			// Nearest-neighbour filtering → crisp pixel edges, no bilinear blur
			if (ctx.imageSmoothingEnabled !== undefined) {
				ctx.imageSmoothingEnabled = false
			}

			ctx.globalAlpha = 1.0

			// Destination integer pixel snapping: eliminate all subpixel interpolation
			// so texel edges land exactly on whole canvas pixels without blur.
			const destX = Math.round(sCx - drawSize / 2)
			const destY = Math.round(sCy - drawSize / 2)
			const destW = Math.round(drawSize)
			const destH = Math.round(drawSize)

			ctx.drawImage(
				tex,
				ox, oy, cropPx, cropPx,
				destX, destY,
				destW, destH
			)

			ctx.restore()
		}
	}

	// 3. Hex edge stroke — drawn on top of texture for clean visual separation
	traceOutlinePath()
	ctx.lineWidth = Math.max(0.6, 1 * avgScale)
	ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', 0.4)
	ctx.stroke()

	// 4. Water waves animation for water/ocean
	if (biome.isWater) {
		const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
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
 * Draws political borders and territory fills for hexes assigned to factions (Civilization style).
 *
 * Pass 1: Territory Fill
 * - Fills hex cells with a subtle translucent tint (fillColor) representing the controlling faction.
 *
 * Pass 2: Outer National Borders
 * - Computes external edges where the adjacent hex belongs to a different faction (or no faction/map edge).
 * - Border lines are inset inward into each nation's own territory by 8% of the radius (0.08 * R).
 * - Miter normals at corner vertices ensure seamless, watertight, gapless continuous loops.
 * - When two nations border each other, each draws an inset line on its own side,
 *   creating the classic dual-ribbon border seen in Civilization without overlapping or obscuring.
 * - Border ribbons render on top of rivers, roads, and bridges with slight transparency (~0.78 inner stroke, 0.30 halo).
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HexPerspectiveCamera} camera
 * @param {Object} mapData
 * @param {number} radius
 * @param {Object|Array} [factionsMap=null]
 * @param {Map} [riverMap=null]
 * @param {'all'|1|2} [pass='all'] - 1 = territory fill only, 2 = outer ribbons only, 'all' = both
 */
export function drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap = null, riverMap = null, pass = 'all', options = {}) {
	if (!ctx || !mapData || !mapData.cells) return

	const cells = mapData.cells
	const screenRadius = options.screenRadius ?? (radius * camera.zoom)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : (screenRadius < 12 ? 2 : (screenRadius < 20 ? 1 : 0))
	const useOrganic = options.organic !== undefined ? options.organic : (mapData?.organic !== undefined ? mapData.organic : ENABLE_ORGANIC_EDGES)
	const vB = options.vBounds

	let candidateCells = options.visibleCells
	if (!candidateCells || (pass === 2 && vB)) {
		candidateCells = []
		if (vB) {
			const pad = 2
			const cMin = vB.minCol - pad
			const cMax = vB.maxCol + pad
			const rMin = vB.minRow - pad
			const rMax = vB.maxRow + pad
			for (let c = cMin; c <= cMax; c++) {
				for (let r = rMin; r <= rMax; r++) {
					const cell = cells[`${c},${r}`]
					if (cell && (cell.faction || cell.fraction)) {
						candidateCells.push(cell)
					}
				}
			}
		} else {
			for (const cell of Object.values(cells)) {
				if (cell && (cell.faction || cell.fraction)) {
					candidateCells.push(cell)
				}
			}
		}
	}

	if (candidateCells.length === 0) return

	// Build quick lookup for river tiers by canonical edge key if not provided
	if (!riverMap) {
		riverMap = new Map()
		if (mapData.rivers) {
			for (const r of Object.values(mapData.rivers)) {
				const cKey = getCanonicalEdgeKey(r.col, r.row, r.edge)
				riverMap.set(cKey, r)
			}
		}
	}

	// Group cells by faction
	// Map: factionId -> { visuals, borderColor, fillColor, cells: Array<cell> }
	const factionGroups = new Map()

	for (const cell of candidateCells) {
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
				cells: []
			}
			factionGroups.set(fId, group)
		}
		group.cells.push(cell)
	}

	if (factionGroups.size === 0) return

	ctx.save()

	// PASS 1: Territory Fills (Translucent colored background per cell)
	if (pass === 'all' || pass === 1) {
		for (const group of factionGroups.values()) {
			if (!group.fillColor) continue

			ctx.fillStyle = group.fillColor
			for (const cell of group.cells) {
				if (!isCellVisible(camera, cell.col, cell.row, radius)) continue

				if (!useOrganic) {
					const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
					const groundVerts = getHexGroundVertices(center.x, center.y, radius)
					const pVerts = groundVerts.map(v => camera.project(v.x, v.y, 0))
					if (!pVerts.some(v => v.visible)) continue

					ctx.beginPath()
					ctx.moveTo(pVerts[0].x, pVerts[0].y)
					for (let i = 1; i < 6; i++) {
						ctx.lineTo(pVerts[i].x, pVerts[i].y)
					}
					ctx.closePath()
					ctx.fill()
				} else {
					const perimeter = getOrganicCellPerimeter(cell.col, cell.row, radius, mapData?.seed || 0, riverMap)
					const pStart = camera.project(perimeter[0].from.x, perimeter[0].from.y, 0)
					let hasVisible = pStart.visible

					const projectedEdges = perimeter.map(e => {
						const m1 = e.mid1 || e.mid
						const m2 = e.mid2 || e.to
						const cp1C = e.cp1C || e.cp2B
						const cp2C = e.cp2C || e.to

						const pCP1A = camera.project(e.cp1A.x, e.cp1A.y, 0)
						const pCP2A = camera.project(e.cp2A.x, e.cp2A.y, 0)
						const pMid1 = camera.project(m1.x, m1.y, 0)
						const pCP1B = camera.project(e.cp1B.x, e.cp1B.y, 0)
						const pCP2B = camera.project(e.cp2B.x, e.cp2B.y, 0)
						const pMid2 = camera.project(m2.x, m2.y, 0)
						const pCP1C = camera.project(cp1C.x, cp1C.y, 0)
						const pCP2C = camera.project(cp2C.x, cp2C.y, 0)
						const pTo = camera.project(e.to.x, e.to.y, 0)
						if (pTo.visible || pMid1.visible || pMid2.visible) hasVisible = true
						return { pCP1A, pCP2A, pMid1, pCP1B, pCP2B, pMid2, pCP1C, pCP2C, pTo }
					})

					if (!hasVisible) continue

					ctx.beginPath()
					ctx.moveTo(pStart.x, pStart.y)
					for (const pe of projectedEdges) {
						ctx.bezierCurveTo(pe.pCP1A.x, pe.pCP1A.y, pe.pCP2A.x, pe.pCP2A.y, pe.pMid1.x, pe.pMid1.y)
						ctx.bezierCurveTo(pe.pCP1B.x, pe.pCP1B.y, pe.pCP2B.x, pe.pCP2B.y, pe.pMid2.x, pe.pMid2.y)
						ctx.bezierCurveTo(pe.pCP1C.x, pe.pCP1C.y, pe.pCP2C.x, pe.pCP2C.y, pe.pTo.x, pe.pTo.y)
					}
					ctx.closePath()
					ctx.fill()
				}
			}
		}
	}

	// PASS 2: External Boundary Chains (Continuous Smooth Polylines / Loops)
	if (pass === 'all' || pass === 2) {
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

		// Helper to calculate corner miter offset between two inward segment normals
		function getCornerMiter(nPrev, nCurr, dVal) {
			const sumX = nPrev.x + nCurr.x
			const sumY = nPrev.y + nCurr.y
			const len = Math.hypot(sumX, sumY)
			if (len < 1e-4) {
				return { x: nCurr.x * dVal, y: nCurr.y * dVal }
			}
			const miterFactor = Math.min(2.0, 2.0 / len)
			const normX = sumX / len
			const normY = sumY / len
			return {
				x: normX * (dVal * miterFactor),
				y: normY * (dVal * miterFactor)
			}
		}

		// Group continuous chains by border color
		// Map: borderColor -> Array<Chain>
		const chainsByColor = new Map()
		const dInset = 0.08 * radius

		for (const group of factionGroups.values()) {
			const borderEdges = []

			for (const cell of group.cells) {
				const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
				const groundVerts = useOrganic
					? getOrganicHexGroundVertices(center.x, center.y, radius, mapData?.seed || 0)
					: getHexGroundVertices(center.x, center.y, radius)

				for (const edge of HEX_EDGES) {
					const nCoord = getHexNeighbor(cell.col, cell.row, edge)
					const nKey = `${nCoord.col},${nCoord.row}`

					// External boundary edge if neighbor cell is not in this faction
					const nCell = cells[nKey]
					const nFaction = nCell ? (nCell.faction || nCell.fraction) : null
					if (nFaction !== group.factionId) {
						const [iA, iB] = EDGE_VERTEX_INDICES[edge]
						const vFrom = groundVerts[iA]
						const vTo = groundVerts[iB]
						const canonKey = getCanonicalEdgeKey(cell.col, cell.row, edge)
						const river = riverMap ? riverMap.get(canonKey) : null
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

				// Calculate inward normal per segment and miter offsets at vertices.
				// Since traversal is clockwise around the cell, the interior is to the right: nIn = (-dy/L, dx/L)
				const N = chain.length
				const normals = []
				for (let i = 0; i < N; i++) {
					const seg = chain[i]
					const dx = seg.vTo.x - seg.vFrom.x
					const dy = seg.vTo.y - seg.vFrom.y
					const elen = Math.hypot(dx, dy) || 1
					normals.push({ x: -dy / elen, y: dx / elen })
				}

				// Inward offsets for the layered border ribbon:
				// - dMain: offset of the crisp main line, sitting just inside the frontier (0.04 * R)
				// - dHaloMid: offset of the mid-tier glow (0.076 * R)
				// - dHaloWide: offset of the wide soft outer-fade halo (0.138 * R)
				// All halo layers have their outer stroke edge aligned exactly at the crisp line (dOuter ~ 0.007 * R).
				// Towards the outside, there is ZERO halo (only the crisp line).
				// Towards the inside, the halo is 2x wider and smoothly fades to transparent!
				const dMain = 0.04 * radius
				const dHaloMid = 0.076 * radius
				const dHaloWide = 0.138 * radius

				function buildCornerOffsets(dVal) {
					const arr = []
					if (chain.isClosed) {
						for (let i = 0; i < N; i++) {
							const prevIdx = (i - 1 + N) % N
							arr.push(getCornerMiter(normals[prevIdx], normals[i], dVal))
						}
					} else {
						arr.push({ x: normals[0].x * dVal, y: normals[0].y * dVal })
						for (let i = 1; i < N; i++) {
							arr.push(getCornerMiter(normals[i - 1], normals[i], dVal))
						}
						arr.push({ x: normals[N - 1].x * dVal, y: normals[N - 1].y * dVal })
					}
					return arr
				}

				const cornerOffsetsMain = buildCornerOffsets(dMain)
				const cornerOffsetsMid = buildCornerOffsets(dHaloMid)
				const cornerOffsetsWide = buildCornerOffsets(dHaloWide)

				// Project segments in chain to camera screen coordinates
				let scaleSum = 0
				let visibleCount = 0

				const projectedChain = []
				const haloMidList = []
				const haloWideList = []

				for (let i = 0; i < N; i++) {
					const seg = chain[i]

					if (!useOrganic) {
						function projectStraightOffsetSegment(cOffsets) {
							const deltaFrom = cOffsets[i]
							const deltaTo = chain.isClosed ? cOffsets[(i + 1) % N] : cOffsets[i + 1]

							const fromInset = { x: seg.vFrom.x + deltaFrom.x, y: seg.vFrom.y + deltaFrom.y }
							const toInset = { x: seg.vTo.x + deltaTo.x, y: seg.vTo.y + deltaTo.y }

							return {
								pFrom: camera.project(fromInset.x, fromInset.y, 0),
								pTo: camera.project(toInset.x, toInset.y, 0)
							}
						}

						const segMain = projectStraightOffsetSegment(cornerOffsetsMain)
						const segMid = projectStraightOffsetSegment(cornerOffsetsMid)
						const segWide = projectStraightOffsetSegment(cornerOffsetsWide)

						if (segMain.pFrom.visible || segMain.pTo.visible) visibleCount++
						scaleSum += (segMain.pFrom.scale + segMain.pTo.scale) / 2

						projectedChain.push(segMain)
						haloMidList.push(segMid)
						haloWideList.push(segWide)
					} else {
						const curve = getHexEdgeCurve(seg.vFrom, seg.vTo, seg.canonKey, radius, seg.riverTier, {
							seed: mapData?.seed || 0
						})

						function projectOffsetSegment(dVal, cOffsets) {
							const deltaFrom = cOffsets[i]
							const deltaTo = chain.isClosed ? cOffsets[(i + 1) % N] : cOffsets[i + 1]

							const fromInset = { x: curve.from.x + deltaFrom.x, y: curve.from.y + deltaFrom.y }
							const toInset = { x: curve.to.x + deltaTo.x, y: curve.to.y + deltaTo.y }
							const m1 = curve.mid1 || curve.mid
							const m2 = curve.mid2 || curve.to
							const cp1C = curve.cp1C || curve.cp2B
							const cp2C = curve.cp2C || curve.to

							const mid1Inset = { x: m1.x + normals[i].x * dVal, y: m1.y + normals[i].y * dVal }
							const mid2Inset = { x: m2.x + normals[i].x * dVal, y: m2.y + normals[i].y * dVal }

							const cp1AInset = { x: fromInset.x + (curve.cp1A.x - curve.from.x), y: fromInset.y + (curve.cp1A.y - curve.from.y) }
							const cp2AInset = { x: mid1Inset.x + (curve.cp2A.x - m1.x), y: mid1Inset.y + (curve.cp2A.y - m1.y) }
							const cp1BInset = { x: mid1Inset.x + (curve.cp1B.x - m1.x), y: mid1Inset.y + (curve.cp1B.y - m1.y) }
							const cp2BInset = { x: mid2Inset.x + (curve.cp2B.x - m2.x), y: mid2Inset.y + (curve.cp2B.y - m2.y) }
							const cp1CInset = { x: mid2Inset.x + (cp1C.x - m2.x), y: mid2Inset.y + (cp1C.y - m2.y) }
							const cp2CInset = { x: toInset.x + (cp2C.x - curve.to.x), y: toInset.y + (cp2C.y - curve.to.y) }

							return {
								pFrom: camera.project(fromInset.x, fromInset.y, 0),
								pCP1A: camera.project(cp1AInset.x, cp1AInset.y, 0),
								pCP2A: camera.project(cp2AInset.x, cp2AInset.y, 0),
								pMid1: camera.project(mid1Inset.x, mid1Inset.y, 0),
								pCP1B: camera.project(cp1BInset.x, cp1BInset.y, 0),
								pCP2B: camera.project(cp2BInset.x, cp2BInset.y, 0),
								pMid2: camera.project(mid2Inset.x, mid2Inset.y, 0),
								pCP1C: camera.project(cp1CInset.x, cp1CInset.y, 0),
								pCP2C: camera.project(cp2CInset.x, cp2CInset.y, 0),
								pTo: camera.project(toInset.x, toInset.y, 0),
								fromInset,
								toInset,
								mid1Inset,
								mid2Inset
							}
						}

						const segMain = projectOffsetSegment(dMain, cornerOffsetsMain)
						const segMid = projectOffsetSegment(dHaloMid, cornerOffsetsMid)
						const segWide = projectOffsetSegment(dHaloWide, cornerOffsetsWide)

						if (segMain.pFrom.visible || segMain.pTo.visible || segMain.pMid1.visible || segMain.pMid2.visible) visibleCount++
						scaleSum += (segMain.pFrom.scale + segMain.pTo.scale) / 2

						projectedChain.push(segMain)
						haloMidList.push(segMid)
						haloWideList.push(segWide)
					}
				}

				// Only render if at least one vertex is visible in camera frustum
				if (visibleCount > 0 && projectedChain.length > 0) {
					projectedChain.isClosed = chain.isClosed
					projectedChain.avgScale = scaleSum / projectedChain.length
					projectedChain.haloMid = haloMidList
					projectedChain.haloWide = haloWideList

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

			// PASS 2A1: Wide soft inward halo (LOD 0 close-up only)
			if (lodLevel === 0) {
				ctx.strokeStyle = hexToRgba(color, 0.12)
				for (const chain of chains) {
					const avgScale = chain.avgScale || 1.0
					ctx.lineWidth = Math.max(4.0, 9.5 * avgScale)
					const list = chain.haloWide || chain
					ctx.beginPath()
					ctx.moveTo(list[0].pFrom.x, list[0].pFrom.y)
					for (let i = 0; i < list.length; i++) {
						const seg = list[i]
						if (!useOrganic) {
							ctx.lineTo(seg.pTo.x, seg.pTo.y)
						} else {
							ctx.bezierCurveTo(seg.pCP1A.x, seg.pCP1A.y, seg.pCP2A.x, seg.pCP2A.y, seg.pMid1.x, seg.pMid1.y)
							ctx.bezierCurveTo(seg.pCP1B.x, seg.pCP1B.y, seg.pCP2B.x, seg.pCP2B.y, seg.pMid2.x, seg.pMid2.y)
							ctx.bezierCurveTo(seg.pCP1C.x, seg.pCP1C.y, seg.pCP2C.x, seg.pCP2C.y, seg.pTo.x, seg.pTo.y)
						}
					}
					if (chain.isClosed) {
						ctx.closePath()
					}
					ctx.stroke()
				}
			}

			// PASS 2A2: Focused inner halo (LOD 0 and LOD 1, skipped at LOD 2 strategic zoom)
			if (lodLevel < 2) {
				ctx.strokeStyle = hexToRgba(color, 0.22)
				for (const chain of chains) {
					const avgScale = chain.avgScale || 1.0
					ctx.lineWidth = Math.max(2.2, 5.0 * avgScale)
					const list = chain.haloMid || chain
					ctx.beginPath()
					ctx.moveTo(list[0].pFrom.x, list[0].pFrom.y)
					for (let i = 0; i < list.length; i++) {
						const seg = list[i]
						if (!useOrganic) {
							ctx.lineTo(seg.pTo.x, seg.pTo.y)
						} else {
							ctx.bezierCurveTo(seg.pCP1A.x, seg.pCP1A.y, seg.pCP2A.x, seg.pCP2A.y, seg.pMid1.x, seg.pMid1.y)
							ctx.bezierCurveTo(seg.pCP1B.x, seg.pCP1B.y, seg.pCP2B.x, seg.pCP2B.y, seg.pMid2.x, seg.pMid2.y)
							ctx.bezierCurveTo(seg.pCP1C.x, seg.pCP1C.y, seg.pCP2C.x, seg.pCP2C.y, seg.pTo.x, seg.pTo.y)
						}
					}
					if (chain.isClosed) {
						ctx.closePath()
					}
					ctx.stroke()
				}
			}

			// PASS 2B: Crisp heraldic main stroke (rendered across all LOD levels; bolder at LOD 2)
			ctx.strokeStyle = hexToRgba(color, 0.78)
			for (const chain of chains) {
				const avgScale = chain.avgScale || 1.0
				ctx.lineWidth = Math.max(1.3, (lodLevel === 2 ? 2.8 : 2.4) * avgScale)
				ctx.beginPath()
				ctx.moveTo(chain[0].pFrom.x, chain[0].pFrom.y)
				for (let i = 0; i < chain.length; i++) {
					const seg = chain[i]
					if (!useOrganic) {
						ctx.lineTo(seg.pTo.x, seg.pTo.y)
					} else {
						ctx.bezierCurveTo(seg.pCP1A.x, seg.pCP1A.y, seg.pCP2A.x, seg.pCP2A.y, seg.pMid1.x, seg.pMid1.y)
						ctx.bezierCurveTo(seg.pCP1B.x, seg.pCP1B.y, seg.pCP2B.x, seg.pCP2B.y, seg.pMid2.x, seg.pMid2.y)
						ctx.bezierCurveTo(seg.pCP1C.x, seg.pCP1C.y, seg.pCP2C.x, seg.pCP2C.y, seg.pTo.x, seg.pTo.y)
					}
				}
				if (chain.isClosed) {
					ctx.closePath()
				}
				ctx.stroke()
			}
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
function drawRivers(ctx, camera, mapData, radius, animTime, options = {}) {
	if (!mapData.rivers) return

	const rivers = Object.values(mapData.rivers)
	if (rivers.length === 0) return

	const useOrganic = options.organic !== undefined ? options.organic : (mapData?.organic !== undefined ? mapData.organic : ENABLE_ORGANIC_EDGES)
	const screenRadius = options.screenRadius ?? (radius * camera.zoom)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : (screenRadius < 12 ? 2 : (screenRadius < 20 ? 1 : 0))

	if (!useOrganic) {
		const preparedRivers = []
		for (const river of rivers) {
			// At LOD 2, cull minor tier-1 streams to keep strategic view uncluttered and fast
			if (lodLevel === 2 && (river.width || 1) === 1) continue

			const center = hexToWorldGroundCenter(river.col, river.row, radius)
			const groundVerts = getHexGroundVertices(center.x, center.y, radius)
			const { from: gFrom, to: gTo } = getHexEdgeEndpoints(groundVerts, river.edge)
			const pFrom = camera.project(gFrom.x, gFrom.y, 0)
			const pTo = camera.project(gTo.x, gTo.y, 0)
			if (!pFrom.visible && !pTo.visible) continue

			const avgScale = (pFrom.scale + pTo.scale) / 2
			const minX = Math.min(pFrom.x, pTo.x)
			const maxX = Math.max(pFrom.x, pTo.x)
			const minY = Math.min(pFrom.y, pTo.y)
			const maxY = Math.max(pFrom.y, pTo.y)
			const pad = 40 * avgScale
			if (maxX < -pad || minX > camera.viewportWidth + pad || maxY < -pad || minY > camera.viewportHeight + pad) {
				continue
			}

			const tier = river.width || 1
			let baseWidth, shoreExtra, currentDashW
			if (tier === 3) {
				baseWidth = Math.max(2.6, 6.2 * avgScale)
				shoreExtra = 1.8 * avgScale
				currentDashW = Math.max(1.2, baseWidth * 0.35)
			} else if (tier === 2) {
				baseWidth = Math.max(1.8, 3.6 * avgScale)
				shoreExtra = 1.4 * avgScale
				currentDashW = Math.max(0.9, baseWidth * 0.38)
			} else {
				baseWidth = Math.max(1.0, 1.9 * avgScale)
				shoreExtra = 1.0 * avgScale
				currentDashW = Math.max(0.6, baseWidth * 0.40)
			}
			const casingWidth = baseWidth + shoreExtra
			const flowDir = river.flowDir === -1 ? -1 : 1

			preparedRivers.push({
				pFrom,
				pTo,
				baseWidth,
				casingWidth,
				currentDashW,
				tier,
				avgScale,
				flowDir
			})
		}

		if (preparedRivers.length === 0) return

		ctx.save()
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		// PASS 1: Riverbed Shore Strokes
		ctx.strokeStyle = '#0284c7'
		for (const r of preparedRivers) {
			ctx.lineWidth = r.casingWidth
			ctx.beginPath()
			ctx.moveTo(r.pFrom.x, r.pFrom.y)
			ctx.lineTo(r.pTo.x, r.pTo.y)
			ctx.stroke()
		}

		// PASS 2: Water Core
		ctx.strokeStyle = '#38bdf8'
		for (const r of preparedRivers) {
			ctx.lineWidth = r.baseWidth
			ctx.beginPath()
			ctx.moveTo(r.pFrom.x, r.pFrom.y)
			ctx.lineTo(r.pTo.x, r.pTo.y)
			ctx.stroke()
		}

		// PASS 3: Animated Flow Dashes (LOD 0 and LOD 1 only, skipped at LOD 2)
		if (lodLevel < 2) {
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)'
			for (const r of preparedRivers) {
				const dx = r.pTo.x - r.pFrom.x
				const dy = r.pTo.y - r.pFrom.y
				const edgeLen = Math.hypot(dx, dy)
				if (edgeLen > 2) {
					const ux = dx / edgeLen
					const uy = dy / edgeLen
					const dir = r.flowDir
					const numDashes = Math.max(1, Math.round(edgeLen / (28 * r.avgScale)))
					const dashLen = Math.max(3, 7 * r.avgScale)
					ctx.lineWidth = r.currentDashW

					for (let d = 0; d < numDashes; d++) {
						const basePhase = (d / numDashes + animTime * 0.45 * dir) % 1
						const phase = (basePhase + 1) % 1
						const cx = r.pFrom.x + dx * phase
						const cy = r.pFrom.y + dy * phase
						const half = dashLen / 2
						ctx.beginPath()
						ctx.moveTo(cx - ux * half, cy - uy * half)
						ctx.lineTo(cx + ux * half, cy + uy * half)
						ctx.stroke()
					}
				}
			}
		}

		ctx.restore()
		return
	}

	ctx.save()

	const preparedRivers = []
	const vertexBranches = new Map()

	function getVertexKey(pt) {
		return `${Math.round(pt.x * 10)},${Math.round(pt.y * 10)}`
	}

	for (const river of rivers) {
		const center = hexToWorldGroundCenter(river.col, river.row, radius)
		const groundVerts = getOrganicHexGroundVertices(center.x, center.y, radius, mapData?.seed || 0)
		const { from: gFrom, to: gTo } = getHexEdgeEndpoints(groundVerts, river.edge)
		const canonKey = getCanonicalEdgeKey(river.col, river.row, river.edge)
		const tier = river.width || 1
		const { cp1, cp2 } = getRiverMeanderControls(gFrom, gTo, canonKey, radius, tier, { seed: mapData?.seed || 0 })

		const pFrom = camera.project(gFrom.x, gFrom.y, 0)
		const pCP1 = camera.project(cp1.x, cp1.y, 0)
		const pCP2 = camera.project(cp2.x, cp2.y, 0)
		const pTo = camera.project(gTo.x, gTo.y, 0)

		if (!pFrom.visible && !pTo.visible) continue

		const minX = Math.min(pFrom.x, pTo.x, pCP1.x, pCP2.x)
		const maxX = Math.max(pFrom.x, pTo.x, pCP1.x, pCP2.x)
		const minY = Math.min(pFrom.y, pTo.y, pCP1.y, pCP2.y)
		const maxY = Math.max(pFrom.y, pTo.y, pCP1.y, pCP2.y)
		const avgScale = (pFrom.scale + pTo.scale) / 2
		const pad = 60 * avgScale
		if (maxX < -pad || minX > camera.viewportWidth + pad || maxY < -pad || minY > camera.viewportHeight + pad) {
			continue
		}
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

	// Calculate rounded turn fillets (2 branches) and confluence fillets (3+ branches)
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
				if (b.isFrom) b.river.startPt = vData.pCenter
				else b.river.endPt = vData.pCenter
			}

			// Sort branches circularly by angle around vertex
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

	// --- PASS 1: Riverbed Shore Strokes, Rounded Junction Fillets, and Confluence Shore Fillets ---
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
export function buildRoadRenderData(camera, mapData, radius, options = {}) {
	const lodLevel = options.lodLevel ?? 0
	if (!mapData.roads) return { trunks: [], turns: [], crossroads: [] }

	const roads = Object.values(mapData.roads)
	if (roads.length === 0) return { trunks: [], turns: [], crossroads: [] }

	const cellBranches = new Map()

	for (const road of roads) {
		const isStone = road.type === 'stone'
		// At LOD 2, cull minor dirt roads from strategic overview
		if (lodLevel === 2 && !isStone) continue

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

		const minX = Math.min(p1.x, p2.x, pMid.x)
		const maxX = Math.max(p1.x, p2.x, pMid.x)
		const minY = Math.min(p1.y, p2.y, pMid.y)
		const maxY = Math.max(p1.y, p2.y, pMid.y)
		const avgScale = (p1.scale + p2.scale) / 2
		const pad = 60 * avgScale
		if (maxX < -pad || minX > camera.viewportWidth + pad || maxY < -pad || minY > camera.viewportHeight + pad) {
			continue
		}
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
function drawHexHighlight(ctx, camera, col, row, radius, color, fillOpacity = 0.2, lineWidth = 2, cell = null, seed = 0, riverMap = null, useOrganic = ENABLE_ORGANIC_EDGES) {
	if (!useOrganic) {
		const center = hexToWorldGroundCenter(col, row, radius)
		const groundVerts = getHexGroundVertices(center.x, center.y, radius)
		const pVerts = groundVerts.map(v => camera.projectTerrain(v.x, v.y, 0))
		if (!pVerts.some(v => v.visible)) return

		ctx.save()
		const rgbaFill = color
			.replace(')', `, ${fillOpacity})`)
			.replace('rgb', 'rgba')
			.replace('#38bdf8', `rgba(56, 189, 248, ${fillOpacity})`)
			.replace('#f6c445', `rgba(246, 196, 69, ${fillOpacity})`)

		ctx.beginPath()
		ctx.moveTo(pVerts[0].x, pVerts[0].y)
		for (let i = 1; i < 6; i++) {
			ctx.lineTo(pVerts[i].x, pVerts[i].y)
		}
		ctx.closePath()

		ctx.fillStyle = rgbaFill
		ctx.fill()

		const avgScale = pVerts[0].scale
		ctx.lineWidth = Math.max(1, lineWidth * avgScale)
		ctx.strokeStyle = color
		ctx.stroke()
		ctx.restore()
		return
	}

	const perimeter = getOrganicCellPerimeter(col, row, radius, seed, riverMap)
	const pStart = camera.projectTerrain(perimeter[0].from.x, perimeter[0].from.y, 0)
	let hasVisible = pStart.visible

	const projectedEdges = perimeter.map(e => {
		const m1 = e.mid1 || e.mid
		const m2 = e.mid2 || e.to
		const cp1C = e.cp1C || e.cp2B
		const cp2C = e.cp2C || e.to

		const pCP1A = camera.projectTerrain(e.cp1A.x, e.cp1A.y, 0)
		const pCP2A = camera.projectTerrain(e.cp2A.x, e.cp2A.y, 0)
		const pMid1 = camera.projectTerrain(m1.x, m1.y, 0)
		const pCP1B = camera.projectTerrain(e.cp1B.x, e.cp1B.y, 0)
		const pCP2B = camera.projectTerrain(e.cp2B.x, e.cp2B.y, 0)
		const pMid2 = camera.projectTerrain(m2.x, m2.y, 0)
		const pCP1C = camera.projectTerrain(cp1C.x, cp1C.y, 0)
		const pCP2C = camera.projectTerrain(cp2C.x, cp2C.y, 0)
		const pTo = camera.projectTerrain(e.to.x, e.to.y, 0)
		if (pTo.visible || pMid1.visible || pMid2.visible) hasVisible = true
		return { pCP1A, pCP2A, pMid1, pCP1B, pCP2B, pMid2, pCP1C, pCP2C, pTo }
	})

	if (!hasVisible) return

	ctx.save()

	const rgbaFill = color
		.replace(')', `, ${fillOpacity})`)
		.replace('rgb', 'rgba')
		.replace('#38bdf8', `rgba(56, 189, 248, ${fillOpacity})`)
		.replace('#f6c445', `rgba(246, 196, 69, ${fillOpacity})`)

	ctx.beginPath()
	ctx.moveTo(pStart.x, pStart.y)
	for (const pe of projectedEdges) {
		ctx.bezierCurveTo(pe.pCP1A.x, pe.pCP1A.y, pe.pCP2A.x, pe.pCP2A.y, pe.pMid1.x, pe.pMid1.y)
		ctx.bezierCurveTo(pe.pCP1B.x, pe.pCP1B.y, pe.pCP2B.x, pe.pCP2B.y, pe.pMid2.x, pe.pMid2.y)
		ctx.bezierCurveTo(pe.pCP1C.x, pe.pCP1C.y, pe.pCP2C.x, pe.pCP2C.y, pe.pTo.x, pe.pTo.y)
	}
	ctx.closePath()

	ctx.fillStyle = rgbaFill
	ctx.fill()

	const avgScale = pStart.scale
	ctx.lineWidth = Math.max(1, lineWidth * avgScale)
	ctx.strokeStyle = color
	ctx.stroke()

	ctx.restore()
}

/**
 * Highlights a specific hex edge (for river drawing).
 */
function drawEdgeHighlight(ctx, camera, col, row, edge, radius, riverWidth = 1, seed = 0, useOrganic = ENABLE_ORGANIC_EDGES) {
	const center = hexToWorldGroundCenter(col, row, radius)
	const groundVerts = useOrganic
		? getOrganicHexGroundVertices(center.x, center.y, radius, seed)
		: getHexGroundVertices(center.x, center.y, radius)
	const { from, to } = getHexEdgeEndpoints(groundVerts, edge)
	const tier = riverWidth || 1

	const pFrom = camera.project(from.x, from.y, 0)
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
	if (!useOrganic) {
		ctx.lineTo(pTo.x, pTo.y)
	} else {
		const canonKey = getCanonicalEdgeKey(col, row, edge)
		const { cp1, cp2 } = getRiverMeanderControls(from, to, canonKey, radius, tier, { seed })
		const pCP1 = camera.project(cp1.x, cp1.y, 0)
		const pCP2 = camera.project(cp2.x, cp2.y, 0)
		ctx.bezierCurveTo(pCP1.x, pCP1.y, pCP2.x, pCP2.y, pTo.x, pTo.y)
	}
	ctx.lineWidth = highlightW + 1.8 * avgScale
	ctx.strokeStyle = '#38bdf8'
	ctx.lineCap = 'round'
	ctx.stroke()
	ctx.restore()
}
