<template>
	<div class="game-area">
		<!-- Top Toolbar -->
		<Topbar
			v-if="showTopbar && !isUiHidden"
			:show-inventory-button="showInventoryButton"
			:show-journal-button="showJournalButton"
			:show-map-button="showMapButton"
			:show-next-time-button="showNextTimeButton"
			:show-date-badge="showDateBadge"
			@advance-time="handleAdvanceTime"
		/>

		<!-- Sidebars (Active during main visual novel story phase) -->
		<SidebarLeft
			v-if="canShowSidebars"
			:has-dialogue="hasDialogue"
		/>
		<SidebarRight
			v-if="canShowSidebars"
			:is-helmet-equipped="isHelmetEquipped"
			:has-dialogue="hasDialogue"
			@open-vr="openVrFromSidebar"
		/>

		<!-- Visual Novel Story Scene (Phase: STORY_VN) -->
		<div class="game">
			<VisualNovel
				ref="visualNovelRef"
				:src="novelsrc"
				@end="onEnd"
				@global-data-changed="onGlobalDataChanged"
				@ui-visibility-changed="onUiVisibilityChanged"
				@ready="onVisualNovelReady"
				@character-click="onCharacterClick"
			/>
		</div>

		<!-- Isometric Location Overlay (Phase: ISOMETRIC_EXPLORATION) -->
		<IsometricGameOverlay
			v-if="isIsometricPhase"
			ref="isometricOverlayRef"
			:location-id="activeIsometricLocationId"
			@exit="onIsometricExit"
			@quest-completed="onIsometricQuestCompleted"
			@combat-requested="onIsometricCombatRequested"
		/>

		<!-- Fast-forward / Skip indicator (Ren'Py Ctrl skip style) -->
		<div
			v-if="isFastForwarding && !isUiHidden"
			class="vn-skip-indicator"
			aria-label="Режим быстрой перемотки"
		>
			<span class="vn-skip-indicator-icon">⏩</span>
			<span class="vn-skip-indicator-text">Перемотка</span>
			<span class="vn-skip-indicator-dots">
				<span>.</span><span>.</span><span>.</span>
			</span>
		</div>

		<!-- Full-screen click-to-unhide overlay when UI is hidden (Ren'Py style) -->
		<div
			v-if="isUiHidden"
			class="ui-hidden-overlay"
			title="Нажмите в любое место или нажмите H / Esc, чтобы вернуть интерфейс"
			@click.stop.prevent="unhideUi"
			@contextmenu.stop.prevent="unhideUi"
		/>

		<!-- Inventory Modal -->
		<InventoryModal
			:is-visible="modalStore.showInventoryModal"
			:items-data="itemsData"
			@close="modalStore.closeInventory"
			@equip="onEquipItem"
			@unequip="handleUnequip"
			@swap="handleSwap"
			@drop="handleDrop"
		/>

		<!-- Map Modal -->
		<MapModal
			:is-visible="modalStore.showMapModal"
			@close="modalStore.closeMap"
			@goto="handleMapGoto"
		/>

		<JournalModal
			:is-visible="modalStore.showJournalModal"
			@close="modalStore.closeJournal"
		/>

		<CalendarModal
			:is-visible="modalStore.showCalendarModal"
			@close="modalStore.closeCalendar"
		/>

		<!-- VR Helmet Launcher & Dashboard (Phase: VR_HUB) -->
		<VrHelmetLauncher
			v-if="isVrHubPhase"
			ref="vrLauncherRef"
			:initial-phase="vrLauncherPhase"
			@exit-vr="onVrExit"
			@launch-yggdrasil="onLaunchYggdrasil"
		/>

		<!-- YGGDRASIL Game Intro Video (Phase: VR_INTRO) -->
		<YggdrasilIntroVideo
			v-if="isVrIntroPhase"
			@intro-complete="onYggIntroComplete"
		/>

		<!-- YGGDRASIL MMO Auth Modal (Phase: VR_AUTH) -->
		<YggdrasilAuthModal
			v-if="isVrAuthPhase"
			@back-to-launcher="onYggBackToLauncher"
			@auth-success="onYggAuthSuccess"
		/>

		<!-- YGGDRASIL Character Creation (Phase: VR_CHAR_CREATE) -->
		<YggdrasilCharacterCreation
			v-if="isVrCharCreatePhase"
			:initial-nickname="mcCharacter?.nickname || mcCharacter?.name || ''"
			@character-confirmed="onCharCreationConfirmed"
		/>

		<!-- Server Shutdown Glitch & Transfer (Phase: VR_SHUTDOWN) -->
		<ServerShutdownSequence
			v-if="isVrShutdownPhase"
			@sequence-complete="onShutdownSequenceComplete"
		/>

		<!-- Menu overlay that can be toggled with Esc -->
		<div v-show="menuVisible" class="menu-overlay">
			<div class="overlay-content">
				<div class="content-area">
					<DynamicContentArea
						ref="dynamicContentAreaRef"
						:current-view="currentView"
						:in-game-context="true"
						:saves-initial-tab="savesTab"
						@saves-tab-change="onSavesTabChange"
						@back-to-menu="showMainMenu"
						@settings-saved="onSettingsSaved"
						@settings-reset="onSettingsReset"
						@settings-dirty-change="onSettingsDirtyChange"
						@load-request="onLoadRequest"
						@save-request="onSaveRequest"
					/>
				</div>
				<div class="menu-area __overlay">
					<MainMenu
						@navigate="handleNavigation"
						:show-back-to-main="currentView !== 'main-menu'"
						:current-view="currentView"
						:saves-tab="savesTab"
						:in-game-context="true"
						:on-continue="onContinue"
					/>
				</div>
			</div>
		</div>
	</div>

	<!-- Tactical Combat Overlay (Phase: TURN_COMBAT) -->
	<CombatOverlay
		v-if="isCombatPhase"
		:encounter-id="activeCombatEncounterId"
		:encounter-data="activeCombatEncounterData"
		@combat-end="onCombatEnd"
	/>

	<!-- Bottom hotbar -->
	<Hotbar
		:visible="showHotbar"
		@open-history="openHistory"
		@open-menu="openMainMenu"
		@open-settings="openSettings"
		@open-save="openSave"
		@open-load="openLoad"
		@quick-save="quickSave"
		@quick-load="quickLoad"
	/>

	<!-- History modal -->
	<HistoryModal
		:isVisible="modalStore.showHistoryModal"
		:entries="historyList"
		@close="modalStore.closeHistory"
	/>

	<ConfirmModal
		:visible="confirmVisible"
		:title="confirmTitle"
		:message="confirmMessage"
		confirmText="Да"
		cancelText="Отмена"
		@confirm="onConfirm"
		@cancel="onCancel"
	/>

	<SettingsLeaveConfirmModal
		:visible="showLeaveConfirm"
		title="Несохранённые настройки"
		message="Сохранить изменения перед переходом?"
		@yes="handleLeaveYes"
		@no="handleLeaveNo"
		@cancel="handleLeaveCancel"
	/>

	<!-- Экран загрузки с руническим индикатором -->
	<GameLoadingScreen
		:active="isGameLoading"
		:title-text="loadingTitleText"
		:status-text="loadingStatusText"
	/>
</template>

<script setup>
import { ref } from 'vue'
import { useModalStore } from '@/stores/modalStore'
import { useGameOrchestrator } from '@/composables/useGameOrchestrator'

// Components
import VisualNovel from '../components/game/VisualNovel.vue'
import InventoryModal from '../components/game/inventory/InventoryModal.vue'
import Topbar from '../components/game/ui/Topbar.vue'
import SidebarLeft from '../components/game/ui/SidebarLeft.vue'
import SidebarRight from '../components/game/ui/SidebarRight.vue'
import MapModal from '../components/game/maps/MapModal.vue'
import DynamicContentArea from '@/components/DynamicContentArea.vue'
import MainMenu from '@/components/MainMenu.vue'
import HistoryModal from '../components/game/modals/HistoryModal.vue'
import JournalModal from '../components/game/modals/JournalModal.vue'
import CalendarModal from '../components/game/modals/CalendarModal.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import Hotbar from '../components/game/ui/Hotbar.vue'
import SettingsLeaveConfirmModal from '@/components/SettingsLeaveConfirmModal.vue'
import VrHelmetLauncher from '../components/game/vr/VrHelmetLauncher.vue'
import YggdrasilIntroVideo from '../components/game/vr/YggdrasilIntroVideo.vue'
import YggdrasilAuthModal from '../components/game/vr/YggdrasilAuthModal.vue'
import YggdrasilCharacterCreation from '../components/game/vr/YggdrasilCharacterCreation.vue'
import ServerShutdownSequence from '../components/game/vr/ServerShutdownSequence.vue'
import GameLoadingScreen from '../components/game/GameLoadingScreen.vue'
import IsometricGameOverlay from '../components/game/IsometricGameOverlay.vue'
import CombatOverlay from '../components/game/CombatOverlay.vue'

const visualNovelRef = ref(null)
const dynamicContentAreaRef = ref(null)
const modalStore = useModalStore()

const {
	// FSM Phase checks
	isStoryVnPhase,
	isIsometricPhase,
	isCombatPhase,
	isVrHubPhase,
	isVrIntroPhase,
	isVrAuthPhase,
	isVrCharCreatePhase,
	isVrShutdownPhase,

	// Character & Items
	mcCharacter,
	itemsData,
	historyList,

	// Loading Screen
	isGameLoading,
	loadingTitleText,
	loadingStatusText,
	onVisualNovelReady,

	// VR & Yggdrasil
	vrLauncherRef,
	vrLauncherPhase,
	openVrFromSidebar,
	onVrExit,
	onLaunchYggdrasil,
	onYggIntroComplete,
	onYggBackToLauncher,
	onYggAuthSuccess,
	onCharCreationConfirmed,
	onShutdownSequenceComplete,

	// Isometric Overlay
	activeIsometricLocationId,
	isometricOverlayRef,
	onIsometricExit,
	onIsometricQuestCompleted,
	onIsometricCombatRequested,

	// Combat Overlay
	activeCombatEncounterId,
	activeCombatEncounterData,
	onCombatEnd,

	// UI & Layout Visibility
	isUiHidden,
	unhideUi,
	isFastForwarding,
	showInventoryButton,
	showJournalButton,
	showMapButton,
	showNextTimeButton,
	showDateBadge,
	showTopbar,
	showHotbar,
	canShowSidebars,
	hasDialogue,
	isHelmetEquipped,

	// Navigation & VN
	novelsrc,
	handleAdvanceTime,
	handleMapGoto,
	onCharacterClick,
	onGlobalDataChanged,
	onUiVisibilityChanged,
	onEnd,

	// Menu, Modals & Settings
	menuVisible,
	currentView,
	savesTab,
	showLeaveConfirm,
	confirmVisible,
	confirmTitle,
	confirmMessage,
	onConfirm,
	onCancel,
	showMainMenu,
	openMainMenu,
	openSettings,
	openSave,
	openLoad,
	openHistory,
	onContinue,
	handleNavigation,
	onSavesTabChange,
	onSettingsSaved,
	onSettingsReset,
	onSettingsDirtyChange,
	handleLeaveYes,
	handleLeaveNo,
	handleLeaveCancel,

	// Saves
	onLoadRequest,
	onSaveRequest,
	quickSave,
	quickLoad,

	// Equipment
	onEquipItem,
	handleUnequip,
	handleSwap,
	handleDrop
} = useGameOrchestrator({ visualNovelRef, dynamicContentAreaRef })
</script>
