<!-- src/renderer/components/game/StoryAudio.vue -->

<template>
	<!-- Dynamically render audio elements for all active streams -->
	<template v-for="(stream, streamId) in audioStreams" :key="streamId">
		<audio
			:ref="(el) => storeAudioRef(streamId, el)"
			:src="stream.file"
			:loop="stream.loop"
			autoplay
			@ended="onStreamEnded(streamId, stream.type)"
			@play="onStreamPlay(streamId, stream.type)"
			@error="onStreamError(streamId, stream.type)"
		></audio>
	</template>
</template>

<script setup>
	import { ref, watch, computed, onMounted, onUnmounted } from 'vue'
	import { useSettingsStore } from '@/stores/settings'

	const props = defineProps({
		audioStreams: { type: Object, default: () => ({}) }
	})

	const emit = defineEmits(['stream-ended', 'stream-started'])

	const store = useSettingsStore()
	const audioRefs = ref({}) // Store references to all audio elements

	const soundVolume = computed(() => {
		const common = store.audio.commonVolume / 100
		const sound = store.audio.soundVolume / 100
		return Math.max(0, Math.min(1, +(common * sound).toFixed(2)))
	})

	const voiceVolume = computed(() => {
		const common = store.audio.commonVolume / 100
		const voice = store.audio.voiceVolume / 100
		return Math.max(0, Math.min(1, +(common * voice).toFixed(2)))
	})

	const musicVolume = computed(() => {
		const common = store.audio.commonVolume / 100
		const music = store.audio.musicVolume / 100
		return Math.max(0, Math.min(1, +(common * music).toFixed(2)))
	})

	function getVolumeForType(type) {
		switch (type) {
			case 'sound': return soundVolume.value
			case 'voice': return voiceVolume.value
			case 'music': return musicVolume.value
			default: return 1
		}
	}

	// Watch for volume changes and update all active players
	watch([soundVolume, voiceVolume, musicVolume], () => {
		console.log('🔊 Volume changed, updating', Object.keys(audioRefs.value).length, 'streams')
		Object.entries(audioRefs.value).forEach(([streamId, audioElement]) => {
			if (audioElement && props.audioStreams[streamId]) {
				audioElement.volume = getVolumeForType(props.audioStreams[streamId].type)
			}
		})
	})

	// Watch for new streams
	watch(() => props.audioStreams, (newStreams) => {
		console.log('✨ audioStreams changed, new streams:', Object.keys(newStreams))
		
		// Clean up orphaned refs (streams that were removed)
		const activeStreamIds = Object.keys(newStreams)
		const orphanedRefs = Object.keys(audioRefs.value).filter(refId => !activeStreamIds.includes(refId))
		orphanedRefs.forEach(orphanId => {
			console.log(`🗑️  Cleaning up orphaned audio ref: ${orphanId}`)
			delete audioRefs.value[orphanId]
		})
		
		// Update volume for still-active streams
		Object.entries(newStreams).forEach(([streamId, stream]) => {
			const audioRef = audioRefs.value[streamId]
			if (audioRef) {
				audioRef.volume = getVolumeForType(stream.type)
			}
		})
	}, { deep: true })

	// Global event handlers for pause/resume
	function handlePauseAllAudio() {
		console.log('🎧 handlePauseAllAudio fired, pausing', Object.keys(audioRefs.value).length, 'audio elements')
		Object.entries(audioRefs.value).forEach(([streamId, audio]) => {
			// Only pause if stream is still active
			if (audio && !audio.paused && props.audioStreams[streamId]) {
				console.log(`⏸️  Pausing stream: ${streamId}`)
				audio.pause()
			}
		})
	}

	function handleResumeAllAudio() {
		console.log('🎧 handleResumeAllAudio fired, resuming', Object.keys(audioRefs.value).length, 'audio elements')
		Object.entries(audioRefs.value).forEach(([streamId, audio]) => {
			// Only resume if stream is still active
			if (audio && audio.paused && props.audioStreams[streamId]) {
				console.log(`▶️  Resuming stream: ${streamId}`)
				audio.play().catch(() => {})
			}
		})
	}

	onMounted(() => {
		console.log('📍 StoryAudio mounted, setting up event listeners')
		window.addEventListener('pauseAllAudio', handlePauseAllAudio)
		window.addEventListener('resumeAllAudio', handleResumeAllAudio)
	})

	onUnmounted(() => {
		window.removeEventListener('pauseAllAudio', handlePauseAllAudio)
		window.removeEventListener('resumeAllAudio', handleResumeAllAudio)
	})

	function storeAudioRef(streamId, element) {
		if (element) {
			console.log(`💾 Storing audio ref for stream: ${streamId}`, element)
			audioRefs.value[streamId] = element
		}
	}

	// Event handlers
	function onStreamPlay(streamId, type) {
		const audioRef = audioRefs.value[streamId]
		if (audioRef) {
			audioRef.volume = getVolumeForType(type)
			console.log(`🎵 Playing ${type} stream: ${streamId}`)
		}
		emit('stream-started', { streamId, type })
	}

	function onStreamEnded(streamId, type) {
		console.log(`✔ ${type} stream finished: ${streamId}`)
		emit('stream-ended', { streamId, type })
	}

	function onStreamError(streamId, type) {
		console.error(`❌ ${type} stream error: ${streamId}`)
	}
</script>
