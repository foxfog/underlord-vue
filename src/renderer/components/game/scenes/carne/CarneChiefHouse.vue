<template>
	<div class="scene-carne-chief-house">
		<img v-if="bgImage" :src="bgImage" alt="Дом старосты деревни Карн" class="scene-bg" />
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	scene: {
		type: Object,
		required: true
	},
	globalData: {
		type: Object,
		default: () => ({})
	},
	isInDialogueMode: {
		type: Boolean,
		default: false
	}
})

defineEmits(['goto'])

const basePath = computed(() => {
	return typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
})

const bgImage = computed(() => {
	return props.scene?.bg
		? `${basePath.value}${props.scene.bg}`
		: `${basePath.value}images/sprites/backgrounds/carne/elder_home_int.webp`
})
</script>

<style scoped>
.scene-carne-chief-house {
	position: absolute;
	inset: 0;
	overflow: hidden;
	user-select: none;
	font-size: 1em;
}

.scene-bg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
	z-index: 0;
}
</style>
