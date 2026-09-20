<template>
	<div class="storyline-editor-view">
		<!-- Top Toolbar -->
		<header class="editor-header">
			<div class="header-left">
				<button type="button" class="header-btn header-btn-back" @click="returnToHome">
					<span class="btn-arrow">‹</span>
					<span>Тесты</span>
				</button>

				<!-- Back to previous scenario button if jumped -->
				<button
					v-if="canNavigateBack"
					type="button"
					class="header-btn header-btn-nav-back"
					:title="`Вернуться к ${previousScenarioPath}`"
					@click="navigateBack"
				>
					<span class="btn-arrow">↩</span>
					<span>Назад к {{ getFileName(previousScenarioPath) }}</span>
				</button>

				<div class="header-title-box">
					<span class="header-icon">📜</span>
					<span class="header-title">Редактор сценариев (Storyline Editor)</span>
				</div>

				<!-- Active File Path & Dirty Indicator -->
				<div v-if="selectedFilePath" class="active-file-indicator">
					<span class="file-path">{{ selectedFilePath }}</span>
					<span v-if="isDirty" class="dirty-badge" title="Есть несохранённые изменения">
						● Не сохранено
					</span>
					<span v-else class="saved-badge">
						✔ Сохранено
					</span>
				</div>
			</div>

			<div class="header-right">
				<!-- Locale Selector -->
				<div class="locale-select-wrap">
					<span class="locale-label">Язык:</span>
					<select
						:value="activeLocale"
						class="locale-select"
						@change="(e) => switchLocale(e.target.value)"
					>
						<option
							v-for="loc in availableLocales"
							:key="loc.code"
							:value="loc.code"
						>
							{{ loc.flag }} {{ loc.label }} ({{ loc.code.toUpperCase() }})
						</option>
					</select>
				</div>

				<!-- 3-Mode View Switcher: Timeline / Graph / JSON -->
				<div class="view-mode-toggle">
					<button
						type="button"
						class="mode-toggle-btn"
						:class="{ __active: viewMode === 'timeline' }"
						title="Линейный список шагов"
						@click="setViewMode('timeline')"
					>
						📋 Список
					</button>
					<button
						type="button"
						class="mode-toggle-btn"
						:class="{ __active: viewMode === 'graph' }"
						title="Интерактивный граф нод слева направо"
						@click="setViewMode('graph')"
					>
						🕸️ Нодовый граф
					</button>
					<button
						type="button"
						class="mode-toggle-btn"
						:class="{ __active: viewMode === 'json' }"
						title="Полноэкранный JSON редактор"
						@click="setViewMode('json')"
					>
						{ } Весь JSON
					</button>
				</div>

				<!-- Action Buttons -->
				<div class="header-actions">
					<button
						type="button"
						class="header-btn header-btn-reload"
						title="Перезагрузить файл с диска"
						:disabled="!selectedFilePath || isLoadingFile"
						@click="reloadCurrentFile"
					>
						🔄
					</button>
					<button
						type="button"
						class="header-btn header-btn-save"
						:class="{ __dirty: isDirty }"
						:disabled="!selectedFilePath || isSaving"
						title="Сохранить файл на диск (Ctrl+S)"
						@click="saveStoryFile"
					>
						<span class="btn-icon">💾</span>
						<span>{{ isSaving ? 'Сохранение...' : 'Сохранить (Ctrl+S)' }}</span>
					</button>
				</div>
			</div>
		</header>

		<!-- Main Workspace Area -->
		<!-- Main Workspace Area -->
		<main class="editor-workspace">
			<!-- Left Panel: File Tree or Collapsed Strip -->
			<div v-if="isLeftCollapsed" class="panel-left-collapsed">
				<button
					type="button"
					class="expand-left-btn"
					title="Развернуть проводник файлов"
					@click="isLeftCollapsed = false"
				>
					<span class="btn-icon">📂</span>
					<span class="expand-arrow">▶</span>
				</button>
			</div>
			<aside v-else class="panel-left">
				<StorylineFileTree
					:tree="fileTree"
					:selected-path="selectedFilePath"
					:is-loading="isLoadingTree"
					:is-folder-expanded="isFolderExpanded"
					@toggle-folder="toggleFolder"
					@select-file="loadStoryFile"
					@create-file="handleCreateFile"
					@create-folder="handleCreateFolder"
					@delete-item="handleDeleteItem"
					@refresh="loadFileTree"
					@toggle-collapse="isLeftCollapsed = true"
				/>
			</aside>

			<!-- Full File Raw JSON Editor Mode -->
			<section v-if="viewMode === 'json'" class="panel-full-json">
				<div class="full-json-header">
					<div class="full-json-title">
						<span>{ } Редактор файла: <code>{{ selectedFilePath }}</code></span>
					</div>
					<div class="full-json-actions">
						<button
							type="button"
							class="full-json-btn"
							@click="beautifyFullJson"
						>
							✨ Форматировать
						</button>
					</div>
				</div>

				<div v-if="jsonSyntaxError" class="full-json-error">
					<span>⚠️ {{ jsonSyntaxError }}</span>
				</div>

				<textarea
					v-model="rawFileContent"
					rows="30"
					spellcheck="false"
					class="full-json-textarea"
					@input="onFullJsonInput"
				></textarea>
			</section>

			<!-- Timeline or Graph Modes (share center view and inspector) -->
			<template v-else>
				<!-- Mode: Steps Timeline -->
				<section v-if="viewMode === 'timeline'" class="panel-center">
					<StorylineStepsTimeline
						:steps="currentStory?.steps || []"
						:active-index="activeStepIndex"
						:get-summary-fn="getStepSummary"
						:get-step-icon="getStepTypeIcon"
						@select-step="handleSelectStep"
						@add-step="(type) => addStep(type)"
						@duplicate-step="duplicateStep"
						@delete-step="removeStep"
						@move-step="moveStep"
					/>
				</section>

				<!-- Mode: Node Graph Canvas -->
				<section v-else class="panel-graph">
					<StorylineNodeCanvas
						:steps="currentStory?.steps || []"
						:active-index="activeStepIndex"
						:inbound-references="inboundReferences"
						:build-graph-fn="buildStoryGraph"
						:get-summary-fn="getStepSummary"
						:get-step-icon="getStepTypeIcon"
						:story-id="currentStory?.id || ''"
						:file-path="selectedFilePath"
						@select-step="handleSelectStep"
						@jump-scenario="(target, stepIdx) => jumpToScenario(target, stepIdx)"
					/>
				</section>

				<!-- Resize Handle for Inspector -->
				<div
					v-if="isInspectorOpen && !isInspectorCollapsed"
					class="inspector-resize-handle"
					title="Перетащите для изменения ширины инспектора"
					@mousedown="startInspectorResize"
				>
					<div class="resize-handle-line"></div>
				</div>

				<!-- Collapsed Strip for Inspector -->
				<div
					v-if="isInspectorOpen && isInspectorCollapsed"
					class="panel-right-collapsed"
				>
					<button
						type="button"
						class="expand-inspector-btn"
						title="Развернуть инспектор шага"
						@click="isInspectorCollapsed = false"
					>
						<span class="btn-arrow">◀</span>
						<span class="btn-icon">{{ activeStep ? getStepTypeIcon(activeStep) : '⚙️' }}</span>
						<span class="vertical-text">Шаг #{{ activeStepIndex + 1 }}</span>
					</button>
				</div>

				<!-- Closed Strip / Floating Reopen Tab for Inspector -->
				<div
					v-else-if="!isInspectorOpen"
					class="panel-right-closed"
				>
					<button
						type="button"
						class="open-inspector-btn"
						title="Открыть инспектор шага"
						@click="isInspectorOpen = true; isInspectorCollapsed = false"
					>
						<span class="btn-arrow">◀</span>
						<span class="btn-icon">⚙️</span>
					</button>
				</div>

				<!-- Full Right Inspector Panel -->
				<section
					v-else
					class="panel-right"
					:style="{ width: `${inspectorWidthEm}em` }"
				>
					<StorylineStepInspector
						:step="activeStep"
						:step-index="activeStepIndex"
						:step-icon="activeStep ? getStepTypeIcon(activeStep) : '⚡'"
						:characters="availableCharacters"
						:scenes="availableScenes"
						:streams="availableAudioStreams"
						@update-step="updateActiveStep"
						@change-step-type="updateStepType"
						@close="isInspectorOpen = false"
						@toggle-collapse="isInspectorCollapsed = true"
					/>
				</section>
			</template>
		</main>

		<!-- Status Notification Toast -->
		<Transition name="toast">
			<div
				v-if="statusMessage"
				class="status-toast"
				:class="`__${statusMessage.type}`"
			>
				<span class="toast-icon">
					{{ statusMessage.type === 'error' ? '❌' : statusMessage.type === 'warning' ? '⚠️' : '✔' }}
				</span>
				<span class="toast-text">{{ statusMessage.text }}</span>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useStorylineEditor } from '@/composables/useStorylineEditor'
import StorylineFileTree from '@/components/game/storylineEditor/StorylineFileTree.vue'
import StorylineStepsTimeline from '@/components/game/storylineEditor/StorylineStepsTimeline.vue'
import StorylineStepInspector from '@/components/game/storylineEditor/StorylineStepInspector.vue'
import StorylineNodeCanvas from '@/components/game/storylineEditor/StorylineNodeCanvas.vue'

const router = useRouter()
const jsonSyntaxError = ref('')

const {
	activeLocale,
	availableLocales,
	fileTree,
	selectedFilePath,
	isLoadingTree,
	isLoadingFile,
	isSaving,
	isDirty,
	statusMessage,
	currentStory,
	activeStepIndex,
	activeStep,
	viewMode,
	navigationHistory,
	canNavigateBack,
	previousScenarioPath,
	isRawFileMode,
	rawFileContent,
	availableCharacters,
	availableScenes,
	availableAudioStreams,
	inboundReferences,
	toggleFolder,
	isFolderExpanded,
	loadFileTree,
	loadStoryFile,
	saveStoryFile,
	createStoryFile,
	createStoryFolder,
	deleteStoryItem,
	addStep,
	duplicateStep,
	removeStep,
	moveStep,
	updateActiveStep,
	updateStepType,
	switchLocale,
	getFileName,
	getStepSummary,
	getStepTypeIcon,
	jumpToScenario,
	navigateBack,
	buildStoryGraph,
	setStatus
} = useStorylineEditor()

const isLeftCollapsed = ref(false)
const isInspectorOpen = ref(true)
const isInspectorCollapsed = ref(false)
const inspectorWidthEm = ref(30)

function handleSelectStep(idx) {
	activeStepIndex.value = idx
	isInspectorOpen.value = true
	isInspectorCollapsed.value = false
}

function startInspectorResize(e) {
	e.preventDefault()
	const startX = e.clientX
	const startWidthEm = inspectorWidthEm.value
	const emInPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

	function onMouseMove(moveEvent) {
		const deltaPx = startX - moveEvent.clientX
		const deltaEm = deltaPx / emInPx
		const newWidthEm = Math.min(Math.max(startWidthEm + deltaEm, 18), 55)
		inspectorWidthEm.value = Number(newWidthEm.toFixed(1))
	}

	function onMouseUp() {
		window.removeEventListener('mousemove', onMouseMove)
		window.removeEventListener('mouseup', onMouseUp)
	}

	window.addEventListener('mousemove', onMouseMove)
	window.addEventListener('mouseup', onMouseUp)
}

function returnToHome() {
	router.push('/home')
}

function setViewMode(mode) {
	if (mode === 'json') {
		rawFileContent.value = JSON.stringify(currentStory.value, null, 2)
		jsonSyntaxError.value = ''
		isRawFileMode.value = true
	} else if (isRawFileMode.value) {
		try {
			const parsed = JSON.parse(rawFileContent.value)
			currentStory.value = parsed
			jsonSyntaxError.value = ''
			isRawFileMode.value = false
		} catch (e) {
			setStatus(`Невозможно переключиться: ошибка в JSON (${e.message})`, 'error')
			return
		}
	}
	viewMode.value = mode
}

function onFullJsonInput() {
	isDirty.value = true
	try {
		const parsed = JSON.parse(rawFileContent.value)
		currentStory.value = parsed
		jsonSyntaxError.value = ''
	} catch (e) {
		jsonSyntaxError.value = `Ошибка синтаксиса: ${e.message}`
	}
}

function beautifyFullJson() {
	try {
		const parsed = JSON.parse(rawFileContent.value)
		rawFileContent.value = JSON.stringify(parsed, null, 2)
		currentStory.value = parsed
		jsonSyntaxError.value = ''
	} catch (e) {
		jsonSyntaxError.value = `Ошибка: ${e.message}`
	}
}

async function reloadCurrentFile() {
	if (selectedFilePath.value) {
		await loadStoryFile(selectedFilePath.value)
	}
}

async function handleCreateFile({ folderPath, fileName }) {
	await createStoryFile(folderPath, fileName)
}

async function handleCreateFolder({ parentPath, folderName }) {
	await createStoryFolder(parentPath, folderName)
}

async function handleDeleteItem({ path, isDirectory }) {
	await deleteStoryItem(path, isDirectory)
}

// Global Hotkeys (Ctrl+S / Cmd+S)
function handleKeydown(e) {
	if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
		e.preventDefault()
		saveStoryFile()
	}
}

onMounted(async () => {
	window.addEventListener('keydown', handleKeydown)
	await loadFileTree()
	// Auto load intro.json if available
	if (!selectedFilePath.value) {
		const introPath = `story/${activeLocale.value}/intro.json`
		await loadStoryFile(introPath)
	}
})

onUnmounted(() => {
	window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.storyline-editor-view {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: #090d16;
	font-size: calc(1 * var(--size));
	font-family: Kurale, sans-serif;
	color: #e2e8f0;
	overflow: hidden;
}

/* Header */
.editor-header {
	height: 3.6em;
	min-height: 3.6em;
	background: rgba(14, 20, 32, 0.95);
	border-bottom: 1px solid rgba(246, 196, 69, 0.25);
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 1.2em;
	gap: 1em;
	box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.5);
	z-index: 10;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 0.9em;
}

.header-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.4em 0.8em;
	font-size: 0.85em;
	color: #cbd5e1;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.35em;
	font-family: inherit;
	transition: all 0.2s;
}

.header-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.header-btn:disabled {
	opacity: 0.35;
	cursor: not-allowed;
}

.header-btn-back .btn-arrow {
	font-size: 1.2em;
	line-height: 1;
}

.header-btn-nav-back {
	background: rgba(56, 189, 248, 0.15);
	border-color: rgba(56, 189, 248, 0.4);
	color: #38bdf8;
	font-weight: 600;
}

.header-btn-nav-back:hover {
	background: rgba(56, 189, 248, 0.25);
	color: #e0f2fe;
}

.header-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.header-icon {
	font-size: 1.4em;
}

.header-title {
	font-weight: 700;
	font-size: 1.1em;
	color: #f1f5f9;
}

.active-file-indicator {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(0, 0, 0, 0.3);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	padding: 0.25em 0.6em;
	font-size: 0.8em;
}

.file-path {
	color: #38bdf8;
	font-family: Consolas, monospace;
}

.dirty-badge {
	color: #f59e0b;
	font-weight: 700;
}

.saved-badge {
	color: #10b981;
}

.header-right {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.locale-select-wrap {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
}

.locale-label {
	color: #94a3b8;
}

.locale-select {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.3em 0.6em;
	font-size: 0.85em;
	color: #f8fafc;
	outline: none;
	font-family: inherit;
	cursor: pointer;
}

.view-mode-toggle {
	display: flex;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 0.4em;
	padding: 0.15em;
	gap: 0.15em;
}

.mode-toggle-btn {
	background: transparent;
	border: none;
	border-radius: 0.3em;
	padding: 0.35em 0.7em;
	font-size: 0.82em;
	color: #94a3b8;
	cursor: pointer;
	transition: all 0.15s;
}

.mode-toggle-btn.__active {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	font-weight: 700;
}

.header-actions {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.header-btn-save.__dirty {
	background: #f6c445;
	border-color: #f6c445;
	color: #0f172a;
	font-weight: 700;
	box-shadow: 0 0 0.6em rgba(246, 196, 69, 0.4);
}

/* Workspace */
.editor-workspace {
	flex: 1;
	display: flex;
	width: 100%;
	height: calc(100% - 3.6em);
	overflow: hidden;
}

.panel-left {
	width: 18em;
	min-width: 15em;
	height: 100%;
	flex-shrink: 0;
	border-right: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-left-collapsed {
	width: 2.8em;
	height: 100%;
	background: #0d1322;
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: 0.8em;
	flex-shrink: 0;
	z-index: 5;
}

.expand-left-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.6em 0.35em;
	color: #cbd5e1;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.3em;
	font-size: 0.9em;
	transition: all 0.2s;
	font-family: inherit;
}

.expand-left-btn:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.expand-left-btn .expand-arrow {
	font-size: 0.75em;
}

.panel-center {
	flex: 1;
	height: 100%;
	min-width: 18em;
	overflow: hidden;
}

.panel-graph {
	flex: 1;
	height: 100%;
	min-width: 20em;
	position: relative;
	overflow: hidden;
}

/* Inspector Resize Handle */
.inspector-resize-handle {
	width: 0.5em;
	height: 100%;
	cursor: col-resize;
	background: transparent;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	z-index: 10;
	position: relative;
	transition: background 0.15s;
}

.inspector-resize-handle:hover,
.inspector-resize-handle:active {
	background: rgba(246, 196, 69, 0.25);
}

.resize-handle-line {
	width: 0.12em;
	height: 2.5em;
	background: rgba(255, 255, 255, 0.25);
	border-radius: 0.06em;
	transition: background 0.15s, height 0.15s;
}

.inspector-resize-handle:hover .resize-handle-line,
.inspector-resize-handle:active .resize-handle-line {
	background: #f6c445;
	height: 4em;
}

/* Inspector Collapsed & Closed Strips */
.panel-right-collapsed,
.panel-right-closed {
	width: 2.6em;
	height: 100%;
	background: #0d1322;
	border-left: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding-top: 0.8em;
	flex-shrink: 0;
	z-index: 5;
}

.expand-inspector-btn,
.open-inspector-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.6em 0.35em;
	color: #cbd5e1;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
	transition: all 0.2s;
	font-family: inherit;
}

.expand-inspector-btn:hover,
.open-inspector-btn:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #f6c445;
}

.vertical-text {
	writing-mode: vertical-rl;
	transform: rotate(180deg);
	font-size: 0.85em;
	letter-spacing: 0.05em;
	white-space: nowrap;
}

.panel-right {
	height: 100%;
	min-width: 18em;
	max-width: 60em;
	flex-shrink: 0;
	border-left: 1px solid rgba(255, 255, 255, 0.1);
}

/* Full File Mode */
.panel-full-json {
	flex: 1;
	display: flex;
	flex-direction: column;
	height: 100%;
	background: #090d16;
	padding: 1em;
	box-sizing: border-box;
	gap: 0.6em;
}

.full-json-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.full-json-title {
	font-size: 0.9em;
	color: #cbd5e1;
}

.full-json-title code {
	color: #38bdf8;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
}

.full-json-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.35em 0.7em;
	font-size: 0.82em;
	color: #cbd5e1;
	cursor: pointer;
}

.full-json-btn:hover {
	background: rgba(255, 255, 255, 0.18);
	color: #fff;
}

.full-json-error {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid rgba(239, 68, 68, 0.4);
	color: #fca5a5;
	border-radius: 0.35em;
	padding: 0.4em 0.8em;
	font-size: 0.82em;
}

.full-json-textarea {
	flex: 1;
	width: 100%;
	background: #0d1322;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.45em;
	padding: 0.8em 1em;
	font-size: 0.88em;
	font-family: Consolas, 'Fira Code', monospace;
	line-height: 1.5;
	color: #38bdf8;
	outline: none;
	resize: none;
	tab-size: 2;
	box-sizing: border-box;
}

.full-json-textarea:focus {
	border-color: #f6c445;
}

/* Toast Notification */
.status-toast {
	position: absolute;
	bottom: 1.5em;
	right: 1.5em;
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.6em 1em;
	border-radius: 0.45em;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.7);
	z-index: 1000;
	font-size: 0.88em;
	font-weight: 600;
	backdrop-filter: blur(0.3em);
}

.status-toast.__success {
	background: rgba(16, 185, 129, 0.9);
	color: #fff;
}

.status-toast.__error {
	background: rgba(239, 68, 68, 0.9);
	color: #fff;
}

.status-toast.__warning {
	background: rgba(245, 158, 11, 0.9);
	color: #0f172a;
}

.status-toast.__info {
	background: rgba(30, 41, 59, 0.9);
	color: #f1f5f9;
	border: 1px solid rgba(255, 255, 255, 0.15);
}

.toast-enter-active,
.toast-leave-active {
	transition: all 0.25s ease;
}

.toast-enter-from,
.toast-leave-to {
	opacity: 0;
	transform: translateY(1em);
}
</style>
