<template>
	<div
		ref="containerRef"
		class="char-canvas-container"
		:class="[
			`char-${characterId}`,
			`orientation-${effectiveOrientation}`,
			{ 'is-interactive': isInteractive, '__is-isometric': effectiveIsIsometric }
		]"
		@click="onCanvasClick"
		@mousemove="onCanvasMouseMove"
		@mouseleave="onCanvasMouseLeave"
	>
		<canvas
			ref="canvasRef"
			class="char-canvas"
			:class="{ '__is-isometric': effectiveIsIsometric }"
		></canvas>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { CharacterRigRenderer } from '@/utils/character/characterRigRenderer'

defineOptions({
	name: 'CharacterCanvas'
})

const props = defineProps({
	// Whole character object (standard VN / Game usage)
	character: {
		type: Object,
		default: null
	},
	// Fine-grained props (Studio / Direct usage)
	characterId: {
		type: String,
		default: 'default'
	},
	bodyParts: {
		type: Object,
		default: null
	},
	characterScale: {
		type: Number,
		default: 1.0
	},
	rootOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	orientation: {
		type: String,
		default: 'right'
	},
	partRotations: {
		type: Object,
		default: () => ({})
	},
	partTranslations: {
		type: Object,
		default: () => ({})
	},
	partScales: {
		type: Object,
		default: () => ({})
	},
	partOpacities: {
		type: Object,
		default: () => ({})
	},
	partPivots: {
		type: Object,
		default: () => ({})
	},
	animatedSprites: {
		type: Object,
		default: () => ({})
	},
	equipmentBySlot: {
		type: Object,
		default: () => ({})
	},
	eyeOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	selectedPartName: {
		type: String,
		default: ''
	},
	showBoundingBoxes: {
		type: Boolean,
		default: false
	},
	getEffectivePartImage: {
		type: Function,
		default: null
	},
	isIsometric: {
		type: Boolean,
		default: false
	},
	isIsometricRotation: {
		type: Boolean,
		default: true
	},
	isometricRotationMode: {
		type: String,
		default: 'trapezoid'
	},
	isometricTiltAngle: {
		type: Number,
		default: 26.565
	},
	isInteractive: {
		type: Boolean,
		default: false
	},
	bleed: {
		type: Object,
		default: () => ({ top: 0, bottom: 0, left: 0, right: 0 })
	},
	relativeCenters: {
		type: Boolean,
		default: false
	},
	zoom: {
		type: Number,
		default: 1.0
	}
})

const emit = defineEmits([
	'select-part',
	'part-hover',
	'character-click',
	'rendered'
])

const containerRef = ref(null)
const canvasRef = ref(null)
const hoveredPartName = ref(null)
const currentRenderScale = ref(1)

const renderer = new CharacterRigRenderer()

// Merge props from either `character` object or individual props
const effectiveCharacterId = computed(() => {
	return props.character?.id || props.characterId
})

const effectiveBodyParts = computed(() => {
	if (props.bodyParts) return props.bodyParts
	return props.character?.sprites || {}
})

const effectiveScale = computed(() => {
	if (props.character) {
		return props.character.size ?? props.characterScale ?? 1.0
	}
	return props.characterScale ?? 1.0
})

const effectiveRootOffset = computed(() => {
	if (props.character?.root_offset) {
		return props.character.root_offset
	}
	return props.rootOffset || { x: 0, y: 0 }
})

const effectiveOrientation = computed(() => {
	return props.character?.orientation || props.orientation || 'right'
})

const effectiveIsIsometric = computed(() => {
	return Boolean(props.isIsometric || props.character?.isIsometric)
})

const effectiveEquipment = computed(() => {
	return props.character?.equipmentBySlot || props.equipmentBySlot || {}
})

const effectivePartRotations = computed(() => {
	const res = { ...props.partRotations }
	if (props.character?.partAnimations) {
		for (const [name, anim] of Object.entries(props.character.partAnimations)) {
			if (anim.rot !== undefined) res[name] = anim.rot
			if (anim.rotate !== undefined) res[name] = anim.rotate
			if (anim.styles?.transform) {
				const match = anim.styles.transform.match(/rotate\(([-0.9]+)deg\)/)
				if (match) res[name] = parseFloat(match[1])
			}
		}
	}
	return res
})

const effectivePartTranslations = computed(() => {
	const res = { ...props.partTranslations }
	if (props.character?.partAnimations) {
		for (const [name, anim] of Object.entries(props.character.partAnimations)) {
			if (anim.x !== undefined || anim.y !== undefined) {
				res[name] = { x: anim.x || 0, y: anim.y || 0 }
			}
			if (anim.translateX !== undefined || anim.translateY !== undefined) {
				res[name] = { x: anim.translateX || 0, y: anim.translateY || 0 }
			}
		}
	}
	return res
})

let resizeObserver = null
let renderRafId = null

function requestRender() {
	if (renderRafId) return
	renderRafId = requestAnimationFrame(() => {
		renderRafId = null
		renderScene()
	})
}

// Hook renderer's auto-redraw on image load
renderer.onNeedRedraw = () => {
	requestRender()
}

const canvasLayoutWidth = ref(1000)
const canvasLayoutHeight = ref(800)

function updateCanvasSize() {
	if (!containerRef.value || !canvasRef.value) return

	const container = containerRef.value
	const canvas = canvasRef.value

	const width = Math.max(10, Math.round(container.clientWidth))
	const height = Math.max(10, Math.round(container.clientHeight))
	canvasLayoutWidth.value = width
	canvasLayoutHeight.value = height
	const dpr = window.devicePixelRatio || 1

	// Determine effective zoom from props or on-screen bounding rect
	let effectiveZoom = Number(props.zoom) || 1.0
	if (containerRef.value) {
		const rect = container.getBoundingClientRect()
		if (rect.width && width > 0) {
			const cssScale = rect.width / width
			if (cssScale > 0) {
				effectiveZoom = Math.max(effectiveZoom, cssScale)
			}
		}
	}

	// Calculate target render scale accounting for devicePixelRatio and visual zoom
	const targetRenderScale = dpr * Math.max(0.1, effectiveZoom)

	// Safety cap to prevent GPU VRAM exhaustion (up to 8192px canvas buffer for high-res close-ups)
	const maxBufferDim = 8192
	const maxScaleX = maxBufferDim / width
	const maxScaleY = maxBufferDim / height
	const maxScale = Math.max(1, Math.min(maxScaleX, maxScaleY))
	const renderScale = Math.min(Math.max(1, targetRenderScale), maxScale)

	currentRenderScale.value = renderScale

	const targetCanvasW = Math.round(width * renderScale)
	const targetCanvasH = Math.round(height * renderScale)

	if (canvas.width !== targetCanvasW || canvas.height !== targetCanvasH) {
		canvas.width = targetCanvasW
		canvas.height = targetCanvasH
		canvas.style.width = `${width}px`
		canvas.style.height = `${height}px`
	}

	requestRender()
}

function renderScene() {
	if (!canvasRef.value || !containerRef.value) return

	const canvas = canvasRef.value
	const ctx = canvas.getContext('2d')
	if (!ctx) return

	const width = canvasLayoutWidth.value || 1000
	const height = canvasLayoutHeight.value || 800
	const renderScale = currentRenderScale.value || 1

	// Compute Scene Graph in CSS layout pixels
	renderer.computeSceneGraph({
		bodyParts: effectiveBodyParts.value,
		width,
		height,
		characterScale: effectiveScale.value,
		rootOffset: effectiveRootOffset.value,
		orientation: effectiveOrientation.value,
		partRotations: effectivePartRotations.value,
		partTranslations: effectivePartTranslations.value,
		partScales: props.partScales,
		partOpacities: props.partOpacities,
		partPivots: props.partPivots,
		animatedSprites: props.animatedSprites,
		equipmentBySlot: effectiveEquipment.value,
		eyeOffset: props.eyeOffset,
		getEffectivePartImage: props.getEffectivePartImage,
		isIsometric: effectiveIsIsometric.value,
		isIsometricRotation: props.isIsometricRotation,
		isometricRotationMode: props.isometricRotationMode,
		isometricTiltAngle: props.isometricTiltAngle,
		bleed: props.bleed
	})

	// Render all parts with renderScale passed directly to renderer
	renderer.render(ctx, {
		clear: true,
		selectedPartName: props.selectedPartName,
		showBoundingBoxes: props.showBoundingBoxes,
		dpr: renderScale,
		isIsometric: effectiveIsIsometric.value
	})

	// Emit computed part centers for overlays / breadcrumbs / gizmos (in CSS pixels)
	queueMicrotask(() => {
		emit('rendered', renderer.getPartCenters({ relativeToStage: props.relativeCenters }))
	})
}

function getCanvasCoords(event) {
	if (!canvasRef.value) return { x: 0, y: 0 }
	const rect = canvasRef.value.getBoundingClientRect()
	// Compensate for any CSS zoom or scaling on parent containers:
	const scaleX = rect.width ? canvasRef.value.clientWidth / rect.width : 1
	const scaleY = rect.height ? canvasRef.value.clientHeight / rect.height : 1
	return {
		x: (event.clientX - rect.left) * scaleX,
		y: (event.clientY - rect.top) * scaleY
	}
}

function onCanvasClick(event) {
	const { x, y } = getCanvasCoords(event)
	const hitPart = renderer.hitTest(x, y)

	if (hitPart) {
		emit('select-part', hitPart)
	}

	if (props.character?.interaction || props.isInteractive) {
		emit('character-click', {
			character: props.character,
			part: hitPart,
			event
		})
	}
}

function onCanvasMouseMove(event) {
	const { x, y } = getCanvasCoords(event)
	const hitPart = renderer.hitTest(x, y)

	if (hitPart !== hoveredPartName.value) {
		hoveredPartName.value = hitPart
		emit('part-hover', hitPart)
		if (containerRef.value) {
			containerRef.value.style.cursor = hitPart ? 'pointer' : 'default'
		}
	}
}

function onCanvasMouseLeave() {
	if (hoveredPartName.value !== null) {
		hoveredPartName.value = null
		emit('part-hover', null)
	}
}

// Watchers to trigger re-renders
watch(
	() => props.zoom,
	() => {
		updateCanvasSize()
	}
)

watch(
	[
		() => props.character,
		() => props.bodyParts,
		() => props.character?.sprites,
		() => props.characterScale,
		() => props.rootOffset,
		() => props.orientation,
		() => props.partRotations,
		() => props.partTranslations,
		() => props.partScales,
		() => props.partOpacities,
		() => props.partPivots,
		() => props.animatedSprites,
		() => props.equipmentBySlot,
		() => effectiveEquipment.value,
		() => props.eyeOffset,
		() => props.selectedPartName,
		() => props.showBoundingBoxes,
		() => props.isIsometric,
		() => props.isIsometricRotation,
		() => props.isometricRotationMode,
		() => props.isometricTiltAngle,
		() => props.bleed
	],
	() => {
		requestRender()
	},
	{ deep: true }
)

onMounted(() => {
	nextTick(() => {
		updateCanvasSize()

		if (containerRef.value && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				updateCanvasSize()
			})
			resizeObserver.observe(containerRef.value)
		}
	})
})

onUnmounted(() => {
	if (resizeObserver) {
		resizeObserver.disconnect()
		resizeObserver = null
	}
	if (renderRafId) {
		cancelAnimationFrame(renderRafId)
		renderRafId = null
	}
})

// Expose public API
defineExpose({
	getPartCenters: (opts = {}) =>
		renderer.getPartCenters({ relativeToStage: props.relativeCenters, ...opts }),
	hitTest: (x, y) => renderer.hitTest(x, y),
	requestRender
})
</script>

<style scoped>
.char-canvas-container {
	position: absolute;
	width: 100%;
	height: 100%;
	top: 0;
	left: 0;
	pointer-events: auto;
	user-select: none;
	image-rendering: auto;
}

.char-canvas {
	display: block;
	width: 100%;
	height: 100%;
	image-rendering: auto;
}

.char-canvas.__is-isometric {
	image-rendering: pixelated;
	image-rendering: crisp-edges;
}

.char-canvas-container.is-interactive {
	cursor: pointer;
}
</style>
