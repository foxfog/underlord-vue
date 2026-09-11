import { ref, computed, watch } from 'vue'
import { useSavesStore } from '../stores/saves'
import { useSettingsStore } from '../stores/settings'
import { useGameStore } from '../stores/gameStore'
import { storeToRefs } from 'pinia'
import { useStoryUI } from './story/useStoryUI'
import { useStoryHistory } from './story/useStoryHistory'
import { useStoryDialogue } from './story/useStoryDialogue'
import { useStoryAudio } from './story/useStoryAudio'
import { useSceneHotspots } from './story/useSceneHotspots'
import { useStoryCharacters } from './story/useStoryCharacters'
import { useStoryTransitions } from './story/useStoryTransitions'
import { useStoryVariables } from './story/useStoryVariables'
import { SOUND_ALIASES } from '../constants/sounds'
import { DIALOGUE_HIDE_UI_CONFIG } from '../constants/dialogue'
import {
	extractVisibleCharacterDisplay,
	applyVisibleCharacterDisplay
} from '../utils/saveGameUtils'
import { evaluateExpression } from '../utils/expressionEvaluator'
import { getCalendarInfo, advanceTimeOfDay } from '../utils/timeCalendar'
import { calculateEquipmentBySlot } from '../utils/equipment'
import {
	createInitialGlobalData,
	createInitialCharacterData
} from '../constants/gameInitialState'
import { useQuests } from './useQuests'
import { useEncyclopedia } from './useEncyclopedia'
import { useNpcSchedule } from './useNpcSchedule'
import { saveManager } from '../services/saveManager'

export function useVisualNovel({ src, emit, notificationComponent } = {}) {
	// State
	const currentScene = ref(null)
	const {
		currentDialogue,
		currentNarration,
		currentTitle,
		currentTitleEffects,
		currentSpeaker,
		currentChoices,
		currentChoicesLayout,
		multiStepDialogueBuffer,
		multiStepPrintedLength,
		clearDialogue,
		resetDialogueState
	} = useStoryDialogue()

	// Audio state & playback
	const {
		audioStreams,
		pausedStreams,
		currentSound,
		currentVoice,
		currentMusic,
		scheduleAudio,
		flushPendingAudio,
		clearPendingAudio,
		onStreamEnded,
		playSound,
		playVoice,
		playMusic,
		stopSound,
		stopVoice,
		stopMusic,
		stopStream,
		stopAllStreams,
		playVariableStepSound,
		getStream,
		pauseAllStreams,
		resumeAllStreams
	} = useStoryAudio()

	// History
	const {
		HISTORY_MAX,
		historyEntries,
		addToHistory,
		getHistory,
		clearHistory,
		setHistory
	} = useStoryHistory()

	// Other state
	let titleTimeout = null
	const storyData = ref(null)
	const stepIndex = ref(0)
	const gameStore = useGameStore()
	const { characterData, sceneData, globalData } = storeToRefs(gameStore)
	const {
		visibleCharacters,
		showCharacter,
		hideCharacter,
		animateCharacterPart,
		rebuildEquipmentBySlot,
		syncCharacterEquipment
	} = useStoryCharacters({ characterData })
	let advanceStoryOverride = null
	const settingsStore = useSettingsStore()
	const isRestoringGameState = ref(false)

	// Transitions & Fades
	const {
		fadeOverlay,
		clearFadeTimeouts,
		isSceneTransitionsEnabled,
		handleFadeStep,
		performSceneTransition
	} = useStoryTransitions({
		settingsStore,
		isRestoringGameState,
		playSound,
		flushPendingAudio,
		advanceStep: () => {
			stepIndex.value++
			processStep()
		},
		setAdvanceOverride: (fn) => {
			advanceStoryOverride = fn
		},
		clearAdvanceOverride: () => {
			advanceStoryOverride = null
		}
	})
	const callStack = ref([])
	let currentStoryPath = 'start' // tracks the file path used to load the current story
	let restoreSessionId = 0
	const showTextInputModal = ref(false)
	const currentInputStep = ref(null)

	// Fast-forward / skip mode state (Ren'Py style Ctrl skip)
	const isSkipping = ref(false)
	let fastForwardInterval = null
	const FAST_FORWARD_INTERVAL_MS = 60

	function stopFastForward() {
		if (fastForwardInterval) {
			clearInterval(fastForwardInterval)
			fastForwardInterval = null
		}
		isSkipping.value = false
	}

	function shouldStopFastForward() {
		return (
			!storyData.value ||
			stepIndex.value >= storyData.value.steps.length ||
			(currentChoices.value && currentChoices.value.length > 0) ||
			showTextInputModal.value ||
			(!isDialogueActive.value && !advanceStoryOverride)
		)
	}

	function advanceFastForwardStep() {
		if (!isSkipping.value) return

		if (shouldStopFastForward()) {
			stopFastForward()
			return
		}

		advanceStory()

		if (shouldStopFastForward()) {
			stopFastForward()
		}
	}

	function startFastForward() {
		if (isSkipping.value) return
		if (shouldStopFastForward()) return

		isSkipping.value = true

		// Advance immediately on first trigger
		advanceFastForwardStep()

		if (!isSkipping.value) return

		if (fastForwardInterval) {
			clearInterval(fastForwardInterval)
		}
		fastForwardInterval = setInterval(() => {
			advanceFastForwardStep()
		}, FAST_FORWARD_INTERVAL_MS)
	}

	function buildStoryFilePath(candidate) {
		const language = settingsStore.general.language || 'ru'
		return `/data/story/${language}/${candidate}.json`
	}
	// UI visibility state
	const isInDialogueMode = ref(false)

	const isDialogueActive = computed(() => {
		return (
			isInDialogueMode.value ||
			!!(
				currentDialogue.value ||
				currentNarration.value ||
				currentTitle.value ||
				(currentChoices.value && currentChoices.value.length > 0) ||
				showTextInputModal.value
			)
		)
	})

	const {
		baseUiVisibility,
		isUiHidden,
		toggleHideUi,
		hideUi,
		unhideUi,
		uiVisibility,
		handleUIStep,
		setDialogueHideUI
	} = useStoryUI({ emit, isDialogueActive, globalData })

	// Variables & Expressions
	const {
		substituteVariables,
		resolveSpeakerTitle,
		updateCharacterData,
		resolvePath,
		applyVariable,
		evaluateCondition,
		getInitialValue
	} = useStoryVariables({
		globalData,
		characterData,
		baseUiVisibility,
		isRestoringGameState,
		notificationComponent,
		rebuildEquipmentBySlot,
		emit
	})

	let loadingPromise = null
	const isLoaded = ref(false)

	// Helpers
	async function loadDataFromPublic(path) {
		if (!path || typeof path !== 'string') return {}
		// Convert .js to .json path
		const jsonPath = path.replace(/\.js$/, '.json')
		try {
			// Use the base path set in index.html for file:// protocol
			// In dev mode, window.__APP_BASE__ will be '/', in production it will be the file path
			const basePath =
				typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			const fullPath = basePath ? basePath + jsonPath.replace(/^\//, '') : jsonPath

			console.log(`📥 Loading: ${fullPath}`)
			const response = await fetch(fullPath)
			if (!response.ok) {
				console.error(`❌ HTTP Error ${response.status}: ${response.statusText}`)
				console.error(`   Full path: ${fullPath}`)
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}
			const data = await response.json()
			console.log(`✅ Loaded successfully`)
			return data
		} catch (jsonError) {
			console.error('Error in loadDataFromPublic:', jsonError)
			console.error(`   Path: ${jsonPath}`)
			console.error(`   Error: ${jsonError.message}`)
			throw new Error(`Data file not found as JSON: ${jsonPath}`)
		}
	}

	function getStoryPathCandidates(requestedStoryPath) {
		const normalized = String(requestedStoryPath || 'start').replace(/^\/*/, '')
		const candidates = [normalized]

		if (!normalized.includes('/')) {
			candidates.push(`macros/${normalized}`)
		} else {
			const baseName = normalized.split('/').pop()
			if (baseName && baseName !== normalized) candidates.push(baseName)
			if (baseName && !normalized.startsWith('macros/')) candidates.push(`macros/${baseName}`)
		}

		return Array.from(new Set(candidates))
	}

	async function loadStory() {
		if (loadingPromise) return loadingPromise
		loadingPromise = (async () => {
			try {
				const storyModule = await loadDataFromPublic(src)
				storyData.value = storyModule
				// Extract path relative to /data/story/<lang>/ for call stack tracking
				const srcMatch = src.match(/\/data\/story\/[^/]+\/(.+)\.json/)
				if (srcMatch) currentStoryPath = srcMatch[1]

				// Load characters (try split format, fallback to legacy file)
				let characterIds = ['mc', 'albedo', 'momonga', 'enri', 'carne-chief']
				try {
					const charRegistry = await loadDataFromPublic('/data/characters/characters.json')
					if (charRegistry && Array.isArray(charRegistry.characters)) {
						characterIds = Array.from(new Set([...characterIds, ...charRegistry.characters]))
					}
				} catch (registryErr) {
					// fallback to default list
				}

				const loadSingleCharacter = async (charId) => {
					try {
						const [valuesData, bodyData, equipmentData] = await Promise.all([
							loadDataFromPublic(`/data/characters/${charId}/values.json`),
							loadDataFromPublic(`/data/characters/${charId}/body.json`),
							loadDataFromPublic(`/data/characters/${charId}/equipment.json`)
						])

						const equipmentBySlot = calculateEquipmentBySlot(
							valuesData.equipment_slots,
							equipmentData
						)

						const mergedCharacter = {
							...valuesData,
							sprites: bodyData,
							equipment: equipmentData,
							equipmentBySlot
						}
						characterData.value[charId] = mergedCharacter
						console.log(`✔ Loaded character ${charId} from split files`)
					} catch (splitFormatError) {
						try {
							const charModule = await loadDataFromPublic(
								`/data/characters/${charId}.json`
							)
							characterData.value[charId] = charModule
							console.log(`✔ Loaded character ${charId} from legacy format`)
						} catch (legacyFormatError) {
							console.warn(
								`✘ Could not load character ${charId} in either format:`,
								splitFormatError,
								legacyFormatError
							)
						}
					}
				}

				await Promise.all(characterIds.map(loadSingleCharacter))

				emit && emit('character-loaded', characterData.value)

				// Set character defaults for save system
				const savesStore = useSavesStore()
				savesStore.setCharacterDefaults(characterData.value)

				// Load NPC schedules
				try {
					const schedulesModule = await loadDataFromPublic('/data/characters/schedules.json')
					useNpcSchedule().loadSchedules(schedulesModule)
				} catch (schedulesErr) {
					console.warn('Could not load schedules.json:', schedulesErr)
				}

				const scenesModule = await loadDataFromPublic('/data/scenes/scenes.json')
				scenesModule.scenes.forEach((scene) => {
					sceneData.value[scene.id] = scene
				})
				useNpcSchedule().loadScenes(scenesModule.scenes)

				isLoaded.value = true
				console.log('✔ All story data loaded, ready to start')
			} catch (error) {
				console.error('Error loading story:', error)
				throw error
			} finally {
				loadingPromise = null
			}
		})()

		return loadingPromise
	}

	function handleAudioStep(step) {
		if (isRestoringGameState.value) return
		switch (step.type) {
			case 'sound':
				if (step.delay && step.delay > 0) {
					scheduleAudio(() => playSound(step), step.delay)
				} else {
					playSound(step)
				}
				break
			case 'voice':
				if (step.delay && step.delay > 0) {
					scheduleAudio(() => playVoice(step), step.delay)
				} else {
					playVoice(step)
				}
				break
			case 'music':
				if (step.delay && step.delay > 0) {
					scheduleAudio(() => playMusic(step), step.delay)
				} else {
					playMusic(step)
				}
				break
			case 'stop-stream':
				stopStream(step.stream)
				break
			case 'stop-all-streams':
				stopAllStreams()
				break
		}
	}

	function handleInventoryRemoveStep(step) {
		if (isRestoringGameState.value || !step.character || !step.itemId) return
		const char = characterData.value[step.character]
		if (char && char.inventory && Array.isArray(char.inventory.items)) {
			const itemQtyToRemove = step.quantity || 1
			let remainingToRemove = itemQtyToRemove
			for (
				let i = char.inventory.items.length - 1;
				i >= 0 && remainingToRemove > 0;
				i--
			) {
				const item = char.inventory.items[i]
				if (item.itemId === step.itemId) {
					const itemQty = item.quantity || 1
					if (itemQty <= remainingToRemove) {
						remainingToRemove -= itemQty
						char.inventory.items.splice(i, 1)
						console.log(
							`📦 Removed ${itemQty}x ${step.itemId} from ${step.character}'s inventory`
						)
					} else {
						item.quantity = itemQty - remainingToRemove
						console.log(
							`📦 Reduced ${step.itemId} quantity by ${remainingToRemove} (now ${item.quantity})`
						)
						remainingToRemove = 0
					}
				}
			}
		}
	}

	function handleInventoryModifyStep(step) {
		if (isRestoringGameState.value || !step.itemId) return
		const charId = step.character || 'mc'
		const char = characterData.value[charId]
		if (!char || !char.inventory || !Array.isArray(char.inventory.items)) return

		let targetItem = null
		if (step.index !== undefined && char.inventory.items[step.index]) {
			targetItem = char.inventory.items[step.index]
		} else {
			targetItem = char.inventory.items.find(
				(item) =>
					item &&
					(item.itemId === step.itemId || item.id === step.itemId)
			)
		}

		if (!targetItem) {
			console.warn(`Item ${step.itemId} not found in ${charId}'s inventory`)
			return
		}

		const propsToRemove = []
		if (step.removeProperty) {
			if (Array.isArray(step.removeProperty)) propsToRemove.push(...step.removeProperty)
			else propsToRemove.push(step.removeProperty)
		}
		if (step.removeProperties && Array.isArray(step.removeProperties)) {
			propsToRemove.push(...step.removeProperties)
		}
		if (step.delete) {
			if (Array.isArray(step.delete)) propsToRemove.push(...step.delete)
			else propsToRemove.push(step.delete)
		}
		if (step.remove) {
			if (Array.isArray(step.remove)) propsToRemove.push(...step.remove)
			else propsToRemove.push(step.remove)
		}
		if (step.action === 'remove' && step.property) {
			propsToRemove.push(step.property)
		}

		for (const prop of propsToRemove) {
			delete targetItem[prop]
			console.log(
				`📦 Removed property "${prop}" from ${step.itemId} in ${charId}'s inventory`
			)
		}

		if (step.property && step.action !== 'remove') {
			targetItem[step.property] = step.value !== undefined ? step.value : true
			console.log(
				`📦 Set property "${step.property}" = ${targetItem[step.property]} on ${step.itemId} in ${charId}'s inventory`
			)
		}

		if (step.properties && typeof step.properties === 'object') {
			Object.assign(targetItem, step.properties)
			console.log(
				`📦 Updated properties on ${step.itemId} in ${charId}'s inventory:`,
				step.properties
			)
		}

		emit && emit('character-loaded', characterData.value)
	}

	function handleInventoryAddStep(step) {
		if (isRestoringGameState.value || !step.character || !step.itemId) return
		const char = characterData.value[step.character]
		if (char && char.inventory && Array.isArray(char.inventory.items)) {
			const itemQtyToAdd = step.quantity || 1
			const existingIndex = char.inventory.items.findIndex(
				(item) => item.itemId === step.itemId
			)
			if (existingIndex !== -1) {
				const existing = char.inventory.items[existingIndex]
				existing.quantity = (existing.quantity || 1) + itemQtyToAdd
				console.log(
					`📦 Added ${itemQtyToAdd}x ${step.itemId} to ${step.character}'s inventory (new qty: ${existing.quantity})`
				)
			} else {
				char.inventory.items.push({
					itemId: step.itemId,
					quantity: itemQtyToAdd
				})
				console.log(
					`📦 Added new item ${itemQtyToAdd}x ${step.itemId} to ${step.character}'s inventory`
				)
			}
		}
	}

	function handleInventoryResetStep(step) {
		if (isRestoringGameState.value) return
		const charId = step.character || 'mc'
		const char = characterData.value[charId]
		if (!char) return

		if (step.equipment_slots) {
			char.equipment_slots = { ...char.equipment_slots, ...step.equipment_slots }
		}
		if (step.inventory && Array.isArray(step.inventory)) {
			char.inventory = { items: [...step.inventory] }
		} else if (step.items && Array.isArray(step.items)) {
			char.inventory = { items: [...step.items] }
		}
		rebuildEquipmentBySlot(charId)
		const visIndex = visibleCharacters.value.findIndex((c) => c.id === charId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = { ...char }
		}
		emit && emit('character-loaded', characterData.value)
		console.log(`📦 [Inventory Reset] Successfully reset inventory & equipment for ${charId}`)
	}

	function handleQuestStep(step) {
		const questId = step.questId || step.id
		if (isRestoringGameState.value || !questId) return
		const questsManager = useQuests()
		if (step.action === 'complete') {
			questsManager.completeQuest(questId)
			if (notificationComponent.value) {
				const q = questsManager.getQuest(questId)
				const title = q?.title || step.title || questId
				notificationComponent.value.showNotification(
					`<p><b>🏆 Задание выполнено</b></p><p>${title}</p>`,
					'success',
					3500
				)
			}
		} else if (step.action === 'fail') {
			questsManager.failQuest(questId)
			if (notificationComponent.value) {
				const q = questsManager.getQuest(questId)
				const title = q?.title || step.title || questId
				notificationComponent.value.showNotification(
					`<p><b>❌ Задание провалено</b></p><p>${title}</p>`,
					'warning',
					3500
				)
			}
		} else if (step.action === 'task-complete' || step.action === 'complete-task') {
			const task = questsManager.completeTask(questId, step.taskId)
			if (notificationComponent.value && task) {
				notificationComponent.value.showNotification(
					`<p><b>🎯 Задача выполнена</b></p><p>${task.text}</p>`,
					'info',
					3000
				)
			}
		} else if (step.action === 'add-story-entry' || step.action === 'story-entry') {
			const entry = step.text || step.entry
			questsManager.addQuestStoryEntry(questId, entry)
			if (notificationComponent.value && entry) {
				notificationComponent.value.showNotification(
					`<p><b>📖 Журнал обновлен</b></p><p>${entry}</p>`,
					'info',
					3000
				)
			}
		} else {
			// Default is 'start'
			const newQ = questsManager.startQuest({
				id: questId,
				parentId: step.parentId,
				title: step.title,
				description: step.description,
				category: step.category,
				target: step.target,
				tasks: step.tasks || [],
				storyEntries: step.storyEntries || []
			})
			if (notificationComponent.value && newQ) {
				notificationComponent.value.showNotification(
					`<p><b>📜 Новое задание</b></p><p>${newQ.title}</p>`,
					'info',
					3500
				)
			}
		}
	}

	function handleDiscoverLocationStep(step) {
		if (isRestoringGameState.value) return
		const isDiscoverAction =
			!step.action || step.action === 'discover' || step.action === 'add'
		if (isDiscoverAction) {
			const targetMap =
				step.map ||
				step.localMap ||
				globalData.value.localMap ||
				globalData.value.currentMap ||
				'current'
			const locs = step.location || step.locations || step.locationId
			discoverLocation(targetMap, locs, {
				title: step.title,
				notification: step.notification || step.text,
				notify: step.notify,
				duration: step.duration
			})
		}
	}

	function handleMapStep(step) {
		if (isRestoringGameState.value) return
		if (step.worldMap || step.globalMap) {
			globalData.value.worldMap = step.worldMap || step.globalMap
		}
		if (step.localMap || step.map || step.currentMap) {
			const lMap = step.localMap || step.map || step.currentMap
			globalData.value.localMap = lMap
			globalData.value.currentMap = lMap
			settingsStore.setCurrentMap(lMap)
		}
		if (step.locationId || step.location) {
			globalData.value.currentLocation = step.locationId || step.location
		}
		if (step.discover || step.discoverLocation) {
			const targetMap =
				step.localMap ||
				step.map ||
				step.currentMap ||
				globalData.value.localMap ||
				globalData.value.currentMap
			discoverLocation(targetMap, step.discover || step.discoverLocation, {
				title: step.discoverTitle || step.title,
				notification: step.discoverNotification || step.notification,
				notify: step.notify
			})
		}
	}

	function handleNpcStep(step) {
		if (isRestoringGameState.value) return
		const npcSchedule = useNpcSchedule()
		const charId = step.character || step.characterId || step.id
		const action = step.action || 'set-state'
		if (action === 'set-state' || step.state !== undefined) {
			npcSchedule.setNpcState(charId, step.state)
		} else if (
			action === 'override' ||
			action === 'override-location' ||
			action === 'set-location'
		) {
			npcSchedule.overrideNpcLocation(charId, {
				scene: step.scene || step.targetScene || step.target,
				position: step.position,
				orientation: step.orientation,
				scale: step.scale,
				customClass: step.class || step.customClass
			})
		} else if (action === 'clear-override' || action === 'reset-location') {
			npcSchedule.clearNpcOverride(charId)
		} else if (action === 'set-known' || action === 'discover-location') {
			npcSchedule.setNpcLocationKnown(charId, step.known !== false)
		}
		// If on current scene, refresh visible characters
		if (currentScene.value?.id) {
			npcSchedule.refreshSceneNpcs(
				currentScene.value.id,
				{
					globalData: globalData.value,
					characterData: characterData.value,
					questsManager: useQuests()
				},
				visibleCharacters,
				characterData
			)
		}
	}

	function processStep() {
		if (!storyData.value || stepIndex.value >= storyData.value.steps.length) {
			isInDialogueMode.value = false
			clearDialogueHiding()
			emit && emit('end')
			return
		}

		const step = storyData.value.steps[stepIndex.value]

		// Conditional step execution
		if (step.if !== undefined && !evaluateCondition(step.if)) {
			stepIndex.value++
			processStep()
			return
		}
		if (step.condition !== undefined && !evaluateCondition(step.condition)) {
			stepIndex.value++
			processStep()
			return
		}

		if (!step.type && step.variable) {
			applyVariable(step.variable)
			// Optional one-shot sound for variable-only steps
			if (step.sound) {
				playVariableStepSound(step.sound)
			}
			stepIndex.value++
			processStep()
			return
		}

		try {
			switch (step.type) {
				case 'scene':
					if (!isRestoringGameState.value) {
						const nextSceneKey =
							typeof step === 'object'
								? step.scene || step.sceneId || step.id
								: step
						const hasExplicitFade =
							step.fade === false ||
							fadeOverlay.value.visible ||
							(storyData.value?.steps &&
								((stepIndex.value > 0 &&
									['fade', 'fade-out'].includes(
										storyData.value.steps[stepIndex.value - 1]?.type
									)) ||
									(stepIndex.value < storyData.value.steps.length - 1 &&
										['fade', 'fade-in'].includes(
											storyData.value.steps[stepIndex.value + 1]?.type
										))))

						const transitionDuration =
							typeof step.fade === 'number' && step.fade > 0 ? step.fade : 0.35

						if (
							isSceneTransitionsEnabled() &&
							currentScene.value &&
							currentScene.value.id !== nextSceneKey &&
							!hasExplicitFade
						) {
							performSceneTransition(
								() => changeScene(step),
								() => {
									stepIndex.value++
									processStep()
								},
								transitionDuration
							)
							break
						}

						changeScene(step)
					}
					stepIndex.value++
					processStep()
					break
				case 'show':
					if (!isRestoringGameState.value) showCharacter(step)
					stepIndex.value++
					processStep()
					break
				case 'hide':
					if (!isRestoringGameState.value) hideCharacter(step)
					stepIndex.value++
					processStep()
					break
				case 'hide-all':
				case 'clear-characters':
					if (!isRestoringGameState.value) {
						visibleCharacters.value = []
					}
					stepIndex.value++
					processStep()
					break
				case 'part-animate':
					if (!isRestoringGameState.value) animateCharacterPart(step)
					stepIndex.value++
					processStep()
					break
				case 'sound':
				case 'voice':
				case 'music':
				case 'stop-stream':
				case 'stop-all-streams':
					handleAudioStep(step)
					stepIndex.value++
					processStep()
					break
				case 'inventory-remove':
					handleInventoryRemoveStep(step)
					stepIndex.value++
					processStep()
					break
				case 'inventory-item-update':
				case 'inventory-item-modify':
				case 'inventory-item-property':
				case 'item-property':
				case 'item-modify':
					handleInventoryModifyStep(step)
					stepIndex.value++
					processStep()
					break
				case 'goto': {
					const target = step.target || step.id || step.label || step.step
					if (step.delay) {
						setTimeout(() => goToLabel(target), step.delay * 1000)
					} else {
						goToLabel(target)
					}
					break
				}
				case 'inventory-add':
					handleInventoryAddStep(step)
					stepIndex.value++
					processStep()
					break
				case 'notification':
					// Show notification: { text: "...", notificationType: "info|success|warning|error", duration: 3000 }
					if (!isRestoringGameState.value && notificationComponent.value && step.text) {
						const html = substituteVariables(step.text)
						const notificationType = step.notificationType || 'info'
						const duration = step.duration || 3000
						notificationComponent.value.showNotification(
							html,
							notificationType,
							duration
						)
						console.log(`📢 Notification: ${html}`)
					}
					stepIndex.value++
					processStep()
					break
				case 'inventory-reset':
				case 'character-reset-inventory':
					handleInventoryResetStep(step)
					stepIndex.value++
					processStep()
					break
				case 'quest':
					handleQuestStep(step)
					stepIndex.value++
					processStep()
					break
				case 'journal':
				case 'encyclopedia':
					handleJournalStep(step)
					stepIndex.value++
					processStep()
					break
				case 'dialogue':
					if (step.variable) applyVariable(step.variable)
					// Check if dialogue has steps
					if (step.steps && Array.isArray(step.steps)) {
						processDialogueSteps(
							step.steps,
							step.character,
							step.title || step.speaker
						)
					} else if (step.character) {
						showDialogue(step.character, step.text, step.title || step.speaker)
					} else if (step.title || step.speaker) {
						showDialogue(null, step.text, step.title || step.speaker)
					} else {
						showNarration(step.text)
					}
					isRestoringGameState.value = false
					break
				case 'titles':
					if (isRestoringGameState.value) {
						stepIndex.value++
						processStep()
						break
					}
					if (step.variable) applyVariable(step.variable)
					showTitle(step)
					isRestoringGameState.value = false
					break
				case 'inputtext':
					showTextInput(step)
					isRestoringGameState.value = false
					break
				case 'choice':
					showChoices(step)
					isRestoringGameState.value = false
					break
				case 'ui':
					handleUIStep(step)
					stepIndex.value++
					processStep()
					break
				case 'fade':
				case 'fade-in':
				case 'fade-out':
					handleFadeStep(step)
					break
				case 'discover-location':
				case 'discover-marker':
				case 'map-marker':
					handleDiscoverLocationStep(step)
					stepIndex.value++
					processStep()
					break
				case 'map':
					handleMapStep(step)
					stepIndex.value++
					processStep()
					break
				case 'hotspot':
				case 'scene-hotspot':
				case 'unlock-hotspot':
				case 'lock-hotspot':
				case 'hide-hotspot':
				case 'show-hotspot':
					if (!isRestoringGameState.value) {
						handleHotspotStep(step)
					}
					stepIndex.value++
					processStep()
					break
				case 'npc':
				case 'npc-state':
				case 'npc-schedule':
					handleNpcStep(step)
					stepIndex.value++
					processStep()
					break
				case 'hold':
					// Keep the current scene/dialogue visible and do not advance further.
					// Use this at the end of a story to prevent the engine from emitting `end`.
					isInDialogueMode.value = false
					return
				case 'continue':
					handleContinue()
					break
				case 'end':
					// 'end' always terminates the game regardless of call stack.
					// Use 'continue' to return from a macro/sub-story to the caller.
					isInDialogueMode.value = false
					isRestoringGameState.value = false
					callStack.value = []
					if (step.delay) {
						setTimeout(() => {
							emit && emit('end')
						}, step.delay * 1000)
					} else {
						emit && emit('end')
					}
					break
				default:
					stepIndex.value++
					processStep()
					break
			}
		} catch (error) {
			console.error('Error processing step:', error)
		}
	}

	function handleJournalStep(step) {
		if (!step || typeof step !== 'object') return
		const enc = useEncyclopedia()
		const target = step.target || (step.category ? 'encyclopedia' : 'character')
		const action =
			step.action || (target === 'character' ? 'add-character' : 'add-entry')

		if (action === 'add-character' || action === 'character') {
			const char = enc.addCharacter({
				id: step.id || step.character,
				name: step.name,
				surname: step.surname,
				title: step.title,
				avatar: step.avatar,
				sympVariable: step.sympVariable,
				titleVariable: step.titleVariable,
				defaultTitle: step.defaultTitle,
				blocks: step.blocks || []
			})
			if (!step.silent && notificationComponent?.value && char && !isRestoringGameState.value) {
				notificationComponent.value.showNotification(
					`<p><b>👤 Новый персонаж в журнале</b></p><p>${char.title || char.name}</p>`,
					'info',
					3000
				)
			}
		} else if (action === 'add-entry' || action === 'entry' || action === 'add-encyclopedia') {
			const entry = enc.addEncyclopediaEntry({
				id: step.id || step.entryId,
				category: step.category,
				subCategory: step.subCategory,
				title: step.title,
				icon: step.icon,
				image: step.image,
				blocks: step.blocks || []
			})
			if (!step.silent && notificationComponent?.value && entry && !isRestoringGameState.value) {
				notificationComponent.value.showNotification(
					`<p><b>📖 Новая статья энциклопедии</b></p><p>${entry.title}</p>`,
					'info',
					3000
				)
			}
		} else if (action === 'set-block' || action === 'update-block' || action === 'add-block') {
			enc.setBlock({
				target: step.target,
				id: step.id || step.entryId || step.character,
				blockId: step.blockId,
				title: step.blockTitle || step.title,
				text: step.text
			})
			if (!step.silent && notificationComponent?.value && !isRestoringGameState.value) {
				notificationComponent.value.showNotification(
					`<p><b>📖 Журнал обновлён</b></p><p>${step.blockTitle || step.title || step.id}</p>`,
					'info',
					2500
				)
			}
		} else if (action === 'remove-block') {
			enc.removeBlock({
				target: step.target,
				id: step.id || step.entryId || step.character,
				blockId: step.blockId
			})
		}
	}

	function changeScene(sceneIdOrStep) {
		const sceneKey =
			typeof sceneIdOrStep === 'object'
				? sceneIdOrStep.scene || sceneIdOrStep.sceneId || sceneIdOrStep.id
				: sceneIdOrStep
		const scene = sceneData.value[sceneKey]
		if (!scene) {
			console.warn('Scene not found:', sceneIdOrStep)
			return
		}
		const mods = typeof sceneIdOrStep === 'object' ? sceneIdOrStep.mods || [] : scene.mods || []
		currentScene.value = { ...scene, mods }

		// Очистка персонажей со сцены при смене локации (если указано в шаге или в описании сцены)
		const clearParam =
			typeof sceneIdOrStep === 'object' &&
			(sceneIdOrStep.clearCharacters !== undefined ||
				sceneIdOrStep.clear !== undefined ||
				sceneIdOrStep.hideCharacters !== undefined)
				? (sceneIdOrStep.clearCharacters ?? sceneIdOrStep.clear ?? sceneIdOrStep.hideCharacters)
				: (scene.clearCharacters ?? scene.clear ?? scene.hideCharacters)

		if (clearParam === true || clearParam === 'all') {
			visibleCharacters.value = []
			console.log('🧹 [changeScene] Cleared all visible characters from screen')
		} else if (Array.isArray(clearParam)) {
			visibleCharacters.value = visibleCharacters.value.filter(
				(c) => !clearParam.includes(c.id)
			)
			console.log(`🧹 [changeScene] Cleared characters [${clearParam.join(', ')}] from screen`)
		} else if (typeof clearParam === 'string') {
			visibleCharacters.value = visibleCharacters.value.filter(
				(c) => c.id !== clearParam
			)
			console.log(`🧹 [changeScene] Cleared character "${clearParam}" from screen`)
		}

		// Автоматическое наполнение сцены персонажами по расписанию (NPC Schedule)
		const suppressSchedule =
			typeof sceneIdOrStep === 'object' &&
			(sceneIdOrStep.populateNpcs === false || sceneIdOrStep.autoPopulate === false)
		if (!suppressSchedule && !isRestoringGameState.value) {
			useNpcSchedule().populateSceneCharacters(
				sceneKey,
				{
					globalData: globalData.value,
					characterData: characterData.value,
					questsManager: useQuests()
				},
				visibleCharacters,
				characterData
			)
		}

		// Apply scene-level variables if specified in scene definition or step
		const sceneVars =
			scene.variables ||
			scene.variable ||
			(typeof sceneIdOrStep === 'object'
				? sceneIdOrStep.variables || sceneIdOrStep.variable
				: null)
		if (sceneVars) {
			if (Array.isArray(sceneVars)) {
				sceneVars.forEach((v) => applyVariable(v))
			} else if (typeof sceneVars === 'string') {
				applyVariable(sceneVars)
			} else if (typeof sceneVars === 'object') {
				for (const [key, val] of Object.entries(sceneVars)) {
					const formattedVal = typeof val === 'string' ? `'${val}'` : val
					applyVariable(`${key} = ${formattedVal}`)
				}
			}
		}

		// Автоматическое определение карт и локации (Skyrim-style: World Map & Local Map)
		const stepObj = typeof sceneIdOrStep === 'object' ? sceneIdOrStep : {}
		const isNewWorld =
			globalData.value.calendarType === 'new_world' || globalData.value.year === 0
		const targetWorldMap =
			stepObj.worldMap ||
			scene.worldMap ||
			stepObj.globalMap ||
			scene.globalMap ||
			(isNewWorld ? 'newworld' : 'cybercity')

		const targetLocalMap =
			stepObj.localMap ||
			scene.localMap ||
			stepObj.map ||
			scene.map ||
			(targetWorldMap === 'newworld' &&
			((scene.id && scene.id.startsWith('carne')) ||
				(stepObj.id && stepObj.id.startsWith('carne')) ||
				(stepObj.scene && stepObj.scene.startsWith('carne')))
				? 'carne'
				: targetWorldMap)

		const targetLocationId =
			stepObj.locationId ||
			scene.locationId ||
			stepObj.location ||
			scene.location ||
			null

		if (targetWorldMap) {
			globalData.value.worldMap = targetWorldMap
		}
		if (targetLocalMap) {
			globalData.value.localMap = targetLocalMap
			globalData.value.currentMap = targetLocalMap
			settingsStore.setCurrentMap(targetLocalMap)
		}
		if (targetLocationId) {
			globalData.value.currentLocation = targetLocationId
		}
	}

	function applyDialogueHiding() {
		// Handled reactively via computed uiVisibility
	}

	function clearDialogueHiding() {
		// Handled reactively via computed uiVisibility
	}

	function showDialogue(characterId, text, explicitTitle = null) {
		isInDialogueMode.value = true
		currentSpeaker.value = resolveSpeakerTitle(characterId, explicitTitle)
		currentNarration.value = ''
		currentDialogue.value = substituteVariables(text)
		addToHistory({
			type: 'dialogue',
			speaker: currentSpeaker.value,
			text: currentDialogue.value,
			stepIndex: stepIndex.value
		})
		applyDialogueHiding()
	}

	function showNarration(text) {
		isInDialogueMode.value = true
		currentNarration.value = substituteVariables(text)
		currentSpeaker.value = ''
		currentDialogue.value = ''
		addToHistory({
			type: 'narration',
			speaker: '',
			text: currentNarration.value,
			stepIndex: stepIndex.value
		})
		applyDialogueHiding()
	}

	function showTitle(step) {
		isInDialogueMode.value = true
		if (titleTimeout) {
			clearTimeout(titleTimeout)
			titleTimeout = null
		}
		let titleText = substituteVariables(step.text)
		let titleTextForDisplay = titleText

		// Apply wrap if provided
		if (step.wrap) {
			titleTextForDisplay = step.wrap.replace('%text%', titleText)
		}

		currentTitle.value = titleTextForDisplay
		currentTitleEffects.value = {
			effectStart: step['effect-start'] || null,
			effect: step.effect || null,
			effectEnd: step['effect-end'] || null,
			typewriter: step.typewriter || false,
			duration: (step.duration || 0) * 1000, // Convert seconds to milliseconds
			class: step.class || null,
			autoEnd: step['auto-end'] || false
		}
		currentDialogue.value = ''
		currentNarration.value = ''
		currentSpeaker.value = ''
		currentChoices.value = []
		addToHistory({ type: 'titles', speaker: '', text: titleText, stepIndex: stepIndex.value })
		applyDialogueHiding()
		if (step.duration && typeof step.duration === 'number' && step.duration > 0) {
			titleTimeout = setTimeout(() => {
				titleTimeout = null
				// If there's an effect-end, trigger it on the component and let it handle the advance
				if (step['effect-end']) {
					// Signal to TitleBlock to play effect-end by setting a flag
					currentTitleEffects.value = {
						...currentTitleEffects.value,
						triggerEffectEnd: true
					}
				} else {
					advanceStory()
				}
			}, step.duration * 1000) // Convert seconds to milliseconds
		}
	}

	function showTextInput(step) {
		isInDialogueMode.value = true
		currentDialogue.value = ''
		currentNarration.value = ''
		currentSpeaker.value = ''
		currentChoices.value = []
		currentInputStep.value = step
		showTextInputModal.value = true
	}

	function onTextInputConfirm(value) {
		if (currentInputStep.value?.variable)
			updateCharacterData(currentInputStep.value.variable, value)
		showTextInputModal.value = false
		currentInputStep.value = null
		stepIndex.value++
		processStep()
	}

	function showChoices(choiceStep) {
		isInDialogueMode.value = true
		advanceStoryOverride = null
		const filteredOptions = (choiceStep.options || []).filter((option) => {
			if (option.if !== undefined) return evaluateCondition(option.if)
			if (option.condition !== undefined) return evaluateCondition(option.condition)
			return true
		})
		currentChoices.value = filteredOptions.map((option) => ({
			...option,
			text: substituteVariables(option.text),
			disabled: option.disabled ? evaluateCondition(option.disabled) : false
		}))
		currentSpeaker.value = resolveSpeakerTitle(
			choiceStep.speaker || choiceStep.character,
			choiceStep.title
		)
		const layout = choiceStep.layout || choiceStep.position || 'center'
		currentChoicesLayout.value =
			layout === 'dialogue' || layout === 'bottom' ? 'dialogue' : 'center'
		if (choiceStep.text) currentDialogue.value = substituteVariables(choiceStep.text)
		applyDialogueHiding()
	}

	function processDialogueSteps(steps, parentCharacter = null, parentTitle = null) {
		let tempIndex = 0
		function processDialogueAction() {
			if (tempIndex >= steps.length) {
				multiStepDialogueBuffer.value = ''
				multiStepPrintedLength.value = 0
				stepIndex.value++
				processStep()
				return
			}
			const action = steps[tempIndex]
			tempIndex++
			const actionType = action.type || (action.text ? 'text' : 'unknown')
			switch (actionType) {
				case 'text':
				case 'dialogue':
					currentChoices.value = []
					// Add text to buffer with line break if needed
					if (multiStepDialogueBuffer.value) {
						multiStepDialogueBuffer.value += ''
					}
					multiStepDialogueBuffer.value += action.text
					// Use character and title from action, or fallback to parent
					const characterForStep = action.character || parentCharacter
					const titleForStep = action.title || action.speaker || parentTitle
					if (characterForStep || titleForStep)
						showDialogue(characterForStep, multiStepDialogueBuffer.value, titleForStep)
					else showNarration(multiStepDialogueBuffer.value)
					advanceStoryOverride = function () {
						// When advancing, calculate how many plain text chars have been printed
						const plainText = multiStepDialogueBuffer.value
							? multiStepDialogueBuffer.value.replace(/<[^>]*>/g, '')
							: ''
						const plainTextLength = plainText.length
						multiStepPrintedLength.value = plainTextLength
						console.log(
							`📝 Multi-step advance: buffer length=${multiStepDialogueBuffer.value.length}, plain text length=${plainTextLength}`
						)
						currentDialogue.value = ''
						currentNarration.value = ''
						processDialogueAction()
					}
					break
				case 'action':
					// Execute action and continue to next dialogue step
					if (action.action) {
						console.log(`Executing action: ${action.action}`)
						// Here you can add action handlers if needed
					}
					processDialogueAction()
					break
				default:
					processDialogueAction()
					break
			}
		}
		processDialogueAction()
	}

	function selectChoice(index) {
		const choice = currentChoices.value[index]
		if (!choice || choice.disabled) return // Prevent selecting disabled choices
		currentChoices.value = []
		currentChoicesLayout.value = 'center'
		if (choice.variable) {
			applyVariable(choice.variable)
		}
		if (choice.actions && choice.actions.length > 0) {
			processChoiceActions(choice.actions)
		} else {
			currentDialogue.value = ''
			currentNarration.value = ''
			stepIndex.value++
			processStep()
		}
	}

	function processChoiceActions(actions) {
		let actionIndex = 0

		function runNextAction() {
			if (actionIndex >= actions.length) {
				advanceStoryOverride = null
				stepIndex.value++
				processStep()
				return
			}

			const action = actions[actionIndex++]

			switch (action.type) {
				case 'dialogue':
					currentChoices.value = []
					if (action.character) {
						showDialogue(action.character, action.text, action.title || action.speaker)
					} else if (action.title || action.speaker) {
						showDialogue(null, action.text, action.title || action.speaker)
					} else {
						showNarration(action.text)
					}
					advanceStoryOverride = function () {
						currentDialogue.value = ''
						currentNarration.value = ''
						runNextAction()
					}
					break

				case 'goto': {
					advanceStoryOverride = null
					currentDialogue.value = ''
					currentNarration.value = ''
					currentSpeaker.value = ''
					currentChoices.value = []
					const targetLabel = action.target || action.id || action.label || action.step
					goToLabel(targetLabel)
					break
				}

				case 'show':
					showCharacter(action)
					runNextAction()
					break

				case 'hide':
					hideCharacter(action.character)
					runNextAction()
					break

				case 'variable':
					if (action.variable) applyVariable(action.variable)
					runNextAction()
					break

				case 'journal':
				case 'encyclopedia':
					handleJournalStep(action)
					runNextAction()
					break

				case 'hotspot':
				case 'scene-hotspot':
				case 'unlock-hotspot':
				case 'lock-hotspot':
				case 'hide-hotspot':
				case 'show-hotspot':
					handleHotspotStep(action)
					runNextAction()
					break

				default:
					if (action.text) {
						currentChoices.value = []
						if (action.character) {
							showDialogue(action.character, action.text, action.title || action.speaker)
						} else if (action.title || action.speaker) {
							showDialogue(null, action.text, action.title || action.speaker)
						} else {
							showNarration(action.text)
						}
						advanceStoryOverride = function () {
							currentDialogue.value = ''
							currentNarration.value = ''
							runNextAction()
						}
					} else {
						if (action.variable) applyVariable(action.variable)
						runNextAction()
					}
					break
			}
		}

		runNextAction()
	}

	function goToLabel(targetLabel, targetStepId = null) {
		let storyTarget = targetLabel
		let stepTarget = targetStepId

		if (typeof targetLabel === 'string' && targetLabel.includes('#')) {
			const [storyPart, stepPart] = targetLabel.split('#')
			storyTarget = storyPart
			stepTarget = stepPart
		}

		const checkTarget = stepTarget || storyTarget
		const targetStepIndex = storyData.value?.steps
			? storyData.value.steps.findIndex(
					(step) =>
						step.id === checkTarget ||
						step.label === checkTarget ||
						step.name === checkTarget
			  )
			: -1
		if (targetStepIndex !== -1 && (!stepTarget || currentStoryPath === storyTarget)) {
			// Goto внутри текущей истории - очищаем диалоги и сбрасываем override
			advanceStoryOverride = null
			currentDialogue.value = ''
			currentNarration.value = ''
			currentSpeaker.value = ''
			currentChoices.value = []
			stepIndex.value = targetStepIndex
			processStep()
			return Promise.resolve()
		}

		// Direct scene navigation: if target is a registered scene in sceneData (scenes.json)
		if (!stepTarget && sceneData.value && sceneData.value[checkTarget]) {
			advanceStoryOverride = null
			currentDialogue.value = ''
			currentNarration.value = ''
			currentSpeaker.value = ''
			currentChoices.value = []
			if (
				isSceneTransitionsEnabled() &&
				currentScene.value &&
				currentScene.value.id !== checkTarget &&
				!isRestoringGameState.value &&
				!fadeOverlay.value.visible
			) {
				return performSceneTransition(() => {
					changeScene(checkTarget)
				})
			}
			changeScene(checkTarget)
			return Promise.resolve()
		}

		// Handle legacy new_world_carne alias directly
		if (storyTarget === 'new_world_carne') {
			storyTarget = 'intro'
			stepTarget = stepTarget || 'intro_carne_arrival'
		}

		// Goto на другую историю - сохраняем позицию для return и загружаем новую историю
		// Save the FULL PATH used to load the current story (not the JSON id field)
		callStack.value.push({ storyId: currentStoryPath, stepIndex: stepIndex.value + 1 })
		// НЕ очищаем диалоги при переходе на другую историю, чтобы избежать мерцания
		return loadTargetStory(storyTarget).then(() => {
			if (stepTarget && storyData.value?.steps) {
				const loadedStepIndex = storyData.value.steps.findIndex(
					(step) =>
						step.id === stepTarget ||
						step.label === stepTarget ||
						step.name === stepTarget
				)
				if (loadedStepIndex !== -1) {
					advanceStoryOverride = null
					currentDialogue.value = ''
					currentNarration.value = ''
					currentSpeaker.value = ''
					currentChoices.value = []
					stepIndex.value = loadedStepIndex
					processStep()
				}
			}
		})
	}

	function handleContinue() {
		if (callStack.value.length > 0) {
			const returnPosition = callStack.value.pop()
			// Очищаем диалоги при возврате из макроса/подстории
			currentDialogue.value = ''
			currentNarration.value = ''
			currentSpeaker.value = ''
			currentChoices.value = []
			loadReturnStory(returnPosition.storyId, returnPosition.stepIndex)
		} else {
			clearDialogueHiding()
			emit && emit('end')
		}
	}

	async function _loadStoryFile(storyName, { startStep = 0, isReturn = false } = {}) {
		const storyLoadSession = restoreSessionId
		const label = isReturn ? 'return story' : 'target story'
		try {
			// Сохраняем состояние персонажа И глобальные данные перед загрузкой новой истории
			const savedCharacterState = characterData.value?.mc
				? { ...characterData.value.mc }
				: null
			const savedGlobalData = { ...globalData.value }
			console.log(`💾 Saving state before loading ${label}:`, {
				mask: savedCharacterState?.equipment_slots?.mask,
				globalData: savedGlobalData
			})

			const storyCandidates = getStoryPathCandidates(storyName)
			let module = null
			let loadError = null
			for (const candidate of storyCandidates) {
				if (storyLoadSession !== restoreSessionId) {
					console.log(
						`✋ Aborting stale ${label} before candidate load: ${candidate}`
					)
					return
				}
				try {
					module = await loadDataFromPublic(buildStoryFilePath(candidate))
					if (storyLoadSession !== restoreSessionId) {
						console.log(
							`✋ Aborting stale ${label} after candidate load: ${candidate}`
						)
						return
					}
					currentStoryPath = candidate
					break
				} catch (err) {
					loadError = err
					console.warn(`Failed to load ${label} candidate: ${candidate}`, err)
				}
			}
			if (!module) {
				throw loadError || new Error(`Unable to load ${label}: ${storyName}`)
			}
			storyData.value = module
			stepIndex.value = startStep

			// Восстанавливаем состояние персонажа и глобальные данные
			if (savedCharacterState && characterData.value?.mc) {
				characterData.value.mc.equipment_slots = savedCharacterState.equipment_slots
				rebuildEquipmentBySlot('mc')
			}
			// Восстанавливаем глобальные переменные
			Object.assign(globalData.value, savedGlobalData)

			console.log(`♻️ Restored state after ${label} load:`, {
				mask: characterData.value.mc?.equipment_slots?.mask,
				globalData: globalData.value
			})

			// Эмитим событие чтобы Game.vue узнал об обновлении
			if (emit) {
				console.log('📤 Emitting character-loaded after story transition')
				emit('character-loaded', characterData.value)
				emit('global-data-changed', globalData.value)
			}

			// Small delay to ensure smooth transition without dialog flicker
			await new Promise((resolve) => setTimeout(resolve, 10))
			if (storyLoadSession !== restoreSessionId) {
				console.log(`✋ Aborting stale ${label} before processStep`)
				return
			}
			isRestoringGameState.value = false
			processStep()
		} catch (error) {
			console.error(`Error loading ${label}:`, error)
			emit && emit('end')
		}
	}

	async function loadTargetStory(storyName) {
		return _loadStoryFile(storyName, { startStep: 0, isReturn: false })
	}

	async function loadReturnStory(storyName, returnStepIndex) {
		return _loadStoryFile(storyName, { startStep: returnStepIndex, isReturn: true })
	}

	function advanceStory() {
		if (currentChoices.value && currentChoices.value.length > 0) {
			return
		}
		if (advanceStoryOverride) {
			const f = advanceStoryOverride
			advanceStoryOverride = null
			try {
				f()
			} catch (e) {
				console.error('Error in override:', e)
				currentDialogue.value = ''
				currentNarration.value = ''
				multiStepDialogueBuffer.value = ''
				multiStepPrintedLength.value = 0
				stepIndex.value++
				processStep()
			}
			return
		}
		currentTitle.value = ''
		currentTitleEffects.value = null
		if (titleTimeout) {
			clearTimeout(titleTimeout)
			titleTimeout = null
		}
		currentDialogue.value = ''
		currentNarration.value = ''
		multiStepDialogueBuffer.value = ''
		multiStepPrintedLength.value = 0
		isRestoringGameState.value = false
		stepIndex.value++
		processStep()
	}

	function getGameState() {
		return saveManager.serializeGameStateSnapshot({
			storyData: storyData.value,
			storyPath: currentStoryPath,
			stepIndex: stepIndex.value,
			callStack: callStack.value,
			globalData: globalData.value,
			characterData: characterData.value,
			visibleCharacters: visibleCharacters.value,
			currentScene: currentScene.value,
			historyEntries: historyEntries.value,
			audioStreams: audioStreams.value,
			baseUiVisibility: baseUiVisibility.value
		})
	}

	async function restoreGameState(saveData) {
		try {
			if (!isLoaded.value) {
				if (loadingPromise) await loadingPromise
				else if (src) {
					try {
						await loadStory()
					} catch (e) {
						console.warn('loadStory warning during restoreGameState:', e)
					}
				} else {
					isLoaded.value = true
				}
			}
			const restoreSession = ++restoreSessionId
			stopFastForward()
			// Clear any active UI state from the previous story run before restoring
			if (titleTimeout) {
				clearTimeout(titleTimeout)
				titleTimeout = null
			}
			showTextInputModal.value = false
			currentInputStep.value = null
			currentDialogue.value = ''
			currentNarration.value = ''
			currentSpeaker.value = ''
			currentChoices.value = []
			advanceStoryOverride = null
			isRestoringGameState.value = true

			const requestedStoryPath = saveData.storyPath || saveData.storyId || 'start'
			const storyCandidates = getStoryPathCandidates(requestedStoryPath)
			let loadedStory = null
			let loadError = null
			for (const candidate of storyCandidates) {
				try {
					loadedStory = await loadDataFromPublic(buildStoryFilePath(candidate))
					currentStoryPath = candidate
					console.log(`✔ Loaded story from save using candidate: ${candidate}`)
					break
				} catch (err) {
					loadError = err
					console.warn(`Failed to load story candidate from save: ${candidate}`, err)
				}
			}
			if (!loadedStory) {
				if (saveData.storyData) {
					loadedStory = saveData.storyData
				} else if (storyData.value) {
					loadedStory = storyData.value
				} else {
					loadedStory = { id: requestedStoryPath, steps: [] }
				}
			}
			storyData.value = loadedStory
			stepIndex.value = saveData.stepIndex || 0

			saveManager.applyRestoredState(saveData, {
				globalData,
				characterData,
				visibleCharacters,
				currentScene,
				sceneData,
				baseUiVisibility,
				callStack,
				audioStreams,
				historyEntries,
				rebuildEquipmentBySlot,
				resolveSpeakerTitle,
				substituteVariables,
				HISTORY_MAX,
				storySteps: storyData.value?.steps || [],
				emit
			})

			clearFadeTimeouts()
			clearPendingAudio()
			isUiHidden.value = false
			fadeOverlay.value = {
				visible: false,
				opacity: 0,
				duration: 0,
				color: '#000000'
			}

			isRestoringGameState.value = false
			processStep()
		} catch (error) {
			console.error('Error restoring game state:', error)
			isRestoringGameState.value = false
			throw error
		}
	}

	function resetGameState() {
		stopFastForward()
		isUiHidden.value = false
		isInDialogueMode.value = false
		stepIndex.value = 0
		callStack.value = []
		currentDialogue.value = ''
		currentNarration.value = ''
		multiStepDialogueBuffer.value = ''
		multiStepPrintedLength.value = 0
		currentSpeaker.value = ''
		currentChoices.value = []
		visibleCharacters.value = []
		currentScene.value = null
		globalData.value = createInitialGlobalData()
		historyEntries.value = []
		audioStreams.value = {}
		pausedStreams.value = {}
		clearFadeTimeouts()
		clearPendingAudio()
		fadeOverlay.value = {
			visible: false,
			opacity: 0,
			duration: 0,
			color: '#000000'
		}
		baseUiVisibility.value = {
			all: false,
			'stats-button': false,
			'inventory-button': false,
			'map-button': false,
			'journal-button': false,
			'next-time-button': false,
			'date-badge': true,
			'calendar-button': true,
			topbar: false,
			hotbar: false,
			dialogue: false,
			dialogueHideUI: DIALOGUE_HIDE_UI_CONFIG
		}
		const questsManager = useQuests()
		questsManager.resetQuests()
		const encyclopediaManager = useEncyclopedia()
		encyclopediaManager.resetEncyclopedia()
		useNpcSchedule().resetState()
	}

	function showNotification(text, type = 'info', duration = 3000) {
		if (notificationComponent?.value && text) {
			const html = substituteVariables(text)
			notificationComponent.value.showNotification(html, type, duration)
		}
	}

	function advanceTime() {
		const info = getCalendarInfo(globalData.value)
		const { nextPeriod, dayIncremented, nextFormatted } = advanceTimeOfDay(info.timePeriod)
		globalData.value.timeOfDay = nextPeriod
		globalData.value.time = nextFormatted
		if (dayIncremented) {
			const currentDay =
				typeof globalData.value.day === 'number'
					? globalData.value.day
					: typeof globalData.value.dayCount === 'number'
						? globalData.value.dayCount
						: 0
			globalData.value.day = currentDay + 1
		}
		console.log(
			`⏳ advanceTime: new timeOfDay=${nextPeriod}, day=${globalData.value.day}, time=${nextFormatted}`
		)

		if (currentScene.value?.id) {
			useNpcSchedule().refreshSceneNpcs(
				currentScene.value.id,
				{
					globalData: globalData.value,
					characterData: characterData.value,
					questsManager: useQuests()
				},
				visibleCharacters,
				characterData
			)
		}

		if (emit) {
			emit('global-data-changed', globalData.value)
		}
		return { nextPeriod, dayIncremented, nextFormatted }
	}

	const {
		discoverLocation,
		isLocationDiscovered,
		setHotspotStatus,
		getHotspotStatus,
		handleHotspotStep,
		handleHotspotClick
	} = useSceneHotspots({
		globalData,
		sceneData,
		currentScene,
		emit,
		showNotification,
		showNarration,
		playSound,
		goToLabel,
		evaluateCondition
	})


	return {
		// state
		stepIndex,
		currentScene,
		visibleCharacters,
		currentDialogue,
		currentNarration,
		currentTitle,
		currentTitleEffects,
		currentSpeaker,
		currentChoices,
		currentChoicesLayout,
		multiStepDialogueBuffer,
		multiStepPrintedLength,
		showTextInputModal,
		currentInputStep,
		uiVisibility,
		baseUiVisibility,
		isUiHidden,
		toggleHideUi,
		hideUi,
		unhideUi,
		fadeOverlay,
		isDialogueActive,
		isInDialogueMode,
		// audio state
		currentSound,
		currentVoice,
		currentMusic,
		audioStreams,
		// game state for Rules Engine
		characterData,
		globalData,
		sceneData,
		storyData,
		// methods
		loadStory,
		processStep,
		advanceStory,
		selectChoice,
		showChoices,
		getGameState,
		restoreGameState,
		resetGameState,
		getInitialValue,
		onTextInputConfirm,
		// notification method
		showNotification,
		applyVariable,
		handleJournalStep,
		rebuildEquipmentBySlot,
		syncCharacterEquipment,
		// time advancing method
		advanceTime,
		// location discovery methods
		discoverLocation,
		isLocationDiscovered,
		// scene hotspot methods
		setHotspotStatus,
		getHotspotStatus,
		handleHotspotStep,
		handleHotspotClick,
		// NPC schedule and routines
		npcSchedule: useNpcSchedule(),
		changeScene,
		// goto method for Rules Engine
		goto: goToLabel,
		// audio methods
		playSound,
		playVoice,
		playMusic,
		stopSound,
		stopVoice,
		stopMusic,
		stopStream,
		stopAllStreams,
		getStream,
		pauseAllStreams,
		resumeAllStreams,
		onStreamEnded,
		// fast-forward / skip mode (Ren'Py style Ctrl skip)
		isSkipping,
		startFastForward,
		stopFastForward,
		// UI methods for dialogue hiding
		setDialogueHideUI,
		resolveSpeakerTitle,
		// history helpers
		getHistory,
		clearHistory
	}
}
