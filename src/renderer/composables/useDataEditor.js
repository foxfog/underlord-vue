// src/renderer/composables/useDataEditor.js
import { ref, computed } from 'vue'
import { ITEM_RARITIES, getRarity, getRarityColor, getRarityBadgeStyle } from '../constants/rarity.js'

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

	// Load all collections and global tags
	async function loadAll() {
		const [chars, classes, fractions, races, equipItems, otherItems, tagsList, categoriesList] = await Promise.all([
			readDataFile('characters/characters_data.json'),
			readDataFile('classes/classes.json'),
			readDataFile('fractions/fractions.json'),
			readDataFile('races/races.json'),
			readDataFile('items/equipment.json'),
			readDataFile('items/other.json'),
			readDataFile('tags/tags.json'),
			readDataFile('items/categories.json')
		])

		// Classes
		entities.value.classes = buildHierarchicalOrder(Array.isArray(classes) ? classes : [])

		// Fractions
		entities.value.fractions = buildHierarchicalOrder(Array.isArray(fractions) ? fractions : [])

		// Races
		entities.value.races = buildHierarchicalOrder(Array.isArray(races) ? races : [])

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
					names: [],
					icon: '',
					gender: 'male',
					races: [],
					classs: [],
					fractions: [],
					tags: [],
					description: ''
				}
			case 'classes':
				return {
					id: '',
					name: '',
					icon: '⚔️',
					parent_id: null,
					tags: [],
					lvl_min: 1,
					description: ''
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
					category: 'humanoid',
					tags: [],
					lvl_min: 1,
					description: ''
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

	function startCreate() {
		const newEntity = createEmptyEntity(activeTab.value)
		const _loc = {}
		for (const l of availableLocales.value) {
			_loc[l.code] = {
				name: '',
				description: '',
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

	// Persist changes for a specific entity type to disk
	async function persistTypeToFile(targetType) {
		switch (targetType) {
			case 'characters': {
				// 1. Save full characters data (only own tags are saved in characters_data.json)
				await writeDataFile('characters/characters_data.json', entities.value.characters)

				// 2. Keep characters.json list of IDs synchronized for novel engine
				const currentIds = entities.value.characters.map((c) => c.id)
				await writeDataFile('characters/characters.json', { characters: currentIds })
				break
			}
			case 'classes': {
				await writeDataFile('classes/classes.json', entities.value.classes)
				break
			}
			case 'fractions': {
				await writeDataFile('fractions/fractions.json', entities.value.fractions)
				break
			}
			case 'races': {
				await writeDataFile('races/races.json', entities.value.races)
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
		}

		if (type === 'classes' || type === 'races') {
			if (copy.lvl_min !== undefined) copy.lvl_min = Number(copy.lvl_min) || 1
			if (copy.parent_id === '') copy.parent_id = null
		}

		if (type === 'fractions') {
			if (copy.parent_id === '') copy.parent_id = null
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
				return 'characters/characters_data.json'
			case 'classes':
				return 'classes/classes.json'
			case 'fractions':
				return 'fractions/fractions.json'
			case 'races':
				return 'races/races.json'
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
		characters: ['id', 'name', 'names', 'icon', 'gender', 'races', 'classs', 'fractions', 'tags', 'description'],
		classes: ['id', 'name', 'icon', 'parent_id', 'tags', 'lvl_min', 'description'],
		fractions: ['id', 'name', 'icon', 'type', 'parent_id', 'tags', 'description'],
		races: ['id', 'name', 'icon', 'parent_id', 'category', 'tags', 'lvl_min', 'description'],
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
		startCreate,
		startEdit,
		cancelEdit,
		saveEntity,
		deleteEntity,
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
		ITEM_RARITIES,
		getRarity,
		getRarityColor,
		getRarityBadgeStyle
	}
}
