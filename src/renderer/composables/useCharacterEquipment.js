import { computed } from 'vue'

export function useCharacterEquipment(mcCharacter, itemsData, gameState, playClothSound = () => {}) {
  function rebuildEquipmentBySlot() {
    if (!mcCharacter.value) return

    const equipmentMap = {}
    if (Array.isArray(mcCharacter.value.equipment)) {
      mcCharacter.value.equipment.forEach((item) => {
        if (item && item.id) equipmentMap[item.id] = item
      })
    }

    const equipmentBySlot = {}
    const slots = mcCharacter.value.equipment_slots || {}
    for (const [slotName, itemRef] of Object.entries(slots)) {
      let itemId = null
      if (itemRef === null || typeof itemRef === 'undefined') {
        itemId = null
      } else if (typeof itemRef === 'string' || typeof itemRef === 'number') {
        itemId = itemRef
      } else if (typeof itemRef === 'object' && itemRef.id) {
        itemId = itemRef.id
      } else if (typeof itemRef === 'object' && itemRef.item && itemRef.item.id) {
        itemId = itemRef.item.id
      }

      if (itemId && equipmentMap[itemId]) {
        equipmentBySlot[slotName] = {
          id: itemId,
          item: equipmentMap[itemId],
          parts: equipmentMap[itemId].parts || []
        }
      }
    }

    mcCharacter.value.equipmentBySlot = equipmentBySlot
  }

  function handleEquip({ slot, itemId, inventoryIndex }) {
    if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

    const currentItemInSlot = mcCharacter.value.equipment_slots[slot]
    if (currentItemInSlot === itemId) return

    if (currentItemInSlot) {
      const oldItemDef = itemsData.value?.[currentItemInSlot]
      const oldItemStackable = oldItemDef?.stackable !== false
      if (oldItemStackable) {
        const existingItem = mcCharacter.value.inventory.items.find((item) => item.itemId === currentItemInSlot)
        if (existingItem) {
          existingItem.quantity = (existingItem.quantity ?? 1) + 1
        } else {
          mcCharacter.value.inventory.items.push({ itemId: currentItemInSlot, quantity: 1 })
        }
      } else {
        mcCharacter.value.inventory.items.push({ itemId: currentItemInSlot, quantity: 1 })
      }
    }

    let itemIndex = inventoryIndex ?? -1
    if (itemIndex === -1) {
      itemIndex = mcCharacter.value.inventory.items.findIndex((item) => item.itemId === itemId)
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
  }

  function handleUnequip({ slot, itemId }) {
    if (!mcCharacter.value?.equipment_slots || !mcCharacter.value?.inventory?.items) return

    const actualItem = mcCharacter.value.equipment_slots[slot]
    if (actualItem !== null && actualItem !== itemId) return

    if (mcCharacter.value.equipment_slots[slot] !== null) {
      mcCharacter.value.equipment_slots[slot] = null
    }

    const itemDef = itemsData.value?.[itemId]
    const isStackable = itemDef?.stackable !== false
    if (isStackable) {
      const existingItem = mcCharacter.value.inventory.items.find((item) => item.itemId === itemId)
      if (existingItem) {
        existingItem.quantity += 1
      } else {
        mcCharacter.value.inventory.items.push({ itemId, quantity: 1 })
      }
    } else {
      mcCharacter.value.inventory.items.push({ itemId, quantity: 1 })
    }

    rebuildEquipmentBySlot()
    playClothSound()
    if (mcCharacter.value) {
      gameState.character.mc = mcCharacter.value
    }
  }

  function handleSwap({ from, to }) {
    if (!mcCharacter.value?.equipment_slots) return
    const fromItemId = mcCharacter.value.equipment_slots[from]
    const toItemId = mcCharacter.value.equipment_slots[to]
    if (!fromItemId || !toItemId) return
    mcCharacter.value.equipment_slots[from] = toItemId
    mcCharacter.value.equipment_slots[to] = fromItemId
    rebuildEquipmentBySlot()
    playClothSound()
    if (mcCharacter.value) {
      gameState.character.mc = mcCharacter.value
    }
  }

  function handleDrop({ itemId, source, slot, quantity = 1 }) {
    if (!mcCharacter.value?.inventory?.items) return
    const itemIndex = mcCharacter.value.inventory.items.findIndex((item) => item.itemId === itemId)
    if (itemIndex === -1) return

    const item = mcCharacter.value.inventory.items[itemIndex]
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
