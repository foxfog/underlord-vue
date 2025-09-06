<template>
	<div class="ui-player _audio">
		<div v-if="audioLook === 1" class="ui-player-controls">
			<div class="ui-player-top">
				<div class="ui-player-timeline">
					<UiRange
						v-model="smoothCurrentTime"
						:min="0"
						:max="audioDuration"
						:step="0.01"
						:showThumb="showThumb"
						@input="seekToTime"
						@drag-start="handleSeekStart"
						@drag-end="handleSeekEnd"
					/>
				</div>
			</div>
			<div class="ui-player-bot">
				<button class="ui-player-playbtn" @click="togglePlay">
					<template v-if="isPlaying">⏸</template>
					<template v-else>▶</template>
				</button>
				<div class="ui-player-time">
					<div>{{ formattedTime }}</div>/<div>{{ formattedEndTime }}</div>
				</div>
				<div class="ui-player-volume">
					<UiRange
						v-model="personalVolume"
						:min="0"
						:max="1"
						:step="0.01"
						:showThumb="showThumb"
						@input="changeVolume"
					/>
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
	import { ref, computed, onMounted, onUnmounted, watch, readonly } from 'vue'
	import { useSettingsStore } from '@/stores/settings'
	import UiRange from './UiRange.vue'

	defineOptions({
		name: 'uiPlayerAudio'
	})

	const props = defineProps({
		src: { type: String, default: '' },
		volumeType: { type: String, default: 'music' }, // common, music, sound, voice
		autoplay: { type: Boolean, default: false },
		audioLook: { type: Number, default: 1 },
		resetOnStop: { type: Boolean, default: false }, // Reset timer to beginning when stopping
		randomMode: { type: Boolean, default: false }, // Enable random file selection mode
		audioFolder: { type: String, default: '' }, // Folder path for random mode
		stopBgMusic: { type: Boolean, default: false }, // Stop background music during playback
		showThumb: { type: Boolean, default: true } // Show thumb on range sliders
	})

	const store = useSettingsStore()
	const audioPlayer = ref(null)

	const isPlaying = ref(false)
	const currentTime = ref(0)
	const audioDuration = ref(0)
	const durationObtained = ref(false)
	const personalVolume = ref(1) // Личная громкость плеера (0-1)
	const currentSrc = ref('')
	const audioFileCache = ref([])
	const isLoadingNewFile = ref(false)

	// Переменные для плавной интерполяции времени
	const lastRealTime = ref(0)
	const lastUpdateTime = ref(0)
	const smoothCurrentTime = ref(0)
	const animationFrameId = ref(null)
	const isInterpolating = ref(false)
	const isUserSeeking = ref(false) // Флаг ручного перемещения

	/**
	 * Глобальная громкость по типу из store
	 */
	const globalVolume = computed(() => {
		switch (props.volumeType) {
			case 'common': return store.audio.commonVolume / 100
			case 'music':  return store.audio.musicVolume / 100
			case 'sound':  return store.audio.soundVolume / 100
			case 'voice':  return store.audio.voiceVolume / 100
			default:       return 1
		}
	})

	/**
	 * Финальная громкость для аудио элемента (личная * глобальная)
	 */
	const finalVolume = computed(() => {
		return personalVolume.value * globalVolume.value
	})

	/**
	 * Форматированное время (использует плавную интерполяцию)
	 */
	const formattedTime = computed(() => {
		const timeToUse = isInterpolating.value ? smoothCurrentTime.value : currentTime.value
		const minutes = Math.floor(timeToUse / 60)
		const seconds = Math.floor(timeToUse % 60)
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
	 * Плавная интерполяция времени для плавного прогресс-бара
	 */
	function startSmoothTimeInterpolation() {
		if (!isPlaying.value || animationFrameId.value) return
		
		// Синхронизируем начальное состояние
		if (audioPlayer.value) {
			const currentAudioTime = audioPlayer.value.currentTime
			currentTime.value = currentAudioTime
			smoothCurrentTime.value = currentAudioTime
			lastRealTime.value = currentAudioTime
			lastUpdateTime.value = performance.now()
		}
		
		isInterpolating.value = true
		
		const animate = (timestamp) => {
			if (!isPlaying.value) {
				isInterpolating.value = false
				animationFrameId.value = null
				return
			}
			
			// Приостанавливаем интерполяцию во время ручного перемещения
			if (!isUserSeeking.value && lastUpdateTime.value > 0) {
				const timeSinceLastUpdate = (timestamp - lastUpdateTime.value) / 1000
				const estimatedCurrentTime = lastRealTime.value + timeSinceLastUpdate
				
				// Ограничиваем максимальным значением длительности
				if (audioDuration.value > 0) {
					smoothCurrentTime.value = Math.min(estimatedCurrentTime, audioDuration.value)
				} else {
					smoothCurrentTime.value = estimatedCurrentTime
				}
			}
			
			animationFrameId.value = requestAnimationFrame(animate)
		}
		
		animationFrameId.value = requestAnimationFrame(animate)
	}
	
	function stopSmoothTimeInterpolation() {
		if (animationFrameId.value) {
			cancelAnimationFrame(animationFrameId.value)
			animationFrameId.value = null
		}
		isInterpolating.value = false
		// Синхронизируем с фактическим временем аудио
		if (audioPlayer.value) {
			const actualTime = audioPlayer.value.currentTime
			currentTime.value = actualTime
			smoothCurrentTime.value = actualTime
			lastRealTime.value = actualTime
		} else {
			// Если аудио недоступно, используем текущее значение
			smoothCurrentTime.value = currentTime.value
		}
	}

	/**
	 * Сброс состояния для нового трека
	 */
	function resetTrackState() {
		stopSmoothTimeInterpolation()
		currentTime.value = 0
		smoothCurrentTime.value = 0
		audioDuration.value = 0
		durationObtained.value = false
		isPlaying.value = false
		lastRealTime.value = 0
		lastUpdateTime.value = 0
		isUserSeeking.value = false
	}

	/**
	 * Управление плеером
	 */
	async function togglePlay() {
		if (!audioPlayer.value) return
		
		if (isPlaying.value) {
			// Сначала останавливаем интерполяцию
			stopSmoothTimeInterpolation()
			// Потом пауза аудио
			audioPlayer.value.pause()
			isPlaying.value = false
			
			// Reset timer to beginning if resetOnStop prop is true
			if (props.resetOnStop) {
				audioPlayer.value.currentTime = 0
				currentTime.value = 0
				smoothCurrentTime.value = 0
			}
			// Notify that test audio stopped only if stopBgMusic is enabled
			if (props.stopBgMusic) {
				store.setTestAudioPlaying(false)
			}
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
					// Сбрасываем состояние перед загрузкой нового трека
					resetTrackState()
					
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
						// Ожидаем короткую паузу для синхронизации
						await new Promise(resolve => setTimeout(resolve, 50))
						// Запускаем плавную интерполяцию
						startSmoothTimeInterpolation()
						// Notify that test audio started only if stopBgMusic is enabled
						if (props.stopBgMusic) {
							store.setTestAudioPlaying(true)
						}
						
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
					// Ожидаем короткую паузу для синхронизации
					await new Promise(resolve => setTimeout(resolve, 50))
					// Запускаем плавную интерполяцию
					startSmoothTimeInterpolation()
					// Notify that test audio started only if stopBgMusic is enabled
					if (props.stopBgMusic) {
						store.setTestAudioPlaying(true)
					}
				} catch (error) {
					console.error('Error playing audio:', error)
				}
			}
		}
	}

	function handleAudioEnded() {
		stopSmoothTimeInterpolation()
		isPlaying.value = false
		// Reset timer to beginning if resetOnStop prop is true
		if (props.resetOnStop && audioPlayer.value) {
			audioPlayer.value.currentTime = 0
			currentTime.value = 0
			smoothCurrentTime.value = 0
		}
		// Notify that test audio stopped only if stopBgMusic is enabled
		if (props.stopBgMusic) {
			store.setTestAudioPlaying(false)
		}
	}

	function handleTimeUpdate() {
		if (audioPlayer.value) {
			const newTime = audioPlayer.value.currentTime
			currentTime.value = newTime
			
			// Обновляем данные для интерполяции
			lastRealTime.value = newTime
			lastUpdateTime.value = performance.now()
			
			// Если интерполяция не активна, синхронизируем
			if (!isInterpolating.value) {
				smoothCurrentTime.value = newTime
			}
		}
	}

	function seekToTime() {
		if (audioPlayer.value) {
			const seekTime = smoothCurrentTime.value
			audioPlayer.value.currentTime = seekTime
			// Синхронизируем все значения времени
			currentTime.value = seekTime
			lastRealTime.value = seekTime
			lastUpdateTime.value = performance.now()
		}
	}

	/**
	 * Обработка начала ручного перемещения бегунка
	 */
	function handleSeekStart() {
		isUserSeeking.value = true
	}

	/**
	 * Обработка окончания ручного перемещения бегунка
	 */
	function handleSeekEnd() {
		isUserSeeking.value = false
	}

	function changeVolume() {
		if (audioPlayer.value) {
			audioPlayer.value.volume = finalVolume.value
		}
	}

	function handleVolumeChange() {
		// Этот метод вызывается при изменении громкости аудио элемента
		// Обновляем финальную громкость при изменении глобальных настроек
		if (audioPlayer.value) {
			audioPlayer.value.volume = finalVolume.value
		}
	}

	function setInitialVolume() {
		if (audioPlayer.value) {
			audioPlayer.value.volume = finalVolume.value
		}
	}

	/**
	 * Смена трека программно (для внешнего управления)
	 */
	async function changeTrack(newSrc) {
		if (!newSrc || !audioPlayer.value) return
		
		// Останавливаем текущее воспроизведение
		if (isPlaying.value) {
			audioPlayer.value.pause()
		}
		
		// Сбрасываем состояние
		resetTrackState()
		
		// Устанавливаем новый источник
		currentSrc.value = newSrc
		audioPlayer.value.src = newSrc
		
		// Загружаем новый трек
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
				
				audioPlayer.value.load()
			})
			
			console.log(`Track changed to: ${newSrc}`)
		} catch (error) {
			console.error('Error loading new track:', error)
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

		// Отслеживаем изменения глобальной громкости для обновления финальной громкости
		watch(globalVolume, () => {
			handleVolumeChange()
		})

		// Отслеживаем изменения личной громкости
		watch(personalVolume, () => {
			changeVolume()
		})
	})

	onUnmounted(() => {
		stopSmoothTimeInterpolation()
	})

	// Отслеживаем изменения src пропа
	watch(() => props.src, (newSrc, oldSrc) => {
		if (newSrc && newSrc !== oldSrc && !props.randomMode) {
			changeTrack(newSrc)
		}
	})

	// Экспортируем методы для внешнего управления
	defineExpose({
		changeTrack,
		togglePlay,
		isPlaying: readonly(isPlaying),
		currentTime: readonly(currentTime),
		smoothCurrentTime: readonly(smoothCurrentTime),
		audioDuration: readonly(audioDuration)
	})
</script>