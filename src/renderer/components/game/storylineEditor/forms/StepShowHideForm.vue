<template>
	<div class="step-form">
		<!-- Action Subtype -->
		<div class="form-group">
			<label class="form-label">Действие со спрайтом:</label>
			<div class="action-type-selector">
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'show' }"
					@click="setActionType('show')"
				>
					👤 Показать (Show)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'hide' }"
					@click="setActionType('hide')"
				>
					👻 Скрыть (Hide)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: ['hide-all', 'clear-characters'].includes(model.type) }"
					@click="setActionType('hide-all')"
				>
					👥 Скрыть всех
				</button>
			</div>
		</div>

		<!-- Character Selector (if not hide-all) -->
		<div v-if="!['hide-all', 'clear-characters'].includes(model.type)" class="form-group">
			<label class="form-label">Персонаж:</label>
			<select
				v-model="model.character"
				class="form-select"
				@change="emitUpdate"
			>
				<option v-for="char in characters" :key="char.id" :value="char.id">
					{{ char.name }} ({{ char.id }})
				</option>
			</select>
		</div>

		<!-- Orientation & Position (if show) -->
		<template v-if="model.type === 'show'">
			<div class="form-row">
				<div class="form-group flex-1">
					<label class="form-label">Ориентация:</label>
					<select
						v-model="model.orientation"
						class="form-select"
						@change="emitUpdate"
					>
						<option value="left">Влево (left)</option>
						<option value="right">Вправо (right)</option>
					</select>
				</div>

				<div class="form-group flex-1">
					<label class="form-label">Позиция по горизонтали (%):</label>
					<input
						v-model.number="leftPos"
						type="number"
						placeholder="20"
						class="form-input"
						@input="updatePosition"
					/>
				</div>
			</div>

			<!-- Entrance Animation -->
			<div class="form-row">
				<div class="form-group flex-1">
					<label class="form-label">Начало анимации (% слева):</label>
					<input
						v-model.number="fromLeftPos"
						type="number"
						placeholder="-25"
						class="form-input"
						@input="updatePosition"
					/>
				</div>

				<div class="form-group flex-1">
					<label class="form-label">Длительность анимации (сек):</label>
					<input
						v-model.number="model.duration"
						type="number"
						step="0.1"
						placeholder="0.8"
						class="form-input"
						@input="emitUpdate"
					/>
				</div>
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
	},
	characters: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['update'])

const model = ref({ ...props.step })
const leftPos = ref(20)
const fromLeftPos = ref(-25)

watch(
	() => props.step,
	(newStep) => {
		model.value = { ...newStep }
		if (newStep.position && newStep.position.l !== undefined) {
			leftPos.value = newStep.position.l
		}
		if (newStep.from && newStep.from.l !== undefined) {
			fromLeftPos.value = newStep.from.l
		}
	},
	{ deep: true, immediate: true }
)

function setActionType(type) {
	model.value.type = type
	if (type === 'show') {
		model.value.character = model.value.character || 'mc'
		model.value.orientation = model.value.orientation || 'left'
		updatePosition()
	} else if (type === 'hide') {
		model.value.character = model.value.character || 'mc'
		delete model.value.position
		delete model.value.from
		delete model.value.orientation
	} else if (type === 'hide-all') {
		delete model.value.character
		delete model.value.position
		delete model.value.from
		delete model.value.orientation
	}
	emitUpdate()
}

function updatePosition() {
	if (model.value.type === 'show') {
		model.value.position = { l: leftPos.value, r: 'auto' }
		if (fromLeftPos.value !== undefined) {
			model.value.from = { l: fromLeftPos.value, r: 'auto' }
		}
	}
	emitUpdate()
}

function emitUpdate() {
	const clean = { ...model.value }
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

.action-type-selector {
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

.form-select:focus,
.form-input:focus {
	border-color: #f6c445;
}
</style>
