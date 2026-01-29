<template>
	<div class="page-content">
		<!-- Main menu content -->
		<div v-if="currentView === 'main-menu'" class="main-menu-content">
			<HomeContent />
		</div>
		
		<!-- Settings content -->
		<div v-else-if="currentView === 'settings'" class="settings-content">
			<div class="page-header">
				<div class="page-title">{{ $t('mainmenu.settings') }}</div>
			</div>
			<SettingsContent @saved="onSettingsSaved" @reset="onSettingsReset" />
		</div>
		
		<!-- Additional content can be added here -->
		<slot></slot>
	</div>
</template>

<script setup>
	import { defineProps, defineEmits } from 'vue'
	import HomeContent from '@/components/HomeContent.vue'
	import SettingsContent from '@/components/SettingsContent.vue'
	
	const props = defineProps({
		currentView: {
			type: String,
			default: 'main-menu'
		}
	})
	
	const emit = defineEmits(['back-to-menu', 'settings-saved', 'settings-reset'])
	
	// Event handlers
	const onBackToMenu = () => {
		emit('back-to-menu')
	}
	
	const onSettingsSaved = () => {
		emit('settings-saved')
	}
	
	const onSettingsReset = () => {
		emit('settings-reset')
	}
</script>

<style scoped>
.settings-content .page-header,
.saves-content .page-header {
	margin-bottom: 1.5rem;
}
</style>