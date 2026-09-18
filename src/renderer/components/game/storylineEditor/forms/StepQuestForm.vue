<template>
	<div class="step-form">
		<!-- Action -->
		<div class="form-group">
			<label class="form-label">Действие квеста:</label>
			<div class="quest-action-selector">
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.action === 'start' }"
					@click="setAction('start')"
				>
					📜 Начать (start)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.action === 'update' }"
					@click="setAction('update')"
				>
					🔄 Обновить (update)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.action === 'complete' }"
					@click="setAction('complete')"
				>
					🏆 Завершить (complete)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.action === 'fail' }"
					@click="setAction('fail')"
				>
					❌ Провалить (fail)
				</button>
			</div>
		</div>

		<!-- Quest ID -->
		<div class="form-group">
			<label class="form-label">ID квеста:</label>
			<input
				v-model="model.id"
				type="text"
				placeholder="end_and_beginning"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- Title & Description (for start/update) -->
		<template v-if="['start', 'update'].includes(model.action)">
			<div class="form-group">
				<label class="form-label">Название квеста:</label>
				<input
					v-model="model.title"
					type="text"
					placeholder="Конец и начало"
					class="form-input"
					@input="emitUpdate"
				/>
			</div>

			<div class="form-group">
				<label class="form-label">Описание:</label>
				<textarea
					v-model="model.description"
					rows="3"
					placeholder="Переживите день в мегаполисе..."
					class="form-textarea"
					@input="emitUpdate"
				></textarea>
			</div>
		</template>
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
		if (!model.value.action) model.value.action = 'start'
	},
	{ deep: true, immediate: true }
)

function setAction(act) {
	model.value.action = act
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

.form-label {
	font-size: 0.85em;
	font-weight: 600;
	color: #cbd5e1;
}

.quest-action-selector {
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
</style>
