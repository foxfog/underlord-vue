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
				<SettingsContent
					ref="settingsContentRef"
					@saved="onSettingsSaved"
					@reset="onSettingsReset"
					@dirty-change="onSettingsDirtyChange"
				/>
			</div>
			<!-- Saves content (visual placeholder) -->
			<div v-else-if="currentView === 'saves'" key="saves" class="saves-wrapper">
				<div class="page-header">
					<div class="page-title">{{ $t('mainmenu.save_load') }}</div>
				</div>
				<SavesContent 
					:in-game="inGameContext" 
					:initial-tab="savesInitialTab"
					@load-request="(data) => emit('load-request', data)" 
					@save-request="(data) => emit('save-request', data)"
					@tab-change="onSavesTabChange"
				/>
			</div>
		</Transition>
		
		<!-- Additional content can be added here -->
		<slot></slot>
	</div>
</template>

<script setup>
	import { watch, ref } from 'vue'
	import HomeContent from '@/components/HomeContent.vue'
	import SettingsContent from '@/components/settings/SettingsContent.vue'
	import SavesContent from '@/components/saves/SavesContent.vue'
	
	const props = defineProps({
		currentView: {
			type: String,
			default: 'main-menu'
		},
		inGameContext: { type: Boolean, default: false },
		savesInitialTab: { type: String, default: 'load', validator: (val) => ['load', 'save'].includes(val) }
	})
		
	const emit = defineEmits([
		'back-to-menu',
		'settings-saved',
		'settings-reset',
		'settings-dirty-change',
		'load-request',
		'save-request',
		'saves-tab-change'
	])
		
	const settingsContentRef = ref(null)

	const onSavesTabChange = (tab) => {
		emit('saves-tab-change', tab)
	}
	
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

	const onSettingsDirtyChange = (val) => {
		emit('settings-dirty-change', val)
	}

	// Expose helpers for parent components to control settings
	function saveSettingsFromOutside() {
		return settingsContentRef.value?.saveSettings?.()
	}

	function revertSettingsFromOutside() {
		return settingsContentRef.value?.revertToInitial?.()
	}

	defineExpose({
		saveSettingsFromOutside,
		revertSettingsFromOutside
	})
</script>
