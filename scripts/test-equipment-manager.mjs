/**
 * Node tests for the Advanced Equipment Manager (pure logic).
 * Run: node scripts/test-equipment-manager.mjs
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', 'src', 'renderer')
const load = (p) => import(pathToFileURL(path.join(root, p)).href)

const slotsMod = await load('constants/equipmentSlots.js')
const mgr = await load('utils/equipmentManager.js')
const stats = await load('utils/stats/characterStats.js')

const { ALL_SLOT_IDS, SLOT_GROUP_LIST } = slotsMod

let passed = 0
function test(name, fn) {
	try {
		fn()
		passed++
		console.log(`  ok  ${name}`)
	} catch (err) {
		console.error(`FAIL  ${name}\n${err.stack}`)
		process.exitCode = 1
	}
}

const items = {
	swimsuit: { id: 'swimsuit', name: 'Сплошной купальник', equipSlot: 'top_underwear', blocksSlots: ['bottom_underwear'] },
	pants: { id: 'pants', name: 'Трусы', slot: 'underpants' },
	tshirt: { id: 'tshirt', slot: 'torso-1' },
	ring: { id: 'ring', name: 'Кольцо', equipSlot: 'ring', equipIndex: 'U', stackable: false },
	ring2: { id: 'ring2', name: 'Кольцо 2', equipSlot: 'ring', equipIndex: 'U', stackable: false },
	lglove: { id: 'lglove', name: 'Левая', equipSlot: 'glove', equipIndex: 'L' },
	gloves: { id: 'gloves', name: 'Перчатки', equipSlot: 'glove', equipIndex: 'LR' },
	sword: { id: 'sword', name: 'Меч', slot: ['weapon-hand-1', 'weapon-hand-2'], stats: { attack: 5 } },
	greatsword: {
		id: 'greatsword',
		name: 'Двуручник',
		equipSlot: 'hand',
		equipIndex: 'U',
		isTwoHanded: true,
		stats: { attack: 10, hp: 4 }
	},
	cursed: { id: 'cursed', slot: 'neck', can_unequip: false },
	necklace: { id: 'necklace', slot: 'neck_1' },
	choker: { id: 'choker', equipSlot: 'neck', blocksSlots: ['mask'] },
	mask: { id: 'mask', slot: 'mask' }
}
const mkChar = (slots = {}, meta = {}) => ({
	equipment_slots: { ...slots },
	equipment_meta: { ...meta },
	inventory: { items: [] }
})
const GRIP = [{ id: 'g', data: { two_handed_one_grip: true } }]
const RINGS8 = [{ id: 'r', data: { ring_slots_bonus: 8 } }]

console.log('Slot catalog')
test('38 concrete slots in 22 groups', () => {
	assert.equal(ALL_SLOT_IDS.length, 38)
	assert.equal(SLOT_GROUP_LIST.length, 22)
	assert.equal(new Set(ALL_SLOT_IDS).size, 38)
})
test('legacy aliases are resolved', () => {
	assert.equal(slotsMod.normalizeSlotId('torso-1'), 'top_mid')
	assert.equal(slotsMod.normalizeSlotId('weapon-hand-1'), 'hand_R')
	assert.equal(slotsMod.normalizeSlotId('head'), 'head')
})

console.log('Placement and indexes')
test('legacy weapon slot array becomes universal hand item', () => {
	const p = mgr.resolveItemPlacement(items.sword)
	assert.deepEqual(p.candidates.sort(), ['hand_L', 'hand_R'])
	assert.equal(p.index, 'U')
})
test('L item cannot go to R slot', () => {
	const plan = mgr.planEquip({ character: mkChar(), itemsData: items, itemId: 'lglove', slot: 'glove_R' })
	assert.equal(plan.ok, false)
	assert.equal(plan.error, 'wrong_slot')
	assert.equal(mgr.planEquip({ character: mkChar(), itemsData: items, itemId: 'lglove', slot: 'glove_L' }).ok, true)
})
test('U item takes exactly one slot', () => {
	const c = mkChar()
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'sword' })
	assert.equal(plan.primary, 'hand_R')
	assert.deepEqual(plan.spans, [])
})

console.log('Blocking')
test('swimsuit occupies top and BLOCKS bottom underwear', () => {
	const c = mkChar({ top_underwear: 'swimsuit' })
	const st = mgr.getSlotStates(c, items)
	assert.equal(st.top_underwear.status, 'occupied')
	assert.equal(st.bottom_underwear.status, 'blocked')
	assert.equal(st.bottom_underwear.blockedBy, 'swimsuit')
})
test('equipping pants under swimsuit asks to remove the swimsuit', () => {
	const c = mkChar({ top_underwear: 'swimsuit' })
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'pants', slot: 'bottom_underwear' })
	assert.equal(plan.ok, true)
	assert.equal(plan.needsConfirm, true)
	assert.deepEqual(plan.removes.map((r) => [r.itemId, r.reason]), [['swimsuit', 'blocked']])
	const { removed } = mgr.applyEquipPlan(c, plan)
	assert.equal(removed[0].itemId, 'swimsuit')
	assert.equal(c.equipment_slots.top_underwear, null)
	assert.equal(c.equipment_slots.bottom_underwear, 'pants')
})
test('equipping swimsuit removes occupied pants', () => {
	const c = mkChar({ bottom_underwear: 'pants' })
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'swimsuit' })
	assert.deepEqual(plan.removes.map((r) => [r.itemId, r.reason]), [['pants', 'blocks']])
	assert.equal(plan.needsConfirm, true)
})
test('plain replace in the same slot needs no confirmation', () => {
	const c = mkChar({ top_mid: 'tshirt' })
	const items2 = { ...items, shirt2: { id: 'shirt2', equipSlot: 'top_mid' } }
	const plan = mgr.planEquip({ character: c, itemsData: items2, itemId: 'shirt2' })
	assert.equal(plan.needsConfirm, false)
	assert.equal(plan.removes[0].reason, 'replace')
})
test('item that cannot be unequipped blocks the plan', () => {
	const c = mkChar({ neck: 'cursed' })
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'necklace' })
	assert.equal(plan.ok, false)
	assert.equal(plan.error, 'cannot_unequip')
})
test('item blocking an occupied slot removes its occupant', () => {
	const c = mkChar({ mask: 'mask' })
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'choker' })
	assert.deepEqual(plan.removes.map((r) => r.itemId), ['mask'])
})

console.log('Rings')
test('only ring_1 and ring_2 are unlocked by default', () => {
	const st = mgr.getSlotStates(mkChar(), items, [])
	assert.equal(st.ring_2.status, 'empty')
	assert.equal(st.ring_3.status, 'locked')
	assert.equal(st.ring_10.status, 'locked')
})
test('auto slot picks first free ring; locked slot is refused', () => {
	const c = mkChar({ ring_1: 'ring' })
	assert.equal(mgr.planEquip({ character: c, itemsData: items, itemId: 'ring2' }).primary, 'ring_2')
	const refused = mgr.planEquip({ character: c, itemsData: items, itemId: 'ring2', slot: 'ring_5' })
	assert.equal(refused.error, 'locked')
	assert.equal(mgr.planEquip({ character: c, itemsData: items, itemId: 'ring2', slot: 'ring_5' }, RINGS8).ok, false)
	assert.equal(
		mgr.planEquip({ character: c, itemsData: items, itemId: 'ring2', slot: 'ring_5', learnedSkills: RINGS8 }).ok,
		true
	)
})
test('ring limit math', () => {
	assert.equal(mgr.getRingSlotLimit([]), 2)
	assert.equal(mgr.getRingSlotLimit(RINGS8), 10)
	assert.equal(mgr.getRingSlotLimit([{ id: 'x', data: { ring_slots_bonus: 99 } }]), 10)
})
test('losing the ring skill ejects rings from closed slots', () => {
	const c = mkChar({ ring_1: 'ring', ring_2: 'ring', ring_5: 'ring2', ring_10: 'ring2' })
	assert.equal(mgr.reconcileEquipment(c, items, RINGS8).removed.length, 0)
	const res = mgr.reconcileEquipment(c, items, [])
	assert.deepEqual(res.removed.map((r) => r.slot).sort(), ['ring_10', 'ring_5'])
	assert.equal(c.equipment_slots.ring_5, null)
	assert.equal(c.equipment_slots.ring_1, 'ring')
})

console.log('Pairs (LR)')
test('LR item takes both slots by default', () => {
	const c = mkChar()
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'gloves', slot: 'glove_R' })
	assert.equal(plan.options.canPair, true)
	assert.equal(plan.primary, 'glove_L')
	assert.deepEqual(plan.spans, ['glove_R'])
	mgr.applyEquipPlan(c, plan)
	const st = mgr.getSlotStates(c, items)
	assert.equal(st.glove_L.status, 'occupied')
	assert.equal(st.glove_R.status, 'occupied')
	assert.equal(st.glove_R.mirrorOf, 'glove_L')
	// item is stored once
	assert.equal(Object.values(c.equipment_slots).filter((v) => v === 'gloves').length, 1)
})
test('LR item with pair:false occupies only the dropped slot', () => {
	const c = mkChar()
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'gloves', slot: 'glove_R', pair: false })
	assert.equal(plan.primary, 'glove_R')
	assert.deepEqual(plan.spans, [])
})
test('unequipping through the mirror slot clears the pair', () => {
	const c = mkChar({ glove_L: 'gloves' }, { glove_L: { spans: ['glove_R'], grip: null, debuffActive: false } })
	const res = mgr.unequipSlot(c, 'glove_R')
	assert.equal(res.itemId, 'gloves')
	assert.equal(c.equipment_slots.glove_L, null)
	assert.equal(c.equipment_meta.glove_L, undefined)
})
test('pair replaces an item sitting in the second slot (needs confirm)', () => {
	const c = mkChar({ glove_R: 'lglove' })
	const items2 = { ...items, rglove: { id: 'rglove', equipSlot: 'glove', equipIndex: 'R' } }
	c.equipment_slots.glove_R = 'rglove'
	const plan = mgr.planEquip({ character: c, itemsData: items2, itemId: 'gloves', slot: 'glove_L' })
	assert.deepEqual(plan.removes.map((r) => [r.itemId, r.reason]), [['rglove', 'span']])
	assert.equal(plan.needsConfirm, true)
})

console.log('Two-handed and grip')
test('two-handed takes hand_R and blocks hand_L', () => {
	const c = mkChar({ hand_L: 'sword' })
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'greatsword', slot: 'hand_L' })
	assert.equal(plan.primary, 'hand_R')
	assert.equal(plan.options.canOneGrip, false)
	assert.deepEqual(plan.removes.map((r) => [r.itemId, r.reason]), [['sword', 'blocks']])
	mgr.applyEquipPlan(c, plan)
	const st = mgr.getSlotStates(c, items)
	assert.equal(st.hand_R.status, 'occupied')
	assert.equal(st.hand_L.status, 'blocked')
})
test('one-handed grip needs the skill', () => {
	const c = mkChar()
	const plan = mgr.planEquip({ character: c, itemsData: items, itemId: 'greatsword', slot: 'hand_L', oneHandedGrip: true })
	assert.equal(plan.error, 'no_skill')
})
test('one-handed grip: single slot, no block, debuffActive flag', () => {
	const c = mkChar({ hand_R: 'sword' })
	const plan = mgr.planEquip({
		character: c,
		itemsData: items,
		learnedSkills: GRIP,
		itemId: 'greatsword',
		slot: 'hand_L',
		oneHandedGrip: true
	})
	assert.equal(plan.ok, true)
	assert.equal(plan.options.canOneGrip, true)
	assert.equal(plan.primary, 'hand_L')
	assert.equal(plan.debuffActive, true)
	assert.equal(plan.removes.length, 0)
	mgr.applyEquipPlan(c, plan)
	assert.equal(mgr.getSlotStates(c, items, GRIP).hand_R.status, 'occupied')
	const forStats = mgr.buildEquipmentItemsForStats(c, items).find((i) => i.id === 'greatsword')
	assert.equal(forStats.debuffActive, true)
})
test('equipWeapon wrapper', () => {
	const c = mkChar()
	const res = mgr.equipWeapon(c, items, GRIP, 'greatsword', true, 'hand_R')
	assert.equal(res.ok, true)
	assert.equal(c.equipment_meta.hand_R.grip, 'one')
})
test('losing the grip skill returns the weapon', () => {
	const c = mkChar({ hand_L: 'greatsword' }, { hand_L: { spans: [], grip: 'one', debuffActive: true } })
	assert.equal(mgr.reconcileEquipment(c, items, GRIP).removed.length, 0)
	const res = mgr.reconcileEquipment(c, items, [])
	assert.equal(res.removed[0].itemId, 'greatsword')
	assert.equal(c.equipment_slots.hand_L, null)
})
test('occupant of a blocked slot is ejected by reconcile', () => {
	const c = mkChar({ hand_R: 'greatsword', hand_L: 'sword' })
	const res = mgr.reconcileEquipment(c, items, [])
	assert.deepEqual(res.removed.map((r) => [r.itemId, r.reason]), [['sword', 'blocked']])
})

console.log('Stats debuff')
test('applyEquipmentDebuffs cuts weapon attack by 20% only when active', () => {
	const base = { ...items.greatsword, debuffActive: false }
	assert.equal(stats.applyEquipmentDebuffs(base), base)
	const cut = stats.applyEquipmentDebuffs({ ...items.greatsword, debuffActive: true })
	assert.equal(cut.stats.attack, 8)
	assert.equal(cut.stats.hp, 4)
	assert.equal(items.greatsword.stats.attack, 10)
})
test('custom oneHandedDebuff and percent stats', () => {
	const cut = stats.applyEquipmentDebuffs({
		stats: { attack: '50%', defense: 10 },
		oneHandedDebuff: { p_atk_mult: -0.5, p_def_mult: -0.1 },
		debuffActive: true
	})
	assert.equal(cut.stats.attack, '25%')
	assert.equal(cut.stats.defense, 9)
})
test('calculateCharacterStats uses the debuffed weapon', () => {
	const run = (active) =>
		stats.calculateCharacterStats({
			character: { lvl: 1 },
			equipmentItems: [{ ...items.greatsword, debuffActive: active }]
		})
	const full = run(false)
	const cut = run(true)
	const key = full.stats ? 'stats' : 'final'
	const get = (r) => (r.stats || r.final || r.finalStats || r).atk_phys
	assert.ok(get(full) > get(cut), `expected ${get(full)} > ${get(cut)} (${key})`)
})

console.log('Migration and hygiene')
test('legacy slots migrate to the new catalog', () => {
	const c = mkChar()
	c.equipment_slots = { 'torso-1': 'tshirt', 'legs-2': null, underpants: 'pants', 'weapon-hand-1': 'sword', head: null }
	assert.equal(mgr.migrateLegacyEquipment(c, items), true)
	assert.equal(c.equipment_slots.top_mid, 'tshirt')
	assert.equal(c.equipment_slots.bottom_underwear, 'pants')
	assert.equal(c.equipment_slots.hand_R, 'sword')
	assert.equal('torso-1' in c.equipment_slots, false)
	assert.equal(mgr.migrateLegacyEquipment(c, items), false)
})
test('a fresh legacy write overrides and returns the displaced item', () => {
	const c = mkChar({ top_mid: 'tshirt' })
	c.equipment_slots['torso-1'] = 'swimsuit'
	mgr.migrateLegacyEquipment(c, items)
	assert.equal(c.equipment_slots.top_mid, 'swimsuit')
	assert.equal(c.inventory.items[0].itemId, 'tshirt')
	c.equipment_slots['torso-1'] = null
	mgr.migrateLegacyEquipment(c, items)
	assert.equal(c.equipment_slots.top_mid, null)
})
test('ensureEquipmentSlots fills all slots', () => {
	const c = { equipment_slots: { head: 'x' } }
	mgr.ensureEquipmentSlots(c)
	assert.equal(Object.keys(c.equipment_slots).length, 38)
	assert.equal(c.equipment_slots.head, 'x')
})
test('collectLearnedSkills merges talents and tree skills', () => {
	const skills = mgr.collectLearnedSkills({
		character: { talents: ['ring_bearer'] },
		talentsRegistry: [{ id: 'ring_bearer', data: { ring_slots_bonus: 8 } }],
		skillsCatalog: [{ id: 'sk1' }, { id: 'sk2' }],
		progressionSkills: { sk1: 1, sk2: 0, missing: 3 }
	})
	assert.deepEqual(skills.map((s) => s.id), ['ring_bearer', 'sk1'])
	assert.equal(mgr.getRingSlotLimit(skills), 10)
})
test('debuff description', () => {
	assert.equal(mgr.describeOneHandedDebuff({}), '−20% физ. атаки')
})

console.log(`\n${passed} passed${process.exitCode ? ', with failures' : ''}`)
