import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createCharacterDefaults } from '../utils/saveGameUtils'
import { saveService, createSaveFile, serializeGameState } from '../services/saveService'

// Таб "Б" содержит 9 слотов (0..8): слот 0 — автосохранение, слоты 1..8 — быстрые сохранения
const QUICK_PAGE_SLOTS_COUNT = 9
const AUTO_SAVE_SLOT = 0
const QUICK_SAVE_MIN_SLOT = 1
const QUICK_SAVE_MAX_SLOT = 8
const QUICK_SAVE_SLOTS_COUNT = QUICK_SAVE_MAX_SLOT - QUICK_SAVE_MIN_SLOT + 1 // 8 слотов

export const useSavesStore = defineStore('saves', () => {
	const saves = ref(new Map()) // Map<slotNumber | string, saveData>
	const profiles = ref([]) // Array<{ id, folder, name, saveCount, updatedAt, ... }>
	const currentProfile = ref(null) // Активный профиль текущего персонажа/прохождения
	const selectedProfileFolder = ref(null) // Текущий фильтр в интерфейсе сохранений ('all' или имя папки)
	const currentSlotNumber = ref(null)
	const pendingLoad = ref(null)
	const characterDefaults = ref({})
	const isInitialized = ref(false)

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

	// ── Управление профилями (Skyrim style) ─────────────────────────────────────
	const listProfiles = async () => {
		try {
			const result = await saveService.listProfiles()
			if (result.success) {
				profiles.value = result.data || []
				// Если активный фильтр не установлен, выбираем текущий профиль или самый свежий
				if (!selectedProfileFolder.value && profiles.value.length > 0) {
					selectedProfileFolder.value =
						currentProfile.value?.folder || profiles.value[0]?.folder || null
				}
				return { success: true, data: profiles.value }
			}
			return { success: false, error: result.error }
		} catch (error) {
			console.error('Failed to list profiles:', error)
			return { success: false, error: error.message }
		}
	}

	const createProfile = async (characterName) => {
		try {
			const result = await saveService.createProfile(characterName)
			if (result.success && result.data) {
				currentProfile.value = result.data
				selectedProfileFolder.value = result.data.folder
				console.log('✔ Профиль установлен как активный:', result.data.folder)
				await listProfiles()
				return { success: true, data: result.data }
			}
			return { success: false, error: result.error }
		} catch (error) {
			console.error('Failed to create profile:', error)
			return { success: false, error: error.message }
		}
	}

	const deleteProfile = async (profileFolder) => {
		try {
			const target = profileFolder || selectedProfileFolder.value
			if (!target) return { success: false, error: 'NO_PROFILE_SPECIFIED' }

			const result = await saveService.deleteProfile(target)
			if (result.success) {
				if (currentProfile.value?.folder === target) {
					currentProfile.value = null
				}
				await listProfiles()
				selectedProfileFolder.value = profiles.value[0]?.folder || null
				await listSaves(selectedProfileFolder.value)
				return { success: true }
			}
			return { success: false, error: result.error }
		} catch (error) {
			console.error('Failed to delete profile:', error)
			return { success: false, error: error.message }
		}
	}

	const selectProfile = async (profileFolder) => {
		selectedProfileFolder.value = profileFolder
		return await listSaves(profileFolder)
	}

	// ── Сохранение / Загрузка ───────────────────────────────────────────────────

	// Сохранение в конкретный слот
	const saveGame = async (
		slotNumber,
		gameState,
		mcName,
		clipRect,
		profileFolder,
		saveType = 'manual'
	) => {
		try {
			// Если профиль ещё не создан, но передано имя персонажа — создаём профиль
			if (!currentProfile.value && mcName && mcName !== 'Unknown') {
				await createProfile(mcName)
			}

			const targetFolder = profileFolder || currentProfile.value?.folder || null
			const saveFile = createSaveFile(
				slotNumber,
				gameState,
				mcName,
				characterDefaults.value,
				saveType,
				targetFolder,
				currentProfile.value?.id
			)

			const result = await saveService.saveGame(slotNumber, saveFile, clipRect, targetFolder)

			if (result.success) {
				saves.value.set(slotNumber, result.data)
				currentSlotNumber.value = slotNumber
				console.log('✔ Save added to store, slot:', slotNumber, 'profile:', targetFolder)
				await listProfiles()
				return { success: true, data: saveFile }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to save game:', error)
			return { success: false, error: error.message }
		}
	}

	// Автосохранение: слот 0 активного профиля
	const saveAuto = async (gameState, mcName, clipRect) => {
		return await saveGame(AUTO_SAVE_SLOT, gameState, mcName, clipRect, null, 'auto')
	}

	// Быстрое сохранение: использует слоты 1-8 активного профиля (не затирая слот 0 автосохранения)
	const saveQuick = async (gameState, mcName, clipRect) => {
		try {
			const targetFolder = currentProfile.value?.folder || selectedProfileFolder.value
			// Обновляем список сохранений если нужно
			if (!isInitialized.value || saves.value.size === 0) {
				await listSaves(targetFolder)
			}

			const existingQuick = quickSaves.value.filter(
				(s) => typeof s.slot === 'number' && s.slot >= QUICK_SAVE_MIN_SLOT && s.slot <= QUICK_SAVE_MAX_SLOT
			)
			let targetSlot = null

			if (existingQuick.length < QUICK_SAVE_SLOTS_COUNT) {
				// Есть свободные слоты в диапазоне 1..8
				const usedSlots = new Set(existingQuick.map((s) => s.slot))
				for (let i = QUICK_SAVE_MIN_SLOT; i <= QUICK_SAVE_MAX_SLOT; i++) {
					if (!usedSlots.has(i)) {
						targetSlot = i
						break
					}
				}
			} else {
				// Все 8 заняты — берём самый старый по дате
				const oldest = existingQuick[existingQuick.length - 1] // отсортированы по timestamp DESC
				if (!oldest) {
					return { success: false, error: 'NO_QUICK_SAVE_SLOT' }
				}
				targetSlot = oldest.slot
				await deleteSave(targetSlot, targetFolder)
			}

			if (targetSlot === null || typeof targetSlot !== 'number') {
				return { success: false, error: 'NO_AVAILABLE_QUICK_SLOT' }
			}

			return await saveGame(targetSlot, gameState, mcName, clipRect, targetFolder, 'quick')
		} catch (error) {
			console.error('Failed to perform quick save:', error)
			return { success: false, error: error.message }
		}
	}

	// Загрузка состояния игры из слота
	const loadGame = async (slotNumber, profileFolder) => {
		try {
			const targetFolder =
				profileFolder !== undefined
					? profileFolder
					: selectedProfileFolder.value === 'all'
						? null
						: selectedProfileFolder.value

			const result = await saveService.loadGame(slotNumber, targetFolder)

			if (result.success) {
				const saveFile = result.data
				saves.value.set(slotNumber, saveFile)
				currentSlotNumber.value = slotNumber
				pendingLoad.value = saveFile

				// Восстанавливаем активный профиль загруженной игры
				if (saveFile.profileFolder) {
					const matched = profiles.value.find((p) => p.folder === saveFile.profileFolder)
					currentProfile.value = matched || {
						id: saveFile.profileId || 1,
						folder: saveFile.profileFolder,
						name: saveFile.mcName || 'Player'
					}
					selectedProfileFolder.value = saveFile.profileFolder
				}

				return { success: true, data: saveFile }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to load game:', error)
			return { success: false, error: error.message }
		}
	}

	// Удаление сохранения
	const deleteSave = async (slotNumber, profileFolder) => {
		try {
			const targetFolder =
				profileFolder !== undefined
					? profileFolder
					: selectedProfileFolder.value === 'all'
						? null
						: selectedProfileFolder.value

			const result = await saveService.deleteSave(slotNumber, targetFolder)

			if (result.success) {
				saves.value.delete(slotNumber)
				if (currentSlotNumber.value === slotNumber) {
					currentSlotNumber.value = null
				}
				await listProfiles()
				return { success: true }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to delete save:', error)
			return { success: false, error: error.message }
		}
	}

	// Список сохранений (по папке профиля или все)
	const listSaves = async (profileFolder) => {
		try {
			const target = profileFolder !== undefined ? profileFolder : selectedProfileFolder.value
			const result = await saveService.listSaves(target)

			if (result.success) {
				saves.value.clear()
				result.data.forEach((saveFile) => {
					// В режиме 'all' сохраняем с ключом folder_slot для исключения коллизий
					if (target === 'all') {
						const key = `${saveFile.profileFolder || 'root'}_${saveFile.slot}`
						saves.value.set(key, saveFile)
					} else {
						saves.value.set(saveFile.slot, saveFile)
					}
				})
				isInitialized.value = true
				console.log('✔ Saves list updated for:', target || 'default', 'total:', saves.value.size)
				return { success: true, data: Array.from(saves.value.values()) }
			} else {
				return { success: false, error: result.error }
			}
		} catch (error) {
			console.error('Failed to list saves:', error)
			return { success: false, error: error.message }
		}
	}

	// Получить сохранение по номеру слота
	const getSave = (slotNumber) => {
		return saves.value.get(slotNumber)
	}

	// Все загруженные сохранения массивом
	const allSavesList = computed(() => {
		return Array.from(saves.value.values()).sort((a, b) => b.timestamp - a.timestamp)
	})

	// Сохранения для таба "Б" (слоты 0-8: 0 = автосохранение, 1-8 = быстрые)
	const quickSaves = computed(() => {
		return Array.from(saves.value.values())
			.filter(
				(saveFile) =>
					typeof saveFile.slot === 'number' &&
					saveFile.slot >= 0 &&
					saveFile.slot <= QUICK_SAVE_MAX_SLOT
			)
			.sort((a, b) => {
				// Автосохранение (слот 0) держим отдельно или сортируем по timestamp
				return b.timestamp - a.timestamp
			})
	})

	// Автосохранение профиля (слот 0)
	const autoSave = computed(() => {
		return saves.value.get(AUTO_SAVE_SLOT) || null
	})

	// Обычные ручные сохранения (слоты >= 9), отсортированные по номеру слота
	const allSaves = computed(() => {
		return Array.from(saves.value.values())
			.filter(
				(saveFile) =>
					typeof saveFile.slot === 'number' &&
					saveFile.slot > QUICK_SAVE_MAX_SLOT
			)
			.sort((a, b) => a.slot - b.slot)
	})

	// Проверка наличия сохранения
	const hasSave = (slotNumber) => {
		return saves.value.has(slotNumber)
	}

	// Загрузить самое свежее быстрое сохранение
	const loadLatestQuick = async () => {
		try {
			await listSaves(currentProfile.value?.folder || selectedProfileFolder.value)
			const existingQuick = quickSaves.value.filter(
				(s) => typeof s.slot === 'number' && s.slot >= QUICK_SAVE_MIN_SLOT && s.slot <= QUICK_SAVE_MAX_SLOT
			)

			if (!existingQuick.length) {
				return { success: false, error: 'NO_QUICK_SAVES' }
			}

			const latest = existingQuick[0]
			if (!latest || typeof latest.slot !== 'number') {
				return { success: false, error: 'INVALID_QUICK_SAVE' }
			}

			return await loadGame(latest.slot, latest.profileFolder)
		} catch (error) {
			console.error('Failed to load latest quick save:', error)
			return { success: false, error: error.message }
		}
	}

	const getPendingLoad = () => pendingLoad.value
	const takePendingLoad = () => {
		const val = pendingLoad.value
		pendingLoad.value = null
		return val
	}

	return {
		saves,
		profiles,
		currentProfile,
		selectedProfileFolder,
		currentSlotNumber,
		isInitialized,
		allSavesList,
		quickSaves,
		autoSave,
		allSaves,
		hasSave,
		getSave,
		listProfiles,
		createProfile,
		deleteProfile,
		selectProfile,
		saveGame,
		saveAuto,
		saveQuick,
		loadGame,
		deleteSave,
		listSaves,
		loadLatestQuick,
		serializeGameState,
		createSaveFile,
		setCharacterDefaults,
		pendingLoad,
		getPendingLoad,
		takePendingLoad,
		AUTO_SAVE_SLOT,
		QUICK_PAGE_SLOTS_COUNT
	}
})
