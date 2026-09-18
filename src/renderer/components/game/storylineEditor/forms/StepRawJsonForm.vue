<template>
	<div class="step-form">
		<!-- Header with Tools -->
		<div class="raw-tools-header">
			<span class="raw-badge">{ } Прямое редактирование JSON экшена</span>
			<div class="raw-actions">
				<button
					type="button"
					class="raw-btn"
					title="Отформатировать JSON с отступами"
					@click="beautifyJson"
				>
					✨ Форматировать
				</button>
				<button
					type="button"
					class="raw-btn __apply"
					:disabled="hasError"
					@click="applyChanges"
				>
					✔ Применить
				</button>
			</div>
		</div>

		<!-- Error Message Banner -->
		<div v-if="errorMessage" class="json-error-banner">
			<span class="error-icon">⚠️</span>
			<span class="error-text">{{ errorMessage }}</span>
		</div>

		<!-- JSON Textarea -->
		<div class="form-group">
			<textarea
				v-model="rawText"
				rows="12"
				spellcheck="false"
				class="raw-textarea"
				@input="onTextInput"
			></textarea>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
	step: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['update'])

const rawText = ref('')
const errorMessage = ref('')
const hasError = ref(false)

watch(
	() => props.step,
	(newStep) => {
		try {
			rawText.value = JSON.stringify(newStep, null, 2)
			errorMessage.value = ''
			hasError.value = false
		} catch (err) {
			errorMessage.value = err.message
			hasError.value = true
		}
	},
	{ immediate: true, deep: true }
)

function onTextInput() {
	validate()
	if (!hasError.value) {
		try {
			const parsed = JSON.parse(rawText.value)
			emit('update', parsed)
		} catch (e) {
			// ignore until valid
		}
	}
}

function validate() {
	try {
		JSON.parse(rawText.value)
		errorMessage.value = ''
		hasError.value = false
		return true
	} catch (err) {
		errorMessage.value = `Ошибка синтаксиса: ${err.message}`
		hasError.value = true
		return false
	}
}

function beautifyJson() {
	try {
		const obj = JSON.parse(rawText.value)
		rawText.value = JSON.stringify(obj, null, 2)
		errorMessage.value = ''
		hasError.value = false
		emit('update', obj)
	} catch (err) {
		errorMessage.value = `Невозможно отформатировать: ${err.message}`
		hasError.value = true
	}
}

function applyChanges() {
	if (validate()) {
		const parsed = JSON.parse(rawText.value)
		emit('update', parsed)
	}
}
</script>

<style scoped>
.step-form {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	color: #e2e8f0;
}

.raw-tools-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 0.4em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.raw-badge {
	font-size: 0.82em;
	color: #94a3b8;
	font-weight: 600;
}

.raw-actions {
	display: flex;
	gap: 0.4em;
}

.raw-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.3em 0.65em;
	font-size: 0.8em;
	color: #cbd5e1;
	cursor: pointer;
	transition: all 0.15s;
}

.raw-btn:hover {
	background: rgba(255, 255, 255, 0.18);
	color: #fff;
}

.raw-btn.__apply {
	background: #f6c445;
	border-color: #f6c445;
	color: #0f172a;
	font-weight: 700;
}

.raw-btn.__apply:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.json-error-banner {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid rgba(239, 68, 68, 0.4);
	border-radius: 0.35em;
	padding: 0.5em 0.8em;
	color: #fca5a5;
	font-size: 0.82em;
}

.error-icon {
	font-size: 1.1em;
}

.raw-textarea {
	width: 100%;
	background: #090d16;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.7em 0.9em;
	font-size: 0.86em;
	font-family: Consolas, 'Fira Code', monospace;
	line-height: 1.5;
	color: #38bdf8;
	box-sizing: border-box;
	outline: none;
	resize: vertical;
	tab-size: 2;
}

.raw-textarea:focus {
	border-color: #f6c445;
}
</style>
