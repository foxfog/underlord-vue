<template>
	<div class="time-calendar-widget">
		<!-- Time of day & Clock badge -->
		<div
			class="time-badge"
			:class="'phase-' + calendarInfo.timePeriod"
			@click="$emit('open-calendar')"
			title="Открыть календарь и время суток"
		>
			<span class="time-icon">{{ calendarInfo.timePeriodIcon }}</span>
			<span class="time-label">{{ calendarInfo.timePeriodName }}</span>
			<span v-if="calendarInfo.hasExactTime" class="time-clock">
				{{ calendarInfo.timeString }}
			</span>
		</div>

		<!-- Advance time button (hidden during active dialogues) -->
		<button
			v-if="showNextTimeButton"
			class="topbar-btn next-time-btn"
			@click.stop="$emit('advance-time')"
			title="Следующее время суток"
		>
			<span class="next-time-icon">⏭</span>
		</button>

		<!-- Day counter badge -->
		<div
			class="day-badge"
			@click="$emit('open-calendar')"
			title="Счетчик дней (нажмите для подробностей)"
		>
			<span class="day-text">{{ calendarInfo.dayCountText }}</span>
		</div>

		<!-- Date & Calendar badge -->
		<div
			class="date-badge"
			:class="calendarInfo.calendarType"
			@click="$emit('open-calendar')"
			title="Календарь (нажмите для открытия)"
		>
			<span class="date-icon">📅</span>
			<span class="date-text">{{ calendarInfo.formattedShort }}</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { getCalendarInfo } from '@/utils/timeCalendar'

const props = defineProps({
	globalData: {
		type: Object,
		default: () => ({})
	},
	showNextTimeButton: {
		type: Boolean,
		default: true
	}
})

defineEmits(['open-calendar', 'advance-time'])

const calendarInfo = computed(() => {
	return getCalendarInfo(props.globalData)
})
</script>

<style scoped>
.time-calendar-widget {
	display: flex;
	align-items: center;
	gap: 0.45em;
	user-select: none;
}

.time-badge,
.day-badge,
.date-badge {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.4em 0.75em;
	background-color: rgba(24, 24, 28, 0.75);
	border: 1px solid var(--color-border-alpha, rgba(255, 255, 255, 0.12));
	color: #e0e0e0;
	border-radius: 0.35em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	font-size: 0.92em;
	font-weight: 500;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	white-space: nowrap;
	backdrop-filter: blur(4px);
}

.time-badge:hover,
.day-badge:hover,
.date-badge:hover {
	background-color: rgba(212, 175, 55, 0.15);
	border-color: var(--color-primary, #d4af37);
	color: var(--color-primary-light, #f3e5ab);
	box-shadow: 0 0 0.6em var(--color-primary-alpha, rgba(212, 175, 55, 0.25));
	transform: translateY(-1px);
}

.time-badge:active,
.day-badge:active,
.date-badge:active {
	transform: translateY(0) scale(0.97);
}

/* Phase specifics */
.time-badge.phase-morning {
	border-color: rgba(246, 173, 85, 0.4);
	color: #fbd38d;
}

.time-badge.phase-day {
	border-color: rgba(236, 201, 75, 0.4);
	color: #fefcbf;
}

.time-badge.phase-evening {
	border-color: rgba(237, 137, 54, 0.4);
	color: #feebc8;
}

.time-badge.phase-night {
	border-color: rgba(128, 90, 213, 0.4);
	color: #e9d8fd;
}

.time-clock {
	font-family: monospace;
	font-size: 0.9em;
	opacity: 0.85;
	margin-left: 0.15em;
}

.day-badge {
	color: var(--color-primary-light, #f3e5ab);
	font-weight: 600;
}

.next-time-btn {
	padding: 0.4em 0.55em;
	background-color: rgba(24, 24, 28, 0.75);
	border: 1px solid var(--color-border-alpha, rgba(255, 255, 255, 0.12));
	color: #e0e0e0;
	border-radius: 0.35em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	font-size: 0.92em;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.next-time-btn:hover {
	background-color: rgba(212, 175, 55, 0.2);
	border-color: var(--color-primary, #d4af37);
	color: var(--color-primary-light, #f3e5ab);
	box-shadow: 0 0 0.6em var(--color-primary-alpha, rgba(212, 175, 55, 0.25));
	transform: translateY(-1px);
}

.next-time-btn:active {
	transform: translateY(0) scale(0.95);
}

.next-time-icon {
	font-size: 0.95em;
	line-height: 1;
}

.date-badge.new_world {
	border-color: rgba(212, 175, 55, 0.35);
}

.date-icon {
	font-size: 0.95em;
}
</style>
