<template>
	<div class="ui-select" :class="{ '_disabled': disabled }">
		<div class="ui-select-body ui-dropdown" ref="dropdownRef">
			<div 
				class="ui-select-label ui-dropdown-toggle" 
				@click="toggleDropdown"
				:class="{ '_active': isOpen }"
			>
				<span class="ui-select-text">{{ displayText }}</span>
				<span class="ui-select-arrow" :class="{ '_rotated': isOpen }">▼</span>
			</div>
			<div class="ui-select-options ui-dropdown-menu" :class="{ '_active': isOpen }">
				<!-- Slot-based custom content - developers can inject any HTML here -->
				<slot 
					name="options" 
					:close="closeDropdown" 
					:isOpen="isOpen"
					:selectedValues="selectedValues"
					:selectOption="selectOptionFromSlot"
					:multiple="multiple"
				></slot>
				
				<!-- Standard options (only shown if no slot content) -->
				<template v-if="!hasOptionsSlot">
					<div 
						v-for="option in options" 
						:key="getOptionValue(option)"
						class="ui-select-option ui-dropdown-item"
						:class="{ 
							'_selected': isSelected(option),
							'_disabled': isOptionDisabled(option)
						}"
						@click="selectOption(option)"
					>
						<input 
							v-if="multiple" 
							type="checkbox" 
							:checked="isSelected(option)"
							:disabled="isOptionDisabled(option)"
							@click.stop
							class="ui-select-checkbox"
						/>
						<input 
							v-else 
							type="radio" 
							:checked="isSelected(option)"
							:disabled="isOptionDisabled(option)"
							@click.stop
							class="ui-select-radio"
							:name="radioGroupName"
						/>
						<span class="ui-select-option-text">{{ getOptionLabel(option) }}</span>
					</div>
					<div v-if="options.length === 0" class="ui-select-empty ui-dropdown-item _disabled">
						{{ emptyText }}
					</div>
				</template>
			</div>
		</div>
	</div> 
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted, watch, nextTick, useSlots } from 'vue'
	
	defineOptions({
		name: 'UiSelect'
	})
	
	const props = defineProps({
		// v-model value - single value or array for multiple
		modelValue: {
			type: [String, Number, Array, Object],
			default: null
		},
		// Options array - can be strings, numbers, or objects
		options: {
			type: Array,
			default: () => []
		},
		// Enable multiple selection
		multiple: {
			type: Boolean,
			default: false
		},
		// Placeholder text when nothing is selected
		placeholder: {
			type: String,
			default: 'Select option...'
		},
		// Text when no options available
		emptyText: {
			type: String,
			default: 'No options available'
		},
		// Disable the select
		disabled: {
			type: Boolean,
			default: false
		},
		// Key for option value (when options are objects)
		valueKey: {
			type: String,
			default: 'value'
		},
		// Key for option label (when options are objects)
		labelKey: {
			type: String,
			default: 'label'
		},
		// Key for option disabled state (when options are objects)
		disabledKey: {
			type: String,
			default: 'disabled'
		},
		// Maximum selected items for multiple mode
		maxSelected: {
			type: Number,
			default: null
		},
		// Custom display text function for slot-based selections
		customDisplayText: {
			type: Function,
			default: null
		}
	})
	
	const emit = defineEmits(['update:modelValue', 'change', 'open', 'close'])
	
	// Slots
	const slots = useSlots()
	
	// Refs
	const dropdownRef = ref(null)
	const isOpen = ref(false)
	
	// Generate unique radio group name
	const radioGroupName = ref(`ui-select-${Math.random().toString(36).substr(2, 9)}`)
	
	// Check if options slot is provided
	const hasOptionsSlot = computed(() => {
		return !!slots.options
	})
	
	// Computed properties
	const selectedValues = computed(() => {
		if (props.multiple) {
			return Array.isArray(props.modelValue) ? props.modelValue : []
		}
		return props.modelValue !== null && props.modelValue !== undefined ? [props.modelValue] : []
	})
	
	const displayText = computed(() => {
		// Use custom display function if provided (for slot-based content)
		if (props.customDisplayText && typeof props.customDisplayText === 'function') {
			return props.customDisplayText(selectedValues.value, props.multiple)
		}
		
		if (selectedValues.value.length === 0) {
			return props.placeholder
		}
		
		if (props.multiple) {
			if (selectedValues.value.length === 1) {
				const option = props.options.find(opt => getOptionValue(opt) === selectedValues.value[0])
				return option ? getOptionLabel(option) : selectedValues.value[0]
			}
			return `${selectedValues.value.length} selected`
		}
		
		const option = props.options.find(opt => getOptionValue(opt) === selectedValues.value[0])
		return option ? getOptionLabel(option) : selectedValues.value[0]
	})
	
	// Helper functions
	function getOptionValue(option) {
		if (typeof option === 'object' && option !== null) {
			return option[props.valueKey]
		}
		return option
	}
	
	function getOptionLabel(option) {
		if (typeof option === 'object' && option !== null) {
			return option[props.labelKey] || option[props.valueKey]
		}
		return option
	}
	
	function isOptionDisabled(option) {
		if (typeof option === 'object' && option !== null) {
			return option[props.disabledKey] || false
		}
		return false
	}
	
	function isSelected(option) {
		const value = getOptionValue(option)
		return selectedValues.value.includes(value)
	}
	
	// Event handlers
	function toggleDropdown() {
		if (props.disabled) return
		
		if (isOpen.value) {
			closeDropdown()
		} else {
			openDropdown()
		}
	}
	
	function openDropdown() {
		if (props.disabled) return
		
		isOpen.value = true
		emit('open')
		
		// Add class to dropdown for positioning logic
		nextTick(() => {
			if (dropdownRef.value) {
				dropdownRef.value.classList.add('_active')
			}
		})
	}
	
	function closeDropdown() {
		isOpen.value = false
		emit('close')
		
		if (dropdownRef.value) {
			dropdownRef.value.classList.remove('_active', '_bot')
		}
	}
	
	function selectOption(option) {
		if (isOptionDisabled(option)) return
		
		const value = getOptionValue(option)
		_selectValue(value)
	}
	
	// Function for slot-based selections (receives raw value)
	function selectOptionFromSlot(value) {
		_selectValue(value)
	}
	
	// Internal selection logic
	function _selectValue(value) {
		if (props.multiple) {
			const currentValues = [...selectedValues.value]
			const index = currentValues.indexOf(value)
			
			if (index > -1) {
				// Remove value
				currentValues.splice(index, 1)
			} else {
				// Add value (check max limit)
				if (!props.maxSelected || currentValues.length < props.maxSelected) {
					currentValues.push(value)
				}
			}
			
			emit('update:modelValue', currentValues)
			emit('change', currentValues)
		} else {
			// Single select
			emit('update:modelValue', value)
			emit('change', value)
			closeDropdown()
		}
	}
	
	// Click outside handler
	function handleClickOutside(event) {
		if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
			closeDropdown()
		}
	}
	
	// Keyboard navigation
	function handleKeydown(event) {
		if (props.disabled) return
		
		switch (event.key) {
			case 'Enter':
			case 'Space':
				event.preventDefault()
				toggleDropdown()
				break
			case 'Escape':
				event.preventDefault()
				closeDropdown()
				break
		}
	}
	
	// Lifecycle
	onMounted(() => {
		document.addEventListener('click', handleClickOutside)
		if (dropdownRef.value) {
			dropdownRef.value.addEventListener('keydown', handleKeydown)
			dropdownRef.value.setAttribute('tabindex', '0')
		}
	})
	
	onUnmounted(() => {
		document.removeEventListener('click', handleClickOutside)
		if (dropdownRef.value) {
			dropdownRef.value.removeEventListener('keydown', handleKeydown)
		}
	})
	
	// Watch for external changes
	watch(() => props.modelValue, (newValue) => {
		// Validate value format
		if (props.multiple && !Array.isArray(newValue) && newValue !== null) {
			console.warn('UiSelect: modelValue should be an array when multiple=true')
		}
	})
</script>