import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'

describe('Scene Hotspots System', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore()
	})

	it('resolves default hotspot status as active when not specified', () => {
		const vn = useVisualNovel({})
		const status = vn.getHotspotStatus('carne_chief_house_hall', {
			id: 'to_kitchen',
			label: 'Кухня'
		})
		expect(status).toBe('active')
	})

	it('resolves static status from hotspot definition when no delta exists', () => {
		const vn = useVisualNovel({})
		const status = vn.getHotspotStatus('carne_chief_house_hall', {
			id: 'to_cellar',
			label: 'Люк в подвал',
			status: 'locked'
		})
		expect(status).toBe('locked')
	})

	it('evaluates dynamic condition against globalData', () => {
		const vn = useVisualNovel({})
		const hotspot = {
			id: 'cellar_passage',
			condition: 'global.has_key == true',
			fallbackStatus: 'locked'
		}

		// Initial: has_key is falsy -> locked
		expect(vn.getHotspotStatus('carne_chief_house_hall', hotspot)).toBe('locked')

		// Set global variable
		vn.globalData.value.has_key = true
		expect(vn.getHotspotStatus('carne_chief_house_hall', hotspot)).toBe('active')
	})

	it('evaluates array includes condition with fallbackStatus hidden for location discovery', () => {
		const vn = useVisualNovel({})
		const hotspot = {
			id: 'to_square',
			condition: "global.discoveredLocations?.carne?.includes('carne_square')",
			fallbackStatus: 'hidden'
		}

		vn.globalData.value = {
			discoveredLocations: {
				carne: ['carne_village_entrance']
			}
		}

		// Initial: carne_square not discovered -> hidden
		expect(vn.getHotspotStatus('carne_village_entrance', hotspot)).toBe('hidden')

		// Discover carne_square -> active
		vn.globalData.value.discoveredLocations.carne.push('carne_square')
		expect(vn.getHotspotStatus('carne_village_entrance', hotspot)).toBe('active')
	})

	it('delta in globalData.sceneHotspots overrides default and condition', () => {
		const vn = useVisualNovel({})
		const hotspot = {
			id: 'to_cellar',
			status: 'locked',
			condition: 'global.has_key == true'
		}

		// Initially locked
		expect(vn.getHotspotStatus('carne_chief_house_hall', hotspot)).toBe('locked')

		// Update delta via setHotspotStatus
		vn.setHotspotStatus('carne_chief_house_hall', 'to_cellar', 'active')
		expect(vn.getHotspotStatus('carne_chief_house_hall', hotspot)).toBe('active')

		// Even if condition is false, delta takes precedence
		vn.globalData.value.has_key = false
		expect(vn.getHotspotStatus('carne_chief_house_hall', hotspot)).toBe('active')
	})

	it('processes unlock-hotspot step action', () => {
		const vn = useVisualNovel({})
		vn.currentScene.value = { id: 'carne_chief_house_hall' }

		vn.storyData.value = {
			steps: [
				{
					type: 'unlock-hotspot',
					scene: 'carne_chief_house_hall',
					id: 'to_cellar'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.sceneHotspots.carne_chief_house_hall.to_cellar).toBe('active')
	})

	it('processes lock-hotspot step action with lockedAction overrides', () => {
		const vn = useVisualNovel({})
		vn.currentScene.value = { id: 'carne_chief_house_hall' }

		vn.storyData.value = {
			steps: [
				{
					type: 'lock-hotspot',
					scene: 'carne_chief_house_hall',
					id: 'to_kitchen',
					notification: 'Кухня заперта на ключ',
					text: 'Кухонная дверь заперта.'
				}
			]
		}
		vn.processStep()

		const entry = vn.globalData.value.sceneHotspots.carne_chief_house_hall.to_kitchen
		expect(entry.status).toBe('locked')
		expect(entry.lockedAction.notification).toBe('Кухня заперта на ключ')
		expect(entry.lockedAction.text).toBe('Кухонная дверь заперта.')
	})

	it('processes hide-hotspot and show-hotspot steps', () => {
		const vn = useVisualNovel({})
		vn.currentScene.value = { id: 'carne_chief_house_hall' }

		vn.storyData.value = {
			steps: [
				{
					type: 'hide-hotspot',
					scene: 'carne_chief_house_hall',
					id: 'secret_stash'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.sceneHotspots.carne_chief_house_hall.secret_stash).toBe('hidden')

		vn.storyData.value = {
			steps: [
				{
					type: 'show-hotspot',
					scene: 'carne_chief_house_hall',
					id: 'secret_stash'
				}
			]
		}
		vn.stepIndex.value = 0
		vn.processStep()

		expect(vn.globalData.value.sceneHotspots.carne_chief_house_hall.secret_stash).toBe('active')
	})

	it('handleHotspotClick executes goto when hotspot is active', () => {
		const vn = useVisualNovel({})
		vn.storyData.value = {
			steps: [
				{ id: 'room_arrival', type: 'dialogue', text: 'Entered room' }
			]
		}

		vn.handleHotspotClick('carne_chief_house_hall', {
			id: 'to_room',
			status: 'active',
			target: 'room_arrival'
		})

		expect(vn.stepIndex.value).toBe(0)
	})

	it('handleHotspotClick triggers lockedAction (sound, notification, text) when locked', () => {
		const notificationMock = {
			showNotification: vi.fn()
		}
		const vn = useVisualNovel({
			notificationComponent: { value: notificationMock }
		})

		const lockedHotspot = {
			id: 'to_cellar',
			status: 'locked',
			lockedAction: {
				text: 'Люк наглухо заперт.',
				notification: 'Заперто!',
				sound: 'audio/sound/cloth.ogg'
			}
		}

		vn.handleHotspotClick('carne_chief_house_hall', lockedHotspot)

		expect(notificationMock.showNotification).toHaveBeenCalledWith('Заперто!', 'warning', 3000)
		expect(vn.currentNarration.value).toBe('Люк наглухо заперт.')
	})

	it('preserves delta-save architecture: only modified hotspots are stored and restored', async () => {
		const vn = useVisualNovel({})
		vn.resetGameState()

		// Initial state has empty sceneHotspots
		expect(vn.globalData.value.sceneHotspots).toEqual({})

		// Modify only one door
		vn.setHotspotStatus('carne_chief_house_hall', 'to_cellar', 'active')

		const saved = vn.getGameState()
		expect(saved.globalData.sceneHotspots).toEqual({
			carne_chief_house_hall: {
				to_cellar: 'active'
			}
		})

		// Reset game
		vn.resetGameState()
		expect(vn.globalData.value.sceneHotspots).toEqual({})

		// Restore game
		await vn.restoreGameState(saved)
		expect(vn.globalData.value.sceneHotspots.carne_chief_house_hall.to_cellar).toBe('active')
	})
})
