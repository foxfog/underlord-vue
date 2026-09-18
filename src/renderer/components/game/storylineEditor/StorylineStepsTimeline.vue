<template>
	<div class="steps-timeline">
		<!-- Header Toolbar -->
		<div class="timeline-header">
			<div class="header-info">
				<span class="timeline-icon">📜</span>
				<span class="timeline-title">Таймлайн шагов</span>
				<span class="step-count-badge">({{ steps.length }})</span>
			</div>

			<!-- Search filter for steps -->
			<div class="step-search-wrap">
				<input
					v-model="filterQuery"
					type="text"
					placeholder="Поиск по шагам..."
					class="step-search-input"
				/>
				<button
					v-if="filterQuery"
					type="button"
					class="search-clear-btn"
					@click="filterQuery = ''"
				>
					×
				</button>
			</div>
		</div>

		<!-- Quick Step Insertion Bar -->
		<div class="quick-insert-bar">
			<button
				type="button"
				class="quick-add-btn"
				title="Добавить реплику диалога"
				@click="emit('add-step', 'dialogue')"
			>
				+ 💬 Диалог
			</button>
			<button
				type="button"
				class="quick-add-btn"
				title="Добавить смену сцены"
				@click="emit('add-step', 'scene')"
			>
				+ 🌄 Сцена
			</button>
			<button
				type="button"
				class="quick-add-btn"
				title="Добавить музыку / звук"
				@click="emit('add-step', 'music')"
			>
				+ 🎵 Музыка
			</button>
			<button
				type="button"
				class="quick-add-btn"
				title="Добавить развилку выбора"
				@click="emit('add-step', 'choice')"
			>
				+ 🔀 Выбор
			</button>
			<button
				type="button"
				class="quick-add-btn"
				title="Добавить изменение переменной"
				@click="emit('add-step', 'variable')"
			>
				+ ⚙️ Переменная
			</button>
			<!-- Dropdown for more types -->
			<div class="more-types-dropdown" @mouseleave="isMoreMenuOpen = false">
				<button
					type="button"
					class="quick-add-btn __more"
					@click="isMoreMenuOpen = !isMoreMenuOpen"
				>
					+ Ещё ▾
				</button>
				<div v-if="isMoreMenuOpen" class="more-menu">
					<button type="button" class="more-menu-item" @click="addFromMore('show')">
						👤 Показать персонажа
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('hide')">
						👻 Скрыть персонажа
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('titles')">
						🏷️ Титры / Вступление
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('goto')">
						➡️ Переход (goto)
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('quest')">
						📜 Квест
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('fade')">
						⬛ Затемнение экрана
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('ui')">
						🖥️ Показ/Скрытие UI
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('notification')">
						📢 Уведомление
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('hold')">
						⏸️ Удержание (hold)
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('end')">
						🛑 Завершить сценарий (end)
					</button>
					<button type="button" class="more-menu-item" @click="addFromMore('raw')">
						{ } Кастомный JSON экшен
					</button>
				</div>
			</div>
		</div>

		<!-- Steps Scroll List -->
		<div class="steps-list-wrapper">
			<div v-if="steps.length === 0" class="empty-steps">
				<span class="empty-icon">📝</span>
				<span>Сценарий пуст. Добавьте первый шаг кнопками сверху!</span>
			</div>

			<div v-else class="steps-items">
				<div
					v-for="(step, idx) in steps"
					:key="idx"
					class="step-item"
					:class="{
						__active: activeIndex === idx,
						__hidden: isFilteredOut(step, idx)
					}"
					@click="emit('select-step', idx)"
				>
					<!-- Number & Reorder buttons -->
					<div class="step-num-col">
						<span class="step-index">#{{ idx + 1 }}</span>
						<div class="step-reorder-btns" @click.stop>
							<button
								type="button"
								class="reorder-btn"
								:disabled="idx === 0"
								title="Переместить вверх"
								@click="emit('move-step', idx, idx - 1)"
							>
								▲
							</button>
							<button
								type="button"
								class="reorder-btn"
								:disabled="idx === steps.length - 1"
								title="Переместить вниз"
								@click="emit('move-step', idx, idx + 1)"
							>
								▼
							</button>
						</div>
					</div>

					<!-- Content Summary -->
					<div class="step-main-col">
						<div class="step-type-row">
							<span class="step-type-badge" :class="getTypeClass(step)">
								{{ getStepIcon(step) }} {{ getStepTypeName(step) }}
							</span>
							<span v-if="step.if || step.condition" class="step-condition-badge" :title="'Условие: ' + (step.if || step.condition)">
								if: {{ step.if || step.condition }}
							</span>
						</div>
						<div class="step-summary-text">
							{{ getSummaryFn(step) }}
						</div>
					</div>

					<!-- Context Actions -->
					<div class="step-actions-col" @click.stop>
						<button
							type="button"
							class="step-action-btn"
							title="Дублировать шаг"
							@click="emit('duplicate-step', idx)"
						>
							📋
						</button>
						<button
							type="button"
							class="step-action-btn __delete"
							title="Удалить шаг"
							@click="emit('delete-step', idx)"
						>
							🗑️
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
	steps: {
		type: Array,
		default: () => []
	},
	activeIndex: {
		type: Number,
		default: 0
	},
	getSummaryFn: {
		type: Function,
		required: true
	},
	getStepIcon: {
		type: Function,
		required: true
	}
})

const emit = defineEmits([
	'select-step',
	'add-step',
	'duplicate-step',
	'delete-step',
	'move-step'
])

const filterQuery = ref('')
const isMoreMenuOpen = ref(false)

function addFromMore(type) {
	emit('add-step', type)
	isMoreMenuOpen.value = false
}

function getStepTypeName(step) {
	if (!step) return 'unknown'
	if (!step.type && step.variable) return 'переменная'
	return step.type || 'кастомный'
}

function getTypeClass(step) {
	const t = step?.type || (step?.variable ? 'variable' : 'default')
	return `__type-${t}`
}

function isFilteredOut(step, idx) {
	if (!filterQuery.value.trim()) return false
	const q = filterQuery.value.toLowerCase().trim()
	const summary = props.getSummaryFn(step).toLowerCase()
	const typeName = getStepTypeName(step).toLowerCase()
	const cond = (step.if || step.condition || '').toLowerCase()
	const indexStr = `#${idx + 1}`

	return !summary.includes(q) && !typeName.includes(q) && !cond.includes(q) && !indexStr.includes(q)
}
</script>

<style scoped>
.steps-timeline {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: rgba(14, 18, 28, 0.7);
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	font-family: inherit;
	box-sizing: border-box;
	color: #e2e8f0;
}

.timeline-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1em;
	background: rgba(20, 26, 40, 0.9);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	gap: 0.8em;
}

.header-info {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.timeline-icon {
	font-size: 1.2em;
}

.timeline-title {
	font-weight: 700;
	font-size: 1em;
	color: #f1f5f9;
}

.step-count-badge {
	font-size: 0.8em;
	color: #94a3b8;
}

.step-search-wrap {
	position: relative;
	width: 11em;
}

.step-search-input {
	width: 100%;
	background: rgba(10, 14, 22, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.35em 0.6em;
	font-size: 0.8em;
	color: #f8fafc;
	outline: none;
	box-sizing: border-box;
}

.step-search-input:focus {
	border-color: #f6c445;
}

.search-clear-btn {
	position: absolute;
	right: 0.5em;
	top: 50%;
	transform: translateY(-50%);
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 1em;
}

.quick-insert-bar {
	display: flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.45em 0.8em;
	background: rgba(12, 16, 26, 0.8);
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
	overflow-x: auto;
	position: relative;
}

.quick-add-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.3em;
	padding: 0.3em 0.55em;
	font-size: 0.78em;
	color: #cbd5e1;
	cursor: pointer;
	white-space: nowrap;
	transition: all 0.15s;
}

.quick-add-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
	border-color: rgba(246, 196, 69, 0.4);
}

.quick-add-btn.__more {
	background: rgba(246, 196, 69, 0.15);
	border-color: rgba(246, 196, 69, 0.3);
	color: #f6c445;
	font-weight: 600;
}

.more-types-dropdown {
	position: relative;
}

.more-menu {
	position: absolute;
	top: 100%;
	right: 0;
	margin-top: 0.3em;
	background: #172033;
	border: 1px solid rgba(246, 196, 69, 0.3);
	border-radius: 0.4em;
	padding: 0.4em;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	z-index: 50;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.6);
	width: 14em;
}

.more-menu-item {
	background: transparent;
	border: none;
	border-radius: 0.3em;
	padding: 0.4em 0.6em;
	text-align: left;
	font-size: 0.82em;
	color: #cbd5e1;
	cursor: pointer;
	transition: background 0.15s;
}

.more-menu-item:hover {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
}

.steps-list-wrapper {
	flex: 1;
	overflow-y: auto;
	padding: 0.6em;
}

.empty-steps {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.6em;
	padding: 3em 1.5em;
	color: #64748b;
	text-align: center;
	font-size: 0.9em;
}

.empty-icon {
	font-size: 2em;
}

.steps-items {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.step-item {
	display: flex;
	align-items: center;
	gap: 0.6em;
	background: rgba(20, 26, 40, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.45em 0.65em;
	cursor: pointer;
	user-select: none;
	transition: all 0.15s;
}

.step-item:hover {
	background: rgba(255, 255, 255, 0.07);
	border-color: rgba(255, 255, 255, 0.15);
}

.step-item.__active {
	background: rgba(246, 196, 69, 0.18);
	border-color: #f6c445;
	border-left: 0.3em solid #f6c445;
}

.step-item.__hidden {
	display: none;
}

.step-num-col {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.step-index {
	font-size: 0.8em;
	font-weight: 700;
	color: #94a3b8;
	min-width: 2em;
}

.step-item.__active .step-index {
	color: #f6c445;
}

.step-reorder-btns {
	display: flex;
	flex-direction: column;
	gap: 0.1em;
}

.reorder-btn {
	background: transparent;
	border: none;
	color: #64748b;
	font-size: 0.6em;
	padding: 0;
	line-height: 1;
	cursor: pointer;
}

.reorder-btn:hover:not(:disabled) {
	color: #fff;
}

.reorder-btn:disabled {
	opacity: 0.2;
	cursor: not-allowed;
}

.step-main-col {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.step-type-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.step-type-badge {
	font-size: 0.72em;
	font-weight: 700;
	text-transform: uppercase;
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
}

.step-type-badge.__type-dialogue {
	background: rgba(56, 189, 248, 0.18);
	color: #38bdf8;
}

.step-type-badge.__type-scene {
	background: rgba(168, 85, 247, 0.18);
	color: #c084fc;
}

.step-type-badge.__type-music,
.step-type-badge.__type-sound,
.step-type-badge.__type-voice {
	background: rgba(34, 197, 94, 0.18);
	color: #4ade80;
}

.step-type-badge.__type-choice {
	background: rgba(249, 115, 22, 0.18);
	color: #fb923c;
}

.step-type-badge.__type-variable {
	background: rgba(234, 179, 8, 0.18);
	color: #facc15;
}

.step-condition-badge {
	font-size: 0.7em;
	color: #e2e8f0;
	background: rgba(99, 102, 241, 0.25);
	border: 1px solid rgba(99, 102, 241, 0.4);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 12em;
	font-family: Consolas, monospace;
}

.step-summary-text {
	font-size: 0.82em;
	color: #cbd5e1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.step-item.__active .step-summary-text {
	color: #fff;
}

.step-actions-col {
	display: none;
	align-items: center;
	gap: 0.2em;
}

.step-item:hover .step-actions-col {
	display: flex;
}

.step-action-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.85em;
	padding: 0.2em 0.35em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: all 0.15s;
}

.step-action-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.step-action-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ef4444;
}
</style>
