<template>
	<div class="page-area __dark">
		<div class="content-area">
			<DynamicContentArea 
				ref="dynamicContentAreaRef"
				:current-view="currentView" 
				@back-to-menu="showMainMenu"
				@settings-saved="onSettingsSaved"
				@settings-reset="onSettingsReset"
				@settings-dirty-change="onSettingsDirtyChange"
			/>
		</div>
		<div class="menu-area __static">
			<MainMenu @navigate="handleNavigation" :show-back-to-main="currentView !== 'main-menu'" />
		</div>
		<div class="back-area">
			<img src="/images/wallpaper/1.jpg" />
		</div>

		<SettingsLeaveConfirmModal
			:visible="showLeaveConfirm"
			title="Несохранённые настройки"
			message="Сохранить изменения перед переходом в другое меню?"
			@yes="handleLeaveYes"
			@no="handleLeaveNo"
			@cancel="handleLeaveCancel"
		/>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import { useRouter } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'
	import SettingsLeaveConfirmModal from '@/components/SettingsLeaveConfirmModal.vue'
	
	const router = useRouter()
	const currentView = ref('main-menu')
	const dynamicContentAreaRef = ref(null)
	const isSettingsDirty = ref(false)
	const showLeaveConfirm = ref(false)
	const pendingView = ref(null)
	
	// Navigation handlers for component switching
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
		// If we are leaving settings with unsaved changes, ask user first
		if (currentView.value === 'settings' && view !== 'settings' && isSettingsDirty.value) {
			pendingView.value = view
			showLeaveConfirm.value = true
			return
		}

		navigateImmediate(view)
	}

	function navigateImmediate(view) {
		if (view === 'settings') {
			showSettings()
		} else if (view === 'save' || view === 'load') {
			// Both save and load on main menu go to saves view (load tab)
			showSaves()
		} else if (view === 'saves') {
			showSaves()
		} else if (view === 'main-menu') {
			showMainMenu()
		}
		// For page navigation (like new game), the router handles it directly
	}
	
	function onSettingsSaved() {
		console.log('Settings saved')
		isSettingsDirty.value = false
	}
	
	function onSettingsReset() {
		console.log('Settings reset to default')
		isSettingsDirty.value = false
	}

	function onSettingsDirtyChange(val) {
		isSettingsDirty.value = val
	}

	async function handleLeaveYes() {
		showLeaveConfirm.value = false
		if (dynamicContentAreaRef.value?.saveSettingsFromOutside) {
			await dynamicContentAreaRef.value.saveSettingsFromOutside()
			isSettingsDirty.value = false
		}
		if (pendingView.value) {
			navigateImmediate(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveNo() {
		showLeaveConfirm.value = false
		// Revert settings in UI to last saved snapshot
		if (dynamicContentAreaRef.value?.revertSettingsFromOutside) {
			dynamicContentAreaRef.value.revertSettingsFromOutside()
		}
		isSettingsDirty.value = false
		if (pendingView.value) {
			navigateImmediate(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveCancel() {
		showLeaveConfirm.value = false
		pendingView.value = null
	}
</script>