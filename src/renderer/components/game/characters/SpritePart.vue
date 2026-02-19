<template>
	<div 
		:class="partClasses"
		:style="computedStyle"
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
					:zindex="equip.item.zindex"
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
				:part-animations="partAnimations"
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
		},
		partAnimations: {
			type: Object,
			default: () => ({})
		}
	})

	const spriteHeight = ref('0')

	// Вычисляем стиль с смещениями из offset
	const offsetStyle = computed(() => {
		const style = {}
		
		// Смещения
		if (props.sprite.offset) {
			if (props.sprite.offset.x !== undefined) {
				style.left = `${props.sprite.offset.x}%`
			}
			if (props.sprite.offset.y !== undefined) {
				style.top = `${props.sprite.offset.y}%`
			}
		}
		
		// Z-index (может быть zindex или z-index в JSON)
		if (props.sprite.zindex !== undefined) {
			style.zIndex = props.sprite.zindex
		} else if (props.sprite['z-index'] !== undefined) {
			style.zIndex = props.sprite['z-index']
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

	// Получаем анимацию для этой части тела
	const partAnimation = computed(() => {
		return props.partAnimations[props.spriteName] || null
	})

	// Вычисляем финальный стиль с учетом анимаций
	const computedStyle = computed(() => {
		const style = { ...styleWithHeight.value }

		if (partAnimation.value) {
			const anim = partAnimation.value

			// Применяем прямые стили
			if (anim.styles) {
				Object.assign(style, anim.styles)
			}

			// Применяем класс и устанавливаем длительность анимации как CSS переменную
			if (anim.animationDuration) {
				const durationInSeconds = anim.animationDuration / 1000
				style['--animation-duration'] = `${durationInSeconds}s`
			}
		}

		return style
	})

	// Вычисляем классы
	const partClasses = computed(() => {
		const classes = [`char-part _${props.spriteName}`]
		if (partAnimation.value?.class) {
			classes.push(partAnimation.value.class)
		}
		return classes
	})

	// Обработчик загрузки изображения для получения его высоты
	const onImageLoad = (event) => {
		spriteHeight.value = `${event.target.naturalHeight}`
	}
</script>
