<template>
	<div
		ref="containerRef"
		class="iso-canvas-container"
		:class="{
			'__is-painting-brush': mode === 'editor' && ['tile', 'elevation', 'eraser'].includes(editorTool) && !isSpacePressed,
			'__is-panning-active': camera.isDragging,
			'__is-space-pressed': isSpacePressed
		}"
		@mouseenter="updateContainerPosition"
		@mousedown="onMouseDown"
		@mousemove="onMouseMove"
		@mouseup="onMouseUp"
		@mouseleave="onMouseLeave"
		@contextmenu.prevent="onContextMenu"
		@wheel.passive="onWheel"
	>
		<canvas ref="canvasRef" class="iso-canvas" />

		<!-- Floating Action Prompt when near interactive object or door -->
		<div
			v-if="actionTooltip"
			class="iso-action-tooltip"
			:style="{
				left: tooltipPos.x + 'px',
				top: tooltipPos.y + 'px'
			}"
		>
			<span class="tooltip-icon">{{ actionTooltip.icon }}</span>
			<span class="tooltip-text">{{ actionTooltip.text }}</span>
		</div>

		<!-- Context menu for interactive object -->
		<div
			v-if="activeContextMenu"
			class="iso-context-menu"
			:style="{
				left: activeContextMenu.x + 'px',
				top: activeContextMenu.y + 'px'
			}"
			@mousedown.stop
			@mouseup.stop
			@click.stop
		>
			<div class="iso-menu-header">
				<span class="iso-menu-icon">{{ (activeContextMenu.object.action === 'weed' || activeContextMenu.object.type === 'weed') ? '🌿' : '📦' }}</span>
				<span class="iso-menu-title">{{ activeContextMenu.object.name || (activeContextMenu.object.type === 'weed' ? 'Сорняк' : 'Объект') }}</span>
			</div>
			<div class="iso-menu-actions">
				<button class="iso-menu-btn iso-menu-btn-primary" @click="handleContextMenuAction(activeContextMenu.object)">
					{{ (activeContextMenu.object.action === 'weed' || activeContextMenu.object.type === 'weed') ? 'Собрать' : 'Взаимодействовать' }}
				</button>
				<button class="iso-menu-btn iso-menu-btn-cancel" @click="closeContextMenu">
					Отмена
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import {
	gridToScreen,
	getTilePolygon,
	getWallPolygon,
	getObjectScreenPos,
	DEFAULT_WALL_HEIGHT,
	pickTileAtScreen,
	isAdjacent,
	manhattanDistance,
	getDepthSortKey,
	pickGridCellAtScreen,
	getBrushOffsets,
	getBrushGridCells,
	getIsoWorldExtremes,
	calculateCameraClamping
} from '@/utils/isometric/isoCoords'
import { findPath, getReachableTiles } from '@/utils/isometric/isoPathfinding'
import {
	resolveCharacterSprite,
	resolveTileSprite,
	resolveWallSprite,
	onSpriteLoaded
} from '@/utils/isometric/isoSprites'
import { drawIsometricFacingIndicator } from '@/utils/isometric/isoFacing'

const props = defineProps({
	locationData: { type: Object, required: true },
	showGrid: { type: Boolean, default: true },
	showCoords: { type: Boolean, default: false },
	showHeights: { type: Boolean, default: false },
	movementRange: { type: Number, default: 4 },
	movementMode: { type: String, default: 'free' }, // 'free' | 'turn-based'
	tacticalConfig: {
		type: Object,
		default: () => ({ maxMp: 5, maxAp: 2 })
	},
	mode: { type: String, default: 'play' }, // 'play' | 'editor'
	editorTool: { type: String, default: 'select' },
	brushSize: { type: Number, default: 1 },
	brushShape: { type: String, default: 'square' }, // 'square' | 'round'
	showPlayer: { type: Boolean, default: true },
	showCenterMarker: { type: Boolean, default: true },
	selectedTile: { type: Object, default: null },
	initialCenter: { type: String, default: 'zero' }, // 'zero' | 'player'
	characterId: { type: String, default: 'mc' }
})

const DEFAULT_ZOOM = 1.5

const emit = defineEmits([
	'weed-cleared',
	'player-moved',
	'quest-completed',
	'tile-clicked',
	'object-interacted',
	'editor-tile-click',
	'editor-tile-right-click',
	'editor-brush-apply',
	'turn-changed',
	'points-changed',
	'action-failed',
	'exit-triggered'
])

const containerRef = ref(null)
const canvasRef = ref(null)

// Cached Container Bounds
const containerRect = ref({
	left: 0,
	top: 0,
	width: 0,
	height: 0
})
const mapVersion = ref(0)
let resizeObserver = null
let unlistenSprites = null

// Camera State
const camera = ref({
	x: 0,
	y: 0,
	zoom: DEFAULT_ZOOM,
	isDragging: false,
	dragStartX: 0,
	dragStartY: 0,
	hasMovedSinceDown: false
})

// Drag-Painting & Keyboard Pan State
const isPainting = ref(false)
const lastPaintedCoord = ref(null)
const isSpacePressed = ref(false)
const lastLoadedMapId = ref(null)

// Game Grid State
const tiles = ref([])
const objects = ref([])
const player = ref({
	x: 2,
	y: 1,
	z: 0,
	renderX: 2,
	renderY: 1,
	renderZ: 0,
	isMoving: false,
	facing: 'SE'
})

// Tactical Turn-Based State
const turnNumber = ref(1)
const currentMp = ref(props.tacticalConfig?.maxMp ?? 5)
const currentAp = ref(props.tacticalConfig?.maxAp ?? 2)

// Movement & Interaction State
const reachableTiles = ref([])
const activePath = ref([])
const hoveredTile = ref(null)
const hoveredInteractiveObject = ref(null)
const hoveredDoorWall = ref(null)
const tooltipPos = ref({ x: 0, y: 0 })
let animationFrameId = null

// Planned Movement Path & Object Context Menu (2-click movement)
const plannedPath = ref([])
const selectedDestinationTile = ref(null)
const activeContextMenu = ref(null)

const plannedPathSet = computed(() => {
	const set = new Set()
	for (const p of plannedPath.value) {
		set.add(`${p.x},${p.y}`)
	}
	return set
})

// Floating particles for weeding action
const particles = ref([])

// Computed brush coverage cells for hover preview and painting
const activeBrushCells = computed(() => {
	if (props.mode !== 'editor' || !hoveredTile.value) return []
	if (!['tile', 'elevation', 'eraser'].includes(props.editorTool)) {
		return [hoveredTile.value]
	}
	let mapBounds = props.locationData?.bounds
	if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
		const gw = props.locationData?.gridWidth || 11
		const gh = props.locationData?.gridHeight || 11
		const halfW = Math.floor(gw / 2)
		const halfH = Math.floor(gh / 2)
		mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
	}
	return getBrushGridCells(
		hoveredTile.value.x,
		hoveredTile.value.y,
		props.brushSize || 1,
		props.brushShape || 'square',
		mapBounds
	)
})

const activeBrushCellSet = computed(() => {
	const set = new Set()
	for (const cell of activeBrushCells.value) {
		set.add(`${cell.x},${cell.y}`)
	}
	return set
})

// Computed Set of reachable tile coordinates for O(1) lookup
const reachableTileSet = computed(() => {
	const set = new Set()
	for (const r of reachableTiles.value) {
		set.add(`${r.x},${r.y}`)
	}
	return set
})

// Fast Set of existing tile coordinates
const tilePosSet = computed(() => {
	void mapVersion.value
	const set = new Set()
	for (const t of tiles.value) {
		set.add(`${t.x},${t.y}`)
	}
	return set
})

// Static render queue pre-sorted once whenever tiles/objects/bounds change
const staticRenderQueue = computed(() => {
	// Read mapVersion so in-place mutations trigger recomputation
	void mapVersion.value

	const queue = []

	// 0. Void cells within map bounds (only in editor mode for <= 15000 cells)
	if (props.mode === 'editor') {
		let mapBounds = props.locationData?.bounds
		if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
			const gw = props.locationData?.gridWidth || 11
			const gh = props.locationData?.gridHeight || 11
			const halfW = Math.floor(gw / 2)
			const halfH = Math.floor(gh / 2)
			mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
		}

		if (mapBounds) {
			const totalCells = (mapBounds.maxX - mapBounds.minX + 1) * (mapBounds.maxY - mapBounds.minY + 1)
			if (totalCells <= 15000) {
				const posSet = tilePosSet.value
				for (let gy = mapBounds.minY; gy <= mapBounds.maxY; gy++) {
					for (let gx = mapBounds.minX; gx <= mapBounds.maxX; gx++) {
						if (!posSet.has(`${gx},${gy}`)) {
							queue.push({
								type: 'void',
								x: gx,
								y: gy,
								z: 0,
								depthKey: getDepthSortKey(gx, gy, 0, 0)
							})
						}
					}
				}
			}
		}
	}

	// 1. Tiles & Edge Walls
	for (const tile of tiles.value) {
		queue.push({
			type: 'tile',
			x: tile.x,
			y: tile.y,
			z: tile.z || 0,
			depthKey: getDepthSortKey(tile.x, tile.y, tile.z || 0, 0),
			data: tile
		})

		if (tile.walls) {
			if (tile.walls.NW) {
				queue.push({
					type: 'wall',
					edge: 'NW',
					tileX: tile.x,
					tileY: tile.y,
					tileZ: tile.z || 0,
					depthKey: getDepthSortKey(tile.x, tile.y, tile.z || 0, 1),
					data: tile.walls.NW
				})
			}
			if (tile.walls.NE) {
				queue.push({
					type: 'wall',
					edge: 'NE',
					tileX: tile.x,
					tileY: tile.y,
					tileZ: tile.z || 0,
					depthKey: getDepthSortKey(tile.x, tile.y, tile.z || 0, 1),
					data: tile.walls.NE
				})
			}
			if (tile.walls.SW) {
				queue.push({
					type: 'wall',
					edge: 'SW',
					tileX: tile.x,
					tileY: tile.y,
					tileZ: tile.z || 0,
					depthKey: getDepthSortKey(tile.x, tile.y, tile.z || 0, 6),
					data: tile.walls.SW
				})
			}
			if (tile.walls.SE) {
				queue.push({
					type: 'wall',
					edge: 'SE',
					tileX: tile.x,
					tileY: tile.y,
					tileZ: tile.z || 0,
					depthKey: getDepthSortKey(tile.x, tile.y, tile.z || 0, 6),
					data: tile.walls.SE
				})
			}
		}
	}

	// 2. Objects
	for (const obj of objects.value) {
		queue.push({
			type: 'object',
			x: obj.x,
			y: obj.y,
			z: obj.z || 0,
			depthKey: getDepthSortKey(obj.x, obj.y, obj.z || 0, 4) + (obj.zIndex || 0) * 0.1,
			data: obj
		})
	}

	// 3. Characters / NPCs
	if (Array.isArray(props.locationData?.characters)) {
		for (const actor of props.locationData.characters) {
			if (props.showPlayer && actor.id === (props.characterId || 'mc')) {
				continue
			}
			queue.push({
				type: 'actor',
				x: actor.x,
				y: actor.y,
				z: actor.z || 0,
				depthKey: getDepthSortKey(actor.x, actor.y, actor.z || 0, 5),
				data: actor
			})
		}
	}

	// Pre-sort once!
	queue.sort((a, b) => a.depthKey - b.depthKey)
	return queue
})

const actionTooltip = computed(() => {
	if (activeContextMenu.value) return null

	if (hoveredInteractiveObject.value) {
		const obj = hoveredInteractiveObject.value
		const isWeed = obj.action === 'weed' || obj.type === 'weed'
		const name = obj.name || (isWeed ? 'Сорняк' : 'Объект')
		const icon = obj.icon || (isWeed ? '🌿' : '📦')
		return {
			icon,
			text: name
		}
	}
	if (hoveredDoorWall.value) {
		const isNear = isPlayerNear(hoveredDoorWall.value.tile)
		if (isNear) {
			return {
				icon: '🚪',
				text: hoveredDoorWall.value.wall.open ? 'Закрыть дверь' : 'Открыть дверь'
			}
		}
		return {
			icon: '🚪',
			text: 'Дверь'
		}
	}
	if (hoveredTile.value && props.locationData?.exits) {
		const exit = props.locationData.exits.find(
			(e) => e.trigger && e.trigger.x === hoveredTile.value.x && e.trigger.y === hoveredTile.value.y
		)
		if (exit) {
			return {
				icon: '🚪',
				text: exit.label || 'Выход'
			}
		}
	}
	return null
})

// Initialize from props
watch(
	() => props.locationData,
	(data) => {
		if (!data) return
		tiles.value = data.tiles ? [...data.tiles] : []
		objects.value = data.objects ? [...data.objects] : []
		mapVersion.value++

		const isDifferentMap = !lastLoadedMapId.value || data.id !== lastLoadedMapId.value
		lastLoadedMapId.value = data.id || null

		if (isDifferentMap) {
			const spawn = data.defaultSpawn || { x: 2, y: 1, z: 0 }
			player.value = {
				x: spawn.x,
				y: spawn.y,
				z: spawn.z || 0,
				renderX: spawn.x,
				renderY: spawn.y,
				renderZ: spawn.z || 0,
				isMoving: false,
				facing: spawn.facing || 'SE'
			}
			turnNumber.value = 1
			currentMp.value = props.tacticalConfig?.maxMp ?? 5
			currentAp.value = props.tacticalConfig?.maxAp ?? 2
			emitPointsChanged()
			updateReachableTiles()
			requestAnimationFrame(() => {
				resetCamera()
			})
		} else {
			updateReachableTiles()
			requestRender()
		}
	},
	{ immediate: true, deep: true }
)

watch(
	() => [player.value.x, player.value.y, props.movementRange, props.movementMode],
	() => {
		updateReachableTiles()
	}
)

watch(
	() => props.tacticalConfig,
	(cfg) => {
		if (cfg) {
			const maxM = cfg.maxMp ?? 5
			const maxA = cfg.maxAp ?? 2
			if (currentMp.value > maxM) currentMp.value = maxM
			if (currentAp.value > maxA) currentAp.value = maxA
			emitPointsChanged()
		}
	},
	{ deep: true }
)

watch(
	() => [
		props.showGrid,
		props.showCoords,
		props.showHeights,
		props.showPlayer,
		props.mode,
		props.editorTool,
		props.brushSize,
		props.brushShape,
		props.selectedTile,
		props.characterId,
		props.movementMode,
		props.movementRange
	],
	() => {
		requestRender()
	}
)

watch(
	() => [camera.value.x, camera.value.y, camera.value.zoom],
	() => {
		requestRender()
	}
)

watch(
	() => hoveredTile.value,
	() => {
		requestRender()
	}
)

watch(
	() => staticRenderQueue.value,
	() => {
		requestRender()
	}
)

watch(
	() => reachableTileSet.value,
	() => {
		requestRender()
	}
)

watch(
	() => plannedPathSet.value,
	() => {
		requestRender()
	}
)

watch(
	() => [player.value.x, player.value.y, player.value.z, player.value.facing],
	() => {
		requestRender()
	}
)

function updateContainerPosition() {
	if (!containerRef.value) return
	const r = containerRef.value.getBoundingClientRect()
	containerRect.value.left = r.left
	containerRect.value.top = r.top
	if (r.width && r.height) {
		if (containerRect.value.width !== r.width || containerRect.value.height !== r.height) {
			containerRect.value.width = r.width
			containerRect.value.height = r.height
			resizeCanvas()
			clampCamera()
		}
	}
}

function updateContainerBounds() {
	if (!containerRef.value) return
	const r = containerRef.value.getBoundingClientRect()
	containerRect.value.left = r.left
	containerRect.value.top = r.top
	containerRect.value.width = r.width
	containerRect.value.height = r.height
	resizeCanvas()
	clampCamera()
	requestRender()
}

function resizeCanvas() {
	const canvas = canvasRef.value
	if (!canvas || !containerRef.value) return
	const dpr = window.devicePixelRatio || 1
	const w = containerRect.value.width || containerRef.value.clientWidth
	const h = containerRect.value.height || containerRef.value.clientHeight
	if (w > 0 && h > 0) {
		const targetW = Math.round(w * dpr)
		const targetH = Math.round(h * dpr)
		if (canvas.width !== targetW || canvas.height !== targetH) {
			canvas.width = targetW
			canvas.height = targetH
		}
	}
}

let renderScheduled = false

function requestRender() {
	if (renderScheduled) return
	renderScheduled = true
	animationFrameId = requestAnimationFrame(renderLoop)
}

function renderLoop() {
	renderScheduled = false
	render()

	// If particles exist or player is moving, continue the loop
	if (particles.value.length > 0 || player.value.isMoving) {
		requestRender()
	}
}

function emitPointsChanged() {
	emit('points-changed', {
		mp: currentMp.value,
		maxMp: props.tacticalConfig?.maxMp ?? 5,
		ap: currentAp.value,
		maxAp: props.tacticalConfig?.maxAp ?? 2
	})
}

function updateReachableTiles() {
	if (player.value.isMoving) {
		reachableTiles.value = []
		return
	}

	const maxRange = props.movementMode === 'turn-based'
		? Math.min(props.movementRange, currentMp.value)
		: props.movementRange

	if (maxRange <= 0) {
		reachableTiles.value = []
		return
	}

	reachableTiles.value = getReachableTiles({
		start: { x: player.value.x, y: player.value.y, z: player.value.z },
		tiles: tiles.value,
		obstacles: objects.value,
		maxRange,
		maxClimbHeight: 1
	})
}

function isPlayerNear(target) {
	if (!target) return false
	return isAdjacent(
		{ x: player.value.x, y: player.value.y },
		{ x: target.x, y: target.y },
		true
	)
}

function endTurn() {
	turnNumber.value++
	currentMp.value = props.tacticalConfig?.maxMp ?? 5
	currentAp.value = props.tacticalConfig?.maxAp ?? 2
	updateReachableTiles()
	emit('turn-changed', {
		turn: turnNumber.value,
		mp: currentMp.value,
		ap: currentAp.value
	})
	emitPointsChanged()
}

function centerCamera(gx = 0, gy = 0, gz = 0) {
	if (!containerRef.value) return
	const width = containerRect.value.width || containerRef.value.clientWidth
	const height = containerRect.value.height || containerRef.value.clientHeight
	if (!width || !height) return
	const tileW = props.locationData?.tileWidth || 64
	const tileH = props.locationData?.tileHeight || 32
	const heightStep = props.locationData?.heightStep || 16

	const screenPos = gridToScreen(
		gx,
		gy,
		gz,
		0,
		0,
		tileW,
		tileH,
		heightStep
	)

	camera.value.x = width / 2 - screenPos.x * camera.value.zoom
	camera.value.y = height / 2 - screenPos.y * camera.value.zoom
	clampCamera()
	requestRender()
}

function centerCameraOnPlayer() {
	centerCamera(player.value.x, player.value.y, player.value.z)
}

/**
 * Clamps camera panning so that outermost tiles cannot move beyond the center of the screen
 * (leaving at most half the screen empty horizontally and vertically), accounting for zoom.
 */
function clampCamera() {
	if (!containerRef.value) return
	const width = containerRect.value.width || containerRef.value.clientWidth
	const height = containerRect.value.height || containerRef.value.clientHeight
	if (!width || !height) return

	let mapBounds = props.locationData?.bounds
	if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
		const gw = props.locationData?.gridWidth || 11
		const gh = props.locationData?.gridHeight || 11
		const halfWGrid = Math.floor(gw / 2)
		const halfHGrid = Math.floor(gh / 2)
		mapBounds = { minX: -halfWGrid, maxX: halfWGrid, minY: -halfHGrid, maxY: halfHGrid }
	}

	const tileW = props.locationData?.tileWidth || 64
	const tileH = props.locationData?.tileHeight || 32
	const heightStep = props.locationData?.heightStep || 16

	const extremes = getIsoWorldExtremes(tiles.value, mapBounds, tileW, tileH, heightStep)
	const limits = calculateCameraClamping(extremes, width, height, camera.value.zoom)

	if (limits.maxCameraX >= limits.minCameraX) {
		camera.value.x = Math.max(limits.minCameraX, Math.min(limits.maxCameraX, camera.value.x))
	} else {
		camera.value.x = (limits.minCameraX + limits.maxCameraX) / 2
	}

	if (limits.maxCameraY >= limits.minCameraY) {
		camera.value.y = Math.max(limits.minCameraY, Math.min(limits.maxCameraY, camera.value.y))
	} else {
		camera.value.y = (limits.minCameraY + limits.maxCameraY) / 2
	}
}

function resetCamera(target = props.initialCenter) {
	camera.value.zoom = DEFAULT_ZOOM
	if (target === 'player') {
		centerCameraOnPlayer()
	} else {
		let mapBounds = props.locationData?.bounds
		if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
			const gw = props.locationData?.gridWidth || 11
			const gh = props.locationData?.gridHeight || 11
			const halfW = Math.floor(gw / 2)
			const halfH = Math.floor(gh / 2)
			mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
		}
		if (mapBounds && typeof mapBounds.minX === 'number') {
			const cx = (mapBounds.minX + mapBounds.maxX) / 2
			const cy = (mapBounds.minY + mapBounds.maxY) / 2
			centerCamera(cx, cy, 0)
		} else {
			centerCamera(0, 0, 0)
		}
	}
	requestRender()
}

function resetLocation() {
	if (props.locationData) {
		tiles.value = JSON.parse(JSON.stringify(props.locationData.tiles || []))
		objects.value = JSON.parse(JSON.stringify(props.locationData.objects || []))
		mapVersion.value++
		const spawn = props.locationData.defaultSpawn || { x: 2, y: 1, z: 0 }
		player.value.x = spawn.x
		player.value.y = spawn.y
		player.value.z = spawn.z || 0
		player.value.renderX = spawn.x
		player.value.renderY = spawn.y
		player.value.renderZ = spawn.z || 0
		player.value.isMoving = false
		player.value.facing = spawn.facing || 'SE'
		turnNumber.value = 1
		currentMp.value = props.tacticalConfig?.maxMp ?? 5
		currentAp.value = props.tacticalConfig?.maxAp ?? 2
		emitPointsChanged()
		updateReachableTiles()
		requestAnimationFrame(() => {
			resetCamera()
		})
	}
}

defineExpose({
	resetCamera,
	centerCamera,
	centerCameraOnPlayer,
	resetLocation,
	endTurn,
	turnNumber,
	currentMp,
	currentAp
})

// Mouse & Brush Interaction
function isBrushTool(tool) {
	return ['tile', 'elevation', 'eraser'].includes(tool)
}

function applyBrushAtHovered(centerTile, isRightClick = false) {
	if (!centerTile) return
	lastPaintedCoord.value = { x: centerTile.x, y: centerTile.y }

	let mapBounds = props.locationData?.bounds
	if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
		const gw = props.locationData?.gridWidth || 11
		const gh = props.locationData?.gridHeight || 11
		const halfW = Math.floor(gw / 2)
		const halfH = Math.floor(gh / 2)
		mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
	}

	const cells = getBrushGridCells(
		centerTile.x,
		centerTile.y,
		props.brushSize || 1,
		props.brushShape || 'square',
		mapBounds
	)

	emit('editor-brush-apply', {
		centerTile,
		cells,
		tool: props.editorTool,
		isRightClick
	})
	emit('editor-tile-click', { tile: centerTile, button: isRightClick ? 2 : 0 })
}

function onMouseDown(e) {
	// Pan via Middle Mouse Button (1) or Space + LMB (0):
	if (e.button === 1 || (e.button === 0 && isSpacePressed.value)) {
		camera.value.isDragging = true
		camera.value.dragStartX = e.clientX - camera.value.x
		camera.value.dragStartY = e.clientY - camera.value.y
		camera.value.hasMovedSinceDown = false
		return
	}

	// In editor mode with LMB:
	if (props.mode === 'editor' && e.button === 0) {
		if (isBrushTool(props.editorTool)) {
			// Start drag-painting!
			isPainting.value = true
			if (hoveredTile.value) {
				applyBrushAtHovered(hoveredTile.value, false)
			}
			return
		}

		// 'select' or point tools (object, wall, spawn): initiate potential pan/click
		camera.value.isDragging = true
		camera.value.dragStartX = e.clientX - camera.value.x
		camera.value.dragStartY = e.clientY - camera.value.y
		camera.value.hasMovedSinceDown = false
		return
	}

	// Play mode:
	if (e.button === 0) {
		camera.value.isDragging = true
		camera.value.dragStartX = e.clientX - camera.value.x
		camera.value.dragStartY = e.clientY - camera.value.y
		camera.value.hasMovedSinceDown = false
	}
}

function onMouseMove(e) {
	if (!containerRef.value) return
	const mouseX = e.clientX - containerRect.value.left
	const mouseY = e.clientY - containerRect.value.top

	if (camera.value.isDragging) {
		const newX = e.clientX - camera.value.dragStartX
		const newY = e.clientY - camera.value.dragStartY
		if (Math.hypot(newX - camera.value.x, newY - camera.value.y) > 4) {
			camera.value.hasMovedSinceDown = true
			closeContextMenu()
		}
		camera.value.x = newX
		camera.value.y = newY
		clampCamera()
		requestRender()
		return
	}

	// Calculate world screen position
	const worldX = (mouseX - camera.value.x) / camera.value.zoom
	const worldY = (mouseY - camera.value.y) / camera.value.zoom

	const tileW = props.locationData?.tileWidth || 64
	const tileH = props.locationData?.tileHeight || 32
	const heightStep = props.locationData?.heightStep || 16

	let picked = pickTileAtScreen(
		worldX,
		worldY,
		tiles.value,
		0,
		0,
		tileW,
		tileH,
		heightStep
	)

	// In editor mode, if cursor is over an empty void cell within map bounds, allow selecting and hovering it
	if (!picked && props.mode === 'editor') {
		let mapBounds = props.locationData?.bounds
		if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
			const gw = props.locationData?.gridWidth || 11
			const gh = props.locationData?.gridHeight || 11
			const halfW = Math.floor(gw / 2)
			const halfH = Math.floor(gh / 2)
			mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
		}
		const voidCell = pickGridCellAtScreen(worldX, worldY, mapBounds, 0, 0, tileW, tileH, heightStep)
		if (voidCell) {
			picked = { x: voidCell.x, y: voidCell.y, z: 0, type: 'void', isVoid: true }
		}
	}

	if (
		hoveredTile.value?.x !== picked?.x ||
		hoveredTile.value?.y !== picked?.y ||
		hoveredTile.value?.z !== picked?.z
	) {
		hoveredTile.value = picked
		requestRender()
	}

	// Continuous drag-painting across tiles
	if (isPainting.value && props.mode === 'editor' && picked) {
		if (
			!lastPaintedCoord.value ||
			lastPaintedCoord.value.x !== picked.x ||
			lastPaintedCoord.value.y !== picked.y
		) {
			applyBrushAtHovered(picked, false)
			requestRender()
		}
	}

	// Check if hovering over an interactive object or door or exit
	if (picked) {
		const obj = objects.value.find(
			(o) => o.x === picked.x && o.y === picked.y && o.interactive
		)
		hoveredInteractiveObject.value = obj || null

		// Check door on tile walls
		let doorFound = null
		if (picked.walls) {
			for (const edge of ['NW', 'NE', 'SW', 'SE']) {
				if (picked.walls[edge]?.door) {
					doorFound = { wall: picked.walls[edge], edge, tile: picked }
					break
				}
			}
		}
		hoveredDoorWall.value = doorFound

		// Check exit on tile
		const exitFound = (props.locationData?.exits || []).some(
			(e) => e.trigger && e.trigger.x === picked.x && e.trigger.y === picked.y
		)

		if (obj || doorFound || exitFound) {
			tooltipPos.value = { x: mouseX + 15, y: mouseY - 25 }
		}
	} else {
		hoveredInteractiveObject.value = null
		hoveredDoorWall.value = null
	}
}

function closeContextMenu() {
	activeContextMenu.value = null
}

function handleContextMenuAction(obj) {
	closeContextMenu()
	executeObjectAction(obj)
}

function checkExitTrigger() {
	if (!props.locationData?.exits) return
	const exit = props.locationData.exits.find(
		(e) => e.trigger && e.trigger.x === player.value.x && e.trigger.y === player.value.y
	)
	if (exit) {
		emit('exit-triggered', exit)
	}
}

function onMouseUp(e) {
	if (isPainting.value) {
		isPainting.value = false
		lastPaintedCoord.value = null
		requestRender()
		return
	}

	if (camera.value.isDragging) {
		camera.value.isDragging = false
		requestRender()
		if (camera.value.hasMovedSinceDown) {
			return
		}
	}

	if (!hoveredTile.value || player.value.isMoving) return

	const target = hoveredTile.value
	emit('tile-clicked', target)

	if (props.mode === 'editor') {
		if (isBrushTool(props.editorTool)) {
			applyBrushAtHovered(target, false)
		} else {
			emit('editor-tile-click', { tile: target, button: e.button })
		}
		return
	}

	// If player is already on an exit tile and clicks it, trigger exit immediately
	const exitOnTarget = (props.locationData?.exits || []).find(
		(e) => e.trigger && e.trigger.x === target.x && e.trigger.y === target.y
	)
	if (
		exitOnTarget &&
		player.value.x === exitOnTarget.trigger.x &&
		player.value.y === exitOnTarget.trigger.y
	) {
		closeContextMenu()
		emit('exit-triggered', exitOnTarget)
		return
	}

	// Check if clicked a door on target tile walls
	if (target.walls) {
		for (const edge of ['NW', 'NE', 'SW', 'SE']) {
			const w = target.walls[edge]
			if (w && w.door) {
				if (isPlayerNear(target)) {
					if (exitOnTarget) {
						closeContextMenu()
						emit('exit-triggered', exitOnTarget)
						return
					}
					toggleDoor(w, target, edge)
					return
				}
			}
		}
	}

	// Check if clicked an interactive object
	const obj = objects.value.find(
		(o) => o.x === target.x && o.y === target.y && o.interactive
	)

	if (obj) {
		if (isPlayerNear(obj)) {
			// Player is near: open context menu!
			plannedPath.value = []
			selectedDestinationTile.value = null

			const r = containerRef.value ? containerRef.value.getBoundingClientRect() : containerRect.value
			const clickX = e.clientX - (r?.left || 0)
			const clickY = e.clientY - (r?.top || 0)

			// Clamp position within container boundaries
			const viewW = r?.width || containerRef.value?.clientWidth || 800
			const viewH = r?.height || containerRef.value?.clientHeight || 600
			const menuW = 140
			const menuH = 95
			const posX = Math.min(Math.max(10, clickX), Math.max(10, viewW - menuW - 10))
			const posY = Math.min(Math.max(10, clickY), Math.max(10, viewH - menuH - 10))

			activeContextMenu.value = {
				object: obj,
				x: posX,
				y: posY
			}
			requestRender()
			return
		}

		// If not near, player approaches object first with 2-click movement
		closeContextMenu()

		const adjacentTiles = tiles.value.filter(
			(t) =>
				isAdjacent(t, obj, false) &&
				t.walkable !== false &&
				!objects.value.some((o) => o.solid !== false && o.x === t.x && o.y === t.y)
		)

		if (adjacentTiles.length > 0) {
			let bestPath = null
			let bestAdj = null
			for (const adj of adjacentTiles) {
				const p = findPath({
					start: { x: player.value.x, y: player.value.y, z: player.value.z },
					target: adj,
					tiles: tiles.value,
					obstacles: objects.value,
					maxClimbHeight: 1
				})
				if (p && (!bestPath || p.length < bestPath.length)) {
					bestPath = p
					bestAdj = adj
				}
			}
			if (bestPath && bestPath.length > 0) {
				const isSameTarget =
					selectedDestinationTile.value &&
					((selectedDestinationTile.value.targetType === 'object' && selectedDestinationTile.value.objectId === obj.id) ||
						(selectedDestinationTile.value.x === bestAdj.x && selectedDestinationTile.value.y === bestAdj.y))

				if (isSameTarget) {
					// Second click: execute movement to adjacent tile (no auto-weed!)
					if (props.movementMode === 'turn-based' && plannedPath.value.length > currentMp.value) {
						emit('action-failed', { reason: 'not_enough_mp' })
						return
					}
					const pathToWalk = plannedPath.value.length > 0 ? plannedPath.value : bestPath
					selectedDestinationTile.value = null
					plannedPath.value = []
					movePlayerAlongPath(pathToWalk)
					return
				} else {
					// First click: plan path to adjacent tile and highlight
					selectedDestinationTile.value = {
						x: bestAdj.x,
						y: bestAdj.y,
						z: bestAdj.z || 0,
						targetType: 'object',
						objectId: obj.id
					}
					plannedPath.value = bestPath
					requestRender()
					return
				}
			}
		}
		// If unreachable, clear
		selectedDestinationTile.value = null
		plannedPath.value = []
		requestRender()
		return
	}

	// Normal move to clicked tile
	closeContextMenu()

	const isReachable = reachableTiles.value.some(
		(r) => r.x === target.x && r.y === target.y
	)

	if (isReachable) {
		const isSameTarget =
			selectedDestinationTile.value &&
			selectedDestinationTile.value.x === target.x &&
			selectedDestinationTile.value.y === target.y

		if (isSameTarget) {
			// Second click on same tile: execute movement!
			if (props.movementMode === 'turn-based' && plannedPath.value.length > currentMp.value) {
				emit('action-failed', { reason: 'not_enough_mp' })
				return
			}
			const pathToWalk = plannedPath.value.length > 0 ? plannedPath.value : null
			selectedDestinationTile.value = null
			plannedPath.value = []
			if (pathToWalk) {
				movePlayerAlongPath(pathToWalk)
			}
			return
		} else {
			// First click: calculate path and highlight
			const path = findPath({
				start: { x: player.value.x, y: player.value.y, z: player.value.z },
				target,
				tiles: tiles.value,
				obstacles: objects.value,
				maxClimbHeight: 1
			})
			if (path && path.length > 0) {
				selectedDestinationTile.value = {
					x: target.x,
					y: target.y,
					z: target.z || 0,
					targetType: 'tile'
				}
				plannedPath.value = path
				requestRender()
				return
			}
		}
	} else {
		selectedDestinationTile.value = null
		plannedPath.value = []
		requestRender()
	}
}

function toggleDoor(wall, tile, edge) {
	if (props.movementMode === 'turn-based') {
		if (currentAp.value <= 0) {
			emit('action-failed', { reason: 'not_enough_ap' })
			return
		}
		currentAp.value--
		emitPointsChanged()
	}
	wall.open = !wall.open
	mapVersion.value++
	updateReachableTiles()
	requestRender()
	emit('object-interacted', {
		type: 'door',
		open: wall.open,
		edge,
		tile
	})
}

function onMouseLeave() {
	if (isPainting.value) {
		isPainting.value = false
		lastPaintedCoord.value = null
	}
	camera.value.isDragging = false
	hoveredTile.value = null
	hoveredInteractiveObject.value = null
	hoveredDoorWall.value = null
	requestRender()
}

function onContextMenu(e) {
	if (props.mode === 'editor' && hoveredTile.value) {
		if (isBrushTool(props.editorTool)) {
			applyBrushAtHovered(hoveredTile.value, true)
		} else {
			emit('editor-tile-right-click', { tile: hoveredTile.value })
		}
	}
}

function onWheel(e) {
	closeContextMenu()
	const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9
	const newZoom = Math.max(0.6, Math.min(3.0, camera.value.zoom * zoomFactor))

	if (!containerRef.value) return
	const mouseX = e.clientX - containerRect.value.left
	const mouseY = e.clientY - containerRect.value.top

	// Zoom to mouse position
	camera.value.x = mouseX - (mouseX - camera.value.x) * (newZoom / camera.value.zoom)
	camera.value.y = mouseY - (mouseY - camera.value.y) * (newZoom / camera.value.zoom)
	camera.value.zoom = newZoom
	clampCamera()
	requestRender()
}

// Action execution (e.g. weeding)
function executeObjectAction(obj) {
	if (props.movementMode === 'turn-based') {
		if (currentAp.value <= 0) {
			emit('action-failed', { reason: 'not_enough_ap' })
			return
		}
		currentAp.value--
		emitPointsChanged()
	}

	if (obj.action === 'weed') {
		spawnWeedParticles(obj.x, obj.y, obj.z || 0)

		const idx = objects.value.findIndex((o) => o.id === obj.id)
		if (idx !== -1) {
			objects.value.splice(idx, 1)
			mapVersion.value++
		}

		hoveredInteractiveObject.value = null
		const remainingWeeds = objects.value.filter((o) => o.type === 'weed').length
		emit('weed-cleared', {
			weedId: obj.id,
			totalRemaining: remainingWeeds
		})

		if (remainingWeeds === 0) {
			emit('quest-completed')
		}
		requestRender()
	} else {
		emit('object-interacted', obj)
	}
}

function spawnWeedParticles(gx, gy, gz) {
	const tileW = props.locationData?.tileWidth || 64
	const tileH = props.locationData?.tileHeight || 32
	const heightStep = props.locationData?.heightStep || 16
	const s = gridToScreen(gx, gy, gz, 0, 0, tileW, tileH, heightStep)

	for (let i = 0; i < 16; i++) {
		particles.value.push({
			x: s.x + (Math.random() - 0.5) * 30,
			y: s.y + (Math.random() - 0.5) * 20,
			vx: (Math.random() - 0.5) * 3,
			vy: -Math.random() * 3 - 1,
			life: 1.0,
			color: Math.random() > 0.4 ? '#48bb78' : '#f6e05e',
			size: Math.random() * 4 + 2
		})
	}
	requestRender()
}

// Step-by-step path movement
function movePlayerAlongPath(path, onComplete = null) {
	if (!path || path.length === 0) {
		if (onComplete) onComplete()
		return
	}

	player.value.isMoving = true
	reachableTiles.value = []
	closeContextMenu()
	requestRender()

	let currentStep = 0

	function step() {
		if (currentStep >= path.length) {
			player.value.isMoving = false
			if (props.movementMode === 'turn-based') {
				currentMp.value = Math.max(0, currentMp.value - path.length)
				emitPointsChanged()
			}
			updateReachableTiles()
			emit('player-moved', {
				x: player.value.x,
				y: player.value.y,
				z: player.value.z,
				stepsTaken: path.length
			})
			checkExitTrigger()
			requestRender()
			if (onComplete) onComplete()
			return
		}

		const next = path[currentStep]
		// Determine facing
		if (next.x > player.value.x) player.value.facing = 'SE'
		else if (next.x < player.value.x) player.value.facing = 'NW'
		else if (next.y > player.value.y) player.value.facing = 'SW'
		else if (next.y < player.value.y) player.value.facing = 'NE'

		player.value.x = next.x
		player.value.y = next.y
		player.value.z = next.z || 0
		requestRender()

		currentStep++
		setTimeout(step, 160)
	}

	step()
}

// Main Rendering Loop
function render() {
	const canvas = canvasRef.value
	if (!canvas || !containerRef.value) return
	const ctx = canvas.getContext('2d')

	const viewW = containerRect.value.width || containerRef.value.clientWidth || 800
	const viewH = containerRect.value.height || containerRef.value.clientHeight || 600
	const dpr = window.devicePixelRatio || 1

	ctx.save()
	ctx.scale(dpr, dpr)
	ctx.clearRect(0, 0, viewW, viewH)

	// Background gradient
	const bgGrad = ctx.createLinearGradient(0, 0, 0, viewH)
	bgGrad.addColorStop(0, '#12161f')
	bgGrad.addColorStop(1, '#1b2230')
	ctx.fillStyle = bgGrad
	ctx.fillRect(0, 0, viewW, viewH)

	// Apply Camera Transform
	ctx.save()
	ctx.translate(camera.value.x, camera.value.y)
	ctx.scale(camera.value.zoom, camera.value.zoom)

	const tileW = props.locationData?.tileWidth || 64
	const tileH = props.locationData?.tileHeight || 32
	const heightStep = props.locationData?.heightStep || 16
	const z = camera.value.zoom
	const camX = camera.value.x
	const camY = camera.value.y

	// Check if player should be drawn
	const shouldDrawPlayer = props.showPlayer !== false && player.value
	const playerDepthKey = shouldDrawPlayer
		? getDepthSortKey(player.value.x, player.value.y, player.value.z, 5)
		: Infinity
	let playerDrawn = !shouldDrawPlayer

	// For large maps (> 15000 cells) in editor mode, draw visible void cells directly on the fly
	if (props.mode === 'editor') {
		let mapBounds = props.locationData?.bounds
		if (!mapBounds && (props.locationData?.gridWidth || props.locationData?.gridHeight)) {
			const gw = props.locationData?.gridWidth || 11
			const gh = props.locationData?.gridHeight || 11
			const halfW = Math.floor(gw / 2)
			const halfH = Math.floor(gh / 2)
			mapBounds = { minX: -halfW, maxX: halfW, minY: -halfH, maxY: halfH }
		}
		if (mapBounds) {
			const totalCells = (mapBounds.maxX - mapBounds.minX + 1) * (mapBounds.maxY - mapBounds.minY + 1)
			if (totalCells > 15000) {
				drawLargeMapVisibleVoidCells(ctx, mapBounds, viewW, viewH, camX, camY, z, tileW, tileH, heightStep)
			}
		}
	}

	const queue = staticRenderQueue.value
	for (let i = 0; i < queue.length; i++) {
		const item = queue[i]

		// Draw player at the correct depth order
		if (!playerDrawn && item.depthKey >= playerDepthKey) {
			drawPlayer(ctx, player.value, tileW, tileH, heightStep)
			playerDrawn = true
		}

		// Frustum Culling: check if item is roughly within viewport
		const itemX = item.type === 'wall' ? item.tileX : item.x
		const itemY = item.type === 'wall' ? item.tileY : item.y
		const itemZ = item.type === 'wall' ? item.tileZ : (item.z || 0)

		const screenCenterX = (itemX - itemY) * (tileW / 2) * z + camX
		const screenCenterY = ((itemX + itemY) * (tileH / 2) - itemZ * heightStep) * z + camY
		const cullMarginX = tileW * 2 * z
		const cullMarginY = (tileH * 4 + 64) * z

		if (
			screenCenterX < -cullMarginX ||
			screenCenterX > viewW + cullMarginX ||
			screenCenterY < -cullMarginY ||
			screenCenterY > viewH + cullMarginY
		) {
			continue
		}

		if (item.type === 'void') {
			drawVoidCell(ctx, item.x, item.y, tileW, tileH, heightStep)
		} else if (item.type === 'tile') {
			drawTile(ctx, item.data, tileW, tileH, heightStep)
		} else if (item.type === 'wall') {
			drawWall(ctx, item.data, item.edge, item.tileX, item.tileY, item.tileZ, tileW, tileH, heightStep)
		} else if (item.type === 'object') {
			drawObject(ctx, item.data, tileW, tileH, heightStep)
		} else if (item.type === 'actor') {
			drawActor(ctx, item.data, tileW, tileH, heightStep)
		}
	}

	if (!playerDrawn) {
		drawPlayer(ctx, player.value, tileW, tileH, heightStep)
		playerDrawn = true
	}

	// Render planned movement trail line and destination marker
	if (plannedPath.value && plannedPath.value.length > 0 && !player.value.isMoving) {
		drawPlannedPath(ctx, tileW, tileH, heightStep)
	}

	// Render Particles
	drawParticles(ctx)

	ctx.restore()
	ctx.restore()
}

// Draw connecting trail line and destination marker for 2-click movement
function drawPlannedPath(ctx, tileW, tileH, heightStep) {
	const path = plannedPath.value
	if (!path || path.length === 0) return

	ctx.save()

	// 1. Draw connecting dotted path line from player to each step
	const pStart = gridToScreen(
		player.value.x,
		player.value.y,
		player.value.z || 0,
		0,
		0,
		tileW,
		tileH,
		heightStep
	)

	ctx.beginPath()
	ctx.moveTo(pStart.x, pStart.y)
	for (let i = 0; i < path.length; i++) {
		const pt = gridToScreen(path[i].x, path[i].y, path[i].z || 0, 0, 0, tileW, tileH, heightStep)
		ctx.lineTo(pt.x, pt.y)
	}
	ctx.strokeStyle = '#38bdf8'
	ctx.lineWidth = 2
	ctx.setLineDash([6, 4])
	ctx.shadowColor = '#38bdf8'
	ctx.shadowBlur = 5
	ctx.stroke()
	ctx.setLineDash([])
	ctx.shadowBlur = 0

	// 2. Intermediate step dots
	for (let i = 0; i < path.length - 1; i++) {
		const pt = gridToScreen(path[i].x, path[i].y, path[i].z || 0, 0, 0, tileW, tileH, heightStep)
		ctx.beginPath()
		ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
		ctx.fillStyle = '#ffffff'
		ctx.fill()
	}

	// 3. Destination target ring
	const destPt = gridToScreen(
		path[path.length - 1].x,
		path[path.length - 1].y,
		path[path.length - 1].z || 0,
		0,
		0,
		tileW,
		tileH,
		heightStep
	)
	ctx.beginPath()
	ctx.arc(destPt.x, destPt.y, 6, 0, Math.PI * 2)
	ctx.fillStyle = 'rgba(56, 189, 248, 0.4)'
	ctx.fill()
	ctx.strokeStyle = '#ffffff'
	ctx.lineWidth = 1.5
	ctx.stroke()

	ctx.beginPath()
	ctx.arc(destPt.x, destPt.y, 2.5, 0, Math.PI * 2)
	ctx.fillStyle = '#ffffff'
	ctx.fill()

	ctx.restore()
}

// Dynamic visible void cells rendering for large maps (> 15000 cells)
function drawLargeMapVisibleVoidCells(ctx, mapBounds, viewW, viewH, camX, camY, zoom, tileW, tileH, heightStep) {
	const c0 = screenToGrid(0, 0, camX, camY, 0, tileW, tileH, heightStep, zoom)
	const c1 = screenToGrid(viewW, 0, camX, camY, 0, tileW, tileH, heightStep, zoom)
	const c2 = screenToGrid(0, viewH, camX, camY, 0, tileW, tileH, heightStep, zoom)
	const c3 = screenToGrid(viewW, viewH, camX, camY, 0, tileW, tileH, heightStep, zoom)

	const minVisX = Math.max(mapBounds.minX, Math.floor(Math.min(c0.x, c1.x, c2.x, c3.x)) - 2)
	const maxVisX = Math.min(mapBounds.maxX, Math.ceil(Math.max(c0.x, c1.x, c2.x, c3.x)) + 2)
	const minVisY = Math.max(mapBounds.minY, Math.floor(Math.min(c0.y, c1.y, c2.y, c3.y)) - 2)
	const maxVisY = Math.min(mapBounds.maxY, Math.ceil(Math.max(c0.y, c1.y, c2.y, c3.y)) + 2)

	const posSet = tilePosSet.value
	for (let gy = minVisY; gy <= maxVisY; gy++) {
		for (let gx = minVisX; gx <= maxVisX; gx++) {
			if (!posSet.has(`${gx},${gy}`)) {
				drawVoidCell(ctx, gx, gy, tileW, tileH, heightStep)
			}
		}
	}
}

// Void Cell Drawing — for grid positions within bounds that have no tile in JSON
function drawVoidCell(ctx, x, y, tileW, tileH, heightStep) {
	const poly = getTilePolygon(x, y, 0, 0, 0, tileW, tileH, heightStep)
	ctx.save()
	ctx.beginPath()
	ctx.moveTo(poly[0].x, poly[0].y)
	ctx.lineTo(poly[1].x, poly[1].y)
	ctx.lineTo(poly[2].x, poly[2].y)
	ctx.lineTo(poly[3].x, poly[3].y)
	ctx.closePath()
	ctx.fillStyle = 'rgba(8, 10, 18, 0.62)'
	ctx.fill()
	ctx.setLineDash([4, 3])
	ctx.strokeStyle = 'rgba(65, 75, 100, 0.38)'
	ctx.lineWidth = 1
	ctx.stroke()
	ctx.setLineDash([])

	// Hover & Brush Outline in editor mode
	if (props.mode === 'editor') {
		const inBrush = activeBrushCellSet.value.has(`${x},${y}`)
		const isCenter = hoveredTile.value && hoveredTile.value.x === x && hoveredTile.value.y === y
		if (inBrush) {
			ctx.fillStyle = isCenter ? 'rgba(56, 189, 248, 0.22)' : 'rgba(56, 189, 248, 0.1)'
			ctx.beginPath()
			ctx.moveTo(poly[0].x, poly[0].y)
			ctx.lineTo(poly[1].x, poly[1].y)
			ctx.lineTo(poly[2].x, poly[2].y)
			ctx.lineTo(poly[3].x, poly[3].y)
			ctx.closePath()
			ctx.fill()

			ctx.strokeStyle = isCenter ? '#ffffff' : 'rgba(56, 189, 248, 0.75)'
			ctx.lineWidth = isCenter ? 2 : 1
			ctx.stroke()
		}
	}

	// Selected Tile Highlight (Editor Inspector Selection - Cyan glow)
	if (props.selectedTile && props.selectedTile.x === x && props.selectedTile.y === y) {
		ctx.fillStyle = 'rgba(56, 189, 248, 0.22)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = '#38bdf8'
		ctx.lineWidth = 2
		ctx.stroke()
	}

	// Show Coordinates on void cell if showCoords is enabled
	if (props.showCoords) {
		const center = gridToScreen(x, y, 0, 0, 0, tileW, tileH, heightStep)
		ctx.font = '9px sans-serif'
		ctx.fillStyle = 'rgba(148, 163, 184, 0.45)'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(`${x},${y}`, center.x, center.y)
	}

	ctx.restore()
}

// Tile Drawing
function drawTile(ctx, tile, tileW, tileH, heightStep) {
	const poly = getTilePolygon(tile.x, tile.y, tile.z || 0, 0, 0, tileW, tileH, heightStep)
	const z = tile.z || 0
	const center = gridToScreen(tile.x, tile.y, z, 0, 0, tileW, tileH, heightStep)

	// Draw side drop faces if elevated
	if (z > 0) {
		const dropPx = z * heightStep
		// Left drop face (shadowed)
		ctx.fillStyle = '#222834'
		ctx.beginPath()
		ctx.moveTo(poly[3].x, poly[3].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[2].x, poly[2].y + dropPx)
		ctx.lineTo(poly[3].x, poly[3].y + dropPx)
		ctx.closePath()
		ctx.fill()
		ctx.strokeStyle = '#1a1f29'
		ctx.lineWidth = 1
		ctx.stroke()

		// Right drop face (lit side)
		ctx.fillStyle = '#313b4d'
		ctx.beginPath()
		ctx.moveTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[1].x, poly[1].y + dropPx)
		ctx.lineTo(poly[2].x, poly[2].y + dropPx)
		ctx.closePath()
		ctx.fill()
		ctx.strokeStyle = '#222834'
		ctx.lineWidth = 1
		ctx.stroke()
	}

	// Try drawing tile sprite
	const tileSprite = resolveTileSprite(tile)
	let drewSprite = false
	if (tileSprite && tileSprite.complete && tileSprite.naturalWidth > 0) {
		ctx.drawImage(tileSprite, center.x - tileW / 2, center.y - tileH / 2, tileW, 64)
		drewSprite = true
	}

	// Top Rhombus Face (Fallback if no sprite)
	if (!drewSprite) {
		let fillColor = '#3c5a3e'
		let strokeColor = '#2d4530'

		if (tile.type === 'soil') {
			fillColor = '#5c4033'
			strokeColor = '#422c22'
		} else if (tile.type === 'stone_terrace' || tile.type === 'stone_tile') {
			fillColor = '#606b7d'
			strokeColor = '#4a5363'
		} else if (tile.type === 'wood_planks') {
			fillColor = '#6d5234'
			strokeColor = '#4e3a24'
		} else if (tile.type === 'stairs') {
			fillColor = '#727e94'
			strokeColor = '#556073'
		} else if (tile.type === 'stone_wall') {
			fillColor = '#3f4756'
			strokeColor = '#2b313d'
		} else if (tile.type === 'lava' || tile.type === 'fire') {
			fillColor = '#ea580c'
			strokeColor = '#c2410c'
		} else if (tile.type === 'water') {
			fillColor = '#0284c7'
			strokeColor = '#0369a1'
		} else if (tile.type === 'ice') {
			fillColor = '#bae6fd'
			strokeColor = '#7dd3fc'
		}

		// Height Tinting if enabled
		if (props.showHeights) {
			if (z === 0) fillColor = '#2f855a'
			else if (z === 1) fillColor = '#3182ce'
			else if (z >= 2) fillColor = '#805ad5'
		}

		ctx.fillStyle = fillColor
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()
	}

	if (props.showGrid) {
		ctx.strokeStyle = drewSprite ? 'rgba(255, 255, 255, 0.14)' : (tile.type === 'soil' ? '#422c22' : '#2d4530')
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.stroke()
	}

	// Reachable Highlight (Sword of Convallaria style gold diamond glow)
	const isReachable = !player.value.isMoving && reachableTileSet.value.has(`${tile.x},${tile.y}`)
	if (isReachable) {
		ctx.fillStyle = 'rgba(246, 196, 69, 0.22)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = '#f6c445'
		ctx.lineWidth = 1.5
		ctx.stroke()
	}

	// Exit Marker on Tile (if tile is an exit trigger)
	const isExitTile = (props.locationData?.exits || []).some(
		(e) => e.trigger && e.trigger.x === tile.x && e.trigger.y === tile.y
	)
	if (isExitTile) {
		ctx.fillStyle = 'rgba(234, 179, 8, 0.22)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = '#eab308'
		ctx.lineWidth = 1.5
		ctx.stroke()

		ctx.font = '13px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText('🚪', center.x, center.y - 2)
	}

	// Planned Path Highlight (2-click movement preview)
	const isPlannedStep = !player.value.isMoving && plannedPathSet.value.has(`${tile.x},${tile.y}`)
	if (isPlannedStep) {
		const isDestination =
			selectedDestinationTile.value &&
			selectedDestinationTile.value.x === tile.x &&
			selectedDestinationTile.value.y === tile.y

		ctx.fillStyle = isDestination ? 'rgba(56, 189, 248, 0.35)' : 'rgba(56, 189, 248, 0.2)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = isDestination ? '#ffffff' : '#38bdf8'
		ctx.lineWidth = isDestination ? 2 : 1.2
		ctx.stroke()
	}

	// Hover & Brush Highlight
	const inBrush = activeBrushCellSet.value.has(`${tile.x},${tile.y}`)
	const isCenter = hoveredTile.value && hoveredTile.value.x === tile.x && hoveredTile.value.y === tile.y
	if (inBrush) {
		ctx.fillStyle = isCenter ? 'rgba(255, 255, 255, 0.28)' : 'rgba(56, 189, 248, 0.18)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = isCenter ? '#ffffff' : 'rgba(56, 189, 248, 0.75)'
		ctx.lineWidth = isCenter ? 2 : 1
		ctx.stroke()
	}

	// Selected Tile Highlight (Editor Inspector Selection - Cyan glow)
	if (props.selectedTile && props.selectedTile.x === tile.x && props.selectedTile.y === tile.y) {
		ctx.fillStyle = 'rgba(56, 189, 248, 0.28)'
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fill()

		ctx.strokeStyle = '#38bdf8'
		ctx.lineWidth = 2.5
		ctx.stroke()
	}

	// Show Coordinates (X, Y, Z)
	if (props.showCoords) {
		ctx.font = '10px sans-serif'
		ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(`${tile.x},${tile.y},${z}`, center.x, center.y)
	}

	// Origin Center Marker (0, 0)
	if (tile.x === 0 && tile.y === 0 && props.showCenterMarker) {
		ctx.save()
		ctx.beginPath()
		ctx.arc(center.x, center.y, 3.5, 0, Math.PI * 2)
		ctx.fillStyle = '#f6c445'
		ctx.shadowColor = '#f6c445'
		ctx.shadowBlur = 5
		ctx.fill()
		ctx.restore()
	}
}

// Wall Drawing
function drawWall(ctx, wall, edge, tileX, tileY, tileZ, tileW, tileH, heightStep) {
	// Try sprite wall first
	const wallSprite = resolveWallSprite(edge, wall)
	if (wallSprite && wallSprite.complete && wallSprite.naturalWidth > 0) {
		const center = gridToScreen(tileX, tileY, tileZ, 0, 0, tileW, tileH, heightStep)
		ctx.drawImage(wallSprite, center.x - tileW / 2, center.y - 112, 64, 128)
		return
	}

	const poly = getWallPolygon(
		tileX,
		tileY,
		tileZ,
		edge,
		wall.height || DEFAULT_WALL_HEIGHT,
		0,
		0,
		tileW,
		tileH,
		heightStep
	)

	const isLit = edge === 'NE' || edge === 'SE'
	let fillColor = isLit ? '#64748b' : '#475569'
	let strokeColor = isLit ? '#475569' : '#334155'

	if (wall.type === 'wood_wall' || wall.type === 'wood') {
		fillColor = isLit ? '#8b6c47' : '#6d5234'
		strokeColor = isLit ? '#6d5234' : '#4e3a24'
	} else if (wall.type === 'fence') {
		fillColor = isLit ? '#a07850' : '#7d5d3c'
		strokeColor = isLit ? '#6e4f31' : '#523a23'
	}

	// Quad body
	ctx.beginPath()
	ctx.moveTo(poly[0].x, poly[0].y)
	ctx.lineTo(poly[1].x, poly[1].y)
	ctx.lineTo(poly[2].x, poly[2].y)
	ctx.lineTo(poly[3].x, poly[3].y)
	ctx.closePath()
	ctx.fillStyle = fillColor
	ctx.fill()
	ctx.strokeStyle = strokeColor
	ctx.lineWidth = 1.5
	ctx.stroke()

	// Wall details: horizontal stone / wood seam
	ctx.save()
	ctx.strokeStyle = 'rgba(0, 0, 0, 0.18)'
	ctx.lineWidth = 1
	const mid0 = { x: (poly[0].x + poly[3].x) / 2, y: (poly[0].y + poly[3].y) / 2 }
	const mid1 = { x: (poly[1].x + poly[2].x) / 2, y: (poly[1].y + poly[2].y) / 2 }
	ctx.beginPath()
	ctx.moveTo(mid0.x, mid0.y)
	ctx.lineTo(mid1.x, mid1.y)
	ctx.stroke()
	ctx.restore()

	// Door rendering if edge has door property
	if (wall.door) {
		drawDoor(ctx, poly, wall, isLit)
	}
}

function drawDoor(ctx, poly, wall, isLit) {
	const t0 = poly[0]
	const t1 = poly[1]
	const b1 = poly[2]
	const b0 = poly[3]

	// Interpolate door frame (middle 50% width, 80% height)
	const leftTop = {
		x: t0.x * 0.75 + t1.x * 0.25,
		y: (t0.y * 0.75 + t1.y * 0.25) * 0.8 + (b0.y * 0.75 + b1.y * 0.25) * 0.2
	}
	const rightTop = {
		x: t0.x * 0.25 + t1.x * 0.75,
		y: (t0.y * 0.25 + t1.y * 0.75) * 0.8 + (b0.y * 0.25 + b1.y * 0.75) * 0.2
	}
	const rightBottom = {
		x: b0.x * 0.25 + b1.x * 0.75,
		y: b0.y * 0.25 + b1.y * 0.75
	}
	const leftBottom = {
		x: b0.x * 0.75 + b1.x * 0.25,
		y: b0.y * 0.75 + b1.y * 0.25
	}

	ctx.save()
	if (wall.open) {
		// Open doorway: dark interior opening
		ctx.fillStyle = '#11141c'
		ctx.beginPath()
		ctx.moveTo(leftTop.x, leftTop.y)
		ctx.lineTo(rightTop.x, rightTop.y)
		ctx.lineTo(rightBottom.x, rightBottom.y)
		ctx.lineTo(leftBottom.x, leftBottom.y)
		ctx.closePath()
		ctx.fill()
		ctx.strokeStyle = '#2d3748'
		ctx.lineWidth = 1
		ctx.stroke()
	} else {
		// Closed wooden door
		ctx.fillStyle = isLit ? '#a16207' : '#854d0e'
		ctx.beginPath()
		ctx.moveTo(leftTop.x, leftTop.y)
		ctx.lineTo(rightTop.x, rightTop.y)
		ctx.lineTo(rightBottom.x, rightBottom.y)
		ctx.lineTo(leftBottom.x, leftBottom.y)
		ctx.closePath()
		ctx.fill()
		ctx.strokeStyle = '#451a03'
		ctx.lineWidth = 1.5
		ctx.stroke()

		// Door handle
		const handleX = leftBottom.x * 0.35 + rightBottom.x * 0.65
		const handleY = (leftTop.y + leftBottom.y) / 2
		ctx.fillStyle = '#f6c445'
		ctx.beginPath()
		ctx.arc(handleX, handleY, 2, 0, Math.PI * 2)
		ctx.fill()
	}
	ctx.restore()
}

// Recursive Object & Attachment Drawing
function drawObject(ctx, rootObj, tileW, tileH, heightStep) {
	const tileBaseScreen = gridToScreen(rootObj.x, rootObj.y, rootObj.z || 0, 0, 0, tileW, tileH, heightStep)
	drawObjectNode(ctx, rootObj, tileBaseScreen, tileW, tileH, heightStep)
}

function drawObjectNode(ctx, obj, parentScreen, tileW, tileH, heightStep) {
	const currentScreen = getObjectScreenPos(
		parentScreen,
		obj.offsetX || 0,
		obj.offsetY || 0,
		obj.offsetZ || 0,
		tileW,
		tileH,
		heightStep
	)

	renderObjectGraphic(ctx, obj, currentScreen, tileW, tileH, heightStep)

	if (Array.isArray(obj.children) && obj.children.length > 0) {
		const sorted = [...obj.children].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
		for (const child of sorted) {
			drawObjectNode(ctx, child, currentScreen, tileW, tileH, heightStep)
		}
	}
}

function renderObjectGraphic(ctx, obj, pos, tileW, tileH, heightStep) {
	ctx.save()
	ctx.translate(pos.x, pos.y)

	// Horizontal flip for NW / SW orientations
	const isFlipped = obj.facing === 'NW' || obj.facing === 'SW'
	if (isFlipped) {
		ctx.scale(-1, 1)
	}

	if (obj.type === 'weed') {
		if (obj.interactive) {
			ctx.beginPath()
			ctx.arc(0, 0, 14, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(72, 187, 120, 0.25)'
			ctx.fill()
		}
		ctx.font = '22px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText('🌿', 0, 4)
	} else if (obj.type === 'table') {
		ctx.font = '28px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '🪵', 0, 2)
	} else if (obj.type === 'plate') {
		ctx.font = '16px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '🍽️', 0, 2)
	} else if (obj.type === 'food') {
		ctx.font = '14px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '🍗', 0, 2)
	} else if (obj.type === 'candlestick') {
		ctx.save()
		ctx.beginPath()
		ctx.arc(0, -10, 8, 0, Math.PI * 2)
		ctx.fillStyle = 'rgba(251, 191, 36, 0.25)'
		ctx.fill()
		ctx.restore()

		ctx.font = '16px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '🕯️', 0, 2)
	} else if (obj.type === 'barrel') {
		ctx.font = '24px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '🛢️', 0, 2)
	} else if (obj.type === 'well') {
		ctx.font = '36px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '⛲', 0, 6)
	} else if (obj.type === 'chest') {
		ctx.font = '22px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '📦', 0, 2)
	} else {
		ctx.font = '20px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(obj.icon || '📦', 0, 2)
	}

	ctx.restore()
}

// Actor (NPC) Drawing
function drawActor(ctx, actor, tileW, tileH, heightStep) {
	const center = gridToScreen(actor.x, actor.y, actor.z || 0, 0, 0, tileW, tileH, heightStep)

	ctx.save()
	ctx.translate(center.x, center.y)

	// Drop shadow
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
	ctx.beginPath()
	ctx.ellipse(0, 2, 16, 8, 0, 0, Math.PI * 2)
	ctx.fill()

	// Directional Facing Indicator
	drawIsometricFacingIndicator(ctx, {
		facing: actor.facing || 'SE',
		team: 'ally',
		isActive: false,
		radius: 19,
		yOffset: 2
	})

	// Actor Sprite / Icon
	const actorSprite = resolveCharacterSprite(actor.id || 'char')
	const hasSprite = actorSprite && actorSprite.complete && actorSprite.naturalWidth > 0

	// Направления спрайтов временно отключены: персонажи всегда смотрят в одну сторону
	const isFlipped = false
	if (isFlipped) {
		ctx.scale(-1, 1)
	}

	if (hasSprite) {
		ctx.drawImage(actorSprite, -32, -116, 64, 128)
	} else {
		ctx.font = '32px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText(actor.icon || '👤', 0, 0)
	}

	if (isFlipped) {
		ctx.scale(-1, 1)
	}

	// Floating NPC Nameplate
	if (actor.name) {
		const badgeH = 16
		const badgeY = hasSprite ? -124 : -48
		ctx.font = 'bold 9px sans-serif'
		const textMetrics = ctx.measureText(actor.name)
		const badgeW = Math.max(textMetrics.width + 12, 44)

		ctx.fillStyle = 'rgba(16, 20, 28, 0.85)'
		ctx.strokeStyle = '#94a3b8'
		ctx.lineWidth = 1
		ctx.beginPath()
		ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 4)
		ctx.fill()
		ctx.stroke()

		ctx.fillStyle = '#e2e8f0'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(actor.name, 0, badgeY + badgeH / 2)
	}

	ctx.restore()
}

// Player Drawing
function drawPlayer(ctx, p, tileW, tileH, heightStep) {
	const center = gridToScreen(p.x, p.y, p.z, 0, 0, tileW, tileH, heightStep)

	ctx.save()
	ctx.translate(center.x, center.y)

	// Drop shadow
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
	ctx.beginPath()
	ctx.ellipse(0, 2, 16, 8, 0, 0, Math.PI * 2)
	ctx.fill()

	// Directional Facing Indicator
	drawIsometricFacingIndicator(ctx, {
		facing: player.value.facing || 'SE',
		team: 'ally',
		isActive: true,
		radius: 19,
		yOffset: 2
	})

	// Hero Sprite / Icon
	const charSprite = resolveCharacterSprite(props.characterId || 'mc')
	const hasSprite = charSprite && charSprite.complete && charSprite.naturalWidth > 0

	// Направления спрайтов временно отключены: персонажи всегда смотрят в одну сторону
	const isFlipped = false
	if (isFlipped) {
		ctx.scale(-1, 1)
	}

	if (hasSprite) {
		ctx.drawImage(charSprite, -32, -116, 64, 128)
	} else {
		ctx.font = '32px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText('🧙‍♂️', 0, 0)
	}

	if (isFlipped) {
		ctx.scale(-1, 1)
	}

	// Floating Tactical Player Badge (Sword of Convallaria style)
	const isTurnBased = props.movementMode === 'turn-based'
	const badgeW = isTurnBased ? 78 : 60
	const badgeH = isTurnBased ? 20 : 16
	const badgeY = hasSprite ? (isTurnBased ? -128 : -124) : (isTurnBased ? -52 : -48)

	ctx.fillStyle = 'rgba(16, 20, 28, 0.9)'
	ctx.strokeStyle = '#f6c445'
	ctx.lineWidth = 1
	ctx.beginPath()
	ctx.roundRect(-badgeW / 2, badgeY, badgeW, badgeH, 4)
	ctx.fill()
	ctx.stroke()

	if (isTurnBased) {
		ctx.font = 'bold 9px sans-serif'
		ctx.fillStyle = '#60a5fa' // MP blue
		ctx.fillText(`MP ${currentMp.value}`, -badgeW / 4, badgeY + 13)
		ctx.fillStyle = '#f59e0b' // AP orange
		ctx.fillText(`AP ${currentAp.value}`, badgeW / 4, badgeY + 13)
	} else {
		ctx.font = 'bold 9px sans-serif'
		ctx.fillStyle = '#f6c445'
		ctx.fillText('ГГ • 1 УР', 0, badgeY + 12)
	}

	ctx.restore()
}

// Particle System
function drawParticles(ctx) {
	for (let i = particles.value.length - 1; i >= 0; i--) {
		const p = particles.value[i]
		p.x += p.vx
		p.y += p.vy
		p.vy += 0.15 // gravity
		p.life -= 0.03

		if (p.life <= 0) {
			particles.value.splice(i, 1)
			continue
		}

		ctx.save()
		ctx.globalAlpha = p.life
		ctx.fillStyle = p.color
		ctx.beginPath()
		ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
		ctx.fill()
		ctx.restore()
	}
}

function handleResize() {
	updateContainerBounds()
	if (props.initialCenter === 'player') {
		centerCameraOnPlayer()
	} else {
		centerCamera(0, 0, 0)
	}
}

function onKeyDown(e) {
	if (e.code === 'Escape') {
		if (activeContextMenu.value) {
			activeContextMenu.value = null
			return
		}
		if (plannedPath.value.length > 0) {
			plannedPath.value = []
			selectedDestinationTile.value = null
			requestRender()
			return
		}
	}

	if (e.code === 'Space' && !e.repeat) {
		const target = e.target
		if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
		isSpacePressed.value = true
	}
}

function onKeyUp(e) {
	if (e.code === 'Space') {
		isSpacePressed.value = false
		if (camera.value.isDragging && props.mode === 'editor') {
			camera.value.isDragging = false
			requestRender()
		}
	}
}

onMounted(() => {
	updateContainerBounds()
	requestAnimationFrame(() => {
		resetCamera()
	})
	if (containerRef.value && typeof ResizeObserver !== 'undefined') {
		resizeObserver = new ResizeObserver(() => {
			updateContainerBounds()
		})
		resizeObserver.observe(containerRef.value)
	}
	unlistenSprites = onSpriteLoaded(() => {
		requestRender()
	})
	window.addEventListener('resize', handleResize)
	window.addEventListener('keydown', onKeyDown)
	window.addEventListener('keyup', onKeyUp)
})

onUnmounted(() => {
	if (animationFrameId) cancelAnimationFrame(animationFrameId)
	if (resizeObserver) resizeObserver.disconnect()
	if (unlistenSprites) unlistenSprites()
	window.removeEventListener('resize', handleResize)
	window.removeEventListener('keydown', onKeyDown)
	window.removeEventListener('keyup', onKeyUp)
})
</script>

<style scoped>
.iso-canvas-container {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	cursor: grab;
	user-select: none;
}

.iso-canvas-container:active {
	cursor: grabbing;
}

.iso-canvas-container.__is-painting-brush {
	cursor: crosshair;
}

.iso-canvas-container.__is-space-pressed {
	cursor: grab !important;
}

.iso-canvas-container.__is-panning-active {
	cursor: grabbing !important;
}

.iso-canvas {
	width: 100%;
	height: 100%;
	display: block;
}

.iso-action-tooltip {
	position: absolute;
	pointer-events: none;
	background: rgba(14, 18, 26, 0.92);
	border: 1px solid #f6c445;
	border-radius: 0.3em;
	padding: 0.3em 0.6em;
	display: flex;
	align-items: center;
	gap: 0.4em;
	box-shadow: 0 0.25em 0.75em rgba(0, 0, 0, 0.6);
	z-index: 10;
	animation: tooltip-pop 0.2s ease-out;
}

.tooltip-icon {
	font-size: 1.1em;
}

.tooltip-text {
	font-size: 0.85em;
	color: #f6c445;
	font-weight: bold;
	font-family: Kurale, sans-serif;
	white-space: nowrap;
}

@keyframes tooltip-pop {
	from {
		opacity: 0;
		transform: translate(-50%, -100%) scale(0.9);
	}
	to {
		opacity: 1;
		transform: translate(-50%, -100%) scale(1);
	}
}

@keyframes context-menu-fade-in {
	from {
		opacity: 0;
		transform: scale(0.95);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}

.iso-context-menu {
	position: absolute;
	transform-origin: top left;
	background: rgba(14, 18, 26, 0.95);
	border: 1px solid #e2c97e;
	border-radius: 0.4em;
	padding: 0.5em 0.7em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.7);
	z-index: 25;
	animation: context-menu-fade-in 0.12s ease-out;
	min-width: 7.5em;
	pointer-events: auto;
}

.iso-menu-header {
	display: flex;
	align-items: center;
	gap: 0.35em;
	border-bottom: 1px solid rgba(226, 201, 126, 0.3);
	padding-bottom: 0.25em;
}

.iso-menu-icon {
	font-size: 1em;
}

.iso-menu-title {
	font-size: 0.85em;
	color: #e2c97e;
	font-weight: bold;
	font-family: Kurale, sans-serif;
	white-space: nowrap;
}

.iso-menu-actions {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.iso-menu-btn {
	background: rgba(40, 50, 70, 0.8);
	color: #e2e8f0;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.3em;
	padding: 0.3em 0.6em;
	font-size: 0.8em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	text-align: center;
	transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.iso-menu-btn:hover {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #ffffff;
}

.iso-menu-btn-primary {
	background: rgba(34, 197, 94, 0.25);
	border-color: rgba(34, 197, 94, 0.5);
	color: #86efac;
}

.iso-menu-btn-primary:hover {
	background: rgba(34, 197, 94, 0.45);
	border-color: #22c55e;
	color: #ffffff;
}

.iso-menu-btn-cancel {
	background: rgba(239, 68, 68, 0.15);
	border-color: rgba(239, 68, 68, 0.35);
	color: #fca5a5;
}

.iso-menu-btn-cancel:hover {
	background: rgba(239, 68, 68, 0.35);
	border-color: #ef4444;
	color: #ffffff;
}
</style>
