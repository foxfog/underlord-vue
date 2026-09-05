<template>
	<div class="char-create-screen">
		<div class="char-create-bg-overlay"></div>

		<!-- ВВОД НИКНЕЙМА И ВХОД -->
		<div class="char-create-container">
			<div class="char-create-header">
				<h2 class="char-create-title">СОЗДАНИЕ ПЕРСОНАЖА</h2>
				<div class="char-create-sub">YGGDRASIL™ DMMO-RPG • СЕРВЕР ЯПОНИЯ</div>
			</div>

			<div class="char-create-content">
				<!-- Превью персонажа -->
				<div class="char-preview-card">
					<div class="char-preview-avatar">
						<div class="char-avatar-circle">
							<span class="avatar-icon">⚔️</span>
						</div>
					</div>

					<div class="char-stats-box">
						<div class="char-stat-row">
							<span class="stat-label">Раса:</span>
							<span class="stat-value">Человек (Human)</span>
						</div>
						<div class="char-stat-row">
							<span class="stat-label">Пол:</span>
							<span class="stat-value">Мужской</span>
						</div>
						<div class="char-stat-row">
							<span class="stat-label">Уровень:</span>
							<span class="stat-value highlight">1</span>
						</div>
						<div class="char-stat-row">
							<span class="stat-label">Класс:</span>
							<span class="stat-value">Воин-новичок</span>
						</div>
						<div class="char-stat-row">
							<span class="stat-label">HP / MP:</span>
							<span class="stat-value">100 / 50</span>
						</div>
					</div>
				</div>

				<!-- Настройка имени и подтверждение -->
				<div class="char-form-card">
					<h3 class="form-card-title">Имя персонажа (Никнейм)</h3>
					<p class="form-card-desc">
						Выберите уникальное имя, под которым вас будут знать в девяти мирах Иггдрасиля.
					</p>

					<div class="form-input-group">
						<input
							v-model="nicknameInput"
							type="text"
							class="char-name-input"
							placeholder="Введите никнейм..."
							maxlength="18"
							@input="checkAvailability"
							@keyup.enter="handleConfirm"
							ref="inputFieldRef"
						/>
					</div>

					<!-- Статус проверки ника -->
					<div
						v-if="validationMessage"
						class="status-message"
						:class="validationStatus"
					>
						{{ validationMessage }}
					</div>

					<!-- Подсказка о занятых именах -->
					<div class="reserved-info-box">
						<span class="info-icon">ℹ️</span>
						<span>Имена основателей великих гильдий (например, Ainz Ooal Gown) зарезервированы администрацией.</span>
					</div>

					<div class="char-create-actions">
						<button
							class="btn-confirm-create"
							:disabled="!isValid"
							@click="handleConfirm"
						>
							Создать персонажа и войти в мир ➔
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { isNicknameReserved } from '../../../constants/yggdrasilConfig'

const emit = defineEmits(['character-confirmed'])

const nicknameInput = ref('')
const validationMessage = ref('')
const validationStatus = ref('')
const inputFieldRef = ref(null)

const isValid = computed(() => {
	const val = nicknameInput.value.trim()
	return val.length >= 2 && !isNicknameReserved(val)
})

onMounted(() => {
	if (inputFieldRef.value) {
		inputFieldRef.value.focus()
	}
})

function checkAvailability() {
	const val = nicknameInput.value.trim()
	if (!val) {
		validationMessage.value = ''
		validationStatus.value = ''
		return
	}

	if (val.length < 2) {
		validationMessage.value = 'Слишком короткое имя (минимум 2 символа).'
		validationStatus.value = 'error'
		return
	}

	if (isNicknameReserved(val)) {
		validationMessage.value = '⛔ Имя занято! Данный никнейм зарезервирован основателем гильдии Ainz Ooal Gown.'
		validationStatus.value = 'error'
		return
	}

	validationMessage.value = '✔ Никнейм свободен для регистрации!'
	validationStatus.value = 'success'
}

function handleConfirm() {
	checkAvailability()
	if (!isValid.value) return

	emit('character-confirmed', {
		nickname: nicknameInput.value.trim()
	})
}
</script>

<style scoped>
.char-create-screen {
	position: absolute;
	inset: 0;
	z-index: 9150;
	display: flex;
	align-items: center;
	justify-content: center;
	background: radial-gradient(circle at center, #1e1b4b 0%, #09090b 80%, #000000 100%);
	color: #f8fafc;
	font-family: 'Overlord', 'Segoe UI', serif, sans-serif;
	user-select: none;
	overflow: hidden;
	padding: 1.5em;
	font-size: calc(1 * var(--size));
}

.char-create-bg-overlay {
	position: absolute;
	inset: 0;
	background-image: radial-gradient(rgba(234, 179, 8, 0.1) 1px, transparent 0);
	background-size: 2em 2em;
	pointer-events: none;
}

.char-create-container {
	position: relative;
	z-index: 1;
	width: min(50em, 95%);
	background: rgba(15, 23, 42, 0.9);
	backdrop-filter: blur(1em);
	border: 2px solid rgba(234, 179, 8, 0.4);
	border-radius: 1em;
	box-shadow: 0 1.5em 3.5em rgba(0, 0, 0, 0.8), 0 0 2.2em rgba(234, 179, 8, 0.2);
	overflow: hidden;
}

.char-create-header {
	background: linear-gradient(180deg, rgba(234, 179, 8, 0.2) 0%, transparent 100%);
	padding: 1.5em 2em 1em;
	border-bottom: 1px solid rgba(234, 179, 8, 0.2);
	text-align: center;
}

.char-create-title {
	font-size: 1.8em;
	font-weight: 800;
	color: #fef08a;
	letter-spacing: 0.1em;
	margin: 0;
	text-shadow: 0 0 0.8em rgba(234, 179, 8, 0.5);
}

.char-create-sub {
	font-size: 0.85em;
	letter-spacing: 0.1em;
	color: #94a3b8;
	margin-top: 0.3em;
}

.char-create-content {
	display: flex;
	gap: 2em;
	padding: 2em;
}

@media (max-width: 680px) {
	.char-create-content {
		flex-direction: column;
	}
}

.char-preview-card {
	flex: 1;
	background: rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.75em;
	padding: 1.5em;
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
}

.char-preview-avatar {
	margin-bottom: 1.2em;
}

.char-avatar-circle {
	width: 6.5em;
	height: 6.5em;
	border-radius: 50%;
	background: radial-gradient(circle, #3b82f6 0%, #1e1b4b 100%);
	border: 0.2em solid #eab308;
	box-shadow: 0 0 1.25em rgba(234, 179, 8, 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
}

.avatar-icon {
	font-size: 3em;
}

.char-stats-box {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.char-stat-row {
	display: flex;
	justify-content: space-between;
	font-size: 0.9em;
	padding: 0.3em 0;
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}

.stat-label {
	color: #94a3b8;
}

.stat-value {
	color: #ffffff;
	font-weight: 600;
}

.stat-value.highlight {
	color: #eab308;
	font-weight: 700;
}

.char-form-card {
	flex: 1.4;
	display: flex;
	flex-direction: column;
	justify-content: center;
}

.form-card-title {
	font-size: 1.25em;
	color: #fef08a;
	margin-bottom: 0.4em;
}

.form-card-desc {
	font-size: 0.85em;
	color: #94a3b8;
	line-height: 1.4;
	margin-bottom: 1.2em;
}

.form-input-group {
	margin-bottom: 0.8em;
}

.char-name-input {
	width: 100%;
	background: rgba(0, 0, 0, 0.7);
	border: 2px solid rgba(234, 179, 8, 0.5);
	border-radius: 0.5em;
	padding: 0.9em 1.2em;
	color: #ffffff;
	font-size: 1.15em;
	outline: none;
	transition: all 0.2s ease;
	box-sizing: border-box;
}

.char-name-input:focus {
	border-color: #eab308;
	box-shadow: 0 0 0.9em rgba(234, 179, 8, 0.4);
}

.status-message {
	padding: 0.6em 0.9em;
	border-radius: 0.4em;
	font-size: 0.85em;
	margin-bottom: 1em;
	line-height: 1.3;
}

.status-message.error {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #fca5a5;
}

.status-message.success {
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #6ee7b7;
}

.reserved-info-box {
	display: flex;
	gap: 0.6em;
	font-size: 0.78em;
	color: #64748b;
	margin-bottom: 1.5em;
	line-height: 1.3;
}

.info-icon {
	font-size: 0.9em;
}

.char-create-actions {
	margin-top: auto;
}

.btn-confirm-create {
	width: 100%;
	background: linear-gradient(135deg, #eab308, #ca8a04);
	color: #0f172a;
	font-size: 1.05em;
	font-weight: 800;
	border: none;
	border-radius: 0.5em;
	padding: 0.9em;
	cursor: pointer;
	transition: all 0.2s ease;
	box-shadow: 0 0.25em 1.25em rgba(234, 179, 8, 0.35);
}

.btn-confirm-create:hover:not(:disabled) {
	filter: brightness(1.15);
	transform: translateY(-0.15em);
}

.btn-confirm-create:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	transform: none;
}
</style>
