/**
 * src/renderer/composables/useCharacterStats.js
 * 
 * Vue Composable for Character Core Attributes, Active Race Evolution, and Stats Calculation.
 * Supports concise naming (str, end, agi, int, free_points) with full backwards compatibility.
 */

import { ref, computed } from 'vue'
import {
	CORE_ATTRIBUTES,
	DEFAULT_ATTRIBUTES,
	ATTRIBUTE_POINTS_PER_LEVEL,
	calculateCharacterStats,
	getRaceStatsConfig,
	normalizeAttributeName
} from '../utils/stats/characterStats.js'

// Singleton reactive store for characters attribute progression
const charactersAttributesState = ref({
	mc: {
		str: 0,
		end: 0,
		agi: 0,
		int: 0,
		strength: 0,
		endurance: 0,
		agility: 0,
		intelligence: 0,
		free_points: 5,
		free_attribute_points: 5,
		active_race: 'human'
	}
})

export function useCharacterStats() {
	function initCharacterStats(characterId, initialData = {}) {
		if (!charactersAttributesState.value[characterId]) {
			const charAttrs = initialData.attributes || initialData
			const str = Number(charAttrs.str ?? charAttrs.strength ?? 0)
			const end = Number(charAttrs.end ?? charAttrs.endurance ?? 0)
			const agi = Number(charAttrs.agi ?? charAttrs.agility ?? 0)
			const int = Number(charAttrs.int ?? charAttrs.intelligence ?? 0)
			const freePts = Number(initialData.free_points ?? initialData.free_attribute_points ?? initialData.attribute_points ?? 5)

			charactersAttributesState.value[characterId] = {
				str,
				end,
				agi,
				int,
				strength: str,
				endurance: end,
				agility: agi,
				intelligence: int,
				free_points: freePts,
				free_attribute_points: freePts,
				active_race: initialData.active_race || (Array.isArray(initialData.races) && initialData.races[0]) || 'human'
			}
		}
		const state = charactersAttributesState.value[characterId]
		for (const attr of CORE_ATTRIBUTES) {
			if (state[attr] === undefined) state[attr] = 0
		}
		// Synchronize aliases
		state.strength = state.str
		state.endurance = state.end
		state.agility = state.agi
		state.intelligence = state.int
		if (state.free_points === undefined) state.free_points = state.free_attribute_points ?? 5
		state.free_attribute_points = state.free_points
		if (!state.active_race) state.active_race = 'human'
		return state
	}

	function getCharacterStatsState(characterId) {
		return initCharacterStats(characterId)
	}

	function getActiveRace(characterId) {
		const state = initCharacterStats(characterId)
		return state.active_race
	}

	function setActiveRace(characterId, raceId, characterObj = null) {
		const state = initCharacterStats(characterId)
		state.active_race = raceId
		if (characterObj) {
			characterObj.active_race = raceId
		}
		return state.active_race
	}

	function getFreeAttributePoints(characterId) {
		const state = initCharacterStats(characterId)
		return state.free_points
	}

	function addFreeAttributePoints(characterId, amount = 5, characterObj = null) {
		const state = initCharacterStats(characterId)
		state.free_points = Math.max(0, state.free_points + amount)
		state.free_attribute_points = state.free_points
		if (characterObj) {
			characterObj.free_points = state.free_points
			characterObj.free_attribute_points = state.free_points
		}
		return state.free_points
	}

	function investAttribute(characterId, attributeName, amount = 1, characterObj = null) {
		const state = initCharacterStats(characterId)
		const normAttr = normalizeAttributeName(attributeName)
		if (!normAttr) return false
		const actualAmount = Math.min(amount, state.free_points)
		if (actualAmount <= 0) return false

		state[normAttr] += actualAmount
		state.free_points -= actualAmount
		state.free_attribute_points = state.free_points

		// Mirror to aliases
		state.strength = state.str
		state.endurance = state.end
		state.agility = state.agi
		state.intelligence = state.int

		if (characterObj) {
			if (!characterObj.attributes) characterObj.attributes = {}
			characterObj.attributes[normAttr] = state[normAttr]
			const longName = normAttr === 'str' ? 'strength' : normAttr === 'end' ? 'endurance' : normAttr === 'agi' ? 'agility' : 'intelligence'
			characterObj.attributes[longName] = state[normAttr]
			characterObj.free_points = state.free_points
			characterObj.free_attribute_points = state.free_points
		}
		return true
	}

	function refundAttribute(characterId, attributeName, amount = 1, characterObj = null) {
		const state = initCharacterStats(characterId)
		const normAttr = normalizeAttributeName(attributeName)
		if (!normAttr) return false
		const currentVal = state[normAttr] || 0
		const actualAmount = Math.min(amount, currentVal)
		if (actualAmount <= 0) return false

		state[normAttr] -= actualAmount
		state.free_points += actualAmount
		state.free_attribute_points = state.free_points

		// Mirror to aliases
		state.strength = state.str
		state.endurance = state.end
		state.agility = state.agi
		state.intelligence = state.int

		if (characterObj) {
			if (!characterObj.attributes) characterObj.attributes = {}
			characterObj.attributes[normAttr] = state[normAttr]
			const longName = normAttr === 'str' ? 'strength' : normAttr === 'end' ? 'endurance' : normAttr === 'agi' ? 'agility' : 'intelligence'
			characterObj.attributes[longName] = state[normAttr]
			characterObj.free_points = state.free_points
			characterObj.free_attribute_points = state.free_points
		}
		return true
	}

	function resetAttributes(characterId, characterObj = null) {
		const state = initCharacterStats(characterId)
		let refunded = 0
		for (const attr of CORE_ATTRIBUTES) {
			refunded += state[attr] || 0
			state[attr] = 0
		}
		state.strength = 0
		state.endurance = 0
		state.agility = 0
		state.intelligence = 0

		state.free_points += refunded
		state.free_attribute_points = state.free_points

		if (characterObj) {
			characterObj.attributes = {
				str: 0, end: 0, agi: 0, int: 0,
				strength: 0, endurance: 0, agility: 0, intelligence: 0
			}
			characterObj.free_points = state.free_points
			characterObj.free_attribute_points = state.free_points
		}
		return refunded
	}

	function getCalculatedStats(characterId, {
		character = null,
		racesData = [],
		equipmentItems = [],
		buffs = [],
		learnedSkills = [],
		level = null
	} = {}) {
		const state = initCharacterStats(characterId, character || {})
		const charObj = character ? { ...character } : { id: characterId }

		// Overlay reactive attributes & active race
		charObj.attributes = {
			str: state.str,
			end: state.end,
			agi: state.agi,
			int: state.int,
			strength: state.str,
			endurance: state.end,
			agility: state.agi,
			intelligence: state.int
		}
		charObj.active_race = state.active_race

		return calculateCharacterStats({
			character: charObj,
			activeRaceId: state.active_race,
			racesData,
			equipmentItems,
			buffs,
			learnedSkills,
			level
		})
	}

	return {
		CORE_ATTRIBUTES,
		DEFAULT_ATTRIBUTES,
		ATTRIBUTE_POINTS_PER_LEVEL,
		charactersAttributesState,
		initCharacterStats,
		getCharacterStatsState,
		getActiveRace,
		setActiveRace,
		getFreeAttributePoints,
		addFreeAttributePoints,
		investAttribute,
		refundAttribute,
		resetAttributes,
		getCalculatedStats,
		getRaceStatsConfig
	}
}
