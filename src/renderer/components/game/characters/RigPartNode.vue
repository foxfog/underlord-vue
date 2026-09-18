<template>
	<div
		:class="partClasses"
		:style="computedPartStyle"
		@click.stop="emit('select-part', spriteName)"
	>
		<div :class="`char-part-sprite _${spriteName} part-sprite-box`">
			<img
				:src="partImageUrl"
				:alt="`${spriteName} sprite`"
				:class="`sprite-image _${spriteName} part-sprite-img`"
				draggable="false"
				@load="onImageLoad"
				@error="emit('part-img-error', { event: $event, name: spriteName })"
			/>
		</div>

		<!-- Skeleton Pivot Point Overlay -->
		<div
			v-if="showBones"
			class="bone-pivot-marker"
			:style="pivotMarkerStyle"
			:title="`Точка вращения (${spriteName})`"
		>
			<span class="bpm-dot"></span>
			<span class="bpm-label">{{ spriteName }}</span>
		</div>

		<!-- Recursively render child parts -->
		<template v-for="(childSprite, childName) in spritesByParent[spriteName]" :key="childName">
			<RigPartNode
				:sprite="childSprite"
				:sprite-name="childName"
				:character-id="characterId"
				:sprites="sprites"
				:sprites-by-parent="spritesByParent"
				:selected-part-name="selectedPartName"
				:part-pivots="partPivots"
				:part-rotations="partRotations"
				:part-translations="partTranslations"
				:part-scales="partScales"
				:part-custom-styles="partCustomStyles"
				:animated-sprites="animatedSprites"
				:eye-offset="eyeOffset"
				:show-bones="showBones"
				:get-effective-part-image="getEffectivePartImage"
				@select-part="emit('select-part', $event)"
				@part-loaded="emit('part-loaded', $event)"
				@part-img-error="emit('part-img-error', $event)"
			/>
		</template>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'

defineOptions({
	name: 'RigPartNode'
})

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
	selectedPartName: {
		type: String,
		default: ''
	},
	partPivots: {
		type: Object,
		default: () => ({})
	},
	partRotations: {
		type: Object,
		default: () => ({})
	},
	partTranslations: {
		type: Object,
		default: () => ({})
	},
	partScales: {
		type: Object,
		default: () => ({})
	},
	partCustomStyles: {
		type: Object,
		default: () => ({})
	},
	animatedSprites: {
		type: Object,
		default: () => ({})
	},
	eyeOffset: {
		type: Object,
		default: () => ({ x: 0, y: 0 })
	},
	showBones: {
		type: Boolean,
		default: false
	},
	getEffectivePartImage: {
		type: Function,
		default: null
	}
})

const emit = defineEmits(['select-part', 'part-img-error', 'part-loaded'])

const spriteHeight = ref('0')

const onImageLoad = (event) => {
	spriteHeight.value = `${event.target.naturalHeight}`
	emit('part-loaded', props.spriteName)
}

const partImageUrl = computed(() => {
	if (props.animatedSprites?.[props.spriteName]) {
		return props.animatedSprites[props.spriteName]
	}
	if (typeof props.getEffectivePartImage === 'function') {
		return props.getEffectivePartImage(props.spriteName)
	}
	return props.sprite?.image || ''
})

const isRootPart = computed(() => {
	return !props.sprite?.parent || props.spriteName === 'body'
})

const offsetStyle = computed(() => {
	const style = {}

	if (props.sprite?.offset) {
		if (props.sprite.offset.x !== undefined) {
			style.left = `${props.sprite.offset.x}%`
		}
		if (props.sprite.offset.y !== undefined) {
			style.top = `${props.sprite.offset.y}%`
		}
	}

	if (props.sprite?.zindex !== undefined) {
		style.zIndex = props.sprite.zindex
	} else if (props.sprite?.['z-index'] !== undefined) {
		style.zIndex = props.sprite['z-index']
	}

	return style
})

const pivot = computed(() => {
	return props.partPivots[props.spriteName] || { x: 50, y: 50 }
})

const pivotMarkerStyle = computed(() => ({
	left: `${pivot.value.x}%`,
	top: `${pivot.value.y}%`
}))

const computedPartStyle = computed(() => {
	const heightVarName = isRootPart.value ? '--charbodyspriteH' : '--charspriteH'
	const style = {
		...offsetStyle.value,
		[heightVarName]: spriteHeight.value
	}

	// Pivot point for transform rotation
	style.transformOrigin = `${pivot.value.x}% ${pivot.value.y}%`

	const rot = props.partRotations[props.spriteName] || 0
	const trans = props.partTranslations?.[props.spriteName]
	const scale = props.partScales?.[props.spriteName]
	const customStyle = props.partCustomStyles?.[props.spriteName]
	const transforms = []

	if (rot) {
		transforms.push(`rotate(${rot}deg)`)
	}

	if (trans && (trans.x || trans.y)) {
		transforms.push(`translate(${trans.x}%, ${trans.y}%)`)
	}

	if (scale !== undefined && scale !== 1) {
		transforms.push(`scale(${scale})`)
	}

	// Eye joystick translation for eyes / head
	if (props.spriteName.includes('head') || props.spriteName.includes('eye')) {
		const eyeX = props.eyeOffset?.x ? props.eyeOffset.x * 6 : 0
		const eyeY = props.eyeOffset?.y ? props.eyeOffset.y * 6 : 0
		if (eyeX || eyeY) {
			transforms.push(`translate(${eyeX}%, ${eyeY}%)`)
		}
	}

	if (transforms.length > 0) {
		style.transform = transforms.join(' ')
	}

	if (customStyle) {
		Object.assign(style, customStyle)
	}

	return style
})

const partClasses = computed(() => {
	return [
		'char-part',
		'rig-part-node',
		`_${props.spriteName}`,
		`_part-${props.spriteName}`,
		{
			'_body': isRootPart.value,
			'__selected': props.selectedPartName === props.spriteName
		}
	]
})
</script>

<style scoped>
.rig-part-node {
	cursor: pointer;
	user-select: none;
}

.rig-part-node.__selected > .part-sprite-box {
	filter: drop-shadow(0 0 0.5em rgba(246, 196, 69, 0.95));
}

.part-sprite-img {
	pointer-events: none;
	-webkit-user-drag: none;
	user-select: none;
}

/* Skeleton Pivot Marker */
.bone-pivot-marker {
	position: absolute;
	transform: translate(-50%, -50%);
	pointer-events: none;
	display: flex;
	align-items: center;
	gap: 0.3em;
	z-index: 99;
}

.bpm-dot {
	width: 0.7em;
	height: 0.7em;
	border-radius: 50%;
	background: #ef4444;
	border: 1px solid #fff;
	box-shadow: 0 0 0.4em rgba(239, 68, 68, 0.8);
}

.bpm-label {
	font-size: 0.65em;
	background: rgba(0, 0, 0, 0.75);
	color: #fff;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
	white-space: nowrap;
}
</style>
