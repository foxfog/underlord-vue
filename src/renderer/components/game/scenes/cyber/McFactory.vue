<template>
	<div class="scene-mc-factory">
		<!-- Фоновое изображение завода -->
		<img v-if="bgImage" :src="bgImage" alt="MC Factory" class="scene-bg" />

		<!-- Интерактивные элементы цеха -->
		<div class="scene-interactive-elements">
			<!-- Рабочее место -->
			<div class="factory-item factory-workstation" @click="onInteract('workstation')">
				<div class="item-indicator">Рабочее место</div>
			</div>

			<!-- Столовая / Обеденная зона -->
			<div class="factory-item factory-cafeteria" @click="onInteract('cafeteria')">
				<div class="item-indicator">Столовая</div>
			</div>

			<!-- Система отдыха -->
			<div class="factory-item factory-breakroom" @click="onInteract('breakroom')">
				<div class="item-indicator">Комната отдыха</div>
			</div>

			<slot name="interactive"></slot>
		</div>

		<!-- Атмосферные эффекты завода -->
		<div class="factory-atmosphere">
			<div class="factory-smoke-layer"></div>
			<div class="factory-lighting-overlay"></div>
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
		: `${basePath.value}images/sprites/backgrounds/factory.webp`
})

const onInteract = (itemName) => {
	emit('interact', { item: itemName })
}
</script>

<style scoped>
.scene-mc-factory {
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
	z-index: 2;
	pointer-events: auto;
}

.factory-item {
	position: absolute;
	cursor: pointer;
	transition: all 0.3s ease;
	opacity: 0;
	pointer-events: auto;
}

.factory-item:hover .item-indicator {
	opacity: 1;
	transform: scale(1.1);
}

.item-indicator {
	position: absolute;
	background: rgba(0, 0, 0, 0.7);
	color: #fff;
	padding: 4px 8px;
	border-radius: 4px;
	font-size: 12px;
	white-space: nowrap;
	opacity: 0;
	transition: all 0.3s ease;
	pointer-events: none;
	z-index: 10;
}

/* Позиционирование интерактивных элементов */
.factory-workstation {
	left: 15%;
	top: 45%;
	width: 30%;
	height: 25%;
}

.factory-workstation .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.factory-cafeteria {
	right: 12%;
	top: 35%;
	width: 25%;
	height: 30%;
}

.factory-cafeteria .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.factory-breakroom {
	right: 10%;
	bottom: 10%;
	width: 20%;
	height: 20%;
}

.factory-breakroom .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

/* Атмосферные эффекты */
.factory-atmosphere {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	pointer-events: none;
}

.factory-smoke-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: radial-gradient(
		ellipse at center top,
		rgba(100, 100, 100, 0.1) 0%,
		transparent 70%
	);
	opacity: 0.6;
}

.factory-lighting-overlay {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: linear-gradient(
		180deg,
		rgba(200, 150, 100, 0.05) 0%,
		rgba(100, 100, 100, 0.1) 100%
	);
	opacity: 0.5;
}
</style>
