<template>
	<div class="scene-mc-apartment">
		<!-- Фоновое изображение квартиры -->
		<img v-if="bgImage" :src="bgImage" alt="MC Apartment" class="scene-bg" />

		<!-- Интерактивные элементы комнаты -->
		<div class="scene-interactive-elements">
			<!-- Примеры интерактивных объектов -->
			<div class="apartment-item apartment-bed" @click="onInteract('bed')">
				<div class="item-indicator">Кровать</div>
			</div>

			<div class="apartment-item apartment-window" @click="onInteract('window')">
				<div class="item-indicator">Окно</div>
			</div>

			<div class="apartment-item apartment-terminal" @click="onInteract('terminal')">
				<div class="item-indicator">Компьютер</div>
			</div>

			<slot name="interactive"></slot>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	scene: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['interact'])

const basePath = computed(() => {
	return typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
})

const bgImage = computed(() => {
	return props.scene?.bg
		? `${basePath.value}${props.scene.bg}`
		: `${basePath.value}images/sprites/backgrounds/apartment.webp`
})

const onInteract = (itemName) => {
	emit('interact', { item: itemName })
}
</script>

<style scoped>
.scene-mc-apartment {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

.scene-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
	z-index: 0;
}

.scene-interactive-elements {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	pointer-events: auto;
}

.apartment-item {
	position: absolute;
	cursor: pointer;
	transition: all 0.3s ease;
	opacity: 0;
	pointer-events: auto;
}

.apartment-item:hover .item-indicator {
	opacity: 1;
	transform: scale(1.1);
}

.item-indicator {
	position: absolute;
	background: rgba(0, 0, 0, 0.7);
	color: #fff;
	padding: 0.25em 0.5em;
	border-radius: 0.25em;
	font-size: 0.75em;
	white-space: nowrap;
	opacity: 0;
	transition: opacity 0.3s ease;
	pointer-events: none;
	z-index: 10;
}

/* Позиционирование интерактивных элементов */
.apartment-bed {
	left: 10%;
	top: 40%;
	width: 25%;
	height: 30%;
}

.apartment-bed .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.apartment-window {
	right: 5%;
	top: 10%;
	width: 20%;
	height: 35%;
}

.apartment-window .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.apartment-terminal {
	right: 8%;
	bottom: 15%;
	width: 18%;
	height: 20%;
}

.apartment-terminal .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}
</style>
