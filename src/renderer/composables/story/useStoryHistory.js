import { ref } from 'vue'

export const HISTORY_MAX = 100

export function useStoryHistory() {
	const historyEntries = ref([])

	function addToHistory(entry) {
		try {
			historyEntries.value.push(entry)
			if (historyEntries.value.length > HISTORY_MAX) {
				historyEntries.value.splice(0, historyEntries.value.length - HISTORY_MAX)
			}
		} catch (e) {
			console.error('Failed to add to history:', e)
		}
	}

	function getHistory() {
		return historyEntries.value.slice()
	}

	function clearHistory() {
		historyEntries.value = []
	}

	function setHistory(entries) {
		if (Array.isArray(entries)) {
			historyEntries.value = entries.slice(-HISTORY_MAX)
		} else {
			historyEntries.value = []
		}
	}

	return {
		HISTORY_MAX,
		historyEntries,
		addToHistory,
		getHistory,
		clearHistory,
		setHistory
	}
}
