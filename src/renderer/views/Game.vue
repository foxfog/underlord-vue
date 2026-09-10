<template>
	<div class="game-area">
		<!-- Top Toolbar -->
		<Topbar
			v-if="showTopbar && !isUiHidden"
			:character="mcCharacter"
			:show-inventory-button="showInventoryButton"
			:show-journal-button="showJournalButton"
			:show-map-button="showMapButton"
			:show-next-time-button="showNextTimeButton"
			:show-date-badge="showDateBadge"
			:global-data="gameState.global"
			@open-inventory="toggleInventoryModal"
			@open-map="toggleMapModal"
			@open-journal="toggleJournalModal"
			@open-calendar="toggleCalendarModal"
			@advance-time="handleAdvanceTime"
		/>

		<!-- Sidebars -->
		<SidebarLeft
			v-if="!showVrLauncher && !showYggAuth && !showCharCreate && !showShutdownSequence && !isUiHidden"
			:has-dialogue="hasDialogue"
		/>
		<SidebarRight
			v-if="!showVrLauncher && !showYggAuth && !showCharCreate && !showShutdownSequence && !isUiHidden"
			:is-helmet-equipped="isHelmetEquipped"
			:has-dialogue="hasDialogue"
			@open-vr="openVrFromSidebar"
		/>

		<div class="game">
			<VisualNovel
				ref="visualNovel"
				:src="novelsrc"
				@end="onEnd"
				@character-loaded="onCharacterLoaded"
				@global-data-changed="onGlobalDataChanged"
				@ui-visibility-changed="onUiVisibilityChanged"
				@ready="onVisualNovelReady"
			/>
		</div>

		<!-- Fast-forward / Skip indicator (Ren'Py Ctrl skip style) -->
		<div
			v-if="isFastForwarding && !isUiHidden"
			class="vn-skip-indicator"
			aria-label="Режим быстрой перемотки"
		>
			<span class="vn-skip-indicator-icon">⏩</span>
			<span class="vn-skip-indicator-text">Перемотка</span>
			<span class="vn-skip-indicator-dots">
				<span>.</span><span>.</span><span>.</span>
			</span>
		</div>

		<!-- Full-screen click-to-unhide overlay when UI is hidden (Ren'Py style) -->
		<div
			v-if="isUiHidden"
			class="ui-hidden-overlay"
			title="Нажмите в любое место или нажмите H / Esc, чтобы вернуть интерфейс"
			@click.stop.prevent="unhideUi"
			@contextmenu.stop.prevent="unhideUi"
		/>

		<!-- Inventory Modal -->
		<InventoryModal
			:is-visible="showInventoryModal"
			:character="mcCharacter"
			:items-data="itemsData"
			@close="toggleInventoryModal"
			@equip="onEquipItem"
			@unequip="handleUnequip"
			@swap="handleSwap"
			@drop="handleDrop"
		/>

		<!-- Map Modal -->
		<MapModal
			:is-visible="showMapModal"
			:global-data="gameState.global"
			@close="toggleMapModal"
			@goto="handleMapGoto"
		/>

		<JournalModal
			:isVisible="showJournalModal"
			:gameState="gameState"
			@close="showJournalModal = false"
		/>

		<CalendarModal
			:is-visible="showCalendarModal"
			:global-data="gameState.global"
			@close="showCalendarModal = false"
		/>

		<!-- VR Helmet Launcher & Dashboard -->
		<VrHelmetLauncher
			v-if="showVrLauncher"
			ref="vrLauncherRef"
			:initial-phase="vrLauncherPhase"
			:global-data="gameState.global"
			@exit-vr="onVrExit"
			@launch-yggdrasil="onLaunchYggdrasil"
		/>

		<!-- YGGDRASIL Game Intro Video -->
		<YggdrasilIntroVideo
			v-if="showYggIntro"
			@intro-complete="onYggIntroComplete"
		/>

		<!-- YGGDRASIL MMO Auth Modal -->
		<YggdrasilAuthModal
			v-if="showYggAuth"
			@back-to-launcher="onYggBackToLauncher"
			@auth-success="onYggAuthSuccess"
		/>

		<!-- YGGDRASIL Character Creation -->
		<YggdrasilCharacterCreation
			v-if="showCharCreate"
			:initial-nickname="mcCharacter?.nickname || mcCharacter?.name || ''"
			@character-confirmed="onCharCreationConfirmed"
		/>

		<!-- Server Shutdown Glitch & Transfer -->
		<ServerShutdownSequence
			v-if="showShutdownSequence"
			@sequence-complete="onShutdownSequenceComplete"
		/>

		<!-- Menu overlay that can be toggled with Esc -->
		<div v-show="menuVisible" class="menu-overlay">
			<div class="overlay-content">
				<div class="content-area">
					<DynamicContentArea
						ref="dynamicContentAreaRef"
						:current-view="currentView"
						:in-game-context="true"
						:saves-initial-tab="savesTab"
						@saves-tab-change="onSavesTabChange"
						@back-to-menu="showMainMenu"
						@settings-saved="onSettingsSaved"
						@settings-reset="onSettingsReset"
						@settings-dirty-change="onSettingsDirtyChange"
						@load-request="onLoadRequest"
						@save-request="onSaveRequest"
					/>
				</div>
				<div class="menu-area __overlay">
					<MainMenu
						@navigate="handleNavigation"
						:show-back-to-main="currentView !== 'main-menu'"
						:current-view="currentView"
						:saves-tab="savesTab"
						:in-game-context="true"
						:on-continue="onContinue"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom hotbar -->
	<Hotbar
		:visible="showHotbar"
		@open-history="openHistory"
		@open-menu="openMainMenu"
		@open-settings="openSettings"
		@open-save="openSave"
		@open-load="openLoad"
		@quick-save="quickSave"
		@quick-load="quickLoad"
	/>

	<!-- History modal -->
	<HistoryModal
		:isVisible="showHistoryModal"
		:entries="historyList"
		@close="showHistoryModal = false"
	/>

	<ConfirmModal
		:visible="confirmVisible"
		:title="confirmTitle"
		:message="confirmMessage"
		confirmText="Да"
		cancelText="Отмена"
		@confirm="onConfirm"
		@cancel="onCancel"
	/>

	<SettingsLeaveConfirmModal
		:visible="showLeaveConfirm"
		title="Несохранённые настройки"
		message="Сохранить изменения перед переходом?"
		@yes="handleLeaveYes"
		@no="handleLeaveNo"
		@cancel="handleLeaveCancel"
	/>

	<!-- Экран загрузки с руническим индикатором в нижнем правом углу -->
	<GameLoadingScreen
		:active="isGameLoading"
		:title-text="loadingTitleText"
		:status-text="loadingStatusText"
	/>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed, reactive, markRaw } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VisualNovel from '../components/game/VisualNovel.vue'
import InventoryModal from '../components/game/inventory/InventoryModal.vue'
import Topbar from '../components/game/ui/Topbar.vue'
import SidebarLeft from '../components/game/ui/SidebarLeft.vue'
import SidebarRight from '../components/game/ui/SidebarRight.vue'
import MapModal from '../components/game/maps/MapModal.vue'
import DynamicContentArea from '@/components/DynamicContentArea.vue'
import MainMenu from '@/components/MainMenu.vue'
import HistoryModal from '../components/game/modals/HistoryModal.vue'
import JournalModal from '../components/game/modals/JournalModal.vue'
import CalendarModal from '../components/game/modals/CalendarModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Hotbar from '../components/game/ui/Hotbar.vue'
import SettingsLeaveConfirmModal from '@/components/SettingsLeaveConfirmModal.vue'
import VrHelmetLauncher from '../components/game/vr/VrHelmetLauncher.vue'
import YggdrasilIntroVideo from '../components/game/vr/YggdrasilIntroVideo.vue'
import YggdrasilAuthModal from '../components/game/vr/YggdrasilAuthModal.vue'
import YggdrasilCharacterCreation from '../components/game/vr/YggdrasilCharacterCreation.vue'
import ServerShutdownSequence from '../components/game/vr/ServerShutdownSequence.vue'
import GameLoadingScreen from '../components/game/GameLoadingScreen.vue'
import { useQuests } from '@/composables/useQuests'
import { useEncyclopedia } from '@/composables/useEncyclopedia'
import { useSavesStore } from '@/stores/saves'
import { useSettingsStore } from '@/stores/settings'
import { SOUND_CLOTH } from '../constants/sounds'
import { useGameRules } from '@/composables/useGameRules'
import { allStoryRules } from '@/constants/storyRules'
import { useSettingsNavigation } from '@/composables/useSettingsNavigation'
import { useScreenshotMode } from '@/composables/useScreenshotMode'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useGameOverlay } from '@/composables/useGameOverlay'
import { useCharacterEquipment } from '@/composables/useCharacterEquipment'
import { useRegisterModal, handleEscape, clearModalStack, hasModals } from '@/composables/useModalStack'

const router = useRouter()
const route = useRoute()
const settingsStore = useSettingsStore()
const savesStore = useSavesStore()
const visualNovel = ref(null)
const showMapModal = ref(false)
const showInventoryModal = ref(false)
const showJournalModal = ref(false)
const showCalendarModal = ref(false)
const mcCharacter = ref(null)
const itemsData = ref({})
const dynamicContentAreaRef = ref(null)
const showHistoryModal = ref(false)
const historyList = ref([])

// Loading screen state
const isGameLoading = ref(true)
const loadingTitleText = ref('ЗАГРУЗКА')
const loadingStatusText = ref(route.meta?.newGame ? 'Инициализация Нового Мира...' : 'Синхронизация данных...')

function onVisualNovelReady() {
	if (!savesStore.getPendingLoad()) {
		setTimeout(() => {
			isGameLoading.value = false
		}, 400)
	}
}

// VR & YGGDRASIL flow state
const showVrLauncher = ref(false)
const vrLauncherRef = ref(null)
const vrLauncherPhase = ref('connecting')
const showYggIntro = ref(false)
const showYggAuth = ref(false)
const showCharCreate = ref(false)
const showShutdownSequence = ref(false)
const lastWorldScene = ref('mc_apartment')

const {
	menuVisible,
	currentView,
	savesTab,
	showMainMenu,
	openSettings,
	openSave,
	openLoad,
	navigateImmediate: overlayNavigateImmediate,
	onSavesTabChange
} = useGameOverlay()

const openMainMenu = showMainMenu

function navigateImmediate(view) {
	if (view === 'home-screen') {
		router.push('/home')
		return
	}
	overlayNavigateImmediate(view)
}

const { confirmVisible, confirmTitle, confirmMessage, showConfirm, onConfirm, onCancel } =
	useConfirmDialog()

const { screenshotMode, saveWithHiddenOverlays } = useScreenshotMode()

const {
	showLeaveConfirm,
	isSettingsDirty,
	handleNavigation: handleNavigationInternal,
	onSettingsSaved,
	onSettingsReset,
	onSettingsDirtyChange,
	handleLeaveYes,
	handleLeaveNo,
	handleLeaveCancel
} = useSettingsNavigation(navigateImmediate, dynamicContentAreaRef)

const handleNavigation = (view) => handleNavigationInternal(view, currentView.value)

// Register modals in the global LIFO modal stack for Escape key handling
useRegisterModal('inventory', showInventoryModal, () => {
	showInventoryModal.value = false
})

useRegisterModal('map', showMapModal, () => {
	showMapModal.value = false
})

useRegisterModal('journal', showJournalModal, () => {
	showJournalModal.value = false
})

useRegisterModal('calendar', showCalendarModal, () => {
	showCalendarModal.value = false
})

useRegisterModal('history', showHistoryModal, () => {
	showHistoryModal.value = false
})

useRegisterModal('vr-launcher', showVrLauncher, () => {
	if (vrLauncherRef.value?.startExitVr) {
		vrLauncherRef.value.startExitVr()
	} else {
		onVrExit()
	}
})

useRegisterModal('ygg-auth', showYggAuth, () => {
	onYggBackToLauncher()
})

useRegisterModal('confirm-dialog', confirmVisible, () => {
	onCancel()
})

useRegisterModal('settings-leave-confirm', showLeaveConfirm, () => {
	handleLeaveCancel()
})

useRegisterModal('game-menu', menuVisible, () => {
	menuVisible.value = false
	currentView.value = 'main-menu'
})

// Game Rules Engine
const gameState = reactive({
	character: {
		mc: {
			health: 100,
			equipment_slots: {
				mask: null
			}
		}
	},
	global: {}, // ← добавляем объект для глобальных переменных
	game: {
		location: 'city_street',
		activeStory: 'start',
		storyPlaying: true
	},
	storyEngine: null,
	closeModal: (modalName) => {
		// Закрывает модальное окно по имени
		if (modalName === 'inventory') {
			showInventoryModal.value = false
		} else if (modalName === 'stats') {
			showStatsModal.value = false
		} else if (modalName === 'map') {
			showMapModal.value = false
		}
		console.log(`✓ Modal closed: ${modalName}`)
	}
})

const { registerRules, startRules, stopRules, resetEngine, stats } = useGameRules(gameState)

const novelsrc = computed(() => {
	const language = settingsStore.general.language || 'ru'
	return `/data/story/${language}/start.json`
})

// UI visibility states from VisualNovel
const vnUiVisibility = ref({})

function onUiVisibilityChanged(newVisibility) {
	if (newVisibility) {
		vnUiVisibility.value = { ...newVisibility }
	}
}

const currentUiVisibility = computed(() => {
	if (vnUiVisibility.value && Object.keys(vnUiVisibility.value).length > 0) {
		return vnUiVisibility.value
	}
	const vn = visualNovel.value
	if (!vn || !vn.uiVisibility) return {}
	return vn.uiVisibility.value || vn.uiVisibility || {}
})

const isUiHidden = computed(() => {
	if (visualNovel.value?.isUiHidden !== undefined) {
		const val = visualNovel.value.isUiHidden
		return typeof val === 'object' && val !== null && 'value' in val ? !!val.value : !!val
	}
	return !!currentUiVisibility.value?.isUiHidden
})

function toggleHideUi() {
	if (visualNovel.value?.toggleHideUi) {
		visualNovel.value.toggleHideUi()
	}
}

function unhideUi() {
	if (visualNovel.value?.unhideUi) {
		visualNovel.value.unhideUi()
	}
}

const isFastForwarding = computed(() => {
	if (visualNovel.value?.isSkipping !== undefined) {
		const val = visualNovel.value.isSkipping
		return typeof val === 'object' && val !== null && 'value' in val ? !!val.value : !!val
	}
	return false
})

function startFastForward() {
	if (visualNovel.value?.startFastForward) {
		visualNovel.value.startFastForward()
	}
}

function stopFastForward() {
	if (visualNovel.value?.stopFastForward) {
		visualNovel.value.stopFastForward()
	}
}

const showInventoryButton = computed(() => {
	const v = currentUiVisibility.value
	if (v.all) return true
	return !!v['inventory-button']
})

const showJournalButton = computed(() => {
	const v = currentUiVisibility.value
	if (v.all) return true
	return !!v['journal-button']
})

const showMapButton = computed(() => {
	const v = currentUiVisibility.value
	if (v.all) return true
	return !!v['map-button']
})

const showNextTimeButton = computed(() => {
	const v = currentUiVisibility.value
	if (v['next-time-button'] !== undefined) return !!v['next-time-button']
	return !v.hasDialogue
})

const showDateBadge = computed(() => {
	const v = currentUiVisibility.value
	const isNewWorld =
		gameState.global?.calendarType === 'new_world' || gameState.global?.year === 0
	if (isNewWorld) {
		// В Новом Мире кнопка календаря скрыта (видна только в старом мире)
		return v['date-badge'] === true && v['calendar-button'] === true
	}
	if (v['date-badge'] !== undefined) return !!v['date-badge']
	if (v['calendar-button'] !== undefined) return !!v['calendar-button']
	return true
})

const showTopbar = computed(() => {
	if (isUiHidden.value) return false
	const v = currentUiVisibility.value
	if (v.all) return true
	return !!(
		v.topbar ||
		showInventoryButton.value ||
		showJournalButton.value ||
		showMapButton.value
	)
})

const showHotbar = computed(() => {
	const v = currentUiVisibility.value
	return !!(v.all || v.hotbar)
})

const hasDialogue = computed(() => {
	return !!currentUiVisibility.value?.hasDialogue
})

const isHelmetEquipped = computed(() => {
	return mcCharacter.value?.equipment_slots?.head === 'neuro_helmet'
})

function getGameAreaClipRect() {
	const gameArea = document.querySelector('.game')
	if (!gameArea) return null
	const rect = gameArea.getBoundingClientRect()
	const dpr = window.devicePixelRatio || 1
	return {
		x: Math.round(rect.left * dpr),
		y: Math.round(rect.top * dpr),
		width: Math.max(0, Math.round(rect.width * dpr)),
		height: Math.max(0, Math.round(rect.height * dpr))
	}
}

// Watch menu visibility changes
watch(menuVisible, (isVisible) => {
	console.log('Menu visibility changed:', isVisible)
	if (isVisible) {
		// Opening menu: pause story streams and play background music
		console.log('Opening menu - pausing streams and playing bgmusic')
		visualNovel.value?.pauseAllStreams?.()
		settingsStore.isMusicPlaying = true
	} else {
		// Closing menu: stop background music and resume story streams
		console.log('Closing menu - stopping bgmusic and resuming streams')
		settingsStore.isMusicPlaying = false
		visualNovel.value?.resumeAllStreams?.()
	}
})

// Watch for view changes
watch(
	() => currentView.value,
	(newView, oldView) => {
		console.log(`Current view changed from "${oldView}" to "${newView}"`)
	}
)

// Watch for character changes and update gameState
watch(
	() => mcCharacter.value,
	(newChar) => {
		if (newChar && gameState.character.mc !== newChar) {
			// Убедимся, что gameState указывает на реальный объект персонажа, а не копию
			gameState.character.mc = newChar
		}
		if (visualNovel.value && gameState.storyEngine !== visualNovel.value) {
			gameState.storyEngine = markRaw(visualNovel.value)
		}
	}
)

// Handler for global-data-changed event from VisualNovel
function onGlobalDataChanged(newGlobalData) {
	if (newGlobalData) {
		const raw = newGlobalData?.value ? newGlobalData.value : newGlobalData
		Object.assign(gameState.global, raw)
		console.log('✅ onGlobalDataChanged: synced to gameState.global:', gameState.global)
		if (raw.currentMap && settingsStore.currentMap !== raw.currentMap) {
			console.log('🔁 Syncing currentMap from story to Pinia:', raw.currentMap)
			settingsStore.setCurrentMap(raw.currentMap)
		}
	}
}

// Watch for global data changes from VisualNovel and sync to gameState
watch(
	() => {
		const vn = visualNovel.value
		if (!vn) return null
		return vn.globalData?.value || vn.globalData
	},
	(newGlobalData) => {
		if (newGlobalData) {
			const raw = newGlobalData?.value ? newGlobalData.value : newGlobalData
			console.log('🌍 globalData changed in visualNovel:', raw)
			Object.assign(gameState.global, raw)
			console.log('✅ Updated gameState.global:', gameState.global)
			if (raw.currentMap && settingsStore.currentMap !== raw.currentMap) {
				console.log('🔁 Syncing currentMap from story to Pinia:', raw.currentMap)
				settingsStore.setCurrentMap(raw.currentMap)
			}
		}
	},
	{ deep: true, immediate: true }
)

watch(
	() => settingsStore.currentMap,
	(newMap) => {
		const vnGlobal = visualNovel.value?.globalData?.value || visualNovel.value?.globalData
		if (!vnGlobal) return
		if (newMap && vnGlobal.currentMap !== newMap) {
			console.log('🔁 Syncing currentMap from Pinia to story globalData:', newMap)
			vnGlobal.currentMap = newMap
		}
	}
)

let isSyncingEquipment = false
function syncEquipmentToScene(characterId = 'mc') {
	if (isSyncingEquipment) return
	isSyncingEquipment = true
	try {
		if (visualNovel.value?.syncCharacterEquipment) {
			visualNovel.value.syncCharacterEquipment(characterId, mcCharacter.value)
		} else if (visualNovel.value?.rebuildEquipmentBySlot) {
			visualNovel.value.rebuildEquipmentBySlot(characterId, mcCharacter.value?.equipment_slots)
		}
	} finally {
		isSyncingEquipment = false
	}
}

let lastEquipmentSlotsStr = ''
// Watch for equipment changes to stay in sync with sprites and rules engine
watch(
	() => mcCharacter.value?.equipment_slots,
	(newSlots) => {
		if (!newSlots) return
		const str = JSON.stringify(newSlots)
		if (str === lastEquipmentSlotsStr) return
		lastEquipmentSlotsStr = str

		if (isSyncingEquipment) return
		isSyncingEquipment = true
		try {
			rebuildEquipmentBySlot()
			syncEquipmentToScene('mc')
		} finally {
			isSyncingEquipment = false
		}
	},
	{ deep: true }
)

function onEnd() {
	// Clear global variables (e.g. toxic_gas) so they don't bleed into the next game
	Object.keys(gameState.global).forEach((key) => delete gameState.global[key])
	// Stop game music, restore background music
	settingsStore.isMusicPlaying = true
	router.push('/home')
}

function toggleInventoryModal() {
	showInventoryModal.value = !showInventoryModal.value
}

function toggleMapModal() {
	showMapModal.value = !showMapModal.value
}

function toggleJournalModal() {
	showJournalModal.value = !showJournalModal.value
}

function toggleCalendarModal() {
	showCalendarModal.value = !showCalendarModal.value
}

function handleAdvanceTime() {
	if (visualNovel.value?.advanceTime) {
		visualNovel.value.advanceTime()
		const vnGlobal = visualNovel.value?.globalData?.value || visualNovel.value?.globalData
		if (vnGlobal) {
			Object.assign(gameState.global, vnGlobal)
		}
	}
}

function handleMapGoto(gotoPayload) {
	const target = typeof gotoPayload === 'string' ? gotoPayload : gotoPayload?.target
	const locationId = typeof gotoPayload === 'object' ? gotoPayload?.locationId : null

	if (locationId) {
		const vnGlobal = visualNovel.value?.globalData?.value || visualNovel.value?.globalData
		if (vnGlobal) {
			vnGlobal.currentLocation = locationId
		}
		gameState.global.currentLocation = locationId
	}

	if (target && visualNovel.value?.goto) {
		visualNovel.value.goto(target)
	}
	showMapModal.value = false
}

function playClothSound() {
	try {
		const common = settingsStore.audio.commonVolume / 100
		const sound = settingsStore.audio.soundVolume / 100
		const volume = Math.max(0, Math.min(1, common * sound))
		const audio = new Audio(SOUND_CLOTH)
		audio.volume = volume
		audio.play().catch(() => {})
	} catch (e) {
		console.warn('Failed to play cloth sound:', e)
	}
}

const { handleEquip, handleUnequip, handleSwap, handleDrop, rebuildEquipmentBySlot } =
	useCharacterEquipment(
		mcCharacter,
		itemsData,
		gameState,
		playClothSound,
		() => syncEquipmentToScene('mc')
	)

const questsManager = useQuests(gameState)
const encyclopediaManager = useEncyclopedia(gameState)

function onEquipItem(payload) {
	handleEquip(payload)
	if (payload?.itemId === 'neuro_helmet' && payload?.slot === 'head') {
		handleNeuroHelmetEquipped()
	}
}

function handleNeuroHelmetEquipped() {
	console.log('🥽 [VR Flow] Neuro helmet equipped! Starting VR launcher sequence...')
	if (questsManager.isQuestActive('try_neuro_helmet')) {
		questsManager.completeTask('try_neuro_helmet', 'equip_helmet_step')
		questsManager.completeQuest('try_neuro_helmet')
	}
	showInventoryModal.value = false
	lastWorldScene.value = visualNovel.value?.getGameState()?.currentScene || 'mc_apartment'
	vrLauncherPhase.value = 'connecting'
	showVrLauncher.value = true
}

let yggBgmAudio = null

function playYggBgm() {
	stopYggBgm()
	try {
		const common = (settingsStore.audio?.commonVolume ?? 100) / 100
		const music = (settingsStore.audio?.musicVolume ?? 100) / 100
		const volume = Math.max(0, Math.min(1, common * music))
		yggBgmAudio = new Audio('audio/music/pw-ost.mp3')
		yggBgmAudio.loop = true
		yggBgmAudio.volume = volume
		yggBgmAudio.play().catch((e) => console.warn('Failed to play ygg bgm:', e))
	} catch (err) {
		console.warn('Error creating ygg bgm audio:', err)
	}
}

function stopYggBgm() {
	if (yggBgmAudio) {
		try {
			yggBgmAudio.pause()
			yggBgmAudio.currentTime = 0
		} catch (e) {}
		yggBgmAudio = null
	}
}

function onVrExit() {
	stopYggBgm()
	showVrLauncher.value = false
	console.log('🚪 [VR Flow] Exited VR, returned to:', lastWorldScene.value)
}

function openVrFromSidebar() {
	if (hasDialogue.value) return
	lastWorldScene.value = visualNovel.value?.getGameState()?.currentScene || 'mc_apartment'
	vrLauncherPhase.value = 'connecting'
	showVrLauncher.value = true
}

function onLaunchYggdrasil() {
	showVrLauncher.value = false
	showYggIntro.value = true
}

function onYggIntroComplete() {
	showYggIntro.value = false
	showYggAuth.value = true
	playYggBgm()
}

function onYggBackToLauncher() {
	stopYggBgm()
	showYggAuth.value = false
	vrLauncherPhase.value = 'dashboard'
	showVrLauncher.value = true
}

function onYggAuthSuccess(payload) {
	console.log('🔑 [YGG Auth Success]:', payload)
	showYggAuth.value = false
	showCharCreate.value = true
}

function onCharCreationConfirmed({ nickname }) {
	console.log('👤 [Char Created] Nickname:', nickname)
	stopYggBgm()
	if (mcCharacter.value) {
		mcCharacter.value.nickname = nickname
		mcCharacter.value.title = nickname
	}
	if (gameState.character?.mc) {
		gameState.character.mc.nickname = nickname
		gameState.character.mc.title = nickname
	}
	if (visualNovel.value?.characterData?.mc) {
		visualNovel.value.characterData.mc.nickname = nickname
		visualNovel.value.characterData.mc.title = nickname
	}
	showCharCreate.value = false
	showShutdownSequence.value = true
}

async function onShutdownSequenceComplete() {
	console.log('⚡ [Shutdown Complete] Moving to Carne Village!')

	// Сброс старого реального инвентаря на стартовый набор MMO YGGDRASIL
	const starterEquipment = {
		head: null,
		mask: null,
		neck_1: null,
		'torso-1': 'tshirt',
		'torso-2': null,
		'torso-3': null,
		'legs-2': 'jeans',
		feet: null,
		'weapon-hand-1': 'sword-diamond',
		'weapon-hand-2': null,
		hands: null,
		weapon_off: null,
		underpants: 'underpants'
	}
	const starterItems = [
		{ itemId: 'ygdrasil-coin-new', quantity: 150 },
		{ itemId: 'potion-health-small', quantity: 3 },
		{ itemId: 'bread', quantity: 3 }
	]

	if (mcCharacter.value) {
		mcCharacter.value.equipment_slots = { ...starterEquipment }
		mcCharacter.value.inventory = { items: [...starterItems] }
	}
	if (gameState.character?.mc) {
		gameState.character.mc.equipment_slots = { ...starterEquipment }
		gameState.character.mc.inventory = { items: [...starterItems] }
	}

	rebuildEquipmentBySlot()
	syncEquipmentToScene('mc')

	// Переключение на календарь и время Нового Мира (день, Месяц теплого ветра, 0 г.)
	const newWorldCalendar = {
		calendarType: 'new_world',
		year: 0,
		month: 3,
		dayOfMonth: 1,
		day: 0,
		dayCount: 0,
		timeOfDay: 'day',
		worldMap: 'newworld',
		localMap: 'carne',
		currentMap: 'carne',
		currentLocation: 'carne_village_entrance'
	}
	settingsStore.setCurrentMap('carne')
	if (gameState.global) {
		Object.assign(gameState.global, newWorldCalendar)
		delete gameState.global.time
	}
	if (visualNovel.value?.globalData) {
		Object.assign(visualNovel.value.globalData, newWorldCalendar)
		delete visualNovel.value.globalData.time
	}
	if (visualNovel.value?.baseUiVisibility?.value) {
		visualNovel.value.baseUiVisibility.value['date-badge'] = false
		visualNovel.value.baseUiVisibility.value['calendar-button'] = false
	}

	try {
		if (visualNovel.value?.goto) {
			await visualNovel.value.goto('intro_carne_arrival')
		}
	} catch (err) {
		console.error('Error transitioning to intro_carne_arrival:', err)
	} finally {
		showShutdownSequence.value = false
	}
}

function handleItemEquippedEvent(e) {
	if (e.detail?.itemId === 'neuro_helmet' && e.detail?.slot === 'head') {
		handleNeuroHelmetEquipped()
	}
}

function onCharacterLoaded(characterData) {
	if (characterData?.mc) {
		lastEquipmentSlotsStr = JSON.stringify(characterData.mc.equipment_slots || {})
		const oldMask = mcCharacter.value?.equipment_slots?.mask
		const newMask = characterData.mc?.equipment_slots?.mask
		console.log('🔄 onCharacterLoaded - updating mcCharacter', {
			oldMask,
			newMask,
			stack: new Error().stack.split('\n').slice(1, 3).join(' | ')
		})
		mcCharacter.value = characterData.mc
		if (gameState.character.mc !== characterData.mc) {
			gameState.character.mc = characterData.mc
		}
		rebuildEquipmentBySlot()
	}
}



// Handler for MainMenu "Continue"
function onContinue() {
	// Close menu and resume game
	menuVisible.value = false
	settingsStore.isMusicPlaying = false
}

async function onLoadRequest(saveData) {
	try {
		if (!visualNovel.value) {
			console.warn('VisualNovel ref not ready')
			return
		}

		// Ask confirmation before loading during an active game
		showConfirm(
			'Загрузить сохранение?',
			`Загрузка слота ${saveData.slot + 1} приведёт к потере текущего прогресса. Продолжить?`,
			async () => {
				console.log('Restoring game from save request', saveData)
				isGameLoading.value = true
				loadingTitleText.value = 'ЗАГРУЗКА'
				loadingStatusText.value = `Загрузка слота ${saveData.slot + 1}...`
				menuVisible.value = false
				currentView.value = 'main-menu'
				settingsStore.isMusicPlaying = false
				await new Promise((r) => setTimeout(r, 60))
				try {
					await visualNovel.value.restoreGameState(saveData.gameState)
					await nextTick()
					setTimeout(() => {
						isGameLoading.value = false
					}, 450)
				} catch (err) {
					console.error('Failed to restore save:', err)
					alert(`Failed to restore save: ${err.message}`)
					isGameLoading.value = false
				}
			}
		)
	} catch (err) {
		console.error('Failed to restore save from saves list:', err)
		alert(`Failed to restore save: ${err.message}`)
	}
}

async function onSaveRequest(saveData) {
	try {
		if (!visualNovel.value) {
			console.warn('VisualNovel ref not ready')
			return
		}

		const gameState = visualNovel.value.getGameState()
		const mcName =
			gameState.characterData?.mc?.title ||
			gameState.characterData?.mc?.nickname ||
			gameState.characterData?.mc?.name ||
			'Unknown'

		// If target slot already has a save, confirm overwrite
		if (savesStore.hasSave(saveData.slot)) {
			showConfirm(
				'Перезаписать слот?',
				`Слот ${saveData.slot + 1} уже содержит сохранение. Перезаписать?`,
				async () => {
					console.log('Saving game to slot', saveData.slot)
					const result = await saveWithHiddenOverlays(async () => {
						const clipRect = getGameAreaClipRect()
						return await savesStore.saveGame(saveData.slot, gameState, mcName, clipRect)
					})
					if (result.success) {
						console.log('✔ Game saved to slot', saveData.slot)
						await savesStore.listSaves()
						menuVisible.value = false
						currentView.value = 'main-menu'
					} else {
						alert(`Failed to save: ${result.error}`)
					}
				}
			)
			return
		}

		console.log('Saving game to slot', saveData.slot)
		const result = await saveWithHiddenOverlays(async () => {
			const clipRect = getGameAreaClipRect()
			return await savesStore.saveGame(saveData.slot, gameState, mcName, clipRect)
		})

		if (result.success) {
			console.log('✔ Game saved to slot', saveData.slot)
			await savesStore.listSaves()
			menuVisible.value = false
			currentView.value = 'main-menu'
		} else {
			alert(`Failed to save: ${result.error}`)
		}
	} catch (err) {
		console.error('Failed to save game:', err)
		alert(`Failed to save: ${err.message}`)
	}
}

async function quickSave() {
	try {
		if (!visualNovel.value) {
			console.warn('VisualNovel ref not ready for quick save')
			return
		}

		const gameState = visualNovel.value.getGameState()
		const mcName =
			gameState.characterData?.mc?.title ||
			gameState.characterData?.mc?.nickname ||
			gameState.characterData?.mc?.name ||
			'Unknown'

		const result = await saveWithHiddenOverlays(async () => {
			const clipRect = getGameAreaClipRect()
			return await savesStore.saveQuick(gameState, mcName, clipRect)
		})
		if (result.success) {
			console.log('✔ Quick save created')
		} else {
			alert(`Не удалось сделать быстрое сохранение: ${result.error}`)
		}
	} catch (err) {
		console.error('Failed to create quick save:', err)
		alert(`Ошибка быстрого сохранения: ${err.message}`)
	}
}

async function quickLoad() {
	try {
		const result = await savesStore.loadLatestQuick()

		if (!result.success) {
			if (result.error === 'NO_QUICK_SAVES') {
				alert('Нет быстрых сохранений')
			} else {
				alert(`Не удалось загрузить быстрое сохранение: ${result.error}`)
			}
			return
		}

		const saveFile = result.data

		if (!visualNovel.value) {
			console.warn('VisualNovel ref not ready for quick load')
			return
		}

		// Просим подтверждение, как при обычной загрузке
		showConfirm(
			'Загрузить быстрое сохранение?',
			'Загрузка приведёт к потере текущего прогресса. Продолжить?',
			async () => {
				try {
					isGameLoading.value = true
					loadingTitleText.value = 'ЗАГРУЗКА'
					loadingStatusText.value = 'Загрузка быстрого сохранения...'
					menuVisible.value = false
					currentView.value = 'main-menu'
					settingsStore.isMusicPlaying = false
					await new Promise((r) => setTimeout(r, 60))
					await visualNovel.value.restoreGameState(saveFile.gameState)
					await nextTick()
					setTimeout(() => {
						isGameLoading.value = false
					}, 450)
				} catch (err) {
					console.error('Failed to restore quick save:', err)
					alert(`Не удалось восстановить быстрое сохранение: ${err.message}`)
					isGameLoading.value = false
				}
			}
		)
	} catch (err) {
		console.error('Failed to load quick save:', err)
		alert(`Ошибка быстрой загрузки: ${err.message}`)
	}
}
function openHistory() {
	if (visualNovel.value) {
		historyList.value = visualNovel.value.getHistory()
	}
	showHistoryModal.value = true
}

function isInputElementActive() {
	const el = document.activeElement
	if (!el) return false
	const tag = el.tagName ? el.tagName.toLowerCase() : ''
	if (tag === 'input' || tag === 'textarea' || tag === 'select') {
		return true
	}
	if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') {
		return true
	}
	return false
}

// Priority keydown handling: Ren'Py-style 'H' to hide UI, Escape for modals / menu
const onKeyDown = (e) => {
	// If an input field or contenteditable element is focused, let user type normally
	if (isInputElementActive()) {
		return
	}

	// If UI is currently hidden (Ren'Py style)
	if (isUiHidden.value) {
		// 'H', 'Escape', ' ', 'Enter' or click will unhide the UI
		if (
			e.code === 'KeyH' ||
			e.key?.toLowerCase() === 'h' ||
			e.key?.toLowerCase() === 'р' ||
			e.key === 'Escape' ||
			e.key === ' ' ||
			e.key === 'Enter'
		) {
			e.preventDefault()
			e.stopPropagation()
			unhideUi()
			return
		}
	}

	if (e.key === 'Escape') {
		stopFastForward()
		const handled = handleEscape()
		if (!handled) {
			openMainMenu()
		}
		return
	}

	// Ren'Py-style Fast-Forward / Skip mode with Ctrl
	if (
		e.key === 'Control' ||
		e.code === 'ControlLeft' ||
		e.code === 'ControlRight'
	) {
		// Only allow fast-forward if not in menus/modals/intros/loading
		if (
			!hasModals() &&
			!menuVisible.value &&
			!showVrLauncher.value &&
			!showYggIntro.value &&
			!showYggAuth.value &&
			!showCharCreate.value &&
			!showShutdownSequence.value &&
			!isGameLoading.value
		) {
			if (isUiHidden.value) {
				unhideUi()
			}
			startFastForward()
		}
		return
	}

	// Toggle UI hide with 'H' / 'KeyH' (Ren'Py style)
	if (
		e.code === 'KeyH' ||
		e.key?.toLowerCase() === 'h' ||
		e.key?.toLowerCase() === 'р'
	) {
		// Only allow hiding if in normal gameplay:
		// no modals open, no Esc menu open, no VR/intro overlays
		if (
			!hasModals() &&
			!menuVisible.value &&
			!showVrLauncher.value &&
			!showYggIntro.value &&
			!showYggAuth.value &&
			!showCharCreate.value &&
			!showShutdownSequence.value
		) {
			e.preventDefault()
			toggleHideUi()
		}
	}
}

const onKeyUp = (e) => {
	if (
		e.key === 'Control' ||
		e.code === 'ControlLeft' ||
		e.code === 'ControlRight'
	) {
		stopFastForward()
	}
}

const onWindowBlur = () => {
	stopFastForward()
}

onMounted(() => {
	// Stop background music when starting the game
	settingsStore.isMusicPlaying = false

	window.addEventListener('keydown', onKeyDown)
	window.addEventListener('keyup', onKeyUp)
	window.addEventListener('blur', onWindowBlur)
	window.addEventListener('item-equipped', handleItemEquippedEvent)

	// ВАЖНО: Инициализируем gameState.storyEngine ДО запуска Rules Engine
	if (visualNovel.value) {
		gameState.storyEngine = markRaw(visualNovel.value)
	}

	// Initialize Game Rules Engine
	registerRules(allStoryRules)
	startRules() // Check rules reactively on gameState changes

	// Load items data (equipment and consumables)
	const getFullPath = (path) => {
		const basePath =
			typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
		return basePath ? basePath + path.replace(/^\//, '') : path
	}

	Promise.all([
		fetch(getFullPath('/data/items/equipment.json')).then((r) => r.json()),
		fetch(getFullPath('/data/items/other.json')).then((r) => r.json())
	])
		.then(([equipment, other]) => {
			// Merge both item collections by id
			itemsData.value = {}
			equipment.forEach((item) => {
				itemsData.value[item.id] = item
			})
			other.forEach((item) => {
				itemsData.value[item.id] = item
			})
			console.log('Items data loaded:', itemsData.value)
			console.log('Equipment items:', equipment)
			console.log('Other items:', other)
		})
		.catch((err) => {
			console.error('Failed to load items data:', err)
		})

	// Safety timeout: ensure loading screen hides after 3s even if something hangs
	setTimeout(() => {
		if (isGameLoading.value && !savesStore.getPendingLoad()) {
			isGameLoading.value = false
		}
	}, 3000)

	// If this is a new game, reset the VisualNovel state
	if (route.meta.newGame && visualNovel.value) {
		console.log('Starting new game - resetting state')
		visualNovel.value.resetGameState()
	}

	// If we have a pending load (navigated from main menu), wait for VisualNovel to be ready and restore
	const savesStore = useSavesStore()
	if (savesStore.getPendingLoad()) {
		isGameLoading.value = true
		loadingTitleText.value = 'ЗАГРУЗКА'
		loadingStatusText.value = 'Восстановление сохранения...'
		nextTick(async () => {
			try {
				// wait up to 5s for VisualNovel ref to mount
				const maxWait = 5000
				const interval = 100
				let waited = 0
				while (!visualNovel.value && waited < maxWait) {
					await new Promise((r) => setTimeout(r, interval))
					waited += interval
				}
				const pending = savesStore.getPendingLoad()
				if (!pending) {
					isGameLoading.value = false
					return
				}
				if (!visualNovel.value) {
					console.warn('VisualNovel not ready to restore save after waiting')
					isGameLoading.value = false
					return
				}
				await visualNovel.value.restoreGameState(pending.gameState)
				savesStore.takePendingLoad()
				menuVisible.value = false
				currentView.value = 'main-menu'
				await nextTick()
				setTimeout(() => {
					isGameLoading.value = false
				}, 500)
			} catch (err) {
				console.error('Failed to restore pending save:', err)
				alert(`Failed to restore save: ${err.message}`)
				savesStore.takePendingLoad()
				isGameLoading.value = false
			}
		})
	}
})

onUnmounted(() => {
	stopFastForward()
	stopYggBgm()
	window.removeEventListener('keydown', onKeyDown)
	window.removeEventListener('keyup', onKeyUp)
	window.removeEventListener('blur', onWindowBlur)
	window.removeEventListener('item-equipped', handleItemEquippedEvent)
	clearModalStack()
	// Fully destroy the rules engine singleton so the next game session
	// gets a fresh engine with the correct gameState reference
	resetEngine()
})
</script>
