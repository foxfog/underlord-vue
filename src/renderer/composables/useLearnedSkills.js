import { computed, unref } from 'vue'
import talentsData from '@data/skills/talents/talents.json'
import skillsCatalogData from '@data/skills/skills.json'
import { useSkillTree } from './useSkillTree'
import { collectLearnedSkills } from '../utils/equipmentManager'

/**
 * Reactive `learnedSkills` array of a character (talents + skill-tree skills).
 * It is the input for slot limits / grip checks of the equipment manager and for
 * `calculateCharacterStats({ learnedSkills })`.
 *
 * @param {import('vue').Ref<Object|null>|Object|null} characterRef
 * @param {string} [characterId='mc'] skill-tree progression key
 * @returns {import('vue').ComputedRef<Array<Object>>}
 */
export function useLearnedSkills(characterRef, characterId = 'mc') {
	const { charactersProgression, skillsCatalog } = useSkillTree()

	return computed(() => {
		const treeCatalog = Array.isArray(skillsCatalog.value) ? skillsCatalog.value : []
		const catalog = treeCatalog.length ? treeCatalog : skillsCatalogData
		return collectLearnedSkills({
			character: unref(characterRef),
			talentsRegistry: talentsData,
			skillsCatalog: Array.isArray(catalog) ? catalog : [],
			progressionSkills: charactersProgression.value?.[characterId]?.skills || {}
		})
	})
}
