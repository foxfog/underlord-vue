<template>
	<section>
		<h3>Audio</h3>
		<div class="option">
			<label>Общая громкость: {{ store.audio.commonVolume }}%</label>
			<UiRange v-model="store.audio.commonVolume" :min="0" :max="100" :step="1" />
			<uiPlayerAudio :key="'common-' + audioKeys.music" :src="''" volumeType="common" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" :stopBgMusic="true" />
		</div>
		<div class="option">
			<label>Музыка: {{ store.audio.musicVolume }}%</label>
			<UiRange v-model="store.audio.musicVolume" :min="0" :max="100" :step="1" />
			<uiPlayerAudio :key="'music-' + audioKeys.music" :src="''" volumeType="music" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" :stopBgMusic="true" />
		</div>
		<div class="option">
			<label>Звуки: {{ store.audio.soundVolume }}%</label>
			<UiRange v-model="store.audio.soundVolume" :min="0" :max="100" :step="1" />
			<uiPlayerAudio :key="'sound-' + audioKeys.sound" :src="''" volumeType="sound" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.sound" :stopBgMusic="true" />
		</div>
		<div class="option">
			<label>Голос: {{ store.audio.voiceVolume }}%</label>
			<UiRange v-model="store.audio.voiceVolume" :min="0" :max="100" :step="1" />
			<uiPlayerAudio :key="'voice-' + audioKeys.voice" :src="''" volumeType="voice" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.voice" :stopBgMusic="true" />
		</div>
	</section>
</template>

<script setup>
	import { reactive } from 'vue'
	import { useSettingsStore } from '@/stores/settings'
	import UiRange from '../UI/UiRange.vue'

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
