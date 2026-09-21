import { describe, it, expect, beforeEach } from 'vitest'
import {
	calculateCharacterStats,
	getRaceStatsConfig,
	parseStatsModifier,
	distributeMobAttributes,
	normalizeAttributeName,
	normalizeStatName,
	CORE_ATTRIBUTES,
	DEFAULT_ATTRIBUTES,
	DEFAULT_BASE_STATS,
	DEFAULT_ATTRIBUTE_CONVERTERS
} from '../stats/characterStats.js'
import { useCharacterStats } from '../../composables/useCharacterStats.js'
import racesData from '@data/races/races.json'

describe('RPG Character Stats & Scaling Engine', () => {
	// =========================================================================
	// 1. Race Base Parameters (Level 1 starting stats)
	// =========================================================================
	describe('1. Starting parameters per race (base_stats)', () => {
		it('provides level 1 starting parameters for Human, Elf, Skeleton, and Elder Lich', () => {
			const human = getRaceStatsConfig('human', racesData)
			expect(human.base_stats.hp).toBe(100)
			expect(human.base_stats.mp).toBe(30)
			expect(human.base_stats.atk_phys).toBe(10)
			expect(human.base_stats.def_phys).toBe(6)
			expect(human.base_stats.atk_mag).toBe(6)
			expect(human.base_stats.def_mag).toBe(6)
			// Canonical short keys
			expect(human.base_stats.spd).toBe(3)
			expect(human.base_stats.init).toBe(5)
			// Backward compatibility aliases
			expect(human.base_stats.speed).toBe(3)
			expect(human.base_stats.initiative).toBe(5)
			expect(human.skill_points_per_level).toBe(0)
			expect(human.spell_points_per_level).toBe(0)

			const elf = getRaceStatsConfig('elf', racesData)
			expect(elf.base_stats.hp).toBe(70)
			expect(elf.base_stats.mp).toBe(60)
			expect(elf.base_stats.atk_phys).toBe(8)
			expect(elf.base_stats.atk_mag).toBe(12)
			expect(elf.base_stats.spd).toBe(4)
			expect(elf.base_stats.init).toBe(8)
			expect(elf.base_stats.speed).toBe(4)
			expect(elf.base_stats.initiative).toBe(8)

			const skeleton = getRaceStatsConfig('skeleton', racesData)
			expect(skeleton.base_stats.hp).toBe(120)
			expect(skeleton.base_stats.mp).toBe(10)
			expect(skeleton.base_stats.atk_phys).toBe(12)
			expect(skeleton.base_stats.def_phys).toBe(8)
			// Canonical res and alias resistances
			expect(skeleton.base_stats.res.poison).toBe(100)
			expect(skeleton.base_stats.resistances.poison).toBe(100)
			expect(skeleton.base_stats.res.dark).toBe(50)
			expect(skeleton.base_stats.res.holy).toBe(-50)
			expect(skeleton.base_stats.res.fire).toBe(-20)

			const lich = getRaceStatsConfig('elder-lich', racesData)
			expect(lich.base_stats.hp).toBe(220)
			expect(lich.base_stats.mp).toBe(200)
			expect(lich.base_stats.atk_mag).toBe(32)
			expect(lich.base_stats.def_mag).toBe(28)
			expect(lich.base_stats.res.cold).toBe(40)
			expect(lich.base_stats.resistances.cold).toBe(40)
		})

		it('gracefully provides valid fallback base stats for all 114 races in races.json', () => {
			expect(racesData.length).toBe(114)
			for (const race of racesData) {
				const config = getRaceStatsConfig(race.id, racesData)
				expect(config.id).toBe(race.id)
				expect(config.base_stats.hp).toBeGreaterThan(0)
				expect(config.base_stats.mp).toBeGreaterThanOrEqual(0)
				expect(config.base_stats.atk_phys).toBeGreaterThan(0)
				expect(config.base_stats.spd).toBeGreaterThan(0)
				expect(config.base_stats.init).toBeGreaterThan(0)
				// Legacy aliases
				expect(config.base_stats.speed).toBeGreaterThan(0)
				expect(config.base_stats.initiative).toBeGreaterThan(0)
			}
		})
	})

	// =========================================================================
	// 2. Core Attributes & Stat Points Distribution
	// =========================================================================
	describe('2. Core attributes (STR, END, AGI, INT) & Free points', () => {
		it('starts with all core attributes at 0', () => {
			const stats = calculateCharacterStats({
				character: { lvl: 1, attributes: {} },
				activeRaceId: 'human',
				racesData
			})
			expect(stats.attributes.base.str).toBe(0)
			expect(stats.attributes.base.end).toBe(0)
			expect(stats.attributes.base.agi).toBe(0)
			expect(stats.attributes.base.int).toBe(0)
			expect(stats.attributes.base.strength).toBe(0)
			expect(stats.attributes.base.endurance).toBe(0)
			expect(stats.attributes.base.agility).toBe(0)
			expect(stats.attributes.base.intelligence).toBe(0)
			expect(stats.attributes.total.str).toBe(0)
			expect(stats.attributes.total.strength).toBe(0)
			expect(stats.stats.hp).toBe(100)
		})

		it('allows investing and refunding attribute points via useCharacterStats with short or long keys', () => {
			const {
				initCharacterStats,
				investAttribute,
				refundAttribute,
				resetAttributes,
				getCharacterStatsState
			} = useCharacterStats()

			const charId = 'test_hero_' + Date.now()
			initCharacterStats(charId, { free_attribute_points: 10 })

			let state = getCharacterStatsState(charId)
			expect(state.free_attribute_points).toBe(10)
			expect(state.str).toBe(0)
			expect(state.strength).toBe(0)

			// Invest 3 in str, 2 in end (using canonical short keys)
			expect(investAttribute(charId, 'str', 3)).toBe(true)
			expect(investAttribute(charId, 'end', 2)).toBe(true)
			expect(state.str).toBe(3)
			expect(state.strength).toBe(3)
			expect(state.end).toBe(2)
			expect(state.endurance).toBe(2)
			expect(state.free_attribute_points).toBe(5)

			// Invests available 5 points (clamped from 10) using long key 'agility'
			expect(investAttribute(charId, 'agility', 10)).toBe(true)
			expect(state.agi).toBe(5)
			expect(state.agility).toBe(5)
			expect(state.free_attribute_points).toBe(0)

			// Cannot invest when 0 points left
			expect(investAttribute(charId, 'agi', 1)).toBe(false)

			// Refund 1 AGI using short key
			expect(refundAttribute(charId, 'agi', 1)).toBe(true)
			expect(state.agi).toBe(4)
			expect(state.agility).toBe(4)
			expect(state.free_attribute_points).toBe(1)

			// Reset all attributes
			const refunded = resetAttributes(charId)
			expect(refunded).toBe(9) // 3 + 2 + 4
			expect(state.str).toBe(0)
			expect(state.end).toBe(0)
			expect(state.agi).toBe(0)
			expect(state.strength).toBe(0)
			expect(state.endurance).toBe(0)
			expect(state.agility).toBe(0)
			expect(state.free_attribute_points).toBe(10)
		})

		it('procedurally distributes mob attributes according to archetype and level', () => {
			// Level 5 mob = (5 - 1) * 5 = 20 points
			const warriorAttrs = distributeMobAttributes({ level: 5, archetype: 'warrior' })
			expect(warriorAttrs.strength + warriorAttrs.endurance + warriorAttrs.agility + warriorAttrs.intelligence).toBe(20)
			expect(warriorAttrs.strength).toBeGreaterThanOrEqual(8)
			expect(warriorAttrs.endurance).toBeGreaterThanOrEqual(6)

			const mageAttrs = distributeMobAttributes({ level: 5, archetype: 'mage' })
			expect(mageAttrs.strength + mageAttrs.endurance + mageAttrs.agility + mageAttrs.intelligence).toBe(20)
			expect(mageAttrs.intelligence).toBeGreaterThanOrEqual(12)

			const archerAttrs = distributeMobAttributes({ level: 5, archetype: 'archer' })
			expect(archerAttrs.agility).toBeGreaterThanOrEqual(10)
		})
	})

	// =========================================================================
	// 3. Race-Specific Attribute Converters (Conversion Ratios)
	// =========================================================================
	describe('3. Race-specific attribute converters (характеристические переработчики)', () => {
		it('converts 1 STR for Human into +20 HP, +10 atk_phys, +8 def_phys', () => {
			const humanStats = calculateCharacterStats({
				character: { lvl: 1, attributes: { strength: 1 } },
				activeRaceId: 'human',
				racesData
			})
			// Base Human HP = 100, +20 from 1 STR = 120 HP
			expect(humanStats.stats.hp).toBe(120)
			// Base Atk = 10, +10 from 1 STR = 20
			expect(humanStats.stats.atk_phys).toBe(20)
			// Base Def = 6, +8 from 1 STR = 14
			expect(humanStats.stats.def_phys).toBe(14)
		})

		it('converts 1 STR for Elf into +15 HP, +8 atk_phys, +7 def_phys', () => {
			const elfStats = calculateCharacterStats({
				character: { lvl: 1, attributes: { strength: 1 } },
				activeRaceId: 'elf',
				racesData
			})
			// Base Elf HP = 70, +15 from 1 STR = 85 HP
			expect(elfStats.stats.hp).toBe(85)
			// Base Atk = 8, +8 from 1 STR = 16
			expect(elfStats.stats.atk_phys).toBe(16)
			// Base Def = 4, +7 from 1 STR = 11
			expect(elfStats.stats.def_phys).toBe(11)
		})

		it('allows both STR and END to contribute to HP, with END granting higher HP and resistances', () => {
			const humanWithBoth = calculateCharacterStats({
				character: { lvl: 1, attributes: { strength: 2, endurance: 3 } },
				activeRaceId: 'human',
				racesData
			})
			// Base: 100 HP
			// 2 STR * 20 HP = 40 HP
			// 3 END * 35 HP = 105 HP
			// Total HP = 100 + 40 + 105 = 245 HP
			expect(humanWithBoth.stats.hp).toBe(245)
			// Attack only comes from STR: 10 base + 2 * 10 = 30 Atk
			expect(humanWithBoth.stats.atk_phys).toBe(30)
			// Defense comes from both: 6 base + 2 * 8 (STR) + 3 * 10 (END) = 6 + 16 + 30 = 52 Def
			expect(humanWithBoth.stats.def_phys).toBe(52)
			// Physical resistance from END: 3 * 1 = 3%
			expect(humanWithBoth.stats.resistances.physical).toBe(3)
		})
	})

	// =========================================================================
	// 4. Active Race Evolution & Learned Passive Skills (Dragon -> Lich Case)
	// =========================================================================
	describe('4. Active race switching / evolution with persistent passive skills (Dragon -> Lich case)', () => {
		it('switches base stats and scalers to Lich while preserving unlosable Dragon passives', () => {
			// Scenario: Character was a Dragon, learned dragon passive "Колоссальное телосложение":
			// - +2 Strength (Attribute bonus)
			// - +800 flat HP (Flat bonus)
			// - +10% HP (Percent bonus)
			const colossalPhysiquePassive = {
				id: 'colossal_physique',
				name: 'Колоссальное телосложение',
				category: 'passive',
				stats: {
					strength: 2,
					hp: 800,
					hp_percent: 10
				}
			}

			// 1. Initial State as Dragon:
			const dragonStats = calculateCharacterStats({
				character: {
					lvl: 10,
					attributes: { strength: 10, endurance: 10, intelligence: 0 },
					races: ['dragonoid', 'elder-lich'],
					skills: { colossal_physique: 1 }
				},
				activeRaceId: 'dragonoid',
				learnedSkills: [colossalPhysiquePassive],
				racesData
			})

			// Dragon base stats: 350 HP, 24 phys_atk, 18 phys_def
			// Dragon STR converter: +30 HP, +16 Atk, +12 Def
			// Dragon END converter: +50 HP, +16 Def
			// Total STR = 10 base + 2 passive = 12 STR
			// Converted HP = (12 * 30) + (10 * 50) = 360 + 500 = 860 HP
			// Pre-percent HP = 350 (base) + 860 (converted) + 800 (flat passive) = 2010 HP
			// +10% HP from passive = 2010 * 1.10 = 2211 HP
			expect(dragonStats.stats.hp).toBe(2211)
			expect(dragonStats.stats.atk_mag).toBe(16) // Dragon atk_mag

			// 2. Evolution to Lich:
			// Active race switches to 'elder-lich'!
			// Learned Dragon passive 'colossal_physique' is retained!
			const lichStats = calculateCharacterStats({
				character: {
					lvl: 10,
					attributes: { strength: 10, endurance: 10, intelligence: 0 },
					races: ['dragonoid', 'elder-lich'],
					skills: { colossal_physique: 1 }
				},
				activeRaceId: 'elder-lich',
				learnedSkills: [colossalPhysiquePassive],
				racesData
			})

			// Lich Base HP = 220 HP, Mag Atk = 32
			// Lich STR converter: +18 HP, +8 Atk, +8 Def
			// Lich END converter: +30 HP, +12 Def, +5 MagDef
			// Step 1: Total STR = 10 base + 2 passive = 12 STR; Total END = 10
			expect(lichStats.attributes.total.strength).toBe(12)
			expect(lichStats.attributes.total.endurance).toBe(10)

			// Step 2: Converted HP = (12 * 18) + (10 * 30) = 216 + 300 = 516 HP
			expect(lichStats.breakdown.hp.converted).toBe(516)

			// Step 3: Pre-percent HP = 220 (Lich base) + 516 (converted) + 800 (passive flat) = 1536 HP
			expect(lichStats.breakdown.hp.flatPassives).toBe(800)
			expect(lichStats.breakdown.hp.prePercent).toBe(1536)

			// Step 4: Percent = 10% from passive
			expect(lichStats.breakdown.hp.totalPercent).toBe(10)

			// Step 5: Final HP = 1536 * 1.10 = 1689.6 -> rounded 1690 HP
			expect(lichStats.stats.hp).toBe(1690)

			// Mag Attack is now Lich's base (32) + END contribution (10 * 5 = +50 mag_def)
			expect(lichStats.stats.atk_mag).toBe(32)
			expect(lichStats.stats.def_mag).toBe(28 + 50) // 28 base + 50 from 10 END
		})
	})

	// =========================================================================
	// 5. Equipment & Items Stat Calculation Pipeline
	// =========================================================================
	describe('5. Equipment & Items modifier pipeline (Step 1 -> Step 5)', () => {
		it('executes user formula: 20 native STR + Item 1 (+2 STR, +200 HP, +20% HP) + Item 2 (+1 STR, +15% HP)', () => {
			// Setup character:
			// - Human (Base HP = 100, Converter STR: +20 HP, +10 Atk, +8 Def)
			// - 20 invested native STR
			// - Item 1: +2 STR, +200 HP, +20% HP
			// - Item 2: +1 STR, +15% HP
			const character = {
				attributes: { strength: 20 }
			}

			const item1 = {
				id: 'armor_1',
				name: 'Броня титана',
				stats: {
					strength: 2,
					hp: 200,
					hp_percent: 20
				}
			}

			const item2 = {
				id: 'ring_1',
				name: 'Кольцо мощи',
				stats: {
					strength: 1,
					hp: '15%' // String percent format test
				}
			}

			const result = calculateCharacterStats({
				character,
				activeRaceId: 'human',
				equipmentItems: [item1, item2],
				racesData
			})

			// Step 1: Total Strength = 20 (base) + 2 (item 1) + 1 (item 2) = 23 STR
			expect(result.attributes.base.strength).toBe(20)
			expect(result.attributes.equipment.strength).toBe(3)
			expect(result.attributes.total.strength).toBe(23)

			// Step 2: Converted HP from 23 STR = 23 * 20 = 460 HP
			expect(result.breakdown.hp.converted).toBe(460)

			// Step 3: Pre-percent HP = 100 (Human base) + 460 (converted) + 200 (flat item 1) = 760 HP
			expect(result.breakdown.hp.raceBase).toBe(100)
			expect(result.breakdown.hp.flatEquip).toBe(200)
			expect(result.breakdown.hp.prePercent).toBe(760)

			// Step 4: Additive Parallel Percentages: 20% + 15% = 35% total
			expect(result.breakdown.hp.percentEquip).toBe(35)
			expect(result.breakdown.hp.totalPercent).toBe(35)

			// Step 5: Final HP = 760 * (1 + 0.35) = 1026 HP!
			expect(result.breakdown.hp.final).toBe(1026)
			expect(result.stats.hp).toBe(1026)

			// Attack: Human Base (10) + 23 STR * 10 (230) = 240 Atk
			expect(result.stats.atk_phys).toBe(240)
			// Defense: Human Base (6) + 23 STR * 8 (184) = 190 Def
			expect(result.stats.def_phys).toBe(190)
		})

		it('parses diverse item stat formats (negative percentages, flat attack, resistances)', () => {
			const weirdItem = {
				id: 'curse_amulet',
				stats: {
					str: 4,
					attack: 14,
					defense: '-50%',
					resistances: { fire: 25, cold: -10 }
				}
			}

			const parsed = parseStatsModifier(weirdItem)
			expect(parsed.attributes.strength).toBe(4)
			expect(parsed.flatStats.atk_phys).toBe(14)
			expect(parsed.percentStats.def_phys).toBe(-50)
			expect(parsed.resistances.fire).toBe(25)
			expect(parsed.resistances.cold).toBe(-10)
		})
	})

	// =========================================================================
	// 6. Critical Hit Chance & Damage Scaling & Step 0.1 Precision
	// =========================================================================
	describe('6. Critical Hit Chance (crit_chance) & Damage (crit_dmg) Scaling', () => {
		it('calculates crit_chance and crit_dmg from race base stats', () => {
			const human = getRaceStatsConfig('human', racesData)
			expect(human.base_stats.crit_chance).toBe(5)
			expect(human.base_stats.crit_dmg).toBe(50)
			expect(human.base_stats.crit_rate).toBe(5)
			expect(human.base_stats.crit_damage).toBe(50)
		})

		it('scales crit_chance and crit_dmg through race attribute converters with 0.1 decimal precision', () => {
			// Mock race with converters: 1 AGI -> +0.2% crit_chance, 1 STR -> +0.5% crit_dmg
			const customRace = {
				id: 'custom_rogue',
				name: 'Rogue Prototype',
				base_stats: {
					hp: 100,
					mp: 20,
					atk_phys: 10,
					def_phys: 5,
					atk_mag: 5,
					def_mag: 5,
					spd: 3,
					init: 5,
					crit_chance: 5,
					crit_dmg: 50
				},
				attribute_converters: {
					agi: { crit_chance: 0.2, atk_phys: 1 },
					str: { crit_dmg: 0.5, atk_phys: 2 }
				}
			}

			const character = {
				attributes: { agi: 13, str: 7 }
			}

			const result = calculateCharacterStats({
				character,
				activeRaceId: 'custom_rogue',
				racesData: [customRace]
			})

			// 13 AGI * 0.2 = 2.6% converted crit_chance
			// Base: 5% + 2.6% = 7.6%
			expect(result.breakdown.crit_chance.raceBase).toBe(5)
			expect(result.breakdown.crit_chance.converted).toBe(2.6)
			expect(result.stats.crit_chance).toBe(7.6)
			expect(result.stats.crit_rate).toBe(7.6)

			// 7 STR * 0.5 = 3.5% converted crit_dmg
			// Base: 50% + 3.5% = 53.5%
			expect(result.breakdown.crit_dmg.raceBase).toBe(50)
			expect(result.breakdown.crit_dmg.converted).toBe(3.5)
			expect(result.stats.crit_dmg).toBe(53.5)
			expect(result.stats.crit_damage).toBe(53.5)
		})

		it('applies passive skills and equipment to crit_chance and crit_dmg through 5-step pipeline', () => {
			const customRace = {
				id: 'crit_master',
				name: 'Crit Master',
				base_stats: {
					hp: 100, mp: 50, atk_phys: 10, def_phys: 10, atk_mag: 10, def_mag: 10,
					spd: 3, init: 5, crit_chance: 5, crit_dmg: 50
				},
				attribute_converters: {
					agi: { crit_chance: 0.1 }
				}
			}

			const dagger = {
				id: 'assassin_dagger',
				stats: {
					crit_chance: 2.5,
					crit_dmg: 15
				}
			}

			const passive = {
				id: 'deadly_precision',
				category: 'passive',
				effects: {
					crit_chance: 5,
					crit_dmg: 25
				}
			}

			const result = calculateCharacterStats({
				character: { attributes: { agi: 10 } }, // 10 AGI * 0.1 = +1.0% crit_chance
				activeRaceId: 'crit_master',
				racesData: [customRace],
				equipmentItems: [dagger],
				learnedSkills: [passive]
			})

			// crit_chance: 5 (base) + 1 (converted) + 5 (passive) + 2.5 (equip) = 13.5%
			expect(result.breakdown.crit_chance.converted).toBe(1)
			expect(result.breakdown.crit_chance.flatPassives).toBe(5)
			expect(result.breakdown.crit_chance.flatEquip).toBe(2.5)
			expect(result.stats.crit_chance).toBe(13.5)

			// crit_dmg: 50 (base) + 0 (converted) + 25 (passive) + 15 (equip) = 90%
			expect(result.breakdown.crit_dmg.flatPassives).toBe(25)
			expect(result.breakdown.crit_dmg.flatEquip).toBe(15)
			expect(result.stats.crit_dmg).toBe(90)
		})
	})
})
