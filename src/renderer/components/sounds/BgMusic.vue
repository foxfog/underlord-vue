<!-- src/renderer/components/sounds/BgMusic.vue -->

<template>
	<audio ref="audioPlayer" id="bgmusic" autoplay loop>
		<source :src="currentMusicFile" />
	</audio>
</template>

<script setup>
import { ref, watch, onMounted, computed, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const audioPlayer = ref(null)
const volumeInterval = ref(null)
const fadeInOutLock = ref(false)

const store = useSettingsStore()

const currentMusicFile = computed(() => store.currentMusicFile)
const isMusicPlaying = computed(() => store.isMusicPlaying)
const isTestAudioPlaying = computed(() => store.isTestAudioPlaying)
const musicVolume = computed(() => {
	const common = store.audio.commonVolume / 100
	const music = store.audio.musicVolume / 100
	return Math.max(0, Math.min(1, +(common * music).toFixed(2)))
})

watch(isMusicPlaying, (newValue) => {
	if (newValue) {
		playMusicWithFadeIn()
	} else {
		pauseMusicWithFadeOut()
	}
})

watch(musicVolume, (newVolume) => {
	if (audioPlayer.value && !isTestAudioPlaying.value) {
		audioPlayer.value.volume = newVolume
	}
})

// Handle test audio playback - fade background music
watch(isTestAudioPlaying, async (isPlaying) => {
	if (!audioPlayer.value) return
	if (fadeInOutLock.value) return

	if (isPlaying) {
		// Test audio started - fade out background music over 0.5s
		await fadeOutForTestAudio()
	} else {
		// Test audio ended - fade in background music back to normal volume
		await fadeInAfterTestAudio()
	}
})

// Следим за сменой трека с плавным затуханием и началом
watch(currentMusicFile, async (newFile, oldFile) => {
	if (!audioPlayer.value) return
	if (fadeInOutLock.value) return
	fadeInOutLock.value = true
	await pauseMusicWithFadeOut(true) // true = не ставить на паузу, только затухание
	try {
		audioPlayer.value.pause()
	} catch {}
	audioPlayer.value.currentTime = 0
	audioPlayer.value.load()
	await nextTick()
	if (isMusicPlaying.value) {
		await playMusicWithFadeIn()
	}
	fadeInOutLock.value = false
})

onMounted(async () => {
	if (!audioPlayer.value) return
	audioPlayer.value.volume = musicVolume.value
	audioPlayer.value.addEventListener('ended', () => {
		if (isMusicPlaying.value) {
			playMusicWithFadeIn()
		}
	})
	// Стартовое состояние
	if (isMusicPlaying.value) {
		await playMusicWithFadeIn()
	} else {
		try {
			audioPlayer.value.pause()
		} catch {}
	}
})

async function playMusicWithFadeIn() {
	clearInterval(volumeInterval.value)
	if (!audioPlayer.value) return
	audioPlayer.value.volume = 0
	try {
		await audioPlayer.value.play()
	} catch {}
	volumeInterval.value = setInterval(() => {
		if (audioPlayer.value.volume < musicVolume.value) {
			audioPlayer.value.volume = Math.min(audioPlayer.value.volume + 0.01, musicVolume.value)
		} else {
			clearInterval(volumeInterval.value)
		}
	}, 25)
}

function pauseMusicWithFadeOut(onlyFade = false) {
	return new Promise((resolve) => {
		clearInterval(volumeInterval.value)
		if (!audioPlayer.value) return resolve()
		volumeInterval.value = setInterval(async () => {
			if (audioPlayer.value.volume > 0.01) {
				audioPlayer.value.volume = Math.max(audioPlayer.value.volume - 0.01, 0)
			} else {
				clearInterval(volumeInterval.value)
				if (!onlyFade) {
					try {
						audioPlayer.value.pause()
					} catch {}
				}
				resolve()
			}
		}, 25)
	})
}

// Fade out background music for test audio (0.5 seconds)
function fadeOutForTestAudio() {
	return new Promise((resolve) => {
		clearInterval(volumeInterval.value)
		if (!audioPlayer.value) return resolve()

		const startVolume = audioPlayer.value.volume
		const fadeSteps = 20 // 20 steps over 0.5 seconds (25ms intervals)
		const volumeDecrement = startVolume / fadeSteps
		let currentStep = 0

		volumeInterval.value = setInterval(() => {
			currentStep++
			if (currentStep < fadeSteps && audioPlayer.value.volume > 0.01) {
				audioPlayer.value.volume = Math.max(startVolume - volumeDecrement * currentStep, 0)
			} else {
				clearInterval(volumeInterval.value)
				audioPlayer.value.volume = 0
				// Stop playback during test audio
				try {
					audioPlayer.value.pause()
				} catch {}
				resolve()
			}
		}, 25) // 25ms * 20 steps = 500ms (0.5 seconds)
	})
}

// Fade in background music after test audio (0.5 seconds)
function fadeInAfterTestAudio() {
	return new Promise((resolve) => {
		clearInterval(volumeInterval.value)
		if (!audioPlayer.value || !isMusicPlaying.value) return resolve()

		// Resume playback
		try {
			audioPlayer.value.play()
		} catch {}

		audioPlayer.value.volume = 0
		const targetVolume = musicVolume.value
		const fadeSteps = 20 // 20 steps over 0.5 seconds
		const volumeIncrement = targetVolume / fadeSteps
		let currentStep = 0

		volumeInterval.value = setInterval(() => {
			currentStep++
			if (currentStep < fadeSteps && audioPlayer.value.volume < targetVolume) {
				audioPlayer.value.volume = Math.min(volumeIncrement * currentStep, targetVolume)
			} else {
				clearInterval(volumeInterval.value)
				audioPlayer.value.volume = targetVolume
				resolve()
			}
		}, 25) // 25ms * 20 steps = 500ms (0.5 seconds)
	})
}
</script>
