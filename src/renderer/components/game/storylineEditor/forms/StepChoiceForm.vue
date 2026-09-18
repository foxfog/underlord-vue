<template>
	<div class="step-form">
		<!-- Prompt / Question Text -->
		<div class="form-group">
			<label class="form-label">Вопрос / Подсказка (prompt):</label>
			<input
				v-model="model.text"
				type="text"
				placeholder="Что будете делать?"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- Options List -->
		<div class="form-group">
			<div class="options-header">
				<label class="form-label">Варианты выбора ({{ optionsList.length }}):</label>
				<button
					type="button"
					class="add-opt-btn"
					@click="addOption"
				>
					+ Вариант
				</button>
			</div>

			<div class="options-list">
				<div
					v-for="(opt, idx) in optionsList"
					:key="idx"
					class="option-card"
				>
					<div class="option-row-top">
						<span class="opt-num">#{{ idx + 1 }}</span>
						<input
							v-model="opt.text"
							type="text"
							placeholder="Текст кнопки выбора..."
							class="form-input opt-text-input"
							@input="onOptionChanged"
						/>
						<div class="opt-actions">
							<button
								type="button"
								class="opt-order-btn"
								:disabled="idx === 0"
								title="Поднять вариант выше"
								@click="moveOption(idx, -1)"
							>
								▲
							</button>
							<button
								type="button"
								class="opt-order-btn"
								:disabled="idx === optionsList.length - 1"
								title="Опустить вариант ниже"
								@click="moveOption(idx, 1)"
							>
								▼
							</button>
							<button
								type="button"
								class="opt-remove-btn"
								title="Удалить вариант"
								@click="removeOption(idx)"
							>
								🗑️
							</button>
						</div>
					</div>

					<div class="option-row-bottom">
						<!-- Target Goto -->
						<div class="opt-subfield">
							<span class="subfield-label">Цель (goto):</span>
							<input
								:value="getOptionTarget(opt)"
								type="text"
								placeholder="chapter/next_scene"
								class="form-input opt-sub-input"
								@input="(e) => setOptionTarget(opt, e.target.value)"
							/>
						</div>

						<!-- Disabled Condition -->
						<div class="opt-subfield">
							<span class="subfield-label">Блокировка (disabled):</span>
							<input
								v-model="opt.disabled"
								type="text"
								placeholder="{global.flag === true}"
								class="form-input opt-sub-input"
								@input="onOptionChanged"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
	step: {
		type: Object,
		required: true
	}
})

const emit = defineEmits(['update'])

const model = ref({ ...props.step })

const optionsList = computed(() => {
	if (!model.value.options && !model.value.choices) {
		model.value.options = []
	}
	return model.value.options || model.value.choices || []
})

watch(
	() => props.step,
	(newStep) => {
		model.value = JSON.parse(JSON.stringify(newStep))
		if (!model.value.options && !model.value.choices) {
			model.value.options = []
		}
	},
	{ deep: true, immediate: true }
)

function getOptionTarget(opt) {
	if (opt.goto) return opt.goto
	if (opt.target) return opt.target
	if (opt.actions && Array.isArray(opt.actions)) {
		const gotoAction = opt.actions.find((a) => a.type === 'goto')
		if (gotoAction) return gotoAction.target || gotoAction.id || ''
	}
	return ''
}

function setOptionTarget(opt, value) {
	const val = value.trim()
	if (opt.actions && Array.isArray(opt.actions)) {
		const gotoAction = opt.actions.find((a) => a.type === 'goto')
		if (gotoAction) {
			gotoAction.target = val
		} else {
			opt.actions.push({ type: 'goto', target: val })
		}
	} else {
		opt.actions = [{ type: 'goto', target: val }]
	}
	onOptionChanged()
}

function addOption() {
	const list = model.value.options || model.value.choices
	list.push({
		text: `Вариант ${list.length + 1}`,
		actions: [{ type: 'goto', target: '' }]
	})
	onOptionChanged()
}

function removeOption(idx) {
	const list = model.value.options || model.value.choices
	list.splice(idx, 1)
	onOptionChanged()
}

function moveOption(idx, direction) {
	const list = model.value.options || model.value.choices
	const targetIdx = idx + direction
	if (targetIdx < 0 || targetIdx >= list.length) return
	const item = list.splice(idx, 1)[0]
	list.splice(targetIdx, 0, item)
	onOptionChanged()
}

function onOptionChanged() {
	emitUpdate()
}

function emitUpdate() {
	emit('update', JSON.parse(JSON.stringify(model.value)))
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

.options-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.add-opt-btn {
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

.add-opt-btn:hover {
	background: rgba(246, 196, 69, 0.35);
}

.options-list {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	margin-top: 0.2em;
}

.option-card {
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.option-row-top {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.opt-num {
	font-size: 0.8em;
	font-weight: 700;
	color: #f6c445;
	min-width: 1.6em;
}

.opt-text-input {
	flex: 1;
}

.opt-actions {
	display: flex;
	align-items: center;
	gap: 0.25em;
}

.opt-order-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	font-size: 0.65em;
	padding: 0.25em 0.45em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: all 0.15s;
}

.opt-order-btn:hover:not(:disabled) {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.opt-order-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.opt-remove-btn {
	background: transparent;
	border: none;
	cursor: pointer;
	font-size: 0.9em;
	padding: 0.2em;
	border-radius: 0.25em;
}

.opt-remove-btn:hover {
	background: rgba(239, 68, 68, 0.2);
}

.option-row-bottom {
	display: flex;
	gap: 0.6em;
	flex-wrap: wrap;
}

.opt-subfield {
	flex: 1;
	min-width: 10em;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.subfield-label {
	font-size: 0.75em;
	color: #94a3b8;
}

.opt-sub-input {
	padding: 0.35em 0.6em;
	font-size: 0.82em;
}
</style>
