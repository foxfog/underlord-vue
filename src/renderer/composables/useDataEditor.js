// src/renderer/composables/useDataEditor.js
import { ref, computed } from 'vue'
import { ITEM_RARITIES, getRarity, getRarityColor, getRarityBadgeStyle } from '../constants/rarity.js'
import { normalizeSkill, normalizeSkillBranch, resolveSkillNode, resolveEntitySkills } from '../utils/skillTree.js'
import { calculateEquipmentBySlot } from '../utils/equipment.js'

// Singleton state
const activeTab = ref('characters') // 'characters' | 'classes' | 'fractions' | 'races' | 'items' | 'tags'
const entities = ref({
	characters: [],
	classes: [],
	fractions: [],
	races: [],
	items: []
})
const globalTags = ref([])
const itemCategories = ref([])
const itemSkills = ref([])
const talents = ref([])
const skillsCatalog = ref([])
const activeLocale = ref('ru')
const availableLocales = ref([
	{ code: 'ru', label: 'Русский', flag: '🇷🇺' },
	{ code: 'en', label: 'English', flag: '🇬🇧' }
])
const localesData = ref({
	ru: { characters: {}, classes: {}, fractions: {}, races: {}, items: {}, item_categories: {} },
	en: { characters: {}, classes: {}, fractions: {}, races: {}, items: {}, item_categories: {} }
})
const isLoading = ref(false)
const selectedEntity = ref(null)
const isCreating = ref(false)
const searchQuery = ref('')
const basePath = ref('src/renderer/public/data/')
const statusMessage = ref(null)
let statusTimeout = null

export const GENDER_OPTIONS = [
	{ id: 'male', label: 'Мужской', shortLabel: 'М', icon: '♂️' },
	{ id: 'female', label: 'Женский', shortLabel: 'Ж', icon: '♀️' },
	{ id: 'genderless', label: 'Бесполое', shortLabel: 'Бесполое', icon: '⚪' },
	{ id: 'hermaphrodite', label: 'Гермафродит', shortLabel: 'Гермафродит', icon: '⚧' }
]

export const EQUIPMENT_SLOTS_LIST = [
	{ id: 'head', label: 'Голова (head)' },
	{ id: 'mask', label: 'Маска / Лицо (mask)' },
	{ id: 'neck_1', label: 'Ожерелье / Шея (neck_1)' },
	{ id: 'torso-1', label: 'Верхняя одежда / Рубашка (torso-1)' },
	{ id: 'torso-2', label: 'Куртка / Броня (torso-2)' },
	{ id: 'torso-3', label: 'Плащ / Накидка (torso-3)' },
	{ id: 'hands', label: 'Перчатки / Руки (hands)' },
	{ id: 'legs-2', label: 'Штаны / Поножи (legs-2)' },
	{ id: 'feet', label: 'Обувь / Сапоги (feet)' },
	{ id: 'weapon-hand-1', label: 'Основное оружие (weapon-hand-1)' },
	{ id: 'weapon-hand-2', label: 'Вторая рука / Щит (weapon-hand-2)' },
	{ id: 'underpants', label: 'Бельё (underpants)' }
]

export function getGenderLabel(gender) {
	const opt = GENDER_OPTIONS.find((g) => g.id === gender)
	return opt ? opt.label : gender || 'Мужской'
}

export function getGenderIcon(gender) {
	const opt = GENDER_OPTIONS.find((g) => g.id === gender)
	return opt ? opt.icon : '♂️'
}

export function getGenderOption(gender) {
	return GENDER_OPTIONS.find((g) => g.id === gender) || GENDER_OPTIONS[0]
}

export function getSlotDisplayName(slotId) {
	const opt = EQUIPMENT_SLOTS_LIST.find((s) => s.id === slotId)
	return opt ? opt.label : slotId
}

export function useDataEditor() {
	function setStatus(text, type = 'success', duration = 4000) {
		if (statusTimeout) clearTimeout(statusTimeout)
		statusMessage.value = { text, type }
		if (duration > 0) {
			statusTimeout = setTimeout(() => {
				statusMessage.value = null
			}, duration)
		}
	}

	// Helper for Electron IPC or Web fallback file reading
	async function readDataFile(relativePath) {
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.readFile) {
			const res = await window.electronAPI.dataEditor.readFile(relativePath)
			if (res.success) return res.data
			if (res.notFound) return null
			throw new Error(res.error || 'Ошибка чтения файла')
		}
		// Web / dev fallback
		try {
			const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			const fullUrl = `${base}data/${relativePath.replace(/^\//, '')}`
			const res = await fetch(fullUrl)
			if (res.ok) {
				return await res.json()
			}
			return null
		} catch (e) {
			return null
		}
	}

	// Helper for Electron IPC or fallback file writing.
	// Uses JSON.parse(JSON.stringify(data)) to guarantee no Vue Proxies are passed to structuredClone!
	async function writeDataFile(relativePath, data) {
		const rawData = JSON.parse(JSON.stringify(data))
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.writeFile) {
			const res = await window.electronAPI.dataEditor.writeFile(relativePath, rawData)
			if (!res.success) throw new Error(res.error || 'Ошибка записи файла')
			return res
		}
		// If running in dev/test without Electron IPC
		console.warn(`[DataEditor] Writing without Electron IPC: ${relativePath}`, rawData)
		return { success: true, simulated: true, path: relativePath }
	}

	async function deleteDataFile(relativePath) {
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.deleteFile) {
			const res = await window.electronAPI.dataEditor.deleteFile(relativePath)
			return res
		}
		// In dev/test without Electron IPC
		console.warn(`[DataEditor] Deleting without Electron IPC: ${relativePath}`)
		return { success: true, simulated: true, path: relativePath }
	}

	async function listDirectory(relativeDir) {
		if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.listFiles) {
			const res = await window.electronAPI.dataEditor.listFiles(relativeDir)
			if (res.success && Array.isArray(res.files)) return res.files
			return []
		}
		if (typeof process !== 'undefined' && process.versions?.node) {
			try {
				const fs = await import('fs')
				const p = await import('path')
				const fullPath = p.resolve(process.cwd(), basePath.value, relativeDir)
				if (fs.existsSync(fullPath)) {
					return fs.readdirSync(fullPath).filter((f) => f.endsWith('.json'))
				}
			} catch (err) {
				return []
			}
		}
		return []
	}

	// Initialize paths and load all datasets
	async function init() {
		isLoading.value = true
		try {
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.getInfo) {
				const info = await window.electronAPI.dataEditor.getInfo()
				if (info?.basePath) basePath.value = info.basePath
			}
			await loadAll()
		} catch (err) {
			console.error('Ошибка инициализации редактора данных:', err)
			setStatus(`Ошибка загрузки данных: ${err.message}`, 'error')
		} finally {
			isLoading.value = false
		}
	}

	// Helper to load all characters from their individual folders characters/{id}/values.json
	async function loadCharactersData() {
		let characterIds = ['mc', 'momonga', 'albedo', 'enri', 'carne-chief']
		try {
			const charRegistry = await readDataFile('characters/characters.json')
			if (charRegistry && Array.isArray(charRegistry.characters) && charRegistry.characters.length > 0) {
				characterIds = Array.from(new Set([...charRegistry.characters]))
			}
		} catch (e) {
			// fallback to default list
		}

		const chars = await Promise.all(
			characterIds.map(async (charId) => {
				try {
					const values = await readDataFile(`characters/${charId}/values.json`)
					if (values) {
						let bodyData = null
						let equipmentData = []
						try {
							bodyData = await readDataFile(`characters/${charId}/body.json`)
						} catch (e) {
							// optional body
						}
						try {
							equipmentData = await readDataFile(`characters/${charId}/equipment.json`)
						} catch (e) {
							// optional equipment
						}
						const equipmentBySlot = calculateEquipmentBySlot(
							values.equipment_slots || {},
							Array.isArray(equipmentData) ? equipmentData : []
						)
						return {
							id: charId,
							...values,
							sprites: bodyData || null,
							equipment: Array.isArray(equipmentData) ? equipmentData : [],
							equipmentBySlot
						}
					}
				} catch (err) {
					console.warn(`[useDataEditor] Could not load characters/${charId}/values.json:`, err)
				}
				return null
			})
		)
		return chars.filter(Boolean)
	}

	// Load all collections and global tags
	async function loadAll() {
		const [chars, classes, fractions, races, equipItems, otherItems, tagsList, categoriesList, loadedItemSkills, loadedTalents, loadedSkillsCatalog] = await Promise.all([
			loadCharactersData(),
			readDataFile('classes/classes.json'),
			readDataFile('fractions/fractions.json'),
			readDataFile('races/races.json'),
			readDataFile('items/equipment.json'),
			readDataFile('items/other.json'),
			readDataFile('tags/tags.json'),
			readDataFile('items/categories.json'),
			readDataFile('skills/items/items.json'),
			readDataFile('skills/talents/talents.json'),
			readDataFile('skills/skills.json')
		])

		if (Array.isArray(loadedItemSkills)) {
			itemSkills.value = loadedItemSkills
		} else if (loadedItemSkills && Array.isArray(loadedItemSkills.skills)) {
			itemSkills.value = loadedItemSkills.skills
		} else {
			itemSkills.value = []
		}

		if (Array.isArray(loadedTalents)) {
			talents.value = loadedTalents
		} else if (loadedTalents && Array.isArray(loadedTalents.talents)) {
			talents.value = loadedTalents.talents
		} else {
			talents.value = []
		}

		if (Array.isArray(loadedSkillsCatalog)) {
			skillsCatalog.value = loadedSkillsCatalog
		} else if (loadedSkillsCatalog && Array.isArray(loadedSkillsCatalog.skills)) {
			skillsCatalog.value = loadedSkillsCatalog.skills
		} else {
			skillsCatalog.value = []
		}

		// Classes
		entities.value.classes = buildHierarchicalOrder(Array.isArray(classes) ? classes : [])

		// Fractions
		entities.value.fractions = buildHierarchicalOrder(Array.isArray(fractions) ? fractions : [])

		// Races
		entities.value.races = buildHierarchicalOrder(Array.isArray(races) ? races : [])

		// Load individual skill files for classes from data/skills/classes/<id>.json
		const classSkillFiles = await listDirectory('skills/classes')
		if (classSkillFiles.length > 0) {
			await Promise.all(
				classSkillFiles.map(async (fileName) => {
					if (!fileName.endsWith('.json')) return
					const classId = fileName.replace('.json', '')
					const skillData = await readDataFile(`skills/classes/${fileName}`)
					const targetClass = entities.value.classes.find((c) => c.id === classId)
					if (targetClass && skillData) {
						targetClass.skill_branches = Array.isArray(skillData.skill_branches) ? skillData.skill_branches : []
						targetClass.skills = Array.isArray(skillData.skills) ? skillData.skills : []
					}
				})
			)
		} else {
			// Web/fallback: attempt loading skills for known classes
			await Promise.all(
				entities.value.classes.map(async (c) => {
					const skillData = await readDataFile(`skills/classes/${c.id}.json`)
					if (skillData) {
						c.skill_branches = Array.isArray(skillData.skill_branches) ? skillData.skill_branches : []
						c.skills = Array.isArray(skillData.skills) ? skillData.skills : []
					}
				})
			)
		}

		// Load individual skill files for races from data/skills/races/<id>.json
		const raceSkillFiles = await listDirectory('skills/races')
		if (raceSkillFiles.length > 0) {
			await Promise.all(
				raceSkillFiles.map(async (fileName) => {
					if (!fileName.endsWith('.json')) return
					const raceId = fileName.replace('.json', '')
					const skillData = await readDataFile(`skills/races/${fileName}`)
					const targetRace = entities.value.races.find((r) => r.id === raceId)
					if (targetRace && skillData) {
						targetRace.skill_branches = Array.isArray(skillData.skill_branches) ? skillData.skill_branches : []
						targetRace.skills = Array.isArray(skillData.skills) ? skillData.skills : []
					}
				})
			)
		} else {
			// Web/fallback: attempt loading skills for known races
			await Promise.all(
				entities.value.races.map(async (r) => {
					const skillData = await readDataFile(`skills/races/${r.id}.json`)
					if (skillData) {
						r.skill_branches = Array.isArray(skillData.skill_branches) ? skillData.skill_branches : []
						r.skills = Array.isArray(skillData.skills) ? skillData.skills : []
					}
				})
			)
		}

		// Characters
		entities.value.characters = Array.isArray(chars) ? chars : []

		// Categories
		itemCategories.value = Array.isArray(categoriesList) ? categoriesList : []

		// Items (merge equipment + other, tag with type)
		const mergedItems = []
		if (Array.isArray(equipItems)) {
			equipItems.forEach((it) => mergedItems.push({ ...it, type: 'equipment' }))
		}
		if (Array.isArray(otherItems)) {
			otherItems.forEach((it) => mergedItems.push({ ...it, type: 'other' }))
		}
		entities.value.items = mergedItems

		// Global Tags
		globalTags.value = Array.isArray(tagsList) ? tagsList : []

		// Load registered locales from locales/locales.json if present
		const registeredLocales = await readDataFile('locales/locales.json')
		if (Array.isArray(registeredLocales) && registeredLocales.length > 0) {
			availableLocales.value = registeredLocales
		}

		// Load Locales (RU, EN, etc.)
		const localeTypes = ['characters', 'classes', 'fractions', 'races', 'items', 'item_categories']
		const localeLoads = []
		for (const l of availableLocales.value) {
			for (const t of localeTypes) {
				localeLoads.push(
					readDataFile(`locales/${l.code}/${t}.json`).then((data) => ({
						lang: l.code,
						type: t,
						data: data && typeof data === 'object' && !Array.isArray(data) ? data : {}
					}))
				)
			}
		}
		const loadedLocales = await Promise.all(localeLoads)
		for (const item of loadedLocales) {
			if (!localesData.value[item.lang]) localesData.value[item.lang] = {}
			localesData.value[item.lang][item.type] = item.data
		}

		// Backward-compatibility: auto-sync any entity texts into Russian locale if missing
		for (const t of localeTypes) {
			const list = entities.value[t] || []
			if (!localesData.value.ru[t]) localesData.value.ru[t] = {}
			for (const entity of list) {
				if (!localesData.value.ru[t][entity.id]) {
					localesData.value.ru[t][entity.id] = {
						name: entity.name || entity.id,
						description: entity.description || '',
						...(t === 'characters' && Array.isArray(entity.names) ? { names: entity.names } : {})
					}
				}
			}
		}
	}

	// Factory functions for creating new entity instances
	function createEmptyEntity(type = activeTab.value) {
		switch (type) {
			case 'characters':
				return {
					id: '',
					name: '',
					surname: '',
					nickname: '',
					title: '',
					names: [],
					icon: '',
					gender: 'male',
					race: 'human',
					races: ['human'],
					classs: ['warrior'],
					fractions: [],
					tags: [],
					talents: [],
					description: '',
					size: 1,
					lvl: 1,
					exp: 0,
					hpmax: 10,
					mpmax: 0,
					hp: 10,
					mp: 0,
					attack: 1,
					defense: 1,
					weight: 60,
					skill_points: 0,
					stat_points: 0,
					equipment_slots: {
						head: null,
						mask: null,
						neck_1: null,
						'torso-1': null,
						'torso-2': null,
						'torso-3': null,
						'legs-2': null,
						legs: null,
						feet: null,
						'weapon-hand-1': null,
						'weapon-hand-2': null,
						hands: null,
						weapon_off: null,
						underpants: null
					},
					inventory: {
						items: []
					},
					abilities: [],
					skills: {},
					class_levels: {},
					race_levels: {}
				}
			case 'classes':
				return {
					id: '',
					name: '',
					icon: '⚔️',
					parent_id: null,
					category: 'combat',
					tags: [],
					lvl_min: 1,
					tier: 'basic',
					skill_points_per_level: 1,
					spell_points_per_level: 0,
					description: '',
					skill_branches: [],
					skills: []
				}
			case 'fractions':
				return {
					id: '',
					name: '',
					icon: '🏰',
					type: 'guild',
					parent_id: null,
					tags: [],
					description: ''
				}
			case 'races':
				return {
					id: '',
					name: '',
					icon: '👤',
					parent_id: null,
					family: null,
					category: 'humanoid',
					tags: [],
					lvl_min: 1,
					tier: 'basic',
					skill_points_per_level: 1,
					spell_points_per_level: 0,
					description: '',
					skill_branches: [],
					skills: []
				}
			case 'items':
				return {
					id: '',
					name: '',
					type: 'equipment',
					rarity: 'common',
					categories: [],
					slot: 'torso-1',
					sprite: '',
					weight: 0.5,
					stackable: false,
					lvl: 1,
					characters: [],
					races: [],
					classs: [],
					genders: [],
					tags: [],
					description: ''
				}
			case 'tags':
				return { id: '', name: '' }
			default:
				return { id: '', name: '' }
		}
	}

	function startCreate(presetData = {}) {
		const newEntity = { ...createEmptyEntity(activeTab.value), ...presetData }
		if (newEntity.parent_id && (activeTab.value === 'classes' || activeTab.value === 'races')) {
			const parent = entities.value[activeTab.value]?.find((e) => e.id === newEntity.parent_id)
			if (parent?.category) {
				newEntity.category = parent.category
			}
			if (parent?.family && activeTab.value === 'races' && !newEntity.family) {
				newEntity.family = parent.family
			}
		}
		const _loc = {}
		for (const l of availableLocales.value) {
			_loc[l.code] = {
				name: newEntity.name || '',
				description: newEntity.description || '',
				names: []
			}
		}
		newEntity._locales = _loc
		selectedEntity.value = newEntity
		isCreating.value = true
	}

	function startEdit(entity) {
		// Deep clone entity for isolated editing
		const cloned = JSON.parse(JSON.stringify(entity))

		if (activeTab.value === 'characters') {
			if (!cloned.gender) cloned.gender = 'male'
			if (!Array.isArray(cloned.races)) cloned.races = []
			if (!Array.isArray(cloned.classs)) cloned.classs = []
			if (!Array.isArray(cloned.fractions)) cloned.fractions = []
			if (!cloned.equipment_slots || typeof cloned.equipment_slots !== 'object') {
				cloned.equipment_slots = {}
			}
			if (!cloned.inventory || typeof cloned.inventory !== 'object') {
				cloned.inventory = { items: [] }
			} else if (!Array.isArray(cloned.inventory.items)) {
				cloned.inventory.items = []
			}
			if (!cloned.skills || typeof cloned.skills !== 'object' || Array.isArray(cloned.skills)) {
				cloned.skills = {}
			}
			if (!cloned.class_levels || typeof cloned.class_levels !== 'object') {
				cloned.class_levels = {}
			}
			if (!cloned.race_levels || typeof cloned.race_levels !== 'object') {
				cloned.race_levels = {}
			}
			if (cloned.equipmentBySlot === undefined) {
				cloned.equipmentBySlot = calculateEquipmentBySlot(cloned.equipment_slots, cloned.equipment)
			}
		}

		if (activeTab.value === 'classes' || activeTab.value === 'races') {
			if (!cloned.tier) cloned.tier = 'basic'
			if (cloned.skill_points_per_level === undefined) cloned.skill_points_per_level = 1
			if (cloned.spell_points_per_level === undefined) cloned.spell_points_per_level = 0
			if (!Array.isArray(cloned.skill_branches)) cloned.skill_branches = []
			if (!Array.isArray(cloned.skills)) cloned.skills = []
		}

		if (activeTab.value === 'items') {
			if (!Array.isArray(cloned.characters)) cloned.characters = []
			if (!Array.isArray(cloned.races)) cloned.races = []
			if (!Array.isArray(cloned.classs)) {
				cloned.classs = Array.isArray(cloned.class)
					? cloned.class
					: Array.isArray(cloned.classes)
					? cloned.classes
					: []
			}
			if (!Array.isArray(cloned.genders)) cloned.genders = []
			if (cloned.lvl === undefined) cloned.lvl = 1
		}

		const _loc = {}
		for (const l of availableLocales.value) {
			const locObj = localesData.value[l.code]?.[activeTab.value]?.[entity.id] || {}
			_loc[l.code] = {
				name: locObj.name !== undefined ? locObj.name : (l.code === 'ru' ? entity.name || '' : ''),
				description: locObj.description !== undefined ? locObj.description : (l.code === 'ru' ? entity.description || '' : ''),
				names: Array.isArray(locObj.names)
					? [...locObj.names]
					: (l.code === 'ru' && Array.isArray(entity.names) ? [...entity.names] : [])
			}
		}
		cloned._locales = _loc
		selectedEntity.value = cloned
		isCreating.value = false
	}

	function cancelEdit() {
		selectedEntity.value = null
		isCreating.value = false
	}

	// Save active or passed entity
	async function saveEntity(type, entityToSave) {
		const targetType = type || activeTab.value
		const data = entityToSave || selectedEntity.value
		if (!data) throw new Error('Нет данных для сохранения')

		const id = String(data.id || '').trim()
		if (!id) throw new Error('ID сущности не может быть пустым')

		// ID validation (only alphanumeric, hyphen, underscore)
		if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
			throw new Error('ID должен содержать только латинские буквы, цифры, дефис или подчеркивание')
		}

		const list = entities.value[targetType]
		const existingIndex = list.findIndex((item) => item.id === id)

		if (isCreating.value && existingIndex !== -1) {
			throw new Error(`Сущность с ID "${id}" уже существует`)
		}

		// Preserve any arbitrary extra fields manually written in the JSON file
		const baseItem = existingIndex >= 0 ? list[existingIndex] : {}
		const mergedData = { ...baseItem, ...data }

		// If explicit custom fields are provided, apply custom fields changes (additions, modifications, deletions)
		if (data._customFields !== undefined && typeof data._customFields === 'object' && data._customFields !== null) {
			// Remove any previous custom fields on baseItem that were deleted in _customFields
			const prevCustom = getCustomFieldsObject(baseItem, targetType)
			for (const key of Object.keys(prevCustom)) {
				delete mergedData[key]
			}
			// Apply new custom fields (ignoring collisions with standard keys and internal _locales)
			const standard = STANDARD_KEYS[targetType] || []
			for (const [k, v] of Object.entries(data._customFields)) {
				if (!standard.includes(k) && k !== '_locales' && k !== '_customFields') {
					mergedData[k] = v
				}
			}
			delete mergedData._customFields
		}

		// Sync localized texts if provided via _locales
		if (mergedData._locales) {
			// If name / description / names were directly mutated on the entity (e.g. in tests or callers), sync to _locales.ru
			if (data.name && data.name !== baseItem.name) {
				if (!mergedData._locales.ru) mergedData._locales.ru = {}
				mergedData._locales.ru.name = data.name
			}
			if (data.description && data.description !== baseItem.description) {
				if (!mergedData._locales.ru) mergedData._locales.ru = {}
				mergedData._locales.ru.description = data.description
			}
			if (Array.isArray(data.names) && data.names !== baseItem.names) {
				if (!mergedData._locales.ru) mergedData._locales.ru = {}
				mergedData._locales.ru.names = data.names
			}

			for (const l of availableLocales.value) {
				const code = l.code
				if (!localesData.value[code]) localesData.value[code] = {}
				if (!localesData.value[code][targetType]) localesData.value[code][targetType] = {}
				const locEntry = mergedData._locales[code] || {}
				const entryToStore = {
					name: locEntry.name || '',
					description: locEntry.description || ''
				}
				if (targetType === 'characters') {
					entryToStore.names = Array.isArray(locEntry.names) ? locEntry.names : []
				}
				localesData.value[code][targetType][id] = entryToStore
				await writeDataFile(`locales/${code}/${targetType}.json`, localesData.value[code][targetType])
			}
			// Update backward-compatible fallback fields on mergedData
			mergedData.name = mergedData._locales.ru?.name || mergedData.name || id
			mergedData.description = mergedData._locales.ru?.description || mergedData.description || ''
			if (targetType === 'characters') {
				mergedData.names = Array.isArray(mergedData._locales.ru?.names)
					? mergedData._locales.ru.names
					: (mergedData.names || [])
			}
			delete mergedData._locales
		} else {
			// Backward-compat for direct callers (e.g. tests) passing name/description directly
			if (mergedData.name || mergedData.description || mergedData.names) {
				if (!localesData.value.ru[targetType]) localesData.value.ru[targetType] = {}
				localesData.value.ru[targetType][id] = {
					name: mergedData.name || id,
					description: mergedData.description || '',
					...(targetType === 'characters' && mergedData.names ? { names: mergedData.names } : {})
				}
				await writeDataFile(`locales/ru/${targetType}.json`, localesData.value.ru[targetType])
			}
		}

		// Clean and normalize entity data
		const cleanData = normalizeEntity(targetType, mergedData)

		if (existingIndex >= 0) {
			list[existingIndex] = cleanData
		} else {
			list.push(cleanData)
		}

		// Cascade category to all descendants if classes or races
		if ((targetType === 'classes' || targetType === 'races') && cleanData.category) {
			function updateDescendantsCategory(parentId, cat) {
				for (const item of list) {
					if (item.parent_id === parentId) {
						item.category = cat
						updateDescendantsCategory(item.id, cat)
					}
				}
			}
			updateDescendantsCategory(cleanData.id, cleanData.category)
		}

		if (isHierarchicalType(targetType)) {
			entities.value[targetType] = buildHierarchicalOrder(list)
		}

		// Auto-register any new tags to globalTags
		if (Array.isArray(cleanData.tags)) {
			let addedAny = false
			for (const t of cleanData.tags) {
				if (t && !globalTags.value.includes(t)) {
					globalTags.value.push(t)
					addedAny = true
				}
			}
			if (addedAny) {
				await persistTypeToFile('tags')
			}
		}

		// Persist changes to filesystem
		await persistTypeToFile(targetType)

		// Persist or delete individual skill file for classes or races
		if (targetType === 'classes' || targetType === 'races') {
			const hasSkills =
				(Array.isArray(cleanData.skills) && cleanData.skills.length > 0) ||
				(Array.isArray(cleanData.skill_branches) && cleanData.skill_branches.length > 0)
			if (hasSkills) {
				const savedSkills = (cleanData.skills || []).map((sk) => {
					const sId = sk.skill_id || sk.id
					const node = {
						id: sId,
						skill_id: sId,
						branch: sk.branch || '',
						grid_col: sk.grid_col ?? 0,
						req_level: sk.req_level ?? 1,
						max_level: sk.max_level ?? 1,
						cost: sk.cost ?? (sk.auto_unlock ? 0 : 1),
						cost_type: sk.cost_type || 'skill_point',
						level_points_given: sk.level_points_given ?? 1,
						auto_unlock: Boolean(sk.auto_unlock),
						parent_ids: Array.isArray(sk.parent_ids) ? sk.parent_ids : [],
						parent_requirement: sk.parent_requirement === 'any' ? 'any' : 'all'
					}
					if (sk.name) node.name = sk.name
					if (sk.icon) node.icon = sk.icon
					if (sk.description) node.description = sk.description
					if (sk.category) node.category = sk.category
					if (sk.data && Object.keys(sk.data).length > 0) node.data = sk.data
					return node
				})
				await writeDataFile(`skills/${targetType}/${cleanData.id}.json`, {
					skill_branches: cleanData.skill_branches || [],
					skills: savedSkills
				})
			} else {
				await deleteDataFile(`skills/${targetType}/${cleanData.id}.json`)
			}
		}

		// Re-prepare selectedEntity with _locales if still selected
		const freshCloned = JSON.parse(JSON.stringify(cleanData))

		if (targetType === 'characters') {
			if (!freshCloned.gender) freshCloned.gender = 'male'
			if (!Array.isArray(freshCloned.races)) freshCloned.races = []
			if (!Array.isArray(freshCloned.classs)) freshCloned.classs = []
			if (!Array.isArray(freshCloned.fractions)) freshCloned.fractions = []
		}

		if (targetType === 'items') {
			if (!Array.isArray(freshCloned.characters)) freshCloned.characters = []
			if (!Array.isArray(freshCloned.races)) freshCloned.races = []
			if (!Array.isArray(freshCloned.classs)) freshCloned.classs = []
			if (!Array.isArray(freshCloned.genders)) freshCloned.genders = []
			if (freshCloned.lvl === undefined) freshCloned.lvl = 1
		}

		const _freshLoc = {}
		for (const l of availableLocales.value) {
			const locObj = localesData.value[l.code]?.[targetType]?.[id] || {}
			_freshLoc[l.code] = {
				name: locObj.name !== undefined ? locObj.name : (l.code === 'ru' ? cleanData.name || '' : ''),
				description: locObj.description !== undefined ? locObj.description : (l.code === 'ru' ? cleanData.description || '' : ''),
				names: Array.isArray(locObj.names)
					? [...locObj.names]
					: (l.code === 'ru' && Array.isArray(cleanData.names) ? [...cleanData.names] : [])
			}
		}
		freshCloned._locales = _freshLoc
		selectedEntity.value = freshCloned
		isCreating.value = false

		const typeLabel = getTypeLabel(targetType)
		const savedDisplayName = getEntityText(targetType, cleanData.id, 'name', 'ru') || cleanData.id
		setStatus(`✔ ${typeLabel} "${savedDisplayName}" успешно сохранён(а) в JSON!`)
		return { success: true, entity: cleanData }
	}

	// Delete an entity by ID
	async function deleteEntity(type, entityId) {
		const targetType = type || activeTab.value
		const list = entities.value[targetType]
		const idx = list.findIndex((item) => item.id === entityId)
		if (idx === -1) {
			throw new Error(`Сущность с ID "${entityId}" не найдена`)
		}

		const [removed] = list.splice(idx, 1)

		if (selectedEntity.value && selectedEntity.value.id === entityId) {
			cancelEdit()
		}

		// Remove from locales
		for (const l of availableLocales.value) {
			if (localesData.value[l.code]?.[targetType]?.[entityId]) {
				delete localesData.value[l.code][targetType][entityId]
				await writeDataFile(`locales/${l.code}/${targetType}.json`, localesData.value[l.code][targetType])
			}
		}

		// Persist changes
		await persistTypeToFile(targetType)

		// Delete associated skill file if class or race
		if (targetType === 'classes' || targetType === 'races') {
			await deleteDataFile(`skills/${targetType}/${entityId}.json`)
		}

		// Delete character folder files if character
		if (targetType === 'characters') {
			await deleteDataFile(`characters/${entityId}/values.json`)
			await deleteDataFile(`characters/${entityId}/body.json`)
			await deleteDataFile(`characters/${entityId}/equipment.json`)
		}

		const typeLabel = getTypeLabel(targetType)
		setStatus(`✔ ${typeLabel} "${removed.name || removed.id}" успешно удален(а)!`, 'info')
		return { success: true }
	}

	// Global Tags management
	async function addGlobalTag(tag) {
		const cleaned = String(tag || '').trim().toLowerCase()
		if (!cleaned) throw new Error('Имя тега не может быть пустым')
		if (globalTags.value.includes(cleaned)) {
			throw new Error(`Тег "${cleaned}" уже существует в списке`)
		}
		globalTags.value.push(cleaned)
		await persistTypeToFile('tags')
		setStatus(`✔ Тег "${cleaned}" добавлен в tags.json!`)
		return cleaned
	}

	async function deleteGlobalTag(tag) {
		const idx = globalTags.value.indexOf(tag)
		if (idx === -1) return
		globalTags.value.splice(idx, 1)
		await persistTypeToFile('tags')
		setStatus(`✔ Тег "${tag}" удалён из tags.json!`, 'info')
	}

	// Item Skills Management (skills/items/items.json)
	async function persistItemSkills() {
		await writeDataFile('skills/items/items.json', itemSkills.value)
	}

	async function saveItemSkill(skill) {
		if (!skill || !skill.id) throw new Error('ID навыка не может быть пустым')
		const cleanSkill = {
			id: String(skill.id).trim(),
			name: String(skill.name || skill.id).trim(),
			icon: skill.icon || '⚔️',
			category: skill.category || 'active',
			description: skill.description || '',
			data: skill.data && typeof skill.data === 'object' ? skill.data : {}
		}
		const idx = itemSkills.value.findIndex((s) => s.id === cleanSkill.id)
		if (idx >= 0) {
			itemSkills.value[idx] = cleanSkill
		} else {
			itemSkills.value.push(cleanSkill)
		}
		await persistItemSkills()
		setStatus(`✔ Навык предмета "${cleanSkill.name}" сохранён в skills/items/items.json!`)
		return cleanSkill
	}

	async function deleteItemSkill(skillId) {
		const idx = itemSkills.value.findIndex((s) => s.id === skillId)
		if (idx >= 0) {
			const [removed] = itemSkills.value.splice(idx, 1)
			await persistItemSkills()
			setStatus(`✔ Навык предмета "${removed.name || removed.id}" удалён из skills/items/items.json!`, 'info')
		}
	}

	// Character Talents Management (skills/talents/talents.json)
	async function persistTalents() {
		await writeDataFile('skills/talents/talents.json', talents.value)
	}

	async function saveTalent(talent) {
		if (!talent || !talent.id) throw new Error('ID таланта не может быть пустым')
		const cleanTalent = {
			id: String(talent.id).trim(),
			name: String(talent.name || talent.id).trim(),
			icon: talent.icon || '🌟',
			category: talent.category || 'passive',
			description: talent.description || '',
			data: talent.data && typeof talent.data === 'object' ? talent.data : {}
		}
		const idx = talents.value.findIndex((t) => t.id === cleanTalent.id)
		if (idx >= 0) {
			talents.value[idx] = cleanTalent
		} else {
			talents.value.push(cleanTalent)
		}
		await persistTalents()
		setStatus(`✔ Талант "${cleanTalent.name}" сохранён в skills/talents/talents.json!`)
		return cleanTalent
	}

	async function deleteTalent(talentId) {
		const idx = talents.value.findIndex((t) => t.id === talentId)
		if (idx >= 0) {
			const [removed] = talents.value.splice(idx, 1)
			await persistTalents()
			setStatus(`✔ Талант "${removed.name || removed.id}" удалён из skills/talents/talents.json!`, 'info')
		}
	}

	// Master Skills Catalog Management (skills/skills.json)
	async function persistSkillsCatalog() {
		await writeDataFile('skills/skills.json', skillsCatalog.value)
	}

	async function saveSkillToCatalog(skill) {
		if (!skill || (!skill.id && !skill.skill_id)) throw new Error('ID навыка не может быть пустым')
		const sId = String(skill.id || skill.skill_id).trim()
		const cleanSkill = {
			id: sId,
			name: String(skill.name || sId).trim(),
			icon: skill.icon || '⚔️',
			category: skill.category || 'active',
			description: skill.description || '',
			data: skill.data && typeof skill.data === 'object' ? skill.data : {}
		}
		const idx = skillsCatalog.value.findIndex((s) => s.id === cleanSkill.id)
		if (idx >= 0) {
			skillsCatalog.value[idx] = cleanSkill
		} else {
			skillsCatalog.value.push(cleanSkill)
		}
		await persistSkillsCatalog()
		setStatus(`✔ Навык "${cleanSkill.name}" сохранён в каталог skills/skills.json!`)
		return cleanSkill
	}

	async function deleteSkillFromCatalog(skillId) {
		const idx = skillsCatalog.value.findIndex((s) => s.id === skillId)
		if (idx >= 0) {
			const [removed] = skillsCatalog.value.splice(idx, 1)
			await persistSkillsCatalog()
			setStatus(`✔ Навык "${removed.name || removed.id}" удалён из каталога skills/skills.json!`, 'info')
		}
	}

	// Persist changes for a specific entity type to disk
	async function persistTypeToFile(targetType) {
		switch (targetType) {
			case 'characters': {
				// 1. Save each character into characters/{id}/values.json and scaffold folder if needed
				await Promise.all(
					entities.value.characters.map(async (c) => {
						const clone = { ...c }
						delete clone.sprites
						delete clone.equipment
						delete clone.equipmentBySlot
						delete clone._locales
						delete clone._customFields

						await writeDataFile(`characters/${c.id}/values.json`, clone)

						// Scaffold body.json and equipment.json if they don't exist
						try {
							const existingBody = await readDataFile(`characters/${c.id}/body.json`)
							if (!existingBody) {
								const defaultImg = c.icon || 'images/sprites/characters/default/default.png'
								await writeDataFile(`characters/${c.id}/body.json`, {
									body: {
										image: defaultImg
									}
								})
							}
							const existingEquip = await readDataFile(`characters/${c.id}/equipment.json`)
							if (!existingEquip) {
								await writeDataFile(`characters/${c.id}/equipment.json`, [])
							}
						} catch (scaffoldErr) {
							console.warn(`[useDataEditor] Scaffold check error for ${c.id}:`, scaffoldErr)
						}
					})
				)

				// 2. Keep characters.json list of IDs synchronized for novel engine
				const currentIds = entities.value.characters.map((c) => c.id)
				await writeDataFile('characters/characters.json', { characters: currentIds })
				break
			}
			case 'classes': {
				// Strip skills and skill_branches so classes.json stays lean
				const cleanClasses = entities.value.classes.map((c) => {
					const clone = { ...c }
					delete clone.skill_branches
					delete clone.skills
					return clone
				})
				await writeDataFile('classes/classes.json', cleanClasses)
				break
			}
			case 'fractions': {
				await writeDataFile('fractions/fractions.json', entities.value.fractions)
				break
			}
			case 'races': {
				// Strip skills and skill_branches so races.json stays lean
				const cleanRaces = entities.value.races.map((r) => {
					const clone = { ...r }
					delete clone.skill_branches
					delete clone.skills
					return clone
				})
				await writeDataFile('races/races.json', cleanRaces)
				break
			}
			case 'tags': {
				await writeDataFile('tags/tags.json', globalTags.value)
				break
			}
			case 'items': {
				const equipmentList = []
				const otherList = []

				for (const item of entities.value.items) {
					const itemClone = { ...item }
					const isEquip = itemClone.type === 'equipment'
					delete itemClone.type // strip runtime helper tag
					if (isEquip) {
						equipmentList.push(itemClone)
					} else {
						otherList.push(itemClone)
					}
				}

				await Promise.all([
					writeDataFile('items/equipment.json', equipmentList),
					writeDataFile('items/other.json', otherList)
				])
				break
			}
		}
	}

	// Normalize data before saving
	function normalizeEntity(type, raw) {
		const copy = JSON.parse(JSON.stringify(raw))
		copy.id = String(copy.id).trim()
		copy.name = String(copy.name || '').trim()

		// Ensure tags is an array of strings
		if (typeof copy.tags === 'string') {
			copy.tags = copy.tags
				.split(',')
				.map((s) => s.trim().toLowerCase())
				.filter(Boolean)
		} else if (!Array.isArray(copy.tags)) {
			copy.tags = []
		} else {
			copy.tags = copy.tags.map((s) => String(s).trim().toLowerCase()).filter(Boolean)
		}

		if (type === 'characters') {
			if (typeof copy.names === 'string') {
				copy.names = copy.names
					.split(',')
					.map((s) => s.trim())
					.filter(Boolean)
			} else if (!Array.isArray(copy.names)) {
				copy.names = []
			}
			copy.gender = ['male', 'female', 'genderless', 'hermaphrodite'].includes(copy.gender)
				? copy.gender
				: 'male'
			copy.races = Array.isArray(copy.races) ? copy.races : []
			copy.classs = Array.isArray(copy.classs) ? copy.classs : []
			copy.fractions = Array.isArray(copy.fractions) ? copy.fractions : []

			if (Array.isArray(copy.talents)) {
				copy.talents = copy.talents.map((t) => String(t).trim()).filter(Boolean)
				if (copy.talents.length === 0) delete copy.talents
			} else if (typeof copy.talents === 'string') {
				copy.talents = copy.talents.split(',').map((t) => t.trim()).filter(Boolean)
				if (copy.talents.length === 0) delete copy.talents
			} else {
				delete copy.talents
			}
		}

		if (type === 'classes' || type === 'races') {
			if (copy.lvl_min !== undefined) copy.lvl_min = Number(copy.lvl_min) || 1
			if (copy.parent_id === '') copy.parent_id = null

			if (copy.grid_tier !== undefined && copy.grid_tier !== null && copy.grid_tier !== '') {
				const parsedTier = parseInt(copy.grid_tier, 10)
				if (!isNaN(parsedTier) && parsedTier >= 0) {
					copy.grid_tier = parsedTier
				} else {
					delete copy.grid_tier
				}
			} else {
				delete copy.grid_tier
			}

			// Auto-inheritance of category from parent if parent_id exists
			if (copy.parent_id) {
				const parentItem = entities.value[type]?.find((item) => item.id === copy.parent_id)
				if (parentItem?.category) {
					copy.category = parentItem.category
				}
			}

			// Validate category fallbacks if not inherited or if root
			if (type === 'classes') {
				const validClassCats = ['combat', 'social', 'craft']
				if (!validClassCats.includes(copy.category)) {
					copy.category = 'combat'
				}
			} else if (type === 'races') {
				const validRaceCats = ['humanoid', 'demi-human', 'heteromorphic']
				if (!validRaceCats.includes(copy.category)) {
					copy.category = 'humanoid'
				}
				if (copy.family !== undefined) {
					copy.family = copy.family ? String(copy.family).trim() : null
				} else if (copy.parent_id) {
					const parentItem = entities.value.races?.find((item) => item.id === copy.parent_id)
					if (parentItem?.family) {
						copy.family = parentItem.family
					}
				}
			}

			if (Array.isArray(copy.skill_branches) && copy.skill_branches.length > 0) {
				copy.skill_branches = copy.skill_branches.map(normalizeSkillBranch)
			} else {
				delete copy.skill_branches
			}

			if (Array.isArray(copy.skills) && copy.skills.length > 0) {
				copy.skills = copy.skills.map(normalizeSkill)
			} else {
				delete copy.skills
			}
		}

		if (type === 'fractions') {
			if (copy.parent_id === '') copy.parent_id = null

			if (copy.grid_tier !== undefined && copy.grid_tier !== null && copy.grid_tier !== '') {
				const parsedTier = parseInt(copy.grid_tier, 10)
				if (!isNaN(parsedTier) && parsedTier >= 0) {
					copy.grid_tier = parsedTier
				} else {
					delete copy.grid_tier
				}
			} else {
				delete copy.grid_tier
			}

			if (copy.parent_id && !copy.type) {
				const parentItem = entities.value.fractions?.find((item) => item.id === copy.parent_id)
				if (parentItem?.type) {
					copy.type = parentItem.type
				}
			}
		}

		if (type === 'items') {
			if (copy.weight !== undefined) copy.weight = parseFloat(copy.weight) || 0
			if (copy.lvl !== undefined) copy.lvl = parseInt(copy.lvl, 10) || 1
			copy.stackable = !!copy.stackable

			// Support legacy "class" or "classes" -> normalize to "classs"
			const rawClass = copy.classs || copy.classes || copy.class
			copy.classs = Array.isArray(rawClass) ? rawClass.filter(Boolean) : []
			delete copy.class
			delete copy.classes

			copy.characters = Array.isArray(copy.characters) ? copy.characters.filter(Boolean) : []
			copy.races = Array.isArray(copy.races) ? copy.races.filter(Boolean) : []
			copy.genders = Array.isArray(copy.genders)
				? copy.genders.filter((g) => ['male', 'female', 'genderless', 'hermaphrodite'].includes(g))
				: []

			// Categories
			copy.categories = Array.isArray(copy.categories)
				? copy.categories.map((c) => String(c).trim()).filter(Boolean)
				: []

			// Rarity
			if (copy.rarity) {
				copy.rarity = String(copy.rarity).trim().toLowerCase()
			}

			// Skills
			if (Array.isArray(copy.skills)) {
				copy.skills = copy.skills.map((s) => String(s).trim()).filter(Boolean)
				if (copy.skills.length === 0) delete copy.skills
			} else if (typeof copy.skills === 'string') {
				copy.skills = copy.skills.split(',').map((s) => s.trim()).filter(Boolean)
				if (copy.skills.length === 0) delete copy.skills
			} else {
				delete copy.skills
			}

			// Omit empty arrays to avoid cluttering JSON as requested
			if (copy.characters.length === 0) delete copy.characters
			if (copy.races.length === 0) delete copy.races
			if (copy.classs.length === 0) delete copy.classs
			if (copy.genders.length === 0) delete copy.genders
			if (copy.categories.length === 0) delete copy.categories
		}

		delete copy._customFields
		return copy
	}

	function getTypeLabel(type) {
		switch (type) {
			case 'characters':
				return 'Персонаж'
			case 'classes':
				return 'Класс'
			case 'fractions':
				return 'Фракция'
			case 'races':
				return 'Раса'
			case 'items':
				return 'Предмет'
			case 'tags':
				return 'Тег'
			default:
				return 'Запись'
		}
	}

	function getFilePathForType(type = activeTab.value) {
		switch (type) {
			case 'characters':
				return 'characters/<id>/values.json (+ characters.json)'
			case 'classes':
				return 'classes/classes.json (+ skills/classes/<id>.json)'
			case 'fractions':
				return 'fractions/fractions.json'
			case 'races':
				return 'races/races.json (+ skills/races/<id>.json)'
			case 'items':
				return 'items/equipment.json & other.json'
			case 'tags':
				return 'tags/tags.json'
			default:
				return ''
		}
	}

	function switchLocale(newLang) {
		if (availableLocales.value.some((l) => l.code === newLang)) {
			activeLocale.value = newLang
		}
	}

	function addLocale({ code, label, flag }) {
		const cleanCode = String(code || '').trim().toLowerCase()
		if (!cleanCode) throw new Error('Код языка не может быть пустым')
		if (!/^[a-z]{2,5}(-[a-z0-9]+)?$/i.test(cleanCode)) {
			throw new Error('Код языка должен состоять из 2-5 латинских букв (например: ru, en, ja, zh)')
		}
		const existing = availableLocales.value.find((l) => l.code === cleanCode)
		if (existing) {
			activeLocale.value = cleanCode
			return existing
		}
		const newLocale = {
			code: cleanCode,
			label: String(label || cleanCode.toUpperCase()).trim(),
			flag: String(flag || '🌐').trim()
		}
		availableLocales.value.push(newLocale)
		if (!localesData.value[cleanCode]) {
			localesData.value[cleanCode] = { characters: {}, classes: {}, fractions: {}, races: {}, items: {} }
		}
		// Persist updated locales registry to locales/locales.json
		writeDataFile('locales/locales.json', availableLocales.value).catch((err) => {
			console.warn('[useDataEditor] Не удалось сохранить locales.json:', err)
		})
		activeLocale.value = cleanCode
		setStatus(`✔ Язык «${newLocale.label}» (${cleanCode}) добавлен в проект!`)
		return newLocale
	}

	function getEntityText(type, id, field = 'name', lang = activeLocale.value) {
		if (!type || !id) return field === 'names' ? [] : ''
		// 1. Check target language
		const targetVal = localesData.value[lang]?.[type]?.[id]?.[field]
		if (targetVal !== undefined && targetVal !== null && targetVal !== '') {
			return targetVal
		}
		// 2. Fallback to Russian (ru)
		if (lang !== 'ru') {
			const ruVal = localesData.value.ru?.[type]?.[id]?.[field]
			if (ruVal !== undefined && ruVal !== null && ruVal !== '') {
				return ruVal
			}
		}
		// 3. Fallback to entity direct property
		const ent = entities.value[type]?.find((x) => x.id === id)
		if (ent && ent[field] !== undefined && ent[field] !== null && ent[field] !== '') {
			return ent[field]
		}
		// 4. Default for name is id
		if (field === 'name') return id
		if (field === 'names') return []
		return ''
	}

	function hasLocaleTranslation(type, id, field = 'name', lang = activeLocale.value) {
		if (!type || !id) return false
		const val = localesData.value[lang]?.[type]?.[id]?.[field]
		if (Array.isArray(val)) return val.length > 0
		return val !== undefined && val !== null && String(val).trim() !== ''
	}

	// Relations getters with localization support
	function getRaceName(raceId, lang = activeLocale.value) {
		return getEntityText('races', raceId, 'name', lang)
	}

	function getClassName(classId, lang = activeLocale.value) {
		return getEntityText('classes', classId, 'name', lang)
	}

	function getFactionName(factionId, lang = activeLocale.value) {
		return getEntityText('fractions', factionId, 'name', lang)
	}

	function getCharacterName(charId, lang = activeLocale.value) {
		return getEntityText('characters', charId, 'name', lang)
	}

	function getItemCategoryName(catId, lang = activeLocale.value) {
		if (!catId) return ''
		const targetVal = localesData.value[lang]?.item_categories?.[catId]
		if (targetVal) return targetVal
		if (lang !== 'ru' && localesData.value.ru?.item_categories?.[catId]) {
			return localesData.value.ru.item_categories[catId]
		}
		const cat = itemCategories.value.find((c) => c.id === catId)
		return cat ? (cat.icon ? `${cat.icon} ${cat.name}` : cat.name) : catId
	}

	// -------------------------------------------------------------------
	// INHERITED & COMBINED CHARACTER TAGS
	// -------------------------------------------------------------------
	function getCharacterInheritedTags(char) {
		if (!char) return []
		const result = []

		// Tags from linked races
		const raceIds = Array.isArray(char.races) ? char.races : []
		for (const rId of raceIds) {
			const race = entities.value.races.find((r) => r.id === rId)
			if (race && Array.isArray(race.tags)) {
				const rName = getRaceName(race.id)
				for (const t of race.tags) {
					result.push({
						tag: t,
						sourceType: 'race',
						sourceId: race.id,
						sourceName: rName,
						sourceIcon: race.icon || '🧬'
					})
				}
			}
		}

		// Tags from linked classes
		const classIds = Array.isArray(char.classs) ? char.classs : []
		for (const cId of classIds) {
			const cls = entities.value.classes.find((c) => c.id === cId)
			if (cls && Array.isArray(cls.tags)) {
				const cName = getClassName(cls.id)
				for (const t of cls.tags) {
					result.push({
						tag: t,
						sourceType: 'class',
						sourceId: cls.id,
						sourceName: cName,
						sourceIcon: cls.icon || '⚔️'
					})
				}
			}
		}

		// Tags from linked fractions
		const fractionIds = Array.isArray(char.fractions) ? char.fractions : []
		for (const fId of fractionIds) {
			const frac = entities.value.fractions.find((f) => f.id === fId)
			if (frac && Array.isArray(frac.tags)) {
				const fName = getFactionName(frac.id)
				for (const t of frac.tags) {
					result.push({
						tag: t,
						sourceType: 'fraction',
						sourceId: frac.id,
						sourceName: fName,
						sourceIcon: frac.icon || '🏛️'
					})
				}
			}
		}

		return result
	}

	// Combined unique list of character tags (own + inherited without duplicates)
	function getCharacterCombinedTags(char) {
		if (!char) return []
		const ownTags = Array.isArray(char.tags) ? char.tags : []
		const inheritedTagStrings = getCharacterInheritedTags(char).map((item) => item.tag)
		// Unique deduplicated list
		return Array.from(new Set([...ownTags, ...inheritedTagStrings]))
	}

	// Count how many entities across the project use a specific tag
	function getTagUsageCount(tag) {
		if (!tag) return 0
		let count = 0
		const collections = [
			entities.value.characters,
			entities.value.classes,
			entities.value.fractions,
			entities.value.races,
			entities.value.items
		]
		for (const coll of collections) {
			for (const item of coll) {
				if (Array.isArray(item.tags) && item.tags.includes(tag)) {
					count++
				}
			}
		}
		return count
	}

	// Filtered list based on search query (searches across ID, tags, description, and localized names)
	const filteredList = computed(() => {
		const q = searchQuery.value.trim().toLowerCase()

		if (activeTab.value === 'tags') {
			if (!q) return globalTags.value
			return globalTags.value.filter((t) => t.toLowerCase().includes(q))
		}

		const list = entities.value[activeTab.value] || []
		if (!q) return list

		return list.filter((item) => {
			const id = (item.id || '').toLowerCase()
			const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : ''
			const rawName = (item.name || '').toLowerCase()
			const rawDesc = (item.description || '').toLowerCase()

			// Check localized text across languages (active, ru, en)
			const nameActive = (getEntityText(activeTab.value, item.id, 'name', activeLocale.value) || '').toLowerCase()
			const descActive = (getEntityText(activeTab.value, item.id, 'description', activeLocale.value) || '').toLowerCase()
			const nameRu = (getEntityText(activeTab.value, item.id, 'name', 'ru') || '').toLowerCase()
			const descRu = (getEntityText(activeTab.value, item.id, 'description', 'ru') || '').toLowerCase()
			const nameEn = (getEntityText(activeTab.value, item.id, 'name', 'en') || '').toLowerCase()
			const descEn = (getEntityText(activeTab.value, item.id, 'description', 'en') || '').toLowerCase()

			const charNames =
				activeTab.value === 'characters'
					? [
							...(Array.isArray(item.names) ? item.names : []),
							...(Array.isArray(localesData.value.ru?.characters?.[item.id]?.names)
								? localesData.value.ru.characters[item.id].names
								: []),
							...(Array.isArray(localesData.value.en?.characters?.[item.id]?.names)
								? localesData.value.en.characters[item.id].names
								: [])
					  ]
							.join(' ')
							.toLowerCase()
					: ''

			return (
				id.includes(q) ||
				tags.includes(q) ||
				rawName.includes(q) ||
				rawDesc.includes(q) ||
				nameActive.includes(q) ||
				descActive.includes(q) ||
				nameRu.includes(q) ||
				descRu.includes(q) ||
				nameEn.includes(q) ||
				descEn.includes(q) ||
				charNames.includes(q)
			)
		})
	})

	const counts = computed(() => ({
		characters: entities.value.characters.length,
		classes: entities.value.classes.length,
		fractions: entities.value.fractions.length,
		races: entities.value.races.length,
		items: entities.value.items.length,
		tags: globalTags.value.length
	}))

	// Known standard keys per type to identify custom/manual JSON fields
	const STANDARD_KEYS = {
		characters: [
			'id',
			'name',
			'surname',
			'nickname',
			'title',
			'names',
			'icon',
			'gender',
			'race',
			'races',
			'classs',
			'fractions',
			'tags',
			'talents',
			'description',
			'size',
			'lvl',
			'exp',
			'hpmax',
			'mpmax',
			'attack',
			'defense',
			'weight',
			'hp',
			'mp',
			'skill_points',
			'stat_points',
			'equipment_slots',
			'inventory',
			'abilities',
			'skills',
			'class_levels',
			'race_levels'
		],
		classes: ['id', 'name', 'icon', 'parent_id', 'category', 'tier', 'grid_tier', 'skill_points_per_level', 'spell_points_per_level', 'tags', 'lvl_min', 'description', 'skill_branches', 'skills'],
		fractions: ['id', 'name', 'icon', 'type', 'parent_id', 'grid_tier', 'tags', 'description'],
		races: ['id', 'name', 'icon', 'parent_id', 'family', 'category', 'tier', 'grid_tier', 'skill_points_per_level', 'spell_points_per_level', 'tags', 'lvl_min', 'description', 'skill_branches', 'skills'],
		items: [
			'id',
			'name',
			'type',
			'rarity',
			'categories',
			'slot',
			'sprite',
			'icon',
			'weight',
			'stackable',
			'lvl',
			'lvl_min',
			'characters',
			'races',
			'classs',
			'class',
			'classes',
			'genders',
			'tags',
			'skills',
			'description'
		],
		tags: []
	}

	function getCustomFieldsObject(entity, type = activeTab.value) {
		if (!entity || typeof entity !== 'object') return {}
		const standard = STANDARD_KEYS[type] || []
		const ignored = [...standard, '_locales', '_customFields']
		const custom = {}
		for (const key of Object.keys(entity)) {
			if (!ignored.includes(key)) {
				custom[key] = entity[key]
			}
		}
		return custom
	}

	function getCustomFields(entity, type = activeTab.value) {
		const obj = getCustomFieldsObject(entity, type)
		return Object.entries(obj).map(([key, value]) => ({ key, value }))
	}

	// -------------------------------------------------------------------
	// HIERARCHICAL REORDERING & TREE STRUCTURE
	// -------------------------------------------------------------------
	function isHierarchicalType(type = activeTab.value) {
		return ['classes', 'races', 'fractions'].includes(type)
	}

	function isChildItem(item, type = activeTab.value) {
		if (!item || !item.parent_id) return false
		const list = entities.value[type] || []
		return list.some((p) => p.id === item.parent_id)
	}

	function getItemDepth(item, type = activeTab.value, visited = new Set()) {
		if (!item || !item.parent_id || visited.has(item.id)) return 0
		visited.add(item.id)
		const list = entities.value[type] || []
		const parent = list.find((p) => p.id === item.parent_id)
		if (!parent) return 0
		return 1 + getItemDepth(parent, type, visited)
	}

	function getParentEntity(item, type = activeTab.value) {
		if (!item || !item.parent_id) return null
		const list = entities.value[type] || []
		return list.find((p) => p.id === item.parent_id) || null
	}

	function buildHierarchicalOrder(items) {
		if (!Array.isArray(items) || items.length === 0) return []

		const itemMap = new Map()
		const childrenMap = new Map()

		for (const item of items) {
			itemMap.set(item.id, item)
			childrenMap.set(item.id, [])
		}

		const rootItems = []
		const orphanItems = []

		for (const item of items) {
			const pid = item.parent_id
			if (!pid) {
				rootItems.push(item)
			} else if (itemMap.has(pid)) {
				childrenMap.get(pid).push(item)
			} else {
				orphanItems.push(item)
			}
		}

		const result = []
		const visited = new Set()

		function appendWithChildren(item) {
			if (visited.has(item.id)) return
			visited.add(item.id)
			result.push(item)

			const children = childrenMap.get(item.id) || []
			for (const child of children) {
				appendWithChildren(child)
			}
		}

		for (const root of rootItems) {
			appendWithChildren(root)
		}

		for (const orphan of orphanItems) {
			if (!visited.has(orphan.id)) {
				appendWithChildren(orphan)
			}
		}

		for (const item of items) {
			if (!visited.has(item.id)) {
				appendWithChildren(item)
			}
		}

		return result
	}

	function getItemSubtree(list, itemId) {
		const result = []
		const item = list.find((it) => it.id === itemId)
		if (!item) return result

		function collect(current) {
			result.push(current)
			const children = list.filter((it) => it.parent_id === current.id)
			for (const ch of children) {
				collect(ch)
			}
		}
		collect(item)
		return result
	}

	function canMoveItemUp(item, index, type = activeTab.value) {
		if (searchQuery.value) return false
		if (type === 'tags') return index > 0

		const list = entities.value[type] || []
		if (index <= 0 || index >= list.length) return false

		if (!isHierarchicalType(type)) {
			return index > 0
		}

		const isChild = isChildItem(item, type)
		if (isChild) {
			const siblings = list.filter((it) => it.parent_id === item.parent_id)
			const siblingIndex = siblings.findIndex((it) => it.id === item.id)
			return siblingIndex > 0
		} else {
			const roots = list.filter((it) => !isChildItem(it, type))
			const rootIndex = roots.findIndex((it) => it.id === item.id)
			return rootIndex > 0
		}
	}

	function canMoveItemDown(item, index, type = activeTab.value) {
		if (searchQuery.value) return false
		if (type === 'tags') return index < globalTags.value.length - 1

		const list = entities.value[type] || []
		if (index < 0 || index >= list.length - 1) return false

		if (!isHierarchicalType(type)) {
			return index < list.length - 1
		}

		const isChild = isChildItem(item, type)
		if (isChild) {
			const siblings = list.filter((it) => it.parent_id === item.parent_id)
			const siblingIndex = siblings.findIndex((it) => it.id === item.id)
			return siblingIndex < siblings.length - 1
		} else {
			const roots = list.filter((it) => !isChildItem(it, type))
			const rootIndex = roots.findIndex((it) => it.id === item.id)
			return rootIndex < roots.length - 1
		}
	}

	async function moveItemUp(type = activeTab.value, indexOrItem) {
		const targetType = type || activeTab.value
		if (targetType === 'tags') {
			const idx = typeof indexOrItem === 'number' ? indexOrItem : globalTags.value.indexOf(indexOrItem)
			return moveTagUp(idx)
		}

		const list = entities.value[targetType]
		if (!list || list.length === 0) return false

		let item, index
		if (typeof indexOrItem === 'number') {
			index = indexOrItem
			item = list[index]
		} else {
			item = indexOrItem
			index = list.findIndex((it) => it.id === item.id)
		}

		if (!canMoveItemUp(item, index, targetType)) return false

		if (!isHierarchicalType(targetType)) {
			const temp = list[index]
			list[index] = list[index - 1]
			list[index - 1] = temp
		} else {
			const isChild = isChildItem(item, targetType)
			if (isChild) {
				const siblings = list.filter((it) => it.parent_id === item.parent_id)
				const sIdx = siblings.findIndex((it) => it.id === item.id)
				if (sIdx <= 0) return false
				const prevSibling = siblings[sIdx - 1]

				const currSubtree = getItemSubtree(list, item.id)
				const currIds = new Set(currSubtree.map((x) => x.id))

				const filtered = list.filter((x) => !currIds.has(x.id))
				const targetPos = filtered.findIndex((x) => x.id === prevSibling.id)
				filtered.splice(targetPos, 0, ...currSubtree)
				entities.value[targetType] = filtered
			} else {
				const roots = list.filter((it) => !isChildItem(it, targetType))
				const rIdx = roots.findIndex((it) => it.id === item.id)
				if (rIdx <= 0) return false
				const prevRoot = roots[rIdx - 1]

				const currSubtree = getItemSubtree(list, item.id)
				const currIds = new Set(currSubtree.map((x) => x.id))

				const filtered = list.filter((x) => !currIds.has(x.id))
				const targetPos = filtered.findIndex((x) => x.id === prevRoot.id)
				filtered.splice(targetPos, 0, ...currSubtree)
				entities.value[targetType] = filtered
			}
		}

		await persistTypeToFile(targetType)
		setStatus(`✔ Порядок обновлён и сохранён в ${getFilePathForType(targetType)}`)
		return true
	}

	async function moveItemDown(type = activeTab.value, indexOrItem) {
		const targetType = type || activeTab.value
		if (targetType === 'tags') {
			const idx = typeof indexOrItem === 'number' ? indexOrItem : globalTags.value.indexOf(indexOrItem)
			return moveTagDown(idx)
		}

		const list = entities.value[targetType]
		if (!list || list.length === 0) return false

		let item, index
		if (typeof indexOrItem === 'number') {
			index = indexOrItem
			item = list[index]
		} else {
			item = indexOrItem
			index = list.findIndex((it) => it.id === item.id)
		}

		if (!canMoveItemDown(item, index, targetType)) return false

		if (!isHierarchicalType(targetType)) {
			const temp = list[index]
			list[index] = list[index + 1]
			list[index + 1] = temp
		} else {
			const isChild = isChildItem(item, targetType)
			if (isChild) {
				const siblings = list.filter((it) => it.parent_id === item.parent_id)
				const sIdx = siblings.findIndex((it) => it.id === item.id)
				if (sIdx < 0 || sIdx >= siblings.length - 1) return false
				const nextSibling = siblings[sIdx + 1]

				const nextSubtree = getItemSubtree(list, nextSibling.id)
				const nextIds = new Set(nextSubtree.map((x) => x.id))

				const filtered = list.filter((x) => !nextIds.has(x.id))
				const targetPos = filtered.findIndex((x) => x.id === item.id)
				filtered.splice(targetPos, 0, ...nextSubtree)
				entities.value[targetType] = filtered
			} else {
				const roots = list.filter((it) => !isChildItem(it, targetType))
				const rIdx = roots.findIndex((it) => it.id === item.id)
				if (rIdx < 0 || rIdx >= roots.length - 1) return false
				const nextRoot = roots[rIdx + 1]

				const nextSubtree = getItemSubtree(list, nextRoot.id)
				const nextIds = new Set(nextSubtree.map((x) => x.id))

				const filtered = list.filter((x) => !nextIds.has(x.id))
				const targetPos = filtered.findIndex((x) => x.id === item.id)
				filtered.splice(targetPos, 0, ...nextSubtree)
				entities.value[targetType] = filtered
			}
		}

		await persistTypeToFile(targetType)
		setStatus(`✔ Порядок обновлён и сохранён в ${getFilePathForType(targetType)}`)
		return true
	}

	async function moveTagUp(index) {
		if (index <= 0 || index >= globalTags.value.length) return false
		const temp = globalTags.value[index]
		globalTags.value[index] = globalTags.value[index - 1]
		globalTags.value[index - 1] = temp
		await persistTypeToFile('tags')
		setStatus('✔ Порядок тегов сохранён в tags/tags.json')
		return true
	}

	async function moveTagDown(index) {
		if (index < 0 || index >= globalTags.value.length - 1) return false
		const temp = globalTags.value[index]
		globalTags.value[index] = globalTags.value[index + 1]
		globalTags.value[index + 1] = temp
		await persistTypeToFile('tags')
		setStatus('✔ Порядок тегов сохранён в tags/tags.json')
		return true
	}

	async function reorderItems(type = activeTab.value, fromIndex, toIndex) {
		const targetType = type || activeTab.value
		if (fromIndex === toIndex) return false
		if (targetType === 'tags') {
			if (fromIndex < 0 || fromIndex >= globalTags.value.length) return false
			if (toIndex < 0 || toIndex >= globalTags.value.length) return false
			const [moved] = globalTags.value.splice(fromIndex, 1)
			globalTags.value.splice(toIndex, 0, moved)
			await persistTypeToFile('tags')
			setStatus('✔ Порядок тегов сохранён в tags/tags.json')
			return true
		}

		const list = entities.value[targetType]
		if (!list || fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return false

		const [moved] = list.splice(fromIndex, 1)
		list.splice(toIndex, 0, moved)

		if (isHierarchicalType(targetType)) {
			entities.value[targetType] = buildHierarchicalOrder(list)
		}

		await persistTypeToFile(targetType)
		setStatus(`✔ Порядок обновлён и сохранён в ${getFilePathForType(targetType)}`)
		return true
	}

	return {
		activeTab,
		entities,
		globalTags,
		activeLocale,
		availableLocales,
		localesData,
		isLoading,
		selectedEntity,
		isCreating,
		searchQuery,
		basePath,
		statusMessage,
		filteredList,
		counts,
		init,
		loadAll,
		createEmptyEntity,
		normalizeEntity,
		startCreate,
		startEdit,
		cancelEdit,
		saveEntity,
		deleteEntity,
		persistTypeToFile,
		addGlobalTag,
		deleteGlobalTag,
		getCharacterInheritedTags,
		getCharacterCombinedTags,
		getTagUsageCount,
		getCustomFields,
		getRaceName,
		getClassName,
		getFactionName,
		getCharacterName,
		getEntityText,
		hasLocaleTranslation,
		switchLocale,
		addLocale,
		getTypeLabel,
		getFilePathForType,
		isHierarchicalType,
		isChildItem,
		getItemDepth,
		getParentEntity,
		buildHierarchicalOrder,
		canMoveItemUp,
		canMoveItemDown,
		moveItemUp,
		moveItemDown,
		moveTagUp,
		moveTagDown,
		reorderItems,
		setStatus,
		GENDER_OPTIONS,
		EQUIPMENT_SLOTS_LIST,
		getGenderLabel,
		getGenderIcon,
		getGenderOption,
		getSlotDisplayName,
		getCustomFieldsObject,
		STANDARD_KEYS,
		itemCategories,
		getItemCategoryName,
		itemSkills,
		saveItemSkill,
		deleteItemSkill,
		persistItemSkills,
		talents,
		saveTalent,
		deleteTalent,
		persistTalents,
		skillsCatalog,
		saveSkillToCatalog,
		deleteSkillFromCatalog,
		persistSkillsCatalog,
		ITEM_RARITIES,
		getRarity,
		getRarityColor,
		getRarityBadgeStyle
	}
}
