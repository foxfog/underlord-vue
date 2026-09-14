<template>
	<div class="localization-manager-view">
		<!-- Top Header Toolbar -->
		<header class="loc-header">
			<div class="header-left">
				<button class="loc-btn loc-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>
				<div class="header-title-box">
					<span class="header-icon">🌐</span>
					<div class="header-titles">
						<h1 class="header-title">Добавить локализацию</h1>
						<span class="header-subtitle">Клонирование дефолтного языка и создание перевода</span>
					</div>
				</div>
			</div>

			<div class="header-right">
				<div class="loc-count-badge">
					<span>Языков в проекте:</span>
					<strong>{{ installedLocales.length }}</strong>
				</div>
				<button
					class="loc-btn loc-btn-secondary"
					title="Перейти в Редактор данных"
					@click="goToDataEditor"
				>
					<span>📚 Редактор данных →</span>
				</button>
			</div>
		</header>

		<!-- Status Message Banner -->
		<Transition name="fade">
			<div
				v-if="statusMessage"
				class="status-banner"
				:class="`__${statusMessage.type}`"
			>
				<span class="status-icon">
					{{ statusMessage.type === 'error' ? '⛔' : '✔' }}
				</span>
				<span class="status-text">{{ statusMessage.text }}</span>
				<button class="status-close-btn" @click="statusMessage = null">✕</button>
			</div>
		</Transition>

		<!-- Main Workspace Grid -->
		<div class="loc-main-scroll">
			<div class="loc-panels-grid">
				<!-- Panel 1: Creation & Cloning Form -->
				<section class="loc-card loc-creation-card">
					<div class="card-header">
						<div class="card-title-group">
							<span class="card-icon">📋</span>
							<h2 class="card-title">Создание новой локализации</h2>
						</div>
						<span class="card-badge __copy">Клонирование</span>
					</div>

					<div class="card-body">
						<p class="section-intro">
							Скопируйте структуру файлов и текстов существующего языка, чтобы создать основу для собственного перевода.
						</p>

						<!-- Step 1: Source Language Selection -->
						<div class="form-step">
							<div class="step-header">
								<span class="step-num">1</span>
								<label class="step-title">Язык-источник (откуда копировать):</label>
							</div>
							<div class="source-select-box">
								<select v-model="sourceLocale" class="loc-select">
									<option
										v-for="loc in installedLocales"
										:key="'src-' + loc.code"
										:value="loc.code"
									>
										{{ loc.flag }} {{ loc.label }} ({{ loc.code.toUpperCase() }}) {{ loc.isDefault ? '— Основной (Дефолт)' : '' }}
									</option>
								</select>
								<div class="source-info-tip">
									<span>Исходный язык:</span>
									<strong>{{ sourceLocaleObj.flag }} {{ sourceLocaleObj.label }}</strong>
									<code>locales/{{ sourceLocale }}/</code>
								</div>
							</div>
						</div>

						<!-- Step 2: Target Language Info -->
						<div class="form-step">
							<div class="step-header">
								<span class="step-num">2</span>
								<label class="step-title">Новый язык перевода (целевой):</label>
							</div>

							<!-- Quick Presets -->
							<div class="presets-section">
								<span class="presets-label">Готовые шаблоны:</span>
								<div class="presets-grid">
									<button
										v-for="preset in PRESET_LOCALES"
										:key="preset.code"
										type="button"
										class="preset-btn"
										:class="{
											__selected: targetCode === preset.code,
											__already: isLocaleInstalled(preset.code)
										}"
										:disabled="isLocaleInstalled(preset.code)"
										@click="selectPreset(preset)"
									>
										<span class="preset-flag">{{ preset.flag }}</span>
										<div class="preset-meta">
											<span class="preset-name">{{ preset.label.split(' ')[0] }}</span>
											<span class="preset-code">{{ preset.code.toUpperCase() }}</span>
										</div>
										<span v-if="isLocaleInstalled(preset.code)" class="preset-badge">Установлен</span>
									</button>
								</div>
							</div>

							<!-- Custom Inputs -->
							<div class="custom-fields-row">
								<div class="loc-field">
									<label class="field-label">
										Код языка (ISO 639-1) <span class="req-star">*</span>
									</label>
									<input
										v-model="targetCode"
										type="text"
										class="loc-input"
										placeholder="например: de, ja, zh"
										maxlength="5"
									/>
								</div>

								<div class="loc-field">
									<label class="field-label">Название языка</label>
									<input
										v-model="targetLabel"
										type="text"
										class="loc-input"
										placeholder="например: Deutsch, 日本語"
									/>
								</div>

								<div class="loc-field __flag-field">
									<label class="field-label">Флаг</label>
									<input
										v-model="targetFlag"
										type="text"
										class="loc-input"
										placeholder="🇩🇪"
										maxlength="4"
									/>
								</div>
							</div>
						</div>

						<!-- Step 3: What to copy -->
						<div class="form-step">
							<div class="step-header">
								<span class="step-num">3</span>
								<label class="step-title">Состав пакета для копирования:</label>
							</div>
							<div class="options-box">
								<label class="checkbox-option">
									<input v-model="copyEntities" type="checkbox" class="loc-checkbox" />
									<div class="opt-desc">
										<span class="opt-title">📦 Словари игровых сущностей</span>
										<span class="opt-sub">
											Копирует <code>characters.json</code>, <code>classes.json</code>, <code>fractions.json</code>, <code>races.json</code>, <code>items.json</code> в папку <code>locales/{{ targetCode || '{код}' }}/</code>.
										</span>
									</div>
								</label>

								<label class="checkbox-option">
									<input v-model="copyStory" type="checkbox" class="loc-checkbox" />
									<div class="opt-desc">
										<span class="opt-title">📜 Сюжетные сценарии новеллы</span>
										<span class="opt-sub">
											Копирует файлы сцен, диалогов и макросов в папку <code>story/{{ targetCode || '{код}' }}/</code> для ручного перевода текста реплик.
										</span>
									</div>
								</label>
							</div>
						</div>

						<!-- Preview Summary -->
						<div class="preview-box">
							<div class="preview-header">
								<span class="preview-icon">🔍</span>
								<span>План создания файлов:</span>
							</div>
							<div class="preview-paths">
								<div class="preview-path-row" v-if="copyEntities">
									<span class="path-label">Словари:</span>
									<code>src/renderer/public/data/locales/{{ targetCode || '{код}' }}/*.json</code>
								</div>
								<div class="preview-path-row" v-if="copyStory">
									<span class="path-label">Сценарии:</span>
									<code>src/renderer/public/data/story/{{ targetCode || '{код}' }}/**</code>
								</div>
								<div class="preview-path-row">
									<span class="path-label">Реестр:</span>
									<code>src/renderer/public/data/locales/locales.json</code>
								</div>
							</div>
						</div>

						<!-- Action Button -->
						<div class="creation-actions">
							<button
								type="button"
								class="loc-btn loc-btn-primary __submit-btn"
								:disabled="isLoading || !targetCode.trim()"
								@click="handleCreateLocale"
							>
								<span v-if="isLoading" class="btn-spinner">⏳</span>
								<span v-else>🚀</span>
								<span>Создать локализацию и скопировать файлы</span>
							</button>
						</div>
					</div>
				</section>

				<!-- Panel 2: Installed Locales List -->
				<section class="loc-card loc-installed-card">
					<div class="card-header">
						<div class="card-title-group">
							<span class="card-icon">📚</span>
							<h2 class="card-title">Установленные локализации</h2>
						</div>
						<button
							type="button"
							class="loc-btn loc-btn-icon"
							title="Обновить список с диска"
							@click="refreshLocales"
						>
							🔄
						</button>
					</div>

					<div class="card-body">
						<p class="section-intro">
							Список языковых пакетов в проекте. Вы можете сразу перейти к переводу сущностей в Редакторе данных или клонировать любой язык как основу.
						</p>

						<div class="installed-list">
							<div
								v-for="loc in installedLocales"
								:key="loc.code"
								class="installed-item-card"
								:class="{ __default: loc.isDefault }"
							>
								<div class="item-header-row">
									<div class="item-identity">
										<span class="item-flag">{{ loc.flag }}</span>
										<div class="item-names">
											<span class="item-title">{{ loc.label }}</span>
											<span class="item-code">[{{ loc.code.toUpperCase() }}]</span>
										</div>
									</div>

									<div class="item-status-badges">
										<span v-if="loc.isDefault" class="status-badge __default">Основной (Дефолт)</span>
										<span v-else class="status-badge __custom">Кастомный</span>
									</div>
								</div>

								<div class="item-details-row">
									<div class="item-detail-chip">
										<span class="chip-icon">📦</span>
										<span>Словари: <strong>{{ loc.entityFiles || 5 }}</strong> файлов</span>
									</div>
									<div class="item-detail-chip">
										<span class="chip-icon">📜</span>
										<span>Сценарии: <strong>{{ loc.storyFiles || 0 }}</strong> файлов</span>
									</div>
								</div>

								<div class="item-actions-row">
									<button
										type="button"
										class="item-action-btn __edit"
										title="Открыть Редактор данных на этом языке"
										@click="editInEditor(loc.code)"
									>
										<span>✏️ Редактировать в Редакторе данных</span>
									</button>

									<button
										type="button"
										class="item-action-btn __clone"
										title="Использовать этот язык как источник для клонирования"
										@click="setAsSource(loc.code)"
									>
										<span>📋 Взять за основу</span>
									</button>

									<button
										v-if="canDeleteLocale(loc.code)"
										type="button"
										class="item-action-btn __delete"
										title="Удалить эту локализацию"
										@click="localeToDelete = loc"
									>
										<span>🗑️</span>
									</button>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>
		</div>

		<!-- Delete Confirmation Modal -->
		<Transition name="fade">
			<div
				v-if="localeToDelete"
				class="modal-overlay"
				@click.self="localeToDelete = null"
			>
				<div class="delete-modal-card">
					<div class="modal-header">
						<span class="modal-icon">⚠️</span>
						<h3 class="modal-title">Удаление локализации</h3>
						<button type="button" class="modal-close-icon-btn" @click="localeToDelete = null">✕</button>
					</div>
					<div class="modal-body">
						<p>
							Вы действительно хотите удалить локализацию
							<strong>«{{ localeToDelete.label }}» ({{ localeToDelete.code.toUpperCase() }})</strong>?
						</p>
						<p class="modal-warning-sub">
							Папка <code>locales/{{ localeToDelete.code }}/</code> и связанные файлы будут безвозвратно удалены с диска.
						</p>
					</div>
					<div class="modal-footer">
						<button class="loc-btn loc-btn-secondary" @click="localeToDelete = null">
							Отмена
						</button>
						<button class="loc-btn loc-btn-danger" @click="confirmDelete">
							🗑️ Да, удалить локализацию
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLocalizationManager } from '@/composables/useLocalizationManager'
import { useDataEditor } from '@/composables/useDataEditor'

const router = useRouter()
const {
	installedLocales,
	sourceLocale,
	sourceLocaleObj,
	targetCode,
	targetLabel,
	targetFlag,
	copyEntities,
	copyStory,
	isLoading,
	statusMessage,
	PRESET_LOCALES,
	selectPreset,
	isLocaleInstalled,
	refreshLocales,
	createLocale,
	deleteLocale,
	canDeleteLocale,
	setStatus
} = useLocalizationManager()

const { switchLocale } = useDataEditor()
const localeToDelete = ref(null)

onMounted(async () => {
	await refreshLocales()
})

function returnToHome() {
	router.push('/home')
}

function goToDataEditor() {
	router.push('/test/data-editor')
}

function setAsSource(code) {
	sourceLocale.value = code
	setStatus(`Язык «${code.toUpperCase()}» выбран в качестве источника для клонирования`, 'success')
}

function editInEditor(code) {
	switchLocale(code)
	router.push('/test/data-editor')
}

async function handleCreateLocale() {
	try {
		await createLocale()
	} catch (err) {
		// Error handled in composable setStatus
	}
}

async function confirmDelete() {
	if (!localeToDelete.value) return
	const code = localeToDelete.value.code
	localeToDelete.value = null
	await deleteLocale(code)
}
</script>

<style scoped>
.localization-manager-view {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: #0b0f19;
	color: #f1f5f9;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	overflow: hidden;
	user-select: none;
}

/* Header Toolbar */
.loc-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.5em;
	background: rgba(15, 23, 42, 0.95);
	border-bottom: 1px solid rgba(246, 196, 69, 0.25);
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.5);
	z-index: 10;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 1.2em;
}

.header-title-box {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.header-icon {
	font-size: 1.8em;
	line-height: 1;
}

.header-titles {
	display: flex;
	flex-direction: column;
}

.header-title {
	font-size: 1.25em;
	font-weight: bold;
	color: #f6c445;
	margin: 0;
	font-family: Overlord, Kurale, serif;
	letter-spacing: 0.05em;
}

.header-subtitle {
	font-size: 0.75em;
	color: #94a3b8;
}

.header-right {
	display: flex;
	align-items: center;
	gap: 1em;
}

.loc-count-badge {
	font-size: 0.85em;
	color: #cbd5e1;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.35em 0.8em;
	display: flex;
	gap: 0.4em;
}

.loc-count-badge strong {
	color: #f6c445;
}

/* Status Banner */
.status-banner {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.5em 1.5em;
	font-size: 0.85em;
	border-bottom: 1px solid transparent;
	z-index: 20;
}

.status-banner.__success {
	background: rgba(16, 185, 129, 0.2);
	color: #6ee7b7;
	border-color: rgba(16, 185, 129, 0.4);
}

.status-banner.__error {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	border-color: rgba(239, 68, 68, 0.4);
}

.status-icon {
	font-size: 1.1em;
}

.status-text {
	flex: 1;
}

.status-close-btn {
	background: transparent;
	border: none;
	color: inherit;
	font-size: 1.1em;
	cursor: pointer;
	opacity: 0.7;
	transition: opacity 0.2s;
}

.status-close-btn:hover {
	opacity: 1;
}

/* Main Workspace */
.loc-main-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 1.5em;
}

.loc-panels-grid {
	display: grid;
	grid-template-columns: 1.2fr 1fr;
	gap: 1.5em;
	max-width: 110em;
	margin: 0 auto;
}

@media (max-width: 768px) {
	.loc-panels-grid {
		grid-template-columns: 1fr;
	}
}

/* Cards */
.loc-card {
	background: rgba(18, 24, 38, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	box-shadow: 0 0.4em 1.5em rgba(0, 0, 0, 0.4);
}

.card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.9em 1.2em;
	background: rgba(15, 23, 42, 0.7);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.card-title-group {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.card-icon {
	font-size: 1.3em;
}

.card-title {
	font-size: 1.1em;
	margin: 0;
	color: #f1f5f9;
	font-family: Overlord, Kurale, serif;
	letter-spacing: 0.03em;
}

.card-badge.__copy {
	font-size: 0.7em;
	background: rgba(59, 130, 246, 0.2);
	color: #60a5fa;
	border: 1px solid rgba(59, 130, 246, 0.4);
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	font-weight: bold;
	text-transform: uppercase;
}

.card-body {
	padding: 1.2em;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
}

.section-intro {
	font-size: 0.85em;
	color: #94a3b8;
	line-height: 1.4;
	margin: 0;
}

/* Form Steps */
.form-step {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	background: rgba(15, 23, 42, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.5em;
	padding: 0.8em 1em;
}

.step-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.step-num {
	width: 1.4em;
	height: 1.4em;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	background: #3b82f6;
	color: #ffffff;
	border-radius: 50%;
	font-size: 0.8em;
	font-weight: bold;
}

.step-title {
	font-size: 0.9em;
	font-weight: bold;
	color: #e2e8f0;
}

.source-select-box {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.source-info-tip {
	font-size: 0.75em;
	color: #64748b;
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.source-info-tip strong {
	color: #94a3b8;
}

.source-info-tip code {
	color: #f6c445;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
}

/* Presets Grid */
.presets-section {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.presets-label {
	font-size: 0.75em;
	color: #64748b;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.presets-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr));
	gap: 0.4em;
	max-height: 10em;
	overflow-y: auto;
	padding: 0.2em;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.preset-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.4em 0.55em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	color: #cbd5e1;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	text-align: left;
	transition: background-color 0.15s, border-color 0.15s;
}

.preset-btn:hover:not(:disabled) {
	background: rgba(59, 130, 246, 0.2);
	border-color: #3b82f6;
	color: #ffffff;
}

.preset-btn.__selected {
	background: rgba(59, 130, 246, 0.35);
	border-color: #60a5fa;
	color: #93c5fd;
	font-weight: bold;
}

.preset-btn.__already {
	opacity: 0.5;
	cursor: not-allowed;
}

.preset-flag {
	font-size: 1.2em;
	line-height: 1;
}

.preset-meta {
	display: flex;
	flex-direction: column;
	flex: 1;
	overflow: hidden;
}

.preset-name {
	font-size: 0.75em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.preset-code {
	font-size: 0.65em;
	color: #64748b;
}

.preset-badge {
	font-size: 0.6em;
	color: #34d399;
	background: rgba(16, 185, 129, 0.15);
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
}

/* Custom Fields */
.custom-fields-row {
	display: flex;
	gap: 0.8em;
	margin-top: 0.3em;
}

.loc-field {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	flex: 1;
}

.loc-field.__flag-field {
	max-width: 5em;
}

.field-label {
	font-size: 0.75em;
	color: #94a3b8;
}

.req-star {
	color: #ef4444;
}

/* Options Box */
.options-box {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.checkbox-option {
	display: flex;
	align-items: flex-start;
	gap: 0.6em;
	padding: 0.5em 0.7em;
	background: rgba(0, 0, 0, 0.2);
	border: 1px solid rgba(255, 255, 255, 0.05);
	border-radius: 0.35em;
	cursor: pointer;
	transition: background-color 0.15s;
}

.checkbox-option:hover {
	background: rgba(255, 255, 255, 0.03);
}

.loc-checkbox {
	margin-top: 0.2em;
	width: 1.1em;
	height: 1.1em;
	cursor: pointer;
}

.opt-desc {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
}

.opt-title {
	font-size: 0.85em;
	font-weight: bold;
	color: #f1f5f9;
}

.opt-sub {
	font-size: 0.75em;
	color: #64748b;
	line-height: 1.3;
}

.opt-sub code {
	color: #f6c445;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.05em 0.3em;
	border-radius: 0.2em;
}

/* Preview Box */
.preview-box {
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(59, 130, 246, 0.25);
	border-radius: 0.4em;
	padding: 0.7em 0.9em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.preview-header {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.8em;
	font-weight: bold;
	color: #93c5fd;
}

.preview-paths {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.preview-path-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.75em;
}

.path-label {
	color: #94a3b8;
	min-width: 5.5em;
}

.preview-path-row code {
	color: #fcd34d;
	background: rgba(0, 0, 0, 0.35);
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
	word-break: break-all;
}

/* Creation Actions */
.creation-actions {
	margin-top: 0.5em;
}

.__submit-btn {
	width: 100%;
	padding: 0.75em 1.2em;
	font-size: 0.95em;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
}

/* Installed Locales List */
.installed-list {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	max-height: 38em;
	overflow-y: auto;
	padding-right: 0.3em;
}

.installed-item-card {
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.9em 1.1em;
	display: flex;
	flex-direction: column;
	gap: 0.7em;
	transition: border-color 0.2s, background-color 0.2s;
}

.installed-item-card:hover {
	border-color: rgba(246, 196, 69, 0.3);
	background: rgba(26, 35, 54, 0.75);
}

.installed-item-card.__default {
	border-color: rgba(16, 185, 129, 0.4);
	background: rgba(16, 185, 129, 0.05);
}

.item-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.item-identity {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.item-flag {
	font-size: 1.6em;
	line-height: 1;
}

.item-names {
	display: flex;
	flex-direction: column;
}

.item-title {
	font-size: 1em;
	font-weight: bold;
	color: #f1f5f9;
}

.item-code {
	font-size: 0.75em;
	color: #64748b;
	font-weight: bold;
}

.status-badge {
	font-size: 0.7em;
	padding: 0.15em 0.5em;
	border-radius: 0.25em;
	font-weight: bold;
}

.status-badge.__default {
	background: rgba(16, 185, 129, 0.2);
	color: #34d399;
	border: 1px solid rgba(16, 185, 129, 0.4);
}

.status-badge.__custom {
	background: rgba(59, 130, 246, 0.2);
	color: #60a5fa;
	border: 1px solid rgba(59, 130, 246, 0.4);
}

.item-details-row {
	display: flex;
	align-items: center;
	gap: 1em;
	font-size: 0.8em;
	color: #94a3b8;
}

.item-detail-chip {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.2em 0.6em;
	border-radius: 0.3em;
}

.chip-icon {
	font-size: 0.95em;
}

.item-actions-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
	flex-wrap: wrap;
	padding-top: 0.4em;
	border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.item-action-btn {
	padding: 0.4em 0.7em;
	border-radius: 0.35em;
	font-size: 0.8em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	border: 1px solid transparent;
	transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}

.item-action-btn.__edit {
	background: rgba(246, 196, 69, 0.15);
	border-color: rgba(246, 196, 69, 0.35);
	color: #f6c445;
	font-weight: bold;
	flex: 1;
	min-width: 14em;
}

.item-action-btn.__edit:hover {
	background: rgba(246, 196, 69, 0.28);
	color: #ffffff;
}

.item-action-btn.__clone {
	background: rgba(59, 130, 246, 0.15);
	border-color: rgba(59, 130, 246, 0.35);
	color: #93c5fd;
}

.item-action-btn.__clone:hover {
	background: rgba(59, 130, 246, 0.28);
	color: #ffffff;
}

.item-action-btn.__delete {
	background: rgba(239, 68, 68, 0.15);
	border-color: rgba(239, 68, 68, 0.3);
	color: #f87171;
	padding: 0.4em 0.6em;
}

.item-action-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ffffff;
}

/* Common UI Elements */
.loc-btn {
	padding: 0.45em 0.9em;
	border-radius: 0.4em;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	border: 1px solid transparent;
	transition: background-color 0.2s, border-color 0.2s, color 0.2s, box-shadow 0.2s;
}

.loc-btn-back {
	background: rgba(255, 255, 255, 0.08);
	border-color: rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
}

.loc-btn-back:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ffffff;
}

.loc-btn-primary {
	background: #f6c445;
	color: #0f172a;
	border-color: #d9a830;
	font-weight: bold;
}

.loc-btn-primary:hover:not(:disabled) {
	background: #ffd369;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.35);
}

.loc-btn-primary:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.loc-btn-secondary {
	background: rgba(59, 130, 246, 0.15);
	border-color: rgba(59, 130, 246, 0.35);
	color: #93c5fd;
}

.loc-btn-secondary:hover {
	background: rgba(59, 130, 246, 0.25);
	color: #ffffff;
}

.loc-btn-icon {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	padding: 0.3em 0.5em;
	font-size: 0.9em;
	cursor: pointer;
	transition: background-color 0.15s;
}

.loc-btn-icon:hover {
	background: rgba(255, 255, 255, 0.1);
}

.loc-btn-danger {
	background: #ef4444;
	color: #ffffff;
	border-color: #dc2626;
	font-weight: bold;
}

.loc-btn-danger:hover {
	background: #f87171;
}

.loc-input,
.loc-select {
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.45em 0.8em;
	color: #f1f5f9;
	font-family: Kurale, sans-serif;
	font-size: 0.85em;
	transition: border-color 0.2s, box-shadow 0.2s;
}

.loc-input:focus,
.loc-select:focus {
	outline: none;
	border-color: #3b82f6;
	box-shadow: 0 0 0.4em rgba(59, 130, 246, 0.3);
}

/* Modals */
.modal-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(0.25em);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 200;
}

.delete-modal-card {
	background: #0f172a;
	border: 1px solid rgba(239, 68, 68, 0.4);
	border-radius: 0.6em;
	width: min(28em, 90%);
	padding: 1.2em;
	display: flex;
	flex-direction: column;
	gap: 1em;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.85);
}

.modal-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.modal-title {
	font-size: 1.1em;
	margin: 0;
	color: #f87171;
	font-family: Overlord, Kurale, serif;
	flex: 1;
}

.modal-close-icon-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.1em;
	cursor: pointer;
}

.modal-close-icon-btn:hover {
	color: #ffffff;
}

.modal-body {
	font-size: 0.85em;
	color: #cbd5e1;
	line-height: 1.4;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.modal-body p {
	margin: 0;
}

.modal-warning-sub {
	color: #ef4444;
	font-size: 0.8em;
}

.modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.8em;
	margin-top: 0.4em;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
}
</style>
