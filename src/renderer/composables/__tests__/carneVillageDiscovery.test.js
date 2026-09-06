import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'
import { useQuests } from '../useQuests'

describe('Carne Village Discovery & Scene Transitions', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore()
		useQuests().resetQuests()
	})

	it('discovers carne_square and adds it to discoveredLocations.carne', () => {
		const vn = useVisualNovel({})
		vn.globalData.value = {
			discoveredLocations: {
				carne: ['carne_village_entrance']
			}
		}

		vn.storyData.value = {
			steps: [
				{
					type: 'discover-location',
					map: 'carne',
					location: 'carne_square',
					title: 'Центральная площадь'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.discoveredLocations.carne).toContain('carne_square')
		expect(vn.globalData.value.discoveredLocations.carne).toContain('carne_village_entrance')
	})

	it('discovers carne_fields and persists both locations in discoveredLocations.carne', () => {
		const vn = useVisualNovel({})
		vn.globalData.value = {
			discoveredLocations: {
				carne: ['carne_village_entrance', 'carne_square']
			}
		}

		vn.storyData.value = {
			steps: [
				{
					type: 'discover-location',
					map: 'carne',
					location: 'carne_fields',
					title: 'Северные поля'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.discoveredLocations.carne).toEqual([
			'carne_village_entrance',
			'carne_square',
			'carne_fields'
		])
	})

	it('transitions to carne_village_square scene, updates location and clears characters', () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_square: {
				id: 'carne_village_square',
				bg: 'grass.webp',
				clearCharacters: true,
				worldMap: 'newworld',
				localMap: 'carne',
				locationId: 'carne_square'
			}
		}
		vn.visibleCharacters.value = [{ id: 'enri' }]

		vn.storyData.value = {
			steps: [
				{
					type: 'scene',
					id: 'carne_village_square'
				}
			]
		}
		vn.processStep()

		expect(vn.currentScene.value?.id).toBe('carne_village_square')
		expect(vn.globalData.value.currentLocation).toBe('carne_square')
		expect(vn.globalData.value.localMap).toBe('carne')
		expect(vn.visibleCharacters.value).toHaveLength(0)
	})

	it('preserves discoveredLocations in save game state and restores it', async () => {
		const vn = useVisualNovel({})
		vn.globalData.value = {
			discoveredLocations: {
				newworld: ['carne_village'],
				carne: ['carne_village_entrance', 'carne_square']
			}
		}

		const state = vn.getGameState()
		expect(state.globalData.discoveredLocations.carne).toHaveLength(2)

		const vnRestore = useVisualNovel({})
		await vnRestore.restoreGameState(state)

		expect(vnRestore.globalData.value.discoveredLocations.carne).toEqual([
			'carne_village_entrance',
			'carne_square'
		])
	})

	it('provides active hotspot on carne_village_square leading to carne_chief_house', () => {
		const vn = useVisualNovel({})
		const squareScene = {
			id: 'carne_village_square',
			hotspots: [
				{
					id: 'to_chief_house',
					locationId: 'carne_chief_house',
					label: 'Дом старосты',
					icon: 'door',
					target: 'carne_chief_house',
					status: 'active'
				}
			]
		}

		expect(vn.getHotspotStatus('carne_village_square', squareScene.hotspots[0])).toBe('active')
	})

	it('navigates directly to registered scene without story steps when calling goto with sceneId', async () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_entrance: {
				id: 'carne_village_entrance',
				clearCharacters: true,
				locationId: 'carne_village_entrance',
				variables: ['global.toxic_gas = 0']
			}
		}
		vn.currentDialogue.value = 'Old dialogue'
		vn.visibleCharacters.value = [{ id: 'enri' }]

		await vn.goto('carne_village_entrance')

		expect(vn.currentScene.value?.id).toBe('carne_village_entrance')
		expect(vn.currentDialogue.value).toBe('')
		expect(vn.visibleCharacters.value).toHaveLength(0)
		expect(vn.globalData.value.toxic_gas).toBe(0)
	})

	it('supports mapOverrides for event-based interception and restores scene default on delete', () => {
		const vn = useVisualNovel({})
		vn.globalData.value = {
			mapOverrides: {
				carne: {
					carne_square: 'carne_square_arrival'
				}
			}
		}

		// Active override
		expect(vn.globalData.value.mapOverrides?.carne?.carne_square).toBe('carne_square_arrival')

		// Delete override after story event completes
		delete vn.globalData.value.mapOverrides.carne.carne_square
		expect(vn.globalData.value.mapOverrides?.carne?.carne_square).toBeUndefined()
	})

	it('resolves carne_village_entrance to_square hotspot based on discovery', () => {
		const vn = useVisualNovel({})
		const entranceScene = {
			id: 'carne_village_entrance',
			hotspots: [
				{
					id: 'to_square',
					locationId: 'carne_square',
					label: 'Центральная площадь',
					icon: 'gate',
					target: 'carne_village_square',
					condition: "global.discoveredLocations?.carne?.includes('carne_square')",
					fallbackStatus: 'hidden'
				}
			]
		}

		vn.globalData.value = {
			discoveredLocations: { carne: ['carne_village_entrance'] }
		}

		// Initially hidden
		expect(vn.getHotspotStatus('carne_village_entrance', entranceScene.hotspots[0])).toBe('hidden')

		// Once square is discovered, hotspot becomes active
		vn.globalData.value.discoveredLocations.carne.push('carne_square')
		expect(vn.getHotspotStatus('carne_village_entrance', entranceScene.hotspots[0])).toBe('active')
	})
})
