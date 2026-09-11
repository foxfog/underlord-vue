import { extractVisibleCharacterDisplay } from '../utils/saveGameUtils'
import { useQuests } from '../composables/useQuests'
import { useEncyclopedia } from '../composables/useEncyclopedia'
import { useNpcSchedule } from '../composables/useNpcSchedule'

/**
 * Service for serializing and deserializing Visual Novel game state.
 */
export const saveManager = {
	/**
	 * Creates a complete serializable snapshot of the current game state.
	 */
	serializeGameStateSnapshot({
		storyData,
		storyPath,
		stepIndex,
		callStack,
		globalData,
		characterData,
		visibleCharacters,
		currentScene,
		historyEntries = [],
		audioStreams = {},
		baseUiVisibility = {}
	}) {
		// Save only active looping streams (that should resume on load)
		const activeLoopingStreams = {}
		Object.entries(audioStreams || {}).forEach(([streamId, stream]) => {
			if (stream && stream.loop) {
				activeLoopingStreams[streamId] = { ...stream }
			}
		})
		console.log(
			'💾 getGameState called, saving audio streams:',
			Object.keys(activeLoopingStreams)
		)

		if (globalData) {
			globalData.quests = useQuests().getQuestsState()
			globalData.encyclopedia = useEncyclopedia().getState()
			globalData.npcStates = useNpcSchedule().getState()
		}

		return {
			storyData,
			storyPath,
			stepIndex,
			callStack,
			globalData,
			characterData,
			visibleCharacters: extractVisibleCharacterDisplay(visibleCharacters || []),
			currentScene: currentScene?.id || currentScene,
			currentSceneMods: currentScene?.mods || [],
			history: Array.isArray(historyEntries) ? historyEntries.slice() : [],
			audioStreams: activeLoopingStreams,
			uiVisibility: { ...baseUiVisibility }
		}
	},

	/**
	 * Restores persistent state from saveData into the provided reactive contexts.
	 */
	applyRestoredState(saveData, context) {
		const {
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
			HISTORY_MAX = 100,
			storySteps = [],
			emit
		} = context

		// 1. Global data
		const restoredGlobal = saveData.globalData || saveData.global || {}
		if (!restoredGlobal.discoveredLocations) {
			restoredGlobal.discoveredLocations = {
				cybercity: ['factory', 'home'],
				newworld: ['carne_village'],
				carne: ['carne_village_entrance']
			}
		}
		if (!restoredGlobal.sceneHotspots) {
			restoredGlobal.sceneHotspots = {}
		}
		globalData.value = restoredGlobal

		if (saveData.globalData?.quests) {
			useQuests().loadQuestsState(saveData.globalData.quests)
		}
		if (saveData.globalData?.encyclopedia) {
			useEncyclopedia().loadState(saveData.globalData.encyclopedia)
		}
		if (saveData.globalData?.npcStates) {
			useNpcSchedule().loadState(saveData.globalData.npcStates)
		}

		if (emit) {
			console.log(
				'📤 Emitting global-data-changed after restoreGameState',
				globalData.value
			)
			emit('global-data-changed', globalData.value)
		}

		// 2. Character data (delta or full)
		if (saveData.characterDataDelta && characterData?.value) {
			Object.keys(saveData.characterDataDelta).forEach((characterId) => {
				if (characterData.value[characterId]) {
					Object.assign(
						characterData.value[characterId],
						saveData.characterDataDelta[characterId]
					)
				}
			})
		}
		if (saveData.characterData && !saveData.characterDataDelta && characterData?.value) {
			Object.keys(saveData.characterData).forEach((characterId) => {
				if (characterData.value[characterId]) {
					Object.assign(
						characterData.value[characterId],
						saveData.characterData[characterId]
					)
				}
			})
		}

		// Rebuild equipment BEFORE restoring visible characters
		if (characterData?.value && rebuildEquipmentBySlot) {
			Object.keys(characterData.value).forEach((charId) => {
				rebuildEquipmentBySlot(charId)
			})
		}

		// 3. Visible characters
		visibleCharacters.value = []
		if (saveData.visibleCharacters && Array.isArray(saveData.visibleCharacters)) {
			if (saveData.visibleCharacters.length > 0) {
				const firstItem = saveData.visibleCharacters[0]
				if (typeof firstItem === 'string') {
					saveData.visibleCharacters.forEach((characterId) => {
						const character = characterData?.value?.[characterId]
						if (character) visibleCharacters.value.push(character)
					})
				} else if (typeof firstItem === 'object' && firstItem.id) {
					saveData.visibleCharacters.forEach((displayData) => {
						const character = characterData?.value?.[displayData.id]
						if (character) {
							if (displayData.position !== undefined) character.position = displayData.position
							if (displayData.orientation !== undefined) character.orientation = displayData.orientation
							if (displayData.back !== undefined) character.back = displayData.back
							if (displayData.customClass !== undefined) character.customClass = displayData.customClass
							if (displayData.scale !== undefined) character.scale = displayData.scale
							visibleCharacters.value.push(character)
						}
					})
				}
			}
		}

		// 4. Current scene and mods
		if (saveData.currentScene && sceneData?.value?.[saveData.currentScene]) {
			currentScene.value = sceneData.value[saveData.currentScene]
			if (saveData.currentSceneMods && Array.isArray(saveData.currentSceneMods)) {
				currentScene.value.mods = saveData.currentSceneMods
			}
		}

		// 5. UI visibility
		if (saveData.uiVisibility && typeof saveData.uiVisibility === 'object') {
			baseUiVisibility.value = { ...baseUiVisibility.value, ...saveData.uiVisibility }
		} else {
			const isNewWorld =
				globalData.value?.calendarType === 'new_world' || globalData.value?.year === 0
			baseUiVisibility.value = {
				...baseUiVisibility.value,
				'date-badge': !isNewWorld,
				'calendar-button': !isNewWorld,
				topbar: true,
				hotbar: true,
				dialogue: true
			}
		}

		// 6. Call stack
		if (callStack) {
			callStack.value = saveData.callStack || []
		}

		// 7. History
		if (saveData.history && Array.isArray(saveData.history)) {
			historyEntries.value = saveData.history.slice(-HISTORY_MAX)
		} else {
			historyEntries.value = []
			const targetStepIndex = saveData.stepIndex || 0
			for (let i = 0; i < targetStepIndex && i < storySteps.length; i++) {
				const s = storySteps[i]
				if (!s) continue
				switch (s.type) {
					case 'dialogue':
						if (s.steps && Array.isArray(s.steps)) {
							s.steps.forEach((step, stepIdx) => {
								if (step.text) {
									const speaker = resolveSpeakerTitle
										? resolveSpeakerTitle(
												step.character || s.character,
												step.title || step.speaker || s.title || s.speaker
										  )
										: (step.character || s.character || '')
									const text = substituteVariables
										? substituteVariables(step.text)
										: step.text
									historyEntries.value.push({
										type: 'dialogue',
										speaker,
										text,
										stepIndex: `${i}_${stepIdx}`
									})
								}
							})
						} else if (s.character || s.title || s.speaker) {
							const speaker = resolveSpeakerTitle
								? resolveSpeakerTitle(s.character, s.title || s.speaker)
								: (s.character || '')
							const text = substituteVariables
								? substituteVariables(s.text || '')
								: (s.text || '')
							historyEntries.value.push({
								type: 'dialogue',
								speaker,
								text,
								stepIndex: i
							})
						} else {
							const text = substituteVariables
								? substituteVariables(s.text || '')
								: (s.text || '')
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
							text: substituteVariables ? substituteVariables(s.text || '') : (s.text || ''),
							stepIndex: i
						})
						break
					default:
						break
				}
			}
			if (historyEntries.value.length > HISTORY_MAX) {
				historyEntries.value = historyEntries.value.slice(-HISTORY_MAX)
			}
		}

		// 8. Audio streams
		if (audioStreams) {
			audioStreams.value = {}
			if (saveData.audioStreams && typeof saveData.audioStreams === 'object') {
				Object.entries(saveData.audioStreams).forEach(([streamId, stream]) => {
					if (stream && stream.loop) {
						console.log(`🔄 Restoring audio stream: ${streamId}`)
						audioStreams.value[streamId] = stream
					}
				})
			}
		}
	}
}
