import { ref } from 'vue'
import { calculateEquipmentBySlot } from '../../utils/equipment'
import { getCharacterAnimation, normalizeAnimationDefinition } from '../../utils/character/characterAnimationEngine'

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
			if (step.orientation) {
				character.orientation = step.orientation
			} else if (!character.orientation) {
				character.orientation = character.defaultOrientation || 'right'
			}

			// Set back flag
			character.back = step.back ?? false

			// Apply scale if provided, or reset to default size
			if (typeof step === 'object' && step.scale !== undefined) {
				character.scale = step.scale
				character.stepScale = step.scale
			} else {
				character.scale = character.size || 1
				character.stepScale = null
			}

			// Apply class if provided
			if (step.class && typeof step === 'object') {
				character.customClass = step.class
			}

			// Apply floorOffset or bleed if provided in step
			if (step.floorOffset !== undefined) {
				character.floorOffset = step.floorOffset
			} else if (step.position?.floorOffset !== undefined) {
				character.floorOffset = step.position.floorOffset
			}
			if (step.bleed !== undefined) {
				character.bleed = step.bleed
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

		const baseDuration = step.duration !== undefined ? Number(step.duration) : 0.5
		const repeat = step.repeat || 'once'
		const repeatCount = Math.max(1, Number(step.repeatCount || 1))
		let totalDurationSec = baseDuration
		if (repeat === 'count') {
			totalDurationSec = baseDuration * repeatCount
		} else if (repeat === 'pingpong' && step.repeatCount) {
			totalDurationSec = baseDuration * 2 * repeatCount
		}
		const durationMs = repeat === 'loop' ? (step.duration ? step.duration * 1000 : 0) : totalDurationSec * 1000

		const animConfig = {
			styles: step.styles || null,
			class: step.class || null,
			keyframes: step.keyframes || null,
			tracks: step.tracks || null,
			duration: baseDuration,
			repeat,
			repeatCount,
			animationDuration: durationMs,
			startTime: performance.now()
		}

		character.partAnimations[partName] = animConfig

		// Sync with visibleCharacters array so Canvas re-renders immediately
		const visIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = {
				...visibleCharacters.value[visIndex],
				partAnimations: { ...character.partAnimations }
			}
		}

		console.log(
			`🎬 [${characterId}] Part animation: part=${partName}, class=${animConfig.class}, duration=${baseDuration}s, repeat=${repeat}, repeatCount=${repeatCount}`
		)

		if (durationMs > 0) {
			scheduleTimer(() => {
				if (character.partAnimations && character.partAnimations[partName]) {
					delete character.partAnimations[partName]
					const vIdx = visibleCharacters.value.findIndex((c) => c.id === characterId)
					if (vIdx !== -1) {
						visibleCharacters.value[vIdx] = {
							...visibleCharacters.value[vIdx],
							partAnimations: { ...character.partAnimations }
						}
					}
					console.log(`🎬 [${characterId}] Part animation cleared: part=${partName}`)
				}
			}, durationMs)
		}
	}

	function playCharacterAnimation(step) {
		const characterId = step.character
		const animId = step.animation || step.id
		const character = characterData.value[characterId]
		if (!character || !animId) return

		const animDef = getCharacterAnimation(animId) || (step.tracks || step.keyframes ? normalizeAnimationDefinition(step) : null)
		const baseDuration = step.duration !== undefined ? Number(step.duration) : (animDef?.duration || (animId === 'cough' ? 1.3 : 0.5))
		const repeat = step.repeat || animDef?.repeat || 'once'
		const repeatCount = Math.max(1, Number(step.repeatCount || animDef?.repeatCount || 1))

		let totalDurationSec = baseDuration
		if (repeat === 'count') {
			totalDurationSec = baseDuration * repeatCount
		} else if (repeat === 'pingpong' && step.repeatCount) {
			totalDurationSec = baseDuration * 2 * repeatCount
		}
		const durationMs = repeat === 'loop' ? (step.duration ? step.duration * 1000 : 0) : totalDurationSec * 1000

		if (!character.partAnimations) {
			character.partAnimations = {}
		}

		const animConfig = {
			animation: animId,
			class: animId,
			duration: baseDuration,
			repeat,
			repeatCount,
			animationDuration: durationMs,
			startTime: performance.now(),
			tracks: step.tracks || animDef?.tracks || null,
			keyframes: step.keyframes || null,
			styles: step.styles || null
		}

		const targetParts = []
		if (animDef && Array.isArray(animDef.tracks) && animDef.tracks.length > 0) {
			for (const track of animDef.tracks) {
				if (track.target) {
					character.partAnimations[track.target] = { ...animConfig }
					targetParts.push(track.target)
				}
			}
		} else if (animId === 'cough') {
			character.partAnimations['neck'] = animConfig
			character.partAnimations['head'] = { ...animConfig }
			targetParts.push('neck', 'head')
		} else if (animId === 'tremble') {
			character.partAnimations['body'] = animConfig
			targetParts.push('body')
		} else if (step.tracks && Array.isArray(step.tracks)) {
			for (const track of step.tracks) {
				if (track.target) {
					character.partAnimations[track.target] = {
						...animConfig,
						styles: track.styles || null,
						class: track.class || null
					}
					targetParts.push(track.target)
				}
			}
		} else {
			const targetPart = step.part || 'head'
			character.partAnimations[targetPart] = animConfig
			targetParts.push(targetPart)
		}

		// Sync with visibleCharacters array
		const visIndex = visibleCharacters.value.findIndex((c) => c.id === characterId)
		if (visIndex !== -1) {
			visibleCharacters.value[visIndex] = {
				...visibleCharacters.value[visIndex],
				partAnimations: { ...character.partAnimations }
			}
		}

		console.log(
			`🎬 [${characterId}] Character animation: ${animId}, duration=${baseDuration}s, repeat=${repeat}, repeatCount=${repeatCount}`
		)

		if (durationMs > 0) {
			scheduleTimer(() => {
				if (character.partAnimations) {
					for (const p of targetParts) {
						delete character.partAnimations[p]
					}
					const vIdx = visibleCharacters.value.findIndex((c) => c.id === characterId)
					if (vIdx !== -1) {
						visibleCharacters.value[vIdx] = {
							...visibleCharacters.value[vIdx],
							partAnimations: { ...character.partAnimations }
						}
					}
				}
			}, durationMs)
		}
	}

	return {
		visibleCharacters,
		showCharacter,
		hideCharacter,
		animateCharacterPart,
		playCharacterAnimation,
		rebuildEquipmentBySlot,
		syncCharacterEquipment,
		clearAllTimers
	}
}
