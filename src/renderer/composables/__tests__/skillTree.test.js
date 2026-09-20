import { describe, it, expect, beforeEach } from 'vitest'
import { useSkillTree } from '../useSkillTree.js'

describe('useSkillTree composable', () => {
	const mockData = {
		characters: [
			{ id: 'mc', name: 'Анон' },
			{ id: 'momonga', name: 'Момонга' }
		],
		classes: [
			{
				id: 'warrior',
				name: 'Воин',
				skill_branches: [
					{ id: 'blade', name: 'Клинок', icon: '🗡️' }
				],
				skills: [
					{
						id: 'strike',
						name: 'Удар',
						branch: 'blade',
						req_level: 0,
						cost: 1,
						level_points_given: 1,
						parent_ids: [],
						data: { power: 50 }
					},
					{
						id: 'double_strike',
						name: 'Двойной удар',
						branch: 'blade',
						req_level: 1,
						cost: 1,
						level_points_given: 1,
						parent_ids: ['strike'],
						data: { power: 120 }
					}
				]
			}
		],
		races: []
	}

	beforeEach(() => {
		const skillTree = useSkillTree()
		skillTree.setEntitiesData(mockData)
		skillTree.selectCharacter('mc')
		skillTree.selectEntityType('classes')
		skillTree.selectEntity('warrior')
		skillTree.charactersProgression.value.mc = {
			skill_points: 3,
			skills: {}
		}
	})

	it('computes current entity and class level correctly', () => {
		const { currentEntity, currentClassLevel, currentSP } = useSkillTree()
		expect(currentEntity.value.id).toBe('warrior')
		expect(currentClassLevel.value).toBe(0)
		expect(currentSP.value).toBe(3)
	})

	it('upgrades skill, adds class level points, and unlocks tier 1 skill', () => {
		const { upgradeSkill, currentSP, currentClassLevel, checkCanLearn, currentSkills } = useSkillTree()
		const doubleStrike = currentSkills.value.find((s) => s.id === 'double_strike')

		// Initially cannot learn double_strike (tier 1, parent strike not learned)
		expect(checkCanLearn(doubleStrike).canLearn).toBe(false)

		// Upgrade strike
		const res = upgradeSkill('strike')
		expect(res.success).toBe(true)
		expect(currentSP.value).toBe(2)
		expect(currentClassLevel.value).toBe(1)

		// Now double_strike is unlocked
		expect(checkCanLearn(doubleStrike).canLearn).toBe(true)

		// Upgrade double_strike
		const res2 = upgradeSkill('double_strike')
		expect(res2.success).toBe(true)
		expect(currentSP.value).toBe(1)
		expect(currentClassLevel.value).toBe(2)
	})

	it('refunds and resets skills correctly', () => {
		const { upgradeSkill, downgradeSkill, resetCurrentEntitySkills, currentSP, currentClassLevel } = useSkillTree()

		upgradeSkill('strike')
		expect(currentSP.value).toBe(2)
		expect(currentClassLevel.value).toBe(1)

		// Downgrade strike
		const downRes = downgradeSkill('strike')
		expect(downRes.success).toBe(true)
		expect(currentSP.value).toBe(3)
		expect(currentClassLevel.value).toBe(0)

		// Upgrade again and full reset
		upgradeSkill('strike')
		expect(currentSP.value).toBe(2)
		const resetRes = resetCurrentEntitySkills()
		expect(resetRes.success).toBe(true)
		expect(resetRes.refundedSP).toBe(1)
		expect(currentSP.value).toBe(3)
		expect(currentClassLevel.value).toBe(0)
	})

	it('handles character level, level points, and entity level-up correctly', () => {
		const tree = useSkillTree()
		tree.charactersProgression.value.mc = {
			char_level: 1,
			level_points: 2,
			global_skill_points: 0,
			global_spell_points: 0,
			class_levels: { warrior: 0 },
			entity_points: { warrior: { skill_points: 0, spell_points: 0 } },
			skills: {},
			skill_purchases: {}
		}

		expect(tree.charLevel.value).toBe(1)
		expect(tree.levelPoints.value).toBe(2)
		expect(tree.currentEntityTier.value).toBe('basic')
		expect(tree.currentEntityMaxLevel.value).toBe(15)

		// Level up entity (warrior) using 1 level point
		const lvlRes = tree.levelUpCurrentEntity()
		expect(lvlRes.success).toBe(true)
		expect(tree.levelPoints.value).toBe(1)
		expect(tree.currentEntityLevel.value).toBe(1)
		// Warrior gives 1 skill point per level
		expect(tree.currentEntityLocalSP.value).toBe(1)

		// Add character level
		tree.addCharacterLevel(3)
		expect(tree.charLevel.value).toBe(4)
		expect(tree.levelPoints.value).toBe(4) // 1 + 3

		// Character level capped at 100
		tree.addCharacterLevel(200)
		expect(tree.charLevel.value).toBe(100)
	})

	it('spends local points first and falls back to global points', () => {
		const tree = useSkillTree()
		tree.charactersProgression.value.mc = {
			char_level: 5,
			level_points: 5,
			global_skill_points: 2,
			global_spell_points: 1,
			class_levels: { warrior: 1 },
			entity_points: { warrior: { skill_points: 0, spell_points: 0 } },
			skills: {},
			skill_purchases: {}
		}

		// Currently local SP is 0, global SP is 2
		expect(tree.currentEntityLocalSP.value).toBe(0)
		expect(tree.globalSP.value).toBe(2)

		// Can still learn strike because global SP is available!
		const res = tree.upgradeSkill('strike')
		expect(res.success).toBe(true)
		expect(tree.currentEntityLocalSP.value).toBe(0)
		expect(tree.globalSP.value).toBe(1) // 1 deducted from global SP

		// Refund restores to global SP
		const refundRes = tree.downgradeSkill('strike')
		expect(refundRes.success).toBe(true)
		expect(tree.globalSP.value).toBe(2)
	})

	it('resolves skills using skillsCatalog and auto-unlocks innate skills on syncAutoUnlockedSkills and entity level-up', () => {
		const tree = useSkillTree()
		const catalog = [
			{
				id: 'night_vision',
				name: 'Ночное зрение',
				icon: '👁️',
				category: 'passive',
				description: 'Видит во тьме',
				data: { vision: 10 }
			}
		]

		const quagoaRace = {
			id: 'quagoa',
			name: 'Квагот',
			tier: 'basic',
			skill_branches: [{ id: 'racial', name: 'Расовые' }],
			skills: [
				{
					skill_id: 'night_vision',
					branch: 'racial',
					req_level: 1,
					auto_unlock: true,
					cost: 0
				}
			]
		}

		tree.setEntitiesData({
			...mockData,
			races: [quagoaRace],
			skillsCatalog: catalog
		})

		tree.selectEntityType('races')
		tree.selectEntity('quagoa')

		// Check currentSkills resolved against catalog
		const resolvedSkill = tree.currentSkills.value.find((s) => s.id === 'night_vision')
		expect(resolvedSkill).toBeDefined()
		expect(resolvedSkill.name).toBe('Ночное зрение')
		expect(resolvedSkill.icon).toBe('👁️')
		expect(resolvedSkill.auto_unlock).toBe(true)
		expect(resolvedSkill.cost).toBe(0)

		// Set character progression with race_levels.quagoa = 1
		tree.charactersProgression.value.mc = {
			char_level: 1,
			level_points: 0,
			race_levels: { quagoa: 1 },
			class_levels: {},
			entity_points: { quagoa: { skill_points: 0, spell_points: 0 } },
			skills: {},
			skill_purchases: {}
		}

		// Run syncAutoUnlockedSkills
		tree.syncAutoUnlockedSkills('mc')

		// Expect night_vision to be unlocked automatically at rank 1
		expect(tree.charactersProgression.value.mc.skills.night_vision).toBe(1)
		expect(tree.charactersProgression.value.mc.skill_purchases.night_vision?.auto_unlock).toBe(true)
	})
})
