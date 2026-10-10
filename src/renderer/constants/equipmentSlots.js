/**
 * Equipment slot catalog for the Advanced Equipment Manager.
 * See docs/systems/AdvancedEquipmentManager.md
 */

/**
 * @typedef {'single'|'sided'|'numbered'} SlotGroupKind
 * @typedef {{ id: string, label: string, kind: SlotGroupKind, slots: string[] }} SlotGroup
 */

const sided = (id, label) => ({
	id,
	label,
	kind: 'sided',
	slots: [`${id}_L`, `${id}_R`]
})

const single = (id, label) => ({ id, label, kind: 'single', slots: [id] })

/** @type {SlotGroup[]} */
export const SLOT_GROUP_LIST = [
	single('head', 'Голова'),
	single('glasses', 'Очки'),
	single('mask', 'Маска'),
	{ id: 'ears', label: 'Уши', kind: 'numbered', slots: ['ears_1', 'ears_2'] },
	single('neck', 'Шея'),
	sided('shoulder', 'Плечо'),
	single('top_underwear', 'Верх (бельё)'),
	single('top_mid', 'Верх (одежда)'),
	single('top_outer', 'Верх (внешний)'),
	single('bottom_underwear', 'Низ (бельё)'),
	single('bottom_outer', 'Низ (внешний)'),
	sided('wrist', 'Запястье'),
	sided('glove', 'Перчатка'),
	{
		id: 'ring',
		label: 'Кольцо',
		kind: 'numbered',
		slots: Array.from({ length: 10 }, (_, i) => `ring_${i + 1}`)
	},
	sided('sock', 'Носок'),
	single('shoes', 'Обувь'),
	single('cloak', 'Плащ'),
	sided('leg', 'Нога'),
	single('misc', 'Разное'),
	sided('hand', 'Рука'),
	single('belt', 'Пояс'),
	single('back', 'Спина')
]

/** @type {Record<string, SlotGroup>} */
export const SLOT_GROUPS = Object.fromEntries(SLOT_GROUP_LIST.map((g) => [g.id, g]))

/** All concrete slot ids in catalog order. */
export const ALL_SLOT_IDS = SLOT_GROUP_LIST.flatMap((g) => g.slots)

/** Concrete slot id -> group id. */
export const SLOT_TO_GROUP = Object.fromEntries(
	SLOT_GROUP_LIST.flatMap((g) => g.slots.map((s) => [s, g.id]))
)

export const RING_GROUP = 'ring'
export const DEFAULT_RING_SLOTS = 2
export const MAX_RING_SLOTS = 10

export const HAND_LEFT = 'hand_L'
export const HAND_RIGHT = 'hand_R'

/** Default one-handed grip penalty when the item has no own `oneHandedDebuff`. */
export const DEFAULT_ONE_HANDED_DEBUFF = Object.freeze({ p_atk_mult: -0.2 })

/** Legacy slot ids (old data/story files) -> new slot or group id. */
export const LEGACY_SLOT_ALIASES = Object.freeze({
	'torso-1': 'top_mid',
	'torso-2': 'top_outer',
	'torso-3': 'cloak',
	legs: 'bottom_outer',
	'legs-2': 'bottom_outer',
	underpants: 'bottom_underwear',
	feet: 'shoes',
	neck_1: 'neck',
	'neck-1': 'neck',
	hands: 'glove',
	'weapon-hand-1': 'hand_R',
	'weapon-hand-2': 'hand_L',
	weapon_off: 'hand_L'
})

const SIDE_LABELS = { L: 'левое', R: 'правое' }
const SIDED_NAMES = {
	shoulder: ['левое плечо', 'правое плечо'],
	wrist: ['левое запястье', 'правое запястье'],
	glove: ['левая перчатка', 'правая перчатка'],
	sock: ['левый носок', 'правый носок'],
	leg: ['левая нога', 'правая нога'],
	hand: ['левая рука', 'правая рука']
}

/**
 * Human readable slot name (lowercase).
 * @param {string} slotId concrete slot, group or legacy id
 * @returns {string}
 */
export function getSlotLabel(slotId) {
	if (!slotId) return ''
	const id = normalizeSlotId(slotId)
	const group = SLOT_GROUPS[id]
	if (group) return group.label.toLowerCase()
	const groupId = SLOT_TO_GROUP[id]
	if (!groupId) return String(slotId)
	const g = SLOT_GROUPS[groupId]
	const idx = g.slots.indexOf(id)
	if (g.kind === 'sided') return SIDED_NAMES[groupId]?.[idx] || `${g.label} ${SIDE_LABELS[idx ? 'R' : 'L']}`
	if (g.kind === 'numbered') return `${g.label.toLowerCase()} ${idx + 1}`
	return g.label.toLowerCase()
}

/**
 * Short slot caption for empty paper-doll cells.
 * @param {string} slotId
 * @returns {string}
 */
export function getSlotShortLabel(slotId) {
	const groupId = SLOT_TO_GROUP[slotId]
	if (!groupId) return slotId
	const g = SLOT_GROUPS[groupId]
	const idx = g.slots.indexOf(slotId)
	if (g.kind === 'sided') return `${g.label} ${idx ? 'R' : 'L'}`
	if (g.kind === 'numbered') return `${g.label} ${idx + 1}`
	return g.label
}

/**
 * Resolves legacy aliases. Unknown ids are returned unchanged.
 * @param {string} slotId
 * @returns {string}
 */
export function normalizeSlotId(slotId) {
	if (typeof slotId !== 'string') return slotId
	return LEGACY_SLOT_ALIASES[slotId] || slotId
}

/** Paper-doll zones. Pairs start on even indices so L/R sit side by side in a 4-column grid. */
export const SLOT_ZONES = [
	{ id: 'head', label: 'Голова', slots: ['head', 'glasses', 'mask', 'neck', 'ears_1', 'ears_2'] },
	{ id: 'torso', label: 'Торс', slots: ['top_underwear', 'top_mid', 'top_outer', 'cloak', 'back', 'belt'] },
	{
		id: 'arms',
		label: 'Руки',
		slots: ['shoulder_L', 'shoulder_R', 'wrist_L', 'wrist_R', 'glove_L', 'glove_R', 'hand_L', 'hand_R']
	},
	{
		id: 'legs',
		label: 'Ноги',
		slots: ['bottom_underwear', 'bottom_outer', 'leg_L', 'leg_R', 'sock_L', 'sock_R', 'shoes', 'misc']
	},
	{ id: 'rings', label: 'Кольца', slots: SLOT_GROUPS.ring.slots }
]
