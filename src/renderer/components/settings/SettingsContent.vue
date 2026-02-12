<template>
	<div class="settings-content">
		<div class="ui-tabs">
			<div class="ui-tabs-header">
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'audio' }" 
					@click="activeSection = 'audio'"
				>
					{{ $t('settings.audio') }}
				</button>
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'general' }" 
					@click="activeSection = 'general'"
				>
					{{ $t('settings.generals') }}
				</button>
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeSection === 'video' }" 
					@click="activeSection = 'video'"
				>
					{{ $t('settings.video') }}
				</button>
			</div>
			<div class="ui-tabs-content">
				<div class="ui-tab" :class="{ '__active': activeSection === 'audio' }">
					<SettingsAudio />
				</div>
				<div class="ui-tab" :class="{ '__active': activeSection === 'general' }">
					<SettingsGeneral />
				</div>
				<div class="ui-tab" :class="{ '__active': activeSection === 'video' }">
					<SettingsVideo />
				</div>
			</div>
		</div>
		<div class="buttons buttons-list">
			<button
				v-if="!isAtDefault"
				class="btn btn-primary"
				@click="resetToDefault"
			>
				{{ $t('settings.resetToDefoult') }}
			</button>
			<button
				v-if="hasUnsavedChanges"
				class="btn btn-primary"
				@click="saveSettings"
			>
				{{ $t('settings.save') }}
			</button>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, watch, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
	import SettingsAudio from './SettingsAudio.vue'
	import SettingsGeneral from './SettingsGeneral.vue'
	import SettingsVideo from './SettingsVideo.vue'
	import { useSettingsStore } from '@/stores/settings'

	const store = useSettingsStore()
	const activeSection = ref('audio')
	const emit = defineEmits(['saved', 'reset', 'dirty-change'])

	const initialSettings = ref(null)
	const defaultSettings = ref(null)

	const currentSettingsSlice = computed(() => ({
		audio: { ...store.audio },
		general: { ...store.general },
		video: { ...store.video }
	}))

	const hasUnsavedChanges = computed(() => {
		if (!initialSettings.value) return false
		return JSON.stringify(currentSettingsSlice.value) !== JSON.stringify(initialSettings.value)
	})

	const isAtDefault = computed(() => {
		if (!defaultSettings.value) return false
		return JSON.stringify(currentSettingsSlice.value) === JSON.stringify(defaultSettings.value)
	})

	// Notify parent about dirty state
	watch(hasUnsavedChanges, (val) => {
		emit('dirty-change', val)
	}, { immediate: true })

	async function saveSettings() {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			...currentSettingsSlice.value
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		// после успешного сохранения текущие настройки становятся исходными
		initialSettings.value = JSON.parse(JSON.stringify(currentSettingsSlice.value))
		emit('saved')
	}

	async function resetToDefault() {
		const def = await window.electronAPI.getSettings('default')
		store.audio = { ...def.audio }
		store.general = { ...def.general }
		store.video = { ...def.video }

		// сохраняем дефолтные значения как текущие и как исходные
		defaultSettings.value = {
			audio: { ...def.audio },
			general: { ...def.general },
			video: { ...def.video }
		}
		initialSettings.value = JSON.parse(JSON.stringify(defaultSettings.value))

		await saveSettings()
		emit('reset')
	}

	// Allow parent components to control settings actions
	defineExpose({
		saveSettings,
		resetToDefault,
		revertToInitial: () => {
			if (!initialSettings.value) return
			const snap = initialSettings.value
			store.audio = { ...snap.audio }
			store.general = { ...snap.general }
			store.video = { ...snap.video }
		}
	})

	onMounted(() => {
		console.log('SettingsContent mounted')
		activeSection.value = 'audio'

		// загружаем текущие и дефолтные настройки для сравнения
		;(async () => {
			try {
				const current = await window.electronAPI.getSettings()
				initialSettings.value = {
					audio: { ...(current.audio || {}) },
					general: { ...(current.general || {}) },
					video: { ...(current.video || {}) }
				}

				const def = await window.electronAPI.getSettings('default')
				defaultSettings.value = {
					audio: { ...(def.audio || {}) },
					general: { ...(def.general || {}) },
					video: { ...(def.video || {}) }
				}
			} catch (e) {
				console.error('Failed to load settings snapshots for comparison', e)
			}
		})()
	})

	onBeforeUnmount(() => {
		console.log('SettingsContent before unmount - resetting tab')
		// Reset to first tab when unmounting
		activeSection.value = 'audio'
	})

	onUnmounted(() => {
		console.log('SettingsContent unmounted - cleaning up')
	})
</script>
