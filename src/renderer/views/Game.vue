<template>
	<div class="game-area">
		<!-- Stats Button -->
		<button class="stats-button" @click="toggleStatsModal">
			📊 Статы
		</button>

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
				
					<!-- Visual-only Save/Load modal (Ren'Py-like placeholders) -->
					<SaveLoadModal ref="saveLoadRef"
						:isVisible="showSaveLoadModal"
						:visualNovel="visualNovel"
						@close="closeSaveLoad"
						@save-complete="onSaveComplete"
						@load-complete="onLoadComplete"
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
	<div class="hotbar">
		<button class="hotbar-btn" @click="openHistory">История</button>
		<button class="hotbar-btn" @click="openMainMenu">Главное меню</button>
		<button class="hotbar-btn" @click="openSave">Сохранить</button>
		<button class="hotbar-btn" @click="openLoad">Загрузить</button>
	</div>

	<!-- History modal -->
	<HistoryModal :isVisible="showHistoryModal" :entries="historyList" @close="showHistoryModal=false" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import VisualNovel from '../components/game/VisualNovel.vue'
import CharacterStatsModal from '../components/game/CharacterStatsModal.vue'
import DynamicContentArea from '@/components/DynamicContentArea.vue'
import MainMenu from '@/components/MainMenu.vue'
import SaveLoadModal from '@/components/SaveLoadModal.vue'
import HistoryModal from '@/components/HistoryModal.vue'
import { useSavesStore } from '@/stores/saves'

const router = useRouter()
const route = useRoute()
const visualNovel = ref(null)
const showStatsModal = ref(false)
const mcCharacter = ref(null)

// Menu and view state for the overlay
const menuVisible = ref(false)
const currentView = ref('main-menu')
const showSaveLoadModal = ref(false)
const saveLoadInitialMode = ref('save')
const saveLoadRef = ref(null)
const showHistoryModal = ref(false)
const historyList = ref([])

function onEnd() {
	router.push('/home')
}

function toggleStatsModal() {
	showStatsModal.value = !showStatsModal.value
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
	} else if (view === 'save-load') {
		showSaveLoadModal.value = true
	} else if (view === 'home-screen') {
		router.push('/home')
	}
}

const closeSaveLoad = () => {
	showSaveLoadModal.value = false
	currentView.value = 'main-menu'
}

function onSaveComplete(data) {
	console.log('Game saved:', data)
	// Optionally close the modal after saving
	showSaveLoadModal.value = false
	currentView.value = 'main-menu'
}

function onLoadComplete(data) {
	console.log('Game loaded:', data)
	// Close menu and resume the game
	showSaveLoadModal.value = false
	menuVisible.value = false
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
  showSaveLoadModal.value = true
  nextTick(() => {
    if (saveLoadRef.value && typeof saveLoadRef.value.setMode === 'function') saveLoadRef.value.setMode('save')
  })
}

function openLoad() {
  showSaveLoadModal.value = true
  nextTick(() => {
    if (saveLoadRef.value && typeof saveLoadRef.value.setMode === 'function') saveLoadRef.value.setMode('load')
  })
}

// Toggle menu visibility via Escape key
const onKeyDown = (e) => {
  if (e.key === 'Escape') {
    menuVisible.value = !menuVisible.value
  }
}

onMounted(() => {
	window.addEventListener('keydown', onKeyDown)

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

<style scoped>
.game-area {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: #1a1a1a;
	color: #fff;
	position: relative;
}

.hotbar {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 12px;
  display: flex;
  gap: 10px;
  justify-content: center;
  z-index: 1500;
}
.hotbar-btn {
  background: rgba(255,255,255,0.04);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.hotbar-btn:hover { background: rgba(255,255,255,0.06) }

.stats-button {
	position: absolute;
	top: 20px;
	left: 20px;
	z-index: 100;
	background-color: #2c2c2c;
	color: white;
	border: 2px solid #444;
	border-radius: 8px;
	padding: 10px 15px;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.2s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.stats-button:hover {
	background-color: #3a3a3a;
	border-color: #007bff;
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.game {
	flex: 1;
	position: relative;
	overflow: hidden;
}

.menu-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 250;
	display: flex;
	align-items: stretch;
	background: rgba(0, 0, 0, 0.4);
}

.overlay-content {
	display: flex;
	width: 100%;
}

.overlay-content .content-area {
	flex: 1;
	padding: 24px;
}

.menu-area.__overlay {
	width: 320px;
	background: #111;
	border-left: 1px solid #222;
	padding: 16px;
	box-shadow: -4px 0 12px rgba(0,0,0,0.6);
}

.game-background {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-size: cover;
	background-position: center;
	transition: background 0.5s ease;
}

</style>
