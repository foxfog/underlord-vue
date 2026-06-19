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
	import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
	import { useRouter, useRoute } from 'vue-router'
	import VisualNovel from '../components/game/VisualNovel.vue'
	import CharacterStatsModal from '../components/game/characters/CharacterStatsModal.vue'
	import InventoryModal from '../components/game/inventory/InventoryModal.vue'
	import Topbar from '../components/game/ui/Topbar.vue'
	import MapModal from '../components/game/maps/MapModal.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'
	import MainMenu from '@/components/MainMenu.vue'
	import HistoryModal from '@/components/game/modals/HistoryModal.vue'
	import ConfirmModal from '@/components/ConfirmModal.vue'
	import Hotbar from '../components/game/ui/Hotbar.vue'
	import SettingsLeaveConfirmModal from '@/components/SettingsLeaveConfirmModal.vue'
	import { useSavesStore } from '@/stores/saves'
	import { useSettingsStore } from '@/stores/settings'
	import { SOUND_CLOTH } from '../constants/sounds'
	import { useGameRules } from '@/composables/useGameRules'
	import { allStoryRules } from '@/constants/storyRules'
	import { reactive } from 'vue'

	const router = useRouter()
	const route = useRoute()
	const settingsStore = useSettingsStore()
	const savesStore = useSavesStore()
	const visualNovel = ref(null)
	const showStatsModal = ref(false)
	const showInventoryModal = ref(false)
	const showMapModal = ref(false)
	const mcCharacter = ref(null)
	const itemsData = ref({})

	const savesTab = ref('load')

	// Menu and view state for the overlay
	const menuVisible = ref(false)
	const currentView = ref('main-menu')
	const dynamicContentAreaRef = ref(null)
	const isSettingsDirty = ref(false)
	const showLeaveConfirm = ref(false)
	const pendingView = ref(null)
	const showHistoryModal = ref(false)
	const historyList = ref([])

	const confirmVisible = ref(false)
	const confirmTitle = ref('')
	const confirmMessage = ref('')
	let confirmAction = null

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

	function showConfirm(title, message, action) {
		confirmTitle.value = title
		confirmMessage.value = message
		confirmAction = action
		confirmVisible.value = true
	}

	function onConfirm() {
		confirmVisible.value = false
		if (confirmAction) {
			const act = confirmAction
			confirmAction = null
			act()
		}
	}

	function onCancel() {
		confirmVisible.value = false
		confirmAction = null
	}

	// UI visibility states
	const uiVisibility = ref({
		all: false,
		'stats-button': false,
		'inventory-button': false,
		'map-button': false,
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
				uiVisibility.value['map-button']
			)
		}
		return !!(
			uiVisibility.value['stats-button'] ||
			uiVisibility.value['inventory-button'] ||
			uiVisibility.value['map-button']
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

	const screenshotMode = ref(false)

	watch(screenshotMode, (isScreenshotMode) => {
		if (typeof document !== 'undefined' && document.body) {
			document.body.classList.toggle('screenshot-mode', isScreenshotMode)
		}
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

	async function saveWithHiddenOverlays(saveAction) {
		screenshotMode.value = true
		await nextTick()
		await new Promise((resolve) => requestAnimationFrame(resolve))
		try {
			return await saveAction()
		} finally {
			screenshotMode.value = false
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

	function handleEquip({ slot, itemId, inventoryIndex }) {
		if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

		// Шаг 1: Проверить, что слот пуст ИЛИ нужен swap с инвентарём (запрещаем)
		const currentItemInSlot = mcCharacter.value.equipment_slots[slot]
		
		// Слот может быть ТОЛЬКО пустым или содержать ДРУГОЙ предмет для swap'а
		// Если слот занят ИМ ЖЕ предметом - это ошибка (нельзя положить второй)
		if (currentItemInSlot === itemId) {
			console.warn(`Cannot equip: slot ${slot} already contains the same item ${itemId}. Use swap instead.`)
			return
		}
		
		// Шаг 2: Если слот содержит ДРУГОЙ предмет - вернуть его в инвентарь
		// (это означает, что пользователь заменяет предмет)
		if (currentItemInSlot) {
			console.log('Replacing item in slot:', { slot, oldItem: currentItemInSlot, newItem: itemId })
			const oldItemDef = itemsData.value[currentItemInSlot]
			const oldItemStackable = oldItemDef?.stackable !== false
			
			if (oldItemStackable) {
				const existingItem = mcCharacter.value.inventory.items.find(item => item.itemId === currentItemInSlot)
				if (existingItem) {
					existingItem.quantity = (existingItem.quantity ?? 1) + 1
				} else {
					mcCharacter.value.inventory.items.push({ itemId: currentItemInSlot, quantity: 1 })
				}
			} else {
				mcCharacter.value.inventory.items.push({ itemId: currentItemInSlot, quantity: 1 })
			}
		}
		
		// Шаг 3: Удалить новый предмет из инвентаря
		let itemIndex = inventoryIndex ?? -1
		if (itemIndex === -1) {
			itemIndex = mcCharacter.value.inventory.items.findIndex(item => item.itemId === itemId)
		}
		
		if (itemIndex !== -1) {
			const item = mcCharacter.value.inventory.items[itemIndex]
			if (item) {
				item.quantity = (item.quantity ?? 1) - 1
				if (item.quantity <= 0) {
					mcCharacter.value.inventory.items.splice(itemIndex, 1)
				}
			}
		}
		
		// Шаг 4: Установить новый предмет в слот
		mcCharacter.value.equipment_slots[slot] = itemId
		console.log(`🔧 Set ${slot} = ${itemId}`, { 
			slotValue: mcCharacter.value.equipment_slots[slot],
			gameStateValue: gameState.character.mc?.equipment_slots[slot]
		})
		
		rebuildEquipmentBySlot()
		playClothSound()
		
		// Update gameState for Rules Engine
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
	}

	function handleUnequip({ slot, itemId }) {
		if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

		// Шаг 1: Убедиться, что в слоте именно этот предмет
		const actualItem = mcCharacter.value.equipment_slots[slot];
		
		// Если слот уже очищен (например дефп watch перезаписал), просто добавляем в инвентарь
		// Это может происходить из-за deep watch на visualNovel.characterData
		if (actualItem === null && itemId) {
			console.warn('⚠️ Slot already empty, but adding item to inventory anyway:', { slot, itemId });
			// Продолжаем дальше к шагу 3 (добавлению в инвентарь)
		} else if (actualItem !== itemId) {
			console.error('❌ Item mismatch:', { 
				slot, 
				expectedItemId: itemId, 
				actualItemId: actualItem,
				allSlots: { ...mcCharacter.value.equipment_slots },  // Копируем для лучшего логирования
				gameStateSlots: { ...gameState.character.mc?.equipment_slots },
				currentStory: visualNovel.value?.storyData?.value?.id
			});
			return
		}

		// Шаг 2: Очистить слот (если ещё не очищен)
		if (mcCharacter.value.equipment_slots[slot] !== null) {
			mcCharacter.value.equipment_slots[slot] = null
		}

		// Шаг 3: Добавить предмет в инвентарь
		const itemDef = itemsData.value[itemId]
		const isStackable = itemDef?.stackable !== false

		if (isStackable) {
			const existingItem = mcCharacter.value.inventory.items.find(item => item.itemId === itemId)
			if (existingItem) {
				existingItem.quantity += 1
			} else {
				mcCharacter.value.inventory.items.push({ itemId, quantity: 1 })
			}
		} else {
			mcCharacter.value.inventory.items.push({ itemId, quantity: 1 })
		}

		rebuildEquipmentBySlot()
		playClothSound()
		
		// Update gameState for Rules Engine
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
			console.log(`🔄 handleUnequip: Removed ${itemId} from ${slot}`);
			console.log('   gameState.character.mc.mask:', gameState.character.mc?.equipment_slots?.mask);
			console.log('   gameState.global:', gameState.global);
			console.log('   gameState.global.toxic_gas:', gameState.global?.toxic_gas);
			console.log('   visualNovel.globalData:', visualNovel.value?.globalData);
		}
	}

	function handleSwap({ from, to }) {
		if (!mcCharacter.value?.equipment_slots) return

		const fromItemId = mcCharacter.value.equipment_slots[from]
		const toItemId = mcCharacter.value.equipment_slots[to]

		// Проверяем, что оба предмета существуют (не null)
		if (!fromItemId || !toItemId) return

		// Просто меняем местами
		const temp = mcCharacter.value.equipment_slots[from]
		mcCharacter.value.equipment_slots[from] = mcCharacter.value.equipment_slots[to]
		mcCharacter.value.equipment_slots[to] = temp

		rebuildEquipmentBySlot()
		playClothSound()
		
		// Update gameState for Rules Engine
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
	}

	function handleDrop({ itemId, source, slot, quantity = 1 }) {
		console.log('Dropping item:', { itemId, source, slot, quantity })
		if (mcCharacter.value?.inventory?.items) {
			// Найти и удалить предмет из инвентаря
			const itemIndex = mcCharacter.value.inventory.items.findIndex(item => item.itemId === itemId)
			if (itemIndex !== -1) {
				const item = mcCharacter.value.inventory.items[itemIndex]
				
				// Если есть quantity > удаляемого количества, просто уменьшить
				if (item.quantity && item.quantity > quantity) {
					item.quantity -= quantity
				} else {
					// Иначе удалить полностью
					mcCharacter.value.inventory.items.splice(itemIndex, 1)
				}
			}
		}
		
		// Update gameState for Rules Engine
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
	}

	function rebuildEquipmentBySlot() {
		if (!mcCharacter.value) return

		const equipmentMap = {}
		if (Array.isArray(mcCharacter.value.equipment)) {
			mcCharacter.value.equipment.forEach(item => {
				if (item && item.id) equipmentMap[item.id] = item
			})
		}

		const equipmentBySlot = {}
		const slots = mcCharacter.value.equipment_slots || {}
		for (const [slotName, itemRef] of Object.entries(slots)) {
			let itemId = null
			if (itemRef === null || typeof itemRef === 'undefined') itemId = null
			else if (typeof itemRef === 'string' || typeof itemRef === 'number') itemId = itemRef
			else if (typeof itemRef === 'object' && itemRef.id) itemId = itemRef.id
			else if (typeof itemRef === 'object' && itemRef.item && itemRef.item.id) itemId = itemRef.item.id
			if (itemId && equipmentMap[itemId]) {
				equipmentBySlot[slotName] = { id: itemId, item: equipmentMap[itemId], parts: equipmentMap[itemId].parts || [] }
			}
		}

		mcCharacter.value.equipmentBySlot = equipmentBySlot
	}

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

	const showSettings = () => {
		currentView.value = 'settings'
	}

	const showSaves = () => {
		currentView.value = 'saves'
	}

	function navigateImmediate(view) {
		if (view === 'settings') {
			showSettings()
		} else if (view === 'save') {
			savesTab.value = 'save'
			currentView.value = 'saves'
			menuVisible.value = true
		} else if (view === 'load') {
			savesTab.value = 'load'
			currentView.value = 'saves'
			menuVisible.value = true
		} else if (view === 'saves') {
			showSaves()
		} else if (view === 'main-menu') {
			showMainMenu()
		} else if (view === 'home-screen') {
			router.push('/home')
		}
	}

	function showMainMenu() {
		openMainMenu()
	}

	function onSavesTabChange(tab) {
		savesTab.value = tab
	}

	const handleNavigation = (view) => {
		// Leaving settings with unsaved changes → ask first
		if (currentView.value === 'settings' && view !== 'settings' && isSettingsDirty.value) {
			pendingView.value = view
			showLeaveConfirm.value = true
			return
		}
		navigateImmediate(view)
	}

	function onSettingsSaved() {
		console.log('Settings saved')
		isSettingsDirty.value = false
	}

	function onSettingsReset() {
		console.log('Settings reset to default')
		isSettingsDirty.value = false
	}

	function onSettingsDirtyChange(val) {
		isSettingsDirty.value = val
	}

	async function handleLeaveYes() {
		showLeaveConfirm.value = false
		if (dynamicContentAreaRef.value?.saveSettingsFromOutside) {
			await dynamicContentAreaRef.value.saveSettingsFromOutside()
			isSettingsDirty.value = false
		}
		if (pendingView.value) {
			navigateImmediate(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveNo() {
		showLeaveConfirm.value = false
		if (dynamicContentAreaRef.value?.revertSettingsFromOutside) {
			dynamicContentAreaRef.value.revertSettingsFromOutside()
		}
		isSettingsDirty.value = false
		if (pendingView.value) {
			navigateImmediate(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveCancel() {
		showLeaveConfirm.value = false
		pendingView.value = null
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

	function openMainMenu() {
		menuVisible.value = true
		currentView.value = 'main-menu'
	}

	function openSettings() {
		menuVisible.value = true
		currentView.value = 'settings'
	}

	function openSave() {
		// If leaving settings with unsaved changes, ask first
		if (currentView.value === 'settings' && isSettingsDirty.value) {
			pendingView.value = 'save'
			showLeaveConfirm.value = true
			return
		}
		savesTab.value = 'save'
		menuVisible.value = true
		currentView.value = 'saves'
	}

	function openLoad() {
		// If leaving settings with unsaved changes, ask first
		if (currentView.value === 'settings' && isSettingsDirty.value) {
			pendingView.value = 'load'
			showLeaveConfirm.value = true
			return
		}
		savesTab.value = 'load'
		menuVisible.value = true
		currentView.value = 'saves'
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