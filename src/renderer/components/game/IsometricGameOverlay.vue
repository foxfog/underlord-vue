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
		/>
		<div v-else class="iso-loading">
			<span>Загрузка локации...</span>
		</div>

		<!-- Кнопка выхода в углу (как просил пользователь) -->
		<button class="iso-exit-btn" @click="$emit('exit')">
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
	</div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
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

watch(() => props.locationId, loadLocation, { immediate: true })

onMounted(() => {
	loadLocation()
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

/* Transition */
.fade-up-enter-active,
.fade-up-leave-active {
	transition: opacity 0.4s, transform 0.4s;
}
.fade-up-enter-from,
.fade-up-leave-to {
	opacity: 0;
	transform: translateX(-50%) translateY(0.5em);
}
</style>
