import { computed } from 'vue'
import { calculateEquipmentBySlot, canCharacterEquipItem } from '../utils/equipment'
import { eventBus } from '../utils/eventBus'

export function useCharacterEquipment(
	mcCharacter,
	itemsData,
	gameState,
	playClothSound = () => {},
	onEquipmentChanged = () => {}
) {
	function rebuildEquipmentBySlot() {
		if (!mcCharacter.value) return
		mcCharacter.value.equipmentBySlot = calculateEquipmentBySlot(
			mcCharacter.value.equipment_slots,
			mcCharacter.value.equipment
		)
	}

	function handleEquip({ slot, itemId, inventoryIndex }) {
		if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

		const currentItemInSlot = mcCharacter.value.equipment_slots[slot]
		if (currentItemInSlot === itemId) return

		let itemIndex = inventoryIndex ?? -1
		if (itemIndex === -1) {
			itemIndex = mcCharacter.value.inventory.items.findIndex(
				(item) => item && item.itemId === itemId
			)
		}

		const invItem = itemIndex !== -1 ? mcCharacter.value.inventory.items[itemIndex] : null
		const itemDef = itemsData.value?.[itemId]
		const canEquip = canCharacterEquipItem(mcCharacter.value, itemDef, invItem)

		if (!canEquip) return

		if (currentItemInSlot) {
			const oldItemDef = itemsData.value?.[currentItemInSlot]
			const oldItemStackable = oldItemDef?.stackable !== false
			if (oldItemStackable) {
				const existingItem = mcCharacter.value.inventory.items.find(
					(item) => item && item.itemId === currentItemInSlot
				)
				if (existingItem) {
					existingItem.quantity = (existingItem.quantity ?? 1) + 1
				} else {
					mcCharacter.value.inventory.items.push({
						itemId: currentItemInSlot,
						quantity: 1
					})
				}
			} else {
				mcCharacter.value.inventory.items.push({ itemId: currentItemInSlot, quantity: 1 })
			}
		}

		if (itemIndex !== -1) {
			const item = mcCharacter.value.inventory.items[itemIndex]
			if (item) {
				item.quantity = (item.quantity ?? 1) - 1
				if (item.quantity <= 0) {
					mcCharacter.value.inventory.items.splice(itemIndex, 1)
				}
			}
		}

		mcCharacter.value.equipment_slots[slot] = itemId
		rebuildEquipmentBySlot()
		playClothSound()
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
		eventBus.emit('item-equipped', { slot, itemId })
		onEquipmentChanged({ action: 'equip', slot, itemId })
	}

	function handleUnequip({ slot, itemId }) {
		if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

		const actualItem = mcCharacter.value.equipment_slots[slot]
		if (actualItem !== null && actualItem !== itemId) return

		const itemToUnequip = itemId || actualItem
		const itemDef = itemsData.value?.[itemToUnequip]
		const canUnequip =
			itemDef?.can_equip !== false &&
			itemDef?.equippable !== false &&
			itemDef?.can_unequip !== false

		if (!canUnequip) return

		if (mcCharacter.value.equipment_slots[slot] !== null) {
			mcCharacter.value.equipment_slots[slot] = null
		}

		const isStackable = itemDef?.stackable !== false
		if (isStackable) {
			const existingItem = mcCharacter.value.inventory.items.find(
				(item) => item && item.itemId === itemToUnequip
			)
			if (existingItem) {
				existingItem.quantity += 1
			} else {
				mcCharacter.value.inventory.items.push({ itemId: itemToUnequip, quantity: 1 })
			}
		} else {
			mcCharacter.value.inventory.items.push({ itemId: itemToUnequip, quantity: 1 })
		}

		rebuildEquipmentBySlot()
		playClothSound()
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
		onEquipmentChanged({ action: 'unequip', slot, itemId: itemToUnequip })
	}

	function handleSwap({ from, to }) {
		if (!mcCharacter.value?.equipment_slots) return
		const fromItemId = mcCharacter.value.equipment_slots[from]
		const toItemId = mcCharacter.value.equipment_slots[to]
		if (!fromItemId || !toItemId) return

		const fromDef = itemsData.value?.[fromItemId]
		const toDef = itemsData.value?.[toItemId]
		const canSwapFrom =
			fromDef?.can_equip !== false &&
			fromDef?.equippable !== false &&
			fromDef?.can_unequip !== false
		const canSwapTo =
			toDef?.can_equip !== false &&
			toDef?.equippable !== false &&
			toDef?.can_unequip !== false

		if (!canSwapFrom || !canSwapTo) return

		mcCharacter.value.equipment_slots[from] = toItemId
		mcCharacter.value.equipment_slots[to] = fromItemId
		rebuildEquipmentBySlot()
		playClothSound()
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
		onEquipmentChanged({ action: 'swap', from, to, fromItemId, toItemId })
	}

	function handleDrop({ itemId, source, slot, quantity = 1 }) {
		if (source === 'equipment') {
			const itemDef = itemsData.value?.[itemId]
			const canDrop =
				itemDef?.can_drop !== false &&
				itemDef?.droppable !== false &&
				itemDef?.can_equip !== false &&
				itemDef?.equippable !== false &&
				itemDef?.can_unequip !== false

			if (!canDrop) return

			if (mcCharacter.value?.equipment_slots && slot) {
				mcCharacter.value.equipment_slots[slot] = null
				rebuildEquipmentBySlot()
			}
			if (mcCharacter.value) {
				gameState.character.mc = mcCharacter.value
			}
			onEquipmentChanged({ action: 'drop', source: 'equipment', slot, itemId })
			return
		}

		if (!mcCharacter.value?.inventory?.items) return
		const itemIndex = mcCharacter.value.inventory.items.findIndex(
			(item) => item && item.itemId === itemId
		)
		if (itemIndex === -1) return

		const item = mcCharacter.value.inventory.items[itemIndex]
		const itemDef = itemsData.value?.[itemId]
		const canDrop =
			item?.can_drop !== false &&
			item?.droppable !== false &&
			itemDef?.can_drop !== false &&
			itemDef?.droppable !== false

		if (!canDrop) return

		if (item.quantity && item.quantity > quantity) {
			item.quantity -= quantity
		} else {
			mcCharacter.value.inventory.items.splice(itemIndex, 1)
		}

		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
	}

	return {
		handleEquip,
		handleUnequip,
		handleSwap,
		handleDrop,
		rebuildEquipmentBySlot
	}
}
