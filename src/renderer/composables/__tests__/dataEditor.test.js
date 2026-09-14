import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDataEditor } from '../useDataEditor'

describe('useDataEditor Composable', () => {
	let editor

	beforeEach(() => {
		editor = useDataEditor()
		// Reset state
		editor.activeTab.value = 'characters'
		editor.entities.value = {
			characters: [
				{
					id: 'mc',
					name: 'Анон Фокс',
					names: ['Анон', 'Игрок'],
					icon: 'images/sprites/characters/mc/char.png',
					races: ['human'],
					classs: ['warrior'],
					fractions: [],
					tags: ['gamer'],
					description: 'Главный герой'
				}
			],
			classes: [
				{
					id: 'warrior',
					name: 'Воин',
					icon: '⚔️',
					parent_id: null,
					tags: ['melee'],
					lvl_min: 1,
					description: 'Боец ближнего боя'
				},
				{
					id: 'paladin',
					name: 'Паладин',
					icon: '🛡️',
					parent_id: 'warrior',
					tags: ['melee', 'holy'],
					lvl_min: 5,
					description: 'Священный рыцарь'
				}
			],
			fractions: [
				{
					id: 'nazaric',
					name: 'Назарик',
					icon: '🏰',
					type: 'stronghold',
					parent_id: null,
					tags: ['dungeon'],
					description: 'Гробница'
				}
			],
			races: [
				{
					id: 'human',
					name: 'Человек',
					icon: '👤',
					parent_id: null,
					category: 'humanoid',
					tags: ['humanoid'],
					lvl_min: 1,
					description: 'Обычный человек'
				},
				{
					id: 'undead',
					name: 'Нежить',
					icon: '💀',
					parent_id: null,
					category: 'heteromorphic',
					tags: ['undead'],
					lvl_min: 1,
					description: 'Мертвецы'
				},
				{
					id: 'sceleton',
					name: 'Скелет',
					icon: '🦴',
					parent_id: 'undead',
					category: 'heteromorphic',
					tags: ['skeleton'],
					lvl_min: 1,
					description: 'Костяной воин'
				}
			],
			items: [
				{
					id: 'sword-diamond',
					name: 'Алмазный меч',
					type: 'equipment',
					slot: 'weapon-hand-1',
					weight: 1.5,
					stackable: false,
					tags: ['weapon'],
					description: 'Острый меч'
				},
				{
					id: 'potion-heal',
					name: 'Зелье лечения',
					type: 'other',
					weight: 0.2,
					stackable: true,
					tags: ['consumable'],
					description: 'Лечебный эликсир'
				}
			]
		}
		editor.cancelEdit()
		editor.searchQuery.value = ''
	})

	it('counts entities accurately for all tabs', () => {
		expect(editor.counts.value.characters).toBe(1)
		expect(editor.counts.value.classes).toBe(2)
		expect(editor.counts.value.fractions).toBe(1)
		expect(editor.counts.value.races).toBe(3)
		expect(editor.counts.value.items).toBe(2)
	})

	it('filters entities by name, ID, or tags', () => {
		editor.activeTab.value = 'classes'
		editor.searchQuery.value = 'Паладин'
		expect(editor.filteredList.value).toHaveLength(1)
		expect(editor.filteredList.value[0].id).toBe('paladin')

		editor.searchQuery.value = 'melee'
		expect(editor.filteredList.value).toHaveLength(2)

		editor.searchQuery.value = 'non-existent'
		expect(editor.filteredList.value).toHaveLength(0)
	})

	it('creates default empty entity objects for each type', () => {
		const char = editor.createEmptyEntity('characters')
		expect(char.id).toBe('')
		expect(Array.isArray(char.races)).toBe(true)
		expect(Array.isArray(char.classs)).toBe(true)
		expect(Array.isArray(char.fractions)).toBe(true)

		const cls = editor.createEmptyEntity('classes')
		expect(cls.lvl_min).toBe(1)
		expect(cls.parent_id).toBeNull()

		const race = editor.createEmptyEntity('races')
		expect(race.category).toBe('humanoid')

		const item = editor.createEmptyEntity('items')
		expect(item.type).toBe('equipment')
		expect(item.stackable).toBe(false)
	})

	it('resolves relational entity names correctly', () => {
		expect(editor.getRaceName('human')).toBe('Человек')
		expect(editor.getRaceName('unknown_race')).toBe('unknown_race')

		expect(editor.getClassName('warrior')).toBe('Воин')
		expect(editor.getFactionName('nazaric')).toBe('Назарик')
		expect(editor.getCharacterName('mc')).toBe('Анон Фокс')
	})

	it('saves a new character with multiple races, classes, and fractions', async () => {
		editor.activeTab.value = 'characters'
		editor.startCreate()

		const newChar = {
			id: 'momonga',
			name: 'Момонга',
			names: ['Аинз Оал Гоун', 'Владыка Назарика'],
			icon: 'images/sprites/momonga.png',
			races: ['undead', 'sceleton'],
			classs: ['paladin', 'warrior'],
			fractions: ['nazaric'],
			tags: 'guildmaster, boss',
			description: 'Повелитель Назарика'
		}

		await editor.saveEntity('characters', newChar)

		expect(editor.entities.value.characters).toHaveLength(2)
		const saved = editor.entities.value.characters.find((c) => c.id === 'momonga')
		expect(saved).toBeDefined()
		expect(saved.races).toEqual(['undead', 'sceleton'])
		expect(saved.classs).toEqual(['paladin', 'warrior'])
		expect(saved.fractions).toEqual(['nazaric'])
		expect(saved.tags).toEqual(['guildmaster', 'boss'])
	})

	it('updates an existing class and validates parent_id', async () => {
		editor.activeTab.value = 'classes'
		const warrior = editor.entities.value.classes.find((c) => c.id === 'warrior')
		editor.startEdit(warrior)

		editor.selectedEntity.value.name = 'Великий Воин'
		editor.selectedEntity.value.lvl_min = '2'

		await editor.saveEntity('classes', editor.selectedEntity.value)

		const updated = editor.entities.value.classes.find((c) => c.id === 'warrior')
		expect(updated.name).toBe('Великий Воин')
		expect(updated.lvl_min).toBe(2)
	})

	it('rejects saving entity with empty or invalid ID', async () => {
		editor.activeTab.value = 'races'
		editor.startCreate()

		await expect(editor.saveEntity('races', { id: '', name: 'Test' })).rejects.toThrow(
			'ID сущности не может быть пустым'
		)

		await expect(
			editor.saveEntity('races', { id: 'invalid id with spaces', name: 'Test' })
		).rejects.toThrow('ID должен содержать только латинские буквы, цифры, дефис или подчеркивание')
	})

	it('rejects creating duplicate ID', async () => {
		editor.activeTab.value = 'characters'
		editor.startCreate()

		await expect(
			editor.saveEntity('characters', { id: 'mc', name: 'Duplicate MC' })
		).rejects.toThrow('Сущность с ID "mc" уже существует')
	})

	it('deletes an entity and cleans up selectedEntity if active', async () => {
		editor.activeTab.value = 'races'
		const sceleton = editor.entities.value.races.find((r) => r.id === 'sceleton')
		editor.startEdit(sceleton)
		expect(editor.selectedEntity.value.id).toBe('sceleton')

		await editor.deleteEntity('races', 'sceleton')

		expect(editor.entities.value.races.find((r) => r.id === 'sceleton')).toBeUndefined()
		expect(editor.selectedEntity.value).toBeNull()
		expect(editor.isCreating.value).toBe(false)
	})

	it('manages global tags registry and counts tag usage across entities', async () => {
		editor.globalTags.value = ['melee', 'magic', 'gamer']
		expect(editor.counts.value.tags).toBe(3)

		// Check usage count for 'melee' (used in warrior, paladin)
		const usage = editor.getTagUsageCount('melee')
		expect(usage).toBe(2)

		// Add new global tag
		await editor.addGlobalTag('stealth')
		expect(editor.globalTags.value).toContain('stealth')

		// Reject duplicate tag
		await expect(editor.addGlobalTag('stealth')).rejects.toThrow('уже существует')

		// Delete global tag
		await editor.deleteGlobalTag('stealth')
		expect(editor.globalTags.value).not.toContain('stealth')
	})

	it('calculates inherited tags from linked races, classes, and fractions for characters', () => {
		const testChar = {
			id: 'momonga',
			name: 'Момонга',
			races: ['undead', 'sceleton'], // races tags: undead, skeleton
			classs: ['paladin'], // paladin tags: melee, holy
			fractions: ['nazaric'], // nazaric tags: dungeon
			tags: ['gamer', 'boss'] // own tags
		}

		const inherited = editor.getCharacterInheritedTags(testChar)
		const inheritedTagNames = inherited.map((i) => i.tag)

		expect(inheritedTagNames).toContain('undead')
		expect(inheritedTagNames).toContain('skeleton')
		expect(inheritedTagNames).toContain('melee')
		expect(inheritedTagNames).toContain('holy')
		expect(inheritedTagNames).toContain('dungeon')

		// Check sources
		const raceTag = inherited.find((i) => i.tag === 'undead')
		expect(raceTag.sourceType).toBe('race')
		expect(raceTag.sourceName).toBe('Нежить')

		const classTag = inherited.find((i) => i.tag === 'holy')
		expect(classTag.sourceType).toBe('class')
		expect(classTag.sourceName).toBe('Паладин')
	})

	it('produces deduplicated combined tags for characters while preserving only own tags in data', async () => {
		// Suppose character has own tag 'melee' and race also has 'melee'
		const charWithDuplicateTag = {
			id: 'test_fighter',
			name: 'Боец',
			races: ['human'], // human tags: ['humanoid']
			classs: ['warrior'], // warrior tags: ['melee']
			fractions: [],
			tags: ['melee', 'champion'] // own tags includes 'melee' which duplicates warrior's tag
		}

		const combined = editor.getCharacterCombinedTags(charWithDuplicateTag)
		// Expect 'melee' to appear exactly once!
		const meleeOccurrences = combined.filter((t) => t === 'melee')
		expect(meleeOccurrences).toHaveLength(1)
		expect(combined).toEqual(expect.arrayContaining(['melee', 'champion', 'humanoid']))

		// Save character: only own tags must be saved in character entity!
		await editor.saveEntity('characters', charWithDuplicateTag)
		const saved = editor.entities.value.characters.find((c) => c.id === 'test_fighter')
		expect(saved.tags).toEqual(['melee', 'champion'])
		expect(saved.tags).not.toContain('humanoid') // Inherited tag is NOT polluted into saved JSON!
	})

	it('preserves extra manual JSON fields (e.g. points-per-lvl, baffes, custom_data) during edits and saving', async () => {
		editor.activeTab.value = 'races'
		// Add a race that contains extra custom fields in JSON
		const raceWithCustomData = {
			id: 'special_dragon',
			name: 'Дракон',
			category: 'heteromorphic',
			lvl_min: 20,
			tags: ['dragon', 'boss'],
			'points-per-lvl': { hp: 10, mp: 10, attack: 5, defense: 4 },
			baffes: { fire_resist: '100%', attack_bonus: '25%' },
			custom_lore_author: 'Game Master',
			nested_mechanics: { breath_cd: 3, flying: true }
		}
		editor.entities.value.races.push(raceWithCustomData)

		// Start editing this race in the UI
		editor.startEdit(raceWithCustomData)

		// Verify getCustomFields identifies them
		const customFields = editor.getCustomFields(editor.selectedEntity.value, 'races')
		const customKeys = customFields.map((cf) => cf.key)
		expect(customKeys).toContain('points-per-lvl')
		expect(customKeys).toContain('baffes')
		expect(customKeys).toContain('custom_lore_author')
		expect(customKeys).toContain('nested_mechanics')

		// Modify standard fields in the form
		editor.selectedEntity.value.name = 'Древний Дракон'
		editor.selectedEntity.value.description = 'Обновленное описание'

		// Save via editor
		await editor.saveEntity('races', editor.selectedEntity.value)

		// Verify saved entity in list has updated standard fields AND intact custom fields
		const saved = editor.entities.value.races.find((r) => r.id === 'special_dragon')
		expect(saved.name).toBe('Древний Дракон')
		expect(saved.description).toBe('Обновленное описание')

		// Custom fields are 100% preserved!
		expect(saved['points-per-lvl']).toEqual({ hp: 10, mp: 10, attack: 5, defense: 4 })
		expect(saved.baffes).toEqual({ fire_resist: '100%', attack_bonus: '25%' })
		expect(saved.custom_lore_author).toBe('Game Master')
		expect(saved.nested_mechanics).toEqual({ breath_cd: 3, flying: true })
	})

	it('buildHierarchicalOrder places child entities directly under their parent', () => {
		const rawClasses = [
			{ id: 'cleric', name: 'Жрец', parent_id: null },
			{ id: 'paladin', name: 'Паладин', parent_id: 'warrior' },
			{ id: 'warrior', name: 'Воин', parent_id: null },
			{ id: 'overlord', name: 'Повелитель', parent_id: 'mage' },
			{ id: 'mage', name: 'Маг', parent_id: null }
		]

		const ordered = editor.buildHierarchicalOrder(rawClasses)
		const ids = ordered.map((c) => c.id)

		// Paladin must follow warrior, and overlord must follow mage
		expect(ids).toEqual(['cleric', 'warrior', 'paladin', 'mage', 'overlord'])
	})

	it('correctly identifies child items and depth', () => {
		editor.activeTab.value = 'classes'
		const warrior = editor.entities.value.classes.find((c) => c.id === 'warrior')
		const paladin = editor.entities.value.classes.find((c) => c.id === 'paladin')

		expect(editor.isChildItem(warrior, 'classes')).toBe(false)
		expect(editor.isChildItem(paladin, 'classes')).toBe(true)

		expect(editor.getItemDepth(warrior, 'classes')).toBe(0)
		expect(editor.getItemDepth(paladin, 'classes')).toBe(1)
	})

	it('moves flat entities (characters, items) up and down', async () => {
		editor.activeTab.value = 'characters'
		editor.entities.value.characters = [
			{ id: 'c1', name: 'First' },
			{ id: 'c2', name: 'Second' },
			{ id: 'c3', name: 'Third' }
		]

		expect(editor.canMoveItemUp(editor.entities.value.characters[0], 0, 'characters')).toBe(false)
		expect(editor.canMoveItemUp(editor.entities.value.characters[1], 1, 'characters')).toBe(true)

		// Move c2 up
		await editor.moveItemUp('characters', 1)
		expect(editor.entities.value.characters.map((c) => c.id)).toEqual(['c2', 'c1', 'c3'])

		// Move c2 down
		await editor.moveItemDown('characters', 0)
		expect(editor.entities.value.characters.map((c) => c.id)).toEqual(['c1', 'c2', 'c3'])
	})

	it('moves hierarchical entities preserving child placement (root moves with its children)', async () => {
		editor.activeTab.value = 'classes'
		editor.entities.value.classes = [
			{ id: 'warrior', name: 'Воин', parent_id: null },
			{ id: 'paladin', name: 'Паладин', parent_id: 'warrior' },
			{ id: 'mage', name: 'Маг', parent_id: null },
			{ id: 'overlord', name: 'Повелитель', parent_id: 'mage' }
		]

		// Moving 'mage' (index 2) UP:
		// Mage (and its child Overlord) should move above Warrior (and its child Paladin)
		const mage = editor.entities.value.classes.find((c) => c.id === 'mage')
		expect(editor.canMoveItemUp(mage, 2, 'classes')).toBe(true)

		await editor.moveItemUp('classes', mage)
		const orderedIds = editor.entities.value.classes.map((c) => c.id)
		expect(orderedIds).toEqual(['mage', 'overlord', 'warrior', 'paladin'])
	})

	it('moves sibling children under the same parent', async () => {
		editor.activeTab.value = 'classes'
		editor.entities.value.classes = [
			{ id: 'warrior', name: 'Воин', parent_id: null },
			{ id: 'paladin', name: 'Паладин', parent_id: 'warrior' },
			{ id: 'berserker', name: 'Берсерк', parent_id: 'warrior' },
			{ id: 'cleric', name: 'Жрец', parent_id: null }
		]

		const berserker = editor.entities.value.classes.find((c) => c.id === 'berserker')
		expect(editor.canMoveItemUp(berserker, 2, 'classes')).toBe(true)

		// Move berserker up: swaps with paladin under warrior
		await editor.moveItemUp('classes', berserker)
		const orderedIds = editor.entities.value.classes.map((c) => c.id)
		expect(orderedIds).toEqual(['warrior', 'berserker', 'paladin', 'cleric'])
	})

	it('moves tags up and down in tags registry', async () => {
		editor.globalTags.value = ['alpha', 'beta', 'gamma']

		await editor.moveTagDown(0) // alpha moves down
		expect(editor.globalTags.value).toEqual(['beta', 'alpha', 'gamma'])

		await editor.moveTagUp(2) // gamma moves up
		expect(editor.globalTags.value).toEqual(['beta', 'gamma', 'alpha'])
	})

	it('handles localization with Russian default and fallback order', () => {
		editor.activeTab.value = 'classes'
		editor.localesData.value.ru.classes = {
			warrior: { name: 'Воин', description: 'Боец ближнего боя' }
		}
		editor.localesData.value.en.classes = {
			warrior: { name: 'Warrior', description: 'Melee fighter' }
		}

		// When activeLocale is 'ru'
		editor.activeLocale.value = 'ru'
		expect(editor.getEntityText('classes', 'warrior', 'name')).toBe('Воин')
		expect(editor.getEntityText('classes', 'warrior', 'description')).toBe('Боец ближнего боя')

		// When activeLocale is 'en'
		editor.activeLocale.value = 'en'
		expect(editor.getEntityText('classes', 'warrior', 'name')).toBe('Warrior')
		expect(editor.getEntityText('classes', 'warrior', 'description')).toBe('Melee fighter')

		// Fallback test: paladin has only Russian translation
		editor.localesData.value.ru.classes.paladin = { name: 'Паладин', description: 'Святой воин' }
		expect(editor.getEntityText('classes', 'paladin', 'name', 'en')).toBe('Паладин')
		expect(editor.hasLocaleTranslation('classes', 'paladin', 'name', 'en')).toBe(false)
		expect(editor.hasLocaleTranslation('classes', 'paladin', 'name', 'ru')).toBe(true)

		// Fallback to id if no translation anywhere
		expect(editor.getEntityText('classes', 'unknown_class', 'name', 'en')).toBe('unknown_class')
	})

	it('saves entity with multi-language _locales and writes to separate locale files', async () => {
		editor.activeTab.value = 'classes'
		editor.activeLocale.value = 'ru'
		editor.startCreate()

		editor.selectedEntity.value.id = 'archer'
		editor.selectedEntity.value._locales = {
			ru: { name: 'Лучник', description: 'Стрелок из лука' },
			en: { name: 'Archer', description: 'Ranged bow shooter' }
		}

		await editor.saveEntity('classes', editor.selectedEntity.value)

		// Check entities list has backward-compatible copy
		const archer = editor.entities.value.classes.find((c) => c.id === 'archer')
		expect(archer).toBeDefined()
		expect(archer.name).toBe('Лучник')
		expect(archer.description).toBe('Стрелок из лука')

		// Check localesData updated
		expect(editor.localesData.value.ru.classes.archer.name).toBe('Лучник')
		expect(editor.localesData.value.en.classes.archer.name).toBe('Archer')

		// Reading in English
		expect(editor.getEntityText('classes', 'archer', 'name', 'en')).toBe('Archer')
		expect(editor.getEntityText('classes', 'archer', 'description', 'en')).toBe('Ranged bow shooter')
	})

	it('deletes entity and removes it from both ru and en locale dictionaries', async () => {
		editor.activeTab.value = 'races'
		editor.localesData.value.ru.races.human = { name: 'Человек', description: 'Люди' }
		editor.localesData.value.en.races.human = { name: 'Human', description: 'Humans' }

		await editor.deleteEntity('races', 'human')

		expect(editor.entities.value.races.some((r) => r.id === 'human')).toBe(false)
		expect(editor.localesData.value.ru.races.human).toBeUndefined()
		expect(editor.localesData.value.en.races.human).toBeUndefined()
	})

	it('searches entities across russian, english, tags, and character synonyms', () => {
		editor.activeTab.value = 'characters'
		editor.localesData.value.ru.characters = {
			mc: {
				name: 'Анон Фокс',
				names: ['Игрок', 'Владыка'],
				description: 'Главный герой'
			}
		}
		editor.localesData.value.en.characters = {
			mc: {
				name: 'Anon Fox',
				names: ['Player', 'Overlord'],
				description: 'Protagonist'
			}
		}

		// Search by English name
		editor.searchQuery.value = 'Anon'
		expect(editor.filteredList.value.some((c) => c.id === 'mc')).toBe(true)

		// Search by Russian synonym
		editor.searchQuery.value = 'Владыка'
		expect(editor.filteredList.value.some((c) => c.id === 'mc')).toBe(true)

		// Search by English synonym
		editor.searchQuery.value = 'Overlord'
		expect(editor.filteredList.value.some((c) => c.id === 'mc')).toBe(true)

		// Search by English description
		editor.searchQuery.value = 'Protagonist'
		expect(editor.filteredList.value.some((c) => c.id === 'mc')).toBe(true)
	})

	it('switches activeLocale and updates relation names dynamically', () => {
		editor.localesData.value.ru.classes = {
			warrior: { name: 'Воин' }
		}
		editor.localesData.value.en.classes = {
			warrior: { name: 'Warrior' }
		}

		editor.switchLocale('ru')
		expect(editor.activeLocale.value).toBe('ru')
		expect(editor.getClassName('warrior')).toBe('Воин')

		editor.switchLocale('en')
		expect(editor.activeLocale.value).toBe('en')
		expect(editor.getClassName('warrior')).toBe('Warrior')
	})

	it('adds new locale dynamically with addLocale and handles validations', () => {
		expect(() => editor.addLocale({ code: '' })).toThrow('Код языка не может быть пустым')
		expect(() => editor.addLocale({ code: '123' })).toThrow('Код языка должен состоять из 2-5 латинских букв')

		const initialCount = editor.availableLocales.value.length
		const added = editor.addLocale({ code: 'ja', label: '日本語', flag: '🇯🇵' })

		expect(added.code).toBe('ja')
		expect(added.label).toBe('日本語')
		expect(editor.availableLocales.value.length).toBe(initialCount + 1)
		expect(editor.activeLocale.value).toBe('ja')
		expect(editor.localesData.value.ja).toBeDefined()
		expect(editor.localesData.value.ja.characters).toBeDefined()

		// Calling addLocale on existing language returns existing and switches activeLocale
		editor.switchLocale('ru')
		const again = editor.addLocale({ code: 'ja', label: 'Japanese' })
		expect(again.code).toBe('ja')
		expect(editor.availableLocales.value.length).toBe(initialCount + 1)
		expect(editor.activeLocale.value).toBe('ja')
	})

	it('saves and resolves entity translations in a dynamically added locale with fallback to ru', async () => {
		editor.addLocale({ code: 'de', label: 'Deutsch', flag: '🇩🇪' })
		editor.activeTab.value = 'races'

		// Prepare russian base
		editor.localesData.value.ru.races.human = { name: 'Человек', description: 'Обычный человек' }

		// Before adding German translation, getEntityText in 'de' falls back to Russian
		expect(editor.getEntityText('races', 'human', 'name', 'de')).toBe('Человек')

		// Save entity with German translation
		const germanData = {
			id: 'human',
			name: 'Mensch',
			category: 'humanoid',
			_locales: {
				ru: { name: 'Человек', description: 'Обычный человек' },
				en: { name: 'Human', description: 'Standard human' },
				de: { name: 'Mensch', description: 'Gewöhnlicher Mensch' }
			}
		}
		await editor.saveEntity('races', germanData)

		expect(editor.getEntityText('races', 'human', 'name', 'de')).toBe('Mensch')
		expect(editor.getEntityText('races', 'human', 'description', 'de')).toBe('Gewöhnlicher Mensch')
		expect(editor.getRaceName('human')).toBe('Mensch') // activeLocale is 'de'
	})
})

