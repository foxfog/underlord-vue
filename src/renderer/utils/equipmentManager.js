/**
 * Advanced Equipment Manager — pure logic (no Vue, no DOM).
 * See docs/systems/AdvancedEquipmentManager.md
 *
 * State shape on a character:
 *   equipment_slots: { [slotId]: itemId | null }          (item stored in its PRIMARY slot only)
 *   equipment_meta:  { [primarySlot]: { spans: string[], grip: 'one'|null, debuffActive: boolean } }
 *
 * Slot statuses (empty | occupied | blocked | locked) are always DERIVED by getSlotStates().
 */

import {
	ALL_SLOT_IDS,
	SLOT_GROUPS,
	SLOT_TO_GROUP,
	LEGACY_SLOT_ALIASES,
	RING_GROUP,
	DEFAULT_RING_SLOTS,
	MAX_RING_SLOTS,
	HAND_LEFT,
	HAND_RIGHT,
	DEFAULT_ONE_HANDED_DEBUFF,
	normalizeSlotId,
	getSlotLabel
} from '../constants/equipmentSlots.js'
import { getCharacterTalentIds } from './talents.js'

// ──────────────────────────── Skills / learnedSkills ────────────────────────────

function skillField(skill, key) {
	if (!skill || typeof skill !== 'object') return undefined
	if (skill.data && typeof skill.data === 'object' && key in skill.data) return skill.data[key]
	return skill[key]
}

/**
 * Number of unlocked ring slots: 2 by default, +`ring_slots_bonus` of every learned skill, max 10.
 * @param {Array<Object>} learnedSkills
 * @returns {number}
 */
export function getRingSlotLimit(learnedSkills = []) {
	let bonus = 0
	for (const skill of learnedSkills || []) {
		bonus += Number(skillField(skill, 'ring_slots_bonus')) || 0
	}
	return Math.min(MAX_RING_SLOTS, Math.max(DEFAULT_RING_SLOTS, DEFAULT_RING_SLOTS + bonus))
}

/**
 * True if any learned skill allows holding a two-handed weapon in one hand.
 * @param {Array<Object>} learnedSkills
 * @returns {boolean}
 */
export function canUseOneHandedGrip(learnedSkills = []) {
	return (learnedSkills || []).some((s) => skillField(s, 'two_handed_one_grip') === true)
}

/**
 * Builds the `learnedSkills` array that goes into calculateCharacterStats / equipment checks.
 * Sources: character talents (resolved from registry) + skill-tree progression (id -> level).
 * Item-granted skills are intentionally excluded to avoid circular slot unlocks.
 *
 * @param {Object} params
 * @param {Object|null} params.character
 * @param {Array<Object>} [params.talentsRegistry]
 * @param {Array<Object>} [params.skillsCatalog]
 * @param {Record<string, number>} [params.progressionSkills]
 * @returns {Array<Object>}
 */
export function collectLearnedSkills({
	character = null,
	talentsRegistry = [],
	skillsCatalog = [],
	progressionSkills = {}
} = {}) {
	const result = []
	const seen = new Set()
	const push = (skill) => {
		if (!skill || !skill.id || seen.has(skill.id)) return
		seen.add(skill.id)
		result.push(skill)
	}

	const talents = Array.isArray(talentsRegistry) ? talentsRegistry : []
	for (const id of getCharacterTalentIds(character)) {
		const found = talents.find((t) => t && t.id === id)
		if (found) push({ ...found, isTalent: true })
	}

	const catalog = Array.isArray(skillsCatalog) ? skillsCatalog : []
	for (const [id, level] of Object.entries(progressionSkills || {})) {
		if ((Number(level) || 0) < 1) continue
		const found = catalog.find((s) => s && s.id === id)
		if (found) push(found)
	}
	return result
}

// ──────────────────────────── Item placement ────────────────────────────

const VALID_INDEXES = ['L', 'R', 'LR', 'U']

function refToId(ref) {
	if (!ref) return null
	if (typeof ref === 'string' || typeof ref === 'number') return String(ref)
	return ref.id ?? ref.itemId ?? ref.item?.id ?? null
}

/** Normalized slot/group refs from `equipSlot` (new) or legacy `slot`. */
export function getItemSlotRefs(def) {
	const raw = def?.equipSlot ?? def?.slot
	const list = Array.isArray(raw) ? raw : raw ? [raw] : []
	return list.filter((s) => typeof s === 'string' && s).map(normalizeSlotId)
}

/** Expands slot ids / group ids (`ring`, `hand`) into concrete slot ids. */
export function expandSlotRefs(refs) {
	const out = []
	for (const raw of Array.isArray(refs) ? refs : refs ? [refs] : []) {
		const id = normalizeSlotId(raw)
		const group = SLOT_GROUPS[id]
		if (group) out.push(...group.slots)
		else if (ALL_SLOT_IDS.includes(id)) out.push(id)
	}
	return [...new Set(out)]
}

/**
 * Describes where an item may go.
 * @param {Object} def item definition
 * @returns {{ group: string, candidates: string[], index: 'L'|'R'|'LR'|'U'|null,
 *   pair: boolean, twoHanded: boolean, blocks: string[] } | null}
 */
export function resolveItemPlacement(def) {
	const refs = getItemSlotRefs(def)
	if (!refs.length) return null

	const declaredIndex = VALID_INDEXES.includes(def.equipIndex) ? def.equipIndex : null
	const candidates = []
	let groupId = null
	let index = null

	for (const ref of refs) {
		const group = SLOT_GROUPS[ref]
		if (group) {
			groupId = groupId || group.id
			if (group.kind === 'single') {
				candidates.push(...group.slots)
				continue
			}
			let idx = declaredIndex || 'U'
			if (group.id === RING_GROUP) idx = 'U'
			index = idx
			if (idx === 'L') candidates.push(group.slots[0])
			else if (idx === 'R') candidates.push(group.slots[1])
			else if (idx === 'LR') candidates.push(...group.slots.slice(0, 2))
			else candidates.push(...group.slots)
		} else if (ALL_SLOT_IDS.includes(ref)) {
			const gid = SLOT_TO_GROUP[ref]
			groupId = groupId || gid
			candidates.push(ref)
			const g = SLOT_GROUPS[gid]
			if (g.kind === 'sided') index = g.slots.indexOf(ref) === 0 ? 'L' : 'R'
		}
	}

	const unique = [...new Set(candidates)]
	if (!unique.length) return null
	if (refs.length > 1 && unique.length > 1) index = 'U'

	return {
		group: groupId,
		candidates: unique,
		index,
		pair: index === 'LR' && unique.length === 2,
		twoHanded: def.isTwoHanded === true || def.is_two_handed === true,
		blocks: expandSlotRefs(def.blocksSlots)
	}
}

/** Effective one-handed grip penalty of an item. */
export function getOneHandedDebuff(def) {
	const d = def?.oneHandedDebuff
	return d && typeof d === 'object' && Object.keys(d).length ? d : { ...DEFAULT_ONE_HANDED_DEBUFF }
}

const DEBUFF_STAT_LABELS = {
	p_atk: 'физ. атаки',
	m_atk: 'маг. атаки',
	p_def: 'физ. защиты',
	m_def: 'маг. защиты'
}

/** Human text for the popup, e.g. "−20% физ. атаки". */
export function describeOneHandedDebuff(def) {
	return Object.entries(getOneHandedDebuff(def))
		.filter(([k]) => k.endsWith('_mult'))
		.map(([k, v]) => {
			const stat = k.slice(0, -5)
			const pct = Math.round(Number(v) * 100)
			return `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% ${DEBUFF_STAT_LABELS[stat] || stat}`
		})
		.join(', ')
}

// ──────────────────────────── State helpers ────────────────────────────

function ensureStateObjects(character) {
	if (!character.equipment_slots || typeof character.equipment_slots !== 'object') {
		character.equipment_slots = {}
	}
	if (!character.equipment_meta || typeof character.equipment_meta !== 'object') {
		character.equipment_meta = {}
	}
}

/** Guarantees every catalog slot key exists in `equipment_slots` (null when empty). */
export function ensureEquipmentSlots(character) {
	if (!character) return false
	ensureStateObjects(character)
	let changed = false
	for (const slot of ALL_SLOT_IDS) {
		if (!(slot in character.equipment_slots)) {
			character.equipment_slots[slot] = null
			changed = true
		}
	}
	return changed
}

/**
 * Equipped items (primary slots only) with meta.
 * @returns {Array<{ slot: string, itemId: string, def: Object|null, spans: string[],
 *   grip: string|null, debuffActive: boolean }>}
 */
export function getEquippedEntries(character, itemsData = {}) {
	const entries = []
	const slots = character?.equipment_slots || {}
	const meta = character?.equipment_meta || {}
	for (const [rawSlot, ref] of Object.entries(slots)) {
		const itemId = refToId(ref)
		if (!itemId) continue
		const slot = normalizeSlotId(rawSlot)
		if (!ALL_SLOT_IDS.includes(slot)) continue
		const m = meta[slot] || {}
		entries.push({
			slot,
			itemId,
			def: itemsData?.[itemId] || null,
			spans: Array.isArray(m.spans) ? m.spans : [],
			grip: m.grip || null,
			debuffActive: m.debuffActive === true
		})
	}
	return entries
}

/** Slots this equipped entry blocks (from `blocksSlots` and two-handed grip). */
export function getEntryBlocks(entry) {
	const placement = entry.def ? resolveItemPlacement(entry.def) : null
	const blocks = new Set(placement?.blocks || [])
	if (placement?.twoHanded && entry.grip !== 'one') {
		blocks.add(entry.slot === HAND_LEFT ? HAND_RIGHT : HAND_LEFT)
	}
	for (const s of [entry.slot, ...entry.spans]) blocks.delete(s)
	return [...blocks]
}

function findEntryAt(entries, slot) {
	return entries.find((e) => e.slot === slot || e.spans.includes(slot)) || null
}

/**
 * Derived status of every slot.
 * @returns {Record<string, { slot: string, status: 'empty'|'occupied'|'blocked'|'locked',
 *   itemId: string|null, primarySlot: string|null, mirrorOf: string|null,
 *   blockedBy: string|null, blockedBySlot: string|null, lockedReason: string|null, conflict: boolean }>}
 */
export function getSlotStates(character, itemsData = {}, learnedSkills = []) {
	const states = {}
	for (const slot of ALL_SLOT_IDS) {
		states[slot] = {
			slot,
			status: 'empty',
			itemId: null,
			primarySlot: null,
			mirrorOf: null,
			blockedBy: null,
			blockedBySlot: null,
			lockedReason: null,
			conflict: false
		}
	}

	const limit = getRingSlotLimit(learnedSkills)
	SLOT_GROUPS[RING_GROUP].slots.forEach((slot, i) => {
		if (i >= limit) {
			states[slot].status = 'locked'
			states[slot].lockedReason = 'Нужен навык для дополнительных колец'
		}
	})

	const entries = getEquippedEntries(character, itemsData)
	for (const e of entries) {
		const st = states[e.slot]
		st.itemId = e.itemId
		st.primarySlot = e.slot
		if (st.status !== 'locked') st.status = 'occupied'
		for (const span of e.spans) {
			const s = states[span]
			if (!s) continue
			s.itemId = e.itemId
			s.primarySlot = e.slot
			s.mirrorOf = e.slot
			if (s.status !== 'locked') s.status = 'occupied'
		}
	}
	for (const e of entries) {
		for (const b of getEntryBlocks(e)) {
			const s = states[b]
			if (!s) continue
			if (s.status === 'empty') {
				s.status = 'blocked'
				s.blockedBy = e.itemId
				s.blockedBySlot = e.slot
			} else if (s.status === 'occupied' && s.itemId !== e.itemId) {
				s.conflict = true
			}
		}
	}
	return states
}

function itemName(itemsData, id) {
	const def = itemsData?.[id]
	return def?.name || def?.id || id
}

function canRemoveItem(def) {
	return def?.can_equip !== false && def?.equippable !== false && def?.can_unequip !== false
}

// ──────────────────────────── Planning ────────────────────────────

/**
 * Pure planner for equipping an item. Does not mutate anything.
 *
 * @param {Object} params
 * @param {Object} params.character
 * @param {Object} params.itemsData id -> definition
 * @param {Array<Object>} [params.learnedSkills]
 * @param {string} params.itemId
 * @param {string|null} [params.slot] target slot (null = auto)
 * @param {boolean} [params.pair] for `LR` items: occupy both slots (default true)
 * @param {boolean} [params.oneHandedGrip] for two-handed items: hold in one hand
 * @returns {Object} `{ ok:false, error, message }` or `{ ok:true, primary, spans, grip, debuffActive,
 *   removes, needsConfirm, options }`
 */
export function planEquip({
	character,
	itemsData = {},
	learnedSkills = [],
	itemId,
	slot = null,
	pair,
	oneHandedGrip = false
}) {
	const fail = (error, message) => ({ ok: false, error, message })

	const def = itemsData?.[itemId]
	if (!def) return fail('no_item', 'Предмет не найден')
	const placement = resolveItemPlacement(def)
	if (!placement) return fail('not_equippable', 'Предмет нельзя экипировать')

	const states = getSlotStates(character, itemsData, learnedSkills)
	const entries = getEquippedEntries(character, itemsData)
	const name = itemName(itemsData, itemId)
	const isLocked = (s) => states[s]?.status === 'locked'

	// 1. Target slot + index validation (L item cannot go to R, etc.)
	let target = slot ? normalizeSlotId(slot) : null
	if (target && !ALL_SLOT_IDS.includes(target) && SLOT_GROUPS[target]) target = null
	if (target && !placement.candidates.includes(target)) {
		return fail('wrong_slot', `«${name}» нельзя надеть в слот «${getSlotLabel(target)}»`)
	}
	if (target && isLocked(target)) {
		return fail('locked', `Слот «${getSlotLabel(target)}» закрыт: ${states[target].lockedReason}`)
	}
	if (!target) {
		const open = placement.candidates.filter((s) => !isLocked(s))
		target =
			open.find((s) => states[s].status === 'empty') ||
			open.find((s) => states[s].status === 'blocked') ||
			open[0] ||
			null
		if (!target) return fail('locked', `Нет доступных слотов для «${name}»`)
	}

	// 2. Occupancy mode: pair / two-handed / one-handed grip
	const groupSlots = SLOT_GROUPS[placement.group]?.slots || []
	const canPair =
		placement.pair && placement.candidates.length === 2 && placement.candidates.every((s) => !isLocked(s))
	const wantPair = canPair ? pair !== false : false

	const isTwoHandedHand = placement.twoHanded && placement.group === 'hand'
	const canOneGrip = isTwoHandedHand && canUseOneHandedGrip(learnedSkills)
	if (oneHandedGrip && isTwoHandedHand && !canOneGrip) {
		return fail('no_skill', 'Нет навыка хвата двуручного оружия одной рукой')
	}
	const useGrip = oneHandedGrip && canOneGrip

	let primary = target
	let spans = []
	let grip = null
	if (wantPair) {
		primary = placement.candidates[0]
		spans = [placement.candidates[1]]
	} else if (isTwoHandedHand) {
		if (useGrip) {
			grip = 'one'
			if (!groupSlots.includes(target)) return fail('wrong_slot', 'Нельзя взять в эту руку')
		} else {
			primary = HAND_RIGHT
		}
	}

	const claim = [primary, ...spans]
	const blocks = new Set(placement.blocks)
	if (isTwoHandedHand && !useGrip) blocks.add(primary === HAND_LEFT ? HAND_RIGHT : HAND_LEFT)
	for (const c of claim) blocks.delete(c)

	// 3. Conflict resolution -> removes[]
	/** @type {Map<string, { slot: string, itemId: string, reason: string }>} */
	const removes = new Map()
	const addRemove = (entry, reason) => {
		if (!entry) return
		const prev = removes.get(entry.slot)
		if (!prev) removes.set(entry.slot, { slot: entry.slot, itemId: entry.itemId, reason })
		else if (prev.reason === 'replace' && reason !== 'replace') prev.reason = reason
	}

	for (const c of claim) {
		const occupant = findEntryAt(entries, c)
		if (occupant) {
			if (occupant.slot === primary && occupant.itemId === itemId && !wantPair && !grip) {
				return fail('already_equipped', 'Уже надето')
			}
			addRemove(occupant, c === primary && occupant.slot === primary ? 'replace' : 'span')
		}
		for (const e of entries) {
			if (e.slot === primary) continue
			if (getEntryBlocks(e).includes(c)) addRemove(e, 'blocked')
		}
	}
	for (const b of blocks) {
		addRemove(findEntryAt(entries, b), 'blocks')
	}

	for (const r of removes.values()) {
		const rd = itemsData?.[r.itemId]
		if (!canRemoveItem(rd)) {
			return fail('cannot_unequip', `«${itemName(itemsData, r.itemId)}» нельзя снять`)
		}
	}

	const list = [...removes.values()]
	return {
		ok: true,
		itemId,
		primary,
		spans,
		grip,
		debuffActive: grip === 'one',
		removes: list,
		needsConfirm: list.some((r) => r.reason !== 'replace'),
		options: {
			canPair,
			pairDefault: true,
			canOneGrip,
			oneGripDefault: false
		}
	}
}

// ──────────────────────────── Mutations ────────────────────────────

/** Primary slot for any occupied slot id (resolves mirror slots). */
export function resolvePrimarySlot(character, slot) {
	const s = normalizeSlotId(slot)
	if (character?.equipment_slots?.[s]) return s
	for (const [primary, m] of Object.entries(character?.equipment_meta || {})) {
		if (Array.isArray(m?.spans) && m.spans.includes(s) && character.equipment_slots?.[primary]) {
			return primary
		}
	}
	return null
}

/**
 * Clears the item at `slot` (primary or mirror). Does NOT touch inventory.
 * @returns {{ itemId: string, slot: string } | null}
 */
export function unequipSlot(character, slot) {
	if (!character) return null
	ensureStateObjects(character)
	const primary = resolvePrimarySlot(character, slot)
	if (!primary) return null
	const itemId = refToId(character.equipment_slots[primary])
	character.equipment_slots[primary] = null
	delete character.equipment_meta[primary]
	return { itemId, slot: primary }
}

/**
 * Applies a successful plan: clears removed items, writes the item and meta.
 * @returns {{ removed: Array<{ itemId: string, slot: string, reason: string }> }}
 */
export function applyEquipPlan(character, plan) {
	ensureStateObjects(character)
	const removed = []
	for (const r of plan.removes) {
		const res = unequipSlot(character, r.slot)
		if (res) removed.push({ ...res, reason: r.reason })
	}
	character.equipment_slots[plan.primary] = plan.itemId
	if (plan.spans.length || plan.grip) {
		character.equipment_meta[plan.primary] = {
			spans: [...plan.spans],
			grip: plan.grip,
			debuffActive: plan.debuffActive === true
		}
	} else {
		delete character.equipment_meta[plan.primary]
	}
	return { removed }
}

/**
 * Convenience wrapper: plan + apply for a weapon. `isOneHandedGrip` requires the grip skill.
 * @returns {Object} plan result (with `removed` when applied)
 */
export function equipWeapon(character, itemsData, learnedSkills, itemId, isOneHandedGrip = false, slot = null) {
	const plan = planEquip({
		character,
		itemsData,
		learnedSkills,
		itemId,
		slot,
		oneHandedGrip: isOneHandedGrip
	})
	if (!plan.ok) return plan
	return { ...plan, ...applyEquipPlan(character, plan) }
}

// ──────────────────────────── Inventory helpers ────────────────────────────

/** Returns an item to inventory (stackable by default, matching legacy behavior). */
export function addItemToInventory(character, itemId, itemsData = {}) {
	if (!character || !itemId) return
	if (!character.inventory) character.inventory = { items: [] }
	if (!Array.isArray(character.inventory.items)) character.inventory.items = []
	const items = character.inventory.items
	const stackable = itemsData?.[itemId]?.stackable !== false
	if (stackable) {
		const existing = items.find((i) => i && i.itemId === itemId)
		if (existing) {
			existing.quantity = (existing.quantity ?? 1) + 1
			return
		}
	}
	items.push({ itemId, quantity: 1 })
}

// ──────────────────────────── Reconciliation ────────────────────────────

/**
 * Re-validates the equipment against current skills / blocks. Call after any skill change,
 * after loading a save, and after equip operations.
 * - rings in locked slots return to inventory;
 * - one-handed grip without the skill returns the weapon to inventory;
 * - items sitting in a blocked slot are removed (the blocker wins);
 * - dangling meta is cleaned.
 *
 * @returns {{ changed: boolean, removed: Array<{ itemId: string, slot: string, reason: string }> }}
 */
export function reconcileEquipment(character, itemsData = {}, learnedSkills = []) {
	const removed = []
	if (!character) return { changed: false, removed }
	ensureStateObjects(character)
	let changed = ensureEquipmentSlots(character)

	const drop = (slot, reason) => {
		const res = unequipSlot(character, slot)
		if (res) {
			removed.push({ ...res, reason })
			changed = true
		}
	}

	// rings beyond the unlocked limit
	const limit = getRingSlotLimit(learnedSkills)
	SLOT_GROUPS[RING_GROUP].slots.forEach((slot, i) => {
		if (i >= limit && character.equipment_slots[slot]) drop(slot, 'locked')
	})

	// one-handed grip without the skill
	if (!canUseOneHandedGrip(learnedSkills)) {
		for (const e of getEquippedEntries(character, itemsData)) {
			if (e.grip === 'one') drop(e.slot, 'no_skill')
		}
	}

	// occupant of a blocked slot loses (iterate to a stable state)
	for (let pass = 0; pass < 5; pass++) {
		let again = false
		const entries = getEquippedEntries(character, itemsData)
		for (const blocker of entries) {
			for (const b of getEntryBlocks(blocker)) {
				const occupant = findEntryAt(entries, b)
				if (occupant && occupant.slot !== blocker.slot) {
					drop(occupant.slot, 'blocked')
					again = true
					break
				}
			}
			if (again) break
		}
		if (!again) break
	}

	// meta hygiene
	for (const key of Object.keys(character.equipment_meta)) {
		if (!character.equipment_slots[key]) {
			delete character.equipment_meta[key]
			changed = true
			continue
		}
		const m = character.equipment_meta[key]
		const wantDebuff = m.grip === 'one'
		if (m.debuffActive !== wantDebuff) {
			m.debuffActive = wantDebuff
			changed = true
		}
		const entries = getEquippedEntries(character, itemsData)
		const cleaned = (m.spans || []).filter((s) => {
			const other = findEntryAt(entries, s)
			return !other || other.slot === key
		})
		if (cleaned.length !== (m.spans || []).length) {
			m.spans = cleaned
			changed = true
		}
	}

	return { changed, removed }
}

// ──────────────────────────── Legacy migration ────────────────────────────

/**
 * Renames legacy slot keys (`torso-1`, `weapon-hand-1`, …) to the new catalog.
 * A legacy key present in `equipment_slots` is treated as a fresh write (stories may set it after
 * a previous migration): a non-null value wins, null clears the target. Displaced items go to
 * the inventory.
 *
 * @returns {boolean} true if anything changed
 */
export function migrateLegacyEquipment(character, itemsData = {}) {
	const slots = character?.equipment_slots
	if (!slots || typeof slots !== 'object') return false

	const legacyKeys = Object.keys(slots).filter(
		(k) => LEGACY_SLOT_ALIASES[k] && !ALL_SLOT_IDS.includes(k)
	)
	if (!legacyKeys.length) return false

	const byTarget = new Map()
	for (const key of legacyKeys) {
		const alias = LEGACY_SLOT_ALIASES[key]
		const group = SLOT_GROUPS[alias]
		let targetSlot = alias
		if (group) {
			const free = group.slots.find((s) => !slots[s])
			targetSlot = free || group.slots[0]
		}
		if (!byTarget.has(targetSlot)) byTarget.set(targetSlot, [])
		byTarget.get(targetSlot).push({ key, value: refToId(slots[key]) })
	}

	if (!character.equipment_meta) character.equipment_meta = {}
	for (const [target, writes] of byTarget) {
		const real = writes.filter((w) => w.value)
		if (real.length) {
			const [winner, ...rest] = real
			const prev = refToId(slots[target])
			if (prev && prev !== winner.value) {
				addItemToInventory(character, prev, itemsData)
				delete character.equipment_meta[target]
			}
			slots[target] = winner.value
			for (const extra of rest) addItemToInventory(character, extra.value, itemsData)
		} else {
			slots[target] = null
			delete character.equipment_meta[target]
		}
	}
	for (const key of legacyKeys) delete slots[key]
	return true
}

// ──────────────────────────── Stats integration ────────────────────────────

/**
 * Equipped item definitions for `calculateCharacterStats({ equipmentItems })`.
 * Each item carries `debuffActive` so the stats pipeline can cut one-handed-grip weapons.
 */
export function buildEquipmentItemsForStats(character, itemsData = {}) {
	return getEquippedEntries(character, itemsData)
		.filter((e) => e.def)
		.map((e) => ({
			...e.def,
			id: e.itemId,
			equippedSlot: e.slot,
			debuffActive: e.debuffActive
		}))
}
