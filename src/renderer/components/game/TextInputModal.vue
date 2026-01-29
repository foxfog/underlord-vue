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

<style scoped>
.modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000;
}

.modal-content {
	background-color: #2c2c2c;
	border-radius: 8px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	min-width: 300px;
	max-width: 500px;
	width: 90%;
}

.modal-header {
	padding: 15px 20px;
	border-bottom: 1px solid #444;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.modal-header-no-close {
	padding: 15px 20px;
	border-bottom: 1px solid #444;
}

.modal-title {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 500;
	color: #fff;
}

.btn-close {
	background: none;
	border: none;
	font-size: 1.5rem;
	color: #aaa;
	cursor: pointer;
	padding: 0;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn-close:hover {
	color: #fff;
}

.modal-body {
	padding: 20px;
}

.input-description {
	color: #ddd;
	margin-bottom: 15px;
	line-height: 1.4;
}

.text-input {
	width: 100%;
	padding: 12px;
	border: 1px solid #444;
	border-radius: 4px;
	background-color: #333;
	color: #fff;
	font-size: 1rem;
	box-sizing: border-box;
}

.text-input:focus {
	outline: none;
	border-color: #007bff;
	box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.text-input::placeholder {
	color: #888;
}

.modal-footer {
	padding: 15px 20px;
	border-top: 1px solid #444;
	display: flex;
	justify-content: flex-end;
	gap: 10px;
}

.btn {
	padding: 8px 16px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-size: 1rem;
}

.btn-primary {
	background-color: #007bff;
	color: white;
}

.btn-primary:hover:not(:disabled) {
	background-color: #0056b3;
}

.btn-primary:disabled {
	background-color: #6c757d;
	cursor: not-allowed;
}

.btn-secondary {
	background-color: #6c757d;
	color: white;
}

.btn-secondary:hover {
	background-color: #5a6268;
}
</style>