import { describe, it, expect, beforeEach } from 'vitest'
import {
	normalizeInitialLoot,
	getContainerItems,
	getItemDetails,
	transferToPlayer,
	transferToContainer,
	takeAllFromContainer,
	depositAllToContainer
} from '../useContainers.js'

describe('useContainers Composable & Utilities', () => {
	let mockGlobalData
	let mockCharacter

	beforeEach(() => {
		mockGlobalData = {
			containers: {}
		}
		mockCharacter = {
			id: 'mc',
			name: 'Судзуки Сатору',
			inventory: {
				items: [
					{ itemId: 'wood', quantity: 2 },
					{ itemId: 'iron_sword', uid: 'sword-1', customName: 'Закаленный Железный меч', rarity: 'uncommon' }
				]
			}
		}
	})

	describe('normalizeInitialLoot', () => {
		it('parses string loot correctly', () => {
			const lootStr = 'wood:4, iron_ingot:6, adamantite_ingot:4'
			const result = normalizeInitialLoot(lootStr)
			expect(result).toHaveLength(3)
			expect(result[0]).toEqual({ itemId: 'wood', quantity: 4 })
			expect(result[1]).toEqual({ itemId: 'iron_ingot', quantity: 6 })
			expect(result[2]).toEqual({ itemId: 'adamantite_ingot', quantity: 4 })
		})

		it('parses array of objects', () => {
			const arr = [{ id: 'wood', count: 3 }, { itemId: 'iron_ingot', quantity: 5 }]
			const result = normalizeInitialLoot(arr)
			expect(result[0]).toEqual({ itemId: 'wood', quantity: 3, id: 'wood', count: 3 })
			expect(result[1]).toEqual({ itemId: 'iron_ingot', quantity: 5 })
		})

		it('returns empty array for invalid input', () => {
			expect(normalizeInitialLoot(null)).toEqual([])
			expect(normalizeInitialLoot('')).toEqual([])
		})
	})

	describe('getContainerItems', () => {
		it('initializes container in globalData if missing', () => {
			const items = getContainerItems('test_chest', 'wood:5, iron_ingot:2', mockGlobalData)
			expect(items).toHaveLength(2)
			expect(mockGlobalData.containers.test_chest).toEqual(items)
		})

		it('reuses existing container data if already in globalData', () => {
			mockGlobalData.containers.test_chest = [{ itemId: 'gold', quantity: 100 }]
			const items = getContainerItems('test_chest', 'wood:5', mockGlobalData)
			expect(items).toEqual([{ itemId: 'gold', quantity: 100 }])
		})
	})

	describe('transferToPlayer', () => {
		it('transfers partial stackable quantity from chest to player', () => {
			getContainerItems('smithy_chest', 'iron_ingot:6', mockGlobalData)
			const chestItem = mockGlobalData.containers.smithy_chest[0]

			const ok = transferToPlayer('smithy_chest', chestItem, 2, mockCharacter, mockGlobalData)
			expect(ok).toBe(true)
			expect(mockGlobalData.containers.smithy_chest[0].quantity).toBe(4)

			const playerIron = mockCharacter.inventory.items.find((it) => it.itemId === 'iron_ingot')
			expect(playerIron).toBeDefined()
			expect(playerIron.quantity).toBe(2)
		})

		it('transfers full stackable quantity and removes item from chest', () => {
			getContainerItems('smithy_chest', 'wood:3', mockGlobalData)
			const chestItem = mockGlobalData.containers.smithy_chest[0]

			const ok = transferToPlayer('smithy_chest', chestItem, 3, mockCharacter, mockGlobalData)
			expect(ok).toBe(true)
			expect(mockGlobalData.containers.smithy_chest).toHaveLength(0)

			const playerWood = mockCharacter.inventory.items.find((it) => it.itemId === 'wood')
			expect(playerWood.quantity).toBe(5) // 2 originally + 3
		})

		it('transfers unique item instance (uid)', () => {
			const uniqueSword = {
				uid: 'unique-adam-1',
				itemId: 'adamantite_sword',
				customName: 'Древний Адамантиевый меч',
				rarity: 'ancient',
				stats: { attack: 45 }
			}
			mockGlobalData.containers.smithy_chest = [uniqueSword]

			const ok = transferToPlayer('smithy_chest', uniqueSword, 1, mockCharacter, mockGlobalData)
			expect(ok).toBe(true)
			expect(mockGlobalData.containers.smithy_chest).toHaveLength(0)

			const transferred = mockCharacter.inventory.items.find((it) => it.uid === 'unique-adam-1')
			expect(transferred).toBeDefined()
			expect(transferred.customName).toBe('Древний Адамантиевый меч')
			expect(transferred.rarity).toBe('ancient')
		})
	})

	describe('transferToContainer', () => {
		it('transfers partial stack from player to chest', () => {
			mockGlobalData.containers.smithy_chest = []
			const playerWood = mockCharacter.inventory.items.find((it) => it.itemId === 'wood')

			const ok = transferToContainer('smithy_chest', playerWood, 1, mockCharacter, mockGlobalData)
			expect(ok).toBe(true)
			expect(playerWood.quantity).toBe(1)
			expect(mockGlobalData.containers.smithy_chest[0]).toEqual({ itemId: 'wood', quantity: 1 })
		})

		it('transfers unique item from player to chest', () => {
			mockGlobalData.containers.smithy_chest = []
			const uniqueSword = mockCharacter.inventory.items.find((it) => it.uid === 'sword-1')

			const ok = transferToContainer('smithy_chest', uniqueSword, 1, mockCharacter, mockGlobalData)
			expect(ok).toBe(true)
			expect(mockCharacter.inventory.items.some((it) => it.uid === 'sword-1')).toBe(false)
			expect(mockGlobalData.containers.smithy_chest[0].uid).toBe('sword-1')
		})
	})

	describe('takeAllFromContainer and depositAllToContainer', () => {
		it('takeAll empties container and moves all items to character', () => {
			mockGlobalData.containers.smithy_chest = [
				{ itemId: 'wood', quantity: 10 },
				{ itemId: 'iron_ingot', quantity: 5 }
			]

			const count = takeAllFromContainer('smithy_chest', mockCharacter, mockGlobalData)
			expect(count).toBe(2)
			expect(mockGlobalData.containers.smithy_chest).toHaveLength(0)

			const playerWood = mockCharacter.inventory.items.find((it) => it.itemId === 'wood')
			expect(playerWood.quantity).toBe(12) // 2 + 10
			const playerIron = mockCharacter.inventory.items.find((it) => it.itemId === 'iron_ingot')
			expect(playerIron.quantity).toBe(5)
		})

		it('depositAll moves all character items into container', () => {
			mockGlobalData.containers.smithy_chest = []
			const count = depositAllToContainer('smithy_chest', mockCharacter, mockGlobalData)
			expect(count).toBe(2)
			expect(mockCharacter.inventory.items).toHaveLength(0)
			expect(mockGlobalData.containers.smithy_chest).toHaveLength(2)
		})
	})

	describe('getItemDetails', () => {
		it('resolves item name, icon and rarity', () => {
			const item = { itemId: 'wood', quantity: 4 }
			const details = getItemDetails(item)
			expect(details.name).toBe('Дерево')
			expect(details.icon).toBe('🪵')
			expect(details.rarity).toBe('common')
		})

		it('prioritizes customName and unique stats', () => {
			const item = {
				itemId: 'iron_sword',
				customName: 'Мой Меч',
				rarity: 'epic',
				stats: { attack: 22 }
			}
			const details = getItemDetails(item)
			expect(details.name).toBe('Мой Меч')
			expect(details.rarity).toBe('epic')
			expect(details.stats.attack).toBe(22)
		})
	})
})
