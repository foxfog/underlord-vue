/**
 * Utility functions for Character Talents (Врождённые таланты персонажей)
 */

/**
 * Extracts talent IDs from a character object safely.
 *
 * @param {Object} character - Character data
 * @returns {Array<string>} Array of talent IDs
 */
export function getCharacterTalentIds(character) {
	if (!character) return []
	if (Array.isArray(character.talents)) {
		return character.talents.map((t) => String(t).trim()).filter(Boolean)
	}
	if (typeof character.talents === 'string') {
		return character.talents
			.split(',')
			.map((t) => t.trim())
			.filter(Boolean)
	}
	return []
}

/**
 * Checks if a character possesses a specific talent ID.
 *
 * @param {Object} character - Character data
 * @param {string} talentId - Talent ID to check
 * @returns {boolean}
 */
export function hasTalent(character, talentId) {
	if (!character || !talentId) return false
	const ids = getCharacterTalentIds(character)
	return ids.includes(String(talentId).trim())
}

/**
 * Checks whether a character has a talent that bypasses equipment requirements
 * (e.g. Nfirea / Enri lore: can equip any magic item ignoring level, class, race, gender restrictions).
 *
 * @param {Object} character - Character data
 * @param {Array<Object>} [talentsRegistry] - Optional registry of talent definitions
 * @returns {boolean} True if character can bypass equip restrictions
 */
export function canCharacterBypassEquipRestrictions(character, talentsRegistry = null) {
	if (!character) return false
	const talentIds = getCharacterTalentIds(character)
	if (talentIds.length === 0) return false

	// Fast check for standard bypass talent ID
	if (talentIds.includes('item_restriction_bypass')) {
		return true
	}

	// Check talent data flags if registry is provided
	if (Array.isArray(talentsRegistry) && talentsRegistry.length > 0) {
		for (const id of talentIds) {
			const found = talentsRegistry.find((t) => t && t.id === id)
			if (found && (found.id === 'item_restriction_bypass' || found.data?.ignore_equip_requirements === true)) {
				return true
			}
		}
	}

	return false
}

/**
 * Resolves full talent objects for a character from a talents registry.
 *
 * @param {Object} character - Character data
 * @param {Array<Object>} talentsRegistry - Full list of talent definitions
 * @returns {Array<Object>} List of resolved talent objects with isTalent: true
 */
export function resolveCharacterTalents(character, talentsRegistry = []) {
	const ids = getCharacterTalentIds(character)
	if (ids.length === 0) return []

	const registry = Array.isArray(talentsRegistry) ? talentsRegistry : []

	return ids.map((id) => {
		const found = registry.find((t) => t && t.id === id)
		if (found) {
			return {
				id: found.id,
				name: found.name || found.id,
				icon: found.icon || '🌟',
				category: found.category || 'passive',
				description: found.description || '',
				data: found.data && typeof found.data === 'object' ? { ...found.data } : {},
				isTalent: true
			}
		}

		return {
			id,
			name: id,
			icon: '🌟',
			category: 'passive',
			description: '',
			data: {},
			isTalent: true
		}
	})
}
