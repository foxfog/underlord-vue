<template>
	<div
		ref="containerRef"
		class="char-canvas-container"
		:class="[
			`char-${characterId}`,
			`orientation-${effectiveOrientation}`,
			{
				'is-interactive': isInteractive,
				'__is-isometric': effectiveIsIsometric,
				'__is-ready': isReady
			}
		]"
		@click="onCanvasClick"
		@mousemove="onCanvasMouseMove"
		@mouseleave="onCanvasMouseLeave"
	>
		<canvas
			ref="canvasRef"
			class="char-canvas"
			:class="{ '__is-isometric': effectiveIsIsometric, '__is-ready': isReady }"
		></canvas>
	</div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, inject } from 'vue'
import { CharacterRigRenderer } from '@/utils/character/characterRigRenderer'
import {
	getCharacterAnimation,
	evaluateAnimationAtTime,
	normalizeAnimationDefinition,
	parseTransformString
} from '@/utils/character/characterAnimationEngine'
import { resolveSceneBleed, PRESERVE_CANONICAL_RULER_HEIGHT } from '@/utils/scene/sceneConfig'

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
	partAnimations: {
		type: Object,
		default: null
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
		default: null
	},
	scene: {
		type: Object,
		default: null
	},
	floorOffset: {
		type: [Number, String],
		default: null
	},
	preserveCanonicalRulerHeight: {
		type: Boolean,
		default: null
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
const isReady = ref(false)
let currentRenderScale = 1

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

const injectedScene = inject('currentScene', null)

function getContainerFontSize() {
	if (!containerRef.value) return 16
	const fs = parseFloat(getComputedStyle(containerRef.value).fontSize)
	return fs && !isNaN(fs) && fs > 0 ? fs : 16
}

const effectiveBleed = computed(() => {
	// 1. If explicit bleed prop was passed with non-zero values (e.g. from Studio stageBleed)
	if (
		props.bleed &&
		typeof props.bleed === 'object' &&
		(props.bleed.top || props.bleed.bottom || props.bleed.left || props.bleed.right)
	) {
		return props.bleed
	}
	// 2. In isometric mode, characters don't use 2D floor bleed
	if (effectiveIsIsometric.value) {
		return { top: 0, bottom: 0, left: 0, right: 0 }
	}
	// 3. Resolve using sceneConfig
	const em = getContainerFontSize()
	const height = canvasLayoutHeight.value || 1080
	const activeScene = props.scene || injectedScene?.value || injectedScene || null
	return resolveSceneBleed({
		bleed: props.bleed || props.character?.bleed,
		character: props.character,
		scene: activeScene,
		floorOffset: props.floorOffset,
		em,
		height
	})
})

const effectivePreserveCanonicalRulerHeight = computed(() => {
	if (props.preserveCanonicalRulerHeight !== null && props.preserveCanonicalRulerHeight !== undefined) {
		return Boolean(props.preserveCanonicalRulerHeight)
	}
	return PRESERVE_CANONICAL_RULER_HEIGHT
})

// Active animated transforms driven by runtime animation loop
const activePartRotations = reactive({})
const activePartTranslations = reactive({})
const activePartScales = reactive({})
const activePartOpacities = reactive({})

const effectivePartRotations = computed(() => {
	const res = { ...props.partRotations }
	if (props.character?.partRotations) {
		Object.assign(res, props.character.partRotations)
	}
	for (const [name, rot] of Object.entries(activePartRotations)) {
		if (rot !== undefined && rot !== null) {
			res[name] = (res[name] || 0) + rot
		}
	}
	return res
})

const effectivePartTranslations = computed(() => {
	const res = {}
	if (props.partTranslations) {
		for (const [k, v] of Object.entries(props.partTranslations)) {
			res[k] = { x: v.x || 0, y: v.y || 0 }
		}
	}
	if (props.character?.partTranslations) {
		for (const [k, v] of Object.entries(props.character.partTranslations)) {
			const base = res[k] || { x: 0, y: 0 }
			res[k] = { x: base.x + (v.x || 0), y: base.y + (v.y || 0) }
		}
	}
	for (const [name, tr] of Object.entries(activePartTranslations)) {
		if (tr) {
			const base = res[name] || { x: 0, y: 0 }
			res[name] = {
				x: (base.x || 0) + (tr.x || 0),
				y: (base.y || 0) + (tr.y || 0)
			}
		}
	}
	return res
})

const effectivePartScales = computed(() => {
	const res = { ...props.partScales }
	if (props.character?.partScales) {
		Object.assign(res, props.character.partScales)
	}
	for (const [name, sc] of Object.entries(activePartScales)) {
		if (sc !== undefined && sc !== null) {
			const base = res[name] ?? 1
			if (typeof sc === 'number' && !isNaN(sc)) {
				if (typeof base === 'number' && !isNaN(base)) {
					res[name] = base * sc
				} else if (typeof base === 'object' && base !== null) {
					res[name] = { ...base, scale: (base.scale ?? 1) * sc }
				} else {
					res[name] = sc
				}
			} else if (typeof sc === 'object' && sc !== null) {
				const scVal = typeof sc.scale === 'number' && !isNaN(sc.scale) ? sc.scale : 1
				if (typeof base === 'number' && !isNaN(base)) {
					res[name] = {
						...sc,
						scale: base * scVal
					}
				} else if (typeof base === 'object' && base !== null) {
					res[name] = {
						...base,
						...sc,
						scale: (base.scale ?? 1) * scVal
					}
				} else {
					res[name] = sc
				}
			}
		}
	}
	return res
})

const effectivePartOpacities = computed(() => {
	const res = { ...props.partOpacities }
	if (props.character?.partOpacities) {
		Object.assign(res, props.character.partOpacities)
	}
	for (const [name, op] of Object.entries(activePartOpacities)) {
		if (op !== undefined && op !== null && !isNaN(op)) {
			res[name] = Math.max(0, Math.min(1, Number(op)))
		}
	}
	return res
})

let resizeObserver = null
let renderRafId = null

function checkImagesLoaded() {
	const allLoaded = renderer.areAllImagesLoaded({
		bodyParts: effectiveBodyParts.value,
		animatedSprites: props.animatedSprites,
		equipmentBySlot: effectiveEquipment.value,
		getEffectivePartImage: props.getEffectivePartImage
	})
	if (allLoaded && !isReady.value) {
		isReady.value = true
	}
	return allLoaded
}

function preloadRequiredImages() {
	renderer
		.preloadAllParts({
			bodyParts: effectiveBodyParts.value,
			animatedSprites: props.animatedSprites,
			equipmentBySlot: effectiveEquipment.value,
			getEffectivePartImage: props.getEffectivePartImage
		})
		.then(() => {
			isReady.value = true
			requestRender()
		})
}

function requestRender() {
	if (renderRafId) return
	renderRafId = requestAnimationFrame(() => {
		renderRafId = null
		renderScene()
	})
}

// Hook renderer's auto-redraw on image load
renderer.onNeedRedraw = () => {
	checkImagesLoaded()
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

	currentRenderScale = renderScale

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
	const renderScale = currentRenderScale || 1

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
		partScales: effectivePartScales.value,
		partOpacities: effectivePartOpacities.value,
		partPivots: props.partPivots,
		animatedSprites: props.animatedSprites,
		equipmentBySlot: effectiveEquipment.value,
		eyeOffset: props.eyeOffset,
		getEffectivePartImage: props.getEffectivePartImage,
		isIsometric: effectiveIsIsometric.value,
		isIsometricRotation: props.isIsometricRotation,
		isometricRotationMode: props.isometricRotationMode,
		bleed: effectiveBleed.value,
		preserveCanonicalRulerHeight: effectivePreserveCanonicalRulerHeight.value
	})

	// Check if all parts have completed loading and set isReady
	const allLoaded = checkImagesLoaded()

	// Render all parts with renderScale passed directly to renderer
	// If images are not yet fully ready, clear canvas so half-loaded unpositioned fragments don't flash
	if (allLoaded) {
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
	} else {
		ctx.setTransform(1, 0, 0, 1, 0, 0)
		ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
	}
}

let animLoopRafId = null

function clearAnimatedOverrides() {
	for (const k of Object.keys(activePartRotations)) {
		delete activePartRotations[k]
	}
	for (const k of Object.keys(activePartTranslations)) {
		delete activePartTranslations[k]
	}
	for (const k of Object.keys(activePartScales)) {
		delete activePartScales[k]
	}
	for (const k of Object.keys(activePartOpacities)) {
		delete activePartOpacities[k]
	}
}

function getEffectivePartAnimations() {
	const res = {}
	if (props.character?.partAnimations) {
		Object.assign(res, props.character.partAnimations)
	}
	if (props.partAnimations) {
		Object.assign(res, props.partAnimations)
	}
	return res
}

function evaluateAnimation(
	partName,
	anim,
	progress,
	elapsedSec,
	durationSec,
	frameRot,
	frameTrans,
	frameScale,
	frameOpacity
) {
	// 1. Check if anim is a registered animation or has inline tracks/keyframes
	const animId = anim.animation || anim.id || (typeof anim.class === 'string' && anim.class)
	const registered = animId ? getCharacterAnimation(animId) : null
	const animSource = (anim.tracks || anim.keyframes) ? anim : registered

	if (animSource) {
		const evalDef = (anim.tracks || anim.keyframes)
			? normalizeAnimationDefinition(anim)
			: {
				...animSource,
				duration: anim.duration !== undefined ? Number(anim.duration) : animSource.duration,
				repeat: anim.repeat || animSource.repeat,
				repeatCount: anim.repeatCount !== undefined ? Number(anim.repeatCount) : animSource.repeatCount
			}

		const evalResult = evaluateAnimationAtTime(evalDef, elapsedSec)
		if (evalResult && evalResult.transformsByPart) {
			const hasNeck = Boolean(effectiveBodyParts.value && effectiveBodyParts.value['neck'])
			for (const [target, state] of Object.entries(evalResult.transformsByPart)) {
				let actualTarget = target
				if (target === 'neck' && !hasNeck) {
					actualTarget = 'head'
				}

				if (state.rotate !== undefined) {
					frameRot[actualTarget] = (frameRot[actualTarget] || 0) + state.rotate
				}
				if (state.translateX !== undefined || state.translateY !== undefined) {
					const prev = frameTrans[actualTarget] || { x: 0, y: 0 }
					frameTrans[actualTarget] = {
						x: prev.x + (state.translateX || 0),
						y: prev.y + (state.translateY || 0)
					}
				}
				// Only set frameScale if scale is actually modified or 3D perspective is active
				const hasScaleAnim =
					(state.scale !== undefined && Math.abs(state.scale - 1) > 0.0001) ||
					(state.scaleX !== undefined && Math.abs(state.scaleX - 1) > 0.0001) ||
					(state.scaleY !== undefined && Math.abs(state.scaleY - 1) > 0.0001) ||
					Boolean(state.rotateX || state.rotateY)

				if (hasScaleAnim) {
					if (
						state.rotateX ||
						state.rotateY ||
						(state.scaleX !== undefined && state.scaleX !== state.scale) ||
						(state.scaleY !== undefined && state.scaleY !== state.scale)
					) {
						frameScale[actualTarget] = {
							scale: state.scale ?? 1,
							scaleX: state.scaleX ?? state.scale ?? 1,
							scaleY: state.scaleY ?? state.scale ?? 1,
							rotateX: state.rotateX || 0,
							rotateY: state.rotateY || 0
						}
					} else {
						frameScale[actualTarget] = state.scale ?? 1
					}
				}

				// Only set frameOpacity if opacity is actually animated
				if (state.opacity !== undefined && state.opacity < 0.999) {
					frameOpacity[actualTarget] = state.opacity
				}
			}
			return evalResult.isFinished
		}
	}
	const animClass = anim.class || anim.animation || ''
	const isCough =
		animClass === 'cough-head' ||
		animClass === 'cough' ||
		anim.animation === 'cough' ||
		(typeof animClass === 'string' && animClass.includes('cough'))

	if (isCough) {
		// Replicate coughing: 2 distinct impulses over duration (at 25% and 75%), neck tilts forward by -8deg
		let impulse = 0
		if (progress < 0.5) {
			impulse = Math.sin((progress / 0.5) * Math.PI)
		} else {
			impulse = Math.sin(((progress - 0.5) / 0.5) * Math.PI)
		}
		const neckTilt = Math.sin(progress * Math.PI) * -8

		const hasNeck = Boolean(effectiveBodyParts.value && effectiveBodyParts.value['neck'])
		if (hasNeck) {
			frameRot['neck'] = (frameRot['neck'] || 0) + neckTilt
			const prevHead = frameTrans['head'] || { x: 0, y: 0 }
			frameTrans['head'] = {
				x: prevHead.x - 2.5 * impulse,
				y: prevHead.y + 3.0 * impulse
			}
			frameRot['head'] = (frameRot['head'] || 0) - 3.0 * impulse
		} else {
			// Fallback when character has no separate neck part
			const prevHead = frameTrans['head'] || { x: 0, y: 0 }
			frameTrans['head'] = {
				x: prevHead.x - 2.5 * impulse,
				y: prevHead.y + 3.0 * impulse
			}
			frameRot['head'] = (frameRot['head'] || 0) + (neckTilt - 3.0 * impulse)
		}
		// Body does NOT shake during cough
		frameRot['body'] = 0
		frameTrans['body'] = { x: 0, y: 0 }
		return
	}

	if (animClass === 'tremble' || anim.animation === 'tremble') {
		const freq = progress * Math.PI * 16
		const env = Math.sin(progress * Math.PI)
		const tx = Math.sin(freq) * 2.0 * env
		const ty = Math.cos(freq * 1.5) * 2.0 * env
		const target = anim.animation === 'tremble' ? 'body' : partName
		const prev = frameTrans[target] || { x: 0, y: 0 }
		frameTrans[target] = { x: prev.x + tx, y: prev.y + ty }
		return
	}

	if (animClass === 'shake-head' || anim.animation === 'head_shake') {
		const shake = Math.sin(progress * Math.PI * 6) * Math.sin(progress * Math.PI)
		const target = anim.animation === 'head_shake' ? 'head' : partName
		frameRot[target] = (frameRot[target] || 0) + shake * 5
		const prev = frameTrans[target] || { x: 0, y: 0 }
		frameTrans[target] = { x: prev.x + shake * 3, y: prev.y }
		return
	}

	if (animClass === 'nod' || anim.animation === 'nod') {
		const nod = Math.sin(progress * Math.PI * 2)
		const target = anim.animation === 'nod' ? 'head' : partName
		frameRot[target] = (frameRot[target] || 0) + nod * 10
		const prev = frameTrans[target] || { x: 0, y: 0 }
		frameTrans[target] = { x: prev.x, y: prev.y + Math.max(0, nod) * 3 }
		return
	}

	if (animClass === 'pulse') {
		const pulseFactor = Math.sin(progress * Math.PI) * 0.06
		frameScale[partName] = (frameScale[partName] || 1) * (1 + pulseFactor)
		return
	}

	if (animClass === 'wave-hand' || animClass === 'wave_hand' || anim.animation === 'wave_hand') {
		const waveAngle = Math.sin(progress * Math.PI * 4) * 25
		if (effectiveBodyParts.value && effectiveBodyParts.value['arm2_left']) {
			frameRot['arm_left'] = -55
			frameRot['arm2_left'] = waveAngle
		} else if (effectiveBodyParts.value && effectiveBodyParts.value['arm_left']) {
			frameRot['arm_left'] = waveAngle
		} else {
			frameRot[partName] = (frameRot[partName] || 0) + waveAngle
		}
		return
	}

	if (animClass === 'breathing' || anim.animation === 'breathing') {
		const breath = Math.sin(progress * Math.PI * 2) * 3
		frameRot['body'] = (frameRot['body'] || 0) + breath * 0.5
		frameRot['head'] = (frameRot['head'] || 0) - breath * 0.3
		return
	}

	// Styles object handling (e.g. { transform: "translateY(10%)", transition: "transform 1s ease-in-out" })
	if (anim.styles) {
		if (anim.styles.transform) {
			const parsed = parseTransformString(anim.styles.transform)
			if (parsed) {
				const easeProgress = (1 - Math.cos(progress * Math.PI)) / 2
				const prevTrans = frameTrans[partName] || { x: 0, y: 0 }
				frameTrans[partName] = {
					x: prevTrans.x + parsed.x * easeProgress,
					y: prevTrans.y + parsed.y * easeProgress
				}
				if (parsed.rot) {
					frameRot[partName] = (frameRot[partName] || 0) + parsed.rot * easeProgress
				}
				if (parsed.scale !== 1) {
					frameScale[partName] = (frameScale[partName] || 1) * (1 + (parsed.scale - 1) * easeProgress)
				}
			}
		}
		if (anim.styles.opacity !== undefined) {
			frameOpacity[partName] = parseFloat(anim.styles.opacity)
		}
	}

	// Direct numeric properties
	if (anim.rot !== undefined) {
		frameRot[partName] = (frameRot[partName] || 0) + anim.rot
	}
	if (anim.x !== undefined || anim.y !== undefined) {
		const prevTrans = frameTrans[partName] || { x: 0, y: 0 }
		frameTrans[partName] = {
			x: prevTrans.x + (anim.x || 0),
			y: prevTrans.y + (anim.y || 0)
		}
	}
	if (anim.scale !== undefined) {
		frameScale[partName] = (frameScale[partName] || 1) * anim.scale
	}
	if (anim.opacity !== undefined) {
		frameOpacity[partName] = anim.opacity
	}
}

function stepCanvasAnimations(now) {
	const anims = getEffectivePartAnimations()
	const keys = Object.keys(anims)
	if (keys.length === 0) {
		clearAnimatedOverrides()
		renderScene()
		return false
	}

	const frameRot = {}
	const frameTrans = {}
	const frameScale = {}
	const frameOpacity = {}
	let hasRunning = false

	for (const [partName, anim] of Object.entries(anims)) {
		if (!anim) continue
		if (!anim.startTime) {
			anim.startTime = now
		}
		const durationSec = Number(anim.duration) || (anim.animationDuration ? anim.animationDuration / 1000 : 0.5)
		const elapsedSec = Math.max(0, (now - anim.startTime) / 1000)
		const progress = durationSec > 0 ? Math.min(1.0, elapsedSec / durationSec) : 1.0

		const isFinished = evaluateAnimation(
			partName,
			anim,
			progress,
			elapsedSec,
			durationSec,
			frameRot,
			frameTrans,
			frameScale,
			frameOpacity
		)

		if (isFinished !== undefined) {
			if (!isFinished) {
				hasRunning = true
			}
		} else {
			if (elapsedSec < durationSec) {
				hasRunning = true
			}
		}
	}

	// Synchronize reactive activePart dictionaries
	for (const k of Object.keys(frameRot)) {
		activePartRotations[k] = frameRot[k]
	}
	for (const k of Object.keys(activePartRotations)) {
		if (!(k in frameRot)) delete activePartRotations[k]
	}

	for (const k of Object.keys(frameTrans)) {
		activePartTranslations[k] = frameTrans[k]
	}
	for (const k of Object.keys(activePartTranslations)) {
		if (!(k in frameTrans)) delete activePartTranslations[k]
	}

	for (const k of Object.keys(frameScale)) {
		activePartScales[k] = frameScale[k]
	}
	for (const k of Object.keys(activePartScales)) {
		if (!(k in frameScale)) delete activePartScales[k]
	}

	for (const k of Object.keys(frameOpacity)) {
		activePartOpacities[k] = frameOpacity[k]
	}
	for (const k of Object.keys(activePartOpacities)) {
		if (!(k in frameOpacity)) delete activePartOpacities[k]
	}

	renderScene()

	if (!hasRunning) {
		clearAnimatedOverrides()
		renderScene()
		return false
	}
	return true
}

function checkAndStartAnimationLoop() {
	const anims = getEffectivePartAnimations()
	if (Object.keys(anims).length > 0) {
		if (!animLoopRafId) {
			const loop = (timestamp) => {
				const running = stepCanvasAnimations(timestamp)
				if (running) {
					animLoopRafId = requestAnimationFrame(loop)
				} else {
					animLoopRafId = null
				}
			}
			animLoopRafId = requestAnimationFrame(loop)
		}
	} else {
		if (animLoopRafId) {
			cancelAnimationFrame(animLoopRafId)
			animLoopRafId = null
		}
		clearAnimatedOverrides()
		renderScene()
	}
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
	() => [props.character?.partAnimations, props.partAnimations],
	() => {
		checkAndStartAnimationLoop()
	},
	{ deep: true, immediate: true }
)

watch(
	[
		() => props.character,
		() => props.bodyParts,
		() => props.character?.sprites,
		() => props.animatedSprites,
		() => props.equipmentBySlot,
		() => effectiveEquipment.value,
		() => props.getEffectivePartImage
	],
	() => {
		preloadRequiredImages()
	},
	{ deep: true }
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
	preloadRequiredImages()

	nextTick(() => {
		updateCanvasSize()

		if (containerRef.value && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				updateCanvasSize()
			})
			resizeObserver.observe(containerRef.value)
		}

		checkAndStartAnimationLoop()
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
	if (animLoopRafId) {
		cancelAnimationFrame(animLoopRafId)
		animLoopRafId = null
	}
	clearAnimatedOverrides()
	renderer.destroy()
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
	opacity: 0;
	transition: opacity 0.12s ease-out;
}

.char-canvas.__is-ready {
	opacity: 1;
}

.char-canvas.__is-isometric {
	image-rendering: pixelated;
	image-rendering: crisp-edges;
}

.char-canvas-container.is-interactive {
	cursor: pointer;
}
</style>
