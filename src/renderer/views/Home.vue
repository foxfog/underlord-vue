<template>
	<div class="page-area __dark">
		<div class="content-area">
			<DynamicContentArea 
				:current-view="currentView" 
				@back-to-menu="showMainMenu"
				@settings-saved="onSettingsSaved"
				@settings-reset="onSettingsReset"
			/>
		</div>
		<div class="menu-area __static">
			<MainMenu @navigate="handleNavigation" :show-back-to-main="currentView !== 'main-menu'" />
		</div>
		<div class="back-area">
			<img src="/images/wallpaper/1.jpg" />
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import { useRouter } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'
	
	const router = useRouter()
	const currentView = ref('main-menu')
	
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
	}
	
	function onSettingsReset() {
		console.log('Settings reset to default')
	}
</script>