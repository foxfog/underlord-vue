<template>
	<div class="ui-audioplayer">
		<div class="ui-audioplayer-body">
			<button class="ui-audioplayer-playbtn" @click="togglePlay">
				<template v-if="isPlaying">⏸</template>
				<template v-else>▶</template>
			</button>

			<div v-if="audioLook === 1" class="ui-audioplayer-left">
				<div class="ui-audioplayer-top">
					<div class="ui-audioplayer-timeline">
						<input
							type="range"
							class="ui-range"
							:max="audioDuration"
							v-model="currentTime"
							@input="seekToTime"
						/>
					</div>
				</div>
				<div class="ui-audioplayer-bot">
					<div class="ui-audioplayer-time">
						<div>{{ formattedTime }}</div>/<div>{{ formattedEndTime }}</div>
					</div>
					<div class="ui-audioplayer-volume">
						<input
							type="range"
							class="ui-range"
							:max="1"
							step="0.01"
							v-model="volume"
							@input="changeVolume"
						/>
					</div>
				</div>
			</div>
		</div>

		<audio
			ref="audioPlayer"
			:src="randomMode ? currentSrc : src"
			:autoplay="autoplay"
			@ended="handleAudioEnded"
			@timeupdate="handleTimeUpdate"
			@volumechange="handleVolumeChange"
		></audio>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
	src: { type: String, default: '' },
	volumeType: { type: String, default: 'music' }, // common, music, sound, voice
	autoplay: { type: Boolean, default: false },
	audioLook: { type: Number, default: 1 },
	resetOnStop: { type: Boolean, default: false }, // Reset timer to beginning when stopping
	randomMode: { type: Boolean, default: false }, // Enable random file selection mode
	audioFolder: { type: String, default: '' } // Folder path for random mode
})

const store = useSettingsStore()
const audioPlayer = ref(null)

const isPlaying = ref(false)
const currentTime = ref(0)
const audioDuration = ref(0)
const durationObtained = ref(false)
const volume = ref(1)
const currentSrc = ref('')
const audioFileCache = ref([])
const isLoadingNewFile = ref(false)

/**
 * Привязка громкости к store по типу
 */
const currentVolume = computed({
	get() {
		switch (props.volumeType) {
			case 'common': return store.audio.commonVolume / 100
			case 'music':  return store.audio.musicVolume / 100
			case 'sound':  return store.audio.soundVolume / 100
			case 'voice':  return store.audio.voiceVolume / 100
			default:       return 1
		}
	},
	set(val) {
		const percent = Math.round(val * 100)
		switch (props.volumeType) {
			case 'common': store.audio.commonVolume = percent; break
			case 'music':  store.audio.musicVolume = percent; break
			case 'sound':  store.audio.soundVolume = percent; break
			case 'voice':  store.audio.voiceVolume = percent; break
		}
	}
})

/**
 * Форматированное время
 */
const formattedTime = computed(() => {
	const minutes = Math.floor(currentTime.value / 60)
	const seconds = Math.floor(currentTime.value % 60)
	return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`
})

const formattedEndTime = computed(() => {
	const endMinutes = Math.floor(audioDuration.value / 60)
	const endSeconds = Math.floor(audioDuration.value % 60)
	return `${endMinutes}:${endSeconds < 10 ? '0' : ''}${endSeconds}`
})

/**
 * Загрузка списка файлов из папки (только для random режима)
 */
async function loadAudioFiles() {
	if (!props.randomMode || !props.audioFolder) return
	
	try {
		const files = await window.electronAPI.listFiles(props.audioFolder)
		audioFileCache.value = files
		console.log(`Loaded ${files.length} files for ${props.volumeType}:`, files)
	} catch (error) {
		console.error(`Error loading ${props.volumeType} files:`, error)
		audioFileCache.value = []
	}
}

/**
 * Получение случайного аудио файла
 */
function getRandomAudioFile() {
	const files = audioFileCache.value
	if (!files || files.length === 0) return ''
	const randomIndex = Math.floor(Math.random() * files.length)
	return files[randomIndex]
}

/**
 * Управление плеером
 */
async function togglePlay() {
	if (!audioPlayer.value) return
	
	if (isPlaying.value) {
		audioPlayer.value.pause()
		// Reset timer to beginning if resetOnStop prop is true
		if (props.resetOnStop) {
			audioPlayer.value.currentTime = 0
			currentTime.value = 0
		}
		// Notify that test audio stopped
		store.setTestAudioPlaying(false)
		isPlaying.value = false
	} else {
		// Для random режима - выбираем новый файл перед воспроизведением
		if (props.randomMode && props.audioFolder) {
			// Если файлы ещё не загружены - загружаем
			if (audioFileCache.value.length === 0) {
				await loadAudioFiles()
			}
			
			// Выбираем случайный файл
			const randomFile = getRandomAudioFile()
			if (randomFile) {
				currentSrc.value = randomFile
				audioPlayer.value.src = randomFile
				
				// Ждём загрузки и сразу воспроизводим
				isLoadingNewFile.value = true
				
				try {
					await new Promise((resolve, reject) => {
						const onCanPlay = () => {
							audioPlayer.value.removeEventListener('canplaythrough', onCanPlay)
							audioPlayer.value.removeEventListener('error', onError)
							resolve()
						}
						
						const onError = (e) => {
							audioPlayer.value.removeEventListener('canplaythrough', onCanPlay)
							audioPlayer.value.removeEventListener('error', onError)
							reject(e)
						}
						
						audioPlayer.value.addEventListener('canplaythrough', onCanPlay, { once: true })
						audioPlayer.value.addEventListener('error', onError, { once: true })
						
						// Принудительно загружаем
						audioPlayer.value.load()
					})
					
					// Файл загружен, можем воспроизводить
					await audioPlayer.value.play()
					isPlaying.value = true
					store.setTestAudioPlaying(true)
					
				} catch (error) {
					console.error('Error playing random audio:', error)
				} finally {
					isLoadingNewFile.value = false
				}
			}
		} else {
			// Обычный режим
			try {
				await audioPlayer.value.play()
				isPlaying.value = true
				store.setTestAudioPlaying(true)
			} catch (error) {
				console.error('Error playing audio:', error)
			}
		}
	}
}

function handleAudioEnded() {
	isPlaying.value = false
	// Reset timer to beginning if resetOnStop prop is true
	if (props.resetOnStop && audioPlayer.value) {
		audioPlayer.value.currentTime = 0
		currentTime.value = 0
	}
	// Notify that test audio stopped
	store.setTestAudioPlaying(false)
}

function handleTimeUpdate() {
	if (audioPlayer.value) {
		currentTime.value = audioPlayer.value.currentTime
	}
}

function seekToTime() {
	if (audioPlayer.value) {
		audioPlayer.value.currentTime = currentTime.value
	}
}

function changeVolume() {
	if (audioPlayer.value) {
		audioPlayer.value.volume = volume.value
	}
}

function handleVolumeChange() {
	if (audioPlayer.value) {
		audioPlayer.value.volume = currentVolume.value
	}
}

function setInitialVolume() {
	if (audioPlayer.value) {
		audioPlayer.value.volume = currentVolume.value
	}
}

/**
 * Хук монтирования
 */
onMounted(() => {
	if (!audioPlayer.value) return

	audioPlayer.value.addEventListener('durationchange', () => {
		if (!durationObtained.value) {
			audioDuration.value = audioPlayer.value.duration
			durationObtained.value = true
		}
	})

	setInitialVolume()

	watch(currentVolume, () => {
		handleVolumeChange()
	})
})
</script>

<style scoped>
	.ui-player-audio {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		align-items: flex-start;
		padding: 0.5rem 1rem;
		background: rgba(0,0,0,0.2);
		border-radius: 8px;
		font-size: 1rem;
	}
	.audio-info {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.audio-title {
		font-weight: bold;
	}
	.audio-status {
		font-size: 1.2em;
	}
	.audio-controls {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	input[type="range"] {
		width: 100px;
	}
</style>