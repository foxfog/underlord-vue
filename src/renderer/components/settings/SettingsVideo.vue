<template>
	<div class="settings-list">
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Режим экрана:</div>
			</div>
			<div class="right">
				<UiSelect
					v-model="fullscreenMode"
					:options="screenModeOptions"
					valueKey="value"
					labelKey="label"
					placeholder="Выберите режим..."
					@change="onFullscreenModeChange"
					class="settings-select"
				/>
			</div>
		</div>
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Разрешение:</div>
			</div>
			<div class="right">
				<UiSelect
					v-model="store.video.resolution"
					:options="resolutionOptions"
					valueKey="value"
					labelKey="label"
					placeholder="Выберите разрешение..."
					@change="onResolutionChange"
					class="settings-select"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'
	import { useSettingsStore } from '@/stores/settings'
	import UiSelect from '@/components/UI/UiSelect.vue'

	defineOptions({
		name: 'SettingsVideo'
	})

	const store = useSettingsStore()
	const availableResolutions = [
		'800x600',
		'1280x720',
		'1920x1080',
		'2560x1440'
	]

	// Screen mode options
	const screenModeOptions = [
		{ value: false, label: 'Оконный' },
		{ value: true, label: 'Полноэкранный' }
	]

	// Resolution options with descriptive labels
	const resolutionOptions = computed(() => {
		return availableResolutions.map(res => {
			const [width, height] = res.split('x')
			
			return {
				value: res,
				label: `${res}`
			}
		})
	})

	const fullscreenMode = computed({
		get: () => !!store.video.fullscreen,
		set: v => { store.video.fullscreen = v }
	})

	function onFullscreenModeChange() {
		window.electronAPI.setFullscreen(store.video.fullscreen)
		if (!store.video.fullscreen) {
			window.electronAPI.setResolution(store.video.resolution)
		}
	}

	function onResolutionChange() {
		store.setResolution(store.video.resolution)
		if (!store.video.fullscreen) {
			window.electronAPI.setResolution(store.video.resolution)
		}
	}
</script>
