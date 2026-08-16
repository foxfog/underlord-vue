import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { useCharacterEquipment } from '../useCharacterEquipment'
import { extractDelta } from '../../utils/saveGameUtils'

describe('Inventory Item Properties (can_drop, can_equip)', () => {
	it('should prevent equipping when item has can_equip: false', () => {
		const mcCharacter = ref({
			equipment_slots: { head: null },
			inventory: {
				items: [
					{
						itemId: 'neuro_helmet',
						can_drop: false,
						can_equip: false
					}
				]
			}
		})
		const itemsData = ref({
			neuro_helmet: {
				id: 'neuro_helmet',
				slot: 'head'
			}
		})
		const gameState = { character: {} }
		const playSound = vi.fn()

		const { handleEquip } = useCharacterEquipment(mcCharacter, itemsData, gameState, playSound)

		// Try to equip neuro_helmet
		handleEquip({ slot: 'head', itemId: 'neuro_helmet', inventoryIndex: 0 })

		// Should NOT be equipped
		expect(mcCharacter.value.equipment_slots.head).toBeNull()
		expect(mcCharacter.value.inventory.items).toHaveLength(1)
		expect(playSound).not.toHaveBeenCalled()
	})

	it('should allow equipping when can_equip is removed or true', () => {
		const mcCharacter = ref({
			equipment_slots: { head: null },
			inventory: {
				items: [
					{
						itemId: 'neuro_helmet',
						can_drop: false
						// can_equip removed
					}
				]
			}
		})
		const itemsData = ref({
			neuro_helmet: {
				id: 'neuro_helmet',
				slot: 'head',
				stackable: false
			}
		})
		const gameState = { character: {} }
		const playSound = vi.fn()

		const { handleEquip } = useCharacterEquipment(mcCharacter, itemsData, gameState, playSound)

		// Equip neuro_helmet
		handleEquip({ slot: 'head', itemId: 'neuro_helmet', inventoryIndex: 0 })

		// Should be equipped
		expect(mcCharacter.value.equipment_slots.head).toBe('neuro_helmet')
		expect(mcCharacter.value.inventory.items).toHaveLength(0)
		expect(playSound).toHaveBeenCalled()
	})

	it('should prevent dropping when item has can_drop: false', () => {
		const mcCharacter = ref({
			equipment_slots: { head: null },
			inventory: {
				items: [
					{
						itemId: 'neuro_helmet',
						can_drop: false
					}
				]
			}
		})
		const itemsData = ref({
			neuro_helmet: {
				id: 'neuro_helmet',
				slot: 'head'
			}
		})
		const gameState = { character: {} }

		const { handleDrop } = useCharacterEquipment(mcCharacter, itemsData, gameState)

		handleDrop({ itemId: 'neuro_helmet', source: 'inventory', quantity: 1 })

		// Should NOT be dropped
		expect(mcCharacter.value.inventory.items).toHaveLength(1)
	})

	it('should prevent unequipping when equipped item has can_equip: false', () => {
		const mcCharacter = ref({
			equipment_slots: { head: 'cursed_helmet' },
			inventory: { items: [] }
		})
		const itemsData = ref({
			cursed_helmet: {
				id: 'cursed_helmet',
				slot: 'head',
				can_equip: false
			}
		})
		const gameState = { character: {} }
		const playSound = vi.fn()

		const { handleUnequip } = useCharacterEquipment(mcCharacter, itemsData, gameState, playSound)

		handleUnequip({ slot: 'head', itemId: 'cursed_helmet' })

		// Helmet should stay equipped
		expect(mcCharacter.value.equipment_slots.head).toBe('cursed_helmet')
		expect(mcCharacter.value.inventory.items).toHaveLength(0)
		expect(playSound).not.toHaveBeenCalled()
	})

	it('should prevent swapping when equipped item has can_equip: false', () => {
		const mcCharacter = ref({
			equipment_slots: { 'torso-1': 'cursed_armor', 'torso-2': 'normal_armor' },
			inventory: { items: [] }
		})
		const itemsData = ref({
			cursed_armor: {
				id: 'cursed_armor',
				slot: ['torso-1', 'torso-2'],
				can_equip: false
			},
			normal_armor: {
				id: 'normal_armor',
				slot: ['torso-1', 'torso-2']
			}
		})
		const gameState = { character: {} }
		const playSound = vi.fn()

		const { handleSwap } = useCharacterEquipment(mcCharacter, itemsData, gameState, playSound)

		handleSwap({ from: 'torso-1', to: 'torso-2' })

		// Should NOT swap
		expect(mcCharacter.value.equipment_slots['torso-1']).toBe('cursed_armor')
		expect(mcCharacter.value.equipment_slots['torso-2']).toBe('normal_armor')
	})

	it('should prevent dropping from equipment when equipped item has can_equip: false', () => {
		const mcCharacter = ref({
			equipment_slots: { head: 'cursed_helmet' },
			inventory: { items: [] }
		})
		const itemsData = ref({
			cursed_helmet: {
				id: 'cursed_helmet',
				slot: 'head',
				can_equip: false
			}
		})
		const gameState = { character: {} }

		const { handleDrop } = useCharacterEquipment(mcCharacter, itemsData, gameState)

		handleDrop({ itemId: 'cursed_helmet', source: 'equipment', slot: 'head', quantity: 1 })

		// Helmet should stay equipped
		expect(mcCharacter.value.equipment_slots.head).toBe('cursed_helmet')
	})

	it('should allow dropping when can_drop is not false', () => {
		const mcCharacter = ref({
			equipment_slots: { head: null },
			inventory: {
				items: [
					{
						itemId: 'bread',
						quantity: 2
					}
				]
			}
		})
		const itemsData = ref({
			bread: {
				id: 'bread',
				stackable: true
			}
		})
		const gameState = { character: {} }

		const { handleDrop } = useCharacterEquipment(mcCharacter, itemsData, gameState)

		handleDrop({ itemId: 'bread', source: 'inventory', quantity: 1 })

		expect(mcCharacter.value.inventory.items[0].quantity).toBe(1)
	})
})

describe('Save utilities with item properties', () => {
	it('should preserve item properties in sanitizeInventory', () => {
		const rawInventory = {
			items: [
				{
					itemId: 'neuro_helmet',
					can_drop: false,
					can_equip: false
				},
				{
					itemId: 'ygdrasil-coin-old',
					quantity: 23
				}
			]
		}

		const clean = extractDelta(
			{ inventory: rawInventory },
			{ inventory: { items: [] } }
		)

		expect(clean.inventory.items[0]).toEqual({
			itemId: 'neuro_helmet',
			can_drop: false,
			can_equip: false
		})
		expect(clean.inventory.items[1]).toEqual({
			itemId: 'ygdrasil-coin-old',
			quantity: 23
		})
	})
})
