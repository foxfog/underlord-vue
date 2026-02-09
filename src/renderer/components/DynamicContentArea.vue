<template>
	<div class="page-content">
		<Transition name="fade" mode="out-in">
			<!-- Main menu content -->
			<HomeContent v-if="currentView === 'main-menu'" key="main-menu" />
			
			<!-- Settings content -->
			<div v-else-if="currentView === 'settings'" key="settings" class="settings-wrapper">
				<div class="page-header">
					<div class="page-title">{{ $t('mainmenu.settings') }}</div>
				</div>
				<SettingsContent @saved="onSettingsSaved" @reset="onSettingsReset" />
			</div>
			<!-- Saves content (visual placeholder) -->
			<div v-else-if="currentView === 'saves'" key="saves" class="saves-wrapper">
				<div class="page-header">
					<div class="page-title">{{ $t('mainmenu.save_load') }}</div>
				</div>
				<SavesContent :in-game="inGameContext" @load-request="(data) => emit('load-request', data)" @save-request="(data) => emit('save-request', data)" />
			</div>
		</Transition>
		
		<!-- Additional content can be added here -->
		<slot></slot>
	</div>
</template>

<script setup>
	import { defineProps, defineEmits, watch } from 'vue'
	import HomeContent from '@/components/HomeContent.vue'
	import SettingsContent from '@/components/SettingsContent.vue'
	import SavesContent from '@/components/SavesContent.vue'
	
	const props = defineProps({
		currentView: {
			type: String,
			default: 'main-menu'
		},
		inGameContext: { type: Boolean, default: false }
	})
	
	const emit = defineEmits(['back-to-menu', 'settings-saved', 'settings-reset', 'load-request', 'save-request'])
	
	// Watch for view changes
	watch(() => props.currentView, (newView, oldView) => {
		console.log(`DynamicContentArea: switching from "${oldView}" to "${newView}"`)
	})
	
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
