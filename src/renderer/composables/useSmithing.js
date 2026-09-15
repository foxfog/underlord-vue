// src/renderer/composables/useSmithing.js
import { ref, computed } from 'vue'
import { ITEM_RARITIES, getRarity, getRarityBadgeStyle } from '../constants/rarity.js'

export const SMITHING_SWORD_RECIPES = [
	{
		id: 'iron_sword',
		name: 'Железный меч',
		itemId: 'iron_sword',
		category: 'swords',
		icon: '🗡️',
		description: 'Прочный стальной клинок, пригодный для регулярных сражений.',
		materials: [
			{ itemId: 'iron_ingot', name: 'Железный слиток', count: 2, icon: '🧱' },
			{ itemId: 'wood', name: 'Дерево', count: 1, icon: '🪵' }
		],
		baseStats: {
			attack: 14
		},
		rarityWeights: {
			common: 55,
			uncommon: 28,
			rare: 12,
			epic: 4,
			legendary: 1
		}
	},
	{
		id: 'adamantite_sword',
		name: 'Адамантиевый меч',
		itemId: 'adamantite_sword',
		category: 'swords',
		icon: '⚔️',
		description: 'Клинок из редчайшего адамантия. Несокрушимая мощь и невероятная острота.',
		materials: [
			{ itemId: 'adamantite_ingot', name: 'Слиток адамантия', count: 2, icon: '💎' },
			{ itemId: 'wood', name: 'Дерево', count: 1, icon: '🪵' }
		],
		baseStats: {
			attack: 34,
			defense: 3
		},
		rarityWeights: {
			rare: 48,
			epic: 32,
			legendary: 14,
			ancient: 5,
			divine: 1
		}
	}
]

const RARITY_PREFIXES = {
	junk: ['Хрупкий', 'Ржавый', 'Тупой', 'Погнутый'],
	common: ['Простой', 'Обычный', 'Надежный', 'Кованый', 'Ополченский'],
	uncommon: ['Закаленный', 'Острый', 'Увесистый', 'Качественный', 'Гвардейский'],
	rare: ['Превосходный', 'Боевой', 'Отточенный', 'Мастерский', 'Рыцарский'],
	epic: ['Пронзающий', 'Пламенный', 'Громогласный', 'Грозный', 'Истинный'],
	legendary: ['Героический', 'Драконий', 'Сокрушительный', 'Владыки', 'Царственный'],
	ancient: ['Древний', 'Теневой', 'Забытый', 'Чернокровный', 'Бездны'],
	divine: ['Божественный', 'Священный', 'Абсолютный', 'Небесный', 'Первозданный'],
	world: ['Мировой', 'Иггдрасильский', 'Сотворенный', 'Сверхъестественный']
}

/**
 * Случайный выбор редкости на основе весов рецепта
 */
export function rollRarity(recipe) {
	const weights = recipe.rarityWeights || { common: 100 }
	const entries = Object.entries(weights)
	const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
	let rand = Math.random() * totalWeight

	for (const [rarity, weight] of entries) {
		if (rand <= weight) {
			return rarity
		}
		rand -= weight
	}
	return entries[0][0]
}

/**
 * Расчет коэффициента качества по редкости
 */
export function rollQuality(rarity) {
	const ranges = {
		junk: [0.75, 0.9],
		common: [0.95, 1.08],
		uncommon: [1.05, 1.18],
		rare: [1.15, 1.28],
		epic: [1.25, 1.4],
		legendary: [1.35, 1.55],
		ancient: [1.45, 1.7],
		divine: [1.6, 1.9],
		world: [1.8, 2.2]
	}
	const [min, max] = ranges[rarity] || [1.0, 1.1]
	const val = min + Math.random() * (max - min)
	return Math.round(val * 100) / 100
}

/**
 * Генерация случайных характеристик
 */
export function rollStats(recipe, rarity, quality) {
	const base = recipe.baseStats || { attack: 10 }
	const stats = {}

	for (const [key, val] of Object.entries(base)) {
		if (typeof val === 'number') {
			// Случайный разброс вокруг качества: ±8%
			const variance = 0.92 + Math.random() * 0.16
			stats[key] = Math.max(1, Math.round(val * quality * variance))
		} else {
			stats[key] = val
		}
	}

	// Бонусные характеристики при высокой редкости
	if (['epic', 'legendary', 'ancient', 'divine', 'world'].includes(rarity)) {
		stats.crit_rate = Math.round((quality - 1) * 20) + 5
	}
	if (['ancient', 'divine', 'world'].includes(rarity)) {
		stats.defense = (stats.defense || 0) + Math.round(quality * 4)
	}

	return stats
}

/**
 * Генерация уникального названия для выкованного предмета
 */
export function generateCustomName(baseName, rarity) {
	const prefixes = RARITY_PREFIXES[rarity] || RARITY_PREFIXES.common
	const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
	return `${prefix} ${baseName.toLowerCase()}`
}

/**
 * Подсчет предметов в инвентаре персонажа
 */
export function getInventoryItemCount(inventory, itemId) {
	if (!inventory?.items || !Array.isArray(inventory.items)) return 0
	let total = 0
	for (const item of inventory.items) {
		if (item.itemId === itemId || item.id === itemId) {
			total += item.quantity || 1
		}
	}
	return total
}

/**
 * Проверка наличия материалов для ковки
 */
export function checkRecipeMaterials(recipe, inventory) {
	if (!recipe?.materials) return { canCraft: true, missing: [] }
	const missing = []

	for (const mat of recipe.materials) {
		const owned = getInventoryItemCount(inventory, mat.itemId)
		if (owned < mat.count) {
			missing.push({
				...mat,
				owned,
				required: mat.count,
				shortage: mat.count - owned
			})
		}
	}

	return {
		canCraft: missing.length === 0,
		missing
	}
}

/**
 * Списание материалов из инвентаря
 */
export function deductMaterials(inventory, materials) {
	if (!inventory?.items) return false

	for (const mat of materials) {
		let needed = mat.count
		for (let i = inventory.items.length - 1; i >= 0; i--) {
			const it = inventory.items[i]
			if (it.itemId === mat.itemId || it.id === mat.itemId) {
				const qty = it.quantity || 1
				if (qty <= needed) {
					needed -= qty
					inventory.items.splice(i, 1)
				} else {
					it.quantity = qty - needed
					needed = 0
				}
				if (needed <= 0) break
			}
		}
	}
	return true
}

/**
 * Главный композабл кузнечного дела
 */
export function useSmithing() {
	const selectedRecipe = ref(SMITHING_SWORD_RECIPES[0])
	const isCrafting = ref(false)
	const craftedResult = ref(null)

	function selectRecipe(recipe) {
		selectedRecipe.value = recipe
		craftedResult.value = null
	}

	function canCraft(recipe, inventory) {
		return checkRecipeMaterials(recipe, inventory).canCraft
	}

	/**
	 * Выковать предмет
	 */
	function craftItem(recipe, character) {
		if (!recipe || !character?.inventory) {
			return { success: false, reason: 'invalid_params' }
		}

		const check = checkRecipeMaterials(recipe, character.inventory)
		if (!check.canCraft) {
			return { success: false, reason: 'missing_materials', missing: check.missing }
		}

		// Списание ресурсов
		deductMaterials(character.inventory, recipe.materials)

		// Рандомизация характеристик
		const rarity = rollRarity(recipe)
		const quality = rollQuality(rarity)
		const stats = rollStats(recipe, rarity, quality)
		const customName = generateCustomName(recipe.name, rarity)

		// Создание уникального экземпляра ItemInstance
		const instance = {
			uid: `inst_${recipe.itemId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
			itemId: recipe.itemId,
			quantity: 1,
			rarity,
			quality,
			customName,
			stats,
			crafter: character.name || 'Судзуки Сатору',
			createdAt: Date.now()
		}

		if (!Array.isArray(character.inventory.items)) {
			character.inventory.items = []
		}
		character.inventory.items.push(instance)

		craftedResult.value = instance
		return { success: true, item: instance }
	}

	return {
		recipes: SMITHING_SWORD_RECIPES,
		selectedRecipe,
		isCrafting,
		craftedResult,
		selectRecipe,
		canCraft,
		checkRecipeMaterials,
		craftItem,
		getRarity,
		getRarityBadgeStyle
	}
}
