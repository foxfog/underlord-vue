import { ref } from 'vue'
import { SOUND_ALIASES } from '../../constants/sounds'

export function useStoryAudio() {
	let pendingAudioTimeouts = []

	function scheduleAudio(callback, delaySeconds) {
		if (!delaySeconds || delaySeconds <= 0) {
			callback()
			return
		}
		const item = {
			callback,
			timer: null
		}
		item.timer = setTimeout(() => {
			callback()
			const idx = pendingAudioTimeouts.indexOf(item)
			if (idx !== -1) pendingAudioTimeouts.splice(idx, 1)
		}, delaySeconds * 1000)
		pendingAudioTimeouts.push(item)
	}

	function flushPendingAudio() {
		while (pendingAudioTimeouts.length > 0) {
			const item = pendingAudioTimeouts.shift()
			if (item.timer) clearTimeout(item.timer)
			try {
				item.callback()
			} catch (e) {
				console.warn('Error flushing pending audio:', e)
			}
		}
	}

	function clearPendingAudio() {
		pendingAudioTimeouts.forEach((item) => {
			if (item.timer) clearTimeout(item.timer)
		})
		pendingAudioTimeouts = []
	}

	// Audio state - indexed by stream ID
	const audioStreams = ref({}) // { streamId: { type, file, loop, stream } }
	const pausedStreams = ref({}) // Store paused streams for resume
	const currentSound = ref(null)
	const currentVoice = ref(null)
	const currentMusic = ref(null)

	function onStreamEnded({ streamId, type }) {
		const stream = audioStreams.value[streamId]
		if (stream && !stream.loop) {
			stopStream(streamId)
			console.log(`🧹 Cleaned up finished non-looping ${type} stream: ${streamId}`)
		}
	}

	function playSound(soundData) {
		// soundData: { file: "path/to/sound.mp3", loop: false, stream: "id" }
		const streamId = soundData.stream || `sound_${Date.now()}`
		const audioData = {
			type: 'sound',
			file: soundData.file,
			loop: soundData.loop ?? false,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentSound.value = audioData
	}

	function playVoice(voiceData) {
		// voiceData: { file: "path/to/voice.mp3", loop: false, stream: "id" }
		const streamId = voiceData.stream || `voice_${Date.now()}`
		const audioData = {
			type: 'voice',
			file: voiceData.file,
			loop: voiceData.loop ?? false,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentVoice.value = audioData
	}

	function playMusic(musicData) {
		// musicData: { file: "path/to/music.ogg", loop: true, stream: "id" }
		const streamId = musicData.stream || `music_${Date.now()}`
		const audioData = {
			type: 'music',
			file: musicData.file,
			loop: musicData.loop ?? true,
			stream: streamId
		}
		audioStreams.value[streamId] = audioData
		currentMusic.value = audioData
	}

	function stopSound() {
		currentSound.value = null
	}
	function stopVoice() {
		currentVoice.value = null
	}
	function stopMusic() {
		currentMusic.value = null
	}

	function stopStream(streamId) {
		const stream = audioStreams.value[streamId]
		if (!stream) return

		switch (stream.type) {
			case 'sound':
				if (currentSound.value?.stream === streamId) stopSound()
				break
			case 'voice':
				if (currentVoice.value?.stream === streamId) stopVoice()
				break
			case 'music':
				if (currentMusic.value?.stream === streamId) stopMusic()
				break
		}
		delete audioStreams.value[streamId]
		delete pausedStreams.value[streamId]
		console.log(`🛑 Stopped stream: ${streamId}`)
	}

	function stopAllStreams() {
		console.log('🛑 Stopping all streams')
		clearPendingAudio()
		audioStreams.value = {}
		pausedStreams.value = {}
		stopSound()
		stopVoice()
		stopMusic()
	}

	function playVariableStepSound(soundName) {
		if (!soundName) return

		let file = soundName
		if (!soundName.includes('/')) {
			// Use shared alias map, fallback to audio/sound/<name>.ogg
			file = SOUND_ALIASES[soundName] || `audio/sound/${soundName}.ogg`
		}

		playSound({
			file,
			loop: false,
			stream: `var_${Date.now()}`
		})
	}

	function getStream(streamId) {
		return audioStreams.value[streamId] || null
	}

	function pauseAllStreams() {
		console.log('🔇 pauseAllStreams called, active streams:', Object.keys(audioStreams.value))
		pausedStreams.value = {}
		Object.entries(audioStreams.value).forEach(([streamId, stream]) => {
			pausedStreams.value[streamId] = { ...stream }
		})
		window.dispatchEvent(new CustomEvent('pauseAllAudio'))
		console.log('📢 pauseAllAudio event dispatched')
	}

	function resumeAllStreams() {
		console.log('🔊 resumeAllStreams called')
		window.dispatchEvent(new CustomEvent('resumeAllAudio'))
		console.log('📢 resumeAllAudio event dispatched')
		pausedStreams.value = {}
	}

	return {
		audioStreams,
		pausedStreams,
		currentSound,
		currentVoice,
		currentMusic,
		scheduleAudio,
		flushPendingAudio,
		clearPendingAudio,
		onStreamEnded,
		playSound,
		playVoice,
		playMusic,
		stopSound,
		stopVoice,
		stopMusic,
		stopStream,
		stopAllStreams,
		playVariableStepSound,
		getStream,
		pauseAllStreams,
		resumeAllStreams
	}
}
