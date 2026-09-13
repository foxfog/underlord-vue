<template>
	<div
		ref="containerRef"
		class="iso-combat-arena"
		:class="{
			'__is-panning': camera.isDragging,
			'__action-mode': Boolean(selectedAction)
		}"
		@mouseenter="updateContainerBounds"
		@mousedown="onMouseDown"
		@mousemove="onMouseMove"
		@mouseup="onMouseUp"
		@mouseleave="onMouseLeave"
		@contextmenu.prevent="onContextMenu"
		@wheel.passive="onWheel"
	>
		<canvas ref="canvasRef" class="arena-canvas" />

		<!-- Tooltip on Unit Hover -->
		<div
			v-if="hoveredUnitTooltip"
			class="hover-unit-tooltip"
			:style="{
				left: tooltipPos.x + 'px',
				top: tooltipPos.y + 'px'
			}"
		>
			<div class="tooltip-header">
				<span class="tooltip-icon">{{ hoveredUnitTooltip.icon }}</span>
				<span class="tooltip-name">{{ hoveredUnitTooltip.name }}</span>
				<span class="tooltip-team-badge" :class="hoveredUnitTooltip.team">
					{{ hoveredUnitTooltip.team === 'ally' ? 'Союзник' : 'Противник' }}
				</span>
			</div>
			<div class="tooltip-stats">
				<div class="stat-row">
					<span>HP:</span>
					<span class="stat-val">{{ hoveredUnitTooltip.hp }}/{{ hoveredUnitTooltip.maxHp }}</span>
				</div>
				<div v-if="hoveredUnitTooltip.maxMp > 0" class="stat-row">
					<span>MP:</span>
					<span class="stat-val">{{ hoveredUnitTooltip.mp }}/{{ hoveredUnitTooltip.maxMp }}</span>
				</div>
				<div class="stat-row">
					<span>AP:</span>
					<span class="stat-val">{{ hoveredUnitTooltip.ap }}/{{ hoveredUnitTooltip.maxAp }}</span>
				</div>
				<div class="stat-row">
					<span>Защита:</span>
					<span class="stat-val">{{ hoveredUnitTooltip.defense }}</span>
				</div>
				<div class="stat-row">
					<span>Взгляд:</span>
					<span class="stat-val">{{ getFacingLabel(hoveredUnitTooltip.facing || (hoveredUnitTooltip.team === 'ally' ? 'NW' : 'SE')) }}</span>
				</div>
				<div class="stat-row">
					<span>Поверхность:</span>
					<span class="stat-val">{{ getUnitTileSurfaceName(hoveredUnitTooltip) }}</span>
				</div>
			</div>
		</div>

		<!-- Tile Tactical Surface Info Card -->
		<div v-if="hoveredTileInfo && !hoveredUnitTooltip" class="hover-tile-card">
			<div class="tile-card-header">
				<span class="tile-card-icon">{{ hoveredTileInfo.icon }}</span>
				<span class="tile-card-title">{{ hoveredTileInfo.name }}</span>
				<span class="tile-card-z">Z: {{ hoveredTileInfo.z }}</span>
				<span class="tile-card-coord">[{{ hoveredTile?.x }}, {{ hoveredTile?.y }}]</span>
			</div>
			<div v-if="hoveredTileInfo.description" class="tile-card-desc">
				{{ hoveredTileInfo.description }}
			</div>
			<div v-if="hoveredTileInfo.obstacle" class="tile-card-obstacle">
				🧱 {{ hoveredTileInfo.obstacle.name }}
			</div>
		</div>

		<!-- Camera reset button -->
		<button class="cam-reset-btn" title="Сбросить камеру к центру" @click="resetCamera">
			🎯
		</button>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import {
	gridToScreen,
	getTilePolygon,
	getWallPolygon,
	pickTileAtScreen,
	getDepthSortKey
} from '@/utils/isometric/isoCoords'
import { findPath, getReachableTiles } from '@/utils/isometric/isoPathfinding'
import {
	resolveCharacterSprite,
	resolveTileSprite,
	resolveWallSprite,
	onSpriteLoaded
} from '@/utils/isometric/isoSprites'
import { normalizeLocationData, loadCatalogs } from '@/utils/isometric/isoLoader'
import { createVfxManager } from '@/utils/combat/combatVfx'
import {
	getTargetableTiles,
	getAreaAffectedTiles,
	getAffectedUnits,
	isTargetInPattern,
	resolveKnockback
} from '@/utils/combat/combatGeometry'
import {
	drawIsometricFacingIndicator,
	getFacingLabel
} from '@/utils/isometric/isoFacing'

const props = defineProps({
	mapId: { type: String, default: 'tests/arena_combat_test' },
	units: { type: Array, required: true },
	activeUnitId: { type: String, default: null },
	selectedAction: { type: Object, default: null },
	moveMode: { type: Boolean, default: false },
	floatingTexts: { type: Array, default: () => [] },
	combatAnimations: { type: Boolean, default: true },
	combatSpeed: { type: Number, default: 1.0 }
})

const emit = defineEmits(['tile-click', 'unit-click', 'move-unit', 'map-loaded'])

const containerRef = ref(null)
const canvasRef = ref(null)

const DEFAULT_ZOOM = 1.35
const camera = ref({
	x: 0,
	y: 0,
	zoom: DEFAULT_ZOOM,
	isDragging: false,
	dragStartX: 0,
	dragStartY: 0,
	hasMovedSinceDown: false
})

const mapData = ref(null)
const tiles = ref([])
const objects = ref([])
const hoveredTile = ref(null)
const hoveredUnitTooltip = ref(null)
const tooltipPos = ref({ x: 0, y: 0 })
const isAnimatingMove = ref(false)

function getUnitTileSurfaceName(unit) {
	if (!unit || unit.x === undefined) return 'Каменный пол'
	const t = tiles.value.find((tile) => tile.x === unit.x && tile.y === unit.y)
	if (!t) return 'Каменный пол'
	if (t.type === 'ice' || t.id?.includes('ice')) return '🧊 Лёд (Скольжение)'
	if (t.type === 'lava' || t.id?.includes('lava') || t.type === 'fire') return '🔥 Лава (Горение)'
	if (t.type === 'water' || t.id?.includes('water')) return '🌊 Вода (Утопление)'
	if (t.type === 'stairs' || t.type?.includes('step')) return '🪜 Ступени (+1 Z)'
	if (t.z && t.z > 0) return `⛰️ Терраса (Z: ${t.z})`
	return '🧱 Каменный пол'
}

const hoveredTileInfo = computed(() => {
	if (!hoveredTile.value) return null
	const t = hoveredTile.value
	const z = t.z || 0

	const obs = objects.value.find((o) => {
		const ox = o.x !== undefined ? o.x : (Array.isArray(o.pos) ? o.pos[0] : null)
		const oy = o.y !== undefined ? o.y : (Array.isArray(o.pos) ? o.pos[1] : null)
		return ox === t.x && oy === t.y
	})

	if (t.type === 'lava' || t.id?.includes('lava') || t.type === 'fire') {
		return {
			icon: '🔥',
			name: 'Раскалённая лава',
			z,
			description: 'Опасная поверхность: наносит 6 урона при входе и накладывает статус горения на 2 хода (-4 HP в начале каждого хода).',
			obstacle: obs
		}
	}
	if (t.type === 'water' || t.id?.includes('water')) {
		return {
			icon: '🌊',
			name: 'Глубокая вода',
			z,
			description: 'Водная поверхность: нелетающие бойцы без навыка плавания мгновенно тонут при попадании. Тушит статус горения.',
			obstacle: obs
		}
	}
	if (t.type === 'ice' || t.id?.includes('ice')) {
		return {
			icon: '🧊',
			name: 'Гладкий лёд',
			z,
			description: 'Скользкая поверхность: при отталкивании цель поскальзывается и скользит на 1 дополнительную клетку дальше.',
			obstacle: obs
		}
	}
	if (t.type === 'stairs' || t.type?.includes('step')) {
		return {
			icon: '🪜',
			name: 'Ступени',
			z,
			description: 'Уступ высотой 1: позволяет наземным юнитам подняться или спуститься на террасу.',
			obstacle: obs
		}
	}
	if (t.type === 'empty' || t.type === 'void' || t.type === 'chasm') {
		return {
			icon: '🌌',
			name: 'Пропасть / Бездна',
			z,
			description: 'Пустота за пределами платформы: падение с обрыва приводит к мгновенной ликвидации (Ring-Out).',
			obstacle: obs
		}
	}
	return {
		icon: z > 0 ? '⛰️' : '🧱',
		name: z > 0 ? `Каменная терраса (+${z} Z)` : 'Каменный пол',
		z,
		description: z > 0 ? `Возвышенность (уровень ${z}). Перепад от 2 уровней вверх блокирует отталкивание как стена, падение вниз наносит урон.` : null,
		obstacle: obs
	}
})

// 2-click Movement Path Preview State
const selectedDestinationTile = ref(null)
const plannedPath = ref([])

const plannedPathSet = computed(() => {
	const set = new Set()
	for (const p of plannedPath.value) {
		set.add(`${p.x},${p.y}`)
	}
	return set
})

const containerRect = {
	left: 0,
	top: 0,
	width: 800,
	height: 600
}

function updateContainerBounds() {
	if (!containerRef.value) return
	const r = containerRef.value.getBoundingClientRect()
	containerRect.left = r.left
	containerRect.top = r.top
	containerRect.width = r.width || containerRef.value.clientWidth || 800
	containerRect.height = r.height || containerRef.value.clientHeight || 600
}

const vfxManager = createVfxManager()
const movingUnits = new Map()
let lastFrameTime = performance.now()

function getUnitVisualPos(unit) {
	const moving = movingUnits.get(unit.id)
	if (moving) {
		return {
			x: moving.currentX,
			y: moving.currentY,
			z: moving.currentZ,
			bob: moving.bob || 0,
			facing: moving.facing,
			fallY: moving.fallY || 0,
			alpha: moving.alpha !== undefined ? moving.alpha : 1.0
		}
	}
	return {
		x: unit.x,
		y: unit.y,
		z: unit.z || 0,
		bob: 0,
		facing: unit.facing,
		fallY: 0,
		alpha: 1.0
	}
}

function updateMovementAnimations(deltaMs) {
	if (movingUnits.size === 0) return

	for (const [unitId, state] of movingUnits.entries()) {
		// Handle Knockback Sliding & Chasm Falling
		if (state.isKnockback) {
			state.elapsed += deltaMs
			const p = Math.min(1, state.elapsed / state.duration)
			state.currentX = state.from.x + (state.to.x - state.from.x) * p
			state.currentY = state.from.y + (state.to.y - state.from.y) * p
			state.currentZ = (state.from.z || 0) + ((state.to.z || 0) - (state.from.z || 0)) * p
			if (state.chasmFall) {
				state.fallY = Math.pow(p, 2) * 80
				state.alpha = Math.max(0, 1 - p * 1.2)
			}
			if (p >= 1) {
				state.resolve()
			}
			continue
		}

		state.stepProgress += deltaMs / state.stepDuration

		if (state.stepProgress >= 1) {
			state.currentStepIndex++
			if (state.currentStepIndex >= state.path.length) {
				state.resolve()
				continue
			}

			// Advance to next step
			state.stepProgress = 0
			state.from = state.to
			state.to = state.path[state.currentStepIndex]
			updateFacing(state, state.from, state.to)
			const actor = props.units.find((u) => u.id === unitId)
			if (actor) actor.facing = state.facing
		}

		const p = Math.min(1, state.stepProgress)
		state.currentX = state.from.x + (state.to.x - state.from.x) * p
		state.currentY = state.from.y + (state.to.y - state.from.y) * p
		state.currentZ = state.from.z + (state.to.z - state.from.z) * p
		state.bob = -Math.sin(p * Math.PI) * 4
	}
}

function updateFacing(state, from, to) {
	if (to.x > from.x) state.facing = 'SE'
	else if (to.x < from.x) state.facing = 'NW'
	else if (to.y > from.y) state.facing = 'SW'
	else if (to.y < from.y) state.facing = 'NE'
}

let moveInterval = null
let renderRequested = false
let animFrameId = null
let unlistenSprites = null
let resizeObserver = null

const activeUnit = computed(() => {
	return props.units.find((u) => u.id === props.activeUnitId) ?? null
})

// Compute reachable tiles for moving active unit
const reachableTiles = computed(() => {
	if (!props.moveMode || isAnimatingMove.value) return []
	const actor = activeUnit.value
	if (!actor || actor.team !== 'ally' || actor.ap < 1) return []
	if (actor.x === undefined || actor.y === undefined) return []

	const livingObstacles = props.units
		.filter((u) => u.hp > 0 && u.id !== actor.id && u.x !== undefined)
		.map((u) => ({ x: u.x, y: u.y, solid: true }))

	const solidObjects = objects.value.filter((o) => o.solid !== false)
	const allObstacles = [...solidObjects, ...livingObstacles]

	return getReachableTiles({
		start: { x: actor.x, y: actor.y, z: actor.z ?? 0 },
		tiles: tiles.value,
		obstacles: allObstacles,
		maxRange: actor.moveRange ?? 3,
		maxClimbHeight: 1
	})
})

const reachableMap = computed(() => {
	const map = new Map()
	for (const t of reachableTiles.value) {
		map.set(`${t.x},${t.y}`, t)
	}
	return map
})

// Compute tiles within range of selected action using combat geometry
const targetableTiles = computed(() => {
	if (!props.selectedAction) return []
	const actor = activeUnit.value
	if (!actor || actor.x === undefined) return []

	return getTargetableTiles(actor, props.selectedAction, tiles.value)
})

const targetableMap = computed(() => {
	const map = new Map()
	for (const t of targetableTiles.value) {
		map.set(`${t.x},${t.y}`, t)
	}
	return map
})

// Compute AoE splash / cleave preview tiles when hovering over a targetable tile
const aoePreviewTiles = computed(() => {
	if (!props.selectedAction || !hoveredTile.value) return []
	const actor = activeUnit.value
	if (!actor || actor.x === undefined) return []
	const hKey = `${hoveredTile.value.x},${hoveredTile.value.y}`
	if (!targetableMap.value.has(hKey)) return []

	const ability = props.selectedAction
	if (!ability.aoeRadius && ability.pattern !== 'cleave' && ability.pattern !== 'line_pierce' && ability.pattern !== 'aoe_point') {
		return []
	}

	return getAreaAffectedTiles(actor, ability, hoveredTile.value, tiles.value)
})

const aoePreviewMap = computed(() => {
	const map = new Map()
	for (const t of aoePreviewTiles.value) {
		map.set(`${t.x},${t.y}`, t)
	}
	return map
})

// Load map data
async function loadMap() {
	try {
		await loadCatalogs()
		const url = `/data/isometric/${props.mapId}.json`
		const resp = await fetch(url)
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
		const raw = await resp.json()
		const normalized = normalizeLocationData(raw)
		mapData.value = normalized
		tiles.value = normalized.tiles || []
		objects.value = normalized.objects || []
		emit('map-loaded', { tiles: tiles.value, objects: objects.value })
	} catch (err) {
		console.warn('[IsoCombatArena] Failed to load map, building fallback arena:', err)
		buildFallbackMap()
	}
	resetCamera()
	requestRender()
}

function buildFallbackMap() {
	const fallbackTiles = []
	for (let x = -5; x <= 5; x++) {
		for (let y = -5; y <= 5; y++) {
			fallbackTiles.push({
				x,
				y,
				z: 0,
				id: 'stone_terrace',
				type: 'stone_terrace',
				walkable: true,
				walls: {}
			})
		}
	}
	tiles.value = fallbackTiles
	objects.value = []
	mapData.value = { tileWidth: 64, tileHeight: 32, heightStep: 16 }
	emit('map-loaded', { tiles: fallbackTiles, objects: [] })
}

function resetCamera() {
	camera.value.x = (containerRect.width || 800) / 2
	camera.value.y = (containerRect.height || 600) / 2 - 20
	camera.value.zoom = DEFAULT_ZOOM
	requestRender()
}

function requestRender() {
	if (renderRequested) return
	renderRequested = true
	animFrameId = requestAnimationFrame(() => {
		renderRequested = false
		render()
	})
}

// Main Render Method
function render() {
	const canvas = canvasRef.value
	const container = containerRef.value
	if (!canvas || !container) return
	const ctx = canvas.getContext('2d')

	const now = performance.now()
	const deltaMs = Math.min(50, now - lastFrameTime)
	lastFrameTime = now

	// Update active VFX and smooth unit movements
	vfxManager.update(deltaMs, props.combatSpeed)
	updateMovementAnimations(deltaMs)

	const viewW = containerRect.width || 800
	const viewH = containerRect.height || 600
	const dpr = window.devicePixelRatio || 1
	const targetW = Math.round(viewW * dpr)
	const targetH = Math.round(viewH * dpr)

	if (canvas.width !== targetW || canvas.height !== targetH) {
		canvas.width = targetW
		canvas.height = targetH
	}

	ctx.save()
	ctx.scale(dpr, dpr)
	ctx.clearRect(0, 0, viewW, viewH)

	// Atmospheric Background Gradient
	const bg = ctx.createLinearGradient(0, 0, 0, viewH)
	bg.addColorStop(0, '#090d16')
	bg.addColorStop(0.6, '#111827')
	bg.addColorStop(1, '#0b0f1a')
	ctx.fillStyle = bg
	ctx.fillRect(0, 0, viewW, viewH)

	// Camera Transform
	ctx.save()
	ctx.translate(camera.value.x, camera.value.y)
	ctx.scale(camera.value.zoom, camera.value.zoom)

	const tileW = mapData.value?.tileWidth || 64
	const tileH = mapData.value?.tileHeight || 32
	const heightStep = mapData.value?.heightStep || 16

	// Build Render Queue sorted by isometric depth
	const renderQueue = []

	// 1. Tiles
	for (const t of tiles.value) {
		const depth = getDepthSortKey(t.x, t.y, t.z || 0, 1)
		renderQueue.push({ type: 'tile', item: t, depth })

		// Walls
		if (t.walls) {
			for (const edge of ['NW', 'NE', 'SW', 'SE']) {
				if (t.walls[edge]) {
					const wallDepth = getDepthSortKey(t.x, t.y, t.z || 0, 2)
					renderQueue.push({
						type: 'wall',
						item: t.walls[edge],
						edge,
						tileX: t.x,
						tileY: t.y,
						tileZ: t.z || 0,
						depth: wallDepth
					})
				}
			}
		}
	}

	// 2. Objects / Props
	for (const obj of objects.value) {
		const ox = obj.x ?? (obj.pos ? obj.pos[0] : 0)
		const oy = obj.y ?? (obj.pos ? obj.pos[1] : 0)
		const oz = obj.z ?? (obj.pos && obj.pos.length > 2 ? obj.pos[2] : 0)
		const depth = getDepthSortKey(ox, oy, oz, 3)
		renderQueue.push({ type: 'object', item: obj, ox, oy, oz, depth })
	}

	// 3. Units (sorted by visual 3D position during smooth movement)
	for (const u of props.units) {
		if (u.x === undefined || u.y === undefined) continue
		const vis = getUnitVisualPos(u)
		const depth = getDepthSortKey(vis.x, vis.y, vis.z || 0, 4)
		renderQueue.push({ type: 'unit', item: u, depth })
	}

	// Sort back-to-front
	renderQueue.sort((a, b) => a.depth - b.depth)

	// Draw Queue
	for (const entry of renderQueue) {
		if (entry.type === 'tile') {
			drawTile(ctx, entry.item, tileW, tileH, heightStep)
		} else if (entry.type === 'wall') {
			drawWall(ctx, entry.item, entry.edge, entry.tileX, entry.tileY, entry.tileZ, tileW, tileH, heightStep)
		} else if (entry.type === 'object') {
			drawObject(ctx, entry.item, entry.ox, entry.oy, entry.oz, tileW, tileH, heightStep)
		} else if (entry.type === 'unit') {
			drawUnit(ctx, entry.item, tileW, tileH, heightStep)
		}
	}

	// 4. Planned Movement Trail (2-click movement preview)
	if (plannedPath.value.length > 0 && !isAnimatingMove.value) {
		drawPlannedPath(ctx, tileW, tileH, heightStep)
	}

	// 5. Combat Visual Effects (Projectiles, Heal Beams, Melee Slashes, Sparks)
	vfxManager.render(ctx)

	// 6. Floating Combat Texts (Rendered on top)
	drawFloatingTexts(ctx, tileW, tileH, heightStep)

	ctx.restore() // End Camera Transform
	ctx.restore() // End DPI Scale

	// Continue animation frame if floating texts or animations/VFX are active
	if (
		props.floatingTexts.length > 0 ||
		isAnimatingMove.value ||
		vfxManager.hasActiveEffects() ||
		movingUnits.size > 0
	) {
		requestRender()
	}
}

// Tile Drawing
function drawTile(ctx, tile, tileW, tileH, heightStep) {
	const poly = getTilePolygon(tile.x, tile.y, tile.z || 0, 0, 0, tileW, tileH, heightStep)
	const center = gridToScreen(tile.x, tile.y, tile.z || 0, 0, 0, tileW, tileH, heightStep)

	// Base tile
	const sprite = resolveTileSprite(tile.id || tile.type)
	if (sprite && sprite.complete && sprite.naturalWidth > 0) {
		ctx.drawImage(sprite, center.x - tileW / 2, center.y - tileH / 2, tileW, tileH)
	} else {
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()

		const isLava = tile.type === 'lava' || tile.id?.includes('lava') || tile.type === 'fire'
		const isWater = tile.type === 'water' || tile.id?.includes('water')
		const isIce = tile.type === 'ice' || tile.id?.includes('ice')

		if (isLava) {
			// Warm glowing lava tile
			const now = performance.now()
			const pulse = Math.sin(now * 0.003 + (tile.x + tile.y) * 1.5) * 0.15 + 0.85
			const grad = ctx.createRadialGradient(center.x, center.y, 2, center.x, center.y, tileW * 0.6)
			grad.addColorStop(0, `rgba(251, 146, 60, ${0.9 * pulse})`)
			grad.addColorStop(0.5, `rgba(234, 88, 12, ${0.95 * pulse})`)
			grad.addColorStop(1, 'rgba(153, 27, 27, 0.95)')
			ctx.fillStyle = grad
			ctx.fill()

			ctx.strokeStyle = 'rgba(254, 215, 170, 0.6)'
			ctx.lineWidth = 1.2
			ctx.stroke()

			// Heat flame emblem
			ctx.save()
			ctx.font = `${Math.floor(tileH * 0.44)}px sans-serif`
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.globalAlpha = 0.65 * pulse
			ctx.fillText('🔥', center.x, center.y)
			ctx.restore()
		} else if (isWater) {
			// Translucent azure water tile with wave shimmer
			const now = performance.now()
			const shimmer = Math.sin(now * 0.002 + (tile.x * 2 - tile.y)) * 0.1 + 0.9
			const grad = ctx.createLinearGradient(poly[0].x, poly[0].y, poly[2].x, poly[2].y)
			grad.addColorStop(0, `rgba(56, 189, 248, ${0.75 * shimmer})`)
			grad.addColorStop(1, `rgba(2, 132, 199, ${0.85 * shimmer})`)
			ctx.fillStyle = grad
			ctx.fill()

			ctx.strokeStyle = 'rgba(186, 230, 253, 0.5)'
			ctx.lineWidth = 1
			ctx.stroke()

			// Water ripple emblem
			ctx.save()
			ctx.font = `${Math.floor(tileH * 0.44)}px sans-serif`
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.globalAlpha = 0.55 * shimmer
			ctx.fillText('🌊', center.x, center.y)
			ctx.restore()
		} else if (isIce) {
			// Frosted crystalline ice tile with glossy sheen & facets
			const now = performance.now()
			const glint = Math.sin(now * 0.0015 + (tile.x + tile.y)) * 0.08 + 0.92
			const grad = ctx.createLinearGradient(poly[0].x, poly[0].y, poly[2].x, poly[2].y)
			grad.addColorStop(0, `rgba(224, 242, 254, ${0.9 * glint})`)
			grad.addColorStop(0.5, `rgba(186, 230, 253, ${0.85 * glint})`)
			grad.addColorStop(1, `rgba(147, 197, 253, ${0.92 * glint})`)
			ctx.fillStyle = grad
			ctx.fill()

			// Ice surface specular highlights & facets
			ctx.beginPath()
			ctx.moveTo(poly[0].x, poly[0].y)
			ctx.lineTo(center.x, center.y)
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
			ctx.lineWidth = 1
			ctx.stroke()

			ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
			ctx.lineWidth = 1.2
			ctx.stroke()

			// Ice crystal emblem
			ctx.save()
			ctx.font = `${Math.floor(tileH * 0.44)}px sans-serif`
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.globalAlpha = 0.7 * glint
			ctx.fillText('🧊', center.x, center.y)
			ctx.restore()
		} else {
			// Shading based on elevation
			const z = tile.z || 0
			ctx.fillStyle = z > 0 ? '#374151' : '#1f2937'
			ctx.fill()

			ctx.strokeStyle = '#374151'
			ctx.lineWidth = 1
			ctx.stroke()
		}
	}

	// 0. Hovered Tile Highlight (Soft gold cursor border)
	if (hoveredTile.value && hoveredTile.value.x === tile.x && hoveredTile.value.y === tile.y) {
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()
		ctx.fillStyle = 'rgba(246, 196, 69, 0.15)'
		ctx.fill()
		ctx.strokeStyle = '#f6c445'
		ctx.lineWidth = 1.5
		ctx.stroke()
	}

	const key = `${tile.x},${tile.y}`

	// Tactical Range Highlights (Sword of Convallaria style)
	// 1. Movement Range (Blue diamond glow) & Planned Path Preview
	if (reachableMap.value.has(key)) {
		const isDestination =
			selectedDestinationTile.value &&
			selectedDestinationTile.value.x === tile.x &&
			selectedDestinationTile.value.y === tile.y
		const isPlannedStep = !isAnimatingMove.value && plannedPathSet.value.has(key)

		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()

		if (isPlannedStep) {
			ctx.fillStyle = isDestination ? 'rgba(56, 189, 248, 0.55)' : 'rgba(56, 189, 248, 0.38)'
			ctx.strokeStyle = isDestination ? '#ffffff' : '#38bdf8'
			ctx.lineWidth = isDestination ? 2 : 1.2
		} else {
			ctx.fillStyle = 'rgba(56, 189, 248, 0.32)'
			ctx.strokeStyle = '#38bdf8'
			ctx.lineWidth = 1.5
		}
		ctx.fill()
		ctx.stroke()
	}

	// 2. Action Range (Red for enemy attack, Green for ally heal)
	if (targetableMap.value.has(key)) {
		const targetEntry = targetableMap.value.get(key)
		const isHeal = targetEntry.type === 'ally'
		const isSelf = targetEntry.type === 'self'

		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()

		if (isSelf) {
			ctx.fillStyle = 'rgba(234, 179, 8, 0.3)'
			ctx.strokeStyle = '#eab308'
		} else if (isHeal) {
			ctx.fillStyle = 'rgba(34, 197, 94, 0.32)'
			ctx.strokeStyle = '#22c55e'
		} else {
			ctx.fillStyle = 'rgba(239, 68, 68, 0.32)'
			ctx.strokeStyle = '#ef4444'
		}
		ctx.fill()
		ctx.lineWidth = 1.5
		ctx.stroke()
	}

	// 2.5 AoE Splash / Cleave Preview (Bright Amber/Orange pulse on area affected)
	if (aoePreviewMap.value.has(key)) {
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()

		ctx.fillStyle = 'rgba(249, 115, 22, 0.45)'
		ctx.strokeStyle = '#f97316'
		ctx.lineWidth = 2
		ctx.fill()
		ctx.stroke()
	}

	// 3. Hovered Tile Cursor
	if (hoveredTile.value && hoveredTile.value.x === tile.x && hoveredTile.value.y === tile.y) {
		ctx.beginPath()
		ctx.moveTo(poly[0].x, poly[0].y)
		ctx.lineTo(poly[1].x, poly[1].y)
		ctx.lineTo(poly[2].x, poly[2].y)
		ctx.lineTo(poly[3].x, poly[3].y)
		ctx.closePath()

		ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
		ctx.fill()
		ctx.strokeStyle = '#ffffff'
		ctx.lineWidth = 2
		ctx.stroke()
	}
}

// Wall Drawing
function drawWall(ctx, wall, edge, tileX, tileY, tileZ, tileW, tileH, heightStep) {
	const sprite = resolveWallSprite(edge, wall)
	if (sprite && sprite.complete && sprite.naturalWidth > 0) {
		const center = gridToScreen(tileX, tileY, tileZ, 0, 0, tileW, tileH, heightStep)
		ctx.drawImage(sprite, center.x - tileW / 2, center.y - 112, 64, 128)
		return
	}

	const poly = getWallPolygon(tileX, tileY, tileZ, edge, 1.5, 0, 0, tileW, tileH, heightStep)
	ctx.beginPath()
	ctx.moveTo(poly[0].x, poly[0].y)
	ctx.lineTo(poly[1].x, poly[1].y)
	ctx.lineTo(poly[2].x, poly[2].y)
	ctx.lineTo(poly[3].x, poly[3].y)
	ctx.closePath()

	const isLit = edge === 'NE' || edge === 'SE'
	ctx.fillStyle = isLit ? '#64748b' : '#475569'
	ctx.fill()
	ctx.strokeStyle = '#334155'
	ctx.lineWidth = 1
	ctx.stroke()
}

// Object / Prop Drawing
function drawObject(ctx, obj, ox, oy, oz, tileW, tileH, heightStep) {
	const center = gridToScreen(ox, oy, oz, 0, 0, tileW, tileH, heightStep)
	ctx.save()
	ctx.translate(center.x, center.y)

	// Prop shadow
	ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
	ctx.beginPath()
	ctx.ellipse(0, 2, 14, 7, 0, 0, Math.PI * 2)
	ctx.fill()

	ctx.font = '22px sans-serif'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'bottom'
	ctx.fillText(obj.icon || '📦', 0, 2)
	ctx.restore()
}

// Unit Drawing (Allies & Enemies with Sword of Convallaria Overhead Bars)
function drawUnit(ctx, unit, tileW, tileH, heightStep) {
	const vis = getUnitVisualPos(unit)
	const center = gridToScreen(vis.x, vis.y, vis.z || 0, 0, 0, tileW, tileH, heightStep)
	const isDead = unit.hp <= 0
	const isActive = props.activeUnitId === unit.id
	const isAlly = unit.team === 'ally'
	const flinch = vfxManager.getUnitFlinch(unit.id)

	ctx.save()
	if (vis.alpha !== undefined) {
		ctx.globalAlpha = Math.max(0, Math.min(1, vis.alpha))
	}
	ctx.translate(center.x + flinch.offsetX, center.y + flinch.offsetY + (vis.bob || 0) + (vis.fallY || 0))

	if (isDead) {
		// Tombstone / Fallen marker
		ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'
		ctx.beginPath()
		ctx.ellipse(0, 2, 12, 6, 0, 0, Math.PI * 2)
		ctx.fill()
		ctx.font = '18px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'bottom'
		ctx.fillText('💀', 0, 0)
		ctx.restore()
		return
	}

	// 1. Feet Shadow
	ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
	ctx.beginPath()
	ctx.ellipse(0, 2, 16, 8, 0, 0, Math.PI * 2)
	ctx.fill()

	// 2. Tactical Facing Indicator (Directional Arrow + Ground Ring + Rear Notch)
	const facing = vis.facing || unit.facing || (isAlly ? 'NW' : 'SE')
	const isTargetable = targetableMap.value.has(`${unit.x},${unit.y}`)
	const isHovered = hoveredUnitTooltip.value?.id === unit.id

	drawIsometricFacingIndicator(ctx, {
		facing,
		team: unit.team,
		isActive,
		isTargetable,
		isHovered,
		radius: 19,
		yOffset: 2,
		drawRing: true,
		drawRearNotch: true
	})

	// 3. Active Unit Ground Ring (Pulsing Gold)
	if (isActive) {
		ctx.save()
		ctx.beginPath()
		ctx.ellipse(0, 2, 20, 10, 0, 0, Math.PI * 2)
		ctx.strokeStyle = '#f6c445'
		ctx.lineWidth = 2.5
		ctx.shadowColor = '#f6c445'
		ctx.shadowBlur = 8
		ctx.stroke()
		ctx.restore()
	}

	// 4. Valid Target Ground Ring
	if (isTargetable && !isActive) {
		const isHeal = props.selectedAction?.targetType === 'ally'
		ctx.save()
		ctx.beginPath()
		ctx.ellipse(0, 2, 19, 9.5, 0, 0, Math.PI * 2)
		ctx.strokeStyle = isHeal ? '#22c55e' : '#ef4444'
		ctx.lineWidth = 2
		ctx.shadowColor = isHeal ? '#22c55e' : '#ef4444'
		ctx.shadowBlur = 6
		ctx.stroke()
		ctx.restore()
	}

	// 4. Sprite or Tactical Token
	const spriteKey = unit.sprite || unit.character || unit.characterId || unit.id
	const allowFallback = spriteKey === 'mc' || spriteKey === 'char'
	const sprite = resolveCharacterSprite(spriteKey, { allowFallback })
	const hasSprite = sprite && sprite.complete && sprite.naturalWidth > 0

	// Направления спрайтов временно отключены: персонажи всегда смотрят в одну сторону
	const isFlipped = false

	if (isFlipped) ctx.scale(-1, 1)

	if (hasSprite) {
		ctx.drawImage(sprite, -32, -100, 64, 112)
	} else {
		// Tactical Miniature Token
		ctx.save()
		const grad = ctx.createRadialGradient(0, -18, 4, 0, -18, 18)
		if (isAlly) {
			grad.addColorStop(0, '#38bdf8')
			grad.addColorStop(1, '#0369a1')
		} else {
			grad.addColorStop(0, '#f87171')
			grad.addColorStop(1, '#991b1b')
		}
		ctx.fillStyle = grad
		ctx.beginPath()
		ctx.arc(0, -18, 17, 0, Math.PI * 2)
		ctx.fill()

		ctx.strokeStyle = isAlly ? '#e0f2fe' : '#fee2e2'
		ctx.lineWidth = 2
		ctx.stroke()

		// Icon inside token
		ctx.font = '18px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'
		ctx.fillText(unit.icon || '👤', 0, -17)
		ctx.restore()
	}

	// Damage flash overlay
	if (flinch.flashAlpha > 0) {
		ctx.save()
		ctx.globalAlpha = Math.min(0.75, flinch.flashAlpha)
		ctx.fillStyle = '#ef4444'
		ctx.beginPath()
		if (hasSprite) {
			ctx.ellipse(0, -45, 26, 48, 0, 0, Math.PI * 2)
		} else {
			ctx.arc(0, -18, 17, 0, Math.PI * 2)
		}
		ctx.fill()
		ctx.restore()
	}

	if (isFlipped) ctx.scale(-1, 1)

	// 5. Overhead Tactical HUD (Name + HP Bar + Statuses)
	const hudY = hasSprite ? -108 : -46
	const barW = 38
	const barH = 5

	// Name Badge
	ctx.font = 'bold 10px sans-serif'
	ctx.textAlign = 'center'
	ctx.textBaseline = 'bottom'
	ctx.fillStyle = '#ffffff'
	ctx.shadowColor = 'rgba(0, 0, 0, 0.85)'
	ctx.shadowBlur = 3
	ctx.fillText(unit.name, 0, hudY - 4)
	ctx.shadowBlur = 0

	// HP Bar Background
	ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
	ctx.lineWidth = 1
	ctx.beginPath()
	ctx.roundRect(-barW / 2, hudY, barW, barH, 2)
	ctx.fill()
	ctx.stroke()

	// HP Bar Fill
	const hpRatio = unit.maxHp > 0 ? Math.max(0, Math.min(1, unit.hp / unit.maxHp)) : 0
	ctx.fillStyle = isAlly ? '#10b981' : '#ef4444'
	ctx.beginPath()
	ctx.roundRect(-barW / 2 + 0.5, hudY + 0.5, Math.max(0, (barW - 1) * hpRatio), barH - 1, 1.5)
	ctx.fill()

	// Status Badges (Defended, Evading, Stunned, Burning)
	if (unit.statuses && unit.statuses.length > 0) {
		const statusText = unit.statuses
			.map((s) => {
				const id = typeof s === 'string' ? s : s.id
				return id === 'defended' ? '🛡️' : id === 'evading' ? '💨' : id === 'stunned' ? '🪃' : id === 'burning' ? '🔥' : '✨'
			})
			.join('')
		ctx.font = '11px sans-serif'
		ctx.fillText(statusText, 0, hudY - 16)
	}

	ctx.restore()
}

// Floating Combat Texts (FCT)
function drawFloatingTexts(ctx, tileW, tileH, heightStep) {
	if (!props.floatingTexts || props.floatingTexts.length === 0) return

	const now = Date.now()
	for (const ft of props.floatingTexts) {
		const targetUnit = props.units.find((u) => u.id === ft.unitId)
		if (!targetUnit || targetUnit.x === undefined) continue

		const center = gridToScreen(targetUnit.x, targetUnit.y, targetUnit.z || 0, 0, 0, tileW, tileH, heightStep)
		const elapsed = now - (ft.timestamp || now)
		const progress = Math.min(1, elapsed / 1300)

		const floatY = -55 - progress * 40
		const alpha = 1 - Math.pow(progress, 2)

		ctx.save()
		ctx.translate(center.x, center.y + floatY)
		ctx.globalAlpha = Math.max(0, alpha)

		ctx.font = 'bold 16px sans-serif'
		ctx.textAlign = 'center'
		ctx.textBaseline = 'middle'

		// Text color
		let textColor = '#f87171' // Damage red
		if (ft.type === 'heal') textColor = '#4ade80' // Heal green
		if (ft.type === 'status') textColor = '#facc15' // Status gold

		// Outline for readability
		ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)'
		ctx.lineWidth = 3
		ctx.strokeText(ft.text, 0, 0)

		ctx.fillStyle = textColor
		ctx.fillText(ft.text, 0, 0)

		ctx.restore()
	}
}

// Mouse Events
function updateTooltip(e) {
	const canvas = canvasRef.value
	const container = containerRef.value
	if (!canvas || !container) return

	const screenX = (e.clientX - containerRect.left - camera.value.x) / camera.value.zoom
	const screenY = (e.clientY - containerRect.top - camera.value.y) / camera.value.zoom

	const tileW = mapData.value?.tileWidth || 64
	const tileH = mapData.value?.tileHeight || 32
	const heightStep = mapData.value?.heightStep || 16

	const picked = pickTileAtScreen(screenX, screenY, tiles.value, 0, 0, tileW, tileH, heightStep)
	hoveredTile.value = picked

	if (picked) {
		const unit = props.units.find((u) => u.hp > 0 && u.x === picked.x && u.y === picked.y)
		if (unit) {
			hoveredUnitTooltip.value = unit
			tooltipPos.value = {
				x: Math.min(e.clientX - containerRect.left + 15, (containerRect.width || 800) - 150),
				y: Math.max(10, e.clientY - containerRect.top - 70)
			}
		} else {
			hoveredUnitTooltip.value = null
		}
	} else {
		hoveredUnitTooltip.value = null
	}
	requestRender()
}

function onMouseDown(e) {
	if (e.button === 1 || e.button === 2) {
		// Middle or Right click: Pan
		camera.value.isDragging = true
		camera.value.dragStartX = e.clientX - camera.value.x
		camera.value.dragStartY = e.clientY - camera.value.y
		camera.value.hasMovedSinceDown = false
	} else if (e.button === 0) {
		camera.value.dragStartX = e.clientX
		camera.value.dragStartY = e.clientY
		camera.value.hasMovedSinceDown = false
	}
}

function onMouseMove(e) {
	if (camera.value.isDragging) {
		camera.value.x = e.clientX - camera.value.dragStartX
		camera.value.y = e.clientY - camera.value.dragStartY
		camera.value.hasMovedSinceDown = true
		requestRender()
		return
	}

	if (e.buttons === 1) {
		const dx = Math.abs(e.clientX - camera.value.dragStartX)
		const dy = Math.abs(e.clientY - camera.value.dragStartY)
		if (dx > 5 || dy > 5) {
			camera.value.isDragging = true
			camera.value.dragStartX = e.clientX - camera.value.x
			camera.value.dragStartY = e.clientY - camera.value.y
			camera.value.hasMovedSinceDown = true
			return
		}
	}

	updateTooltip(e)
}

function onMouseUp(e) {
	if (camera.value.isDragging) {
		camera.value.isDragging = false
		return
	}

	if (e.button === 0 && !camera.value.hasMovedSinceDown) {
		handleCanvasClick(e)
	}
}

function onMouseLeave() {
	camera.value.isDragging = false
	hoveredTile.value = null
	hoveredUnitTooltip.value = null
	requestRender()
}

function onContextMenu(e) {
	// Right click cancels planned movement path or selected action
	camera.value.isDragging = false
	if (plannedPath.value.length > 0) {
		selectedDestinationTile.value = null
		plannedPath.value = []
		requestRender()
	}
}

function onWheel(e) {
	const zoomFactor = e.deltaY < 0 ? 1.1 : 0.91
	const newZoom = Math.min(2.2, Math.max(0.7, camera.value.zoom * zoomFactor))
	camera.value.zoom = newZoom
	requestRender()
}

// Draw connecting trail line and destination marker for 2-click movement
function drawPlannedPath(ctx, tileW, tileH, heightStep) {
	const path = plannedPath.value
	const actor = activeUnit.value
	if (!path || path.length === 0 || !actor) return

	ctx.save()

	// 1. Connecting dotted path line from actor to each step
	const pStart = gridToScreen(
		actor.x,
		actor.y,
		actor.z || 0,
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

// Click Handling
function handleCanvasClick(e) {
	if (isAnimatingMove.value) return
	const container = containerRef.value
	if (!container) return

	const screenX = (e.clientX - containerRect.left - camera.value.x) / camera.value.zoom
	const screenY = (e.clientY - containerRect.top - camera.value.y) / camera.value.zoom

	const tileW = mapData.value?.tileWidth || 64
	const tileH = mapData.value?.tileHeight || 32
	const heightStep = mapData.value?.heightStep || 16

	const picked = pickTileAtScreen(screenX, screenY, tiles.value, 0, 0, tileW, tileH, heightStep)
	if (!picked) return

	const clickedUnit = props.units.find((u) => u.hp > 0 && u.x === picked.x && u.y === picked.y)

	// 1. If an action is selected:
	if (props.selectedAction) {
		selectedDestinationTile.value = null
		plannedPath.value = []
		if (clickedUnit) {
			emit('unit-click', clickedUnit)
		} else {
			emit('tile-click', picked)
		}
		return
	}

	// 2. If in move mode and clicked on a reachable tile:
	if (props.moveMode && reachableMap.value.has(`${picked.x},${picked.y}`)) {
		const actor = activeUnit.value
		if (actor && actor.ap >= 1) {
			const isSameTarget =
				selectedDestinationTile.value &&
				selectedDestinationTile.value.x === picked.x &&
				selectedDestinationTile.value.y === picked.y

			if (isSameTarget && plannedPath.value.length > 0) {
				// Second click on same destination tile: execute movement!
				const pathToWalk = [...plannedPath.value]
				selectedDestinationTile.value = null
				plannedPath.value = []
				animateUnitMovement(actor.id, pathToWalk)
				return
			} else {
				// First click: calculate path and preview
				const livingObstacles = props.units
					.filter((u) => u.hp > 0 && u.id !== actor.id && u.x !== undefined)
					.map((u) => ({ x: u.x, y: u.y, solid: true }))
				const allObstacles = [...objects.value.filter((o) => o.solid !== false), ...livingObstacles]

				const path = findPath({
					start: { x: actor.x, y: actor.y, z: actor.z ?? 0 },
					target: { x: picked.x, y: picked.y, z: picked.z ?? 0 },
					tiles: tiles.value,
					obstacles: allObstacles,
					maxClimbHeight: 1
				})

				if (path && path.length > 0) {
					selectedDestinationTile.value = {
						x: picked.x,
						y: picked.y,
						z: picked.z ?? 0
					}
					plannedPath.value = path
					requestRender()
					return
				}
			}
		}
	}

	// Clicked elsewhere or invalid path: clear planned path
	selectedDestinationTile.value = null
	plannedPath.value = []

	// 3. Otherwise, click on unit or tile
	if (clickedUnit) {
		emit('unit-click', clickedUnit)
	} else {
		emit('tile-click', picked)
	}
	requestRender()
}

// Smooth Unit Movement Animation (Frame-by-frame with walk bob)
function animateUnitMovement(unitId, path) {
	return new Promise((resolve) => {
		if (!path || path.length === 0) {
			resolve()
			return
		}

		const actor = props.units.find((u) => u.id === unitId)
		if (!actor) {
			resolve()
			return
		}

		// If animations are disabled in settings, move instantly
		if (!props.combatAnimations) {
			const dest = path[path.length - 1]
			actor.x = dest.x
			actor.y = dest.y
			actor.z = dest.z || 0
			emit('move-unit', {
				unitId,
				destination: {
					x: dest.x,
					y: dest.y,
					z: dest.z || 0,
					facing: actor.facing
				}
			})
			requestRender()
			resolve()
			return
		}

		isAnimatingMove.value = true
		selectedDestinationTile.value = null
		plannedPath.value = []

		let currentStepIndex = 0
		const from = { x: actor.x, y: actor.y, z: actor.z || 0 }
		const to = path[0]

		const baseStepDuration = 150
		const stepDuration = baseStepDuration / Math.max(0.5, props.combatSpeed || 1.0)

		const state = {
			path,
			from,
			to,
			currentStepIndex,
			stepProgress: 0,
			currentX: from.x,
			currentY: from.y,
			currentZ: from.z,
			bob: 0,
			facing: actor.facing,
			stepDuration,
			resolve: () => {
				isAnimatingMove.value = false
				movingUnits.delete(unitId)
				const dest = path[path.length - 1]
				actor.x = dest.x
				actor.y = dest.y
				actor.z = dest.z || 0
				actor.facing = state.facing
				emit('move-unit', {
					unitId,
					destination: {
						x: dest.x,
						y: dest.y,
						z: dest.z || 0,
						facing: actor.facing
					}
				})
				requestRender()
				resolve()
			}
		}

		updateFacing(state, from, to)
		actor.facing = state.facing

		movingUnits.set(unitId, state)
		requestRender()
	})
}

// Animate quick knockback slide and chasm falling
function animateKnockback({ unitId, from, to, chasmFall = false }) {
	return new Promise((resolve) => {
		if (!props.combatAnimations) {
			const actor = props.units.find((u) => u.id === unitId)
			if (actor) {
				actor.x = to.x
				actor.y = to.y
				actor.z = to.z || 0
			}
			resolve()
			return
		}

		const speed = Math.max(0.5, props.combatSpeed || 1.0)
		const dist = Math.max(1, Math.abs(to.x - from.x) + Math.abs(to.y - from.y))
		const duration = (chasmFall ? 350 : (dist > 1 ? 260 : 200)) / speed
		const actor = props.units.find((u) => u.id === unitId)

		const state = {
			isKnockback: true,
			from: { ...from },
			to: { ...to },
			elapsed: 0,
			duration,
			chasmFall,
			currentX: from.x,
			currentY: from.y,
			currentZ: from.z || 0,
			bob: 0,
			facing: actor?.facing,
			fallY: 0,
			alpha: 1.0,
			resolve: () => {
				movingUnits.delete(unitId)
				if (actor) {
					actor.x = to.x
					actor.y = to.y
					actor.z = to.z || 0
				}
				requestRender()
				resolve()
			}
		}

		movingUnits.set(unitId, state)
		requestRender()
	})
}

// Play Combat Action Visual Effects (Projectiles, Heal Beams, Melee Slashes)
function playActionVfx({ casterId, targetId, targetCoords, ability }) {
	return new Promise((resolve) => {
		if (!props.combatAnimations) {
			resolve()
			return
		}

		const speed = Math.max(0.5, props.combatSpeed || 1.0)
		let resolved = false
		const safetyTimer = setTimeout(() => {
			safeResolve()
		}, Math.max(1200, 2500 / speed))

		const safeResolve = () => {
			if (resolved) return
			resolved = true
			clearTimeout(safetyTimer)
			resolve()
		}

		const caster = props.units.find((u) => u.id === casterId)
		const target = targetId ? props.units.find((u) => u.id === targetId) : null
		const targetPoint = target
			? { x: target.x, y: target.y, z: target.z || 0 }
			: targetCoords

		if (!caster || !targetPoint) {
			safeResolve()
			return
		}

		const tileW = mapData.value?.tileWidth || 64
		const tileH = mapData.value?.tileHeight || 32
		const heightStep = mapData.value?.heightStep || 16

		const pCaster = gridToScreen(caster.x, caster.y, caster.z || 0, 0, 0, tileW, tileH, heightStep)
		const pTarget = gridToScreen(targetPoint.x, targetPoint.y, targetPoint.z || 0, 0, 0, tileW, tileH, heightStep)

		const dist = Math.abs(targetPoint.x - caster.x) + Math.abs(targetPoint.y - caster.y)

		const triggerAreaFlinch = () => {
			try {
				const affected = getAffectedUnits(caster, ability, targetPoint, props.units, tiles.value)
				if (target && !affected.some((u) => u.id === target.id)) {
					affected.push(target)
				}
				for (const u of affected) {
					vfxManager.triggerFlinch(u.id, 1.1, 260 / speed)
				}
			} catch (flinchErr) {
				console.warn('[playActionVfx] triggerAreaFlinch error:', flinchErr)
			}
		}

		const handlePostHitEffects = async () => {
			if (ability.knockback && ability.knockback > 0 && target) {
				try {
					const kbResult = resolveKnockback({
						attacker: caster,
						target,
						ability,
						allUnits: props.units,
						mapTiles: tiles.value,
						mapObjects: objects.value,
						strikeDamage: 10
					})

					if (kbResult.collision) {
						vfxManager.spawnImpactSparks(pTarget.x, pTarget.y - 20, '#f97316', 12)
						vfxManager.triggerFlinch(target.id, 1.4, 280 / speed)
						if (kbResult.collision.obstacleUnit) {
							vfxManager.triggerFlinch(kbResult.collision.obstacleUnit.id, 1.4, 280 / speed)
						}
					}

					if (kbResult.knockbackDistance > 0) {
						await animateKnockback({
							unitId: target.id,
							from: kbResult.from,
							to: kbResult.to,
							chasmFall: kbResult.chasmFall
						})
					}

					if (kbResult.fall) {
						vfxManager.spawnImpactSparks(pTarget.x, pTarget.y - 10, '#fde047', 10)
						vfxManager.triggerFlinch(target.id, 1.3, 260 / speed)
					}

					if (kbResult.iceSlide) {
						vfxManager.spawnImpactSparks(pTarget.x, pTarget.y - 10, '#bae6fd', 12)
					}
				} catch (err) {
					console.warn('[playActionVfx] knockback animation error:', err)
				}
			}
		}

		// 1. Healing Ability (beam from sky)
		if (ability.type === 'heal') {
			vfxManager.spawnHealBeam({
				target: { x: pTarget.x, y: pTarget.y },
				color: ability.color || (caster.class === 'mage' ? '#22c55e' : '#facc15'),
				duration: 460 / speed
			})
			setTimeout(safeResolve, 320 / speed)
			requestRender()
			return
		}

		// 2. Ranged Arrow / Archer
		const isArcher =
			caster.class === 'archer' ||
			ability.vfx === 'arrow' ||
			(ability.type === 'damage' && dist > 1 && caster.icon === '🏹')

		if (isArcher) {
			vfxManager.spawnProjectile({
				from: { x: pCaster.x, y: pCaster.y - 35 },
				to: { x: pTarget.x, y: pTarget.y - 35 },
				type: 'arrow',
				duration: 270 / speed,
				onHit: async () => {
					try {
						triggerAreaFlinch()
						await handlePostHitEffects()
					} finally {
						safeResolve()
					}
				}
			})
			requestRender()
			return
		}

		// 3. Magic Spells / Mage
		const isMage =
			caster.class === 'mage' ||
			ability.vfx === 'magic' ||
			ability.type === 'damage_status' ||
			dist > 1 ||
			ability.aoeRadius > 0

		if (isMage) {
			const magicColor = ability.id?.includes('fire')
				? '#f97316'
				: ability.id?.includes('lightning')
				? '#38bdf8'
				: '#a855f7'
			vfxManager.spawnProjectile({
				from: { x: pCaster.x, y: pCaster.y - 35 },
				to: { x: pTarget.x, y: pTarget.y - 35 },
				type: 'magic',
				color: magicColor,
				duration: 300 / speed,
				onHit: async () => {
					try {
						triggerAreaFlinch()
						await handlePostHitEffects()
					} finally {
						safeResolve()
					}
				}
			})
			requestRender()
			return
		}

		// 4. Melee Slash / Attack (Warrior, Fighter, Cleave)
		const dx = pTarget.x - pCaster.x
		const dy = pTarget.y - pCaster.y
		const strikeAngle = Math.atan2(dy, dx)

		vfxManager.spawnMeleeSlash({
			target: { x: pTarget.x, y: pTarget.y },
			angle: strikeAngle,
			color: '#fef08a',
			duration: 220 / speed
		})
		triggerAreaFlinch()
		setTimeout(async () => {
			try {
				await handlePostHitEffects()
			} finally {
				safeResolve()
			}
		}, 140 / speed)
		requestRender()
	})
}

defineExpose({
	animateUnitMovement,
	animateKnockback,
	playActionVfx,
	triggerUnitFlinch: (unitId, intensity) => vfxManager.triggerFlinch(unitId, intensity),
	tiles,
	objects
})

watch(
	() => [props.activeUnitId, props.moveMode, props.selectedAction],
	() => {
		selectedDestinationTile.value = null
		plannedPath.value = []
		requestRender()
	}
)

watch(
	() => [props.units, props.activeUnitId, props.selectedAction, props.moveMode, props.floatingTexts],
	() => requestRender(),
	{ deep: true }
)

onMounted(() => {
	updateContainerBounds()
	loadMap()
	unlistenSprites = onSpriteLoaded(() => requestRender())

	if (containerRef.value) {
		resizeObserver = new ResizeObserver((entries) => {
			if (entries && entries[0]) {
				const cr = entries[0].contentRect
				containerRect.width = cr.width
				containerRect.height = cr.height
				const r = containerRef.value.getBoundingClientRect()
				containerRect.left = r.left
				containerRect.top = r.top
			} else {
				updateContainerBounds()
			}
			resetCamera()
		})
		resizeObserver.observe(containerRef.value)
	}
})

onUnmounted(() => {
	vfxManager.clear()
	movingUnits.clear()
	if (unlistenSprites) unlistenSprites()
	if (resizeObserver) resizeObserver.disconnect()
	if (animFrameId) cancelAnimationFrame(animFrameId)
})
</script>

<style scoped>
.iso-combat-arena {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
	cursor: grab;
	user-select: none;
}

.iso-combat-arena.__is-panning {
	cursor: grabbing;
}

.iso-combat-arena.__action-mode {
	cursor: crosshair;
}

.arena-canvas {
	display: block;
	width: 100%;
	height: 100%;
}

/* Tooltip on unit hover */
.hover-unit-tooltip {
	position: absolute;
	pointer-events: none;
	z-index: 50;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.35em;
	padding: 0.4em 0.6em;
	color: #e2e8f0;
	font-size: 0.75em;
	backdrop-filter: blur(0.3em);
	box-shadow: 0 0.25em 0.8em rgba(0, 0, 0, 0.5);
	min-width: 9em;
}

.tooltip-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 0.25em;
	margin-bottom: 0.25em;
}

.tooltip-icon {
	font-size: 1.1em;
}

.tooltip-name {
	font-weight: bold;
	color: #f6c445;
	flex: 1;
}

.tooltip-team-badge {
	font-size: 0.8em;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
}

.tooltip-team-badge.ally {
	background: rgba(16, 185, 129, 0.25);
	color: #34d399;
}

.tooltip-team-badge.enemy {
	background: rgba(239, 68, 68, 0.25);
	color: #f87171;
}

.tooltip-stats {
	display: flex;
	flex-direction: column;
	gap: 0.15em;
}

.stat-row {
	display: flex;
	justify-content: space-between;
	font-size: 0.9em;
	color: #94a3b8;
}

.stat-val {
	font-weight: bold;
	color: #ffffff;
}

/* Reset camera button */
.cam-reset-btn {
	position: absolute;
	right: 1em;
	top: 4.2em;
	z-index: 40;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.3);
	color: #f6c445;
	border-radius: 50%;
	width: 2.2em;
	height: 2.2em;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	font-size: 0.95em;
	transition: background-color 0.2s, transform 0.2s, border-color 0.2s;
}

.cam-reset-btn:hover {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	transform: scale(1.08);
}

/* Tile tactical surface info card */
.hover-tile-card {
	position: absolute;
	left: 1em;
	bottom: 1em;
	z-index: 45;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.4em;
	padding: 0.45em 0.7em;
	color: #e2e8f0;
	font-size: 0.75em;
	backdrop-filter: blur(0.3em);
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.6);
	max-width: 22em;
	pointer-events: none;
}

.tile-card-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 0.25em;
	margin-bottom: 0.25em;
}

.tile-card-icon {
	font-size: 1.2em;
}

.tile-card-title {
	font-weight: bold;
	color: #f6c445;
	flex: 1;
}

.tile-card-z {
	font-size: 0.8em;
	background: rgba(59, 130, 246, 0.25);
	color: #60a5fa;
	padding: 0.1em 0.35em;
	border-radius: 0.2em;
	font-weight: bold;
}

.tile-card-coord {
	font-size: 0.8em;
	color: #94a3b8;
	font-family: monospace;
}

.tile-card-desc {
	font-size: 0.85em;
	color: #cbd5e1;
	line-height: 1.35;
}

.tile-card-obstacle {
	margin-top: 0.3em;
	font-size: 0.85em;
	color: #fb923c;
	font-weight: bold;
}
</style>

