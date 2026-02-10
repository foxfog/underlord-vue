<template>
	<div
	:key="character.id"
	class="char"
	:class="[
		`char-${character.id}`,
		`orientation-${character.orientation || 'right'}`,
		{ 'char-back': character.back }
	]"
	:style="characterStyle"
	>
	<div class="char-body" ref="charBodyRef">
		<!-- Base body sprites -->
		<template v-for="(sprite, spriteName) in spritesByParent[null]" :key="spriteName">
			<SpritePart 
				:sprite="sprite" 
				:sprite-name="spriteName"
				:character-id="character.id"
				:sprites="character.sprites"
				:sprites-by-parent="spritesByParent"
				:equipment-by-slot="character.equipmentBySlot"
			/>
		</template>
	</div>
	</div>
</template>


<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import SpritePart from './SpritePart.vue'

const props = defineProps({
	character: {
		type: Object,
		required: true
	}
})

const charBodyRef = ref(null)
const isAnimating = ref(false)

// Compute positioning style from character.position object
const characterStyle = computed(() => {
	const style = {
		scale: props.character.scale || props.character.size || 1.3
	}
	
	// Determine which position to use
	// If we have fromPosition and NOT animating yet, use fromPosition
	// If we have fromPosition and animating, use position (final) with transition
	let positionToUse
	if (props.character.fromPosition && !isAnimating.value) {
		positionToUse = props.character.fromPosition
	} else {
		positionToUse = props.character.position
	}
	
	// Add transition only when animating
	if (isAnimating.value && props.character.animationDuration) {
		// animationDuration is in milliseconds, convert to seconds for CSS
		const durationInSeconds = props.character.animationDuration / 1000
		style.transition = `all ${durationInSeconds}s ease-in-out`
	}
	
	// Map position aliases to CSS properties
	if (positionToUse) {
		const posMap = {
			l: 'left',
			r: 'right',
			t: 'top',
			b: 'bottom'
		}
		
		for (const [alias, cssProp] of Object.entries(posMap)) {
			if (positionToUse[alias] !== undefined) {
				const value = positionToUse[alias]
				// Add % if value is a number
				style[cssProp] = typeof value === 'number' ? `${value}%` : value
			}
		}
	}
	
	return style
})

// Watch for animation trigger
watch(() => props.character.fromPosition, (newFromPosition) => {
	if (newFromPosition) {
		console.log(`🎬 [${props.character.id}] Frame 1: Show at fromPosition=${JSON.stringify(newFromPosition)}`)
		// Start with fromPosition (isAnimating = false)
		isAnimating.value = false
		
		// Next tick, apply animation to position
		nextTick(() => {
			const durationInSeconds = props.character.animationDuration ? (props.character.animationDuration / 1000) : 'unknown'
			console.log(`🎬 [${props.character.id}] Frame 2: Animate to position=${JSON.stringify(props.character.position)} (transition: ${durationInSeconds}s)`)
			isAnimating.value = true
		})
	}
}, { immediate: true })

onMounted(() => {
	if (!charBodyRef.value) return

	const updateCharHeight = () => {
		const height = charBodyRef.value.offsetHeight
		charBodyRef.value.parentElement.style.setProperty('--char-height', `${height}px`)
	}

	// Первый вызов
	updateCharHeight()

	// ResizeObserver для отслеживания изменений размера
	const resizeObserver = new ResizeObserver(() => {
		updateCharHeight()
	})

	resizeObserver.observe(charBodyRef.value)

	onUnmounted(() => {
		resizeObserver.disconnect()
	})
})


// Группируем части тела по их родителю для быстрого доступа
const spritesByParent = computed(() => {
	const grouped = { null: {} }
	
	if (!props.character.sprites) {
		return grouped
	}
	
	// Инициализируем группы для каждого parent
	for (const spriteName in props.character.sprites) {
		const sprite = props.character.sprites[spriteName]
		const parent = sprite.parent || null
		
		if (!grouped[parent]) {
			grouped[parent] = {}
		}
	}
	
	// Распределяем спрайты по группам parent
	for (const spriteName in props.character.sprites) {
		const sprite = props.character.sprites[spriteName]
		const parent = sprite.parent || null
		grouped[parent][spriteName] = sprite
	}
	
	return grouped
})
</script>
