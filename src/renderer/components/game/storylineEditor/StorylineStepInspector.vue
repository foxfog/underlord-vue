<template>
	<div class="step-inspector">
		<!-- Empty State when no step selected -->
		<div v-if="!step" class="inspector-empty">
			<span class="empty-icon">👈</span>
			<span class="empty-text">Выберите шаг сценария из списка слева для редактирования</span>
		</div>

		<div v-else class="inspector-content">
			<!-- Header Toolbar -->
			<div class="inspector-header">
				<div class="header-step-badge">
					<span class="step-icon">{{ stepIcon }}</span>
					<span class="step-num">Шаг #{{ stepIndex + 1 }}</span>
				</div>

				<!-- Step Type Selector -->
				<div class="type-select-wrap">
					<select
						:value="currentStepType"
						class="step-type-select"
						@change="(e) => emit('change-step-type', e.target.value)"
					>
						<option value="dialogue">💬 Диалог (dialogue)</option>
						<option value="scene">🌄 Сцена (scene)</option>
						<option value="music">🎵 Музыка (music)</option>
						<option value="sound">🔊 Звуковой эффект (sound)</option>
						<option value="voice">🗣️ Озвучка (voice)</option>
						<option value="stop-stream">⏹️ Остановка аудио</option>
						<option value="choice">🔀 Выбор игрока (choice)</option>
						<option value="show">👤 Показать спрайт (show)</option>
						<option value="hide">👻 Скрыть спрайт (hide)</option>
						<option value="hide-all">👥 Скрыть всех (hide-all)</option>
						<option value="variable">⚙️ Переменная (variable)</option>
						<option value="titles">🏷️ Титры (titles)</option>
						<option value="goto">➡️ Переход (goto)</option>
						<option value="quest">📜 Квест (quest)</option>
						<option value="fade">⬛ Затемнение (fade)</option>
						<option value="notification">📢 Уведомление (notification)</option>
						<option value="hold">⏸️ Удержание (hold)</option>
						<option value="continue">↩️ Продолжить (continue)</option>
						<option value="end">🛑 Завершить (end)</option>
						<option value="raw">{ } Кастомный JSON</option>
					</select>
				</div>

				<!-- Mode Tabs -->
				<div class="mode-tabs">
					<button
						type="button"
						class="mode-tab-btn"
						:class="{ __active: mode === 'visual' }"
						@click="mode = 'visual'"
					>
						🎨 Визуально
					</button>
					<button
						type="button"
						class="mode-tab-btn"
						:class="{ __active: mode === 'json' }"
						@click="mode = 'json'"
					>
						{ } JSON
					</button>
				</div>

				<!-- Window Controls: Collapse & Close -->
				<div class="inspector-window-controls">
					<button
						type="button"
						class="inspector-ctrl-btn"
						title="Свернуть инспектор"
						@click="emit('toggle-collapse')"
					>
						<span>_</span>
					</button>
					<button
						type="button"
						class="inspector-ctrl-btn __close"
						title="Закрыть инспектор"
						@click="emit('close')"
					>
						<span>✕</span>
					</button>
				</div>
			</div>

			<!-- Common Condition Row (if / condition) -->
			<div class="condition-row">
				<label class="condition-label">Условие выполнения (if):</label>
				<input
					v-model="conditionExpression"
					type="text"
					placeholder="Например: global.hasItem === true (оставьте пустым, если не нужно)"
					class="condition-input"
					@input="updateCondition"
				/>
			</div>

			<!-- Form Container -->
			<div class="form-container">
				<!-- JSON Mode or Explicit Raw -->
				<StepRawJsonForm
					v-if="mode === 'json' || isRawStepType"
					:step="step"
					@update="onStepUpdate"
				/>

				<!-- Visual Forms based on type -->
				<template v-else>
					<StepDialogueForm
						v-if="currentStepType === 'dialogue'"
						:step="step"
						:characters="characters"
						@update="onStepUpdate"
					/>
					<StepSceneForm
						v-else-if="currentStepType === 'scene'"
						:step="step"
						:scenes="scenes"
						@update="onStepUpdate"
					/>
					<StepAudioForm
						v-else-if="['music', 'sound', 'voice', 'stop-stream'].includes(currentStepType)"
						:step="step"
						:streams="streams"
						@update="onStepUpdate"
					/>
					<StepChoiceForm
						v-else-if="currentStepType === 'choice'"
						:step="step"
						@update="onStepUpdate"
					/>
					<StepShowHideForm
						v-else-if="['show', 'hide', 'hide-all', 'clear-characters'].includes(currentStepType)"
						:step="step"
						:characters="characters"
						@update="onStepUpdate"
					/>
					<StepVariableForm
						v-else-if="currentStepType === 'variable'"
						:step="step"
						@update="onStepUpdate"
					/>
					<StepTitlesForm
						v-else-if="currentStepType === 'titles'"
						:step="step"
						@update="onStepUpdate"
					/>
					<StepQuestForm
						v-else-if="currentStepType === 'quest'"
						:step="step"
						@update="onStepUpdate"
					/>
					<!-- Fallback to Raw JSON for other/custom types -->
					<StepRawJsonForm
						v-else
						:step="step"
						@update="onStepUpdate"
					/>
				</template>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import StepDialogueForm from './forms/StepDialogueForm.vue'
import StepSceneForm from './forms/StepSceneForm.vue'
import StepAudioForm from './forms/StepAudioForm.vue'
import StepChoiceForm from './forms/StepChoiceForm.vue'
import StepShowHideForm from './forms/StepShowHideForm.vue'
import StepVariableForm from './forms/StepVariableForm.vue'
import StepTitlesForm from './forms/StepTitlesForm.vue'
import StepQuestForm from './forms/StepQuestForm.vue'
import StepRawJsonForm from './forms/StepRawJsonForm.vue'

const props = defineProps({
	step: {
		type: Object,
		default: null
	},
	stepIndex: {
		type: Number,
		default: 0
	},
	stepIcon: {
		type: String,
		default: '⚡'
	},
	characters: {
		type: Array,
		default: () => []
	},
	scenes: {
		type: Array,
		default: () => []
	},
	streams: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['update-step', 'change-step-type', 'close', 'toggle-collapse'])

const mode = ref('visual')
const conditionExpression = ref('')

watch(
	() => props.step,
	(newStep) => {
		if (newStep) {
			conditionExpression.value = newStep.if || newStep.condition || ''
		}
	},
	{ immediate: true, deep: true }
)

const currentStepType = computed(() => {
	if (!props.step) return 'raw'
	if (!props.step.type && props.step.variable) return 'variable'
	return props.step.type || 'raw'
})

const isRawStepType = computed(() => {
	const supported = [
		'dialogue',
		'scene',
		'music',
		'sound',
		'voice',
		'stop-stream',
		'choice',
		'show',
		'hide',
		'hide-all',
		'clear-characters',
		'variable',
		'titles',
		'quest'
	]
	return !supported.includes(currentStepType.value)
})

function updateCondition() {
	if (!props.step) return
	const updated = { ...props.step }
	const cond = conditionExpression.value.trim()
	if (cond) {
		updated.if = cond
	} else {
		delete updated.if
		delete updated.condition
	}
	emit('update-step', updated)
}

function onStepUpdate(newStepData) {
	const updated = { ...newStepData }
	const cond = conditionExpression.value.trim()
	if (cond) {
		updated.if = cond
	}
	emit('update-step', updated)
}
</script>

<style scoped>
.step-inspector {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: rgba(14, 18, 28, 0.85);
	font-family: inherit;
	box-sizing: border-box;
	color: #e2e8f0;
}

.inspector-empty {
	flex: 1;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.8em;
	padding: 2em;
	color: #64748b;
	text-align: center;
}

.empty-icon {
	font-size: 2.2em;
}

.empty-text {
	font-size: 0.95em;
	max-width: 18em;
	line-height: 1.4;
}

.inspector-content {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
}

.inspector-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75em 1em;
	background: rgba(20, 26, 40, 0.9);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	gap: 0.8em;
}

.header-step-badge {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.step-icon {
	font-size: 1.2em;
}

.step-num {
	font-weight: 700;
	font-size: 0.92em;
	color: #f6c445;
}

.type-select-wrap {
	flex: 1;
	max-width: 16em;
}

.step-type-select {
	width: 100%;
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.35em 0.6em;
	font-size: 0.85em;
	color: #f8fafc;
	outline: none;
	font-family: inherit;
	cursor: pointer;
}

.step-type-select:focus {
	border-color: #f6c445;
}

.mode-tabs {
	display: flex;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 0.35em;
	padding: 0.15em;
	gap: 0.15em;
}

.mode-tab-btn {
	background: transparent;
	border: none;
	border-radius: 0.25em;
	padding: 0.3em 0.65em;
	font-size: 0.8em;
	color: #94a3b8;
	cursor: pointer;
	transition: all 0.15s;
}

.mode-tab-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	font-weight: 700;
}

.inspector-window-controls {
	display: flex;
	align-items: center;
	gap: 0.3em;
	margin-left: 0.4em;
}

.inspector-ctrl-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.3em;
	padding: 0.25em 0.55em;
	font-size: 0.8em;
	color: #94a3b8;
	cursor: pointer;
	transition: all 0.15s;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: inherit;
}

.inspector-ctrl-btn:hover {
	background: rgba(255, 255, 255, 0.18);
	color: #fff;
}

.inspector-ctrl-btn.__close:hover {
	background: rgba(239, 68, 68, 0.3);
	border-color: #ef4444;
	color: #fca5a5;
}

.condition-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.5em 1em;
	background: rgba(10, 14, 22, 0.6);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.condition-label {
	font-size: 0.78em;
	color: #94a3b8;
	white-space: nowrap;
}

.condition-input {
	flex: 1;
	background: #090d16;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.3em;
	padding: 0.3em 0.6em;
	font-size: 0.8em;
	color: #38bdf8;
	font-family: Consolas, monospace;
	outline: none;
}

.condition-input:focus {
	border-color: #f6c445;
}

.form-container {
	flex: 1;
	overflow-y: auto;
	padding: 1em;
}
</style>
