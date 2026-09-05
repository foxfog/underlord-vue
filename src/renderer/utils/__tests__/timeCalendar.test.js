import { describe, it, expect } from 'vitest'
import {
	normalizeTimeOfDay,
	getTimeOfDayFromHour,
	parseTime,
	advanceTimeOfDay,
	advanceTimeMinutes,
	getCalendarInfo,
	getMonthGrid
} from '../timeCalendar'
import { TIME_PERIODS } from '../../constants/calendar'

describe('Time and Calendar Utils', () => {
	describe('normalizeTimeOfDay', () => {
		it('normalizes english and russian time of day keys', () => {
			expect(normalizeTimeOfDay('morning')).toBe(TIME_PERIODS.MORNING)
			expect(normalizeTimeOfDay('Утро')).toBe(TIME_PERIODS.MORNING)
			expect(normalizeTimeOfDay('day')).toBe(TIME_PERIODS.DAY)
			expect(normalizeTimeOfDay('День')).toBe(TIME_PERIODS.DAY)
			expect(normalizeTimeOfDay('evening')).toBe(TIME_PERIODS.EVENING)
			expect(normalizeTimeOfDay('Вечер')).toBe(TIME_PERIODS.EVENING)
			expect(normalizeTimeOfDay('night')).toBe(TIME_PERIODS.NIGHT)
			expect(normalizeTimeOfDay('Ночь')).toBe(TIME_PERIODS.NIGHT)
			expect(normalizeTimeOfDay('unknown')).toBeNull()
		})
	})

	describe('getTimeOfDayFromHour', () => {
		it('correctly maps 24h hours to periods', () => {
			expect(getTimeOfDayFromHour(5)).toBe(TIME_PERIODS.MORNING)
			expect(getTimeOfDayFromHour(8)).toBe(TIME_PERIODS.MORNING)
			expect(getTimeOfDayFromHour(11)).toBe(TIME_PERIODS.MORNING)

			expect(getTimeOfDayFromHour(12)).toBe(TIME_PERIODS.DAY)
			expect(getTimeOfDayFromHour(14)).toBe(TIME_PERIODS.DAY)
			expect(getTimeOfDayFromHour(16)).toBe(TIME_PERIODS.DAY)

			expect(getTimeOfDayFromHour(17)).toBe(TIME_PERIODS.EVENING)
			expect(getTimeOfDayFromHour(20)).toBe(TIME_PERIODS.EVENING)
			expect(getTimeOfDayFromHour(21)).toBe(TIME_PERIODS.EVENING)

			expect(getTimeOfDayFromHour(22)).toBe(TIME_PERIODS.NIGHT)
			expect(getTimeOfDayFromHour(0)).toBe(TIME_PERIODS.NIGHT)
			expect(getTimeOfDayFromHour(4)).toBe(TIME_PERIODS.NIGHT)
		})
	})

	describe('parseTime', () => {
		it('parses formatted string', () => {
			const res = parseTime('20:52')
			expect(res.isValid).toBe(true)
			expect(res.hour).toBe(20)
			expect(res.minute).toBe(52)
			expect(res.formatted).toBe('20:52')
		})

		it('parses object format', () => {
			const res = parseTime({ hour: 8, minute: 5 })
			expect(res.isValid).toBe(true)
			expect(res.hour).toBe(8)
			expect(res.minute).toBe(5)
			expect(res.formatted).toBe('08:05')
		})
	})

	describe('advanceTimeOfDay', () => {
		it('advances morning -> day -> evening -> night without day increment', () => {
			const step1 = advanceTimeOfDay('morning')
			expect(step1.nextPeriod).toBe('day')
			expect(step1.dayIncremented).toBe(false)

			const step2 = advanceTimeOfDay('day')
			expect(step2.nextPeriod).toBe('evening')
			expect(step2.dayIncremented).toBe(false)

			const step3 = advanceTimeOfDay('evening')
			expect(step3.nextPeriod).toBe('night')
			expect(step3.dayIncremented).toBe(false)
		})

		it('advances night -> morning with day increment = true', () => {
			const step4 = advanceTimeOfDay('night')
			expect(step4.nextPeriod).toBe('morning')
			expect(step4.dayIncremented).toBe(true)
		})
	})

	describe('advanceTimeMinutes', () => {
		it('advances minutes within same day', () => {
			const res = advanceTimeMinutes(20, 52, 60)
			expect(res.hour).toBe(21)
			expect(res.minute).toBe(52)
			expect(res.daysElapsed).toBe(0)
			expect(res.period).toBe('evening')
		})

		it('advances across midnight and counts days', () => {
			const res = advanceTimeMinutes(23, 30, 60)
			expect(res.hour).toBe(0)
			expect(res.minute).toBe(30)
			expect(res.daysElapsed).toBe(1)
			expect(res.period).toBe('night')
		})
	})

	describe('getCalendarInfo - Real World (Intro 2138)', () => {
		it('returns default 2138 Real world date with day 0 and evening', () => {
			const info = getCalendarInfo({
				time: '20:52',
				timeOfDay: 'evening'
			})

			expect(info.calendarType).toBe('real')
			expect(info.year).toBe(2138)
			expect(info.month).toBe(12)
			expect(info.monthName).toBe('Декабрь')
			expect(info.dayOfMonth).toBe(18)
			expect(info.dayCount).toBe(0)
			expect(info.timePeriod).toBe('evening')
			expect(info.timePeriodName).toBe('Вечер')
			expect(info.timeString).toBe('20:52')
		})

		it('advances date when day increases in real world', () => {
			const info = getCalendarInfo({
				day: 2,
				calendarType: 'real',
				year: 2138,
				month: 12,
				dayOfMonth: 18
			})

			expect(info.dayCount).toBe(2)
			expect(info.dayOfMonth).toBe(20)
			expect(info.month).toBe(12)
		})
	})

	describe('getCalendarInfo - New World (Overlord)', () => {
		it('computes 0-indexed day count starting at Day 1, Month 3 (Месяц теплого ветра, Весна) by default', () => {
			const info = getCalendarInfo({
				calendarType: 'new_world',
				day: 0
			})

			expect(info.calendarType).toBe('new_world')
			expect(info.year).toBe(0)
			expect(info.month).toBe(3)
			expect(info.monthName).toBe('Месяц теплого ветра')
			expect(info.seasonRu).toBe('Весна')
			expect(info.dayOfMonth).toBe(1)
			expect(info.daysInMonth).toBe(30)
			expect(info.formattedShort).toContain('Месяц теплого ветра')
		})

		it('supports explicit start month and day in New World', () => {
			const info = getCalendarInfo({
				calendarType: 'new_world',
				month: 1,
				dayOfMonth: 1,
				day: 0
			})

			expect(info.month).toBe(1)
			expect(info.monthName).toBe('Месяц глубоких снегов')
			expect(info.seasonRu).toBe('Зима')
			expect(info.dayOfMonth).toBe(1)
		})

		it('has correct season triads according to elemental seasons', () => {
			// Зима: 12, 1, 2
			expect(getCalendarInfo({ calendarType: 'new_world', month: 12, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Зима')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 1, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Зима')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 2, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Зима')

			// Весна: 3, 4, 5
			expect(getCalendarInfo({ calendarType: 'new_world', month: 3, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Весна')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 4, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Весна')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 5, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Весна')

			// Лето: 6, 7, 8 (Month 8 - Месяц последнего очага is summer)
			expect(getCalendarInfo({ calendarType: 'new_world', month: 6, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Лето')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 7, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Лето')
			const month8 = getCalendarInfo({ calendarType: 'new_world', month: 8, dayOfMonth: 1, day: 0 })
			expect(month8.monthName).toBe('Месяц последнего очага')
			expect(month8.seasonRu).toBe('Лето')

			// Осень: 9, 10, 11
			expect(getCalendarInfo({ calendarType: 'new_world', month: 9, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Осень')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 10, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Осень')
			expect(getCalendarInfo({ calendarType: 'new_world', month: 11, dayOfMonth: 1, day: 0 }).seasonRu).toBe('Осень')
		})

		it('advances months every 30 days in New World', () => {
			// Month 3 day 1 + 30 days = Month 4 day 1
			const infoMonth4 = getCalendarInfo({
				calendarType: 'new_world',
				month: 3,
				dayOfMonth: 1,
				day: 30
			})
			expect(infoMonth4.month).toBe(4)
			expect(infoMonth4.monthName).toBe('Месяц цветущих ветров')
			expect(infoMonth4.dayOfMonth).toBe(1)

			// Month 1 day 1 + 359 days = Month 12 day 30 (last day of year 0)
			const infoEndOfYear0 = getCalendarInfo({
				calendarType: 'new_world',
				month: 1,
				dayOfMonth: 1,
				day: 359
			})
			expect(infoEndOfYear0.year).toBe(0)
			expect(infoEndOfYear0.month).toBe(12)
			expect(infoEndOfYear0.monthName).toBe('Месяц льда')
			expect(infoEndOfYear0.dayOfMonth).toBe(30)

			// Month 1 day 1 + 360 days = year 1, month 1, day 1
			const infoYear1 = getCalendarInfo({
				calendarType: 'new_world',
				month: 1,
				dayOfMonth: 1,
				day: 360
			})
			expect(infoYear1.year).toBe(1)
			expect(infoYear1.month).toBe(1)
			expect(infoYear1.monthName).toBe('Месяц глубоких снегов')
			expect(infoYear1.dayOfMonth).toBe(1)
		})
	})

	describe('getMonthGrid', () => {
		it('generates 30 days grid for New World', () => {
			const grid = getMonthGrid('new_world', 0, 1, 1, 0)
			const actualDays = grid.filter((cell) => !cell.isPadding)
			expect(actualDays.length).toBe(30)
			expect(actualDays[0].isCurrent).toBe(true)
		})
	})
})
