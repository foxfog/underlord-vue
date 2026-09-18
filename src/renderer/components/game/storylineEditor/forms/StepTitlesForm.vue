<template>
	<div class="step-form">
		<!-- Titles Text / HTML -->
		<div class="form-group">
			<label class="form-label">Текст титров (поддерживается HTML):</label>
			<textarea
				v-model="model.text"
				rows="4"
				placeholder="<p class='t-64'>Глава I</p><p class='t-32'>Конец и начало</p>"
				class="form-textarea"
				@input="emitUpdate"
			></textarea>
		</div>

		<!-- Timing and Auto-end -->
		<div class="form-row">
			<div class="form-group flex-1">
				<label class="form-label">Длительность показа (сек):</label>
				<input
					v-model.number="model.duration"
					type="number"
					min="1"
					max="300"
					placeholder="5"
					class="form-input"
					@input="emitUpdate"
				/>
			</div>

			<div class="form-group flex-1 flex-center">
				<label class="checkbox-label">
					<input
						v-model="model['auto-end']"
						type="checkbox"
						@change="emitUpdate"
					/>
					<span>Автоматическое завершение (auto-end)</span>
				</label>
			</div>
		</div>

		<!-- Style Presets -->
		<div class="form-group">
			<label class="form-label">Стиль отображения:</label>
			<div class="preset-chips">
				<button
					type="button"
					class="preset-chip"
					:class="{ __active: !model.class }"
					@click="setStylePreset('standard')"
				>
					Стандартный
				</button>
				<button
					type="button"
					class="preset-chip"
					:class="{ __active: model.class === 'sw-title-block' }"
					@click="setStylePreset('star-wars')"
				>
					Бегущие титры (Star Wars Crawl)
				</button>
			</div>
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

const model = ref({ ...props.step })

watch(
	() => props.step,
	(newStep) => {
		model.value = { ...newStep }
	},
	{ deep: true, immediate: true }
)

function setStylePreset(preset) {
	if (preset === 'star-wars') {
		model.value.class = 'sw-title-block'
		model.value.wrap =
			"<div class='sw-stars'></div><div class='sw-twinkling'></div><div class='sw-old-filter'><div class='sw-logo'>UnderlorD</div><div class='sw-fade'></div><div class='sw-inner'><div class='sw-crawl'>%text%</div></div></div>"
		model.value.duration = model.value.duration || 60
	} else {
		delete model.value.class
		delete model.value.wrap
	}
	emitUpdate()
}

function emitUpdate() {
	emit('update', { ...model.value })
}
</script>

<style scoped>
.step-form {
	display: flex;
	flex-direction: column;
	gap: 0.9em;
	color: #e2e8f0;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.form-row {
	display: flex;
	gap: 0.8em;
}

.flex-1 {
	flex: 1;
}

.flex-center {
	justify-content: center;
}

.form-label {
	font-size: 0.85em;
	font-weight: 600;
	color: #cbd5e1;
}

.form-input,
.form-textarea {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.5em 0.75em;
	font-size: 0.88em;
	color: #f8fafc;
	outline: none;
	font-family: inherit;
	box-sizing: border-box;
	transition: border-color 0.2s;
}

.form-input:focus,
.form-textarea:focus {
	border-color: #f6c445;
}

.form-textarea {
	resize: vertical;
	line-height: 1.4;
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
	color: #cbd5e1;
	cursor: pointer;
}

.preset-chips {
	display: flex;
	gap: 0.5em;
}

.preset-chip {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.4em 0.75em;
	font-size: 0.82em;
	color: #94a3b8;
	cursor: pointer;
	transition: all 0.15s;
}

.preset-chip:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.preset-chip.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: 600;
}
</style>
