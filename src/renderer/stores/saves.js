import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createCharacterDefaults } from '../utils/saveGameUtils'
import { saveService, createSaveFile, serializeGameState } from '../services/saveService'

export const useSavesStore = defineStore('saves', () => {
	const saves = ref(new Map()) // Map<slotNumber, saveData>
	const currentSlotNumber = ref(null)
	const pendingLoad = ref(null)
	const characterDefaults = ref({}) // Сохраняем дефолтные значения персонажей

	// Сохраняем дефолты персонажей для оптимизации дельты в save files
	const setCharacterDefaults = (characterData) => {
		try {
			characterDefaults.value = createCharacterDefaults(characterData)
			console.log('✔ Character defaults set:', Object.keys(characterDefaults.value))
			return { success: true }
		} catch (err) {
			console.error('Failed to set character defaults:', err)
			return { success: false, error: err.message }
		}
	}

	// Save game state to slot — delegated to saveService
	const saveGame = async (slotNumber, gameState, mcName) => {
		try {
			console.log('💾 saves.saveGame - gameState.audioStreams:', Object.keys(gameState.audioStreams || {}))
			const saveFile = createSaveFile(slotNumber, gameState, mcName, characterDefaults.value)
			console.log('💾 saves.saveGame - saveFile.gameState.audioStreams:', Object.keys(saveFile.gameState.audioStreams || {}))
			const result = await saveService.saveGame(slotNumber, saveFile)

			if (result.success) {
				saves.value.set(slotNumber, saveFile)
				currentSlotNumber.value = slotNumber
				console.log('✔ Save added to store, slot:', slotNumber)
				return { success: true, data: saveFile }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to save game:', error)
			return { success: false, error: error.message }
		}
	}

	// Load game state from slot
	const loadGame = async (slotNumber) => {
		try {
			const result = await saveService.loadGame(slotNumber)

			if (result.success) {
				const saveFile = result.data
				saves.value.set(slotNumber, saveFile)
				currentSlotNumber.value = slotNumber
				// update pendingLoad for consumers that navigate to game
				pendingLoad.value = saveFile
				return { success: true, data: saveFile }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to load game:', error)
			return { success: false, error: error.message }
		}
	}

	// Delete save file
	const deleteSave = async (slotNumber) => {
		try {
			const result = await saveService.deleteSave(slotNumber)

			if (result.success) {
				saves.value.delete(slotNumber)
				if (currentSlotNumber.value === slotNumber) {
					currentSlotNumber.value = null
				}
				return { success: true }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to delete save:', error)
			return { success: false, error: error.message }
		}
	}

	// List all saves
	const listSaves = async () => {
		try {
			const result = await saveService.listSaves()
			console.log('listSaves IPC result:', result)

			if (result.success) {
				saves.value.clear()
				result.data.forEach((saveFile) => {
					console.log('Loading save from disk - slot:', saveFile.slot, 'mcName:', saveFile.mcName)
					saves.value.set(saveFile.slot, saveFile)
				})
				console.log('✔ Saves list updated, total:', saves.value.size)
				console.log('✔ Saves map keys:', Array.from(saves.value.keys()))
				return { success: true, data: Array.from(saves.value.values()) }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to list saves:', error)
			return { success: false, error: error.message }
		}
	}

	// Get save by slot number
	const getSave = (slotNumber) => {
		return saves.value.get(slotNumber)
	}

	// Get all saves sorted by slot
	const allSaves = computed(() => {
		return Array.from(saves.value.values()).sort((a, b) => a.slot - b.slot)
	})

	// Check if slot has save
	const hasSave = (slotNumber) => {
		return saves.value.has(slotNumber)
	}

	const getPendingLoad = () => pendingLoad.value
	const takePendingLoad = () => {
		const val = pendingLoad.value
		pendingLoad.value = null
		return val
	}

	return {
		saves,
		currentSlotNumber,
		saveGame,
		loadGame,
		deleteSave,
		listSaves,
		getSave,
		allSaves,
		hasSave,
		serializeGameState,
		createSaveFile,
		setCharacterDefaults,
		pendingLoad,
		getPendingLoad,
		takePendingLoad,
	}
})
