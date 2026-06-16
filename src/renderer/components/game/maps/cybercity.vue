<template>
	<div class="map-background">
		<img src="/images/sprites/maps/city.webp" class="map-bg-image" />
	</div>
	<div class="map-overlay">
		<div 
			v-for="place in locations"
			:key="place.id"
			class="map-place"
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
import { ref } from 'vue'

const locations = ref([
	{
		id: 'factory',
		name: 'Завод',
		x: 50,
		y: 50,
		class: 'map-place-factory',
		active: true
	},
	{
		id: 'home',
		name: 'Дом',
		x: 10,
		y: 50,
		class: 'map-place-mchome',
		active: false
	}
])
</script>
