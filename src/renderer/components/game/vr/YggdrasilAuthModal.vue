<template>
	<div class="mmo-auth-screen">
		<!-- Фоновое изображение YGGDRASIL с эффектом виньетки -->
		<div class="mmo-bg-wrap">
			<img :src="yggdrasilBgPath" alt="YGGDRASIL Background" class="mmo-bg-img" />
			<div class="mmo-bg-overlay"></div>
		</div>

		<!-- Верхний логотип -->
		<div class="mmo-header">
			<h1 class="mmo-logo-title">YGGDRASIL</h1>
			<div class="mmo-logo-subtitle">DIVE MASSIVELY MULTIPLAYER ONLINE RPG</div>
		</div>

		<!-- Окно авторизации / регистрации в стиле классических MMO -->
		<div class="mmo-auth-modal">
			<div class="mmo-tabs">
				<button
					class="mmo-tab"
					:class="{ active: currentTab === 'login' }"
					@click="currentTab = 'login'"
				>
					Вход
				</button>
				<button
					class="mmo-tab"
					:class="{ active: currentTab === 'register' }"
					@click="startAutoRegister"
				>
					Быстрая регистрация
				</button>
			</div>

			<!-- ВКЛАДКА: ВХОД -->
			<div v-if="currentTab === 'login'" class="mmo-tab-body">
				<div class="mmo-form-group">
					<label class="mmo-label">Игровой логин / ID:</label>
					<input
						v-model="loginInput"
						type="text"
						class="mmo-input"
						placeholder="Введите ваш логин..."
						@keyup.enter="handleLoginSubmit"
					/>
				</div>

				<div class="mmo-form-group">
					<label class="mmo-label">Пароль нейро-ключа:</label>
					<input
						v-model="passwordInput"
						type="password"
						class="mmo-input"
						placeholder="••••••••••••"
						@keyup.enter="handleLoginSubmit"
					/>
				</div>

				<div v-if="loginError" class="mmo-error-banner">
					{{ loginError }}
				</div>

				<div class="mmo-buttons-row">
					<button class="mmo-btn-secondary" @click="$emit('back-to-launcher')">
						Назад
					</button>
					<button class="mmo-btn-primary" @click="handleLoginSubmit">
						Войти в игру
					</button>
				</div>

				<div class="mmo-hint-row">
					<span>Впервые в игре?</span>
					<a href="#" class="mmo-link" @click.prevent="startAutoRegister">Создать новый аккаунт</a>
				</div>
			</div>

			<!-- ВКЛАДКА: РЕГИСТРАЦИЯ (АВТОМАТИЧЕСКАЯ) -->
			<div v-else class="mmo-tab-body">
				<div class="auto-reg-banner">
					<span class="reg-spinner" v-if="isAutoFilling"></span>
					<span>{{ autoRegStatus }}</span>
				</div>

				<div class="mmo-form-group">
					<label class="mmo-label">Новый логин:</label>
					<input
						:value="regLoginDisplay"
						type="text"
						class="mmo-input readonly-input"
						readonly
					/>
				</div>

				<div class="mmo-form-group">
					<label class="mmo-label">Пароль:</label>
					<input
						:value="regPasswordDisplay"
						type="password"
						class="mmo-input readonly-input"
						readonly
					/>
				</div>

				<div class="mmo-form-group checkbox-group">
					<input
						type="checkbox"
						id="agree"
						:checked="regAgreed"
						disabled
					/>
					<label for="agree" class="mmo-checkbox-label">
						Согласен с правилами DMMO-RPG YGGDRASIL
					</label>
				</div>

				<div class="mmo-buttons-row">
					<button
						class="mmo-btn-secondary"
						:disabled="isAutoFilling"
						@click="currentTab = 'login'"
					>
						Отмена
					</button>
					<button
						class="mmo-btn-primary"
						:disabled="!regReady"
						@click="completeRegistration"
					>
						{{ regReady ? 'Продолжить к созданию персонажа ➔' : 'Заполнение данных...' }}
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { isNicknameReserved } from '../../../constants/yggdrasilConfig'

const emit = defineEmits(['auth-success', 'back-to-launcher'])

const currentTab = ref('login')
const loginInput = ref('')
const passwordInput = ref('')
const loginError = ref('')

const isAutoFilling = ref(false)
const regLoginDisplay = ref('')
const regPasswordDisplay = ref('')
const regAgreed = ref(false)
const regReady = ref(false)
const autoRegStatus = ref('Персонаж автоматически генерирует учетную запись...')

const yggdrasilBgPath = computed(() => {
	const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
	return `${base}images/sprites/backgrounds/YGGDRASIL.webp`
})

function handleLoginSubmit() {
	const cleanLogin = loginInput.value.trim().toLowerCase()
	const cleanPass = passwordInput.value.trim()

	if (!cleanLogin) {
		loginError.value = 'Введите логин аккаунта.'
		return
	}

	// Пасхалка для Момонги
	if (cleanLogin === 'momonga' || cleanLogin === 'момонга') {
		loginError.value = '⚠️ Ошибка сессии: Пользователь Momonga уже находится в игре в Тронном зале Назарика!'
		return
	}

	// Пасхалка для других имен Overlord
	if (isNicknameReserved(cleanLogin)) {
		loginError.value = '⚠️ Ошибка доступа: Данный аккаунт принадлежит основателям гильдии Ainz Ooal Gown.'
		return
	}

	// Обычная ошибка при попытке угадать
	loginError.value = '⛔ Ошибка: Неверный логин или пароль. Если у вас нет учетной записи, воспользуйтесь быстрой регистрацией.'
}

function startAutoRegister() {
	currentTab.value = 'register'
	regLoginDisplay.value = ''
	regPasswordDisplay.value = ''
	regAgreed.value = false
	regReady.value = false
	isAutoFilling.value = true
	autoRegStatus.value = 'Автозаполнение данных учетной записи...'

	// Симулируем набор данных
	const targetLogin = 'User2138_Anon'
	const targetPass = 'SecretPass2138'
	let i = 0

	const typeInterval = setInterval(() => {
		if (i < targetLogin.length) {
			regLoginDisplay.value += targetLogin[i]
			i++
		} else {
			clearInterval(typeInterval)
			regPasswordDisplay.value = '••••••••••••'
			regAgreed.value = true
			isAutoFilling.value = false
			regReady.value = true
			autoRegStatus.value = '✔ Учетная запись сгенерирована! Нажмите кнопку для продолжения.'
		}
	}, 60)
}

function completeRegistration() {
	emit('auth-success', { account: regLoginDisplay.value })
}
</script>

<style scoped>
.mmo-auth-screen {
	position: absolute;
	inset: 0;
	z-index: 9100;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-family: 'Overlord', 'Segoe UI', serif, sans-serif;
	user-select: none;
	overflow: hidden;
	font-size: calc(1 * var(--size));
}

.mmo-bg-wrap {
	position: absolute;
	inset: 0;
	z-index: 0;
}

.mmo-bg-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	filter: brightness(0.8) contrast(1.1);
	transform: scale(1.03);
	animation: slowZoom 20s infinite alternate ease-in-out;
}

.mmo-bg-overlay {
	position: absolute;
	inset: 0;
	background: radial-gradient(circle at center, rgba(15, 23, 42, 0.5) 0%, rgba(2, 6, 23, 0.85) 100%);
}

.mmo-header {
	position: relative;
	z-index: 1;
	text-align: center;
	margin-bottom: 2em;
}

.mmo-logo-title {
	font-size: 3.5em;
	font-weight: 900;
	letter-spacing: 0.15em;
	color: #fef08a;
	text-shadow: 0 0 0.4em rgba(234, 179, 8, 0.6), 0 0 0.8em rgba(202, 138, 4, 0.4);
	margin: 0;
}

.mmo-logo-subtitle {
	font-size: 0.95em;
	letter-spacing: 0.25em;
	color: #cbd5e1;
	text-transform: uppercase;
	margin-top: 0.4em;
}

.mmo-auth-modal {
	position: relative;
	z-index: 1;
	width: min(29em, 92%);
	background: rgba(15, 23, 42, 0.88);
	backdrop-filter: blur(0.75em);
	border: 2px solid rgba(234, 179, 8, 0.4);
	border-radius: 0.75em;
	box-shadow: 0 1.25em 3em rgba(0, 0, 0, 0.8), 0 0 2em rgba(234, 179, 8, 0.15);
	overflow: hidden;
}

.mmo-tabs {
	display: flex;
	border-bottom: 2px solid rgba(234, 179, 8, 0.3);
	background: rgba(0, 0, 0, 0.4);
}

.mmo-tab {
	flex: 1;
	padding: 1em;
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1em;
	font-weight: 600;
	letter-spacing: 0.05em;
	cursor: pointer;
	transition: all 0.2s ease;
}

.mmo-tab:hover {
	color: #fef08a;
}

.mmo-tab.active {
	color: #fef08a;
	background: rgba(234, 179, 8, 0.15);
	border-bottom: 0.2em solid #eab308;
}

.mmo-tab-body {
	padding: 2em;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
}

.mmo-form-group {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.mmo-label {
	font-size: 0.85em;
	color: #cbd5e1;
	letter-spacing: 0.05em;
}

.mmo-input {
	background: rgba(0, 0, 0, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.4em;
	padding: 0.75em 1em;
	color: #ffffff;
	font-size: 1em;
	outline: none;
	transition: border-color 0.2s ease;
}

.mmo-input:focus {
	border-color: #eab308;
	box-shadow: 0 0 0.6em rgba(234, 179, 8, 0.3);
}

.readonly-input {
	color: #38bdf8;
	background: rgba(0, 0, 0, 0.4);
}

.mmo-error-banner {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #fca5a5;
	padding: 0.7em 1em;
	border-radius: 0.4em;
	font-size: 0.85em;
	line-height: 1.4;
}

.mmo-buttons-row {
	display: flex;
	gap: 1em;
	margin-top: 0.8em;
}

.mmo-btn-secondary {
	flex: 1;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
	padding: 0.75em;
	border-radius: 0.4em;
	cursor: pointer;
	font-weight: 600;
	transition: all 0.2s ease;
}

.mmo-btn-secondary:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.2);
	color: #ffffff;
}

.mmo-btn-primary {
	flex: 2;
	background: linear-gradient(135deg, #eab308, #ca8a04);
	border: none;
	color: #0f172a;
	font-weight: 700;
	padding: 0.75em;
	border-radius: 0.4em;
	cursor: pointer;
	font-size: 1em;
	transition: all 0.2s ease;
	box-shadow: 0 0.25em 0.9em rgba(234, 179, 8, 0.3);
}

.mmo-btn-primary:hover:not(:disabled) {
	filter: brightness(1.15);
	transform: translateY(-0.1em);
}

.mmo-btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
	transform: none;
}

.mmo-hint-row {
	display: flex;
	justify-content: center;
	gap: 0.5em;
	font-size: 0.85em;
	color: #94a3b8;
}

.mmo-link {
	color: #eab308;
	text-decoration: underline;
}

.auto-reg-banner {
	display: flex;
	align-items: center;
	gap: 0.8em;
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.4);
	padding: 0.8em 1em;
	border-radius: 0.4em;
	color: #bae6fd;
	font-size: 0.85em;
}

.reg-spinner {
	width: 1.1em;
	height: 1.1em;
	border: 0.12em solid #38bdf8;
	border-top-color: transparent;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
}

.checkbox-group {
	flex-direction: row;
	align-items: center;
	gap: 0.6em;
}

.mmo-checkbox-label {
	font-size: 0.85em;
	color: #cbd5e1;
}

@keyframes slowZoom {
	from { transform: scale(1.0); }
	to { transform: scale(1.05); }
}

@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}
</style>
