// src/renderer/stores/game.js
import { defineStore } from 'pinia'

let _GameStore = null

export function initGameStore() {
	if (_GameStore) return // уже инициализирован

	_GameStore = defineStore('game', {
		state: () => ({
			mc: {
				name: 'MC',
				nicname: 'player',
				title: 'player',
			},
			characters: {
				momonga: {
					name: 'Сатору',
					surname: 'Судзуки',
					nicname: 'Momonga',
					title: 'Ainz',
					stats: {
						intelect: 100,
						strength: 10,
						agility: 10,
						luck: 10
					}
				}
			},
			world: {
				cur_time: 'day',
			},
			// Current location state
			location: 'test-location' // default location
		}),

		getters: {
			// Removed McName getter - accessing mc.name directly instead
		},

		actions: {
			updateMcName(name) {
				this.mc.name = name
			},
			
			// Action to update current location
			updateLocation(locationId) {
				this.location = locationId
			},
			
			// Action to load save data into the store
			loadSaveData(saveData) {
				// Merge save data with current state
				// For each property in the current state, use the saved value if it exists, otherwise keep current
				const currentState = this.$state
				const mergedState = {}
				
				for (const key in currentState) {
					if (saveData[key] !== undefined) {
						mergedState[key] = saveData[key]
					} else {
						mergedState[key] = currentState[key]
					}
				}
				
				// Update the store with merged data
				this.$patch(mergedState)
			},
			
			// Other game actions can be added here
		}
	})
}

export function useGameStore() {
	if (!_GameStore) {
		initGameStore()
	}
	return _GameStore()
}