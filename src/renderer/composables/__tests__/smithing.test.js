import { describe, it, expect } from 'vitest'
import {
	SMITHING_SWORD_RECIPES,
	rollRarity,
	rollQuality,
	rollStats,
	generateCustomName,
	getInventoryItemCount,
	checkRecipeMaterials,
	deductMaterials,
	useSmithing
} from '../useSmithing.js'

describe('useSmithing Composable & Crafting System', () => {
	const ironSwordRecipe = SMITHING_SWORD_RECIPES.find((r) => r.id === 'iron_sword')
	const adamantiteSwordRecipe = SMITHING_SWORD_RECIPES.find((r) => r.id === 'adamantite_sword')

	it('provides recipes for iron and adamantite swords with materials', () => {
		expect(ironSwordRecipe).toBeDefined()
		expect(adamantiteSwordRecipe).toBeDefined()

		expect(ironSwordRecipe.materials).toEqual([
			{ itemId: 'iron_ingot', name: 'Железный слиток', count: 2, icon: '🧱' },
			{ itemId: 'wood', name: 'Дерево', count: 1, icon: '🪵' }
		])

		expect(adamantiteSwordRecipe.materials).toEqual([
			{ itemId: 'adamantite_ingot', name: 'Слиток адамантия', count: 2, icon: '💎' },
			{ itemId: 'wood', name: 'Дерево', count: 1, icon: '🪵' }
		])
	})

	it('rollRarity selects from configured weights', () => {
		const results = new Set()
		for (let i = 0; i < 100; i++) {
			results.add(rollRarity(ironSwordRecipe))
		}
		// In 100 rolls, common should always be rolled
		expect(results.has('common')).toBe(true)

		// Adamantite can roll ancient or divine
		const adamWeights = adamantiteSwordRecipe.rarityWeights
		expect(adamWeights.ancient).toBeDefined()
		expect(adamWeights.ancient).toBeGreaterThan(0)
	})

	it('rollQuality returns reasonable multipliers for rarities', () => {
		const qCommon = rollQuality('common')
		expect(qCommon).toBeGreaterThanOrEqual(0.95)
		expect(qCommon).toBeLessThanOrEqual(1.1)

		const qAncient = rollQuality('ancient')
		expect(qAncient).toBeGreaterThanOrEqual(1.4)
		expect(qAncient).toBeLessThanOrEqual(1.75)
	})

	it('rollStats scales stats and adds bonuses for high rarities', () => {
		const statsCommon = rollStats(ironSwordRecipe, 'common', 1.0)
		expect(statsCommon.attack).toBeGreaterThanOrEqual(10)
		expect(statsCommon.attack).toBeLessThanOrEqual(20)

		const statsAncient = rollStats(adamantiteSwordRecipe, 'ancient', 1.5)
		expect(statsAncient.attack).toBeGreaterThan(35)
		expect(statsAncient.crit_rate).toBeDefined()
		expect(statsAncient.defense).toBeDefined()
	})

	it('generateCustomName produces prefixed sword titles', () => {
		const name = generateCustomName('Железный меч', 'common')
		expect(name).toContain('железный меч')

		const nameAncient = generateCustomName('Адамантиевый меч', 'ancient')
		expect(nameAncient).toContain('адамантиевый меч')
	})

	it('getInventoryItemCount counts items by itemId or id', () => {
		const inv = {
			items: [
				{ itemId: 'wood', quantity: 3 },
				{ itemId: 'iron_ingot', quantity: 5 },
				{ id: 'wood', quantity: 2 }
			]
		}
		expect(getInventoryItemCount(inv, 'wood')).toBe(5)
		expect(getInventoryItemCount(inv, 'iron_ingot')).toBe(5)
		expect(getInventoryItemCount(inv, 'adamantite_ingot')).toBe(0)
	})

	it('checkRecipeMaterials returns missing materials when inventory lacks them', () => {
		const invEmpty = { items: [] }
		const check = checkRecipeMaterials(ironSwordRecipe, invEmpty)
		expect(check.canCraft).toBe(false)
		expect(check.missing).toHaveLength(2)

		const invFull = {
			items: [
				{ itemId: 'iron_ingot', quantity: 2 },
				{ itemId: 'wood', quantity: 1 }
			]
		}
		const checkFull = checkRecipeMaterials(ironSwordRecipe, invFull)
		expect(checkFull.canCraft).toBe(true)
		expect(checkFull.missing).toHaveLength(0)
	})

	it('deductMaterials reduces quantities and removes exhausted items', () => {
		const inv = {
			items: [
				{ itemId: 'iron_ingot', quantity: 3 },
				{ itemId: 'wood', quantity: 1 }
			]
		}
		const ok = deductMaterials(inv, ironSwordRecipe.materials)
		expect(ok).toBe(true)

		// Iron ingot should now be 1
		const iron = inv.items.find((i) => i.itemId === 'iron_ingot')
		expect(iron.quantity).toBe(1)

		// Wood was exactly 1, so it should be removed
		const wood = inv.items.find((i) => i.itemId === 'wood')
		expect(wood).toBeUndefined()
	})

	it('craftItem executes full forging process and produces an ItemInstance', () => {
		const { craftItem } = useSmithing()
		const character = {
			name: 'Момонга',
			inventory: {
				items: [
					{ itemId: 'adamantite_ingot', quantity: 5 },
					{ itemId: 'wood', quantity: 3 }
				]
			}
		}

		const result = craftItem(adamantiteSwordRecipe, character)
		expect(result.success).toBe(true)
		expect(result.item).toBeDefined()

		const inst = result.item
		expect(inst.uid).toMatch(/^inst_adamantite_sword_/)
		expect(inst.itemId).toBe('adamantite_sword')
		expect(inst.customName).toBeDefined()
		expect(inst.crafter).toBe('Момонга')
		expect(inst.stats.attack).toBeGreaterThan(25)

		// Check materials were deducted
		const remainingAdam = character.inventory.items.find((i) => i.itemId === 'adamantite_ingot')
		expect(remainingAdam.quantity).toBe(3) // 5 - 2 = 3

		// Check instance is in character inventory
		const addedInstance = character.inventory.items.find((i) => i.uid === inst.uid)
		expect(addedInstance).toBeDefined()
	})

	it('craftItem fails when character lacks materials', () => {
		const { craftItem } = useSmithing()
		const character = {
			name: 'Судзуки',
			inventory: { items: [] }
		}

		const result = craftItem(ironSwordRecipe, character)
		expect(result.success).toBe(false)
		expect(result.reason).toBe('missing_materials')
	})
})
