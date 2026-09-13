<template>
	<div class="iso-tester-view">
		<!-- Isometric Canvas Engine -->
		<IsoCanvas
			v-if="currentLocationData"
			ref="canvasRef"
			:location-data="currentLocationData"
			:character-id="selectedCharacterId"
			:show-grid="showGrid"
			:show-coords="showCoords"
			:show-heights="showHeights"
			:movement-range="4"
			:movement-mode="movementMode"
			:tactical-config="tacticalConfig"
			mode="play"
			@weed-cleared="onWeedCleared"
			@quest-completed="onQuestCompleted"
			@turn-changed="onTurnChanged"
			@points-changed="onPointsChanged"
			@action-failed="onActionFailed"
		/>

		<!-- Top Header Bar -->
		<header class="iso-header">
			<div class="header-left">
				<button class="iso-btn iso-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>

				<!-- Location Selector -->
				<div class="header-selector-box">
					<span class="selector-icon">📂</span>
					<label class="selector-label">Карта:</label>
					<select
						v-model="selectedLocationId"
						class="iso-select"
						@change="onLocationChange"
					>
						<option
							v-for="loc in availableLocations"
							:key="loc.id"
							:value="loc.id"
						>
							{{ loc.name }}
						</option>
					</select>
				</div>

				<!-- Character Selector -->
				<div class="header-selector-box">
					<span class="selector-icon">👤</span>
					<label class="selector-label">Герой:</label>
					<select
						v-model="selectedCharacterId"
						class="iso-select"
					>
						<option
							v-for="c in characterList"
							:key="c.id"
							:value="c.id"
						>
							{{ c.name }}
						</option>
					</select>
				</div>

				<!-- Scenario Preset Selector -->
				<div class="header-selector-box">
					<span class="selector-icon">🎭</span>
					<label class="selector-label">Сценарий:</label>
					<select
						v-model="selectedScenario"
						class="iso-select"
						@change="onScenarioChange"
					>
						<option value="weeds">🌿 Квест: Прополка</option>
						<option value="combat">⚔️ Тактический бой</option>
						<option value="sandbox">🏝️ Песочница</option>
					</select>
				</div>

				<!-- Movement Mode Selector -->
				<div class="header-selector-box">
					<span class="selector-icon">🕹️</span>
					<label class="selector-label">Режим:</label>
					<select
						v-model="movementMode"
						class="iso-select"
					>
						<option value="free">Свободный ход</option>
						<option value="turn-based">Пошаговый (MP/AP)</option>
					</select>
				</div>
			</div>

			<div class="header-right">
				<button
					v-if="selectedScenario === 'weeds'"
					class="iso-btn iso-btn-secondary"
					title="Случайно раскидать сорняки по свободным клеткам"
					@click="onRandomizeWeeds"
				>
					<span>🎲 Сорняки</span>
				</button>
				<button
					class="iso-btn iso-btn-secondary"
					title="Перейти в визуальный редактор карт"
					@click="goToEditor"
				>
					<span>🛠️ Редактор</span>
				</button>
			</div>
		</header>

		<!-- Tactical Turn-Based HUD (Center-Top) -->
		<div v-if="movementMode === 'turn-based'" class="iso-tactical-hud">
			<div class="hud-turn-badge">
				<span class="hud-turn-icon">⏳</span>
				<span class="hud-turn-text">Ход {{ tacticalState.turn }}</span>
			</div>

			<div class="hud-stat-box hud-mp-box">
				<div class="stat-header">
					<span class="stat-icon">🏃</span>
					<span class="stat-name">Шаги (MP)</span>
					<span class="stat-val">{{ tacticalState.mp }} / {{ tacticalConfig.maxMp }}</span>
				</div>
				<div class="pips-row">
					<span
						v-for="i in tacticalConfig.maxMp"
						:key="'mp-' + i"
						class="pip mp-pip"
						:class="{ __filled: i <= tacticalState.mp }"
					/>
				</div>
			</div>

			<div class="hud-stat-box hud-ap-box">
				<div class="stat-header">
					<span class="stat-icon">⚔️</span>
					<span class="stat-name">Действия (AP)</span>
					<span class="stat-val">{{ tacticalState.ap }} / {{ tacticalConfig.maxAp }}</span>
				</div>
				<div class="pips-row">
					<span
						v-for="i in tacticalConfig.maxAp"
						:key="'ap-' + i"
						class="pip ap-pip"
						:class="{ __filled: i <= tacticalState.ap }"
					/>
				</div>
			</div>

			<button
				class="hud-end-turn-btn"
				:class="{ __pulsing: tacticalState.mp === 0 && tacticalState.ap === 0 }"
				title="Завершить текущий ход и восстановить очки (Пробел)"
				@click="onEndTurnClick"
			>
				<span class="btn-icon">⌛</span>
				<span>Конец хода</span>
			</button>
		</div>

		<!-- Turn Change Floating Banner -->
		<transition name="banner-fade">
			<div v-if="turnBanner" class="iso-turn-banner">
				<span class="banner-icon">⚔️</span>
				<span class="banner-title">Ход игрока • Ход {{ tacticalState.turn }}</span>
				<span class="banner-sub">Очки MP и AP восстановлены</span>
			</div>
		</transition>

		<!-- Action Failed Toast -->
		<transition name="toast-fade">
			<div v-if="actionFailedNotice" class="iso-action-failed-toast">
				<span class="toast-icon">⚠️</span>
				<span>{{ actionFailedNotice }}</span>
			</div>
		</transition>

		<!-- Quest Progress Tracker (Top Left, only in weeds scenario) -->
		<aside v-if="selectedScenario === 'weeds' && initialWeedsCount > 0" class="iso-quest-tracker">
			<div class="quest-header">
				<span class="quest-icon">📜</span>
				<span class="quest-title">Задание старосты</span>
			</div>
			<div class="quest-body">
				<div class="quest-name">Прополка огорода</div>
				<p class="quest-desc">
					Центр карты в клетке (0,0). Подойдите к сорнякам и нажмите ЛКМ для прополки.
				</p>
				<div class="quest-progress-box">
					<div class="progress-labels">
						<span>Прогресс</span>
						<span class="progress-count">{{ weedsCleared }} / {{ initialWeedsCount }}</span>
					</div>
					<div class="progress-bar-bg">
						<div
							class="progress-bar-fill"
							:style="{ width: progressPercent + '%' }"
						/>
					</div>
				</div>

				<div v-if="isQuestCompleted" class="quest-complete-alert">
					<span class="alert-icon">✨</span>
					<span>Все сорняки выполоты! Задание выполнено!</span>
				</div>
			</div>
		</aside>

		<!-- Bottom Left: Controls Help -->
		<div class="iso-help-panel">
			<div class="help-title">Управление:</div>
			<div class="help-row">
				<span class="help-key">ЛКМ</span>
				<span class="help-desc">Клик по клетке — ход • Клик по объекту / двери — действие</span>
			</div>
			<div class="help-row">
				<span class="help-key">Пробел</span>
				<span class="help-desc">Конец хода (в пошаговом режиме)</span>
			</div>
			<div class="help-row">
				<span class="help-key">Drag</span>
				<span class="help-desc">Зажать и двигать — панорамирование камеры</span>
			</div>
			<div class="help-row">
				<span class="help-key">Колесико</span>
				<span class="help-desc">Масштаб (Zoom)</span>
			</div>
		</div>

		<!-- Bottom Right: Debug Toolbar -->
		<div class="iso-debug-toolbar">
			<div class="toolbar-label">Отладка:</div>
			<button
				class="toolbar-toggle"
				:class="{ __active: showGrid }"
				@click="showGrid = !showGrid"
			>
				Сетка
			</button>
			<button
				class="toolbar-toggle"
				:class="{ __active: showCoords }"
				@click="showCoords = !showCoords"
			>
				(X, Y, Z)
			</button>
			<button
				class="toolbar-toggle"
				:class="{ __active: showHeights }"
				@click="showHeights = !showHeights"
			>
				Высоты
			</button>
			<button class="toolbar-btn" @click="resetCamera">
				Центр (0,0)
			</button>
			<button class="toolbar-btn" @click="resetLocation">
				Сброс
			</button>
		</div>

		<!-- Victory Modal Overlay -->
		<div v-if="showVictoryModal" class="victory-modal-overlay">
			<div class="victory-modal">
				<div class="victory-icon">🎉</div>
				<h2 class="victory-title">Задание выполнено!</h2>
				<p class="victory-message">
					Все сорняки на участке успешно убраны! Земля подготовлена к посадке целебных трав.
				</p>
				<div class="victory-buttons">
					<button class="iso-btn iso-btn-primary" @click="resetLocation">
						Пройти заново
					</button>
					<button class="iso-btn iso-btn-secondary" @click="returnToHome">
						В меню
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import IsoCanvas from '@/components/game/isometric/IsoCanvas.vue'
import { useIsometricLocations } from '@/composables/useIsometricLocations'
import { loadCatalogs, normalizeLocationData } from '@/utils/isometric/isoLoader.js'
import defaultGardenJson from '@/data/isometric/tests/carne_chief_garden.json'
import cliffsJson from '@/data/isometric/tests/height_cliffs_test.json'
import arenaJson from '@/data/isometric/tests/arena_combat_test.json'
import mcApartmentJson from '@/data/isometric/cybercity/mc_apartment.json'

const router = useRouter()
const canvasRef = ref(null)

const {
	loadManifest,
	loadLocationById,
	testLocations,
	applyScenarioPreset,
	randomizeWeeds
} = useIsometricLocations()

// Pre-loaded fallback test maps dictionary for instant switching
const testMapDictionary = {
	carne_chief_garden: defaultGardenJson,
	height_cliffs_test: cliffsJson,
	arena_combat_test: arenaJson,
	mc_apartment: mcApartmentJson
}

const availableLocations = ref([
	{ id: 'carne_chief_garden', name: 'Огород старосты (Квест)' },
	{ id: 'height_cliffs_test', name: 'Многоуровневые террасы (Z: -1..3)' },
	{ id: 'arena_combat_test', name: 'Тактическая арена (Укрытия)' },
	{ id: 'mc_apartment', name: 'Квартира ГГ (Токио 2138)' }
])

const selectedLocationId = ref('carne_chief_garden')
const selectedScenario = ref('weeds')
const selectedCharacterId = ref('mc')

const characterList = [
	{ id: 'mc', name: '🧙‍♂️ ГГ (Судзуки Сатору)' },
	{ id: 'momonga', name: '💀 Момонга (Аинз)' },
	{ id: 'char', name: '👤 Стандартный NPC (char)' },
	{ id: 'unknown_guard', name: '❓ Неизвестный NPC (fallback)' }
]

const currentLocationData = ref(normalizeLocationData(JSON.parse(JSON.stringify(defaultGardenJson))))

// Movement Modes & Tactical Resources
const movementMode = ref('free')
const tacticalConfig = ref({ maxMp: 5, maxAp: 2 })
const tacticalState = ref({ turn: 1, mp: 5, ap: 2 })
const turnBanner = ref(false)
const actionFailedNotice = ref('')
let bannerTimeoutId = null
let toastTimeoutId = null

const initialWeedsCount = ref(
	defaultGardenJson.objects.filter((o) => o.type === 'weed').length
)
const weedsCleared = ref(0)
const isQuestCompleted = ref(false)
const showVictoryModal = ref(false)

// Debug toggles
const showGrid = ref(true)
const showCoords = ref(false)
const showHeights = ref(false)

const progressPercent = computed(() => {
	if (initialWeedsCount.value === 0) return 100
	return Math.min(100, Math.round((weedsCleared.value / initialWeedsCount.value) * 100))
})

onMounted(async () => {
	await loadCatalogs()
	const mf = await loadManifest()
	if (mf && Array.isArray(mf.categories)) {
		const allLocs = []
		for (const cat of mf.categories) {
			for (const loc of cat.locations || []) {
				allLocs.push({
					id: loc.id,
					name: `${loc.name} [${cat.name}]`
				})
			}
		}
		if (allLocs.length > 0) {
			availableLocations.value = allLocs
		}
	}
	window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown)
	if (bannerTimeoutId) clearTimeout(bannerTimeoutId)
	if (toastTimeoutId) clearTimeout(toastTimeoutId)
})

function onKeyDown(e) {
	if (e.code === 'Space' && movementMode.value === 'turn-based') {
		e.preventDefault()
		onEndTurnClick()
	}
}

async function onLocationChange() {
	let mapData = testMapDictionary[selectedLocationId.value]
	if (!mapData) {
		mapData = await loadLocationById(selectedLocationId.value)
	}
	if (!mapData) {
		mapData = defaultGardenJson
	}
	const cloned = JSON.parse(JSON.stringify(mapData))
	const normalized = normalizeLocationData(cloned)
	currentLocationData.value = applyScenarioPreset(normalized, selectedScenario.value)

	initialWeedsCount.value = currentLocationData.value.objects.filter((o) => o.type === 'weed').length
	weedsCleared.value = 0
	isQuestCompleted.value = false
	showVictoryModal.value = false
	canvasRef.value?.resetLocation?.()
}

function onScenarioChange() {
	const mapData = testMapDictionary[selectedLocationId.value] || defaultGardenJson
	const cloned = JSON.parse(JSON.stringify(mapData))
	const normalized = normalizeLocationData(cloned)
	currentLocationData.value = applyScenarioPreset(normalized, selectedScenario.value)

	initialWeedsCount.value = currentLocationData.value.objects.filter((o) => o.type === 'weed').length
	weedsCleared.value = 0
	isQuestCompleted.value = false
	showVictoryModal.value = false
	canvasRef.value?.resetLocation?.()
}

function onRandomizeWeeds() {
	if (!currentLocationData.value) return
	randomizeWeeds(currentLocationData.value, 5)
	initialWeedsCount.value = currentLocationData.value.objects.filter((o) => o.type === 'weed').length
	weedsCleared.value = 0
	isQuestCompleted.value = false
	showVictoryModal.value = false
	canvasRef.value?.resetLocation?.()
}

function onWeedCleared(payload) {
	weedsCleared.value = initialWeedsCount.value - payload.totalRemaining
}

function onQuestCompleted() {
	isQuestCompleted.value = true
	showVictoryModal.value = true
}

function onTurnChanged(payload) {
	tacticalState.value.turn = payload.turn
	tacticalState.value.mp = payload.mp
	tacticalState.value.ap = payload.ap

	turnBanner.value = true
	if (bannerTimeoutId) clearTimeout(bannerTimeoutId)
	bannerTimeoutId = setTimeout(() => {
		turnBanner.value = false
	}, 1800)
}

function onPointsChanged(payload) {
	tacticalState.value.mp = payload.mp
	tacticalState.value.ap = payload.ap
}

function onActionFailed(payload) {
	if (payload.reason === 'not_enough_mp') {
		actionFailedNotice.value = 'Недостаточно очков движения (MP)!'
	} else if (payload.reason === 'not_enough_ap') {
		actionFailedNotice.value = 'Недостаточно очков действия (AP)!'
	} else {
		actionFailedNotice.value = 'Действие недоступно!'
	}

	if (toastTimeoutId) clearTimeout(toastTimeoutId)
	toastTimeoutId = setTimeout(() => {
		actionFailedNotice.value = ''
	}, 2200)
}

function onEndTurnClick() {
	canvasRef.value?.endTurn?.()
}

function resetCamera() {
	canvasRef.value?.resetCamera?.()
}

function resetLocation() {
	weedsCleared.value = 0
	isQuestCompleted.value = false
	showVictoryModal.value = false
	tacticalState.value = {
		turn: 1,
		mp: tacticalConfig.value.maxMp,
		ap: tacticalConfig.value.maxAp
	}
	canvasRef.value?.resetLocation?.()
}

function returnToHome() {
	router.push('/home')
}

function goToEditor() {
	router.push('/test/isometric-editor')
}
</script>

<style scoped>
.iso-tester-view {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	background-color: #11141c;
	overflow: hidden;
	font-family: Kurale, sans-serif;
	color: #e2e8f0;
	font-size: calc(1 * var(--size));
}

/* Header */
.iso-header {
	position: absolute;
	top: 1em;
	left: 1.5em;
	right: 1.5em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	z-index: 20;
	pointer-events: none;
}

.iso-header > * {
	pointer-events: auto;
}

.header-left,
.header-right {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.header-selector-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.4em;
	padding: 0.35em 0.8em;
	backdrop-filter: blur(0.4em);
}

.selector-icon {
	font-size: 1em;
}

.selector-label {
	font-size: 0.85em;
	color: #cbd5e1;
	font-weight: bold;
}

.iso-select {
	background: rgba(30, 41, 59, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f6c445;
	padding: 0.25em 0.5em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	outline: none;
	font-family: Kurale, sans-serif;
}

.iso-select:focus {
	border-color: #f6c445;
}

/* Tactical HUD */
.iso-tactical-hud {
	position: absolute;
	top: 4.8em;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	align-items: center;
	gap: 0.8em;
	background: rgba(15, 23, 42, 0.9);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.6em;
	padding: 0.5em 1em;
	z-index: 25;
	backdrop-filter: blur(0.4em);
	box-shadow: 0 0.4em 1.2em rgba(0, 0, 0, 0.6);
	animation: hud-appear 0.25s ease-out;
}

.hud-turn-badge {
	display: flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(246, 196, 69, 0.15);
	border: 1px solid #f6c445;
	border-radius: 0.35em;
	padding: 0.35em 0.7em;
	color: #f6c445;
	font-weight: bold;
	font-size: 0.9em;
	white-space: nowrap;
}

.hud-stat-box {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	min-width: 6.5em;
}

.stat-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.75em;
	gap: 0.4em;
}

.hud-mp-box .stat-name,
.hud-mp-box .stat-val {
	color: #60a5fa;
	font-weight: bold;
}

.hud-ap-box .stat-name,
.hud-ap-box .stat-val {
	color: #f59e0b;
	font-weight: bold;
}

.pips-row {
	display: flex;
	gap: 0.25em;
}

.pip {
	flex: 1;
	height: 0.4em;
	border-radius: 0.15em;
	background: rgba(255, 255, 255, 0.12);
	transition: background-color 0.2s, box-shadow 0.2s;
}

.mp-pip.__filled {
	background: #3b82f6;
	box-shadow: 0 0 0.4em rgba(59, 130, 246, 0.6);
}

.ap-pip.__filled {
	background: #f59e0b;
	box-shadow: 0 0 0.4em rgba(245, 158, 11, 0.6);
}

.hud-end-turn-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: linear-gradient(135deg, #f59e0b, #d97706);
	color: #0f172a;
	border: 1px solid #b45309;
	border-radius: 0.4em;
	padding: 0.45em 0.9em;
	font-size: 0.85em;
	font-weight: bold;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	white-space: nowrap;
	transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
}

.hud-end-turn-btn:hover {
	background: linear-gradient(135deg, #fbbf24, #f59e0b);
	box-shadow: 0 0 0.8em rgba(245, 158, 11, 0.5);
	transform: translateY(-0.05em);
}

.hud-end-turn-btn.__pulsing {
	animation: btn-pulse 1.2s infinite ease-in-out;
}

/* Turn Banner */
.iso-turn-banner {
	position: absolute;
	top: 35%;
	left: 50%;
	transform: translate(-50%, -50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.3em;
	background: rgba(15, 23, 42, 0.94);
	border: 2px solid #f6c445;
	border-radius: 0.8em;
	padding: 1.2em 2.5em;
	z-index: 40;
	pointer-events: none;
	backdrop-filter: blur(0.5em);
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.8);
}

.banner-icon {
	font-size: 2em;
}

.banner-title {
	font-size: 1.6em;
	font-family: Overlord, Kurale, serif;
	color: #f6c445;
	text-shadow: 0 0 0.6em rgba(246, 196, 69, 0.5);
}

.banner-sub {
	font-size: 0.95em;
	color: #cbd5e1;
}

/* Toast */
.iso-action-failed-toast {
	position: absolute;
	top: 8.5em;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(239, 68, 68, 0.9);
	color: #ffffff;
	border: 1px solid #dc2626;
	border-radius: 0.4em;
	padding: 0.4em 0.9em;
	font-size: 0.85em;
	font-weight: bold;
	z-index: 35;
	box-shadow: 0 0.4em 1em rgba(0, 0, 0, 0.6);
	pointer-events: none;
}

/* Quest Tracker */
.iso-quest-tracker {
	position: absolute;
	top: 5em;
	left: 1.5em;
	width: 18em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.5em;
	padding: 1em;
	z-index: 20;
	backdrop-filter: blur(0.4em);
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.5);
}

.quest-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	margin-bottom: 0.6em;
	border-bottom: 1px solid rgba(246, 196, 69, 0.2);
	padding-bottom: 0.4em;
}

.quest-icon {
	font-size: 1.2em;
}

.quest-title {
	font-size: 0.9em;
	color: #f6c445;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.quest-name {
	font-size: 1.05em;
	font-weight: bold;
	color: #ffffff;
	margin-bottom: 0.3em;
}

.quest-desc {
	font-size: 0.85em;
	color: #94a3b8;
	line-height: 1.35;
	margin: 0 0 0.8em 0;
}

.quest-progress-box {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.progress-labels {
	display: flex;
	justify-content: space-between;
	font-size: 0.85em;
	color: #cbd5e1;
}

.progress-count {
	font-weight: bold;
	color: #f6c445;
}

.progress-bar-bg {
	width: 100%;
	height: 0.5em;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 0.25em;
	overflow: hidden;
}

.progress-bar-fill {
	height: 100%;
	background: linear-gradient(90deg, #10b981, #f6c445);
	transition: width 0.3s ease-out;
}

.quest-complete-alert {
	margin-top: 0.8em;
	padding: 0.5em;
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	border-radius: 0.3em;
	font-size: 0.85em;
	color: #34d399;
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-weight: bold;
}

/* Controls Help */
.iso-help-panel {
	position: absolute;
	bottom: 1.5em;
	left: 1.5em;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.8em 1.2em;
	z-index: 20;
	backdrop-filter: blur(0.4em);
	pointer-events: none;
	font-size: 0.85em;
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.help-title {
	font-weight: bold;
	color: #f6c445;
	margin-bottom: 0.1em;
}

.help-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.help-key {
	background: rgba(255, 255, 255, 0.15);
	border-radius: 0.2em;
	padding: 0.1em 0.4em;
	font-size: 0.85em;
	color: #f8fafc;
	font-weight: bold;
}

.help-desc {
	color: #cbd5e1;
}

/* Debug Toolbar */
.iso-debug-toolbar {
	position: absolute;
	bottom: 1.5em;
	right: 1.5em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5em;
	padding: 0.6em 1em;
	display: flex;
	align-items: center;
	gap: 0.5em;
	z-index: 20;
	backdrop-filter: blur(0.4em);
}

.toolbar-label {
	font-size: 0.85em;
	color: #94a3b8;
	margin-right: 0.2em;
}

.toolbar-toggle,
.toolbar-btn {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #e2e8f0;
	padding: 0.35em 0.7em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.toolbar-toggle:hover,
.toolbar-btn:hover {
	background: rgba(51, 65, 85, 0.9);
	border-color: #f6c445;
	color: #f6c445;
}

.toolbar-toggle.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: bold;
}

/* Buttons */
.iso-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.5em 1.2em;
	border-radius: 0.4em;
	font-size: 0.95em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.2s ease;
}

.iso-btn-back {
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(246, 196, 69, 0.35);
	color: #f6c445;
	backdrop-filter: blur(0.4em);
}

.iso-btn-back:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.3);
}

.btn-icon {
	font-size: 1.3em;
	line-height: 1;
}

.iso-btn-primary {
	background: #f6c445;
	color: #0f172a;
	border: 1px solid #d9a830;
	font-weight: bold;
}

.iso-btn-primary:hover {
	background: #ffd369;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.5);
}

.iso-btn-secondary {
	background: rgba(30, 41, 59, 0.8);
	color: #e2e8f0;
	border: 1px solid rgba(255, 255, 255, 0.2);
}

.iso-btn-secondary:hover {
	background: rgba(51, 65, 85, 0.9);
	color: #ffffff;
}

/* Victory Modal */
.victory-modal-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 50;
	backdrop-filter: blur(0.3em);
}

.victory-modal {
	background: #131926;
	border: 2px solid #f6c445;
	border-radius: 0.8em;
	padding: 2em 2.5em;
	max-width: 28em;
	text-align: center;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.8);
	animation: modal-appear 0.3s ease-out;
}

.victory-icon {
	font-size: 3em;
	margin-bottom: 0.3em;
}

.victory-title {
	font-size: 1.8em;
	font-family: Overlord, Kurale, serif;
	color: #f6c445;
	margin: 0 0 0.5em 0;
	text-shadow: 0 0 0.6em rgba(246, 196, 69, 0.4);
}

.victory-message {
	font-size: 1.05em;
	color: #cbd5e1;
	line-height: 1.4;
	margin: 0 0 1.5em 0;
}

.victory-buttons {
	display: flex;
	gap: 1em;
	justify-content: center;
}

@keyframes hud-appear {
	from {
		opacity: 0;
		transform: translate(-50%, -0.5em);
	}
	to {
		opacity: 1;
		transform: translate(-50%, 0);
	}
}

@keyframes btn-pulse {
	0%, 100% {
		box-shadow: 0 0 0 rgba(245, 158, 11, 0.4);
	}
	50% {
		box-shadow: 0 0 1.2em rgba(245, 158, 11, 0.85);
		transform: scale(1.03);
	}
}

.banner-fade-enter-active,
.banner-fade-leave-active,
.toast-fade-enter-active,
.toast-fade-leave-active {
	transition: opacity 0.25s, transform 0.25s;
}

.banner-fade-enter-from,
.banner-fade-leave-to {
	opacity: 0;
	transform: translate(-50%, -45%);
}

.toast-fade-enter-from,
.toast-fade-leave-to {
	opacity: 0;
	transform: translate(-50%, -0.4em);
}

@keyframes modal-appear {
	from {
		opacity: 0;
		transform: scale(0.92);
	}
	to {
		opacity: 1;
		transform: scale(1);
	}
}
</style>
