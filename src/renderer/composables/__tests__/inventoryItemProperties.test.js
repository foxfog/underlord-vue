import { describe, it, expect, vi } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useCharacterEquipment } from '../useCharacterEquipment'
import { useVisualNovel } from '../useVisualNovel'
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

describe('Character equipmentBySlot synchronization', () => {
	it('removes helmet from equipmentBySlot when equipment_slots.head is reset to null', () => {
		const mcCharacter = ref({
			equipment_slots: {
				head: 'neuro_helmet',
				'torso-1': 'tshirt',
				'legs-2': 'jeans',
				underpants: 'underpants'
			},
			equipment: [
				{
					id: 'neuro_helmet',
					zindex: 2,
					parts: [{ parent: 'head', image: 'neuro_helmet.png' }]
				},
				{
					id: 'tshirt',
					zindex: 3,
					parts: [{ parent: 'body', image: 'tshirt_body.png' }]
				},
				{
					id: 'jeans',
					zindex: 2,
					parts: [{ parent: 'body', image: 'jeans.png' }]
				},
				{
					id: 'underpants',
					zindex: 1,
					parts: [{ parent: 'body', image: 'underpants.png' }]
				}
			],
			inventory: { items: [] }
		})
		const itemsData = ref({})
		const gameState = { character: {} }

		const { rebuildEquipmentBySlot } = useCharacterEquipment(mcCharacter, itemsData, gameState)

		// Initially rebuild with helmet
		rebuildEquipmentBySlot()
		expect(mcCharacter.value.equipmentBySlot.head).toBeDefined()
		expect(mcCharacter.value.equipmentBySlot.head.id).toBe('neuro_helmet')

		// New world transfer / inventory reset: head becomes null
		mcCharacter.value.equipment_slots.head = null
		rebuildEquipmentBySlot()

		// Helmet should be completely absent from equipmentBySlot
		expect(mcCharacter.value.equipmentBySlot.head).toBeUndefined()
		expect(mcCharacter.value.equipmentBySlot['torso-1'].id).toBe('tshirt')
		expect(mcCharacter.value.equipmentBySlot['legs-2'].id).toBe('jeans')
		expect(mcCharacter.value.equipmentBySlot.underpants.id).toBe('underpants')
	})

	it('should trigger onEquipmentChanged callback on unequip, equip, swap, and drop', () => {
		const mcCharacter = ref({
			equipment_slots: { head: 'hat_1', 'torso-1': 'shirt_1', 'torso-2': 'vest_1' },
			equipment: [
				{ id: 'hat_1', parts: [] },
				{ id: 'hat_2', parts: [] },
				{ id: 'shirt_1', parts: [] },
				{ id: 'vest_1', parts: [] }
			],
			inventory: { items: [{ itemId: 'hat_2', quantity: 1 }] }
		})
		const itemsData = ref({
			hat_1: { id: 'hat_1', slot: 'head' },
			hat_2: { id: 'hat_2', slot: 'head' },
			shirt_1: { id: 'shirt_1', slot: ['torso-1', 'torso-2'] },
			vest_1: { id: 'vest_1', slot: ['torso-1', 'torso-2'] }
		})
		const gameState = { character: {} }
		const playSound = vi.fn()
		const onEquipmentChanged = vi.fn()

		const { handleEquip, handleUnequip, handleSwap, handleDrop } = useCharacterEquipment(
			mcCharacter,
			itemsData,
			gameState,
			playSound,
			onEquipmentChanged
		)

		// Unequip
		handleUnequip({ slot: 'head', itemId: 'hat_1' })
		expect(onEquipmentChanged).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'unequip', slot: 'head', itemId: 'hat_1' })
		)

		// Equip
		handleEquip({ slot: 'head', itemId: 'hat_2', inventoryIndex: 0 })
		expect(onEquipmentChanged).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'equip', slot: 'head', itemId: 'hat_2' })
		)

		// Swap
		handleSwap({ from: 'torso-1', to: 'torso-2' })
		expect(onEquipmentChanged).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'swap', from: 'torso-1', to: 'torso-2' })
		)

		// Drop from equipment
		handleDrop({ itemId: 'hat_2', source: 'equipment', slot: 'head' })
		expect(onEquipmentChanged).toHaveBeenCalledWith(
			expect.objectContaining({ action: 'drop', source: 'equipment', slot: 'head' })
		)
	})

	it('should synchronize scene visibleCharacters equipment when syncCharacterEquipment or rebuildEquipmentBySlot is called', () => {
		setActivePinia(createPinia())
		initSettingsStore({})
		const vn = useVisualNovel()
		const { characterData, visibleCharacters, rebuildEquipmentBySlot, syncCharacterEquipment } = vn

		// Setup character data
		characterData.value.mc = {
			id: 'mc',
			equipment: [
				{ id: 'tshirt_blue', parts: [{ parent: 'torso' }] },
				{ id: 'pants_jeans', parts: [{ parent: 'legs' }] }
			],
			equipment_slots: {
				'torso-1': 'tshirt_blue',
				'legs-2': 'pants_jeans'
			},
			equipmentBySlot: {}
		}

		// Character is visible on scene
		visibleCharacters.value = [{ ...characterData.value.mc }]

		// Initially rebuild
		rebuildEquipmentBySlot('mc')
		expect(visibleCharacters.value[0].equipmentBySlot['torso-1']).toBeDefined()
		expect(visibleCharacters.value[0].equipmentBySlot['torso-1'].id).toBe('tshirt_blue')

		// Unequip torso-1 via external character update (e.g. from InventoryModal)
		const updatedMc = {
			...characterData.value.mc,
			equipment_slots: {
				'torso-1': null,
				'legs-2': 'pants_jeans'
			}
		}

		syncCharacterEquipment('mc', updatedMc)

		// Visible character on scene MUST have torso-1 removed immediately!
		expect(visibleCharacters.value[0].equipmentBySlot['torso-1']).toBeUndefined()
		expect(visibleCharacters.value[0].equipmentBySlot['legs-2']).toBeDefined()
		expect(visibleCharacters.value[0].equipmentBySlot['legs-2'].id).toBe('pants_jeans')
	})
})

