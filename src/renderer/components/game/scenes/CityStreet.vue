<template>
	<div class="scene-city-street">
		<!-- Фоновое изображение -->
		<img v-if="bgImage" :src="bgImage" alt="City Street" class="scene-bg" />
		
		<!-- Интерактивные объекты могут быть добавлены здесь -->
		<div class="scene-interactive-elements">
			<slot name="interactive"></slot>
		</div>
		
		<!-- Модификаторы -->
		<div v-if="hasMod('fog')" class="scene-modifier scene-modifier-fog">
			<img 
				:src="fogImagePath" 
				alt="Fog" 
				class="fog-layer fog-layer-1"
			/>
			<img 
				:src="fogImagePath" 
				alt="Fog" 
				class="fog-layer fog-layer-2"
			/>
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

const basePath = computed(() => {
	return typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
})

const bgImage = computed(() => {
	return props.scene?.bg ? `${basePath.value}${props.scene.bg}` : null
})

const fogImagePath = computed(() => {
	return `${basePath.value}images/sprites/backgrounds/fog.webp`
})

const hasMod = (modName) => {
	return props.scene?.mods && Array.isArray(props.scene.mods) && props.scene.mods.includes(modName)
}
</script>

<style scoped>
.scene-city-street {
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

.scene-modifier {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 2;
	pointer-events: none;
}

.scene-modifier-fog {
	overflow: hidden;
	/* soften edges so texture seam doesn't appear */
	-webkit-mask-image: radial-gradient(circle at center, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 100%);
	mask-image: radial-gradient(circle at center, rgba(0,0,0,1) 62%, rgba(0,0,0,0) 100%);
	-webkit-mask-size: 100% 100%;
	mask-size: 100% 100%;
}

.fog-layer {
	position: absolute;
	width: 170%;
	height: 170%;
	top: -35%;
	left: -35%;
	object-fit: cover;
	opacity: 0.55;
	filter: blur(8px);
	transform: translate3d(0, 0, 0) scale(1.1);
	will-change: transform, opacity;
	animation-timing-function: ease-in-out;
	animation-iteration-count: infinite;
}

.fog-layer-1 {
	animation: fog-drift-1 26s infinite;
}

.fog-layer-2 {
	animation: fog-drift-2 34s infinite;
	animation-delay: -11s;
	opacity: 0.38;
}

@keyframes fog-drift-1 {
	0% {
		transform: translate3d(0, 0, 0) scale(1.1) rotate(0deg);
		opacity: 0.48;
	}
	20% {
		transform: translate3d(3%, 1.5%, 0) scale(1.14) rotate(0.4deg);
		opacity: 0.56;
	}
	45% {
		transform: translate3d(6%, 2.5%, 0) scale(1.18) rotate(0.8deg);
		opacity: 0.62;
	}
	70% {
		transform: translate3d(2.5%, 1.2%, 0) scale(1.15) rotate(0.3deg);
		opacity: 0.54;
	}
	100% {
		transform: translate3d(0, 0, 0) scale(1.1) rotate(0deg);
		opacity: 0.48;
	}
}

@keyframes fog-drift-2 {
	0% {
		transform: translate3d(0, 0, 0) scale(1.2) rotate(0deg);
		opacity: 0.30;
	}
	18% {
		transform: translate3d(-2.5%, -1.5%, 0) scale(1.16) rotate(-0.4deg);
		opacity: 0.36;
	}
	52% {
		transform: translate3d(-5.5%, -3.2%, 0) scale(1.12) rotate(-0.9deg);
		opacity: 0.42;
	}
	78% {
		transform: translate3d(-3%, -1.8%, 0) scale(1.16) rotate(-0.3deg);
		opacity: 0.34;
	}
	100% {
		transform: translate3d(0, 0, 0) scale(1.2) rotate(0deg);
		opacity: 0.30;
	}
}
</style>
