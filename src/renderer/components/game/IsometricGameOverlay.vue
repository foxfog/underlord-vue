<template>
	<div class="iso-game-overlay">
		<IsoCanvas
			v-if="locationData"
			ref="isoCanvasRef"
			:location-data="locationData"
			character-id="mc"
			:show-grid="false"
			:show-coords="false"
			:show-heights="false"
			:movement-range="4"
			movement-mode="free"
			mode="play"
			@weed-cleared="onWeedCleared"
			@quest-completed="onQuestCompleted"
			@exit-triggered="onExitTriggered"
		/>
		<div v-else class="iso-loading">
			<span>Загрузка локации...</span>
		</div>

		<!-- Кнопка выхода в углу -->
		<button class="iso-exit-btn" @click="requestExit(null)">
			◀ Покинуть локацию
		</button>

		<!-- HUD с прогрессом прополки -->
		<div class="iso-progress-hud" v-if="totalWeeds > 0">
			<span class="hud-icon">🌿</span>
			<span class="hud-text">Сорняков осталось: <b>{{ remainingWeeds }}</b> / {{ totalWeeds }}</span>
		</div>

		<!-- Уведомление о завершении -->
		<Transition name="fade-up">
			<div class="iso-complete-banner" v-if="questDone">
				<span>✅ Огород прополот! Вернитесь к старосте.</span>
			</div>
		</Transition>

		<!-- Диалог подтверждения выхода -->
		<Transition name="fade-confirm">
			<div v-if="showExitConfirm" class="iso-confirm-backdrop" @click="cancelExit">
				<div class="iso-confirm-dialog" @click.stop>
					<div class="iso-confirm-header">
						<span class="iso-confirm-icon">🚪</span>
						<span class="iso-confirm-title">Покинуть локацию?</span>
					</div>
					<div class="iso-confirm-body">
						<p v-if="!questDone && totalWeeds > 0 && remainingWeeds > 0" class="iso-confirm-warning">
							Огород ещё не очищен от сорняков (осталось: <b>{{ remainingWeeds }}</b> шт.). Вы действительно хотите уйти?
						</p>
						<p v-else class="iso-confirm-text">
							Вернуться в дом старосты?
						</p>
					</div>
					<div class="iso-confirm-actions">
						<button class="iso-btn-cancel" @click="cancelExit">
							Остаться
						</button>
						<button
							class="iso-btn-confirm"
							:class="{ '__success': questDone || remainingWeeds === 0 }"
							@click="confirmExit"
						>
							{{ questDone || remainingWeeds === 0 ? 'Вернуться' : 'Покинуть' }}
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import IsoCanvas from '@/components/game/isometric/IsoCanvas.vue'
import { useIsometricLocations } from '@/composables/useIsometricLocations'

const props = defineProps({
	locationId: {
		type: String,
		required: true
	}
})

const emit = defineEmits(['exit', 'quest-completed'])

const isoCanvasRef = ref(null)
const locationData = ref(null)
const remainingWeeds = ref(0)
const totalWeeds = ref(0)
const questDone = ref(false)
const showExitConfirm = ref(false)
const pendingExit = ref(null)

const { loadLocationById, applyScenarioPreset } = useIsometricLocations()

async function loadLocation() {
	const data = await loadLocationById(props.locationId)
	if (data) {
		// Применяем сценарий с сорняками
		const withWeeds = applyScenarioPreset(data, 'weeds')
		// Считаем начальное количество сорняков
		const weedCount = (withWeeds?.objects || []).filter((o) => o.type === 'weed').length
		totalWeeds.value = weedCount
		remainingWeeds.value = weedCount
		locationData.value = withWeeds
	}
}

function onWeedCleared(data) {
	if (data && typeof data.totalRemaining === 'number') {
		remainingWeeds.value = data.totalRemaining
	} else {
		remainingWeeds.value = Math.max(0, remainingWeeds.value - 1)
	}
}

function onQuestCompleted(data) {
	questDone.value = true
	emit('quest-completed', data)
}

function requestExit(exitPayload = null) {
	pendingExit.value = exitPayload
	showExitConfirm.value = true
}

function confirmExit() {
	showExitConfirm.value = false
	const payload = pendingExit.value
	pendingExit.value = null
	emit('exit', payload)
}

function cancelExit() {
	showExitConfirm.value = false
	pendingExit.value = null
}

function onExitTriggered(exit) {
	requestExit(exit)
}

function onKeyDown(e) {
	if (e.key === 'Escape' && showExitConfirm.value) {
		e.stopPropagation()
		cancelExit()
	}
}

watch(() => props.locationId, loadLocation, { immediate: true })

onMounted(() => {
	window.addEventListener('keydown', onKeyDown)
	loadLocation()
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown)
})

defineExpose({
	requestExit,
	cancelExit,
	showExitConfirm
})
</script>

<style scoped>
.iso-game-overlay {
	position: absolute;
	inset: 0;
	z-index: 200;
	background: #000;
	display: flex;
	align-items: stretch;
	justify-content: stretch;
	font-size: calc(1 * var(--size));
}

.iso-loading {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: 1;
	color: #fff;
	font-size: 1.5em;
}

.iso-exit-btn {
	position: absolute;
	top: 0.75em;
	left: 0.75em;
	z-index: 210;
	background: rgba(0, 0, 0, 0.7);
	color: #e2c97e;
	border: 1px solid rgba(226, 201, 126, 0.4);
	border-radius: 0.4em;
	padding: 0.4em 0.9em;
	font-size: 0.9em;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s;
	font-family: inherit;
}

.iso-exit-btn:hover {
	background: rgba(226, 201, 126, 0.15);
	border-color: rgba(226, 201, 126, 0.7);
	color: #f5e0a0;
}

.iso-progress-hud {
	position: absolute;
	top: 0.75em;
	right: 0.75em;
	z-index: 210;
	background: rgba(0, 0, 0, 0.7);
	color: #c8f0b0;
	border: 1px solid rgba(80, 200, 60, 0.35);
	border-radius: 0.4em;
	padding: 0.4em 0.9em;
	font-size: 0.9em;
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.hud-icon {
	font-size: 1em;
}

.iso-complete-banner {
	position: absolute;
	bottom: 2em;
	left: 50%;
	transform: translateX(-50%);
	z-index: 210;
	background: rgba(30, 80, 20, 0.92);
	color: #c8f0b0;
	border: 1px solid rgba(80, 200, 60, 0.6);
	border-radius: 0.5em;
	padding: 0.6em 1.5em;
	font-size: 1em;
	text-align: center;
}

/* Transitions */
.fade-up-enter-active,
.fade-up-leave-active {
	transition: opacity 0.4s, transform 0.4s;
}
.fade-up-enter-from,
.fade-up-leave-to {
	opacity: 0;
	transform: translateX(-50%) translateY(0.5em);
}

/* Confirm Dialog Backdrop */
.iso-confirm-backdrop {
	position: absolute;
	inset: 0;
	z-index: 250;
	background: rgba(0, 0, 0, 0.65);
	backdrop-filter: blur(0.2em);
	display: flex;
	align-items: center;
	justify-content: center;
}

.iso-confirm-dialog {
	width: min(24em, 85%);
	background: rgba(18, 24, 38, 0.95);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.6em;
	padding: 1.2em 1.5em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.8);
	font-family: inherit;
}

.iso-confirm-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 0.5em;
}

.iso-confirm-icon {
	font-size: 1.4em;
}

.iso-confirm-title {
	font-size: 1.1em;
	font-weight: bold;
	color: #f6c445;
}

.iso-confirm-body {
	font-size: 0.9em;
	line-height: 1.4;
	color: #e2e8f0;
}

.iso-confirm-warning {
	color: #f87171;
	margin: 0;
}

.iso-confirm-text {
	color: #cbd5e1;
	margin: 0;
}

.iso-confirm-actions {
	display: flex;
	justify-content: flex-end;
	gap: 0.8em;
	margin-top: 0.5em;
}

.iso-btn-cancel,
.iso-btn-confirm {
	padding: 0.4em 1.2em;
	border-radius: 0.4em;
	font-size: 0.9em;
	cursor: pointer;
	font-family: inherit;
	transition: background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.iso-btn-cancel {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
}

.iso-btn-cancel:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ffffff;
}

.iso-btn-confirm {
	background: rgba(220, 38, 38, 0.85);
	border: 1px solid rgba(239, 68, 68, 0.6);
	color: #ffffff;
	font-weight: bold;
}

.iso-btn-confirm:hover {
	background: rgba(239, 68, 68, 0.95);
	box-shadow: 0 0 0.8em rgba(239, 68, 68, 0.4);
}

.iso-btn-confirm.__success {
	background: rgba(22, 101, 52, 0.85);
	border-color: rgba(34, 197, 94, 0.6);
}

.iso-btn-confirm.__success:hover {
	background: rgba(34, 197, 94, 0.95);
	box-shadow: 0 0 0.8em rgba(34, 197, 94, 0.4);
}

.fade-confirm-enter-active,
.fade-confirm-leave-active {
	transition: opacity 0.2s, transform 0.2s;
}

.fade-confirm-enter-from,
.fade-confirm-leave-to {
	opacity: 0;
}
</style>
