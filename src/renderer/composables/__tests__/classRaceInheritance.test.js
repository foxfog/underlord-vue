import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'

describe('Class & Race Category Inheritance and Cascading', () => {
	let editor

	beforeEach(() => {
		editor = useDataEditor()
		editor.isCreating.value = false
		editor.selectedEntity.value = null
		globalThis.window = {
			electronAPI: {
				dataEditor: {
					writeFile: vi.fn().mockResolvedValue({ success: true })
				}
			}
		}
		// Setup mock entities for testing
		editor.entities.value.classes = [
			{
				id: 'warrior',
				name: 'Воин',
				parent_id: null,
				category: 'combat',
				tier: 'basic'
			},
			{
				id: 'knight',
				name: 'Рыцарь',
				parent_id: 'warrior',
				category: 'combat',
				tier: 'advanced'
			},
			{
				id: 'paladin',
				name: 'Паладин',
				parent_id: 'knight',
				category: 'combat',
				tier: 'rare'
			},
			{
				id: 'craftsman',
				name: 'Ремесленник',
				parent_id: null,
				category: 'craft',
				tier: 'basic'
			}
		]

		editor.entities.value.races = [
			{
				id: 'skeleton',
				name: 'Скелет',
				parent_id: null,
				category: 'heteromorphic',
				tier: 'basic'
			},
			{
				id: 'lich',
				name: 'Лич',
				parent_id: 'skeleton',
				category: 'heteromorphic',
				tier: 'advanced'
			}
		]
	})

	it('normalizeEntity inherits category from parent class when parent_id is set', () => {
		const newClass = {
			id: 'berserker',
			name: 'Берсерк',
			parent_id: 'warrior',
			category: 'social' // even if user/caller passed social, parent is combat!
		}
		const normalized = editor.normalizeEntity('classes', newClass)
		expect(normalized.category).toBe('combat')
	})

	it('normalizeEntity inherits category from parent race when parent_id is set', () => {
		const newRace = {
			id: 'skeleton-mage',
			name: 'Скелет-маг',
			parent_id: 'skeleton',
			category: 'humanoid' // parent is heteromorphic
		}
		const normalized = editor.normalizeEntity('races', newRace)
		expect(normalized.category).toBe('heteromorphic')
	})

	it('normalizeEntity applies default fallback category when root has invalid or missing category', () => {
		const rootClass = {
			id: 'custom-class',
			name: 'Особый класс',
			parent_id: null,
			category: 'invalid_category'
		}
		const normalizedClass = editor.normalizeEntity('classes', rootClass)
		expect(normalizedClass.category).toBe('combat')

		const rootRace = {
			id: 'custom-race',
			name: 'Особая раса',
			parent_id: null,
			category: 'invalid_race_category'
		}
		const normalizedRace = editor.normalizeEntity('races', rootRace)
		expect(normalizedRace.category).toBe('humanoid')
	})

	it('startCreate with parent_id automatically pre-fills category from parent', () => {
		editor.activeTab.value = 'classes'
		editor.startCreate({ parent_id: 'craftsman' })
		expect(editor.selectedEntity.value.parent_id).toBe('craftsman')
		expect(editor.selectedEntity.value.category).toBe('craft')
	})

	it('cascades category changes to all descendants when parent category is saved', async () => {
		editor.activeTab.value = 'classes'
		// Change warrior from 'combat' to 'social'
		const updatedWarrior = {
			id: 'warrior',
			name: 'Воин',
			parent_id: null,
			category: 'social',
			tier: 'basic'
		}

		await editor.saveEntity('classes', updatedWarrior)

		// Knight and Paladin should both have received 'social'
		const knight = editor.entities.value.classes.find((c) => c.id === 'knight')
		const paladin = editor.entities.value.classes.find((c) => c.id === 'paladin')

		expect(knight.category).toBe('social')
		expect(paladin.category).toBe('social')
	})

	describe('Multi-Parent (Tag System) Parsing and Hierarchy', () => {
		it('parseParentIds parses null, empty, single, array, and comma-separated IDs', () => {
			expect(editor.parseParentIds(null)).toEqual([])
			expect(editor.parseParentIds(undefined)).toEqual([])
			expect(editor.parseParentIds('')).toEqual([])
			expect(editor.parseParentIds('human')).toEqual(['human'])
			expect(editor.parseParentIds(' blood-guard, vampire-bride ')).toEqual(['blood-guard', 'vampire-bride'])
			expect(editor.parseParentIds(['succubus', 'incubus', 'demon'])).toEqual(['succubus', 'incubus', 'demon'])
			expect(editor.parseParentIds('a, , b, c')).toEqual(['a', 'b', 'c'])
		})

		it('normalizeEntity serializes multi-parent array to clean comma-separated string or null', () => {
			const entityWithArray = {
				id: 'devil',
				name: 'Дьявол',
				parent_id: ['succubus', 'incubus', 'demon'],
				category: 'heteromorphic'
			}
			const normalized = editor.normalizeEntity('races', entityWithArray)
			expect(normalized.parent_id).toBe('succubus, incubus, demon')

			const entityWithSingleArray = {
				id: 'hobgoblin',
				name: 'Хобгоблин',
				parent_id: ['goblin'],
				category: 'demi-human'
			}
			const normalizedSingle = editor.normalizeEntity('races', entityWithSingleArray)
			expect(normalizedSingle.parent_id).toBe('goblin')

			const entityWithEmptyArray = {
				id: 'human',
				name: 'Человек',
				parent_id: [],
				category: 'humanoid'
			}
			const normalizedEmpty = editor.normalizeEntity('races', entityWithEmptyArray)
			expect(normalizedEmpty.parent_id).toBeNull()
		})

		it('isChildItem, getItemDepth, and getParentEntity correctly identify multi-parent entities', () => {
			editor.entities.value.races = [
				{ id: 'blood-guard', name: 'Кровавый страж', parent_id: null, category: 'heteromorphic' },
				{ id: 'vampire-bride', name: 'Невеста вампира', parent_id: null, category: 'heteromorphic' },
				{ id: 'vampire-lord', name: 'Владыка вампиров', parent_id: 'blood-guard, vampire-bride', category: 'heteromorphic' },
				{ id: 'true-vampire', name: 'Истинный вампир', parent_id: 'vampire-lord', category: 'heteromorphic' }
			]

			const lord = editor.entities.value.races.find((r) => r.id === 'vampire-lord')
			const trueVamp = editor.entities.value.races.find((r) => r.id === 'true-vampire')

			expect(editor.isChildItem(lord, 'races')).toBe(true)
			expect(editor.getItemDepth(lord, 'races')).toBe(1)
			expect(editor.getItemDepth(trueVamp, 'races')).toBe(2)
			expect(editor.getParentEntity(lord, 'races').id).toBe('blood-guard')
		})

		it('buildHierarchicalOrder places multi-parent items under primary parent instead of orphan pool', () => {
			const items = [
				{ id: 'succubus', name: 'Суккуб', parent_id: null },
				{ id: 'incubus', name: 'Инкуб', parent_id: null },
				{ id: 'demon', name: 'Демон', parent_id: null },
				{ id: 'devil', name: 'Дьявол', parent_id: 'succubus, incubus, demon' },
				{ id: 'archdevil', name: 'Архидьявол', parent_id: 'devil' }
			]

			const ordered = editor.buildHierarchicalOrder(items)
			const ids = ordered.map((it) => it.id)

			// Devil must come right after succubus (its primary parent) and before archdevil
			const succubusIdx = ids.indexOf('succubus')
			const devilIdx = ids.indexOf('devil')
			const archdevilIdx = ids.indexOf('archdevil')

			expect(devilIdx).toBe(succubusIdx + 1)
			expect(archdevilIdx).toBe(devilIdx + 1)
		})

		it('cascades category updates to descendants with multi-parent parent_id string', async () => {
			editor.entities.value.races = [
				{ id: 'parent-a', name: 'Parent A', parent_id: null, category: 'heteromorphic' },
				{ id: 'parent-b', name: 'Parent B', parent_id: null, category: 'heteromorphic' },
				{ id: 'child-ab', name: 'Child AB', parent_id: 'parent-a, parent-b', category: 'heteromorphic' }
			]

			const updatedParentA = {
				id: 'parent-a',
				name: 'Parent A',
				parent_id: null,
				category: 'demi-human'
			}

			await editor.saveEntity('races', updatedParentA)

			const child = editor.entities.value.races.find((r) => r.id === 'child-ab')
			expect(child.category).toBe('demi-human')
		})
	})
})
