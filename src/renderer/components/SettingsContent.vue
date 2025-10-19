<template>
	<div class="settings-content">
		<div class="ui-tabs">
			<div class="ui-tabs-header">
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'audio' }" 
					@click="activeSection = 'audio'"
				>
					{{ $t('settings.audio') }}
				</button>
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'general' }" 
					@click="activeSection = 'general'"
				>
					{{ $t('settings.generals') }}
				</button>
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'video' }" 
					@click="activeSection = 'video'"
				>
					{{ $t('settings.video') }}
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
			<button class="btn btn-primary" @click="saveSettings">{{ $t('settings.save') }}</button>
			<button class="btn btn-primary" @click="resetToDefault">{{ $t('settings.resetToDefoult') }}</button>
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import SettingsAudio from '@/components/settings/SettingsAudio.vue'
	import SettingsGeneral from '@/components/settings/SettingsGeneral.vue'
	import SettingsVideo from '@/components/settings/SettingsVideo.vue'
	import { useSettingsStore } from '@/stores/settings'

	const store = useSettingsStore()
	const activeSection = ref('audio')
	const emit = defineEmits(['saved', 'reset'])

	async function saveSettings() {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			audio: { ...store.audio },
			general: { ...store.general },
			video: { ...store.video }
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		emit('saved')
	}

	async function resetToDefault() {
		const def = await window.electronAPI.getSettings('default')
		store.audio = { ...def.audio }
		store.general = { ...def.general }
		store.video = { ...def.video }
		await saveSettings()
		emit('reset')
	}
</script>

<style scoped>
.settings-content .ui-tabs {
	margin-bottom: 1.5rem;
}
</style>