/**
 * src/renderer/utils/skillTree.js
 * Core logic for skill tree graphs, level grids, parent prerequisites, and progression.
 */

/**
 * Predefined skill categories with Russian labels, icons, and theme colors.
 */
export const SKILL_CATEGORIES = [
	{ id: 'active', label: 'Активная способность', shortLabel: 'Активная', icon: '⚔️', color: '#ef4444' },
	{ id: 'passive', label: 'Пассивная способность', shortLabel: 'Пассивная', icon: '🛡️', color: '#3b82f6' },
	{ id: 'aura', label: 'Аура', shortLabel: 'Аура', icon: '✨', color: '#f59e0b' },
	{ id: 'buff', label: 'Бафф', shortLabel: 'Бафф', icon: '🔼', color: '#10b981' },
	{ id: 'debuff', label: 'Дебафф', shortLabel: 'Дебафф', icon: '🔽', color: '#a855f7' },
	{ id: 'spell', label: 'Заклинание', shortLabel: 'Спел', icon: '🔮', color: '#c084fc' }
]

export const VALID_SKILL_CATEGORIES = new Set(SKILL_CATEGORIES.map((c) => c.id))

/**
 * Entity tiers (Classes and Races) with maximum allowable levels.
 */
export const ENTITY_TIERS = {
	basic: { id: 'basic', label: 'Базовый', maxLevel: 15 },
	advanced: { id: 'advanced', label: 'Продвинутый', maxLevel: 10 },
	rare: { id: 'rare', label: 'Редкий / Секретный', maxLevel: 5 }
}

/**
 * Returns maximum level for a class or race based on its tier.
 * @param {Object} entity
 * @returns {number} 15 (basic), 10 (advanced), 5 (rare/secret)
 */
export function getEntityMaxLevel(entity) {
	if (!entity) return 15
	const tier = String(entity.tier || 'basic').trim().toLowerCase()
	if (tier === 'advanced') return 10
	if (tier === 'rare' || tier === 'secret') return 5
	return 15
}

/**
 * Returns category metadata by id, falling back to 'active'.
 * @param {string} categoryId
 * @returns {{ id: string, label: string, shortLabel: string, icon: string, color: string }}
 */
export function getCategoryMeta(categoryId) {
	return SKILL_CATEGORIES.find((c) => c.id === categoryId) || SKILL_CATEGORIES[0]
}

/**
 * Resolves a skill tree node by merging intrinsic attributes from the central catalog
 * with tree-specific progression parameters (branch, req_level, cost, auto_unlock, parent_ids).
 * @param {Object} node - Skill node from class/race tree
 * @param {Array<Object>} catalog - Master skill catalog (from skills/skills.json)
 * @returns {Object} normalized full skill object
 */
export function resolveSkillNode(node, catalog = []) {
	if (!node || typeof node !== 'object') return normalizeSkill(node)
	const skillId = String(node.skill_id || node.id || '').trim()
	let catalogItem = null
	if (Array.isArray(catalog)) {
		catalogItem = catalog.find((s) => s.id === skillId) || null
	} else if (catalog && typeof catalog === 'object') {
		catalogItem = catalog[skillId] || (Array.isArray(Object.values(catalog)) ? Object.values(catalog).find((s) => s?.id === skillId) : null)
	}
	return normalizeSkill(node, catalogItem)
}

/**
 * Resolves an array of skill tree nodes against a skill catalog.
 * @param {Array<Object>} skillsList
 * @param {Array<Object>} catalog
 * @returns {Array<Object>}
 */
export function resolveEntitySkills(skillsList = [], catalog = []) {
	if (!Array.isArray(skillsList)) return []
	return skillsList.map((node) => resolveSkillNode(node, catalog))
}

/**
 * Normalizes a single skill object to ensure all required fields exist with valid defaults.
 * @param {Object} skill
 * @param {Object|null} catalogItem - Optional intrinsic skill definition from skills.json
 * @returns {Object} normalized skill
 */
export function normalizeSkill(skill, catalogItem = null) {
	if (!skill || typeof skill !== 'object') {
		return {
			id: 'unknown_skill',
			skill_id: 'unknown_skill',
			name: 'Навык',
			icon: '⚔️',
			description: '',
			branch: '',
			category: 'active',
			grid_col: 0,
			req_level: 1,
			max_level: 1,
			cost: 1,
			cost_type: 'skill_point',
			level_points_given: 1,
			auto_unlock: false,
			parent_ids: [],
			parent_requirement: 'all',
			entity_id: '',
			data: {}
		}
	}

	const skillId = String(skill.skill_id || skill.id || '').trim()

	let rawData = skill.data !== undefined ? skill.data : (catalogItem?.data || {})
	let parsedData = rawData
	if (typeof parsedData === 'string') {
		try {
			parsedData = JSON.parse(parsedData)
		} catch (e) {
			parsedData = {}
		}
	} else if (!parsedData || typeof parsedData !== 'object' || Array.isArray(parsedData)) {
		parsedData = {}
	}
	if (Object.keys(parsedData).length === 0 && catalogItem?.data && typeof catalogItem.data === 'object') {
		parsedData = catalogItem.data
	}

	let category = String(skill.category || catalogItem?.category || 'active').trim().toLowerCase()
	if (!VALID_SKILL_CATEGORIES.has(category)) {
		category = 'active'
	}

	const gridCol = Math.max(0, parseInt(skill.grid_col, 10) || 0)
	const parsedReq = parseInt(skill.req_level, 10)
	const reqLevel = isNaN(parsedReq) ? 1 : Math.max(1, parsedReq)

	const autoUnlock = Boolean(skill.auto_unlock)

	const parsedCost = parseInt(skill.cost, 10)
	let cost = autoUnlock ? 0 : (isNaN(parsedCost) ? 1 : Math.max(0, parsedCost))

	const name = String(skill.name || catalogItem?.name || skillId || 'Навык').trim()
	const icon = skill.icon || catalogItem?.icon || '⚔️'
	const description = String(skill.description !== undefined ? skill.description : (catalogItem?.description || '')).trim()

	return {
		id: skillId || 'unknown_skill',
		skill_id: skillId || 'unknown_skill',
		name,
		icon,
		description,
		branch: String(skill.branch || '').trim(),
		category,
		grid_col: gridCol,
		req_level: reqLevel,
		max_level: Math.max(1, parseInt(skill.max_level, 10) || 1),
		cost,
		cost_type: skill.cost_type === 'spell_point' ? 'spell_point' : 'skill_point',
		level_points_given: skill.level_points_given !== undefined && !isNaN(parseInt(skill.level_points_given, 10))
			? Math.max(0, parseInt(skill.level_points_given, 10))
			: 1,
		auto_unlock: autoUnlock,
		parent_ids: Array.isArray(skill.parent_ids)
			? skill.parent_ids.map((p) => String(p).trim()).filter(Boolean)
			: [],
		parent_requirement: skill.parent_requirement === 'any' ? 'any' : 'all',
		entity_id: String(skill.entity_id || '').trim(),
		data: parsedData
	}
}

/**
 * Normalizes a branch definition object.
 * @param {Object} branch
 * @returns {Object}
 */
export function normalizeSkillBranch(branch) {
	if (!branch || typeof branch !== 'object') {
		return {
			id: 'general',
			name: 'Общая',
			icon: '🌿',
			description: ''
		}
	}
	return {
		id: String(branch.id || 'general').trim(),
		name: String(branch.name || branch.id || 'Ветка').trim(),
		icon: branch.icon || '🌿',
		description: String(branch.description || '').trim()
	}
}

/**
 * Computes the accumulated class/race level points for a given character and entity.
 * Points = sum of (invested ranks * skill.level_points_given) for all learned skills in this class/race.
 *
 * @param {Object} characterSkills - Map of { [skillId]: currentRank }
 * @param {Array<Object>} entitySkills - List of skill definitions belonging to this class/race
 * @returns {number}
 */
export function calculateClassLevel(characterSkills = {}, entitySkills = []) {
	let totalLevelPoints = 0
	for (const rawSkill of entitySkills) {
		const skill = normalizeSkill(rawSkill)
		const rank = characterSkills[skill.id] || 0
		if (rank > 0) {
			totalLevelPoints += rank * skill.level_points_given
		}
	}
	return totalLevelPoints
}

/**
 * Resolves current entity level for a character, checking explicit class_levels / race_levels first,
 * and falling back to skill point accumulation (calculateClassLevel) for backwards compatibility.
 *
 * @param {Object} characterState
 * @param {string} entityId
 * @param {Array<Object>} entitySkills
 * @returns {number}
 */
export function getEntityLevel(characterState = {}, entityId = '', entitySkills = []) {
	if (entityId && characterState.class_levels && characterState.class_levels[entityId] !== undefined) {
		return characterState.class_levels[entityId]
	}
	if (entityId && characterState.race_levels && characterState.race_levels[entityId] !== undefined) {
		return characterState.race_levels[entityId]
	}
	if (typeof characterState.class_level === 'number') {
		return characterState.class_level
	}
	if (typeof characterState.level === 'number') {
		return characterState.level
	}
	return 1 + calculateClassLevel(characterState.skills || {}, entitySkills)
}

/**
 * Returns available skill points (SP or MP), factoring in local entity points first and universal global points.
 *
 * @param {Object} characterState
 * @param {string} entityId
 * @param {string} costType - 'skill_point' | 'spell_point'
 * @returns {{ local: number, global: number, total: number }}
 */
export function getAvailableSkillPoints(characterState = {}, entityId = '', costType = 'skill_point') {
	const pointsKey = costType === 'spell_point' ? 'spell_points' : 'skill_points'
	const globalKey = costType === 'spell_point' ? 'global_spell_points' : 'global_skill_points'

	const localPointsObj = characterState.entity_points?.[entityId]
	if (localPointsObj && typeof localPointsObj[pointsKey] === 'number') {
		const local = Math.max(0, localPointsObj[pointsKey])
		const global = Math.max(0, characterState[globalKey] || 0)
		return { local, global, total: local + global }
	}

	// Legacy fallback: single characterState.skill_points (or spell_points)
	const fallback = typeof characterState[pointsKey] === 'number'
		? characterState[pointsKey]
		: (typeof characterState.skill_points === 'number' ? characterState.skill_points : 0)

	const global = Math.max(0, characterState[globalKey] || 0)
	return { local: fallback, global, total: fallback + global }
}

/**
 * Validates whether an entity (Class or Race) can be leveled up by +1.
 *
 * Rules:
 * 1. Character has level_points >= 1
 * 2. Entity level < max allowable level for its tier (Basic: 15, Advanced: 10, Rare: 5)
 * 3. Advanced tier requires parent entity to be at maximum level.
 * 4. Rare tier requires parent entity (if parent_id exists) to be at maximum level.
 * 5. Races:
 *    - Only 1 base race allowed across the entire character.
 *    - Only 1 evolution branch allowed (must follow a single linear lineage).
 * 6. Classes:
 *    - Multiclassing is allowed (multiple base classes and parallel branches).
 *
 * @param {Object} entity
 * @param {string} entityType - 'classes' | 'races'
 * @param {Object} characterProgression
 * @param {Array<Object>} allEntities
 * @returns {{ canLevelUp: boolean, reasons: string[] }}
 */
export function canLevelUpEntity(entity, entityType = 'classes', characterProgression = {}, allEntities = []) {
	if (!entity || !entity.id) {
		return { canLevelUp: false, reasons: ['Сущность не выбрана'] }
	}

	const reasons = []
	const levelMap = entityType === 'classes'
		? (characterProgression.class_levels || {})
		: (characterProgression.race_levels || {})

	const currentLvl = levelMap[entity.id] || 0
	const maxLvl = getEntityMaxLevel(entity)

	// 1. Max Level Check
	if (currentLvl >= maxLvl) {
		reasons.push(`Сущность уже достигла максимального уровня (${maxLvl})`)
	}

	// 2. Character Level Points Check
	const levelPoints = characterProgression.level_points ?? 0
	if (levelPoints < 1) {
		reasons.push('Недостаточно очков уровня персонажа (требуется 1 очко уровня)')
	}

	// 3. Parent / Tier Requirements
	const tier = String(entity.tier || 'basic').toLowerCase()
	if (tier === 'advanced') {
		if (!entity.parent_id) {
			reasons.push('Для продвинутой сущности не указан родительский класс/раса')
		} else {
			const parentEntity = allEntities.find((e) => e.id === entity.parent_id)
			const parentLvl = levelMap[entity.parent_id] || 0
			const parentMax = getEntityMaxLevel(parentEntity)
			if (parentLvl < parentMax) {
				const parentName = parentEntity?.name || entity.parent_id
				const typeLabel = entityType === 'classes' ? 'класс' : 'расу'
				reasons.push(`Требуется полностью изучить родительский ${typeLabel} '${parentName}' до ур. ${parentMax} (текущий: ${parentLvl})`)
			}
		}
	} else if ((tier === 'rare' || tier === 'secret') && entity.parent_id) {
		const parentEntity = allEntities.find((e) => e.id === entity.parent_id)
		const parentLvl = levelMap[entity.parent_id] || 0
		const parentMax = getEntityMaxLevel(parentEntity)
		if (parentLvl < parentMax) {
			const parentName = parentEntity?.name || entity.parent_id
			const typeLabel = entityType === 'classes' ? 'класс' : 'расу'
			reasons.push(`Требуется полностью изучить родительский ${typeLabel} '${parentName}' до ур. ${parentMax} (текущий: ${parentLvl})`)
		}
	}

	// 4. Race Specific Rules
	if (entityType === 'races') {
		const leveledRaceIds = Object.keys(characterProgression.race_levels || {}).filter(
			(id) => (characterProgression.race_levels[id] || 0) > 0
		)

		// Rule A: Single base race only
		if (!entity.parent_id) {
			const otherBaseRaceId = leveledRaceIds.find((id) => {
				if (id === entity.id) return false
				const otherEnt = allEntities.find((e) => e.id === id)
				return !otherEnt?.parent_id
			})
			if (otherBaseRaceId) {
				const otherName = allEntities.find((e) => e.id === otherBaseRaceId)?.name || otherBaseRaceId
				reasons.push(`Персонаж уже выбрал базовую расу '${otherName}' и не может взять другую`)
			}
		}

		// Rule B: Single evolution branch only
		if (entity.parent_id && currentLvl === 0) {
			// Find all ancestors of target entity
			const ancestors = new Set()
			let currParentId = entity.parent_id
			while (currParentId) {
				ancestors.add(currParentId)
				const p = allEntities.find((e) => e.id === currParentId)
				currParentId = p?.parent_id || null
			}

			// Check if any currently leveled race is neither an ancestor nor descendant
			for (const rId of leveledRaceIds) {
				if (rId === entity.id || ancestors.has(rId)) continue

				// Check if rId is a descendant of entity
				let isDescendant = false
				let dParent = allEntities.find((e) => e.id === rId)?.parent_id
				while (dParent) {
					if (dParent === entity.id) {
						isDescendant = true
						break
					}
					dParent = allEntities.find((e) => e.id === dParent)?.parent_id
				}

				if (!isDescendant) {
					reasons.push('Персонаж может развивать только одну ветку эволюции расы')
					break
				}
			}
		}
	}

	return {
		canLevelUp: reasons.length === 0,
		reasons
	}
}

/**
 * Levels up an entity by +1, deducting 1 level point and awarding dedicated local points.
 * Automatically unlocks any entity skills marked with auto_unlock: true when required level is met.
 *
 * @param {Object} entity
 * @param {string} entityType - 'classes' | 'races'
 * @param {Object} characterProgression
 * @param {Array<Object>} allEntities
 * @param {Array<Object>} entitySkills - Optional skills belonging to this class/race
 * @returns {{ success: boolean, reasons?: string[], characterProgression: Object }}
 */
export function levelUpEntity(entity, entityType = 'classes', characterProgression = {}, allEntities = [], entitySkills = []) {
	const check = canLevelUpEntity(entity, entityType, characterProgression, allEntities)
	if (!check.canLevelUp) {
		return { success: false, reasons: check.reasons, characterProgression }
	}

	const nextState = JSON.parse(JSON.stringify(characterProgression))
	nextState.level_points = Math.max(0, (nextState.level_points || 0) - 1)

	const levelKey = entityType === 'classes' ? 'class_levels' : 'race_levels'
	if (!nextState[levelKey]) nextState[levelKey] = {}
	const newLvl = (nextState[levelKey][entity.id] || 0) + 1
	nextState[levelKey][entity.id] = newLvl

	if (!nextState.entity_points) nextState.entity_points = {}
	if (!nextState.entity_points[entity.id]) {
		nextState.entity_points[entity.id] = { skill_points: 0, spell_points: 0 }
	}

	const spPerLvl = typeof entity.sp_lvl === 'number'
		? entity.sp_lvl
		: (typeof entity.skill_points_per_level === 'number' ? entity.skill_points_per_level : 1)
	const mpPerLvl = typeof entity.mp_lvl === 'number'
		? entity.mp_lvl
		: (typeof entity.spell_points_per_level === 'number' ? entity.spell_points_per_level : 0)

	nextState.entity_points[entity.id].skill_points =
		(nextState.entity_points[entity.id].skill_points || 0) + spPerLvl
	nextState.entity_points[entity.id].spell_points =
		(nextState.entity_points[entity.id].spell_points || 0) + mpPerLvl

	// Auto-unlock skills marked with auto_unlock where req_level <= newLvl
	const skillsToScan = Array.isArray(entitySkills) && entitySkills.length > 0
		? entitySkills
		: (Array.isArray(entity.skills) ? entity.skills : [])

	for (const rawSkill of skillsToScan) {
		const normSkill = normalizeSkill(rawSkill)
		if (normSkill.auto_unlock && normSkill.req_level <= newLvl) {
			if (!nextState.skills) nextState.skills = {}
			if ((nextState.skills[normSkill.id] || 0) < 1) {
				nextState.skills[normSkill.id] = 1
				if (!nextState.skill_purchases) nextState.skill_purchases = {}
				nextState.skill_purchases[normSkill.id] = {
					entityId: entity.id,
					costType: normSkill.cost_type,
					auto_unlock: true,
					cost: 0,
					fromLocal: 0,
					fromGlobal: 0
				}
			}
		}
	}

	return {
		success: true,
		characterProgression: nextState
	}
}

/**
 * Checks if a skill can be learned/upgraded by the character.
 *
 * Requirements:
 * 1. Current class/race level >= skill.req_level
 * 2. If parent_ids is non-empty:
 *    - 'all': ALL parents must have rank >= 1
 *    - 'any': AT LEAST ONE parent must have rank >= 1
 * 3. Available character skill/spell points >= skill.cost
 * 4. Current rank < skill.max_level
 *
 * @param {Object} skill - Target skill definition
 * @param {Object} characterState - Character progression state
 * @param {Array<Object>} entitySkills - All skills belonging to the current class/race
 * @param {Object} entity - Optional entity object (for ID / tier lookup)
 * @returns {{ canLearn: boolean, reasons: string[], isMaxed: boolean }}
 */
export function canLearnSkill(skill, characterState = {}, entitySkills = [], entity = null) {
	const normalizedSkill = normalizeSkill(skill)
	const skillsMap = characterState.skills || {}
	const currentRank = skillsMap[normalizedSkill.id] || 0
	const entityId = entity?.id || normalizedSkill.entity_id || entitySkills[0]?.entity_id || ''

	const reasons = []

	// 1. Max level check
	if (currentRank >= normalizedSkill.max_level) {
		return {
			canLearn: false,
			reasons: ['Навык уже прокачан до максимального уровня'],
			isMaxed: true
		}
	}

	// 2. Class / Race level requirement check
	const currentEntityLevel = getEntityLevel(characterState, entityId, entitySkills)
	if (currentEntityLevel < normalizedSkill.req_level) {
		if (normalizedSkill.auto_unlock) {
			reasons.push(
				`Требуется уровень класса/расы: ${normalizedSkill.req_level} (навык откроется автоматически при получении уровня)`
			)
		} else {
			reasons.push(
				`Требуется уровень класса/расы: ${normalizedSkill.req_level} (текущий: ${currentEntityLevel})`
			)
		}
	}

	// 3. Parent prerequisites check
	const parents = normalizedSkill.parent_ids
	if (parents.length > 0) {
		const learnedParents = parents.filter((pid) => (skillsMap[pid] || 0) >= 1)

		if (normalizedSkill.parent_requirement === 'any') {
			if (learnedParents.length === 0) {
				const parentNames = parents
					.map((pid) => entitySkills.find((s) => s.id === pid)?.name || pid)
					.join(' ИЛИ ')
				reasons.push(`Требуется изучить хотя бы один из навыков: ${parentNames}`)
			}
		} else {
			// 'all'
			if (learnedParents.length < parents.length) {
				const missingParents = parents
					.filter((pid) => (skillsMap[pid] || 0) < 1)
					.map((pid) => entitySkills.find((s) => s.id === pid)?.name || pid)
					.join(', ')
				reasons.push(`Требуется изучить все предшествующие навыки: ${missingParents}`)
			}
		}
	}

	// 4. Points check (local entity points + universal global points)
	const points = getAvailableSkillPoints(characterState, entityId, normalizedSkill.cost_type)
	if (points.total < normalizedSkill.cost) {
		const label = normalizedSkill.cost_type === 'spell_point' ? 'очков спелов (MP)' : 'очков прокачки (SP)'
		reasons.push(
			`Недостаточно ${label}: требуется ${normalizedSkill.cost} (доступно: ${points.total})`
		)
	}

	return {
		canLearn: reasons.length === 0,
		reasons,
		isMaxed: false
	}
}

/**
 * Learns a skill for the character.
 * Deducts points (local first, then global), increments skill rank, and returns updated state.
 *
 * @param {Object} characterState
 * @param {string} skillId - Target skill ID
 * @param {Array<Object>} entitySkills - All skills belonging to this class/race
 * @param {Object} entity - Optional entity definition
 * @returns {{ success: boolean, error?: string, characterState: Object }}
 */
export function learnSkill(characterState, skillId, entitySkills = [], entity = null) {
	const skill = entitySkills.find((s) => s.id === skillId)
	if (!skill) {
		return { success: false, error: `Навык с ID '${skillId}' не найден`, characterState }
	}

	const validation = canLearnSkill(skill, characterState, entitySkills, entity)
	if (!validation.canLearn) {
		return { success: false, error: validation.reasons.join('; '), characterState }
	}

	const norm = normalizeSkill(skill)
	const nextState = JSON.parse(JSON.stringify(characterState))
	if (!nextState.skills) nextState.skills = {}
	const currentRank = nextState.skills[norm.id] || 0
	nextState.skills[norm.id] = currentRank + 1

	const entityId = entity?.id || norm.entity_id || entitySkills[0]?.entity_id || ''
	const costType = norm.cost_type || 'skill_point'
	const pointsKey = costType === 'spell_point' ? 'spell_points' : 'skill_points'
	const globalKey = costType === 'spell_point' ? 'global_spell_points' : 'global_skill_points'

	if (nextState.entity_points && entityId && nextState.entity_points[entityId]) {
		let local = nextState.entity_points[entityId][pointsKey] || 0
		let global = nextState[globalKey] || 0
		const fromLocal = Math.min(local, norm.cost)
		const fromGlobal = norm.cost - fromLocal

		local -= fromLocal
		global -= fromGlobal

		nextState.entity_points[entityId][pointsKey] = local
		nextState[globalKey] = global

		if (!nextState.skill_purchases) nextState.skill_purchases = {}
		nextState.skill_purchases[norm.id] = {
			entityId,
			costType,
			pointsKey,
			globalKey,
			fromLocal,
			fromGlobal,
			cost: norm.cost
		}
	} else {
		// Legacy single point deduction
		const currentSP = nextState.skill_points ?? 0
		nextState.skill_points = currentSP - norm.cost
	}

	return {
		success: true,
		characterState: nextState
	}
}

/**
 * Checks if a skill rank can be refunded.
 * It cannot be refunded if:
 * 1. The skill is not learned (rank === 0).
 * 2. If decrementing this skill breaks any dependent child skills (e.g. child was learned and this was a required parent).
 * 3. If decrementing this skill drops the class level below the req_level of any learned skill (when class level is tied to skills).
 *
 * @param {Object} skill - Target skill definition
 * @param {Object} characterState - Current character state
 * @param {Array<Object>} entitySkills - All skills of the class/race
 * @param {Object} entity - Optional entity definition
 * @returns {{ canRefund: boolean, reasons: string[] }}
 */
export function canRefundSkill(skill, characterState = {}, entitySkills = [], entity = null) {
	const norm = normalizeSkill(skill)
	const skillsMap = characterState.skills || {}
	const currentRank = skillsMap[norm.id] || 0

	if (currentRank <= 0) {
		return { canRefund: false, reasons: ['Навык еще не прокачан'] }
	}

	if (norm.auto_unlock) {
		return { canRefund: false, reasons: ['Врождённый навык нельзя сбросить'] }
	}

	const existingPurchase = characterState.skill_purchases?.[norm.id]
	if (existingPurchase?.auto_unlock) {
		return { canRefund: false, reasons: ['Врождённый навык нельзя сбросить'] }
	}

	const reasons = []

	// Simulate state after refunding 1 rank
	const simulatedSkills = { ...skillsMap }
	if (currentRank === 1) {
		delete simulatedSkills[norm.id]
	} else {
		simulatedSkills[norm.id] = currentRank - 1
	}

	// 1. Check parent dependencies of other learned skills
	for (const otherSkillRaw of entitySkills) {
		const other = normalizeSkill(otherSkillRaw)
		if ((skillsMap[other.id] || 0) > 0 && other.parent_ids.includes(norm.id)) {
			if (currentRank === 1) {
				if (other.parent_requirement === 'all') {
					reasons.push(
						`Нельзя сбросить: от этого навыка зависит изученный навык '${other.name}'`
					)
					break
				} else if (other.parent_requirement === 'any') {
					const otherLearnedParents = other.parent_ids.filter(
						(pid) => pid !== norm.id && (simulatedSkills[pid] || 0) >= 1
					)
					if (otherLearnedParents.length === 0) {
						reasons.push(
							`Нельзя сбросить: от этого навыка зависит изученный навык '${other.name}' (нет других активных предков)`
						)
						break
					}
				}
			}
		}
	}

	// 2. Check class level requirement if level is dynamically calculated from skills
	const entityId = entity?.id || norm.entity_id || entitySkills[0]?.entity_id || ''
	const hasExplicitLevel = Boolean(
		(characterState.class_levels && characterState.class_levels[entityId] !== undefined) ||
		(characterState.race_levels && characterState.race_levels[entityId] !== undefined)
	)

	if (!hasExplicitLevel) {
		const simulatedClassLevel = calculateClassLevel(simulatedSkills, entitySkills)
		for (const otherSkillRaw of entitySkills) {
			const other = normalizeSkill(otherSkillRaw)
			if ((simulatedSkills[other.id] || 0) > 0 && other.req_level > simulatedClassLevel) {
				reasons.push(
					`Нельзя сбросить: понижение уровня класса/расы нарушит требование для навыка '${other.name}' (требуется ур. ${other.req_level})`
				)
				break
			}
		}
	}

	return {
		canRefund: reasons.length === 0,
		reasons
	}
}

/**
 * Refunds 1 rank of a skill, restoring SP/MP (local and global according to purchase).
 *
 * @param {Object} characterState
 * @param {string} skillId
 * @param {Array<Object>} entitySkills
 * @param {Object} entity
 * @returns {{ success: boolean, error?: string, characterState: Object }}
 */
export function refundSkill(characterState, skillId, entitySkills = [], entity = null) {
	const skill = entitySkills.find((s) => s.id === skillId)
	if (!skill) {
		return { success: false, error: `Навык с ID '${skillId}' не найден`, characterState }
	}

	const check = canRefundSkill(skill, characterState, entitySkills, entity)
	if (!check.canRefund) {
		return { success: false, error: check.reasons.join('; '), characterState }
	}

	const norm = normalizeSkill(skill)
	const nextState = JSON.parse(JSON.stringify(characterState))
	if (!nextState.skills) nextState.skills = {}
	const currentRank = nextState.skills[norm.id] || 0

	if (currentRank === 1) {
		delete nextState.skills[norm.id]
	} else {
		nextState.skills[norm.id] = currentRank - 1
	}

	const purchase = nextState.skill_purchases?.[norm.id]
	if (purchase) {
		const { entityId, pointsKey, globalKey, fromLocal, fromGlobal } = purchase
		if (nextState.entity_points?.[entityId]) {
			nextState.entity_points[entityId][pointsKey] =
				(nextState.entity_points[entityId][pointsKey] || 0) + fromLocal
		}
		if (fromGlobal > 0) {
			nextState[globalKey] = (nextState[globalKey] || 0) + fromGlobal
		}
		delete nextState.skill_purchases[norm.id]
	} else {
		nextState.skill_points = (nextState.skill_points ?? 0) + norm.cost
	}

	return {
		success: true,
		characterState: nextState
	}
}

/**
 * Fully resets all skills belonging to this class/race and refunds all spent SP/MP.
 *
 * @param {Object} characterState
 * @param {Array<Object>} entitySkills
 * @param {Object} entity
 * @returns {{ success: boolean, refundedSP: number, characterState: Object }}
 */
export function resetSkills(characterState, entitySkills = [], entity = null) {
	const nextState = JSON.parse(JSON.stringify(characterState))
	if (!nextState.skills) nextState.skills = {}
	let refundedSP = 0

	for (const skillRaw of entitySkills) {
		const skill = normalizeSkill(skillRaw)
		const rank = nextState.skills[skill.id] || 0
		if (rank > 0) {
			const purchase = nextState.skill_purchases?.[skill.id]
			if (skill.auto_unlock || purchase?.auto_unlock) {
				// Keep innate/auto-unlocked skill active at rank 1, refund no points
				continue
			}
			if (purchase) {
				const { entityId, pointsKey, globalKey, fromLocal, fromGlobal } = purchase
				if (nextState.entity_points?.[entityId]) {
					nextState.entity_points[entityId][pointsKey] =
						(nextState.entity_points[entityId][pointsKey] || 0) + fromLocal
				}
				if (fromGlobal > 0) {
					nextState[globalKey] = (nextState[globalKey] || 0) + fromGlobal
				}
				delete nextState.skill_purchases[skill.id]
			} else {
				refundedSP += rank * skill.cost
			}
			delete nextState.skills[skill.id]
		}
	}

	if (refundedSP > 0) {
		nextState.skill_points = (nextState.skill_points ?? 0) + refundedSP
	}

	return {
		success: true,
		refundedSP,
		characterState: nextState
	}
}

/**
 * Swaps or shifts a skill's grid_col within its level tier.
 * @param {Array<Object>} skillsList - Array of skill objects
 * @param {string} skillId - ID of skill to shift
 * @param {number} direction - -1 (left) or 1 (right)
 * @param {number} maxColumns - Optional max columns constraint
 * @returns {Array<Object>} Updated skills array
 */
export function swapSkillColumns(skillsList = [], skillId, direction = 1, maxColumns = 10) {
	if (!Array.isArray(skillsList) || !skillId) return skillsList
	const target = skillsList.find((s) => s.id === skillId)
	if (!target) return skillsList

	const targetCol = target.grid_col ?? 0
	const newCol = targetCol + direction
	if (newCol < 0 || newCol >= maxColumns) return skillsList

	// Check if there is another skill at target's level at newCol
	const neighbor = skillsList.find(
		(s) => s.id !== skillId && s.req_level === target.req_level && (s.grid_col ?? 0) === newCol
	)

	if (neighbor) {
		neighbor.grid_col = targetCol
	}
	target.grid_col = newCol

	return skillsList
}

/**
 * Organizes skills into an intuitive visual cellular grid grouped by Tier (req_level) and branches.
 * Ensures uniform column count across all tier rows and calculates parent-child connector lines.
 *
 * @param {Array<Object>} rawSkills
 * @param {Array<Object>} rawBranches
 * @returns {Object} { tiers: Array<{ level: number, skills: Array, cells: Array }>, branches: Array, connectors: Array, maxCols: number, skills: Array }
 */
export function organizeSkillsByGrid(rawSkills = [], rawBranches = [], catalog = []) {
	const skills = (Array.isArray(rawSkills) ? rawSkills : []).map((s) => resolveSkillNode(s, catalog))
	const branches = (Array.isArray(rawBranches) ? rawBranches : []).map(normalizeSkillBranch)

	// Determine all unique tiers (req_level)
	const tierLevelsSet = new Set(skills.map((s) => s.req_level))
	if (tierLevelsSet.size === 0) tierLevelsSet.add(1)
	const sortedTiers = Array.from(tierLevelsSet).sort((a, b) => a - b)

	// Determine maxCols across all tiers (minimum 3 columns)
	let maxCols = 3
	for (const s of skills) {
		if (s.grid_col >= maxCols) {
			maxCols = s.grid_col + 1
		}
	}
	for (const lvl of sortedTiers) {
		const count = skills.filter((s) => s.req_level === lvl).length
		if (count > maxCols) {
			maxCols = count
		}
	}

	// Map skills into tiers with uniform cells array
	const tiers = sortedTiers.map((lvl) => {
		const tierSkills = skills.filter((s) => s.req_level === lvl)
		const cells = new Array(maxCols).fill(null)

		const unplaced = []
		for (const sk of tierSkills) {
			const col = sk.grid_col
			if (col < maxCols && cells[col] === null) {
				cells[col] = sk
			} else {
				unplaced.push(sk)
			}
		}

		for (const sk of unplaced) {
			let placed = false
			for (let c = 0; c < maxCols; c++) {
				if (cells[c] === null) {
					cells[c] = sk
					sk.grid_col = c
					placed = true
					break
				}
			}
			if (!placed) {
				cells.push(sk)
				sk.grid_col = cells.length - 1
			}
		}

		return {
			level: lvl,
			skills: tierSkills,
			cells
		}
	})

	// Equalize all tiers to the maximum cells length
	for (const t of tiers) {
		if (t.cells.length > maxCols) {
			maxCols = t.cells.length
		}
	}
	for (const t of tiers) {
		while (t.cells.length < maxCols) {
			t.cells.push(null)
		}
	}

	// Generate connections between parent and child skills
	const connectors = []
	for (const skill of skills) {
		for (const pid of skill.parent_ids) {
			const parent = skills.find((s) => s.id === pid)
			if (parent) {
				connectors.push({
					fromId: parent.id,
					toId: skill.id,
					fromReqLevel: parent.req_level,
					toReqLevel: skill.req_level,
					fromCol: parent.grid_col,
					toCol: skill.grid_col,
					requirement: skill.parent_requirement
				})
			}
		}
	}

	return {
		tiers,
		branches,
		connectors,
		maxCols,
		skills
	}
}

