// src/renderer/composables/useSkillTree.js
import { ref, computed } from 'vue'
import {
	normalizeSkill,
	normalizeSkillBranch,
	calculateClassLevel,
	getEntityLevel,
	getAvailableSkillPoints,
	canLevelUpEntity,
	levelUpEntity,
	getEntityMaxLevel,
	canLearnSkill,
	learnSkill,
	canRefundSkill,
	refundSkill,
	resetSkills,
	organizeSkillsByGrid
} from '../utils/skillTree.js'

// Singleton reactive state for skill tree system
const charactersList = ref([])
const classesList = ref([])
const racesList = ref([])

const selectedCharacterId = ref('mc')
const selectedEntityType = ref('classes') // 'classes' | 'races'
const selectedEntityId = ref('')
const selectedBranchId = ref('all') // 'all' or branch.id
const selectedSkillId = ref(null)

// Character progression state map:
// { [characterId]: { char_level, level_points, global_skill_points, global_spell_points, skill_points, class_levels, race_levels, entity_points, skills, skill_purchases } }
const charactersProgression = ref({
	mc: {
		char_level: 1,
		level_points: 5,
		global_skill_points: 0,
		global_spell_points: 0,
		skill_points: 5,
		class_levels: { warrior: 1 },
		race_levels: { human: 1 },
		entity_points: {
			warrior: { skill_points: 2, spell_points: 0 },
			human: { skill_points: 1, spell_points: 0 }
		},
		skills: {},
		skill_purchases: {}
	},
	momonga: {
		char_level: 100,
		level_points: 0,
		global_skill_points: 10,
		global_spell_points: 25,
		skill_points: 20,
		class_levels: { necromancer: 15, master_of_death: 10, eclipse: 5 },
		race_levels: { skeleton_mage: 15, elder_lich: 10, overlord: 5 },
		entity_points: {},
		skills: {},
		skill_purchases: {}
	}
})

export function useSkillTree() {
	function initCharacterProgression(charId) {
		if (!charactersProgression.value[charId]) {
			charactersProgression.value[charId] = {
				char_level: 1,
				level_points: 5,
				global_skill_points: 0,
				global_spell_points: 0,
				skill_points: 5,
				class_levels: {},
				race_levels: {},
				entity_points: {},
				skills: {},
				skill_purchases: {}
			}
		}
		const p = charactersProgression.value[charId]
		if (p.char_level === undefined) p.char_level = 1
		if (p.level_points === undefined) p.level_points = 5
		if (p.global_skill_points === undefined) p.global_skill_points = 0
		if (p.global_spell_points === undefined) p.global_spell_points = 0
		if (p.skill_points === undefined) p.skill_points = 5
		if (!p.class_levels) p.class_levels = {}
		if (!p.race_levels) p.race_levels = {}
		if (!p.entity_points) p.entity_points = {}
		if (!p.skills) p.skills = {}
		if (!p.skill_purchases) p.skill_purchases = {}
		return p
	}

	function setEntitiesData({ characters, classes, races }) {
		if (Array.isArray(characters)) charactersList.value = characters
		if (Array.isArray(classes)) classesList.value = classes
		if (Array.isArray(races)) racesList.value = races

		// Auto-select initial entity if none selected
		if (!selectedEntityId.value) {
			const activeList = selectedEntityType.value === 'classes' ? classesList.value : racesList.value
			if (activeList.length > 0) {
				selectedEntityId.value = activeList[0].id
			}
		}
	}

	const currentCharacter = computed(() => {
		return charactersList.value.find((c) => c.id === selectedCharacterId.value) || {
			id: selectedCharacterId.value,
			name: selectedCharacterId.value
		}
	})

	const currentCharacterProgression = computed(() => {
		return initCharacterProgression(selectedCharacterId.value)
	})

	const charLevel = computed({
		get: () => currentCharacterProgression.value.char_level ?? 1,
		set: (val) => {
			currentCharacterProgression.value.char_level = Math.min(100, Math.max(1, val))
		}
	})

	const levelPoints = computed({
		get: () => currentCharacterProgression.value.level_points ?? 0,
		set: (val) => {
			currentCharacterProgression.value.level_points = Math.max(0, val)
		}
	})

	const globalSP = computed({
		get: () => currentCharacterProgression.value.global_skill_points ?? 0,
		set: (val) => {
			currentCharacterProgression.value.global_skill_points = Math.max(0, val)
		}
	})

	const globalMP = computed({
		get: () => currentCharacterProgression.value.global_spell_points ?? 0,
		set: (val) => {
			currentCharacterProgression.value.global_spell_points = Math.max(0, val)
		}
	})

	const currentSP = computed({
		get: () => currentCharacterProgression.value.skill_points ?? 0,
		set: (val) => {
			currentCharacterProgression.value.skill_points = Math.max(0, val)
		}
	})

	const currentEntity = computed(() => {
		const list = selectedEntityType.value === 'classes' ? classesList.value : racesList.value
		return list.find((e) => e.id === selectedEntityId.value) || null
	})

	const currentEntityTier = computed(() => {
		return currentEntity.value?.tier || 'basic'
	})

	const currentEntityMaxLevel = computed(() => {
		return getEntityMaxLevel(currentEntity.value)
	})

	const currentBranches = computed(() => {
		if (!currentEntity.value) return []
		const raw = currentEntity.value.skill_branches || []
		return raw.map(normalizeSkillBranch)
	})

	const currentSkills = computed(() => {
		if (!currentEntity.value) return []
		const raw = currentEntity.value.skills || []
		return raw.map(normalizeSkill)
	})

	const currentEntityLevel = computed(() => {
		const prog = currentCharacterProgression.value
		const eId = selectedEntityId.value
		if (!eId) return 0
		const levelMap = selectedEntityType.value === 'classes' ? prog.class_levels : prog.race_levels
		if (levelMap && levelMap[eId] !== undefined) {
			return levelMap[eId]
		}
		return calculateClassLevel(prog.skills || {}, currentSkills.value)
	})

	const currentClassLevel = computed(() => {
		return currentEntityLevel.value
	})

	const currentEntityLocalSP = computed({
		get: () => {
			const eId = selectedEntityId.value
			if (currentCharacterProgression.value.entity_points?.[eId]) {
				return currentCharacterProgression.value.entity_points[eId].skill_points ?? 0
			}
			return currentCharacterProgression.value.skill_points ?? 0
		},
		set: (val) => {
			const eId = selectedEntityId.value
			if (!currentCharacterProgression.value.entity_points) currentCharacterProgression.value.entity_points = {}
			if (!currentCharacterProgression.value.entity_points[eId]) {
				currentCharacterProgression.value.entity_points[eId] = { skill_points: 0, spell_points: 0 }
			}
			currentCharacterProgression.value.entity_points[eId].skill_points = Math.max(0, val)
		}
	})

	const currentEntityLocalMP = computed({
		get: () => {
			const eId = selectedEntityId.value
			return currentCharacterProgression.value.entity_points?.[eId]?.spell_points ?? 0
		},
		set: (val) => {
			const eId = selectedEntityId.value
			if (!currentCharacterProgression.value.entity_points) currentCharacterProgression.value.entity_points = {}
			if (!currentCharacterProgression.value.entity_points[eId]) {
				currentCharacterProgression.value.entity_points[eId] = { skill_points: 0, spell_points: 0 }
			}
			currentCharacterProgression.value.entity_points[eId].spell_points = Math.max(0, val)
		}
	})

	const canLevelUpCurrentEntityStatus = computed(() => {
		if (!currentEntity.value) return { canLevelUp: false, reasons: ['Сущность не выбрана'] }
		const allList = selectedEntityType.value === 'classes' ? classesList.value : racesList.value
		return canLevelUpEntity(
			currentEntity.value,
			selectedEntityType.value,
			currentCharacterProgression.value,
			allList
		)
	})

	const filteredSkills = computed(() => {
		if (selectedBranchId.value === 'all') {
			return currentSkills.value
		}
		return currentSkills.value.filter((s) => s.branch === selectedBranchId.value)
	})

	const gridData = computed(() => {
		return organizeSkillsByGrid(filteredSkills.value, currentBranches.value)
	})

	const selectedSkill = computed(() => {
		if (!selectedSkillId.value) return null
		return currentSkills.value.find((s) => s.id === selectedSkillId.value) || null
	})

	function selectCharacter(charId) {
		selectedCharacterId.value = charId
		initCharacterProgression(charId)
	}

	function selectEntityType(type) {
		selectedEntityType.value = type
		const list = type === 'classes' ? classesList.value : racesList.value
		if (list.length > 0) {
			selectedEntityId.value = list[0].id
		} else {
			selectedEntityId.value = ''
		}
		selectedBranchId.value = 'all'
		selectedSkillId.value = null
	}

	function selectEntity(id) {
		selectedEntityId.value = id
		selectedBranchId.value = 'all'
		selectedSkillId.value = null
	}

	function selectBranch(branchId) {
		selectedBranchId.value = branchId
	}

	function selectSkill(skillId) {
		selectedSkillId.value = skillId
	}

	function addCharacterLevel(amount = 1) {
		const prog = currentCharacterProgression.value
		const oldLvl = prog.char_level || 1
		const newLvl = Math.min(100, oldLvl + amount)
		const gained = newLvl - oldLvl
		prog.char_level = newLvl
		prog.level_points = (prog.level_points || 0) + gained
	}

	function addLevelPoints(amount = 1) {
		const prog = currentCharacterProgression.value
		prog.level_points = Math.max(0, (prog.level_points || 0) + amount)
	}

	function addGlobalSkillPoints(amount = 1) {
		const prog = currentCharacterProgression.value
		prog.global_skill_points = Math.max(0, (prog.global_skill_points || 0) + amount)
	}

	function addGlobalSpellPoints(amount = 1) {
		const prog = currentCharacterProgression.value
		prog.global_spell_points = Math.max(0, (prog.global_spell_points || 0) + amount)
	}

	function addLocalSkillPoints(amount = 1) {
		const eId = selectedEntityId.value
		if (!eId) return
		const prog = currentCharacterProgression.value
		if (!prog.entity_points) prog.entity_points = {}
		if (!prog.entity_points[eId]) prog.entity_points[eId] = { skill_points: 0, spell_points: 0 }
		prog.entity_points[eId].skill_points = Math.max(0, (prog.entity_points[eId].skill_points || 0) + amount)
	}

	function addLocalSpellPoints(amount = 1) {
		const eId = selectedEntityId.value
		if (!eId) return
		const prog = currentCharacterProgression.value
		if (!prog.entity_points) prog.entity_points = {}
		if (!prog.entity_points[eId]) prog.entity_points[eId] = { skill_points: 0, spell_points: 0 }
		prog.entity_points[eId].spell_points = Math.max(0, (prog.entity_points[eId].spell_points || 0) + amount)
	}

	function addSkillPoints(amount = 1) {
		const prog = currentCharacterProgression.value
		prog.skill_points = Math.max(0, (prog.skill_points || 0) + amount)
	}

	function levelUpCurrentEntity() {
		if (!currentEntity.value) return { success: false, reasons: ['Сущность не выбрана'] }
		const allList = selectedEntityType.value === 'classes' ? classesList.value : racesList.value
		const res = levelUpEntity(
			currentEntity.value,
			selectedEntityType.value,
			currentCharacterProgression.value,
			allList
		)
		if (res.success) {
			charactersProgression.value[selectedCharacterId.value] = res.characterProgression
		}
		return res
	}

	function checkCanLearn(skill) {
		if (!skill) return { canLearn: false, reasons: ['Навык не выбран'] }
		return canLearnSkill(skill, currentCharacterProgression.value, currentSkills.value, currentEntity.value)
	}

	function checkCanRefund(skill) {
		if (!skill) return { canRefund: false, reasons: ['Навык не выбран'] }
		return canRefundSkill(skill, currentCharacterProgression.value, currentSkills.value, currentEntity.value)
	}

	function upgradeSkill(skillId) {
		const targetId = skillId || selectedSkillId.value
		if (!targetId) return { success: false, error: 'Навык не выбран' }

		const res = learnSkill(
			currentCharacterProgression.value,
			targetId,
			currentSkills.value,
			currentEntity.value
		)
		if (res.success) {
			charactersProgression.value[selectedCharacterId.value] = res.characterState
		}
		return res
	}

	function downgradeSkill(skillId) {
		const targetId = skillId || selectedSkillId.value
		if (!targetId) return { success: false, error: 'Навык не выбран' }

		const res = refundSkill(
			currentCharacterProgression.value,
			targetId,
			currentSkills.value,
			currentEntity.value
		)
		if (res.success) {
			charactersProgression.value[selectedCharacterId.value] = res.characterState
		}
		return res
	}

	function resetCurrentEntitySkills() {
		const res = resetSkills(
			currentCharacterProgression.value,
			currentSkills.value,
			currentEntity.value
		)
		if (res.success) {
			charactersProgression.value[selectedCharacterId.value] = res.characterState
		}
		return res
	}

	function getSkillRank(skillId) {
		return currentCharacterProgression.value.skills?.[skillId] || 0
	}

	return {
		// State
		charactersList,
		classesList,
		racesList,
		selectedCharacterId,
		selectedEntityType,
		selectedEntityId,
		selectedBranchId,
		selectedSkillId,
		charactersProgression,

		// Progression Computed
		charLevel,
		levelPoints,
		globalSP,
		globalMP,
		currentEntityLevel,
		currentEntityTier,
		currentEntityMaxLevel,
		currentEntityLocalSP,
		currentEntityLocalMP,
		canLevelUpCurrentEntityStatus,

		// Computed
		currentCharacter,
		currentCharacterProgression,
		currentSP,
		currentEntity,
		currentBranches,
		currentSkills,
		currentClassLevel,
		filteredSkills,
		gridData,
		selectedSkill,

		// Actions
		setEntitiesData,
		selectCharacter,
		selectEntityType,
		selectEntity,
		selectBranch,
		selectSkill,
		addCharacterLevel,
		addLevelPoints,
		addGlobalSkillPoints,
		addGlobalSpellPoints,
		addLocalSkillPoints,
		addLocalSpellPoints,
		addSkillPoints,
		levelUpCurrentEntity,
		checkCanLearn,
		checkCanRefund,
		upgradeSkill,
		downgradeSkill,
		resetCurrentEntitySkills,
		getSkillRank
	}
}
