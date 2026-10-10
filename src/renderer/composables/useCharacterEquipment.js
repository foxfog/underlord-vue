import { calculateEquipmentBySlot, canCharacterEquipItem } from '../utils/equipment'
import { eventBus } from '../utils/eventBus'
import {
	addItemToInventory,
	applyEquipPlan,
	ensureEquipmentSlots,
	getSlotStates,
	migrateLegacyEquipment,
	planEquip,
	reconcileEquipment,
	resolveItemPlacement,
	resolvePrimarySlot,
	unequipSlot
} from '../utils/equipmentManager'
import { getSlotLabel } from '../constants/equipmentSlots'
import { useEquipPrompt } from './useEquipPrompt'

const REASON_TEXT = {
	locked: 'слот закрыт',
	no_skill: 'потерян навык хвата',
	blocked: 'слот заблокирован'
}

export function useCharacterEquipment(
	mcCharacter,
	itemsData,
	gameState,
	playClothSound = () => {},
	onEquipmentChanged = () => {},
	getLearnedSkills = () => []
) {
	const { openPrompt, closePrompt, showNotice } = useEquipPrompt()

	function rebuildEquipmentBySlot() {
		if (!mcCharacter.value) return
		mcCharacter.value.equipmentBySlot = calculateEquipmentBySlot(
			mcCharacter.value.equipment_slots,
			mcCharacter.value.equipment
		)
	}

	function itemLabel(id) {
		return itemsData.value?.[id]?.name || id
	}

	function commitChanges(event) {
		rebuildEquipmentBySlot()
		playClothSound()
		if (mcCharacter.value) {
			gameState.character.mc = mcCharacter.value
		}
		onEquipmentChanged(event)
	}

	/** Returns ejected items (from reconcile) to the inventory and tells the player. */
	function returnEjected(removed) {
		for (const r of removed) {
			addItemToInventory(mcCharacter.value, r.itemId, itemsData.value)
			showNotice(`«${itemLabel(r.itemId)}» снято: ${REASON_TEXT[r.reason] || r.reason}`)
		}
	}

	/**
	 * Brings the equipment state in line with the current data: legacy slot names, missing slots,
	 * locked rings, lost grip skill, blocked occupants. Safe to call any time (idempotent).
	 * @returns {boolean} true if the character was changed
	 */
	function syncEquipmentState() {
		const char = mcCharacter.value
		if (!char) return false
		let changed = migrateLegacyEquipment(char, itemsData.value)
		changed = ensureEquipmentSlots(char) || changed
		const res = reconcileEquipment(char, itemsData.value, getLearnedSkills())
		if (res.removed.length) returnEjected(res.removed)
		changed = changed || res.changed || res.removed.length > 0
		if (changed) {
			rebuildEquipmentBySlot()
			gameState.character.mc = char
			onEquipmentChanged({ action: 'reconcile', removed: res.removed })
		}
		return changed
	}

	function handleEquip(payload) {
		const char = mcCharacter.value
		if (!char?.inventory?.items) return
		const { slot = null, itemId, inventoryIndex, anchor = null } = payload

		migrateLegacyEquipment(char, itemsData.value)
		ensureEquipmentSlots(char)

		let itemIndex = inventoryIndex ?? -1
		if (itemIndex === -1 || char.inventory.items[itemIndex]?.itemId !== itemId) {
			itemIndex = char.inventory.items.findIndex((item) => item && item.itemId === itemId)
		}

		const invItem = itemIndex !== -1 ? char.inventory.items[itemIndex] : null
		const itemDef = itemsData.value?.[itemId]
		if (!canCharacterEquipItem(char, itemDef, invItem)) return

		const skills = getLearnedSkills()
		const planFor = (options = {}) =>
			planEquip({
				character: char,
				itemsData: itemsData.value,
				learnedSkills: skills,
				itemId,
				slot,
				pair: options.pair,
				oneHandedGrip: options.oneHandedGrip
			})

		const options = payload.options
		const plan = planFor(options || {})
		if (!plan.ok) {
			if (plan.error !== 'already_equipped') showNotice(plan.message)
			return
		}

		const needsChoice = options === undefined && (plan.options.canPair || plan.options.canOneGrip)
		if (needsChoice || (plan.needsConfirm && !payload.confirmed)) {
			openPrompt({
				itemId,
				slot,
				anchor,
				canPair: plan.options.canPair,
				canOneGrip: plan.options.canOneGrip,
				preview: (o) => planFor(o),
				confirm: (o) => {
					closePrompt()
					handleEquip({ ...payload, options: o, confirmed: true })
				},
				cancel: closePrompt
			})
			return
		}

		// Commit: take the item out of the inventory first, then displace/return the rest.
		if (itemIndex !== -1) {
			const item = char.inventory.items[itemIndex]
			if (item) {
				item.quantity = (item.quantity ?? 1) - 1
				if (item.quantity <= 0) char.inventory.items.splice(itemIndex, 1)
			}
		}
		const { removed } = applyEquipPlan(char, plan)
		for (const r of removed) addItemToInventory(char, r.itemId, itemsData.value)

		const res = reconcileEquipment(char, itemsData.value, skills)
		if (res.removed.length) returnEjected(res.removed)

		eventBus.emit('item-equipped', { slot: plan.primary, itemId })
		commitChanges({ action: 'equip', slot: plan.primary, itemId, removed })
	}

	function handleUnequip({ slot, itemId }) {
		const char = mcCharacter.value
		if (!char?.equipment_slots || !char?.inventory?.items) return

		const primary = resolvePrimarySlot(char, slot)
		if (!primary) return
		const actualItem = char.equipment_slots[primary]
		if (itemId && actualItem !== itemId) return

		const itemToUnequip = actualItem
		const itemDef = itemsData.value?.[itemToUnequip]
		const canUnequip =
			itemDef?.can_equip !== false &&
			itemDef?.equippable !== false &&
			itemDef?.can_unequip !== false

		if (!canUnequip) return

		unequipSlot(char, primary)
		addItemToInventory(char, itemToUnequip, itemsData.value)
		commitChanges({ action: 'unequip', slot: primary, itemId: itemToUnequip })
	}

	function handleSwap({ from, to }) {
		const char = mcCharacter.value
		if (!char?.equipment_slots) return
		const fromSlot = resolvePrimarySlot(char, from)
		const toSlot = resolvePrimarySlot(char, to)
		if (!fromSlot || !toSlot || fromSlot === toSlot) return

		const fromItemId = char.equipment_slots[fromSlot]
		const toItemId = char.equipment_slots[toSlot]
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

		// Paired / one-handed-grip items carry meta and are not swapped blindly.
		const meta = char.equipment_meta || {}
		if (meta[fromSlot] || meta[toSlot]) return

		const fromPlace = resolveItemPlacement(fromDef)
		const toPlace = resolveItemPlacement(toDef)
		if (!fromPlace?.candidates.includes(toSlot) || !toPlace?.candidates.includes(fromSlot)) return
		if (fromPlace.twoHanded || toPlace.twoHanded) return

		char.equipment_slots[fromSlot] = toItemId
		char.equipment_slots[toSlot] = fromItemId
		commitChanges({ action: 'swap', from: fromSlot, to: toSlot, fromItemId, toItemId })
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
				unequipSlot(mcCharacter.value, slot)
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

	/** Derived slot statuses (empty / occupied / blocked / locked) for the UI. */
	function getEquipmentSlotStates() {
		return getSlotStates(mcCharacter.value, itemsData.value, getLearnedSkills())
	}

	return {
		handleEquip,
		handleUnequip,
		handleSwap,
		handleDrop,
		rebuildEquipmentBySlot,
		syncEquipmentState,
		getEquipmentSlotStates,
		getSlotLabel
	}
}
