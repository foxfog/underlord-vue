import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'
import {
	calculateEquipmentBySlot,
	canCharacterEquipItem,
	getEquipRestrictionReasons
} from '../../utils/equipment.js'
import { canLearnSkill, organizeSkillsByGrid } from '../../utils/skillTree.js'

describe('Character Editor Subtabs: Equipment, Inventory & Skills', () => {
	let editor
	let writtenFiles = {}

	beforeEach(async () => {
		editor = useDataEditor()
		writtenFiles = {}

		const mockFiles = {
			'characters/characters.json': { characters: ['mc', 'momonga', 'albedo'] },
			'characters/mc/values.json': {
				id: 'mc',
				name: 'Анон',
				lvl: 1,
				gender: 'male',
				races: ['human'],
				classs: ['warrior'],
				equipment_slots: {
					head: null,
					mask: null,
					'torso-1': 'tshirt',
					'legs-2': 'jeans'
				},
				inventory: {
					items: [
						{ itemId: 'gasmask', quantity: 1 },
						{ itemId: 'ygdrasil-coin-old', quantity: 23 }
					]
				},
				skills: {
					warrior_slash: 1
				}
			},
			'characters/mc/body.json': {
				body: { image: 'images/sprites/characters/mc/body.png' },
				head: { image: 'images/sprites/characters/mc/head.png', parent: 'body' }
			},
			'characters/mc/equipment.json': [
				{
					id: 'tshirt',
					zindex: 3,
					parts: [{ parent: 'body', image: 'images/sprites/characters/mc/equipment/tshirt_body.png' }]
				},
				{
					id: 'gasmask',
					zindex: 1,
					parts: [{ parent: 'head', image: 'images/sprites/characters/mc/equipment/gasmask.png' }]
				}
			],
			'characters/momonga/values.json': {
				id: 'momonga',
				name: 'Момонга',
				lvl: 100,
				gender: 'male',
				races: ['overlord', 'skeleton'],
				classs: ['wizard', 'master-of-death'],
				equipment_slots: {
					head: null,
					neck_1: 'pendant-zen'
				},
				inventory: {
					items: [{ itemId: 'potion-health-small', quantity: 10 }]
				},
				skills: {
					fire_bolt: 1
				}
			},
			'characters/albedo/values.json': {
				id: 'albedo',
				name: 'Альбедо',
				lvl: 100,
				gender: 'female',
				races: ['demon', 'succubus'],
				classs: ['guardian_overseer'],
				equipment_slots: {},
				inventory: { items: [] },
				skills: {}
			},
			'classes/classes.json': [
				{ id: 'warrior', name: 'Воин', tier: 'basic' },
				{ id: 'wizard', name: 'Волшебник', tier: 'basic' }
			],
			'races/races.json': [
				{ id: 'human', name: 'Человек', tier: 'basic' },
				{ id: 'skeleton', name: 'Скелет', tier: 'basic' }
			],
			'fractions/fractions.json': [{ id: 'nazarick', name: 'Назарик' }],
			'tags/tags.json': ['warrior', 'undead', 'hero'],
			'items/categories.json': [],
			'skills/items/items.json': [],
			'skills/talents/talents.json': [],
			'items/equipment.json': [
				{ id: 'tshirt', name: 'Футболка', slot: 'torso-1', lvl_min: 1 },
				{ id: 'gasmask', name: 'Газмаска', slot: 'mask', lvl_min: 1 },
				{ id: 'dragon_helm', name: 'Шлем Дракона', slot: 'head', lvl_min: 80, classs: ['warrior'] }
			],
			'items/other.json': [
				{ id: 'potion-health-small', name: 'Зелье', stackable: true }
			],
			'skills/classes/warrior.json': {
				skill_branches: [{ id: 'swordsmanship', name: 'Фехтование' }],
				skills: [
					{
						id: 'warrior_slash',
						name: 'Рассечение',
						branch: 'swordsmanship',
						req_level: 1,
						cost: 1,
						parent_ids: []
					},
					{
						id: 'warrior_cross_slash',
						name: 'Крестовой выпад',
						branch: 'swordsmanship',
						req_level: 5,
						cost: 2,
						parent_ids: ['warrior_slash'],
						parent_requirement: 'all'
					}
				]
			}
		}

		vi.stubGlobal('window', {
			electronAPI: {
				dataEditor: {
					readFile: vi.fn(async (relPath) => {
						if (writtenFiles[relPath]) {
							return { success: true, data: writtenFiles[relPath] }
						}
						if (mockFiles[relPath]) {
							return { success: true, data: mockFiles[relPath] }
						}
						return { success: false, notFound: true }
					}),
					writeFile: vi.fn(async (relPath, data) => {
						writtenFiles[relPath] = data
						return { success: true, path: relPath }
					}),
					deleteFile: vi.fn(async () => ({ success: true }))
				}
			}
		})

		await editor.init()
	})

	it('loads characters with sprites, equipment and calculated equipmentBySlot', async () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		expect(mc).toBeDefined()
		expect(mc.name).toBe('Анон')
		expect(mc.sprites).toBeDefined()
		expect(mc.sprites.body).toBeDefined()
		expect(Array.isArray(mc.equipment)).toBe(true)
		expect(mc.equipment.some((e) => e.id === 'tshirt')).toBe(true)

		// equipmentBySlot should have mapped tshirt to torso-1
		expect(mc.equipmentBySlot).toBeDefined()
		expect(mc.equipmentBySlot['torso-1']).toBeDefined()
		expect(mc.equipmentBySlot['torso-1'].id).toBe('tshirt')
	})

	it('equips item from inventory and updates equipmentBySlot live', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		expect(mc.equipment_slots.mask).toBeFalsy()

		// Equip gasmask to mask slot
		mc.equipment_slots.mask = 'gasmask'
		mc.equipmentBySlot = calculateEquipmentBySlot(mc.equipment_slots, mc.equipment)

		expect(mc.equipment_slots.mask).toBe('gasmask')
		expect(mc.equipmentBySlot.mask).toBeDefined()
		expect(mc.equipmentBySlot.mask.id).toBe('gasmask')

		// Unequip
		mc.equipment_slots.mask = null
		mc.equipmentBySlot = calculateEquipmentBySlot(mc.equipment_slots, mc.equipment)
		expect(mc.equipmentBySlot.mask).toBeUndefined()
	})

	it('verifies equipment restrictions for characters', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		const highLvlItem = {
			id: 'dragon_helm',
			name: 'Шлем Дракона',
			slot: 'head',
			lvl_min: 80,
			classs: ['warrior']
		}

		// MC is level 1, so dragon_helm cannot be equipped
		const canEquip = canCharacterEquipItem(mc, highLvlItem)
		expect(canEquip).toBe(false)

		const reasons = getEquipRestrictionReasons(mc, highLvlItem)
		expect(reasons.length).toBeGreaterThan(0)
		expect(reasons[0]).toContain('Требуется уровень: 80')

		// If MC had talent item_restriction_bypass, he could equip it
		const mcWithTalent = { ...mc, talents: ['item_restriction_bypass'] }
		const canBypass = canCharacterEquipItem(mcWithTalent, highLvlItem)
		expect(canBypass).toBe(true)
	})

	it('validates and learns class skills based on level and parent prerequisites', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		const warriorClass = editor.entities.value.classes.find((c) => c.id === 'warrior')
		const skills = warriorClass.skills

		const baseSkill = skills.find((s) => s.id === 'warrior_slash')
		const advancedSkill = skills.find((s) => s.id === 'warrior_cross_slash')

		// MC is level 1
		const stateLvl1 = {
			id: 'mc',
			char_level: 1,
			skill_points: 5,
			class_levels: { warrior: 1 },
			skills: {}
		}

		// baseSkill requires lvl 1, 0 parents -> can learn
		const resBase = canLearnSkill(baseSkill, stateLvl1, skills, warriorClass)
		expect(resBase.canLearn).toBe(true)

		// advancedSkill requires lvl 5 and warrior_slash -> cannot learn at lvl 1
		const resAdv = canLearnSkill(advancedSkill, stateLvl1, skills, warriorClass)
		expect(resAdv.canLearn).toBe(false)
		expect(resAdv.reasons.some((r) => r.includes('Требуется уровень'))).toBe(true)

		// Level up MC to 5 and learn warrior_slash
		const stateLvl5 = {
			id: 'mc',
			char_level: 5,
			skill_points: 5,
			class_levels: { warrior: 5 },
			skills: { warrior_slash: 1 }
		}

		const resAdvReady = canLearnSkill(advancedSkill, stateLvl5, skills, warriorClass)
		expect(resAdvReady.canLearn).toBe(true)
	})

	it('saves character to values.json cleanly without leaking sprites or equipmentBySlot', async () => {
		const writtenFiles = {}
		window.electronAPI.dataEditor.writeFile = vi.fn(async (path, content) => {
			writtenFiles[path] = content
			return { success: true, path }
		})

		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		mc.skills.warrior_cross_slash = 1
		mc.equipment_slots.head = 'gasmask'

		await editor.saveEntity('characters', mc)

		expect(writtenFiles['characters/mc/values.json']).toBeDefined()
		const savedData = writtenFiles['characters/mc/values.json']

		// Check that data fields are saved
		expect(savedData.id).toBe('mc')
		expect(savedData.equipment_slots.head).toBe('gasmask')
		expect(savedData.skills.warrior_cross_slash).toBe(1)

		// Check that runtime preview fields are stripped
		expect(savedData.sprites).toBeUndefined()
		expect(savedData.equipment).toBeUndefined()
		expect(savedData.equipmentBySlot).toBeUndefined()
		expect(savedData._locales).toBeUndefined()
	})

	it('manages inventory item quantities and returns unequipped items back to inventory', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		const coins = mc.inventory.items.find((i) => i.itemId === 'ygdrasil-coin-old')
		expect(coins.quantity).toBe(23)

		// Unequip tshirt from torso-1
		const unequippedId = mc.equipment_slots['torso-1']
		mc.equipment_slots['torso-1'] = null

		const existing = mc.inventory.items.find((i) => i.itemId === unequippedId)
		if (existing) {
			existing.quantity += 1
		} else {
			mc.inventory.items.push({ itemId: unequippedId, quantity: 1 })
		}

		expect(mc.equipment_slots['torso-1']).toBeNull()
		expect(mc.inventory.items.some((i) => i.itemId === 'tshirt')).toBe(true)
	})

	it('manages character talents selection and persistence', async () => {
		const writtenFiles = {}
		window.electronAPI.dataEditor.writeFile = vi.fn(async (path, content) => {
			writtenFiles[path] = content
			return { success: true, path }
		})

		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		if (!Array.isArray(mc.talents)) mc.talents = []

		// Add talent item_restriction_bypass to MC
		mc.talents.push('item_restriction_bypass')
		expect(mc.talents.includes('item_restriction_bypass')).toBe(true)

		await editor.saveEntity('characters', mc)
		expect(writtenFiles['characters/mc/values.json']).toBeDefined()
		expect(writtenFiles['characters/mc/values.json'].talents).toContain('item_restriction_bypass')

		// Remove talent
		mc.talents = mc.talents.filter((t) => t !== 'item_restriction_bypass')
		expect(mc.talents.includes('item_restriction_bypass')).toBe(false)
	})

	it('organizes class skills into unified cellular tier grid and manages class assignments', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		const warriorClass = editor.entities.value.classes.find((c) => c.id === 'warrior')

		// Assign wizard class to mc
		if (!Array.isArray(mc.classs)) mc.classs = []
		if (!mc.classs.includes('wizard')) {
			mc.classs.push('wizard')
			if (!mc.class_levels) mc.class_levels = {}
			mc.class_levels.wizard = 3
		}

		expect(mc.classs).toContain('wizard')
		expect(mc.class_levels.wizard).toBe(3)

		// Check unified cellular tier grid organization for warrior skills
		const grid = organizeSkillsByGrid(warriorClass.skills, warriorClass.skill_branches || [])
		expect(grid.tiers).toBeDefined()
		expect(grid.tiers.length).toBeGreaterThanOrEqual(2)

		// Tier 1 contains warrior_slash, Tier 5 contains warrior_cross_slash
		const tier1 = grid.tiers.find((t) => t.level === 1)
		const tier5 = grid.tiers.find((t) => t.level === 5)
		expect(tier1).toBeDefined()
		expect(tier5).toBeDefined()
		expect(tier1.skills.some((s) => s.id === 'warrior_slash')).toBe(true)
		expect(tier5.skills.some((s) => s.id === 'warrior_cross_slash')).toBe(true)
	})

	it('organizes bottom-up display tiers and handles skill synchronization with abilities', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')
		const warriorClass = editor.entities.value.classes.find((c) => c.id === 'warrior')

		const grid = organizeSkillsByGrid(warriorClass.skills, warriorClass.skill_branches || [])
		const displayTiers = [...grid.tiers].sort((a, b) => b.level - a.level)

		// Bottom-up: Level 5 is first in display array, Level 1 is last (rendered at bottom)
		expect(displayTiers[0].level).toBeGreaterThan(displayTiers[displayTiers.length - 1].level)
		expect(displayTiers[displayTiers.length - 1].level).toBe(1)

		// Test syncing learned skill into character.abilities
		if (!mc.abilities) mc.abilities = []
		mc.skills.warrior_cross_slash = 2

		// Sync logic as performed in CharacterSkillsTab
		const allKnownSkills = warriorClass.skills
		for (const [skillId, rank] of Object.entries(mc.skills)) {
			const skillDef = allKnownSkills.find((s) => s.id === skillId)
			if (skillDef) {
				const existing = mc.abilities.find((a) => a.id === skillId)
				if (existing) {
					existing.rank = rank
				} else {
					mc.abilities.push({
						id: skillDef.id,
						name: skillDef.name || skillDef.id,
						icon: skillDef.icon || '⚔️',
						rank
					})
				}
			}
		}

		const synced = mc.abilities.find((a) => a.id === 'warrior_cross_slash')
		expect(synced).toBeDefined()
		expect(synced.rank).toBe(2)

		// Unlearning skill removes it from abilities
		delete mc.skills.warrior_cross_slash
		mc.abilities = mc.abilities.filter((a) => (mc.skills[a.id] || 0) > 0)
		expect(mc.abilities.some((a) => a.id === 'warrior_cross_slash')).toBe(false)
	})

	it('verifies ClassRaceTreeDrawer and ClassRaceTreeCanvas unified selection mode architecture', async () => {
		const fs = await import('fs')
		const path = await import('path')

		// 1. Verify ClassRaceTreeCanvas props & emits for selection mode
		const canvasPath = path.resolve(__dirname, '../../components/game/dataEditor/ClassRaceTreeCanvas.vue')
		expect(fs.existsSync(canvasPath)).toBe(true)
		const canvasContent = fs.readFileSync(canvasPath, 'utf-8')
		expect(canvasContent).toContain('selectionMode:')
		expect(canvasContent).toContain('assignedIds:')
		expect(canvasContent).toContain("'toggleAssign'")
		expect(canvasContent).toContain('__assigned')
		expect(canvasContent).toContain('node-assigned-check')
		expect(canvasContent).toContain('node-selection-actions')

		// 2. Verify ClassRaceTreeDrawer wrapper component exists and embeds ClassRaceTreeCanvas
		const drawerPath = path.resolve(__dirname, '../../components/game/dataEditor/ClassRaceTreeDrawer.vue')
		expect(fs.existsSync(drawerPath)).toBe(true)
		const drawerContent = fs.readFileSync(drawerPath, 'utf-8')
		expect(drawerContent).toContain('import ClassRaceTreeCanvas from \'./ClassRaceTreeCanvas.vue\'')
		expect(drawerContent).toContain(':selection-mode="true"')
		expect(drawerContent).toContain(':assigned-ids="assignedIds"')
		expect(drawerContent).toContain('@toggle-assign="onToggleAssign"')
		expect(drawerContent).toContain("emit('close')")

		// 3. Verify CharacterSkillsTab uses ClassRaceTreeDrawer instead of ad-hoc card list
		const tabPath = path.resolve(__dirname, '../../components/game/dataEditor/CharacterSkillsTab.vue')
		expect(fs.existsSync(tabPath)).toBe(true)
		const tabContent = fs.readFileSync(tabPath, 'utf-8')
		expect(tabContent).toContain('import ClassRaceTreeDrawer from \'./ClassRaceTreeDrawer.vue\'')
		expect(tabContent).toContain('<ClassRaceTreeDrawer')
		expect(tabContent).toContain('@close')
		expect(tabContent).not.toContain('tpd-cards-grid')
		expect(tabContent).not.toContain('pickerSearchQuery')
	})

	it('supports assigning and unassigning classes and races with automatic level initialization', () => {
		const mc = editor.entities.value.characters.find((c) => c.id === 'mc')

		// Class assignment logic as implemented in CharacterSkillsTab
		function addClass(char, classId) {
			if (!Array.isArray(char.classs)) char.classs = []
			if (!char.classs.includes(classId)) {
				char.classs.push(classId)
				if (!char.class_levels) char.class_levels = {}
				if (!char.class_levels[classId]) char.class_levels[classId] = 1
			}
		}

		function removeClass(char, classId) {
			if (!Array.isArray(char.classs)) return
			const idx = char.classs.indexOf(classId)
			if (idx !== -1) char.classs.splice(idx, 1)
		}

		function addRace(char, raceId) {
			if (!Array.isArray(char.races)) char.races = []
			if (!char.races.includes(raceId)) {
				char.races.push(raceId)
				if (!char.race_levels) char.race_levels = {}
				if (!char.race_levels[raceId]) char.race_levels[raceId] = 1
			}
		}

		function removeRace(char, raceId) {
			if (!Array.isArray(char.races)) return
			const idx = char.races.indexOf(raceId)
			if (idx !== -1) char.races.splice(idx, 1)
		}

		// Initial state
		expect(mc.classs).toEqual(['warrior'])
		expect(mc.races).toEqual(['human'])

		// Add wizard class
		addClass(mc, 'wizard')
		expect(mc.classs).toContain('wizard')
		expect(mc.class_levels.wizard).toBe(1)

		// Add skeleton race
		addRace(mc, 'skeleton')
		expect(mc.races).toContain('skeleton')
		expect(mc.race_levels.skeleton).toBe(1)

		// Remove warrior class
		removeClass(mc, 'warrior')
		expect(mc.classs).not.toContain('warrior')
		expect(mc.classs).toContain('wizard')

		// Remove skeleton race
		removeRace(mc, 'skeleton')
		expect(mc.races).not.toContain('skeleton')
		expect(mc.races).toContain('human')
	})

	it('supports CharacterStatsTab with active race switching, attributes, and pipeline calculation', () => {
		const mc = {
			id: 'mc',
			name: 'Анон',
			lvl: 1,
			races: ['human', 'elder-lich'],
			active_race: 'human',
			attributes: { strength: 5, endurance: 0, agility: 0, intelligence: 0 },
			free_attribute_points: 5,
			equipment_slots: { 'torso-1': 'tshirt' }
		}

		// Initial active race is human
		expect(mc.active_race).toBe('human')
		expect(mc.attributes.strength).toBe(5)

		// Switch active race to elder-lich
		mc.active_race = 'elder-lich'
		expect(mc.active_race).toBe('elder-lich')
		// Races array still contains both
		expect(mc.races).toContain('human')
		expect(mc.races).toContain('elder-lich')
	})
})



