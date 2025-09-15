<!-- src/renderer/views/Settings.vue -->

<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">{{ $t('mainmenu.settings') }}</div>
			</div>
			<div class="page-content">
				<div class="ui-tabs">
					<div class="ui-tabs-header">
						<button 
							class="ui-tabs-label" 
							:class="{ '__active': activeSection === 'audio' }" 
							@click="activeSection = 'audio'"
						>
							Audio
						</button>
						<button 
							class="ui-tabs-label" 
							:class="{ '__active': activeSection === 'general' }" 
							@click="activeSection = 'general'"
						>
							General
						</button>
						<button 
							class="ui-tabs-label" 
							:class="{ '__active': activeSection === 'video' }" 
							@click="activeSection = 'video'"
						>
							Video
						</button>
					</div>
					<div class="ui-tabs-content">
						<div class="ui-tab" :class="{ '__active': activeSection === 'audio' }">
							<SettingsAudio />
						</div>
						<div class="ui-tab" :class="{ '__active': activeSection === 'general' }">
							<SettingsGeneral />
						</div>
						<div class="ui-tab" :class="{ '__active': activeSection === 'video' }">
							<SettingsVideo />
						</div>
					</div>
				</div>
				<div class="buttons buttons-list">
					<button class="btn btn-primary" @click="saveSettings">Сохранить</button>
					<button class="btn btn-primary" @click="resetToDefault">Сбросить</button>
				</div>
			</div>
		</div>
		<div class="menu-area __static">
			<MainMenu />
		</div>
		<div class="back-area">
			<img src="/images/wallpaper/1.jpg" />
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import MainMenu from '@/components/MainMenu.vue'
	import SettingsAudio from '@/components/settings/SettingsAudio.vue'
	import SettingsGeneral from '@/components/settings/SettingsGeneral.vue'
	import SettingsVideo from '@/components/settings/SettingsVideo.vue'
	import { useSettingsStore } from '@/stores/settings'

	const store = useSettingsStore()
	const activeSection = ref('audio')

	async function saveSettings() {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			audio: { ...store.audio },
			general: { ...store.general },
			video: { ...store.video }
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
	}

	async function resetToDefault() {
		const def = await window.electronAPI.getSettings('default')
		store.audio = { ...def.audio }
		store.general = { ...def.general }
		store.video = { ...def.video }
		await saveSettings()
	}
</script>