<template>
	<div class="step-form">
		<!-- Mode Toggle (Single vs Batch) -->
		<div class="mode-switch-row">
			<label class="form-label">Формат переменной:</label>
			<div class="mode-toggle-group">
				<button
					type="button"
					class="mode-toggle-btn"
					:class="{ __active: !isBatchMode }"
					@click="setBatchMode(false)"
				>
					⚙️ Одиночная
				</button>
				<button
					type="button"
					class="mode-toggle-btn"
					:class="{ __active: isBatchMode }"
					@click="setBatchMode(true)"
				>
					🎛️ Пакет операций ({{ operations.length }})
				</button>
			</div>
		</div>

		<!-- SINGLE MODE -->
		<template v-if="!isBatchMode">
			<div class="form-group">
				<label class="form-label">Выражение изменения переменной:</label>
				<input
					v-model="singleVariable"
					type="text"
					placeholder="global.flag = true"
					class="form-input code-font"
					@input="emitUpdate"
				/>
			</div>
		</template>

		<!-- BATCH OPERATIONS MODE -->
		<template v-else>
			<div class="batch-header-row">
				<label class="form-label">Список операций пакета:</label>
				<div class="batch-view-toggle">
					<button
						type="button"
						class="view-toggle-btn"
						:class="{ __active: !isBulkTextMode }"
						@click="isBulkTextMode = false"
					>
						📋 Список
					</button>
					<button
						type="button"
						class="view-toggle-btn"
						:class="{ __active: isBulkTextMode }"
						@click="enterBulkMode"
					>
						📝 Массовый ввод
					</button>
				</div>
			</div>

			<!-- Bulk Textarea Mode -->
			<div v-if="isBulkTextMode" class="form-group">
				<textarea
					v-model="bulkTextContent"
					rows="6"
					class="form-textarea code-font"
					placeholder="global.calendarType = 'real'&#10;global.year = 2138&#10;global.time = '20:52'"
					@input="syncFromBulkText"
				></textarea>
				<span class="form-hint">
					Каждая строка или выражение через ';' сохраняется как отдельная операция.
				</span>
			</div>

			<!-- List Mode with Individual Row Inputs -->
			<div v-else class="operations-list">
				<div
					v-for="(op, opIdx) in operations"
					:key="opIdx"
					class="operation-row"
				>
					<span class="op-index">#{{ opIdx + 1 }}</span>
					<input
						v-model="operations[opIdx]"
						type="text"
						placeholder="global.flag = true"
						class="form-input code-font op-input"
						@input="emitUpdate"
					/>
					<div class="op-actions">
						<button
							type="button"
							class="op-action-btn"
							title="Переместить вверх"
							:disabled="opIdx === 0"
							@click="moveOperation(opIdx, opIdx - 1)"
						>
							▲
						</button>
						<button
							type="button"
							class="op-action-btn"
							title="Переместить вниз"
							:disabled="opIdx === operations.length - 1"
							@click="moveOperation(opIdx, opIdx + 1)"
						>
							▼
						</button>
						<button
							type="button"
							class="op-action-btn __delete"
							title="Удалить операцию"
							@click="removeOperation(opIdx)"
						>
							✕
						</button>
					</div>
				</div>

				<button
					type="button"
					class="add-op-btn"
					@click="addOperation"
				>
					+ Добавить выражение
				</button>
			</div>
		</template>

		<!-- Quick Presets -->
		<div class="form-group">
			<label class="form-label">
				{{ isBatchMode ? 'Добавить шаблон в пакет:' : 'Быстрые шаблоны переменных:' }}
			</label>
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
				v-model="soundEffect"
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

const isBatchMode = ref(false)
const isBulkTextMode = ref(false)
const singleVariable = ref('')
const operations = ref([])
const bulkTextContent = ref('')
const soundEffect = ref('')

const presets = [
	{ label: 'Календарь (2138г.)', code: "global.calendarType = 'real'; global.year = 2138" },
	{ label: 'Время суток: Вечер', code: "global.timeOfDay = 'evening'" },
	{ label: 'Локация: Фабрика', code: "global.currentLocation = 'factory'" },
	{ label: 'Карта: Кибергород', code: "global.currentMap = 'cybercity'" },
	{ label: 'Имя ГГ в титул', code: 'character.mc.title = character.mc.name' },
	{ label: 'Флаг квеста = true', code: 'global.quest_step_done = true' }
]

function parseOperationsFromStep(step) {
	if (!step) return []
	const rawOps = step.operations || step.variables
	if (Array.isArray(rawOps)) {
		return rawOps.map((op) => String(op).trim()).filter(Boolean)
	}
	if (typeof rawOps === 'string') {
		return rawOps
			.split(/\r?\n|;/)
			.map((s) => s.trim())
			.filter(Boolean)
	}
	if (step.variable) {
		return [String(step.variable).trim()]
	}
	return []
}

watch(
	() => props.step,
	(newStep) => {
		if (!newStep) return
		const isBatch =
			newStep.type === 'variables' ||
			Array.isArray(newStep.operations) ||
			Array.isArray(newStep.variables)

		isBatchMode.value = isBatch
		soundEffect.value = newStep.sound || ''

		if (isBatch) {
			operations.value = parseOperationsFromStep(newStep)
			if (operations.value.length === 0) {
				operations.value = ['global.flag = true']
			}
			bulkTextContent.value = operations.value.join('\n')
		} else {
			singleVariable.value = newStep.variable || ''
			operations.value = newStep.variable ? [newStep.variable] : []
		}
	},
	{ deep: true, immediate: true }
)

function setBatchMode(enableBatch) {
	if (isBatchMode.value === enableBatch) return
	isBatchMode.value = enableBatch

	if (enableBatch) {
		// Convert single into operations list
		if (singleVariable.value) {
			operations.value = singleVariable.value
				.split(/\r?\n|;/)
				.map((s) => s.trim())
				.filter(Boolean)
		}
		if (operations.value.length === 0) {
			operations.value = ['global.flag = true']
		}
		bulkTextContent.value = operations.value.join('\n')
	} else {
		// Convert operations into single variable string
		singleVariable.value = operations.value.join('; ')
	}
	emitUpdate()
}

function enterBulkMode() {
	bulkTextContent.value = operations.value.join('\n')
	isBulkTextMode.value = true
}

function syncFromBulkText() {
	operations.value = bulkTextContent.value
		.split(/\r?\n/)
		.map((s) => s.trim())
		.filter(Boolean)
	emitUpdate()
}

function addOperation() {
	operations.value.push('')
	emitUpdate()
}

function removeOperation(index) {
	operations.value.splice(index, 1)
	if (operations.value.length === 0) {
		operations.value.push('')
	}
	emitUpdate()
}

function moveOperation(fromIdx, toIdx) {
	if (toIdx < 0 || toIdx >= operations.value.length) return
	const item = operations.value.splice(fromIdx, 1)[0]
	operations.value.splice(toIdx, 0, item)
	emitUpdate()
}

function applyPreset(code) {
	if (!isBatchMode.value) {
		singleVariable.value = code
	} else {
		const parts = code
			.split(';')
			.map((s) => s.trim())
			.filter(Boolean)
		// If only 1 empty operation exists, replace it
		if (operations.value.length === 1 && !operations.value[0]) {
			operations.value = parts
		} else {
			operations.value.push(...parts)
		}
		bulkTextContent.value = operations.value.join('\n')
	}
	emitUpdate()
}

function emitUpdate() {
	const base = { ...props.step }

	if (!isBatchMode.value) {
		delete base.type
		delete base.operations
		delete base.variables
		base.variable = singleVariable.value
	} else {
		base.type = 'variables'
		delete base.variable
		delete base.variables
		base.operations = operations.value.map((op) => op.trim()).filter(Boolean)
	}

	if (soundEffect.value) {
		base.sound = soundEffect.value
	} else {
		delete base.sound
	}

	emit('update', base)
}
</script>

<style scoped>
.step-form {
	display: flex;
	flex-direction: column;
	gap: 0.9em;
	color: #e2e8f0;
}

.mode-switch-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding-bottom: 0.5em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.mode-toggle-group {
	display: flex;
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	overflow: hidden;
}

.mode-toggle-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	padding: 0.35em 0.7em;
	font-size: 0.8em;
	cursor: pointer;
	transition: all 0.15s;
}

.mode-toggle-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	font-weight: 600;
}

.form-group {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.batch-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.batch-view-toggle {
	display: flex;
	gap: 0.25em;
}

.view-toggle-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	color: #94a3b8;
	font-size: 0.75em;
	padding: 0.2em 0.5em;
	cursor: pointer;
	transition: all 0.15s;
}

.view-toggle-btn.__active {
	background: rgba(56, 189, 248, 0.2);
	border-color: rgba(56, 189, 248, 0.4);
	color: #38bdf8;
}

.form-label {
	font-size: 0.85em;
	font-weight: 600;
	color: #cbd5e1;
}

.form-hint {
	font-size: 0.74em;
	color: #64748b;
	line-height: 1.3;
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

.form-textarea {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.5em 0.75em;
	font-size: 0.85em;
	color: #f8fafc;
	outline: none;
	resize: vertical;
	box-sizing: border-box;
	line-height: 1.4;
	transition: border-color 0.2s;
}

.form-textarea:focus {
	border-color: #f6c445;
}

.code-font {
	font-family: Consolas, monospace;
	color: #38bdf8;
}

/* Operations List */
.operations-list {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.operation-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.op-index {
	font-size: 0.75em;
	color: #64748b;
	width: 1.8em;
	text-align: right;
	font-family: Consolas, monospace;
}

.op-input {
	flex: 1;
	font-size: 0.82em;
	padding: 0.4em 0.6em;
}

.op-actions {
	display: flex;
	gap: 0.2em;
}

.op-action-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	color: #94a3b8;
	font-size: 0.75em;
	padding: 0.3em 0.45em;
	cursor: pointer;
	transition: all 0.15s;
}

.op-action-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.op-action-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #fca5a5;
	border-color: rgba(239, 68, 68, 0.5);
}

.op-action-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.add-op-btn {
	align-self: flex-start;
	background: rgba(246, 196, 69, 0.12);
	border: 1px dashed rgba(246, 196, 69, 0.4);
	border-radius: 0.35em;
	color: #f6c445;
	font-size: 0.8em;
	font-weight: 600;
	padding: 0.4em 0.8em;
	cursor: pointer;
	transition: all 0.15s;
	margin-top: 0.2em;
}

.add-op-btn:hover {
	background: rgba(246, 196, 69, 0.22);
	border-color: #f6c445;
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
