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

/**
 * Checks if a character meets all restrictions to equip a given item.
 *
 * @param {Object} character - Character data (id, lvl, gender, classs/classes, races/race)
 * @param {Object} itemDef - Item definition
 * @param {Object|null} invItem - Inventory item instance (optional)
 * @returns {boolean} True if character can equip the item
 */
export function canCharacterEquipItem(character, itemDef, invItem = null) {
	if (!itemDef) return false
	if (invItem?.can_equip === false || invItem?.equippable === false) return false
	if (itemDef?.can_equip === false || itemDef?.equippable === false) return false

	// If no character is provided, allow by default unless explicitly disabled
	if (!character) return true

	// 1. Minimum Level Check
	const minLvl = itemDef.lvl_min ?? itemDef.lvl ?? 0
	if (minLvl > 1) {
		const charLvl = character.lvl ?? 1
		if (charLvl < minLvl) return false
	}

	// 2. Character ID Restriction
	if (Array.isArray(itemDef.characters) && itemDef.characters.length > 0) {
		if (!character.id || !itemDef.characters.includes(character.id)) return false
	}

	// 3. Gender Restriction (if empty / unspecified, all genders are allowed)
	const allowedGenders = itemDef.genders || (itemDef.gender ? [itemDef.gender] : null)
	if (Array.isArray(allowedGenders) && allowedGenders.length > 0) {
		if (!character.gender || !allowedGenders.includes(character.gender)) return false
	}

	// 4. Class Restriction
	const requiredClasses =
		itemDef.classs || itemDef.classes || (itemDef.class ? (Array.isArray(itemDef.class) ? itemDef.class : [itemDef.class]) : null)
	if (Array.isArray(requiredClasses) && requiredClasses.length > 0) {
		const charClasses = Array.isArray(character.classs)
			? character.classs
			: Array.isArray(character.classes)
			? character.classes
			: character.class
			? [character.class]
			: []
		const hasClassMatch = charClasses.some((c) => requiredClasses.includes(c))
		if (!hasClassMatch) return false
	}

	// 5. Race Restriction
	if (Array.isArray(itemDef.races) && itemDef.races.length > 0) {
		const charRaces = Array.isArray(character.races)
			? character.races
			: character.race
			? [character.race]
			: []
		const hasRaceMatch = charRaces.some((r) => itemDef.races.includes(r))
		if (!hasRaceMatch) return false
	}

	return true
}

/**
 * Returns a list of reasons why a character cannot equip an item.
 *
 * @param {Object} character - Character data
 * @param {Object} itemDef - Item definition
 * @param {Object|null} invItem - Inventory item instance
 * @returns {Array<string>} Array of restriction reasons
 */
export function getEquipRestrictionReasons(character, itemDef, invItem = null) {
	const reasons = []
	if (!itemDef) return reasons
	if (invItem?.can_equip === false || invItem?.equippable === false || itemDef?.can_equip === false || itemDef?.equippable === false) {
		reasons.push('Предмет нельзя экипировать')
		return reasons
	}
	if (!character) return reasons

	const minLvl = itemDef.lvl_min ?? itemDef.lvl ?? 0
	if (minLvl > 1) {
		const charLvl = character.lvl ?? 1
		if (charLvl < minLvl) {
			reasons.push(`Требуется уровень: ${minLvl} (у вас: ${charLvl})`)
		}
	}

	if (Array.isArray(itemDef.characters) && itemDef.characters.length > 0) {
		if (!character.id || !itemDef.characters.includes(character.id)) {
			reasons.push(`Только для персонажей: ${itemDef.characters.join(', ')}`)
		}
	}

	const allowedGenders = itemDef.genders || (itemDef.gender ? [itemDef.gender] : null)
	if (Array.isArray(allowedGenders) && allowedGenders.length > 0) {
		if (!character.gender || !allowedGenders.includes(character.gender)) {
			const genderLabels = {
				male: 'Мужской',
				female: 'Женский',
				genderless: 'Бесполое',
				hermaphrodite: 'Гермафродит'
			}
			const labels = allowedGenders.map((g) => genderLabels[g] || g).join(', ')
			reasons.push(`Только для пола: ${labels}`)
		}
	}

	const requiredClasses =
		itemDef.classs || itemDef.classes || (itemDef.class ? (Array.isArray(itemDef.class) ? itemDef.class : [itemDef.class]) : null)
	if (Array.isArray(requiredClasses) && requiredClasses.length > 0) {
		const charClasses = Array.isArray(character.classs)
			? character.classs
			: Array.isArray(character.classes)
			? character.classes
			: character.class
			? [character.class]
			: []
		if (!charClasses.some((c) => requiredClasses.includes(c))) {
			reasons.push(`Требуемый класс: ${requiredClasses.join(', ')}`)
		}
	}

	if (Array.isArray(itemDef.races) && itemDef.races.length > 0) {
		const charRaces = Array.isArray(character.races)
			? character.races
			: character.race
			? [character.race]
			: []
		if (!charRaces.some((r) => itemDef.races.includes(r))) {
			reasons.push(`Требуемая раса: ${itemDef.races.join(', ')}`)
		}
	}

	return reasons
}

