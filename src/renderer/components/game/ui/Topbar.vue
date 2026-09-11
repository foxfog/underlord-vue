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
				:global-data="effectiveGlobalData"
				:show-next-time-button="showNextTimeButton"
				:show-date-badge="showDateBadge"
				:show-exact-time="showExactTime"
				@open-calendar="openCalendar"
				@advance-time="advanceTime"
			/>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import TimeCalendarWidget from './TimeCalendarWidget.vue'
import { useGameStore } from '@/stores/gameStore'
import { useModalStore } from '@/stores/modalStore'

const gameStore = useGameStore()
const modalStore = useModalStore()

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
	showDateBadge: {
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

const effectiveGlobalData = computed(() => {
	return props.globalData && Object.keys(props.globalData).length > 0
		? props.globalData
		: gameStore.globalData
})

const emit = defineEmits([
	'open-inventory',
	'open-map',
	'open-journal',
	'open-calendar',
	'advance-time'
])

function openInventory() {
	modalStore.toggleInventory()
	emit('open-inventory')
}

function openMap() {
	modalStore.toggleMap()
	emit('open-map')
}

function openJournal() {
	modalStore.toggleJournal()
	emit('open-journal')
}

function openCalendar() {
	modalStore.toggleCalendar()
	emit('open-calendar')
}

function advanceTime() {
	emit('advance-time')
}
</script>
