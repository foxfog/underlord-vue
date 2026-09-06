import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'
import { useQuests } from '../useQuests'
import { DIALOGUE_HIDE_UI_CONFIG } from '../../constants/dialogue'
import { advanceTimeOfDay, getCalendarInfo } from '../../utils/timeCalendar'

describe('Time and Calendar Visual Novel Integration', () => {
	it('should include next-time-button in DIALOGUE_HIDE_UI_CONFIG', () => {
		expect(DIALOGUE_HIDE_UI_CONFIG).toContain('next-time-button')
	})

	it('advances time of day through all 4 phases and increments day on night->morning', () => {
		const state = {
			timeOfDay: 'morning',
			day: 0,
			calendarType: 'new_world',
			month: 3,
			dayOfMonth: 1
		}

		// morning -> day
		let adv1 = advanceTimeOfDay(state.timeOfDay)
		expect(adv1.nextPeriod).toBe('day')
		expect(adv1.dayIncremented).toBe(false)
		state.timeOfDay = adv1.nextPeriod

		// day -> evening
		let adv2 = advanceTimeOfDay(state.timeOfDay)
		expect(adv2.nextPeriod).toBe('evening')
		expect(adv2.dayIncremented).toBe(false)
		state.timeOfDay = adv2.nextPeriod

		// evening -> night
		let adv3 = advanceTimeOfDay(state.timeOfDay)
		expect(adv3.nextPeriod).toBe('night')
		expect(adv3.dayIncremented).toBe(false)
		state.timeOfDay = adv3.nextPeriod

		// night -> morning (increments day)
		let adv4 = advanceTimeOfDay(state.timeOfDay)
		expect(adv4.nextPeriod).toBe('morning')
		expect(adv4.dayIncremented).toBe(true)
		state.timeOfDay = adv4.nextPeriod
		if (adv4.dayIncremented) {
			state.day += 1
		}

		expect(state.day).toBe(1)
		expect(state.timeOfDay).toBe('morning')

		const calInfo = getCalendarInfo(state)
		expect(calInfo.dayCount).toBe(1)
		expect(calInfo.dayOfMonth).toBe(2) // 2nd day of Month of Warm Wind
		expect(calInfo.monthName).toBe('Месяц теплого ветра')
	})

	it('handles transitioning from Real world 2138 to New World', () => {
		// Earth / Intro state
		const earthState = {
			calendarType: 'real',
			year: 2138,
			month: 12,
			dayOfMonth: 18,
			day: 0,
			time: '20:52',
			timeOfDay: 'evening'
		}

		let info = getCalendarInfo(earthState)
		expect(info.calendarType).toBe('real')
		expect(info.year).toBe(2138)
		expect(info.monthName).toBe('Декабрь')
		expect(info.dayOfMonth).toBe(18)
		expect(info.timePeriod).toBe('evening')
		expect(info.timeString).toBe('20:52')

		// Transport to New World (starts at Month 3, Day 1)
		const newWorldState = {
			...earthState,
			calendarType: 'new_world',
			year: 0,
			month: 3,
			dayOfMonth: 1,
			day: 0,
			timeOfDay: 'morning'
		}

		let nwInfo = getCalendarInfo(newWorldState)
		expect(nwInfo.calendarType).toBe('new_world')
		expect(nwInfo.year).toBe(0)
		expect(nwInfo.month).toBe(3)
		expect(nwInfo.monthName).toBe('Месяц теплого ветра')
		expect(nwInfo.seasonRu).toBe('Весна')
		expect(nwInfo.dayOfMonth).toBe(1)
		expect(nwInfo.timePeriod).toBe('morning')
	})
})

describe('UI Visibility Reactivity and Event Emission', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('emits ui-visibility-changed on initialization and when baseUiVisibility changes', async () => {
		const emit = vi.fn()
		const vn = useVisualNovel({ emit })

		// Initial emit happens via immediate watcher
		expect(emit).toHaveBeenCalledWith(
			'ui-visibility-changed',
			expect.objectContaining({
				topbar: false,
				'inventory-button': false,
				'map-button': false
			})
		)

		// Change baseUiVisibility
		vn.baseUiVisibility.value['inventory-button'] = true
		vn.baseUiVisibility.value['journal-button'] = true
		vn.baseUiVisibility.value.hotbar = true
		await nextTick()

		// Should emit updated visibility
		expect(emit).toHaveBeenCalledWith(
			'ui-visibility-changed',
			expect.objectContaining({
				'inventory-button': true,
				'journal-button': true,
				hotbar: true,
				topbar: true
			})
		)

		expect(vn.uiVisibility.value['inventory-button']).toBe(true)
		expect(vn.uiVisibility.value.topbar).toBe(true)
	})

	it('shows map-button and computes topbar to true', async () => {
		const emit = vi.fn()
		const vn = useVisualNovel({ emit })

		vn.baseUiVisibility.value['map-button'] = true
		await nextTick()

		expect(vn.uiVisibility.value['map-button']).toBe(true)
		expect(vn.uiVisibility.value.topbar).toBe(true)
	})

	it('resets baseUiVisibility and quests on resetGameState', async () => {
		const emit = vi.fn()
		const vn = useVisualNovel({ emit })
		const questsManager = useQuests()

		// Start a quest and show UI
		questsManager.startQuest({ id: 'test_quest', title: 'Test Quest' })
		expect(questsManager.allQuests.value.length).toBe(1)

		vn.baseUiVisibility.value['map-button'] = true
		vn.baseUiVisibility.value.topbar = true
		await nextTick()
		expect(vn.uiVisibility.value['map-button']).toBe(true)

		// Call resetGameState
		vn.resetGameState()
		await nextTick()

		// Quests should be empty
		expect(questsManager.allQuests.value.length).toBe(0)

		// UI visibility should be reset
		expect(vn.uiVisibility.value['map-button']).toBe(false)
		expect(vn.uiVisibility.value.topbar).toBe(false)
	})
})

describe('Story Engine Fade Transitions', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
		vi.useRealTimers()
	})

	it('fade-in step initializes solid overlay and smoothly fades to transparent', () => {
		vi.useFakeTimers()
		const vn = useVisualNovel({})

		vn.storyData.value = {
			steps: [
				{ type: 'fade', action: 'in', duration: 1.5, color: '#000000' },
				{ type: 'dialogue', character: 'mc', text: 'Where am I?' }
			]
		}

		vn.processStep()

		// Step 0: Fade In starts solid black
		expect(vn.fadeOverlay.value.visible).toBe(true)
		expect(vn.fadeOverlay.value.opacity).toBe(1)
		expect(vn.fadeOverlay.value.color).toBe('#000000')

		// Advance 35ms: transition opacity to 0 starts
		vi.advanceTimersByTime(35)
		expect(vn.fadeOverlay.value.opacity).toBe(0)
		expect(vn.fadeOverlay.value.duration).toBe(1.5)
		expect(vn.currentDialogue.value).toBe('') // Dialogue has not appeared yet

		// Advance past duration (1500ms + 50ms)
		vi.advanceTimersByTime(1550)
		expect(vn.fadeOverlay.value.visible).toBe(false)
		expect(vn.currentDialogue.value).toBe('Where am I?')

		vi.useRealTimers()
	})

	it('fade-out step starts transparent and animates to solid', () => {
		vi.useFakeTimers()
		const vn = useVisualNovel({})

		vn.storyData.value = {
			steps: [
				{ type: 'fade-out', duration: 2, color: '#112233' },
				{ type: 'dialogue', character: 'mc', text: 'After fade out' }
			]
		}

		vn.processStep()

		expect(vn.fadeOverlay.value.visible).toBe(true)
		expect(vn.fadeOverlay.value.opacity).toBe(0)
		expect(vn.fadeOverlay.value.color).toBe('#112233')

		vi.advanceTimersByTime(35)
		expect(vn.fadeOverlay.value.opacity).toBe(1)
		expect(vn.fadeOverlay.value.duration).toBe(2)

		vi.advanceTimersByTime(2050)
		expect(vn.currentDialogue.value).toBe('After fade out')

		vi.useRealTimers()
	})

	it('allows skipping fade wait by calling advanceStory', () => {
		vi.useFakeTimers()
		const vn = useVisualNovel({})

		vn.storyData.value = {
			steps: [
				{ type: 'fade', action: 'in', duration: 3 },
				{ type: 'dialogue', character: 'mc', text: 'Skipped!' }
			]
		}

		vn.processStep()
		expect(vn.fadeOverlay.value.visible).toBe(true)

		// User clicks to advance mid-fade
		vi.advanceTimersByTime(200)
		vn.advanceStory()

		expect(vn.fadeOverlay.value.visible).toBe(false)
		expect(vn.currentDialogue.value).toBe('Skipped!')

		vi.useRealTimers()
	})

	it('resets fadeOverlay state on resetGameState', () => {
		const vn = useVisualNovel({})

		expect(vn.fadeOverlay.value.visible).toBe(false)
		expect(vn.fadeOverlay.value.opacity).toBe(0)

		vn.fadeOverlay.value.visible = true
		vn.fadeOverlay.value.opacity = 0.5
		vn.resetGameState()

		expect(vn.fadeOverlay.value.visible).toBe(false)
		expect(vn.fadeOverlay.value.opacity).toBe(0)
	})
})

describe('Scene and Step Character Clearing', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('clears characters when scene step has clearCharacters: true', () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			test_scene: { id: 'test_scene', bg: 'bg.jpg' }
		}
		vn.visibleCharacters.value = [{ id: 'mc' }, { id: 'albedo' }]
		expect(vn.visibleCharacters.value).toHaveLength(2)

		vn.storyData.value = {
			steps: [{ type: 'scene', id: 'test_scene', clearCharacters: true }]
		}
		vn.processStep()

		expect(vn.visibleCharacters.value).toHaveLength(0)
	})

	it('clears characters when scene definition in sceneData has clearCharacters: true', () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_entrance: {
				id: 'carne_village_entrance',
				bg: 'grass.webp',
				clearCharacters: true
			}
		}
		vn.visibleCharacters.value = [{ id: 'mc' }]
		expect(vn.visibleCharacters.value).toHaveLength(1)

		vn.storyData.value = {
			steps: [{ type: 'scene', id: 'carne_village_entrance' }]
		}
		vn.processStep()

		expect(vn.visibleCharacters.value).toHaveLength(0)
	})

	it('clears specific characters when clearCharacters is an array', () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			test_scene: { id: 'test_scene', bg: 'bg.jpg' }
		}
		vn.visibleCharacters.value = [{ id: 'mc' }, { id: 'albedo' }, { id: 'shalltear' }]

		vn.storyData.value = {
			steps: [
				{
					type: 'scene',
					id: 'test_scene',
					clearCharacters: ['albedo', 'shalltear']
				}
			]
		}
		vn.processStep()

		expect(vn.visibleCharacters.value).toHaveLength(1)
		expect(vn.visibleCharacters.value[0].id).toBe('mc')
	})

	it('clears characters via hide-all or clear-characters step', () => {
		const vn = useVisualNovel({})
		vn.visibleCharacters.value = [{ id: 'mc' }]

		vn.storyData.value = {
			steps: [{ type: 'hide-all' }]
		}
		vn.processStep()

		expect(vn.visibleCharacters.value).toHaveLength(0)
	})
})

describe('Automatic World and Local Map Resolution', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('automatically sets worldMap, localMap, and currentLocation from scene definition', () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_entrance: {
				id: 'carne_village_entrance',
				bg: 'grass.webp',
				worldMap: 'newworld',
				localMap: 'carne',
				locationId: 'carne_village_entrance'
			}
		}

		vn.storyData.value = {
			steps: [{ type: 'scene', id: 'carne_village_entrance' }]
		}
		vn.processStep()

		expect(vn.globalData.value.worldMap).toBe('newworld')
		expect(vn.globalData.value.localMap).toBe('carne')
		expect(vn.globalData.value.currentMap).toBe('carne')
		expect(vn.globalData.value.currentLocation).toBe('carne_village_entrance')
	})

	it('heuristically infers newworld and carne in New World when scene starts with carne', () => {
		const vn = useVisualNovel({})
		vn.globalData.value.calendarType = 'new_world'
		vn.sceneData.value = {
			carne_forest_edge: {
				id: 'carne_forest_edge',
				bg: 'forest.webp'
			}
		}

		vn.storyData.value = {
			steps: [{ type: 'scene', id: 'carne_forest_edge' }]
		}
		vn.processStep()

		expect(vn.globalData.value.worldMap).toBe('newworld')
		expect(vn.globalData.value.localMap).toBe('carne')
		expect(vn.globalData.value.currentMap).toBe('carne')
	})

	it('handles explicit type: "map" step', () => {
		const vn = useVisualNovel({})
		vn.storyData.value = {
			steps: [
				{
					type: 'map',
					worldMap: 'newworld',
					localMap: 'carne',
					locationId: 'carne_square'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.worldMap).toBe('newworld')
		expect(vn.globalData.value.localMap).toBe('carne')
		expect(vn.globalData.value.currentLocation).toBe('carne_square')
	})
})

describe('Map Marker Discovery and Persistence', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('initializes default discovered locations on resetGameState', () => {
		const vn = useVisualNovel({})
		vn.resetGameState()

		expect(vn.globalData.value.discoveredLocations).toBeDefined()
		expect(vn.globalData.value.discoveredLocations.cybercity).toEqual(['factory', 'home'])
		expect(vn.globalData.value.discoveredLocations.newworld).toEqual(['carne_village'])
		expect(vn.globalData.value.discoveredLocations.carne).toEqual(['carne_village_entrance'])
	})

	it('discovers a location via discover-location step and emits global-data-changed', () => {
		let emittedData = null
		const emitMock = vi.fn((event, data) => {
			if (event === 'global-data-changed') {
				emittedData = data
			}
		})

		const vn = useVisualNovel({ emit: emitMock })
		vn.resetGameState()

		vn.storyData.value = {
			steps: [
				{
					type: 'discover-location',
					map: 'carne',
					location: 'carne_chief_house',
					title: 'Дом старосты'
				}
			]
		}
		vn.processStep()

		expect(vn.isLocationDiscovered('carne', 'carne_chief_house')).toBe(true)
		expect(vn.globalData.value.discoveredLocations.carne).toContain('carne_chief_house')
		expect(emitMock).toHaveBeenCalledWith('global-data-changed', vn.globalData.value)
	})

	it('handles discovery of multiple locations at once and prevents duplicates', () => {
		const vn = useVisualNovel({})
		vn.resetGameState()

		vn.storyData.value = {
			steps: [
				{
					type: 'discover-location',
					map: 'newworld',
					locations: ['great_tomb_nazarick', 'e_rantel', 'carne_village']
				}
			]
		}
		vn.processStep()

		const newworldLocs = vn.globalData.value.discoveredLocations.newworld
		expect(newworldLocs).toContain('great_tomb_nazarick')
		expect(newworldLocs).toContain('e_rantel')
		// carne_village was already there, so count should be 1
		expect(newworldLocs.filter((l) => l === 'carne_village')).toHaveLength(1)
	})

	it('discovers location via map step with discover property', () => {
		const vn = useVisualNovel({})
		vn.resetGameState()

		vn.storyData.value = {
			steps: [
				{
					type: 'map',
					localMap: 'carne',
					discover: 'carne_square',
					locationId: 'carne_square'
				}
			]
		}
		vn.processStep()

		expect(vn.globalData.value.discoveredLocations.carne).toContain('carne_square')
		expect(vn.globalData.value.currentLocation).toBe('carne_square')
	})

	it('persists and restores discoveredLocations in save game state', async () => {
		const vn = useVisualNovel({})
		vn.resetGameState()

		vn.discoverLocation('carne', 'carne_fields')
		vn.discoverLocation('newworld', 'tob_forest')

		const saved = vn.getGameState()
		expect(saved.globalData.discoveredLocations.carne).toContain('carne_fields')
		expect(saved.globalData.discoveredLocations.newworld).toContain('tob_forest')

		// New VN instance restoring saved data
		const vn2 = useVisualNovel({})
		await vn2.restoreGameState(saved)

		expect(vn2.globalData.value.discoveredLocations.carne).toContain('carne_fields')
		expect(vn2.globalData.value.discoveredLocations.newworld).toContain('tob_forest')
		expect(vn2.isLocationDiscovered('carne', 'carne_fields')).toBe(true)
	})

	it('backfills default discoveredLocations when restoring a legacy save without them', async () => {
		const legacySave = {
			stepIndex: 0,
			storyId: 'start',
			globalData: {
				currentMap: 'cybercity'
			}
		}

		const vn = useVisualNovel({})
		await vn.restoreGameState(legacySave)

		expect(vn.globalData.value.discoveredLocations).toBeDefined()
		expect(vn.globalData.value.discoveredLocations.cybercity).toEqual(['factory', 'home'])
		expect(vn.globalData.value.discoveredLocations.newworld).toEqual(['carne_village'])
		expect(vn.globalData.value.discoveredLocations.carne).toEqual(['carne_village_entrance'])
	})

	it('sets intro variables to real calendar and evening time at start of game', () => {
		const vn = useVisualNovel({})
		vn.storyData.value = {
			steps: [
				{ variable: "global.calendarType = 'real'" },
				{ variable: "global.year = 2138" },
				{ variable: "global.month = 12" },
				{ variable: "global.dayOfMonth = 18" },
				{ variable: "global.day = 0" },
				{ variable: "global.time = '20:52'" },
				{ variable: "global.timeOfDay = 'evening'" },
				{ variable: "global.currentMap = 'cybercity'" },
				{ variable: "global.currentLocation = 'factory'" },
				{ type: 'discover-location', map: 'cybercity', locations: ['factory', 'home'] }
			]
		}

		vn.processStep()

		expect(vn.globalData.value.calendarType).toBe('real')
		expect(vn.globalData.value.timeOfDay).toBe('evening')
		expect(vn.globalData.value.time).toBe('20:52')
		expect(vn.globalData.value.currentMap).toBe('cybercity')
		expect(vn.globalData.value.currentLocation).toBe('factory')
		expect(vn.globalData.value.discoveredLocations.cybercity).toEqual(['factory', 'home'])

		const calInfo = getCalendarInfo(vn.globalData.value)
		expect(calInfo.timePeriod).toBe('evening')
		expect(calInfo.timeString).toBe('20:52')
		expect(calInfo.calendarType).toBe('real')
		expect(calInfo.formattedShort).toContain('2138')
	})
})

describe('UI Visibility for date-badge and next-time-button', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('hides next-time-button and date-badge via ui action step', () => {
		const vn = useVisualNovel({})
		expect(vn.uiVisibility.value['date-badge']).toBe(true)

		vn.storyData.value = {
			steps: [
				{
					type: 'ui',
					action: 'show',
					target: ['inventory-button', 'journal-button', 'map-button']
				},
				{
					type: 'ui',
					action: 'hide',
					target: ['next-time-button', 'date-badge']
				}
			]
		}

		vn.processStep()

		expect(vn.uiVisibility.value['inventory-button']).toBe(true)
		expect(vn.uiVisibility.value['journal-button']).toBe(true)
		expect(vn.uiVisibility.value['map-button']).toBe(true)
		expect(vn.uiVisibility.value['next-time-button']).toBe(false)
		expect(vn.uiVisibility.value['date-badge']).toBe(false)
	})

	it('restores date-badge on resetStory / resetGameState', () => {
		const vn = useVisualNovel({})
		vn.storyData.value = {
			steps: [
				{
					type: 'ui',
					action: 'hide',
					target: ['date-badge']
				}
			]
		}
		vn.processStep()
		expect(vn.uiVisibility.value['date-badge']).toBe(false)

		vn.resetGameState()
		expect(vn.uiVisibility.value['date-badge']).toBe(true)
		expect(vn.uiVisibility.value['calendar-button']).toBe(true)
	})

	it('shows calendar-button and date-badge when topbar is shown or explicitly shown', () => {
		const vn = useVisualNovel({})
		// Step 0: hide all, then hold
		vn.storyData.value = {
			steps: [
				{
					type: 'ui',
					action: 'hide',
					target: ['all']
				},
				{
					type: 'hold'
				},
				{
					type: 'ui',
					action: 'show',
					target: ['topbar', 'hotbar', 'inventory-button', 'journal-button', 'date-badge']
				}
			]
		}
		vn.processStep() // hides all and pauses at hold
		expect(vn.uiVisibility.value['date-badge']).toBe(false)
		expect(vn.uiVisibility.value['calendar-button']).toBe(false)

		vn.stepIndex.value = 2
		vn.processStep() // executes show step
		expect(vn.uiVisibility.value['date-badge']).toBe(true)
		expect(vn.uiVisibility.value['calendar-button']).toBe(true)
		expect(vn.uiVisibility.value['inventory-button']).toBe(true)
	})

	it('supports calendar-button as an alias for date-badge in hide action', () => {
		const vn = useVisualNovel({})
		vn.storyData.value = {
			steps: [
				{
					type: 'ui',
					action: 'hide',
					target: ['calendar-button']
				}
			]
		}
		vn.processStep()
		expect(vn.uiVisibility.value['date-badge']).toBe(false)
		expect(vn.uiVisibility.value['calendar-button']).toBe(false)
	})
})

describe('Intro New World Arrival Transition and Label Seeking', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('jumps directly to intro_carne_arrival step when already in intro story', async () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_entrance: {
				id: 'carne_village_entrance',
				bg: 'grass.webp'
			}
		}
		vn.storyData.value = {
			id: 'intro',
			steps: [
				{ id: 'start_step', type: 'dialogue', text: 'City step' },
				{ id: 'apartment_hold', type: 'hold' },
				{
					id: 'intro_carne_arrival',
					label: 'new_world_carne',
					type: 'scene',
					scene: 'carne_village_entrance'
				},
				{ type: 'dialogue', character: 'mc', text: 'Where am I?' }
			]
		}
		vn.stepIndex.value = 1 // at apartment hold

		await vn.goto('intro_carne_arrival')

		expect(vn.currentScene.value?.id).toBe('carne_village_entrance')
		expect(vn.currentDialogue.value).toBe('Where am I?')
	})

	it('supports legacy new_world_carne alias to jump to intro_carne_arrival', async () => {
		const vn = useVisualNovel({})
		vn.sceneData.value = {
			carne_village_entrance: {
				id: 'carne_village_entrance',
				bg: 'grass.webp'
			}
		}
		vn.storyData.value = {
			id: 'intro',
			steps: [
				{ id: 'start_step', type: 'dialogue', text: 'City step' },
				{
					id: 'intro_carne_arrival',
					label: 'new_world_carne',
					type: 'scene',
					scene: 'carne_village_entrance'
				},
				{ type: 'dialogue', character: 'mc', text: 'Where am I?' }
			]
		}
		vn.stepIndex.value = 0

		await vn.goto('new_world_carne')

		expect(vn.currentScene.value?.id).toBe('carne_village_entrance')
		expect(vn.currentDialogue.value).toBe('Where am I?')
	})
})



