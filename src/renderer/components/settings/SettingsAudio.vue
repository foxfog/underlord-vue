<template>
	<section>
		<h3>Audio</h3>
		<div class="option">
			<label>Общая громкость: {{ store.audio.commonVolume }}%</label>
			<input type="range" min="0" max="100" v-model.number="store.audio.commonVolume" />
			<UiPlayerAudio :key="'common-' + audioKeys.music" :src="''" volumeType="common" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" />
		</div>
		<div class="option">
			<label>Музыка: {{ store.audio.musicVolume }}%</label>
			<input type="range" min="0" max="100" v-model.number="store.audio.musicVolume" />
			<UiPlayerAudio :key="'music-' + audioKeys.music" :src="''" volumeType="music" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.music" />
		</div>
		<div class="option">
			<label>Звуки: {{ store.audio.soundVolume }}%</label>
			<input type="range" min="0" max="100" v-model.number="store.audio.soundVolume" />
			<UiPlayerAudio :key="'sound-' + audioKeys.sound" :src="''" volumeType="sound" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.sound" />
		</div>
		<div class="option">
			<label>Голос: {{ store.audio.voiceVolume }}%</label>
			<input type="range" min="0" max="100" v-model.number="store.audio.voiceVolume" />
			<UiPlayerAudio :key="'voice-' + audioKeys.voice" :src="''" volumeType="voice" :resetOnStop="true" :randomMode="true" :audioFolder="audioFolders.voice" />
		</div>
	</section>
</template>

<script setup>
	import { reactive } from 'vue'
	import { useSettingsStore } from '@/stores/settings'
	import UiPlayerAudio from '@/components/UI/UiPlayerAudio.vue'

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
