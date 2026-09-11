<template>
	<div v-if="isVisible" class="modal calendar-modal" @click="closeOnBackground">
		<div class="modal-content calendar-modal__content" @click.stop>
			<!-- Header -->
			<div class="modal-header">
				<div class="calendar-header-title">
					<span class="calendar-icon">📅</span>
					<h2 class="modal-title">
						{{ calendarInfo.calendarType === 'new_world' ? 'Календарь Нового Мира' : 'Календарь' }}
					</h2>
					<span class="world-badge" :class="calendarInfo.calendarType">
						{{ calendarInfo.yearText }}
					</span>
				</div>
				<button class="btn-close" @click="$emit('close')">×</button>
			</div>

			<div class="modal-body calendar-modal-body">
				<!-- Current status banner -->
				<div class="calendar-status-card">
					<div class="status-main-info">
						<div class="status-date-title">
							{{ calendarInfo.formattedFull }}
						</div>
						<div class="status-day-counter">
							{{ calendarInfo.dayCountText }}
						</div>
					</div>
					<div class="status-time-pill" :class="'phase-' + calendarInfo.timePeriod">
						<span class="pill-icon">{{ calendarInfo.timePeriodIcon }}</span>
						<span class="pill-text">{{ calendarInfo.timePeriodName }}</span>
						<span v-if="showExactTime && calendarInfo.hasExactTime" class="pill-clock">({{ calendarInfo.timeString }})</span>
					</div>
				</div>

				<!-- Time of day phases progression -->
				<div class="time-phases-section">
					<div class="section-label">Фазы времени суток</div>
					<div class="time-phases-bar">
						<div
							v-for="phase in timePhases"
							:key="phase.id"
							class="phase-item"
							:class="{ active: calendarInfo.timePeriod === phase.id }"
							:title="phase.desc"
						>
							<span class="phase-icon">{{ phase.icon }}</span>
							<span class="phase-name">{{ phase.name }}</span>
							<span class="phase-hours">{{ phase.hours }}</span>
						</div>
					</div>
				</div>

				<!-- Month grid view -->
				<div class="calendar-grid-section">
					<div class="grid-header-row">
						<div class="current-month-heading">
							<span class="month-name">{{ calendarInfo.monthName }}</span>
							<span class="month-season" v-if="calendarInfo.monthData?.seasonRu">
								• {{ calendarInfo.monthData.seasonRu }}
							</span>
							<span class="month-number">({{ calendarInfo.month }} / 12)</span>
						</div>
						<div class="grid-stats">
							{{ calendarInfo.dayOfMonth }} / {{ calendarInfo.daysInMonth }} дн.
						</div>
					</div>

					<!-- Weekday headers -->
					<div class="weekday-header-grid">
						<div
							v-for="wd in weekdays"
							:key="wd.id"
							class="weekday-col"
							:class="{ weekend: wd.id === 6 || wd.id === 7 }"
						>
							{{ wd.shortRu }}
						</div>
					</div>

					<!-- Day cells grid -->
					<div class="days-matrix-grid">
						<div
							v-for="(cell, idx) in monthGrid"
							:key="idx"
							class="day-cell"
							:class="{
								padding: cell.isPadding,
								current: cell.isCurrent,
								weekend: cell.isWeekend
							}"
						>
							<span v-if="!cell.isPadding" class="day-number">{{ cell.day }}</span>
							<span v-if="cell.isCurrent" class="today-marker">●</span>
						</div>
					</div>
				</div>

				<!-- New World Month List Accordion / Reference -->
				<div v-if="calendarInfo.calendarType === 'new_world'" class="new-world-months-section">
					<div class="section-label-toggle" @click="showMonthsList = !showMonthsList">
						<span>Месяцы Нового Мира (360 дней)</span>
						<span class="toggle-arrow">{{ showMonthsList ? '▲' : '▼' }}</span>
					</div>
					<div v-if="showMonthsList" class="months-overview-grid">
						<div
							v-for="m in allNewWorldMonths"
							:key="m.id"
							class="month-pill"
							:class="{ active: m.id === calendarInfo.month }"
						>
							<span class="m-num">{{ m.id }}.</span>
							<span class="m-name">{{ m.nameRu }}</span>
							<span class="m-season">{{ m.seasonRu }}</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
	getCalendarInfo,
	getMonthGrid
} from '@/utils/timeCalendar'
import {
	TIME_PERIOD_CONFIG,
	DAYS_OF_WEEK,
	NEW_WORLD_MONTHS
} from '@/constants/calendar'
import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()

const props = defineProps({
	isVisible: { type: Boolean, default: false },
	globalData: { type: Object, default: () => ({}) },
	showExactTime: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])

const showMonthsList = ref(false)

const effectiveGlobalData = computed(() => {
	return props.globalData && Object.keys(props.globalData).length > 0
		? props.globalData
		: gameStore.globalData
})

const calendarInfo = computed(() => {
	return getCalendarInfo(effectiveGlobalData.value)
})

const weekdays = DAYS_OF_WEEK
const allNewWorldMonths = NEW_WORLD_MONTHS

const timePhases = computed(() => {
	return [
		{
			id: 'morning',
			name: TIME_PERIOD_CONFIG.morning.nameRu,
			icon: TIME_PERIOD_CONFIG.morning.icon,
			hours: '05:00 - 12:00',
			desc: 'Утренние часы'
		},
		{
			id: 'day',
			name: TIME_PERIOD_CONFIG.day.nameRu,
			icon: TIME_PERIOD_CONFIG.day.icon,
			hours: '12:00 - 17:00',
			desc: 'Дневное время'
		},
		{
			id: 'evening',
			name: TIME_PERIOD_CONFIG.evening.nameRu,
			icon: TIME_PERIOD_CONFIG.evening.icon,
			hours: '17:00 - 22:00',
			desc: 'Вечерние сумерки'
		},
		{
			id: 'night',
			name: TIME_PERIOD_CONFIG.night.nameRu,
			icon: TIME_PERIOD_CONFIG.night.icon,
			hours: '22:00 - 05:00',
			desc: 'Глубокая ночь'
		}
	]
})

const monthGrid = computed(() => {
	const info = calendarInfo.value
	return getMonthGrid(
		info.calendarType,
		info.year,
		info.month,
		info.dayOfMonth,
		info.dayCount
	)
})

function closeOnBackground() {
	emit('close')
}
</script>

<style scoped>
.calendar-modal__content {
	width: min(38em, 90%);
	max-height: 88%;
}

.calendar-header-title {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.calendar-icon {
	font-size: 1.2em;
}

.world-badge {
	font-size: 0.75em;
	padding: 0.2em 0.6em;
	border-radius: 0.3em;
	background: rgba(212, 175, 55, 0.15);
	border: 1px solid var(--color-primary, #d4af37);
	color: var(--color-primary-light, #f3e5ab);
}

.calendar-modal-body {
	padding: 1.2em;
	display: flex;
	flex-direction: column;
	gap: 1.1em;
	overflow-y: auto;
}

.calendar-status-card {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: rgba(20, 20, 26, 0.7);
	border: 1px solid rgba(212, 175, 55, 0.25);
	border-radius: 0.5em;
	padding: 0.8em 1em;
	gap: 0.8em;
	box-shadow: inset 0 0 0.6em rgba(0, 0, 0, 0.4);
}

.status-date-title {
	font-size: 1.15em;
	font-weight: bold;
	color: #fff;
}

.status-day-counter {
	font-size: 0.88em;
	color: var(--color-primary-light, #f3e5ab);
	margin-top: 0.2em;
}

.status-time-pill {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.4em 0.8em;
	border-radius: 0.4em;
	font-weight: bold;
	font-size: 0.95em;
	background: rgba(30, 30, 40, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
}

.status-time-pill.phase-morning {
	border-color: #f6ad55;
	color: #fbd38d;
	background: rgba(246, 173, 85, 0.15);
}

.status-time-pill.phase-day {
	border-color: #ecc94b;
	color: #fefcbf;
	background: rgba(236, 201, 75, 0.15);
}

.status-time-pill.phase-evening {
	border-color: #ed8936;
	color: #feebc8;
	background: rgba(237, 137, 54, 0.15);
}

.status-time-pill.phase-night {
	border-color: #805ad5;
	color: #e9d8fd;
	background: rgba(128, 90, 213, 0.15);
}

.pill-clock {
	font-family: monospace;
	font-size: 0.9em;
	opacity: 0.9;
}

/* Time phases */
.time-phases-section {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.section-label {
	font-size: 0.82em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #a0a0a0;
}

.time-phases-bar {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 0.5em;
}

.phase-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0.5em 0.3em;
	background: rgba(20, 20, 24, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	transition: all 0.2s ease;
	text-align: center;
}

.phase-item.active {
	background: rgba(212, 175, 55, 0.15);
	border-color: var(--color-primary, #d4af37);
	box-shadow: 0 0 0.5em rgba(212, 175, 55, 0.3);
	transform: translateY(-0.06em);
}

.phase-icon {
	font-size: 1.3em;
}

.phase-name {
	font-size: 0.88em;
	font-weight: bold;
	color: #e0e0e0;
	margin-top: 0.2em;
}

.phase-item.active .phase-name {
	color: var(--color-primary-light, #f3e5ab);
}

.phase-hours {
	font-size: 0.72em;
	color: #777;
	margin-top: 0.1em;
}

/* Month Grid */
.calendar-grid-section {
	background: rgba(16, 16, 22, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.8em;
}

.grid-header-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 0.6em;
	padding-bottom: 0.4em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.current-month-heading {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.month-name {
	font-size: 1.1em;
	font-weight: bold;
	color: var(--color-primary-light, #f3e5ab);
}

.month-season {
	font-size: 0.85em;
	color: #999;
}

.month-number {
	font-size: 0.82em;
	color: #666;
}

.grid-stats {
	font-size: 0.85em;
	color: #888;
}

.weekday-header-grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 0.3em;
	text-align: center;
	margin-bottom: 0.4em;
}

.weekday-col {
	font-size: 0.8em;
	font-weight: bold;
	color: #888;
	padding: 0.2em;
}

.weekday-col.weekend {
	color: #e57373;
}

.days-matrix-grid {
	display: grid;
	grid-template-columns: repeat(7, 1fr);
	gap: 0.35em;
}

.day-cell {
	aspect-ratio: 1;
	min-height: 2.2em;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: rgba(30, 30, 36, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.05);
	border-radius: 0.3em;
	font-size: 0.88em;
	position: relative;
	color: #ccc;
}

.day-cell.padding {
	background: transparent;
	border-color: transparent;
}

.day-cell.weekend:not(.padding) {
	color: #e57373;
}

.day-cell.current {
	background: rgba(212, 175, 55, 0.25);
	border-color: var(--color-primary, #d4af37);
	color: #fff;
	font-weight: bold;
	box-shadow: 0 0 0.5em rgba(212, 175, 55, 0.4);
}

.today-marker {
	position: absolute;
	bottom: 0.1em;
	font-size: 0.5em;
	color: var(--color-primary, #d4af37);
}

/* Months overview list */
.new-world-months-section {
	margin-top: 0.2em;
}

.section-label-toggle {
	display: flex;
	justify-content: space-between;
	align-items: center;
	cursor: pointer;
	padding: 0.4em 0.6em;
	background: rgba(20, 20, 26, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	font-size: 0.85em;
	color: #aaa;
	user-select: none;
	transition: all 0.2s ease;
}

.section-label-toggle:hover {
	color: #fff;
	border-color: rgba(212, 175, 55, 0.3);
}

.toggle-arrow {
	font-size: 0.75em;
	color: var(--color-primary, #d4af37);
}

.months-overview-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.4em;
	margin-top: 0.5em;
	padding: 0.5em;
	background: rgba(14, 14, 18, 0.7);
	border-radius: 0.35em;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.month-pill {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.3em 0.5em;
	background: rgba(24, 24, 30, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.05);
	border-radius: 0.25em;
	font-size: 0.78em;
	color: #bbb;
}

.month-pill.active {
	background: rgba(212, 175, 55, 0.2);
	border-color: var(--color-primary, #d4af37);
	color: var(--color-primary-light, #f3e5ab);
	font-weight: bold;
}

.m-num {
	color: #777;
	font-size: 0.9em;
}

.m-season {
	margin-left: auto;
	font-size: 0.85em;
	color: #666;
}

.month-pill.active .m-season {
	color: var(--color-primary-light, #f3e5ab);
	opacity: 0.8;
}
</style>
