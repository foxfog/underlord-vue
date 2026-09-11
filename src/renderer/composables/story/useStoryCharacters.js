import { ref } from 'vue'
import { calculateEquipmentBySlot } from '../../utils/equipment'

export function useStoryCharacters({ characterData } = {}) {
	const visibleCharacters = ref([])
	const activeTimers = new Set()

	function scheduleTimer(fn, delay) {
		const timerId = setTimeout(() => {
			activeTimers.delete(timerId)
			fn()
		}, delay)
		activeTimers.add(timerId)
		return timerId
	}

	function clearAllTimers() {
		for (const timerId of activeTimers) {
			clearTimeout(timerId)
		}
		activeTimers.clear()
	}

	function rebuildEquipmentBySlot(characterId, newSlots = null) {
		const char = characterData.value[characterId]
		if (!char) return

		if (newSlots) {
			char.equipment_slots = { ...newSlots }
		}

		const equipmentBySlot = calculateEquipmentBySlot(char.equipment_slots, char.equipment)
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
			if (characterObj.equipment) {
				char.equipment = [...characterObj.equipment]
			}
		}

		rebuildEquipmentBySlot(characterId)

		const visIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = {
				...visibleCharacters.value[visIndex],
				equipment_slots: { ...(char.equipment_slots || {}) },
				equipmentBySlot: { ...(char.equipmentBySlot || {}) }
			}
		}
	}

	function showCharacter(step) {
		const characterId = step.character || step.id
		const character = characterData.value[characterId]
		if (character) {
			if (step.expression) {
				character.currentEmotion = step.expression
			}
			if (step.pose) {
				character.currentPose = step.pose
			}

			// Apply new slots if provided in step
			if (step.equipment_slots) {
				character.equipment_slots = {
					...character.equipment_slots,
					...step.equipment_slots
				}
			}

			// Handle start position for animation
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

			// Set animation duration
			if (step.from && typeof step === 'object') {
				character.animationDuration = (step.duration ?? 1) * 1000
				scheduleTimer(() => {
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

			// Set orientation
			character.orientation = step.orientation || 'right'

			// Set back flag
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
			clearAllTimers()
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
			const currentPos = character.position ? { ...character.position } : null
			character.fromPosition = currentPos
			character.position = stepOrId.to
			const durationMs = (stepOrId.duration || 0) * 1000
			character.animationDuration = durationMs

			if (!visibleCharacters.value.some((c) => c.id === characterId)) {
				visibleCharacters.value.push(character)
			}

			if (durationMs > 0) {
				scheduleTimer(() => {
					visibleCharacters.value = visibleCharacters.value.filter(
						(c) => c.id !== characterId
					)
					character.fromPosition = null
					character.animationDuration = null
				}, durationMs)
			} else {
				visibleCharacters.value = visibleCharacters.value.filter(
					(c) => c.id !== characterId
				)
			}
		} else {
			visibleCharacters.value = visibleCharacters.value.filter((c) => c.id !== characterId)
		}
	}

	function animateCharacterPart(step) {
		const characterId = step.character
		const partName = step.part
		const character = characterData.value[characterId]

		if (!character) return

		if (!character.partAnimations) {
			character.partAnimations = {}
		}

		const animConfig = {
			styles: step.styles || null,
			class: step.class || null,
			animationDuration: step.duration ? step.duration * 1000 : null
		}

		character.partAnimations[partName] = animConfig

		console.log(
			`🎬 [${characterId}] Part animation: part=${partName}, class=${animConfig.class}, duration=${step.duration}s, styles=${JSON.stringify(animConfig.styles)}`
		)

		if (step.duration && step.duration > 0) {
			const durationMs = step.duration * 1000
			scheduleTimer(() => {
				if (character.partAnimations && character.partAnimations[partName]) {
					delete character.partAnimations[partName]
					console.log(`🎬 [${characterId}] Part animation cleared: part=${partName}`)
				}
			}, durationMs)
		}
	}

	return {
		visibleCharacters,
		showCharacter,
		hideCharacter,
		animateCharacterPart,
		rebuildEquipmentBySlot,
		syncCharacterEquipment,
		clearAllTimers
	}
}
