import { computed } from 'vue'
import { useSavesStore } from '@/stores/saves'

export function useSaves() {
	const store = useSavesStore()

	const saves = computed(() => store.allSaves)
	const profiles = computed(() => store.profiles)
	const currentProfile = computed(() => store.currentProfile)
	const hasSave = (slot) => store.hasSave(slot)
	const getSave = (slot) => store.getSave(slot)

	return {
		saves,
		profiles,
		currentProfile,
		hasSave,
		getSave,
		listProfiles: store.listProfiles,
		createProfile: store.createProfile,
		deleteProfile: store.deleteProfile,
		selectProfile: store.selectProfile,
		listSaves: store.listSaves,
		saveGame: store.saveGame,
		saveAuto: store.saveAuto,
		saveQuick: store.saveQuick,
		loadGame: store.loadGame,
		deleteSave: store.deleteSave,
		setCharacterDefaults: store.setCharacterDefaults,
		pendingLoad: store.pendingLoad,
		getPendingLoad: store.getPendingLoad,
		takePendingLoad: store.takePendingLoad
	}
}
