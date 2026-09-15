import { describe, it, expect } from 'vitest'
import { calculateEquipmentBySlot, canCharacterEquipItem, getEquipRestrictionReasons } from '../equipment'

describe('calculateEquipmentBySlot', () => {
	const equipmentList = [
		{
			id: 'gasmask',
			name: 'Противогаз',
			parts: ['head_mask', 'filter']
		},
		{
			id: 'cloak',
			name: 'Плащ',
			parts: ['body_cloak']
		}
	]

	it('handles empty slots and list', () => {
		expect(calculateEquipmentBySlot({}, [])).toEqual({})
		expect(calculateEquipmentBySlot(null, null)).toEqual({})
	})

	it('maps string item ids to equipment parts', () => {
		const slots = {
			mask: 'gasmask',
			back: 'cloak',
			gloves: null
		}
		const result = calculateEquipmentBySlot(slots, equipmentList)
		expect(result.mask).toBeDefined()
		expect(result.mask.id).toBe('gasmask')
		expect(result.mask.parts).toEqual(['head_mask', 'filter'])
		expect(result.back.id).toBe('cloak')
		expect(result.gloves).toBeUndefined()
	})

	it('maps object references with id or item.id', () => {
		const slots = {
			mask: { id: 'gasmask' },
			back: { item: { id: 'cloak' } }
		}
		const result = calculateEquipmentBySlot(slots, equipmentList)
		expect(result.mask.id).toBe('gasmask')
		expect(result.back.id).toBe('cloak')
	})

	it('ignores slots with unknown item IDs', () => {
		const slots = {
			helmet: 'cyber_helmet_unknown'
		}
		const result = calculateEquipmentBySlot(slots, equipmentList)
		expect(result.helmet).toBeUndefined()
	})
})

describe('canCharacterEquipItem & getEquipRestrictionReasons', () => {
	const testChar = {
		id: 'mc',
		name: 'Анон',
		gender: 'male',
		lvl: 5,
		classs: ['warrior'],
		races: ['human']
	}

	it('allows item when no restrictions are set (gender, class, race, level, character)', () => {
		const genericItem = {
			id: 'generic_shirt',
			name: 'Рубаха'
		}
		expect(canCharacterEquipItem(testChar, genericItem)).toBe(true)
		expect(getEquipRestrictionReasons(testChar, genericItem)).toEqual([])
	})

	it('allows item to all genders when genders is empty or omitted', () => {
		const ungenderedItem = {
			id: 'cloak',
			name: 'Плащ'
		}
		expect(canCharacterEquipItem({ ...testChar, gender: 'male' }, ungenderedItem)).toBe(true)
		expect(canCharacterEquipItem({ ...testChar, gender: 'female' }, ungenderedItem)).toBe(true)
		expect(canCharacterEquipItem({ ...testChar, gender: 'genderless' }, ungenderedItem)).toBe(true)
		expect(canCharacterEquipItem({ ...testChar, gender: 'hermaphrodite' }, ungenderedItem)).toBe(true)
	})

	it('enforces gender restrictions when specified', () => {
		const femaleItem = {
			id: 'dress',
			name: 'Платье',
			genders: ['female']
		}
		// Male character cannot equip
		expect(canCharacterEquipItem(testChar, femaleItem)).toBe(false)
		const reasons = getEquipRestrictionReasons(testChar, femaleItem)
		expect(reasons).toContain('Только для пола: Женский')

		// Female character can equip
		const femaleChar = { ...testChar, gender: 'female' }
		expect(canCharacterEquipItem(femaleChar, femaleItem)).toBe(true)
		expect(getEquipRestrictionReasons(femaleChar, femaleItem)).toEqual([])
	})

	it('enforces minimum level requirements', () => {
		const highLvlItem = {
			id: 'legendary_sword',
			lvl: 10
		}
		expect(canCharacterEquipItem(testChar, highLvlItem)).toBe(false)
		const reasons = getEquipRestrictionReasons(testChar, highLvlItem)
		expect(reasons).toContain('Требуется уровень: 10 (у вас: 5)')

		// Level 10+ character can equip
		expect(canCharacterEquipItem({ ...testChar, lvl: 10 }, highLvlItem)).toBe(true)
		expect(canCharacterEquipItem({ ...testChar, lvl: 12 }, highLvlItem)).toBe(true)
	})

	it('enforces class restrictions', () => {
		const mageStaff = {
			id: 'staff',
			classs: ['mage', 'wizard']
		}
		expect(canCharacterEquipItem(testChar, mageStaff)).toBe(false)
		expect(getEquipRestrictionReasons(testChar, mageStaff)).toContain('Требуемый класс: mage, wizard')

		// Character with matching class can equip
		const mageChar = { ...testChar, classs: ['mage', 'warrior'] }
		expect(canCharacterEquipItem(mageChar, mageStaff)).toBe(true)
	})

	it('enforces race restrictions', () => {
		const undeadRing = {
			id: 'bone_ring',
			races: ['undead', 'skeleton']
		}
		expect(canCharacterEquipItem(testChar, undeadRing)).toBe(false)
		expect(getEquipRestrictionReasons(testChar, undeadRing)).toContain('Требуемая раса: undead, skeleton')

		// Undead character can equip
		const undeadChar = { ...testChar, races: ['undead'] }
		expect(canCharacterEquipItem(undeadChar, undeadRing)).toBe(true)
	})

	it('enforces specific character restrictions', () => {
		const momongaRobe = {
			id: 'supreme_robe',
			characters: ['momonga']
		}
		expect(canCharacterEquipItem(testChar, momongaRobe)).toBe(false)
		expect(getEquipRestrictionReasons(testChar, momongaRobe)).toContain('Только для персонажей: momonga')

		// Momonga can equip
		const momonga = { ...testChar, id: 'momonga' }
		expect(canCharacterEquipItem(momonga, momongaRobe)).toBe(true)
	})

	it('respects can_equip and equippable flags on item and invItem', () => {
		const nonEquipItem = {
			id: 'quest_item',
			can_equip: false
		}
		expect(canCharacterEquipItem(testChar, nonEquipItem)).toBe(false)

		const regularItem = { id: 'helmet' }
		const disabledInvItem = { itemId: 'helmet', can_equip: false }
		expect(canCharacterEquipItem(testChar, regularItem, disabledInvItem)).toBe(false)
	})
})
