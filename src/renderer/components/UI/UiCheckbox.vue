<template>
	<div
		class="ui-checkbox"
		:class="[
			`_mode-${mode}`,
			{ '_checked': isChecked, '_disabled': disabled }
		]"
		role="checkbox"
		:aria-checked="isChecked"
		:tabindex="disabled ? -1 : 0"
		@click="toggle"
		@keydown.space.prevent="toggle"
		@keydown.enter.prevent="toggle"
	>
		<!-- Native checkbox for accessibility -->
		<input
			type="checkbox"
			class="ui-checkbox-native"
			:checked="isChecked"
			:disabled="disabled"
			@change.stop="onNativeChange"
		/>

		<!-- Visual control -->
		<div v-if="mode === 'switch'" class="ui-checkbox-switch">
			<div class="ui-checkbox-switch-thumb"></div>
		</div>
		<div v-else class="ui-checkbox-box">
			<span class="ui-checkbox-check">✓</span>
		</div>

		<!-- Label / content -->
		<div v-if="$slots.default || label" class="ui-checkbox-label">
			<slot>{{ label }}</slot>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'

	defineOptions({
		name: 'UiCheckbox'
	})

	const props = defineProps({
		modelValue: {
			type: Boolean,
			default: false
		},
		label: {
			type: String,
			default: ''
		},
		// 'checkbox' | 'switch'
		mode: {
			type: String,
			default: 'checkbox'
		},
		disabled: {
			type: Boolean,
			default: false
		}
	})

	const emit = defineEmits(['update:modelValue', 'change'])

	const isChecked = computed(() => props.modelValue)

	function update(value) {
		if (props.disabled) return
		emit('update:modelValue', value)
		emit('change', value)
	}

	function toggle() {
		update(!props.modelValue)
	}

	function onNativeChange(event) {
		update(event.target.checked)
	}
</script>

