<template>
	<div class="step-form">
		<!-- Dialogue Mode (Single vs Multi-step) -->
		<div class="form-group">
			<label class="form-label">Структура диалога:</label>
			<div class="structure-type-selector">
				<button
					type="button"
					class="type-btn"
					:class="{ __active: structureMode === 'single' }"
					@click="setStructureMode('single')"
				>
					💬 Одиночная реплика
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: structureMode === 'multi' }"
					@click="setStructureMode('multi')"
				>
					📑 Многошаговый диалог ({{ subStepsList.length }} реплик)
				</button>
			</div>
		</div>

		<!-- Optional Dialogue ID -->
		<div class="form-group">
			<label class="form-label">ID диалога (необязательно, для меток и стилей):</label>
			<input
				v-model="model.id"
				type="text"
				placeholder="Например: location_time_info"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- Speaker Type Selector -->
		<div class="form-group">
			<label class="form-label">Говорящий (по умолчанию):</label>
			<div class="speaker-type-selector">
				<button
					type="button"
					class="type-btn"
					:class="{ __active: speakerType === 'character' }"
					@click="setSpeakerType('character')"
				>
					👤 Персонаж
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: speakerType === 'narration' }"
					@click="setSpeakerType('narration')"
				>
					📖 Повествование (Без имени)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: speakerType === 'custom' }"
					@click="setSpeakerType('custom')"
				>
					✏️ Кастомное имя
				</button>
			</div>
		</div>

		<!-- Character Dropdown -->
		<div v-if="speakerType === 'character'" class="form-group">
			<label class="form-label">Выберите персонажа:</label>
			<div class="character-select-row">
				<select
					v-model="model.character"
					class="form-select"
					@change="onCharacterSelect"
				>
					<option
						v-for="char in characters"
						:key="char.id"
						:value="char.id"
					>
						{{ char.name }} ({{ char.id }})
					</option>
					<option value="_custom_">-- Ввести свой ID персонажа --</option>
				</select>
			</div>
			<!-- Custom ID input if _custom_ selected -->
			<div v-if="isCustomCharId" class="custom-id-input-wrap">
				<input
					v-model="customCharId"
					type="text"
					placeholder="Введите ID (например: guard_1)"
					class="form-input"
					@input="applyCustomCharId"
				/>
			</div>
		</div>

		<!-- Custom Speaker Name Input -->
		<div v-if="speakerType === 'custom'" class="form-group">
			<label class="form-label">Отображаемое имя спикера:</label>
			<input
				v-model="model.speaker"
				type="text"
				placeholder="Голос из толпы / Незнакомец"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- Optional Title Override -->
		<div v-if="speakerType === 'character'" class="form-group">
			<label class="form-label">Титул / Отображаемое имя (необязательно):</label>
			<input
				v-model="model.title"
				type="text"
				placeholder="Оставьте пустым для автоопределения"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- ========================================== -->
		<!-- SINGLE DIALOGUE MODE                       -->
		<!-- ========================================== -->
		<div v-if="structureMode === 'single'" class="form-group">
			<div class="label-with-tags">
				<label class="form-label">Текст реплики:</label>
				<div class="quick-tags">
					<button
						type="button"
						class="tag-insert-btn"
						title="Вставить полужирный"
						@click="insertTextSingle('<b>', '</b>')"
					>
						&lt;b&gt;
					</button>
					<button
						type="button"
						class="tag-insert-btn"
						title="Вставить секретный текст"
						@click="insertTextSingle('<span class=\'secret\'>', '</span>')"
					>
						секрет
					</button>
					<button
						type="button"
						class="tag-insert-btn"
						title="Вставить мигающий текст"
						@click="insertTextSingle('<span class=\'blink\'>', '</span>')"
					>
						мигание
					</button>
					<button
						type="button"
						class="tag-insert-btn"
						title="Имя ГГ"
						@click="insertTextSingle('%character.mc.name%')"
					>
						%mc.name%
					</button>
					<button
						type="button"
						class="tag-insert-btn"
						title="Перенос строки"
						@click="insertTextSingle('<br>')"
					>
						&lt;br&gt;
					</button>
				</div>
			</div>
			<textarea
				ref="singleTextareaRef"
				v-model="model.text"
				rows="4"
				placeholder="Введите текст реплики диалога или повествования..."
				class="form-textarea"
				@input="emitUpdate"
			></textarea>
		</div>

		<!-- ========================================== -->
		<!-- MULTI-STEP DIALOGUE MODE                   -->
		<!-- ========================================== -->
		<div v-else class="form-group">
			<div class="multi-steps-header">
				<label class="form-label">Шаги диалога (steps: {{ subStepsList.length }}):</label>
				<button
					type="button"
					class="add-substep-btn"
					@click="addSubStep"
				>
					+ Добавить реплику
				</button>
			</div>

			<div class="substeps-list">
				<div
					v-for="(subStep, idx) in subStepsList"
					:key="idx"
					class="substep-card"
				>
					<div class="substep-header-row">
						<span class="substep-badge">Реплика #{{ idx + 1 }}</span>
						<div class="substep-actions">
							<button
								type="button"
								class="substep-btn"
								:disabled="idx === 0"
								title="Переместить вверх"
								@click="moveSubStep(idx, idx - 1)"
							>
								▲
							</button>
							<button
								type="button"
								class="substep-btn"
								:disabled="idx === subStepsList.length - 1"
								title="Переместить вниз"
								@click="moveSubStep(idx, idx + 1)"
							>
								▼
							</button>
							<button
								type="button"
								class="substep-btn __delete"
								title="Удалить реплику"
								@click="removeSubStep(idx)"
							>
								🗑️
							</button>
						</div>
					</div>

					<div class="label-with-tags">
						<span class="substep-field-label">Текст:</span>
						<div class="quick-tags">
							<button
								type="button"
								class="tag-insert-btn"
								@click="insertTextSub(idx, '<b>', '</b>')"
							>
								&lt;b&gt;
							</button>
							<button
								type="button"
								class="tag-insert-btn"
								@click="insertTextSub(idx, '<span class=\'secret\'>', '</span>')"
							>
								секрет
							</button>
							<button
								type="button"
								class="tag-insert-btn"
								@click="insertTextSub(idx, '<span class=\'blink\'>', '</span>')"
							>
								мигание
							</button>
							<button
								type="button"
								class="tag-insert-btn"
								@click="insertTextSub(idx, '<p>', '</p>')"
							>
								&lt;p&gt;
							</button>
							<button
								type="button"
								class="tag-insert-btn"
								@click="insertTextSub(idx, '<br>')"
							>
								&lt;br&gt;
							</button>
						</div>
					</div>

					<textarea
						:id="`substep-textarea-${idx}`"
						v-model="subStep.text"
						rows="3"
						placeholder="Текст подшага..."
						class="form-textarea"
						@input="emitUpdate"
					></textarea>
				</div>
			</div>
		</div>

		<!-- Voice / Sound Option -->
		<div class="form-group">
			<label class="form-label">Звук / Озвучка (необязательно):</label>
			<input
				v-model="model.sound"
				type="text"
				placeholder="audio/voice/ralof/intro_1.wav"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
	step: {
		type: Object,
		required: true
	},
	characters: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['update'])

const singleTextareaRef = ref(null)
const model = ref({ ...props.step })
const isCustomCharId = ref(false)
const customCharId = ref('')

// Structure mode: single vs multi
const structureMode = ref('single')

// Speaker type: character vs narration vs custom
const speakerType = ref('narration')

const subStepsList = computed(() => {
	if (!Array.isArray(model.value.steps)) {
		model.value.steps = []
	}
	return model.value.steps
})

watch(
	() => props.step,
	(newStep) => {
		model.value = JSON.parse(JSON.stringify(newStep))

		// Detect structure mode
		if (Array.isArray(newStep.steps)) {
			structureMode.value = 'multi'
		} else {
			structureMode.value = 'single'
		}

		// Detect speaker type
		if (newStep.character) {
			speakerType.value = 'character'
			const found = props.characters.some((c) => c.id === newStep.character)
			if (!found && newStep.character) {
				isCustomCharId.value = true
				customCharId.value = newStep.character
			} else {
				isCustomCharId.value = false
			}
		} else if (newStep.speaker || newStep.title) {
			speakerType.value = 'custom'
		} else {
			speakerType.value = 'narration'
		}
	},
	{ deep: true, immediate: true }
)

function setStructureMode(mode) {
	structureMode.value = mode
	if (mode === 'multi') {
		if (!Array.isArray(model.value.steps)) {
			model.value.steps = model.value.text ? [{ text: model.value.text }] : [{ text: '' }]
		}
		delete model.value.text
	} else {
		if (Array.isArray(model.value.steps) && model.value.steps.length > 0) {
			model.value.text = model.value.steps[0].text || ''
		} else {
			model.value.text = ''
		}
		delete model.value.steps
	}
	emitUpdate()
}

function setSpeakerType(type) {
	speakerType.value = type
	if (type === 'character') {
		model.value.character = model.value.character || 'mc'
		delete model.value.speaker
	} else if (type === 'narration') {
		delete model.value.character
		delete model.value.speaker
		delete model.value.title
	} else if (type === 'custom') {
		delete model.value.character
		model.value.speaker = model.value.speaker || ''
	}
	emitUpdate()
}

function onCharacterSelect(e) {
	if (e.target.value === '_custom_') {
		isCustomCharId.value = true
		customCharId.value = ''
		model.value.character = ''
	} else {
		isCustomCharId.value = false
		model.value.character = e.target.value
	}
	emitUpdate()
}

function applyCustomCharId() {
	model.value.character = customCharId.value.trim()
	emitUpdate()
}

function addSubStep() {
	if (!Array.isArray(model.value.steps)) {
		model.value.steps = []
	}
	model.value.steps.push({ text: '' })
	emitUpdate()
}

function removeSubStep(idx) {
	if (!Array.isArray(model.value.steps)) return
	model.value.steps.splice(idx, 1)
	emitUpdate()
}

function moveSubStep(fromIdx, toIdx) {
	if (
		!Array.isArray(model.value.steps) ||
		fromIdx < 0 ||
		fromIdx >= model.value.steps.length ||
		toIdx < 0 ||
		toIdx >= model.value.steps.length
	)
		return
	const item = model.value.steps.splice(fromIdx, 1)[0]
	model.value.steps.splice(toIdx, 0, item)
	emitUpdate()
}

function insertTextSingle(startTag, endTag = '') {
	const textarea = singleTextareaRef.value
	if (!textarea) return

	const start = textarea.selectionStart
	const end = textarea.selectionEnd
	const val = model.value.text || ''
	const selected = val.substring(start, end)
	const replacement = startTag + selected + endTag

	model.value.text = val.substring(0, start) + replacement + val.substring(end)
	emitUpdate()

	setTimeout(() => {
		textarea.focus()
		const newPos = start + startTag.length + selected.length
		textarea.setSelectionRange(newPos, newPos)
	}, 10)
}

function insertTextSub(idx, startTag, endTag = '') {
	const textarea = document.getElementById(`substep-textarea-${idx}`)
	if (!textarea || !model.value.steps[idx]) return

	const start = textarea.selectionStart
	const end = textarea.selectionEnd
	const val = model.value.steps[idx].text || ''
	const selected = val.substring(start, end)
	const replacement = startTag + selected + endTag

	model.value.steps[idx].text = val.substring(0, start) + replacement + val.substring(end)
	emitUpdate()

	setTimeout(() => {
		textarea.focus()
		const newPos = start + startTag.length + selected.length
		textarea.setSelectionRange(newPos, newPos)
	}, 10)
}

function emitUpdate() {
	const clean = JSON.parse(JSON.stringify(model.value))
	if (!clean.id) delete clean.id
	if (!clean.title) delete clean.title
	if (!clean.sound) delete clean.sound
	if (!clean.speaker && speakerType.value !== 'custom') delete clean.speaker
	if (!clean.character && speakerType.value !== 'character') delete clean.character
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

.structure-type-selector,
.speaker-type-selector {
	display: flex;
	gap: 0.4em;
	flex-wrap: wrap;
}

.type-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.4em 0.7em;
	font-size: 0.82em;
	color: #94a3b8;
	cursor: pointer;
	transition: all 0.2s;
}

.type-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.type-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	border-color: #f6c445;
	color: #f6c445;
	font-weight: 700;
}

.form-select,
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

.form-select:focus,
.form-input:focus,
.form-textarea:focus {
	border-color: #f6c445;
}

.custom-id-input-wrap {
	margin-top: 0.4em;
}

.label-with-tags {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.quick-tags {
	display: flex;
	gap: 0.3em;
}

.tag-insert-btn {
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.3);
	border-radius: 0.3em;
	color: #38bdf8;
	font-size: 0.75em;
	padding: 0.15em 0.45em;
	cursor: pointer;
	transition: background 0.15s;
}

.tag-insert-btn:hover {
	background: rgba(56, 189, 248, 0.3);
}

.form-textarea {
	resize: vertical;
	line-height: 1.4;
}

/* Multi-steps styles */
.multi-steps-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.add-substep-btn {
	background: rgba(246, 196, 69, 0.2);
	border: 1px solid rgba(246, 196, 69, 0.4);
	color: #f6c445;
	border-radius: 0.35em;
	padding: 0.25em 0.65em;
	font-size: 0.8em;
	cursor: pointer;
	font-weight: 600;
	transition: all 0.15s;
}

.add-substep-btn:hover {
	background: rgba(246, 196, 69, 0.35);
}

.substeps-list {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	margin-top: 0.3em;
}

.substep-card {
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.substep-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.substep-badge {
	font-size: 0.8em;
	font-weight: 700;
	color: #f6c445;
}

.substep-actions {
	display: flex;
	gap: 0.2em;
}

.substep-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.85em;
	padding: 0.15em 0.3em;
	cursor: pointer;
	border-radius: 0.25em;
	transition: all 0.15s;
}

.substep-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.substep-btn:disabled {
	opacity: 0.2;
	cursor: not-allowed;
}

.substep-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.25);
	color: #ef4444;
}

.substep-field-label {
	font-size: 0.78em;
	color: #94a3b8;
}
</style>
