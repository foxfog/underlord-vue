<template>
	<div class="game-area">
		<!-- Top Toolbar -->
		<Topbar
			v-if="showTopbar"
			:character="mcCharacter"
			@open-stats="toggleStatsModal"
			@open-inventory="toggleInventoryModal"
		/>

		<div class="game">
			<VisualNovel
				ref="visualNovel"
				src="/data/story/ru/start.json"
				@end="onEnd"
				@character-loaded="onCharacterLoaded"
			/>
		</div>

		<!-- Stats Modal -->
		<CharacterStatsModal
			:is-visible="showStatsModal"
			:character="mcCharacter"
			@close="toggleStatsModal"
		/>

		<!-- Inventory Modal -->
		<InventoryModal
			:is-visible="showInventoryModal"
			:character="mcCharacter"
			:items-data="itemsData"
			@close="toggleInventoryModal"
		/>

		<!-- Menu overlay that can be toggled with Esc -->
		<div v-show="menuVisible" class="menu-overlay">
			<div class="overlay-content">
				<div class="content-area">
					<DynamicContentArea
						:current-view="currentView"
						:in-game-context="true"
						@back-to-menu="showMainMenu"
						@settings-saved="onSettingsSaved"
						@settings-reset="onSettingsReset"
						@load-request="onLoadRequest"
					/>
				</div>
				<div class="menu-area __overlay">
					<MainMenu
						@navigate="handleNavigation"
						:show-back-to-main="currentView !== 'main-menu'"
						:in-game-context="true"
						:on-continue="onContinue"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Bottom hotbar -->
	<div v-if="showHotbar" class="hotbar">
		<button class="hotbar-btn" @click="openHistory">История</button>
		<button class="hotbar-btn" @click="openMainMenu">Главное меню</button>
		<button class="hotbar-btn" @click="openSave">Сохранить</button>
		<button class="hotbar-btn" @click="openLoad">Загрузить</button>
	</div>

	<!-- History modal -->
	<HistoryModal :isVisible="showHistoryModal" :entries="historyList" @close="showHistoryModal=false" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VisualNovel from '../components/game/VisualNovel.vue'
import CharacterStatsModal from '../components/game/CharacterStatsModal.vue'
import InventoryModal from '../components/game/InventoryModal.vue'
import Topbar from '../components/game/Topbar.vue'
import DynamicContentArea from '@/components/DynamicContentArea.vue'
import MainMenu from '@/components/MainMenu.vue'
import HistoryModal from '@/components/HistoryModal.vue'
import { useSavesStore } from '@/stores/saves'
import { useSettingsStore } from '@/stores/settings'

const router = useRouter()
const route = useRoute()
const settingsStore = useSettingsStore()
const visualNovel = ref(null)
const showStatsModal = ref(false)
const showInventoryModal = ref(false)
const mcCharacter = ref(null)
const itemsData = ref({})

// Menu and view state for the overlay
const menuVisible = ref(false)
const currentView = ref('main-menu')
const showHistoryModal = ref(false)
const historyList = ref([])

// UI visibility states
const uiVisibility = ref({
	all: true,
	'stats-button': true,
	topbar: true,
	hotbar: true,
	dialogue: true
})

// Computed properties for UI visibility
const showTopbar = computed(() => {
	return uiVisibility.value.all && uiVisibility.value.topbar
})

const showHotbar = computed(() => {
	return uiVisibility.value.all && uiVisibility.value.hotbar
})

// Watch for uiVisibility changes from VisualNovel
watch(() => visualNovel.value?.uiVisibility, (newVisibility) => {
	if (newVisibility) {
		uiVisibility.value = newVisibility
	}
}, { deep: true })

// Watch menu visibility changes
watch(menuVisible, (isVisible) => {
	console.log('Menu visibility changed:', isVisible)
	if (isVisible) {
		// Opening menu: pause story streams and play background music
		console.log('Opening menu - pausing streams and playing bgmusic')
		visualNovel.value?.pauseAllStreams?.()
		settingsStore.isMusicPlaying = true
	} else {
		// Closing menu: stop background music and resume story streams
		console.log('Closing menu - stopping bgmusic and resuming streams')
		settingsStore.isMusicPlaying = false
		visualNovel.value?.resumeAllStreams?.()
	}
})

// Watch for view changes
watch(() => currentView.value, (newView, oldView) => {
	console.log(`Current view changed from "${oldView}" to "${newView}"`)
})

function onEnd() {
	// Stop game music, restore background music
	settingsStore.isMusicPlaying = true
	router.push('/home')
}

function toggleStatsModal() {
	showStatsModal.value = !showStatsModal.value
}

function toggleInventoryModal() {
	showInventoryModal.value = !showInventoryModal.value
}

function onCharacterLoaded(characterData) {
	if (characterData?.mc) {
		mcCharacter.value = characterData.mc
	}
}

// Navigation and view switching for DynamicContentArea / MainMenu
const showMainMenu = () => {
	currentView.value = 'main-menu'
}

const showSettings = () => {
	currentView.value = 'settings'
}

const showSaves = () => {
	currentView.value = 'saves'
}

const handleNavigation = (view) => {
	if (view === 'settings') {
		showSettings()
	} else if (view === 'saves') {
		showSaves()
	} else if (view === 'main-menu') {
		showMainMenu()
	} else if (view === 'home-screen') {
		router.push('/home')
	}
}

function onSettingsSaved() {
	console.log('Settings saved')
}

function onSettingsReset() {
	console.log('Settings reset to default')
}

// Handler for MainMenu "Continue"
function onContinue() {
	// Close menu and resume game
	menuVisible.value = false
	settingsStore.isMusicPlaying = false
}

async function onLoadRequest(saveData) {
 	try {
 		if (!visualNovel.value) {
 			console.warn('VisualNovel ref not ready')
 			return
 		}

 		console.log('Restoring game from save request', saveData)
 		await visualNovel.value.restoreGameState(saveData.gameState)

 		// Close menus and resume
 		menuVisible.value = false
 		currentView.value = 'main-menu'
 		settingsStore.isMusicPlaying = false
 	} catch (err) {
 		console.error('Failed to restore save from saves list:', err)
 		alert(`Failed to restore save: ${err.message}`)
 	}
}

// Hotbar actions
function openHistory() {
  if (!visualNovel.value) return
  historyList.value = visualNovel.value.getHistory()
  showHistoryModal.value = true
}

function openMainMenu() {
  menuVisible.value = true
  currentView.value = 'main-menu'
}

function openSave() {
  menuVisible.value = true
  currentView.value = 'saves'
}

function openLoad() {
  menuVisible.value = true
  currentView.value = 'saves'
}

// Toggle menu visibility via Escape key
const onKeyDown = (e) => {
  if (e.key === 'Escape') {
    menuVisible.value = !menuVisible.value
  }
}

onMounted(() => {
	// Stop background music when starting the game
	settingsStore.isMusicPlaying = false
	
	window.addEventListener('keydown', onKeyDown)

	// Load items data (equipment and consumables)
	Promise.all([
		fetch('/data/characters/equipment.json').then(r => r.json()),
		fetch('/data/characters/other.json').then(r => r.json())
	]).then(([equipment, other]) => {
		// Merge both item collections by id
		itemsData.value = {}
		equipment.forEach(item => {
			itemsData.value[item.id] = item
		})
		other.forEach(item => {
			itemsData.value[item.id] = item
		})
		console.log('Items data loaded:', itemsData.value)
	}).catch(err => {
		console.error('Failed to load items data:', err)
	})

	// If this is a new game, reset the VisualNovel state
	if (route.meta.newGame && visualNovel.value) {
		console.log('Starting new game - resetting state')
		visualNovel.value.resetGameState()
	}

	// If we have a pending load (navigated from main menu), wait for VisualNovel to be ready and restore
	const savesStore = useSavesStore()
	if (savesStore.getPendingLoad()) {
		nextTick(async () => {
			try {
				// wait up to 5s for VisualNovel ref to mount
				const maxWait = 5000
				const interval = 100
				let waited = 0
				while (!visualNovel.value && waited < maxWait) {
					await new Promise((r) => setTimeout(r, interval))
					waited += interval
				}
				const pending = savesStore.getPendingLoad() ? savesStore.takePendingLoad() : null
				if (!pending) return
				if (!visualNovel.value) {
					console.warn('VisualNovel not ready to restore save after waiting')
					// put it back so user can try again (restore failed)
					savesStore.pendingLoad = pending
					return
				}
				await visualNovel.value.restoreGameState(pending.gameState)
				menuVisible.value = false
				currentView.value = 'main-menu'
			} catch (err) {
				console.error('Failed to restore pending save:', err)
				alert(`Failed to restore save: ${err.message}`)
			}
		})
	}
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown)
})
</script>