/**
 * Time and Calendar calculation utilities
 * Supports Real World (Earth / Cybercity 2138) and New World (Overlord 360-day custom calendar)
 */

import {
	TIME_PERIODS,
	TIME_PERIOD_CONFIG,
	TIME_PERIOD_SEQUENCE,
	DAYS_OF_WEEK,
	NEW_WORLD_MONTHS,
	NEW_WORLD_DAYS_PER_YEAR,
	NEW_WORLD_DAYS_PER_MONTH,
	REAL_MONTHS
} from '../constants/calendar'

/**
 * Normalizes time of day string (Russian or English) to standard key
 * @param {string} val
 * @returns {'morning'|'day'|'evening'|'night'|null}
 */
export function normalizeTimeOfDay(val) {
	if (!val || typeof val !== 'string') return null
	const lower = val.trim().toLowerCase()

	if (lower === 'morning' || lower === 'утро') return TIME_PERIODS.MORNING
	if (lower === 'day' || lower === 'день') return TIME_PERIODS.DAY
	if (lower === 'evening' || lower === 'вечер') return TIME_PERIODS.EVENING
	if (lower === 'night' || lower === 'ночь') return TIME_PERIODS.NIGHT

	return null
}

/**
 * Get time period from an hour (0-23)
 * @param {number} hour
 * @returns {'morning'|'day'|'evening'|'night'}
 */
export function getTimeOfDayFromHour(hour) {
	const h = ((Math.floor(hour) % 24) + 24) % 24
	if (h >= 5 && h <= 11) return TIME_PERIODS.MORNING
	if (h >= 12 && h <= 16) return TIME_PERIODS.DAY
	if (h >= 17 && h <= 21) return TIME_PERIODS.EVENING
	return TIME_PERIODS.NIGHT
}

/**
 * Parse time string ("20:52", "8:00") or object ({ hour: 20, minute: 52 })
 * @param {string|object|number} timeVal
 * @returns {{ hour: number, minute: number, formatted: string, isValid: boolean }}
 */
export function parseTime(timeVal) {
	if (typeof timeVal === 'string') {
		const match = timeVal.trim().match(/^(\d{1,2})[:.](\d{1,2})$/)
		if (match) {
			const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)))
			const minute = Math.min(59, Math.max(0, parseInt(match[2], 10)))
			return {
				hour,
				minute,
				formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
				isValid: true
			}
		}
	} else if (timeVal && typeof timeVal === 'object') {
		const hour = Math.min(23, Math.max(0, parseInt(timeVal.hour || 0, 10)))
		const minute = Math.min(59, Math.max(0, parseInt(timeVal.minute || 0, 10)))
		return {
			hour,
			minute,
			formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
			isValid: true
		}
	} else if (typeof timeVal === 'number' && !isNaN(timeVal)) {
		const totalMin = ((Math.floor(timeVal) % 1440) + 1440) % 1440
		const hour = Math.floor(totalMin / 60)
		const minute = totalMin % 60
		return {
			hour,
			minute,
			formatted: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
			isValid: true
		}
	}

	return {
		hour: 0,
		minute: 0,
		formatted: '00:00',
		isValid: false
	}
}

/**
 * Cycle to the next time of day.
 * morning -> day -> evening -> night -> morning (increments day when night -> morning)
 * @param {string} currentPeriod
 * @returns {{ nextPeriod: string, dayIncremented: boolean, nextHour: number, nextMinute: number, nextFormatted: string }}
 */
export function advanceTimeOfDay(currentPeriod) {
	const normalized = normalizeTimeOfDay(currentPeriod) || TIME_PERIODS.DAY
	const currentIndex = TIME_PERIOD_SEQUENCE.indexOf(normalized)
	const nextIndex = (currentIndex + 1) % TIME_PERIOD_SEQUENCE.length
	const nextPeriod = TIME_PERIOD_SEQUENCE[nextIndex]
	const dayIncremented = currentIndex === TIME_PERIOD_SEQUENCE.length - 1 // Night -> Morning

	const config = TIME_PERIOD_CONFIG[nextPeriod]
	const nextHour = config.defaultHour
	const nextMinute = config.defaultMinute
	const nextFormatted = `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`

	return {
		nextPeriod,
		dayIncremented,
		nextHour,
		nextMinute,
		nextFormatted
	}
}

/**
 * Advance time by delta minutes (for full 24h clock support)
 * @param {number} currentHour
 * @param {number} currentMinute
 * @param {number} deltaMinutes
 * @returns {{ hour: number, minute: number, formatted: string, daysElapsed: number, period: string }}
 */
export function advanceTimeMinutes(currentHour, currentMinute, deltaMinutes = 60) {
	const currentTotalMin = currentHour * 60 + currentMinute
	const newTotalMin = currentTotalMin + deltaMinutes

	const daysElapsed = Math.floor(newTotalMin / 1440)
	const remainingMin = ((newTotalMin % 1440) + 1440) % 1440

	const hour = Math.floor(remainingMin / 60)
	const minute = remainingMin % 60
	const formatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
	const period = getTimeOfDayFromHour(hour)

	return {
		hour,
		minute,
		formatted,
		daysElapsed,
		period
	}
}

/**
 * Check if a year is a leap year in Gregorian calendar
 * @param {number} year
 * @returns {boolean}
 */
export function isLeapYear(year) {
	return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/**
 * Get days in month for Real world calendar
 * @param {number} year
 * @param {number} month 1-12
 * @returns {number}
 */
export function getDaysInRealMonth(year, month) {
	if (month === 2) {
		return isLeapYear(year) ? 29 : 28
	}
	const m = REAL_MONTHS[month - 1]
	return m ? m.days : 30
}

/**
 * Get weekday index (1 = Mon, 7 = Sun) for a Real Gregorian date
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} day 1-31
 * @returns {number} 1 to 7
 */
export function getRealDayOfWeek(year, month, day) {
	const jsDate = new Date(year, month - 1, day)
	const jsDay = jsDate.getDay() // 0 = Sun, 1 = Mon ... 6 = Sat
	return jsDay === 0 ? 7 : jsDay
}

/**
 * Calculate full calendar and time state from global game data
 * @param {object} globalData
 * @returns {object} Full calendar status
 */
export function getCalendarInfo(globalData = {}) {
	const calendarType =
		globalData.calendarType === 'new_world' || globalData.world === 'new_world'
			? 'new_world'
			: 'real'

	const dayCount =
		typeof globalData.day === 'number'
			? globalData.day
			: typeof globalData.dayCount === 'number'
				? globalData.dayCount
				: 0

	// Time resolution
	const timeParsed = parseTime(globalData.time)
	let periodId = normalizeTimeOfDay(globalData.timeOfDay)

	if (!periodId) {
		if (timeParsed.isValid) {
			periodId = getTimeOfDayFromHour(timeParsed.hour)
		} else {
			// Intro default is Evening (20:52)
			periodId = TIME_PERIODS.EVENING
		}
	}

	const periodConfig = TIME_PERIOD_CONFIG[periodId] || TIME_PERIOD_CONFIG[TIME_PERIODS.EVENING]

	const timeDisplay = timeParsed.isValid
		? timeParsed.formatted
		: `${String(periodConfig.defaultHour).padStart(2, '0')}:${String(periodConfig.defaultMinute).padStart(2, '0')}`

	if (calendarType === 'new_world') {
		const baseYear = typeof globalData.year === 'number' ? globalData.year : 0
		const baseMonth =
			typeof globalData.month === 'number'
				? globalData.month
				: typeof globalData.nwMonth === 'number'
					? globalData.nwMonth
					: 3
		const baseDayOfMonth =
			typeof globalData.dayOfMonth === 'number'
				? globalData.dayOfMonth
				: typeof globalData.nwDayOfMonth === 'number'
					? globalData.nwDayOfMonth
					: 1

		const startMonth = Math.min(12, Math.max(1, Math.floor(baseMonth)))
		const startDay = Math.min(
			NEW_WORLD_DAYS_PER_MONTH,
			Math.max(1, Math.floor(baseDayOfMonth))
		)
		const startDayInYear = (startMonth - 1) * NEW_WORLD_DAYS_PER_MONTH + (startDay - 1)

		// Calculate total days including base month/day and elapsed dayCount
		const totalDays = startDayInYear + dayCount
		const year = baseYear + Math.floor(totalDays / NEW_WORLD_DAYS_PER_YEAR)
		const dayInYear =
			((totalDays % NEW_WORLD_DAYS_PER_YEAR) + NEW_WORLD_DAYS_PER_YEAR) %
			NEW_WORLD_DAYS_PER_YEAR
		const month = Math.floor(dayInYear / NEW_WORLD_DAYS_PER_MONTH) + 1
		const dayOfMonth = (dayInYear % NEW_WORLD_DAYS_PER_MONTH) + 1
		const dayOfWeek = ((totalDays % 7) + 7) % 7 + 1

		const monthData = NEW_WORLD_MONTHS[month - 1] || NEW_WORLD_MONTHS[0]
		const weekdayData = DAYS_OF_WEEK[dayOfWeek - 1] || DAYS_OF_WEEK[0]

		return {
			calendarType: 'new_world',
			calendarName: 'Новый Мир',
			dayCount,
			dayCountText: `День ${dayCount}`,
			year,
			yearText: `${year} г.`,
			month,
			monthName: monthData.nameRu,
			monthData,
			seasonRu: monthData.seasonRu,
			dayOfMonth,
			dayOfWeek,
			weekdayName: weekdayData.nameRu,
			weekdayShort: weekdayData.shortRu,
			weekdayData,
			timePeriod: periodId,
			timePeriodName: periodConfig.nameRu,
			timePeriodIcon: periodConfig.icon,
			timePeriodConfig: periodConfig,
			timeString: timeDisplay,
			hasExactTime: timeParsed.isValid,
			formattedShort: `${dayOfMonth} ${monthData.nameRu} [${year} г.]`,
			formattedDate: `${dayOfMonth} ${monthData.nameRu}`,
			formattedFull: `${dayOfMonth}-й день · ${monthData.nameRu}, ${year} г. (${weekdayData.shortRu})`,
			daysInMonth: NEW_WORLD_DAYS_PER_MONTH
		}
	} else {
		// Real World (Earth 2138)
		const baseYear = typeof globalData.year === 'number' ? globalData.year : 2138
		const baseMonth = typeof globalData.month === 'number' ? globalData.month : 12
		const baseDayOfMonth = typeof globalData.dayOfMonth === 'number' ? globalData.dayOfMonth : 18

		// Apply dayCount offset to base date
		const date = new Date(baseYear, baseMonth - 1, baseDayOfMonth + dayCount)
		const year = date.getFullYear()
		const month = date.getMonth() + 1
		const dayOfMonth = date.getDate()
		const dayOfWeek = getRealDayOfWeek(year, month, dayOfMonth)

		const monthData = REAL_MONTHS[month - 1] || REAL_MONTHS[11]
		const weekdayData = DAYS_OF_WEEK[dayOfWeek - 1] || DAYS_OF_WEEK[0]

		return {
			calendarType: 'real',
			calendarName: 'Календарь',
			dayCount,
			dayCountText: `День ${dayCount}`,
			year,
			yearText: `[${year}]`,
			month,
			monthName: monthData.nameRu,
			monthData,
			dayOfMonth,
			dayOfWeek,
			weekdayName: weekdayData.nameRu,
			weekdayShort: weekdayData.shortRu,
			weekdayData,
			timePeriod: periodId,
			timePeriodName: periodConfig.nameRu,
			timePeriodIcon: periodConfig.icon,
			timePeriodConfig: periodConfig,
			timeString: timeDisplay,
			hasExactTime: timeParsed.isValid,
			formattedShort: `[${year}] ${dayOfMonth} ${monthData.shortRu}`,
			formattedDate: `${dayOfMonth} ${monthData.genitiveRu || monthData.nameRu}`,
			formattedFull: `${dayOfMonth} ${monthData.genitiveRu || monthData.nameRu} ${year} г. (${weekdayData.shortRu})`,
			daysInMonth: getDaysInRealMonth(year, month)
		}
	}
}

/**
 * Generate monthly grid of days for calendar modal view
 * @param {string} calendarType 'new_world' | 'real'
 * @param {number} year
 * @param {number} month 1-12
 * @param {number} currentDay
 * @param {number} dayCount
 * @returns {Array<{ day: number, isCurrent: boolean, dayOfWeek: number, isWeekend: boolean }>}
 */
export function getMonthGrid(calendarType, year, month, currentDay, dayCount = 0) {
	const daysInMonth =
		calendarType === 'new_world' ? NEW_WORLD_DAYS_PER_MONTH : getDaysInRealMonth(year, month)

	const days = []

	// Determine starting weekday of the month
	let firstDayOfWeek = 1
	if (calendarType === 'new_world') {
		const totalDaysToMonthStart = year * NEW_WORLD_DAYS_PER_YEAR + (month - 1) * NEW_WORLD_DAYS_PER_MONTH
		firstDayOfWeek = ((totalDaysToMonthStart % 7) + 7) % 7 + 1
	} else {
		firstDayOfWeek = getRealDayOfWeek(year, month, 1)
	}

	// Add empty padding slots for preceding days of week (if month doesn't start on Monday)
	for (let p = 1; p < firstDayOfWeek; p++) {
		days.push({
			day: null,
			isPadding: true,
			dayOfWeek: p,
			isWeekend: p === 6 || p === 7
		})
	}

	// Add month days
	for (let d = 1; d <= daysInMonth; d++) {
		const currentWeekday = ((firstDayOfWeek - 1 + (d - 1)) % 7) + 1
		days.push({
			day: d,
			isPadding: false,
			isCurrent: d === currentDay,
			dayOfWeek: currentWeekday,
			isWeekend: currentWeekday === 6 || currentWeekday === 7
		})
	}

	return days
}
