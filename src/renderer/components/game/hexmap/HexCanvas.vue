<template>
	<div
		ref="containerRef"
		class="hex-canvas-container"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@pointerleave="onPointerLeave"
		@contextmenu.prevent="onContextMenu"
	>
		<canvas ref="canvasRef" class="hex-canvas-element"></canvas>
 
		<!-- HTML Div Settlement Name Badges Layer (Scale-independent, Auto-fading, Anti-overlap) -->
		<div class="hex-settlements-layer">
			<div
				v-for="badge in visibleSettlementBadges"
				:key="badge.id"
				class="hex-settlement-badge"
				:class="{
					'__discovered': badge.isDiscovered,
					'__undiscovered': !badge.isDiscovered,
					'__selected': badge.isSelected,
					'__hovered': badge.isHovered,
					'__current': badge.isCurrent
				}"
				:style="{
					left: badge.xPercent + '%',
					top: badge.yPercent + '%',
					opacity: badge.opacity,
					borderColor: badge.isSelected ? '#38bdf8' : (badge.isCurrent ? '#38bdf8' : (badge.isDiscovered ? badge.color : undefined))
				}"
				@click.stop="onSettlementBadgeClick(badge)"
				@pointerenter="onSettlementBadgePointerEnter(badge)"
				@pointerleave="onSettlementBadgePointerLeave"
			>
				<span v-if="badge.isCurrent" class="badge-current-dot" title="Текущее местоположение"></span>
				<span class="badge-icon">{{ badge.icon }}</span>
				<span class="badge-name">{{ badge.displayName }}</span>
				<span v-if="badge.hasLocalMap" class="badge-pin" title="Есть локальная карта">📍</span>
			</div>
		</div>

		<!-- Zoom / Center Controls Overlay -->
		<div class="hex-canvas-overlay-controls">
			<button class="hex-nav-btn" title="Приблизить" @click="zoomIn">➕</button>
			<button class="hex-nav-btn" title="Отдалить" @click="zoomOut">➖</button>
			<button class="hex-nav-btn" title="Сбросить камеру и центрировать" @click="resetCamera">🎯</button>
			<button
				class="hex-nav-btn"
				:class="{ '__active': localShowBorders }"
				:title="localShowBorders ? 'Скрыть границы государств' : 'Показать границы государств'"
				@click="toggleBorders"
			>
				🏳️
			</button>
		</div>

		<!-- Hovered Hex Mini Info Pill (Bottom-Left) -->
		<div v-if="hoveredHexInfo" class="hex-canvas-info-pill">
			<span class="info-coord">⬡ ({{ hoveredHexInfo.col }}, {{ hoveredHexInfo.row }})</span>
			<span class="info-biome">{{ hoveredHexInfo.terrainName }}</span>
			<span v-if="hoveredHexInfo.feature !== 'none'" class="info-feature">
				{{ hoveredHexInfo.featureName }}
			</span>
			<span v-if="hoveredHexInfo.settlement" class="info-settlement">
				🏰 {{ hoveredHexInfo.settlement.name }}
			</span>
			<span v-if="hoveredHexInfo.factionInfo" class="info-faction" :style="{ color: hoveredHexInfo.factionInfo.borderColor }">
				{{ hoveredHexInfo.factionInfo.icon }} {{ hoveredHexInfo.factionInfo.name }}
			</span>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
	screenToHex,
	getClosestEdgeToPoint,
	hexToWorldGroundCenter,
	HexPerspectiveCamera,
	calculateDynamicPitch,
	DEFAULT_HEX_RADIUS,
	DEFAULT_HEX_MIN_ZOOM,
	DEFAULT_HEX_MAX_ZOOM
} from '@/utils/hexmap/hexCoords.js'
import {
	BIOMES,
	SETTLEMENT_TYPES,
	normalizeHexMapData,
	getFactionVisuals
} from '@/utils/hexmap/hexLoader.js'
import { renderHexMap } from '@/utils/hexmap/hexRenderer.js'

const props = defineProps({
	mapData: {
		type: Object,
		required: true
	},
	activeTool: {
		type: String,
		default: 'select'
	},
	activeBiome: {
		type: String,
		default: 'grass'
	},
	activeMountainRadius: {
		type: Number,
		default: 1
	},
	activeRiverWidth: {
		type: Number,
		default: 1
	},
	activeRoadType: {
		type: String,
		default: 'dirt'
	},
	activeSettlementType: {
		type: String,
		default: 'village'
	},
	selectedHex: {
		type: Object,
		default: null
	},
	discoveredLocations: {
		type: [Array, Set],
		default: null
	},
	currentLocation: {
		type: String,
		default: ''
	},
	readOnly: {
		type: Boolean,
		default: false
	},
	pitch: {
		type: Number,
		default: 45
	},
	showBorders: {
		type: Boolean,
		default: true
	},
	factionsMap: {
		type: [Array, Object],
		default: null
	},
	pixelScale: {
		type: Number,
		default: 1
	}
})

const emit = defineEmits([
	'hex-click',
	'hex-hover',
	'edge-click',
	'settlement-click',
	'brush-apply',
	'pitch-change',
	'update:pitch',
	'update:showBorders',
	'borders-toggle'
])

const containerRef = ref(null)
const canvasRef = ref(null)
const canvasWidth = ref(960)
const canvasHeight = ref(540)

watch(() => props.pixelScale, () => {
	resizeCanvas()
	markDirty()
})

// Mark dirty on any external data change that affects rendering
watch(() => props.mapData, markDirty, { deep: false })
watch(() => props.selectedHex, markDirty)
watch(() => props.factionsMap, markDirty)
watch(() => props.discoveredLocations, markDirty)
watch(() => props.activeTool, markDirty)


// Borders State
const localShowBorders = ref(props.showBorders)
watch(() => props.showBorders, (val) => {
	localShowBorders.value = val
	markDirty()
})

function toggleBorders() {
	localShowBorders.value = !localShowBorders.value
	emit('update:showBorders', localShowBorders.value)
	emit('borders-toggle', localShowBorders.value)
	markDirty()
}

// Camera State (3D Perspective with dynamic zoom-pitch coupling: min 0° at 0.5x zoom, max 60° at 3.75x zoom)
const cameraX = ref(0)
const cameraY = ref(0)
const zoom = ref(1.0)
const pitch = ref(
	props.pitch !== undefined && props.pitch !== null
		? Math.max(0, Math.min(60, props.pitch))
		: calculateDynamicPitch(zoom.value)
)
const isDragging = ref(false)
const isTilting = ref(false)
const dragStart = { x: 0, y: 0, camX: 0, camY: 0, pitch: 48 }
const hasMovedSignificantly = ref(false)

watch(() => props.pitch, (newP) => {
	if (newP !== undefined && newP !== null && Math.abs(newP - pitch.value) > 1) {
		pitch.value = Math.max(0, Math.min(60, newP))
		markDirty()
	}
})

// Hover State
const hoveredHex = ref(null)
const hoveredEdge = ref(null)

// Animation Frame
let animationFrameId = null
const animStartTime = performance.now()

// ── Dirty-flag render throttling ─────────────────────────────────────────────
// renderDirty=true → перерисовать в следующем кадре (пан/зум/ховер/resize/данные)
// Анимация воды/рек throttled до ~30fps (каждые 33мс) чтобы не жечь GPU каждые 16мс
let renderDirty = true
const ANIM_FRAME_INTERVAL_MS = 33 // ~30fps для водной анимации
let lastAnimRenderTime = 0

// ── Frame budget guard ────────────────────────────────────────────────────────
// Если предыдущий рендер занял > FRAME_BUDGET_MS, следующий animTick пропускается.
// Это убирает [Violation] 'requestAnimationFrame' handler took Nms при LOD 0.
const FRAME_BUDGET_MS = 14 // ~85% от 16мс бюджета (оставляем запас на composite)
let lastRenderDurationMs = 0

function markDirty() {
	renderDirty = true
}

// Discovered settlements set
const discoveredSet = computed(() => {
	if (!props.discoveredLocations) return null
	if (props.discoveredLocations instanceof Set) return props.discoveredLocations
	return new Set(props.discoveredLocations)
})

const hoveredHexInfo = computed(() => {
	if (!hoveredHex.value) return null
	const c = hoveredHex.value.col
	const r = hoveredHex.value.row
	const cell = props.mapData?.cells?.[`${c},${r}`]
	if (!cell) return null

	const biome = BIOMES[cell.terrain] || BIOMES.grass
	let featureName = ''
	if (cell.feature === 'hills') featureName = 'Холмы'
	else if (cell.feature === 'mountain') {
		featureName = `Гора (R=${cell.mountainRadius || 1})`
	}

	let factionInfo = null
	const fId = cell.faction || cell.fraction
	if (fId) {
		factionInfo = getFactionVisuals(fId, props.factionsMap)
	}

	return {
		col: c,
		row: r,
		terrainName: biome.name,
		feature: cell.feature,
		featureName,
		settlement: cell.settlement,
		factionInfo
	}
})

// Pre-filtered settlement cells list (cached, only recomputed when cells data changes)
const settlementCells = computed(() => {
	if (!props.mapData?.cells) return []
	return Object.values(props.mapData.cells).filter(cell => cell?.settlement)
})

// Scale-independent HTML div settlement badges (auto-fading on zoom out, anti-overlap)
const visibleSettlementBadges = computed(() => {
	if (settlementCells.value.length === 0 || canvasWidth.value <= 0 || canvasHeight.value <= 0) {
		return []
	}

	const scale = Math.max(1, props.pixelScale || 2)
	const radius = props.mapData.hexRadius || DEFAULT_HEX_RADIUS
	const camera = new HexPerspectiveCamera({
		viewportWidth: canvasWidth.value,
		viewportHeight: canvasHeight.value,
		cameraX: cameraX.value,
		cameraY: cameraY.value,
		zoom: zoom.value / scale,
		pitch: pitch.value
	})

	const cw = canvasWidth.value
	const ch = canvasHeight.value
	const horizonY = camera.getHorizonY()
	const candidates = []

	for (const cell of settlementCells.value) {
		const settlement = cell?.settlement
		if (!settlement) continue

		const isDiscovered = !discoveredSet.value || discoveredSet.value.has(settlement.id)

		// 3D Ground Center of the hex
		const center = hexToWorldGroundCenter(cell.col, cell.row, radius)
		const yOffset = cell.feature === 'mountain' ? radius * 0.22 : 0
		const zOffset = cell.feature === 'hills' ? 10 * (radius / 36) : 0

		// Ground anchor point beneath the buildings
		const anchorGroundY = center.y + yOffset + radius * 0.38
		const p = camera.projectTerrain(center.x, anchorGroundY, zOffset)

		// 1. Frustum & Horizon Culling
		if (!p.visible || p.distZ <= 100) continue
		if (p.y < horizonY + 12) continue // Behind or right on the horizon

		// In screen/physical pixels:
		const screenX = p.x * scale
		const screenY = p.y * scale
		const xPercent = (p.x / cw) * 100
		const yPercent = (p.y / ch) * 100

		// Check if inside canvas viewport (with small margin)
		if (xPercent < 2 || xPercent > 98 || yPercent < 2 || yPercent > 98) {
			continue
		}

		// 2. Distance & Zoom-out Culling (Исчезновение при сильном отдалении)
		// p.scale takes into account both perspective distance (distZ) and camera zoom!
		const sc = p.scale * scale
		// If strongly zoomed out or very far back in perspective:
		if (sc < 0.52) {
			continue
		}

		// Smooth opacity transition between 0.52 and 0.72
		let opacity = 1.0
		if (sc < 0.72) {
			opacity = Math.max(0, Math.min(1, (sc - 0.52) / (0.72 - 0.52)))
		}

		const typeDef = SETTLEMENT_TYPES[settlement.type] || SETTLEMENT_TYPES.village
		const isSelected = Boolean(
			props.selectedHex &&
			props.selectedHex.col === cell.col &&
			props.selectedHex.row === cell.row
		)
		const isHovered = Boolean(
			hoveredHex.value &&
			hoveredHex.value.col === cell.col &&
			hoveredHex.value.row === cell.row
		)
		const curLoc = props.currentLocation || ''
		const isCarneActive =
			settlement.id === 'carne_village' &&
			(curLoc.startsWith('carne') || curLoc === 'carne_village')
		const isCurrent = Boolean(
			curLoc &&
			(curLoc === settlement.id || curLoc === settlement.sceneId || isCarneActive)
		)

		// Importance score for anti-collision sorting
		let score = 0
		if (isSelected) score += 2000
		if (isCurrent) score += 1500
		if (isHovered) score += 1000
		if (isDiscovered) score += 100
		const typeScores = {
			walled_city: 80,
			fortress: 60,
			town: 40,
			village: 20,
			camp: 10
		}
		score += typeScores[settlement.type] || 15
		score += sc * 20

		candidates.push({
			id: settlement.id || `settlement_${cell.col}_${cell.row}`,
			col: cell.col,
			row: cell.row,
			cell,
			settlement,
			displayName: isDiscovered ? (settlement.name || typeDef.name) : (props.readOnly ? '???' : (settlement.name || typeDef.name)),
			icon: typeDef.icon || '🏰',
			color: typeDef.color || '#f6c445',
			hasLocalMap: Boolean(settlement.hasLocalMap),
			isDiscovered,
			isSelected,
			isHovered,
			isCurrent,
			screenX,
			screenY,
			xPercent,
			yPercent,
			opacity: isSelected || isHovered || isCurrent ? 1.0 : opacity,
			score
		})
	}

	// 3. Collision / Overlap Prevention Filter (Чтоб не наслаиваться друг на друга)
	// Sort by score descending (highest priority first)
	candidates.sort((a, b) => b.score - a.score)

	const accepted = []
	for (const cand of candidates) {
		let collides = false
		for (const placed of accepted) {
			const dx = Math.abs(cand.screenX - placed.screenX)
			const dy = Math.abs(cand.screenY - placed.screenY)
			// If two badges would overlap horizontally (< 72px) and vertically (< 26px)
			if (dx < 72 && dy < 26) {
				collides = true
				break
			}
		}
		if (!collides) {
			accepted.push(cand)
		}
	}

	return accepted
})

function onSettlementBadgeClick(badge) {
	emit('settlement-click', {
		settlement: badge.settlement,
		col: badge.col,
		row: badge.row
	})
	emit('hex-click', {
		col: badge.col,
		row: badge.row,
		cell: badge.cell,
		event: null
	})
}

function onSettlementBadgePointerEnter(badge) {
	hoveredHex.value = { col: badge.col, row: badge.row }
	emit('hex-hover', { col: badge.col, row: badge.row, cell: badge.cell })
}

function onSettlementBadgePointerLeave() {
	hoveredHex.value = null
}

function getCanvasCoords(event) {
	if (!canvasRef.value) return { x: 0, y: 0 }
	const rect = canvasRef.value.getBoundingClientRect()
	return {
		x: event.clientX - rect.left,
		y: event.clientY - rect.top
	}
}

function clientToWorldCoords(clientX, clientY) {
	const canvas = canvasRef.value
	if (!canvas) return null
	const rect = canvas.getBoundingClientRect()
	if (rect.width === 0 || rect.height === 0) return null

	const scale = Math.max(1, props.pixelScale || 2)

	const scaleX = canvas.width / rect.width
	const scaleY = canvas.height / rect.height

	const mouseCanvasX = (clientX - rect.left) * scaleX
	const mouseCanvasY = (clientY - rect.top) * scaleY

	const camera = new HexPerspectiveCamera({
		viewportWidth: canvas.width,
		viewportHeight: canvas.height,
		cameraX: cameraX.value,
		cameraY: cameraY.value,
		zoom: zoom.value / scale,
		pitch: pitch.value
	})

	return camera.unproject(mouseCanvasX, mouseCanvasY)
}

function onPointerDown(e) {
	// If Right-Click OR Shift+Left-Click: start smooth perspective tilt!
	if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
		isTilting.value = true
		hasMovedSignificantly.value = false
		dragStart.y = e.clientY
		dragStart.pitch = pitch.value
		containerRef.value?.setPointerCapture?.(e.pointerId)
		return
	}

	if (e.button === 1 || e.spaceKey || props.activeTool === 'select' || props.readOnly) {
		isDragging.value = true
		hasMovedSignificantly.value = false
		dragStart.x = e.clientX
		dragStart.y = e.clientY
		dragStart.camX = cameraX.value
		dragStart.camY = cameraY.value
		containerRef.value?.setPointerCapture?.(e.pointerId)
	} else if (e.button === 0) {
		isDragging.value = true
		hasMovedSignificantly.value = false
		dragStart.x = e.clientX
		dragStart.y = e.clientY
		dragStart.camX = cameraX.value
		dragStart.camY = cameraY.value
		containerRef.value?.setPointerCapture?.(e.pointerId)
	}
}

function onPointerMove(e) {
	if (isTilting.value) {
		const dy = e.clientY - dragStart.y
		if (Math.abs(dy) > 3) {
			hasMovedSignificantly.value = true
		}
		const newPitch = Math.max(0, Math.min(60, Math.round(dragStart.pitch - dy * 0.25)))
		pitch.value = newPitch
		emit('pitch-change', pitch.value)
		emit('update:pitch', pitch.value)
		markDirty()
		return
	}

	if (isDragging.value) {
		const dx = e.clientX - dragStart.x
		const dy = e.clientY - dragStart.y
		if (Math.hypot(dx, dy) > 4) {
			hasMovedSignificantly.value = true
			const theta = (pitch.value * Math.PI) / 180
			const cosT = Math.max(0.2, Math.cos(theta))
			cameraX.value = dragStart.camX - dx / zoom.value
			cameraY.value = dragStart.camY - dy / (zoom.value * cosT)
			markDirty()
		}
		// While actively dragging/panning the map, suppress raycast hover and DOM updates
		hoveredHex.value = null
		hoveredEdge.value = null
		return
	}

	const ground = clientToWorldCoords(e.clientX, e.clientY)
	const radius = props.mapData.hexRadius || DEFAULT_HEX_RADIUS

	if (!ground) {
		hoveredHex.value = null
		hoveredEdge.value = null
		return
	}

	const hex = screenToHex(ground.x, ground.y, radius, 1.0)

	// Check bounds
	const minCol = props.mapData.bounds?.minCol ?? 0
	const maxCol = props.mapData.bounds?.maxCol ?? ((props.mapData.cols || 20) - 1)
	const minRow = props.mapData.bounds?.minRow ?? 0
	const maxRow = props.mapData.bounds?.maxRow ?? ((props.mapData.rows || 15) - 1)

	if (hex.col >= minCol && hex.col <= maxCol && hex.row >= minRow && hex.row <= maxRow) {
		const prevCol = hoveredHex.value?.col
		const prevRow = hoveredHex.value?.row
		hoveredHex.value = hex

		if (props.activeTool === 'river') {
			const edgeInfo = getClosestEdgeToPoint(ground.x, ground.y, hex.col, hex.row, radius, 1.0)
			hoveredEdge.value = edgeInfo.edge
		} else {
			hoveredEdge.value = null
		}

		// Only mark dirty if the hovered cell actually changed
		if (hex.col !== prevCol || hex.row !== prevRow) {
			markDirty()
		}

		emit('hex-hover', {
			col: hex.col,
			row: hex.row,
			cell: props.mapData?.cells?.[`${hex.col},${hex.row}`],
			edge: hoveredEdge.value
		})
	} else {
		if (hoveredHex.value !== null) markDirty()
		hoveredHex.value = null
		hoveredEdge.value = null
	}
}

function onPointerUp(e) {
	if (isTilting.value) {
		isTilting.value = false
		containerRef.value?.releasePointerCapture?.(e.pointerId)
		return
	}

	if (!isDragging.value) return
	isDragging.value = false
	containerRef.value?.releasePointerCapture?.(e.pointerId)

	// If it was a clean click without significant drag
	if (!hasMovedSignificantly.value && hoveredHex.value) {
		const hex = hoveredHex.value
		const cell = props.mapData?.cells?.[`${hex.col},${hex.row}`]

		// Check if clicked settlement
		if (cell?.settlement) {
			emit('settlement-click', {
				settlement: cell.settlement,
				col: hex.col,
				row: hex.row
			})
		}

		if (props.activeTool === 'river' && hoveredEdge.value) {
			emit('edge-click', {
				col: hex.col,
				row: hex.row,
				edge: hoveredEdge.value,
				width: props.activeRiverWidth
			})
		} else {
			emit('hex-click', {
				col: hex.col,
				row: hex.row,
				cell,
				event: e
			})
		}
	}
}

function onPointerLeave() {
	if (hoveredHex.value !== null) markDirty()
	hoveredHex.value = null
	hoveredEdge.value = null
	isDragging.value = false
	isTilting.value = false
}

function applyZoom(newZoom) {
	const clampedZoom = Math.min(DEFAULT_HEX_MAX_ZOOM, Math.max(DEFAULT_HEX_MIN_ZOOM, newZoom))
	zoom.value = clampedZoom
	const newPitch = calculateDynamicPitch(clampedZoom)
	if (newPitch !== pitch.value) {
		pitch.value = newPitch
		emit('pitch-change', pitch.value)
		emit('update:pitch', pitch.value)
	}
	markDirty()
}

function onWheel(e) {
	// Блокируем скролл страницы — listener зарегистрирован с { passive: false }
	e.preventDefault()

	if (e.shiftKey) {
		// Shift + Wheel smoothly tilts perspective angle manually!
		const delta = e.deltaY < 0 ? 3 : -3
		const newPitch = Math.max(0, Math.min(60, pitch.value + delta))
		pitch.value = newPitch
		emit('pitch-change', pitch.value)
		emit('update:pitch', pitch.value)
		markDirty()
		return
	}

	const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85
	applyZoom(zoom.value * zoomFactor)
}

function onContextMenu(e) {
	if (hasMovedSignificantly.value) {
		// Prevent context menu after tilting with right mouse button
		return
	}
	if (hoveredHex.value && !props.readOnly) {
		emit('hex-click', {
			col: hoveredHex.value.col,
			row: hoveredHex.value.row,
			cell: props.mapData?.cells?.[`${hoveredHex.value.col},${hoveredHex.value.row}`],
			isRightClick: true,
			event: e
		})
	}
}

function zoomIn() {
	applyZoom(zoom.value * 1.25)
}

function zoomOut() {
	applyZoom(zoom.value * 0.8)
}

function resetCamera() {
	if (!canvasRef.value || !props.mapData) return
	const radius = props.mapData.hexRadius || DEFAULT_HEX_RADIUS
	const minCol = props.mapData.bounds?.minCol ?? 0
	const maxCol = props.mapData.bounds?.maxCol ?? ((props.mapData.cols || 20) - 1)
	const minRow = props.mapData.bounds?.minRow ?? 0
	const maxRow = props.mapData.bounds?.maxRow ?? ((props.mapData.rows || 15) - 1)

	const centerGround = hexToWorldGroundCenter(
		Math.floor((minCol + maxCol) / 2),
		Math.floor((minRow + maxRow) / 2),
		radius
	)

	zoom.value = 1.0
	pitch.value = calculateDynamicPitch(1.0)
	cameraX.value = centerGround.x
	cameraY.value = centerGround.y
	emit('pitch-change', pitch.value)
	emit('update:pitch', pitch.value)
	markDirty()
}

let offscreenCanvas = null
let offscreenCtx = null

function ensureOffscreen(w, h) {
	if (!offscreenCanvas) {
		offscreenCanvas = document.createElement('canvas')
		offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: false })
	}
	if (offscreenCanvas.width !== w || offscreenCanvas.height !== h) {
		offscreenCanvas.width = w
		offscreenCanvas.height = h
	}
}

function resizeCanvas() {
	const canvas = canvasRef.value
	const container = containerRef.value
	if (!canvas || !container) return

	const rect = container.getBoundingClientRect()
	const targetW = Math.round(rect.width)
	const targetH = Math.round(rect.height)

	if (targetW > 0 && targetH > 0) {
		const scale = Math.max(1, props.pixelScale || 2)
		const internalW = Math.max(1, Math.round(targetW / scale))
		const internalH = Math.max(1, Math.round(targetH / scale))

		// Visible canvas is kept 1:1 with screen/container for crystal-clear sharp pixels
		if (canvas.width !== targetW || canvas.height !== targetH) {
			canvas.width = targetW
			canvas.height = targetH
		}

		ensureOffscreen(internalW, internalH)

		canvasWidth.value = internalW
		canvasHeight.value = internalH
		markDirty()
	}
}

function renderLoop(currentTime) {
	// ── Dirty-flag check ──────────────────────────────────────────────────────
	// Animated elements (rivers, water shimmer) throttled to ~30fps.
	// Everything else renders ONLY when state changed (dirty).
	const timeSinceAnimRender = currentTime - lastAnimRenderTime
	// Frame budget guard: если предыдущий рендер тяжёлый — пропускаем animTick
	const prevFrameHeavy = lastRenderDurationMs > FRAME_BUDGET_MS
	const animTick = !prevFrameHeavy && timeSinceAnimRender >= ANIM_FRAME_INTERVAL_MS

	if (!renderDirty && !animTick) {
		// Nothing changed — skip this frame entirely, reschedule
		animationFrameId = requestAnimationFrame(renderLoop)
		return
	}

	if (!canvasRef.value || !props.mapData) {
		animationFrameId = requestAnimationFrame(renderLoop)
		return
	}
	const mainCtx = canvasRef.value.getContext('2d')
	if (!mainCtx) {
		animationFrameId = requestAnimationFrame(renderLoop)
		return
	}

	// Consume dirty flag
	renderDirty = false
	if (animTick) lastAnimRenderTime = currentTime

	const scale = Math.max(1, props.pixelScale || 2)
	const elapsedSec = (currentTime - animStartTime) / 1000

	ensureOffscreen(canvasWidth.value, canvasHeight.value)
	if (!offscreenCtx) {
		animationFrameId = requestAnimationFrame(renderLoop)
		return
	}

	const _t0 = performance.now()

	// 1. Clear offscreen buffer
	offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height)
	if (offscreenCtx.imageSmoothingEnabled !== undefined) {
		offscreenCtx.imageSmoothingEnabled = false
	}

	// 2. Render entire map at 0.5x resolution into offscreen buffer
	renderHexMap(offscreenCtx, props.mapData, {
		cameraX: cameraX.value,
		cameraY: cameraY.value,
		zoom: zoom.value / scale,
		pitch: pitch.value,
		hoveredHex: hoveredHex.value,
		selectedHex: props.selectedHex,
		hoveredEdge: hoveredEdge.value,
		activeTool: props.activeTool,
		activeRiverWidth: props.activeRiverWidth,
		discoveredLocations: discoveredSet.value,
		drawCanvasBadges: false,
		showBorders: localShowBorders.value,
		factionsMap: props.factionsMap,
		animTime: elapsedSec
	})

	// 3. Blit offscreen buffer to visible canvas with STRICT nearest-neighbor (no blur/smoothing)
	mainCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
	if (mainCtx.imageSmoothingEnabled !== undefined) {
		mainCtx.imageSmoothingEnabled = false
	}
	mainCtx.drawImage(
		offscreenCanvas,
		0, 0, offscreenCanvas.width, offscreenCanvas.height,
		0, 0, canvasRef.value.width, canvasRef.value.height
	)

	// Сохраняем время рендера для frame budget guard следующего кадра
	lastRenderDurationMs = performance.now() - _t0

	animationFrameId = requestAnimationFrame(renderLoop)
}

let resizeObserver = null

onMounted(() => {
	resizeCanvas()
	if (typeof ResizeObserver !== 'undefined' && containerRef.value) {
		resizeObserver = new ResizeObserver(() => {
			resizeCanvas()
		})
		resizeObserver.observe(containerRef.value)
	}
	window.addEventListener('resize', resizeCanvas)
	// Wheel зарегистрирован вручную с { passive: false } чтобы:
	//  1. Подавить Chrome Violation "non-passive event listener" (Vue @wheel.prevent не может это)
	//  2. Сохранить возможность вызывать e.preventDefault() для блокировки скролла страницы
	containerRef.value?.addEventListener('wheel', onWheel, { passive: false })
	resetCamera()
	animationFrameId = requestAnimationFrame(renderLoop)
})

onUnmounted(() => {
	if (resizeObserver) {
		resizeObserver.disconnect()
		resizeObserver = null
	}
	window.removeEventListener('resize', resizeCanvas)
	containerRef.value?.removeEventListener('wheel', onWheel)
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId)
	}
	offscreenCanvas = null
	offscreenCtx = null
})

defineExpose({
	resetCamera,
	zoomIn,
	zoomOut
})
</script>

<style scoped>
.hex-canvas-container {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%);
	user-select: none;
	touch-action: none;
}

.hex-canvas-element {
	display: block;
	width: 100%;
	height: 100%;
	cursor: grab;
	image-rendering: -webkit-optimize-contrast;
	image-rendering: -moz-crisp-edges;
	image-rendering: pixelated;
}

.hex-canvas-element:active {
	cursor: grabbing;
}

.hex-canvas-overlay-controls {
	position: absolute;
	top: 0.8em;
	right: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	z-index: 10;
}

.hex-nav-btn {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f8fafc;
	font-size: 0.9em;
	width: 2.2em;
	height: 2.2em;
	border-radius: 0.3em;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	box-shadow: 0 0.2em 0.5em rgba(0, 0, 0, 0.5);
	transition: all 0.2s ease;
}

.hex-nav-btn:hover {
	background: #334155;
	border-color: #f6c445;
	color: #f6c445;
	transform: translateY(-0.05em);
}

.hex-nav-btn.__active {
	background: #1e293b;
	border-color: #38bdf8;
	color: #38bdf8;
	box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.4);
}

.hex-canvas-info-pill {
	position: absolute;
	bottom: 0.8em;
	left: 0.8em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.3em;
	padding: 0.3em 0.8em;
	display: flex;
	align-items: center;
	gap: 0.6em;
	font-size: 0.8em;
	color: #e2e8f0;
	z-index: 10;
	pointer-events: none;
	backdrop-filter: blur(0.25em);
}

.info-coord {
	color: #f6c445;
	font-weight: bold;
}

.info-biome {
	color: #94a3b8;
}

.info-feature {
	color: #38bdf8;
}

.info-settlement {
	color: #4ade80;
	font-weight: bold;
}

.info-faction {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	font-weight: bold;
	background: rgba(0, 0, 0, 0.25);
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
}

/* HTML Settlement Badges Overlay Layer */
.hex-settlements-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: hidden;
	z-index: 5;
}

.hex-settlement-badge {
	position: absolute;
	transform: translate(-50%, -50%);
	pointer-events: auto;
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.22em 0.55em;
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(246, 196, 69, 0.5);
	border-radius: 0.3em;
	color: #f8fafc;
	font-size: 0.72em;
	font-weight: 600;
	white-space: nowrap;
	box-shadow: 0 0.15em 0.45em rgba(0, 0, 0, 0.65);
	backdrop-filter: blur(0.2em);
	cursor: pointer;
	user-select: none;
	transition: opacity 0.2s ease, transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.hex-settlement-badge:hover,
.hex-settlement-badge.__hovered {
	transform: translate(-50%, -50%) scale(1.08);
	border-color: #f6c445;
	background: rgba(30, 41, 59, 0.96);
	box-shadow: 0 0.25em 0.7em rgba(246, 196, 69, 0.4);
	z-index: 10;
}

.hex-settlement-badge.__selected {
	border-color: #38bdf8;
	box-shadow: 0 0 0.6em rgba(56, 189, 248, 0.6);
	z-index: 12;
}

.hex-settlement-badge.__undiscovered {
	border-color: rgba(148, 163, 184, 0.4);
	color: #94a3b8;
	background: rgba(15, 23, 42, 0.75);
}

.badge-icon {
	font-size: 0.95em;
}

.badge-name {
	letter-spacing: 0.02em;
}

.badge-pin {
	font-size: 0.85em;
	margin-left: 0.1em;
}

.hex-settlement-badge.__current {
	border-color: #38bdf8;
	background: rgba(12, 74, 110, 0.94);
	box-shadow: 0 0 0.8em rgba(56, 189, 248, 0.7), 0 0.2em 0.5em rgba(0, 0, 0, 0.7);
	animation: badge-current-pulse 2s infinite ease-in-out;
	z-index: 15;
}

@keyframes badge-current-pulse {
	0%, 100% {
		box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.6), 0 0.2em 0.5em rgba(0, 0, 0, 0.7);
	}
	50% {
		box-shadow: 0 0 1.2em rgba(56, 189, 248, 1), 0 0.2em 0.5em rgba(0, 0, 0, 0.7);
	}
}

.badge-current-dot {
	display: inline-block;
	width: 0.55em;
	height: 0.55em;
	border-radius: 50%;
	background: #38bdf8;
	box-shadow: 0 0 0.35em #38bdf8;
	margin-right: 0.15em;
}
</style>
