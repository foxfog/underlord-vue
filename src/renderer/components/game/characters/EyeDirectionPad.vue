<template>
	<div class="eye-direction-pad">
		<!-- Mode Switcher & Range Multiplier -->
		<div class="eye-mode-bar">
			<span class="emb-title">Режим:</span>
			<div class="emb-buttons">
				<button
					type="button"
					class="eye-mode-btn"
					:class="{ __active: modelValueMode === 'linked' }"
					@click="$emit('update:modelValueMode', 'linked')"
				>
					👀 Оба глаза
				</button>
				<button
					type="button"
					class="eye-mode-btn"
					:class="{ __active: modelValueMode === 'independent' }"
					@click="$emit('update:modelValueMode', 'independent')"
				>
					👁️👁️ Раздельно
				</button>
			</div>
		</div>

		<!-- Amplitude / Range Multiplier -->
		<div class="eye-range-bar">
			<span class="erb-title" title="Максимальный размах смещения зрачков">Размах хода:</span>
			<div class="erb-buttons">
				<button
					v-for="m in [1.0, 1.5, 2.0, 2.5, 3.0]"
					:key="m"
					type="button"
					class="eye-range-btn"
					:class="{ __active: offsetRangeMultiplier === m }"
					@click="offsetRangeMultiplier = m"
				>
					{{ m.toFixed(1) }}x
				</button>
			</div>
		</div>

		<!-- Joysticks Area -->
		<div class="joysticks-container">
			<!-- Linked Single Pad -->
			<div v-if="modelValueMode === 'linked'" class="pad-wrapper">
				<div class="pad-label">
					<span>👀 Направление взгляда</span>
					<span class="pad-coords">({{ formatVal(linkedOffset.x) }}, {{ formatVal(linkedOffset.y) }})</span>
				</div>
				<div
					ref="linkedPadRef"
					class="circle-pad"
					@mousedown="onPadMouseDown($event, 'linked')"
					@touchstart.passive="onPadTouchStart($event, 'linked')"
				>
					<div class="pad-crosshair-h"></div>
					<div class="pad-crosshair-v"></div>
					<div class="pad-center-guide"></div>
					<div
						class="pad-knob"
						:style="getKnobStyle(linkedOffset.x, linkedOffset.y)"
					>
						<span class="knob-pupil"></span>
					</div>
				</div>

				<!-- Precise Numeric Sliders for Linked -->
				<div class="pad-fine-controls">
					<div class="pfc-row">
						<span class="pfc-axis">X:</span>
						<input
							type="range"
							min="-3.0"
							max="3.0"
							step="0.01"
							class="pfc-range"
							:value="linkedOffset.x || 0"
							@input="updateCoordAxis('linked', 'x', $event.target.value)"
						/>
						<input
							type="number"
							min="-3.0"
							max="3.0"
							step="0.01"
							class="pfc-number"
							:value="linkedOffset.x || 0"
							@input="updateCoordAxis('linked', 'x', $event.target.value)"
						/>
						<button
							v-if="linkedOffset.x !== 0"
							type="button"
							class="pfc-reset-btn"
							title="Сбросить X в 0"
							@click="updateCoordAxis('linked', 'x', 0)"
						>
							🔄
						</button>
					</div>
					<div class="pfc-row">
						<span class="pfc-axis">Y:</span>
						<input
							type="range"
							min="-3.0"
							max="3.0"
							step="0.01"
							class="pfc-range"
							:value="linkedOffset.y || 0"
							@input="updateCoordAxis('linked', 'y', $event.target.value)"
						/>
						<input
							type="number"
							min="-3.0"
							max="3.0"
							step="0.01"
							class="pfc-number"
							:value="linkedOffset.y || 0"
							@input="updateCoordAxis('linked', 'y', $event.target.value)"
						/>
						<button
							v-if="linkedOffset.y !== 0"
							type="button"
							class="pfc-reset-btn"
							title="Сбросить Y в 0"
							@click="updateCoordAxis('linked', 'y', 0)"
						>
							🔄
						</button>
					</div>
				</div>
			</div>

			<!-- Independent Dual Pads -->
			<div v-else class="dual-pads-wrapper">
				<!-- Left Eye -->
				<div class="pad-wrapper">
					<div class="pad-label">
						<span>👁️ Левый глаз</span>
						<span class="pad-coords">({{ formatVal(leftOffset.x) }}, {{ formatVal(leftOffset.y) }})</span>
					</div>
					<div
						ref="leftPadRef"
						class="circle-pad __dual"
						@mousedown="onPadMouseDown($event, 'left')"
						@touchstart.passive="onPadTouchStart($event, 'left')"
					>
						<div class="pad-crosshair-h"></div>
						<div class="pad-crosshair-v"></div>
						<div class="pad-center-guide"></div>
						<div
							class="pad-knob"
							:style="getKnobStyle(leftOffset.x, leftOffset.y)"
						>
							<span class="knob-pupil"></span>
						</div>
					</div>

					<!-- Precise Numeric Sliders for Left -->
					<div class="pad-fine-controls __compact">
						<div class="pfc-row">
							<span class="pfc-axis">X:</span>
							<input
								type="range"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-range"
								:value="leftOffset.x || 0"
								@input="updateCoordAxis('left', 'x', $event.target.value)"
							/>
							<input
								type="number"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-number"
								:value="leftOffset.x || 0"
								@input="updateCoordAxis('left', 'x', $event.target.value)"
							/>
						</div>
						<div class="pfc-row">
							<span class="pfc-axis">Y:</span>
							<input
								type="range"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-range"
								:value="leftOffset.y || 0"
								@input="updateCoordAxis('left', 'y', $event.target.value)"
							/>
							<input
								type="number"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-number"
								:value="leftOffset.y || 0"
								@input="updateCoordAxis('left', 'y', $event.target.value)"
							/>
						</div>
					</div>
				</div>

				<!-- Right Eye -->
				<div class="pad-wrapper">
					<div class="pad-label">
						<span>👁️ Правый глаз</span>
						<span class="pad-coords">({{ formatVal(rightOffset.x) }}, {{ formatVal(rightOffset.y) }})</span>
					</div>
					<div
						ref="rightPadRef"
						class="circle-pad __dual"
						@mousedown="onPadMouseDown($event, 'right')"
						@touchstart.passive="onPadTouchStart($event, 'right')"
					>
						<div class="pad-crosshair-h"></div>
						<div class="pad-crosshair-v"></div>
						<div class="pad-center-guide"></div>
						<div
							class="pad-knob"
							:style="getKnobStyle(rightOffset.x, rightOffset.y)"
						>
							<span class="knob-pupil"></span>
						</div>
					</div>

					<!-- Precise Numeric Sliders for Right -->
					<div class="pad-fine-controls __compact">
						<div class="pfc-row">
							<span class="pfc-axis">X:</span>
							<input
								type="range"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-range"
								:value="rightOffset.x || 0"
								@input="updateCoordAxis('right', 'x', $event.target.value)"
							/>
							<input
								type="number"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-number"
								:value="rightOffset.x || 0"
								@input="updateCoordAxis('right', 'x', $event.target.value)"
							/>
						</div>
						<div class="pfc-row">
							<span class="pfc-axis">Y:</span>
							<input
								type="range"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-range"
								:value="rightOffset.y || 0"
								@input="updateCoordAxis('right', 'y', $event.target.value)"
							/>
							<input
								type="number"
								min="-3.0"
								max="3.0"
								step="0.01"
								class="pfc-number"
								:value="rightOffset.y || 0"
								@input="updateCoordAxis('right', 'y', $event.target.value)"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Scene Eye Presets Grid -->
		<div class="presets-section">
			<div class="presets-header">
				<span class="ph-title">Быстрые пресеты для сцен:</span>
				<button type="button" class="center-btn" @click="resetToCenter">
					🎯 В центр (0, 0)
				</button>
			</div>

			<div class="presets-grid">
				<button
					v-for="p in presets"
					:key="p.id"
					type="button"
					class="preset-btn"
					:title="p.label"
					@click="$emit('select-preset', p)"
				>
					<span class="preset-icon">{{ p.icon }}</span>
					<span class="preset-label">{{ p.label }}</span>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onUnmounted } from 'vue'

const props = defineProps({
	modelValueMode: {
		type: String,
		default: 'linked'
	},
	linkedOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	leftOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	rightOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	presets: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits([
	'update:modelValueMode',
	'update:linkedOffset',
	'update:leftOffset',
	'update:rightOffset',
	'select-preset'
])

const linkedPadRef = ref(null)
const leftPadRef = ref(null)
const rightPadRef = ref(null)

const offsetRangeMultiplier = ref(2.0)

let activeTarget = null // 'linked' | 'left' | 'right'

function formatVal(v) {
	return (v || 0).toFixed(2)
}

function getKnobStyle(x, y) {
	// Knob position within circle in %: center is 50%, range +- 38%
	const mult = Number(offsetRangeMultiplier.value) || 2.0
	const normX = Math.max(-1, Math.min(1, (x || 0) / mult))
	const normY = Math.max(-1, Math.min(1, (y || 0) / mult))
	const px = 50 + normX * 38
	const py = 50 + normY * 38
	return {
		left: `${px}%`,
		top: `${py}%`
	}
}

function getTargetPadRef(target) {
	if (target === 'linked') return linkedPadRef.value
	if (target === 'left') return leftPadRef.value
	if (target === 'right') return rightPadRef.value
	return null
}

function updateCoordFromPointer(clientX, clientY, target) {
	const pad = getTargetPadRef(target)
	if (!pad) return

	const rect = pad.getBoundingClientRect()
	const centerX = rect.left + rect.width / 2
	const centerY = rect.top + rect.height / 2
	const radius = rect.width / 2

	const dx = (clientX - centerX) / radius
	const dy = (clientY - centerY) / radius

	// Clamp to unit circle length <= 1
	const distance = Math.hypot(dx, dy)
	let nx = dx
	let ny = dy
	if (distance > 1) {
		nx = dx / distance
		ny = dy / distance
	}

	const mult = Number(offsetRangeMultiplier.value) || 2.0
	nx = Math.round(nx * mult * 100) / 100
	ny = Math.round(ny * mult * 100) / 100

	if (target === 'linked') {
		emit('update:linkedOffset', { x: nx, y: ny })
		emit('update:leftOffset', { x: nx, y: ny })
		emit('update:rightOffset', { x: nx, y: ny })
	} else if (target === 'left') {
		emit('update:leftOffset', { x: nx, y: ny })
	} else if (target === 'right') {
		emit('update:rightOffset', { x: nx, y: ny })
	}
}

function updateCoordAxis(target, axis, val) {
	const num = Number(val) || 0
	if (target === 'linked') {
		const next = { ...props.linkedOffset, [axis]: num }
		emit('update:linkedOffset', next)
		emit('update:leftOffset', { ...props.leftOffset, [axis]: num })
		emit('update:rightOffset', { ...props.rightOffset, [axis]: num })
	} else if (target === 'left') {
		emit('update:leftOffset', { ...props.leftOffset, [axis]: num })
	} else if (target === 'right') {
		emit('update:rightOffset', { ...props.rightOffset, [axis]: num })
	}
}

function onPadMouseDown(e, target) {
	activeTarget = target
	updateCoordFromPointer(e.clientX, e.clientY, target)
	window.addEventListener('mousemove', onWindowMouseMove)
	window.addEventListener('mouseup', onWindowMouseUp)
}

function onWindowMouseMove(e) {
	if (!activeTarget) return
	updateCoordFromPointer(e.clientX, e.clientY, activeTarget)
}

function onWindowMouseUp() {
	activeTarget = null
	window.removeEventListener('mousemove', onWindowMouseMove)
	window.removeEventListener('mouseup', onWindowMouseUp)
}

function onPadTouchStart(e, target) {
	if (!e.touches[0]) return
	activeTarget = target
	updateCoordFromPointer(e.touches[0].clientX, e.touches[0].clientY, target)
	window.addEventListener('touchmove', onWindowTouchMove, { passive: false })
	window.addEventListener('touchend', onWindowTouchEnd)
}

function onWindowTouchMove(e) {
	if (!activeTarget || !e.touches[0]) return
	e.preventDefault()
	updateCoordFromPointer(e.touches[0].clientX, e.touches[0].clientY, activeTarget)
}

function onWindowTouchEnd() {
	activeTarget = null
	window.removeEventListener('touchmove', onWindowTouchMove)
	window.removeEventListener('touchend', onWindowTouchEnd)
}

function resetToCenter() {
	emit('update:linkedOffset', { x: 0, y: 0 })
	emit('update:leftOffset', { x: 0, y: 0 })
	emit('update:rightOffset', { x: 0, y: 0 })
}

onUnmounted(() => {
	window.removeEventListener('mousemove', onWindowMouseMove)
	window.removeEventListener('mouseup', onWindowMouseUp)
	window.removeEventListener('touchmove', onWindowTouchMove)
	window.removeEventListener('touchend', onWindowTouchEnd)
})
</script>

<style scoped>
.eye-direction-pad {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	background: rgba(14, 19, 30, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.9em;
}

.eye-mode-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5em;
}

.emb-title {
	font-size: 0.85em;
	color: #94a3b8;
	font-weight: bold;
}

.emb-buttons {
	display: flex;
	gap: 0.4em;
}

.eye-mode-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.3em;
	padding: 0.25em 0.6em;
	font-size: 0.8em;
	cursor: pointer;
	transition: all 0.2s;
}

.eye-mode-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.eye-mode-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

.eye-range-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.5em;
	padding-top: 0.3em;
	border-top: 1px dashed rgba(255, 255, 255, 0.08);
}

.erb-title {
	font-size: 0.78em;
	color: #94a3b8;
}

.erb-buttons {
	display: flex;
	gap: 0.3em;
}

.eye-range-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.15em 0.45em;
	font-size: 0.75em;
	cursor: pointer;
	transition: all 0.15s;
}

.eye-range-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.eye-range-btn.__active {
	background: rgba(56, 189, 248, 0.2);
	border-color: #38bdf8;
	color: #38bdf8;
	font-weight: bold;
}

.pad-fine-controls {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	width: 100%;
	max-width: 15em;
	margin-top: 0.4em;
	background: rgba(0, 0, 0, 0.25);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.35em;
	padding: 0.4em 0.5em;
}

.pad-fine-controls.__compact {
	max-width: 11em;
	padding: 0.3em 0.4em;
	gap: 0.25em;
}

.pfc-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.pfc-axis {
	font-size: 0.75em;
	font-weight: bold;
	color: #f6c445;
	width: 1.2em;
	text-align: center;
}

.pfc-range {
	flex: 1;
	accent-color: #f6c445;
	height: 0.3em;
	cursor: pointer;
}

.pfc-number {
	width: 3.8em;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.25em;
	color: #e2e8f0;
	font-size: 0.75em;
	padding: 0.15em 0.3em;
	text-align: center;
	font-family: monospace;
}

.pad-fine-controls.__compact .pfc-number {
	width: 3.2em;
}

.pfc-reset-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #94a3b8;
	border-radius: 0.2em;
	padding: 0.1em 0.3em;
	font-size: 0.7em;
	cursor: pointer;
}

.pfc-reset-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.joysticks-container {
	display: flex;
	justify-content: center;
	padding: 0.5em 0;
}

.pad-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.4em;
}

.dual-pads-wrapper {
	display: flex;
	gap: 1.5em;
	justify-content: center;
}

.pad-label {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.82em;
	color: #cbd5e1;
}

.pad-coords {
	font-size: 0.75em;
	color: #94a3b8;
	font-family: monospace;
}

.circle-pad {
	width: 8em;
	height: 8em;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
	border: 2px solid rgba(246, 196, 69, 0.4);
	box-shadow: inset 0 0 1em rgba(0, 0, 0, 0.6), 0 0.2em 0.6em rgba(0, 0, 0, 0.4);
	position: relative;
	cursor: grab;
	user-select: none;
	touch-action: none;
	transition: border-color 0.2s, box-shadow 0.2s;
}

.circle-pad:active {
	cursor: grabbing;
	border-color: #f6c445;
	box-shadow: inset 0 0 1.2em rgba(246, 196, 69, 0.25), 0 0 0.8em rgba(246, 196, 69, 0.3);
}

.circle-pad.__dual {
	width: 6.5em;
	height: 6.5em;
}

.pad-crosshair-h {
	position: absolute;
	top: 50%;
	left: 0.5em;
	right: 0.5em;
	height: 0.06em;
	background: rgba(255, 255, 255, 0.1);
	transform: translateY(-50%);
	pointer-events: none;
}

.pad-crosshair-v {
	position: absolute;
	left: 50%;
	top: 0.5em;
	bottom: 0.5em;
	width: 0.06em;
	background: rgba(255, 255, 255, 0.1);
	transform: translateX(-50%);
	pointer-events: none;
}

.pad-center-guide {
	position: absolute;
	left: 50%;
	top: 50%;
	width: 2.2em;
	height: 2.2em;
	border-radius: 50%;
	border: 1px dashed rgba(255, 255, 255, 0.15);
	transform: translate(-50%, -50%);
	pointer-events: none;
}

.pad-knob {
	position: absolute;
	width: 2em;
	height: 2em;
	border-radius: 50%;
	background: radial-gradient(circle at 35% 35%, #ffd769, #e6a817);
	box-shadow: 0 0.2em 0.5em rgba(0, 0, 0, 0.6), 0 0 0.6em rgba(246, 196, 69, 0.6);
	transform: translate(-50%, -50%);
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
	transition: transform 0.05s ease-out;
}

.circle-pad.__dual .pad-knob {
	width: 1.6em;
	height: 1.6em;
}

.knob-pupil {
	width: 0.7em;
	height: 0.7em;
	border-radius: 50%;
	background: #0f172a;
	box-shadow: inset 0 0 0.2em rgba(0, 0, 0, 0.8);
}

.presets-section {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	padding-top: 0.6em;
}

.presets-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.ph-title {
	font-size: 0.8em;
	color: #94a3b8;
}

.center-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	border-radius: 0.25em;
	padding: 0.2em 0.5em;
	font-size: 0.75em;
	cursor: pointer;
}

.center-btn:hover {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
}

.presets-grid {
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 0.35em;
}

.preset-btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.35em;
	padding: 0.35em 0.2em;
	cursor: pointer;
	transition: all 0.15s;
}

.preset-btn:hover {
	background: rgba(246, 196, 69, 0.18);
	border-color: #f6c445;
	transform: translateY(-0.1em);
}

.preset-icon {
	font-size: 1.1em;
}

.preset-label {
	font-size: 0.68em;
	color: #cbd5e1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 100%;
}
</style>
