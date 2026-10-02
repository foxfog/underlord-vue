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
	getHashFloat,
	getHexEdgeVertexIndices,
	getHexVertexNeighborCells,
	DEFAULT_HEX_MIN_ZOOM,
	DEFAULT_HEX_MAX_ZOOM
} from './hexCoords.js'
import {
	DEFAULT_PIXEL_SCALE,
	setDefaultPixelScale,
	ENABLE_BIOME_TEXTURES,
	setEnableBiomeTextures,
	ENABLE_ORGANIC_EDGES,
	setEnableOrganicEdges,
	ENABLE_HEX_ANIMATIONS,
	setEnableHexAnimations,
	ANIM_DISABLE_ZOOM_FRACTION,
	setAnimDisableZoomFraction,
	HEX_LOD_SCREEN_RADIUS_ORGANIC,
	HEX_LOD_SCREEN_RADIUS_STRATEGIC,
	calculateLodLevel,
	HEX_TEXTURE_CROP_PX,
	HEX_TEXTURE_BLEED,
	RIVER_CONFIG,
	setRiverConfig,
	HEX_BORDER_ALPHA,
	setHexBorderAlpha,
	BORDER_CASING_ALPHA,
	setBorderCasingAlpha,
	BORDER_CORE_ALPHA,
	setBorderCoreAlpha,
	FACTION_FILL_ALPHA,
	setFactionFillAlpha,
	WATER_CONFIG,
	setWaterConfig
} from './hexConfig.js'

export {
	DEFAULT_PIXEL_SCALE,
	setDefaultPixelScale,
	ENABLE_BIOME_TEXTURES,
	setEnableBiomeTextures,
	ENABLE_ORGANIC_EDGES,
	setEnableOrganicEdges,
	ENABLE_HEX_ANIMATIONS,
	setEnableHexAnimations,
	ANIM_DISABLE_ZOOM_FRACTION,
	setAnimDisableZoomFraction,
	RIVER_CONFIG,
	setRiverConfig,
	WATER_CONFIG,
	setWaterConfig,
	HEX_BORDER_ALPHA,
	setHexBorderAlpha,
	BORDER_CASING_ALPHA,
	setBorderCasingAlpha,
	BORDER_CORE_ALPHA,
	setBorderCoreAlpha,
	FACTION_FILL_ALPHA,
	setFactionFillAlpha
}

// ── Two-Layer Static Landscape Cache State ────────────────────────────────────
// Offscreen static landscape caches (Ground plane & Relief overlay)
let _staticGroundCanvas = null
let _staticGroundCtx = null
let _staticOverlayCanvas = null
let _staticOverlayCtx = null

let _lastStaticParams = null
let _hexStaticVersion = 0

/**
 * Increment this version whenever map geometry, cells, factions, borders,
 * or tools mutate the map data, invalidating the offscreen static layers.
 */
export function invalidateHexStaticCache() {
	_hexStaticVersion++
}

function ensureStaticCanvases(width, height) {
	if (typeof document === 'undefined') return false
	if (!_staticGroundCanvas) {
		_staticGroundCanvas = document.createElement('canvas')
		_staticGroundCtx = _staticGroundCanvas.getContext('2d')
	}
	if (!_staticOverlayCanvas) {
		_staticOverlayCanvas = document.createElement('canvas')
		_staticOverlayCtx = _staticOverlayCanvas.getContext('2d')
	}
	if (!_staticGroundCtx || !_staticOverlayCtx) return false

	if (_staticGroundCanvas.width !== width || _staticGroundCanvas.height !== height) {
		_staticGroundCanvas.width = width
		_staticGroundCanvas.height = height
	}
	if (_staticOverlayCanvas.width !== width || _staticOverlayCanvas.height !== height) {
		_staticOverlayCanvas.width = width
		_staticOverlayCanvas.height = height
	}
	return true
}

function isStaticCacheValid(params) {
	if (!_lastStaticParams) return false
	if (_hexStaticVersion !== _lastStaticParams.staticVersion) return false
	if (params.mapData !== _lastStaticParams.mapData) return false
	if (params.viewportWidth !== _lastStaticParams.viewportWidth) return false
	if (params.viewportHeight !== _lastStaticParams.viewportHeight) return false
	if (params.cameraX !== _lastStaticParams.cameraX) return false
	if (params.cameraY !== _lastStaticParams.cameraY) return false
	if (params.zoom !== _lastStaticParams.zoom) return false
	if (params.logicalZoom !== _lastStaticParams.logicalZoom) return false
	if (params.pixelScale !== _lastStaticParams.pixelScale) return false
	if (params.pitch !== _lastStaticParams.pitch) return false
	if (params.focalDistance !== _lastStaticParams.focalDistance) return false
	if (params.showBorders !== _lastStaticParams.showBorders) return false
	if (params.factionsMap !== _lastStaticParams.factionsMap) return false
	if (params.drawCanvasBadges !== _lastStaticParams.drawCanvasBadges) return false
	if (params.discoveredLocations !== _lastStaticParams.discoveredLocations) return false
	if (params.useOrganic !== _lastStaticParams.useOrganic) return false
	if (params.lodLevel !== _lastStaticParams.lodLevel) return false
	if (params.hexBorderAlpha !== _lastStaticParams.hexBorderAlpha) return false
	if (params.borderCasingAlpha !== _lastStaticParams.borderCasingAlpha) return false
	if (params.borderCoreAlpha !== _lastStaticParams.borderCoreAlpha) return false
	if (params.factionFillAlpha !== _lastStaticParams.factionFillAlpha) return false
	return true
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
 * Implements a 2-Layer Static Landscape Cache:
 * - Layer 1 (Ground): Atmosphere + Base biomes & textures + Territory tint fills
 * - Dynamic Middle: Water shimmer + Animated rivers
 * - Layer 2 (Overlay): Hills + Roads + Bridges + Border ribbons + Mountains + Settlements
 * - Interactive Top: Hover & selection highlights
 *
 * When camera is stationary (idle animation ticks, tool changes, hover moves),
 * Ground and Overlay layers are blitted from cached offscreen canvases in ~0.1ms!
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
		animTime = 0, // Seconds for animated rivers
		skipStaticCache = false
	} = options

	const radius = mapData.hexRadius || 36
	const width = ctx.canvas?.width || 800
	const height = ctx.canvas?.height || 600

	const camera = new HexPerspectiveCamera({
		viewportWidth: width,
		viewportHeight: height,
		cameraX,
		cameraY,
		zoom,
		pitch,
		focalDistance
	})

	// 0. Build canonical river lookup map once per frame
	const riverMap = new Map()
	if (mapData.rivers) {
		for (const r of Object.values(mapData.rivers)) {
			const cKey = getCanonicalEdgeKey(r.col, r.row, r.edge)
			riverMap.set(cKey, r)
		}
	}

	// 0.05. Check organic edges setting & calculate dynamic LOD level
	const pixelScale = Math.max(1, Number(options.pixelScale ?? DEFAULT_PIXEL_SCALE) || 1)
	const logicalZoom = options.logicalZoom !== undefined ? Number(options.logicalZoom) : (zoom * pixelScale)

	const mapOrganic = options.organic !== undefined ? options.organic : (mapData?.organic !== undefined ? mapData.organic : ENABLE_ORGANIC_EDGES)
	// screenRadius is the physical/visual radius of the hex on the display (independent of internal render pixelScale buffer downsampling)
	const screenRadius = radius * logicalZoom
	let lodLevel = calculateLodLevel(screenRadius)
	const useOrganic = lodLevel === 0 && mapOrganic

	const _animZoomThreshold = DEFAULT_HEX_MIN_ZOOM + (1 - ANIM_DISABLE_ZOOM_FRACTION) * (DEFAULT_HEX_MAX_ZOOM - DEFAULT_HEX_MIN_ZOOM)
	const animationsActive = ENABLE_HEX_ANIMATIONS && (ANIM_DISABLE_ZOOM_FRACTION <= 0 || logicalZoom >= _animZoomThreshold)
	const effectiveAnimTime = animationsActive ? animTime : 0

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
	const visibleWaterCells = []
	const cellsMap = mapData.cells || {}

	for (let c = vBounds.minCol; c <= vBounds.maxCol; c++) {
		for (let r = vBounds.minRow; r <= vBounds.maxRow; r++) {
			const cell = cellsMap[`${c},${r}`]
			if (cell && isCellVisible(camera, c, r, radius)) {
				visibleCells.push(cell)
				if (cell.feature === 'mountain' || cell.settlement || (lodLevel < 2 && cell.feature === 'hills')) {
					visibleReliefCells.push(cell)
				}
				if (lodLevel === 0 && (cell.terrain === 'water' || cell.terrain === 'ocean')) {
					visibleWaterCells.push(cell)
				}
			}
		}
	}

	// Sort ONLY the visible relief cells (hills, mountains, settlements) by Y back-to-front
	if (visibleReliefCells.length > 1) {
		visibleReliefCells.sort((a, b) => {
			const yA = a.row + (a.col % 2 !== 0 ? 0.5 : 0)
			const yB = b.row + (b.col % 2 !== 0 ? 0.5 : 0)
			return yA - yB || a.col - b.col
		})
	}

	const canUseCache = !skipStaticCache && typeof document !== 'undefined' && width > 0 && height > 0

	if (canUseCache) {
		const cacheParams = {
			mapData,
			viewportWidth: width,
			viewportHeight: height,
			cameraX,
			cameraY,
			zoom,
			logicalZoom,
			pixelScale,
			pitch,
			focalDistance,
			showBorders,
			factionsMap,
			drawCanvasBadges,
			discoveredLocations,
			useOrganic,
			lodLevel,
			hexBorderAlpha: HEX_BORDER_ALPHA,
			borderCasingAlpha: BORDER_CASING_ALPHA,
			borderCoreAlpha: BORDER_CORE_ALPHA,
			factionFillAlpha: FACTION_FILL_ALPHA
		}

		if (!isStaticCacheValid(cacheParams) || !_staticGroundCanvas || !_staticOverlayCanvas) {
			if (ensureStaticCanvases(width, height)) {
				// ── Render Layer 1: Static Ground Canvas ──
				_staticGroundCtx.clearRect(0, 0, width, height)
				if (_staticGroundCtx.imageSmoothingEnabled !== undefined) {
					_staticGroundCtx.imageSmoothingEnabled = false
				}
				drawAtmosphere(_staticGroundCtx, camera)
				drawBaseCellsBatched(_staticGroundCtx, camera, mapData, radius, 0, mapData.seed || 0, riverMap, {
					organic: useOrganic,
					lodLevel,
					screenRadius,
					visibleCells,
					skipWaterShimmer: true
				})

				// ── Render Layer 2: Static Overlay Canvas ──
				_staticOverlayCtx.clearRect(0, 0, width, height)
				if (_staticOverlayCtx.imageSmoothingEnabled !== undefined) {
					_staticOverlayCtx.imageSmoothingEnabled = false
				}
				if (showBorders) {
					drawPoliticalBorders(_staticOverlayCtx, camera, mapData, radius, factionsMap, riverMap, 1, {
						organic: useOrganic,
						lodLevel,
						screenRadius,
						visibleCells,
						vBounds
					})
				}
				if (lodLevel < 2) {
					for (const cell of visibleReliefCells) {
						if (cell.feature === 'hills') {
							drawHills(_staticOverlayCtx, camera, cell, radius)
						}
					}
				}
				const roadData = buildRoadRenderData(camera, mapData, radius, { lodLevel })
				renderRoads(_staticOverlayCtx, roadData)
				drawBridges(_staticOverlayCtx, camera, mapData, radius)
				if (showBorders) {
					drawPoliticalBorders(_staticOverlayCtx, camera, mapData, radius, factionsMap, riverMap, 2, {
						organic: useOrganic,
						lodLevel,
						screenRadius,
						visibleCells,
						vBounds
					})
				}
				for (const cell of visibleReliefCells) {
					if (cell.feature === 'mountain') {
						const mRad = cell.mountainRadius || 1
						if (isCellVisible(camera, cell.col, cell.row, radius, mRad * 2.8)) {
							drawMountain(_staticOverlayCtx, camera, cell, radius)
						}
					}
					if (cell.settlement) {
						const isDiscovered = !discoveredLocations || discoveredLocations.has(cell.settlement.id)
						drawSettlement(_staticOverlayCtx, camera, cell, radius, isDiscovered, drawCanvasBadges)
					}
				}

				_lastStaticParams = { ...cacheParams, staticVersion: _hexStaticVersion }
			}
		}

		ctx.save()
		if (ctx.imageSmoothingEnabled !== undefined) {
			ctx.imageSmoothingEnabled = false
		}

		// Composite Layer 1: Static Ground
		if (_staticGroundCanvas) {
			ctx.drawImage(_staticGroundCanvas, 0, 0)
		}

		// Dynamic Middle: Water pixel shimmer animation (LOD 0 only) & Rivers
		if (lodLevel === 0 && effectiveAnimTime > 0 && visibleWaterCells.length > 0) {
			drawWaterShimmerBatch(ctx, camera, visibleWaterCells, radius, effectiveAnimTime)
		}

		drawRivers(ctx, camera, mapData, radius, effectiveAnimTime, {
			organic: useOrganic,
			lodLevel,
			screenRadius
		})

		// Composite Layer 2: Static Overlay
		if (_staticOverlayCanvas) {
			ctx.drawImage(_staticOverlayCanvas, 0, 0)
		}

		// Interactive Highlights on top
		if (hoveredHex) {
			const hCell = mapData.cells?.[`${hoveredHex.col},${hoveredHex.row}`]
			drawHexHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, radius, '#38bdf8', 0.25, 2, hCell, mapData.seed || 0, riverMap, useOrganic)
		}
		if (selectedHex) {
			const sCell = mapData.cells?.[`${selectedHex.col},${selectedHex.row}`]
			drawHexHighlight(ctx, camera, selectedHex.col, selectedHex.row, radius, '#f6c445', 0.35, 3, sCell, mapData.seed || 0, riverMap, useOrganic)
		}
		if (activeTool === 'river' && hoveredHex && hoveredEdge) {
			drawEdgeHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, hoveredEdge.edge, radius, activeRiverWidth, mapData.seed || 0, useOrganic)
		}

		ctx.restore()
		return
	}

	// ── Direct un-cached fallback rendering (Node.js test environments or skipStaticCache) ──
	ctx.save()
	if (ctx.imageSmoothingEnabled !== undefined) {
		ctx.imageSmoothingEnabled = false
	}

	drawAtmosphere(ctx, camera)

	drawBaseCellsBatched(ctx, camera, mapData, radius, effectiveAnimTime, mapData.seed || 0, riverMap, {
		organic: useOrganic,
		lodLevel,
		screenRadius,
		visibleCells
	})

	drawRivers(ctx, camera, mapData, radius, effectiveAnimTime, {
		organic: useOrganic,
		lodLevel,
		screenRadius
	})

	if (showBorders) {
		drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap, riverMap, 1, {
			organic: useOrganic,
			lodLevel,
			screenRadius,
			visibleCells,
			vBounds
		})
	}

	if (lodLevel < 2) {
		for (const cell of visibleReliefCells) {
			if (cell.feature === 'hills') {
				drawHills(ctx, camera, cell, radius)
			}
		}
	}

	const roadData = buildRoadRenderData(camera, mapData, radius, { lodLevel })
	renderRoads(ctx, roadData)

	drawBridges(ctx, camera, mapData, radius)

	if (showBorders) {
		drawPoliticalBorders(ctx, camera, mapData, radius, factionsMap, riverMap, 2, {
			organic: useOrganic,
			lodLevel,
			screenRadius,
			visibleCells,
			vBounds
		})
	}

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

	if (hoveredHex) {
		const hCell = mapData.cells?.[`${hoveredHex.col},${hoveredHex.row}`]
		drawHexHighlight(ctx, camera, hoveredHex.col, hoveredHex.row, radius, '#38bdf8', 0.25, 2, hCell, mapData.seed || 0, riverMap, useOrganic)
	}
	if (selectedHex) {
		const sCell = mapData.cells?.[`${selectedHex.col},${selectedHex.row}`]
		drawHexHighlight(ctx, camera, selectedHex.col, selectedHex.row, radius, '#f6c445', 0.35, 3, sCell, mapData.seed || 0, riverMap, useOrganic)
	}

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
	const pixelScale = Math.max(1, Number(options.pixelScale ?? DEFAULT_PIXEL_SCALE) || 1)
	const screenRadius = options.screenRadius ?? (radius * camera.zoom * pixelScale)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : calculateLodLevel(screenRadius)

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
		// - LOD 1: Smoothly fade border alpha from HEX_BORDER_ALPHA down to 0 as screenRadius approaches strategic threshold
		// - LOD 2: Completely suppress cell border strokes (eliminates dark moiré grid)
		if (HEX_BORDER_ALPHA > 0.001) {
			if (lodLevel === 0) {
				traceGroupPath()
				ctx.lineWidth = Math.max(0.6, 1 * camera.zoom)
				ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', HEX_BORDER_ALPHA)
				ctx.stroke()
			} else if (lodLevel === 1) {
				const lodSpan = HEX_LOD_SCREEN_RADIUS_ORGANIC - HEX_LOD_SCREEN_RADIUS_STRATEGIC
				const fadeAlpha = HEX_BORDER_ALPHA * Math.max(0, Math.min(1, (screenRadius - HEX_LOD_SCREEN_RADIUS_STRATEGIC) / (lodSpan || 1)))
				if (fadeAlpha > 0.01) {
					traceGroupPath()
					ctx.lineWidth = Math.max(0.5, 0.8 * camera.zoom)
					ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', fadeAlpha)
					ctx.stroke()
				}
			}
		}

		// 3.4. Water shimmer animation for water/ocean (LOD 0 only)
		if (biome.isWater && lodLevel === 0 && !options.skipWaterShimmer) {
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
	const BLEED = HEX_TEXTURE_BLEED
	const drawSize = Math.max(boundW, boundH) * BLEED

	const CROP_PX = HEX_TEXTURE_CROP_PX
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

		if (HEX_BORDER_ALPHA > 0.001) {
			ctx.lineWidth = Math.max(0.6, 1 * camera.zoom)
			ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', HEX_BORDER_ALPHA)
			ctx.stroke()
		}

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
			const BLEED = HEX_TEXTURE_BLEED
			const drawSize = Math.max(boundW, boundH) * BLEED

			// PIXELATED LOOK: sample only a small crop of the texture (CROP_PX×CROP_PX texels)
			// and magnify it to fill the hex. With 2x canvas downscaling, 44 texels
			// map ~1:1 to canvas pixels, creating perfectly unified 2×2 retro screen pixels.
			const CROP_PX = HEX_TEXTURE_CROP_PX
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
	if (HEX_BORDER_ALPHA > 0.001) {
		traceOutlinePath()
		ctx.lineWidth = Math.max(0.6, 1 * avgScale)
		ctx.strokeStyle = hexToRgba(biome.edgeColor || '#000000', HEX_BORDER_ALPHA)
		ctx.stroke()
	}

	// 4. Water waves animation for water/ocean
	if (biome.isWater) {
		const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
		drawWaterShimmer(ctx, camera, center.x, center.y, radius, animTime, cell.terrain === 'ocean')
	}
}

// ── Pixel Art Water Shimmer & Wavelet Batching Engine ────────────────────────
// Reusable flat arrays (x, y, w, h) to eliminate per-frame garbage collection.
const _waterBatches = {
	coastHL: [],
	coastMid: [],
	coastShadow: [],
	oceanHL: [],
	oceanMid: [],
	oceanShadow: []
}

function clearWaterBatches() {
	_waterBatches.coastHL.length = 0
	_waterBatches.coastMid.length = 0
	_waterBatches.coastShadow.length = 0
	_waterBatches.oceanHL.length = 0
	_waterBatches.oceanMid.length = 0
	_waterBatches.oceanShadow.length = 0
}

/**
 * Normalized relative offsets for ripple spots inside a flat-topped hex.
 * Flat-topped hex inscribed radius is (sqrt(3)/2) * R ≈ 0.866 * R.
 * Offsets are kept safely within [-0.32 .. +0.32] * R so ripples never bleed into neighboring land hexes.
 */
const WATER_RIPPLE_SPOTS = [
	{ relX: -0.22, relY: -0.16, phaseOffset: 0.00 },
	{ relX: 0.18, relY: -0.06, phaseOffset: 0.36 },
	{ relX: -0.06, relY: 0.20, phaseOffset: 0.72 },
	{ relX: 0.20, relY: 0.16, phaseOffset: 0.18 },
	{ relX: -0.18, relY: 0.08, phaseOffset: 0.54 }
]

/**
 * Appends pixel art ripple rectangles for a single water hex cell to the batch buffers.
 */
function appendCellWaterRipples(camera, cx, cy, radius, animTime, isOcean, batches) {
	if (!WATER_CONFIG.enabled || animTime <= 0) return

	// Spatial hash for deterministic pseudo-random offsets per cell
	const cellSeed = ((Math.round(cx) * 73856093) ^ (Math.round(cy) * 19349663)) >>> 0
	const numSpots = Math.max(1, Math.min(WATER_RIPPLE_SPOTS.length, WATER_CONFIG.ripplesPerHex || 3))
	const cycleDuration = isOcean ? 3.4 : 2.6
	const animSpeed = WATER_CONFIG.speed || 1.0
	const basePx = WATER_CONFIG.pixelSize || 2.0
	const driftEnabled = WATER_CONFIG.drift ?? true

	const hlBatch = isOcean ? batches.oceanHL : batches.coastHL
	const midBatch = isOcean ? batches.oceanMid : batches.coastMid
	const shadowBatch = isOcean ? batches.oceanShadow : batches.coastShadow

	for (let s = 0; s < numSpots; s++) {
		const spot = WATER_RIPPLE_SPOTS[s]
		const spotSeed = (cellSeed ^ (s * 1013904223)) >>> 0

		// Local cell offset with subtle deterministic jitter
		const jitterX = (getHashFloat(spotSeed, 1) - 0.5) * 0.12 * radius
		const jitterY = (getHashFloat(spotSeed, 2) - 0.5) * 0.10 * radius
		const baseX = cx + spot.relX * radius + jitterX
		const baseY = cy + spot.relY * radius + jitterY

		// Periodic life cycle (active 62% of period, calm 38%)
		const spotPhase = (spot.phaseOffset + getHashFloat(spotSeed, 3) * 0.28) * cycleDuration
		const t = ((animTime * animSpeed + spotPhase) % cycleDuration) / cycleDuration
		if (t > 0.62) continue

		// Smooth bell curve intensity (0 -> 1 -> 0)
		const u = t / 0.62
		const intensity = Math.sin(u * Math.PI)
		if (intensity < 0.10) continue

		// Wind drift and gentle vertical bob on water surface
		const drift = driftEnabled ? (u - 0.5) * (isOcean ? 6.0 : 4.0) : 0
		const bob = Math.sin(animTime * 2.6 + getHashFloat(spotSeed, 4) * 6.28) * (0.9 * camera.cosT)

		const worldX = baseX + drift
		const worldY = baseY + bob

		const p = camera.project(worldX, worldY, 0)
		if (!p.visible) continue

		// Compute pixel block size scaled with camera perspective distance
		const px = Math.max(1, Math.round(basePx * Math.min(1.4, Math.max(0.65, p.scale))))
		const scrX = Math.round(p.x)
		const scrY = Math.round(p.y)

		if (intensity < 0.32) {
			// Early birth / late fade: subtle 2-3 pixel glint
			const glintW = (2 + Math.round(intensity * 3)) * px
			const glintX = scrX - Math.floor(glintW / 2)
			midBatch.push(glintX, scrY, glintW, px)
			const hlW = px
			hlBatch.push(scrX - Math.floor(hlW / 2), scrY - px, hlW, px)
		} else {
			// Full 3-tier stepped pixel wave crest with highlight, body, and shadow
			const bodyW = (4 + Math.round(intensity * 4)) * px
			const bodyX = scrX - Math.floor(bodyW / 2)
			midBatch.push(bodyX, scrY, bodyW, px)

			// Highlight crest on top (center-aligned)
			const hlW = Math.max(px, (1 + Math.round(intensity * 2)) * px)
			const hlX = scrX - Math.floor(hlW / 2)
			hlBatch.push(hlX, scrY - px, hlW, px)

			// Shadow trough directly underneath
			const shW = Math.max(px, (2 + Math.round(intensity * 3)) * px)
			const shX = scrX - Math.floor(shW / 2)
			shadowBatch.push(shX, scrY + px, shW, px)

			// Detached side sparkles at crest peak
			if (intensity > 0.68) {
				const tipOffset = Math.floor(bodyW / 2) + px
				midBatch.push(scrX - tipOffset - px, scrY, px, px)
				midBatch.push(scrX + tipOffset, scrY, px, px)
			}
		}
	}
}

/**
 * Flushes all queued pixel wave rectangles to the canvas using minimal state changes.
 */
function flushWaterBatches(ctx) {
	ctx.save()
	if (ctx.imageSmoothingEnabled !== undefined) {
		ctx.imageSmoothingEnabled = false
	}

	// 1. Coast Shadows
	if (_waterBatches.coastShadow.length > 0) {
		ctx.fillStyle = WATER_CONFIG.coast.shadow
		const arr = _waterBatches.coastShadow
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}
	// 2. Coast Midtone Body
	if (_waterBatches.coastMid.length > 0) {
		ctx.fillStyle = WATER_CONFIG.coast.mid
		const arr = _waterBatches.coastMid
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}
	// 3. Coast Sunlight Highlights / Crest
	if (_waterBatches.coastHL.length > 0) {
		ctx.fillStyle = WATER_CONFIG.coast.highlight
		const arr = _waterBatches.coastHL
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}

	// 4. Ocean Deep Shadows
	if (_waterBatches.oceanShadow.length > 0) {
		ctx.fillStyle = WATER_CONFIG.ocean.shadow
		const arr = _waterBatches.oceanShadow
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}
	// 5. Ocean Wave Body
	if (_waterBatches.oceanMid.length > 0) {
		ctx.fillStyle = WATER_CONFIG.ocean.mid
		const arr = _waterBatches.oceanMid
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}
	// 6. Ocean Crest Highlights
	if (_waterBatches.oceanHL.length > 0) {
		ctx.fillStyle = WATER_CONFIG.ocean.highlight
		const arr = _waterBatches.oceanHL
		for (let i = 0; i < arr.length; i += 4) {
			ctx.fillRect(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])
		}
	}

	ctx.restore()
}

/**
 * Batched rendering of animated pixel-art ripples across all visible water cells.
 */
export function drawWaterShimmerBatch(ctx, camera, visibleWaterCells, radius, animTime) {
	if (!WATER_CONFIG.enabled || animTime <= 0 || !visibleWaterCells || visibleWaterCells.length === 0) return
	clearWaterBatches()
	for (const cell of visibleWaterCells) {
		const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
		appendCellWaterRipples(camera, center.x, center.y, radius, animTime, cell.terrain === 'ocean', _waterBatches)
	}
	flushWaterBatches(ctx)
}

/**
 * Single-cell pixel shimmer rendering (used when drawing individual hexes without batching).
 */
export function drawWaterShimmer(ctx, camera, cx, cy, radius, animTime, isOcean) {
	if (!WATER_CONFIG.enabled || animTime <= 0) return
	clearWaterBatches()
	appendCellWaterRipples(camera, cx, cy, radius, animTime, isOcean, _waterBatches)
	flushWaterBatches(ctx)
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
	const pixelScale = Math.max(1, Number(options.pixelScale ?? DEFAULT_PIXEL_SCALE) || 1)
	const screenRadius = options.screenRadius ?? (radius * camera.zoom * pixelScale)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : calculateLodLevel(screenRadius)
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
			const fillColor = cell.fillColor || visuals.fillColor || hexToRgba(borderColor, FACTION_FILL_ALPHA)
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
			if (lodLevel === 0 && BORDER_CORE_ALPHA > 0.001) {
				ctx.strokeStyle = hexToRgba(color, Math.min(1, BORDER_CORE_ALPHA * 0.4))
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
			if (lodLevel < 2 && BORDER_CORE_ALPHA > 0.001) {
				ctx.strokeStyle = hexToRgba(color, Math.min(1, BORDER_CORE_ALPHA * 0.733))
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
			if (BORDER_CASING_ALPHA > 0.001) {
				ctx.strokeStyle = hexToRgba(color, BORDER_CASING_ALPHA)
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
 * Strokes a cubic Bezier curve with linearly tapering line width from w0 to w1.
 * Optimized with fast-path single Bezier stroke when w0 === w1.
 */
export function strokeTaperedCubicBezier(ctx, p0, cp1, cp2, p3, w0, w1, color, steps = 10) {
	if (Math.abs(w0 - w1) < 0.1) {
		ctx.beginPath()
		ctx.moveTo(p0.x, p0.y)
		ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p3.x, p3.y)
		ctx.lineWidth = Math.max(0.2, w0)
		ctx.strokeStyle = color
		ctx.stroke()
		return
	}

	let prevPt = p0
	for (let i = 0; i < steps; i++) {
		const tB = (i + 1) / steps
		const tMid = (i + 0.5) / steps
		const pB = getCubicBezierPoint(p0, cp1, cp2, p3, tB)
		const w = w0 + tMid * (w1 - w0)
		ctx.beginPath()
		ctx.moveTo(prevPt.x, prevPt.y)
		ctx.lineTo(pB.x, pB.y)
		ctx.lineWidth = Math.max(0.2, w)
		ctx.strokeStyle = color
		ctx.stroke()
		prevPt = pB
	}
}

/**
 * Strokes a straight line with linearly tapering line width from w0 to w1.
 * Optimized with fast-path single line stroke when w0 === w1.
 */
export function strokeTaperedLine(ctx, p0, p1, w0, w1, color, steps = 8) {
	if (Math.abs(w0 - w1) < 0.1) {
		ctx.beginPath()
		ctx.moveTo(p0.x, p0.y)
		ctx.lineTo(p1.x, p1.y)
		ctx.lineWidth = Math.max(0.2, w0)
		ctx.strokeStyle = color
		ctx.stroke()
		return
	}

	let prevPt = p0
	for (let i = 0; i < steps; i++) {
		const tB = (i + 1) / steps
		const tMid = (i + 0.5) / steps
		const pB = { x: p0.x + (p1.x - p0.x) * tB, y: p0.y + (p1.y - p0.y) * tB }
		const w = w0 + tMid * (w1 - w0)
		ctx.beginPath()
		ctx.moveTo(prevPt.x, prevPt.y)
		ctx.lineTo(pB.x, pB.y)
		ctx.lineWidth = Math.max(0.2, w)
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
 * Computes a point on a cubic Bezier curve at parameter t (0..1).
 */
function getCubicBezierPoint(p0, cp1, cp2, p1, t) {
	const mt = 1 - t
	const mt2 = mt * mt
	const t2 = t * t
	return {
		x: mt2 * mt * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t2 * t * p1.x,
		y: mt2 * mt * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t2 * t * p1.y
	}
}

/**
 * Computes normalized tangent and perpendicular normal vectors on a cubic Bezier curve at t.
 */
function getCubicBezierTangent(p0, cp1, cp2, p1, t) {
	const mt = 1 - t
	const dx = 3 * mt * mt * (cp1.x - p0.x) + 6 * mt * t * (cp2.x - cp1.x) + 3 * t * t * (p1.x - cp2.x)
	const dy = 3 * mt * mt * (cp1.y - p0.y) + 6 * mt * t * (cp2.y - cp1.y) + 3 * t * t * (p1.y - cp2.y)
	const len = Math.hypot(dx, dy) || 1
	const tx = dx / len
	const ty = dy / len
	return {
		tx,
		ty,
		nx: -ty,
		ny: tx
	}
}

/**
 * Subdivides a cubic Bezier curve into two sub-curves at parameter u (0..1) using de Casteljau's algorithm.
 */
function splitCubicBezier(p0, cp1, cp2, p3, u) {
	const p01 = { x: p0.x + (cp1.x - p0.x) * u, y: p0.y + (cp1.y - p0.y) * u }
	const p12 = { x: cp1.x + (cp2.x - cp1.x) * u, y: cp1.y + (cp2.y - cp1.y) * u }
	const p23 = { x: cp2.x + (p3.x - cp2.x) * u, y: cp2.y + (p3.y - cp2.y) * u }

	const p012 = { x: p01.x + (p12.x - p01.x) * u, y: p01.y + (p12.y - p01.y) * u }
	const p123 = { x: p12.x + (p23.x - p12.x) * u, y: p12.y + (p23.y - p12.y) * u }

	const p0123 = { x: p012.x + (p123.x - p012.x) * u, y: p012.y + (p123.y - p012.y) * u }

	return {
		left: { p0, cp1: p01, cp2: p012, p3: p0123 },
		right: { p0: p0123, cp1: p123, cp2: p23, p3 }
	}
}

/**
 * Checks whether a river edge endpoint touches an adjacent water body cell (sea, ocean, lake).
 *
 * @param {Object} river - { col, row, edge }
 * @param {boolean} isFrom - true for start vertex ('from'), false for end ('to')
 * @param {Object} mapData
 * @returns {{ touchesWater: boolean, waterCells: Array }}
 */
export function checkRiverVertexTouchesWater(river, isFrom, mapData) {
	if (!mapData?.cells || !river) return { touchesWater: false, waterCells: [] }
	const vIndices = getHexEdgeVertexIndices(river.edge)
	const vIdx = isFrom ? vIndices.from : vIndices.to
	const neighborCoords = getHexVertexNeighborCells(river.col, river.row, vIdx)
	const waterCells = []

	for (const nc of neighborCoords) {
		const cell = mapData.cells[`${nc.col},${nc.row}`]
		if (cell) {
			const b = BIOMES[cell.terrain]
			if (cell.terrain === 'water' || cell.terrain === 'ocean' || b?.isWater) {
				waterCells.push(cell)
			}
		}
	}

	return {
		touchesWater: waterCells.length > 0,
		waterCells
	}
}

/**
 * Calculates geometry for a river delta / estuary gently expanding into a water cell.
 * River connects at full width at the coastline vertex and flares into the water body,
 * merging with the exact same water color with zero pinching or early transparency.
 */
function buildRiverDeltaGeometry(pCenter, branch, radius, seed = 0) {
	const rObj = branch.river
	const scale = pCenter.scale || 1
	const isFrom = branch.isFrom
	const baseWidth = branch.baseWidth

	// Direction vector pointing OUTWARDS into open sea water
	let outUx, outUy
	if (isFrom) {
		const dx = rObj.pFrom.x - rObj.pCP1.x
		const dy = rObj.pFrom.y - rObj.pCP1.y
		const len = Math.hypot(dx, dy) || 1
		outUx = dx / len
		outUy = dy / len
	} else {
		const dx = rObj.pTo.x - rObj.pCP2.x
		const dy = rObj.pTo.y - rObj.pCP2.y
		const len = Math.hypot(dx, dy) || 1
		outUx = dx / len
		outUy = dy / len
	}

	const outNx = -outUy
	const outNy = outUx

	const flareMult = RIVER_CONFIG.delta.flareMultiplier || 1.5
	const deltaWidth = baseWidth * flareMult
	const reach = radius * (RIVER_CONFIG.delta.reachRatio || 0.28) * scale

	// Points at river mouth on the coast (matching exact river cross-section)
	const L0 = { x: pCenter.x + outNx * (baseWidth / 2), y: pCenter.y + outNy * (baseWidth / 2) }
	const R0 = { x: pCenter.x - outNx * (baseWidth / 2), y: pCenter.y - outNy * (baseWidth / 2) }

	// Points in the sea (estuary fan)
	const P_sea = { x: pCenter.x + outUx * reach, y: pCenter.y + outUy * reach }
	const L1 = { x: P_sea.x + outNx * (deltaWidth / 2), y: P_sea.y + outNy * (deltaWidth / 2) }
	const R1 = { x: P_sea.x - outNx * (deltaWidth / 2), y: P_sea.y - outNy * (deltaWidth / 2) }
	const Mid = { x: P_sea.x + outUx * (reach * 0.15), y: P_sea.y + outUy * (reach * 0.15) }

	return {
		pMouth: pCenter,
		branch,
		river: rObj,
		isFrom,
		outU: { x: outUx, y: outUy },
		outN: { x: outNx, y: outNy },
		L0,
		R0,
		L1,
		R1,
		Mid,
		P_sea,
		baseWidth,
		deltaWidth,
		reach,
		scale
	}
}

/**
 * Renders stylized pixel-art water currents flowing along rivers.
 * Draws square pixel cubes (px × px) instead of elongated stripes/dashes,
 * matching the retro pixel aesthetics of the hex map.
 * Fully configurable via RIVER_CONFIG (pixel size, speed, density, lanes, tones).
 */
function renderRiverPixelFlow(ctx, preparedRivers, riverTurns, riverDeltas, animTime, lodLevel, options = {}) {
	if (lodLevel >= 2) return // At strategic overview, skip flow animation for high FPS

	const flowCfg = RIVER_CONFIG.flow
	if (!flowCfg.enabled) return

	const basePx = Math.max(1.5, flowCfg.pixelSize || 2.5)
	const speed = flowCfg.speed || 18.0
	const density = Math.max(0.2, flowCfg.density || 1.0)
	const lightTone = flowCfg.lightTone || '#7dd3fc'
	const midTone = flowCfg.midTone || '#38bdf8'
	const darkTone = flowCfg.darkTone || '#0369a1'
	const foamTone = flowCfg.foamTone || '#ffffff'

	ctx.save()

	// 1. Rivers (cubic Bezier or straight lines)
	for (const r of preparedRivers) {
		const isStraight = options.isStraight || !r.pCP1
		const startX = r.startPt ? r.startPt.x : r.pFrom.x
		const startY = r.startPt ? r.startPt.y : r.pFrom.y
		const endX = r.endPt ? r.endPt.x : r.pTo.x
		const endY = r.endPt ? r.endPt.y : r.pTo.y

		const chordLen = Math.hypot(endX - startX, endY - startY)
		if (chordLen < 3) continue
		const approxLen = chordLen * (isStraight ? 1.0 : 1.15)
		const avgScale = r.avgScale || 1
		const px = Math.max(1.5, basePx * Math.min(1.4, Math.max(0.65, avgScale)))

		const stepDist = Math.max(6 * avgScale, (14 * avgScale) / density)
		const numSteps = Math.max(2, Math.round(approxLen / stepDist))

		const lanes = r.tier === 1 ? [0] : (r.tier === 2 ? [-0.24, 0.24] : [-0.30, 0, 0.30])
		const flowDir = r.flowDir || 1

		for (let lIdx = 0; lIdx < lanes.length; lIdx++) {
			const laneRatio = lanes[lIdx]
			const laneVel = laneRatio === 0 ? 1.05 : 0.95
			const lanePhaseOffset = lIdx * 0.33
			const animTravel = flowDir * (animTime * speed * avgScale * laneVel)

			for (let s = 0; s < numSteps; s++) {
				const rawPos = (s * stepDist + animTravel + lanePhaseOffset * approxLen) % approxLen
				const pos = rawPos < 0 ? rawPos + approxLen : rawPos
				const t = 0.08 + (pos / approxLen) * 0.84

				let pt, tan
				if (isStraight) {
					pt = { x: startX + (endX - startX) * t, y: startY + (endY - startY) * t }
					const dx = endX - startX
					const dy = endY - startY
					const dlen = Math.hypot(dx, dy) || 1
					tan = { tx: dx / dlen, ty: dy / dlen, nx: -dy / dlen, ny: dx / dlen }
				} else {
					pt = getCubicBezierPoint(r.startPt, r.pCP1, r.pCP2, r.endPt, t)
					tan = getCubicBezierTangent(r.startPt, r.pCP1, r.pCP2, r.endPt, t)
				}

				let widthFactor = 1.0
				let tipFade = 1.0
				if (r.isSource) {
					const flowProgress = r.sourceAtStart ? t : 1.0 - t
					widthFactor = Math.max(0.1, flowProgress)
					if (flowProgress < 0.25) {
						tipFade = Math.max(0, flowProgress / 0.25)
					}
				}

				const currentBaseWidth = r.baseWidth * widthFactor
				const fx = pt.x + tan.nx * (laneRatio * currentBaseWidth * 0.85)
				const fy = pt.y + tan.ny * (laneRatio * currentBaseWidth * 0.85)

				// Pixel-art coordinate snapping
				const snapX = Math.round(fx / px) * px
				const snapY = Math.round(fy / px) * px

				// Deterministic alternating tones (40% light, 30% dark, 20% mid, 10% foam crest)
				const toneKey = (s * 3 + lIdx * 7) % 10
				let tone = lightTone
				if (toneKey < 4) tone = lightTone
				else if (toneKey < 7) tone = darkTone
				else if (toneKey < 9) tone = midTone
				else tone = foamTone

				if (tipFade < 1.0) {
					ctx.globalAlpha = tipFade
				}
				ctx.fillStyle = tone
				// Square pixel cube (px × px)
				ctx.fillRect(snapX, snapY, px, px)
				if (tipFade < 1.0) {
					ctx.globalAlpha = 1.0
				}
			}
		}
	}

	// 2. Turns
	for (const turn of riverTurns) {
		const scale = turn.scale || 1
		const px = Math.max(1.5, basePx * Math.min(1.4, Math.max(0.65, scale)))
		const turnLen = Math.hypot(turn.A1.x - turn.A0.x, turn.A1.y - turn.A0.y)
		if (turnLen < 3) continue

		const numSteps = Math.max(1, Math.round(turnLen / (10 * scale)))
		const animTravel = (animTime * speed * scale) % turnLen

		for (let s = 0; s < numSteps; s++) {
			const rawPos = (s * 10 * scale + animTravel) % turnLen
			const t = 0.15 + (rawPos / turnLen) * 0.70
			const mt = 1 - t
			const fx = mt * mt * turn.A0.x + 2 * mt * t * turn.center.x + t * t * turn.A1.x
			const fy = mt * mt * turn.A0.y + 2 * mt * t * turn.center.y + t * t * turn.A1.y

			const snapX = Math.round(fx / px) * px
			const snapY = Math.round(fy / px) * px

			const toneKey = s % 3
			const tone = toneKey === 0 ? lightTone : (toneKey === 1 ? darkTone : midTone)

			ctx.fillStyle = tone
			ctx.fillRect(snapX, snapY, px, px)
		}
	}

	// 3. Deltas (fanning pixel cubes gently dissolving into the sea)
	for (const delta of riverDeltas) {
		const scale = delta.scale || 1
		const px = Math.max(1.5, basePx * Math.min(1.4, Math.max(0.65, scale)))
		const reachDist = Math.max(12 * scale, delta.reach || (20 * scale))
		const stepDist = Math.max(7 * scale, (14 * scale) / density)
		const numSteps = Math.max(2, Math.round(reachDist / stepDist))
		const lanes = [-0.32, 0, 0.32]
		const animDist = animTime * speed * scale

		for (let lIdx = 0; lIdx < lanes.length; lIdx++) {
			const spread = lanes[lIdx]
			const lanePhaseOffset = lIdx * 0.33 * reachDist

			for (let s = 0; s < numSteps; s++) {
				const rawDist = (s * stepDist + animDist + lanePhaseOffset) % reachDist
				const dist = rawDist < 0 ? rawDist + reachDist : rawDist
				const progress = dist / reachDist
				const deltaAlpha = Math.max(0, 1 - progress) * 0.8
				if (deltaAlpha <= 0.05) continue

				const fx =
					delta.pMouth.x +
					delta.outU.x * dist +
					delta.outN.x * (spread * delta.deltaWidth * (0.35 + progress * 0.65))
				const fy =
					delta.pMouth.y +
					delta.outU.y * dist +
					delta.outN.y * (spread * delta.deltaWidth * (0.35 + progress * 0.65))

				const snapX = Math.round(fx / px) * px
				const snapY = Math.round(fy / px) * px

				const toneKey = (s * 3 + lIdx * 7) % 10
				let tone = lightTone
				if (toneKey < 4) tone = lightTone
				else if (toneKey < 7) tone = darkTone
				else if (toneKey < 9) tone = midTone
				else tone = foamTone

				ctx.fillStyle = tone
				ctx.globalAlpha = deltaAlpha
				ctx.fillRect(snapX, snapY, px, px)
				ctx.globalAlpha = 1.0
			}
		}
	}

	ctx.restore()
}

/**
 * Analyzes the river network to identify source vertices (headwaters where incoming flow is 0).
 * Returns a Set of vertex keys that are river sources.
 */
export function getRiverSourceVertexKeys(rivers, radius, mapData, useOrganic) {
	const vertexFlow = new Map()

	function getVKey(pt) {
		return `${Math.round(pt.x * 10)},${Math.round(pt.y * 10)}`
	}

	for (const river of rivers) {
		const center = hexToWorldGroundCenter(river.col, river.row, radius)
		const groundVerts = useOrganic
			? getOrganicHexGroundVertices(center.x, center.y, radius, mapData?.seed || 0)
			: getHexGroundVertices(center.x, center.y, radius)
		const { from: gFrom, to: gTo } = getHexEdgeEndpoints(groundVerts, river.edge)
		const flowDir = river.flowDir === -1 ? -1 : 1

		const kFrom = getVKey(gFrom)
		const kTo = getVKey(gTo)

		let eFrom = vertexFlow.get(kFrom)
		if (!eFrom) {
			eFrom = { incoming: 0, outgoing: 0 }
			vertexFlow.set(kFrom, eFrom)
		}
		let eTo = vertexFlow.get(kTo)
		if (!eTo) {
			eTo = { incoming: 0, outgoing: 0 }
			vertexFlow.set(kTo, eTo)
		}

		if (flowDir === 1) {
			eFrom.outgoing++
			eTo.incoming++
		} else {
			eTo.outgoing++
			eFrom.incoming++
		}
	}

	const sourceKeys = new Set()
	for (const [key, vf] of vertexFlow.entries()) {
		if (vf.incoming === 0 && vf.outgoing > 0) {
			sourceKeys.add(key)
		}
	}
	return sourceKeys
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
	const pixelScale = Math.max(1, Number(options.pixelScale ?? DEFAULT_PIXEL_SCALE) || 1)
	const screenRadius = options.screenRadius ?? (radius * camera.zoom * pixelScale)
	const lodLevel = options.lodLevel !== undefined ? options.lodLevel : calculateLodLevel(screenRadius)

	const waterColor = RIVER_CONFIG.colors?.waterColor || BIOMES.water?.color || '#0284c7'
	const hasBorder = RIVER_CONFIG.colors?.hasBorder ?? false
	const borderColor = RIVER_CONFIG.colors?.borderColor || '#0369a1'

	function getVertexKey(pt) {
		return `${Math.round(pt.x * 10)},${Math.round(pt.y * 10)}`
	}

	const sourceVertexKeys = getRiverSourceVertexKeys(rivers, radius, mapData, useOrganic)

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
			let baseWidth, shoreExtra
			if (tier === 3) {
				baseWidth = Math.max(2.6, 6.2 * avgScale)
				shoreExtra = 1.8 * avgScale
			} else if (tier === 2) {
				baseWidth = Math.max(1.8, 3.6 * avgScale)
				shoreExtra = 1.4 * avgScale
			} else {
				baseWidth = Math.max(1.0, 1.9 * avgScale)
				shoreExtra = 1.0 * avgScale
			}
			const casingWidth = baseWidth + shoreExtra
			const flowDir = river.flowDir === -1 ? -1 : 1

			const keyFrom = getVertexKey(gFrom)
			const keyTo = getVertexKey(gTo)
			let isSource = false
			let sourceAtStart = false
			if (flowDir === 1 && sourceVertexKeys.has(keyFrom)) {
				isSource = true
				sourceAtStart = true
			} else if (flowDir === -1 && sourceVertexKeys.has(keyTo)) {
				isSource = true
				sourceAtStart = false
			}

			let wStart = baseWidth
			let wEnd = baseWidth
			let casingStart = casingWidth
			let casingEnd = casingWidth

			if (isSource) {
				if (sourceAtStart) {
					wStart = 0.2
					wEnd = baseWidth
					casingStart = 0.2
					casingEnd = casingWidth
				} else {
					wStart = baseWidth
					wEnd = 0.2
					casingStart = casingWidth
					casingEnd = 0.2
				}
			}

			preparedRivers.push({
				river,
				pFrom,
				pTo,
				startPt: pFrom,
				endPt: pTo,
				baseWidth,
				casingWidth,
				tier,
				avgScale,
				flowDir,
				isSource,
				sourceAtStart,
				wStart,
				wEnd,
				casingStart,
				casingEnd
			})
		}

		if (preparedRivers.length === 0) return

		ctx.save()
		ctx.lineCap = 'round'
		ctx.lineJoin = 'round'

		// PASS 1: Riverbed Shore Strokes (if enabled)
		if (hasBorder) {
			ctx.strokeStyle = borderColor
			for (const r of preparedRivers) {
				strokeTaperedLine(ctx, r.startPt, r.endPt, r.casingStart, r.casingEnd, borderColor)
			}
		}

		// PASS 2: Water Core (same color as coast water #0284c7)
		ctx.strokeStyle = waterColor
		for (const r of preparedRivers) {
			strokeTaperedLine(ctx, r.startPt, r.endPt, r.wStart, r.wEnd, waterColor)
		}

		// PASS 3: Pixel-Art Animated Flow (LOD 0 and LOD 1 only, skipped at LOD 2)
		if (lodLevel < 2) {
			renderRiverPixelFlow(ctx, preparedRivers, [], [], animTime, lodLevel, { isStraight: true })
		}

		ctx.restore()
		return
	}

	ctx.save()

	const preparedRivers = []
	const vertexBranches = new Map()

	for (const river of rivers) {
		// ── Cheap early-out: skip entirely if hex is outside frustum ──────────
		if (!isCellVisible(camera, river.col, river.row, radius, 1.5)) continue

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
		if (tier === 3) {
			baseWidth = Math.max(2.6, 6.2 * avgScale)
			shoreExtra = 1.8 * avgScale
		} else if (tier === 2) {
			baseWidth = Math.max(1.8, 3.6 * avgScale)
			shoreExtra = 1.4 * avgScale
		} else {
			// Tier 1: fine mountain creek/brook
			baseWidth = Math.max(1.0, 1.9 * avgScale)
			shoreExtra = 1.0 * avgScale
		}
		const casingWidth = baseWidth + shoreExtra
		const flowDir = river.flowDir === -1 ? -1 : 1

		const keyFrom = getVertexKey(gFrom)
		const keyTo = getVertexKey(gTo)
		let isSource = false
		let sourceAtStart = false
		if (flowDir === 1 && sourceVertexKeys.has(keyFrom)) {
			isSource = true
			sourceAtStart = true
		} else if (flowDir === -1 && sourceVertexKeys.has(keyTo)) {
			isSource = true
			sourceAtStart = false
		}

		let wStart = baseWidth
		let wEnd = baseWidth
		let casingStart = casingWidth
		let casingEnd = casingWidth

		if (isSource) {
			if (sourceAtStart) {
				wStart = 0.2
				wEnd = baseWidth
				casingStart = 0.2
				casingEnd = casingWidth
			} else {
				wStart = baseWidth
				wEnd = 0.2
				casingStart = casingWidth
				casingEnd = 0.2
			}
		}

		const rObj = {
			river,
			pFrom,
			pCP1,
			pCP2,
			pTo,
			startPt: pFrom,
			endPt: pTo,
			casingWidth,
			baseWidth,
			tier,
			avgScale,
			flowDir,
			gFrom,
			gTo,
			isSource,
			sourceAtStart,
			wStart,
			wEnd,
			casingStart,
			casingEnd
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
			tier,
			flowDir
		})

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
			tier,
			flowDir
		})
	}

	// Calculate rounded turn fillets (2 branches), confluence fillets (3+ branches), and deltas (1 branch touching water)
	const riverTurns = []
	const riverConfluences = []
	const riverDeltas = []

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
				scale: vData.pCenter.scale
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
		} else if (k === 1) {
			const b0 = vData.branches[0]
			const isFlowingIntoVertex = (b0.isFrom && b0.flowDir === -1) || (!b0.isFrom && b0.flowDir !== -1)
			if (isFlowingIntoVertex) {
				const waterContact = checkRiverVertexTouchesWater(b0.river.river, b0.isFrom, mapData)
				if (waterContact.touchesWater && RIVER_CONFIG.delta.enabled) {
					const delta = buildRiverDeltaGeometry(vData.pCenter, b0, radius, mapData?.seed || 0)
					if (delta) {
						riverDeltas.push(delta)
					}
				}
			}
		}
	}

	ctx.lineCap = 'round'
	ctx.lineJoin = 'round'

	// --- PASS 1: Riverbed Shore Strokes (only if hasBorder is enabled) ---
	if (hasBorder) {
		for (const r of preparedRivers) {
			strokeTaperedCubicBezier(ctx, r.startPt, r.pCP1, r.pCP2, r.endPt, r.casingStart, r.casingEnd, borderColor)
		}

		for (const turn of riverTurns) {
			strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.casingWidth, turn.b1.casingWidth, borderColor, borderColor, 4)
		}

		for (const conf of riverConfluences) {
			for (const f of conf.fillets) {
				strokeTaperedCurve(ctx, f.PA, conf.center, f.PB, f.bA.casingWidth, f.bB.casingWidth, borderColor, borderColor, 3)
			}
		}
	}

	// --- PASS 2: Main River Water Ribbon, Width-Tapered Turn Fillets, Confluence Pools, and Deltas ---
	// All rendered with pure waterColor (#0284c7) matching the coast water tile
	ctx.strokeStyle = waterColor
	for (const r of preparedRivers) {
		strokeTaperedCubicBezier(ctx, r.startPt, r.pCP1, r.pCP2, r.endPt, r.wStart, r.wEnd, waterColor)
	}

	for (const turn of riverTurns) {
		strokeTaperedCurve(ctx, turn.A0, turn.center, turn.A1, turn.b0.baseWidth, turn.b1.baseWidth, waterColor, waterColor, 4)
	}

	for (const conf of riverConfluences) {
		for (const f of conf.fillets) {
			strokeTaperedCurve(ctx, f.PA, conf.center, f.PB, f.bA.baseWidth, f.bB.baseWidth, waterColor, waterColor, 3)
		}
	}

	// Deltas: gentle expansion into the water tile, seamlessly matching the coast water (#0284c7)
	for (const delta of riverDeltas) {
		ctx.beginPath()
		ctx.moveTo(delta.L0.x, delta.L0.y)
		ctx.lineTo(delta.L1.x, delta.L1.y)
		ctx.quadraticCurveTo(delta.Mid.x, delta.Mid.y, delta.R1.x, delta.R1.y)
		ctx.lineTo(delta.R0.x, delta.R0.y)
		ctx.closePath()

		ctx.fillStyle = waterColor
		ctx.fill()
	}

	// --- PASS 3: Pixel-Art Animated Flow (Square pixel cubes) ---
	renderRiverPixelFlow(ctx, preparedRivers, riverTurns, riverDeltas, animTime, lodLevel)

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

				// ── Cheap early-out before expensive geometry ─────────────────
				if (!isCellVisible(camera, c1.col, c1.row, radius, 2.0) &&
					!isCellVisible(camera, c2.col, c2.row, radius, 2.0)) break

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

	if (sc < 0.42) {
		// Zoomed out (LOD 1 / LOD 2): fast single-peak low-poly mountain
		const h = (38 + (mRadius - 1) * 16) * sc
		const w = radius * (0.75 + (mRadius - 1) * 0.18) * sc
		const peakY = drawY - h
		const baseY = drawY + 1 * sc * camera.cosT

		ctx.save()
		// Simple footprint shadow
		ctx.beginPath()
		ctx.ellipse(cx, baseY, w * 1.05, w * 0.22 * Math.max(0.3, camera.cosT), 0, 0, Math.PI * 2)
		ctx.fillStyle = 'rgba(15, 23, 42, 0.35)'
		ctx.fill()

		// Left lit rock face
		ctx.beginPath()
		ctx.moveTo(cx, peakY)
		ctx.lineTo(cx - w, baseY)
		ctx.lineTo(cx, baseY)
		ctx.closePath()
		ctx.fillStyle = '#94a3b8'
		ctx.fill()

		// Right shaded rock face
		ctx.beginPath()
		ctx.moveTo(cx, peakY)
		ctx.lineTo(cx, baseY)
		ctx.lineTo(cx + w, baseY)
		ctx.closePath()
		ctx.fillStyle = '#475569'
		ctx.fill()

		// Snow cap (top 35%)
		const snowH = h * 0.35
		const snowW = w * 0.35
		ctx.beginPath()
		ctx.moveTo(cx, peakY)
		ctx.lineTo(cx - snowW, peakY + snowH)
		ctx.lineTo(cx, peakY + snowH * 1.08)
		ctx.closePath()
		ctx.fillStyle = '#ffffff'
		ctx.fill()

		ctx.beginPath()
		ctx.moveTo(cx, peakY)
		ctx.lineTo(cx, peakY + snowH * 1.08)
		ctx.lineTo(cx + snowW, peakY + snowH)
		ctx.closePath()
		ctx.fillStyle = '#e2e8f0'
		ctx.fill()

		ctx.restore()
		return
	}

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

	if (sc < 0.42) {
		// Zoomed out (LOD 1 / LOD 2): fast compact settlement icon
		ctx.save()
		// Small footprint shadow
		ctx.beginPath()
		ctx.ellipse(cx, drawY + 1 * sc * camera.cosT, radius * 0.35 * sc, radius * 0.16 * sc * camera.cosT, 0, 0, Math.PI * 2)
		ctx.fillStyle = 'rgba(15, 23, 42, 0.40)'
		ctx.fill()

		const iconColor = isDiscovered ? typeDef.color : '#94a3b8'
		const iconR = Math.max(3, 8 * sc)
		const iconH = Math.max(4, 12 * sc)

		if (settlement.type === 'camp') {
			ctx.beginPath()
			ctx.moveTo(cx, drawY - iconH)
			ctx.lineTo(cx - iconR, drawY)
			ctx.lineTo(cx + iconR, drawY)
			ctx.closePath()
			ctx.fillStyle = iconColor
			ctx.fill()
			ctx.strokeStyle = '#451a03'
			ctx.lineWidth = 0.8
			ctx.stroke()
		} else if (settlement.type === 'village') {
			const houseW = iconR * 1.6
			const houseH = iconH
			const roofH = houseH * 0.5
			ctx.fillStyle = '#78350f'
			ctx.fillRect(cx - houseW / 2, drawY - roofH, houseW, roofH)
			ctx.beginPath()
			ctx.moveTo(cx, drawY - houseH)
			ctx.lineTo(cx - houseW / 2 - 1, drawY - roofH)
			ctx.lineTo(cx + houseW / 2 + 1, drawY - roofH)
			ctx.closePath()
			ctx.fillStyle = iconColor
			ctx.fill()
		} else {
			const towW = iconR * 1.4
			const towH = iconH * 1.2
			ctx.fillStyle = '#334155'
			ctx.fillRect(cx - towW / 2, drawY - towH, towW, towH)
			ctx.fillStyle = iconColor
			ctx.fillRect(cx - towW / 2, drawY - towH, towW, 3 * sc)
			ctx.strokeStyle = '#0f172a'
			ctx.lineWidth = 0.8
			ctx.strokeRect(cx - towW / 2, drawY - towH, towW, towH)
		}

		ctx.restore()
		return
	}

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
