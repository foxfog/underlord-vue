<template>
	<div v-if="isVisible" class="modal journal-modal" @click="closeOnBackground">
		<div class="modal-content journal-modal__content" @click.stop>
			<div class="modal-header">
				<h2 class="modal-title">Журнал</h2>
				<button class="btn-close" @click="$emit('close')">×</button>
			</div>

			<div class="modal-tabs">
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'tasks' }"
					@click="switchTab('tasks')"
				>
					Задания
				</button>
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'characters' }"
					@click="switchTab('characters')"
				>
					Персонажи
				</button>
				<button
					class="modal-tab"
					:class="{ active: activeTab === 'encyclopedia' }"
					@click="switchTab('encyclopedia')"
				>
					Энциклопедия
				</button>
			</div>

			<div class="modal-body journal-body">
				<div v-if="activeTab === 'tasks'" class="tab-content-item">
					<!-- СПИСОК / ДЕРЕВО ЗАДАНИЙ -->
					<template v-if="!selectedQuest">
						<div class="section-title">Журнал заданий</div>
						<div v-if="questTree.length === 0" class="journal-empty">
							Нет зарегистрированных заданий
						</div>
						<div v-else class="journal-quest-tree">
							<QuestTreeItem
								v-for="rootNode in questTree"
								:key="rootNode.id"
								:quest="rootNode"
								:depth="0"
								@select-quest="onSelectQuest"
							/>
						</div>
					</template>

					<!-- ДЕТАЛЬНОЕ ОТОБРАЖЕНИЕ ЗАДАНИЯ В ЭТОЙ ЖЕ МОДАЛКЕ -->
					<template v-else>
						<div class="quest-inline-detail">
							<div class="inline-nav-bar">
								<button class="btn-inline-back" @click="selectedQuestId = null">
									← Назад к списку заданий
								</button>
								<span class="detail-status-pill" :class="`pill-${selectedQuest.status}`">
									<template v-if="selectedQuest.status === 'completed'">Выполнено</template>
									<template v-else-if="selectedQuest.status === 'failed'">Провалено</template>
									<template v-else>В процессе</template>
								</span>
							</div>

							<div class="inline-title-row">
								<span class="detail-status-icon">
									<template v-if="selectedQuest.status === 'completed'">✔</template>
									<template v-else-if="selectedQuest.status === 'failed'">❌</template>
									<template v-else>⚡</template>
								</span>
								<h3 class="detail-title">{{ selectedQuest.title }}</h3>
							</div>

							<!-- Описание задания -->
							<div v-if="selectedQuest.description" class="detail-desc-box">
								{{ selectedQuest.description }}
							</div>

							<!-- Задачи (Таски) -->
							<div class="detail-section">
								<div class="detail-section-title">🎯 Задачи задания</div>

								<div
									v-if="!selectedQuest.tasks || selectedQuest.tasks.length === 0"
									class="detail-empty-hint"
								>
									Нет отдельных задач для этого этапа.
								</div>

								<div v-else class="tasks-group-container">
									<!-- Обязательные задачи -->
									<div v-if="mandatoryTasks.length > 0" class="tasks-subgroup">
										<div class="subgroup-label">Обязательные:</div>
										<div
											v-for="task in mandatoryTasks"
											:key="task.id"
											class="task-row"
											:class="{ 'is-completed': task.completed }"
										>
											<span class="task-checkbox">{{ task.completed ? '☑' : '☐' }}</span>
											<span class="task-text">{{ task.text }}</span>
										</div>
									</div>

									<!-- Дополнительные задачи -->
									<div v-if="optionalTasks.length > 0" class="tasks-subgroup">
										<div class="subgroup-label optional-label">Дополнительные:</div>
										<div
											v-for="task in optionalTasks"
											:key="task.id"
											class="task-row optional-row"
											:class="{ 'is-completed': task.completed }"
										>
											<span class="task-checkbox">{{ task.completed ? '☑' : '☐' }}</span>
											<span class="task-text">{{ task.text }}</span>
											<span class="optional-tag">[Опционально]</span>
										</div>
									</div>
								</div>
							</div>

							<!-- Хроника и заметки задания -->
							<div class="detail-section">
								<div class="detail-section-title">📖 Хроника и заметки</div>
								<div
									v-if="!selectedQuest.storyEntries || selectedQuest.storyEntries.length === 0"
									class="detail-empty-hint"
								>
									Заметки по этому заданию пока отсутствуют.
								</div>
								<div v-else class="chronicle-list">
									<div
										v-for="(entry, idx) in selectedQuest.storyEntries"
										:key="idx"
										class="chronicle-item"
									>
										<span class="chronicle-icon">📜</span>
										<span class="chronicle-text">{{ entry }}</span>
									</div>
								</div>
							</div>
						</div>
					</template>
				</div>

				<div v-if="activeTab === 'characters'" class="tab-content-item">
					<div class="section-title">Персонажи</div>
					<ul class="journal-list">
						<li>Электра — информатор и союзник.</li>
						<li>Морг — капитан стражи.</li>
						<li>Кроу — таинственный торговец.</li>
					</ul>
				</div>

				<div v-if="activeTab === 'encyclopedia'" class="tab-content-item">
					<div class="section-title">Энциклопедия</div>
					<ul class="journal-list">
						<li>Расы: люди, эльфы, карлики.</li>
						<li>Фракции: Гильдия, Орден, Охрана.</li>
						<li>Магия: элементальная и ритуальная.</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuests } from '../../../composables/useQuests'
import QuestTreeItem from './QuestTreeItem.vue'

defineProps({
	isVisible: { type: Boolean, default: false }
})

const emit = defineEmits(['close'])
const activeTab = ref('tasks')
const selectedQuestId = ref(null)

const { questTree, allQuests } = useQuests()

const selectedQuest = computed(() => {
	if (!selectedQuestId.value) return null
	return allQuests.value.find((q) => q.id === selectedQuestId.value) || null
})

const mandatoryTasks = computed(() => {
	if (!selectedQuest.value?.tasks) return []
	return selectedQuest.value.tasks.filter((t) => t.required !== false)
})

const optionalTasks = computed(() => {
	if (!selectedQuest.value?.tasks) return []
	return selectedQuest.value.tasks.filter((t) => t.required === false)
})

function switchTab(tab) {
	activeTab.value = tab
	selectedQuestId.value = null
}

function onSelectQuest(quest) {
	if (quest && quest.id) {
		selectedQuestId.value = quest.id
	}
}

function closeOnBackground() {
	emit('close')
}
</script>

<style scoped>
.journal-empty {
	padding: 1.5em;
	color: rgba(255, 255, 255, 0.5);
	font-style: italic;
}
.journal-quest-list {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	margin-bottom: 1.5em;
	list-style: none;
	padding-left: 0;
}
.quest-item {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.8em 1em;
	transition: all 0.2s ease;
}
.active-quest {
	border-left: 4px solid #4fc3f7;
}
.completed-quest {
	border-left: 4px solid #81c784;
	opacity: 0.75;
}
.quest-item-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-weight: 600;
	font-size: 1.05em;
}
.quest-bullet {
	font-size: 1.1em;
}
.active-quest .quest-title {
	color: #e1f5fe;
}
.completed-quest .quest-title {
	color: #c8e6c9;
	text-decoration: line-through;
}
.quest-description {
	margin-top: 0.4em;
	font-size: 0.9em;
	color: rgba(255, 255, 255, 0.75);
	line-height: 1.4;
}
.section-completed {
	margin-top: 1.5em;
	color: #81c784 !important;
}

/* ДЕТАЛЬНОЕ ОТОБРАЖЕНИЕ ВНУТРИ ВКЛАДКИ */
.quest-inline-detail {
	display: flex;
	flex-direction: column;
	gap: 1.1em;
	padding: 0.2em 0;
	animation: fadeInDetail 0.2s ease;
}

@keyframes fadeInDetail {
	from {
		opacity: 0;
		transform: translateY(0.4em);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

.inline-nav-bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding-bottom: 0.8em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-inline-back {
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.4);
	color: #7dd3fc;
	padding: 0.45em 0.9em;
	border-radius: 0.4em;
	font-size: 0.88em;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;
}

.btn-inline-back:hover {
	background: rgba(56, 189, 248, 0.3);
	color: #ffffff;
	transform: translateX(-0.15em);
}

.inline-title-row {
	display: flex;
	align-items: center;
	gap: 0.7em;
}

.detail-status-icon {
	font-size: 1.4em;
}

.detail-title {
	margin: 0;
	font-size: 1.35em;
	color: #f8fafc;
	font-weight: 700;
}

.detail-status-pill {
	font-size: 0.75em;
	font-weight: 700;
	text-transform: uppercase;
	padding: 0.2em 0.6em;
	border-radius: 0.75em;
}

.detail-desc-box {
	background: rgba(255, 255, 255, 0.04);
	border-left: 3px solid #38bdf8;
	padding: 0.8em 1em;
	border-radius: 0.25em;
	font-size: 0.95em;
	color: #cbd5e1;
	line-height: 1.5;
}

.detail-section-title {
	font-size: 0.95em;
	font-weight: 700;
	color: #7dd3fc;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	margin-bottom: 0.6em;
}

.detail-empty-hint {
	font-style: italic;
	color: #64748b;
	font-size: 0.85em;
	padding: 0.3em 0;
}

.tasks-group-container {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.subgroup-label {
	font-size: 0.8em;
	font-weight: 600;
	color: #94a3b8;
	margin-bottom: 0.3em;
}

.optional-label {
	color: #facc15;
}

.task-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.4em 0.6em;
	background: rgba(255, 255, 255, 0.03);
	border-radius: 0.4em;
	font-size: 0.9em;
	color: #f1f5f9;
}

.task-row.is-completed {
	opacity: 0.7;
	text-decoration: line-through;
	color: #86efac;
}

.task-checkbox {
	font-size: 1.1em;
	line-height: 1;
	color: #38bdf8;
}

.task-row.is-completed .task-checkbox {
	color: #4ade80;
}

.optional-tag {
	margin-left: auto;
	font-size: 0.7em;
	color: #facc15;
	opacity: 0.8;
}

.chronicle-list {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.chronicle-item {
	display: flex;
	gap: 0.6em;
	background: rgba(0, 0, 0, 0.3);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.4em;
	padding: 0.6em 0.8em;
	font-size: 0.88em;
	color: #cbd5e1;
	line-height: 1.4;
}

.chronicle-icon {
	font-size: 1.1em;
	flex-shrink: 0;
}
</style>
