import { describe, it, expect, vi } from 'vitest'
import { ref, reactive } from 'vue'
import { useStoryVariables } from '../useStoryVariables'

describe('useStoryVariables composable', () => {
	function setupStoryVariables(initialState = {}) {
		const globalData = reactive({
			gold: 100,
			day: 3,
			timeOfDay: 'morning',
			visitedLocations: ['factory'],
			...(initialState.global || {})
		})

		const characterData = reactive({
			mc: {
				name: 'Momonga',
				title: 'Guild Master',
				inventory: [
					{ itemId: 'gasmask', count: 1 },
					{ itemId: 'potion', count: 5 }
				],
				equipment_slots: {
					head: null,
					'torso-1': 'tshirt'
				},
				stats: {
					hp: 100,
					mp: 500
				}
			},
			albedo: {
				name: 'Альбедо',
				title: 'Смотритель Стражей'
			},
			...(initialState.character || {})
		})

		const emit = vi.fn()
		const rebuildEquipmentBySlot = vi.fn()

		const storyVariables = useStoryVariables({
			globalData: ref(globalData),
			characterData: ref(characterData),
			rebuildEquipmentBySlot,
			emit
		})

		return {
			...storyVariables,
			globalData,
			characterData,
			emit,
			rebuildEquipmentBySlot
		}
	}

	describe('substituteVariables', () => {
		it('returns empty string for null, undefined or empty input', () => {
			const { substituteVariables } = setupStoryVariables()
			expect(substituteVariables('')).toBe('')
			expect(substituteVariables(null)).toBe('')
			expect(substituteVariables(undefined)).toBe('')
		})

		it('interpolates global variables in text', () => {
			const { substituteVariables } = setupStoryVariables()
			const text = 'Сейчас {global.timeOfDay}, день {global.day}. В кошельке {global.gold} золотых.'
			expect(substituteVariables(text)).toBe('Сейчас morning, день 3. В кошельке 100 золотых.')
		})

		it('interpolates character variables in text', () => {
			const { substituteVariables } = setupStoryVariables()
			const text = 'Имя: {character.mc.name}, Титул: {character.mc.title}, HP: {character.mc.stats.hp}'
			expect(substituteVariables(text)).toBe('Имя: Momonga, Титул: Guild Master, HP: 100')
		})

		it('interpolates character inventory item with index and search by itemId', () => {
			const { substituteVariables } = setupStoryVariables()
			expect(substituteVariables('{character.mc.inventory[0].itemId}')).toBe('gasmask')
			expect(substituteVariables('{character.mc.inventory[potion].count}')).toBe('5')
		})

		it('leaves unresolvable tokens unchanged', () => {
			const { substituteVariables } = setupStoryVariables()
			expect(substituteVariables('Привет, {unknown.variable}!')).toBe('Привет, {unknown.variable}!')
		})
	})

	describe('resolveSpeakerTitle', () => {
		it('returns explicitTitle if provided, supporting variable substitution', () => {
			const { resolveSpeakerTitle } = setupStoryVariables()
			expect(resolveSpeakerTitle('mc', 'Верховный Владыка')).toBe('Верховный Владыка')
			expect(resolveSpeakerTitle('mc', '{character.mc.title} {character.mc.name}')).toBe('Guild Master Momonga')
		})

		it('falls back to character.title or character.name', () => {
			const { resolveSpeakerTitle } = setupStoryVariables()
			expect(resolveSpeakerTitle('mc')).toBe('Guild Master')
			expect(resolveSpeakerTitle('albedo')).toBe('Смотритель Стражей')
		})

		it('falls back to characterId when character is not found', () => {
			const { resolveSpeakerTitle } = setupStoryVariables()
			expect(resolveSpeakerTitle('unknown_npc')).toBe('unknown_npc')
			expect(resolveSpeakerTitle('')).toBe('')
			expect(resolveSpeakerTitle(null)).toBe('')
		})
	})

	describe('resolvePath', () => {
		it('resolves character object path properly', () => {
			const { resolvePath, characterData } = setupStoryVariables()
			const resolved = resolvePath('character.mc.stats.hp')
			expect(resolved).toEqual({
				container: characterData.mc.stats,
				key: 'hp',
				root: 'character',
				id: 'mc'
			})
		})

		it('resolves global object path properly', () => {
			const { resolvePath, globalData } = setupStoryVariables()
			const resolved = resolvePath('global.gold')
			expect(resolved).toEqual({
				container: globalData,
				key: 'gold',
				root: 'global'
			})
		})

		it('returns null for nonexistent path', () => {
			const { resolvePath } = setupStoryVariables()
			expect(resolvePath('character.nonexistent.stats.hp')).toBeNull()
		})
	})

	describe('applyVariable', () => {
		it('sets values on character', () => {
			const { applyVariable, characterData } = setupStoryVariables()
			applyVariable('character.mc.stats.hp = 85')
			expect(characterData.mc.stats.hp).toBe(85)
		})

		it('triggers rebuildEquipmentBySlot when equipment_slots are modified', () => {
			const { applyVariable, rebuildEquipmentBySlot } = setupStoryVariables()
			applyVariable("character.mc.equipment_slots.head = 'neuro_helmet'")
			expect(rebuildEquipmentBySlot).toHaveBeenCalledWith('mc')
		})

		it('applies arithmetic operators (+=, -=) on global variables', () => {
			const { applyVariable, globalData } = setupStoryVariables()
			applyVariable('global.gold += 50')
			expect(globalData.gold).toBe(150)

			applyVariable('global.gold -= 30')
			expect(globalData.gold).toBe(120)
		})

		it('emits global-data-changed when global variables are modified', () => {
			const { applyVariable, emit } = setupStoryVariables()
			applyVariable('global.day = 4')
			expect(emit).toHaveBeenCalledWith('global-data-changed', expect.any(Object))
		})
	})

	describe('evaluateCondition', () => {
		it('evaluates boolean conditions against global and character data', () => {
			const { evaluateCondition } = setupStoryVariables()
			expect(evaluateCondition('global.gold >= 100')).toBe(true)
			expect(evaluateCondition('global.gold > 200')).toBe(false)
			expect(evaluateCondition("global.timeOfDay == 'morning' && character.mc.stats.hp == 100")).toBe(true)
			expect(evaluateCondition('!character.mc.equipment_slots.head')).toBe(true)
		})

		it('returns false for invalid or empty condition strings', () => {
			const { evaluateCondition } = setupStoryVariables()
			expect(evaluateCondition('')).toBe(false)
			expect(evaluateCondition(null)).toBe(false)
		})
	})

	describe('getInitialValue', () => {
		it('returns property value or empty string', () => {
			const { getInitialValue } = setupStoryVariables()
			expect(getInitialValue('character.mc.name')).toBe('Momonga')
			expect(getInitialValue('character.mc.title')).toBe('Guild Master')
			expect(getInitialValue('character.mc.nonexistent')).toBe('')
		})
	})
})
