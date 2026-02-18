<template>
	<!-- Компонентная сцена (если есть компонент для этой сцены) -->
	<component 
		v-if="scene && sceneComponent" 
		:is="sceneComponent" 
		:scene="scene"
	/>
	
	<!-- Простое фоновое изображение (fallback) -->
	<img 
		v-else-if="scene && scene.bg" 
		:src="bgImagePath" 
		alt="Background" 
		class="background-img" 
	/>
</template>

<script setup>
import { computed } from 'vue'
import CityStreet from '../scenes/CityStreet.vue'

const props = defineProps({ scene: { type: Object, default: null } })

// Маппинг ID сцен на компоненты
const sceneComponents = {
	city_street: CityStreet
	// Здесь можно добавить другие компонентные сцены
	// mc_apartment: McApartment,
	// и т.д.
}

const sceneComponent = computed(() => {
	if (!props.scene || !props.scene.id) return null
	return sceneComponents[props.scene.id] || null
})

const bgImagePath = computed(() => {
	if (!props.scene?.bg) return null
	const basePath = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
	return `${basePath}${props.scene.bg}`
})
</script>
