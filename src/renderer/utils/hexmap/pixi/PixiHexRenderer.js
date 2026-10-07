/**
 * PixiJS v8 Hexagonal Map Hardware WebGL Renderer
 *
 * Implements GPU-accelerated rendering for the hex world canvas:
 * - GLSL Water Ripple & Caustics Shader: Real-time procedural wave distortion on oceans and rivers.
 * - GLSL Lighting Shader: Day/night color grading and dynamic torch flicker.
 * - GLSL Fog of War: Hardware visibility masking for unexplored regions.
 * - GPU Sprite Batching: Draws thousands of 2.5D mountains, hills, forests, and settlements in 1 draw call.
 * - 3D Perspective Projection: Matches HexPerspectiveCamera geometry identically with HTML HUD badges.
 */
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import {
	HexPerspectiveCamera,
	hexToWorldGroundCenter,
	getHexGroundVertices,
	getVisibleHexGridBounds,
	getHexEdgeEndpoints
} from '../hexCoords.js'
import { BIOMES, getFactionVisuals } from '../hexLoader.js'
import { WaterRippleFilter, LightingFilter, FogOfWarFilter } from '../../pixi/filters/index.js'
import { PixiHexTextureManager } from './PixiHexTextureManager.js'

export class PixiHexRenderer {
	constructor() {
		this.app = null
		this.isInitialized = false
		this.textureManager = new PixiHexTextureManager()

		// Scene Graph
		this.stage = null
		this.worldContainer = new Container()
		this.groundGfx = new Graphics()
		this.waterLayer = new Container()
		this.waterGfx = new Graphics()
		this.coastGfx = new Graphics()
		this.bordersGfx = new Graphics()
		this.riversGfx = new Graphics()
		this.roadsGfx = new Graphics()
		this.featuresLayer = new Container()
		this.featuresLayer.sortableChildren = true
		this.highlightsGfx = new Graphics()

		// Hardware GLSL Filters
		this.waterFilter = new WaterRippleFilter({ speed: 1.4, frequency: 32.0, amplitude: 0.005 })
		this.lightingFilter = new LightingFilter()
		this.fogFilter = new FogOfWarFilter()

		this.waterLayer.filters = [this.waterFilter]
		this.worldContainer.filters = [this.lightingFilter, this.fogFilter]

		// Sprite pooling for mountain/hill/settlement billboards
		this.spritePool = []
		this.activeSprites = []

		this.lastCameraKey = ''
	}

	/**
	 * Initializes PixiJS on the canvas element.
	 * @param {HTMLCanvasElement} canvasElement
	 * @param {number} width
	 * @param {number} height
	 */
	async init(canvasElement, width, height) {
		if (this.isInitialized) return

		this.app = new Application()
		await this.app.init({
			canvas: canvasElement,
			width: width || 960,
			height: height || 540,
			autoDensity: true,
			antialias: false,
			background: '#090d16',
			resolution: window.devicePixelRatio || 1
		})

		this.stage = this.app.stage

		// Assemble layer graph
		this.waterLayer.addChild(this.waterGfx)

		this.worldContainer.addChild(this.groundGfx)
		this.worldContainer.addChild(this.waterLayer)
		this.worldContainer.addChild(this.coastGfx)
		this.worldContainer.addChild(this.bordersGfx)
		this.worldContainer.addChild(this.riversGfx)
		this.worldContainer.addChild(this.roadsGfx)
		this.worldContainer.addChild(this.featuresLayer)
		this.worldContainer.addChild(this.highlightsGfx)

		this.stage.addChild(this.worldContainer)
		this.isInitialized = true
	}

	/**
	 * Acquires a reusable Sprite from the pool.
	 * @private
	 * @returns {Sprite}
	 */
	_acquireSprite() {
		if (this.spritePool.length > 0) {
			const s = this.spritePool.pop()
			s.visible = true
			return s
		}
		const s = new Sprite()
		this.featuresLayer.addChild(s)
		return s
	}

	/**
	 * Releases all active sprites back to the pool.
	 * @private
	 */
	_recycleSprites() {
		for (let i = 0; i < this.activeSprites.length; i++) {
			const s = this.activeSprites[i]
			s.visible = false
			this.spritePool.push(s)
		}
		this.activeSprites.length = 0
	}

	/**
	 * Projects 6 hex ground vertices to screen space coordinates.
	 * @private
	 * @param {HexPerspectiveCamera} camera
	 * @param {number} col
	 * @param {number} row
	 * @param {number} radius
	 * @returns {Array<number>|null} [x0, y0, x1, y1, ...] or null if culled
	 */
	_projectHexPolygon(camera, col, row, radius) {
		const verts = getHexGroundVertices(col, row, radius)
		const poly = []
		let anyVisible = false

		for (let i = 0; i < verts.length; i++) {
			const p = camera.projectTerrain(verts[i].x, verts[i].y, 0)
			if (p.visible && p.distZ > 50) {
				anyVisible = true
			}
			poly.push(p.x, p.y)
		}

		return anyVisible ? poly : null
	}

	/**
	 * Executes a complete hardware-accelerated render frame.
	 * @param {Object} mapData
	 * @param {Object} options
	 */
	renderFrame(mapData, options = {}) {
		if (!this.isInitialized || !mapData || !this.app) return

		const {
			cameraX = 0,
			cameraY = 0,
			zoom = 1.0,
			pitch = 45,
			focalDistance = 900,
			hoveredHex = null,
			selectedHex = null,
			hoveredEdge = null,
			activeTool = null,
			showBorders = true,
			factionsMap = null,
			animTime = 0,
			timeOfDay = 'day',
			discoveredLocations = null
		} = options

		const width = this.app.renderer.width
		const height = this.app.renderer.height
		const radius = mapData.hexRadius || 36

		// Update GLSL shader uniforms
		this.waterFilter.time = animTime
		this.lightingFilter.time = animTime
		this.lightingFilter.setTimeOfDay(timeOfDay)

		const camera = new HexPerspectiveCamera({
			viewportWidth: width,
			viewportHeight: height,
			cameraX,
			cameraY,
			zoom,
			pitch,
			focalDistance
		})

		// Culling visible cells
		const mapBounds = mapData.bounds || {
			minCol: 0,
			maxCol: (mapData.cols || 20) - 1,
			minRow: 0,
			maxRow: (mapData.rows || 15) - 1
		}
		const vBounds = getVisibleHexGridBounds(camera, radius, mapBounds)
		const cellsMap = mapData.cells || {}

		const visibleCells = []
		const visibleWaterCells = []
		const visibleReliefCells = []

		for (let c = vBounds.minCol; c <= vBounds.maxCol; c++) {
			for (let r = vBounds.minRow; r <= vBounds.maxRow; r++) {
				const cell = cellsMap[`${c},${r}`]
				if (cell) {
					visibleCells.push(cell)
					if (cell.terrain === 'water' || cell.terrain === 'ocean') {
						visibleWaterCells.push(cell)
					}
					if (cell.feature === 'mountain' || cell.feature === 'hills' || cell.settlement) {
						visibleReliefCells.push(cell)
					}
				}
			}
		}

		// 1. Render Base Ground Biomes & 2. Water Layer (GLSL Ripple Shader)
		this.groundGfx.clear()
		this.waterGfx.clear()

		for (let i = 0; i < visibleCells.length; i++) {
			const cell = visibleCells[i]
			const poly = this._projectHexPolygon(camera, cell.col, cell.row, radius)
			if (!poly) continue

			const isWater = cell.terrain === 'water' || cell.terrain === 'ocean'
			const biomeDef = BIOMES[cell.terrain] || BIOMES.grass

			if (isWater) {
				const waterColor = cell.terrain === 'ocean' ? '#0f4c81' : '#1e6091'
				this.waterGfx.poly(poly)
				this.waterGfx.fill(waterColor)
			} else {
				this.groundGfx.poly(poly)
				this.groundGfx.fill(biomeDef.color || '#4c7c38')
			}
		}

		// 3. Render Political Borders & Faction Fills
		this.bordersGfx.clear()
		if (showBorders && factionsMap) {
			for (let i = 0; i < visibleCells.length; i++) {
				const cell = visibleCells[i]
				const fId = cell.faction || cell.fraction
				if (!fId) continue

				const fVisuals = getFactionVisuals(fId, factionsMap)
				if (fVisuals && fVisuals.color) {
					const poly = this._projectHexPolygon(camera, cell.col, cell.row, radius)
					if (poly) {
						this.bordersGfx.poly(poly)
						this.bordersGfx.fill({ color: fVisuals.color, alpha: 0.16 })
						this.bordersGfx.stroke({ color: fVisuals.borderColor || fVisuals.color, width: 2, alpha: 0.75 })
					}
				}
			}
		}

		// 4. Render Rivers
		this.riversGfx.clear()
		if (mapData.rivers) {
			for (const r of Object.values(mapData.rivers)) {
				const endpoints = getHexEdgeEndpoints(r.col, r.row, r.edge, radius)
				if (!endpoints) continue

				const p1 = camera.projectTerrain(endpoints.x1, endpoints.y1, 0)
				const p2 = camera.projectTerrain(endpoints.x2, endpoints.y2, 0)

				if (p1.visible && p2.visible) {
					const rWidth = Math.max(2, (r.width || 1) * 3 * p1.scale)
					this.riversGfx.moveTo(p1.x, p1.y)
					this.riversGfx.lineTo(p2.x, p2.y)
					this.riversGfx.stroke({ color: '#38bdf8', width: rWidth, cap: 'round' })
				}
			}
		}

		// 5. Render GPU Batched Features (Mountains, Hills, Settlements)
		this._recycleSprites()

		// Sort back-to-front by projected screen Y
		visibleReliefCells.sort((a, b) => {
			const centerA = hexToWorldGroundCenter(a.col, a.row, radius)
			const centerB = hexToWorldGroundCenter(b.col, b.row, radius)
			return centerA.y - centerB.y
		})

		for (let i = 0; i < visibleReliefCells.length; i++) {
			const cell = visibleReliefCells[i]
			const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
			const p = camera.projectTerrain(center.x, center.y, 0)
			if (!p.visible || p.distZ <= 80) continue

			const sc = p.scale * (radius / 36)

			// Mountain Billboard
			if (cell.feature === 'mountain') {
				const tex = this.textureManager.getMountainTexture(cell.mountainRadius || 1)
				if (tex) {
					const s = this._acquireSprite()
					s.texture = tex
					s.anchor.set(0.5, 0.88)
					s.position.set(p.x, p.y + radius * 0.15 * p.scale)
					s.scale.set(sc * 0.95)
					s.zIndex = p.y
					this.activeSprites.push(s)
				}
			} else if (cell.feature === 'hills') {
				// Hills Billboard
				const tex = this.textureManager.getHillsTexture()
				if (tex) {
					const s = this._acquireSprite()
					s.texture = tex
					s.anchor.set(0.5, 0.85)
					s.position.set(p.x, p.y)
					s.scale.set(sc * 0.85)
					s.zIndex = p.y
					this.activeSprites.push(s)
				}
			}

			// Settlement Billboard
			if (cell.settlement) {
				const isDiscovered = !discoveredLocations || discoveredLocations.has(cell.settlement.id)
				const sType = cell.settlement.type || 'village'
				const tex = this.textureManager.getSettlementTexture(sType)
				if (tex) {
					const s = this._acquireSprite()
					s.texture = tex
					s.anchor.set(0.5, 0.86)
					s.position.set(p.x, p.y + radius * 0.22 * p.scale)
					s.scale.set(sc * 0.80)
					s.alpha = isDiscovered ? 1.0 : 0.4
					s.zIndex = p.y + 10
					this.activeSprites.push(s)
				}
			}
		}

		// 6. Interactive Highlights Layer (Hover and Selected Hex)
		this.highlightsGfx.clear()

		if (selectedHex) {
			const sPoly = this._projectHexPolygon(camera, selectedHex.col, selectedHex.row, radius)
			if (sPoly) {
				this.highlightsGfx.poly(sPoly)
				this.highlightsGfx.fill({ color: '#f6c445', alpha: 0.32 })
				this.highlightsGfx.stroke({ color: '#f6c445', width: 3, alpha: 0.95 })
			}
		}

		if (hoveredHex) {
			const hPoly = this._projectHexPolygon(camera, hoveredHex.col, hoveredHex.row, radius)
			if (hPoly) {
				this.highlightsGfx.poly(hPoly)
				this.highlightsGfx.fill({ color: '#38bdf8', alpha: 0.25 })
				this.highlightsGfx.stroke({ color: '#38bdf8', width: 2.5, alpha: 0.9 })
			}
		}

		// River Brush Edge Highlight
		if (activeTool === 'river' && hoveredHex && hoveredEdge) {
			const endpoints = getHexEdgeEndpoints(hoveredHex.col, hoveredHex.row, hoveredEdge, radius)
			if (endpoints) {
				const ep1 = camera.projectTerrain(endpoints.x1, endpoints.y1, 0)
				const ep2 = camera.projectTerrain(endpoints.x2, endpoints.y2, 0)
				if (ep1.visible && ep2.visible) {
					this.highlightsGfx.moveTo(ep1.x, ep1.y)
					this.highlightsGfx.lineTo(ep2.x, ep2.y)
					this.highlightsGfx.stroke({ color: '#38bdf8', width: 4.5, cap: 'round' })
				}
			}
		}

		// 7. Update Torch / Vision Center on dynamic lighting & fog
		if (selectedHex) {
			const center = hexToWorldGroundCenter(selectedHex.col, selectedHex.row, radius)
			const sp = camera.projectTerrain(center.x, center.y, 0)
			if (sp.visible && width > 0 && height > 0) {
				const nx = sp.x / width
				const ny = sp.y / height
				this.lightingFilter.setLight(nx, ny, 0.28, 1.35)
				this.fogFilter.setPlayerVision(nx, ny, 0.24, 0.42)
			}
		} else {
			// Center of screen light default
			this.lightingFilter.setLight(0.5, 0.5, 0.40, 1.0)
			this.fogFilter.setPlayerVision(0.5, 0.5, 0.40, 0.65)
		}
	}

	/**
	 * Resizes the renderer canvas.
	 * @param {number} width
	 * @param {number} height
	 */
	resize(width, height) {
		if (!this.app || !this.app.renderer) return
		this.app.renderer.resize(width, height)
	}

	/**
	 * Cleans up PixiJS resources and textures.
	 */
	destroy() {
		this._recycleSprites()
		if (this.textureManager) {
			this.textureManager.clear()
		}
		if (this.app) {
			try {
				this.app.destroy(true, { children: true, texture: false })
			} catch (e) {
				console.warn('[PixiHexRenderer] destroy error:', e)
			}
			this.app = null
		}
		this.isInitialized = false
	}
}
