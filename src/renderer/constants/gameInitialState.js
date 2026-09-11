/**
 * Single source of truth for initial game state
 */

export const createInitialCharacterData = () => ({
	mc: {
		health: 100,
		equipment_slots: {
			mask: null
		}
	}
})

export const createInitialGlobalData = () => ({
	discoveredLocations: {
		cybercity: ['factory', 'home'],
		newworld: ['carne_village'],
		carne: ['carne_village_entrance']
	},
	sceneHotspots: {}
})
