<template>
	<div
		:key="character.id"
		class="char"
		:class="[
			`char-${character.id}`,
			`orientation-${character.orientation || 'right'}`,
			{ 'char-back': character.back, 'is-interactive': Boolean(character.interaction) },
			character.customClass
		]"
		:style="characterStyle"
		@click="onCharacterClick"
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
					:part-animations="character.partAnimations || {}"
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

const emit = defineEmits(['character-click'])

function onCharacterClick(event) {
	if (props.character.interaction) {
		emit('character-click', { character: props.character, interaction: props.character.interaction, event })
	}
}

const charBodyRef = ref(null)
const isAnimating = ref(false)
let animationTimeout = null

// Compute positioning style from character.position object
const characterStyle = computed(() => {
	const style = {
		scale: props.character.scale ?? props.character.size ?? 1
	}

	// Apply root avatar offset if defined (e.g. from values.json root_offset)
	if (props.character.root_offset) {
		const ro = props.character.root_offset
		if (ro.x || ro.y) {
			style.translate = `${ro.x || 0}% ${-(ro.y || 0)}%`
		}
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
			left: 'left',
			r: 'right',
			right: 'right',
			t: 'top',
			top: 'top',
			b: 'bottom',
			bottom: 'bottom'
		}

		for (const [alias, cssProp] of Object.entries(posMap)) {
			if (positionToUse[alias] !== undefined) {
				const value = positionToUse[alias]
				// Add % if value is a number
				style[cssProp] = typeof value === 'number' ? `${value}%` : value
			}
		}

		// Ensure right-anchored elements override default CSS left: 0%
		if (style.right !== undefined && style.left === undefined) {
			style.left = 'auto'
		}
		// Ensure left-anchored elements override default CSS right: 0%
		if (style.left !== undefined && style.right === undefined) {
			style.right = 'auto'
		}
	}

	return style
})

// Watch for animation trigger
watch(
	() => props.character.fromPosition,
	(newFromPosition) => {
		if (newFromPosition) {
			console.log(
				`🎬 [${props.character.id}] Frame 1: Show at fromPosition=${JSON.stringify(newFromPosition)}`
			)
			// Start with fromPosition (isAnimating = false)
			isAnimating.value = false

			// Clear any existing animation timeout to prevent race conditions
			if (animationTimeout) {
				clearTimeout(animationTimeout)
				animationTimeout = null
			}

			// Next tick, apply animation to position
			nextTick(() => {
				const durationInSeconds = props.character.animationDuration
					? props.character.animationDuration / 1000
					: 'unknown'
				console.log(
					`🎬 [${props.character.id}] Frame 2: Animate to position=${JSON.stringify(props.character.position)} (transition: ${durationInSeconds}s)`
				)
				isAnimating.value = true

				// After animation duration, remove transition CSS to prevent unwanted transitions
				if (props.character.animationDuration) {
					animationTimeout = setTimeout(() => {
						console.log(
							`🎬 [${props.character.id}] Animation complete - removing transition`
						)
						isAnimating.value = false
						animationTimeout = null
					}, props.character.animationDuration)
				}
			})
		}
	},
	{ immediate: true }
)

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
		// Очищаем animation timeout при размонтировании
		if (animationTimeout) {
			clearTimeout(animationTimeout)
			animationTimeout = null
		}
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
