<template>
	<div class="game-area">
		<!-- Top Toolbar -->
		<Topbar
			v-if="showTopbar"
			:character="mcCharacter"
			:show-map-button="showMapButton"
			:show-inventory-button="showInventoryButton"
			@open-stats="toggleStatsModal"
			@open-inventory="toggleInventoryModal"
			@open-map="toggleMapModal"
			@open-journal="toggleJournalModal"
		/>

		<div class="game">
			<VisualNovel
				ref="visualNovel"
				:src="novelsrc"
				@end="onEnd"
				@character-loaded="onCharacterLoaded"
				@global-data-changed="onGlobalDataChanged"
			/>
		</div>

		<!-- Stats Modal -->
		<CharacterStatsModal
			:is-visible="showStatsModal"
			:character="mcCharacter"
			@close="toggleStatsModal"
		/>

		<!-- Inventory Modal -->
		<InventoryModal
			:is-visible="showInventoryModal"
			:character="mcCharacter"
			:items-data="itemsData"
			@close="toggleInventoryModal"
			@equip="handleEquip"
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

		<JournalModal :isVisible="showJournalModal" @close="showJournalModal = false" />

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
	<HistoryModal :isVisible="showHistoryModal" :entries="historyList" @close="showHistoryModal=false" />

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
</template>

<script setup>
	import { ref, onMounted, onUnmounted, nextTick, watch, computed, reactive } from 'vue'
	import { useRouter, useRoute } from 'vue-router'
	import VisualNovel from '../components/game/VisualNovel.vue'
	import CharacterStatsModal from '../components/game/characters/CharacterStatsModal.vue'
	import InventoryModal from '../components/game/inventory/InventoryModal.vue'
	import Topbar from '../components/game/ui/Topbar.vue'
	import MapModal from '../components/game/maps/MapModal.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'
	import MainMenu from '@/components/MainMenu.vue'
	import HistoryModal from '../components/game/modals/HistoryModal.vue'
	import JournalModal from '../components/game/modals/JournalModal.vue'
	import ConfirmModal from '@/components/ConfirmModal.vue'
	import Hotbar from '../components/game/ui/Hotbar.vue'
	import SettingsLeaveConfirmModal from '@/components/SettingsLeaveConfirmModal.vue'
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

	const router = useRouter()
	const route = useRoute()
	const settingsStore = useSettingsStore()
	const savesStore = useSavesStore()
	const visualNovel = ref(null)
	const showStatsModal = ref(false)
	const showInventoryModal = ref(false)
	const showMapModal = ref(false)
	const showJournalModal = ref(false)
	const mcCharacter = ref(null)
	const itemsData = ref({})
	const dynamicContentAreaRef = ref(null)
	const showHistoryModal = ref(false)
	const historyList = ref([])

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

	const {
		confirmVisible,
		confirmTitle,
		confirmMessage,
		showConfirm,
		onConfirm,
		onCancel
	} = useConfirmDialog()

	const {
		screenshotMode,
		saveWithHiddenOverlays
	} = useScreenshotMode()

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
		global: {},  // ← добавляем объект для глобальных переменных
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
			console.log(`✓ Modal closed: ${modalName}`);
		}
	})

	const { 
		registerRules, 
		startRules, 
		stopRules,
		resetEngine,
		stats
	} = useGameRules(gameState)

	const novelsrc = computed(() => {
		const language = settingsStore.general.language || 'ru'
		return `/data/story/${language}/start.json`
	})

	// UI visibility states
	const uiVisibility = ref({
		all: false,
		'stats-button': false,
		'inventory-button': false,
		'map-button': false,
		'journal-button': false,
		topbar: false,
		hotbar: false,
		dialogue: false
	})

	// Computed properties for UI visibility
	const showTopbar = computed(() => {
		if (uiVisibility.value.all) return true
		if (!uiVisibility.value.topbar) {
			return !!(
				uiVisibility.value['stats-button'] ||
				uiVisibility.value['inventory-button'] ||
				uiVisibility.value['map-button'] ||
				uiVisibility.value['journal-button']
			)
		}
		return !!(
			uiVisibility.value['stats-button'] ||
			uiVisibility.value['inventory-button'] ||
			uiVisibility.value['map-button'] ||
			uiVisibility.value['journal-button']
		)
	})

	const showHotbar = computed(() => {
		return uiVisibility.value.all || uiVisibility.value.hotbar
	})

	const showMapButton = computed(() => {
		return uiVisibility.value['map-button'] !== false
	})

	const showInventoryButton = computed(() => {
		return uiVisibility.value['inventory-button'] !== false
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

	// Watch for uiVisibility changes from VisualNovel
	watch(() => visualNovel.value?.uiVisibility, (newVisibility) => {
		if (newVisibility) {
			uiVisibility.value = newVisibility
		}
	}, { deep: true })

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
	watch(() => currentView.value, (newView, oldView) => {
		console.log(`Current view changed from "${oldView}" to "${newView}"`)
	})

	// Watch for character changes and update gameState
	watch(() => mcCharacter.value, (newChar) => {
		if (newChar) {
			// Убедимся, что gameState указывает на реальный объект персонажа, а не копию
			gameState.character.mc = newChar
			gameState.storyEngine = visualNovel.value
			
			// Синхронизируем и с characterData из visualNovel
			if (visualNovel.value?.characterData?.mc) {
				gameState.character.mc = visualNovel.value.characterData.mc;
			}
		}
	}, { deep: true })

	// Watch for character data changes in visualNovel to stay in sync
	watch(() => visualNovel.value?.characterData?.mc, (charData) => {
		if (charData) {
			console.log('✏️ characterData changed in visualNovel, syncing...');
			gameState.character.mc = charData;
			mcCharacter.value = charData;
		}
	}, { deep: true })

	// Watch for global data changes from VisualNovel and sync to gameState
	watch(() => visualNovel.value?.globalData, (newGlobalData) => {
		if (newGlobalData) {
			console.log('🌍 globalData changed in visualNovel:', newGlobalData);
			Object.assign(gameState.global, newGlobalData)
			console.log('✅ Updated gameState.global:', gameState.global);
			if (newGlobalData.currentMap && settingsStore.currentMap !== newGlobalData.currentMap) {
				console.log('🔁 Syncing currentMap from story to Pinia:', newGlobalData.currentMap)
				settingsStore.setCurrentMap(newGlobalData.currentMap)
			}
		}
	}, { deep: true })

	watch(() => settingsStore.currentMap, (newMap) => {
		if (!visualNovel.value?.globalData) return
		if (newMap && visualNovel.value.globalData.currentMap !== newMap) {
			console.log('🔁 Syncing currentMap from Pinia to story globalData:', newMap)
			visualNovel.value.globalData.currentMap = newMap
		}
	})

	// Watch for equipment changes to debug sync issues
	watch(() => mcCharacter.value?.equipment_slots?.mask, (newMask, oldMask) => {
		if (newMask !== oldMask) {
			console.log('👕 Mask status:', {
				oldMask,
				newMask,
				gameStateMask: gameState.character.mc?.equipment_slots?.mask
			});
		}
		// Убедимся что gameState синхронизирован
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value;
		}
	})

	function onEnd() {
		// Clear global variables (e.g. toxic_gas) so they don't bleed into the next game
		Object.keys(gameState.global).forEach(key => delete gameState.global[key])
		// Stop game music, restore background music
		settingsStore.isMusicPlaying = true
		router.push('/home')
	}

	function toggleStatsModal() {
		showStatsModal.value = !showStatsModal.value
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

function handleMapGoto(gotoPayload) {
	const target = typeof gotoPayload === 'string' ? gotoPayload : gotoPayload?.target
	const locationId = typeof gotoPayload === 'object' ? gotoPayload?.locationId : null

	if (locationId) {
		if (visualNovel.value?.globalData) {
			visualNovel.value.globalData.currentLocation = locationId
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

	const {
		handleEquip,
		handleUnequip,
		handleSwap,
		handleDrop,
		rebuildEquipmentBySlot
	} = useCharacterEquipment(mcCharacter, itemsData, gameState, playClothSound)

	function onCharacterLoaded(characterData) {
		if (characterData?.mc) {
			const oldMask = mcCharacter.value?.equipment_slots?.mask;
			const newMask = characterData.mc?.equipment_slots?.mask;
			console.log('🔄 onCharacterLoaded - updating mcCharacter', {
				oldMask,
				newMask,
				stack: new Error().stack.split('\n').slice(1, 3).join(' | ')
			});
			mcCharacter.value = characterData.mc
			// Также пересинхронизируем gameState чтобы Rules Engine видел актуальные данные
			gameState.character.mc = characterData.mc
		}
	}

	function onGlobalDataChanged(globalData) {
		if (globalData) {
			console.log('🌍 onGlobalDataChanged - updating gameState.global', globalData);
			Object.assign(gameState.global, globalData);
			console.log('✅ gameState.global updated:', gameState.global);
			if (globalData.currentMap && settingsStore.currentMap !== globalData.currentMap) {
				console.log('🔁 Syncing currentMap from global-data-changed to Pinia:', globalData.currentMap);
				settingsStore.setCurrentMap(globalData.currentMap);
			}
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
					await visualNovel.value.restoreGameState(saveData.gameState)
					menuVisible.value = false
					currentView.value = 'main-menu'
					settingsStore.isMusicPlaying = false
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
			const mcName = gameState.characterData?.mc?.name || 'Unknown'

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
			const mcName = gameState.characterData?.mc?.name || 'Unknown'

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
						await visualNovel.value.restoreGameState(saveFile.gameState)
						menuVisible.value = false
						currentView.value = 'main-menu'
						settingsStore.isMusicPlaying = false
					} catch (err) {
						console.error('Failed to restore quick save:', err)
						alert(`Не удалось восстановить быстрое сохранение: ${err.message}`)
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

	// Toggle menu visibility via Escape key
	const onKeyDown = (e) => {
	if (e.key === 'Escape') {
		menuVisible.value = !menuVisible.value
	}
	}

	onMounted(() => {
		// Stop background music when starting the game
		settingsStore.isMusicPlaying = false
		
		window.addEventListener('keydown', onKeyDown)

		// ВАЖНО: Инициализируем gameState.storyEngine ДО запуска Rules Engine
		gameState.storyEngine = visualNovel.value

		// Initialize Game Rules Engine
		registerRules(allStoryRules)
		startRules() // Check rules reactively on gameState changes

		// Load items data (equipment and consumables)
		const getFullPath = (path) => {
			const basePath = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			return basePath ? basePath + path.replace(/^\//, '') : path
		}

		Promise.all([
			fetch(getFullPath('/data/items/equipment.json')).then(r => r.json()),
			fetch(getFullPath('/data/items/other.json')).then(r => r.json())
		]).then(([equipment, other]) => {
			// Merge both item collections by id
			itemsData.value = {}
			equipment.forEach(item => {
				itemsData.value[item.id] = item
			})
			other.forEach(item => {
				itemsData.value[item.id] = item
			})
			console.log('Items data loaded:', itemsData.value)
			console.log('Equipment items:', equipment)
			console.log('Other items:', other)
		}).catch(err => {
			console.error('Failed to load items data:', err)
		})

		// If this is a new game, reset the VisualNovel state
		if (route.meta.newGame && visualNovel.value) {
			console.log('Starting new game - resetting state')
			visualNovel.value.resetGameState()
		}

		// If we have a pending load (navigated from main menu), wait for VisualNovel to be ready and restore
		const savesStore = useSavesStore()
		if (savesStore.getPendingLoad()) {
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
					if (!pending) return
					if (!visualNovel.value) {
						console.warn('VisualNovel not ready to restore save after waiting')
						return
					}
					await visualNovel.value.restoreGameState(pending.gameState)
					savesStore.takePendingLoad()
					menuVisible.value = false
					currentView.value = 'main-menu'
				} catch (err) {
					console.error('Failed to restore pending save:', err)
					alert(`Failed to restore save: ${err.message}`)
					savesStore.takePendingLoad()
				}
			})
		}
	})

	onUnmounted(() => {
		window.removeEventListener('keydown', onKeyDown)
		// Fully destroy the rules engine singleton so the next game session
		// gets a fresh engine with the correct gameState reference
		resetEngine()
	})
</script>