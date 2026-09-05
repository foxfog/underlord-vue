<template>
	<div class="shutdown-overlay" :class="[overlayClass, { 'shake-active': isShaking }]">
		<!-- ЭТАП 1: ОБРАТНЫЙ ОТСЧЕТ ДО 00:00:00 -->
		<div v-if="stage === 'countdown'" class="countdown-stage">
			<div class="countdown-warning-badge">СЕРВЕРЫ YGGDRASIL ЗАКРЫВАЮТСЯ</div>
			<div class="countdown-clock" :class="{ 'clock-zero': isZero }">
				{{ clockText }}
			</div>
			<div class="countdown-desc">
				{{ countdownSubtext }}
			</div>
		</div>

		<!-- ЭТАП 2: ЭКРАН ЗАГРУЗКИ / ОТКЛЮЧЕНИЯ ИГРЫ -->
		<div v-if="stage === 'loading'" class="loading-stage">
			<div class="ygg-logo-dim">YGGDRASIL</div>
			<div class="ygg-loading-spinner" v-if="!isMorphed"></div>
			<div class="loading-text" :class="{ 'morphed-text': isMorphed }">
				{{ currentLoadingText }}
			</div>
			<div class="loading-sub" v-if="isMorphed">
				Окружение: Лесная опушка • Атмосферное давление: 760 мм рт. ст. • Чистый кислород
			</div>
		</div>

		<!-- Глитч-эффекты и полосы шума -->
		<div v-if="isGlitching" class="glitch-scanlines"></div>
		<div v-if="isGlitching" class="glitch-color-shift"></div>

		<!-- Плавное затемнение экрана в конце сцены перехода -->
		<div class="fade-to-black-overlay" :class="{ active: isFadingToBlack }"></div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const emit = defineEmits(['sequence-complete'])
const settingsStore = useSettingsStore()

const stage = ref('countdown') // 'countdown' | 'loading'
const clockText = ref('23:59:59')
const isZero = ref(false)
const isShaking = ref(false)
const isGlitching = ref(false)
const countdownSubtext = ref('Финальные секунды работы серверов...')
const currentLoadingText = ref('Отключение от сервера YGGDRASIL...')
const isMorphed = ref(false)
const isFadingToBlack = ref(false)
const overlayClass = ref('theme-countdown')

let audioCtx = null
let noiseNode = null
let gainNode = null
let sequenceTimer = null

// Непрерывный генератор белого/розового шума (шипение экрана/эфира)
function startContinuousHissing() {
	try {
		const AudioContext = window.AudioContext || window.webkitAudioContext
		if (!AudioContext) return
		audioCtx = new AudioContext()
		if (audioCtx.state === 'suspended') {
			audioCtx.resume()
		}

		const common = (settingsStore.audio?.commonVolume ?? 100) / 100
		const sound = (settingsStore.audio?.soundVolume ?? 100) / 100
		const targetVol = Math.max(0.04, Math.min(0.35, common * sound * 0.3))

		const bufferSize = audioCtx.sampleRate * 2
		const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate)
		const data = buffer.getChannelData(0)
		for (let i = 0; i < bufferSize; i++) {
			data[i] = (Math.random() * 2 - 1) * 0.85
		}

		noiseNode = audioCtx.createBufferSource()
		noiseNode.buffer = buffer
		noiseNode.loop = true

		const filter = audioCtx.createBiquadFilter()
		filter.type = 'bandpass'
		filter.frequency.setValueAtTime(1100, audioCtx.currentTime)
		filter.Q.setValueAtTime(1.1, audioCtx.currentTime)

		gainNode = audioCtx.createGain()
		gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime)
		gainNode.gain.linearRampToValueAtTime(targetVol, audioCtx.currentTime + 0.3)

		noiseNode.connect(filter)
		filter.connect(gainNode)
		gainNode.connect(audioCtx.destination)

		noiseNode.start()
	} catch (e) {
		console.warn('Continuous hissing error:', e)
	}
}

function stopContinuousHissing(fadeDuration = 1.5) {
	if (!gainNode || !audioCtx) return
	try {
		gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime)
		gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + fadeDuration)
		setTimeout(() => {
			if (noiseNode) {
				try { noiseNode.stop() } catch (_) {}
				noiseNode.disconnect()
				noiseNode = null
			}
			if (audioCtx) {
				try { audioCtx.close() } catch (_) {}
				audioCtx = null
			}
		}, fadeDuration * 1000 + 100)
	} catch (_) {}
}

onMounted(() => {
	startSequence()
})

onUnmounted(() => {
	if (sequenceTimer) clearTimeout(sequenceTimer)
	stopContinuousHissing(0.1)
})

function startSequence() {
	// Мгновенный переход к полуночи (23:59:59 -> 00:00:00)
	setTimeout(() => {
		clockText.value = '00:00:00'
		onZeroReached()
	}, 700)
}

function onZeroReached() {
	isZero.value = true
	isShaking.value = true
	isGlitching.value = true
	countdownSubtext.value = 'СЕРВЕРЫ ОСТАНОВЛЕНЫ. Ошибка принудительного разрыва связи [STATUS 0xDEADBEEF]'

	// Запуск непрерывного шипения без прерываний!
	startContinuousHissing()

	// Через 2 секунды переходим к фазе отключения (шипение продолжается непрерывно!)
	sequenceTimer = setTimeout(() => {
		stage.value = 'loading'
		isShaking.value = false
		overlayClass.value = 'theme-loading'
		currentLoadingText.value = 'Отключение от сервера YGGDRASIL...'

		// Еще через 1.8 секунды — превращение в Неизвестный мир (шипение продолжается!)
		sequenceTimer = setTimeout(() => {
			currentLoadingText.value = '« Неизвестный мир... »'
			isMorphed.value = true
			overlayClass.value = 'theme-unknown'

			// Плавное затемнение экрана и затухание шипения в течение 1.5 секунд
			sequenceTimer = setTimeout(() => {
				isFadingToBlack.value = true
				stopContinuousHissing(1.5)

				// Финальная передача управления сцене новеллы (деревня Карн) после полного затемнения + небольшая пауза
				sequenceTimer = setTimeout(() => {
					emit('sequence-complete')
				}, 1700)
			}, 1200)
		}, 1800)
	}, 2000)
}
</script>

<style scoped>
.shutdown-overlay {
	position: absolute;
	inset: 0;
	z-index: 9200;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: 'Overlord', 'Segoe UI', monospace, sans-serif;
	user-select: none;
	overflow: hidden;
	transition: background 1s ease;
	font-size: calc(1 * var(--size));
}

.theme-countdown {
	background: #05050a;
	color: #f8fafc;
}

.theme-loading {
	background: #020617;
	color: #38bdf8;
}

.theme-unknown {
	background: radial-gradient(circle at center, #062b19 0%, #031109 70%, #000000 100%);
	color: #86efac;
}

/* ЭТАП ОБРАТНОГО ОТСЧЕТА */
.countdown-stage {
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1.5em;
}

.countdown-warning-badge {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #f87171;
	padding: 0.4em 1.2em;
	border-radius: 1.25em;
	font-size: 0.9em;
	letter-spacing: 0.1em;
	font-weight: 700;
}

.countdown-clock {
	font-size: 6.5em;
	font-weight: 900;
	font-family: monospace;
	letter-spacing: 0.1em;
	color: #e2e8f0;
	text-shadow: 0 0 0.5em rgba(255, 255, 255, 0.4);
	transition: all 0.3s ease;
}

.clock-zero {
	color: #ef4444;
	text-shadow: 0 0 0.6em rgba(239, 68, 68, 0.8), 0 0 1.2em rgba(239, 68, 68, 0.4);
	animation: pulseZero 0.6s infinite alternate;
}

.countdown-desc {
	font-size: 1.1em;
	color: #94a3b8;
	letter-spacing: 0.05em;
}

/* ЭТАП ЗАГРУЗКИ / ПЕРЕХОДА */
.loading-stage {
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2em;
}

.ygg-logo-dim {
	font-size: 2.2em;
	letter-spacing: 0.25em;
	color: rgba(255, 255, 255, 0.25);
	font-weight: 900;
}

.ygg-loading-spinner {
	width: 3.2em;
	height: 3.2em;
	border: 0.2em solid rgba(56, 189, 248, 0.2);
	border-top-color: #38bdf8;
	border-radius: 50%;
	animation: spin 1s linear infinite;
}

.loading-text {
	font-size: 1.4em;
	letter-spacing: 0.1em;
	color: #94a3b8;
	font-family: monospace;
	transition: all 0.5s ease;
}

.morphed-text {
	font-size: 2.5em;
	font-family: 'Overlord', serif;
	color: #86efac;
	text-shadow: 0 0 0.5em rgba(134, 239, 172, 0.7), 0 0 1em rgba(34, 197, 94, 0.4);
	letter-spacing: 0.15em;
	animation: floatText 2s infinite alternate ease-in-out;
}

.loading-sub {
	font-size: 0.9em;
	color: #4ade80;
	letter-spacing: 0.05em;
	opacity: 0.85;
}

/* ЭФФЕКТ ТРЯСКИ ЭКРАНА */
.shake-active {
	animation: screenShake 0.12s infinite;
}

@keyframes screenShake {
	0% { transform: translate(0, 0) rotate(0deg); }
	20% { transform: translate(-0.4em, 0.35em) rotate(-0.5deg); }
	40% { transform: translate(0.4em, -0.25em) rotate(0.5deg); }
	60% { transform: translate(-0.35em, -0.2em) rotate(0.3deg); }
	80% { transform: translate(0.25em, 0.25em) rotate(-0.3deg); }
	100% { transform: translate(0, 0) rotate(0deg); }
}

@keyframes pulseZero {
	from { transform: scale(1); }
	to { transform: scale(1.04); }
}

@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

@keyframes floatText {
	from { transform: translateY(0); }
	to { transform: translateY(-0.25em); }
}

.glitch-scanlines {
	position: absolute;
	inset: 0;
	background: repeating-linear-gradient(
		0deg,
		rgba(0, 0, 0, 0.45) 0,
		rgba(0, 0, 0, 0.45) calc(0.12 * var(--size)),
		transparent calc(0.12 * var(--size)),
		transparent calc(0.24 * var(--size))
	);
	pointer-events: none;
}

.glitch-color-shift {
	position: absolute;
	inset: 0;
	background: rgba(239, 68, 68, 0.15);
	mix-blend-mode: screen;
	animation: glitchBlink 0.1s infinite;
	pointer-events: none;
}

@keyframes glitchBlink {
	0% { opacity: 0.8; }
	50% { opacity: 0.2; }
	100% { opacity: 0.9; }
}

.fade-to-black-overlay {
	position: absolute;
	inset: 0;
	background: #000000;
	opacity: 0;
	pointer-events: none;
	z-index: 10000;
	transition: opacity 1.5s ease-in-out;
}

.fade-to-black-overlay.active {
	opacity: 1;
}
</style>
