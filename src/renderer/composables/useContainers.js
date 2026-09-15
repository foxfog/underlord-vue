// src/renderer/composables/useContainers.js
import { computed } from 'vue'
import { parseLootString } from '../utils/isometric/isoLoader.js'
import { getRarity, getRarityBadgeStyle } from '../constants/rarity.js'
import { useGameStore } from '../stores/gameStore.js'

export const DEFAULT_ITEM_NAMES = {
	wood: 'Дерево',
	iron_ingot: 'Железный слиток',
	adamantite_ingot: 'Слиток адамантия',
	iron_sword: 'Железный меч',
	adamantite_sword: 'Адамантиевый меч',
	gold: 'Золото'
}

export const DEFAULT_ITEM_ICONS = {
	wood: '🪵',
	iron_ingot: '🧱',
	adamantite_ingot: '💎',
	iron_sword: '🗡️',
	adamantite_sword: '⚔️',
	gold: '🪙'
}

/**
 * Нормализует начальный лут контейнера в массив предметов [{ itemId, quantity, ... }]
 * @param {string|Array} initialLoot
 * @returns {Array<Object>}
 */
export function normalizeInitialLoot(initialLoot) {
	if (!initialLoot) return []

	if (typeof initialLoot === 'string') {
		const parsed = parseLootString(initialLoot)
		return parsed.map((it) => ({
			itemId: it.id || it.itemId,
			quantity: it.count || it.quantity || 1
		}))
	}

	if (Array.isArray(initialLoot)) {
		return initialLoot.map((it) => {
			if (typeof it === 'string') {
				const parts = it.split(':').map((s) => s.trim())
				return {
					itemId: parts[0],
					quantity: parts[1] ? parseInt(parts[1], 10) || 1 : 1
				}
			}
			return {
				...it,
				itemId: it.itemId || it.id || 'item',
				quantity: it.quantity !== undefined ? it.quantity : it.count !== undefined ? it.count : 1
			}
		})
	}

	return []
}

/**
 * Получает или инициализирует массив предметов контейнера в globalData.containers[containerId]
 * @param {string} containerId
 * @param {string|Array} [initialLoot]
 * @param {Object} [targetGlobalData]
 * @returns {Array<Object>}
 */
export function getContainerItems(containerId, initialLoot = null, targetGlobalData = null) {
	let gd = targetGlobalData
	if (!gd) {
		try {
			gd = useGameStore().globalData
		} catch {
			gd = null
		}
	}
	if (!gd) return []

	if (!gd.containers) {
		gd.containers = {}
	}

	if (!gd.containers[containerId]) {
		gd.containers[containerId] = normalizeInitialLoot(initialLoot)
	}

	return gd.containers[containerId]
}

/**
 * Получает метаданные о предмете (название, иконка, редкость, характеристики)
 * @param {Object} item
 * @param {Object} [itemsData]
 * @returns {Object}
 */
export function getItemDetails(item, itemsData = {}) {
	if (!item) return { name: 'Неизвестный предмет', icon: '📦', rarity: 'common' }

	const itemId = item.itemId || item.id
	const def = itemsData?.[itemId] || {}

	const name = item.customName || def.name || DEFAULT_ITEM_NAMES[itemId] || itemId
	const icon = item.icon || def.icon || DEFAULT_ITEM_ICONS[itemId] || '📦'
	const rarity = item.rarity || def.rarity || 'common'
	const stats = item.stats || def.stats || null
	const quality = item.quality !== undefined ? item.quality : null
	const description = def.description || ''

	return {
		itemId,
		name,
		icon,
		rarity,
		stats,
		quality,
		description,
		rarityConfig: getRarity(rarity),
		badgeStyle: getRarityBadgeStyle(rarity)
	}
}

/**
 * Переносит предмет из контейнера в инвентарь персонажа
 * @param {string} containerId
 * @param {Object} item
 * @param {number} [quantity=1]
 * @param {Object} character
 * @param {Object} [targetGlobalData]
 * @returns {boolean} true если перенос выполнен
 */
export function transferToPlayer(containerId, item, quantity = 1, character, targetGlobalData = null) {
	if (!item || !character) return false

	const containerItems = getContainerItems(containerId, null, targetGlobalData)
	if (!character.inventory) character.inventory = { items: [] }
	if (!Array.isArray(character.inventory.items)) character.inventory.items = []

	const playerItems = character.inventory.items

	// Уникальный экземпляр с uid (например выкованный меч)
	if (item.uid) {
		const index = containerItems.findIndex((it) => it.uid === item.uid)
		if (index === -1) return false

		const [transferred] = containerItems.splice(index, 1)
		playerItems.push(transferred)
		return true
	}

	// Стакаемый предмет
	const itemId = item.itemId || item.id
	const index = containerItems.findIndex((it) => !it.uid && (it.itemId === itemId || it.id === itemId))
	if (index === -1) return false

	const cItem = containerItems[index]
	const currentQty = cItem.quantity !== undefined ? cItem.quantity : 1
	const moveQty = Math.max(1, Math.min(quantity, currentQty))

	if (currentQty - moveQty <= 0) {
		containerItems.splice(index, 1)
	} else {
		cItem.quantity = currentQty - moveQty
	}

	// Добавляем в инвентарь игрока
	const existingInPlayer = playerItems.find((it) => !it.uid && (it.itemId === itemId || it.id === itemId))
	if (existingInPlayer) {
		existingInPlayer.quantity = (existingInPlayer.quantity || 1) + moveQty
	} else {
		playerItems.push({
			...cItem,
			itemId,
			quantity: moveQty
		})
	}

	return true
}

/**
 * Переносит предмет из инвентаря персонажа в контейнер
 * @param {string} containerId
 * @param {Object} item
 * @param {number} [quantity=1]
 * @param {Object} character
 * @param {Object} [targetGlobalData]
 * @returns {boolean} true если перенос выполнен
 */
export function transferToContainer(containerId, item, quantity = 1, character, targetGlobalData = null) {
	if (!item || !character?.inventory?.items) return false

	const containerItems = getContainerItems(containerId, null, targetGlobalData)
	const playerItems = character.inventory.items

	// Уникальный экземпляр с uid
	if (item.uid) {
		const index = playerItems.findIndex((it) => it.uid === item.uid)
		if (index === -1) return false

		const [transferred] = playerItems.splice(index, 1)
		containerItems.push(transferred)
		return true
	}

	// Стакаемый предмет
	const itemId = item.itemId || item.id
	const index = playerItems.findIndex((it) => !it.uid && (it.itemId === itemId || it.id === itemId))
	if (index === -1) return false

	const pItem = playerItems[index]
	const currentQty = pItem.quantity !== undefined ? pItem.quantity : 1
	const moveQty = Math.max(1, Math.min(quantity, currentQty))

	if (currentQty - moveQty <= 0) {
		playerItems.splice(index, 1)
	} else {
		pItem.quantity = currentQty - moveQty
	}

	// Добавляем в контейнер
	const existingInContainer = containerItems.find((it) => !it.uid && (it.itemId === itemId || it.id === itemId))
	if (existingInContainer) {
		existingInContainer.quantity = (existingInContainer.quantity || 1) + moveQty
	} else {
		containerItems.push({
			...pItem,
			itemId,
			quantity: moveQty
		})
	}

	return true
}

/**
 * Забрать все предметы из контейнера в инвентарь игрока
 * @param {string} containerId
 * @param {Object} character
 * @param {Object} [targetGlobalData]
 * @returns {number} количество перенесенных предметов
 */
export function takeAllFromContainer(containerId, character, targetGlobalData = null) {
	if (!character) return 0
	const containerItems = getContainerItems(containerId, null, targetGlobalData)
	if (!containerItems || containerItems.length === 0) return 0

	const itemsToMove = [...containerItems]
	let count = 0

	for (const item of itemsToMove) {
		const qty = item.uid ? 1 : (item.quantity || 1)
		const ok = transferToPlayer(containerId, item, qty, character, targetGlobalData)
		if (ok) count++
	}

	return count
}

/**
 * Сложить все неэкипированные предметы из инвентаря игрока в контейнер
 * @param {string} containerId
 * @param {Object} character
 * @param {Object} [targetGlobalData]
 * @returns {number} количество перенесенных предметов
 */
export function depositAllToContainer(containerId, character, targetGlobalData = null) {
	if (!character?.inventory?.items) return 0
	const playerItems = [...character.inventory.items]
	let count = 0

	for (const item of playerItems) {
		const qty = item.uid ? 1 : (item.quantity || 1)
		const ok = transferToContainer(containerId, item, qty, character, targetGlobalData)
		if (ok) count++
	}

	return count
}

/**
 * Vue Composable для работы с конкретным контейнером
 */
export function useContainers(containerId, initialLoot = null, customGlobalData = null) {
	const gameStore = useGameStore()
	const globalData = customGlobalData || gameStore.globalData

	const items = computed(() => {
		return getContainerItems(containerId, initialLoot, globalData)
	})

	return {
		items,
		transferToPlayer: (item, quantity, character) =>
			transferToPlayer(containerId, item, quantity, character, globalData),
		transferToContainer: (item, quantity, character) =>
			transferToContainer(containerId, item, quantity, character, globalData),
		takeAll: (character) => takeAllFromContainer(containerId, character, globalData),
		depositAll: (character) => depositAllToContainer(containerId, character, globalData),
		getItemDetails
	}
}
