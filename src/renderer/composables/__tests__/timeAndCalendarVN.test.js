import { describe, it, expect, vi, beforeEach } from 'vitest'
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
			calendarType: 'new_world'
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
		expect(calInfo.dayOfMonth).toBe(2) // 2nd day of Month of Deep Snows
		expect(calInfo.monthName).toBe('Месяц глубоких снегов')
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

		// Transport to New World
		const newWorldState = {
			...earthState,
			calendarType: 'new_world',
			year: 0,
			day: 0,
			timeOfDay: 'morning'
		}

		let nwInfo = getCalendarInfo(newWorldState)
		expect(nwInfo.calendarType).toBe('new_world')
		expect(nwInfo.year).toBe(0)
		expect(nwInfo.monthName).toBe('Месяц глубоких снегов')
		expect(nwInfo.dayOfMonth).toBe(1)
		expect(nwInfo.timePeriod).toBe('morning')
	})
})
