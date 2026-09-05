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
			:class="[place.class, { _active: place.active, _disabled: place.active }]"
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
		default: ''
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

function isLocationDiscovered(location) {
	const list = props.globalData?.discoveredLocations?.cybercity
	if (Array.isArray(list)) {
		return list.includes(location.id)
	}
	return true
}

const discoveredLocations = computed(() => {
	return locations.value.filter(isLocationDiscovered)
})

// Вычисляем активную точку на основе переменной
const locationsWithActive = computed(() => {
	return discoveredLocations.value.map((location) => ({
		...location,
		active: location.id === props.currentLocation
	}))
})

function getPlaceTarget(place) {
	// First check if there is a data-driven override for this map and place
	const overrides = props.globalData?.mapOverrides?.cybercity
	if (overrides && overrides[place.id]) {
		return overrides[place.id]
	}

	if (place.id === 'factory') {
		return 'cyber/factory/factory_main'
	}
	if (place.id === 'home') {
		return 'cyber/mchome'
	}
	return null
}

function onPlaceClick(place) {
	if (place.id === props.currentLocation) {
		return
	}

	const target = getPlaceTarget(place)
	if (!target) return
	emit('goto', { target, locationId: place.id })
}
</script>
