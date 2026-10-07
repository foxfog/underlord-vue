<template>
	<div class="step-form">
		<!-- Camera Effect Presets -->
		<div class="form-group">
			<label class="form-label">Кинематографический эффект камеры:</label>
			<div class="preset-grid">
				<button
					v-for="preset in presets"
					:key="preset.id"
					type="button"
					class="preset-card"
					:class="{ __active: currentEffect === preset.id }"
					@click="setEffect(preset.id)"
				>
					<span class="preset-icon">{{ preset.icon }}</span>
					<div class="preset-info">
						<span class="preset-title">{{ preset.title }}</span>
						<span class="preset-desc">{{ preset.description }}</span>
					</div>
				</button>
			</div>
		</div>

		<!-- Parameters Row: Duration & Overscan -->
		<div class="form-row">
			<div class="form-group flex-1">
				<label class="form-label">Длительность (сек):</label>
				<input
					v-model.number="model.duration"
					type="number"
					min="0.1"
					max="10"
					step="0.05"
					placeholder="0.6"
					class="form-input"
					@input="emitUpdate"
				/>
			</div>

			<div class="form-group flex-1">
				<label class="form-label">Коэффициент оверскана (scale):</label>
				<input
					v-model.number="model.overscan"
					type="number"
					min="1.0"
					max="1.5"
					step="0.01"
					placeholder="1.05 (дефолт)"
					class="form-input"
					@input="emitUpdate"
				/>
			</div>
		</div>

		<!-- Checkboxes Row -->
		<div class="form-group">
			<label class="checkbox-label">
				<input
					v-model="model.wait"
					type="checkbox"
					@change="emitUpdate"
				/>
				<span>Ждать завершения анимации камеры (wait)</span>
			</label>
			<span class="form-hint">
				Если выключено, камера анимируется параллельно со следующей репликой или озвучкой.
			</span>
		</div>

		<div v-if="currentEffect === 'damage'" class="form-group">
			<label class="checkbox-label">
				<input
					v-model="damageFlashEnabled"
					type="checkbox"
					@change="toggleDamageFlash"
				/>
				<span>Красная виньетка / вспышка урона (damage flash)</span>
			</label>
		</div>
	</div>
</template>

<script setup>
import { reactive, watch, computed } from 'vue'

const props = defineProps({
	step: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['update'])

const presets = [
	{
		id: 'nod',
		icon: '👤↕️',
		title: 'Кивание (согласие)',
		description: 'Плавный наклон вниз и пружинящий возврат',
		defaultDuration: 0.6
	},
	{
		id: 'shake',
		icon: '👤↔️',
		title: 'Покачивание (отказ)',
		description: 'Горизонтальное качание влево-вправо',
		defaultDuration: 0.55
	},
	{
		id: 'cough',
		icon: '🤧⚡',
		title: 'Кашель / чих',
		description: 'Резкий спазм с глубоким наклоном и отдачей',
		defaultDuration: 0.6
	},
	{
		id: 'damage',
		icon: '💥🩸',
		title: 'Урон / толчок',
		description: 'Хаотичная тряска с красной вспышкой и виньеткой',
		defaultDuration: 0.65
	},
	{
		id: 'rumble',
		icon: '🌋〰️',
		title: 'Грохот / вибрация',
		description: 'Дрожание экрана от шагов титана, взрывов или станков',
		defaultDuration: 0.8
	},
	{
		id: 'reset',
		icon: '🔄🎯',
		title: 'Сброс камеры',
		description: 'Возврат камеры в нейтральное положение',
		defaultDuration: 0.1
	}
]

const model = reactive({
	type: 'camera',
	effect: props.step.effect || props.step.action || props.step.animation || 'nod',
	duration: props.step.duration !== undefined ? props.step.duration : 0.6,
	overscan: props.step.overscan || undefined,
	wait: props.step.wait === true,
	damageFlash: props.step.damageFlash !== undefined ? props.step.damageFlash : true
})

const currentEffect = computed(() => {
	const raw = model.effect || 'nod'
	if (['nod', 'agree', 'nod-agree', 'yes'].includes(raw)) return 'nod'
	if (['shake', 'refuse', 'shake-refuse', 'no', 'head-shake'].includes(raw)) return 'shake'
	if (['cough', 'sneeze', 'chih', 'kashel'].includes(raw)) return 'cough'
	if (['damage', 'hurt', 'hit', 'damage-shake'].includes(raw)) return 'damage'
	if (['rumble', 'earthquake', 'heavy-shake'].includes(raw)) return 'rumble'
	if (['reset', 'stop', 'clear', 'none'].includes(raw)) return 'reset'
	return raw
})

const damageFlashEnabled = computed({
	get() {
		return model.damageFlash !== false
	},
	set(val) {
		model.damageFlash = val
		emitUpdate()
	}
})

function toggleDamageFlash() {
	emitUpdate()
}

function setEffect(effectId) {
	model.effect = effectId
	const preset = presets.find((p) => p.id === effectId)
	if (preset && (!model.duration || model.duration === 0.6)) {
		model.duration = preset.defaultDuration
	}
	emitUpdate()
}

watch(
	() => props.step,
	(newStep) => {
		if (newStep) {
			model.type = newStep.type || 'camera'
			model.effect = newStep.effect || newStep.action || newStep.animation || 'nod'
			model.duration = newStep.duration !== undefined ? newStep.duration : 0.6
			model.overscan = newStep.overscan || undefined
			model.wait = newStep.wait === true
			model.damageFlash = newStep.damageFlash !== undefined ? newStep.damageFlash : true
		}
	},
	{ deep: true }
)

function emitUpdate() {
	const result = {
		type: 'camera',
		effect: model.effect
	}

	if (model.duration !== undefined && model.duration !== null && model.duration !== '') {
		result.duration = Number(model.duration)
	}

	if (model.overscan !== undefined && model.overscan !== null && model.overscan !== '') {
		result.overscan = Number(model.overscan)
	}

	if (model.wait === true) {
		result.wait = true
	}

	if (currentEffect.value === 'damage' && model.damageFlash === false) {
		result.damageFlash = false
	}

	emit('update', result)
}
</script>

<style scoped>
.step-form {
	display: flex;
	flex-direction: column;
	gap: 1.1em;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.form-row {
	display: flex;
	gap: 0.8em;
}

.flex-1 {
	flex: 1;
}

.form-label {
	font-size: 0.85em;
	font-weight: 600;
	color: #cbd5e1;
}

.form-hint {
	font-size: 0.78em;
	color: #94a3b8;
	margin-top: 0.2em;
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

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
	color: #cbd5e1;
	cursor: pointer;
}

.preset-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.6em;
}

.preset-card {
	display: flex;
	align-items: flex-start;
	gap: 0.7em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.45em;
	padding: 0.6em 0.75em;
	cursor: pointer;
	text-align: left;
	transition: all 0.18s ease;
}

.preset-card:hover {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(255, 255, 255, 0.25);
}

.preset-card.__active {
	background: rgba(246, 196, 69, 0.16);
	border-color: #f6c445;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.25);
}

.preset-icon {
	font-size: 1.35em;
	line-height: 1;
}

.preset-info {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.preset-title {
	font-size: 0.85em;
	font-weight: 600;
	color: #f1f5f9;
}

.preset-card.__active .preset-title {
	color: #f6c445;
}

.preset-desc {
	font-size: 0.74em;
	color: #94a3b8;
	line-height: 1.25;
}
</style>
