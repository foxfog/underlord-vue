<template>
	<div v-if="isVisible" class="modal">
		<div class="modal-content">
			<div class="modal-header" v-if="showCloseButton">
				<h2 class="modal-title">{{ title }}</h2>
				<button class="btn-close" @click="closeModal">×</button>
			</div>
			<div v-else class="modal-header-no-close">
				<h2 class="modal-title">{{ title }}</h2>
			</div>
			<div class="modal-body">
				<p class="input-description">{{ description }}</p>
				<input 
					v-model="inputValue"
					type="text" 
					class="text-input"
					:placeholder="placeholder"
					@keyup.enter="confirmInput"
					ref="inputField"
				/>
			</div>
			<div class="modal-footer">
				<button v-if="showCancelButton" class="btn btn-secondary" @click="closeModal">Отмена</button>
				<button class="btn btn-primary" @click="confirmInput" :disabled="!inputValue.trim()">{{ confirmButtonText }}</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	},
	title: {
		type: String,
		default: 'Введите текст'
	},
	description: {
		type: String,
		default: ''
	},
	placeholder: {
		type: String,
		default: 'Введите значение...'
	},
	initialValue: {
		type: String,
		default: ''
	},
	showCloseButton: {
		type: Boolean,
		default: true
	},
	showCancelButton: {
		type: Boolean,
		default: true
	},
	confirmButtonText: {
		type: String,
		default: 'Подтвердить'
	}
})

const emit = defineEmits(['close', 'confirm'])

const inputValue = ref(props.initialValue)
const inputField = ref(null)

watch(() => props.isVisible, (newVal) => {
	if (newVal) {
		inputValue.value = props.initialValue
		nextTick(() => {
			if (inputField.value) {
				inputField.value.focus()
			}
		})
	}
})

function closeModal() {
	emit('close')
}

function confirmInput() {
	if (inputValue.value.trim()) {
		emit('confirm', inputValue.value.trim())
		closeModal()
	}
}
</script>

