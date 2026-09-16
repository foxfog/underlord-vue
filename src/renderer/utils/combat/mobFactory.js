/**
 * src/renderer/utils/combat/mobFactory.js
 * 
 * Mob Generation Engine for Underlord-Vue:
 * - Calculates characteristics dynamically from Race & Class (zero manual stat duplication)
 * - 1★ to 5★ Star/Rank system with stat multipliers and equipment tier scaling
 * - 5★ Legendary mobs generate 1-3 custom named artifact items with regressive probability
 * - Dynamic level scaling (by MC level or average party level with clamps)
 * - Encounter & Mob Pack resolution for isometric battles and combatStore
 */

import racesData from '@data/races/races.json'
import classesData from '@data/classes/classes.json'
import equipmentData from '@data/items/equipment.json'
import mobTemplatesData from '@data/combat/mob_templates.json'
import mobPacksData from '@data/combat/mob_packs.json'

import {
	MOB_STAR_RATINGS,
	getStarRatingMeta,
	rollStarRating,
	LEGENDARY_ITEM_DROP_CHANCES
} from '@/constants/mobs.js'

import { applyWeaponToAbility } from '@/utils/combat/combatGeometry.js'
import { generateCustomName, rollQuality } from '@/composables/useSmithing.js'

// Cached maps for fast O(1) lookups
const racesMap = new Map((racesData || []).map((r) => [r.id, r]))
const classesMap = new Map((classesData || []).map((c) => [c.id, c]))
const equipmentMap = new Map((equipmentData || []).map((item) => [item.id, item]))

/**
 * Standard class archetypes baseline stats and growth per level
 */
const CLASS_STAT_PROFILES = Object.freeze({
	warrior: {
		baseHp: 24, hpPerLvl: 6.0,
		baseMp: 0, mpPerLvl: 0,
		baseAttack: 6, atkPerLvl: 1.6,
		baseDefense: 3, defPerLvl: 1.1,
		baseInitiative: 5, initPerLvl: 0.2,
		moveRange: 3
	},
	fighter: {
		baseHp: 22, hpPerLvl: 5.5,
		baseMp: 0, mpPerLvl: 0,
		baseAttack: 6, atkPerLvl: 1.5,
		baseDefense: 2, defPerLvl: 1.0,
		baseInitiative: 6, initPerLvl: 0.3,
		moveRange: 3
	},
	paladin: {
		baseHp: 26, hpPerLvl: 6.5,
		baseMp: 5, mpPerLvl: 1.0,
		baseAttack: 5, atkPerLvl: 1.4,
		baseDefense: 4, defPerLvl: 1.3,
		baseInitiative: 4, initPerLvl: 0.1,
		moveRange: 3
	},
	archer: {
		baseHp: 18, hpPerLvl: 4.2,
		baseMp: 0, mpPerLvl: 0,
		baseAttack: 5, atkPerLvl: 1.5,
		baseDefense: 2, defPerLvl: 0.6,
		baseInitiative: 8, initPerLvl: 0.4,
		moveRange: 3
	},
	hunter: {
		baseHp: 19, hpPerLvl: 4.5,
		baseMp: 0, mpPerLvl: 0,
		baseAttack: 5, atkPerLvl: 1.5,
		baseDefense: 2, defPerLvl: 0.7,
		baseInitiative: 7, initPerLvl: 0.3,
		moveRange: 3
	},
	wizard: {
		baseHp: 14, hpPerLvl: 3.2,
		baseMp: 12, mpPerLvl: 3.0,
		baseAttack: 6, atkPerLvl: 1.8,
		baseDefense: 1, defPerLvl: 0.4,
		baseInitiative: 4, initPerLvl: 0.1,
		moveRange: 2
	},
	mage: {
		baseHp: 14, hpPerLvl: 3.2,
		baseMp: 12, mpPerLvl: 3.0,
		baseAttack: 6, atkPerLvl: 1.8,
		baseDefense: 1, defPerLvl: 0.4,
		baseInitiative: 4, initPerLvl: 0.1,
		moveRange: 2
	},
	cleric: {
		baseHp: 18, hpPerLvl: 4.5,
		baseMp: 8, mpPerLvl: 2.2,
		baseAttack: 4, atkPerLvl: 1.2,
		baseDefense: 2, defPerLvl: 0.8,
		baseInitiative: 4, initPerLvl: 0.2,
		moveRange: 2
	},
	beast: {
		baseHp: 20, hpPerLvl: 5.2,
		baseMp: 0, mpPerLvl: 0,
		baseAttack: 5, atkPerLvl: 1.6,
		baseDefense: 2, defPerLvl: 0.8,
		baseInitiative: 7, initPerLvl: 0.3,
		moveRange: 4
	}
})

const DEFAULT_CLASS_PROFILE = Object.freeze({
	baseHp: 20, hpPerLvl: 5.0,
	baseMp: 0, mpPerLvl: 0,
	baseAttack: 5, atkPerLvl: 1.4,
	baseDefense: 2, defPerLvl: 0.8,
	baseInitiative: 5, initPerLvl: 0.2,
	moveRange: 3
})

/**
 * Returns a registered mob template by ID.
 * @param {string} templateId
 * @returns {Object|null}
 */
export function getMobTemplate(templateId) {
	if (!templateId) return null
	return mobTemplatesData[templateId] || null
}

/**
 * Returns a registered mob pack by ID.
 * @param {string} packId
 * @returns {Object|null}
 */
export function getMobPack(packId) {
	if (!packId) return null
	return mobPacksData[packId] || null
}

/**
 * Calculates baseline characteristics dynamically from Race and Class.
 * Zero manual stats required in mob definitions!
 * 
 * @param {Object} params
 * @param {string} params.raceId - e.g. 'skeleton', 'human', 'beast'
 * @param {string} params.classId - e.g. 'warrior', 'archer', 'fighter'
 * @param {number} params.level - Total entity level (>= 1)
 * @param {number} [params.raceRatio=0.3] - Fraction of levels allocated to race (for non-humans)
 * @returns {Object} Calculated base stats
 */
export function calculateStatsFromRaceAndClass({ raceId, classId, level = 1, raceRatio = 0.3 }) {
	const lvl = Math.max(1, Math.round(level))
	const race = racesMap.get(raceId) || null
	const isHumanoid = !race || raceId === 'human' || race.category === 'humanoid'

	// Level distribution: humanoids put 100% of levels into class; monsters share with race
	let raceLevel = 0
	let classLevel = lvl

	if (!isHumanoid) {
		raceLevel = Math.max(1, Math.floor(lvl * raceRatio))
		classLevel = Math.max(1, lvl - raceLevel)
	}

	const classProfile = CLASS_STAT_PROFILES[classId] || DEFAULT_CLASS_PROFILE

	let hp = classProfile.baseHp + (classLevel - 1) * classProfile.hpPerLvl
	let mp = classProfile.baseMp + (classLevel - 1) * classProfile.mpPerLvl
	let attack = classProfile.baseAttack + (classLevel - 1) * classProfile.atkPerLvl
	let defense = classProfile.baseDefense + (classLevel - 1) * classProfile.defPerLvl
	let initiative = classProfile.baseInitiative + (classLevel - 1) * classProfile.initPerLvl

	// Apply Race contributions
	if (raceLevel > 0) {
		if (race && race['points-per-lvl']) {
			const ppl = race['points-per-lvl']
			hp += (ppl.hp || 0) * raceLevel * 2
			mp += (ppl.mp || 0) * raceLevel
			attack += (ppl.attack || 0) * raceLevel * 0.8
			defense += (ppl.defense || 0) * raceLevel * 0.8
		} else {
			// Racial fallback defaults
			if (raceId === 'skeleton') {
				hp += 3 * raceLevel
				defense += 1.4 * raceLevel
				attack += 1.0 * raceLevel
			} else if (raceId === 'beast') {
				hp += 4 * raceLevel
				attack += 1.5 * raceLevel
				defense += 0.6 * raceLevel
				initiative += 0.5 * raceLevel
			} else {
				hp += 3 * raceLevel
				defense += 1.0 * raceLevel
				attack += 1.0 * raceLevel
			}
		}
	}

	// Apply Race percentage buffs (baffes) if present
	if (race && race.baffes) {
		if (race.baffes.attack) {
			const percent = parseFloat(race.baffes.attack) || 0
			attack *= (1 + percent / 100)
		}
		if (race.baffes.defense) {
			const percent = parseFloat(race.baffes.defense) || 0
			defense *= (1 + percent / 100)
		}
	}

	return {
		hp: Math.max(1, Math.round(hp)),
		mp: Math.max(0, Math.round(mp)),
		ap: 2,
		maxAp: 2,
		attack: Math.max(1, Math.round(attack)),
		defense: Math.max(0, Math.round(defense)),
		initiative: Math.max(1, Math.round(initiative)),
		moveRange: classProfile.moveRange,
		classLevel,
		raceLevel
	}
}

/**
 * Resolves final mob level from various configurations:
 * - Direct number: 4
 * - Range array: [2, 5] -> random integer
 * - Dynamic scaling: { scaleWith: 'mc'|'party_avg', levelOffset: [-1, 1], minLevel: 1, maxLevel: 15 }
 * 
 * @param {number|Array<number>|Object} levelConfig
 * @param {Object} [context={}]
 * @returns {number}
 */
export function resolveMobLevel(levelConfig, context = {}) {
	if (typeof levelConfig === 'number') {
		return Math.max(1, Math.round(levelConfig))
	}

	if (Array.isArray(levelConfig) && levelConfig.length >= 2) {
		const min = Math.max(1, Math.round(levelConfig[0]))
		const max = Math.max(min, Math.round(levelConfig[1]))
		return Math.floor(min + Math.random() * (max - min + 1))
	}

	if (levelConfig && typeof levelConfig === 'object') {
		let baseLvl = 1

		if (levelConfig.scaleWith === 'party_avg') {
			const party = context.partyLevels || (context.mcLevel ? [context.mcLevel] : [1])
			const avg = party.reduce((sum, l) => sum + l, 0) / (party.length || 1)
			baseLvl = Math.round(avg)
		} else {
			// Default scaleWith 'mc'
			baseLvl = Math.max(1, Math.round(context.mcLevel || 1))
		}

		// Apply level offset
		let offset = 0
		if (Array.isArray(levelConfig.levelOffset) && levelConfig.levelOffset.length >= 2) {
			const minOff = levelConfig.levelOffset[0]
			const maxOff = levelConfig.levelOffset[1]
			offset = Math.floor(minOff + Math.random() * (maxOff - minOff + 1))
		} else if (typeof levelConfig.levelOffset === 'number') {
			offset = Math.round(levelConfig.levelOffset)
		}

		let finalLvl = baseLvl + offset

		if (typeof levelConfig.minLevel === 'number') {
			finalLvl = Math.max(levelConfig.minLevel, finalLvl)
		}
		if (typeof levelConfig.maxLevel === 'number') {
			finalLvl = Math.min(levelConfig.maxLevel, finalLvl)
		}

		return Math.max(1, Math.round(finalLvl))
	}

	return 1
}

/**
 * Resolves equipment loadout for a mob based on its level and star rating.
 * Generates 1-3 unique named items for 5★ (Legendary) mobs with regressive probability.
 * 
 * @param {Object} template
 * @param {number} level
 * @param {Object} starMeta
 * @returns {Object}
 */
export function resolveEquipmentForMob(template, level, starMeta) {
	const tiers = template.equipmentTiers || []
	if (tiers.length === 0) {
		return {
			weaponId: template.weapon || 'sword',
			armorId: null,
			shieldId: null,
			itemBonuses: { attack: 0, defense: 0, hp: 0 },
			uniqueArtifacts: [],
			equippedItems: []
		}
	}

	// Find tier matching level
	let matchingTier = tiers.find((t) => level >= t.minLevel && level <= t.maxLevel)
	if (!matchingTier) {
		// Fallback to nearest tier
		matchingTier = level < tiers[0].minLevel ? tiers[0] : tiers[tiers.length - 1]
	}

	const variants = matchingTier.variants || {}
	const variant = variants[starMeta.loadoutTier] || variants.normal || Object.values(variants)[0] || {}

	const weaponId = variant.weapon || template.weapon || 'sword'
	const armorId = variant.armor || null
	const shieldId = variant.shield || null

	const itemBonuses = { attack: 0, defense: 0, hp: 0 }
	const uniqueArtifacts = []
	const equippedItems = []

	// Process item bonuses
	const itemSlots = [
		{ slot: 'weapon', id: weaponId },
		{ slot: 'armor', id: armorId },
		{ slot: 'shield', id: shieldId }
	].filter((item) => Boolean(item.id))

	// For 5★ Legendary mobs: determine how many items become unique named artifacts
	// 1st item 100%, 2nd item 30%, 3rd item 10%
	let legendaryChanceIdx = 0

	for (const { slot, id } of itemSlots) {
		const itemDef = equipmentMap.get(id) || null
		const baseAttack = itemDef?.stats?.attack ? (parseInt(itemDef.stats.attack, 10) || 0) : 0
		const baseDefense = itemDef?.stats?.defense ? (parseInt(itemDef.stats.defense, 10) || 0) : 0
		const baseHp = itemDef?.stats?.hp ? (parseInt(itemDef.stats.hp, 10) || 0) : 0

		let isUnique = false
		let customName = null
		let quality = 1.0

		if (starMeta.stars === 5 && legendaryChanceIdx < LEGENDARY_ITEM_DROP_CHANCES.length) {
			const roll = Math.random()
			if (roll <= LEGENDARY_ITEM_DROP_CHANCES[legendaryChanceIdx]) {
				isUnique = true
				quality = rollQuality('legendary')
				const baseName = itemDef?.name || id
				customName = generateCustomName(baseName, 'legendary')
			}
			legendaryChanceIdx++
		}

		const mult = isUnique ? quality * 1.3 : 1.0
		const finalAtk = Math.round(baseAttack * mult)
		const finalDef = Math.round(baseDefense * mult)
		const finalHp = Math.round(baseHp * mult)

		itemBonuses.attack += finalAtk
		itemBonuses.defense += finalDef
		itemBonuses.hp += finalHp

		const itemRecord = {
			slot,
			itemId: id,
			name: customName || itemDef?.name || id,
			customName: customName || undefined,
			isUnique,
			quality: isUnique ? quality : 1.0,
			stats: { attack: finalAtk, defense: finalDef, hp: finalHp }
		}

		equippedItems.push(itemRecord)
		if (isUnique) {
			uniqueArtifacts.push(itemRecord)
		}
	}

	return {
		weaponId,
		armorId,
		shieldId,
		itemBonuses,
		uniqueArtifacts,
		equippedItems
	}
}

/**
 * Resolves abilities list for mob: guaranteed + weighted random pool by level and star.
 * 
 * @param {Object} template
 * @param {number} level
 * @param {Object} starMeta
 * @param {string} weaponId
 * @returns {Array<Object>}
 */
export function resolveAbilitiesForMob(template, level, starMeta, weaponId) {
	const abilitiesConfig = template.abilities || {}
	const guaranteed = (abilitiesConfig.guaranteed || []).map((ab) => ({ ...ab }))
	const pool = abilitiesConfig.pool || []

	// Filter pool by reqLevel
	const eligiblePool = pool.filter((ab) => !ab.reqLevel || ab.reqLevel <= level)

	// Determine how many random abilities to select based on stars:
	// 1★: 0, 2★: 1, 3★: 1-2, 4★: 2, 5★: 2-3
	let pickCount = 1
	if (starMeta.stars === 1) pickCount = 0
	else if (starMeta.stars === 2) pickCount = 1
	else if (starMeta.stars === 3) pickCount = Math.random() > 0.5 ? 2 : 1
	else if (starMeta.stars === 4) pickCount = 2
	else if (starMeta.stars === 5) pickCount = Math.random() > 0.4 ? 3 : 2

	pickCount = Math.min(pickCount, eligiblePool.length)

	// Weighted random selection without duplicates
	const selectedFromPool = []
	const available = [...eligiblePool]

	for (let i = 0; i < pickCount; i++) {
		if (available.length === 0) break
		const totalWeight = available.reduce((sum, a) => sum + (a.weight || 1), 0)
		let r = Math.random() * totalWeight
		let chosenIdx = 0

		for (let j = 0; j < available.length; j++) {
			const w = available[j].weight || 1
			if (r <= w) {
				chosenIdx = j
				break
			}
			r -= w
		}

		selectedFromPool.push({ ...available[chosenIdx] })
		available.splice(chosenIdx, 1)
	}

	// Merge and apply weapon pattern / geometry
	const allAbilities = [...guaranteed, ...selectedFromPool].map((ab) => {
		if (ab.useWeapon || ab.id === 'attack') {
			return applyWeaponToAbility(ab, weaponId)
		}
		return ab
	})

	return allAbilities
}

/**
 * Builds final loot list for mob: base table + chance of equipped items + guaranteed 5★ unique artifacts.
 * 
 * @param {Object} template
 * @param {number} level
 * @param {Object} starMeta
 * @param {Array<Object>} uniqueArtifacts
 * @param {Array<Object>} equippedItems
 * @returns {Array<Object>}
 */
export function resolveLootForMob(template, level, starMeta, uniqueArtifacts = [], equippedItems = []) {
	const lootList = []

	// 1. Guaranteed unique artifacts for 5★ legendary mobs
	for (const artifact of uniqueArtifacts) {
		lootList.push({
			itemId: artifact.itemId,
			name: artifact.customName || artifact.name,
			count: 1,
			isUnique: true,
			quality: artifact.quality,
			stats: artifact.stats
		})
	}

	// 2. Base loot table from template
	const baseTable = template.lootTable || []
	for (const entry of baseTable) {
		const roll = Math.random()
		// Higher star gives slightly higher loot chance
		const chance = Math.min(1.0, (entry.chance || 0.5) * (1 + (starMeta.stars - 2) * 0.1))

		if (roll <= chance) {
			let count = 1
			if (Array.isArray(entry.count) && entry.count.length >= 2) {
				const min = entry.count[0]
				const max = entry.count[1]
				count = Math.floor(min + Math.random() * (max - min + 1))
			} else if (typeof entry.count === 'number') {
				count = entry.count
			}
			lootList.push({
				itemId: entry.itemId,
				count
			})
		}
	}

	// 3. Small chance (10-20%) to drop regular equipped items
	const dropChance = 0.10 + (starMeta.stars - 1) * 0.03
	for (const eq of equippedItems) {
		if (eq.isUnique) continue // already added
		if (Math.random() <= dropChance) {
			lootList.push({
				itemId: eq.itemId,
				name: eq.name,
				count: 1
			})
		}
	}

	return lootList
}

/**
 * Creates a complete CombatUnit instance from a template and spawn config.
 * 
 * @param {string|Object} templateOrId - Mob template or template ID
 * @param {Object} [spawnConfig={}] - Specific spawn overrides (level, star, stats, weapon, etc.)
 * @param {Object} [context={}] - Context containing mcLevel, partyLevels, etc.
 * @returns {Object} CombatUnit ready for combatStore
 */
export function createMobInstance(templateOrId, spawnConfig = {}, context = {}) {
	const template = typeof templateOrId === 'string' ? getMobTemplate(templateOrId) : templateOrId
	if (!template) {
		throw new Error(`[mobFactory] Unknown mob template: ${templateOrId}`)
	}

	// 1. Resolve Level
	const level = resolveMobLevel(spawnConfig.level ?? template.defaultLevelRange ?? [1, 2], context)

	// 2. Resolve Star Rating (1★ to 5★)
	const starMeta = rollStarRating(spawnConfig.star ?? spawnConfig.stars)

	// 3. Calculate Base Stats from Race and Class
	const baseStats = calculateStatsFromRaceAndClass({
		raceId: template.race || 'human',
		classId: template.class || 'warrior',
		level,
		raceRatio: template.raceLevelRatio ?? 0.3
	})

	// 4. Apply Star Rating Multipliers
	let hp = Math.max(1, Math.round(baseStats.hp * starMeta.hpMult))
	let attack = Math.max(1, Math.round(baseStats.attack * starMeta.atkMult))
	let defense = Math.max(0, Math.round(baseStats.defense * starMeta.defMult))
	let ap = baseStats.ap + starMeta.bonusAp

	// 5. Resolve Equipment Loadout & Item Bonuses
	const equipment = resolveEquipmentForMob(template, level, starMeta)
	attack += equipment.itemBonuses.attack
	defense += equipment.itemBonuses.defense
	hp += equipment.itemBonuses.hp

	// Weapon override if specified in spawnConfig
	const finalWeapon = spawnConfig.weapon || equipment.weaponId || 'sword'

	// 6. Apply direct stat overrides from spawnConfig (if any)
	if (spawnConfig.stats && typeof spawnConfig.stats === 'object') {
		if (typeof spawnConfig.stats.hp === 'number') hp = spawnConfig.stats.hp
		if (typeof spawnConfig.stats.attack === 'number') attack = spawnConfig.stats.attack
		if (typeof spawnConfig.stats.defense === 'number') defense = spawnConfig.stats.defense
		if (typeof spawnConfig.stats.ap === 'number') ap = spawnConfig.stats.ap
	}

	// 7. Resolve Abilities
	let abilities = []
	if (Array.isArray(spawnConfig.abilities) && spawnConfig.abilities.length > 0) {
		// Explicit abilities provided
		abilities = spawnConfig.abilities.map((ab) => {
			if (typeof ab === 'string') {
				return applyWeaponToAbility({ id: ab, name: ab, useWeapon: true }, finalWeapon)
			}
			return ab.useWeapon ? applyWeaponToAbility(ab, finalWeapon) : ab
		})
	} else {
		abilities = resolveAbilitiesForMob(template, level, starMeta, finalWeapon)
	}

	// 8. Resolve Loot & Exp
	const loot = resolveLootForMob(template, level, starMeta, equipment.uniqueArtifacts, equipment.equippedItems)
	const baseExp = (template.expReward || 15) + (level - 1) * (template.expPerLevel || 5)
	const exp = Math.round(baseExp * starMeta.expMult)

	// 9. Format display name
	let displayName = spawnConfig.name || template.name
	if (starMeta.stars === 5 && !spawnConfig.name) {
		displayName = `Легендарный ${template.name}`
	} else if (starMeta.stars === 4 && !spawnConfig.name) {
		displayName = `Элитный ${template.name}`
	}

	const unitId = spawnConfig.id || `${template.id}_${Math.random().toString(36).slice(2, 7)}`

	return {
		id: unitId,
		templateId: template.id,
		name: displayName,
		team: 'enemy',
		class: template.class || 'warrior',
		race: template.race || 'human',
		level,
		star: starMeta.stars,
		starMeta,
		role: spawnConfig.role || 'normal',
		weapon: finalWeapon,
		hp,
		maxHp: hp,
		mp: baseStats.mp,
		maxMp: baseStats.mp,
		ap,
		maxAp: ap,
		attack,
		defense,
		initiative: baseStats.initiative,
		x: spawnConfig.x ?? 0,
		y: spawnConfig.y ?? 0,
		z: spawnConfig.z ?? 0,
		facing: spawnConfig.facing || 'SE',
		moveRange: template.moveRange || baseStats.moveRange || 3,
		icon: template.icon || '💀',
		sprite: template.sprite || null,
		abilities,
		loot,
		uniqueArtifacts: equipment.uniqueArtifacts,
		exp
	}
}

/**
 * Resolves a full tactical encounter from a squad, pack ID, or encounter config.
 * 
 * @param {string|Object} squadOrPackId - Mob pack ID or full squad definition
 * @param {Object} [context={}] - Context with allies, mcLevel, etc.
 * @returns {Object} Complete encounter object ready for combatStore.initCombat()
 */
export function resolveEncounterFromSquad(squadOrPackId, context = {}) {
	const pack = typeof squadOrPackId === 'string' ? getMobPack(squadOrPackId) : squadOrPackId
	if (!pack) {
		throw new Error(`[mobFactory] Unknown mob pack / squad: ${squadOrPackId}`)
	}

	// Default fallback allies if not provided in context
	const allies = context.allies || [
		{
			id: 'mc',
			name: context.mcName || 'Анон',
			team: 'ally',
			class: 'fighter',
			weapon: 'sword',
			hp: 40,
			maxHp: 40,
			mp: 0,
			maxMp: 0,
			ap: 2,
			maxAp: 2,
			attack: 8,
			defense: 4,
			initiative: 7,
			x: -1,
			y: 3,
			z: 0,
			facing: 'NW',
			moveRange: 3,
			icon: '⚔️',
			abilities: [
				{
					id: 'attack',
					name: 'Удар мечом',
					apCost: 1,
					mpCost: 0,
					minRange: 1,
					maxRange: 1,
					pattern: 'adjacent',
					type: 'damage',
					power: 1.0,
					targetType: 'enemy',
					icon: '⚔️'
				}
			]
		}
	]

	// Generate each enemy from squad
	const enemies = (pack.enemies || []).map((enemySpawn, idx) => {
		const template = getMobTemplate(enemySpawn.template) || enemySpawn
		return createMobInstance(template, {
			...enemySpawn,
			id: enemySpawn.id || `enemy_${idx + 1}`
		}, context)
	})

	return {
		id: pack.id || `encounter_${Math.random().toString(36).slice(2, 7)}`,
		name: pack.name || 'Сражение',
		description: pack.description || '',
		mapId: pack.mapId || 'tests/arena_combat_test',
		winStory: pack.winStory || null,
		loseStory: pack.loseStory || null,
		allies,
		enemies
	}
}
