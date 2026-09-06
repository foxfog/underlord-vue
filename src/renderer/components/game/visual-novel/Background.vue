<template>
	<div class="background-scene-wrapper">
		<!-- Компонентная сцена (если есть компонент для этой сцены) -->
		<component
			v-if="scene && sceneComponent"
			:is="sceneComponent"
			:scene="scene"
			:global-data="globalData"
			:is-in-dialogue-mode="isInDialogueMode"
			@goto="$emit('goto', $event)"
			@hotspot-click="$emit('hotspot-click', $event)"
		/>

		<!-- Фоновое изображение (fallback) -->
		<img
			v-else-if="scene && scene.bg"
			:src="bgImagePath"
			alt="Background"
			class="background-img"
		/>

		<!-- Универсальные интерактивные хотспоты сцены (из scenes.json) -->
		<SceneHotspots
			v-if="scene && scene.hotspots && scene.hotspots.length > 0"
			:scene="scene"
			:global-data="globalData"
			:is-in-dialogue-mode="isInDialogueMode"
			@goto="$emit('goto', $event)"
			@hotspot-click="$emit('hotspot-click', $event)"
		/>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import CityStreet from '../scenes/CityStreet.vue'
import McApartment from '../scenes/cyber/McApartment.vue'
import McFactory from '../scenes/cyber/McFactory.vue'
import CarneVillageEntrance from '../scenes/carne/CarneVillageEntrance.vue'
import CarneVillageSquare from '../scenes/carne/CarneVillageSquare.vue'
import SceneHotspots from '../scenes/SceneHotspots.vue'

const props = defineProps({
	scene: { type: Object, default: null },
	globalData: { type: Object, default: () => ({}) },
	isInDialogueMode: { type: Boolean, default: false }
})

defineEmits(['goto', 'hotspot-click'])

// Маппинг ID сцен на компоненты
const sceneComponents = {
	city_street: CityStreet,
	mc_apartment: McApartment,
	mc_factory: McFactory,
	carne_village_entrance: CarneVillageEntrance,
	carne_village_square: CarneVillageSquare
	// Здесь можно добавить другие компонентные сцены
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

<style scoped>
.background-scene-wrapper {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}
</style>
