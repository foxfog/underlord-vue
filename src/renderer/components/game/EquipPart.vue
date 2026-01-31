<template>
	<div 
		:class="`equip-part _${partName}`"
		:style="styleWithHeight"
	>
		<div :class="`equip-part-sprite _${partName}`">
			<img 
				:src="part.image" 
				:alt="`${partName} equipment sprite`" 
				:class="`sprite-image _${partName}`"
				@load="onImageLoad"
			/>
		</div>
	</div>
</template>

<script setup>
import { defineProps, computed, ref } from 'vue'

const props = defineProps({
	part: {
		type: Object,
		required: true
	},
	partName: {
		type: String,
		required: true
	},
	characterId: {
		type: String,
		required: true
	}
})

const spriteHeight = ref('0')

// Вычисляем стиль со смещениями из offset (если есть)
const offsetStyle = computed(() => {
	if (!props.part.offset) {
		return {}
	}

	const style = {}
	if (props.part.offset.x !== undefined) {
		style.left = `${props.part.offset.x}%`
	}
	if (props.part.offset.y !== undefined) {
		style.top = `${props.part.offset.y}%`
	}
	return style
})

// Вычисляем стиль с высотой спрайта
// Для _body используем --charbodyspriteH, для остальных --charspriteH
const styleWithHeight = computed(() => {
	const heightVarName = props.partName === 'body' ? '--charbodyspriteH' : '--charspriteH'
	return {
		...offsetStyle.value,
		[heightVarName]: spriteHeight.value
	}
})

// Обработчик загрузки изображения для получения его высоты
const onImageLoad = (event) => {
	spriteHeight.value = `${event.target.naturalHeight}`
}
</script>

<style>
.equip-part {
	width: 100%;
	height: 100%;
	transform-origin: center center;
	margin: auto;
	position: absolute;
	top: 0;
	bottom: 0;
	right: 0;
	left: 0;
	.equip-part-sprite {
		position: absolute;
		width: 100%;
		height: 100%;
		
		.sprite-image {
			height: 100%;
			width: 100%;
			position: absolute;
			object-fit: contain;
		}
	}
}
</style>
