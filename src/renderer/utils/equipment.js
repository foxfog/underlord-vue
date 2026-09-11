/**
 * Equipment calculation utilities
 */

/**
 * Calculates equipment mapping by slot from given slots and available equipment list.
 *
 * @param {Object} equipmentSlots - Slot dictionary, e.g. { mask: "gasmask", weapon: null }
 * @param {Array<Object>} equipmentList - List of item definitions with parts
 * @returns {Object} Mapping of slot name to { id, item, parts }
 */
export function calculateEquipmentBySlot(equipmentSlots = {}, equipmentList = []) {
	const equipmentMap = {}
	if (Array.isArray(equipmentList)) {
		equipmentList.forEach((item) => {
			if (item && item.id) {
				equipmentMap[item.id] = item
			}
		})
	}

	const equipmentBySlot = {}
	const slots = equipmentSlots || {}
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

	return equipmentBySlot
}
