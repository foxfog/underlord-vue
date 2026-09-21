<template>
	<div class="data-table-editor">
		<!-- Top Toolbar -->
		<div class="dte-toolbar">
			<div class="dte-toolbar-left">
				<!-- Search -->
				<div class="dte-search-box">
					<span class="dte-search-icon">🔍</span>
					<input
						v-model="searchQuery"
						type="text"
						class="dte-search-input"
						placeholder="Поиск по имени, ID, тегам, категориям..."
					/>
					<button
						v-if="searchQuery"
						class="dte-btn-clear"
						type="button"
						@click="searchQuery = ''"
					>
						✕
					</button>
				</div>

				<!-- Grouping / Hierarchy Mode -->
				<div class="dte-grouping-selector">
					<span class="dte-label">Группировка:</span>
					<button
						v-if="hasHierarchy"
						type="button"
						class="dte-mode-btn"
						:class="{ __active: groupingMode === 'tree' }"
						title="Иерархия по предкам (parent_id)"
						@click="groupingMode = 'tree'"
					>
						<span>🌳 Древо</span>
					</button>
					<button
						v-if="hasCategory"
						type="button"
						class="dte-mode-btn"
						:class="{ __active: groupingMode === 'category' }"
						title="Группировка по категориям"
						@click="groupingMode = 'category'"
					>
						<span>📁 Категории</span>
					</button>
					<button
						v-if="hasFamily"
						type="button"
						class="dte-mode-btn"
						:class="{ __active: groupingMode === 'family' }"
						title="Группировка по семействам"
						@click="groupingMode = 'family'"
					>
						<span>👥 Семейства</span>
					</button>
					<button
						type="button"
						class="dte-mode-btn"
						:class="{ __active: groupingMode === 'flat' }"
						title="Плоская таблица без группировок"
						@click="groupingMode = 'flat'"
					>
						<span>📋 Плоский</span>
					</button>
				</div>

				<!-- Fold / Unfold All Rows -->
				<div v-if="groupingMode !== 'flat'" class="dte-fold-actions">
					<button
						type="button"
						class="dte-small-btn"
						title="Развернуть все строки"
						@click="expandAllRows"
					>
						<span>➕ Развернуть все</span>
					</button>
					<button
						type="button"
						class="dte-small-btn"
						title="Свернуть все строки"
						@click="collapseAllRows"
					>
						<span>➖ Свернуть все</span>
					</button>
				</div>
			</div>

			<div class="dte-toolbar-right">
				<!-- Columns Visibility Dropdown -->
				<div class="dte-dropdown-wrap">
					<button
						type="button"
						class="dte-toolbar-btn"
						:class="{ __open: isColMenuOpen }"
						@click="isColMenuOpen = !isColMenuOpen"
					>
						<span>👁️ Колонки ({{ visibleColCount }}/{{ allColumns.length }}) ▼</span>
					</button>
					<Transition name="fade">
						<div v-if="isColMenuOpen" class="dte-col-dropdown">
							<div class="dte-col-dropdown-header">
								<span>Отображение колонок</span>
								<div class="dte-col-presets">
									<button type="button" class="dte-preset-link" @click="setColPreset('all')">Все</button>
									<button type="button" class="dte-preset-link" @click="setColPreset('stats')">Статы</button>
									<button type="button" class="dte-preset-link" @click="setColPreset('converters')">Скейлы</button>
									<button type="button" class="dte-preset-link" @click="setColPreset('compact')">Компактно</button>
								</div>
							</div>
							<div class="dte-col-dropdown-list">
								<div
									v-for="grp in columnGroups"
									:key="grp.id"
									class="dte-col-group-section"
								>
									<div class="dte-col-group-title">
										<label class="dte-col-check-label">
											<input
												type="checkbox"
												:checked="isGroupAllVisible(grp)"
												@change="toggleGroupColumns(grp, $event.target.checked)"
											/>
											<strong>{{ grp.label }}</strong>
										</label>
									</div>
									<div class="dte-col-items">
										<label
											v-for="col in grp.columns"
											:key="col.key"
											class="dte-col-check-item"
										>
											<input
												type="checkbox"
												:checked="!hiddenColKeys.has(col.key)"
												@change="toggleColumnVisibility(col.key, $event.target.checked)"
											/>
											<span>{{ col.label }}</span>
										</label>
									</div>
								</div>
							</div>
						</div>
					</Transition>
				</div>

				<!-- Pin Actions Column Toggle Button -->
				<button
					type="button"
					class="dte-toolbar-btn"
					:class="{ __active: isActionsPinned }"
					:title="isActionsPinned ? 'Колонка «Действия» закреплена справа экрана. Кликните, чтобы открепить (скроллить вместе со строкой).' : 'Закрепить колонку «Действия» справа экрана, чтобы кнопки ✏️ и 🗑️ были видны всегда.'"
					@click="togglePinActions"
				>
					<span>{{ isActionsPinned ? '📌 Действия закр.' : '📍 Закрепить действия' }}</span>
				</button>

				<!-- Add Row Button -->
				<button
					type="button"
					class="dte-toolbar-btn __primary"
					title="Создать новую запись"
					@click="$emit('create')"
				>
					<span>➕ Создать</span>
				</button>

				<!-- Save Batch Button -->
				<button
					type="button"
					class="dte-toolbar-btn __save"
					:class="{ __dirty: dirtyCount > 0 }"
					:title="dirtyCount > 0 ? `Есть несохраненные изменения (${dirtyCount})` : 'Все изменения сохранены'"
					@click="handleSaveBatch"
				>
					<span>💾 Сохранить {{ dirtyCount > 0 ? `(${dirtyCount})` : '' }}</span>
				</button>
			</div>
		</div>

		<!-- Main Spreadsheet Table Area -->
		<div class="dte-table-container" @click="onContainerClick">
			<table class="dte-table">
				<!-- Table Header with Super-Header Groups and Sub-Headers -->
				<thead>
					<!-- Row 1: Super Header (Functional Groups with Collapsible [-]/[+] buttons) -->
					<tr class="dte-super-header-row">
						<!-- Fixed index column header -->
						<th class="dte-super-th __sticky-left __index-col" rowspan="2">
							<span class="dte-th-content">#</span>
						</th>

						<!-- Super header groups -->
						<th
							v-for="grp in visibleGroups"
							:key="'super-' + grp.id"
							class="dte-super-th"
							:class="[
								grp.themeClass,
								{ __collapsed: isGroupCollapsed(grp.id) }
							]"
							:colspan="isGroupCollapsed(grp.id) ? 1 : grp.visibleColumns.length"
							:title="isGroupCollapsed(grp.id) ? `Развернуть группу: ${grp.label} (${grp.visibleColumns.length} колонок)` : ''"
						>
							<div class="dte-super-th-inner" :class="{ __collapsed_inner: isGroupCollapsed(grp.id) }">
								<button
									type="button"
									class="dte-group-collapse-btn"
									:title="isGroupCollapsed(grp.id) ? `Развернуть группу: ${grp.label} (${grp.visibleColumns.length} колонок)` : `Свернуть группу: ${grp.label}`"
									@click.stop="toggleGroupCollapse(grp.id)"
								>
									{{ isGroupCollapsed(grp.id) ? '➕' : '➖' }}
								</button>
								<template v-if="!isGroupCollapsed(grp.id)">
									<span class="dte-group-name">{{ grp.label }}</span>
								</template>
							</div>
						</th>

						<!-- Actions Column (Pin-able to right edge) -->
						<th
							class="dte-super-th __actions-col"
							:class="{ '__sticky-right': isActionsPinned }"
							:title="isActionsPinned ? 'Колонка действий закреплена справа экрана. Кликните 📌 чтобы открепить.' : 'Колонка действий не закреплена. Кликните 📍 чтобы закрепить справа.'"
							rowspan="2"
						>
							<div class="dte-actions-th-inner">
								<span class="dte-th-content">Действия</span>
								<button
									type="button"
									class="dte-pin-col-btn"
									:class="{ __active: isActionsPinned }"
									:title="isActionsPinned ? 'Открепить колонку (скроллить вместе с таблицей)' : 'Закрепить колонку справа (всегда на виду)'"
									@click.stop="togglePinActions"
								>
									{{ isActionsPinned ? '📌' : '📍' }}
								</button>
							</div>
						</th>
					</tr>

					<!-- Row 2: Sub-Header Columns (Column Names with Sorting) -->
					<tr class="dte-sub-header-row">
						<template v-for="grp in visibleGroups" :key="'subgrp-' + grp.id">
							<!-- If group is collapsed, render a single narrow column placeholder -->
							<th
								v-if="isGroupCollapsed(grp.id)"
								class="dte-sub-th __collapsed-placeholder"
								:class="grp.themeClass"
								:title="`Группа «${grp.label}» свернута. Кликните ➕ выше, чтобы развернуть.`"
							>
								<span>···</span>
							</th>

							<!-- Otherwise render individual column sub-headers -->
							<template v-else>
								<th
									v-for="col in grp.visibleColumns"
									:key="'subcol-' + col.key"
									class="dte-sub-th"
									:class="[
										grp.themeClass,
										col.customClass,
										{ __sortable: groupingMode === 'flat' }
									]"
									:style="{ minWidth: col.minWidth || '4.5em' }"
									@click="groupingMode === 'flat' ? toggleSort(col.key) : null"
								>
									<div class="dte-sub-th-inner">
										<span class="dte-col-title" :title="col.tooltip || col.label">
											{{ col.label }}
										</span>
										<span
											v-if="groupingMode === 'flat' && sortKey === col.key"
											class="dte-sort-icon"
										>
											{{ sortOrder === 'asc' ? '▲' : '▼' }}
										</span>
									</div>
								</th>
							</template>
						</template>
					</tr>
				</thead>

				<!-- Table Body -->
				<tbody>
					<template v-for="(rowItem, rIdx) in processedRows" :key="rowItem.rowKey">
						<!-- Category / Family Divider Row (for grouping modes) -->
						<tr
							v-if="rowItem.isGroupDivider"
							class="dte-divider-row"
							@click="toggleGroupDivider(rowItem.groupVal)"
						>
							<td :colspan="totalColspan" class="dte-divider-td">
								<div class="dte-divider-content">
									<button
										type="button"
										class="dte-divider-toggle-btn"
										:title="isDividerCollapsed(rowItem.groupVal) ? 'Развернуть' : 'Свернуть'"
									>
										{{ isDividerCollapsed(rowItem.groupVal) ? '▶' : '▼' }}
									</button>
									<span class="dte-divider-icon">{{ rowItem.groupIcon }}</span>
									<span class="dte-divider-title">{{ rowItem.groupTitle }}</span>
									<span class="dte-divider-count">({{ rowItem.count }})</span>
								</div>
							</td>
						</tr>

						<!-- Standard Data Row -->
						<tr
							v-else-if="!rowItem.isHiddenByFold"
							class="dte-data-row"
							:class="{
								__selected: selectedId === rowItem.data.id,
								__dirty: isItemDirty(rowItem.data.id),
								__is_child: rowItem.isChild
							}"
							@click="onRowClick(rowItem.data)"
						>
							<!-- # Index Column -->
							<td class="dte-td __sticky-left __index-col">
								<span class="dte-row-index">{{ rowItem.displayIndex }}</span>
							</td>

							<!-- Cells across visible groups -->
							<template v-for="grp in visibleGroups" :key="'cellgrp-' + grp.id">
								<!-- Collapsed group cell -->
								<td
									v-if="isGroupCollapsed(grp.id)"
									class="dte-td __collapsed-cell"
									:class="grp.themeClass"
								>
									<span>···</span>
								</td>

								<!-- Individual column cells -->
								<template v-else>
									<td
										v-for="col in grp.visibleColumns"
										:key="'cell-' + rowItem.data.id + '-' + col.key"
										class="dte-td"
										:class="[
											grp.themeClass,
											col.customClass,
											{
												__active_cell: isCellSelected(rowItem.data.id, col.key),
												__editing: isCellEditing(rowItem.data.id, col.key),
												'__cat-humanoid': col.key === 'category' && rowItem.data.category === 'humanoid',
												'__cat-demi-human': col.key === 'category' && rowItem.data.category === 'demi-human',
												'__cat-heteromorphic': col.key === 'category' && rowItem.data.category === 'heteromorphic'
											}
										]"
										@click.stop="onCellClick(rowItem.data.id, col.key)"
										@dblclick.stop="startEditCell(rowItem.data, col)"
									>
										<!-- In-place Inline Cell Editor Mode -->
										<template v-if="isCellEditing(rowItem.data.id, col.key)">
											<!-- Number Input -->
											<input
												v-if="col.type === 'number'"
												ref="cellInputRef"
												v-model.number="editCellValue"
												type="number"
												:step="col.step || (isPercentStat(col.key) ? 0.1 : (col.key === 'spd' ? 0.05 : 1))"
												:min="col.min !== undefined ? col.min : 0"
												class="dte-inline-input __number"
												@keydown.enter="commitEditCell(rowItem.data, col)"
												@keydown.esc="cancelEditCell"
												@blur="commitEditCell(rowItem.data, col)"
											/>

											<!-- Select Input -->
											<select
												v-else-if="col.type === 'select'"
												ref="cellInputRef"
												v-model="editCellValue"
												class="dte-inline-select"
												@change="commitEditCell(rowItem.data, col)"
												@keydown.enter="commitEditCell(rowItem.data, col)"
												@keydown.esc="cancelEditCell"
												@blur="commitEditCell(rowItem.data, col)"
											>
												<option
													v-for="opt in getSelectOptions(col, rowItem.data)"
													:key="opt.value"
													:value="opt.value"
												>
													{{ opt.label }}
												</option>
											</select>

											<!-- Text Input -->
											<input
												v-else
												ref="cellInputRef"
												v-model="editCellValue"
												type="text"
												class="dte-inline-input __text"
												@keydown.enter="commitEditCell(rowItem.data, col)"
												@keydown.esc="cancelEditCell"
												@blur="commitEditCell(rowItem.data, col)"
											/>
										</template>

										<!-- Normal Cell Display Mode -->
										<template v-else>
											<!-- Icon column -->
											<div v-if="col.key === 'icon'" class="dte-icon-cell">
												<span v-if="!rowItem.data.icon || isEmoji(rowItem.data.icon)" class="dte-emoji-icon">
													{{ rowItem.data.icon || defaultIcon }}
												</span>
												<img
													v-else
													:src="resolveIconPath(rowItem.data.icon)"
													class="dte-img-icon"
													alt=""
												/>
											</div>

											<!-- Name column (with tree hierarchy indent and folding button) -->
											<div v-else-if="col.key === 'name'" class="dte-name-cell">
												<div
													v-if="groupingMode === 'tree'"
													class="dte-tree-indent"
													:style="{ width: (rowItem.depth * 1.3) + 'em' }"
												>
													<span v-if="rowItem.depth > 0" class="dte-tree-branch">↳</span>
												</div>

												<!-- Fold/Unfold button if this item has children -->
												<button
													v-if="groupingMode === 'tree' && rowItem.hasChildren"
													type="button"
													class="dte-row-fold-btn"
													:title="isRowCollapsed(rowItem.data.id) ? 'Развернуть потомков' : 'Свернуть потомков'"
													@click.stop="toggleRowCollapse(rowItem.data.id)"
												>
													{{ isRowCollapsed(rowItem.data.id) ? '➕' : '➖' }}
												</button>
												<span v-else-if="groupingMode === 'tree'" class="dte-row-fold-spacer" />

												<span class="dte-name-text">
													{{ getDisplayName(rowItem.data) }}
												</span>
											</div>

											<!-- Category column with user badge colors -->
											<div v-else-if="col.key === 'category'" class="dte-cat-cell">
												<span
													class="dte-cat-badge"
													:class="`__cat-${rowItem.data.category}`"
												>
													{{ getCategoryLabel(rowItem.data.category) }}
												</span>
											</div>

											<!-- Parent ID badge -->
											<div v-else-if="col.key === 'parent_id'" class="dte-parent-cell">
												<span v-if="rowItem.data.parent_id" class="dte-parent-badge">
													↳ {{ getParentName(rowItem.data.parent_id) }}
												</span>
												<span v-else class="dte-empty-dim">—</span>
											</div>

											<!-- Number columns (formatted) -->
											<div v-else-if="col.type === 'number'" class="dte-num-cell">
												<span class="dte-num-val">{{ getColValue(rowItem.data, col) }}</span>
											</div>

											<!-- Attribute Converter column with multi-stat pills (0 to many parameters) -->
											<div v-else-if="col.type === 'converter'" class="dte-conv-cell">
												<div
													v-if="getConverterEntries(rowItem.data, col.attrKey).length > 0"
													class="dte-conv-pills"
													:title="getConverterTooltip(rowItem.data, col.attrKey)"
												>
													<span
														v-for="entry in getConverterEntries(rowItem.data, col.attrKey)"
														:key="entry.key"
														class="dte-conv-pill"
														:class="entry.meta.theme"
													>
														+{{ entry.val }}{{ entry.meta.isPercent ? '%' : '' }} {{ entry.meta.label }}
													</span>
												</div>
												<span v-else class="dte-empty-dim" title="Нет скейлов (0 параметров)">—</span>
												<button
													type="button"
													class="dte-conv-edit-btn"
													title="Настроить скейлы этой характеристики (от 0 до множества параметров)"
													@click.stop="openConverterModal(rowItem.data, col.attrKey)"
												>
													⚙️
												</button>
											</div>

											<!-- Default plain text cell -->
											<div v-else class="dte-text-cell">
												<span>{{ getColValue(rowItem.data, col) || '—' }}</span>
											</div>
										</template>
									</td>
								</template>
							</template>

							<!-- Actions column -->
							<td
								class="dte-td __actions-col"
								:class="{ '__sticky-right': isActionsPinned }"
							>
								<div class="dte-actions-wrap">
									<button
										type="button"
										class="dte-action-btn __edit"
										title="Открыть в боковом инспекторе"
										@click.stop="$emit('select', rowItem.data)"
									>
										✏️
									</button>
									<button
										type="button"
										class="dte-action-btn __delete"
										title="Удалить"
										@click.stop="$emit('delete', rowItem.data)"
									>
										🗑️
									</button>
								</div>
							</td>
						</tr>
					</template>

					<!-- Empty state -->
					<tr v-if="processedRows.length === 0" class="dte-empty-row">
						<td :colspan="totalColspan" class="dte-empty-td">
							<div class="dte-empty-notice">
								<span>{{ searchQuery ? 'Ничего не найдено по фильтру' : 'Таблица пуста' }}</span>
							</div>
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<!-- Converter Scalings Editor Modal (0 to many parameters) -->
		<Transition name="fade">
			<div
				v-if="converterModal.open"
				class="dte-modal-overlay"
				@click.self="closeConverterModal"
			>
				<div class="dte-modal-card">
					<div class="dte-modal-header">
						<div class="dte-modal-title-box">
							<span class="dte-modal-icon">⚙️</span>
							<div>
								<h3 class="dte-modal-title">
									Скейлы характеристики: {{ converterModal.attrKey.toUpperCase() }}
								</h3>
								<span class="dte-modal-subtitle">
									{{ getDisplayName(converterModal.item) }} ({{ converterModal.item.id }})
								</span>
							</div>
						</div>
						<button
							type="button"
							class="dte-modal-close-btn"
							@click="closeConverterModal"
						>
							✕
						</button>
					</div>

					<div class="dte-modal-body">
						<div class="dte-modal-desc">
							Каждое 1 очко <strong>{{ converterModal.attrKey.toUpperCase() }}</strong> у этой расы увеличивает следующие боевые параметры:
						</div>

						<!-- Existing Scaled Parameters List -->
						<div class="dte-conv-modal-list">
							<div
								v-if="converterModal.entries.length === 0"
								class="dte-conv-modal-empty"
							>
								<span>Характеристика ничего не скейлит (0 параметров). Вы можете добавить параметры ниже.</span>
							</div>

							<div
								v-for="(entry, eIdx) in converterModal.entries"
								:key="entry.key"
								class="dte-conv-modal-row"
							>
								<div class="dte-conv-row-info">
									<span class="dte-conv-row-icon">{{ entry.meta.icon }}</span>
									<span class="dte-conv-row-name">{{ entry.meta.label }}</span>
									<span class="dte-conv-row-key">({{ entry.key }})</span>
								</div>

								<div class="dte-conv-row-val">
									<span class="dte-conv-plus">+</span>
									<input
										v-model.number="entry.val"
										type="number"
										:step="isPercentStat(entry.key) ? 0.1 : (entry.key.includes('spd') ? 0.05 : 1)"
										class="dte-inline-input __modal-num"
									/>
									<span v-if="entry.meta.isPercent" class="dte-conv-pct-suffix">%</span>
									<button
										type="button"
										class="dte-conv-del-btn"
										title="Удалить скейл этого параметра"
										@click="removeConverterEntry(eIdx)"
									>
										🗑️
									</button>
								</div>
							</div>
						</div>

						<!-- Add New Scaled Parameter Section -->
						<div class="dte-conv-add-section">
							<span class="dte-conv-add-title">➕ Добавить параметр для скейла:</span>
							<div class="dte-conv-add-row">
								<select
									v-model="newConverterStatKey"
									class="dte-inline-select __stat-sel"
									@change="onNewConverterStatKeyChange"
								>
									<option
										v-for="opt in availableConverterStats"
										:key="opt.key"
										:value="opt.key"
										:disabled="converterModal.entries.some(e => e.key === opt.key)"
									>
										{{ opt.icon }} {{ opt.label }} ({{ opt.key }})
									</option>
								</select>

								<input
									v-model.number="newConverterStatVal"
									type="number"
									:step="isPercentStat(newConverterStatKey) ? 0.1 : (newConverterStatKey.includes('spd') ? 0.05 : 1)"
									class="dte-inline-input __modal-num"
									placeholder="Значение"
								/>
								<span v-if="isPercentStat(newConverterStatKey)" class="dte-conv-pct-suffix">%</span>

								<button
									type="button"
									class="dte-toolbar-btn __primary __add-param-btn"
									:disabled="!newConverterStatKey || newConverterStatVal === 0"
									@click="addConverterEntry"
								>
									<span>Добавить</span>
								</button>
							</div>
						</div>
					</div>

					<div class="dte-modal-footer">
						<button
							type="button"
							class="dte-small-btn __danger"
							title="Удалить все скейлы для этой характеристики"
							@click="clearConverterEntries"
						>
							Очистить все (0 параметров)
						</button>
						<div class="dte-modal-footer-right">
							<button
								type="button"
								class="dte-toolbar-btn"
								@click="closeConverterModal"
							>
								Отмена
							</button>
							<button
								type="button"
								class="dte-toolbar-btn __primary"
								@click="applyConverterModal"
							>
								💾 Сохранить
							</button>
						</div>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'

const props = defineProps({
	type: {
		type: String,
		required: true
	},
	items: {
		type: Array,
		default: () => []
	},
	selectedId: {
		type: String,
		default: null
	},
	activeLocale: {
		type: String,
		default: 'ru'
	},
	localesData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['select', 'create', 'delete', 'saveBatch', 'change'])

// Search and grouping state
const searchQuery = ref('')
const groupingMode = ref('tree') // 'tree' | 'category' | 'family' | 'flat'
const isColMenuOpen = ref(false)
const hiddenColKeys = ref(new Set())
const collapsedGroupIds = ref(new Set())
const collapsedRowIds = ref(new Set()) // For tree mode row folding
const collapsedDividers = ref(new Set()) // For category/family divider folding

// Inline editing state
const selectedCell = ref({ itemId: null, colKey: null })
const editingCell = ref({ itemId: null, colKey: null })
const editCellValue = ref(null)
const cellInputRef = ref(null)
const dirtyItemIds = ref(new Set())

// Sorting for flat mode
const sortKey = ref('id')
const sortOrder = ref('asc') // 'asc' | 'desc'

// Default Icon by type
const defaultIcon = computed(() => {
	switch (props.type) {
		case 'races': return '🧬'
		case 'classes': return '⚔️'
		case 'fractions': return '🏛️'
		case 'items': return '📦'
		default: return '📄'
	}
})

// Check capability by type
const hasHierarchy = computed(() => ['classes', 'races', 'fractions'].includes(props.type))
const hasCategory = computed(() => ['classes', 'races', 'items'].includes(props.type))
const hasFamily = computed(() => props.type === 'races')

// Ensure proper initial grouping mode based on type
watch(
	() => props.type,
	(newType) => {
		if (newType === 'items') {
			groupingMode.value = 'category'
		} else if (hasHierarchy.value) {
			groupingMode.value = 'tree'
		} else {
			groupingMode.value = 'flat'
		}
		collapsedRowIds.value.clear()
		collapsedDividers.value.clear()
		editingCell.value = { itemId: null, colKey: null }
	},
	{ immediate: true }
)

// =========================================================================
// COLUMN DEFINITIONS BY ENTITY TYPE
// =========================================================================
const columnGroups = computed(() => {
	if (props.type === 'races' || props.type === 'classes') {
		return [
			{
				id: 'core',
				label: 'Основное',
				themeClass: '__grp-core',
				columns: [
					{ key: 'icon', label: 'Иконка', minWidth: '3.2em', type: 'icon' },
					{ key: 'name', label: 'Название', minWidth: '11em', type: 'text' },
					{ key: 'id', label: 'ID', minWidth: '8em', type: 'text' },
					{ key: 'category', label: 'Категория', minWidth: '9em', type: 'select' },
					...(props.type === 'races' ? [{ key: 'family', label: 'Семейство', minWidth: '8.5em', type: 'text' }] : [])
				]
			},
			{
				id: 'hierarchy',
				label: 'Иерархия',
				themeClass: '__grp-hierarchy',
				columns: [
					{ key: 'parent_id', label: 'Базовый предок', minWidth: '9em', type: 'select' },
					{ key: 'tier', label: 'Тир', minWidth: '4em', type: 'number', min: 1 },
					{ key: 'lvl_min', label: 'Мин. ур.', minWidth: '4.5em', type: 'number', min: 1 }
				]
			},
			{
				id: 'stats',
				label: 'Базовые характеристики (Base Stats)',
				themeClass: '__grp-stats',
				columns: [
					{ key: 'hp', label: 'HP', minWidth: '4.5em', type: 'number', statPath: 'base_stats.hp' },
					{ key: 'mp', label: 'MP', minWidth: '4.5em', type: 'number', statPath: 'base_stats.mp' },
					{ key: 'atk_phys', label: 'Физ. Атака', minWidth: '5.2em', type: 'number', statPath: 'base_stats.atk_phys' },
					{ key: 'def_phys', label: 'Физ. Защита', minWidth: '5.2em', type: 'number', statPath: 'base_stats.def_phys' },
					{ key: 'atk_mag', label: 'Маг. Атака', minWidth: '5.2em', type: 'number', statPath: 'base_stats.atk_mag' },
					{ key: 'def_mag', label: 'Маг. Защита', minWidth: '5.2em', type: 'number', statPath: 'base_stats.def_mag' },
					{ key: 'spd', label: 'Скор.', minWidth: '4em', type: 'number', step: 0.1, statPath: 'base_stats.spd' },
					{ key: 'init', label: 'Иниц.', minWidth: '4em', type: 'number', statPath: 'base_stats.init' },
					{ key: 'crit_chance', label: 'Крит. %', minWidth: '4.8em', type: 'number', step: 0.1, statPath: 'base_stats.crit_chance', tooltip: 'Шанс критического урона (%)' },
					{ key: 'crit_dmg', label: 'Крит. Урон %', minWidth: '5.5em', type: 'number', step: 0.1, statPath: 'base_stats.crit_dmg', tooltip: 'Процент критического урона (%)' }
				]
			},
			{
				id: 'converters',
				label: 'Скейлы характеристик (STR/END/AGI/INT)',
				themeClass: '__grp-converters',
				columns: [
					{ key: 'conv_str', attrKey: 'str', label: 'STR (Скейл)', minWidth: '10.5em', type: 'converter' },
					{ key: 'conv_end', attrKey: 'end', label: 'END (Скейл)', minWidth: '10.5em', type: 'converter' },
					{ key: 'conv_agi', attrKey: 'agi', label: 'AGI (Скейл)', minWidth: '10.5em', type: 'converter' },
					{ key: 'conv_int', attrKey: 'int', label: 'INT (Скейл)', minWidth: '10.5em', type: 'converter' }
				]
			},
			{
				id: 'progression',
				label: 'Очки за уровень (Progression)',
				themeClass: '__grp-progression',
				columns: [
					{ key: 'skill_points_per_level', label: 'Skill Points/ур.', minWidth: '7em', type: 'number' },
					{ key: 'spell_points_per_level', label: 'Spell Points/ур.', minWidth: '7em', type: 'number' }
				]
			}
		]
	}

	if (props.type === 'fractions') {
		return [
			{
				id: 'core',
				label: 'Основное',
				themeClass: '__grp-core',
				columns: [
					{ key: 'icon', label: 'Иконка', minWidth: '3.2em', type: 'icon' },
					{ key: 'name', label: 'Название', minWidth: '12em', type: 'text' },
					{ key: 'id', label: 'ID', minWidth: '9em', type: 'text' },
					{ key: 'type', label: 'Тип', minWidth: '8.5em', type: 'select' }
				]
			},
			{
				id: 'hierarchy',
				label: 'Иерархия фракций',
				themeClass: '__grp-hierarchy',
				columns: [
					{ key: 'parent_id', label: 'Головная фракция', minWidth: '11em', type: 'select' },
					{ key: 'leader', label: 'Лидер', minWidth: '9em', type: 'text' },
					{ key: 'reputation', label: 'Репутация', minWidth: '6em', type: 'number' }
				]
			}
		]
	}

	// Default fallback: Items
	return [
		{
			id: 'core',
			label: 'Основное',
			themeClass: '__grp-core',
			columns: [
				{ key: 'icon', label: 'Иконка', minWidth: '3.2em', type: 'icon' },
				{ key: 'name', label: 'Название', minWidth: '12em', type: 'text' },
				{ key: 'id', label: 'ID', minWidth: '9em', type: 'text' },
				{ key: 'type', label: 'Тип', minWidth: '8em', type: 'select' },
				{ key: 'rarity', label: 'Редкость', minWidth: '8em', type: 'select' }
			]
		},
		{
			id: 'equipment',
			label: 'Параметры экипировки',
			themeClass: '__grp-hierarchy',
			columns: [
				{ key: 'slot', label: 'Слот', minWidth: '8em', type: 'text' },
				{ key: 'lvl', label: 'Уровень', minWidth: '5em', type: 'number', min: 1 },
				{ key: 'price', label: 'Цена', minWidth: '5.5em', type: 'number', min: 0 }
			]
		},
		{
			id: 'stats',
			label: 'Бонусы характеристик',
			themeClass: '__grp-stats',
			columns: [
				{ key: 'hp', label: 'HP', minWidth: '4.5em', type: 'number', statPath: 'base_stats.hp' },
				{ key: 'mp', label: 'MP', minWidth: '4.5em', type: 'number', statPath: 'base_stats.mp' },
				{ key: 'atk_phys', label: 'Физ. Атака', minWidth: '5.2em', type: 'number', statPath: 'base_stats.atk_phys' },
				{ key: 'def_phys', label: 'Физ. Защита', minWidth: '5.2em', type: 'number', statPath: 'base_stats.def_phys' },
				{ key: 'atk_mag', label: 'Маг. Атака', minWidth: '5.2em', type: 'number', statPath: 'base_stats.atk_mag' },
				{ key: 'def_mag', label: 'Маг. Защита', minWidth: '5.2em', type: 'number', statPath: 'base_stats.def_mag' }
			]
		}
	]
})

// Flattened list of all available columns
const allColumns = computed(() => {
	const cols = []
	for (const grp of columnGroups.value) {
		for (const c of grp.columns) {
			cols.push(c)
		}
	}
	return cols
})

// Visible column count
const visibleColCount = computed(() => {
	return allColumns.value.filter((c) => !hiddenColKeys.value.has(c.key)).length
})

// Visible groups with filtered visible columns
const visibleGroups = computed(() => {
	return columnGroups.value
		.map((grp) => {
			const visibleCols = grp.columns.filter((c) => !hiddenColKeys.value.has(c.key))
			return {
				...grp,
				visibleColumns: visibleCols
			}
		})
		.filter((grp) => grp.visibleColumns.length > 0)
})

// Total colspan across all visible columns + index + actions
const totalColspan = computed(() => {
	let count = 2 // # and actions
	for (const grp of visibleGroups.value) {
		if (isGroupCollapsed(grp.id)) {
			count += 1
		} else {
			count += grp.visibleColumns.length
		}
	}
	return count
})

// Group collapse state
function isGroupCollapsed(groupId) {
	return collapsedGroupIds.value.has(groupId)
}

function toggleGroupCollapse(groupId) {
	if (collapsedGroupIds.value.has(groupId)) {
		collapsedGroupIds.value.delete(groupId)
	} else {
		collapsedGroupIds.value.add(groupId)
	}
}

// Column visibility controls
function toggleColumnVisibility(colKey, isVisible) {
	if (isVisible) {
		hiddenColKeys.value.delete(colKey)
	} else {
		hiddenColKeys.value.add(colKey)
	}
}

function isGroupAllVisible(grp) {
	return grp.columns.every((c) => !hiddenColKeys.value.has(c.key))
}

function toggleGroupColumns(grp, isVisible) {
	for (const col of grp.columns) {
		if (isVisible) {
			hiddenColKeys.value.delete(col.key)
		} else {
			hiddenColKeys.value.add(col.key)
		}
	}
}

function setColPreset(preset) {
	hiddenColKeys.value.clear()
	if (preset === 'stats') {
		for (const col of allColumns.value) {
			if (!['icon', 'name', 'hp', 'mp', 'atk_phys', 'def_phys', 'atk_mag', 'def_mag', 'spd', 'init'].includes(col.key)) {
				hiddenColKeys.value.add(col.key)
			}
		}
	} else if (preset === 'converters') {
		for (const col of allColumns.value) {
			if (!['icon', 'name', 'conv_str', 'conv_end', 'conv_agi', 'conv_int'].includes(col.key)) {
				hiddenColKeys.value.add(col.key)
			}
		}
	} else if (preset === 'compact') {
		for (const col of allColumns.value) {
			if (['converters', 'progression'].some((grpId) => {
				const grp = columnGroups.value.find((g) => g.id === grpId)
				return grp?.columns.some((c) => c.key === col.key)
			})) {
				hiddenColKeys.value.add(col.key)
			}
		}
	}
	isColMenuOpen.value = false
}

// Sticky Actions column state (default: false so it doesn't stick when table is shifted, toggleable via 📌)
const isActionsPinned = ref(false)
try {
	const savedPin = localStorage.getItem('dte_pin_actions')
	if (savedPin !== null) {
		isActionsPinned.value = savedPin === 'true'
	}
} catch (e) {
	// Ignore storage errors in test/headless environments
}

function togglePinActions() {
	isActionsPinned.value = !isActionsPinned.value
	try {
		localStorage.setItem('dte_pin_actions', isActionsPinned.value ? 'true' : 'false')
	} catch (e) {
		// Ignore storage errors
	}
}

// =========================================================================
// ROW HIERARCHY, FOLDING & PROCESSING
// =========================================================================

// Filter items by search query
const filteredItems = computed(() => {
	const query = (searchQuery.value || '').trim().toLowerCase()
	if (!query) return props.items || []

	return (props.items || []).filter((item) => {
		const name = (getDisplayName(item) || '').toLowerCase()
		const id = (item.id || '').toLowerCase()
		const cat = (item.category || item.type || '').toLowerCase()
		const family = (item.family || '').toLowerCase()
		const tags = Array.isArray(item.tags) ? item.tags.join(' ').toLowerCase() : ''
		return name.includes(query) || id.includes(query) || cat.includes(query) || family.includes(query) || tags.includes(query)
	})
})

// Build tree hierarchy structure
const processedRows = computed(() => {
	const items = filteredItems.value
	if (!items.length) return []

	// 1. Tree Hierarchy Mode
	if (groupingMode.value === 'tree' && hasHierarchy.value && !searchQuery.value) {
		return buildTreeRows(items)
	}

	// 2. Category Grouping Mode
	if (groupingMode.value === 'category') {
		return buildCategoryRows(items)
	}

	// 3. Family Grouping Mode
	if (groupingMode.value === 'family' && hasFamily.value) {
		return buildFamilyRows(items)
	}

	// 4. Flat Mode (sorted)
	return buildFlatRows(items)
})

function buildTreeRows(items) {
	const itemMap = new Map()
	const childrenMap = new Map()
	for (const it of items) {
		itemMap.set(it.id, it)
		childrenMap.set(it.id, [])
	}

	const roots = []
	for (const it of items) {
		if (it.parent_id && itemMap.has(it.parent_id)) {
			childrenMap.get(it.parent_id).push(it)
		} else {
			roots.push(it)
		}
	}

	const rows = []
	let indexCounter = 1

	function traverse(node, depth, isHiddenAncestor) {
		const children = childrenMap.get(node.id) || []
		const hasChildren = children.length > 0
		const isCollapsed = collapsedRowIds.value.has(node.id)

		rows.push({
			rowKey: 'tree-row-' + node.id,
			data: node,
			displayIndex: indexCounter++,
			depth,
			hasChildren,
			isChild: depth > 0,
			isHiddenByFold: isHiddenAncestor,
			isGroupDivider: false
		})

		const hideChildren = isHiddenAncestor || isCollapsed
		for (const child of children) {
			traverse(child, depth + 1, hideChildren)
		}
	}

	for (const root of roots) {
		traverse(root, 0, false)
	}

	return rows
}

function buildCategoryRows(items) {
	const groups = new Map()
	for (const it of items) {
		const cat = it.category || it.type || 'other'
		if (!groups.has(cat)) groups.set(cat, [])
		groups.get(cat).push(it)
	}

	const rows = []
	let indexCounter = 1

	for (const [catVal, catItems] of groups.entries()) {
		const isCollapsed = collapsedDividers.value.has('cat:' + catVal)
		rows.push({
			rowKey: 'div-cat-' + catVal,
			isGroupDivider: true,
			groupVal: 'cat:' + catVal,
			groupTitle: getCategoryLabel(catVal),
			groupIcon: getCategoryIcon(catVal),
			count: catItems.length
		})

		if (!isCollapsed) {
			for (const item of catItems) {
				rows.push({
					rowKey: 'cat-row-' + item.id,
					data: item,
					displayIndex: indexCounter++,
					depth: 0,
					hasChildren: false,
					isChild: false,
					isHiddenByFold: false,
					isGroupDivider: false
				})
			}
		}
	}

	return rows
}

function buildFamilyRows(items) {
	const groups = new Map()
	for (const it of items) {
		const fam = it.family || 'Без семейства'
		if (!groups.has(fam)) groups.set(fam, [])
		groups.get(fam).push(it)
	}

	const rows = []
	let indexCounter = 1

	for (const [famVal, famItems] of groups.entries()) {
		const isCollapsed = collapsedDividers.value.has('fam:' + famVal)
		rows.push({
			rowKey: 'div-fam-' + famVal,
			isGroupDivider: true,
			groupVal: 'fam:' + famVal,
			groupTitle: famVal,
			groupIcon: '👥',
			count: famItems.length
		})

		if (!isCollapsed) {
			for (const item of famItems) {
				rows.push({
					rowKey: 'fam-row-' + item.id,
					data: item,
					displayIndex: indexCounter++,
					depth: 0,
					hasChildren: false,
					isChild: false,
					isHiddenByFold: false,
					isGroupDivider: false
				})
			}
		}
	}

	return rows
}

function buildFlatRows(items) {
	const sorted = [...items]
	if (sortKey.value) {
		sorted.sort((a, b) => {
			let valA = getFieldValue(a, sortKey.value)
			let valB = getFieldValue(b, sortKey.value)

			if (typeof valA === 'number' && typeof valB === 'number') {
				return sortOrder.value === 'asc' ? valA - valB : valB - valA
			}

			valA = String(valA || '').toLowerCase()
			valB = String(valB || '').toLowerCase()
			return sortOrder.value === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
		})
	}

	return sorted.map((item, idx) => ({
		rowKey: 'flat-row-' + item.id,
		data: item,
		displayIndex: idx + 1,
		depth: 0,
		hasChildren: false,
		isChild: false,
		isHiddenByFold: false,
		isGroupDivider: false
	}))
}

// Folding methods
function isRowCollapsed(itemId) {
	return collapsedRowIds.value.has(itemId)
}

function toggleRowCollapse(itemId) {
	if (collapsedRowIds.value.has(itemId)) {
		collapsedRowIds.value.delete(itemId)
	} else {
		collapsedRowIds.value.add(itemId)
	}
}

function isDividerCollapsed(groupVal) {
	return collapsedDividers.value.has(groupVal)
}

function toggleGroupDivider(groupVal) {
	if (collapsedDividers.value.has(groupVal)) {
		collapsedDividers.value.delete(groupVal)
	} else {
		collapsedDividers.value.add(groupVal)
	}
}

function expandAllRows() {
	collapsedRowIds.value.clear()
	collapsedDividers.value.clear()
}

function collapseAllRows() {
	if (groupingMode.value === 'tree') {
		for (const it of props.items) {
			collapsedRowIds.value.add(it.id)
		}
	} else {
		for (const r of processedRows.value) {
			if (r.isGroupDivider) {
				collapsedDividers.value.add(r.groupVal)
			}
		}
	}
}

function toggleSort(key) {
	if (sortKey.value === key) {
		sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
	} else {
		sortKey.value = key
		sortOrder.value = 'asc'
	}
}

// =========================================================================
// DATA ACCESS & HELPERS
// =========================================================================
function getDisplayName(item) {
	if (!item) return ''
	if (item.name) return item.name
	const loc = props.localesData?.[props.activeLocale]?.[props.type]?.[item.id]?.name
	return loc || item.id
}

function getParentName(parentId) {
	if (!parentId) return ''
	const parent = props.items.find((it) => it.id === parentId)
	return parent ? getDisplayName(parent) : parentId
}

function getCategoryLabel(cat) {
	switch (cat) {
		case 'humanoid': return 'Гуманоиды'
		case 'demi-human': return 'Полулюди'
		case 'heteromorphic': return 'Гетероморфы'
		case 'warrior': return 'Воинские'
		case 'mage': return 'Магические'
		case 'rogue': return 'Ловкие'
		case 'special': return 'Особые'
		case 'faction': return 'Фракция'
		case 'guild': return 'Гильдия'
		case 'equipment': return 'Экипировка'
		case 'consumable': return 'Расходник'
		default: return cat || '—'
	}
}

function getCategoryIcon(cat) {
	switch (cat) {
		case 'humanoid': return '👤'
		case 'demi-human': return '🐺'
		case 'heteromorphic': return '💀'
		case 'warrior': return '⚔️'
		case 'mage': return '🔮'
		case 'rogue': return '🗡️'
		default: return '📁'
	}
}

function isEmoji(str) {
	if (!str || typeof str !== 'string') return true
	return !str.includes('/') && !str.includes('.')
}

function resolveIconPath(icon) {
	if (!icon) return ''
	if (icon.startsWith('http://') || icon.startsWith('https://')) return icon
	return icon.startsWith('/') ? icon : '/' + icon
}

function isPercentStat(key) {
	if (!key) return false
	const k = String(key).toLowerCase()
	return k.startsWith('res.') ||
		k === 'crit_chance' ||
		k === 'crit_dmg' ||
		k === 'crit_rate' ||
		k === 'crit_damage' ||
		k.includes('percent') ||
		k.includes('pct') ||
		k.includes('res')
}

// Available combat stats and resistances for converter scalings
const availableConverterStats = [
	{ key: 'hp', label: 'HP (Здоровье)', icon: '❤️', isPercent: false },
	{ key: 'mp', label: 'MP (Мана)', icon: '💧', isPercent: false },
	{ key: 'atk_phys', label: 'Физ. Атака', icon: '⚔️', isPercent: false },
	{ key: 'def_phys', label: 'Физ. Защита', icon: '🛡️', isPercent: false },
	{ key: 'atk_mag', label: 'Маг. Атака', icon: '🔮', isPercent: false },
	{ key: 'def_mag', label: 'Маг. Защита', icon: '✨', isPercent: false },
	{ key: 'spd', label: 'Скорость', icon: '👟', isPercent: false },
	{ key: 'init', label: 'Инициатива', icon: '⚡', isPercent: false },
	{ key: 'crit_chance', label: 'Шанс крит. урона (%)', icon: '🎯', isPercent: true },
	{ key: 'crit_dmg', label: 'Крит. урон (%)', icon: '💥', isPercent: true },
	{ key: 'res.physical', label: 'Физ. Сопротивление (%)', icon: '🛡️', isPercent: true },
	{ key: 'res.fire', label: 'Сопр. Огонь (%)', icon: '🔥', isPercent: true },
	{ key: 'res.cold', label: 'Сопр. Холод (%)', icon: '❄️', isPercent: true },
	{ key: 'res.lightning', label: 'Сопр. Молния (%)', icon: '⚡', isPercent: true },
	{ key: 'res.poison', label: 'Сопр. Яд (%)', icon: '🧪', isPercent: true },
	{ key: 'res.holy', label: 'Сопр. Свет (%)', icon: '☀️', isPercent: true },
	{ key: 'res.dark', label: 'Сопр. Тьма (%)', icon: '🌑', isPercent: true }
]

function getStatDisplayMeta(statKey) {
	const map = {
		hp: { label: 'HP', icon: '❤️', theme: '__hp', isPercent: false },
		mp: { label: 'MP', icon: '💧', theme: '__mp', isPercent: false },
		atk_phys: { label: 'Физ.Атк', icon: '⚔️', theme: '__atk_phys', isPercent: false },
		def_phys: { label: 'Физ.Защ', icon: '🛡️', theme: '__def_phys', isPercent: false },
		atk_mag: { label: 'Маг.Атк', icon: '🔮', theme: '__atk_mag', isPercent: false },
		def_mag: { label: 'Маг.Защ', icon: '✨', theme: '__def_mag', isPercent: false },
		spd: { label: 'Скор', icon: '👟', theme: '__spd', isPercent: false },
		init: { label: 'Иниц', icon: '⚡', theme: '__init', isPercent: false },
		crit_chance: { label: 'Крит.Шанс', icon: '🎯', theme: '__crit_chance', isPercent: true },
		crit_dmg: { label: 'Крит.Урон', icon: '💥', theme: '__crit_dmg', isPercent: true },
		'res.physical': { label: 'Физ.Сопр', icon: '🛡️', theme: '__res', isPercent: true },
		'res.fire': { label: 'Огонь', icon: '🔥', theme: '__res', isPercent: true },
		'res.cold': { label: 'Холод', icon: '❄️', theme: '__res', isPercent: true },
		'res.lightning': { label: 'Молния', icon: '⚡', theme: '__res', isPercent: true },
		'res.poison': { label: 'Яд', icon: '🧪', theme: '__res', isPercent: true },
		'res.holy': { label: 'Свет', icon: '☀️', theme: '__res', isPercent: true },
		'res.dark': { label: 'Тьма', icon: '🌑', theme: '__res', isPercent: true }
	}
	const isPct = isPercentStat(statKey)
	return map[statKey] || { label: statKey, icon: '📊', theme: '__generic', isPercent: isPct }
}

function parseConverterEntries(attrObj) {
	if (!attrObj || typeof attrObj !== 'object') return []
	const entries = []
	for (const [key, val] of Object.entries(attrObj)) {
		if (key === 'res' && typeof val === 'object' && val !== null) {
			for (const [resKey, resVal] of Object.entries(val)) {
				if (resVal !== undefined && resVal !== null && resVal !== 0) {
					entries.push({
						key: `res.${resKey}`,
						val: resVal,
						meta: getStatDisplayMeta(`res.${resKey}`)
					})
				}
			}
		} else if (typeof val === 'number' && val !== 0) {
			entries.push({
				key,
				val,
				meta: getStatDisplayMeta(key)
			})
		}
	}
	return entries
}

function getConverterScales(item, attrKey) {
	if (!item) return {}
	const ac = item.attribute_converters || item.converters
	if (!ac || typeof ac !== 'object') return {}
	return ac[attrKey] || {}
}

function getConverterEntries(item, attrKey) {
	const scales = getConverterScales(item, attrKey)
	return parseConverterEntries(scales)
}

function getConverterTooltip(item, attrKey) {
	const entries = getConverterEntries(item, attrKey)
	if (!entries.length) return `1 ${attrKey.toUpperCase()} не даёт бонусов (0 параметров). Кликните для настройки.`
	const parts = entries.map(e => `+${e.val}${e.meta.isPercent ? '%' : ''} ${e.meta.label}`)
	return `1 ${attrKey.toUpperCase()} даёт: ${parts.join(', ')} (клик для настройки)`
}

// Converter Modal state
const converterModal = ref({
	open: false,
	item: null,
	attrKey: 'str',
	entries: []
})
const newConverterStatKey = ref('crit_chance')
const newConverterStatVal = ref(0.5)

function onNewConverterStatKeyChange() {
	if (isPercentStat(newConverterStatKey.value)) {
		newConverterStatVal.value = 0.5
	} else if (newConverterStatKey.value === 'spd') {
		newConverterStatVal.value = 0.1
	} else {
		newConverterStatVal.value = 10
	}
}

function openConverterModal(item, attrKey) {
	const entries = getConverterEntries(item, attrKey)
	converterModal.value = {
		open: true,
		item,
		attrKey,
		entries: JSON.parse(JSON.stringify(entries))
	}
	newConverterStatKey.value = 'crit_chance'
	newConverterStatVal.value = 0.5
}

function closeConverterModal() {
	converterModal.value.open = false
	converterModal.value.item = null
}

function removeConverterEntry(idx) {
	converterModal.value.entries.splice(idx, 1)
}

function addConverterEntry() {
	if (!newConverterStatKey.value || newConverterStatVal.value === 0) return
	const existing = converterModal.value.entries.find(e => e.key === newConverterStatKey.value)
	if (existing) {
		existing.val = newConverterStatVal.value
	} else {
		converterModal.value.entries.push({
			key: newConverterStatKey.value,
			val: newConverterStatVal.value,
			meta: getStatDisplayMeta(newConverterStatKey.value)
		})
	}
}

function clearConverterEntries() {
	converterModal.value.entries = []
}

function applyConverterModal() {
	if (!converterModal.value.item) return
	const item = converterModal.value.item
	const attr = converterModal.value.attrKey

	if (!item.attribute_converters || typeof item.attribute_converters !== 'object') {
		item.attribute_converters = {}
	}

	const newObj = {}
	const resObj = {}
	let hasRes = false

	for (const entry of converterModal.value.entries) {
		const val = Number(entry.val) || 0
		if (entry.key.startsWith('res.')) {
			const resKey = entry.key.replace('res.', '')
			resObj[resKey] = val
			hasRes = true
		} else {
			newObj[entry.key] = val
		}
	}
	if (hasRes) {
		newObj.res = resObj
	}

	item.attribute_converters[attr] = newObj
	dirtyItemIds.value.add(item.id)
	emit('change', item, 'attribute_converters', item.attribute_converters)
	closeConverterModal()
}

function getFieldValue(item, key) {
	if (!item) return ''
	if (key.startsWith('conv_')) {
		const attr = key.replace('conv_', '')
		const entries = getConverterEntries(item, attr)
		return entries.length
	}
	if (['hp', 'mp', 'atk_phys', 'def_phys', 'atk_mag', 'def_mag', 'spd', 'init', 'crit_chance', 'crit_dmg'].includes(key)) {
		return item.base_stats?.[key] ?? (key === 'crit_chance' ? 5 : (key === 'crit_dmg' ? 50 : 0))
	}
	return item[key]
}

function getColValue(item, col) {
	if (col.type === 'converter') {
		const entries = getConverterEntries(item, col.attrKey)
		return entries.map(e => `+${e.val}${e.meta.isPercent ? '%' : ''} ${e.meta.label}`).join(', ')
	}
	if (col.statPath) {
		const parts = col.statPath.split('.')
		let curr = item
		for (const p of parts) {
			if (!curr) return ''
			curr = curr[p]
		}
		if (curr !== undefined) {
			return isPercentStat(col.key) ? `${curr}%` : curr
		}
		return isPercentStat(col.key) ? '0%' : '0'
	}
	return item[col.key]
}

function getSelectOptions(col, item) {
	if (col.key === 'category') {
		if (props.type === 'races') {
			return [
				{ value: 'humanoid', label: 'Гуманоиды (humanoid)' },
				{ value: 'demi-human', label: 'Полулюди (demi-human)' },
				{ value: 'heteromorphic', label: 'Гетероморфы (heteromorphic)' }
			]
		}
		if (props.type === 'classes') {
			return [
				{ value: 'warrior', label: 'Воинские (warrior)' },
				{ value: 'mage', label: 'Магические (mage)' },
				{ value: 'rogue', label: 'Ловкие (rogue)' },
				{ value: 'special', label: 'Особые (special)' }
			]
		}
	}

	if (col.key === 'parent_id') {
		const options = [{ value: '', label: '— Нет (Базовый предок) —' }]
		for (const it of props.items) {
			if (it.id !== item.id) {
				options.push({ value: it.id, label: `${getDisplayName(it)} (${it.id})` })
			}
		}
		return options
	}

	if (col.key === 'type') {
		if (props.type === 'fractions') {
			return [
				{ value: 'faction', label: 'Фракция' },
				{ value: 'guild', label: 'Гильдия' },
				{ value: 'kingdom', label: 'Королевство' },
				{ value: 'cult', label: 'Культ' }
			]
		}
		if (props.type === 'items') {
			return [
				{ value: 'equipment', label: 'Экипировка' },
				{ value: 'consumable', label: 'Расходник' },
				{ value: 'quest', label: 'Квестовый' },
				{ value: 'material', label: 'Материал' }
			]
		}
	}

	if (col.key === 'rarity') {
		return [
			{ value: 'common', label: 'Обычный' },
			{ value: 'uncommon', label: 'Необычный' },
			{ value: 'rare', label: 'Редкий' },
			{ value: 'epic', label: 'Эпический' },
			{ value: 'legendary', label: 'Легендарный' },
			{ value: 'relic', label: 'Реликвия' }
		]
	}

	return []
}

// =========================================================================
// CELL SELECTION & INLINE EDITING
// =========================================================================
function isCellSelected(itemId, colKey) {
	return selectedCell.value.itemId === itemId && selectedCell.value.colKey === colKey
}

function isCellEditing(itemId, colKey) {
	return editingCell.value.itemId === itemId && editingCell.value.colKey === colKey
}

function isItemDirty(itemId) {
	return dirtyItemIds.value.has(itemId)
}

const dirtyCount = computed(() => dirtyItemIds.value.size)

function onRowClick(item) {
	emit('select', item)
}

function onCellClick(itemId, colKey) {
	selectedCell.value = { itemId, colKey }
}

function onContainerClick(e) {
	if (!e.target.closest('.dte-td')) {
		selectedCell.value = { itemId: null, colKey: null }
	}
}

function startEditCell(item, col) {
	if (col.key === 'icon') {
		emit('select', item)
		return
	}
	if (col.type === 'converter') {
		openConverterModal(item, col.attrKey)
		return
	}
	editingCell.value = { itemId: item.id, colKey: col.key }

	let val = getColValue(item, col)
	if (col.type === 'number') {
		val = Number(val) || 0
	}
	editCellValue.value = val

	nextTick(() => {
		if (cellInputRef.value) {
			if (Array.isArray(cellInputRef.value)) {
				cellInputRef.value[0]?.focus?.()
				cellInputRef.value[0]?.select?.()
			} else {
				cellInputRef.value.focus?.()
				cellInputRef.value.select?.()
			}
		}
	})
}

function commitEditCell(item, col) {
	if (!editingCell.value.itemId) return

	const oldVal = getColValue(item, col)
	let newVal = editCellValue.value

	if (col.type === 'number') {
		newVal = Number(newVal) || 0
		if (col.min !== undefined && newVal < col.min) {
			newVal = col.min
		}
	}

	if (oldVal !== newVal) {
		// Apply change directly to entity
		if (col.statPath) {
			const parts = col.statPath.split('.')
			let curr = item
			for (let i = 0; i < parts.length - 1; i++) {
				if (!curr[parts[i]]) curr[parts[i]] = {}
				curr = curr[parts[i]]
			}
			curr[parts[parts.length - 1]] = newVal
		} else {
			item[col.key] = newVal
		}

		dirtyItemIds.value.add(item.id)
		emit('change', item, col.key, newVal)
	}

	editingCell.value = { itemId: null, colKey: null }
}

function cancelEditCell() {
	editingCell.value = { itemId: null, colKey: null }
}

function handleSaveBatch() {
	dirtyItemIds.value.clear()
	emit('saveBatch')
}
</script>

<style scoped>
/* ==========================================================================
   Spreadsheet Table Editor (Google Sheets style)
   Strictly 'em' layout according to AGENTS.md Rule 1.
   ========================================================================== */
.data-table-editor {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: #080c14;
	color: #e2e8f0;
	font-family: inherit;
	overflow: hidden;
	user-select: none;
}

/* --------------------------------------------------------------------------
   Toolbar
   -------------------------------------------------------------------------- */
.dte-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6em 1em;
	background: #0b1120;
	border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	gap: 0.8em;
	flex-shrink: 0;
}

.dte-toolbar-left,
.dte-toolbar-right {
	display: flex;
	align-items: center;
	gap: 0.6em;
	flex-wrap: wrap;
}

.dte-search-box {
	display: flex;
	align-items: center;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.25em 0.6em;
	width: 18em;
	gap: 0.4em;
}

.dte-search-icon {
	font-size: 0.85em;
	opacity: 0.7;
}

.dte-search-input {
	background: transparent;
	border: none;
	color: #fff;
	font-size: 0.85em;
	outline: none;
	width: 100%;
}

.dte-btn-clear {
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.8em;
	padding: 0;
}

.dte-grouping-selector {
	display: flex;
	align-items: center;
	background: rgba(0, 0, 0, 0.3);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.15em;
	gap: 0.2em;
}

.dte-label {
	font-size: 0.75em;
	color: #94a3b8;
	margin-left: 0.4em;
	margin-right: 0.2em;
}

.dte-mode-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.75em;
	font-weight: 600;
	padding: 0.3em 0.6em;
	border-radius: 0.3em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.dte-mode-btn:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.08);
}

.dte-mode-btn.__active {
	background: #2563eb;
	color: #fff;
}

.dte-fold-actions {
	display: flex;
	gap: 0.3em;
}

.dte-small-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	font-size: 0.75em;
	padding: 0.3em 0.6em;
	border-radius: 0.35em;
	cursor: pointer;
	transition: background 0.15s;
}

.dte-small-btn:hover {
	background: rgba(255, 255, 255, 0.12);
	color: #fff;
}

.dte-toolbar-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	font-size: 0.8em;
	font-weight: 600;
	padding: 0.4em 0.8em;
	border-radius: 0.4em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.dte-toolbar-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.dte-toolbar-btn.__primary {
	background: #16a34a;
	border-color: #22c55e;
	color: #fff;
}

.dte-toolbar-btn.__primary:hover {
	background: #15803d;
}

.dte-toolbar-btn.__save {
	background: #1e293b;
	border-color: rgba(255, 255, 255, 0.2);
}

.dte-toolbar-btn.__save.__dirty {
	background: #f59e0b;
	border-color: #fbbf24;
	color: #000;
	font-weight: 700;
	animation: pulseDirty 2s infinite ease-in-out;
}

@keyframes pulseDirty {
	0%, 100% { transform: scale(1); }
	50% { transform: scale(1.03); }
}

/* --------------------------------------------------------------------------
   Columns Visibility Dropdown
   -------------------------------------------------------------------------- */
.dte-dropdown-wrap {
	position: relative;
}

.dte-col-dropdown {
	position: absolute;
	top: 120%;
	right: 0;
	width: 22em;
	max-height: 30em;
	overflow-y: auto;
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.5em;
	box-shadow: 0 0.8em 2em rgba(0, 0, 0, 0.8);
	z-index: 50;
	padding: 0.8em;
}

.dte-col-dropdown-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	padding-bottom: 0.5em;
	margin-bottom: 0.6em;
	font-size: 0.85em;
	font-weight: 600;
	color: #fff;
}

.dte-col-presets {
	display: flex;
	gap: 0.4em;
}

.dte-preset-link {
	background: none;
	border: none;
	color: #38bdf8;
	font-size: 0.8em;
	cursor: pointer;
	text-decoration: underline;
}

.dte-col-group-section {
	margin-bottom: 0.8em;
}

.dte-col-group-title {
	font-size: 0.8em;
	color: #94a3b8;
	margin-bottom: 0.3em;
}

.dte-col-items {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.3em 0.5em;
	padding-left: 0.5em;
}

.dte-col-check-label,
.dte-col-check-item {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.78em;
	color: #cbd5e1;
	cursor: pointer;
}

/* --------------------------------------------------------------------------
   Table & Grid
   -------------------------------------------------------------------------- */
.dte-table-container {
	flex: 1;
	overflow: auto;
	position: relative;
	background: #080c14;
}

.dte-table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.82em;
	text-align: left;
	table-layout: auto;
}

/* Super Header */
.dte-super-header-row {
	position: sticky;
	top: 0;
	z-index: 20;
	background: #000000;
}

.dte-super-th {
	background: #000000;
	color: #ffffff;
	font-weight: 700;
	font-size: 0.82em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	padding: 0.45em 0.6em;
	border-right: 1px solid rgba(255, 255, 255, 0.15);
	border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	text-align: center;
	white-space: nowrap;
}

.dte-super-th-inner {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.4em;
}

.dte-group-collapse-btn {
	background: rgba(255, 255, 255, 0.15);
	border: 1px solid rgba(255, 255, 255, 0.25);
	color: #fff;
	font-size: 0.75em;
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
	cursor: pointer;
	line-height: 1;
	transition: background 0.15s;
}

.dte-group-collapse-btn:hover {
	background: rgba(255, 255, 255, 0.3);
}

.dte-group-name {
	font-weight: 700;
}

.dte-group-badge {
	font-size: 0.75em;
	color: #94a3b8;
}

/* Sub Header */
.dte-sub-header-row {
	position: sticky;
	top: 2.1em; /* Position under super header */
	z-index: 19;
	background: #090d16;
}

.dte-sub-th {
	background: #090d16;
	color: #cbd5e1;
	font-weight: 600;
	font-size: 0.8em;
	padding: 0.4em 0.6em;
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	border-bottom: 1px solid rgba(255, 255, 255, 0.25);
	white-space: nowrap;
}

.dte-sub-th.__sortable {
	cursor: pointer;
}

.dte-sub-th.__sortable:hover {
	background: #151d2f;
	color: #fff;
}

.dte-sub-th-inner {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.3em;
}

.dte-sort-icon {
	color: #38bdf8;
	font-size: 0.7em;
}

/* Sticky Columns */
.__sticky-left {
	position: sticky !important;
	left: 0 !important;
	z-index: 25;
	background: #090d16;
}

.__sticky-right {
	position: sticky !important;
	right: 0 !important;
	z-index: 25;
	background: #090d16;
	box-shadow: -0.25em 0 0.5em rgba(0, 0, 0, 0.4);
}

.dte-super-th.__sticky-left,
.dte-super-th.__sticky-right {
	z-index: 35 !important;
	background: #000000 !important;
}

.dte-td.__sticky-left,
.dte-td.__sticky-right {
	position: sticky !important;
	z-index: 22 !important;
	background: #090d16 !important;
}

.dte-td.__sticky-left {
	left: 0 !important;
}

.dte-td.__sticky-right {
	right: 0 !important;
	box-shadow: -0.25em 0 0.5em rgba(0, 0, 0, 0.4);
}

.dte-data-row:hover .dte-td.__sticky-left,
.dte-data-row:hover .dte-td.__sticky-right {
	background: #151d2f !important;
}

.dte-data-row.__selected .dte-td.__sticky-left,
.dte-data-row.__selected .dte-td.__sticky-right {
	background: #122144 !important;
}

.__index-col {
	width: 2.8em;
	min-width: 2.8em;
	text-align: center;
	border-right: 1px solid rgba(255, 255, 255, 0.2);
}

.__actions-col {
	width: 5.5em;
	min-width: 5.5em;
	text-align: center;
	border-left: 1px solid rgba(255, 255, 255, 0.2);
}

.dte-actions-th-inner {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.35em;
}

.dte-pin-col-btn {
	background: transparent;
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #94a3b8;
	font-size: 0.85em;
	padding: 0.1em 0.3em;
	border-radius: 0.25em;
	cursor: pointer;
	line-height: 1;
	transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.dte-pin-col-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #ffffff;
	border-color: rgba(255, 255, 255, 0.4);
}

.dte-pin-col-btn.__active {
	background: rgba(59, 130, 246, 0.25);
	border-color: #3b82f6;
	color: #60a5fa;
}

/* Group Themes for Distinct Column Coloring */
.__grp-stats {
	background-color: rgba(59, 130, 246, 0.08) !important;
	border-color: rgba(59, 130, 246, 0.2) !important;
}

.dte-super-th.__grp-stats {
	background-color: #0b1c3d !important;
	color: #60a5fa !important;
}

.dte-sub-th.__grp-stats {
	background-color: #0e1e3e !important;
	color: #93c5fd !important;
}

.__grp-converters {
	background-color: rgba(168, 85, 247, 0.06) !important;
}

.dte-super-th.__grp-converters {
	background-color: #24123d !important;
	color: #c084fc !important;
}

.__grp-progression {
	background-color: rgba(234, 179, 8, 0.06) !important;
}

.dte-super-th.__grp-progression {
	background-color: #302409 !important;
	color: #fde047 !important;
}

/* --------------------------------------------------------------------------
   Table Body & Rows
   -------------------------------------------------------------------------- */
.dte-data-row {
	border-bottom: 1px solid rgba(255, 255, 255, 0.07);
	transition: background 0.1s ease;
	cursor: pointer;
}

.dte-data-row:hover {
	background: rgba(255, 255, 255, 0.05);
}

.dte-data-row.__selected {
	background: rgba(37, 99, 235, 0.18) !important;
}

.dte-data-row.__selected .__sticky-left,
.dte-data-row.__selected .__sticky-right {
	background: #122144 !important;
}

.dte-data-row.__dirty {
	border-left: 0.2em solid #f59e0b;
}

/* Data Cells */
.dte-td {
	padding: 0.35em 0.6em;
	border-right: 1px solid rgba(255, 255, 255, 0.07);
	white-space: nowrap;
	font-size: 0.85em;
	color: #e2e8f0;
}

.dte-td.__active_cell {
	position: relative;
	outline: 2px solid #3b82f6;
	outline-offset: -0.12em;
	background: rgba(59, 130, 246, 0.15) !important;
}

/* Active Cell Bottom-Right Square Dot (Google Sheets Style) */
.dte-td.__active_cell::after {
	content: '';
	position: absolute;
	right: 0;
	bottom: 0;
	width: 0.35em;
	height: 0.35em;
	background: #3b82f6;
	pointer-events: none;
}

/* Collapsed Column Widths & Layout */
.dte-super-th.__collapsed,
.dte-sub-th.__collapsed-placeholder,
.dte-td.__collapsed-cell {
	width: 2.2em !important;
	min-width: 2.2em !important;
	max-width: 2.2em !important;
	padding: 0.35em 0.1em !important;
	text-align: center !important;
	box-sizing: border-box !important;
	overflow: hidden !important;
	white-space: nowrap !important;
}

.dte-super-th-inner.__collapsed_inner {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
}

.dte-td.__collapsed-cell {
	color: #64748b;
	background: rgba(0, 0, 0, 0.2);
}

.dte-row-index {
	font-size: 0.78em;
	color: #64748b;
}

/* --------------------------------------------------------------------------
   Category Column User Styling (matching screenshot)
   -------------------------------------------------------------------------- */
.dte-cat-cell {
	display: flex;
	align-items: center;
}

.dte-cat-badge {
	font-size: 0.78em;
	font-weight: 700;
	padding: 0.2em 0.6em;
	border-radius: 0.3em;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	display: inline-block;
}

.dte-cat-badge.__cat-humanoid {
	background: #2563eb;
	color: #ffffff;
	box-shadow: 0 0.1em 0.4em rgba(37, 99, 235, 0.4);
}

.dte-cat-badge.__cat-demi-human {
	background: #16a34a;
	color: #ffffff;
	box-shadow: 0 0.1em 0.4em rgba(22, 163, 74, 0.4);
}

.dte-cat-badge.__cat-heteromorphic {
	background: #be185d;
	color: #ffffff;
	box-shadow: 0 0.1em 0.4em rgba(190, 24, 93, 0.4);
}

/* Highlight cell backgrounds slightly for categories */
.dte-td.__cat-humanoid {
	background: rgba(37, 99, 235, 0.06);
}

.dte-td.__cat-demi-human {
	background: rgba(22, 163, 74, 0.06);
}

.dte-td.__cat-heteromorphic {
	background: rgba(190, 24, 93, 0.06);
}

/* --------------------------------------------------------------------------
   Special Cells (Icon, Name, Numbers, Parents)
   -------------------------------------------------------------------------- */
.dte-icon-cell {
	display: flex;
	align-items: center;
	justify-content: center;
}

.dte-emoji-icon {
	font-size: 1.2em;
}

.dte-img-icon {
	width: 1.5em;
	height: 1.5em;
	object-fit: contain;
	border-radius: 0.2em;
}

.dte-name-cell {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.dte-tree-branch {
	color: #64748b;
	font-size: 0.9em;
	margin-right: 0.2em;
}

.dte-row-fold-btn {
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #fff;
	font-size: 0.7em;
	padding: 0.05em 0.25em;
	border-radius: 0.2em;
	cursor: pointer;
	line-height: 1;
}

.dte-row-fold-spacer {
	width: 1em;
	display: inline-block;
}

.dte-name-text {
	font-weight: 600;
	color: #f8fafc;
}

.dte-parent-badge {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	color: #94a3b8;
}

.dte-empty-dim {
	color: #475569;
}

.dte-num-cell {
	text-align: right;
	font-variant-numeric: tabular-nums;
	font-weight: 500;
}

.dte-actions-wrap {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.3em;
}

.dte-action-btn {
	background: rgba(255, 255, 255, 0.08);
	border: none;
	padding: 0.2em 0.4em;
	border-radius: 0.25em;
	cursor: pointer;
	font-size: 0.78em;
	transition: background 0.15s;
}

.dte-action-btn:hover {
	background: rgba(255, 255, 255, 0.2);
}

/* --------------------------------------------------------------------------
   Divider Rows (Category & Family Grouping)
   -------------------------------------------------------------------------- */
.dte-divider-row {
	background: #0f172a;
	border-top: 1px solid rgba(255, 255, 255, 0.15);
	border-bottom: 1px solid rgba(255, 255, 255, 0.15);
	cursor: pointer;
}

.dte-divider-row:hover {
	background: #1e293b;
}

.dte-divider-td {
	padding: 0.4em 0.8em;
}

.dte-divider-content {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.dte-divider-toggle-btn {
	background: none;
	border: none;
	color: #94a3b8;
	font-size: 0.75em;
	cursor: pointer;
}

.dte-divider-title {
	font-weight: 700;
	font-size: 0.85em;
	color: #f1f5f9;
}

.dte-divider-count {
	font-size: 0.78em;
	color: #64748b;
}

/* --------------------------------------------------------------------------
   Inline Cell Inputs
   -------------------------------------------------------------------------- */
.dte-inline-input,
.dte-inline-select {
	background: #020617;
	border: 1px solid #38bdf8;
	color: #fff;
	font-family: inherit;
	font-size: 0.9em;
	padding: 0.15em 0.35em;
	border-radius: 0.2em;
	width: 100%;
	outline: none;
	box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.3);
}

.dte-inline-input.__number {
	text-align: right;
}

/* Empty State */
.dte-empty-row {
	text-align: center;
}

.dte-empty-td {
	padding: 3em 1em;
}

.dte-empty-notice {
	color: #64748b;
	font-size: 1em;
}

/* --------------------------------------------------------------------------
   Attribute Converter Cells & Multi-Stat Pills
   -------------------------------------------------------------------------- */
.dte-conv-cell {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.35em;
	min-height: 1.5em;
}

.dte-conv-pills {
	display: flex;
	flex-wrap: wrap;
	gap: 0.25em;
	align-items: center;
	max-width: 16em;
}

.dte-conv-pill {
	font-size: 0.72em;
	font-weight: 600;
	padding: 0.12em 0.35em;
	border-radius: 0.25em;
	border: 1px solid rgba(255, 255, 255, 0.15);
	line-height: 1.2;
	white-space: nowrap;
}

.dte-conv-pill.__hp {
	background: rgba(239, 68, 68, 0.2);
	color: #fca5a5;
	border-color: rgba(239, 68, 68, 0.4);
}

.dte-conv-pill.__mp {
	background: rgba(59, 130, 246, 0.2);
	color: #93c5fd;
	border-color: rgba(59, 130, 246, 0.4);
}

.dte-conv-pill.__atk_phys {
	background: rgba(249, 115, 22, 0.2);
	color: #fdba74;
	border-color: rgba(249, 115, 22, 0.4);
}

.dte-conv-pill.__def_phys {
	background: rgba(100, 116, 139, 0.25);
	color: #cbd5e1;
	border-color: rgba(148, 163, 184, 0.4);
}

.dte-conv-pill.__atk_mag {
	background: rgba(168, 85, 247, 0.2);
	color: #d8b4fe;
	border-color: rgba(168, 85, 247, 0.4);
}

.dte-conv-pill.__def_mag {
	background: rgba(236, 72, 153, 0.2);
	color: #f472b6;
	border-color: rgba(236, 72, 153, 0.4);
}

.dte-conv-pill.__spd {
	background: rgba(34, 197, 94, 0.2);
	color: #86efac;
	border-color: rgba(34, 197, 94, 0.4);
}

.dte-conv-pill.__init {
	background: rgba(234, 179, 8, 0.2);
	color: #fde047;
	border-color: rgba(234, 179, 8, 0.4);
}

.dte-conv-pill.__crit_chance {
	background: rgba(245, 158, 11, 0.25);
	color: #fbbf24;
	border-color: rgba(245, 158, 11, 0.5);
}

.dte-conv-pill.__crit_dmg {
	background: rgba(239, 68, 68, 0.25);
	color: #fca5a5;
	border-color: rgba(239, 68, 68, 0.5);
}

.dte-conv-pill.__res {
	background: rgba(20, 184, 166, 0.2);
	color: #5eead4;
	border-color: rgba(20, 184, 166, 0.4);
}

.dte-conv-pill.__generic {
	background: rgba(148, 163, 184, 0.15);
	color: #cbd5e1;
	border-color: rgba(148, 163, 184, 0.3);
}

.dte-conv-pct-suffix {
	font-size: 0.85em;
	font-weight: 700;
	color: #94a3b8;
	margin-left: -0.1em;
}

.dte-conv-edit-btn {
	background: rgba(255, 255, 255, 0.08);
	border: none;
	font-size: 0.72em;
	padding: 0.15em 0.3em;
	border-radius: 0.2em;
	cursor: pointer;
	opacity: 0.6;
	transition: opacity 0.15s, background 0.15s;
}

.dte-conv-edit-btn:hover {
	opacity: 1;
	background: rgba(255, 255, 255, 0.2);
}

/* --------------------------------------------------------------------------
   Converter Editor Modal Dialog (0 to many parameters)
   -------------------------------------------------------------------------- */
.dte-modal-overlay {
	position: absolute;
	inset: 0;
	z-index: 100;
	background: rgba(0, 0, 0, 0.65);
	backdrop-filter: blur(0.2em);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 1.5em;
}

.dte-modal-card {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.6em;
	width: 34em;
	max-width: 95%;
	max-height: 85%;
	display: flex;
	flex-direction: column;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.8);
	overflow: hidden;
}

.dte-modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.2em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	background: #1e293b;
	border-radius: 0.6em 0.6em 0 0;
}

.dte-modal-title-box {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.dte-modal-icon {
	font-size: 1.4em;
}

.dte-modal-title {
	font-size: 1.05em;
	font-weight: 700;
	color: #f8fafc;
	margin: 0;
}

.dte-modal-subtitle {
	font-size: 0.78em;
	color: #94a3b8;
}

.dte-modal-close-btn {
	background: none;
	border: none;
	color: #94a3b8;
	font-size: 1.1em;
	cursor: pointer;
	padding: 0.2em 0.4em;
	border-radius: 0.2em;
	transition: color 0.15s;
}

.dte-modal-close-btn:hover {
	color: #ef4444;
}

.dte-modal-body {
	padding: 1em 1.2em;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	flex: 1;
}

.dte-modal-desc {
	font-size: 0.85em;
	color: #cbd5e1;
	line-height: 1.4;
}

.dte-conv-modal-list {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	max-height: 14em;
	overflow-y: auto;
	padding-right: 0.3em;
}

.dte-conv-modal-empty {
	padding: 1.2em;
	text-align: center;
	color: #64748b;
	font-size: 0.85em;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 0.3em;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.dte-conv-modal-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8em;
	padding: 0.4em 0.6em;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.3em;
}

.dte-conv-row-info {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.85em;
	flex: 1;
	min-width: 0;
}

.dte-conv-row-icon {
	font-size: 1.1em;
}

.dte-conv-row-name {
	font-weight: 600;
	color: #f1f5f9;
	white-space: nowrap;
}

.dte-conv-row-key {
	font-size: 0.75em;
	color: #64748b;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.dte-conv-row-val {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.dte-conv-plus {
	font-size: 0.9em;
	font-weight: 700;
	color: #22c55e;
}

.dte-inline-input.__modal-num {
	width: 5em !important;
	text-align: right;
}

.dte-conv-del-btn {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.3);
	border-radius: 0.25em;
	color: #fca5a5;
	cursor: pointer;
	padding: 0.2em 0.4em;
	font-size: 0.85em;
	transition: background 0.15s;
}

.dte-conv-del-btn:hover {
	background: rgba(239, 68, 68, 0.35);
}

.dte-conv-add-section {
	margin-top: 0.4em;
	padding-top: 0.8em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.dte-conv-add-title {
	font-size: 0.8em;
	font-weight: 600;
	color: #94a3b8;
}

.dte-conv-add-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.dte-inline-select.__stat-sel {
	flex: 1;
	min-width: 10em;
}

.dte-toolbar-btn.__add-param-btn {
	padding: 0.25em 0.7em !important;
	font-size: 0.85em !important;
}

.dte-modal-footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.2em;
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	background: #0b1120;
	border-radius: 0 0 0.6em 0.6em;
}

.dte-modal-footer-right {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.dte-small-btn.__danger {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.3);
	color: #fca5a5;
	font-size: 0.75em;
	padding: 0.3em 0.6em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: background 0.15s;
}

.dte-small-btn.__danger:hover {
	background: rgba(239, 68, 68, 0.3);
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
