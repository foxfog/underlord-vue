/**
 * src/renderer/utils/stats/characterStats.js
 * 
 * Complete RPG Character Stats & Scaling Engine:
 * 1. Active Race Starting Base Stats:
 *    - hp, mp
 *    - atk_phys (физ. атака), def_phys (физ. защита)
 *    - atk_mag (маг. атака), def_mag (маг. защита)
 *    - spd (скорость), init (инициатива), res (сопротивления)
 * 2. Character Core Attributes:
 *    - str (Сила), end (Выносливость), agi (Ловкость), int (Интеллект)
 *    - Free attribute points (free_points / free_attr_points, 5 per level)
 * 3. Race-Specific Attribute Converters (attribute_converters / converters):
 *    - Conversion ratios per 1 attribute point into combat stats
 * 4. Active Race Switching & Evolution (retains all learned skills/passives)
 * 5. Full 5-Step Stat Calculation Pipeline:
 *    Step 1: TotalAttr = BaseAttr + PassiveAttr + EquipAttr + BuffAttr
 *    Step 2: ConvertedStat = Σ (TotalAttr × RaceConverter[Attr][Stat])
 *    Step 3: PrePercentStat = RaceBaseStat + ConvertedStat + PassiveFlatStat + EquipFlatStat + BuffFlatStat
 *    Step 4: TotalPercent = Σ PassivePercent + Σ EquipPercent + Σ BuffPercent (parallel / additive)
 *    Step 5: FinalStat = PrePercentStat × (1 + TotalPercent / 100)
 */

export const CORE_ATTRIBUTES = Object.freeze(['str', 'end', 'agi', 'int'])
export const LEGACY_CORE_ATTRIBUTES = Object.freeze(['strength', 'endurance', 'agility', 'intelligence'])

export const DEFAULT_ATTRIBUTES = Object.freeze({
	str: 0,
	end: 0,
	agi: 0,
	int: 0,
	// Backwards compatibility aliases
	strength: 0,
	endurance: 0,
	agility: 0,
	intelligence: 0
})

export const ATTRIBUTE_POINTS_PER_LEVEL = 5

export const DEFAULT_BASE_STATS = Object.freeze({
	hp: 100,
	mp: 30,
	atk_phys: 10,
	def_phys: 6,
	atk_mag: 6,
	def_mag: 6,
	spd: 3,
	init: 5,
	crit_chance: 5,
	crit_dmg: 50,
	res: {},
	// Backwards compatibility aliases
	speed: 3,
	initiative: 5,
	crit_rate: 5,
	crit_damage: 50,
	resistances: {},
	phys_attack: 10,
	phys_defense: 6,
	mag_attack: 6,
	mag_defense: 6
})

export const DEFAULT_ATTRIBUTE_CONVERTERS = Object.freeze({
	str: {
		hp: 20,
		atk_phys: 10,
		def_phys: 8,
		phys_attack: 10,
		phys_defense: 8
	},
	end: {
		hp: 35,
		def_phys: 10,
		phys_defense: 10,
		res: { physical: 1 },
		resistances: { physical: 1 }
	},
	agi: {
		spd: 0.1,
		init: 2,
		atk_phys: 4,
		speed: 0.1,
		initiative: 2,
		phys_attack: 4
	},
	int: {
		mp: 20,
		atk_mag: 10,
		def_mag: 8,
		mag_attack: 10,
		mag_defense: 8
	},
	// Backwards compatibility aliases
	strength: {
		hp: 20,
		atk_phys: 10,
		def_phys: 8,
		phys_attack: 10,
		phys_defense: 8
	},
	endurance: {
		hp: 35,
		def_phys: 10,
		phys_defense: 10,
		res: { physical: 1 },
		resistances: { physical: 1 }
	},
	agility: {
		spd: 0.1,
		init: 2,
		atk_phys: 4,
		speed: 0.1,
		initiative: 2,
		phys_attack: 4
	},
	intelligence: {
		mp: 20,
		atk_mag: 10,
		def_mag: 8,
		mag_attack: 10,
		mag_defense: 8
	}
})

export const CATEGORY_BASE_STAT_DEFAULTS = Object.freeze({
	humanoid: {
		hp: 100,
		mp: 30,
		atk_phys: 10,
		def_phys: 6,
		atk_mag: 6,
		def_mag: 6,
		spd: 3,
		init: 5,
		crit_chance: 5,
		crit_dmg: 50,
		res: {},
		speed: 3,
		initiative: 5,
		crit_rate: 5,
		crit_damage: 50,
		resistances: {},
		phys_attack: 10,
		phys_defense: 6,
		mag_attack: 6,
		mag_defense: 6
	},
	'demi-human': {
		hp: 110,
		mp: 20,
		atk_phys: 11,
		def_phys: 7,
		atk_mag: 5,
		def_mag: 5,
		spd: 3.5,
		init: 6,
		crit_chance: 7,
		crit_dmg: 50,
		res: {},
		speed: 3.5,
		initiative: 6,
		crit_rate: 7,
		crit_damage: 50,
		resistances: {},
		phys_attack: 11,
		phys_defense: 7,
		mag_attack: 5,
		mag_defense: 5
	},
	heteromorphic: {
		hp: 130,
		mp: 40,
		atk_phys: 12,
		def_phys: 9,
		atk_mag: 8,
		def_mag: 8,
		spd: 3,
		init: 4,
		crit_chance: 5,
		crit_dmg: 60,
		res: { dark: 20 },
		speed: 3,
		initiative: 4,
		crit_rate: 5,
		crit_damage: 60,
		resistances: { dark: 20 },
		phys_attack: 12,
		phys_defense: 9,
		mag_attack: 8,
		mag_defense: 8
	}
})

const ATTRIBUTE_ALIASES = Object.freeze({
	str: 'str',
	strength: 'str',
	end: 'end',
	con: 'end',
	vit: 'end',
	endurance: 'end',
	agi: 'agi',
	dex: 'agi',
	agility: 'agi',
	int: 'int',
	intelligence: 'int'
})

const STAT_ALIASES = Object.freeze({
	hp: 'hp',
	health: 'hp',
	maxhp: 'hp',
	max_hp: 'hp',
	mp: 'mp',
	mana: 'mp',
	maxmp: 'mp',
	max_mp: 'mp',
	atk_phys: 'atk_phys',
	phys_attack: 'atk_phys',
	phys_atk: 'atk_phys',
	attack: 'atk_phys',
	physatk: 'atk_phys',
	def_phys: 'def_phys',
	phys_defense: 'def_phys',
	phys_def: 'def_phys',
	defense: 'def_phys',
	physdef: 'def_phys',
	atk_mag: 'atk_mag',
	mag_attack: 'atk_mag',
	mag_atk: 'atk_mag',
	magatk: 'atk_mag',
	magic_attack: 'atk_mag',
	def_mag: 'def_mag',
	mag_defense: 'def_mag',
	mag_def: 'def_mag',
	magdef: 'def_mag',
	magic_defense: 'def_mag',
	spd: 'spd',
	speed: 'spd',
	moverange: 'spd',
	move_range: 'spd',
	init: 'init',
	initiative: 'init',
	crit_chance: 'crit_chance',
	crit_rate: 'crit_chance',
	crit: 'crit_chance',
	critical_chance: 'crit_chance',
	crit_dmg: 'crit_dmg',
	crit_damage: 'crit_dmg',
	critical_damage: 'crit_dmg',
	crit_mult: 'crit_dmg',
	crit_multiplier: 'crit_dmg',
	res: 'res',
	resistances: 'res',
	resistance: 'res'
})

/**
 * Normalizes an attribute name (e.g. 'strength' -> 'str', 'str' -> 'str').
 * @param {string} name
 * @returns {'str'|'end'|'agi'|'int'|null}
 */
export function normalizeAttributeName(name) {
	if (!name || typeof name !== 'string') return null
	const lower = name.trim().toLowerCase()
	return ATTRIBUTE_ALIASES[lower] || null
}

/**
 * Normalizes a combat stat name (e.g. 'health' -> 'hp', 'phys_attack' -> 'atk_phys', 'initiative' -> 'init').
 * @param {string} name
 * @returns {string|null}
 */
export function normalizeStatName(name) {
	if (!name || typeof name !== 'string') return null
	const lower = name.trim().toLowerCase().replace(/-/g, '_')
	return STAT_ALIASES[lower] || null
}

/**
 * Parses any source (equipment item, passive skill, trait, buff) for:
 * 1. Flat attributes (str, end, agi, int)
 * 2. Flat combat stats (hp, mp, atk_phys, def_phys, etc.)
 * 3. Percentage combat stats (e.g. "20%", hp_percent: 15)
 * 4. Resistances (res / resistances)
 * 
 * @param {Object} source - Item, Skill, Buff, or stats dictionary
 * @returns {{
 *   attributes: Record<string, number>,
 *   flatStats: Record<string, number>,
 *   percentStats: Record<string, number>,
 *   res: Record<string, number>,
 *   resistances: Record<string, number>
 * }}
 */
export function parseStatsModifier(source) {
	const resMap = {}
	const result = {
		attributes: {
			str: 0,
			end: 0,
			agi: 0,
			int: 0,
			strength: 0,
			endurance: 0,
			agility: 0,
			intelligence: 0
		},
		flatStats: {},
		percentStats: {},
		res: resMap,
		resistances: resMap
	}

	if (!source || typeof source !== 'object') return result

	// Collect candidate dictionaries from source, source.stats, source.effects, source.data, source.data.stats, source.attributes
	const candidatePools = []
	if (source.stats && typeof source.stats === 'object') candidatePools.push(source.stats)
	if (source.effects && typeof source.effects === 'object') candidatePools.push(source.effects)
	if (source.data && typeof source.data === 'object') {
		candidatePools.push(source.data)
		if (source.data.stats && typeof source.data.stats === 'object') {
			candidatePools.push(source.data.stats)
		}
		if (source.data.effects && typeof source.data.effects === 'object') {
			candidatePools.push(source.data.effects)
		}
	}
	if (source.attributes && typeof source.attributes === 'object') candidatePools.push(source.attributes)
	candidatePools.push(source)

	const processedKeys = new Set()

	for (const pool of candidatePools) {
		for (const [rawKey, rawVal] of Object.entries(pool)) {
			if (['id', 'name', 'icon', 'category', 'description', 'slot', 'type', 'stats', 'effects', 'data', 'parts', 'characters'].includes(rawKey)) {
				continue
			}
			const poolUniqueKey = `${rawKey}:${rawVal}`
			if (processedKeys.has(poolUniqueKey)) continue
			processedKeys.add(poolUniqueKey)

			// 1. Check if key is a percentage indicator, e.g. hp_percent, hp_pct, atk_phys_percent
			const lowerKey = rawKey.toLowerCase().replace(/-/g, '_')
			const isPercentKey = lowerKey.endsWith('_percent') || lowerKey.endsWith('_pct')
			const baseStatKey = isPercentKey ? lowerKey.replace(/(_percent|_pct)$/, '') : lowerKey

			// Check Resistances
			if ((baseStatKey === 'res' || baseStatKey === 'resistances') && typeof rawVal === 'object' && rawVal !== null) {
				for (const [resType, resAmt] of Object.entries(rawVal)) {
					const num = parseFloat(resAmt) || 0
					resMap[resType] = (resMap[resType] || 0) + num
				}
				continue
			}

			// Check Attribute
			const normalizedAttr = normalizeAttributeName(baseStatKey)
			if (normalizedAttr && !isPercentKey && typeof rawVal !== 'string') {
				const num = parseFloat(rawVal) || 0
				result.attributes[normalizedAttr] = (result.attributes[normalizedAttr] || 0) + num
				// Mirror to long name
				const longName = normalizedAttr === 'str' ? 'strength' : normalizedAttr === 'end' ? 'endurance' : normalizedAttr === 'agi' ? 'agility' : 'intelligence'
				result.attributes[longName] = result.attributes[normalizedAttr]
				continue
			}

			// Check Stat
			const normalizedStat = normalizeStatName(baseStatKey)
			if (normalizedStat) {
				// String percentage, e.g. "20%", "+15%", "-10%"
				if (typeof rawVal === 'string' && rawVal.includes('%')) {
					const cleanVal = parseFloat(rawVal.replace('%', '')) || 0
					result.percentStats[normalizedStat] = (result.percentStats[normalizedStat] || 0) + cleanVal
				} else if (isPercentKey) {
					const num = parseFloat(rawVal) || 0
					result.percentStats[normalizedStat] = (result.percentStats[normalizedStat] || 0) + num
				} else {
					// Direct flat number
					const num = parseFloat(rawVal) || 0
					result.flatStats[normalizedStat] = (result.flatStats[normalizedStat] || 0) + num
				}
				continue
			}

			// Also allow string percentage attributes if any, e.g. str: "10%"
			if (normalizedAttr) {
				if (typeof rawVal === 'string' && rawVal.includes('%')) {
					const cleanVal = parseFloat(rawVal.replace('%', '')) || 0
					result.percentStats[normalizedAttr] = (result.percentStats[normalizedAttr] || 0) + cleanVal
				} else {
					const num = parseFloat(rawVal) || 0
					result.attributes[normalizedAttr] = (result.attributes[normalizedAttr] || 0) + num
					const longName = normalizedAttr === 'str' ? 'strength' : normalizedAttr === 'end' ? 'endurance' : normalizedAttr === 'agi' ? 'agility' : 'intelligence'
					result.attributes[longName] = result.attributes[normalizedAttr]
				}
			}
		}
	}

	return result
}

/**
 * Resolves starting base_stats and attribute_converters for a race.
 * Provides guaranteed fallback values for all 114 races without throwing errors.
 * 
 * @param {string|Object} raceOrId
 * @param {Array<Object>} [racesData=[]]
 * @returns {{
 *   id: string,
 *   name: string,
 *   base_stats: Object,
 *   attribute_converters: Object
 * }}
 */
export function getRaceStatsConfig(raceOrId, racesData = []) {
	let race = null
	if (typeof raceOrId === 'string') {
		race = (racesData || []).find((r) => r.id === raceOrId) || { id: raceOrId, name: raceOrId }
	} else if (raceOrId && typeof raceOrId === 'object') {
		race = raceOrId
	} else {
		race = { id: 'human', name: 'Человек' }
	}

	const category = race.category || 'humanoid'
	const categoryBase = CATEGORY_BASE_STAT_DEFAULTS[category] || CATEGORY_BASE_STAT_DEFAULTS.humanoid

	// 1. Base stats resolution
	const rawBase = race.base_stats || race.stats || {}
	const baseRes = {
		...(categoryBase.res || categoryBase.resistances || {}),
		...(rawBase.res || rawBase.resistances || {})
	}

	let baseStats = {
		hp: rawBase.hp ?? categoryBase.hp,
		mp: rawBase.mp ?? categoryBase.mp,
		atk_phys: rawBase.atk_phys ?? rawBase.phys_attack ?? rawBase.attack ?? categoryBase.atk_phys,
		def_phys: rawBase.def_phys ?? rawBase.phys_defense ?? rawBase.defense ?? categoryBase.def_phys,
		atk_mag: rawBase.atk_mag ?? rawBase.mag_attack ?? categoryBase.atk_mag,
		def_mag: rawBase.def_mag ?? rawBase.mag_defense ?? categoryBase.def_mag,
		spd: rawBase.spd ?? rawBase.speed ?? categoryBase.spd,
		init: rawBase.init ?? rawBase.initiative ?? categoryBase.init,
		crit_chance: rawBase.crit_chance ?? rawBase.crit_rate ?? categoryBase.crit_chance ?? 5,
		crit_dmg: rawBase.crit_dmg ?? rawBase.crit_damage ?? categoryBase.crit_dmg ?? 50,
		res: baseRes
	}

	// Built-in iconic racial defaults if not explicitly configured
	if (!race.base_stats) {
		if (race.id === 'human') {
			baseStats = {
				hp: 100, mp: 30, atk_phys: 10, def_phys: 6, atk_mag: 6, def_mag: 6, spd: 3, init: 5, crit_chance: 5, crit_dmg: 50, res: {}
			}
		} else if (race.id === 'elf') {
			baseStats = {
				hp: 70, mp: 60, atk_phys: 8, def_phys: 4, atk_mag: 12, def_mag: 10, spd: 4, init: 8, crit_chance: 8, crit_dmg: 50, res: { nature: 10 }
			}
		} else if (race.id === 'skeleton') {
			baseStats = {
				hp: 120, mp: 10, atk_phys: 12, def_phys: 8, atk_mag: 4, def_mag: 4, spd: 2, init: 4, crit_chance: 4, crit_dmg: 60,
				res: { poison: 100, dark: 50, holy: -50, fire: -20 }
			}
		} else if (race.id === 'elder-lich' || race.id === 'lich') {
			baseStats = {
				hp: 220, mp: 200, atk_phys: 14, def_phys: 12, atk_mag: 32, def_mag: 28, spd: 3, init: 7, crit_chance: 5, crit_dmg: 70,
				res: { poison: 100, dark: 70, cold: 40, holy: -40 }
			}
		} else if (race.id === 'dragon' || race.id === 'dragonoid') {
			baseStats = {
				hp: 350, mp: 80, atk_phys: 24, def_phys: 18, atk_mag: 16, def_mag: 14, spd: 3, init: 6, crit_chance: 6, crit_dmg: 75,
				res: { fire: 50, physical: 15 }
			}
		}
	}

	// Add backwards-compatible aliases directly on base_stats
	baseStats.speed = baseStats.spd
	baseStats.initiative = baseStats.init
	baseStats.crit_rate = baseStats.crit_chance
	baseStats.crit_damage = baseStats.crit_dmg
	baseStats.resistances = baseStats.res
	baseStats.phys_attack = baseStats.atk_phys
	baseStats.phys_defense = baseStats.def_phys
	baseStats.mag_attack = baseStats.atk_mag
	baseStats.mag_defense = baseStats.def_mag

	// 2. Attribute converters resolution
	const rawConverters = race.attribute_converters || race.converters || {}
	const normalizeConverterBranch = (rawBranch, defaultBranch) => {
		const branch = { ...defaultBranch, ...(rawBranch || {}) }
		const branchRes = {
			...(defaultBranch.res || defaultBranch.resistances || {}),
			...(branch.res || branch.resistances || {})
		}
		const out = {
			hp: branch.hp ?? defaultBranch.hp ?? 0,
			mp: branch.mp ?? defaultBranch.mp ?? 0,
			atk_phys: branch.atk_phys ?? branch.phys_attack ?? defaultBranch.atk_phys ?? 0,
			def_phys: branch.def_phys ?? branch.phys_defense ?? defaultBranch.def_phys ?? 0,
			atk_mag: branch.atk_mag ?? branch.mag_attack ?? defaultBranch.atk_mag ?? 0,
			def_mag: branch.def_mag ?? branch.mag_defense ?? defaultBranch.def_mag ?? 0,
			spd: branch.spd ?? branch.speed ?? defaultBranch.spd ?? 0,
			init: branch.init ?? branch.initiative ?? defaultBranch.init ?? 0,
			crit_chance: branch.crit_chance ?? branch.crit_rate ?? defaultBranch.crit_chance ?? 0,
			crit_dmg: branch.crit_dmg ?? branch.crit_damage ?? defaultBranch.crit_dmg ?? 0,
			res: branchRes
		}
		// Aliases
		out.speed = out.spd
		out.initiative = out.init
		out.crit_rate = out.crit_chance
		out.crit_damage = out.crit_dmg
		out.resistances = out.res
		out.phys_attack = out.atk_phys
		out.phys_defense = out.def_phys
		out.mag_attack = out.atk_mag
		out.mag_defense = out.def_mag
		return out
	}

	const converters = {
		str: normalizeConverterBranch(rawConverters.str || rawConverters.strength, DEFAULT_ATTRIBUTE_CONVERTERS.str),
		end: normalizeConverterBranch(rawConverters.end || rawConverters.endurance, DEFAULT_ATTRIBUTE_CONVERTERS.end),
		agi: normalizeConverterBranch(rawConverters.agi || rawConverters.agility, DEFAULT_ATTRIBUTE_CONVERTERS.agi),
		int: normalizeConverterBranch(rawConverters.int || rawConverters.intelligence, DEFAULT_ATTRIBUTE_CONVERTERS.int)
	}

	// Built-in iconic racial converters if not explicitly configured
	if (!race.attribute_converters && !race.converters) {
		if (race.id === 'human') {
			converters.str = normalizeConverterBranch({ hp: 20, atk_phys: 10, def_phys: 8 }, DEFAULT_ATTRIBUTE_CONVERTERS.str)
			converters.end = normalizeConverterBranch({ hp: 35, def_phys: 10, res: { physical: 1 } }, DEFAULT_ATTRIBUTE_CONVERTERS.end)
			converters.agi = normalizeConverterBranch({ spd: 0.1, init: 2, atk_phys: 4 }, DEFAULT_ATTRIBUTE_CONVERTERS.agi)
			converters.int = normalizeConverterBranch({ mp: 20, atk_mag: 10, def_mag: 8 }, DEFAULT_ATTRIBUTE_CONVERTERS.int)
		} else if (race.id === 'elf') {
			converters.str = normalizeConverterBranch({ hp: 15, atk_phys: 8, def_phys: 7 }, DEFAULT_ATTRIBUTE_CONVERTERS.str)
			converters.end = normalizeConverterBranch({ hp: 25, def_phys: 8 }, DEFAULT_ATTRIBUTE_CONVERTERS.end)
			converters.agi = normalizeConverterBranch({ spd: 0.15, init: 3, atk_phys: 6 }, DEFAULT_ATTRIBUTE_CONVERTERS.agi)
			converters.int = normalizeConverterBranch({ mp: 30, atk_mag: 15, def_mag: 10 }, DEFAULT_ATTRIBUTE_CONVERTERS.int)
		} else if (race.id === 'skeleton') {
			converters.str = normalizeConverterBranch({ hp: 25, atk_phys: 12, def_phys: 10 }, DEFAULT_ATTRIBUTE_CONVERTERS.str)
			converters.end = normalizeConverterBranch({ hp: 40, def_phys: 14, res: { physical: 2 } }, DEFAULT_ATTRIBUTE_CONVERTERS.end)
			converters.agi = normalizeConverterBranch({ spd: 0.08, init: 1, atk_phys: 3 }, DEFAULT_ATTRIBUTE_CONVERTERS.agi)
			converters.int = normalizeConverterBranch({ mp: 15, atk_mag: 8, def_mag: 6 }, DEFAULT_ATTRIBUTE_CONVERTERS.int)
		} else if (race.id === 'elder-lich' || race.id === 'lich') {
			converters.str = normalizeConverterBranch({ hp: 18, atk_phys: 8, def_phys: 8 }, DEFAULT_ATTRIBUTE_CONVERTERS.str)
			converters.end = normalizeConverterBranch({ hp: 30, def_phys: 12, def_mag: 5 }, DEFAULT_ATTRIBUTE_CONVERTERS.end)
			converters.agi = normalizeConverterBranch({ spd: 0.1, init: 2, atk_phys: 4 }, DEFAULT_ATTRIBUTE_CONVERTERS.agi)
			converters.int = normalizeConverterBranch({ mp: 45, atk_mag: 22, def_mag: 16 }, DEFAULT_ATTRIBUTE_CONVERTERS.int)
		} else if (race.id === 'dragon' || race.id === 'dragonoid') {
			converters.str = normalizeConverterBranch({ hp: 30, atk_phys: 16, def_phys: 12 }, DEFAULT_ATTRIBUTE_CONVERTERS.str)
			converters.end = normalizeConverterBranch({ hp: 50, def_phys: 16, res: { physical: 3 } }, DEFAULT_ATTRIBUTE_CONVERTERS.end)
			converters.agi = normalizeConverterBranch({ spd: 0.1, init: 2, atk_phys: 5 }, DEFAULT_ATTRIBUTE_CONVERTERS.agi)
			converters.int = normalizeConverterBranch({ mp: 25, atk_mag: 12, def_mag: 10 }, DEFAULT_ATTRIBUTE_CONVERTERS.int)
		}
	}

	// Backwards compatibility aliases for converter roots
	converters.strength = converters.str
	converters.endurance = converters.end
	converters.agility = converters.agi
	converters.intelligence = converters.int

	return {
		...race,
		id: race.id,
		name: race.name || race.id,
		sp_lvl: race.sp_lvl !== undefined ? race.sp_lvl : (race.skill_points_per_level !== undefined ? race.skill_points_per_level : 1),
		mp_lvl: race.mp_lvl !== undefined ? race.mp_lvl : (race.spell_points_per_level !== undefined ? race.spell_points_per_level : 0),
		skill_points_per_level: race.sp_lvl !== undefined ? race.sp_lvl : (race.skill_points_per_level !== undefined ? race.skill_points_per_level : 1),
		spell_points_per_level: race.mp_lvl !== undefined ? race.mp_lvl : (race.spell_points_per_level !== undefined ? race.spell_points_per_level : 0),
		base_stats: baseStats,
		attribute_converters: converters
	}
}

/**
 * Calculates complete character stats through the 5-step pipeline:
 * 
 * Step 1: Total Attributes (Base + Passives + Equipment + Buffs)
 * Step 2: Converted Stats (Total Attributes converted via active race converters)
 * Step 3: Pre-percentage Stat Sum (Active Race Base + Converted + Flat Passives + Flat Equipment + Flat Buffs)
 * Step 4: Additive Parallel Percentages (Passives% + Equipment% + Buffs%)
 * Step 5: Final Combat Stat Calculation (PrePercent × (1 + TotalPercent / 100))
 * 
 * @param {Object} params
 * @param {Object} params.character - Character object or progression state
 * @param {string} [params.activeRaceId] - Explicit active race ID
 * @param {Array<Object>} [params.racesData=[]] - Array of race definitions
 * @param {Array<Object>} [params.equipmentItems=[]] - Array of equipped item objects
 * @param {Array<Object>} [params.buffs=[]] - Array of active buff objects
 * @param {Array<Object>} [params.learnedSkills=[]] - Array of learned passive skills / traits
 * @param {number} [params.level] - Character level (defaults to character.lvl || 1)
 * @returns {Object} Complete calculation breakdown & final stats
 */
export function calculateCharacterStats({
	character = {},
	activeRaceId = null,
	racesData = [],
	equipmentItems = [],
	buffs = [],
	learnedSkills = [],
	level = null
} = {}) {
	// Determine character level & active race
	const lvl = Math.max(1, Math.round(level ?? character.lvl ?? character.char_level ?? 1))
	const raceId = activeRaceId || character.active_race || (Array.isArray(character.races) && character.races[0]) || 'human'
	const raceConfig = getRaceStatsConfig(raceId, racesData)

	// Step 1: Base & Modifier Attributes
	const charAttrs = character.attributes || character
	const baseAttrs = {
		str: Number(charAttrs.str ?? charAttrs.strength ?? 0),
		end: Number(charAttrs.end ?? charAttrs.endurance ?? 0),
		agi: Number(charAttrs.agi ?? charAttrs.agility ?? 0),
		int: Number(charAttrs.int ?? charAttrs.intelligence ?? 0)
	}

	// Parse modifiers from all sources
	const parsedPassives = (learnedSkills || []).map(parseStatsModifier)
	const parsedEquip = (equipmentItems || []).map(parseStatsModifier)
	const parsedBuffs = (buffs || []).map(parseStatsModifier)

	// Sum attributes by source
	const passiveAttrs = { str: 0, end: 0, agi: 0, int: 0 }
	for (const p of parsedPassives) {
		for (const attr of CORE_ATTRIBUTES) passiveAttrs[attr] += p.attributes[attr] || 0
	}

	const equipAttrs = { str: 0, end: 0, agi: 0, int: 0 }
	for (const e of parsedEquip) {
		for (const attr of CORE_ATTRIBUTES) equipAttrs[attr] += e.attributes[attr] || 0
	}

	const buffAttrs = { str: 0, end: 0, agi: 0, int: 0 }
	for (const b of parsedBuffs) {
		for (const attr of CORE_ATTRIBUTES) buffAttrs[attr] += b.attributes[attr] || 0
	}

	// Total Attributes (Step 1)
	const totalAttrs = {
		str: baseAttrs.str + passiveAttrs.str + equipAttrs.str + buffAttrs.str,
		end: baseAttrs.end + passiveAttrs.end + equipAttrs.end + buffAttrs.end,
		agi: baseAttrs.agi + passiveAttrs.agi + equipAttrs.agi + buffAttrs.agi,
		int: baseAttrs.int + passiveAttrs.int + equipAttrs.int + buffAttrs.int
	}

	// Add backwards-compatible full-name attribute aliases
	for (const pool of [baseAttrs, passiveAttrs, equipAttrs, buffAttrs, totalAttrs]) {
		pool.strength = pool.str
		pool.endurance = pool.end
		pool.agility = pool.agi
		pool.intelligence = pool.int
	}

	// Step 2: Converted Stats from Active Race Converters
	const convertedRes = {}
	const convertedStats = {
		hp: 0,
		mp: 0,
		atk_phys: 0,
		def_phys: 0,
		atk_mag: 0,
		def_mag: 0,
		spd: 0,
		init: 0,
		res: convertedRes,
		resistances: convertedRes
	}

	const CONVERTER_STAT_KEYS = ['hp', 'mp', 'atk_phys', 'def_phys', 'atk_mag', 'def_mag', 'spd', 'init', 'crit_chance', 'crit_dmg']
	const converters = raceConfig.attribute_converters
	for (const attr of CORE_ATTRIBUTES) {
		const totalVal = totalAttrs[attr]
		if (totalVal <= 0) continue
		const conv = converters[attr] || converters[attr === 'str' ? 'strength' : attr === 'end' ? 'endurance' : attr === 'agi' ? 'agility' : 'intelligence'] || {}

		for (const stat of CONVERTER_STAT_KEYS) {
			const ratio = Number(conv[stat] !== undefined ? conv[stat] : conv[STAT_ALIASES[stat]]) || 0
			if (ratio !== 0) {
				convertedStats[stat] = (convertedStats[stat] || 0) + totalVal * ratio
			}
		}

		const convRes = conv.res || conv.resistances
		if (convRes && typeof convRes === 'object') {
			for (const [resKey, resRatio] of Object.entries(convRes)) {
				convertedRes[resKey] = (convertedRes[resKey] || 0) + totalVal * (Number(resRatio) || 0)
			}
		}
	}

	// Step 3 & 4: Flat stats and percentage modifiers from Passives, Equipment, and Buffs
	const flatPassives = {}
	const percentPassives = {}
	const passiveResistances = {}
	for (const p of parsedPassives) {
		for (const [k, v] of Object.entries(p.flatStats)) flatPassives[k] = (flatPassives[k] || 0) + v
		for (const [k, v] of Object.entries(p.percentStats)) percentPassives[k] = (percentPassives[k] || 0) + v
		for (const [k, v] of Object.entries(p.res)) passiveResistances[k] = (passiveResistances[k] || 0) + v
	}

	const flatEquip = {}
	const percentEquip = {}
	const equipResistances = {}
	for (const e of parsedEquip) {
		for (const [k, v] of Object.entries(e.flatStats)) flatEquip[k] = (flatEquip[k] || 0) + v
		for (const [k, v] of Object.entries(e.percentStats)) percentEquip[k] = (percentEquip[k] || 0) + v
		for (const [k, v] of Object.entries(e.res)) equipResistances[k] = (equipResistances[k] || 0) + v
	}

	const flatBuffs = {}
	const percentBuffs = {}
	const buffResistances = {}
	for (const b of parsedBuffs) {
		for (const [k, v] of Object.entries(b.flatStats)) flatBuffs[k] = (flatBuffs[k] || 0) + v
		for (const [k, v] of Object.entries(b.percentStats)) percentBuffs[k] = (percentBuffs[k] || 0) + v
		for (const [k, v] of Object.entries(b.res)) buffResistances[k] = (buffResistances[k] || 0) + v
	}

	// List of all primary combat stats to calculate (canonical short names)
	const primaryStats = [
		'hp',
		'mp',
		'atk_phys',
		'def_phys',
		'atk_mag',
		'def_mag',
		'spd',
		'init',
		'crit_chance',
		'crit_dmg'
	]

	const breakdown = {}
	const finalStats = {}

	for (const stat of primaryStats) {
		const raceBase = Number(raceConfig.base_stats[stat] ?? raceConfig.base_stats[stat === 'spd' ? 'speed' : stat === 'init' ? 'initiative' : (stat === 'crit_chance' ? 'crit_rate' : (stat === 'crit_dmg' ? 'crit_damage' : stat))] ?? 0)
		const converted = Number(convertedStats[stat] || 0)
		const passFlat = Number(flatPassives[stat] || 0)
		const eqFlat = Number(flatEquip[stat] || 0)
		const bfFlat = Number(flatBuffs[stat] || 0)

		// Step 3: Pre-percentage Stat Sum
		const prePercent = raceBase + converted + passFlat + eqFlat + bfFlat

		// Step 4: Additive Parallel Percentages
		const passPct = Number(percentPassives[stat] || 0)
		const eqPct = Number(percentEquip[stat] || 0)
		const bfPct = Number(percentBuffs[stat] || 0)
		const totalPct = passPct + eqPct + bfPct

		// Step 5: Final Stat Calculation
		const rawFinal = prePercent * (1 + totalPct / 100)
		let finalVal = rawFinal
		if (stat === 'spd' || stat === 'crit_chance' || stat === 'crit_dmg') {
			finalVal = Math.max(0, Math.round(rawFinal * 10) / 10)
		} else if (stat === 'hp') {
			finalVal = Math.max(1, Math.round(rawFinal))
		} else if (stat === 'mp') {
			finalVal = Math.max(0, Math.round(rawFinal))
		} else {
			finalVal = Math.max(0, Math.round(rawFinal))
		}

		const stepRecord = {
			raceBase,
			converted,
			flatPassives: passFlat,
			flatEquip: eqFlat,
			flatBuffs: bfFlat,
			prePercent,
			percentPassives: passPct,
			percentEquip: eqPct,
			percentBuffs: bfPct,
			totalPercent: totalPct,
			final: finalVal
		}

		breakdown[stat] = stepRecord
		finalStats[stat] = finalVal
	}

	// Calculate Resistances
	const finalResistances = { ...(raceConfig.base_stats.res || raceConfig.base_stats.resistances || {}) }
	for (const [resKey, val] of Object.entries(convertedRes)) {
		finalResistances[resKey] = (finalResistances[resKey] || 0) + val
	}
	for (const [resKey, val] of Object.entries(passiveResistances)) {
		finalResistances[resKey] = (finalResistances[resKey] || 0) + val
	}
	for (const [resKey, val] of Object.entries(equipResistances)) {
		finalResistances[resKey] = (finalResistances[resKey] || 0) + val
	}
	for (const [resKey, val] of Object.entries(buffResistances)) {
		finalResistances[resKey] = (finalResistances[resKey] || 0) + val
	}
	finalStats.res = finalResistances
	finalStats.resistances = finalResistances

	// Mirror legacy aliases on finalStats and breakdown
	finalStats.speed = finalStats.spd
	finalStats.initiative = finalStats.init
	finalStats.crit_rate = finalStats.crit_chance
	finalStats.crit_damage = finalStats.crit_dmg
	finalStats.phys_attack = finalStats.atk_phys
	finalStats.phys_defense = finalStats.def_phys
	finalStats.mag_attack = finalStats.atk_mag
	finalStats.mag_defense = finalStats.def_mag

	breakdown.speed = breakdown.spd
	breakdown.initiative = breakdown.init
	breakdown.crit_rate = breakdown.crit_chance
	breakdown.crit_damage = breakdown.crit_dmg
	breakdown.phys_attack = breakdown.atk_phys
	breakdown.phys_defense = breakdown.def_phys
	breakdown.mag_attack = breakdown.atk_mag
	breakdown.mag_defense = breakdown.def_mag

	return {
		level: lvl,
		activeRaceId: raceConfig.id,
		activeRace: raceConfig,
		attributes: {
			base: baseAttrs,
			passives: passiveAttrs,
			equipment: equipAttrs,
			buffs: buffAttrs,
			total: totalAttrs
		},
		breakdown,
		stats: finalStats
	}
}

/**
 * Procedurally distributes attribute points for mobs based on level and archetype.
 * 
 * @param {Object} params
 * @param {number} params.level - Mob level (>= 1)
 * @param {string} [params.archetype='warrior'] - 'warrior'|'tank'|'archer'|'mage'|'assassin'|'balanced'
 * @param {number} [params.pointsPerLevel=5] - Attribute points per level
 * @returns {Record<string, number>} Distributed attributes
 */
export function distributeMobAttributes({
	level = 1,
	archetype = 'warrior',
	pointsPerLevel = ATTRIBUTE_POINTS_PER_LEVEL
} = {}) {
	const lvl = Math.max(1, Math.round(level))
	const totalPoints = (lvl - 1) * pointsPerLevel

	const ratios = {
		warrior: { str: 0.45, end: 0.35, agi: 0.15, int: 0.05 },
		tank: { str: 0.30, end: 0.55, agi: 0.10, int: 0.05 },
		archer: { str: 0.25, end: 0.20, agi: 0.50, int: 0.05 },
		mage: { str: 0.05, end: 0.20, agi: 0.15, int: 0.60 },
		assassin: { str: 0.35, end: 0.15, agi: 0.45, int: 0.05 },
		balanced: { str: 0.25, end: 0.25, agi: 0.25, int: 0.25 }
	}

	const selected = ratios[archetype] || ratios.warrior
	let remaining = totalPoints
	const res = { str: 0, end: 0, agi: 0, int: 0 }

	for (const attr of CORE_ATTRIBUTES) {
		const allocated = Math.floor(totalPoints * selected[attr])
		res[attr] = allocated
		remaining -= allocated
	}

	// Distribute any remainder due to floor
	if (remaining > 0) {
		const sorted = [...CORE_ATTRIBUTES].sort((a, b) => selected[b] - selected[a])
		for (let i = 0; i < remaining; i++) {
			res[sorted[i % sorted.length]] += 1
		}
	}

	// Aliases
	res.strength = res.str
	res.endurance = res.end
	res.agility = res.agi
	res.intelligence = res.int

	return res
}
