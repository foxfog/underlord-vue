import { describe, it, expect } from 'vitest'
import {
	getCharacterTalentIds,
	hasTalent,
	canCharacterBypassEquipRestrictions,
	resolveCharacterTalents
} from '../../utils/talents.js'
import { canCharacterEquipItem, getEquipRestrictionReasons } from '../../utils/equipment.js'
import talentsData from '@data/skills/talents/talents.json'
import { useDataEditor } from '../useDataEditor.js'

describe('Character Talents System (Врождённые таланты персонажей)', () => {
	describe('talents.json data registry integrity', () => {
		it('contains valid talent objects with required fields', () => {
			expect(Array.isArray(talentsData)).toBe(true)
			expect(talentsData.length).toBeGreaterThan(0)

			for (const talent of talentsData) {
				expect(talent.id).toBeTruthy()
				expect(typeof talent.id).toBe('string')
				expect(talent.name).toBeTruthy()
				expect(typeof talent.name).toBe('string')
				expect(talent.category).toBeTruthy()
				expect(talent.description).toBeTruthy()
			}
		})

		it('contains the canonical item_restriction_bypass talent with ignore_equip_requirements flag', () => {
			const bypassTalent = talentsData.find((t) => t.id === 'item_restriction_bypass')
			expect(bypassTalent).toBeDefined()
			expect(bypassTalent.data?.ignore_equip_requirements).toBe(true)
		})
	})

	describe('Talents Utility Functions (talents.js)', () => {
		it('getCharacterTalentIds correctly extracts IDs from array and comma-separated string', () => {
			expect(getCharacterTalentIds(null)).toEqual([])
			expect(getCharacterTalentIds({})).toEqual([])
			expect(getCharacterTalentIds({ talents: ['talent_1', ' talent_2 '] })).toEqual(['talent_1', 'talent_2'])
			expect(getCharacterTalentIds({ talents: 'talent_1, talent_2, ' })).toEqual(['talent_1', 'talent_2'])
		})

		it('hasTalent accurately detects if a character has a talent', () => {
			const char = { talents: ['item_restriction_bypass'] }
			expect(hasTalent(char, 'item_restriction_bypass')).toBe(true)
			expect(hasTalent(char, 'field_expansion')).toBe(false)
			expect(hasTalent(null, 'item_restriction_bypass')).toBe(false)
		})

		it('canCharacterBypassEquipRestrictions returns true for item_restriction_bypass ID or registry flag', () => {
			const charBypass = { talents: ['item_restriction_bypass'] }
			const charOther = { talents: ['field_expansion'] }
			const charNone = { talents: [] }

			expect(canCharacterBypassEquipRestrictions(charBypass)).toBe(true)
			expect(canCharacterBypassEquipRestrictions(charOther)).toBe(false)
			expect(canCharacterBypassEquipRestrictions(charNone)).toBe(false)

			// Custom talent with ignore_equip_requirements flag in registry
			const customRegistry = [
				{ id: 'custom_omni', data: { ignore_equip_requirements: true } },
				{ id: 'other', data: {} }
			]
			expect(canCharacterBypassEquipRestrictions({ talents: ['custom_omni'] }, customRegistry)).toBe(true)
			expect(canCharacterBypassEquipRestrictions({ talents: ['other'] }, customRegistry)).toBe(false)
		})

		it('resolveCharacterTalents resolves full objects and sets isTalent: true', () => {
			const char = { talents: ['item_restriction_bypass', 'unknown_talent'] }
			const resolved = resolveCharacterTalents(char, talentsData)

			expect(resolved).toHaveLength(2)
			expect(resolved[0].id).toBe('item_restriction_bypass')
			expect(resolved[0].name).toBe('Врождённое всемогущество экипировки')
			expect(resolved[0].isTalent).toBe(true)
			expect(resolved[0].data?.ignore_equip_requirements).toBe(true)

			// Unknown talent fallback
			expect(resolved[1].id).toBe('unknown_talent')
			expect(resolved[1].name).toBe('unknown_talent')
			expect(resolved[1].isTalent).toBe(true)
		})
	})

	describe('Equipment Restriction Bypass via Talent (equipment.js)', () => {
		const highTierRestrictedItem = {
			id: 'staff_of_ainz_ooal_gown',
			name: 'Посох Аинз Оал Гоун',
			lvl_min: 100,
			classs: ['master-of-death', 'wizard'],
			races: ['skeleton', 'overlord'],
			characters: ['momonga'],
			genders: ['male'],
			can_equip: true
		}

		it('prevents normal character without matching stats from equipping restricted item', () => {
			const normalEnri = {
				id: 'enri',
				lvl: 1,
				classs: ['hunter'],
				races: ['human'],
				gender: 'female',
				talents: []
			}

			expect(canCharacterEquipItem(normalEnri, highTierRestrictedItem)).toBe(false)
			const reasons = getEquipRestrictionReasons(normalEnri, highTierRestrictedItem)
			expect(reasons.length).toBeGreaterThan(0)
			expect(reasons.some((r) => r.includes('уровень'))).toBe(true)
			expect(reasons.some((r) => r.includes('персонажей'))).toBe(true)
			expect(reasons.some((r) => r.includes('пол'))).toBe(true)
			expect(reasons.some((r) => r.includes('класс'))).toBe(true)
			expect(reasons.some((r) => r.includes('раса'))).toBe(true)
		})

		it('allows character with item_restriction_bypass talent to equip ANY restricted item', () => {
			const talentEnri = {
				id: 'enri',
				lvl: 1,
				classs: ['hunter'],
				races: ['human'],
				gender: 'female',
				talents: ['item_restriction_bypass']
			}

			expect(canCharacterEquipItem(talentEnri, highTierRestrictedItem)).toBe(true)
			const reasons = getEquipRestrictionReasons(talentEnri, highTierRestrictedItem)
			expect(reasons).toEqual([])
		})

		it('still forbids equipping items marked explicitly as can_equip: false (e.g. quest junk)', () => {
			const unEquippableItem = {
				id: 'quest_herb',
				can_equip: false
			}
			const talentEnri = {
				id: 'enri',
				talents: ['item_restriction_bypass']
			}

			expect(canCharacterEquipItem(talentEnri, unEquippableItem)).toBe(false)
			const reasons = getEquipRestrictionReasons(talentEnri, unEquippableItem)
			expect(reasons).toContain('Предмет нельзя экипировать')
		})
	})

	describe('useDataEditor talents integration & normalization', () => {
		it('normalizes character talents and strips empty values', async () => {
			const editor = useDataEditor()

			// Test saving character with talents array
			const res1 = await editor.saveEntity('characters', {
				id: 'test_nfirea',
				name: 'Нфири Бареаре',
				talents: ['item_restriction_bypass', ' ']
			})
			expect(res1.entity.talents).toEqual(['item_restriction_bypass'])

			// Test saving character with comma-separated string
			const res2 = await editor.saveEntity('characters', {
				id: 'test_brain',
				name: 'Брейн Англас',
				talents: 'field_expansion, martial_arts '
			})
			expect(res2.entity.talents).toEqual(['field_expansion', 'martial_arts'])

			// Test saving character with empty talents removes field
			const res3 = await editor.saveEntity('characters', {
				id: 'test_peasant',
				name: 'Крестьянин',
				talents: []
			})
			expect(res3.entity.talents).toBeUndefined()
		})

		it('supports saveTalent and deleteTalent in useDataEditor', async () => {
			const editor = useDataEditor()
			const initialLen = editor.talents.value.length

			const newTalent = {
				id: 'test_talent_temp',
				name: 'Временный талант',
				icon: '✨',
				category: 'passive',
				description: 'Тестовое описание таланта'
			}

			await editor.saveTalent(newTalent)
			expect(editor.talents.value.some((t) => t.id === 'test_talent_temp')).toBe(true)

			await editor.deleteTalent('test_talent_temp')
			expect(editor.talents.value.some((t) => t.id === 'test_talent_temp')).toBe(false)
			expect(editor.talents.value.length).toBe(initialLen)
		})
	})
})
