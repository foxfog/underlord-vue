<template>
	<div class="map-background" :style="{ '--map-aspect-ratio': '2528 / 1686' }">
		<img src="/images/sprites/maps/carne.jpg" class="map-bg-image" alt="Карта деревни Карн" />
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

const emit = defineEmits(['goto', 'switch-level', 'view-local'])

const locations = ref([
	{
		id: 'carne_village_entrance',
		name: 'Вход в деревню',
		x: 50,
		y: 86,
		class: 'map-place-entrance',
		target: 'carne_village_entrance'
	},
	{
		id: 'carne_square',
		name: 'Центральная площадь',
		x: 50,
		y: 55,
		class: 'map-place-square',
		target: 'carne_village_square'
	},
	{
		id: 'carne_chief_house',
		name: 'Дом старосты',
		x: 62,
		y: 50,
		class: 'map-place-house',
		target: 'carne_chief_house'
	},
	{
		id: 'carne_chief_garden',
		name: 'Огород старосты',
		x: 68,
		y: 42,
		class: 'map-place-garden',
		target: 'carne_chief_garden_iso'
	},
	{
		id: 'carne_emmot_house',
		name: 'Дом семьи Эммот',
		x: 40,
		y: 50,
		class: 'map-place-house',
		target: 'carne_emmot_house'
	},
	{
		id: 'carne_fields',
		name: 'Северные поля',
		x: 28,
		y: 22,
		class: 'map-place-fields'
	},
	{
		id: 'carne_forest_edge',
		name: 'Опушка леса Тоб',
		x: 82,
		y: 32,
		class: 'map-place-forest'
	}
])

function isLocationDiscovered(location) {
	const list = props.globalData?.discoveredLocations?.carne
	if (Array.isArray(list)) {
		return list.includes(location.id)
	}
	return location.id === 'carne_village_entrance'
}

const discoveredLocations = computed(() => {
	return locations.value.filter(isLocationDiscovered)
})

const locationsWithActive = computed(() => {
	return discoveredLocations.value.map((location) => {
		const isCurrent =
			location.id === props.currentLocation ||
			(props.currentLocation === 'carne_village' && location.id === 'carne_village_entrance')
		return {
			...location,
			active: isCurrent
		}
	})
})

function onPlaceClick(place) {
	if (place.active) return

	// Overrides from story or state if available
	const overrides = props.globalData?.mapOverrides?.carne
	if (overrides && overrides[place.id]) {
		emit('goto', { target: overrides[place.id], locationId: place.id })
		return
	}

	if (place.target) {
		emit('goto', { target: place.target, locationId: place.id })
	}
}
</script>
