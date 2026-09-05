<template>
	<div
		class="ygg-intro-overlay"
		tabindex="0"
		ref="overlayRef"
		@mousedown="startHold"
		@mouseup="cancelHold"
		@mouseleave="cancelHold"
		@touchstart.passive="startHold"
		@touchend="cancelHold"
	>
		<!-- Видеоролик -->
		<video
			ref="videoRef"
			class="intro-video"
			:src="videoSrc"
			autoplay
			playsinline
			@ended="finishIntro"
			@error="onVideoError"
		></video>

		<!-- Затемнение при пропуске / завершении -->
		<div class="fade-overlay" :class="{ 'fade-out': isFinishing }"></div>

		<!-- Модный кружковый индикатор пропуска сбоку справа (Cyberpunk / AAA Game Style) -->
		<div
			class="skip-indicator-wrap"
			:class="{ 'is-holding': isHolding, 'is-completed': isCompleted }"
			@mousedown.stop="startHold"
			@mouseup.stop="cancelHold"
		>
			<div class="skip-info-text">
				<span class="skip-title">ПРОПУСТИТЬ</span>
				<span class="skip-hint">Удерживайте любую клавишу</span>
			</div>

			<div class="skip-circle-box">
				<svg class="skip-svg" viewBox="0 0 64 64">
					<!-- Фоновая дорожка кольца -->
					<circle
						class="skip-circle-bg"
						cx="32"
						cy="32"
						r="26"
					/>
					<!-- Заполняющееся кольцо прогресса -->
					<circle
						class="skip-circle-progress"
						cx="32"
						cy="32"
						r="26"
						:style="circleProgressStyle"
					/>
				</svg>

				<!-- Иконка по центру круга -->
				<div class="skip-center-icon">
					<span class="skip-icon-symbol">⏭</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits(['intro-complete'])

const settingsStore = useSettingsStore()
const overlayRef = ref(null)
const videoRef = ref(null)

const isFinishing = ref(false)
const isHolding = ref(false)
const isCompleted = ref(false)
const holdProgress = ref(0) // 0 to 100

// 1.8 секунды удержания для надежного и комфортного пропуска
const HOLD_DURATION_MS = 1800
const CIRCUMFERENCE = 2 * Math.PI * 26 // ~163.36

let holdStartTime = 0
let animFrameId = null

const videoSrc = computed(() => {
	return 'video/yggdrasil-intro.mp4'
})

const circleProgressStyle = computed(() => {
	const offset = CIRCUMFERENCE * (1 - holdProgress.value / 100)
	return {
		strokeDasharray: `${CIRCUMFERENCE}`,
		strokeDashoffset: `${offset}`
	}
})

onMounted(() => {
	// Настройка звука видео согласно общим настройкам
	if (videoRef.value) {
		const common = (settingsStore.audio?.commonVolume ?? 100) / 100
		const sound = (settingsStore.audio?.soundVolume ?? 100) / 100
		videoRef.value.volume = Math.max(0, Math.min(1, common * sound))

		videoRef.value.play().catch((err) => {
			console.warn('Intro video autoplay issue:', err)
		})
	}

	window.addEventListener('keydown', handleKeyDown, { capture: true })
	window.addEventListener('keyup', handleKeyUp, { capture: true })

	if (overlayRef.value) {
		overlayRef.value.focus()
	}
})

onUnmounted(() => {
	window.removeEventListener('keydown', handleKeyDown, { capture: true })
	window.removeEventListener('keyup', handleKeyUp, { capture: true })
	if (animFrameId) {
		cancelAnimationFrame(animFrameId)
		animFrameId = null
	}
})

function handleKeyDown(e) {
	e.preventDefault()
	e.stopPropagation()
	// Игнорируем повторы при удержании клавиши ОС
	if (e.repeat) return
	startHold()
}

function handleKeyUp(e) {
	e.preventDefault()
	e.stopPropagation()
	cancelHold()
}

function updateHoldProgress() {
	if (!isHolding.value) return

	const elapsed = performance.now() - holdStartTime
	const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100)
	holdProgress.value = pct

	if (pct >= 100) {
		triggerSkip()
	} else {
		animFrameId = requestAnimationFrame(updateHoldProgress)
	}
}

function startHold() {
	if (isHolding.value || isCompleted.value || isFinishing.value) return
	isHolding.value = true
	holdStartTime = performance.now()
	animFrameId = requestAnimationFrame(updateHoldProgress)
}

function cancelHold() {
	if (isCompleted.value || isFinishing.value) return
	isHolding.value = false
	if (animFrameId) {
		cancelAnimationFrame(animFrameId)
		animFrameId = null
	}
	holdProgress.value = 0
}

function triggerSkip() {
	if (isCompleted.value || isFinishing.value) return
	isCompleted.value = true
	isHolding.value = false
	if (animFrameId) {
		cancelAnimationFrame(animFrameId)
		animFrameId = null
	}

	finishIntro()
}

function finishIntro() {
	if (isFinishing.value) return
	isFinishing.value = true

	if (videoRef.value) {
		try {
			videoRef.value.pause()
		} catch (_) {}
	}

	setTimeout(() => {
		emit('intro-complete')
	}, 350)
}

function onVideoError(e) {
	console.warn('Error playing YGGDRASIL intro video:', e)
	finishIntro()
}
</script>

<style scoped>
.ygg-intro-overlay {
	position: absolute;
	inset: 0;
	z-index: 9500;
	background: #000000;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	user-select: none;
	outline: none;
	font-size: calc(1 * var(--size));
}

.intro-video {
	width: 100%;
	height: 100%;
	object-fit: contain;
	background: #000;
}

.fade-overlay {
	position: absolute;
	inset: 0;
	background: #000;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.35s ease;
	z-index: 9505;
}

.fade-overlay.fade-out {
	opacity: 1;
}

/* МОДНЫЙ КРУЖКОВЫЙ ИНДИКАТОР ПРОПУСКА */
.skip-indicator-wrap {
	position: absolute;
	bottom: 2.4em;
	right: 3em;
	z-index: 9520;
	display: flex;
	align-items: center;
	gap: 1em;
	padding: 0.5em 0.9em 0.5em 1.4em;
	background: rgba(8, 14, 28, 0.72);
	border: 1px solid rgba(56, 189, 248, 0.28);
	border-radius: 2.5em;
	box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.75), inset 0 0 0.75em rgba(56, 189, 248, 0.08);
	backdrop-filter: blur(0.75em);
	cursor: pointer;
	opacity: 0.65;
	transform: scale(0.96);
	transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.skip-indicator-wrap:hover {
	opacity: 0.9;
	border-color: rgba(56, 189, 248, 0.5);
	transform: scale(1);
}

.skip-indicator-wrap.is-holding {
	opacity: 1;
	transform: scale(1.05);
	border-color: rgba(56, 189, 248, 0.9);
	box-shadow:
		0 0 1.75em rgba(56, 189, 248, 0.45),
		inset 0 0 1em rgba(56, 189, 248, 0.25);
}

.skip-indicator-wrap.is-completed {
	transform: scale(1.12);
	filter: brightness(1.8);
	border-color: #38bdf8;
	box-shadow: 0 0 2.5em #38bdf8;
}

.skip-info-text {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	text-align: right;
}

.skip-title {
	font-family: 'Overlord', 'Segoe UI', monospace, sans-serif;
	font-size: 0.8em;
	font-weight: 800;
	letter-spacing: 0.12em;
	color: #38bdf8;
	text-transform: uppercase;
	text-shadow: 0 0 0.5em rgba(56, 189, 248, 0.6);
}

.skip-hint {
	font-size: 0.7em;
	color: #94a3b8;
	letter-spacing: 0.03em;
	margin-top: 0.1em;
	transition: color 0.2s ease;
}

.skip-indicator-wrap.is-holding .skip-hint {
	color: #e2e8f0;
}

/* КРУГ ПРОГРЕССА */
.skip-circle-box {
	position: relative;
	width: 3.2em;
	height: 3.2em;
	display: flex;
	align-items: center;
	justify-content: center;
}

.skip-svg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	transform: rotate(-90deg); /* Начало отсчета с 12 часов */
}

.skip-circle-bg {
	stroke: rgba(255, 255, 255, 0.12);
	stroke-width: 4;
	fill: rgba(0, 0, 0, 0.4);
}

.skip-circle-progress {
	stroke: #38bdf8;
	stroke-width: 4.5;
	stroke-linecap: round;
	fill: none;
	filter: drop-shadow(0 0 0.4em #38bdf8);
	transition: stroke-dashoffset 0.05s linear;
}

.skip-center-icon {
	position: relative;
	z-index: 2;
	display: flex;
	align-items: center;
	justify-content: center;
	color: #f1f5f9;
	font-size: 0.95em;
	transition: transform 0.2s ease;
}

.skip-indicator-wrap.is-holding .skip-center-icon {
	transform: scale(1.15);
	color: #38bdf8;
	text-shadow: 0 0 0.5em #38bdf8;
}

@media (max-width: 768px) {
	.skip-indicator-wrap {
		bottom: 1.25em;
		right: 1.25em;
		padding: 0.4em 0.75em 0.4em 1em;
	}
	.skip-info-text {
		display: none;
	}
}
</style>
