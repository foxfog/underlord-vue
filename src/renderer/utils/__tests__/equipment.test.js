import { describe, it, expect } from 'vitest'
import { calculateEquipmentBySlot } from '../equipment'

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
