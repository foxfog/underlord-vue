<template>
	<router-view />
	<BgMusic />
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import BgMusic from '@/components/sounds/BgMusic.vue'

const store = useSettingsStore()

let resizeTimer = null

function handleResize() {
	document.documentElement.classList.add('is-resizing')
	if (resizeTimer) clearTimeout(resizeTimer)
	resizeTimer = setTimeout(() => {
		document.documentElement.classList.remove('is-resizing')
		resizeTimer = null
	}, 120)
}

watch(
	() => store.video.resolution,
	(newRes) => {
		document.documentElement.classList.add('is-resizing')
		const [w, h] = String(newRes || '1920x1080').split('x')
		document.documentElement.style.setProperty('--layout-width', w || '1920')
		document.documentElement.style.setProperty('--layout-height', h || '1080')
		// Принудительный reflow, чтобы размеры пересчитались мгновенно без транзишенов
		void document.documentElement.offsetHeight
		if (resizeTimer) clearTimeout(resizeTimer)
		resizeTimer = setTimeout(() => {
			document.documentElement.classList.remove('is-resizing')
			resizeTimer = null
		}, 120)
	},
	{ immediate: true }
)

watch(
	() => store.video.fullscreen,
	() => {
		handleResize()
	}
)

onMounted(() => {
	window.addEventListener('resize', handleResize, { passive: true })
})

onUnmounted(() => {
	window.removeEventListener('resize', handleResize)
	if (resizeTimer) clearTimeout(resizeTimer)
})
</script>
