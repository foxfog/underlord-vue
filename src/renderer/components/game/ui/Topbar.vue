<template>
	<div class="topbar">
		<div class="topbar-left">
			<button
				v-if="showInventoryButton"
				class="topbar-btn"
				@click="openInventory"
				title="Открыть инвентарь"
			>
				🎒 Инвентарь
			</button>
			<button
				v-if="showJournalButton"
				class="topbar-btn"
				@click="openJournal"
				title="Открыть журнал"
			>
				📔 Журнал
			</button>
			<button
				v-if="showMapButton"
				class="topbar-btn"
				@click="openMap"
				title="Открыть карту мира"
			>
				🗺 Карта
			</button>
		</div>

		<div class="topbar-right">
			<TimeCalendarWidget
				:global-data="globalData"
				:show-next-time-button="showNextTimeButton"
				:show-exact-time="showExactTime"
				@open-calendar="openCalendar"
				@advance-time="advanceTime"
			/>
		</div>
	</div>
</template>

<script setup>
import TimeCalendarWidget from './TimeCalendarWidget.vue'

const props = defineProps({
	character: {
		type: Object,
		default: null
	},
	showInventoryButton: {
		type: Boolean,
		default: false
	},
	showJournalButton: {
		type: Boolean,
		default: false
	},
	showMapButton: {
		type: Boolean,
		default: false
	},
	showNextTimeButton: {
		type: Boolean,
		default: true
	},
	showExactTime: {
		type: Boolean,
		default: false
	},
	globalData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits([
	'open-inventory',
	'open-map',
	'open-journal',
	'open-calendar',
	'advance-time'
])

function openInventory() {
	emit('open-inventory')
}

function openMap() {
	emit('open-map')
}

function openJournal() {
	emit('open-journal')
}

function openCalendar() {
	emit('open-calendar')
}

function advanceTime() {
	emit('advance-time')
}
</script>
