<template>
	<div 
		:class="`char-part _${spriteName}`"
		:style="styleWithHeight"
	>
		<div :class="`char-part-sprite _${spriteName}`">
			<img 
				:src="sprite.image" 
				:alt="`${spriteName} sprite`" 
				:class="`sprite-image _${spriteName}`"
				@load="onImageLoad"
			/>
		</div>
		
		<!-- Оборудование для этого спрайта -->
		<template v-for="(equip, slotName) in equipmentBySlot" :key="`equip-${slotName}`">
			<template v-for="(part, partIndex) in equip.parts" :key="`equip-part-${partIndex}`">
				<EquipPart 
					v-if="part.parent === spriteName"
					:part="part"
					:part-name="`${equip.id}-${partIndex}`"
					:character-id="characterId"
				/>
			</template>
		</template>
		
		<!-- Рекурсивно отрисовываем дочерние части тела -->
		<template v-for="(childSprite, childName) in spritesByParent[spriteName]" :key="childName">
			<SpritePart 
				:sprite="childSprite" 
				:sprite-name="childName"
				:character-id="characterId"
				:sprites="sprites"
				:sprites-by-parent="spritesByParent"
				:equipment-by-slot="equipmentBySlot"
			/>
		</template>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import EquipPart from './EquipPart.vue'

const props = defineProps({
	sprite: {
		type: Object,
		required: true
	},
	spriteName: {
		type: String,
		required: true
	},
	characterId: {
		type: String,
		required: true
	},
	sprites: {
		type: Object,
		required: true
	},
	spritesByParent: {
		type: Object,
		required: true
	},
	equipmentBySlot: {
		type: Object,
		default: () => ({})
	}
})

const spriteHeight = ref('0')

// Вычисляем стиль с смещениями из offset
const offsetStyle = computed(() => {
	if (!props.sprite.offset) {
		return {}
	}

	const style = {}
	if (props.sprite.offset.x !== undefined) {
		style.left = `${props.sprite.offset.x}%`
	}
	if (props.sprite.offset.y !== undefined) {
		style.top = `${props.sprite.offset.y}%`
	}
	return style
})

// Вычисляем стиль с высотой спрайта
// Для _body используем --charbodyspriteH, для остальных --charspriteH
const styleWithHeight = computed(() => {
	const heightVarName = props.spriteName === 'body' ? '--charbodyspriteH' : '--charspriteH'
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
