<template>
	<div class="data-editor-view">
		<!-- Top Toolbar -->
		<header class="editor-header">
			<div class="header-left">
				<button class="editor-btn editor-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>

				<div class="header-title-box">
					<span class="header-icon">📚</span>
					<span class="header-title">Редактор данных (Data Editor)</span>
				</div>
			</div>

			<!-- Entity Type Switcher Tabs -->
			<div class="header-tabs">
				<button
					v-for="tab in tabConfigs"
					:key="tab.id"
					class="type-tab-btn"
					:class="{ __active: activeTab === tab.id }"
					@click="switchTab(tab.id)"
				>
					<span class="tab-icon">{{ tab.icon }}</span>
					<span class="tab-name">{{ tab.name }}</span>
					<span class="tab-count">{{ counts[tab.id] || 0 }}</span>
				</button>
			</div>

			<div class="header-right">
				<!-- Global Language Switcher Dropdown -->
				<div class="header-locale-dropdown-wrap" ref="headerLocaleDropdownRef">
					<button
						type="button"
						class="header-locale-trigger-btn"
						:class="{ __open: isHeaderLocaleOpen }"
						title="Выбрать язык отображения данных и интерфейса"
						@click="isHeaderLocaleOpen = !isHeaderLocaleOpen"
					>
						<span class="trigger-flag">{{ currentLocaleObj.flag }}</span>
						<span class="trigger-name">{{ currentLocaleObj.label }}</span>
						<span class="trigger-code">({{ currentLocaleObj.code.toUpperCase() }})</span>
						<span class="trigger-arrow">{{ isHeaderLocaleOpen ? '▲' : '▼' }}</span>
					</button>

					<!-- Dropdown Menu -->
					<Transition name="fade">
						<div v-if="isHeaderLocaleOpen" class="header-locale-dropdown-menu">
							<div class="dropdown-menu-header">
								<span class="menu-header-title">Язык данных:</span>
							</div>
							<div class="dropdown-menu-list">
								<button
									v-for="loc in availableLocales"
									:key="'hloc-' + loc.code"
									type="button"
									class="locale-dropdown-item"
									:class="{ __active: activeLocale === loc.code }"
									@click="selectHeaderLocale(loc.code)"
								>
									<span class="item-flag">{{ loc.flag }}</span>
									<div class="item-info">
										<span class="item-label">{{ loc.label }}</span>
										<span class="item-code">{{ loc.code.toUpperCase() }}</span>
									</div>
									<span v-if="loc.code === 'ru'" class="item-badge __default">Основной</span>
									<span v-if="activeLocale === loc.code" class="item-check">✔</span>
								</button>
							</div>
							<div class="dropdown-menu-footer">
								<button
									type="button"
									class="add-locale-btn"
									@click="openAddLocaleModal"
								>
									<span class="add-icon">➕</span>
									<span>Добавить язык...</span>
								</button>
							</div>
						</div>
					</Transition>
				</div>

				<div class="file-path-badge" :title="currentFilePath">
					<span class="path-icon">📁</span>
					<span class="path-text">{{ currentFilePath }}</span>
				</div>
			</div>
		</header>

		<!-- Status / Notification Alert Banner -->
		<Transition name="fade">
			<div
				v-if="statusMessage"
				class="status-banner"
				:class="`__${statusMessage.type}`"
			>
				<span class="status-icon">
					{{ statusMessage.type === 'error' ? '⚠️' : statusMessage.type === 'info' ? 'ℹ️' : '✔' }}
				</span>
				<span class="status-text">{{ statusMessage.text }}</span>
			</div>
		</Transition>

		<!-- Main Workspace: Split View (List + Form / Manager) -->
		<div class="editor-workspace">
			<!-- ========================================================= -->
			<!-- TAB: TAGS MANAGER (when activeTab === 'tags')             -->
			<!-- ========================================================= -->
			<template v-if="activeTab === 'tags'">
				<aside class="sidebar-list-pane">
					<div class="list-toolbar">
						<div class="search-box">
							<span class="search-icon">🔍</span>
							<input
								v-model="searchQuery"
								type="text"
								class="search-input"
								placeholder="Поиск тегов..."
							/>
							<button
								v-if="searchQuery"
								class="search-clear-btn"
								@click="searchQuery = ''"
							>
								✕
							</button>
						</div>

						<!-- Add New Global Tag Input -->
						<div class="tag-creator-bar">
							<input
								v-model="newTagInput"
								type="text"
								class="editor-input"
								placeholder="Новый тег (латиница)..."
								@keyup.enter="handleCreateTag"
							/>
							<button
								class="editor-btn editor-btn-primary"
								:disabled="!newTagInput.trim()"
								@click="handleCreateTag"
							>
								<span>➕</span>
							</button>
						</div>
					</div>

					<div class="cards-scroll-area">
						<div
							v-if="filteredList.length === 0"
							class="empty-list-notice"
						>
							{{ searchQuery ? 'Теги не найдены' : 'Список тегов пуст' }}
						</div>

						<div
							v-for="(tag, tIdx) in filteredList"
							:key="tag"
							class="tag-list-item"
							:class="{
								__active: selectedTagForInspector === tag,
								'__is-dragging': draggedTagIndex === tIdx,
								'__drag-over': dragOverTagIndex === tIdx
							}"
							:draggable="!searchQuery"
							@dragstart="onTagDragStart($event, tIdx)"
							@dragover.prevent="onTagDragOver($event, tIdx)"
							@dragleave="onTagDragLeave($event, tIdx)"
							@drop="onTagDrop($event, tIdx)"
							@dragend="onTagDragEnd"
							@click="selectedTagForInspector = tag"
						>
							<div class="tag-order-controls" @click.stop>
								<span class="card-index-badge">#{{ tIdx + 1 }}</span>
								<div v-if="!searchQuery" class="card-order-arrows">
									<button
										type="button"
										class="order-arrow-btn"
										:disabled="tIdx === 0"
										title="Переместить выше в tags.json"
										@click.stop="handleMoveTagUp(tIdx)"
									>
										▲
									</button>
									<button
										type="button"
										class="order-arrow-btn"
										:disabled="tIdx === filteredList.length - 1"
										title="Переместить ниже в tags.json"
										@click.stop="handleMoveTagDown(tIdx)"
									>
										▼
									</button>
								</div>
							</div>

							<div class="tag-item-left">
								<span class="tag-item-icon">🏷️</span>
								<span class="tag-item-name">{{ tag }}</span>
							</div>

							<div class="tag-item-right">
								<span
									class="tag-usage-count"
									:title="`Используется в ${getTagUsageCount(tag)} сущностях`"
								>
									{{ getTagUsageCount(tag) }}
								</span>
								<button
									class="card-action-btn __delete"
									title="Удалить тег из реестра"
									@click.stop="promptDeleteTag(tag)"
								>
									🗑️
								</button>
							</div>
						</div>
					</div>
				</aside>

				<main class="form-pane">
					<div class="tags-inspector-pane">
						<div class="form-header">
							<div class="form-title-group">
								<span class="form-status-tag __edit">Реестр тегов</span>
								<h2 class="form-title">
									{{ selectedTagForInspector ? `Тег: ${selectedTagForInspector}` : 'Глобальный реестр тегов' }}
								</h2>
							</div>

							<div class="form-header-actions">
								<span class="file-save-target">
									Файл реестра: <code>tags/tags.json</code>
								</span>
							</div>
						</div>

						<div class="tags-inspector-content">
							<div v-if="selectedTagForInspector" class="tag-detail-box">
								<div class="tag-detail-header">
									<span class="tag-hero-badge">🏷️ {{ selectedTagForInspector }}</span>
									<span class="tag-hero-usage">
										Всего использований: {{ getTagUsageCount(selectedTagForInspector) }}
									</span>
								</div>

								<div class="tag-usage-sections">
									<h4 class="usage-section-heading">Сущности с этим тегом:</h4>
									<div class="usage-entities-grid">
										<div
											v-for="ent in getEntitiesWithTag(selectedTagForInspector)"
											:key="ent.type + '-' + ent.id"
											class="usage-entity-chip"
										>
											<span class="usage-ent-type">{{ ent.typeLabel }}:</span>
											<span class="usage-ent-name">{{ ent.name }}</span>
											<span class="usage-ent-id">({{ ent.id }})</span>
										</div>
										<div
											v-if="getEntitiesWithTag(selectedTagForInspector).length === 0"
											class="no-usage-note"
										>
											Этот тег пока не назначен ни одной сущности.
										</div>
									</div>
								</div>
							</div>

							<div v-else class="empty-state-content">
								<div class="empty-state-icon">🏷️</div>
								<h3 class="empty-state-title">Управление реестром тегов</h3>
								<p class="empty-state-desc">
									Все теги сохраняются в <code>src/renderer/public/data/tags/tags.json</code>. Вы можете создавать новые теги, проверять их использование в персонажах, классах, фракциях, расах и предметах.
								</p>
							</div>
						</div>
					</div>
				</main>
			</template>

			<!-- ========================================================= -->
			<!-- TABS: CHARACTERS, CLASSES, FRACTIONS, RACES, ITEMS        -->
			<!-- ========================================================= -->
			<template v-else>
				<!-- Left Column: Entities List & Filter -->
				<aside class="sidebar-list-pane">
					<div class="list-toolbar">
						<div class="search-box">
							<span class="search-icon">🔍</span>
							<input
								v-model="searchQuery"
								type="text"
								class="search-input"
								placeholder="Поиск по имени, ID, тегам..."
							/>
							<button
								v-if="searchQuery"
								class="search-clear-btn"
								@click="searchQuery = ''"
							>
								✕
							</button>
						</div>

						<button class="editor-btn editor-btn-primary add-entity-btn" @click="onStartCreate">
							<span>➕ Создать {{ currentTypeLabel.toLowerCase() }}</span>
						</button>
					</div>

					<div v-if="searchQuery" class="search-filter-active-notice">
						<span>🔍 Фильтр активен — ручная сортировка временно отключена</span>
					</div>

					<!-- Entity Cards List -->
					<div class="cards-scroll-area">
						<div
							v-if="filteredList.length === 0"
							class="empty-list-notice"
						>
							{{ searchQuery ? 'Ничего не найдено по вашему запросу' : 'Список пуст' }}
						</div>

						<div
							v-for="(item, idx) in filteredList"
							:key="item.id"
							class="entity-card"
							:class="{
								__active: selectedEntity && selectedEntity.id === item.id && !isCreating,
								'__child-card': isChildItem(item, activeTab),
								'__is-dragging': draggedIndex === idx,
								'__drag-over': dragOverIndex === idx
							}"
							:style="getChildCardStyle(item)"
							:draggable="!searchQuery"
							@dragstart="onCardDragStart($event, idx)"
							@dragover.prevent="onCardDragOver($event, idx)"
							@dragleave="onCardDragLeave($event, idx)"
							@drop="onCardDrop($event, idx)"
							@dragend="onCardDragEnd"
							@click="onSelectEntity(item)"
						>
							<!-- Child visual connector branch -->
							<div
								v-if="isChildItem(item, activeTab)"
								class="child-tree-connector"
								:title="getChildBadgeLabel(item)"
							>
								<span class="child-tree-arrow">↳</span>
							</div>

							<!-- Order controls and file position index -->
							<div class="card-order-controls" @click.stop>
								<span class="card-index-badge" :title="`Позиция в файле #${idx + 1}`">
									#{{ idx + 1 }}
								</span>
								<div v-if="!searchQuery" class="card-order-arrows">
									<button
										type="button"
										class="order-arrow-btn"
										:disabled="!canMoveItemUp(item, idx, activeTab)"
										:title="canMoveItemUp(item, idx, activeTab) ? 'Переместить вверх в файле' : 'Нельзя переместить выше'"
										@click.stop="handleMoveItemUp(item, idx)"
									>
										▲
									</button>
									<button
										type="button"
										class="order-arrow-btn"
										:disabled="!canMoveItemDown(item, idx, activeTab)"
										:title="canMoveItemDown(item, idx, activeTab) ? 'Переместить вниз в файле' : 'Нельзя переместить ниже'"
										@click.stop="handleMoveItemDown(item, idx)"
									>
										▼
									</button>
								</div>
							</div>

							<div class="card-icon-col">
								<span v-if="!item.icon || isEmoji(item.icon)" class="card-emoji-icon">
									{{ item.icon || defaultIconForTab }}
								</span>
								<img
									v-else
									:src="resolveIconPath(item.icon)"
									class="card-img-icon"
									alt=""
									@error="(e) => e.target.style.display = 'none'"
								/>
							</div>

							<div class="card-content-col">
								<div class="card-header-row">
									<div class="card-title-wrap">
										<span class="card-name">
											{{ getEntityText(activeTab, item.id, 'name') }}
											<span
												v-if="activeLocale !== 'ru' && !hasLocaleTranslation(activeTab, item.id, 'name', activeLocale)"
												class="locale-fallback-badge"
												title="Перевод на выбранный язык отсутствует, используется дефолтный русский"
											>
												RU
											</span>
										</span>
										<span
											v-if="isChildItem(item, activeTab)"
											class="child-indicator-pill"
											:class="'__' + activeTab"
										>
											↳ {{ getChildBadgeLabel(item) }}
										</span>
									</div>
									<span class="card-id-badge">{{ item.id }}</span>
								</div>

								<!-- Badges / Relations Row -->
								<div class="card-badges-row">
									<!-- Character Relations -->
									<template v-if="activeTab === 'characters'">
										<span
											v-for="rId in (item.races || [])"
											:key="'r-' + rId"
											class="rel-badge __race"
											:title="'Раса: ' + getRaceName(rId)"
										>
											🧬 {{ getRaceName(rId) }}
										</span>
										<span
											v-for="cId in (item.classs || [])"
											:key="'c-' + cId"
											class="rel-badge __class"
											:title="'Класс: ' + getClassName(cId)"
										>
											⚔️ {{ getClassName(cId) }}
										</span>
										<span
											v-for="fId in (item.fractions || [])"
											:key="'f-' + fId"
											class="rel-badge __fraction"
											:title="'Фракция: ' + getFactionName(fId)"
										>
											🏛️ {{ getFactionName(fId) }}
										</span>
										<!-- Show count of total unique tags for character -->
										<span class="rel-badge __tags-count" title="Всего уникальных тегов (собственные + унаследованные)">
											🏷️ {{ getCharacterCombinedTags(item).length }} тегов
										</span>
									</template>

									<!-- Parent Relation for Classes / Races / Fractions -->
									<template v-if="['classes', 'races', 'fractions'].includes(activeTab) && item.parent_id">
										<span class="rel-badge __parent" :title="'Базовый предок: ' + item.parent_id">
											↳ {{ getParentLabel(item.parent_id) }}
										</span>
									</template>

									<!-- Item badges -->
									<template v-if="activeTab === 'items'">
										<span class="rel-badge" :class="item.type === 'equipment' ? '__equip' : '__other'">
											{{ item.type === 'equipment' ? 'Экипировка' : 'Расходник' }}
										</span>
										<span v-if="item.slot" class="rel-badge __slot">
											{{ Array.isArray(item.slot) ? item.slot.join(', ') : item.slot }}
										</span>
									</template>

									<!-- Category badge for races -->
									<span v-if="activeTab === 'races' && item.category" class="rel-badge __cat">
										{{ item.category }}
									</span>

									<!-- Type badge for fractions -->
									<span v-if="activeTab === 'fractions' && item.type" class="rel-badge __cat">
										{{ item.type }}
									</span>
								</div>
							</div>

							<div class="card-actions-col">
								<button
									class="card-action-btn __edit"
									title="Редактировать"
									@click.stop="onSelectEntity(item)"
								>
									✏️
								</button>
								<button
									class="card-action-btn __delete"
									title="Удалить"
									@click.stop="promptDelete(item)"
								>
									🗑️
								</button>
							</div>
						</div>
					</div>
				</aside>

				<!-- Right Column: Detail / Edit Form -->
				<main class="form-pane">
					<div v-if="selectedEntity" class="form-container">
						<div class="form-header">
							<div class="form-title-group">
								<span class="form-status-tag" :class="isCreating ? '__new' : '__edit'">
									{{ isCreating ? 'Создание' : 'Редактирование' }}
								</span>
								<h2 class="form-title">
									{{ isCreating ? `Новый(ая) ${currentTypeLabel}` : (getEntityText(activeTab, selectedEntity.id, 'name') || selectedEntity.id) }}
								</h2>
							</div>

							<div class="form-header-actions">
								<button class="editor-btn editor-btn-secondary" @click="cancelEdit">
									Отмена
								</button>
								<button
									class="editor-btn editor-btn-primary save-btn"
									:disabled="isSaving"
									@click="handleSave"
								>
									<span class="btn-icon">💾</span>
									<span>{{ isSaving ? 'Сохранение...' : 'Сохранить в JSON' }}</span>
								</button>
							</div>
						</div>

						<!-- Form Fields Area -->
						<div class="form-fields-scroll">
							<!-- Localization Switcher inside Form -->
							<div class="form-locale-panel">
								<div class="form-locale-row">
									<div class="form-locale-select-box">
										<label class="form-locale-select-label">
											<span class="info-icon">🌐</span>
											<span>Язык перевода:</span>
										</label>
										<select
											:value="activeLocale"
											class="editor-select form-locale-select"
											@change="switchLocale($event.target.value)"
										>
											<option
												v-for="loc in availableLocales"
												:key="'form-sel-loc-' + loc.code"
												:value="loc.code"
											>
												{{ loc.flag }} {{ loc.label }} ({{ loc.code.toUpperCase() }}) {{ loc.code === 'ru' ? '— Основной' : '' }}
											</option>
										</select>
										<button
											type="button"
											class="editor-btn editor-btn-secondary __form-add-lang-btn"
											title="Добавить новый язык в проект"
											@click="openAddLocaleModal"
										>
											<span>➕ Добавить язык</span>
										</button>
									</div>

									<div class="form-locale-info">
										<span class="info-text">
											Файл: <code>locales/{{ activeLocale }}/{{ activeTab }}.json</code>
										</span>
										<span
											v-if="activeLocale === 'ru'"
											class="tab-default-tag"
										>
											Основной (Дефолт)
										</span>
										<span
											v-else-if="selectedEntity._locales && !selectedEntity._locales[activeLocale]?.name"
											class="tab-missing-tag"
										>
											Нет перевода
										</span>
										<span
											v-else
											class="tab-default-tag"
										>
											Перевод заполнен
										</span>
									</div>
								</div>
							</div>

							<!-- Primary Row: ID & Name -->
							<div class="field-row __split">
								<div class="form-field">
									<label class="field-label">
										ID <span class="req-star">*</span>
										<span class="field-hint">(латиница, цифры, дефис, подчеркивание)</span>
									</label>
									<input
										v-model="selectedEntity.id"
										type="text"
										class="editor-input"
										placeholder="например: archer, undead, carne_guard"
										:disabled="!isCreating"
									/>
								</div>

								<div class="form-field">
									<div class="field-label-row">
										<label class="field-label">
											Название (Name) <span class="req-star">*</span>
											<span class="locale-pill-tag" :class="`__${activeLocale}`">
												{{ activeLocale.toUpperCase() }}
											</span>
										</label>
										<span
											v-if="activeLocale !== 'ru' && selectedEntity._locales?.ru?.name"
											class="field-ru-preview"
											:title="selectedEntity._locales.ru.name"
										>
											RU: {{ selectedEntity._locales.ru.name }}
										</span>
									</div>
									<input
										v-model="currentLocaleName"
										type="text"
										class="editor-input"
										:placeholder="activeLocale !== 'ru' && selectedEntity._locales?.ru?.name ? `[RU: ${selectedEntity._locales.ru.name}]` : 'Отображаемое имя сущности'"
									/>
								</div>
							</div>

							<!-- Icon / Sprite Path -->
							<div class="field-row __split">
								<div class="form-field">
									<label class="field-label">
										Иконка (Icon / Emoji / Спрайт)
									</label>
									<div class="icon-input-box">
										<input
											v-model="selectedEntity.icon"
											type="text"
											class="editor-input"
											placeholder="Эмодзи (💀) или путь (images/sprites/...)"
										/>
										<div class="icon-preview-box">
											<span v-if="!selectedEntity.icon || isEmoji(selectedEntity.icon)" class="icon-preview-emoji">
												{{ selectedEntity.icon || '❓' }}
											</span>
											<img
												v-else
												:src="resolveIconPath(selectedEntity.icon)"
												class="icon-preview-img"
												alt=""
												@error="(e) => e.target.style.display = 'none'"
											/>
										</div>
									</div>
								</div>

								<!-- Characters: Names / Synonyms -->
								<div v-if="activeTab === 'characters'" class="form-field">
									<div class="field-label-row">
										<label class="field-label">
											Синонимы / Другие имена (Names)
											<span class="locale-pill-tag" :class="`__${activeLocale}`">
												{{ activeLocale.toUpperCase() }}
											</span>
											<span class="field-hint">(через запятую)</span>
										</label>
										<span
											v-if="activeLocale !== 'ru' && selectedEntity._locales?.ru?.names?.length"
											class="field-ru-preview"
										>
											RU: {{ arrayToCommaStr(selectedEntity._locales.ru.names) }}
										</span>
									</div>
									<input
										:value="arrayToCommaStr(currentLocaleNames)"
										type="text"
										class="editor-input"
										:placeholder="activeLocale !== 'ru' && selectedEntity._locales?.ru?.names?.length ? `[RU: ${arrayToCommaStr(selectedEntity._locales.ru.names)}]` : 'Путник, Аинз, Владыка...'"
										@input="currentLocaleNames = commaStrToArray($event.target.value)"
									/>
								</div>

								<!-- Classes & Races: Parent ID -->
								<div v-if="['classes', 'races'].includes(activeTab)" class="form-field">
									<label class="field-label">
										Родитель (Parent ID)
										<span class="field-hint">(для иерархии/подклассов)</span>
									</label>
									<select v-model="selectedEntity.parent_id" class="editor-select">
										<option :value="null">— Нет (базовая сущность) —</option>
										<option
											v-for="parentOpt in availableParentOptions"
											:key="parentOpt.id"
											:value="parentOpt.id"
										>
											{{ parentOpt.name }} ({{ parentOpt.id }})
										</option>
									</select>
								</div>

								<!-- Factions: Type & Parent ID -->
								<div v-if="activeTab === 'fractions'" class="form-field">
									<label class="field-label">
										Тип организации (Type)
									</label>
									<input
										v-model="selectedEntity.type"
										type="text"
										class="editor-input"
										placeholder="guild, nation, settlement, stronghold..."
									/>
								</div>

								<!-- Items: Category / Type -->
								<div v-if="activeTab === 'items'" class="form-field">
									<label class="field-label">
										Категория предмета (Type)
									</label>
									<select v-model="selectedEntity.type" class="editor-select">
										<option value="equipment">Экипировка (equipment)</option>
										<option value="other">Прочее / Расходники (other)</option>
									</select>
								</div>
							</div>

							<!-- CHARACTERS RELATIONS PANEL -->
							<template v-if="activeTab === 'characters'">
								<div class="relations-panel">
									<div class="panel-section-title">
										🔗 Привязанные сущности (Связи по ID)
									</div>

									<!-- Races Multi-Select -->
									<div class="multi-select-box">
										<label class="field-label">
											Расы персонажа (Races):
											<span class="field-hint">нажмите для выбора нескольких</span>
										</label>
										<div class="chips-container">
											<button
												v-for="r in entities.races"
												:key="'sel-r-' + r.id"
												type="button"
												class="chip-toggle-btn __race"
												:class="{ __selected: (selectedEntity.races || []).includes(r.id) }"
												@click="toggleRelationItem(selectedEntity.races, r.id)"
											>
												<span class="chip-check">{{ (selectedEntity.races || []).includes(r.id) ? '☑' : '☐' }}</span>
												<span class="chip-name">{{ r.name || r.id }}</span>
												<span class="chip-id">({{ r.id }})</span>
											</button>
										</div>
									</div>

									<!-- Classes Multi-Select -->
									<div class="multi-select-box">
										<label class="field-label">
											Классы персонажа (Classes / Classs):
											<span class="field-hint">нажмите для выбора нескольких</span>
										</label>
										<div class="chips-container">
											<button
												v-for="c in entities.classes"
												:key="'sel-c-' + c.id"
												type="button"
												class="chip-toggle-btn __class"
												:class="{ __selected: (selectedEntity.classs || []).includes(c.id) }"
												@click="toggleRelationItem(selectedEntity.classs, c.id)"
											>
												<span class="chip-check">{{ (selectedEntity.classs || []).includes(c.id) ? '☑' : '☐' }}</span>
												<span class="chip-name">{{ c.name || c.id }}</span>
												<span class="chip-id">({{ c.id }})</span>
											</button>
										</div>
									</div>

									<!-- Fractions Multi-Select -->
									<div class="multi-select-box">
										<label class="field-label">
											Фракции персонажа (Factions / Fractions):
											<span class="field-hint">нажмите для выбора нескольких</span>
										</label>
										<div class="chips-container">
											<button
												v-for="f in entities.fractions"
												:key="'sel-f-' + f.id"
												type="button"
												class="chip-toggle-btn __fraction"
												:class="{ __selected: (selectedEntity.fractions || []).includes(f.id) }"
												@click="toggleRelationItem(selectedEntity.fractions, f.id)"
											>
												<span class="chip-check">{{ (selectedEntity.fractions || []).includes(f.id) ? '☑' : '☐' }}</span>
												<span class="chip-name">{{ f.name || f.id }}</span>
												<span class="chip-id">({{ f.id }})</span>
											</button>
										</div>
									</div>
								</div>
							</template>

							<!-- CLASSES: MIN LEVEL -->
							<template v-if="activeTab === 'classes'">
								<div class="field-row __split">
									<div class="form-field">
										<label class="field-label">Минимальный уровень (lvl_min)</label>
										<input
											v-model.number="selectedEntity.lvl_min"
											type="number"
											min="1"
											max="100"
											class="editor-input"
										/>
									</div>
								</div>
							</template>

							<!-- RACES: CATEGORY & MIN LEVEL -->
							<template v-if="activeTab === 'races'">
								<div class="field-row __split">
									<div class="form-field">
										<label class="field-label">Категория расы (Category)</label>
										<select v-model="selectedEntity.category" class="editor-select">
											<option value="humanoid">Гуманоидная (humanoid)</option>
											<option value="demi-human">Полулюди (demi-human)</option>
											<option value="heteromorphic">Гетероморфная (heteromorphic)</option>
										</select>
									</div>

									<div class="form-field">
										<label class="field-label">Минимальный уровень (lvl_min)</label>
										<input
											v-model.number="selectedEntity.lvl_min"
											type="number"
											min="1"
											max="100"
											class="editor-input"
										/>
									</div>
								</div>
							</template>

							<!-- FRACTIONS: PARENT ID -->
							<template v-if="activeTab === 'fractions'">
								<div class="field-row __split">
									<div class="form-field">
										<label class="field-label">
											Вышестоящая организация (Parent Faction)
										</label>
										<select v-model="selectedEntity.parent_id" class="editor-select">
											<option :value="null">— Нет (суверенная фракция) —</option>
											<option
												v-for="parentOpt in availableParentOptions"
												:key="parentOpt.id"
												:value="parentOpt.id"
											>
												{{ parentOpt.name }} ({{ parentOpt.id }})
											</option>
										</select>
									</div>
								</div>
							</template>

							<!-- ITEMS: SLOT, WEIGHT, STACKABLE -->
							<template v-if="activeTab === 'items'">
								<div class="field-row __split">
									<div class="form-field">
										<label class="field-label">Слот экипировки (Slot)</label>
										<select v-model="selectedEntity.slot" class="editor-select">
											<option value="">— Без слота (для расходников) —</option>
											<option value="head">Голова (head)</option>
											<option value="mask">Маска / Лицо (mask)</option>
											<option value="neck_1">Ожерелье / Шея (neck_1)</option>
											<option value="torso-1">Верхняя одежда / Рубашка (torso-1)</option>
											<option value="torso-2">Куртка / Броня (torso-2)</option>
											<option value="torso-3">Плащ / Накидка (torso-3)</option>
											<option value="legs-2">Штаны / Поножи (legs-2)</option>
											<option value="feet">Обувь / Сапоги (feet)</option>
											<option value="weapon-hand-1">Основное оружие (weapon-hand-1)</option>
											<option value="weapon-hand-2">Вторая рука / Щит (weapon-hand-2)</option>
											<option value="hands">Перчатки / Руки (hands)</option>
											<option value="underpants">Бельё (underpants)</option>
										</select>
									</div>

									<div class="form-field">
										<label class="field-label">Вес предмета в кг (Weight)</label>
										<input
											v-model.number="selectedEntity.weight"
											type="number"
											step="0.01"
											class="editor-input"
											placeholder="0.5"
										/>
									</div>

									<div class="form-field __checkbox">
										<label class="checkbox-label">
											<input v-model="selectedEntity.stackable" type="checkbox" />
											<span>Стакаемый в инвентаре (Stackable)</span>
										</label>
									</div>
								</div>
							</template>

							<!-- ========================================================= -->
							<!-- TAGS SECTION: ADVANCED OWN + INHERITED + COMBINED         -->
							<!-- ========================================================= -->
							<div class="tag-management-card">
								<!-- 1. OWN TAGS -->
								<div class="tag-sub-section">
									<div class="tag-section-header">
										<span class="tag-section-title">
											🏷️ {{ activeTab === 'characters' ? 'Собственные теги персонажа' : 'Теги сущности' }}
										</span>
										<span class="tag-section-hint">
											{{ activeTab === 'characters' ? '(сохраняются в characters_data.json)' : '(сохраняются в JSON)' }}
										</span>
									</div>

									<!-- Current Own Tags Chips -->
									<div class="current-tags-chips">
										<span
											v-for="t in (selectedEntity.tags || [])"
											:key="'own-tag-' + t"
											class="interactive-tag-chip __own"
										>
											<span class="chip-text">{{ t }}</span>
											<button
												type="button"
												class="chip-remove-btn"
												title="Удалить тег"
												@click="removeTagFromEntity(t)"
											>
												✕
											</button>
										</span>

										<span v-if="(selectedEntity.tags || []).length === 0" class="no-tags-hint">
											Собственные теги пока не добавлены
										</span>
									</div>

									<!-- Tag Input with Live Dropdown Autocomplete -->
									<div class="tag-autocomplete-wrapper">
										<div class="tag-input-row">
											<input
												ref="tagInputRef"
												v-model="newTagField"
												type="text"
												class="editor-input tag-text-input"
												placeholder="Введите тег для автодополнения..."
												autocomplete="off"
												@focus="isTagDropdownOpen = true"
												@blur="onTagInputBlur"
												@input="onTagInput"
												@keydown.down.prevent="onTagNavigateDown"
												@keydown.up.prevent="onTagNavigateUp"
												@keydown.enter.prevent="onTagEnter"
												@keydown.esc="isTagDropdownOpen = false"
											/>
											<button
												type="button"
												class="editor-btn editor-btn-secondary"
												:disabled="!newTagField.trim()"
												@click="onTagEnter"
											>
												➕ Добавить
											</button>
										</div>

										<!-- Dropdown selector with matching tag names -->
										<div
											v-if="isTagDropdownOpen && tagSuggestions.length > 0"
											class="tag-autocomplete-dropdown"
										>
											<div
												v-for="(sug, idx) in tagSuggestions"
												:key="sug.tag"
												class="autocomplete-item"
												:class="{ __highlighted: highlightedTagIndex === idx }"
												@mousedown.prevent="selectTagSuggestion(sug.tag)"
												@mouseenter="highlightedTagIndex = idx"
											>
												<div class="ac-item-left">
													<span class="ac-tag-icon">🏷️</span>
													<span class="ac-tag-name">
														<strong class="ac-match-highlight">{{ sug.matchPrefix }}</strong>{{ sug.matchSuffix }}
													</span>
												</div>
												<div class="ac-item-right">
													<span v-if="sug.isNew" class="ac-new-pill">
														новый тег
													</span>
													<span
														v-else-if="sug.usageCount > 0"
														class="ac-usage-pill"
														:title="`Используется в ${sug.usageCount} сущностях`"
													>
														{{ sug.usageCount }}
													</span>
												</div>
											</div>
										</div>
									</div>

									<!-- Global Tag Suggestions Pills -->
									<div class="tag-suggestions-box">
										<span class="suggestions-label">Быстрый выбор из tags.json:</span>
										<div class="suggestion-pills-list">
											<button
												v-for="gt in availableGlobalTagSuggestions"
												:key="'sug-' + gt"
												type="button"
												class="suggestion-pill"
												@click="addTagToEntity(gt)"
											>
												+ {{ gt }}
											</button>
										</div>
									</div>
								</div>

								<!-- 2. INHERITED TAGS (ONLY FOR CHARACTERS) -->
								<div v-if="activeTab === 'characters'" class="tag-sub-section __inherited">
									<div class="tag-section-header">
										<span class="tag-section-title">
											🧬 Унаследованные теги (из рас, классов и фракций)
										</span>
										<span class="tag-section-hint">
											(вычисляются динамически, НЕ сохраняются в персонажа)
										</span>
									</div>

									<div class="inherited-tags-grid">
										<span
											v-for="(item, idx) in getCharacterInheritedTags(selectedEntity)"
											:key="'inh-' + idx"
											class="interactive-tag-chip __inherited-chip"
											:class="`__${item.sourceType}`"
											:title="`Источник: ${item.sourceName} (${item.sourceType})`"
										>
											<span class="inh-source-icon">{{ item.sourceIcon }}</span>
											<span class="chip-text">{{ item.tag }}</span>
											<span class="inh-source-label">({{ item.sourceName }})</span>
										</span>

										<span
											v-if="getCharacterInheritedTags(selectedEntity).length === 0"
											class="no-tags-hint"
										>
											Связанные расы, классы и фракции не содержат тегов
										</span>
									</div>
								</div>

								<!-- 3. COMBINED / EFFECTIVE UNIQUE TAGS (ONLY FOR CHARACTERS) -->
								<div v-if="activeTab === 'characters'" class="tag-sub-section __combined">
									<div class="tag-section-header">
										<span class="tag-section-title">
											✨ Итоговый сводный список всех тегов ({{ getCharacterCombinedTags(selectedEntity).length }})
										</span>
										<span class="tag-section-hint">
											(единый пул без дубликатов для боевой системы и условий игры)
										</span>
									</div>

									<div class="combined-tags-chips">
										<span
											v-for="ct in getCharacterCombinedTags(selectedEntity)"
											:key="'comb-' + ct"
											class="interactive-tag-chip __combined-chip"
										>
											{{ ct }}
										</span>
									</div>
								</div>
							</div>

							<!-- DESCRIPTION (COMMON) -->
							<div class="form-field">
								<div class="field-label-row">
									<label class="field-label">
										Описание / Лор (Description)
										<span class="locale-pill-tag" :class="`__${activeLocale}`">
											{{ activeLocale.toUpperCase() }}
										</span>
									</label>
									<span
										v-if="activeLocale !== 'ru' && selectedEntity._locales?.ru?.description"
										class="field-ru-preview"
										:title="selectedEntity._locales.ru.description"
									>
										RU оригинал доступен для перевода
									</span>
								</div>
								<!-- Russian Reference Box when translating in English -->
								<div
									v-if="activeLocale !== 'ru' && selectedEntity._locales?.ru?.description"
									class="ru-reference-box"
								>
									<span class="ref-badge">🇷🇺 RU Оригинал:</span>
									<p class="ref-text">{{ selectedEntity._locales.ru.description }}</p>
								</div>
								<textarea
									v-model="currentLocaleDesc"
									class="editor-textarea"
									rows="4"
									:placeholder="activeLocale !== 'ru' ? 'Введите перевод на английском языке...' : 'Подробное текстовое описание сущности для игры и журнала...'"
								></textarea>
							</div>

							<!-- CUSTOM / UNMAPPED JSON FIELDS PRESERVATION SECTION -->
							<div
								v-if="currentCustomFields.length > 0"
								class="custom-fields-badge-box"
							>
								<div class="custom-fields-header">
									<span class="custom-fields-title">
										📦 Пользовательские поля из JSON ({{ currentCustomFields.length }})
									</span>
									<span class="custom-fields-badge-tag">
										✔ Сохраняются без изменений
									</span>
								</div>
								<p class="custom-fields-desc">
									Эти поля заданы напрямую в файле JSON (например, <code>points-per-lvl</code>, <code>baffes</code>, <code>stats</code>). При сохранении через интерфейс они автоматически сохраняются в исходном виде.
								</p>
								<div class="custom-fields-list">
									<div
										v-for="cf in currentCustomFields"
										:key="cf.key"
										class="custom-field-pill"
									>
										<span class="cf-key">{{ cf.key }}:</span>
										<span class="cf-val">{{ formatCustomFieldValue(cf.value) }}</span>
									</div>
								</div>
							</div>
						</div>

						<!-- Bottom Action Bar -->
						<div class="form-footer">
							<div class="footer-left">
								<span class="file-save-target">
									Запись будет сохранена в: <code>{{ currentFilePath }}</code>
								</span>
							</div>
							<div class="footer-right">
								<button class="editor-btn editor-btn-secondary" @click="cancelEdit">
									Отмена
								</button>
								<button
									class="editor-btn editor-btn-primary save-btn"
									:disabled="isSaving"
									@click="handleSave"
								>
									<span class="btn-icon">💾</span>
									<span>{{ isSaving ? 'Сохранение...' : 'Сохранить в JSON' }}</span>
								</button>
							</div>
						</div>
					</div>

					<!-- Empty State when no entity selected -->
					<div v-else class="form-empty-state">
						<div class="empty-state-content">
							<div class="empty-state-icon">📝</div>
							<h3 class="empty-state-title">Выберите запись для редактирования</h3>
							<p class="empty-state-desc">
								Выберите сущность из списка слева для просмотра и редактирования данных, либо создайте новую.
							</p>
							<button class="editor-btn editor-btn-primary" @click="onStartCreate">
								<span>➕ Создать {{ currentTypeLabel.toLowerCase() }}</span>
							</button>
						</div>
					</div>
				</main>
			</template>
		</div>

		<!-- Delete Entity Confirmation Modal -->
		<Transition name="fade">
			<div v-if="entityToDelete" class="modal-overlay" @click.self="entityToDelete = null">
				<div class="delete-modal-card">
					<div class="modal-header">
						<span class="modal-icon">⚠️</span>
						<h3 class="modal-title">Подтверждение удаления</h3>
					</div>
					<div class="modal-body">
						<p>
							Вы действительно хотите удалить сущность
							<strong>«{{ entityToDelete.name || entityToDelete.id }}»</strong>
							(ID: <code>{{ entityToDelete.id }}</code>)?
						</p>
						<p class="modal-warning-sub">
							Изменения будут немедленно записаны в JSON-файл на диске.
						</p>
					</div>
					<div class="modal-footer">
						<button class="editor-btn editor-btn-secondary" @click="entityToDelete = null">
							Отмена
						</button>
						<button class="editor-btn editor-btn-danger" @click="confirmDelete">
							🗑️ Да, удалить
						</button>
					</div>
				</div>
			</div>
		</Transition>

		<!-- Delete Tag Confirmation Modal -->
		<Transition name="fade">
			<div v-if="tagToDelete" class="modal-overlay" @click.self="tagToDelete = null">
				<div class="delete-modal-card">
					<div class="modal-header">
						<span class="modal-icon">⚠️</span>
						<h3 class="modal-title">Удаление тега из реестра</h3>
					</div>
					<div class="modal-body">
						<p>
							Удалить тег <strong>«{{ tagToDelete }}»</strong> из <code>tags.json</code>?
						</p>
						<p class="modal-warning-sub">
							Тег перестанет предлагаться в подсказках быстрого выбора.
						</p>
					</div>
					<div class="modal-footer">
						<button class="editor-btn editor-btn-secondary" @click="tagToDelete = null">
							Отмена
						</button>
						<button class="editor-btn editor-btn-danger" @click="confirmDeleteTag">
							🗑️ Удалить тег
						</button>
					</div>
				</div>
			</div>
		</Transition>

		<!-- Add Language Modal -->
		<Transition name="fade">
			<div v-if="isAddLocaleModalOpen" class="modal-overlay" @click.self="isAddLocaleModalOpen = false">
				<div class="add-locale-modal-card">
					<div class="modal-header">
						<span class="modal-icon">🌐</span>
						<h3 class="modal-title">Добавить язык локализации</h3>
						<button type="button" class="modal-close-icon-btn" @click="isAddLocaleModalOpen = false">✕</button>
					</div>
					<div class="modal-body">
						<p class="modal-desc">
							Выберите язык из готовых шаблонов или введите свой код языка (ISO 639-1):
						</p>

						<!-- Quick Presets Grid -->
						<div class="preset-locales-grid">
							<button
								v-for="preset in PRESET_LOCALES"
								:key="preset.code"
								type="button"
								class="preset-locale-card"
								:class="{ __already: isLocaleAdded(preset.code) }"
								:disabled="isLocaleAdded(preset.code)"
								@click="selectPresetLocale(preset)"
							>
								<span class="preset-flag">{{ preset.flag }}</span>
								<div class="preset-info">
									<span class="preset-name">{{ preset.label }}</span>
									<span class="preset-code">{{ preset.code.toUpperCase() }}</span>
								</div>
								<span v-if="isLocaleAdded(preset.code)" class="preset-added-badge">Добавлен</span>
							</button>
						</div>

						<!-- Custom Language Input Box -->
						<div class="custom-locale-box">
							<div class="custom-locale-title">Или ввести пользовательский язык:</div>
							<div class="field-row __split">
								<div class="form-field">
									<label class="field-label">Код (2-5 латинских букв) <span class="req-star">*</span></label>
									<input
										v-model="newLocaleCode"
										type="text"
										class="editor-input"
										placeholder="например: ja, zh, ko, de"
										maxlength="5"
									/>
								</div>
								<div class="form-field">
									<label class="field-label">Название языка</label>
									<input
										v-model="newLocaleLabel"
										type="text"
										class="editor-input"
										placeholder="например: 日本語, Deutsch"
									/>
								</div>
								<div class="form-field __narrow">
									<label class="field-label">Флаг</label>
									<input
										v-model="newLocaleFlag"
										type="text"
										class="editor-input"
										placeholder="🇯🇵"
										maxlength="4"
									/>
								</div>
							</div>
						</div>
					</div>
					<div class="modal-footer">
						<button class="editor-btn editor-btn-secondary" @click="isAddLocaleModalOpen = false">
							Отмена
						</button>
						<button
							class="editor-btn editor-btn-primary"
							:disabled="!newLocaleCode.trim()"
							@click="confirmAddCustomLocale"
						>
							➕ Добавить язык
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useDataEditor } from '@/composables/useDataEditor'

const router = useRouter()
const {
	activeTab,
	entities,
	globalTags,
	activeLocale,
	availableLocales,
	localesData,
	selectedEntity,
	isCreating,
	searchQuery,
	statusMessage,
	filteredList,
	counts,
	init,
	startCreate,
	startEdit,
	cancelEdit,
	saveEntity,
	deleteEntity,
	addGlobalTag,
	deleteGlobalTag,
	getCharacterInheritedTags,
	getCharacterCombinedTags,
	getTagUsageCount,
	getCustomFields,
	getRaceName,
	getClassName,
	getFactionName,
	getCharacterName,
	getEntityText,
	hasLocaleTranslation,
	switchLocale,
	addLocale,
	getTypeLabel,
	getFilePathForType,
	isHierarchicalType,
	isChildItem,
	getItemDepth,
	getParentEntity,
	canMoveItemUp,
	canMoveItemDown,
	moveItemUp,
	moveItemDown,
	moveTagUp,
	moveTagDown,
	reorderItems,
	setStatus
} = useDataEditor()

const isSaving = ref(false)
const entityToDelete = ref(null)
const tagToDelete = ref(null)
const selectedTagForInspector = ref(null)
const newTagInput = ref('')
const newTagField = ref('')
const isTagDropdownOpen = ref(false)
const highlightedTagIndex = ref(0)
const tagInputRef = ref(null)

// Header Dropdown & Add Language Modal State
const isHeaderLocaleOpen = ref(false)
const headerLocaleDropdownRef = ref(null)
const isAddLocaleModalOpen = ref(false)
const newLocaleCode = ref('')
const newLocaleLabel = ref('')
const newLocaleFlag = ref('🌐')

const PRESET_LOCALES = [
	{ code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
	{ code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
	{ code: 'de', label: 'Deutsch (German)', flag: '🇩🇪' },
	{ code: 'es', label: 'Español (Spanish)', flag: '🇪🇸' },
	{ code: 'fr', label: 'Français (French)', flag: '🇫🇷' },
	{ code: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
	{ code: 'it', label: 'Italiano (Italian)', flag: '🇮🇹' },
	{ code: 'pt', label: 'Português (Portuguese)', flag: '🇵🇹' },
	{ code: 'pl', label: 'Polski (Polish)', flag: '🇵🇱' },
	{ code: 'uk', label: 'Українська (Ukrainian)', flag: '🇺🇦' },
	{ code: 'tr', label: 'Türkçe (Turkish)', flag: '🇹🇷' }
]

const currentLocaleObj = computed(() => {
	const list = availableLocales.value || []
	const found = list.find((l) => l.code === activeLocale.value)
	return found || { code: activeLocale.value, label: activeLocale.value.toUpperCase(), flag: '🌐' }
})

function selectHeaderLocale(code) {
	switchLocale(code)
	isHeaderLocaleOpen.value = false
}

function openAddLocaleModal() {
	isHeaderLocaleOpen.value = false
	newLocaleCode.value = ''
	newLocaleLabel.value = ''
	newLocaleFlag.value = '🌐'
	isAddLocaleModalOpen.value = true
}

function isLocaleAdded(code) {
	return (availableLocales.value || []).some((l) => l.code === code)
}

function selectPresetLocale(preset) {
	try {
		addLocale(preset)
		if (selectedEntity.value) {
			if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
			if (!selectedEntity.value._locales[preset.code]) {
				selectedEntity.value._locales[preset.code] = { name: '', description: '', names: [] }
			}
		}
		isAddLocaleModalOpen.value = false
	} catch (err) {
		setStatus(err.message, 'error')
	}
}

function confirmAddCustomLocale() {
	if (!newLocaleCode.value.trim()) return
	try {
		const added = addLocale({
			code: newLocaleCode.value.trim().toLowerCase(),
			label: newLocaleLabel.value.trim() || newLocaleCode.value.trim().toUpperCase(),
			flag: newLocaleFlag.value.trim() || '🌐'
		})
		if (selectedEntity.value) {
			if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
			if (!selectedEntity.value._locales[added.code]) {
				selectedEntity.value._locales[added.code] = { name: '', description: '', names: [] }
			}
		}
		isAddLocaleModalOpen.value = false
	} catch (err) {
		setStatus(err.message, 'error')
	}
}

function onWindowClick(e) {
	if (
		isHeaderLocaleOpen.value &&
		headerLocaleDropdownRef.value &&
		!headerLocaleDropdownRef.value.contains(e.target)
	) {
		isHeaderLocaleOpen.value = false
	}
}

// Localized input field proxies
const currentLocaleName = computed({
	get() {
		if (!selectedEntity.value) return ''
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		return selectedEntity.value._locales[activeLocale.value].name || ''
	},
	set(val) {
		if (!selectedEntity.value) return
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		selectedEntity.value._locales[activeLocale.value].name = val
		if (activeLocale.value === 'ru') {
			selectedEntity.value.name = val
		}
	}
})

const currentLocaleDesc = computed({
	get() {
		if (!selectedEntity.value) return ''
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		return selectedEntity.value._locales[activeLocale.value].description || ''
	},
	set(val) {
		if (!selectedEntity.value) return
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		selectedEntity.value._locales[activeLocale.value].description = val
		if (activeLocale.value === 'ru') {
			selectedEntity.value.description = val
		}
	}
})

const currentLocaleNames = computed({
	get() {
		if (!selectedEntity.value) return []
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		return selectedEntity.value._locales[activeLocale.value].names || []
	},
	set(val) {
		if (!selectedEntity.value) return
		if (!selectedEntity.value._locales) selectedEntity.value._locales = {}
		if (!selectedEntity.value._locales[activeLocale.value]) {
			selectedEntity.value._locales[activeLocale.value] = { name: '', description: '', names: [] }
		}
		selectedEntity.value._locales[activeLocale.value].names = val
		if (activeLocale.value === 'ru') {
			selectedEntity.value.names = val
		}
	}
})

// Drag & Drop for entity cards
const draggedIndex = ref(null)
const dragOverIndex = ref(null)

function onCardDragStart(e, index) {
	if (searchQuery.value) return
	draggedIndex.value = index
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = 'move'
	}
}

function onCardDragOver(e, index) {
	if (searchQuery.value) return
	dragOverIndex.value = index
}

function onCardDragLeave(e, index) {
	if (dragOverIndex.value === index) {
		dragOverIndex.value = null
	}
}

async function onCardDrop(e, targetIndex) {
	if (searchQuery.value) return
	const fromIdx = draggedIndex.value
	draggedIndex.value = null
	dragOverIndex.value = null
	if (fromIdx !== null && fromIdx !== targetIndex) {
		await reorderItems(activeTab.value, fromIdx, targetIndex)
	}
}

function onCardDragEnd() {
	draggedIndex.value = null
	dragOverIndex.value = null
}

// Drag & Drop for tags
const draggedTagIndex = ref(null)
const dragOverTagIndex = ref(null)

function onTagDragStart(e, index) {
	if (searchQuery.value) return
	draggedTagIndex.value = index
	if (e.dataTransfer) {
		e.dataTransfer.effectAllowed = 'move'
	}
}

function onTagDragOver(e, index) {
	if (searchQuery.value) return
	dragOverTagIndex.value = index
}

function onTagDragLeave(e, index) {
	if (dragOverTagIndex.value === index) {
		dragOverTagIndex.value = null
	}
}

async function onTagDrop(e, targetIndex) {
	if (searchQuery.value) return
	const fromIdx = draggedTagIndex.value
	draggedTagIndex.value = null
	dragOverTagIndex.value = null
	if (fromIdx !== null && fromIdx !== targetIndex) {
		await reorderItems('tags', fromIdx, targetIndex)
	}
}

function onTagDragEnd() {
	draggedTagIndex.value = null
	dragOverTagIndex.value = null
}

async function handleMoveItemUp(item, index) {
	await moveItemUp(activeTab.value, item)
}

async function handleMoveItemDown(item, index) {
	await moveItemDown(activeTab.value, item)
}

async function handleMoveTagUp(index) {
	await moveTagUp(index)
}

async function handleMoveTagDown(index) {
	await moveTagDown(index)
}

function getChildCardStyle(item) {
	if (!isChildItem(item, activeTab.value)) return {}
	const depth = getItemDepth(item, activeTab.value)
	return {
		'--child-depth': depth
	}
}

function getParentLabel(parentId) {
	if (!parentId) return ''
	switch (activeTab.value) {
		case 'classes':
			return getClassName(parentId)
		case 'races':
			return getRaceName(parentId)
		case 'fractions':
			return getFactionName(parentId)
		default:
			return parentId
	}
}

function getChildBadgeLabel(item) {
	const pLabel = getParentLabel(item.parent_id)
	switch (activeTab.value) {
		case 'classes':
			return `Дочерний класс от: ${pLabel}`
		case 'races':
			return `Подраса от: ${pLabel}`
		case 'fractions':
			return `Подразделение: ${pLabel}`
		default:
			return `Дочерний от: ${pLabel}`
	}
}

const tagSuggestions = computed(() => {
	const q = newTagField.value.trim().toLowerCase()
	const currentOwn = Array.isArray(selectedEntity.value?.tags) ? selectedEntity.value.tags : []

	// Base matches from globalTags not already attached to this entity
	const matches = globalTags.value
		.filter((gt) => !currentOwn.includes(gt))
		.filter((gt) => !q || gt.includes(q))
		.sort((a, b) => {
			if (q) {
				const aStarts = a.startsWith(q)
				const bStarts = b.startsWith(q)
				if (aStarts && !bStarts) return -1
				if (!aStarts && bStarts) return 1
			}
			return a.localeCompare(b)
		})
		.slice(0, 10)
		.map((gt) => {
			let matchPrefix = gt
			let matchSuffix = ''
			if (q && gt.startsWith(q)) {
				matchPrefix = gt.slice(0, q.length)
				matchSuffix = gt.slice(q.length)
			}
			return {
				tag: gt,
				matchPrefix,
				matchSuffix,
				usageCount: getTagUsageCount(gt),
				isNew: false
			}
		})

	// If query is typed and not already in matches or globalTags, add option to create it
	if (q && !globalTags.value.includes(q) && !currentOwn.includes(q)) {
		matches.unshift({
			tag: q,
			matchPrefix: q,
			matchSuffix: '',
			usageCount: 0,
			isNew: true
		})
	}

	return matches
})

function onTagInput() {
	isTagDropdownOpen.value = true
	highlightedTagIndex.value = 0
}

function onTagNavigateDown() {
	if (!isTagDropdownOpen.value) {
		isTagDropdownOpen.value = true
		return
	}
	if (highlightedTagIndex.value < tagSuggestions.value.length - 1) {
		highlightedTagIndex.value++
	}
}

function onTagNavigateUp() {
	if (highlightedTagIndex.value > 0) {
		highlightedTagIndex.value--
	}
}

function onTagEnter() {
	if (
		isTagDropdownOpen.value &&
		tagSuggestions.value.length > 0 &&
		tagSuggestions.value[highlightedTagIndex.value]
	) {
		selectTagSuggestion(tagSuggestions.value[highlightedTagIndex.value].tag)
	} else if (newTagField.value.trim()) {
		addTagToEntity(newTagField.value)
		newTagField.value = ''
		isTagDropdownOpen.value = false
	}
}

function selectTagSuggestion(tag) {
	addTagToEntity(tag)
	newTagField.value = ''
	highlightedTagIndex.value = 0
	isTagDropdownOpen.value = false
	tagInputRef.value?.focus()
}

function onTagInputBlur() {
	setTimeout(() => {
		isTagDropdownOpen.value = false
	}, 200)
}

const currentCustomFields = computed(() => {
	if (!selectedEntity.value) return []
	return getCustomFields(selectedEntity.value, activeTab.value)
})

function formatCustomFieldValue(val) {
	if (typeof val === 'object' && val !== null) {
		return JSON.stringify(val)
	}
	return String(val)
}

const tabConfigs = [
	{ id: 'characters', name: 'Персонажи', icon: '👤' },
	{ id: 'classes', name: 'Классы', icon: '⚔️' },
	{ id: 'fractions', name: 'Фракции', icon: '🏛️' },
	{ id: 'races', name: 'Расы', icon: '🧬' },
	{ id: 'items', name: 'Предметы', icon: '🎒' },
	{ id: 'tags', name: 'Теги', icon: '🏷️' }
]

const currentTypeLabel = computed(() => getTypeLabel(activeTab.value))
const currentFilePath = computed(() => getFilePathForType(activeTab.value))

const defaultIconForTab = computed(() => {
	switch (activeTab.value) {
		case 'characters': return '👤'
		case 'classes': return '⚔️'
		case 'fractions': return '🏛️'
		case 'races': return '🧬'
		case 'items': return '🎒'
		case 'tags': return '🏷️'
		default: return '📄'
	}
})

// Options for parent selector (exclude self when editing)
const availableParentOptions = computed(() => {
	const list = entities.value[activeTab.value] || []
	const selfId = selectedEntity.value?.id
	return list.filter((item) => item.id !== selfId)
})

// Suggest tags from global registry not currently assigned to selectedEntity
const availableGlobalTagSuggestions = computed(() => {
	if (!selectedEntity.value) return []
	const currentOwn = Array.isArray(selectedEntity.value.tags) ? selectedEntity.value.tags : []
	return globalTags.value.filter((gt) => !currentOwn.includes(gt)).slice(0, 14)
})

onMounted(async () => {
	window.addEventListener('click', onWindowClick)
	await init()
})

onUnmounted(() => {
	window.removeEventListener('click', onWindowClick)
})

function switchTab(tabId) {
	activeTab.value = tabId
	cancelEdit()
	searchQuery.value = ''
	selectedTagForInspector.value = null
}

function onStartCreate() {
	startCreate()
}

function onSelectEntity(item) {
	startEdit(item)
}

function returnToHome() {
	router.push('/home')
}

// Helpers for multi-select chips
function toggleRelationItem(arr, id) {
	if (!Array.isArray(arr)) return
	const idx = arr.indexOf(id)
	if (idx >= 0) {
		arr.splice(idx, 1)
	} else {
		arr.push(id)
	}
}

// Comma string conversion helpers
function arrayToCommaStr(arr) {
	if (!Array.isArray(arr)) return ''
	return arr.join(', ')
}

function commaStrToArray(str) {
	if (typeof str !== 'string') return []
	return str
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
}

function isEmoji(str) {
	if (!str) return true
	return str.length <= 4 && !str.includes('/') && !str.includes('.')
}

function resolveIconPath(iconPath) {
	if (!iconPath) return ''
	if (iconPath.startsWith('http') || iconPath.startsWith('data:')) return iconPath
	const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
	return base + iconPath.replace(/^\//, '')
}

// Entity Tag Management in Form
function addTagToEntity(tagText) {
	const cleaned = String(tagText || '').trim().toLowerCase()
	if (!cleaned || !selectedEntity.value) return

	if (!Array.isArray(selectedEntity.value.tags)) {
		selectedEntity.value.tags = []
	}

	if (!selectedEntity.value.tags.includes(cleaned)) {
		selectedEntity.value.tags.push(cleaned)
	}

	// Also add to global tags if not present
	if (!globalTags.value.includes(cleaned)) {
		addGlobalTag(cleaned).catch(() => {})
	}

	newTagField.value = ''
}

function removeTagFromEntity(tagText) {
	if (!selectedEntity.value || !Array.isArray(selectedEntity.value.tags)) return
	const idx = selectedEntity.value.tags.indexOf(tagText)
	if (idx >= 0) {
		selectedEntity.value.tags.splice(idx, 1)
	}
}

// Global Tag Creation in Tags Tab
async function handleCreateTag() {
	if (!newTagInput.value.trim()) return
	try {
		await addGlobalTag(newTagInput.value)
		newTagInput.value = ''
	} catch (err) {
		setStatus(err.message, 'error')
	}
}

function promptDeleteTag(tag) {
	tagToDelete.value = tag
}

async function confirmDeleteTag() {
	if (!tagToDelete.value) return
	try {
		await deleteGlobalTag(tagToDelete.value)
		if (selectedTagForInspector.value === tagToDelete.value) {
			selectedTagForInspector.value = null
		}
		tagToDelete.value = null
	} catch (err) {
		setStatus(err.message, 'error')
	}
}

// Inspector helper: find entities containing tag
function getEntitiesWithTag(tag) {
	if (!tag) return []
	const results = []
	const defs = [
		{ type: 'characters', label: 'Персонаж', list: entities.value.characters },
		{ type: 'classes', label: 'Класс', list: entities.value.classes },
		{ type: 'fractions', label: 'Фракция', list: entities.value.fractions },
		{ type: 'races', label: 'Раса', list: entities.value.races },
		{ type: 'items', label: 'Предмет', list: entities.value.items }
	]
	for (const def of defs) {
		for (const item of def.list) {
			if (Array.isArray(item.tags) && item.tags.includes(tag)) {
				results.push({
					type: def.type,
					typeLabel: def.label,
					id: item.id,
					name: item.name || item.id
				})
			}
		}
	}
	return results
}

async function handleSave() {
	if (!selectedEntity.value) return
	isSaving.value = true
	try {
		await saveEntity(activeTab.value, selectedEntity.value)
	} catch (err) {
		console.error('Ошибка сохранения сущности:', err)
		setStatus(`Ошибка сохранения: ${err.message}`, 'error')
	} finally {
		isSaving.value = false
	}
}

function promptDelete(item) {
	entityToDelete.value = item
}

async function confirmDelete() {
	if (!entityToDelete.value) return
	try {
		await deleteEntity(activeTab.value, entityToDelete.value.id)
		entityToDelete.value = null
	} catch (err) {
		console.error('Ошибка удаления сущности:', err)
		setStatus(`Ошибка удаления: ${err.message}`, 'error')
	}
}
</script>

<style scoped>
.data-editor-view {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: radial-gradient(ellipse at center, #182236 0%, #0c111c 100%);
	color: #f1f5f9;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	overflow: hidden;
	user-select: none;
}

/* Header Toolbar */
.editor-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6em 1.2em;
	background: rgba(15, 23, 42, 0.92);
	border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	backdrop-filter: blur(0.4em);
	gap: 1em;
	z-index: 10;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.editor-btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.4em;
	padding: 0.5em 0.9em;
	border-radius: 0.4em;
	font-size: 0.9em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
	border: 1px solid transparent;
}

.editor-btn-back {
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	border: 1px solid rgba(255, 255, 255, 0.15);
}

.editor-btn-back:hover {
	background: rgba(255, 255, 255, 0.16);
	color: #ffffff;
}

.editor-btn-primary {
	background: #f6c445;
	color: #0f172a;
	border: 1px solid #d9a830;
	font-weight: bold;
}

.editor-btn-primary:hover:not(:disabled) {
	background: #ffd369;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.4);
}

.editor-btn-primary:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.editor-btn-secondary {
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	border: 1px solid rgba(255, 255, 255, 0.15);
}

.editor-btn-secondary:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ffffff;
}

.editor-btn-danger {
	background: #ef4444;
	color: #ffffff;
	border: 1px solid #dc2626;
	font-weight: bold;
}

.editor-btn-danger:hover {
	background: #f87171;
	box-shadow: 0 0 0.8em rgba(239, 68, 68, 0.4);
}

.header-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.header-icon {
	font-size: 1.3em;
}

.header-title {
	font-size: 1.1em;
	font-weight: bold;
	color: #f6c445;
	font-family: Overlord, Kurale, serif;
	letter-spacing: 0.04em;
}

/* Entity Tabs */
.header-tabs {
	display: flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(0, 0, 0, 0.35);
	padding: 0.25em;
	border-radius: 0.5em;
	border: 1px solid rgba(255, 255, 255, 0.08);
}

.type-tab-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.4em 0.8em;
	background: transparent;
	border: 1px solid transparent;
	border-radius: 0.35em;
	color: #94a3b8;
	font-size: 0.9em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.type-tab-btn:hover {
	color: #ffffff;
	background: rgba(255, 255, 255, 0.06);
}

.type-tab-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.4);
	font-weight: bold;
}

.tab-count {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.12);
	padding: 0.1em 0.45em;
	border-radius: 0.3em;
	color: #cbd5e1;
}

.type-tab-btn.__active .tab-count {
	background: #f6c445;
	color: #0f172a;
}

.file-path-badge {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.35em 0.7em;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.35em;
	font-size: 0.8em;
	color: #94a3b8;
	max-width: 22em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.path-text {
	font-family: monospace;
	color: #a5b4fc;
}

/* Status Alert Banner */
.status-banner {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding: 0.6em 1.2em;
	font-size: 0.9em;
	font-weight: bold;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	animation: slideDown 0.2s ease-out;
}

.status-banner.__success {
	background: rgba(16, 185, 129, 0.25);
	color: #34d399;
	border-color: #10b981;
}

.status-banner.__error {
	background: rgba(239, 68, 68, 0.25);
	color: #f87171;
	border-color: #ef4444;
}

.status-banner.__info {
	background: rgba(59, 130, 246, 0.25);
	color: #60a5fa;
	border-color: #3b82f6;
}

/* Workspace Split Layout */
.editor-workspace {
	flex: 1;
	display: flex;
	overflow: hidden;
}

/* Left Column: List */
.sidebar-list-pane {
	width: 26em;
	background: rgba(15, 23, 42, 0.7);
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.list-toolbar {
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.search-box {
	display: flex;
	align-items: center;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.4em 0.7em;
	gap: 0.5em;
}

.search-icon {
	font-size: 0.9em;
	opacity: 0.6;
}

.search-input {
	flex: 1;
	background: transparent;
	border: none;
	color: #ffffff;
	font-size: 0.9em;
	font-family: Kurale, sans-serif;
	outline: none;
}

.search-clear-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.85em;
}

.search-clear-btn:hover {
	color: #ffffff;
}

.add-entity-btn {
	width: 100%;
}

.search-filter-active-notice {
	background: rgba(245, 158, 11, 0.12);
	border: 1px solid rgba(245, 158, 11, 0.28);
	border-radius: 0.35em;
	padding: 0.4em 0.7em;
	font-size: 0.75em;
	color: #fcd34d;
	line-height: 1.3;
}

.cards-scroll-area {
	flex: 1;
	overflow-y: auto;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.empty-list-notice {
	padding: 2em 1em;
	text-align: center;
	color: #64748b;
	font-size: 0.9em;
}

/* Drag and drop feedback */
.entity-card.__is-dragging,
.tag-list-item.__is-dragging {
	opacity: 0.45;
	border-style: dashed;
}

.entity-card.__drag-over,
.tag-list-item.__drag-over {
	border-top: 2px solid #f6c445 !important;
}

/* Entity Card */
.entity-card {
	display: flex;
	align-items: center;
	background: rgba(26, 35, 54, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 0.7em 0.8em;
	gap: 0.6em;
	cursor: pointer;
	transition: background-color 0.2s, border-color 0.2s, transform 0.2s;
	position: relative;
}

.entity-card:hover {
	background: rgba(30, 41, 59, 0.9);
	border-color: rgba(246, 196, 69, 0.3);
}

.entity-card.__active {
	background: rgba(246, 196, 69, 0.15);
	border-color: #f6c445;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.15);
}

/* Child Card Hierarchical Tree Placement & Indicators */
.entity-card.__child-card {
	margin-left: calc(var(--child-depth, 1) * 1.8em);
	background: rgba(18, 26, 43, 0.65);
	border-left: 0.2em solid rgba(56, 189, 248, 0.75);
}

.entity-card.__child-card:has(.child-indicator-pill.__classes) {
	border-left-color: rgba(239, 68, 68, 0.85);
}

.entity-card.__child-card:has(.child-indicator-pill.__races) {
	border-left-color: rgba(59, 130, 246, 0.85);
}

.entity-card.__child-card:has(.child-indicator-pill.__fractions) {
	border-left-color: rgba(16, 185, 129, 0.85);
}

.child-tree-connector {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #38bdf8;
	font-size: 1.15em;
	font-weight: bold;
	line-height: 1;
	flex-shrink: 0;
	opacity: 0.9;
}

.card-title-wrap {
	display: flex;
	align-items: center;
	gap: 0.45em;
	flex-wrap: wrap;
	min-width: 0;
}

.child-indicator-pill {
	font-size: 0.7em;
	padding: 0.1em 0.45em;
	border-radius: 0.25em;
	background: rgba(56, 189, 248, 0.15);
	border: 1px solid rgba(56, 189, 248, 0.35);
	color: #7dd3fc;
	font-family: Kurale, sans-serif;
	white-space: nowrap;
}

.child-indicator-pill.__classes {
	background: rgba(239, 68, 68, 0.15);
	border-color: rgba(239, 68, 68, 0.35);
	color: #fca5a5;
}

.child-indicator-pill.__races {
	background: rgba(59, 130, 246, 0.15);
	border-color: rgba(59, 130, 246, 0.35);
	color: #93c5fd;
}

.child-indicator-pill.__fractions {
	background: rgba(16, 185, 129, 0.15);
	border-color: rgba(16, 185, 129, 0.35);
	color: #6ee7b7;
}

/* Reordering Controls & Index Badge */
.card-order-controls,
.tag-order-controls {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.15em;
	margin-right: 0.2em;
	flex-shrink: 0;
}

.card-index-badge {
	font-size: 0.7em;
	font-family: monospace;
	color: #64748b;
	line-height: 1;
}

.card-order-arrows {
	display: flex;
	flex-direction: column;
	gap: 0.1em;
}

.order-arrow-btn {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.2em;
	color: #94a3b8;
	font-size: 0.6em;
	padding: 0.15em 0.35em;
	cursor: pointer;
	line-height: 1;
	transition: background-color 0.15s, color 0.15s, border-color 0.15s;
}

.order-arrow-btn:hover:not(:disabled) {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.5);
}

.order-arrow-btn:disabled {
	opacity: 0.2;
	cursor: not-allowed;
}

.card-icon-col {
	width: 2.4em;
	height: 2.4em;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.35);
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.08);
	overflow: hidden;
	flex-shrink: 0;
}

.card-emoji-icon {
	font-size: 1.3em;
}

.card-img-icon {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.card-content-col {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.card-header-row {
	display: flex;
	align-items: baseline;
	gap: 0.5em;
	overflow: hidden;
}

.card-name {
	font-size: 0.95em;
	font-weight: bold;
	color: #ffffff;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.entity-card.__active .card-name {
	color: #f6c445;
}

.card-id-badge {
	font-size: 0.75em;
	font-family: monospace;
	background: rgba(0, 0, 0, 0.3);
	color: #94a3b8;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	flex-shrink: 0;
}

.card-badges-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25em;
}

.rel-badge {
	font-size: 0.7em;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	border: 1px solid rgba(255, 255, 255, 0.08);
	white-space: nowrap;
}

.rel-badge.__race {
	background: rgba(59, 130, 246, 0.2);
	color: #93c5fd;
	border-color: rgba(59, 130, 246, 0.3);
}

.rel-badge.__class {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	border-color: rgba(239, 68, 68, 0.3);
}

.rel-badge.__fraction {
	background: rgba(16, 185, 129, 0.2);
	color: #6ee7b7;
	border-color: rgba(16, 185, 129, 0.3);
}

.rel-badge.__parent {
	background: rgba(245, 158, 11, 0.2);
	color: #fcd34d;
	border-color: rgba(245, 158, 11, 0.3);
}

.rel-badge.__tags-count {
	background: rgba(246, 196, 69, 0.15);
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.3);
}

.rel-badge.__equip {
	background: rgba(168, 85, 247, 0.2);
	color: #d8b4fe;
}

.rel-badge.__other {
	background: rgba(100, 116, 139, 0.2);
	color: #cbd5e1;
}

.rel-badge.__slot {
	background: rgba(0, 0, 0, 0.3);
	color: #cbd5e1;
}

.rel-badge.__cat {
	background: rgba(20, 184, 166, 0.2);
	color: #5eead4;
}

.card-actions-col {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.card-action-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	padding: 0.25em 0.4em;
	font-size: 0.8em;
	cursor: pointer;
	transition: background-color 0.2s, transform 0.2s;
}

.card-action-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	transform: scale(1.1);
}

.card-action-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.4);
	border-color: #ef4444;
}

/* Right Column: Form Pane */
.form-pane {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	background: rgba(18, 24, 38, 0.5);
}

.form-container {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.form-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.5em;
	background: rgba(15, 23, 42, 0.6);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.form-title-group {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.form-status-tag {
	font-size: 0.75em;
	font-weight: bold;
	padding: 0.25em 0.6em;
	border-radius: 0.3em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.form-status-tag.__new {
	background: rgba(16, 185, 129, 0.25);
	color: #34d399;
	border: 1px solid #10b981;
}

.form-status-tag.__edit {
	background: rgba(246, 196, 69, 0.25);
	color: #f6c445;
	border: 1px solid #f6c445;
}

.form-title {
	margin: 0;
	font-size: 1.3em;
	color: #ffffff;
	font-family: Overlord, Kurale, serif;
}

.form-header-actions {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.form-fields-scroll {
	flex: 1;
	overflow-y: auto;
	padding: 1.5em;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
}

.field-row {
	display: flex;
	gap: 1.2em;
}

.field-row.__split > .form-field {
	flex: 1;
}

.form-field {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.field-label {
	font-size: 0.9em;
	color: #cbd5e1;
	font-weight: bold;
}

.req-star {
	color: #ef4444;
}

.field-hint {
	font-size: 0.8em;
	font-weight: normal;
	color: #94a3b8;
	margin-left: 0.4em;
}

.editor-input,
.editor-select,
.editor-textarea {
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.55em 0.8em;
	color: #ffffff;
	font-size: 0.95em;
	font-family: Kurale, sans-serif;
	transition: border-color 0.2s, box-shadow 0.2s;
	outline: none;
}

.editor-input:focus,
.editor-select:focus,
.editor-textarea:focus {
	border-color: #f6c445;
	box-shadow: 0 0 0.5em rgba(246, 196, 69, 0.3);
}

.editor-input:disabled {
	opacity: 0.6;
	cursor: not-allowed;
	background: rgba(0, 0, 0, 0.3);
}

.editor-textarea {
	resize: vertical;
	line-height: 1.4;
}

.icon-input-box {
	display: flex;
	gap: 0.6em;
	align-items: center;
}

.icon-input-box .editor-input {
	flex: 1;
}

.icon-preview-box {
	width: 2.6em;
	height: 2.6em;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	flex-shrink: 0;
}

.icon-preview-emoji {
	font-size: 1.4em;
}

.icon-preview-img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

/* Relations Panel */
.relations-panel {
	background: rgba(15, 23, 42, 0.45);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 1.2em;
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.panel-section-title {
	font-size: 1em;
	font-weight: bold;
	color: #f6c445;
	border-bottom: 1px solid rgba(246, 196, 69, 0.2);
	padding-bottom: 0.4em;
}

.multi-select-box {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.chips-container {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
}

.chip-toggle-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.35em 0.7em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	color: #94a3b8;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.chip-toggle-btn:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #ffffff;
}

.chip-toggle-btn.__selected.__race {
	background: rgba(59, 130, 246, 0.25);
	border-color: #3b82f6;
	color: #93c5fd;
	font-weight: bold;
}

.chip-toggle-btn.__selected.__class {
	background: rgba(239, 68, 68, 0.25);
	border-color: #ef4444;
	color: #fca5a5;
	font-weight: bold;
}

.chip-toggle-btn.__selected.__fraction {
	background: rgba(16, 185, 129, 0.25);
	border-color: #10b981;
	color: #6ee7b7;
	font-weight: bold;
}

.chip-id {
	font-size: 0.75em;
	font-family: monospace;
	opacity: 0.7;
}

/* ========================================================= */
/* TAGS MANAGEMENT CARD IN FORM                              */
/* ========================================================= */
.tag-management-card {
	background: rgba(15, 23, 42, 0.55);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 1.2em;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
}

.tag-sub-section {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
}

.tag-sub-section.__inherited {
	padding-top: 1em;
	border-top: 1px dashed rgba(255, 255, 255, 0.12);
}

.tag-sub-section.__combined {
	padding-top: 1em;
	border-top: 1px solid rgba(246, 196, 69, 0.2);
}

.tag-section-header {
	display: flex;
	align-items: baseline;
	gap: 0.6em;
	flex-wrap: wrap;
}

.tag-section-title {
	font-size: 0.95em;
	font-weight: bold;
	color: #f6c445;
}

.tag-section-hint {
	font-size: 0.8em;
	color: #94a3b8;
}

.current-tags-chips,
.inherited-tags-grid,
.combined-tags-chips {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.interactive-tag-chip {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.3em 0.6em;
	border-radius: 0.35em;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	border: 1px solid transparent;
}

.interactive-tag-chip.__own {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.35);
}

.chip-remove-btn {
	background: transparent;
	border: none;
	color: #fca5a5;
	cursor: pointer;
	font-size: 0.75em;
	padding: 0 0.1em;
	line-height: 1;
	border-radius: 0.2em;
}

.chip-remove-btn:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ffffff;
}

.interactive-tag-chip.__inherited-chip {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
}

.interactive-tag-chip.__inherited-chip.__race {
	border-color: rgba(59, 130, 246, 0.4);
	color: #93c5fd;
	background: rgba(59, 130, 246, 0.15);
}

.interactive-tag-chip.__inherited-chip.__class {
	border-color: rgba(239, 68, 68, 0.4);
	color: #fca5a5;
	background: rgba(239, 68, 68, 0.15);
}

.interactive-tag-chip.__inherited-chip.__fraction {
	border-color: rgba(16, 185, 129, 0.4);
	color: #6ee7b7;
	background: rgba(16, 185, 129, 0.15);
}

.inh-source-icon {
	font-size: 0.9em;
}

.inh-source-label {
	font-size: 0.75em;
	opacity: 0.75;
}

.interactive-tag-chip.__combined-chip {
	background: rgba(168, 85, 247, 0.2);
	color: #e9d5ff;
	border: 1px solid rgba(168, 85, 247, 0.35);
	font-weight: bold;
}

.no-tags-hint {
	font-size: 0.85em;
	color: #64748b;
	font-style: italic;
}

.tag-autocomplete-wrapper {
	position: relative;
	width: 100%;
}

.tag-input-row {
	display: flex;
	gap: 0.6em;
	align-items: center;
	margin-top: 0.3em;
}

.tag-text-input {
	flex: 1;
}

.tag-autocomplete-dropdown {
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	margin-top: 0.3em;
	background: #111827;
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.4em;
	box-shadow: 0 0.6em 1.8em rgba(0, 0, 0, 0.7);
	max-height: 14em;
	overflow-y: auto;
	z-index: 60;
	display: flex;
	flex-direction: column;
	backdrop-filter: blur(0.4em);
}

.autocomplete-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5em 0.8em;
	cursor: pointer;
	transition: background-color 0.15s, color 0.15s;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.autocomplete-item:last-child {
	border-bottom: none;
}

.autocomplete-item:hover,
.autocomplete-item.__highlighted {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
}

.ac-item-left {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.ac-tag-icon {
	font-size: 0.9em;
}

.ac-tag-name {
	font-size: 0.9em;
	color: #e2e8f0;
}

.autocomplete-item.__highlighted .ac-tag-name,
.autocomplete-item:hover .ac-tag-name {
	color: #f6c445;
}

.ac-match-highlight {
	color: #f6c445;
	text-decoration: underline;
}

.ac-item-right {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.ac-usage-pill {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.1);
	color: #94a3b8;
	padding: 0.1em 0.45em;
	border-radius: 0.3em;
}

.ac-new-pill {
	font-size: 0.7em;
	background: rgba(16, 185, 129, 0.25);
	color: #34d399;
	border: 1px solid #10b981;
	padding: 0.15em 0.5em;
	border-radius: 0.25em;
	text-transform: uppercase;
	font-weight: bold;
	letter-spacing: 0.03em;
}

.tag-suggestions-box {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	margin-top: 0.2em;
}

.suggestions-label {
	font-size: 0.8em;
	color: #94a3b8;
}

.suggestion-pills-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35em;
}

.suggestion-pill {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.3em;
	padding: 0.2em 0.5em;
	font-size: 0.75em;
	color: #94a3b8;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.suggestion-pill:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #ffffff;
}

/* ========================================================= */
/* TAGS TAB LIST ITEMS & INSPECTOR                           */
/* ========================================================= */
.tag-creator-bar {
	display: flex;
	gap: 0.4em;
}

.tag-list-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6em 0.8em;
	background: rgba(26, 35, 54, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	cursor: pointer;
	transition: background-color 0.2s, border-color 0.2s;
}

.tag-list-item:hover {
	background: rgba(30, 41, 59, 0.9);
	border-color: rgba(246, 196, 69, 0.3);
}

.tag-list-item.__active {
	background: rgba(246, 196, 69, 0.15);
	border-color: #f6c445;
}

.tag-item-left {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.tag-item-name {
	font-size: 0.9em;
	color: #ffffff;
	font-weight: bold;
}

.tag-list-item.__active .tag-item-name {
	color: #f6c445;
}

.tag-item-right {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.tag-usage-count {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.1);
	color: #cbd5e1;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
}

.tags-inspector-pane {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.tags-inspector-content {
	flex: 1;
	overflow-y: auto;
	padding: 1.5em;
}

.tag-detail-box {
	display: flex;
	flex-direction: column;
	gap: 1.5em;
	background: rgba(15, 23, 42, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.6em;
	padding: 1.5em;
}

.tag-detail-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 1em;
}

.tag-hero-badge {
	font-size: 1.4em;
	font-weight: bold;
	color: #f6c445;
	font-family: Overlord, Kurale, serif;
}

.tag-hero-usage {
	font-size: 0.9em;
	color: #94a3b8;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.3em 0.7em;
	border-radius: 0.3em;
}

.usage-section-heading {
	margin: 0 0 0.8em 0;
	font-size: 1em;
	color: #cbd5e1;
}

.usage-entities-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6em;
}

.usage-entity-chip {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.4em 0.8em;
	font-size: 0.85em;
}

.usage-ent-type {
	color: #f6c445;
	font-weight: bold;
}

.usage-ent-name {
	color: #ffffff;
}

.usage-ent-id {
	font-family: monospace;
	color: #94a3b8;
	font-size: 0.8em;
}

.no-usage-note {
	color: #64748b;
	font-size: 0.9em;
	font-style: italic;
}

.checkbox-label {
	display: flex;
	align-items: center;
	gap: 0.6em;
	font-size: 0.9em;
	color: #cbd5e1;
	cursor: pointer;
	margin-top: 1.8em;
}

/* Form Footer */
.form-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.5em;
	background: rgba(15, 23, 42, 0.75);
	border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.file-save-target {
	font-size: 0.85em;
	color: #94a3b8;
}

.file-save-target code {
	color: #f6c445;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
}

.footer-right {
	display: flex;
	gap: 0.6em;
}

/* Empty State */
.form-empty-state {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2em;
}

.empty-state-content {
	max-width: 28em;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 1em;
	background: rgba(15, 23, 42, 0.5);
	padding: 2.5em;
	border-radius: 0.8em;
	border: 1px dashed rgba(255, 255, 255, 0.15);
}

.empty-state-icon {
	font-size: 3em;
}

.empty-state-title {
	margin: 0;
	font-size: 1.3em;
	color: #ffffff;
	font-family: Overlord, Kurale, serif;
}

.empty-state-desc {
	margin: 0;
	font-size: 0.9em;
	color: #94a3b8;
	line-height: 1.5;
}

/* Delete Modal */
.modal-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.75);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
	backdrop-filter: blur(0.2em);
}

.delete-modal-card {
	width: 30em;
	background: #182236;
	border: 1px solid rgba(239, 68, 68, 0.4);
	border-radius: 0.6em;
	padding: 1.5em;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.8);
}

.modal-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.modal-icon {
	font-size: 1.5em;
}

.modal-title {
	margin: 0;
	font-size: 1.2em;
	color: #fca5a5;
}

.modal-body {
	font-size: 0.95em;
	color: #e2e8f0;
	line-height: 1.5;
}

.modal-warning-sub {
	color: #94a3b8;
	font-size: 0.85em;
	margin-top: 0.5em;
}

.modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.6em;
}

/* Custom Fields Preservation Box */
.custom-fields-badge-box {
	background: rgba(30, 41, 59, 0.45);
	border: 1px dashed rgba(246, 196, 69, 0.35);
	border-radius: 0.5em;
	padding: 0.9em 1.2em;
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.custom-fields-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.custom-fields-title {
	font-size: 0.9em;
	font-weight: bold;
	color: #f6c445;
}

.custom-fields-badge-tag {
	font-size: 0.75em;
	background: rgba(16, 185, 129, 0.2);
	color: #34d399;
	border: 1px solid rgba(16, 185, 129, 0.3);
	padding: 0.15em 0.5em;
	border-radius: 0.25em;
	font-weight: bold;
}

.custom-fields-desc {
	margin: 0;
	font-size: 0.8em;
	color: #94a3b8;
	line-height: 1.4;
}

.custom-fields-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
	margin-top: 0.2em;
}

.custom-field-pill {
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	padding: 0.25em 0.6em;
	font-size: 0.8em;
	font-family: monospace;
	max-width: 100%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.cf-key {
	color: #93c5fd;
	font-weight: bold;
	margin-right: 0.3em;
}

.cf-val {
	color: #fcd34d;
}

/* Localization Controls & Language Switcher Dropdown */
.header-right {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.header-locale-dropdown-wrap {
	position: relative;
}

.header-locale-trigger-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.35em 0.7em;
	color: #f1f5f9;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
}

.header-locale-trigger-btn:hover {
	background: rgba(30, 41, 59, 0.9);
	border-color: rgba(59, 130, 246, 0.6);
}

.header-locale-trigger-btn.__open {
	background: rgba(30, 41, 59, 1);
	border-color: #3b82f6;
	box-shadow: 0 0 0.5em rgba(59, 130, 246, 0.35);
}

.trigger-flag {
	font-size: 1.15em;
	line-height: 1;
}

.trigger-name {
	font-weight: bold;
	color: #e2e8f0;
}

.trigger-code {
	color: #94a3b8;
	font-size: 0.85em;
	font-weight: normal;
}

.trigger-arrow {
	color: #64748b;
	font-size: 0.7em;
	margin-left: 0.2em;
}

.header-locale-dropdown-menu {
	position: absolute;
	top: calc(100% + 0.35em);
	right: 0;
	min-width: 14em;
	background: #0f172a;
	border: 1px solid rgba(59, 130, 246, 0.4);
	border-radius: 0.5em;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.8);
	z-index: 100;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.dropdown-menu-header {
	padding: 0.45em 0.8em;
	font-size: 0.75em;
	color: #64748b;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.dropdown-menu-list {
	max-height: 16em;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	padding: 0.25em 0;
}

.locale-dropdown-item {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding: 0.45em 0.8em;
	background: transparent;
	border: none;
	width: 100%;
	text-align: left;
	cursor: pointer;
	color: #cbd5e1;
	font-family: Kurale, sans-serif;
	transition: background-color 0.15s, color 0.15s;
}

.locale-dropdown-item:hover {
	background: rgba(59, 130, 246, 0.15);
	color: #ffffff;
}

.locale-dropdown-item.__active {
	background: rgba(59, 130, 246, 0.25);
	color: #93c5fd;
	font-weight: bold;
}

.item-flag {
	font-size: 1.2em;
	line-height: 1;
}

.item-info {
	display: flex;
	flex-direction: column;
	flex: 1;
}

.item-label {
	font-size: 0.85em;
}

.item-code {
	font-size: 0.7em;
	color: #64748b;
}

.item-badge.__default {
	font-size: 0.65em;
	background: rgba(16, 185, 129, 0.2);
	color: #34d399;
	border: 1px solid rgba(16, 185, 129, 0.35);
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
}

.item-check {
	color: #3b82f6;
	font-size: 0.85em;
}

.dropdown-menu-footer {
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	padding: 0.35em 0.5em;
	background: rgba(0, 0, 0, 0.2);
}

.add-locale-btn {
	width: 100%;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.4em;
	padding: 0.4em 0.6em;
	background: rgba(59, 130, 246, 0.15);
	border: 1px dashed rgba(59, 130, 246, 0.4);
	border-radius: 0.35em;
	color: #93c5fd;
	font-family: Kurale, sans-serif;
	font-size: 0.8em;
	cursor: pointer;
	transition: background-color 0.2s, border-color 0.2s, color 0.2s;
}

.add-locale-btn:hover {
	background: rgba(59, 130, 246, 0.3);
	border-color: #60a5fa;
	color: #ffffff;
}

.locale-fallback-badge {
	font-size: 0.65em;
	background: rgba(246, 196, 69, 0.18);
	color: #f6c445;
	border: 1px solid rgba(246, 196, 69, 0.4);
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
	font-weight: bold;
	margin-left: 0.3em;
	vertical-align: middle;
}

/* Form Localization Panel */
.form-locale-panel {
	background: rgba(15, 23, 42, 0.65);
	border: 1px solid rgba(59, 130, 246, 0.25);
	border-radius: 0.5em;
	padding: 0.7em 0.9em;
	display: flex;
	flex-direction: column;
	gap: 0.5em;
	margin-bottom: 0.5em;
}

.form-locale-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8em;
	flex-wrap: wrap;
}

.form-locale-select-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
	flex-wrap: wrap;
}

.form-locale-select-label {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	font-size: 0.85em;
	font-weight: bold;
	color: #93c5fd;
}

.form-locale-select {
	min-width: 14em;
	padding: 0.35em 0.7em;
	font-size: 0.85em;
}

.__form-add-lang-btn {
	padding: 0.35em 0.7em;
	font-size: 0.8em;
}

.form-locale-info {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.75em;
	color: #64748b;
}

.form-locale-info code {
	color: #fcd34d;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
}

.tab-default-tag {
	font-size: 0.7em;
	background: rgba(16, 185, 129, 0.2);
	color: #34d399;
	border: 1px solid rgba(16, 185, 129, 0.35);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	font-weight: normal;
}

.tab-missing-tag {
	font-size: 0.7em;
	background: rgba(239, 68, 68, 0.2);
	color: #f87171;
	border: 1px solid rgba(239, 68, 68, 0.35);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	font-weight: normal;
}

/* Add Language Modal */
.add-locale-modal-card {
	background: #0f172a;
	border: 1px solid rgba(59, 130, 246, 0.4);
	border-radius: 0.75em;
	width: min(34em, 90%);
	max-height: 85%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.85);
}

.modal-desc {
	font-size: 0.85em;
	color: #94a3b8;
	margin-bottom: 0.7em;
}

.preset-locales-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(8.5em, 1fr));
	gap: 0.4em;
	max-height: 12em;
	overflow-y: auto;
	padding: 0.2em;
	margin-bottom: 0.8em;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.05);
}

.preset-locale-card {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.45em 0.6em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	cursor: pointer;
	text-align: left;
	font-family: Kurale, sans-serif;
	transition: background-color 0.15s, border-color 0.15s;
}

.preset-locale-card:hover:not(:disabled) {
	background: rgba(59, 130, 246, 0.2);
	border-color: #3b82f6;
}

.preset-locale-card:disabled {
	opacity: 0.55;
	cursor: not-allowed;
}

.preset-flag {
	font-size: 1.25em;
	line-height: 1;
}

.preset-info {
	display: flex;
	flex-direction: column;
	flex: 1;
	overflow: hidden;
}

.preset-name {
	font-size: 0.8em;
	color: #f1f5f9;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.preset-code {
	font-size: 0.65em;
	color: #64748b;
	font-weight: bold;
}

.preset-added-badge {
	font-size: 0.6em;
	color: #34d399;
	background: rgba(16, 185, 129, 0.15);
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
}

.custom-locale-box {
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	padding-top: 0.6em;
}

.custom-locale-title {
	font-size: 0.8em;
	color: #94a3b8;
	font-weight: bold;
	margin-bottom: 0.4em;
}

.__narrow {
	max-width: 5em;
}

/* Localized Field Enhancements */
.field-label-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 0.25em;
}

.locale-pill-tag {
	font-size: 0.7em;
	font-weight: bold;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	letter-spacing: 0.05em;
	margin-left: 0.3em;
}

.locale-pill-tag.__ru {
	background: rgba(16, 185, 129, 0.2);
	color: #34d399;
	border: 1px solid rgba(16, 185, 129, 0.35);
}

.locale-pill-tag.__en {
	background: rgba(59, 130, 246, 0.2);
	color: #60a5fa;
	border: 1px solid rgba(59, 130, 246, 0.35);
}

.field-ru-preview {
	font-size: 0.75em;
	color: #cbd5e1;
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.3em;
	padding: 0.15em 0.5em;
	max-width: 50%;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.ru-reference-box {
	background: rgba(15, 23, 42, 0.7);
	border-left: 0.2em solid #f6c445;
	border-radius: 0 0.4em 0.4em 0;
	padding: 0.5em 0.8em;
	margin-bottom: 0.4em;
	font-size: 0.8em;
}

.ref-badge {
	color: #f6c445;
	font-weight: bold;
	font-size: 0.85em;
	display: block;
	margin-bottom: 0.2em;
}

.ref-text {
	margin: 0;
	color: #94a3b8;
	line-height: 1.4;
	font-style: italic;
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
