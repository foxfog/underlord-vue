import { ref, computed, watch } from 'vue'
import { useSavesStore } from '../stores/saves'
import { useSettingsStore } from '../stores/settings'
import { SOUND_ALIASES } from '../constants/sounds'
import { DIALOGUE_HIDE_UI_CONFIG } from '../constants/dialogue'
import {
	extractVisibleCharacterDisplay,
	applyVisibleCharacterDisplay
} from '../utils/saveGameUtils'
import { evaluateExpression } from '../utils/expressionEvaluator'
import { getCalendarInfo, advanceTimeOfDay } from '../utils/timeCalendar'
import { useQuests } from './useQuests'
import { useEncyclopedia } from './useEncyclopedia'

export function useVisualNovel({ src, emit, notificationComponent } = {}) {
	// State
	const currentScene = ref(null)
	const visibleCharacters = ref([])
	const currentDialogue = ref('')
	const currentNarration = ref('')
	const currentTitle = ref('')
	const currentTitleEffects = ref(null) // { effectStart, effect, effectEnd }
	const currentSpeaker = ref('')
	const currentChoices = ref([])
	const currentChoicesLayout = ref('center') // 'center' (default) | 'dialogue'
	const multiStepDialogueBuffer = ref('') // Buffer for accumulating multi-step dialogue text
	const multiStepPrintedLength = ref(0) // Track how many characters have been printed via typewriter

	// Fade transition overlay state
	const fadeOverlay = ref({
		visible: false,
		opacity: 0,
		duration: 1.5,
		color: '#000000'
	})
	let fadeTimeout = null

	// Audio state - indexed by stream ID
	const audioStreams = ref({}) // { streamId: { type, file, loop, stream } }
	const pausedStreams = ref({}) // Store paused streams for resume
	const currentSound = ref(null)
	const currentVoice = ref(null)
	const currentMusic = ref(null)

	// History
	const HISTORY_MAX = 100
	const historyEntries = ref([])
	function addToHistory(entry) {
		try {
			historyEntries.value.push(entry)
			if (historyEntries.value.length > HISTORY_MAX) {
				historyEntries.value.splice(0, historyEntries.value.length - HISTORY_MAX)
			}
		} catch (e) {
			console.error('Failed to add to history:', e)
		}
	}

	// Other state
	let titleTimeout = null
	const storyData = ref(null)
	const stepIndex = ref(0)
	const characterData = ref({})
	const sceneData = ref({})
	const globalData = ref({
		sceneHotspots: {}
	})
	let advanceStoryOverride = null
	const callStack = ref([])
	let currentStoryPath = 'start' // tracks the file path used to load the current story
	let restoreSessionId = 0
	const showTextInputModal = ref(false)
	const currentInputStep = ref(null)

	const settingsStore = useSettingsStore()

	function buildStoryFilePath(candidate) {
		const language = settingsStore.general.language || 'ru'
		return `/data/story/${language}/${candidate}.json`
	}
	// UI visibility state
	const baseUiVisibility = ref({
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
		dialogueHideUI: DIALOGUE_HIDE_UI_CONFIG // Глобальная конфигурация для скрытия при диалоге
	})

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

	const uiVisibility = computed(() => {
		const base = baseUiVisibility.value
		const hideList = base.dialogueHideUI || DIALOGUE_HIDE_UI_CONFIG || []
		const inDialogue = isDialogueActive.value

		function isTargetHiddenByDialogue(target) {
			if (!inDialogue) return false
			return hideList.includes('all') || hideList.includes(target)
		}

		const statsButton = isTargetHiddenByDialogue('stats-button')
			? false
			: !!(base.all || base['stats-button'])
		const inventoryButton = isTargetHiddenByDialogue('inventory-button')
			? false
			: !!(base.all || base['inventory-button'])
		const mapButton = isTargetHiddenByDialogue('map-button')
			? false
			: !!(base.all || base['map-button'])
		const journalButton = isTargetHiddenByDialogue('journal-button')
			? false
			: !!(base.all || base['journal-button'])
		const nextTimeButton = isTargetHiddenByDialogue('next-time-button')
			? false
			: !!(base.all || base['next-time-button'])
		const dateBadge =
			isTargetHiddenByDialogue('date-badge') || isTargetHiddenByDialogue('calendar-button')
				? false
				: base['date-badge'] !== undefined
					? !!base['date-badge']
					: base['calendar-button'] !== undefined
						? !!base['calendar-button']
						: true
		const hotbar = isTargetHiddenByDialogue('hotbar') ? false : !!(base.all || base.hotbar)
		const topbar = isTargetHiddenByDialogue('topbar')
			? false
			: inventoryButton || mapButton || journalButton || nextTimeButton || !!base.topbar
		const dialogue = isTargetHiddenByDialogue('dialogue') ? false : base.dialogue !== false

		return {
			all: !!base.all,
			'stats-button': statsButton,
			'inventory-button': inventoryButton,
			'map-button': mapButton,
			'journal-button': journalButton,
			'next-time-button': nextTimeButton,
			'date-badge': dateBadge,
			'calendar-button': dateBadge,
			topbar,
			hotbar,
			dialogue,
			dialogueHideUI: hideList,
			hasDialogue: inDialogue
		}
	})

	watch(
		uiVisibility,
		(newVal) => {
			if (newVal && emit) {
				emit('ui-visibility-changed', { ...newVal })
			}
		},
		{ immediate: true, deep: true }
	)

	const isRestoringGameState = ref(false)
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
				const characterIds = ['mc', 'albedo', 'momonga', 'enri']
				for (const charId of characterIds) {
					try {
						const valuesData = await loadDataFromPublic(
							`/data/characters/${charId}/values.json`
						)
						const bodyData = await loadDataFromPublic(
							`/data/characters/${charId}/body.json`
						)
						const equipmentData = await loadDataFromPublic(
							`/data/characters/${charId}/equipment.json`
						)

						const equipmentMap = {}
						equipmentData.forEach((item) => {
							equipmentMap[item.id] = item
						})

						const equipmentBySlot = {}
						if (valuesData.equipment_slots) {
							for (const [slotName, itemId] of Object.entries(
								valuesData.equipment_slots
							)) {
								if (itemId && equipmentMap[itemId]) {
									equipmentBySlot[slotName] = {
										id: itemId,
										item: equipmentMap[itemId],
										parts: equipmentMap[itemId].parts || []
									}
								}
							}
						}

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

				emit && emit('character-loaded', characterData.value)

				// Set character defaults for save system
				const savesStore = useSavesStore()
				savesStore.setCharacterDefaults(characterData.value)

				const scenesModule = await loadDataFromPublic('/data/scenes/scenes.json')
				scenesModule.scenes.forEach((scene) => {
					sceneData.value[scene.id] = scene
				})

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
					if (!isRestoringGameState.value) playSound(step)
					stepIndex.value++
					processStep()
					break
				case 'voice':
					if (!isRestoringGameState.value) playVoice(step)
					stepIndex.value++
					processStep()
					break
				case 'music':
					if (!isRestoringGameState.value) playMusic(step)
					stepIndex.value++
					processStep()
					break
				case 'stop-stream':
					if (!isRestoringGameState.value) stopStream(step.stream)
					stepIndex.value++
					processStep()
					break
				case 'stop-all-streams':
					if (!isRestoringGameState.value) stopAllStreams()
					stepIndex.value++
					processStep()
					break
				case 'inventory-remove':
					// Remove item(s) from inventory: { character: "mc", itemId: "gasmask", quantity: 1 }
					if (!isRestoringGameState.value && step.character && step.itemId) {
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
					stepIndex.value++
					processStep()
					break
				case 'inventory-item-update':
				case 'inventory-item-modify':
				case 'inventory-item-property':
				case 'item-property':
				case 'item-modify':
					// Modify / remove / add properties of item in inventory:
					// e.g. { character: "mc", itemId: "neuro_helmet", removeProperty: "can_equip" }
					// e.g. { character: "mc", itemId: "neuro_helmet", property: "can_equip", value: true }
					if (!isRestoringGameState.value && step.itemId) {
						const charId = step.character || 'mc'
						const char = characterData.value[charId]
						if (char && char.inventory && Array.isArray(char.inventory.items)) {
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

							if (targetItem) {
								// Handle property removal
								const propsToRemove = []
								if (step.removeProperty) {
									if (Array.isArray(step.removeProperty))
										propsToRemove.push(...step.removeProperty)
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

								// Handle setting single property
								if (step.property && step.action !== 'remove') {
									targetItem[step.property] =
										step.value !== undefined ? step.value : true
									console.log(
										`📦 Set property "${step.property}" = ${targetItem[step.property]} on ${step.itemId} in ${charId}'s inventory`
									)
								}

								// Handle setting multiple properties
								if (step.properties && typeof step.properties === 'object') {
									Object.assign(targetItem, step.properties)
									console.log(
										`📦 Updated properties on ${step.itemId} in ${charId}'s inventory:`,
										step.properties
									)
								}

								emit && emit('character-loaded', characterData.value)
							} else {
								console.warn(
									`Item ${step.itemId} not found in ${charId}'s inventory`
								)
							}
						}
					}
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
				case 'end':
					// 'end' always terminates the game regardless of call stack.
					// Use 'continue' to return from a macro/sub-story to the caller.
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
				case 'inventory-add':
					// Add item(s) to inventory: { character: "mc", itemId: "ygdrasil-coin-new", quantity: 4 }
					if (!isRestoringGameState.value && step.character && step.itemId) {
						const char = characterData.value[step.character]
						if (char && char.inventory && Array.isArray(char.inventory.items)) {
							const itemQtyToAdd = step.quantity || 1
							// Try to stack with existing item
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
					if (!isRestoringGameState.value) {
						const charId = step.character || 'mc'
						const char = characterData.value[charId]
						if (char) {
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
					}
					stepIndex.value++
					processStep()
					break
				case 'quest': {
					const questId = step.questId || step.id
					if (!isRestoringGameState.value && questId) {
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
					stepIndex.value++
					processStep()
					break
				}
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
					if (!isRestoringGameState.value) {
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
					stepIndex.value++
					processStep()
					break
				case 'map':
					if (!isRestoringGameState.value) {
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
	function showCharacter(step) {
		const characterId = typeof step === 'string' ? step : step.character
		const character = characterData.value[characterId]
		if (character) {
			// Set initial position from 'from' if provided
			if (step.from && typeof step === 'object') {
				character.fromPosition = step.from
				console.log(
					`🎬 [${characterId}] Animation started: from=${JSON.stringify(step.from)} to=${JSON.stringify(step.position)} duration=${step.duration ?? 1}s`
				)
			} else {
				character.fromPosition = null
			}

			// Set target position
			if (step.position && typeof step === 'object') {
				character.position = step.position
			}

			// Set animation duration (default 1000ms if from is specified but duration is not)
			// Duration in JSON is in seconds, convert to milliseconds for CSS
			if (step.from && typeof step === 'object') {
				character.animationDuration = (step.duration ?? 1) * 1000
				// Clear fromPosition and animationDuration after animation completes
				setTimeout(() => {
					character.fromPosition = null
					character.animationDuration = null
					console.log(
						`🎬 [${characterId}] Animation cleanup: fromPosition and duration cleared`
					)
				}, character.animationDuration)
			} else if (step.duration && typeof step === 'object') {
				character.animationDuration = step.duration * 1000
			} else {
				character.animationDuration = null
			}

			// Set orientation (default 'right' if not specified)
			character.orientation = step.orientation || 'right'

			// Set back flag (default false if not specified)
			character.back = step.back ?? false

			// Apply scale if provided, or reset to default size
			if (typeof step === 'object' && step.scale !== undefined) {
				character.scale = step.scale
			} else {
				character.scale = character.size || 1
			}

			// Apply class if provided
			if (step.class && typeof step === 'object') {
				character.customClass = step.class
			}

			rebuildEquipmentBySlot(characterId)

			const existingIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
			if (existingIndex !== -1) {
				visibleCharacters.value[existingIndex] = { ...character }
			} else {
				visibleCharacters.value.push(character)
			}
		}
	}
	function hideCharacter(stepOrId) {
		const characterId = typeof stepOrId === 'string' ? stepOrId : stepOrId?.character
		if (!characterId || characterId === 'all') {
			visibleCharacters.value = []
			return
		}
		const character = characterData.value[characterId]
		if (!character) {
			visibleCharacters.value = visibleCharacters.value.filter((c) => c.id !== characterId)
			return
		}

		// If we have animation params, play hide animation first, then remove
		if (typeof stepOrId === 'object' && stepOrId.to && stepOrId.duration) {
			// Start from current position and animate to "to"
			const currentPos = character.position ? { ...character.position } : null
			character.fromPosition = currentPos
			character.position = stepOrId.to
			// Duration in seconds in JSON -> ms for CSS
			const durationMs = (stepOrId.duration || 0) * 1000
			character.animationDuration = durationMs

			// Ensure character is visible during animation
			if (!visibleCharacters.value.some((c) => c.id === characterId)) {
				visibleCharacters.value.push(character)
			}

			// After animation, actually hide character
			if (durationMs > 0) {
				setTimeout(() => {
					visibleCharacters.value = visibleCharacters.value.filter(
						(c) => c.id !== characterId
					)
					// Clean animation props so future shows are clean
					character.fromPosition = null
					character.animationDuration = null
				}, durationMs)
			} else {
				visibleCharacters.value = visibleCharacters.value.filter(
					(c) => c.id !== characterId
				)
			}
		} else {
			// Instant hide (old behaviour)
			visibleCharacters.value = visibleCharacters.value.filter((c) => c.id !== characterId)
		}
	}

	function animateCharacterPart(step) {
		const characterId = step.character
		const partName = step.part
		const character = characterData.value[characterId]

		if (!character) return

		// Инициализируем объект partAnimations если его нет
		if (!character.partAnimations) {
			character.partAnimations = {}
		}

		const animConfig = {
			styles: step.styles || null,
			class: step.class || null,
			animationDuration: step.duration ? step.duration * 1000 : null
		}

		// Устанавливаем анимацию для части тела
		character.partAnimations[partName] = animConfig

		console.log(
			`🎬 [${characterId}] Part animation: part=${partName}, class=${animConfig.class}, duration=${step.duration}s, styles=${JSON.stringify(animConfig.styles)}`
		)

		// Если есть длительность, то очищаем анимацию после её завершения
		if (step.duration && step.duration > 0) {
			const durationMs = step.duration * 1000
			setTimeout(() => {
				if (character.partAnimations && character.partAnimations[partName]) {
					delete character.partAnimations[partName]
					console.log(`🎬 [${characterId}] Part animation cleared: part=${partName}`)
				}
			}, durationMs)
		}
	}

	function handleUIStep(step) {
		const action = step.action // 'show' or 'hide'
		const targets = step.target || [] // Array of target IDs
		const show = action === 'show'
		const knownTargets = [
			'topbar',
			'hotbar',
			'dialogue',
			'stats-button',
			'inventory-button',
			'map-button',
			'journal-button',
			'next-time-button',
			'date-badge',
			'calendar-button'
		]

		function setAllUi(value) {
			baseUiVisibility.value.all = value
			knownTargets.forEach((target) => {
				baseUiVisibility.value[target] = value
			})
		}

		// If target is not specified or empty, apply to all UI
		if (!targets || targets.length === 0) {
			console.log(`UI ${action}: all elements`)
			setAllUi(show)
			return
		}

		// Apply action to specified targets
		targets.forEach((target) => {
			console.log(`UI ${action}: ${target}`)
			if (target === 'all') {
				setAllUi(show)
			} else {
				if (!knownTargets.includes(target)) {
					console.warn(`UI target not recognized: ${target}`)
					return
				}
				if (!show && baseUiVisibility.value.all) {
					baseUiVisibility.value.all = false
					knownTargets.forEach((k) => {
						baseUiVisibility.value[k] = true
					})
				}
				if (target === 'calendar-button' || target === 'date-badge') {
					baseUiVisibility.value['date-badge'] = show
					baseUiVisibility.value['calendar-button'] = show
					return
				}
				if (target === 'topbar' && !show) {
					baseUiVisibility.value.topbar = false
					baseUiVisibility.value['stats-button'] = false
					baseUiVisibility.value['inventory-button'] = false
					baseUiVisibility.value['map-button'] = false
					baseUiVisibility.value['journal-button'] = false
					baseUiVisibility.value['next-time-button'] = false
					baseUiVisibility.value['date-badge'] = false
					baseUiVisibility.value['calendar-button'] = false
					return
				}
				if (target === 'topbar' && show) {
					baseUiVisibility.value.topbar = true
					baseUiVisibility.value['date-badge'] = true
					baseUiVisibility.value['calendar-button'] = true
					return
				}
				baseUiVisibility.value[target] = show
				if (
					show &&
					['stats-button', 'inventory-button', 'map-button', 'journal-button', 'date-badge', 'calendar-button'].includes(
						target
					)
				) {
					baseUiVisibility.value.topbar = true
				}
			}
		})
	}

	/**
	 * Установить какие UI элементы должны быть скрыты во время активного диалога
	 * @param {string[]} targets - Массив ID элементов для скрытия при диалоге
	 */
	function setDialogueHideUI(targets) {
		baseUiVisibility.value.dialogueHideUI = Array.isArray(targets) ? targets : []
		console.log(`📌 Dialogue hide UI configured:`, baseUiVisibility.value.dialogueHideUI)
	}

	function handleFadeStep(step) {
		if (isRestoringGameState.value) {
			fadeOverlay.value.visible = false
			fadeOverlay.value.opacity = 0
			stepIndex.value++
			processStep()
			return
		}

		if (fadeTimeout) {
			clearTimeout(fadeTimeout)
			fadeTimeout = null
		}

		const action = step.action || (step.type === 'fade-out' ? 'out' : 'in')
		const parsedDuration = typeof step.duration === 'number' ? step.duration : parseFloat(step.duration)
		const duration = !isNaN(parsedDuration) && parsedDuration >= 0 ? parsedDuration : 1.5
		const color = step.color || '#000000'
		const wait = step.wait !== false

		if (action === 'in') {
			// Fade in: start solid, then animate to 0
			fadeOverlay.value = {
				visible: true,
				opacity: 1,
				duration: 0,
				color
			}

			setTimeout(() => {
				fadeOverlay.value = {
					visible: true,
					opacity: 0,
					duration,
					color
				}
			}, 30)

			if (wait) {
				fadeTimeout = setTimeout(() => {
					fadeOverlay.value.visible = false
					fadeTimeout = null
					advanceStoryOverride = null
					stepIndex.value++
					processStep()
				}, duration * 1000 + 40)

				advanceStoryOverride = function () {
					if (fadeTimeout) clearTimeout(fadeTimeout)
					fadeTimeout = null
					fadeOverlay.value.visible = false
					fadeOverlay.value.opacity = 0
					advanceStoryOverride = null
					stepIndex.value++
					processStep()
				}
			} else {
				fadeTimeout = setTimeout(() => {
					fadeOverlay.value.visible = false
					fadeTimeout = null
				}, duration * 1000 + 40)
				stepIndex.value++
				processStep()
			}
		} else {
			// Fade out: start transparent, then animate to 1
			fadeOverlay.value = {
				visible: true,
				opacity: 0,
				duration: 0,
				color
			}

			setTimeout(() => {
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration,
					color
				}
			}, 30)

			if (wait) {
				fadeTimeout = setTimeout(() => {
					fadeTimeout = null
					advanceStoryOverride = null
					stepIndex.value++
					processStep()
				}, duration * 1000 + 40)

				advanceStoryOverride = function () {
					if (fadeTimeout) clearTimeout(fadeTimeout)
					fadeTimeout = null
					fadeOverlay.value.opacity = 1
					advanceStoryOverride = null
					stepIndex.value++
					processStep()
				}
			} else {
				stepIndex.value++
				processStep()
			}
		}
	}

	function isSceneTransitionsEnabled() {
		try {
			return settingsStore?.general?.sceneTransitions !== false
		} catch (_) {
			return true
		}
	}

	function performSceneTransition(
		onSceneChange,
		onComplete = null,
		duration = 0.35,
		color = '#000000'
	) {
		if (fadeTimeout) {
			clearTimeout(fadeTimeout)
			fadeTimeout = null
		}

		return new Promise((resolve) => {
			let isFinished = false

			const finish = () => {
				if (isFinished) return
				isFinished = true
				if (fadeTimeout) {
					clearTimeout(fadeTimeout)
					fadeTimeout = null
				}
				advanceStoryOverride = null
				fadeOverlay.value.visible = false
				fadeOverlay.value.opacity = 0
				if (onComplete) onComplete()
				resolve()
			}

			// 1. Fade Out: animate to solid color
			fadeOverlay.value = {
				visible: true,
				opacity: 0,
				duration: 0,
				color
			}

			setTimeout(() => {
				if (isFinished) return
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration,
					color
				}
			}, 20)

			advanceStoryOverride = finish

			fadeTimeout = setTimeout(() => {
				if (isFinished) return

				// 2. Change scene while screen is fully covered
				try {
					if (onSceneChange) onSceneChange()
				} catch (err) {
					console.error('Error during scene transition callback:', err)
				}

				// 3. Fade In: start solid, animate to transparent
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration: 0,
					color
				}

				setTimeout(() => {
					if (isFinished) return
					fadeOverlay.value = {
						visible: true,
						opacity: 0,
						duration,
						color
					}
				}, 20)

				fadeTimeout = setTimeout(() => {
					finish()
				}, duration * 1000 + 40)
			}, duration * 1000 + 30)
		})
	}

	function applyDialogueHiding() {
		// Handled reactively via computed uiVisibility
	}

	function clearDialogueHiding() {
		// Handled reactively via computed uiVisibility
	}

	function onStreamEnded({ streamId, type }) {
		const stream = audioStreams.value[streamId]
		if (stream && !stream.loop) {
			stopStream(streamId)
			console.log(`🧹 Cleaned up finished non-looping ${type} stream: ${streamId}`)
		}
	}

	// Audio handlers
	function playSound(soundData) {
		// soundData: { file: "path/to/sound.mp3", loop: false, stream: "id" }
		const streamId = soundData.stream || `sound_${Date.now()}`
		const audioData = {
			type: 'sound',
			file: soundData.file,
			loop: soundData.loop ?? false,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentSound.value = audioData
	}

	function playVoice(voiceData) {
		// voiceData: { file: "path/to/voice.mp3", loop: false, stream: "id" }
		const streamId = voiceData.stream || `voice_${Date.now()}`
		const audioData = {
			type: 'voice',
			file: voiceData.file,
			loop: voiceData.loop ?? false,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentVoice.value = audioData
	}

	function playMusic(musicData) {
		// musicData: { file: "path/to/music.ogg", loop: true, stream: "id" }
		const streamId = musicData.stream || `music_${Date.now()}`
		const audioData = {
			type: 'music',
			file: musicData.file,
			loop: musicData.loop ?? true,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentMusic.value = audioData
	}

	function stopSound() {
		currentSound.value = null
	}
	function stopVoice() {
		currentVoice.value = null
	}
	function stopMusic() {
		currentMusic.value = null
	}

	// Stream management by ID
	function stopStream(streamId) {
		const stream = audioStreams.value[streamId]
		if (!stream) return

		switch (stream.type) {
			case 'sound':
				if (currentSound.value?.stream === streamId) stopSound()
				break
			case 'voice':
				if (currentVoice.value?.stream === streamId) stopVoice()
				break
			case 'music':
				if (currentMusic.value?.stream === streamId) stopMusic()
				break
		}
		delete audioStreams.value[streamId]
		delete pausedStreams.value[streamId]
		console.log(`🛑 Stopped stream: ${streamId}`)
	}

	function stopAllStreams() {
		console.log('🛑 Stopping all streams')
		audioStreams.value = {}
		pausedStreams.value = {}
		stopSound()
		stopVoice()
		stopMusic()
	}

	/**
	 * Helper: play short sound from a variable-only step.
	 * step.sound can be:
	 * - simple name, e.g. "cloth" -> audio/sound/cloth.ogg
	 * - full path, e.g. "audio/sound/cloth.ogg"
	 */
	function playVariableStepSound(soundName) {
		if (!soundName) return

		let file = soundName
		if (!soundName.includes('/')) {
			// Use shared alias map, fallback to audio/sound/<name>.ogg
			file = SOUND_ALIASES[soundName] || `audio/sound/${soundName}.ogg`
		}

		playSound({
			file,
			loop: false,
			stream: `var_${Date.now()}`
		})
	}

	function getStream(streamId) {
		return audioStreams.value[streamId] || null
	}

	function pauseAllStreams() {
		console.log('🔇 pauseAllStreams called, active streams:', Object.keys(audioStreams.value))
		pausedStreams.value = {}
		Object.entries(audioStreams.value).forEach(([streamId, stream]) => {
			pausedStreams.value[streamId] = { ...stream }
		})
		window.dispatchEvent(new CustomEvent('pauseAllAudio'))
		console.log('📢 pauseAllAudio event dispatched')
	}

	function resumeAllStreams() {
		console.log('🔊 resumeAllStreams called')
		window.dispatchEvent(new CustomEvent('resumeAllAudio'))
		console.log('📢 resumeAllAudio event dispatched')
		pausedStreams.value = {}
	}

	function resolveSpeakerTitle(characterId, explicitTitle = null) {
		if (
			explicitTitle !== null &&
			explicitTitle !== undefined &&
			String(explicitTitle).trim() !== ''
		) {
			return substituteVariables(String(explicitTitle))
		}
		if (!characterId) return ''
		const character = characterData.value[characterId]
		if (character) {
			if (
				character.title !== null &&
				character.title !== undefined &&
				String(character.title).trim() !== ''
			) {
				return substituteVariables(String(character.title))
			}
			if (
				character.name !== null &&
				character.name !== undefined &&
				String(character.name).trim() !== ''
			) {
				return substituteVariables(String(character.name))
			}
		}
		return characterId
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

	function rebuildEquipmentBySlot(characterId, newSlots = null) {
		const char = characterData.value[characterId]
		if (!char) return

		if (newSlots) {
			char.equipment_slots = { ...newSlots }
		}

		const equipmentMap = {}
		if (Array.isArray(char.equipment)) {
			char.equipment.forEach((item) => {
				if (item && item.id) equipmentMap[item.id] = item
			})
		}

		const equipmentBySlot = {}
		const slots = char.equipment_slots || {}
		for (const [slotName, itemRef] of Object.entries(slots)) {
			let itemId = null
			if (itemRef === null || typeof itemRef === 'undefined') itemId = null
			else if (typeof itemRef === 'string' || typeof itemRef === 'number') itemId = itemRef
			else if (typeof itemRef === 'object' && itemRef.id) itemId = itemRef.id
			else if (typeof itemRef === 'object' && itemRef.item && itemRef.item.id)
				itemId = itemRef.item.id
			if (itemId && equipmentMap[itemId]) {
				equipmentBySlot[slotName] = {
					id: itemId,
					item: equipmentMap[itemId],
					parts: equipmentMap[itemId].parts || []
				}
			}
		}

		char.equipmentBySlot = equipmentBySlot

		const visIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = {
				...visibleCharacters.value[visIndex],
				...char,
				equipment_slots: { ...(char.equipment_slots || {}) },
				equipmentBySlot: { ...equipmentBySlot }
			}
		}
	}

	function syncCharacterEquipment(characterId, characterObj = null) {
		let char = characterData.value[characterId]
		if (!char && characterObj) {
			characterData.value[characterId] = { ...characterObj }
			char = characterData.value[characterId]
		}
		if (!char) return

		if (characterObj && char !== characterObj) {
			if (characterObj.equipment_slots) {
				char.equipment_slots = { ...characterObj.equipment_slots }
			}
			if (characterObj.equipment && (!char.equipment || !char.equipment.length)) {
				char.equipment = characterObj.equipment
			}
			if (characterObj.inventory) {
				char.inventory = characterObj.inventory
			}
		}

		rebuildEquipmentBySlot(characterId)

		if (
			(!char.equipmentBySlot || Object.keys(char.equipmentBySlot).length === 0) &&
			characterObj?.equipmentBySlot &&
			Object.keys(characterObj.equipmentBySlot).length > 0
		) {
			char.equipmentBySlot = { ...characterObj.equipmentBySlot }
		}

		const visIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = {
				...visibleCharacters.value[visIndex],
				...char,
				equipment_slots: { ...(char.equipment_slots || {}) },
				equipmentBySlot: { ...(char.equipmentBySlot || {}) }
			}
		}
	}

	function updateCharacterData(variablePath, value) {
		const parts = variablePath.split('.')
		if (parts[0] === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			if (characterData.value[characterId]) {
				let target = characterData.value[characterId]
				for (let i = 0; i < propertyPath.length - 1; i++) {
					if (!target[propertyPath[i]]) target[propertyPath[i]] = {}
					target = target[propertyPath[i]]
				}
				const finalProperty = propertyPath[propertyPath.length - 1]
				target[finalProperty] = value
				if (
					propertyPath[0] === 'equipment_slots' ||
					finalProperty === 'equipment_slots' ||
					propertyPath.includes('equipment_slots')
				)
					rebuildEquipmentBySlot(characterId)
			}
		}
	}

	function resolvePath(variablePath) {
		const parts = variablePath.split('.')
		const root = parts[0]
		if (root === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			if (!characterData.value[characterId]) return null
			let target = characterData.value[characterId]
			for (let i = 0; i < propertyPath.length - 1; i++) {
				const part = propertyPath[i]
				const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
				if (arrayMatch) {
					const arrayName = arrayMatch[1]
					const indexExpr = arrayMatch[2]
					if (target[arrayName] === undefined) {
						target[arrayName] = []
					}
					let index = parseInt(indexExpr)
					if (isNaN(index)) {
						const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
						if (Array.isArray(target[arrayName])) {
							index = target[arrayName].findIndex(
								(item) => item && (item.itemId === searchValue || item.id === searchValue)
							)
						}
					}
					if (index === -1 || !target[arrayName][index]) {
						return null
					}
					target = target[arrayName][index]
				} else {
					if (
						target[part] === undefined ||
						typeof target[part] !== 'object' ||
						target[part] === null
					) {
						target[part] = {}
					}
					target = target[part]
				}
			}
			const finalPart = propertyPath[propertyPath.length - 1]
			const arrayMatch = finalPart.match(/^(\w+)\[([^\]]+)\]$/)
			if (arrayMatch) {
				const arrayName = arrayMatch[1]
				const indexExpr = arrayMatch[2]
				let index = parseInt(indexExpr)
				if (isNaN(index)) {
					const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
					if (Array.isArray(target[arrayName])) {
						index = target[arrayName].findIndex(
							(item) => item && (item.itemId === searchValue || item.id === searchValue)
						)
					}
				}
				return {
					container: target[arrayName],
					key: index,
					root: 'character',
					id: characterId
				}
			}
			return {
				container: target,
				key: finalPart,
				root: 'character',
				id: characterId
			}
		}
		if (root === 'global' && parts.length >= 2) {
			const propertyPath = parts.slice(1)
			let target = globalData.value
			for (let i = 0; i < propertyPath.length - 1; i++) {
				const part = propertyPath[i]
				const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
				if (arrayMatch) {
					const arrayName = arrayMatch[1]
					const indexExpr = arrayMatch[2]
					if (target[arrayName] === undefined) target[arrayName] = []
					let index = parseInt(indexExpr)
					if (isNaN(index)) {
						const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
						if (Array.isArray(target[arrayName])) {
							index = target[arrayName].findIndex(
								(item) => item && (item.id === searchValue || item.itemId === searchValue)
							)
						}
					}
					if (index === -1 || !target[arrayName][index]) return null
					target = target[arrayName][index]
				} else {
					if (
						target[part] === undefined ||
						typeof target[part] !== 'object' ||
						target[part] === null
					) {
						target[part] = {}
					}
					target = target[part]
				}
			}
			const finalPart = propertyPath[propertyPath.length - 1]
			const arrayMatch = finalPart.match(/^(\w+)\[([^\]]+)\]$/)
			if (arrayMatch) {
				const arrayName = arrayMatch[1]
				const indexExpr = arrayMatch[2]
				let index = parseInt(indexExpr)
				if (isNaN(index)) {
					const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
					if (Array.isArray(target[arrayName])) {
						index = target[arrayName].findIndex(
							(item) => item && (item.id === searchValue || item.itemId === searchValue)
						)
					}
				}
				return {
					container: target[arrayName],
					key: index,
					root: 'global'
				}
			}
			return { container: target, key: finalPart, root: 'global' }
		}
		return null
	}

	function applyVariable(expr) {
		if (!expr || typeof expr !== 'string') return
		const trimmedExpr = expr.trim()
		if (trimmedExpr.startsWith('delete ')) {
			const targetPath = trimmedExpr.substring(7).trim()
			const resolved = resolvePath(targetPath)
			if (resolved && resolved.container && resolved.key !== undefined) {
				delete resolved.container[resolved.key]
				console.log(`Applied variable (delete): ${targetPath}`)
				if (resolved.root === 'character') {
					emit && emit('character-loaded', characterData.value)
				}
			}
			return
		}

		const m = trimmedExpr.match(/^\s*([a-zA-Z0-9_\.\[\]'"]+)\s*(\+=|-=|=|\*=|\/=)\s*(.+)\s*$/)
		if (!m) {
			console.warn('Unsupported variable expression:', expr)
			return
		}
		const targetPath = m[1]
		const op = m[2]
		const rhsRaw = m[3]

		const resolved = resolvePath(targetPath)
		if (!resolved) {
			console.warn('Could not resolve target path for variable:', targetPath)
			return
		}

		const rhsValue = evaluateExpression(rhsRaw, {
			global: globalData.value,
			character: characterData.value
		})
		const container = resolved.container
		const key = resolved.key
		const current = container[key]
		let newValue
		switch (op) {
			case '=':
				newValue = rhsValue
				break
			case '+=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) +
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '-=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) -
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '*=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) *
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '/=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) /
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 1)
				break
			default:
				newValue = rhsValue
		}

		container[key] = newValue

		// Check sympathy notification
		if (
			!isRestoringGameState.value &&
			(key.includes('symp') || targetPath.includes('symp'))
		) {
			const prevNum = typeof current === 'number' ? current : Number(current) || 0
			const newNum = typeof newValue === 'number' ? newValue : Number(newValue) || 0
			const diff = newNum - prevNum
			if (diff !== 0 && notificationComponent?.value) {
				let charId = null
				if (key.endsWith('_mc_symp')) {
					charId = key.replace(/_mc_symp$/, '')
				} else if (key.endsWith('_symp')) {
					charId = key.replace(/_symp$/, '')
				} else if (resolved.root === 'character') {
					charId = resolved.id
				}

				let charName = 'Персонаж'
				if (charId) {
					const resolvedTitle = resolveSpeakerTitle(charId)
					if (resolvedTitle && resolvedTitle !== charId) {
						charName = resolvedTitle
					} else {
						const encChar = useEncyclopedia().getCharacter(charId)
						if (encChar?.name) {
							charName = encChar.name
						} else {
							charName = charId.charAt(0).toUpperCase() + charId.slice(1)
						}
					}
				}

				const isPositive = diff > 0
				const sign = isPositive ? `+${diff}` : `${diff}`
				const icon = isPositive ? '❤️' : '💔'
				const titleText = isPositive ? 'Отношение улучшилось' : 'Отношение ухудшилось'
				const notifType = isPositive ? 'success' : 'warning'

				notificationComponent.value.showNotification(
					`<p><b>${icon} ${titleText}: ${charName}</b></p><p>${sign} (Симпатия: ${newNum})</p>`,
					notifType,
					3000
				)
			}
		}
		if (resolved.root === 'character') {
			console.log(`Applied variable: ${expr} -> ${resolved.id}.${key} =`, newValue)
			updateCharacterData(targetPath, newValue)
			// Эмитим событие если изменились данные персонажа (equipment_slots или свойства инвентаря)
			if (emit) {
				emit('character-loaded', characterData.value)
			}
		} else {
			console.log(`Applied global variable: ${expr} -> ${targetPath} =`, newValue)
			// Также синхронизируем глобальные переменные
			if (emit) {
				console.log(
					`📤 Emitting global-data-changed after global variable change`,
					globalData.value
				)
				emit('global-data-changed', globalData.value)
			}
		}
	}

	function evaluateCondition(conditionStr) {
		if (!conditionStr || typeof conditionStr !== 'string') return false
		try {
			return Boolean(
				evaluateExpression(conditionStr, {
					global: globalData.value,
					character: characterData.value
				})
			)
		} catch (error) {
			console.warn('Error evaluating condition:', conditionStr, error)
			return false
		}
	}

	function substituteVariables(text) {
		if (!text) return ''
		return text.replace(/\{([^}]+)\}/g, (match, variablePath) => {
			const parts = variablePath.split('.')
			if (parts[0] === 'character' && parts.length >= 3) {
				const characterId = parts[1]
				const propertyPath = parts.slice(2)
				if (characterData.value[characterId]) {
					let target = characterData.value[characterId]
					for (let i = 0; i < propertyPath.length; i++) {
						const part = propertyPath[i]
						// Handle array indexing: items[0], items[indexOf(gasmask)]
						const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
						if (arrayMatch) {
							const arrayName = arrayMatch[1]
							const indexExpr = arrayMatch[2]
							if (target[arrayName] === undefined) return match
							let index = parseInt(indexExpr)
							// If index is NaN, try to find by property value
							if (isNaN(index)) {
								// Look for an item by itemId: items[gasmask] or items['gasmask']
								const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
								if (Array.isArray(target[arrayName])) {
									index = target[arrayName].findIndex(
										(item) => item.itemId === searchValue
									)
									if (index === -1) return match
								}
							}
							target = Array.isArray(target[arrayName])
								? target[arrayName][index]
								: undefined
							if (target === undefined) return match
						} else {
							if (target[part] === undefined) return match
							target = target[part]
						}
					}
					return target || ''
				}
			}
			if (parts[0] === 'global' && parts.length >= 2) {
				const propertyPath = parts.slice(1)
				let target = globalData.value
				for (let i = 0; i < propertyPath.length; i++) {
					if (target[propertyPath[i]] === undefined) return match
					target = target[propertyPath[i]]
				}
				return target || ''
			}
			return match
		})
	}

	function getInitialValue(variablePath) {
		if (!variablePath) return ''
		const parts = variablePath.split('.')
		if (parts[0] === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			if (characterData.value[characterId]) {
				let target = characterData.value[characterId]
				for (let i = 0; i < propertyPath.length; i++) {
					if (target[propertyPath[i]] === undefined) return ''
					target = target[propertyPath[i]]
				}
				return target || ''
			}
		}
		return ''
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
						const tempDiv = document.createElement('div')
						tempDiv.innerHTML = multiStepDialogueBuffer.value
						const plainTextLength = tempDiv.textContent?.length || 0
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

	async function loadTargetStory(storyName) {
		const storyLoadSession = restoreSessionId
		try {
			// Сохраняем состояние персонажа И глобальные данные перед загрузкой новой истории
			const savedCharacterState = characterData.value?.mc
				? { ...characterData.value.mc }
				: null
			const savedGlobalData = { ...globalData.value } // Сохраняем глобальные переменные (toxic_gas)
			console.log('💾 Saving state before loading new story:', {
				mask: savedCharacterState?.equipment_slots?.mask,
				globalData: savedGlobalData
			})

			const storyCandidates = getStoryPathCandidates(storyName)
			let module = null
			let loadError = null
			for (const candidate of storyCandidates) {
				if (storyLoadSession !== restoreSessionId) {
					console.log(
						`✋ Aborting stale loadTargetStory before candidate load: ${candidate}`
					)
					return
				}
				try {
					module = await loadDataFromPublic(buildStoryFilePath(candidate))
					if (storyLoadSession !== restoreSessionId) {
						console.log(
							`✋ Aborting stale loadTargetStory after candidate load: ${candidate}`
						)
						return
					}
					currentStoryPath = candidate
					break
				} catch (err) {
					loadError = err
					console.warn(`Failed to load story candidate: ${candidate}`, err)
				}
			}
			if (!module) {
				throw loadError || new Error(`Unable to load story: ${storyName}`)
			}
			storyData.value = module
			stepIndex.value = 0

			// Восстанавливаем состояние персонажа и глобальные данные
			if (savedCharacterState && characterData.value?.mc) {
				characterData.value.mc.equipment_slots = savedCharacterState.equipment_slots
				rebuildEquipmentBySlot('mc')
			}
			// Восстанавливаем глобальные переменные
			Object.assign(globalData.value, savedGlobalData)

			console.log('♻️ Restored state after story load:', {
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
				console.log('✋ Aborting stale loadTargetStory before processStep')
				return
			}
			isRestoringGameState.value = false
			processStep()
		} catch (error) {
			console.error('Error loading target story:', error)
			emit && emit('end')
		}
	}

	async function loadReturnStory(storyName, returnStepIndex) {
		const storyLoadSession = restoreSessionId
		try {
			// Сохраняем состояние персонажа И глобальные данные перед загрузкой новой истории
			const savedCharacterState = characterData.value?.mc
				? { ...characterData.value.mc }
				: null
			const savedGlobalData = { ...globalData.value } // Сохраняем глобальные переменные (toxic_gas)
			console.log('💾 Saving state before loading return story:', {
				mask: savedCharacterState?.equipment_slots?.mask,
				globalData: savedGlobalData
			})

			const storyCandidates = getStoryPathCandidates(storyName)
			let module = null
			let loadError = null
			for (const candidate of storyCandidates) {
				if (storyLoadSession !== restoreSessionId) {
					console.log(
						`✋ Aborting stale loadReturnStory before candidate load: ${candidate}`
					)
					return
				}
				try {
					module = await loadDataFromPublic(buildStoryFilePath(candidate))
					if (storyLoadSession !== restoreSessionId) {
						console.log(
							`✋ Aborting stale loadReturnStory after candidate load: ${candidate}`
						)
						return
					}
					currentStoryPath = candidate
					break
				} catch (err) {
					loadError = err
					console.warn(`Failed to load return story candidate: ${candidate}`, err)
				}
			}
			if (!module) {
				throw loadError || new Error(`Unable to load return story: ${storyName}`)
			}
			storyData.value = module
			stepIndex.value = returnStepIndex

			// Восстанавливаем состояние персонажа и глобальные данные
			if (savedCharacterState && characterData.value?.mc) {
				characterData.value.mc.equipment_slots = savedCharacterState.equipment_slots
				rebuildEquipmentBySlot('mc')
			}
			// Восстанавливаем глобальные переменные
			Object.assign(globalData.value, savedGlobalData)

			console.log('♻️ Restored state after story load:', {
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
				console.log('✋ Aborting stale loadReturnStory before processStep')
				return
			}
			isRestoringGameState.value = false
			processStep()
		} catch (error) {
			console.error('Error loading return story:', error)
			emit && emit('end')
		}
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
		// Save only active looping streams (that should resume on load)
		const activeLoopingStreams = {}
		Object.entries(audioStreams.value).forEach(([streamId, stream]) => {
			if (stream.loop) {
				activeLoopingStreams[streamId] = { ...stream }
			}
		})
		console.log(
			'💾 getGameState called, saving audio streams:',
			Object.keys(activeLoopingStreams)
		)

		if (globalData.value) {
			globalData.value.quests = useQuests().getQuestsState()
			globalData.value.encyclopedia = useEncyclopedia().getState()
		}

		return {
			storyData: storyData.value,
			storyPath: currentStoryPath,
			stepIndex: stepIndex.value,
			callStack: callStack.value,
			globalData: globalData.value,
			characterData: characterData.value,
			visibleCharacters: extractVisibleCharacterDisplay(visibleCharacters.value),
			currentScene: currentScene.value?.id,
			currentSceneMods: currentScene.value?.mods || [],
			history: historyEntries.value.slice(),
			audioStreams: activeLoopingStreams,
			uiVisibility: { ...baseUiVisibility.value }
		}
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
			globalData.value = saveData.globalData || {}
			if (!globalData.value.discoveredLocations) {
				globalData.value.discoveredLocations = {
					cybercity: ['factory', 'home'],
					newworld: ['carne_village'],
					carne: ['carne_village_entrance']
				}
			}
			if (!globalData.value.sceneHotspots) {
				globalData.value.sceneHotspots = {}
			}
			if (saveData.globalData?.quests) {
				useQuests().loadQuestsState(saveData.globalData.quests)
			}
			if (saveData.globalData?.encyclopedia) {
				useEncyclopedia().loadState(saveData.globalData.encyclopedia)
			}
			// Notify outside listeners (Game.vue) about restored global data
			if (emit) {
				console.log(
					'📤 Emitting global-data-changed after restoreGameState',
					globalData.value
				)
				emit('global-data-changed', globalData.value)
			}
			if (saveData.characterDataDelta) {
				Object.keys(saveData.characterDataDelta).forEach((characterId) => {
					if (characterData.value[characterId])
						Object.assign(
							characterData.value[characterId],
							saveData.characterDataDelta[characterId]
						)
				})
			}
			if (saveData.characterData && !saveData.characterDataDelta) {
				Object.keys(saveData.characterData).forEach((characterId) => {
					if (characterData.value[characterId])
						Object.assign(
							characterData.value[characterId],
							saveData.characterData[characterId]
						)
				})
			}
			// Rebuild equipment BEFORE restoring visible characters so they get the updated equipmentBySlot
			Object.keys(characterData.value).forEach((charId) => {
				rebuildEquipmentBySlot(charId)
			})

			visibleCharacters.value = []
			if (saveData.visibleCharacters && Array.isArray(saveData.visibleCharacters)) {
				// Handle both old format (array of IDs) and new format (array of display objects)
				if (saveData.visibleCharacters.length > 0) {
					const firstItem = saveData.visibleCharacters[0]

					if (typeof firstItem === 'string') {
						// Old format: array of character IDs - just get the character from characterData
						saveData.visibleCharacters.forEach((characterId) => {
							const character = characterData.value[characterId]
							if (character) visibleCharacters.value.push(character)
						})
					} else if (typeof firstItem === 'object' && firstItem.id) {
						// New format: array of display objects - restore characters with display properties
						saveData.visibleCharacters.forEach((displayData) => {
							const character = characterData.value[displayData.id]
							if (character) {
								// Apply display properties from saved data directly to original character
								if (displayData.position !== undefined)
									character.position = displayData.position
								if (displayData.orientation !== undefined)
									character.orientation = displayData.orientation
								if (displayData.back !== undefined)
									character.back = displayData.back
								if (displayData.customClass !== undefined)
									character.customClass = displayData.customClass
								if (displayData.scale !== undefined)
									character.scale = displayData.scale
								visibleCharacters.value.push(character)
							}
						})
					}
				}
			}
			if (saveData.currentScene && sceneData.value[saveData.currentScene]) {
				currentScene.value = sceneData.value[saveData.currentScene]
				// Restore scene mods if they were saved
				if (saveData.currentSceneMods && Array.isArray(saveData.currentSceneMods)) {
					currentScene.value.mods = saveData.currentSceneMods
				}
			}
			// Restore UI visibility if present in save; otherwise enable core UI by default
			if (saveData.uiVisibility && typeof saveData.uiVisibility === 'object') {
				baseUiVisibility.value = { ...baseUiVisibility.value, ...saveData.uiVisibility }
			} else {
				baseUiVisibility.value = {
					...baseUiVisibility.value,
					topbar: true,
					hotbar: true,
					dialogue: true
				}
			}
			currentDialogue.value = ''
			currentNarration.value = ''
			multiStepDialogueBuffer.value = ''
			multiStepPrintedLength.value = 0
			currentTitle.value = ''
			if (titleTimeout) {
				clearTimeout(titleTimeout)
				titleTimeout = null
			}
			currentSpeaker.value = ''
			currentChoices.value = []
			callStack.value = saveData.callStack || []

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

			if (saveData.history && Array.isArray(saveData.history))
				historyEntries.value = saveData.history.slice(-HISTORY_MAX)
			else {
				historyEntries.value = []
				for (
					let i = 0;
					i < stepIndex.value && i < (storyData.value.steps || []).length;
					i++
				) {
					const s = storyData.value.steps[i]
					if (!s) continue
					switch (s.type) {
						case 'dialogue':
							// Handle dialogue with steps
							if (s.steps && Array.isArray(s.steps)) {
								s.steps.forEach((step, stepIdx) => {
									if (step.text) {
										const speaker = resolveSpeakerTitle(
											step.character || s.character,
											step.title || step.speaker || s.title || s.speaker
										)
										const text = substituteVariables(step.text)
										historyEntries.value.push({
											type: 'dialogue',
											speaker,
											text,
											stepIndex: `${i}_${stepIdx}`
										})
									}
								})
							} else if (s.character || s.title || s.speaker) {
								const speaker = resolveSpeakerTitle(s.character, s.title || s.speaker)
								const text = substituteVariables(s.text || '')
								historyEntries.value.push({
									type: 'dialogue',
									speaker,
									text,
									stepIndex: i
								})
							} else {
								const text = substituteVariables(s.text || '')
								historyEntries.value.push({
									type: 'narration',
									speaker: '',
									text,
									stepIndex: i
								})
							}
							break
						case 'titles':
							historyEntries.value.push({
								type: 'titles',
								speaker: '',
								text: substituteVariables(s.text || ''),
								stepIndex: i
							})
							break
						default:
							break
					}
				}
				if (historyEntries.value.length > HISTORY_MAX)
					historyEntries.value = historyEntries.value.slice(-HISTORY_MAX)
			}

			// Restore audio streams (only looping ones)
			audioStreams.value = {}
			if (saveData.audioStreams && typeof saveData.audioStreams === 'object') {
				Object.entries(saveData.audioStreams).forEach(([streamId, stream]) => {
					if (stream && stream.loop) {
						console.log(`🔄 Restoring audio stream: ${streamId}`)
						audioStreams.value[streamId] = stream
					}
				})
			}

			if (fadeTimeout) {
				clearTimeout(fadeTimeout)
				fadeTimeout = null
			}
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
		globalData.value = {
			discoveredLocations: {
				cybercity: ['factory', 'home'],
				newworld: ['carne_village'],
				carne: ['carne_village_entrance']
			},
			sceneHotspots: {}
		}
		historyEntries.value = []
		audioStreams.value = {}
		pausedStreams.value = {}
		if (fadeTimeout) {
			clearTimeout(fadeTimeout)
			fadeTimeout = null
		}
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
		if (emit) {
			emit('global-data-changed', globalData.value)
		}
		return { nextPeriod, dayIncremented, nextFormatted }
	}

	function discoverLocation(mapId, locationInput, options = {}) {
		if (!mapId || !locationInput) return false

		if (!globalData.value) {
			globalData.value = {}
		}
		if (!globalData.value.discoveredLocations) {
			globalData.value.discoveredLocations = {}
		}
		if (!Array.isArray(globalData.value.discoveredLocations[mapId])) {
			globalData.value.discoveredLocations[mapId] = []
		}

		const list = globalData.value.discoveredLocations[mapId]
		const locationsToAdd = Array.isArray(locationInput) ? locationInput : [locationInput]
		const newlyDiscovered = []

		locationsToAdd.forEach((locId) => {
			if (locId && typeof locId === 'string' && !list.includes(locId)) {
				list.push(locId)
				newlyDiscovered.push(locId)
			}
		})

		if (newlyDiscovered.length > 0) {
			console.log(`🗺 [Location Discovered] map="${mapId}":`, newlyDiscovered)

			if (options.notification || options.title || options.notify) {
				const label =
					options.title ||
					(typeof options.notification === 'string'
						? options.notification
						: null)
				if (label || options.notification) {
					const notifText =
						typeof options.notification === 'string'
							? options.notification
							: `<p><b>📍 Открыта новая локация</b></p><p>${label}</p>`
					showNotification(notifText, 'info', options.duration || 3500)
				}
			}

			if (emit) {
				emit('global-data-changed', globalData.value)
			}
			return true
		}
		return false
	}

	function isLocationDiscovered(mapId, locationId) {
		if (!globalData.value?.discoveredLocations) return false
		const list = globalData.value.discoveredLocations[mapId]
		return Array.isArray(list) && list.includes(locationId)
	}

	function setHotspotStatus(sceneId, hotspotId, status = 'active', lockedAction = null) {
		if (!sceneId || !hotspotId) return

		if (!globalData.value) {
			globalData.value = {}
		}
		if (!globalData.value.sceneHotspots) {
			globalData.value.sceneHotspots = {}
		}
		if (!globalData.value.sceneHotspots[sceneId]) {
			globalData.value.sceneHotspots[sceneId] = {}
		}

		if (lockedAction) {
			globalData.value.sceneHotspots[sceneId][hotspotId] = {
				status,
				lockedAction
			}
		} else {
			globalData.value.sceneHotspots[sceneId][hotspotId] = status
		}

		console.log(
			`🚪 [Hotspot Updated] scene="${sceneId}" id="${hotspotId}" status="${status}"`
		)

		if (emit) {
			emit('global-data-changed', globalData.value)
		}
	}

	function getHotspotStatus(sceneId, hotspot) {
		if (!sceneId || !hotspot) return 'active'
		const hotspotId = typeof hotspot === 'string' ? hotspot : hotspot.id
		if (!hotspotId) return 'active'

		// 1. Saved delta override in globalData.sceneHotspots
		const delta = globalData.value?.sceneHotspots?.[sceneId]?.[hotspotId]
		if (delta !== undefined && delta !== null) {
			if (typeof delta === 'string') return delta
			if (typeof delta === 'object' && delta.status) return delta.status
		}

		if (typeof hotspot === 'string') return 'active'

		// 2. Dynamic condition
		if (hotspot.condition) {
			const isPassed = evaluateCondition(hotspot.condition)
			return isPassed ? 'active' : hotspot.fallbackStatus || 'locked'
		}

		// 3. Static status
		return hotspot.status || 'active'
	}

	function handleHotspotStep(step) {
		if (!step || typeof step !== 'object') return
		const sceneId =
			step.scene ||
			step.sceneId ||
			(currentScene.value ? currentScene.value.id : null)
		const hotspotId = step.id || step.hotspot || step.hotspotId
		if (!sceneId || !hotspotId) {
			console.warn('⚠️ [Hotspot Step] Missing scene or hotspot id:', step)
			return
		}

		let status = step.status
		if (step.type === 'unlock-hotspot' || step.type === 'show-hotspot') {
			status = 'active'
		} else if (step.type === 'lock-hotspot') {
			status = 'locked'
		} else if (step.type === 'hide-hotspot') {
			status = 'hidden'
		} else if (!status) {
			status = 'active'
		}

		let lockedAction = step.lockedAction || null
		if (!lockedAction && (step.text || step.sound || step.notification || step.goto)) {
			lockedAction = {
				text: step.text,
				sound: step.sound,
				notification: step.notification,
				notificationType: step.notificationType || 'warning',
				duration: step.duration,
				goto: step.goto
			}
		}

		setHotspotStatus(sceneId, hotspotId, status, lockedAction)
	}

	function handleHotspotClick(sceneId, hotspot) {
		if (!hotspot) return
		const resolvedSceneId = sceneId || currentScene.value?.id
		const status = getHotspotStatus(resolvedSceneId, hotspot)

		if (status === 'active') {
			let target = hotspot.target
			const scene = sceneData.value?.[resolvedSceneId] || currentScene.value
			const localMap = scene?.localMap || globalData.value?.localMap
			if (localMap && globalData.value?.mapOverrides?.[localMap]) {
				const overrides = globalData.value.mapOverrides[localMap]
				const overrideKey = hotspot.locationId || hotspot.target || hotspot.id
				if (overrides[overrideKey]) {
					target = overrides[overrideKey]
				}
			}
			if (target) {
				goToLabel(target)
			}
		} else if (status === 'locked') {
			const delta = globalData.value?.sceneHotspots?.[resolvedSceneId]?.[hotspot.id]
			const lockedAction =
				typeof delta === 'object' && delta?.lockedAction
					? delta.lockedAction
					: hotspot.lockedAction || {}

			if (lockedAction.sound) {
				playSound({ file: lockedAction.sound, loop: false })
			}
			if (lockedAction.notification) {
				showNotification(
					lockedAction.notification,
					lockedAction.notificationType || 'warning',
					lockedAction.duration || 3000
				)
			}
			if (lockedAction.text) {
				showNarration(lockedAction.text)
			}
			if (lockedAction.goto) {
				goToLabel(lockedAction.goto)
			}
		}
	}

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
		// UI methods for dialogue hiding
		setDialogueHideUI,
		resolveSpeakerTitle,
		// history helpers
		getHistory: () => historyEntries.value.slice(),
		clearHistory: () => {
			historyEntries.value = []
		}
	}
}
