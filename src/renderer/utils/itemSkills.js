/**
 * src/renderer/utils/itemSkills.js
 *
 * Utilities for Item-bound Skills & Enchantments:
 * - Extracting skill IDs from base item templates (id) and unique crafted instances (uid)
 * - Resolving skill objects from the shared registry (skills/items/items.json)
 * - Resolving all active skills granted to a character by their equipped gear
 */

/**
 * Extracts an array of skill IDs from an item definition or instance.
 * Supports both array format: ["skill_1", "skill_2"] and comma-separated string: "skill_1, skill_2".
 *
 * @param {Object|null} item - Item definition or unique instance
 * @returns {string[]} Array of skill ID strings
 */
export function getItemSkillIds(item) {
	if (!item || typeof item !== 'object') return []

	if (Array.isArray(item.skills)) {
		return item.skills.map((s) => String(s).trim()).filter(Boolean)
	}

	if (typeof item.skills === 'string') {
		return item.skills
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
	}

	return []
}

/**
 * Resolves full skill objects for a given item using the items skill registry.
 * Attaches metadata about the source item (name, uid) to each resolved skill.
 *
 * @param {Object|null} item - Item definition or unique instance
 * @param {Array<Object>|Object} itemSkillsRegistry - Array of skill definitions or id->skill map
 * @returns {Array<Object>} Resolved skill objects with sourceItem metadata
 */
export function resolveItemSkills(item, itemSkillsRegistry = []) {
	if (!item) return []

	const skillIds = getItemSkillIds(item)
	if (skillIds.length === 0) return []

	// Build map for fast lookup
	const registryMap = new Map()
	if (Array.isArray(itemSkillsRegistry)) {
		for (const sk of itemSkillsRegistry) {
			if (sk && sk.id) registryMap.set(sk.id, sk)
		}
	} else if (itemSkillsRegistry && typeof itemSkillsRegistry === 'object') {
		for (const [key, val] of Object.entries(itemSkillsRegistry)) {
			if (val && typeof val === 'object') {
				registryMap.set(val.id || key, val)
			}
		}
	}

	const sourceItemName = item.customName || item.name || item.itemId || item.id || 'Предмет'
	const sourceUid = item.uid || null

	const resolved = []
	for (const id of skillIds) {
		const skillDef = registryMap.get(id)
		if (skillDef) {
			resolved.push({
				...skillDef,
				sourceItem: sourceItemName,
				sourceUid
			})
		} else {
			// Fallback placeholder if skill definition is missing
			resolved.push({
				id,
				name: id,
				icon: '✨',
				category: 'passive',
				description: 'Встроенное свойство предмета',
				sourceItem: sourceItemName,
				sourceUid
			})
		}
	}

	return resolved
}

/**
 * Resolves all skills granted by currently equipped items on a character.
 * Inspects character.equipment_slots and character.inventory.items for equipped gear.
 *
 * @param {Object|null} character - Character object
 * @param {Array<Object>|Object} allItemsData - Catalog of items (equipment.json / other.json)
 * @param {Array<Object>|Object} itemSkillsRegistry - Shared item skills registry
 * @returns {Array<Object>} Array of active skills with sourceItem metadata
 */
export function resolveEquippedSkills(character, allItemsData = {}, itemSkillsRegistry = []) {
	if (!character || typeof character !== 'object') return []

	// Build items lookup map
	const itemsMap = new Map()
	if (Array.isArray(allItemsData)) {
		for (const it of allItemsData) {
			if (it && it.id) itemsMap.set(it.id, it)
		}
	} else if (allItemsData && typeof allItemsData === 'object') {
		for (const [key, it] of Object.entries(allItemsData)) {
			if (it && typeof it === 'object') {
				itemsMap.set(it.id || key, it)
			}
		}
	}

	// 1. Gather all equipped item references/instances
	const equippedItems = []

	// Check character.equipment_slots: { [slot]: itemId | { id, uid, ... } }
	const slots = character.equipment_slots || {}
	for (const itemRef of Object.values(slots)) {
		if (!itemRef) continue

		if (typeof itemRef === 'string') {
			// Check if player inventory has an instanced item matching this itemId/uid
			const invInstance = character.inventory?.items?.find(
				(i) => i.uid === itemRef || (i.itemId === itemRef && i.isEquipped)
			)
			if (invInstance) {
				equippedItems.push(invInstance)
			} else {
				const baseDef = itemsMap.get(itemRef)
				if (baseDef) equippedItems.push(baseDef)
			}
		} else if (typeof itemRef === 'object') {
			equippedItems.push(itemRef)
		}
	}

	// Check character.inventory.items for any items explicitly flagged isEquipped: true
	if (Array.isArray(character.inventory?.items)) {
		for (const invItem of character.inventory.items) {
			if (invItem && invItem.isEquipped) {
				if (!equippedItems.some((eq) => (eq.uid && eq.uid === invItem.uid) || eq === invItem)) {
					equippedItems.push(invItem)
				}
			}
		}
	}

	// 2. Resolve skills for each equipped item
	const allSkills = []
	const seenSkillKeys = new Set()

	for (const eqItem of equippedItems) {
		// Merge skills from both the unique instance and its base template definition
		const baseDef = eqItem.itemId ? itemsMap.get(eqItem.itemId) : null

		const itemSkills = resolveItemSkills(eqItem, itemSkillsRegistry)
		const baseSkills = baseDef ? resolveItemSkills(baseDef, itemSkillsRegistry) : []

		const combinedForThisItem = [...itemSkills]
		for (const bs of baseSkills) {
			if (!combinedForThisItem.some((s) => s.id === bs.id)) {
				combinedForThisItem.push(bs)
			}
		}

		for (const sk of combinedForThisItem) {
			const dedupKey = `${sk.id}_${sk.sourceUid || sk.sourceItem}`
			if (!seenSkillKeys.has(dedupKey)) {
				seenSkillKeys.add(dedupKey)
				allSkills.push(sk)
			}
		}
	}

	return allSkills
}
