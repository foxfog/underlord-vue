import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
	getItemSkillIds,
	resolveItemSkills,
	resolveEquippedSkills
} from '@/utils/itemSkills.js'
import { useDataEditor } from '../useDataEditor.js'
import { useSmithing, SMITHING_SWORD_RECIPES } from '../useSmithing.js'

describe('Item Skills & Enchantments Architecture', () => {
	const mockItemSkills = [
		{
			id: 'stiletto_fire_burst',
			name: 'Огненный взрыв',
			icon: '🔥',
			category: 'active',
			description: 'Зачарование Флюдера',
			data: { damage: 85, element: 'fire' }
		},
		{
			id: 'adamantite_edge',
			name: 'Адамантиевая заточка',
			icon: '⚔️',
			category: 'passive',
			description: 'Пробивание брони',
			data: { armor_penetration: 12 }
		},
		{
			id: 'neuro_link',
			name: 'Нейро-интерфейс',
			icon: '🧠',
			category: 'passive',
			description: 'Прямое подключение',
			data: { initiative_bonus: 5 }
		}
	]

	const mockEquipmentCatalog = [
		{
			id: 'adamantite_sword',
			name: 'Адамантиевый меч',
			slot: ['weapon-hand-1'],
			skills: ['adamantite_edge']
		},
		{
			id: 'neuro_helmet',
			name: 'Nervegear 1',
			slot: 'head',
			skills: ['neuro_link']
		},
		{
			id: 'fluder_stiletto',
			name: 'Зачарованный стилет',
			slot: ['weapon-hand-1', 'weapon-hand-2'],
			skills: ['stiletto_fire_burst']
		}
	]

	describe('getItemSkillIds', () => {
		it('extracts skill IDs from array format', () => {
			const item = { id: 'sword', skills: ['adamantite_edge', 'blood_drain'] }
			expect(getItemSkillIds(item)).toEqual(['adamantite_edge', 'blood_drain'])
		})

		it('extracts skill IDs from comma-separated string format', () => {
			const item = { id: 'sword', skills: 'adamantite_edge, blood_drain' }
			expect(getItemSkillIds(item)).toEqual(['adamantite_edge', 'blood_drain'])
		})

		it('returns empty array when item has no skills or is invalid', () => {
			expect(getItemSkillIds(null)).toEqual([])
			expect(getItemSkillIds({})).toEqual([])
			expect(getItemSkillIds({ id: 'item', skills: [] })).toEqual([])
		})
	})

	describe('resolveItemSkills', () => {
		it('resolves full skill definitions for a base template item (id)', () => {
			const item = { id: 'adamantite_sword', name: 'Адамантиевый меч', skills: ['adamantite_edge'] }
			const resolved = resolveItemSkills(item, mockItemSkills)

			expect(resolved).toHaveLength(1)
			expect(resolved[0].id).toBe('adamantite_edge')
			expect(resolved[0].name).toBe('Адамантиевая заточка')
			expect(resolved[0].icon).toBe('⚔️')
			expect(resolved[0].sourceItem).toBe('Адамантиевый меч')
			expect(resolved[0].sourceUid).toBeNull()
		})

		it('resolves full skill definitions for a unique crafted instance (uid)', () => {
			const instance = {
				uid: 'inst_stiletto_9999',
				itemId: 'fluder_stiletto',
				customName: 'Стилет Повелителя Смерти',
				skills: ['stiletto_fire_burst']
			}
			const resolved = resolveItemSkills(instance, mockItemSkills)

			expect(resolved).toHaveLength(1)
			expect(resolved[0].id).toBe('stiletto_fire_burst')
			expect(resolved[0].name).toBe('Огненный взрыв')
			expect(resolved[0].sourceItem).toBe('Стилет Повелителя Смерти')
			expect(resolved[0].sourceUid).toBe('inst_stiletto_9999')
		})
	})

	describe('resolveEquippedSkills', () => {
		it('gathers all skills from character equipment_slots and inventory instances', () => {
			const character = {
				id: 'mc',
				equipment_slots: {
					head: 'neuro_helmet',
					'weapon-hand-1': 'adamantite_sword'
				},
				inventory: {
					items: [
						{
							uid: 'inst_stiletto_123',
							itemId: 'fluder_stiletto',
							customName: 'Стилет Аинза',
							skills: ['stiletto_fire_burst'],
							isEquipped: true
						}
					]
				}
			}

			const equippedSkills = resolveEquippedSkills(character, mockEquipmentCatalog, mockItemSkills)

			expect(equippedSkills).toHaveLength(3)
			const skillIds = equippedSkills.map((s) => s.id)
			expect(skillIds).toContain('neuro_link')
			expect(skillIds).toContain('adamantite_edge')
			expect(skillIds).toContain('stiletto_fire_burst')
		})
	})

	describe('useDataEditor Item Skills Integration', () => {
		let editor
		let writtenFiles = {}

		beforeEach(() => {
			writtenFiles = {}
			editor = useDataEditor()
			globalThis.window = {
				electronAPI: {
					dataEditor: {
						readFile: vi.fn(async (relPath) => {
							if (relPath === 'skills/items/items.json') {
								return { success: true, data: mockItemSkills }
							}
							return { success: true, data: [] }
						}),
						writeFile: vi.fn(async (relPath, data) => {
							writtenFiles[relPath] = data
							return { success: true }
						}),
						deleteFile: vi.fn(async () => ({ success: true })),
						listFiles: vi.fn(async () => ({ success: true, files: [] }))
					}
				}
			}
		})

		it('loadAll loads itemSkills from skills/items/items.json', async () => {
			await editor.loadAll()
			expect(editor.itemSkills.value).toHaveLength(3)
			expect(editor.itemSkills.value[0].id).toBe('stiletto_fire_burst')
		})

		it('normalizes skills property on items and strips empty array', () => {
			const itemWithSkills = {
				id: 'test_item',
				name: 'Тестовый меч',
				skills: ['stiletto_fire_burst', 'adamantite_edge']
			}
			const normalized = editor.normalizeEntity('items', itemWithSkills)
			expect(normalized.skills).toEqual(['stiletto_fire_burst', 'adamantite_edge'])

			const itemWithEmptySkills = {
				id: 'test_empty',
				name: 'Пустой меч',
				skills: []
			}
			const normalizedEmpty = editor.normalizeEntity('items', itemWithEmptySkills)
			expect(normalizedEmpty.skills).toBeUndefined()
		})

		it('saveItemSkill persists new or updated skill into skills/items/items.json', async () => {
			await editor.loadAll()
			const newSkill = {
				id: 'vampiric_edge',
				name: 'Вампирическое лезвие',
				icon: '🩸',
				category: 'passive',
				description: 'Вытягивание здоровья'
			}

			await editor.saveItemSkill(newSkill)

			expect(writtenFiles['skills/items/items.json']).toBeDefined()
			const saved = writtenFiles['skills/items/items.json'].find((s) => s.id === 'vampiric_edge')
			expect(saved).toBeDefined()
			expect(saved.name).toBe('Вампирическое лезвие')
		})
	})

	describe('useSmithing ItemInstance Skills Preservation', () => {
		it('forges item instance with inherited skills from recipe', () => {
			const { craftItem } = useSmithing()
			const mockChar = {
				name: 'Судзуки Сатору',
				inventory: {
					items: [
						{ itemId: 'adamantite_ingot', quantity: 5 },
						{ itemId: 'wood', quantity: 3 }
					]
				}
			}

			const adamantiteRecipe = SMITHING_SWORD_RECIPES.find((r) => r.id === 'adamantite_sword')
			expect(adamantiteRecipe).toBeDefined()
			expect(adamantiteRecipe.skills).toContain('adamantite_edge')

			const result = craftItem(adamantiteRecipe, mockChar)
			expect(result.success).toBe(true)
			expect(result.item.uid).toMatch(/^inst_adamantite_sword_/)
			expect(result.item.skills).toEqual(['adamantite_edge'])
		})
	})
})
