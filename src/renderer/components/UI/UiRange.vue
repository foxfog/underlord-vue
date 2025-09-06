<template>
	<div class="ui-range" :class="{ 'ui-range--disabled': disabled, 'ui-range--no-thumb': !showThumb }">
		<div 
			class="ui-range-body" 
			@mousedown="startDrag"
			@touchstart="startDrag"
			ref="rangeBody"
		>
			<div class="ui-range-track">
				<div 
					class="ui-range-progress" 
					:style="{ width: progressWidth + '%' }"
				></div>
			</div>
			<div 
				class="ui-range-thumb" 
				:style="{ left: thumbLeftPosition }"
				@mousedown.stop="startDrag"
				@touchstart.stop="startDrag"
			></div>
		</div>
		
		<!-- Hidden native input for accessibility and form integration -->
		<input 
			type="range" 
			class="ui-range-native"
			:min="min"
			:max="max"
			:step="step"
			:value="modelValue"
			:disabled="disabled"
			@input="handleNativeInput"
			tabindex="-1"
		/>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted } from 'vue'
	
	defineOptions({
		name: 'uiRange'
	})
	
	const props = defineProps({
		modelValue: {
			type: Number,
			default: 0
		},
		min: {
			type: Number,
			default: 0
		},
		max: {
			type: Number,
			default: 100
		},
		step: {
			type: Number,
			default: 1
		},
		disabled: {
			type: Boolean,
			default: false
		},
		showThumb: {
			type: Boolean,
			default: true
		}
	})
	
	const emit = defineEmits(['update:modelValue', 'input', 'change', 'drag-start', 'drag-end'])
	
	const rangeBody = ref(null)
	const isDragging = ref(false)
	
	// Calculate progress percentage
	const progressWidth = computed(() => {
		const range = props.max - props.min
		if (range === 0) return 0
		return ((props.modelValue - props.min) / range) * 100
	})

	// Calculate thumb position with edge alignment
	const thumbLeftPosition = computed(() => {
		const progress = progressWidth.value / 100 // 0 to 1
		// Position thumb so left edge aligns at 0% and right edge aligns at 100%
		// Thumb width is 1.2rem, so we need to subtract thumb width * progress
		// to shift it left as progress increases
		return `calc(${progressWidth.value}% - ${progress * 1.2}rem)`
	})
	
	// Calculate value from position
	function calculateValueFromPosition(clientX) {
		if (!rangeBody.value) return props.modelValue
		
		const rect = rangeBody.value.getBoundingClientRect()
		const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
		const range = props.max - props.min
		const rawValue = props.min + (percentage * range)
		
		// Apply step rounding
		const steppedValue = Math.round(rawValue / props.step) * props.step
		return Math.max(props.min, Math.min(props.max, steppedValue))
	}
	
	// Start dragging
	function startDrag(event) {
		if (props.disabled) return
		
		isDragging.value = true
		emit('drag-start') // Уведомляем о начале перетаскивания
		const clientX = event.type.includes('touch') ? event.touches[0].clientX : event.clientX
		updateValue(clientX)
		
		// Add global event listeners
		const moveHandler = (e) => {
			if (!isDragging.value) return
			const x = e.type.includes('touch') ? e.touches[0].clientX : e.clientX
			updateValue(x)
		}
		
		const endHandler = () => {
			if (isDragging.value) {
				isDragging.value = false
				emit('change', props.modelValue)
				emit('drag-end') // Уведомляем об окончании перетаскивания
			}
			document.removeEventListener('mousemove', moveHandler)
			document.removeEventListener('mouseup', endHandler)
			document.removeEventListener('touchmove', moveHandler)
			document.removeEventListener('touchend', endHandler)
		}
		
		document.addEventListener('mousemove', moveHandler)
		document.addEventListener('mouseup', endHandler)
		document.addEventListener('touchmove', moveHandler)
		document.addEventListener('touchend', endHandler)
		
		// Prevent text selection
		event.preventDefault()
	}
	
	// Update value and emit events
	function updateValue(clientX) {
		const newValue = calculateValueFromPosition(clientX)
		if (newValue !== props.modelValue) {
			emit('update:modelValue', newValue)
			emit('input', newValue)
		}
	}
	
	// Handle native input for accessibility
	function handleNativeInput(event) {
		const value = parseFloat(event.target.value)
		emit('update:modelValue', value)
		emit('input', value)
		emit('change', value)
	}
	
	// Keyboard support
	function handleKeydown(event) {
		if (props.disabled) return
		
		let newValue = props.modelValue
		const range = props.max - props.min
		
		switch (event.key) {
			case 'ArrowLeft':
			case 'ArrowDown':
				newValue = Math.max(props.min, props.modelValue - props.step)
				break
			case 'ArrowRight':
			case 'ArrowUp':
				newValue = Math.min(props.max, props.modelValue + props.step)
				break
			case 'Home':
				newValue = props.min
				break
			case 'End':
				newValue = props.max
				break
			case 'PageDown':
				newValue = Math.max(props.min, props.modelValue - range * 0.1)
				break
			case 'PageUp':
				newValue = Math.min(props.max, props.modelValue + range * 0.1)
				break
			default:
				return
		}
		
		event.preventDefault()
		emit('update:modelValue', newValue)
		emit('input', newValue)
		emit('change', newValue)
	}
	
	onMounted(() => {
		if (rangeBody.value) {
			rangeBody.value.addEventListener('keydown', handleKeydown)
			rangeBody.value.setAttribute('tabindex', '0')
			rangeBody.value.setAttribute('role', 'slider')
			rangeBody.value.setAttribute('aria-valuemin', props.min)
			rangeBody.value.setAttribute('aria-valuemax', props.max)
			rangeBody.value.setAttribute('aria-valuenow', props.modelValue)
		}
	})
	
	onUnmounted(() => {
		if (rangeBody.value) {
			rangeBody.value.removeEventListener('keydown', handleKeydown)
		}
	})
</script>