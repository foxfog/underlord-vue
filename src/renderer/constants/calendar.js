/**
 * Calendar and Time System Constants
 * Supports Real World (Earth / Cybercity 2138) and New World (Overlord 360-day calendar)
 */

export const TIME_PERIODS = {
	MORNING: 'morning',
	DAY: 'day',
	EVENING: 'evening',
	NIGHT: 'night'
}

export const TIME_PERIOD_CONFIG = {
	[TIME_PERIODS.MORNING]: {
		id: 'morning',
		nameRu: 'Утро',
		nameEn: 'Morning',
		icon: '🌅',
		defaultHour: 8,
		defaultMinute: 0,
		hourRange: [5, 11] // 05:00 - 11:59
	},
	[TIME_PERIODS.DAY]: {
		id: 'day',
		nameRu: 'День',
		nameEn: 'Day',
		icon: '☀️',
		defaultHour: 14,
		defaultMinute: 0,
		hourRange: [12, 16] // 12:00 - 16:59
	},
	[TIME_PERIODS.EVENING]: {
		id: 'evening',
		nameRu: 'Вечер',
		nameEn: 'Evening',
		icon: '🌇',
		defaultHour: 19,
		defaultMinute: 0,
		hourRange: [17, 21] // 17:00 - 21:59
	},
	[TIME_PERIODS.NIGHT]: {
		id: 'night',
		nameRu: 'Ночь',
		nameEn: 'Night',
		icon: '🌙',
		defaultHour: 23,
		defaultMinute: 0,
		hourRange: [22, 4] // 22:00 - 04:59
	}
}

export const TIME_PERIOD_SEQUENCE = [
	TIME_PERIODS.MORNING,
	TIME_PERIODS.DAY,
	TIME_PERIODS.EVENING,
	TIME_PERIODS.NIGHT
]

export const DAYS_OF_WEEK = [
	{ id: 1, nameRu: 'Понедельник', shortRu: 'Пн', nameEn: 'Monday', shortEn: 'Mon' },
	{ id: 2, nameRu: 'Вторник', shortRu: 'Вт', nameEn: 'Tuesday', shortEn: 'Tue' },
	{ id: 3, nameRu: 'Среда', shortRu: 'Ср', nameEn: 'Wednesday', shortEn: 'Wed' },
	{ id: 4, nameRu: 'Четверг', shortRu: 'Чт', nameEn: 'Thursday', shortEn: 'Thu' },
	{ id: 5, nameRu: 'Пятница', shortRu: 'Пт', nameEn: 'Friday', shortEn: 'Fri' },
	{ id: 6, nameRu: 'Суббота', shortRu: 'Сб', nameEn: 'Saturday', shortEn: 'Sat' },
	{ id: 7, nameRu: 'Воскресенье', shortRu: 'Вс', nameEn: 'Sunday', shortEn: 'Sun' }
]

/**
 * 12 месяцев Нового Мира (по 30 дней в каждом = 360 дней в году)
 */
export const NEW_WORLD_MONTHS = [
	{ id: 1, nameRu: 'Месяц глубоких снегов', nameEn: 'Month of Deep Snows', days: 30, seasonRu: 'Зима' },
	{ id: 2, nameRu: 'Месяц уходящих снегов', nameEn: 'Month of Departing Snows', days: 30, seasonRu: 'Весна' },
	{ id: 3, nameRu: 'Месяц теплого ветра', nameEn: 'Month of Warm Wind', days: 30, seasonRu: 'Весна' },
	{ id: 4, nameRu: 'Месяц цветущих ветров', nameEn: 'Month of Blooming Winds', days: 30, seasonRu: 'Весна' },
	{ id: 5, nameRu: 'Месяц грозового ветра', nameEn: 'Month of Thunder Wind', days: 30, seasonRu: 'Лето' },
	{ id: 6, nameRu: 'Месяц первой искры', nameEn: 'Month of First Spark', days: 30, seasonRu: 'Лето' },
	{ id: 7, nameRu: 'Месяц яростного пламени', nameEn: 'Month of Fierce Flame', days: 30, seasonRu: 'Лето' },
	{ id: 8, nameRu: 'Месяц последнего очага', nameEn: 'Month of Last Hearth', days: 30, seasonRu: 'Осень' },
	{ id: 9, nameRu: 'Месяц щедрой земли', nameEn: 'Month of Bountiful Earth', days: 30, seasonRu: 'Осень' },
	{ id: 10, nameRu: 'Месяц засыпающей земли', nameEn: 'Month of Sleeping Earth', days: 30, seasonRu: 'Осень' },
	{ id: 11, nameRu: 'Месяц скованной земли', nameEn: 'Month of Shackled Earth', days: 30, seasonRu: 'Зима' },
	{ id: 12, nameRu: 'Месяц льда', nameEn: 'Month of Ice', days: 30, seasonRu: 'Зима' }
]


export const NEW_WORLD_DAYS_PER_YEAR = 360
export const NEW_WORLD_DAYS_PER_MONTH = 30

/**
 * Григорианские месяцы (Реальный мир 2138 года)
 */
export const REAL_MONTHS = [
	{ id: 1, nameRu: 'Январь', genitiveRu: 'января', shortRu: 'янв', nameEn: 'January', days: 31 },
	{ id: 2, nameRu: 'Февраль', genitiveRu: 'февраля', shortRu: 'фев', nameEn: 'February', days: 28 },
	{ id: 3, nameRu: 'Март', genitiveRu: 'марта', shortRu: 'мар', nameEn: 'March', days: 31 },
	{ id: 4, nameRu: 'Апрель', genitiveRu: 'апреля', shortRu: 'апр', nameEn: 'April', days: 30 },
	{ id: 5, nameRu: 'Май', genitiveRu: 'мая', shortRu: 'май', nameEn: 'May', days: 31 },
	{ id: 6, nameRu: 'Июнь', genitiveRu: 'июня', shortRu: 'июн', nameEn: 'June', days: 30 },
	{ id: 7, nameRu: 'Июль', genitiveRu: 'июля', shortRu: 'июл', nameEn: 'July', days: 31 },
	{ id: 8, nameRu: 'Август', genitiveRu: 'августа', shortRu: 'авг', nameEn: 'August', days: 31 },
	{ id: 9, nameRu: 'Сентябрь', genitiveRu: 'сентября', shortRu: 'сен', nameEn: 'September', days: 30 },
	{ id: 10, nameRu: 'Октябрь', genitiveRu: 'октября', shortRu: 'окт', nameEn: 'October', days: 31 },
	{ id: 11, nameRu: 'Ноябрь', genitiveRu: 'ноября', shortRu: 'ноя', nameEn: 'November', days: 30 },
	{ id: 12, nameRu: 'Декабрь', genitiveRu: 'декабря', shortRu: 'дек', nameEn: 'December', days: 31 }
]
