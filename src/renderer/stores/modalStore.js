import { defineStore } from 'pinia'
import { reactive, toRefs } from 'vue'

const MODAL_KEY_MAP = {
	inventory: 'showInventoryModal',
	stats: 'showInventoryModal',
	map: 'showMapModal',
	journal: 'showJournalModal',
	calendar: 'showCalendarModal',
	history: 'showHistoryModal'
}

export const useModalStore = defineStore('modal', () => {
	const state = reactive({
		showInventoryModal: false,
		showMapModal: false,
		showJournalModal: false,
		showCalendarModal: false,
		showHistoryModal: false
	})

	function open(modalName) {
		const key = MODAL_KEY_MAP[modalName]
		if (key) state[key] = true
	}

	function close(modalName) {
		const key = MODAL_KEY_MAP[modalName]
		if (key) state[key] = false
	}

	function toggle(modalName) {
		const key = MODAL_KEY_MAP[modalName]
		if (key) state[key] = !state[key]
	}

	function closeAll() {
		for (const key of Object.values(MODAL_KEY_MAP)) {
			state[key] = false
		}
	}

	return {
		...toRefs(state),
		openInventory: () => open('inventory'),
		closeInventory: () => close('inventory'),
		toggleInventory: () => toggle('inventory'),
		openMap: () => open('map'),
		closeMap: () => close('map'),
		toggleMap: () => toggle('map'),
		openJournal: () => open('journal'),
		closeJournal: () => close('journal'),
		toggleJournal: () => toggle('journal'),
		openCalendar: () => open('calendar'),
		closeCalendar: () => close('calendar'),
		toggleCalendar: () => toggle('calendar'),
		openHistory: () => open('history'),
		closeHistory: () => close('history'),
		toggleHistory: () => toggle('history'),
		open,
		close,
		toggle,
		closeAll
	}
})
