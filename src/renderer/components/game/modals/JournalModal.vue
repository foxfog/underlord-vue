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
					<div v-if="allCharacters.length === 0" class="journal-empty">
						Вы пока не познакомились ни с кем в этом мире.
					</div>
					<div v-else class="journal-split-layout">
						<!-- Левая колонка: список персонажей -->
						<div class="journal-items-sidebar">
							<div class="sidebar-header-label">Персонажи ({{ allCharacters.length }})</div>
							<div class="journal-cards-list">
								<button
									v-for="char in allCharacters"
									:key="char.id"
									class="char-list-card"
									:class="{ 'is-selected': selectedCharacter?.id === char.id }"
									@click="selectedCharacterId = char.id"
								>
									<div class="char-list-avatar-wrap">
										<img
											v-if="char.avatar"
											:src="formatImagePath(char.avatar)"
											:alt="char.name"
											class="char-list-avatar"
										/>
										<span v-else class="char-list-avatar-fallback">👤</span>
									</div>
									<div class="char-list-info">
										<div class="char-list-name">{{ char.title || char.name }}</div>
										<div class="char-list-badge" :style="{ color: getCharacterAttitude(char).color }">
											{{ getCharacterAttitude(char).icon }} {{ getCharacterAttitude(char).label }}
										</div>
									</div>
								</button>
							</div>
						</div>

						<!-- Правая колонка: детальная карточка персонажа -->
						<div v-if="selectedCharacter" class="journal-detail-pane">
							<div class="character-header-card">
								<div class="character-big-portrait">
									<img
										v-if="selectedCharacter.avatar"
										:src="formatImagePath(selectedCharacter.avatar)"
										:alt="selectedCharacter.name"
										class="big-portrait-img"
									/>
									<span v-else class="big-portrait-fallback">👤</span>
								</div>
								<div class="character-header-meta">
									<h3 class="character-fullname">{{ selectedCharacter.title }}</h3>
									
									<div class="char-meta-row">
										<span class="meta-label">Отношение:</span>
										<span
											class="attitude-pill"
											:style="{
												borderColor: getCharacterAttitude(selectedCharacter).color,
												color: getCharacterAttitude(selectedCharacter).color
											}"
										>
											{{ getCharacterAttitude(selectedCharacter).icon }}
											{{ getCharacterAttitude(selectedCharacter).label }}
											({{ getCharacterSympathy(selectedCharacter) > 0 ? '+' : '' }}{{ getCharacterSympathy(selectedCharacter) }})
										</span>
									</div>

									<div class="char-meta-row">
										<span class="meta-label">Обращение к нам:</span>
										<span class="meta-value title-value">
											«{{ getCharacterTitleToMc(selectedCharacter) }}»
										</span>
									</div>

									<div class="char-meta-row">
										<span class="meta-label">Местонахождение:</span>
										<span class="meta-value location-value">
											📍 {{ getCharacterLocation(selectedCharacter) }}
										</span>
									</div>
								</div>
							</div>

							<!-- Модульные блоки заметок -->
							<div class="detail-section">
								<div class="detail-section-title">📝 Сведения и заметки</div>
								<div
									v-if="!selectedCharacter.blocks || selectedCharacter.blocks.length === 0"
									class="detail-empty-hint"
								>
									Подробные сведения пока отсутствуют.
								</div>
								<div v-else class="journal-blocks-list">
									<div
										v-for="block in selectedCharacter.blocks"
										:key="block.id"
										class="journal-block-card"
									>
										<div v-if="block.title" class="block-card-title">{{ block.title }}</div>
										<div class="block-card-text">{{ block.text }}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div v-if="activeTab === 'encyclopedia'" class="tab-content-item">
					<div v-if="allEntries.length === 0" class="journal-empty">
						В энциклопедии пока нет открытых записей.
					</div>
					<div v-else class="journal-split-layout">
						<!-- Левая колонка: категории и записи -->
						<div class="journal-items-sidebar">
							<div class="sidebar-header-label">Статьи ({{ allEntries.length }})</div>
							<div class="enc-tree-list">
								<div
									v-for="category in encyclopediaTree"
									:key="category.id"
									class="enc-category-group"
								>
									<div class="enc-cat-header">
										<span class="enc-cat-icon">{{ category.icon }}</span>
										<span class="enc-cat-title">{{ category.title }}</span>
									</div>

									<!-- Прямые записи категории -->
									<div v-if="category.entries && category.entries.length > 0" class="enc-sub-items">
										<button
											v-for="entry in category.entries"
											:key="entry.id"
											class="enc-entry-btn"
											:class="{ 'is-selected': selectedEntry?.id === entry.id }"
											@click="selectedEntryId = entry.id"
										>
											<span class="enc-entry-icon">{{ entry.icon || '📄' }}</span>
											<span class="enc-entry-title">{{ entry.title }}</span>
										</button>
									</div>

									<!-- Подкатегории -->
									<div
										v-for="sub in category.subCategories"
										:key="sub.id"
										class="enc-subcategory-group"
									>
										<div class="enc-subcat-header">
											<span class="enc-subcat-icon">{{ sub.icon }}</span>
											<span class="enc-subcat-title">{{ sub.title }}</span>
										</div>
										<div class="enc-sub-items">
											<button
												v-for="entry in sub.entries"
												:key="entry.id"
												class="enc-entry-btn"
												:class="{ 'is-selected': selectedEntry?.id === entry.id }"
												@click="selectedEntryId = entry.id"
											>
												<span class="enc-entry-icon">{{ entry.icon || '📄' }}</span>
												<span class="enc-entry-title">{{ entry.title }}</span>
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- Правая колонка: детальная карточка статьи -->
						<div v-if="selectedEntry" class="journal-detail-pane">
							<div class="enc-detail-header">
								<div class="enc-breadcrumb">{{ entryBreadcrumb }}</div>
								<div class="enc-title-row">
									<span class="enc-title-icon">{{ selectedEntry.icon || '📜' }}</span>
									<h3 class="detail-title">{{ selectedEntry.title }}</h3>
								</div>
							</div>

							<!-- Модульные блоки сведений -->
							<div class="detail-section">
								<div class="detail-section-title">📖 Известные факты</div>
								<div
									v-if="!selectedEntry.blocks || selectedEntry.blocks.length === 0"
									class="detail-empty-hint"
								>
									Сведения пока не записаны.
								</div>
								<div v-else class="journal-blocks-list">
									<div
										v-for="block in selectedEntry.blocks"
										:key="block.id"
										class="journal-block-card"
									>
										<div v-if="block.title" class="block-card-title">{{ block.title }}</div>
										<div class="block-card-text">{{ block.text }}</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useQuests } from '../../../composables/useQuests'
import { useEncyclopedia, getAttitudeInfo } from '../../../composables/useEncyclopedia'
import { useNpcSchedule } from '../../../composables/useNpcSchedule'
import { useGameStore } from '@/stores/gameStore'
import QuestTreeItem from './QuestTreeItem.vue'

const gameStore = useGameStore()

const props = defineProps({
	isVisible: { type: Boolean, default: false },
	gameState: { type: Object, default: null }
})

const emit = defineEmits(['close'])
const activeTab = ref('tasks')
const selectedQuestId = ref(null)
const selectedCharacterId = ref(null)
const selectedEntryId = ref(null)

const { questTree, allQuests } = useQuests()
const { allCharacters, allEntries, categories } = useEncyclopedia()

function formatImagePath(path) {
	if (!path) return ''
	if (path.startsWith('/') || path.startsWith('http')) return path
	return '/' + path
}

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

// Characters logic
const selectedCharacter = computed(() => {
	if (allCharacters.value.length === 0) return null
	if (selectedCharacterId.value) {
		const found = allCharacters.value.find((c) => c.id === selectedCharacterId.value)
		if (found) return found
	}
	return allCharacters.value[0] || null
})

function getCharacterSympathy(char) {
	if (!char) return 0
	const varName = char.sympVariable || `${char.id}_mc_symp`
	const gData = props.gameState?.global || gameStore.globalData || {}
	const val = gData[varName]
	return typeof val === 'number' ? val : Number(val) || 0
}

function getCharacterAttitude(char) {
	const symp = getCharacterSympathy(char)
	return getAttitudeInfo(symp)
}

function getCharacterTitleToMc(char) {
	if (!char) return 'Путник'
	const varName = char.titleVariable || `${char.id}_mc_title`
	const gData = props.gameState?.global || gameStore.globalData || {}
	const val = gData[varName]
	if (val && String(val).trim() !== '') return String(val)
	return char.defaultTitle || 'Путник'
}

function getCharacterLocation(char) {
	if (!char) return 'Неизвестно'
	const { getNpcLocationDisplay } = useNpcSchedule()
	const context = {
		globalData: props.gameState?.global || gameStore.globalData || {},
		characterData: props.gameState?.character || gameStore.characterData || {}
	}
	const sceneData = props.gameState?.sceneData || gameStore.sceneData || {}
	return getNpcLocationDisplay(char.id, context, sceneData)
}

// Encyclopedia logic
const selectedEntry = computed(() => {
	if (allEntries.value.length === 0) return null
	if (selectedEntryId.value) {
		const found = allEntries.value.find((e) => e.id === selectedEntryId.value)
		if (found) return found
	}
	return allEntries.value[0] || null
})

const encyclopediaTree = computed(() => {
	const result = []
	categories.forEach((cat) => {
		const directEntries = allEntries.value.filter((e) => e.category === cat.id && !e.subCategory)
		const subCats = (cat.subCategories || [])
			.map((sub) => ({
				...sub,
				entries: allEntries.value.filter((e) => e.category === cat.id && e.subCategory === sub.id)
			}))
			.filter((sub) => sub.entries.length > 0)

		if (directEntries.length > 0 || subCats.length > 0) {
			result.push({
				...cat,
				entries: directEntries,
				subCategories: subCats
			})
		}
	})
	return result
})

const entryBreadcrumb = computed(() => {
	if (!selectedEntry.value) return ''
	const cat = categories.find((c) => c.id === selectedEntry.value.category)
	const catTitle = cat ? cat.title : selectedEntry.value.category
	if (selectedEntry.value.subCategory && cat?.subCategories) {
		const sub = cat.subCategories.find((s) => s.id === selectedEntry.value.subCategory)
		const subTitle = sub ? sub.title : selectedEntry.value.subCategory
		return `${catTitle} › ${subTitle}`
	}
	return catTitle
})

function switchTab(tab) {
	activeTab.value = tab
	selectedQuestId.value = null
	if (tab === 'characters' && !selectedCharacterId.value && allCharacters.value.length > 0) {
		selectedCharacterId.value = allCharacters.value[0].id
	}
	if (tab === 'encyclopedia' && !selectedEntryId.value && allEntries.value.length > 0) {
		selectedEntryId.value = allEntries.value[0].id
	}
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
	border-left: 0.25em solid #4fc3f7;
}
.completed-quest {
	border-left: 0.25em solid #81c784;
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
	border-left: 0.2em solid #38bdf8;
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

/* ==========================================================================
   РАЗДЕЛЫ ПЕРСОНАЖЕЙ И ЭНЦИКЛОПЕДИИ (Strict em / %)
   ========================================================================== */
.journal-split-layout {
	display: flex;
	gap: 1.2em;
	min-height: 25em;
}

.journal-items-sidebar {
	width: 16em;
	flex-shrink: 0;
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	padding-right: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.sidebar-header-label {
	font-size: 0.8em;
	font-weight: 700;
	text-transform: uppercase;
	color: #94a3b8;
	letter-spacing: 0.05em;
	margin-bottom: 0.3em;
}

.journal-cards-list {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.char-list-card {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	padding: 0.5em 0.7em;
	display: flex;
	align-items: center;
	gap: 0.7em;
	cursor: pointer;
	text-align: left;
	color: inherit;
	transition: all 0.2s ease;
}

.char-list-card:hover {
	background: rgba(56, 189, 248, 0.1);
	transform: translateX(0.15em);
}

.char-list-card.is-selected {
	background: rgba(56, 189, 248, 0.18);
	border-color: #38bdf8;
	box-shadow: 0 0 0.6em rgba(56, 189, 248, 0.2);
}

.char-list-avatar-wrap {
	width: 2.4em;
	height: 2.4em;
	border-radius: 0.3em;
	overflow: hidden;
	background: rgba(0, 0, 0, 0.4);
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.char-list-avatar {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.char-list-avatar-fallback {
	font-size: 1.4em;
}

.char-list-info {
	flex: 1;
	min-width: 0;
}

.char-list-name {
	font-size: 0.92em;
	font-weight: 600;
	color: #f1f5f9;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.char-list-badge {
	font-size: 0.75em;
	font-weight: 600;
	margin-top: 0.15em;
}

.journal-detail-pane {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 1em;
	padding-left: 0.5em;
	animation: fadeInDetail 0.2s ease;
}

.character-header-card {
	display: flex;
	gap: 1.2em;
	background: rgba(0, 0, 0, 0.25);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 1em;
}

.character-big-portrait {
	width: 5.5em;
	height: 6.8em;
	border-radius: 0.4em;
	overflow: hidden;
	background: rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.12);
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
}

.big-portrait-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.big-portrait-fallback {
	font-size: 2.8em;
}

.character-header-meta {
	display: flex;
	flex-direction: column;
	justify-content: center;
	gap: 0.6em;
	flex: 1;
}

.character-fullname {
	margin: 0;
	font-size: 1.35em;
	color: #f8fafc;
	font-weight: 700;
}

.char-meta-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	font-size: 0.9em;
}

.meta-label {
	color: #94a3b8;
	font-size: 0.9em;
}

.meta-value {
	color: #f1f5f9;
	font-weight: 600;
}

.title-value {
	color: #38bdf8;
	font-style: italic;
}

.location-value {
	color: #cbd5e1;
	font-weight: 500;
}

.attitude-pill {
	font-size: 0.85em;
	font-weight: 600;
	padding: 0.2em 0.6em;
	border-radius: 0.8em;
	border: 1px solid;
	background: rgba(0, 0, 0, 0.3);
}

.journal-blocks-list {
	display: flex;
	flex-direction: column;
	gap: 0.7em;
}

.journal-block-card {
	background: rgba(255, 255, 255, 0.03);
	border-left: 0.2em solid #38bdf8;
	border-radius: 0.25em;
	padding: 0.7em 0.9em;
}

.block-card-title {
	font-size: 0.85em;
	font-weight: 700;
	color: #7dd3fc;
	margin-bottom: 0.3em;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.block-card-text {
	font-size: 0.9em;
	color: #cbd5e1;
	line-height: 1.5;
}

/* Энциклопедия: категории и статьи */
.enc-tree-list {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.enc-category-group {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.enc-cat-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
	font-weight: 700;
	color: #7dd3fc;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.enc-cat-icon {
	font-size: 1.1em;
}

.enc-sub-items {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	padding-left: 0.6em;
}

.enc-subcategory-group {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	margin-top: 0.3em;
	padding-left: 0.6em;
}

.enc-subcat-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.8em;
	font-weight: 600;
	color: #94a3b8;
}

.enc-subcat-icon {
	font-size: 1em;
}

.enc-entry-btn {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding: 0.4em 0.6em;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.35em;
	color: #e2e8f0;
	font-size: 0.88em;
	cursor: pointer;
	text-align: left;
	transition: all 0.2s ease;
}

.enc-entry-btn:hover {
	background: rgba(56, 189, 248, 0.15);
	color: #ffffff;
}

.enc-entry-btn.is-selected {
	background: rgba(56, 189, 248, 0.25);
	border-color: #38bdf8;
	color: #ffffff;
	font-weight: 600;
}

.enc-detail-header {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	padding-bottom: 0.6em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.enc-breadcrumb {
	font-size: 0.78em;
	color: #64748b;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.enc-title-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.enc-title-icon {
	font-size: 1.5em;
}
</style>
