<template>
	<div class="map-background">
		<img src="/images/sprites/maps/city.webp" class="map-bg-image" />
	</div>
	<div class="map-overlay">
		<div 
			v-for="place in locationsWithActive"
			:key="place.id"
			class="map-place"
			@click="onPlaceClick(place)"
			:class="[place.class, { '_active': place.active }]"
			:style="{ left: place.x + '%', top: place.y + '%' }"
		>
			<div class="map-place-image"></div>
			<div class="map-marker">
				<div class="map-marker__icon"></div>
				<div class="map-marker__label">{{ place.name }}</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed } from 'vue'

	const props = defineProps({
		currentLocation: {
			type: String,
			default: 'factory'
		},
		globalData: {
			type: Object,
			default: () => ({})
		}
	})

const emit = defineEmits(['goto'])

	const locations = ref([
		{
			id: 'factory',
			name: 'Завод',
			x: 47,
			y: 30,
			class: 'map-place-factory'
		},
		{
			id: 'home',
			name: 'Дом',
			x: 85,
			y: 73,
			class: 'map-place-mchome'
		}
	])

	// Вычисляем активную точку на основе переменной
	const locationsWithActive = computed(() => {
		return locations.value.map(location => ({
			...location,
			active: location.id === props.currentLocation
		}))
	})

function getPlaceTarget(place) {
	if (place.id === 'home' && props.globalData?.nowevent === 'mcoutfactory') {
		return 'cyber/mchome'
	}
	return null
}

function onPlaceClick(place) {
	const target = getPlaceTarget(place)
	if (!target) return
	emit('goto', target)
}
</script>
