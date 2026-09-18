<template>
	<div class="step-form">
		<!-- Scene ID Dropdown / Input -->
		<div class="form-group">
			<label class="form-label">Идентификатор сцены:</label>
			<select
				v-model="selectedScene"
				class="form-select"
				@change="onSceneSelect"
			>
				<option v-for="sc in scenes" :key="sc" :value="sc">
					{{ sc }}
				</option>
				<option value="_custom_">-- Ввести свой ID сцены --</option>
			</select>
			<div v-if="isCustomScene" class="custom-input-wrap">
				<input
					v-model="customSceneId"
					type="text"
					placeholder="Например: dark_forest_clearing"
					class="form-input"
					@input="applyCustomScene"
				/>
			</div>
		</div>

		<!-- Scene Modifiers (mods) -->
		<div class="form-group">
			<label class="form-label">Модификаторы сцены (mods):</label>
			<div class="mods-selector">
				<label
					v-for="mod in availableMods"
					:key="mod.id"
					class="mod-checkbox-label"
				>
					<input
						type="checkbox"
						:checked="hasMod(mod.id)"
						@change="toggleMod(mod.id)"
					/>
					<span>{{ mod.label }}</span>
				</label>
			</div>
			<!-- Custom mod input -->
			<div class="custom-mod-row">
				<input
					v-model="newModInput"
					type="text"
					placeholder="Свой мод (например: rain)"
					class="form-input"
					@keydown.enter="addCustomMod"
				/>
				<button
					type="button"
					class="mod-add-btn"
					:disabled="!newModInput.trim()"
					@click="addCustomMod"
				>
					+ Добавить
				</button>
			</div>
			<!-- Active mods tags -->
			<div v-if="model.mods && model.mods.length" class="active-mods-tags">
				<span
					v-for="m in model.mods"
					:key="m"
					class="mod-tag"
				>
					{{ m }}
					<button
						type="button"
						class="mod-tag-remove"
						@click="removeMod(m)"
					>
						×
					</button>
				</span>
			</div>
		</div>

		<!-- Fade Transition -->
		<div class="form-group">
			<label class="form-label">Длительность затемнения (Fade в сек.):</label>
			<input
				v-model.number="model.fade"
				type="number"
				step="0.1"
				min="0"
				max="5"
				placeholder="0.35"
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
	},
	scenes: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['update'])

const model = ref({ ...props.step })
const selectedScene = ref('')
const isCustomScene = ref(false)
const customSceneId = ref('')
const newModInput = ref('')

const availableMods = [
	{ id: 'fog', label: '🌫️ Туман (fog)' },
	{ id: 'night', label: '🌙 Ночь (night)' },
	{ id: 'sunset', label: '🌅 Закат (sunset)' },
	{ id: 'rain', label: '🌧️ Дождь (rain)' }
]

watch(
	() => props.step,
	(newStep) => {
		model.value = { ...newStep }
		const currentId = newStep.id || newStep.scene || ''
		if (props.scenes.includes(currentId)) {
			selectedScene.value = currentId
			isCustomScene.value = false
		} else if (currentId) {
			selectedScene.value = '_custom_'
			isCustomScene.value = true
			customSceneId.value = currentId
		} else {
			selectedScene.value = props.scenes[0] || 'city_street'
			isCustomScene.value = false
		}
	},
	{ deep: true, immediate: true }
)

function onSceneSelect(e) {
	if (e.target.value === '_custom_') {
		isCustomScene.value = true
		customSceneId.value = ''
		model.value.id = ''
	} else {
		isCustomScene.value = false
		model.value.id = e.target.value
	}
	emitUpdate()
}

function applyCustomScene() {
	model.value.id = customSceneId.value.trim()
	emitUpdate()
}

function hasMod(modId) {
	return Array.isArray(model.value.mods) && model.value.mods.includes(modId)
}

function toggleMod(modId) {
	if (!Array.isArray(model.value.mods)) model.value.mods = []
	const idx = model.value.mods.indexOf(modId)
	if (idx >= 0) {
		model.value.mods.splice(idx, 1)
	} else {
		model.value.mods.push(modId)
	}
	if (model.value.mods.length === 0) delete model.value.mods
	emitUpdate()
}

function addCustomMod() {
	const val = newModInput.value.trim().toLowerCase()
	if (!val) return
	if (!Array.isArray(model.value.mods)) model.value.mods = []
	if (!model.value.mods.includes(val)) {
		model.value.mods.push(val)
	}
	newModInput.value = ''
	emitUpdate()
}

function removeMod(modId) {
	if (!Array.isArray(model.value.mods)) return
	const idx = model.value.mods.indexOf(modId)
	if (idx >= 0) {
		model.value.mods.splice(idx, 1)
	}
	if (model.value.mods.length === 0) delete model.value.mods
	emitUpdate()
}

function emitUpdate() {
	const clean = { ...model.value }
	if (!clean.fade && clean.fade !== 0) delete clean.fade
	if (clean.mods && clean.mods.length === 0) delete clean.mods
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

.custom-input-wrap {
	margin-top: 0.4em;
}

.mods-selector {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6em;
	margin-top: 0.2em;
}

.mod-checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.35em;
	font-size: 0.82em;
	color: #cbd5e1;
	cursor: pointer;
}

.custom-mod-row {
	display: flex;
	gap: 0.4em;
	margin-top: 0.4em;
}

.custom-mod-row .form-input {
	flex: 1;
}

.mod-add-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	color: #cbd5e1;
	font-size: 0.82em;
	padding: 0 0.7em;
	cursor: pointer;
}

.mod-add-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.active-mods-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35em;
	margin-top: 0.3em;
}

.mod-tag {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	background: rgba(246, 196, 69, 0.15);
	border: 1px solid rgba(246, 196, 69, 0.3);
	color: #f6c445;
	border-radius: 0.3em;
	padding: 0.15em 0.5em;
	font-size: 0.78em;
}

.mod-tag-remove {
	background: transparent;
	border: none;
	color: #f6c445;
	cursor: pointer;
	font-size: 1.1em;
	padding: 0;
	line-height: 1;
}
</style>
