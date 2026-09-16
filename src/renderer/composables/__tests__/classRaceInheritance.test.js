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
})
