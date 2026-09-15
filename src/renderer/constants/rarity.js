/**
 * Item Rarity Definitions & Helpers for Underlord-Vue
 *
 * 9 levels of rarity:
 * 1. junk (Хлам) - серый
 * 2. common (Обычный) - белый (дефолт)
 * 3. uncommon (Необычный) - зеленый
 * 4. rare (Редкий) - синий
 * 5. epic (Эпичный) - фиолетовый
 * 6. legendary (Легендарный) - золотой/желтый
 * 7. ancient (Древний) - черный с серебристым свечением
 * 8. divine (Божественный) - красный
 * 9. world (Мировой) - радужный градиент
 */

export const ITEM_RARITIES = [
	{
		id: 'junk',
		label: 'Хлам',
		color: '#94a3b8',
		bg: 'rgba(148, 163, 184, 0.15)',
		border: '#94a3b8',
		icon: '🗑️'
	},
	{
		id: 'common',
		label: 'Обычный',
		color: '#f8fafc',
		bg: 'rgba(248, 250, 252, 0.12)',
		border: '#cbd5e1',
		icon: '⚪'
	},
	{
		id: 'uncommon',
		label: 'Необычный',
		color: '#4ade80',
		bg: 'rgba(74, 222, 128, 0.15)',
		border: '#4ade80',
		icon: '🟢'
	},
	{
		id: 'rare',
		label: 'Редкий',
		color: '#60a5fa',
		bg: 'rgba(96, 165, 250, 0.15)',
		border: '#60a5fa',
		icon: '🔵'
	},
	{
		id: 'epic',
		label: 'Эпичный',
		color: '#c084fc',
		bg: 'rgba(192, 132, 252, 0.15)',
		border: '#c084fc',
		icon: '🟣'
	},
	{
		id: 'legendary',
		label: 'Легендарный',
		color: '#facc15',
		bg: 'rgba(250, 204, 21, 0.18)',
		border: '#facc15',
		icon: '🟡'
	},
	{
		id: 'ancient',
		label: 'Древний',
		color: '#e2e8f0',
		bg: '#0f172a',
		border: '#475569',
		icon: '🖤',
		shadow: '0 0 0.5em rgba(0, 0, 0, 0.9)'
	},
	{
		id: 'divine',
		label: 'Божественный',
		color: '#f87171',
		bg: 'rgba(248, 113, 113, 0.2)',
		border: '#f87171',
		icon: '🔴'
	},
	{
		id: 'world',
		label: 'Мировой',
		color: '#ffffff',
		bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.35), rgba(234, 179, 8, 0.35), rgba(59, 130, 246, 0.35), rgba(168, 85, 247, 0.35))',
		border: '#f43f5e',
		icon: '🌈',
		isRainbow: true
	}
]

export const RARITY_MAP = Object.fromEntries(ITEM_RARITIES.map((r) => [r.id, r]))

/**
 * Получить конфигурацию редкости по ID
 * @param {string} rarityId
 * @returns {object}
 */
export function getRarity(rarityId) {
	return RARITY_MAP[rarityId] || RARITY_MAP.common
}

/**
 * Получить цвет текста редкости
 * @param {string} rarityId
 * @returns {string}
 */
export function getRarityColor(rarityId) {
	return getRarity(rarityId).color
}

/**
 * Получить inline style для бейджа редкости
 * @param {string} rarityId
 * @returns {object}
 */
export function getRarityBadgeStyle(rarityId) {
	const r = getRarity(rarityId)
	if (r.isRainbow) {
		return {
			color: r.color,
			background: r.bg,
			borderColor: 'transparent',
			boxShadow: '0 0 0.5em rgba(244, 63, 94, 0.4)'
		}
	}
	return {
		color: r.color,
		backgroundColor: r.bg,
		borderColor: r.border,
		boxShadow: r.shadow || 'none'
	}
}
