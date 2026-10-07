/**
 * Game Orchestrator & State Machine (FSM) Composable
 *
 * Replaces monolithic coordination in Game.vue with an explicit finite-state machine:
 * Phases: STORY_VN ⇄ OVERWORLD_HEX ⇄ ISOMETRIC_EXPLORATION ⇄ TURN_COMBAT ⇄ VR_HUB (and VR sub-phases).
 *
 * Encapsulates:
 * - Game phase FSM state & lifecycle transitions.
 * - VR & YGGDRASIL prologue flow and audio.
 * - 2.5D Isometric scene exploration & mob interactions.
 * - Tactical turn-based combat encounters & result branching.
 * - Save / Load orchestration & screenshot thumbnails.
 * - Ren'Py-style UI visibility, fast-forward skip, and hotkey controls.
 * - Game Rules Engine & equipment synchronization.
 */

import {
	ref,
	computed,
	watch,
	onMounted,
	onUnmounted,
	nextTick,
	reactive,
	markRaw
} from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { GAME_PHASES, isVrPhase } from '@/constants/gamePhases'
import { useGameStore } from '@/stores/gameStore'
import { useModalStore } from '@/stores/modalStore'
import { useSavesStore } from '@/stores/saves'
import { useSettingsStore } from '@/stores/settings'
import { useQuests } from '@/composables/useQuests'
import { useEncyclopedia } from '@/composables/useEncyclopedia'
import { useGameRules } from '@/composables/useGameRules'
import { allStoryRules } from '@/constants/storyRules'
import { useSettingsNavigation } from '@/composables/useSettingsNavigation'
import { useScreenshotMode } from '@/composables/useScreenshotMode'
import { useConfirmDialog } from '@/composables/useConfirmDialog'
import { useGameOverlay } from '@/composables/useGameOverlay'
import { useCharacterEquipment } from '@/composables/useCharacterEquipment'
import {
	useRegisterModal,
	handleEscape,
	clearModalStack,
	hasModals
} from '@/composables/useModalStack'
import { audioService } from '@/services/audioService'
import { SOUND_CLOTH } from '@/constants/sounds'
import { eventBus } from '@/utils/eventBus'

export function useGameOrchestrator({ visualNovelRef, dynamicContentAreaRef }) {
	const router = useRouter()
	const route = useRoute()
	const gameStore = useGameStore()
	const modalStore = useModalStore()
	const savesStore = useSavesStore()
	const settingsStore = useSettingsStore()

	// ── 1. Game Phase FSM ───────────────────────────────────────────────────────
	const currentPhase = ref(GAME_PHASES.STORY_VN)
	const previousPhase = ref(null)

	function transitionTo(nextPhase, payload = {}) {
		if (currentPhase.value === nextPhase) return
		console.log(`🎮 [Game FSM] Transition: ${currentPhase.value} -> ${nextPhase}`, payload)
		previousPhase.value = currentPhase.value
		currentPhase.value = nextPhase
	}

	// Declarative computed phase checks for Vue template
	const isStoryVnPhase = computed(() => currentPhase.value === GAME_PHASES.STORY_VN)
	const isOverworldHexPhase = computed(() => currentPhase.value === GAME_PHASES.OVERWORLD_HEX)
	const isIsometricPhase = computed(() => currentPhase.value === GAME_PHASES.ISOMETRIC_EXPLORATION)
	const isCombatPhase = computed(() => currentPhase.value === GAME_PHASES.TURN_COMBAT)
	const isVrHubPhase = computed(() => currentPhase.value === GAME_PHASES.VR_HUB)
	const isVrIntroPhase = computed(() => currentPhase.value === GAME_PHASES.VR_INTRO)
	const isVrAuthPhase = computed(() => currentPhase.value === GAME_PHASES.VR_AUTH)
	const isVrCharCreatePhase = computed(() => currentPhase.value === GAME_PHASES.VR_CHAR_CREATE)
	const isVrShutdownPhase = computed(() => currentPhase.value === GAME_PHASES.VR_SHUTDOWN)
	const isAnyVrPhase = computed(() => isVrPhase(currentPhase.value))

	// ── 2. Character Data & Items ───────────────────────────────────────────────
	const mcCharacter = computed(() => gameStore.characterData?.mc)
	const itemsData = ref({})
	const historyList = ref([])

	// ── 3. Loading Screen State ─────────────────────────────────────────────────
	const isGameLoading = ref(true)
	const loadingTitleText = ref('ЗАГРУЗКА')
	const loadingStatusText = ref(
		route.meta?.newGame ? 'Инициализация Нового Мира...' : 'Синхронизация данных...'
	)

	function onVisualNovelReady() {
		if (!savesStore.getPendingLoad()) {
			setTimeout(() => {
				isGameLoading.value = false
			}, 400)
		}
	}

	// ── 4. VR & Yggdrasil Prologue State ────────────────────────────────────────
	const vrLauncherRef = ref(null)
	const vrLauncherPhase = ref('connecting')
	const lastWorldScene = ref('mc_apartment')
	let yggBgmAudio = null

	function playYggBgm() {
		stopYggBgm()
		yggBgmAudio = audioService.playMusic('audio/music/pw-ost.mp3', true)
	}

	function stopYggBgm() {
		if (yggBgmAudio) {
			audioService.stopAudio(yggBgmAudio)
			yggBgmAudio = null
		}
	}

	function handleNeuroHelmetEquipped() {
		if (isAnyVrPhase.value) return
		console.log('🥽 [VR Flow] Neuro helmet equipped! Starting VR launcher sequence...')
		if (questsManager.isQuestActive('try_neuro_helmet')) {
			questsManager.completeTask('try_neuro_helmet', 'equip_helmet_step')
			questsManager.completeQuest('try_neuro_helmet')
		}
		modalStore.closeInventory()
		lastWorldScene.value = visualNovelRef.value?.getGameState()?.currentScene || 'mc_apartment'
		vrLauncherPhase.value = 'connecting'
		transitionTo(GAME_PHASES.VR_HUB)
	}

	function openVrFromSidebar() {
		if (hasDialogue.value) return
		lastWorldScene.value = visualNovelRef.value?.getGameState()?.currentScene || 'mc_apartment'
		vrLauncherPhase.value = 'connecting'
		transitionTo(GAME_PHASES.VR_HUB)
	}

	function onVrExit() {
		stopYggBgm()
		transitionTo(GAME_PHASES.STORY_VN)
		console.log('🚪 [VR Flow] Exited VR, returned to:', lastWorldScene.value)
	}

	function onLaunchYggdrasil() {
		transitionTo(GAME_PHASES.VR_INTRO)
	}

	function onYggIntroComplete() {
		transitionTo(GAME_PHASES.VR_AUTH)
		playYggBgm()
	}

	function onYggBackToLauncher() {
		stopYggBgm()
		vrLauncherPhase.value = 'dashboard'
		transitionTo(GAME_PHASES.VR_HUB)
	}

	function onYggAuthSuccess(payload) {
		console.log('🔑 [YGG Auth Success]:', payload)
		transitionTo(GAME_PHASES.VR_CHAR_CREATE)
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
		if (visualNovelRef.value?.characterData?.mc) {
			visualNovelRef.value.characterData.mc.nickname = nickname
			visualNovelRef.value.characterData.mc.title = nickname
		}
		transitionTo(GAME_PHASES.VR_SHUTDOWN)
	}

	async function onShutdownSequenceComplete() {
		console.log('⚡ [Shutdown Complete] Moving to Carne Village!')

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
		if (visualNovelRef.value?.globalData) {
			Object.assign(visualNovelRef.value.globalData, newWorldCalendar)
			delete visualNovelRef.value.globalData.time
		}
		if (visualNovelRef.value?.baseUiVisibility?.value) {
			visualNovelRef.value.baseUiVisibility.value['date-badge'] = false
			visualNovelRef.value.baseUiVisibility.value['calendar-button'] = false
		}

		try {
			if (visualNovelRef.value?.goto) {
				await visualNovelRef.value.goto('intro_carne_arrival')
			}
		} catch (err) {
			console.error('Error transitioning to intro_carne_arrival:', err)
		} finally {
			transitionTo(GAME_PHASES.STORY_VN)
		}
	}

	// ── 5. Isometric Location Overlay State ─────────────────────────────────────
	const activeIsometricLocationId = ref('')
	const isometricOverlayRef = ref(null)

	function enterIsometric(locationId) {
		activeIsometricLocationId.value = locationId
		transitionTo(GAME_PHASES.ISOMETRIC_EXPLORATION, { locationId })
	}

	function onIsometricExit(exitPayload) {
		const prevLoc = activeIsometricLocationId.value
		activeIsometricLocationId.value = ''
		transitionTo(GAME_PHASES.STORY_VN)

		if (exitPayload?.target && visualNovelRef.value?.goto) {
			visualNovelRef.value.goto(exitPayload.target)
			return
		}
		if (prevLoc === 'carne_smithy' && visualNovelRef.value?.goto) {
			visualNovelRef.value.goto('carne_village_square')
		} else if (visualNovelRef.value?.goto) {
			visualNovelRef.value.goto('carne_chief_house')
		}
	}

	function onIsometricQuestCompleted() {
		const vnGlobal = visualNovelRef.value?.globalData?.value || visualNovelRef.value?.globalData
		if (vnGlobal) {
			vnGlobal.chief_quest_done = true
		}
		gameState.global.chief_quest_done = true
		questsManager.completeTask('chief_garden_quest', 'weed_task')
	}

	function onIsometricCombatRequested({ encounter, mobObject }) {
		enterCombat(encounter.id || 'dynamic_encounter', encounter, mobObject)
	}

	// ── 6. Tactical Combat Overlay State ────────────────────────────────────────
	const activeCombatEncounterId = ref('')
	const activeCombatEncounterData = ref(null)
	const combatOriginIsometricMob = ref(null)

	function enterCombat(encounterId, encounterData, originMob = null) {
		activeCombatEncounterId.value = encounterId
		activeCombatEncounterData.value = encounterData
		combatOriginIsometricMob.value = originMob
		transitionTo(GAME_PHASES.TURN_COMBAT, { encounterId })
	}

	function onCombatEnd({ result }) {
		const vnGlobal = visualNovelRef.value?.globalData?.value || visualNovelRef.value?.globalData
		if (vnGlobal) vnGlobal.lastCombatResult = result
		gameState.global.lastCombatResult = result

		const encounterId = activeCombatEncounterId.value
		const originMob = combatOriginIsometricMob.value

		activeCombatEncounterId.value = ''
		activeCombatEncounterData.value = null
		combatOriginIsometricMob.value = null

		// If combat was initiated from an isometric location mob
		if (originMob) {
			transitionTo(GAME_PHASES.ISOMETRIC_EXPLORATION)
			if (result === 'win' || result === 'victory') {
				if (isometricOverlayRef.value?.onMobDefeated) {
					isometricOverlayRef.value.onMobDefeated(originMob)
				}
			}
			return
		}

		transitionTo(GAME_PHASES.STORY_VN)

		// Navigate to win/lose story label based on encounter id
		const winLabel = `${encounterId}_win`
		const loseLabel = `${encounterId}_lose`
		const label = result === 'win' ? winLabel : loseLabel
		if (visualNovelRef.value?.goto) {
			visualNovelRef.value.goto(label)
		}
	}

	// ── 7. Overlays, Menus & Confirmation Dialogs ──────────────────────────────
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

	function onContinue() {
		menuVisible.value = false
		settingsStore.isMusicPlaying = false
	}

	// ── 8. Ren'Py UI Visibility, Skip, and Buttons ──────────────────────────────
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
		const vn = visualNovelRef.value
		if (!vn || !vn.uiVisibility) return {}
		return vn.uiVisibility.value || vn.uiVisibility || {}
	})

	const isUiHidden = computed(() => {
		if (visualNovelRef.value?.isUiHidden !== undefined) {
			const val = visualNovelRef.value.isUiHidden
			return typeof val === 'object' && val !== null && 'value' in val ? !!val.value : !!val
		}
		return !!currentUiVisibility.value?.isUiHidden
	})

	function toggleHideUi() {
		visualNovelRef.value?.toggleHideUi?.()
	}

	function unhideUi() {
		visualNovelRef.value?.unhideUi?.()
	}

	const isFastForwarding = computed(() => {
		if (visualNovelRef.value?.isSkipping !== undefined) {
			const val = visualNovelRef.value.isSkipping
			return typeof val === 'object' && val !== null && 'value' in val ? !!val.value : !!val
		}
		return false
	})

	function startFastForward() {
		visualNovelRef.value?.startFastForward?.()
	}

	function stopFastForward() {
		visualNovelRef.value?.stopFastForward?.()
	}

	const showInventoryButton = computed(() => {
		if (isIsometricPhase.value && !isCombatPhase.value) return true
		const v = currentUiVisibility.value
		if (v.all) return true
		return !!v['inventory-button']
	})

	const showJournalButton = computed(() => {
		if (isIsometricPhase.value && !isCombatPhase.value) return true
		const v = currentUiVisibility.value
		if (v.all) return true
		return !!v['journal-button']
	})

	const showMapButton = computed(() => {
		if (isIsometricPhase.value && !isCombatPhase.value) return true
		const v = currentUiVisibility.value
		if (v.all) return true
		return !!v['map-button']
	})

	const showNextTimeButton = computed(() => {
		if (isIsometricPhase.value && !isCombatPhase.value) return true
		const v = currentUiVisibility.value
		if (v['next-time-button'] !== undefined) return !!v['next-time-button']
		return !v.hasDialogue
	})

	const showDateBadge = computed(() => {
		const isNewWorld =
			gameState.global?.calendarType === 'new_world' || gameState.global?.year === 0
		if (isNewWorld) return false
		const v = currentUiVisibility.value
		if (v['date-badge'] !== undefined) return !!v['date-badge']
		if (v['calendar-button'] !== undefined) return !!v['calendar-button']
		return true
	})

	const showTopbar = computed(() => {
		if (isUiHidden.value || isCombatPhase.value) return false
		if (isIsometricPhase.value) return true
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
		if (isIsometricPhase.value || isCombatPhase.value) return false
		const v = currentUiVisibility.value
		return !!(v.all || v.hotbar)
	})

	const canShowSidebars = computed(() => {
		return isStoryVnPhase.value && !isUiHidden.value
	})

	const hasDialogue = computed(() => {
		return !!currentUiVisibility.value?.hasDialogue
	})

	const isHelmetEquipped = computed(() => {
		return mcCharacter.value?.equipment_slots?.head === 'neuro_helmet'
	})

	// ── 9. Scene & Map Navigation ───────────────────────────────────────────────
	const novelsrc = computed(() => {
		const language = settingsStore.general.language || 'ru'
		return `/data/story/${language}/start.json`
	})

	function onGlobalDataChanged(newGlobal) {
		if (newGlobal && typeof newGlobal === 'object') {
			gameStore.setGlobalData(newGlobal)
		}
	}

	function handleAdvanceTime() {
		if (visualNovelRef.value?.advanceTime) {
			visualNovelRef.value.advanceTime()
			const vnGlobal =
				visualNovelRef.value?.globalData?.value || visualNovelRef.value?.globalData
			if (vnGlobal) {
				Object.assign(gameState.global, vnGlobal)
			}
		}
	}

	function handleMapGoto(gotoPayload) {
		const target = typeof gotoPayload === 'string' ? gotoPayload : gotoPayload?.target
		const locationId = typeof gotoPayload === 'object' ? gotoPayload?.locationId : null

		if (locationId) {
			const vnGlobal =
				visualNovelRef.value?.globalData?.value || visualNovelRef.value?.globalData
			if (vnGlobal) {
				vnGlobal.currentLocation = locationId
			}
			gameState.global.currentLocation = locationId
		}

		const scenesMap =
			visualNovelRef.value?.sceneData?.value || visualNovelRef.value?.sceneData || {}
		const targetScene = scenesMap[target]
		if (targetScene?.isometric) {
			enterIsometric(targetScene.isometric)
			modalStore.closeMap()
			return
		}
		if (targetScene?.combat) {
			enterCombat(targetScene.combat, null, null)
			modalStore.closeMap()
			return
		}

		if (target && visualNovelRef.value?.goto) {
			visualNovelRef.value.goto(target)
		}
		modalStore.closeMap()
	}

	// Watch currentScene in case navigation happens through hotspot (e.g. from village square)
	watch(
		() => visualNovelRef.value?.currentScene?.value || visualNovelRef.value?.currentScene,
		(newScene) => {
			if (newScene?.isometric) {
				enterIsometric(newScene.isometric)
			}
			if (newScene?.combat) {
				enterCombat(newScene.combat, null, null)
			}
		},
		{ deep: true }
	)

	function onCharacterClick({ character, interaction }) {
		if (!interaction || interaction.type !== 'npc-menu' || !interaction.story) return
		if (visualNovelRef.value?.goto) {
			visualNovelRef.value.goto(interaction.story)
		}
	}

	function onEnd() {
		Object.keys(gameState.global).forEach((key) => delete gameState.global[key])
		settingsStore.isMusicPlaying = true
		router.push('/home')
	}

	// ── 10. Character Equipment, Rules Engine & Audio ───────────────────────────
	const gameState = reactive({
		get character() {
			return gameStore.characterData
		},
		get global() {
			return gameStore.globalData
		},
		game: {
			location: 'city_street',
			activeStory: 'start',
			storyPlaying: true
		},
		storyEngine: null,
		closeModal: (modalName) => {
			modalStore.close(modalName)
		}
	})

	const { registerRules, startRules, resetEngine } = useGameRules(gameState)
	const questsManager = useQuests(gameState)
	const encyclopediaManager = useEncyclopedia(gameState)

	function playClothSound() {
		audioService.playSound(SOUND_CLOTH, 'sound')
	}

	let isSyncingEquipment = false
	function syncEquipmentToScene(characterId = 'mc') {
		if (isSyncingEquipment) return
		isSyncingEquipment = true
		try {
			if (visualNovelRef.value?.syncCharacterEquipment) {
				visualNovelRef.value.syncCharacterEquipment(characterId, mcCharacter.value)
			} else if (visualNovelRef.value?.rebuildEquipmentBySlot) {
				visualNovelRef.value.rebuildEquipmentBySlot(
					characterId,
					mcCharacter.value?.equipment_slots
				)
			}
		} finally {
			isSyncingEquipment = false
		}
	}

	const {
		handleEquip,
		handleUnequip,
		handleSwap,
		handleDrop,
		rebuildEquipmentBySlot
	} = useCharacterEquipment(
		mcCharacter,
		itemsData,
		gameState,
		playClothSound,
		() => syncEquipmentToScene('mc')
	)

	function onEquipItem(payload) {
		handleEquip(payload)
	}

	let lastEquipmentSlotsStr = ''
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

	function handleItemEquippedEvent(payload) {
		const detail = payload?.detail || payload
		if (detail?.itemId === 'neuro_helmet' && detail?.slot === 'head') {
			handleNeuroHelmetEquipped()
		}
	}

	// ── 11. Saves & Screenshots ─────────────────────────────────────────────────
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

	async function onLoadRequest(saveData) {
		try {
			if (!visualNovelRef.value) {
				console.warn('VisualNovel ref not ready')
				return
			}

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
						await visualNovelRef.value.restoreGameState(saveData.gameState)
						if (visualNovelRef.value.globalData?.value) {
							gameStore.setGlobalData(visualNovelRef.value.globalData.value)
						}
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
			if (!visualNovelRef.value) {
				console.warn('VisualNovel ref not ready')
				return
			}

			const state = visualNovelRef.value.getGameState()
			const mcName =
				state.characterData?.mc?.title ||
				state.characterData?.mc?.nickname ||
				state.characterData?.mc?.name ||
				'Unknown'

			if (savesStore.hasSave(saveData.slot)) {
				showConfirm(
					'Перезаписать слот?',
					`Слот ${saveData.slot + 1} уже содержит сохранение. Перезаписать?`,
					async () => {
						console.log('Saving game to slot', saveData.slot)
						const result = await saveWithHiddenOverlays(async () => {
							const clipRect = getGameAreaClipRect()
							return await savesStore.saveGame(saveData.slot, state, mcName, clipRect)
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
				return await savesStore.saveGame(saveData.slot, state, mcName, clipRect)
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
			if (!visualNovelRef.value) {
				console.warn('VisualNovel ref not ready for quick save')
				return
			}

			const state = visualNovelRef.value.getGameState()
			const mcName =
				state.characterData?.mc?.title ||
				state.characterData?.mc?.nickname ||
				state.characterData?.mc?.name ||
				'Unknown'

			const result = await saveWithHiddenOverlays(async () => {
				const clipRect = getGameAreaClipRect()
				return await savesStore.saveQuick(state, mcName, clipRect)
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
			if (!visualNovelRef.value) {
				console.warn('VisualNovel ref not ready for quick load')
				return
			}

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
						await visualNovelRef.value.restoreGameState(saveFile.gameState)
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
		if (visualNovelRef.value) {
			historyList.value = visualNovelRef.value.getHistory()
		}
		modalStore.openHistory()
	}

	// ── 12. Modal Stack Registration ───────────────────────────────────────────
	useRegisterModal('inventory', () => modalStore.showInventoryModal, () => {
		modalStore.closeInventory()
	})
	useRegisterModal('map', () => modalStore.showMapModal, () => {
		modalStore.closeMap()
	})
	useRegisterModal('journal', () => modalStore.showJournalModal, () => {
		modalStore.closeJournal()
	})
	useRegisterModal('calendar', () => modalStore.showCalendarModal, () => {
		modalStore.closeCalendar()
	})
	useRegisterModal('history', () => modalStore.showHistoryModal, () => {
		modalStore.closeHistory()
	})
	useRegisterModal('vr-launcher', isVrHubPhase, () => {
		if (vrLauncherRef.value?.startExitVr) {
			vrLauncherRef.value.startExitVr()
		} else {
			onVrExit()
		}
	})
	useRegisterModal('ygg-auth', isVrAuthPhase, () => {
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
	useRegisterModal('isometric-overlay', isIsometricPhase, () => {
		if (isometricOverlayRef.value?.showExitConfirm) {
			isometricOverlayRef.value.cancelExit()
		} else if (isometricOverlayRef.value?.requestExit) {
			isometricOverlayRef.value.requestExit()
		} else {
			onIsometricExit()
		}
	})
	useRegisterModal('combat-overlay', isCombatPhase, () => {
		// Escape during combat does nothing (combat must be resolved)
	})

	// ── 13. Hotkeys & Input Listeners ───────────────────────────────────────────
	function isInputElementActive() {
		const el = document.activeElement
		if (!el) return false
		const tag = el.tagName ? el.tagName.toLowerCase() : ''
		if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
		if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') return true
		return false
	}

	const onKeyDown = (e) => {
		if (isInputElementActive()) return

		if (isUiHidden.value) {
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

		if (
			e.key === 'Control' ||
			e.code === 'ControlLeft' ||
			e.code === 'ControlRight'
		) {
			if (
				!hasModals() &&
				!menuVisible.value &&
				!isAnyVrPhase.value &&
				!isGameLoading.value
			) {
				if (isUiHidden.value) {
					unhideUi()
				}
				startFastForward()
			}
			return
		}

		if (
			e.code === 'KeyH' ||
			e.key?.toLowerCase() === 'h' ||
			e.key?.toLowerCase() === 'р'
		) {
			if (!hasModals() && !menuVisible.value && !isAnyVrPhase.value) {
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

	// ── 14. Menu Audio & Settings Synchronization ──────────────────────────────
	watch(menuVisible, (isVisible) => {
		if (isVisible) {
			visualNovelRef.value?.pauseAllStreams?.()
			settingsStore.isMusicPlaying = true
		} else {
			settingsStore.isMusicPlaying = false
			visualNovelRef.value?.resumeAllStreams?.()
		}
	})

	watch(
		() => gameStore.globalData?.currentMap,
		(newMap) => {
			if (newMap && settingsStore.currentMap !== newMap) {
				settingsStore.setCurrentMap(newMap)
			}
		}
	)

	// ── 15. Lifecycle Hooks ────────────────────────────────────────────────────
	onMounted(() => {
		settingsStore.isMusicPlaying = false

		window.addEventListener('keydown', onKeyDown)
		window.addEventListener('keyup', onKeyUp)
		window.addEventListener('blur', onWindowBlur)
		eventBus.on('item-equipped', handleItemEquippedEvent)

		if (visualNovelRef.value) {
			gameState.storyEngine = markRaw(visualNovelRef.value)
		}

		registerRules(allStoryRules)
		startRules()

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
				itemsData.value = {}
				equipment.forEach((item) => {
					itemsData.value[item.id] = item
				})
				other.forEach((item) => {
					itemsData.value[item.id] = item
				})
			})
			.catch((err) => {
				console.error('Failed to load items data:', err)
			})

		setTimeout(() => {
			if (isGameLoading.value && !savesStore.getPendingLoad()) {
				isGameLoading.value = false
			}
		}, 3000)

		if (route.meta?.newGame && visualNovelRef.value) {
			visualNovelRef.value.resetGameState?.()
		}

		// Restore pending load if navigated from main menu
		if (savesStore.getPendingLoad()) {
			isGameLoading.value = true
			loadingTitleText.value = 'ЗАГРУЗКА'
			loadingStatusText.value = 'Восстановление сохранения...'
			nextTick(async () => {
				try {
					const maxWait = 5000
					const interval = 100
					let waited = 0
					while (!visualNovelRef.value && waited < maxWait) {
						await new Promise((r) => setTimeout(r, interval))
						waited += interval
					}
					const pending = savesStore.getPendingLoad()
					if (!pending || !visualNovelRef.value) {
						isGameLoading.value = false
						return
					}
					await visualNovelRef.value.restoreGameState(pending.gameState)
					if (visualNovelRef.value.globalData?.value) {
						gameStore.setGlobalData(visualNovelRef.value.globalData.value)
					}
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
		eventBus.off('item-equipped', handleItemEquippedEvent)
		clearModalStack()
		resetEngine()
	})

	return {
		// FSM Phase state
		currentPhase,
		previousPhase,
		transitionTo,
		isStoryVnPhase,
		isOverworldHexPhase,
		isIsometricPhase,
		isCombatPhase,
		isVrHubPhase,
		isVrIntroPhase,
		isVrAuthPhase,
		isVrCharCreatePhase,
		isVrShutdownPhase,
		isAnyVrPhase,

		// Character & Items
		mcCharacter,
		itemsData,
		historyList,

		// Loading screen
		isGameLoading,
		loadingTitleText,
		loadingStatusText,
		onVisualNovelReady,

		// VR & Yggdrasil
		vrLauncherRef,
		vrLauncherPhase,
		openVrFromSidebar,
		onVrExit,
		onLaunchYggdrasil,
		onYggIntroComplete,
		onYggBackToLauncher,
		onYggAuthSuccess,
		onCharCreationConfirmed,
		onShutdownSequenceComplete,

		// Isometric Overlay
		activeIsometricLocationId,
		isometricOverlayRef,
		enterIsometric,
		onIsometricExit,
		onIsometricQuestCompleted,
		onIsometricCombatRequested,

		// Combat Overlay
		activeCombatEncounterId,
		activeCombatEncounterData,
		enterCombat,
		onCombatEnd,

		// UI & Layout Visibility
		isUiHidden,
		unhideUi,
		isFastForwarding,
		showInventoryButton,
		showJournalButton,
		showMapButton,
		showNextTimeButton,
		showDateBadge,
		showTopbar,
		showHotbar,
		canShowSidebars,
		hasDialogue,
		isHelmetEquipped,

		// Navigation & VN
		novelsrc,
		handleAdvanceTime,
		handleMapGoto,
		onCharacterClick,
		onGlobalDataChanged,
		onUiVisibilityChanged,
		onEnd,

		// Menu, Modals & Settings
		menuVisible,
		currentView,
		savesTab,
		showLeaveConfirm,
		confirmVisible,
		confirmTitle,
		confirmMessage,
		onConfirm,
		onCancel,
		openMainMenu,
		openSettings,
		openSave,
		openLoad,
		openHistory,
		onContinue,
		handleNavigation,
		onSavesTabChange,
		onSettingsSaved,
		onSettingsReset,
		onSettingsDirtyChange,
		handleLeaveYes,
		handleLeaveNo,
		handleLeaveCancel,

		// Saves
		onLoadRequest,
		onSaveRequest,
		quickSave,
		quickLoad,

		// Equipment
		onEquipItem,
		handleUnequip,
		handleSwap,
		handleDrop
	}
}
