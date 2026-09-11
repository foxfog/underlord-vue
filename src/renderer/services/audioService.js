import { useSettingsStore } from '../stores/settings'

class AudioService {
	// Расчет громкости согласно гайдлайнам (AGENTS.md):
	// commonVolume * categoryVolume / 10000
	calculateVolume(category) {
		const settingsStore = useSettingsStore()
		const common = settingsStore.audio?.commonVolume ?? 100
		let categoryVol = 100
		
		if (category === 'music') {
			categoryVol = settingsStore.audio?.musicVolume ?? 100
		} else if (category === 'sound') {
			categoryVol = settingsStore.audio?.soundVolume ?? 100
		} else if (category === 'voice') {
			categoryVol = settingsStore.audio?.voiceVolume ?? 100
		} else if (category === 'ui') {
			categoryVol = settingsStore.audio?.uiVolume ?? 100
		}
		
		const volume = (common * categoryVol) / 10000
		return Math.max(0, Math.min(1, volume))
	}

	playSound(src, category = 'sound') {
		try {
			const volume = this.calculateVolume(category)
			const audio = new Audio(src)
			audio.volume = volume
			audio.play().catch((e) => console.warn('Audio play prevented:', e))
			return audio
		} catch (e) {
			console.warn('Failed to play sound:', e)
			return null
		}
	}

	playMusic(src, loop = true) {
		try {
			const volume = this.calculateVolume('music')
			const audio = new Audio(src)
			audio.loop = loop
			audio.volume = volume
			audio.play().catch((e) => console.warn('Music play prevented:', e))
			return audio
		} catch (e) {
			console.warn('Failed to play music:', e)
			return null
		}
	}
	
	stopAudio(audioInstance) {
		if (audioInstance) {
			try {
				audioInstance.pause()
				audioInstance.currentTime = 0
			} catch (e) {
				console.warn('Failed to stop audio:', e)
			}
		}
	}
}

export const audioService = new AudioService()
