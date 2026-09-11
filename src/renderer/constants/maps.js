/**
 * Shared map identifiers and localized names
 */

export const MAP_NAMES = {
	carne: 'Деревня Карн',
	newworld: 'Новый Мир',
	cybercity: 'Кибергород'
}

export function getMapTitle(mapKey) {
	if (!mapKey) return ''
	return MAP_NAMES[mapKey] || mapKey
}
