import { describe, it, expect } from 'vitest'
import { createSaveFile, findNonSerializable } from '../saveService'

describe('saveService helpers', () => {
	it('createSaveFile returns normalized object', () => {
		const slot = 1
		const gameState = {
			storyData: { id: 'intro' },
			stepIndex: 3,
			callStack: [],
			globalData: { score: 10 },
			characterData: { hero: { hp: 100 } },
			visibleCharacters: ['hero'],
			currentScene: 'scene1',
			history: []
		}

		const saveFile = createSaveFile(slot, gameState, 'Player', {})

		expect(saveFile).toHaveProperty('slot', slot)
		expect(saveFile).toHaveProperty('timestamp')
		expect(saveFile).toHaveProperty('timestampFormatted')
		expect(saveFile).toHaveProperty('mcName', 'Player')
		expect(saveFile).toHaveProperty('gameState')
		expect(saveFile.gameState).toHaveProperty('storyId', 'intro')
		expect(saveFile.gameState).toHaveProperty('stepIndex', 3)
	})

	it('findNonSerializable detects functions and symbols', () => {
		const bad = { a: 1, b: () => 2 }
		const found = findNonSerializable(bad)
		expect(found).toBeTruthy()
		expect(found).toHaveProperty('path')
	})
})