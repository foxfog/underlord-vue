import { describe, it, expect } from 'vitest'
import { resolveVariablePath, evaluateExpression } from '../expressionEvaluator'

describe('expressionEvaluator', () => {
	describe('resolveVariablePath', () => {
		const context = {
			global: {
				day: 5,
				timeOfDay: 'evening',
				playerStats: {
					karma: -10
				}
			},
			character: {
				mc: {
					name: 'Momonga',
					title: 'Guild Master',
					inventory: [
						{ itemId: 'gasmask', count: 1 },
						{ itemId: 'health_potion', count: 3 }
					],
					equipment_slots: {
						head: 'neuro_helmet'
					}
				}
			}
		}

		it('returns undefined for empty, null, or invalid path', () => {
			expect(resolveVariablePath(null, context)).toBeUndefined()
			expect(resolveVariablePath('', context)).toBeUndefined()
			expect(resolveVariablePath('   ', context)).toBeUndefined()
			expect(resolveVariablePath('random.prop', context)).toBeUndefined()
		})

		it('resolves root objects', () => {
			expect(resolveVariablePath('global', context)).toEqual(context.global)
			expect(resolveVariablePath('character', context)).toEqual(context.character)
		})

		it('resolves top-level and nested global properties', () => {
			expect(resolveVariablePath('global.day', context)).toBe(5)
			expect(resolveVariablePath('global.timeOfDay', context)).toBe('evening')
			expect(resolveVariablePath('global.playerStats.karma', context)).toBe(-10)
		})

		it('resolves character properties', () => {
			expect(resolveVariablePath('character.mc.name', context)).toBe('Momonga')
			expect(resolveVariablePath('character.mc.title', context)).toBe('Guild Master')
			expect(resolveVariablePath('character.mc.equipment_slots.head', context)).toBe('neuro_helmet')
		})

		it('resolves optional chaining paths (global?.prop, global.?prop)', () => {
			expect(resolveVariablePath('global?.day', context)).toBe(5)
			expect(resolveVariablePath('character?.mc?.name', context)).toBe('Momonga')
			expect(resolveVariablePath('global?.nonExistent?.prop', context)).toBeUndefined()
		})

		it('resolves array indexing by numeric index', () => {
			expect(resolveVariablePath('character.mc.inventory[0].itemId', context)).toBe('gasmask')
			expect(resolveVariablePath('character.mc.inventory[1].count', context)).toBe(3)
			expect(resolveVariablePath('character.mc.inventory[99]', context)).toBeUndefined()
		})

		it('resolves array item lookup by itemId string', () => {
			expect(resolveVariablePath('character.mc.inventory[gasmask].count', context)).toBe(1)
			expect(resolveVariablePath("character.mc.inventory['health_potion'].count", context)).toBe(3)
			expect(resolveVariablePath('character.mc.inventory[unknown_item]', context)).toBeUndefined()
		})
	})

	describe('evaluateExpression', () => {
		const context = {
			global: {
				gold: 150,
				timeOfDay: 'night',
				isNewWorld: true,
				dayCount: 12
			},
			character: {
				mc: {
					level: 100,
					karma: -500,
					hasWeapon: false
				}
			}
		}

		it('evaluates primitive literals and empty expressions', () => {
			expect(evaluateExpression('', context)).toBe(false)
			expect(evaluateExpression('   ', context)).toBe(false)
			expect(evaluateExpression('42')).toBe(42)
			expect(evaluateExpression('true')).toBe(true)
			expect(evaluateExpression('false')).toBe(false)
			expect(evaluateExpression('null')).toBe(null)
			expect(evaluateExpression("'test'")).toBe('test')
		})

		it('evaluates arithmetic expressions', () => {
			expect(evaluateExpression('10 + 25')).toBe(35)
			expect(evaluateExpression('50 - 15')).toBe(35)
			expect(evaluateExpression('6 * 7')).toBe(42)
			expect(evaluateExpression('100 / 4')).toBe(25)
			expect(evaluateExpression('14 % 4')).toBe(2)
		})

		it('evaluates comparisons', () => {
			expect(evaluateExpression('10 > 5')).toBe(true)
			expect(evaluateExpression('10 < 5')).toBe(false)
			expect(evaluateExpression('10 >= 10')).toBe(true)
			expect(evaluateExpression('5 <= 4')).toBe(false)
			expect(evaluateExpression("5 == '5'")).toBe(true)
			expect(evaluateExpression("5 === '5'")).toBe(false)
			expect(evaluateExpression('5 != 6')).toBe(true)
			expect(evaluateExpression("5 !== '5'")).toBe(true)
		})

		it('evaluates context variables with and without curly braces', () => {
			expect(evaluateExpression('global.gold >= 100', context)).toBe(true)
			expect(evaluateExpression('{global.gold >= 200}', context)).toBe(false)
			expect(evaluateExpression("global.timeOfDay == 'night'", context)).toBe(true)
			expect(evaluateExpression('character.mc.level === 100', context)).toBe(true)
			expect(evaluateExpression('character.mc.karma < 0', context)).toBe(true)
		})

		it('evaluates boolean logic (&&, ||, !)', () => {
			expect(evaluateExpression('global.gold > 100 && global.isNewWorld', context)).toBe(true)
			expect(evaluateExpression('global.gold > 200 || character.mc.level == 100', context)).toBe(true)
			expect(evaluateExpression('!character.mc.hasWeapon', context)).toBe(true)
			expect(evaluateExpression('!(global.gold > 200)', context)).toBe(true)
		})

		it('evaluates expressions with parentheses for grouping', () => {
			expect(evaluateExpression('(2 + 3) * 4')).toBe(20)
			expect(evaluateExpression('(global.gold > 200 || global.dayCount > 10) && global.isNewWorld', context)).toBe(true)
		})
	})
})
