<template>
	<router-view />
	<BgMusic />
	<PerformanceOverlay v-if="store.video.showFpsOverlay" />
</template>

<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import BgMusic from '@/components/sounds/BgMusic.vue'
import PerformanceOverlay from '@/components/UI/PerformanceOverlay.vue'

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

function onKeyDown(e) {
	if (e.code === 'F3') {
		e.preventDefault()
		store.toggleFpsOverlay()
	}
}

onMounted(() => {
	window.addEventListener('resize', handleResize, { passive: true })
	window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
	window.removeEventListener('resize', handleResize)
	window.removeEventListener('keydown', onKeyDown)
	if (resizeTimer) clearTimeout(resizeTimer)
})
</script>
