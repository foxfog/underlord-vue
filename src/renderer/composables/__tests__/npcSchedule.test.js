import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useNpcSchedule } from '../useNpcSchedule'
import { useQuests } from '../useQuests'

describe('useNpcSchedule composable', () => {
	let scheduleManager

	beforeEach(() => {
		scheduleManager = useNpcSchedule()
		scheduleManager.resetState()
		useQuests().resetQuests()

		// Sample test schedules
		scheduleManager.loadSchedules({
			characters: {
				'carne-chief': {
					defaultLocation: 'carne_chief_house',
					locationKnown: true,
					schedules: [
						{
							id: 'chief_injured',
							targetScene: 'carne_chief_bed',
							position: { r: 10, l: 'auto' },
							orientation: 'left',
							conditions: {
								state: 'injured'
							}
						},
						{
							id: 'chief_square_day',
							targetScene: 'carne_village_square',
							position: { l: 40, r: 'auto' },
							orientation: 'right',
							conditions: {
								timePhase: ['morning', 'day']
							}
						},
						{
							id: 'chief_house_night',
							targetScene: 'carne_chief_house',
							position: { r: 15, l: 'auto', b: 0 },
							orientation: 'left',
							conditions: {
								timePhase: ['evening', 'night']
							}
						}
					]
				},
				'villager-bob': {
					locationKnown: false,
					schedules: [
						{
							id: 'bob_fields',
							targetScene: 'carne_fields',
							position: { l: 20, r: 'auto' },
							conditions: {
								timePhase: 'day',
								variable: 'global.bob_alive === true'
							}
						}
					]
				}
			}
		})

		scheduleManager.loadScenes([
			{ id: 'carne_chief_house', name: 'Дом старосты', localMap: 'carne' },
			{ id: 'carne_village_square', name: 'Центральная площадь', localMap: 'carne' },
			{ id: 'carne_fields', name: 'Северные поля', localMap: 'carne' },
			{ id: 'carne_chief_bed', name: 'Спальня старосты', localMap: 'carne' }
		])
	})

	describe('Schedule rule evaluation', () => {
		it('places chief on village square during day', () => {
			const context = {
				globalData: { timeOfDay: 'day' }
			}
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc).not.toBeNull()
			expect(loc.sceneId).toBe('carne_village_square')
			expect(loc.position).toEqual({ l: 40, r: 'auto' })
			expect(loc.orientation).toBe('right')
		})

		it('places chief in house during night', () => {
			const context = {
				globalData: { timeOfDay: 'night' }
			}
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc).not.toBeNull()
			expect(loc.sceneId).toBe('carne_chief_house')
			expect(loc.position).toEqual({ r: 15, l: 'auto', b: 0 })
			expect(loc.orientation).toBe('left')
		})

		it('applies custom state condition (injured) with higher priority than time of day', () => {
			scheduleManager.setNpcState('carne-chief', 'injured')
			const context = {
				globalData: { timeOfDay: 'day' }
			}
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc).not.toBeNull()
			expect(loc.sceneId).toBe('carne_chief_bed')
			expect(loc.position).toEqual({ r: 10, l: 'auto' })
		})

		it('returns null by default when conditions do not match (NPC is nowhere)', () => {
			const context = {
				globalData: { timeOfDay: 'night', bob_alive: true }
			}
			// bob is only scheduled for 'day'
			const loc = scheduleManager.resolveNpcLocation('villager-bob', context)
			expect(loc).toBeNull()
		})

		it('checks variable expression conditions', () => {
			// day, but bob_alive is false
			const contextDead = {
				globalData: { timeOfDay: 'day', bob_alive: false }
			}
			expect(scheduleManager.resolveNpcLocation('villager-bob', contextDead)).toBeNull()

			// day and bob_alive is true
			const contextAlive = {
				globalData: { timeOfDay: 'day', bob_alive: true }
			}
			const loc = scheduleManager.resolveNpcLocation('villager-bob', contextAlive)
			expect(loc).not.toBeNull()
			expect(loc.sceneId).toBe('carne_fields')
		})
	})

	describe('Manual Overrides', () => {
		it('takes highest priority over schedules and conditions', () => {
			scheduleManager.overrideNpcLocation('carne-chief', {
				scene: 'carne_fields',
				position: { l: 50, r: 'auto' },
				orientation: 'right'
			})

			const context = { globalData: { timeOfDay: 'night' } }
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc).not.toBeNull()
			expect(loc.sceneId).toBe('carne_fields')
			expect(loc.position).toEqual({ l: 50, r: 'auto' })
			expect(loc.isOverride).toBe(true)
		})

		it('allows explicit hiding via override scene "none"', () => {
			scheduleManager.overrideNpcLocation('carne-chief', { scene: 'none' })
			const context = { globalData: { timeOfDay: 'night' } }
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc).toBeNull()
		})

		it('restores normal schedule when override is cleared', () => {
			scheduleManager.overrideNpcLocation('carne-chief', { scene: 'carne_fields' })
			scheduleManager.clearNpcOverride('carne-chief')

			const context = { globalData: { timeOfDay: 'night' } }
			const loc = scheduleManager.resolveNpcLocation('carne-chief', context)
			expect(loc.sceneId).toBe('carne_chief_house')
		})
	})

	describe('Scene Population and Refreshing', () => {
		it('populates visibleCharacters for the specified scene', () => {
			const visibleCharactersRef = ref([])
			const characterDataRef = ref({
				'carne-chief': { id: 'carne-chief', name: 'Староста', title: 'Староста деревни' }
			})

			const context = { globalData: { timeOfDay: 'night' } }
			scheduleManager.populateSceneCharacters(
				'carne_chief_house',
				context,
				visibleCharactersRef,
				characterDataRef
			)

			expect(visibleCharactersRef.value).toHaveLength(1)
			expect(visibleCharactersRef.value[0].id).toBe('carne-chief')
			expect(visibleCharactersRef.value[0].position).toEqual({ r: 15, l: 'auto', b: 0 })
			expect(visibleCharactersRef.value[0].orientation).toBe('left')
			expect(visibleCharactersRef.value[0]._isScheduledNpc).toBe(true)
		})

		it('refreshes scene NPCs when time advances', () => {
			const visibleCharactersRef = ref([])
			const characterDataRef = ref({
				'carne-chief': { id: 'carne-chief', name: 'Староста' }
			})

			// Start in the square during day -> chief is there
			scheduleManager.populateSceneCharacters(
				'carne_village_square',
				{ globalData: { timeOfDay: 'day' } },
				visibleCharactersRef,
				characterDataRef
			)
			expect(visibleCharactersRef.value).toHaveLength(1)
			expect(visibleCharactersRef.value[0].id).toBe('carne-chief')

			// Advance time to night -> chief goes home, square has no chief
			scheduleManager.refreshSceneNpcs(
				'carne_village_square',
				{ globalData: { timeOfDay: 'night' } },
				visibleCharactersRef,
				characterDataRef
			)
			expect(visibleCharactersRef.value).toHaveLength(0)
		})
	})

	describe('Location Display in Journal/Encyclopedia', () => {
		it('formats location nicely when known', () => {
			const context = { globalData: { timeOfDay: 'night' } }
			const display = scheduleManager.getNpcLocationDisplay('carne-chief', context)
			expect(display).toBe('Дом старосты (Деревня Карн)')
		})

		it('returns "Неизвестно" when location is unknown', () => {
			const context = { globalData: { timeOfDay: 'day', bob_alive: true } }
			// bob has locationKnown: false
			const display = scheduleManager.getNpcLocationDisplay('villager-bob', context)
			expect(display).toBe('Неизвестно')
		})

		it('shows location once player visits the scene where NPC is located', () => {
			const visibleCharactersRef = ref([])
			const characterDataRef = ref({
				'villager-bob': { id: 'villager-bob', name: 'Боб' }
			})

			const context = { globalData: { timeOfDay: 'day', bob_alive: true } }
			expect(scheduleManager.isNpcLocationKnown('villager-bob')).toBe(false)

			// Player enters carne_fields
			scheduleManager.populateSceneCharacters(
				'carne_fields',
				context,
				visibleCharactersRef,
				characterDataRef
			)

			expect(scheduleManager.isNpcLocationKnown('villager-bob')).toBe(true)
			expect(scheduleManager.getNpcLocationDisplay('villager-bob', context)).toBe(
				'Северные поля (Деревня Карн)'
			)
		})
	})

	describe('State serialization (Save & Load)', () => {
		it('saves and restores npcStates properly', () => {
			scheduleManager.setNpcState('carne-chief', 'injured')
			scheduleManager.overrideNpcLocation('carne-chief', { scene: 'carne_fields' })
			scheduleManager.setNpcLocationKnown('villager-bob', true)

			const savedState = scheduleManager.getState()

			// Reset
			scheduleManager.resetState()
			expect(scheduleManager.getNpcState('carne-chief').state).toBe('default')
			expect(scheduleManager.getNpcState('carne-chief').overrideScene).toBeNull()

			// Load
			scheduleManager.loadState(savedState)
			expect(scheduleManager.getNpcState('carne-chief').state).toBe('injured')
			expect(scheduleManager.getNpcState('carne-chief').overrideScene).toBe('carne_fields')
			expect(scheduleManager.isNpcLocationKnown('villager-bob')).toBe(true)
		})
	})

	describe('Visual Novel Engine Integration', () => {
		it('executes npc step actions in story', async () => {
			const { createPinia, setActivePinia } = await import('pinia')
			const { initSettingsStore } = await import('../../stores/settings')
			const { useVisualNovel } = await import('../useVisualNovel')

			setActivePinia(createPinia())
			initSettingsStore()

			const vn = useVisualNovel({})
			vn.characterData.value = {
				'carne-chief': { id: 'carne-chief', name: 'Староста' }
			}
			vn.sceneData.value = {
				carne_chief_house: { id: 'carne_chief_house', name: 'Дом старосты', clearCharacters: true }
			}

			// 1. Override action
			vn.storyData.value = {
				steps: [
					{
						type: 'npc',
						action: 'override',
						character: 'carne-chief',
						scene: 'carne_village_square',
						position: { r: 25, l: 'auto' }
					}
				]
			}
			vn.processStep()

			const state = scheduleManager.getNpcState('carne-chief')
			expect(state.overrideScene).toBe('carne_village_square')
			expect(state.overridePosition).toEqual({ r: 25, l: 'auto' })

			// 2. Clear override
			vn.storyData.value = {
				steps: [
					{
						type: 'npc',
						action: 'clear-override',
						character: 'carne-chief'
					}
				]
			}
			vn.stepIndex.value = 0
			vn.processStep()
			expect(scheduleManager.getNpcState('carne-chief').overrideScene).toBeNull()

			// 3. changeScene automatically populates carne_chief_house
			vn.globalData.value.timeOfDay = 'night'
			vn.changeScene('carne_chief_house')
			expect(vn.visibleCharacters.value).toHaveLength(1)
			expect(vn.visibleCharacters.value[0].id).toBe('carne-chief')
			expect(vn.visibleCharacters.value[0].position).toEqual({ r: 15, l: 'auto', b: 0 })
			expect(vn.visibleCharacters.value[0].orientation).toBe('left')
		})
	})
})


describe('checkConditions — dayOfWeek, dayOfMonth, month', () => {
	let sm

	beforeEach(() => {
		sm = useNpcSchedule()
		sm.resetState()
		sm.loadSchedules({ characters: {} })
	})

	// New World calendar math reference:
	// startDayInYear = (month-1)*30 + (dayOfMonth-1)
	// totalDays = startDayInYear + day
	// currentDayOfWeek = (totalDays % 7 + 7) % 7 + 1  (1=Mon, 7=Sun)
	// currentDayOfMonth = totalDays % 30 + 1
	// currentMonth = floor(totalDays / 30) + 1 (within year)

	it('matches dayOfWeek by number', () => {
		// month=3, dayOfMonth=1, day=3 => startDayInYear=60, totalDays=63, dow=(63%7+7)%7+1=1 (Mon)
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 3 } }
		expect(sm.checkConditions({ dayOfWeek: 1 }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 2 }, ctx)).toBe(false)
	})

	it('matches dayOfWeek by English name (full and short)', () => {
		// totalDays=63 => dow=1 (Monday)
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 3 } }
		expect(sm.checkConditions({ dayOfWeek: 'Monday' }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 'Mon' }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 'tuesday' }, ctx)).toBe(false)
	})

	it('matches dayOfWeek by Russian name (full and short)', () => {
		// totalDays=63 => dow=1 (Понедельник)
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 3 } }
		expect(sm.checkConditions({ dayOfWeek: 'Понедельник' }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 'Пн' }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 'Вторник' }, ctx)).toBe(false)
	})

	it('matches dayOfWeek array (weekend check)', () => {
		// month=3, dayOfMonth=1, day=8 => startDayInYear=60, totalDays=68, dow=(68%7+7)%7+1=(5+7)%7+1=6 (Sat)
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 8 } }
		expect(sm.checkConditions({ dayOfWeek: [6, 7] }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: [1, 2, 3, 4, 5] }, ctx)).toBe(false)
	})

	it('matches dayOfMonth by exact number', () => {
		// month=3, dayOfMonth=1, day=4 => totalDays=64, dayInYear=64, dom=64%30+1=5
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 4 } }
		expect(sm.checkConditions({ dayOfMonth: 5 }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfMonth: 1 }, ctx)).toBe(false)
	})

	it('matches dayOfMonth by array', () => {
		// dom=5
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 4 } }
		expect(sm.checkConditions({ dayOfMonth: [3, 5, 7] }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfMonth: [1, 2, 4] }, ctx)).toBe(false)
	})

	it('matches dayOfMonth with range object', () => {
		// dom=5
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 4 } }
		expect(sm.checkConditions({ dayOfMonth: { min: 1, max: 10 } }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfMonth: { min: 15, max: 30 } }, ctx)).toBe(false)
	})

	it('matches month by number', () => {
		const ctx = { globalData: { world: 'new_world', month: 6, dayOfMonth: 1, day: 0 } }
		expect(sm.checkConditions({ month: 6 }, ctx)).toBe(true)
		expect(sm.checkConditions({ month: [5, 6, 7] }, ctx)).toBe(true)
		expect(sm.checkConditions({ month: 3 }, ctx)).toBe(false)
	})

	it('matches month by New World name (ru and en)', () => {
		// month=6 = 'Месяц первой искры' / 'Month of First Spark'
		const ctx = { globalData: { world: 'new_world', month: 6, dayOfMonth: 1, day: 0 } }
		expect(sm.checkConditions({ month: 'Месяц первой искры' }, ctx)).toBe(true)
		expect(sm.checkConditions({ month: 'Month of First Spark' }, ctx)).toBe(true)
		expect(sm.checkConditions({ month: 'Месяц льда' }, ctx)).toBe(false)
	})

	it('combines dayOfWeek and month conditions (both must pass)', () => {
		// totalDays=63 => dow=1 (Mon), month=3
		const ctx = { globalData: { world: 'new_world', month: 3, dayOfMonth: 1, day: 3 } }
		expect(sm.checkConditions({ dayOfWeek: 1, month: 3 }, ctx)).toBe(true)
		expect(sm.checkConditions({ dayOfWeek: 1, month: 5 }, ctx)).toBe(false) // month mismatch
		expect(sm.checkConditions({ dayOfWeek: 3, month: 3 }, ctx)).toBe(false) // dow mismatch
	})
})
