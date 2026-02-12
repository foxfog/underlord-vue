// src/renderer/stores/settings.js
import { defineStore } from 'pinia'

let _SettingsStore = null

export function initSettingsStore(settings) {
	if (_SettingsStore) return // уже инициализирован

	_SettingsStore = defineStore('settings', {
		state: () => ({
			isMusicPlaying: true,
			defaultMusicFile: 'audio/music/medieval-irish.mp3',
			currentMusicFile: 'audio/music/medieval-irish.mp3',
			isTestAudioPlaying: false,

			audio: {
				...(settings?.audio ?? {}),
				commonVolume: settings?.audio?.commonVolume ?? 80,
				musicVolume: settings?.audio?.musicVolume ?? 80,
				soundVolume: settings?.audio?.soundVolume ?? 80,
				voiceVolume: settings?.audio?.voiceVolume ?? 80,
			},

			controls: {
				...(settings?.controls ?? {}),
				keyboardLayout: settings?.controls?.keyboardLayout ?? 'default',
			},

			general: {
				...(settings?.general ?? {}),
				language: settings?.general?.language ?? 'ru',
				textSpeed: settings?.general?.textSpeed ?? 100,
				skipSplash: settings?.general?.skipSplash ?? false,
			},

			video: {
				...(settings?.video ?? {}),
				fullscreen: settings?.video?.fullscreen ?? false,
				resolution: settings?.video?.resolution ?? '1920x1080',
			},
		}),

		getters: {
			commonVolume: (state) => state.audio.commonVolume / 100,

			getVolume: (state) => (name) => {
				const common = state.audio.commonVolume / 100
				const volume = state.audio[name] / 100
				return (common * volume).toFixed(2)
			},
		},

		actions: {
			toggleMusic() {
				this.isMusicPlaying = !this.isMusicPlaying
			},
			setMusicFile(file) {
				this.currentMusicFile = file
			},

			updateVolumeByName({ name, newValue }) {
				if (this.audio[name] !== undefined) {
					this.audio[name] = newValue
				}
			},

			setFullscreen(value) {
				this.video.fullscreen = value
			},

			setLanguage(lang) {
				this.general.language = lang
			},

			setTextSpeed(speed) {
				this.general.textSpeed = speed
			},

			setSkipSplash(value) {
				this.general.skipSplash = value
			},

			setKeyboardLayout(layout) {
				this.controls.keyboardLayout = layout
			},

			setResolution(res) {
				this.video.resolution = res
			},

			// Test audio control actions
			setTestAudioPlaying(isPlaying) {
				this.isTestAudioPlaying = isPlaying
			},
		}
	})
}

export function useSettingsStore() {
	if (!_SettingsStore) {
		throw new Error('SettingsStore is not initialized. Call initSettingsStore(settings) before using useSettingsStore().')
	}
	return _SettingsStore()
}
