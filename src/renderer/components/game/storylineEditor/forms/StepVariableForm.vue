<template>
	<div class="step-form">
		<!-- Variable Expression -->
		<div class="form-group">
			<label class="form-label">Выражение изменения переменной:</label>
			<input
				v-model="model.variable"
				type="text"
				placeholder="global.flag = true"
				class="form-input code-font"
				@input="emitUpdate"
			/>
		</div>

		<!-- Quick Presets -->
		<div class="form-group">
			<label class="form-label">Быстрые шаблоны переменных:</label>
			<div class="preset-chips">
				<button
					v-for="p in presets"
					:key="p.label"
					type="button"
					class="preset-chip"
					@click="applyPreset(p.code)"
				>
					{{ p.label }}
				</button>
			</div>
		</div>

		<!-- Optional Sound Effect -->
		<div class="form-group">
			<label class="form-label">Звук при изменении (необязательно):</label>
			<input
				v-model="model.sound"
				type="text"
				placeholder="audio/sound/quest_complete.mp3"
				class="form-input"
				@input="emitUpdate"
			/>
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

const presets = [
	{ label: 'Календарь (2138г.)', code: "global.calendarType = 'real'; global.year = 2138" },
	{ label: 'Время суток: Вечер', code: "global.timeOfDay = 'evening'" },
	{ label: 'Локация: Фабрика', code: "global.currentLocation = 'factory'" },
	{ label: 'Карта: Кибергород', code: "global.currentMap = 'cybercity'" },
	{ label: 'Имя ГГ в титул', code: 'character.mc.title = character.mc.name' },
	{ label: 'Флаг квеста = true', code: 'global.quest_step_done = true' }
]

watch(
	() => props.step,
	(newStep) => {
		model.value = { ...newStep }
	},
	{ deep: true, immediate: true }
)

function applyPreset(code) {
	model.value.variable = code
	emitUpdate()
}

function emitUpdate() {
	const clean = { ...model.value }
	if (!clean.sound) delete clean.sound
	delete clean.type // Variables in engine usually don't have type
	emit('update', clean)
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

.form-label {
	font-size: 0.85em;
	font-weight: 600;
	color: #cbd5e1;
}

.form-input {
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

.form-input:focus {
	border-color: #f6c445;
}

.code-font {
	font-family: Consolas, monospace;
	color: #38bdf8;
}

.preset-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.preset-chip {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.3em 0.6em;
	font-size: 0.78em;
	color: #cbd5e1;
	cursor: pointer;
	transition: all 0.15s;
}

.preset-chip:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: rgba(246, 196, 69, 0.4);
	color: #f6c445;
}
</style>
