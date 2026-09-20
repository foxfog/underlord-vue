import { describe, it, expect } from 'vitest'
import {
	normalizeSkill,
	normalizeSkillBranch,
	calculateClassLevel,
	canLearnSkill,
	learnSkill,
	canRefundSkill,
	refundSkill,
	resetSkills,
	organizeSkillsByGrid,
	getCategoryMeta,
	swapSkillColumns,
	ENTITY_TIERS,
	getEntityMaxLevel,
	canLevelUpEntity,
	levelUpEntity,
	getAvailableSkillPoints,
	resolveSkillNode,
	resolveEntitySkills
} from '../skillTree.js'

describe('skillTree utilities', () => {
	const sampleSkills = [
		{
			id: 'slash',
			name: 'Рассечение',
			icon: '⚔️',
			branch: 'combat',
			req_level: 1,
			max_level: 1,
			cost: 1,
			level_points_given: 1,
			parent_ids: [],
			parent_requirement: 'all',
			data: { damage: 100 }
		},
		{
			id: 'shield_block',
			name: 'Блок щитом',
			icon: '🛡️',
			branch: 'defense',
			req_level: 1,
			max_level: 1,
			cost: 1,
			level_points_given: 1,
			parent_ids: [],
			parent_requirement: 'all',
			data: { armor: 20 }
		},
		{
			id: 'heavy_slash',
			name: 'Тяжелый удар',
			icon: '🪓',
			branch: 'combat',
			req_level: 2,
			max_level: 1,
			cost: 2,
			level_points_given: 2,
			parent_ids: ['slash'],
			parent_requirement: 'all',
			data: { damage: 250 }
		},
		{
			id: 'parry',
			name: 'Парирование',
			icon: '✨',
			branch: 'combat',
			req_level: 3,
			max_level: 1,
			cost: 1,
			level_points_given: 1,
			parent_ids: ['slash', 'shield_block'],
			parent_requirement: 'any',
			data: { counter_chance: 35 }
		},
		{
			id: 'warlord_stance',
			name: 'Стойка воеводы',
			icon: '👑',
			branch: 'combat',
			req_level: 4,
			max_level: 1,
			cost: 3,
			level_points_given: 2,
			parent_ids: ['heavy_slash', 'shield_block'],
			parent_requirement: 'all',
			data: { attack_aura: 15 }
		}
	]

	it('normalizes skill objects and parses JSON data correctly', () => {
		const raw = {
			id: 'test_skill',
			data: '{"burn": 10}'
		}
		const norm = normalizeSkill(raw)
		expect(norm.id).toBe('test_skill')
		expect(norm.req_level).toBe(1)
		expect(norm.max_level).toBe(1)
		expect(norm.cost).toBe(1)
		expect(norm.cost_type).toBe('skill_point')
		expect(norm.level_points_given).toBe(1)
		expect(norm.parent_ids).toEqual([])
		expect(norm.parent_requirement).toBe('all')
		expect(norm.data).toEqual({ burn: 10 })
	})

	it('calculates class level correctly based on learned skills and level_points_given', () => {
		const charSkills = {
			slash: 2, // 2 * 1 = 2
			shield_block: 1 // 1 * 1 = 1
		}
		const level = calculateClassLevel(charSkills, sampleSkills)
		expect(level).toBe(3)
	})

	it('allows learning root skills (req_level 1, no parents) when SP is sufficient', () => {
		const charState = {
			skill_points: 5,
			skills: {}
		}
		const slash = sampleSkills.find((s) => s.id === 'slash')
		const res = canLearnSkill(slash, charState, sampleSkills)
		expect(res.canLearn).toBe(true)
		expect(res.reasons).toEqual([])
	})

	it('prevents learning skills if SP is insufficient', () => {
		const charState = {
			skill_points: 0,
			skills: {}
		}
		const slash = sampleSkills.find((s) => s.id === 'slash')
		const res = canLearnSkill(slash, charState, sampleSkills)
		expect(res.canLearn).toBe(false)
		expect(res.reasons.some((r) => r.includes('Недостаточно'))).toBe(true)
	})

	it('prevents learning higher tier skill if class level requirement is not met', () => {
		const charState = {
			skill_points: 5,
			skills: {} // base level is 1
		}
		const heavySlash = sampleSkills.find((s) => s.id === 'heavy_slash') // req_level: 2
		const res = canLearnSkill(heavySlash, charState, sampleSkills)
		expect(res.canLearn).toBe(false)
		expect(res.reasons.some((r) => r.includes('Требуется уровень класса/расы: 2'))).toBe(true)
	})

	it('unlocks higher tier skills once base skills give required class level points', () => {
		// Learning slash gives 1 level point to the class, raising level from 1 to 2
		let state = { skill_points: 5, skills: {} }
		const resLearn = learnSkill(state, 'slash', sampleSkills)
		expect(resLearn.success).toBe(true)
		state = resLearn.characterState

		expect(calculateClassLevel(state.skills, sampleSkills)).toBe(1)
		expect(state.skill_points).toBe(4)

		const heavySlash = sampleSkills.find((s) => s.id === 'heavy_slash') // req_level: 2, parent: slash
		const canLearnHeavy = canLearnSkill(heavySlash, state, sampleSkills)
		expect(canLearnHeavy.canLearn).toBe(true)
	})

	it('enforces single parent requirement', () => {
		// Class level 2 met, but slash parent not learned
		const state = {
			skill_points: 5,
			skills: { shield_block: 1 } // gives 1 lvl pt -> level 2, but heavy_slash requires parent 'slash'
		}
		const heavySlash = sampleSkills.find((s) => s.id === 'heavy_slash')
		const res = canLearnSkill(heavySlash, state, sampleSkills)
		expect(res.canLearn).toBe(false)
		expect(res.reasons.some((r) => r.includes('Требуется изучить все предшествующие навыки'))).toBe(true)
	})

	it('handles parent_requirement: "any" correctly (requires only one parent)', () => {
		// parry requires: req_level 3, parents: ['slash', 'shield_block'] with 'any'
		// Case 1: Neither parent learned
		let state = {
			skill_points: 5,
			skills: {}
		}
		const parry = sampleSkills.find((s) => s.id === 'parry')
		expect(canLearnSkill(parry, state, sampleSkills).canLearn).toBe(false)

		// Case 2: Only 'slash' learned + shield_block for level 3
		state = {
			skill_points: 5,
			skills: { slash: 1, shield_block: 1 } // level 1 + 2 = 3
		}
		expect(canLearnSkill(parry, state, sampleSkills).canLearn).toBe(true)
	})

	it('handles parent_requirement: "all" correctly (requires all parents)', () => {
		// warlord_stance requires: req_level 4, parents: ['heavy_slash', 'shield_block'] with 'all'
		let state = {
			skill_points: 10,
			skills: {
				slash: 1, // 1 lvl pt
				heavy_slash: 1 // 2 lvl pts -> total 1 + 3 = 4
			}
		}
		const warlord = sampleSkills.find((s) => s.id === 'warlord_stance')

		// shield_block missing -> false
		expect(canLearnSkill(warlord, state, sampleSkills).canLearn).toBe(false)

		// add shield_block -> true
		state.skills.shield_block = 1
		expect(canLearnSkill(warlord, state, sampleSkills).canLearn).toBe(true)
	})

	it('prevents upgrading beyond max_level', () => {
		const state = {
			skill_points: 10,
			skills: { slash: 1 }
		}
		const slash = sampleSkills.find((s) => s.id === 'slash')
		const res = canLearnSkill(slash, state, sampleSkills)
		expect(res.canLearn).toBe(false)
		expect(res.isMaxed).toBe(true)
	})

	it('prevents refunding if dependent child skills would break', () => {
		const state = {
			skill_points: 5,
			skills: {
				slash: 1,
				heavy_slash: 1
			}
		}
		const slash = sampleSkills.find((s) => s.id === 'slash')
		const check = canRefundSkill(slash, state, sampleSkills)
		expect(check.canRefund).toBe(false)
		expect(check.reasons.some((r) => r.includes('Тяжелый удар'))).toBe(true)
	})

	it('allows refunding when no child dependencies exist and restores SP', () => {
		const state = {
			skill_points: 3,
			skills: {
				slash: 1
			}
		}
		const res = refundSkill(state, 'slash', sampleSkills)
		expect(res.success).toBe(true)
		expect(res.characterState.skills.slash).toBeUndefined()
		expect(res.characterState.skill_points).toBe(4)
	})

	it('resets all skills for the entity and refunds all spent SP', () => {
		const state = {
			skill_points: 0,
			skills: {
				slash: 1, // 1 * cost 1 = 1
				heavy_slash: 1 // 1 * cost 2 = 2
			}
		}
		const res = resetSkills(state, sampleSkills)
		expect(res.success).toBe(true)
		expect(res.refundedSP).toBe(3)
		expect(res.characterState.skill_points).toBe(3)
		expect(res.characterState.skills).toEqual({})
	})

	it('organizes skills by tier starting at level 1 and calculates connectors properly', () => {
		const branches = [
			{ id: 'combat', name: 'Бой', icon: '⚔️' },
			{ id: 'defense', name: 'Защита', icon: '🛡️' }
		]
		const organized = organizeSkillsByGrid(sampleSkills, branches)
		expect(organized.tiers.length).toBe(4) // 1, 2, 3, 4
		expect(organized.tiers[0].level).toBe(1)
		expect(organized.tiers[0].skills.length).toBe(2) // slash, shield_block
		expect(organized.connectors.length).toBe(5)
	})

	it('validates skill categories including spell and assigns default category', () => {
		const skill1 = normalizeSkill({ id: 's1', category: 'passive' })
		expect(skill1.category).toBe('passive')

		const skill2 = normalizeSkill({ id: 's2', category: 'buff' })
		expect(skill2.category).toBe('buff')

		const skill3 = normalizeSkill({ id: 's3', category: 'spell' })
		expect(skill3.category).toBe('spell')

		const skill4 = normalizeSkill({ id: 's4', category: 'invalid_category' })
		expect(skill4.category).toBe('active')

		const spellMeta = getCategoryMeta('spell')
		expect(spellMeta.id).toBe('spell')
		expect(spellMeta.icon).toBe('🔮')
		expect(spellMeta.color).toBe('#c084fc')
	})

	it('normalizes grid_col and creates uniform cellular slots per tier starting at 1', () => {
		const skills = [
			{ id: 'root1', req_level: 1, grid_col: 0 },
			{ id: 'mid1', req_level: 2, grid_col: 2 },
			{ id: 'mid2', req_level: 2, grid_col: 1 }
		]
		const organized = organizeSkillsByGrid(skills, [])
		expect(organized.maxCols).toBeGreaterThanOrEqual(3)

		for (const tier of organized.tiers) {
			expect(tier.cells.length).toBe(organized.maxCols)
		}

		const tier1 = organized.tiers.find((t) => t.level === 1)
		expect(tier1.cells[0]?.id).toBe('root1')
		expect(tier1.cells[1]).toBe(null)
		expect(tier1.cells[2]).toBe(null)

		const tier2 = organized.tiers.find((t) => t.level === 2)
		expect(tier2.cells[1]?.id).toBe('mid2')
		expect(tier2.cells[2]?.id).toBe('mid1')
	})

	it('swaps skill column positions within the same tier', () => {
		const list = [
			{ id: 's1', req_level: 1, grid_col: 0 },
			{ id: 's2', req_level: 1, grid_col: 1 }
		]
		swapSkillColumns(list, 's1', 1)
		expect(list.find((s) => s.id === 's1').grid_col).toBe(1)
		expect(list.find((s) => s.id === 's2').grid_col).toBe(0)

		swapSkillColumns(list, 's1', 1)
		expect(list.find((s) => s.id === 's1').grid_col).toBe(2)

		swapSkillColumns(list, 's2', -1)
		expect(list.find((s) => s.id === 's2').grid_col).toBe(0)
	})

	describe('Entity Tiers, Leveling and Local/Global Points', () => {
		const sampleClasses = [
			{ id: 'warrior', name: 'Воин', tier: 'basic', parent_id: null, skill_points_per_level: 2, spell_points_per_level: 0 },
			{ id: 'knight', name: 'Рыцарь', tier: 'advanced', parent_id: 'warrior', skill_points_per_level: 2, spell_points_per_level: 1 },
			{ id: 'mage', name: 'Маг', tier: 'basic', parent_id: null, skill_points_per_level: 1, spell_points_per_level: 3 },
			{ id: 'world_champion', name: 'Чемпион Мира', tier: 'rare', parent_id: 'knight', skill_points_per_level: 3, spell_points_per_level: 1 }
		]

		const sampleRaces = [
			{ id: 'human', name: 'Человек', tier: 'basic', parent_id: null, skill_points_per_level: 1, spell_points_per_level: 0 },
			{ id: 'skeleton_mage', name: 'Скелет-маг', tier: 'basic', parent_id: null, skill_points_per_level: 1, spell_points_per_level: 1 },
			{ id: 'elder_lich', name: 'Старший Лич', tier: 'advanced', parent_id: 'skeleton_mage', skill_points_per_level: 1, spell_points_per_level: 2 },
			{ id: 'overlord', name: 'Оверлорд', tier: 'rare', parent_id: 'elder_lich', skill_points_per_level: 2, spell_points_per_level: 3 }
		]

		it('returns correct max levels for basic (15), advanced (10), rare (5)', () => {
			expect(getEntityMaxLevel(sampleClasses[0])).toBe(15) // basic
			expect(getEntityMaxLevel(sampleClasses[1])).toBe(10) // advanced
			expect(getEntityMaxLevel(sampleClasses[3])).toBe(5)  // rare
			expect(getEntityMaxLevel({ tier: 'unknown' })).toBe(15) // default
		})

		it('levels up basic class, deducts level_points, and grants dedicated local points', () => {
			const char = {
				char_level: 5,
				level_points: 3,
				class_levels: { warrior: 1 },
				entity_points: {
					warrior: { skill_points: 2, spell_points: 0 }
				}
			}

			const res = levelUpEntity(sampleClasses[0], 'classes', char, sampleClasses)
			expect(res.success).toBe(true)
			expect(res.characterProgression.level_points).toBe(2)
			expect(res.characterProgression.class_levels.warrior).toBe(2)
			// +2 local skill points
			expect(res.characterProgression.entity_points.warrior.skill_points).toBe(4)
		})

		it('prevents leveling up advanced class until parent is maxed to tier max (15 for basic)', () => {
			const char = {
				char_level: 10,
				level_points: 5,
				class_levels: { warrior: 14 }, // not maxed (max is 15)
				entity_points: {}
			}

			const check = canLevelUpEntity(sampleClasses[1], 'classes', char, sampleClasses) // knight requires warrior maxed
			expect(check.canLevelUp).toBe(false)
			expect(check.reasons.some((r) => r.includes('до ур. 15'))).toBe(true)

			// Max warrior
			char.class_levels.warrior = 15
			const checkMaxed = canLevelUpEntity(sampleClasses[1], 'classes', char, sampleClasses)
			expect(checkMaxed.canLevelUp).toBe(true)
		})

		it('enforces race rule: character can have only 1 base race', () => {
			const char = {
				char_level: 5,
				level_points: 2,
				race_levels: { human: 5 },
				entity_points: {}
			}

			// Trying to level up skeleton_mage (another base race)
			const check = canLevelUpEntity(sampleRaces[1], 'races', char, sampleRaces)
			expect(check.canLevelUp).toBe(false)
			expect(check.reasons.some((r) => r.includes('Персонаж уже выбрал базовую расу'))).toBe(true)
		})

		it('enforces race rule: character can develop only 1 evolution branch', () => {
			const char = {
				char_level: 20,
				level_points: 2,
				race_levels: { skeleton_mage: 15, elder_lich: 10 },
				entity_points: {}
			}

			// Overlord is valid child of elder_lich
			const checkOverlord = canLevelUpEntity(sampleRaces[3], 'races', char, sampleRaces)
			expect(checkOverlord.canLevelUp).toBe(true)

			// Another fictitious branch child of a different base race is forbidden
			const altRace = { id: 'alt_race', tier: 'advanced', parent_id: 'human' }
			const checkAlt = canLevelUpEntity(altRace, 'races', char, [...sampleRaces, altRace])
			expect(checkAlt.canLevelUp).toBe(false)
		})

		it('allows multiclassing: character can level multiple base classes simultaneously', () => {
			const char = {
				char_level: 10,
				level_points: 3,
				class_levels: { warrior: 5 },
				entity_points: {}
			}

			// Can level mage (another base class)
			const checkMage = canLevelUpEntity(sampleClasses[2], 'classes', char, sampleClasses)
			expect(checkMage.canLevelUp).toBe(true)
		})

		it('spends local points first, then falls back to global points', () => {
			const warriorSkills = [
				{ id: 'w_heavy', name: 'Удар', entity_id: 'warrior', cost: 3, cost_type: 'skill_point', req_level: 1 }
			]

			const char = {
				class_levels: { warrior: 2 },
				entity_points: {
					warrior: { skill_points: 2, spell_points: 0 } // only 2 local SP
				},
				global_skill_points: 5, // 5 global SP
				skills: {}
			}

			// Available points: 2 local + 5 global = 7 total
			const avail = getAvailableSkillPoints(char, 'warrior', 'skill_point')
			expect(avail.local).toBe(2)
			expect(avail.global).toBe(5)
			expect(avail.total).toBe(7)

			// Learning skill of cost 3: uses 2 local + 1 global
			const res = learnSkill(char, 'w_heavy', warriorSkills)
			expect(res.success).toBe(true)
			expect(res.characterState.entity_points.warrior.skill_points).toBe(0)
			expect(res.characterState.global_skill_points).toBe(4) // 5 - 1
			expect(res.characterState.skills.w_heavy).toBe(1)

			// Refunding skill restores 2 local and 1 global
			const ref = refundSkill(res.characterState, 'w_heavy', warriorSkills)
			expect(ref.success).toBe(true)
			expect(ref.characterState.entity_points.warrior.skill_points).toBe(2)
			expect(ref.characterState.global_skill_points).toBe(5)
		})

		it('supports optional skills with cost 0 (requires manual learning and prerequisites)', () => {
			const treeSkills = [
				{
					id: 'free_trait',
					name: 'Врожденный талант',
					entity_id: 'warrior',
					cost: 0,
					cost_type: 'skill_point',
					req_level: 1,
					parent_ids: []
				},
				{
					id: 'free_advanced',
					name: 'Продвинутый талант',
					entity_id: 'warrior',
					cost: 0,
					cost_type: 'skill_point',
					req_level: 2,
					parent_ids: ['free_trait']
				}
			]

			const normFree = normalizeSkill(treeSkills[0])
			expect(normFree.cost).toBe(0)

			const char = {
				class_levels: { warrior: 1 },
				entity_points: { warrior: { skill_points: 0, spell_points: 0 } },
				global_skill_points: 0,
				skills: {}
			}

			// 1. Is NOT automatically learned even though it costs 0
			expect(char.skills.free_trait).toBeUndefined()

			// 2. Can learn free_trait even with 0 SP because cost is 0 and req_level 1 <= warrior lvl 1
			const check1 = canLearnSkill(treeSkills[0], char, treeSkills)
			expect(check1.canLearn).toBe(true)

			// 3. Child skill 'free_advanced' is locked because parent 'free_trait' is not yet learned
			const checkChildLocked = canLearnSkill(treeSkills[1], char, treeSkills)
			expect(checkChildLocked.canLearn).toBe(false)
			expect(checkChildLocked.reasons.some((r) => r.includes('предшествующие навыки'))).toBe(true)

			// 4. Learning free_trait costs 0 points and marks it learned
			const learnRes = learnSkill(char, 'free_trait', treeSkills)
			expect(learnRes.success).toBe(true)
			expect(learnRes.characterState.skills.free_trait).toBe(1)
			expect(learnRes.characterState.entity_points.warrior.skill_points).toBe(0)

			// 5. Now child skill req_level check (warrior is lvl 1, child requires lvl 2)
			const checkChildLvl = canLearnSkill(treeSkills[1], learnRes.characterState, treeSkills)
			expect(checkChildLvl.canLearn).toBe(false)
			expect(checkChildLvl.reasons.some((r) => r.includes('Требуется уровень'))).toBe(true)

			// 6. Once warrior is level 2, child can be learned
			learnRes.characterState.class_levels.warrior = 2
			const checkChildOk = canLearnSkill(treeSkills[1], learnRes.characterState, treeSkills)
			expect(checkChildOk.canLearn).toBe(true)

			const learnChildRes = learnSkill(learnRes.characterState, 'free_advanced', treeSkills)
			expect(learnChildRes.success).toBe(true)
			expect(learnChildRes.characterState.skills.free_advanced).toBe(1)

			// 7. Cannot refund free_trait while free_advanced is learned
			const refBlocked = refundSkill(learnChildRes.characterState, 'free_trait', treeSkills)
			expect(refBlocked.canRefund ?? refBlocked.success).toBe(false)

			// 8. Can refund child, and then refund parent
			const refChildOk = refundSkill(learnChildRes.characterState, 'free_advanced', treeSkills)
			expect(refChildOk.success).toBe(true)
			expect(refChildOk.characterState.skills.free_advanced).toBeUndefined()

			const refParentOk = refundSkill(refChildOk.characterState, 'free_trait', treeSkills)
			expect(refParentOk.success).toBe(true)
			expect(refParentOk.characterState.skills.free_trait).toBeUndefined()
		})
	})

	describe('central catalog & auto_unlock mechanics', () => {
		const mockCatalog = {
			night_vision: {
				id: 'night_vision',
				name: 'Ночное зрение',
				icon: '👁️',
				category: 'passive',
				description: 'Позволяет видеть в темноте',
				data: { vision_range: 10 }
			},
			stealth_ambush: {
				id: 'stealth_ambush',
				name: 'Внезапная атака',
				icon: '🗡️',
				category: 'active',
				description: 'Атака из тени',
				data: { backstab_multiplier: 2.0 }
			}
		}

		it('resolves skill node referencing catalog by skill_id', () => {
			const node = {
				skill_id: 'night_vision',
				branch: 'racial',
				req_level: 1,
				grid_col: 1,
				auto_unlock: true,
				cost: 0
			}

			const resolved = resolveSkillNode(node, mockCatalog)
			expect(resolved.id).toBe('night_vision')
			expect(resolved.name).toBe('Ночное зрение')
			expect(resolved.icon).toBe('👁️')
			expect(resolved.category).toBe('passive')
			expect(resolved.description).toBe('Позволяет видеть в темноте')
			expect(resolved.data).toEqual({ vision_range: 10 })
			expect(resolved.branch).toBe('racial')
			expect(resolved.req_level).toBe(1)
			expect(resolved.auto_unlock).toBe(true)
			expect(resolved.cost).toBe(0)
		})

		it('resolves a list of skills using resolveEntitySkills', () => {
			const list = [
				{ skill_id: 'night_vision', req_level: 1, auto_unlock: true },
				{ skill_id: 'stealth_ambush', req_level: 3, cost: 2 },
				{ id: 'custom_skill', name: 'Кастомный', cost: 1 }
			]

			const resolved = resolveEntitySkills(list, mockCatalog)
			expect(resolved).toHaveLength(3)
			expect(resolved[0].name).toBe('Ночное зрение')
			expect(resolved[0].auto_unlock).toBe(true)
			expect(resolved[1].name).toBe('Внезапная атака')
			expect(resolved[2].name).toBe('Кастомный')
		})

		it('normalizes skill with auto_unlock: true to cost: 0', () => {
			const raw = {
				id: 'innate_passive',
				name: 'Врождённый навык',
				auto_unlock: true,
				cost: 5
			}
			const norm = normalizeSkill(raw)
			expect(norm.auto_unlock).toBe(true)
			expect(norm.cost).toBe(0)
		})

		it('levelUpEntity automatically unlocks auto_unlock skills matching req_level without consuming SP', () => {
			const entitySkills = [
				{
					id: 'night_vision',
					skill_id: 'night_vision',
					name: 'Ночное зрение',
					req_level: 1,
					auto_unlock: true,
					cost: 0
				},
				{
					id: 'deep_sight',
					skill_id: 'deep_sight',
					name: 'Глубинное зрение',
					req_level: 2,
					auto_unlock: true,
					cost: 0
				},
				{
					id: 'stealth',
					name: 'Скрытность',
					req_level: 1,
					auto_unlock: false,
					cost: 1
				}
			]

			const quagoaRace = {
				id: 'quagoa',
				name: 'Квагот',
				tier: 'basic',
				skill_points_per_level: 1,
				spell_points_per_level: 0
			}

			const char = {
				id: 'char_quagoa',
				level_points: 1,
				race_levels: { quagoa: 1 },
				class_levels: {},
				entity_points: { quagoa: { skill_points: 0, spell_points: 0 } },
				skills: {},
				skill_purchases: {}
			}

			const result = levelUpEntity(quagoaRace, 'races', char, [quagoaRace], entitySkills)
			expect(result.success).toBe(true)
			expect(result.characterProgression.race_levels.quagoa).toBe(2)

			expect(result.characterProgression.skills.night_vision).toBe(1)
			expect(result.characterProgression.skills.deep_sight).toBe(1)
			expect(result.characterProgression.skills.stealth).toBeUndefined()

			expect(result.characterProgression.entity_points.quagoa.skill_points).toBe(1)

			const autoPurchases = Object.values(result.characterProgression.skill_purchases).filter((p) => p.auto_unlock)
			expect(autoPurchases).toHaveLength(2)
			expect(autoPurchases.every((p) => p.cost === 0)).toBe(true)
		})

		it('canRefundSkill and refundSkill prevent refunding auto_unlock skills', () => {
			const treeSkills = [
				{
					id: 'night_vision',
					name: 'Ночное зрение',
					req_level: 1,
					auto_unlock: true,
					cost: 0
				}
			]

			const char = {
				id: 'quagoa_miner',
				race_levels: { quagoa: 1 },
				class_levels: {},
				entity_points: { quagoa: { skill_points: 0, spell_points: 0 } },
				skills: { night_vision: 1 },
				skill_purchases: {
					night_vision: {
						entityId: 'quagoa',
						cost: 0,
						cost_type: 'skill_point',
						auto_unlock: true
					}
				}
			}

			const check = canRefundSkill(treeSkills[0], char, treeSkills)
			expect(check.canRefund).toBe(false)
			expect(check.reasons.some((r) => r.includes('Врождённый навык'))).toBe(true)

			const refundRes = refundSkill(char, 'night_vision', treeSkills)
			expect(refundRes.success).toBe(false)
			expect(refundRes.characterState.skills.night_vision).toBe(1)
		})

		it('resetSkills preserves auto_unlock skills at rank 1 and does not refund points for them', () => {
			const treeSkills = [
				{
					id: 'night_vision',
					name: 'Ночное зрение',
					req_level: 1,
					auto_unlock: true,
					cost: 0
				},
				{
					id: 'power_strike',
					name: 'Силовой удар',
					req_level: 1,
					auto_unlock: false,
					cost: 2,
					cost_type: 'skill_point'
				}
			]

			const char = {
				id: 'fighter',
				class_levels: { warrior: 3 },
				entity_points: { warrior: { skill_points: 1, spell_points: 0 } },
				skills: {
					night_vision: 1,
					power_strike: 1
				},
				skill_purchases: {
					night_vision: {
						entityId: 'warrior',
						cost: 0,
						costType: 'skill_point',
						pointsKey: 'skill_points',
						globalKey: 'global_skill_points',
						fromLocal: 0,
						fromGlobal: 0,
						auto_unlock: true
					},
					power_strike: {
						entityId: 'warrior',
						cost: 2,
						costType: 'skill_point',
						pointsKey: 'skill_points',
						globalKey: 'global_skill_points',
						fromLocal: 2,
						fromGlobal: 0
					}
				}
			}

			const res = resetSkills(char, treeSkills, { id: 'warrior' })
			expect(res.success).toBe(true)
			expect(res.characterState.skills.power_strike).toBeUndefined()
			expect(res.characterState.entity_points.warrior.skill_points).toBe(3)
			expect(res.characterState.skills.night_vision).toBe(1)
			expect(res.characterState.skill_purchases.night_vision).toBeDefined()
			expect(res.characterState.skill_purchases.power_strike).toBeUndefined()
		})
	})
})

