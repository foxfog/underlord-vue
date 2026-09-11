<template>
	<div class="vr-launcher-overlay">
		<!-- ЭКРАН 1: ПОДКЛЮЧЕНИЕ К НЕЙРОСЕТИ -->
		<div v-if="phase === 'connecting'" class="vr-connecting-screen">
			<div class="vr-connecting-content">
				<div class="neural-circle-container">
					<div class="neural-circle-outer"></div>
					<div class="neural-circle-middle"></div>
					<div class="neural-circle-core">
						<span class="neural-pct">{{ connectProgress }}%</span>
					</div>
				</div>

				<h2 class="connecting-title">ПОДКЛЮЧЕНИЕ К НЕЙРОИНТЕРФЕЙСУ</h2>
				<div class="connecting-sub">{{ currentStatusText }}</div>

				<div class="neural-progress-track">
					<div class="neural-progress-fill" :style="{ width: `${connectProgress}%` }"></div>
				</div>

				<div class="neural-log-box">
					<div v-for="(log, idx) in logEntries" :key="idx" class="neural-log-line">
						<span class="log-arrow">&gt;</span> {{ log }}
					</div>
				</div>
			</div>
		</div>

		<!-- ЭКРАН ОТКЛЮЧЕНИЯ (ВЫХОД В РЕАЛЬНОСТЬ) -->
		<div v-else-if="phase === 'disconnecting'" class="vr-connecting-screen disconnecting-theme">
			<div class="vr-connecting-content">
				<div class="neural-circle-container">
					<div class="neural-circle-outer disc-outer"></div>
					<div class="neural-circle-middle disc-middle"></div>
					<div class="neural-circle-core disc-core">
						<span class="neural-pct disc-pct">{{ connectProgress }}%</span>
					</div>
				</div>

				<h2 class="connecting-title disc-title">ОТКЛЮЧЕНИЕ НЕЙРОИНТЕРФЕЙСА</h2>
				<div class="connecting-sub disc-sub">{{ currentStatusText }}</div>

				<div class="neural-progress-track">
					<div class="neural-progress-fill disc-fill" :style="{ width: `${connectProgress}%` }"></div>
				</div>

				<div class="neural-log-box disc-log">
					<div v-for="(log, idx) in logEntries" :key="idx" class="neural-log-line">
						<span class="log-arrow disc-arrow">&gt;</span> {{ log }}
					</div>
				</div>
			</div>
		</div>

		<!-- ЭКРАН 2: РАБОЧИЙ СТОЛ НЕЙРОШЛЕМА (КОНСОЛЬНЫЙ СТИЛЬ) -->
		<div v-else class="vr-dashboard-screen">
			<!-- Верхняя панель статуса -->
			<div class="vr-topbar">
				<div class="vr-topbar-left">
					<span class="vr-brand">NEURO-OS // v4.8</span>
					<span class="vr-status-badge">🟢 Сигнал 99.8%</span>
				</div>
				<div class="vr-topbar-right">
					<span class="vr-clock">{{ formattedVrTime }}</span>
					<span class="vr-user">ID: Worker_2138</span>
				</div>
			</div>

			<!-- Центральная зона карточек приложений (PlayStation Style) -->
			<div class="vr-cards-carousel">
				<!-- Главная карточка: YGGDRASIL -->
				<div class="vr-card vr-card-featured active" @click="launchYggdrasil">
					<div class="vr-card-badge">СЕРВЕРЫ ЗАКРЫВАЮТСЯ В 00:00</div>
					<div class="vr-card-image-wrap">
						<img
							:src="yggdrasilBgPath"
							alt="Yggdrasil"
							class="vr-card-img"
						/>
						<div class="vr-card-glow"></div>
					</div>
					<div class="vr-card-info">
						<h3 class="vr-card-title">YGGDRASIL™</h3>
						<p class="vr-card-desc">
							Культовая DMMO-RPG. Финальный отсчет до отключения серверов. Войдите в игру прямо сейчас.
						</p>
						<button class="vr-btn-play" @click.stop="launchYggdrasil">
							▶ Запустить игру
						</button>
					</div>
				</div>

				<!-- Второстепенная карточка: Корпоративная сеть -->
				<div class="vr-card vr-card-secondary disabled">
					<div class="vr-card-header-icon">🏭</div>
					<h3 class="vr-card-title">Заводской терминал</h3>
					<p class="vr-card-desc">Доступ заблокирован до начала рабочей смены (06:00).</p>
					<div class="vr-card-status">ОФФЛАЙН</div>
				</div>

				<!-- Второстепенная карточка: Настройки -->
				<div class="vr-card vr-card-secondary disabled">
					<div class="vr-card-header-icon">⚙️</div>
					<h3 class="vr-card-title">Настройки шлема</h3>
					<p class="vr-card-desc">Калибровка зрительных сенсоров и датчиков перегрузки.</p>
					<div class="vr-card-status">В НОРМЕ</div>
				</div>
			</div>

			<!-- Нижняя панель действий -->
			<div class="vr-bottom-bar">
				<div class="vr-tip">
					💡 <span>Нажмите на YGGDRASIL для авторизации и запуска DMMO-RPG</span>
				</div>
				<button class="vr-btn-exit" @click="startExitVr">
					⏻ Снять шлем (Выход в реальность)
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { useGameStore } from '@/stores/gameStore'

const gameStore = useGameStore()

const props = defineProps({
	initialPhase: {
		type: String,
		default: 'connecting' // 'connecting' | 'dashboard'
	},
	globalData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['launch-yggdrasil', 'exit-vr'])

const phase = ref(props.initialPhase)
const connectProgress = ref(0)
const currentStatusText = ref('Инициализация нейроинтерфейса...')
const logEntries = ref([])

const effectiveGlobalData = computed(() => {
	return props.globalData && Object.keys(props.globalData).length > 0
		? props.globalData
		: gameStore.globalData
})

const formattedVrTime = computed(() => {
	const g = effectiveGlobalData.value
	const time = g?.time || '21:14'
	const day = String(g?.dayOfMonth || 18).padStart(2, '0')
	const month = String(g?.month || 12).padStart(2, '0')
	const year = g?.year || 2138
	return `${time} • ${day}.${month}.${year}`
})

const yggdrasilBgPath = computed(() => {
	const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
	return `${base}images/sprites/backgrounds/YGGDRASIL.webp`
})

function onKeyDown(e) {
	if (e.key === 'Escape') {
		e.stopPropagation()
		e.preventDefault()
		if (phase.value === 'dashboard') {
			startExitVr()
		}
	}
}

onMounted(() => {
	window.addEventListener('keydown', onKeyDown, true)
	if (phase.value === 'connecting') {
		runConnectingSequence()
	}
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown, true)
})

function runConnectingSequence() {
	connectProgress.value = 0
	logEntries.value = ['Подключение электродов... OK']

	const steps = [
		{ pct: 25, status: 'Синхронизация мозговых волн...', log: 'Нейронная связь установлена.' },
		{ pct: 55, status: 'Калибровка сенсорики и оптики...', log: 'Слуховой и зрительный поток откалиброваны.' },
		{ pct: 85, status: 'Загрузка окружения виртуальной консоли...', log: 'Безопасный барьер перегрузки активен.' },
		{ pct: 100, status: 'Добро пожаловать в виртуальное пространство.', log: 'Вход выполнен успешно.' }
	]

	let currentStep = 0
	const interval = setInterval(() => {
		if (currentStep < steps.length) {
			const item = steps[currentStep]
			connectProgress.value = item.pct
			currentStatusText.value = item.status
			logEntries.value.push(item.log)
			currentStep++
		} else {
			clearInterval(interval)
			setTimeout(() => {
				phase.value = 'dashboard'
			}, 600)
		}
	}, 550)
}

function launchYggdrasil() {
	emit('launch-yggdrasil')
}

function startExitVr() {
	runDisconnectingSequence()
}

function runDisconnectingSequence() {
	phase.value = 'disconnecting'
	connectProgress.value = 0
	currentStatusText.value = 'Завершение виртуального сеанса...'
	logEntries.value = ['Сохранение буфера сессии... OK']

	const steps = [
		{ pct: 30, status: 'Десинхронизация зрительно-моторного синапса...', log: 'Синаптический поток свернут.' },
		{ pct: 65, status: 'Отключение нейроэлектродов шлема...', log: 'Электроды деактивированы. Сигнал снят.' },
		{ pct: 90, status: 'Возврат сенсорного контроля телу...', log: 'Реальные сенсоры активны.' },
		{ pct: 100, status: 'Нейрошлем отключен. Безопасное снятие.', log: 'Сеанс завершен.' }
	]

	let currentStep = 0
	const interval = setInterval(() => {
		if (currentStep < steps.length) {
			const item = steps[currentStep]
			connectProgress.value = item.pct
			currentStatusText.value = item.status
			logEntries.value.push(item.log)
			currentStep++
		} else {
			clearInterval(interval)
			setTimeout(() => {
				emit('exit-vr')
			}, 500)
		}
	}, 450)
}

defineExpose({
	startExitVr
})
</script>

<style scoped>
.vr-launcher-overlay {
	position: absolute;
	inset: 0;
	z-index: 9000;
	background: radial-gradient(circle at 50% 30%, #0d1b2a 0%, #050811 80%, #020307 100%);
	color: #e0f2fe;
	font-family: 'Segoe UI', Roboto, sans-serif;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	user-select: none;
	font-size: calc(1 * var(--size));
}

/* ЭКРАН ПОДКЛЮЧЕНИЯ */
.vr-connecting-screen {
	display: flex;
	align-items: center;
	justify-content: center;
	height: 100%;
	padding: 2em;
	text-align: center;
	overflow: hidden;
}

.vr-connecting-content {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	width: min(28em, 85%);
	margin-top: -3.5em;
}

.neural-circle-container {
	position: relative;
	width: 8em;
	height: 8em;
	margin-bottom: 2em;
}

.neural-circle-outer {
	position: absolute;
	inset: 0;
	border: 0.2em dashed #00e5ff;
	border-radius: 50%;
	animation: spin 8s linear infinite;
	box-shadow: 0 0 1.25em rgba(0, 229, 255, 0.4);
}

.neural-circle-middle {
	position: absolute;
	inset: 0.75em;
	border: 0.125em solid rgba(0, 229, 255, 0.3);
	border-top-color: #00e5ff;
	border-radius: 50%;
	animation: spinReverse 4s linear infinite;
}

.neural-circle-core {
	position: absolute;
	inset: 1.5em;
	background: radial-gradient(circle, rgba(0, 229, 255, 0.25) 0%, transparent 80%);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.neural-pct {
	font-size: 1.3em;
	font-weight: 700;
	color: #00e5ff;
	font-family: monospace;
}

.connecting-title {
	font-size: 1.5em;
	letter-spacing: 0.15em;
	font-weight: 600;
	color: #ffffff;
	margin-bottom: 0.5em;
	text-shadow: 0 0 0.75em rgba(0, 229, 255, 0.6);
}

.connecting-sub {
	font-size: 1em;
	color: #7dd3fc;
	margin-bottom: 1.5em;
	min-height: 1.4em;
}

.neural-progress-track {
	width: min(25em, 80%);
	height: 0.4em;
	background: rgba(255, 255, 255, 0.1);
	border-radius: 0.25em;
	overflow: hidden;
	margin-bottom: 1.5em;
	box-shadow: inset 0 0.08em 0.2em rgba(0, 0, 0, 0.5);
}

.neural-progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #0284c7, #00e5ff);
	transition: width 0.4s ease;
	box-shadow: 0 0 0.6em #00e5ff;
}

.neural-log-box {
	position: absolute;
	top: 100%;
	left: 50%;
	transform: translateX(-50%);
	width: 100%;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(0, 229, 255, 0.2);
	border-radius: 0.4em;
	padding: 0.8em 1.2em;
	text-align: left;
	font-family: monospace;
	font-size: 0.85em;
	color: #38bdf8;
	box-sizing: border-box;
}

.neural-log-line {
	margin-bottom: 0.3em;
}

.log-arrow {
	color: #00e5ff;
	font-weight: bold;
}

/* РАБОЧИЙ СТОЛ (ДАШБОРД) */
.vr-dashboard-screen {
	display: flex;
	flex-direction: column;
	height: 100%;
	padding: 1.5em 3em;
}

.vr-topbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-bottom: 1.2em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.vr-brand {
	font-weight: 800;
	letter-spacing: 0.1em;
	font-size: 1.1em;
	color: #38bdf8;
	margin-right: 1em;
}

.vr-status-badge {
	background: rgba(16, 185, 129, 0.15);
	border: 1px solid rgba(16, 185, 129, 0.4);
	color: #6ee7b7;
	padding: 0.2em 0.6em;
	border-radius: 0.75em;
	font-size: 0.8em;
}

.vr-clock {
	color: #94a3b8;
	margin-right: 1.5em;
	font-size: 0.95em;
}

.vr-user {
	color: #e0f2fe;
	font-weight: 600;
	background: rgba(255, 255, 255, 0.08);
	padding: 0.3em 0.8em;
	border-radius: 0.4em;
}

.vr-cards-carousel {
	display: flex;
	gap: 2em;
	align-items: center;
	justify-content: center;
	flex: 1;
	padding: 2em 0;
}

.vr-card {
	position: relative;
	border-radius: 1em;
	overflow: hidden;
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.15);
	transition: all 0.3s ease;
	cursor: pointer;
}

.vr-card-featured {
	width: min(28em, 90%);
	border: 0.125em solid rgba(0, 229, 255, 0.5);
	box-shadow: 0 0.6em 1.8em rgba(0, 0, 0, 0.6), 0 0 1.5em rgba(0, 229, 255, 0.2);
}

.vr-card-featured:hover {
	transform: translateY(-0.4em) scale(1.02);
	border-color: #00e5ff;
	box-shadow: 0 0.9em 2.5em rgba(0, 0, 0, 0.7), 0 0 2.2em rgba(0, 229, 255, 0.4);
}

.vr-card-badge {
	position: absolute;
	top: 0.75em;
	left: 0.75em;
	z-index: 2;
	background: #ef4444;
	color: white;
	font-size: 0.75em;
	font-weight: 700;
	padding: 0.3em 0.7em;
	border-radius: 0.4em;
	box-shadow: 0 0.15em 0.5em rgba(239, 68, 68, 0.6);
}

.vr-card-image-wrap {
	position: relative;
	height: 14em;
	overflow: hidden;
}

.vr-card-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
	transition: transform 0.4s ease;
}

.vr-card-featured:hover .vr-card-img {
	transform: scale(1.05);
}

.vr-card-glow {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, transparent 40%, rgba(15, 23, 42, 0.95) 100%);
}

.vr-card-info {
	padding: 1.5em;
}

.vr-card-title {
	font-size: 1.6em;
	font-weight: 700;
	color: #f8fafc;
	margin-bottom: 0.5em;
	letter-spacing: 0.05em;
}

.vr-card-desc {
	font-size: 0.9em;
	color: #94a3b8;
	line-height: 1.4;
	margin-bottom: 1.2em;
}

.vr-btn-play {
	width: 100%;
	background: linear-gradient(135deg, #0284c7, #00e5ff);
	color: #020617;
	font-weight: 700;
	font-size: 1.05em;
	border: none;
	border-radius: 0.5em;
	padding: 0.8em;
	cursor: pointer;
	transition: all 0.2s ease;
	box-shadow: 0 0.25em 0.9em rgba(0, 229, 255, 0.3);
}

.vr-btn-play:hover {
	filter: brightness(1.15);
	transform: scale(1.01);
}

.vr-card-secondary {
	width: 14em;
	height: 17.5em;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 1.5em;
	text-align: center;
	opacity: 0.6;
	cursor: not-allowed;
}

.vr-card-secondary:hover {
	opacity: 0.8;
}

.vr-card-header-icon {
	font-size: 2.5em;
	margin-bottom: 1em;
}

.vr-card-status {
	margin-top: auto;
	font-size: 0.75em;
	color: #64748b;
	font-weight: 700;
	letter-spacing: 0.05em;
}

/* НИЖНЯЯ ПАНЕЛЬ */
.vr-bottom-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-top: 1em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.vr-tip {
	font-size: 0.9em;
	color: #94a3b8;
}

.vr-btn-exit {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.4);
	color: #fca5a5;
	padding: 0.6em 1.4em;
	border-radius: 0.5em;
	font-weight: 600;
	font-size: 0.95em;
	cursor: pointer;
	transition: all 0.2s ease;
}

.vr-btn-exit:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ffffff;
	border-color: #ef4444;
}

@keyframes spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

@keyframes spinReverse {
	from { transform: rotate(360deg); }
	to { transform: rotate(0deg); }
}

/* СТИЛИ ОТКЛЮЧЕНИЯ */
.disconnecting-theme {
	background: radial-gradient(circle at 50% 30%, #1e112a 0%, #0c0714 80%, #050208 100%);
}

.disc-outer {
	border-color: #f59e0b;
	box-shadow: 0 0 1.25em rgba(245, 158, 11, 0.4);
}

.disc-middle {
	border-top-color: #f59e0b;
}

.disc-core {
	background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 80%);
}

.disc-pct {
	color: #f59e0b;
}

.disc-title {
	text-shadow: 0 0 0.75em rgba(245, 158, 11, 0.6);
}

.disc-sub {
	color: #fcd34d;
}

.disc-fill {
	background: linear-gradient(90deg, #d97706, #f59e0b);
	box-shadow: 0 0 0.6em #f59e0b;
}

.disc-log {
	border-color: rgba(245, 158, 11, 0.3);
	color: #fcd34d;
}

.disc-arrow {
	color: #f59e0b;
}
</style>
