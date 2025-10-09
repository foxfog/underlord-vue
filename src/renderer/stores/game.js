// src/renderer/stores/game.js
import { defineStore } from 'pinia'

let _GameStore = null

export function initGameStore() {
	if (_GameStore) return // уже инициализирован

	_GameStore = defineStore('game', {
		state: () => ({
			mc: {
				name: '',
				// Other player properties can be added here
			},
			// Other game state properties can be added here
		}),

		getters: {
			// Removed McName getter - accessing mc.name directly instead
		},

		actions: {
			updateMcName(name) {
				this.mc.name = name
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