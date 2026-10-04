<template>
	<div
		class="perf-overlay"
		:class="{ '__is-collapsed': isCollapsed }"
		@click="toggleCollapse"
	>
		<div class="perf-header">
			<span class="perf-title">⚡ PERF</span>
			<span
				class="perf-badge"
				:class="{
					'__good': currentFps >= 55,
					'__warn': currentFps >= 30 && currentFps < 55,
					'__bad': currentFps < 30
				}"
			>
				{{ currentFps }} FPS
			</span>
			<span class="perf-toggle-hint">{{ isCollapsed ? '▶' : '▼' }}</span>
		</div>

		<div v-if="!isCollapsed" class="perf-body">
			<!-- Frame Time Metric -->
			<div class="perf-row">
				<span class="perf-label">Кадр:</span>
				<span
					class="perf-val"
					:class="{
						'__good': frameDurationMs <= 16.7,
						'__warn': frameDurationMs > 16.7 && frameDurationMs <= 33.3,
						'__bad': frameDurationMs > 33.3
					}"
				>
					{{ frameDurationMs.toFixed(1) }} мс
				</span>
			</div>

			<!-- Frame Budget Bar (16.6ms = 60 FPS target) -->
			<div class="perf-budget-bar">
				<div
					class="perf-budget-fill"
					:style="{ width: Math.min(100, (frameDurationMs / 33.3) * 100) + '%' }"
					:class="{
						'__good': frameDurationMs <= 16.7,
						'__warn': frameDurationMs > 16.7 && frameDurationMs <= 33.3,
						'__bad': frameDurationMs > 33.3
					}"
				></div>
				<div class="perf-budget-target-line" title="Целевой бюджет: 16.6 мс (60 FPS)"></div>
			</div>

			<!-- Min FPS / 1% Lows -->
			<div class="perf-row">
				<span class="perf-label">Мин FPS (дропы):</span>
				<span class="perf-val">{{ minFps }}</span>
			</div>

			<!-- Memory Heap (Chromium / Electron) -->
			<div v-if="heapUsageMb !== null" class="perf-row">
				<span class="perf-label">JS Heap:</span>
				<span class="perf-val">{{ heapUsageMb.toFixed(1) }} МБ</span>
			</div>

			<div class="perf-footer">
				<span class="perf-hint">F3 — скрыть | клик — сжать</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

defineOptions({
	name: 'PerformanceOverlay'
})

const isCollapsed = ref(false)
const currentFps = ref(60)
const minFps = ref(60)
const frameDurationMs = ref(16.6)
const heapUsageMb = ref(null)

let animId = null
let frameCount = 0
let lastFpsCalcTime = performance.now()
let lastFrameTime = performance.now()
let minFpsInWindow = 60

function toggleCollapse() {
	isCollapsed.value = !isCollapsed.value
}

function updatePerformance(now) {
	const delta = now - lastFrameTime
	lastFrameTime = now

	// Smooth frame duration
	if (delta > 0 && delta < 500) {
		frameDurationMs.value = frameDurationMs.value * 0.85 + delta * 0.15
	}

	frameCount++

	// Recalculate FPS every 500ms
	if (now - lastFpsCalcTime >= 500) {
		const elapsedSec = (now - lastFpsCalcTime) / 1000
		const instantFps = Math.round(frameCount / elapsedSec)
		currentFps.value = instantFps

		if (instantFps < minFpsInWindow) {
			minFpsInWindow = instantFps
		}
		minFps.value = minFpsInWindow

		frameCount = 0
		lastFpsCalcTime = now

		// Query memory if available in Electron
		if (typeof performance !== 'undefined' && performance.memory?.usedJSHeapSize) {
			heapUsageMb.value = performance.memory.usedJSHeapSize / (1024 * 1024)
		}
	}

	// Reset minFps every 5 seconds to stay relevant
	if (now % 5000 < 20) {
		minFpsInWindow = currentFps.value
	}

	animId = requestAnimationFrame(updatePerformance)
}

onMounted(() => {
	lastFrameTime = performance.now()
	lastFpsCalcTime = performance.now()
	animId = requestAnimationFrame(updatePerformance)
})

onUnmounted(() => {
	if (animId) {
		cancelAnimationFrame(animId)
		animId = null
	}
})
</script>

<style scoped>
.perf-overlay {
	position: absolute;
	top: 0.6em;
	right: 0.6em;
	z-index: 9999;
	background: rgba(10, 15, 26, 0.92);
	border: 1px solid rgba(56, 189, 248, 0.35);
	border-radius: 0.4em;
	padding: 0.4em 0.6em;
	font-family: monospace, sans-serif;
	font-size: 0.8em;
	color: #f1f5f9;
	box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(0.3em);
	cursor: pointer;
	user-select: none;
	min-width: 9.5em;
	pointer-events: auto;
}

.perf-overlay.__is-collapsed {
	min-width: auto;
	padding: 0.3em 0.5em;
}

.perf-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5em;
}

.perf-title {
	font-weight: bold;
	color: #38bdf8;
	font-size: 0.85em;
	letter-spacing: 0.05em;
}

.perf-badge {
	font-weight: bold;
	padding: 0.1em 0.3em;
	border-radius: 0.25em;
	font-size: 0.95em;
}

.perf-badge.__good,
.perf-val.__good,
.perf-budget-fill.__good {
	color: #4ade80;
	background: rgba(74, 222, 128, 0.15);
}

.perf-badge.__warn,
.perf-val.__warn,
.perf-budget-fill.__warn {
	color: #facc15;
	background: rgba(250, 204, 21, 0.18);
}

.perf-badge.__bad,
.perf-val.__bad,
.perf-budget-fill.__bad {
	color: #f87171;
	background: rgba(248, 113, 113, 0.25);
}

.perf-toggle-hint {
	font-size: 0.7em;
	color: #64748b;
}

.perf-body {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	margin-top: 0.4em;
	padding-top: 0.35em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.perf-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.82em;
}

.perf-label {
	color: #94a3b8;
}

.perf-val {
	font-weight: 600;
	padding: 0.05em 0.2em;
	border-radius: 0.2em;
}

.perf-budget-bar {
	position: relative;
	width: 100%;
	height: 0.3em;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 0.15em;
	overflow: hidden;
	margin: 0.1em 0;
}

.perf-budget-fill {
	height: 100%;
	border-radius: 0.15em;
	transition: width 0.1s ease;
}

.perf-budget-target-line {
	position: absolute;
	left: 50%;
	top: 0;
	bottom: 0;
	width: 0;
	border-left: 1px solid #38bdf8;
	opacity: 0.8;
}

.perf-footer {
	margin-top: 0.2em;
	font-size: 0.65em;
	color: #64748b;
	text-align: center;
}
</style>
