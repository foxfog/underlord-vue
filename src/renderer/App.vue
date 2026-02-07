<template>
	<router-view />
	<BgMusic />
</template>

<script setup>
	import { watchEffect } from 'vue'
	import { useSettingsStore } from '@/stores/settings'
	import BgMusic from '@/components/sounds/BgMusic.vue'

	const store = useSettingsStore()

	watchEffect(() => {
		const [w, h] = String(store.video.resolution || '1800x600').split('x')
		document.documentElement.style.setProperty('--layout-width', w || '800')
		document.documentElement.style.setProperty('--layout-height', h || '600')
	})
</script>