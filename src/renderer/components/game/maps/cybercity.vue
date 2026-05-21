<template>
	<div class="map-background">
		<img src="/images/sprites/maps/city.webp" class="map-bg-image" />
	</div>
	<div class="map-overlay">
		<div class="map-place map-place-factory _active">
			<div class="map-place-image"></div>
			<div class="map-marker">
				<div class="map-marker__icon"></div>
				<div class="map-marker__label">Завод</div>
			</div>
		</div>
		<div class="map-place map-place-mchome">
			<div class="map-place-image"></div>
			<div class="map-marker">
				<div class="map-marker__icon"></div>
				<div class="map-marker__label">Дом</div>
			</div>
		</div>
	</div>
</template>

<script setup>
</script>

<style scoped>
	.map-place-factory {
		left: 50%;
		top: 50%;
	}
	.map-place-mchome {
		left: 10%;
		top: 50%;
	}
</style>
