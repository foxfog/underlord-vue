<template>
	<div class="step-form">
		<!-- Audio Action Sub-Type -->
		<div class="form-group">
			<label class="form-label">Тип аудио-действия:</label>
			<div class="audio-type-selector">
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'music' }"
					@click="changeAudioType('music')"
				>
					🎵 Музыка (BGM)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'sound' }"
					@click="changeAudioType('sound')"
				>
					🔊 Звуковой эффект (SFX)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'voice' }"
					@click="changeAudioType('voice')"
				>
					🗣️ Голос (Voice)
				</button>
				<button
					type="button"
					class="type-btn"
					:class="{ __active: model.type === 'stop-stream' }"
					@click="changeAudioType('stop-stream')"
				>
					⏹️ Остановить поток
				</button>
			</div>
		</div>

		<!-- File Path (if not stop-stream) -->
		<div v-if="model.type !== 'stop-stream'" class="form-group">
			<label class="form-label">Путь к аудиофайлу:</label>
			<input
				v-model="model.file"
				type="text"
				placeholder="audio/music/star_wars_title.mp3"
				class="form-input"
				@input="emitUpdate"
			/>
		</div>

		<!-- Stream Name -->
		<div class="form-group">
			<label class="form-label">Имя аудио-потока (stream):</label>
			<select
				v-model="selectedStream"
				class="form-select"
				@change="onStreamSelect"
			>
				<option v-for="s in streams" :key="s" :value="s">
					{{ s }}
				</option>
				<option value="_custom_">-- Ввести свой поток --</option>
			</select>
			<div v-if="isCustomStream" class="custom-input-wrap">
				<input
					v-model="customStreamName"
					type="text"
					placeholder="Например: ambient_wind"
					class="form-input"
					@input="applyCustomStream"
				/>
			</div>
		</div>

		<!-- Loop Checkbox (if playing audio) -->
		<div v-if="model.type !== 'stop-stream'" class="form-group">
			<label class="checkbox-label">
				<input
					v-model="model.loop"
					type="checkbox"
					@change="emitUpdate"
				/>
				<span>Зациклить воспроизведение (loop)</span>
			</label>
		</div>

		<!-- Volume Slider (Optional) -->
		<div v-if="model.type !== 'stop-stream'" class="form-group">
			<div class="label-with-val">
				<label class="form-label">Громкость (0-100%):</label>
				<span class="val-badge">{{ model.volume !== undefined ? model.volume : 100 }}%</span>
			</div>
			<input
				v-model.number="model.volume"
				type="range"
				min="0"
				max="100"
				class="form-range"
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
	streams: {
		type: Array,
		default: () => ['bgm', 'sfx', 'voice', 'ambient', 'swt', 'factory', 'back']
	}
})

const emit = defineEmits(['update'])

const model = ref({ ...props.step })
const selectedStream = ref('')
const isCustomStream = ref(false)
const customStreamName = ref('')

watch(
	() => props.step,
	(newStep) => {
		model.value = { ...newStep }
		const curStream = newStep.stream || (newStep.type === 'music' ? 'bgm' : 'sfx')
		if (props.streams.includes(curStream)) {
			selectedStream.value = curStream
			isCustomStream.value = false
		} else if (curStream) {
			selectedStream.value = '_custom_'
			isCustomStream.value = true
			customStreamName.value = curStream
		} else {
			selectedStream.value = props.streams[0] || 'bgm'
			isCustomStream.value = false
		}
	},
	{ deep: true, immediate: true }
)

function changeAudioType(newType) {
	model.value.type = newType
	if (newType === 'music') {
		model.value.loop = true
		model.value.stream = 'bgm'
		if (!model.value.file) model.value.file = 'audio/music/intro.mp3'
	} else if (newType === 'sound') {
		model.value.loop = false
		model.value.stream = 'sfx'
		if (!model.value.file) model.value.file = 'audio/sound/click.mp3'
	} else if (newType === 'voice') {
		model.value.loop = false
		model.value.stream = 'voice'
	} else if (newType === 'stop-stream') {
		delete model.value.file
		delete model.value.loop
		delete model.value.volume
	}
	emitUpdate()
}

function onStreamSelect(e) {
	if (e.target.value === '_custom_') {
		isCustomStream.value = true
		customStreamName.value = ''
		model.value.stream = ''
	} else {
		isCustomStream.value = false
		model.value.stream = e.target.value
	}
	emitUpdate()
}

function applyCustomStream() {
	model.value.stream = customStreamName.value.trim()
	emitUpdate()
}

function emitUpdate() {
	const clean = { ...model.value }
	if (clean.volume === 100 || clean.volume === undefined) delete clean.volume
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

.audio-type-selector {
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

.custom-input-wrap {
	margin-top: 0.4em;
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
	color: #cbd5e1;
	cursor: pointer;
}

.label-with-val {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.val-badge {
	font-size: 0.8em;
	color: #f6c445;
	font-weight: 600;
}

.form-range {
	accent-color: #f6c445;
	cursor: pointer;
}
</style>
