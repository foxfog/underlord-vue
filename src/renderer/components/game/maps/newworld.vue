<template>
	<div class="map-background" :style="{ '--map-aspect-ratio': '2480 / 1754' }">
		<img src="/images/sprites/maps/newworld.png" class="map-bg-image" alt="Карта Нового Мира" />
	</div>
	<div class="map-overlay">
		<div
			v-for="place in locationsWithActive"
			:key="place.id"
			class="map-place"
			@click="onPlaceClick(place)"
			:class="[place.class, { _active: place.active }]"
			:style="{ left: place.x + '%', top: place.y + '%' }"
			:title="place.hasLocalMap ? `${place.name} (Кликните для просмотра локальной карты)` : place.name"
		>
			<div class="map-place-image"></div>
			<div class="map-marker">
				<div class="map-marker__icon"></div>
				<div class="map-marker__label">
					{{ place.name }}
					<span v-if="place.hasLocalMap" class="map-marker__sublabel">📍</span>
				</div>
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
		id: 'carne_village',
		name: 'Деревня Карн',
		x: 43,
		y: 48,
		class: 'map-place-carne',
		hasLocalMap: true,
		localMapId: 'carne',
		target: 'new_world_carne'
	},
	{
		id: 'great_tomb_nazarick',
		name: 'Гробница Назарик',
		x: 39,
		y: 55,
		class: 'map-place-nazarick'
	},
	{
		id: 'e_rantel',
		name: 'Крепость Э-Рантэл',
		x: 47,
		y: 62,
		class: 'map-place-erantel'
	},
	{
		id: 'tob_forest',
		name: 'Великий Лес Тоб',
		x: 44,
		y: 38,
		class: 'map-place-forest'
	},
	{
		id: 're_estize_capital',
		name: 'Столица Рэ-Эстиз',
		x: 28,
		y: 50,
		class: 'map-place-capital'
	},
	{
		id: 'baharuth_empire',
		name: 'Империя Бахарут',
		x: 66,
		y: 46,
		class: 'map-place-empire'
	}
])

function isLocationDiscovered(location) {
	const list = props.globalData?.discoveredLocations?.newworld
	if (Array.isArray(list)) {
		return list.includes(location.id)
	}
	return location.id === 'carne_village'
}

const discoveredLocations = computed(() => {
	return locations.value.filter(isLocationDiscovered)
})

const locationsWithActive = computed(() => {
	const current = props.currentLocation || ''
	return discoveredLocations.value.map((location) => {
		const isCarneActive =
			location.id === 'carne_village' &&
			(current.startsWith('carne') || current === 'carne_village')
		const isCurrent = location.id === current || isCarneActive
		return {
			...location,
			active: isCurrent
		}
	})
})

function onPlaceClick(place) {
	if (place.hasLocalMap && place.localMapId) {
		emit('view-local', place.localMapId)
		return
	}

	const overrides = props.globalData?.mapOverrides?.newworld
	if (overrides && overrides[place.id]) {
		emit('goto', { target: overrides[place.id], locationId: place.id })
		return
	}

	if (place.target) {
		emit('goto', { target: place.target, locationId: place.id })
	}
}
</script>
