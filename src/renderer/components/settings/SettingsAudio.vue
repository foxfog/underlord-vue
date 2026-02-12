<template>
	<div class="settings-list">
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Общая громкость</div>
			</div>
			<div class="right">
				<UiRange v-model="store.audio.commonVolume" :min="0" :max="100" :step="1" />
				<div class="settings-item-value">{{ store.audio.commonVolume }}%</div>
				<uiPlayerAudio :key="'common-' + audioKeys.music" :src="''" volumeType="common" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" :stopBgMusic="true" class="_btn" />
			</div>
		</div>
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Музыка</div>
			</div>
			<div class="right">
				<UiRange v-model="store.audio.musicVolume" :min="0" :max="100" :step="1" />
				<div class="settings-item-value">{{ store.audio.musicVolume }}%</div>
				<uiPlayerAudio :key="'music-' + audioKeys.music" :src="''" volumeType="music" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" :stopBgMusic="true" class="_btn" />
			</div>
		</div>
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Звуки</div>
			</div>
			<div class="right">
				<UiRange v-model="store.audio.soundVolume" :min="0" :max="100" :step="1" />
				<div class="settings-item-value">{{ store.audio.soundVolume }}%</div>
				<uiPlayerAudio :key="'sound-' + audioKeys.sound" :src="''" volumeType="sound" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.sound" :stopBgMusic="true" class="_btn" />
			</div>
		</div>
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Голос</div>
			</div>
			<div class="right">
				<UiRange v-model="store.audio.voiceVolume" :min="0" :max="100" :step="1" />
				<div class="settings-item-value">{{ store.audio.voiceVolume }}%</div>
				<uiPlayerAudio :key="'voice-' + audioKeys.voice" :src="''" volumeType="voice" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.voice" :stopBgMusic="true" class="_btn" />
			</div>
		</div>
	</div>
</template>

<script setup>
import { reactive } from 'vue'
import { useSettingsStore } from '@/stores/settings'

	const store = useSettingsStore()
	
	// Папки для каждого типа аудио (hardcoded configuration)
	const audioFolders = {
		music: 'audio/test/music/',
		sound: 'audio/test/sound/',
		voice: 'audio/test/voice/'
	}
	
	// Ключи для принудительного обновления компонентов
	const audioKeys = reactive({
		music: 0,
		sound: 0,
		voice: 0
	})
</script>