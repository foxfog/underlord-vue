<template>
	<div class="char-rig-equip-panel" :class="{ '__is-wide': isWideSidebar }">
		<!-- HEADER & GLOBAL ACTIONS -->
		<div class="equip-summary-card">
			<div class="esc-header">
				<div class="esc-title-box">
					<span class="esc-icon">👗</span>
					<div>
						<div class="esc-title">Гардероб и Экипировка</div>
						<div class="esc-sub">
							В гардеробе: <strong>{{ characterEquipment.length }}</strong> • На кукле:
							<strong>{{ activeEquippedCount }}</strong>
						</div>
					</div>
				</div>

				<div class="esc-actions">
					<button
						type="button"
						class="btn-studio-action __toggle-width"
						:class="{ __active: isWideSidebar }"
						:title="isWideSidebar ? 'Свернуть сайдбар к компактному размеру (25em)' : 'Развернуть сайдбар для удобной работы в 2 колонки (48em)'"
						@click="emit('toggle-sidebar-width')"
					>
						<span>{{ isWideSidebar ? '📱' : '↔️' }}</span>
						<span>{{ isWideSidebar ? 'Компактный' : '2 колонки' }}</span>
					</button>
					<button
						type="button"
						class="btn-studio-action __toggle-all"
						title="Надеть все предметы на персонажа для предпросмотра"
						@click="emit('set-all-equipped', true)"
					>
						<span>👁️</span>
						<span>Одеть всё</span>
					</button>
					<button
						type="button"
						class="btn-studio-action __strip-all"
						title="Снять все предметы (оставить персонажа голышом)"
						@click="emit('set-all-equipped', false)"
					>
						<span>🚫</span>
						<span>Раздеть</span>
					</button>
					<button
						type="button"
						class="btn-studio-action __save-equip"
						title="Сохранить файл characters/[id]/equipment.json"
						@click="emit('save-equipment')"
					>
						<span>💾</span>
						<span>Сохранить</span>
					</button>
				</div>
			</div>
		</div>

		<!-- SEARCH & FILTERS -->
		<div class="equip-filters-card">
			<!-- Search bar -->
			<div class="equip-search-box">
				<span class="search-icon">🔍</span>
				<input
					v-model="searchQuery"
					type="text"
					class="equip-search-input"
					placeholder="Поиск по названию или ID предмета..."
				/>
				<button
					v-if="searchQuery"
					type="button"
					class="search-clear-btn"
					title="Очистить поиск"
					@click="searchQuery = ''"
				>
					✕
				</button>
			</div>

			<!-- Slot / Body Part Category Chips -->
			<div class="slot-categories-pills">
				<button
					v-for="cat in slotCategories"
					:key="cat.id"
					type="button"
					class="slot-category-btn"
					:class="{ __active: selectedSlotCategory === cat.id }"
					@click="selectedSlotCategory = cat.id"
				>
					<span class="sc-icon">{{ cat.icon }}</span>
					<span class="sc-label">{{ cat.label }}</span>
					<span v-if="getCategoryItemCount(cat.id)" class="sc-count">
						{{ getCategoryItemCount(cat.id) }}
					</span>
				</button>
			</div>

			<!-- Origin Filters & Add Custom Button -->
			<div class="equip-subfilters-row">
				<div class="origin-filter-tabs">
					<button
						type="button"
						class="origin-tab-btn"
						:class="{ __active: originFilter === 'all' }"
						@click="originFilter = 'all'"
					>
						Вся база ({{ allMergedItems.length }})
					</button>
					<button
						type="button"
						class="origin-tab-btn"
						:class="{ __active: originFilter === 'configured' }"
						@click="originFilter = 'configured'"
					>
						В гардеробе ({{ characterEquipment.length }})
					</button>
					<button
						type="button"
						class="origin-tab-btn"
						:class="{ __active: originFilter === 'equipped' }"
						@click="originFilter = 'equipped'"
					>
						На кукле ({{ activeEquippedCount }})
					</button>
				</div>

				<button
					type="button"
					class="btn-add-custom-item"
					title="Добавить новый кастомный предмет одежды по ID"
					@click="showCustomItemInput = !showCustomItemInput"
				>
					<span>➕</span>
					<span>Новый ID</span>
				</button>
			</div>

			<!-- Inline Prompt for Custom Item ID -->
			<Transition name="fade">
				<div v-if="showCustomItemInput" class="custom-item-prompt-bar">
					<input
						v-model="newCustomItemId"
						type="text"
						class="custom-item-input"
						placeholder="ID предмета (например: cape_dark)..."
						@keyup.enter="handleCreateCustomItem"
					/>
					<button
						type="button"
						class="custom-item-submit-btn"
						:disabled="!newCustomItemId.trim()"
						@click="handleCreateCustomItem"
					>
						Добавить
					</button>
					<button
						type="button"
						class="custom-item-cancel-btn"
						@click="showCustomItemInput = false"
					>
						✕
					</button>
				</div>
			</Transition>
		</div>

		<!-- TWO-COLUMN WORKSPACE: ITEMS LIST (LEFT) & ITEM INSPECTOR / PARTS BUILDER (RIGHT) -->
		<div class="equip-two-col-layout">
			<!-- LEFT: ITEMS LIST -->
			<div class="equip-items-list-col">
				<div class="items-list-scroll">
					<div v-if="filteredItems.length > 0" class="items-list-container">
						<div
							v-for="item in filteredItems"
							:key="item.id"
							class="item-card"
							:class="{
								__selected: selectedEquipmentId === item.id,
								__is_configured: item.isConfigured,
								__is_equipped: isItemEquipped(item.id)
							}"
							@click="emit('select-equipment', item.id)"
						>
							<!-- Left Icon / Sprite -->
							<div class="item-icon-box">
								<img
									v-if="item.sprite"
									:src="resolveItemIconPath(item.sprite)"
									class="item-icon-img"
									alt=""
									@error="(e) => (e.target.style.display = 'none')"
								/>
								<span v-else class="item-icon-fallback">
									{{ getSlotFallbackIcon(item.slot) }}
								</span>
							</div>

							<!-- Center Info -->
							<div class="item-info-box">
								<div class="item-title-row">
									<span class="item-name">{{ item.name || item.id }}</span>
									<span v-if="item.rarity" class="item-rarity-badge" :class="`__${item.rarity}`">
										{{ item.rarity }}
									</span>
								</div>

								<div class="item-meta-row">
									<span class="item-id-pill">{{ item.id }}</span>
									<span class="item-slot-pill">{{ formatSlotPill(item.slot) }}</span>
								</div>

								<!-- Status Badge -->
								<div class="item-status-row">
									<span v-if="item.isConfigured" class="status-badge __configured">
										✔ Настроено: {{ item.partsCount }} {{ getPartsPlural(item.partsCount) }}
									</span>
									<span v-else class="status-badge __not-configured">
										Не в гардеробе
									</span>
								</div>
							</div>

							<!-- Right Actions (Eye toggle, Add, Remove) -->
							<div class="item-card-actions" @click.stop>
								<!-- Eye toggle preview on canvas -->
								<button
									v-if="item.isConfigured"
									type="button"
									class="item-action-eye-btn"
									:class="{ __active: isItemEquipped(item.id) }"
									:title="isItemEquipped(item.id) ? 'Снять предмет с куклы' : 'Надеть предмет на куклу'"
									@click="emit('toggle-equip', item.id)"
								>
									{{ isItemEquipped(item.id) ? '👁️' : '🚫' }}
								</button>

								<!-- Add to character if not configured -->
								<button
									v-if="!item.isConfigured"
									type="button"
									class="item-action-add-btn"
									title="Добавить предмет в гардероб персонажа"
									@click="emit('add-from-catalog', item)"
								>
									➕ В гардероб
								</button>

								<!-- Remove if configured -->
								<button
									v-else
									type="button"
									class="item-action-del-btn"
									title="Удалить предмет из гардероба"
									@click="emit('remove-equipment', item.id)"
								>
									🗑️
								</button>
							</div>
						</div>
					</div>

					<!-- Empty state -->
					<div v-else class="equip-empty-msg">
						<span class="empty-icon">🔎</span>
						<div class="empty-text">Предметы не найдены</div>
						<div class="empty-sub">
							Попробуйте изменить поисковый запрос или выбрать другую категорию
						</div>
					</div>
				</div>
			</div>

			<!-- RIGHT: ITEM INSPECTOR & PARTS BUILDER -->
			<div class="equip-inspector-col">
				<div v-if="selectedItemConfig" class="inspector-card">
					<!-- Inspector Header -->
					<div class="insp-header">
						<div class="insp-title-box">
							<span class="insp-icon">{{ getSlotFallbackIcon(selectedCatalogDef?.slot) }}</span>
							<div>
								<div class="insp-name">{{ selectedCatalogDef?.name || selectedItemConfig.id }}</div>
								<div class="insp-id">id: <code>{{ selectedItemConfig.id }}</code></div>
							</div>
						</div>

						<div class="insp-header-actions">
							<!-- Quick Preview Button -->
							<button
								type="button"
								class="insp-btn-preview"
								:class="{ __active: isItemEquipped(selectedItemConfig.id) }"
								@click="emit('toggle-equip', selectedItemConfig.id)"
							>
								<span>{{ isItemEquipped(selectedItemConfig.id) ? '👁️ Надет' : '🚫 Снят' }}</span>
							</button>

							<!-- Delete Item Button -->
							<button
								type="button"
								class="insp-btn-delete"
								title="Удалить предмет из гардероба"
								@click="emit('remove-equipment', selectedItemConfig.id)"
							>
								🗑️
							</button>
						</div>
					</div>

					<!-- Inspector Item Global Properties (Z-Index) -->
					<div class="insp-props-bar">
						<div class="prop-group">
							<label class="prop-label" title="Базовый Z-Index предмета (порядок наложения относительно тела)">
								Базовый Z-Index предмета:
							</label>
							<div class="stepper-box">
								<button
									type="button"
									class="step-btn"
									@click="adjustItemZIndex(-1)"
								>
									-1
								</button>
								<input
									type="number"
									class="step-input"
									:value="selectedItemConfig.zindex ?? 1"
									@change="setItemZIndex($event.target.value)"
								/>
								<button
									type="button"
									class="step-btn"
									@click="adjustItemZIndex(1)"
								>
									+1
								</button>
							</div>
							<span class="prop-hint">(1 = поверх тела, -1 = позади)</span>
						</div>

						<button
							type="button"
							class="btn-add-part"
							title="Добавить новый составной слой спрайта для этого предмета"
							@click="emit('add-part', selectedItemConfig.id, 'body')"
						>
							<span>➕</span>
							<span>Добавить слой (часть)</span>
						</button>
					</div>

					<!-- PARTS LIST (LAYERS) -->
					<div class="insp-parts-scroll">
						<div
							v-if="selectedItemConfig.parts && selectedItemConfig.parts.length > 0"
							class="parts-list"
						>
							<div
								v-for="(part, idx) in selectedItemConfig.parts"
								:key="`part-${selectedItemConfig.id}-${idx}`"
								class="part-layer-card"
							>
								<!-- Part Header -->
								<div class="plc-header">
									<div class="plc-title">
										<span class="plc-num">#{{ idx + 1 }}</span>
										<span class="plc-bone-badge">{{ formatBoneName(part.parent) }}</span>
									</div>

									<button
										type="button"
										class="plc-del-btn"
										title="Удалить эту часть одежды"
										@click="emit('remove-part', selectedItemConfig.id, idx)"
									>
										✕
									</button>
								</div>

								<!-- Part Configuration Form -->
								<div class="plc-body">
									<!-- Parent Body Part Selector -->
									<div class="plc-row">
										<label class="plc-label">Привязать к кости / части тела:</label>
										<select
											class="plc-select"
											:value="part.parent || 'body'"
											@change="updatePartField(idx, 'parent', $event.target.value)"
										>
											<option
												v-for="bone in availableBoneList"
												:key="bone"
												:value="bone"
											>
												{{ formatBoneOption(bone) }}
											</option>
										</select>
									</div>

									<!-- Sprite Image Path Selector -->
									<div class="plc-row">
										<label class="plc-label">Путь к файлу спрайта (PNG):</label>
										<div class="image-field-wrap">
											<!-- Dropdown for scanned images if any -->
											<select
												v-if="availableEquipmentImages.length > 0"
												class="plc-select plc-img-select"
												:value="part.image"
												@change="updatePartField(idx, 'image', $event.target.value)"
											>
												<option value="">-- Выбрать из папки экипировки --</option>
												<option
													v-for="img in availableEquipmentImages"
													:key="img"
													:value="img"
												>
													{{ getFilenameFromPath(img) }} ({{ img }})
												</option>
											</select>

											<!-- Direct Text Input for path -->
											<input
												type="text"
												class="plc-input"
												:value="part.image"
												placeholder="images/sprites/characters/.../equipment/..."
												@input="updatePartField(idx, 'image', $event.target.value)"
											/>

											<!-- Image Preview Thumbnail -->
											<div v-if="part.image" class="plc-img-preview-box">
												<img
													:src="resolveItemIconPath(part.image)"
													class="plc-img-preview-img"
													alt=""
													@error="(e) => (e.target.style.opacity = '0.3')"
												/>
											</div>
										</div>
									</div>

									<!-- Offset X & Offset Y Controls -->
									<div class="plc-offset-grid">
										<!-- Offset X -->
										<div class="offset-axis-control">
											<div class="oac-top">
												<span class="oac-label">Смещение X (влево/вправо):</span>
												<span class="oac-val">{{ Number(part.offset?.x || 0).toFixed(1) }}%</span>
											</div>
											<div class="oac-inputs">
												<input
													type="range"
													min="-50"
													max="50"
													step="0.1"
													class="oac-slider"
													:value="part.offset?.x || 0"
													@input="updatePartOffset(idx, 'x', Number($event.target.value))"
												/>
												<div class="oac-steppers">
													<button
														type="button"
														class="oac-step-btn"
														@click="adjustPartOffset(idx, 'x', -1)"
													>
														-1%
													</button>
													<button
														type="button"
														class="oac-step-btn __zero"
														@click="updatePartOffset(idx, 'x', 0)"
													>
														0
													</button>
													<button
														type="button"
														class="oac-step-btn"
														@click="adjustPartOffset(idx, 'x', 1)"
													>
														+1%
													</button>
												</div>
											</div>
										</div>

										<!-- Offset Y -->
										<div class="offset-axis-control">
											<div class="oac-top">
												<span class="oac-label">Смещение Y (вверх/вниз):</span>
												<span class="oac-val">{{ Number(part.offset?.y || 0).toFixed(1) }}%</span>
											</div>
											<div class="oac-inputs">
												<input
													type="range"
													min="-50"
													max="50"
													step="0.1"
													class="oac-slider"
													:value="part.offset?.y || 0"
													@input="updatePartOffset(idx, 'y', Number($event.target.value))"
												/>
												<div class="oac-steppers">
													<button
														type="button"
														class="oac-step-btn"
														@click="adjustPartOffset(idx, 'y', -1)"
													>
														-1%
													</button>
													<button
														type="button"
														class="oac-step-btn __zero"
														@click="updatePartOffset(idx, 'y', 0)"
													>
														0
													</button>
													<button
														type="button"
														class="oac-step-btn"
														@click="adjustPartOffset(idx, 'y', 1)"
													>
														+1%
													</button>
												</div>
											</div>
										</div>
									</div>

									<!-- Individual Part Z-Index (optional) -->
									<div class="plc-row __zindex-row">
										<label class="plc-label">Локальный Z-Index слоя (опционально):</label>
										<div class="stepper-box">
											<button
												type="button"
												class="step-btn"
												@click="adjustPartZIndex(idx, -1)"
											>
												-1
											</button>
											<input
												type="number"
												class="step-input"
												:value="part.zindex ?? ''"
												placeholder="по умолчанию"
												@change="setPartZIndex(idx, $event.target.value)"
											/>
											<button
												type="button"
												class="step-btn"
												@click="adjustPartZIndex(idx, 1)"
											>
												+1
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>

						<!-- No parts hint -->
						<div v-else class="no-parts-box">
							<span class="np-icon">🧩</span>
							<div class="np-title">У этого предмета ещё нет слоёв</div>
							<div class="np-sub">
								Нажмите «Добавить слой», чтобы привязать спрайт к части тела (например, тело,
								плечо или кисть).
							</div>
							<button
								type="button"
								class="btn-add-first-part"
								@click="emit('add-part', selectedItemConfig.id, 'body')"
							>
								➕ Добавить первый слой
							</button>
						</div>
					</div>

					<!-- Inspector Footer Action -->
					<div class="insp-footer">
						<button
							type="button"
							class="insp-save-btn"
							@click="emit('save-equipment')"
						>
							<span>💾</span>
							<span>Сохранить в characters/{{ characterId }}/equipment.json</span>
						</button>
					</div>
				</div>

				<!-- If no item selected -->
				<div v-else class="inspector-card __empty">
					<span class="insp-empty-icon">👈</span>
					<div class="insp-empty-title">Выберите предмет из списка</div>
					<div class="insp-empty-sub">
						Выберите настроенный предмет или добавьте новый из базы предметов игры, чтобы
						редактировать его части, привязку к костям и смещения.
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
	characterId: {
		type: String,
		required: true
	},
	bodyParts: {
		type: Object,
		default: () => ({})
	},
	characterEquipment: {
		type: Array,
		default: () => []
	},
	itemsCatalog: {
		type: Array,
		default: () => []
	},
	activeEquippedIds: {
		type: Object, // Set
		default: () => new Set()
	},
	selectedEquipmentId: {
		type: String,
		default: null
	},
	availableEquipmentImages: {
		type: Array,
		default: () => []
	},
	isWideSidebar: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits([
	'select-equipment',
	'toggle-equip',
	'set-all-equipped',
	'add-from-catalog',
	'remove-equipment',
	'add-part',
	'remove-part',
	'update-part',
	'update-item',
	'save-equipment',
	'toggle-sidebar-width'
])

// Filter states
const searchQuery = ref('')
const selectedSlotCategory = ref('all')
const originFilter = ref('all') // 'all' | 'configured' | 'equipped'
const showCustomItemInput = ref(false)
const newCustomItemId = ref('')

const slotCategories = [
	{ id: 'all', label: 'Все', icon: '✨', slots: [] },
	{ id: 'head', label: 'Голова', icon: '🪖', slots: ['head'] },
	{ id: 'mask', label: 'Маска', icon: '🎭', slots: ['mask'] },
	{ id: 'neck', label: 'Шея', icon: '📿', slots: ['neck_1', 'neck-1'] },
	{ id: 'torso', label: 'Торс', icon: '👕', slots: ['torso-1', 'torso-2', 'torso-3'] },
	{ id: 'underpants', label: 'Бельё', icon: '🩲', slots: ['underpants'] },
	{ id: 'hands', label: 'Руки', icon: '🧤', slots: ['hands'] },
	{ id: 'legs', label: 'Ноги', icon: '👖', slots: ['legs', 'legs-2'] },
	{ id: 'feet', label: 'Ступни', icon: '👢', slots: ['feet'] },
	{ id: 'weapon', label: 'Оружие', icon: '⚔️', slots: ['weapon-hand-1', 'weapon-hand-2', 'weapon_off'] }
]

// Active equipped count
const activeEquippedCount = computed(() => {
	let count = 0
	for (const it of props.characterEquipment) {
		if (it && it.id && isItemEquipped(it.id)) count++
	}
	return count
})

function isItemEquipped(itemId) {
	if (!itemId || !props.activeEquippedIds) return false
	if (props.activeEquippedIds instanceof Set) {
		return props.activeEquippedIds.has(itemId)
	}
	return Boolean(props.activeEquippedIds[itemId])
}

// All items merged (Catalog + Configured)
const allMergedItems = computed(() => {
	const map = new Map()

	// 1. Add catalog items
	if (Array.isArray(props.itemsCatalog)) {
		props.itemsCatalog.forEach((catItem) => {
			if (catItem && catItem.id) {
				map.set(catItem.id, {
					id: catItem.id,
					name: catItem.name || catItem.id,
					slot: catItem.slot,
					sprite: catItem.sprite,
					rarity: catItem.rarity,
					isConfigured: false,
					partsCount: 0
				})
			}
		})
	}

	// 2. Add or update with character's configured items
	if (Array.isArray(props.characterEquipment)) {
		props.characterEquipment.forEach((eq) => {
			if (!eq || !eq.id) return
			const existing = map.get(eq.id)
			const pCount = Array.isArray(eq.parts) ? eq.parts.length : 0
			if (existing) {
				existing.isConfigured = true
				existing.partsCount = pCount
			} else {
				map.set(eq.id, {
					id: eq.id,
					name: eq.id,
					slot: null,
					sprite: null,
					rarity: null,
					isConfigured: true,
					partsCount: pCount
				})
			}
		})
	}

	return Array.from(map.values())
})

// Match slot category
function matchesSlotCategory(item, catId) {
	if (catId === 'all') return true
	const cat = slotCategories.find((c) => c.id === catId)
	if (!cat || !cat.slots.length) return true

	const itemSlots = Array.isArray(item.slot) ? item.slot : [item.slot]
	for (const s of itemSlots) {
		if (s && cat.slots.includes(s)) return true
	}
	return false
}

// Counts for category badges
function getCategoryItemCount(catId) {
	if (catId === 'all') return allMergedItems.value.length
	return allMergedItems.value.filter((item) => matchesSlotCategory(item, catId)).length
}

// Filtered items list
const filteredItems = computed(() => {
	const q = searchQuery.value.trim().toLowerCase()
	const cat = selectedSlotCategory.value
	const origin = originFilter.value

	return allMergedItems.value.filter((item) => {
		// Search query
		if (q) {
			const nameMatch = (item.name || '').toLowerCase().includes(q)
			const idMatch = (item.id || '').toLowerCase().includes(q)
			if (!nameMatch && !idMatch) return false
		}

		// Slot category
		if (!matchesSlotCategory(item, cat)) return false

		// Origin filter
		if (origin === 'configured' && !item.isConfigured) return false
		if (origin === 'equipped' && !isItemEquipped(item.id)) return false

		return true
	})
})

// Selected Item Configuration
const selectedItemConfig = computed(() => {
	if (!props.selectedEquipmentId) return null
	return props.characterEquipment.find((x) => x.id === props.selectedEquipmentId) || null
})

// Selected Catalog Definition
const selectedCatalogDef = computed(() => {
	if (!props.selectedEquipmentId) return null
	return props.itemsCatalog.find((x) => x.id === props.selectedEquipmentId) || null
})

// Available Bones from current character bodyParts
const availableBoneList = computed(() => {
	const defaultOrder = [
		'body',
		'neck',
		'head',
		'belly',
		'arm_left',
		'arm2_left',
		'arm3_left',
		'arm_right',
		'arm2_right',
		'arm3_right'
	]
	const actual = Object.keys(props.bodyParts || {})
	const result = []

	// Put recognized bones first
	for (const b of defaultOrder) {
		if (actual.includes(b)) result.push(b)
	}
	// Append any custom parts
	for (const b of actual) {
		if (!result.includes(b)) result.push(b)
	}
	return result.length > 0 ? result : ['body', 'head', 'arm_left', 'arm_right']
})

const BONE_LABELS = {
	body: '🧍 Тело (body)',
	head: '👤 Голова (head)',
	neck: '🦒 Шея (neck)',
	belly: '🫃 Живот (belly)',
	arm_left: '🦾 Левое плечо (arm_left)',
	arm2_left: '💪 Левое предплечье (arm2_left)',
	arm3_left: '🖐️ Левая кисть (arm3_left)',
	arm_right: '🦾 Правое плечо (arm_right)',
	arm2_right: '💪 Правое предплечье (arm2_right)',
	arm3_right: '🖐️ Правая кисть (arm3_right)'
}

function formatBoneName(bone) {
	if (!bone) return 'body'
	return BONE_LABELS[bone] || `🦴 ${bone}`
}

function formatBoneOption(bone) {
	return BONE_LABELS[bone] || `🦴 ${bone}`
}

function getSlotFallbackIcon(slot) {
	if (!slot) return '📦'
	const s = Array.isArray(slot) ? slot[0] : slot
	if (s === 'head') return '🪖'
	if (s === 'mask') return '🎭'
	if (s.includes('torso')) return '👕'
	if (s.includes('legs')) return '👖'
	if (s === 'underpants') return '🩲'
	if (s === 'feet') return '👢'
	if (s === 'hands') return '🧤'
	if (s.includes('weapon')) return '⚔️'
	if (s.includes('neck')) return '📿'
	return '📦'
}

function formatSlotPill(slot) {
	if (!slot) return 'Слот не указан'
	return Array.isArray(slot) ? slot.join(' / ') : slot
}

function getPartsPlural(count) {
	if (count % 10 === 1 && count % 100 !== 11) return 'слой'
	if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) return 'слоя'
	return 'слоев'
}

function resolveItemIconPath(src) {
	if (!src) return ''
	if (src.startsWith('/') || src.startsWith('http')) return src
	return `/${src}`
}

function getFilenameFromPath(path) {
	if (!path) return ''
	const parts = path.split('/')
	return parts[parts.length - 1]
}

// Item Mutation Handlers
function setItemZIndex(val) {
	if (!selectedItemConfig.value) return
	const z = Number(val) || 0
	emit('update-item', selectedItemConfig.value.id, { zindex: z })
}

function adjustItemZIndex(delta) {
	if (!selectedItemConfig.value) return
	const cur = Number(selectedItemConfig.value.zindex ?? 1)
	emit('update-item', selectedItemConfig.value.id, { zindex: cur + delta })
}

function updatePartField(partIndex, field, value) {
	if (!selectedItemConfig.value) return
	emit('update-part', selectedItemConfig.value.id, partIndex, { [field]: value })
}

function updatePartOffset(partIndex, axis, value) {
	if (!selectedItemConfig.value) return
	const curOffset = selectedItemConfig.value.parts[partIndex]?.offset || { x: 0, y: 0 }
	const newOffset = {
		...curOffset,
		[axis]: Number(Number(value).toFixed(2))
	}
	emit('update-part', selectedItemConfig.value.id, partIndex, { offset: newOffset })
}

function adjustPartOffset(partIndex, axis, delta) {
	if (!selectedItemConfig.value) return
	const cur = Number(selectedItemConfig.value.parts[partIndex]?.offset?.[axis] || 0)
	updatePartOffset(partIndex, axis, cur + delta)
}

function setPartZIndex(partIndex, value) {
	if (!selectedItemConfig.value) return
	const z = value === '' ? undefined : Number(value)
	emit('update-part', selectedItemConfig.value.id, partIndex, { zindex: z })
}

function adjustPartZIndex(partIndex, delta) {
	if (!selectedItemConfig.value) return
	const cur = Number(selectedItemConfig.value.parts[partIndex]?.zindex || 0)
	setPartZIndex(partIndex, cur + delta)
}

function handleCreateCustomItem() {
	const cleanId = newCustomItemId.value.trim().toLowerCase().replace(/\s+/g, '_')
	if (!cleanId) return
	emit('add-from-catalog', { id: cleanId, name: cleanId })
	newCustomItemId.value = ''
	showCustomItemInput.value = false
}
</script>

<style scoped>
.char-rig-equip-panel {
	display: flex;
	flex-direction: column;
	gap: 0.85em;
	width: 100%;
}

/* SUMMARY CARD */
.equip-summary-card {
	background: rgba(15, 23, 42, 0.75);
	border: 1px solid rgba(148, 163, 184, 0.15);
	border-radius: 0.65em;
	padding: 0.75em 0.9em;
}

.esc-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8em;
	flex-wrap: wrap;
}

.esc-title-box {
	display: flex;
	align-items: center;
	gap: 0.65em;
}

.esc-icon {
	font-size: 1.5em;
}

.esc-title {
	font-size: 1em;
	font-weight: 700;
	color: #f8fafc;
}

.esc-sub {
	font-size: 0.78em;
	color: #94a3b8;
}

.esc-sub strong {
	color: #38bdf8;
}

.esc-actions {
	display: flex;
	align-items: center;
	gap: 0.45em;
}

.btn-studio-action {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(30, 41, 59, 0.85);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.45em;
	color: #cbd5e1;
	font-size: 0.78em;
	font-weight: 600;
	padding: 0.4em 0.65em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn-studio-action:hover {
	background: rgba(51, 65, 85, 0.95);
	color: #f8fafc;
	border-color: rgba(148, 163, 184, 0.4);
}

.btn-studio-action.__toggle-all:hover {
	border-color: #06b6d4;
	color: #38bdf8;
}

.btn-studio-action.__strip-all:hover {
	border-color: #f43f5e;
	color: #fda4af;
}

.btn-studio-action.__toggle-width {
	background: rgba(14, 165, 233, 0.15);
	border-color: rgba(56, 189, 248, 0.35);
	color: #38bdf8;
}

.btn-studio-action.__toggle-width:hover {
	background: rgba(14, 165, 233, 0.28);
	border-color: #38bdf8;
	color: #ffffff;
}

.btn-studio-action.__toggle-width.__active {
	background: rgba(14, 165, 233, 0.25);
	border-color: #38bdf8;
	color: #7dd3fc;
}

.btn-studio-action.__save-equip {
	background: linear-gradient(135deg, #059669 0%, #10b981 100%);
	border-color: #34d399;
	color: #ffffff;
}

.btn-studio-action.__save-equip:hover {
	background: linear-gradient(135deg, #047857 0%, #059669 100%);
	box-shadow: 0 0 0.6em rgba(16, 185, 129, 0.4);
}

/* FILTERS CARD */
.equip-filters-card {
	background: rgba(15, 23, 42, 0.65);
	border: 1px solid rgba(148, 163, 184, 0.12);
	border-radius: 0.65em;
	padding: 0.75em 0.9em;
	display: flex;
	flex-direction: column;
	gap: 0.65em;
}

.equip-search-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(2, 6, 23, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.45em;
	padding: 0.35em 0.65em;
}

.search-icon {
	font-size: 0.9em;
	opacity: 0.7;
}

.equip-search-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: #f8fafc;
	font-size: 0.82em;
}

.equip-search-input::placeholder {
	color: #64748b;
}

.search-clear-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.85em;
	padding: 0 0.2em;
}

.search-clear-btn:hover {
	color: #f8fafc;
}

/* Category pills */
.slot-categories-pills {
	display: flex;
	align-items: center;
	gap: 0.35em;
	overflow-x: auto;
	padding-bottom: 0.25em;
	scrollbar-width: thin;
}

.slot-category-btn {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.15);
	border-radius: 1em;
	color: #94a3b8;
	font-size: 0.75em;
	font-weight: 500;
	padding: 0.25em 0.6em;
	white-space: nowrap;
	cursor: pointer;
	transition: all 0.15s ease;
}

.slot-category-btn:hover {
	background: rgba(51, 65, 85, 0.8);
	color: #e2e8f0;
}

.slot-category-btn.__active {
	background: #0ea5e9;
	border-color: #38bdf8;
	color: #ffffff;
	font-weight: 600;
}

.sc-count {
	font-size: 0.85em;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 0.6em;
	padding: 0.05em 0.4em;
}

/* Origin filter row */
.equip-subfilters-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.6em;
	flex-wrap: wrap;
}

.origin-filter-tabs {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.origin-tab-btn {
	background: rgba(30, 41, 59, 0.5);
	border: 1px solid transparent;
	border-radius: 0.35em;
	color: #94a3b8;
	font-size: 0.74em;
	padding: 0.25em 0.55em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.origin-tab-btn:hover {
	color: #cbd5e1;
	background: rgba(51, 65, 85, 0.6);
}

.origin-tab-btn.__active {
	background: rgba(14, 165, 233, 0.2);
	border-color: rgba(14, 165, 233, 0.5);
	color: #38bdf8;
	font-weight: 600;
}

.btn-add-custom-item {
	display: inline-flex;
	align-items: center;
	gap: 0.3em;
	background: rgba(51, 65, 85, 0.5);
	border: 1px dashed rgba(148, 163, 184, 0.3);
	border-radius: 0.35em;
	color: #94a3b8;
	font-size: 0.74em;
	padding: 0.25em 0.55em;
	cursor: pointer;
}

.btn-add-custom-item:hover {
	border-color: #38bdf8;
	color: #38bdf8;
}

/* Custom Item Prompt */
.custom-item-prompt-bar {
	display: flex;
	align-items: center;
	gap: 0.45em;
	background: rgba(2, 6, 23, 0.8);
	border: 1px solid #0284c7;
	border-radius: 0.45em;
	padding: 0.4em 0.6em;
}

.custom-item-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: #f8fafc;
	font-size: 0.8em;
}

.custom-item-submit-btn {
	background: #0284c7;
	border: none;
	border-radius: 0.35em;
	color: #ffffff;
	font-size: 0.74em;
	font-weight: 600;
	padding: 0.25em 0.65em;
	cursor: pointer;
}

.custom-item-submit-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.custom-item-cancel-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.85em;
}

/* TWO-COLUMN LAYOUT */
.equip-two-col-layout {
	display: flex;
	gap: 0.85em;
	min-height: 25em;
	flex: 1;
	transition: all 0.2s ease;
}

/* Stacking fallback when sidebar is in compact mode (< 38em) */
.char-rig-equip-panel:not(.__is-wide) .equip-two-col-layout {
	flex-direction: column;
}

.char-rig-equip-panel:not(.__is-wide) .equip-items-list-col {
	max-width: 100%;
}

.char-rig-equip-panel:not(.__is-wide) .items-list-scroll {
	max-height: 24em;
}

.char-rig-equip-panel.__is-wide .equip-two-col-layout {
	flex-direction: row;
}

.char-rig-equip-panel.__is-wide .equip-items-list-col {
	flex: 1;
	min-width: 15em;
	max-width: 24em;
}

.char-rig-equip-panel.__is-wide .equip-inspector-col {
	flex: 2;
	min-width: 20em;
}

.equip-items-list-col {
	flex: 1;
	min-width: 14em;
	max-width: 24em;
	display: flex;
	flex-direction: column;
}

.items-list-scroll {
	max-height: 48em;
	overflow-y: auto;
	scrollbar-width: thin;
	padding-right: 0.2em;
}

.items-list-container {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
}

/* ITEM CARD */
.item-card {
	display: flex;
	align-items: center;
	gap: 0.6em;
	background: rgba(15, 23, 42, 0.65);
	border: 1px solid rgba(148, 163, 184, 0.12);
	border-radius: 0.55em;
	padding: 0.5em 0.65em;
	cursor: pointer;
	transition: all 0.15s ease;
	min-width: 0;
}

.item-card:hover {
	background: rgba(30, 41, 59, 0.8);
	border-color: rgba(148, 163, 184, 0.25);
}

.item-card.__selected {
	background: rgba(14, 165, 233, 0.15);
	border-color: #0ea5e9;
	box-shadow: 0 0 0.5em rgba(14, 165, 233, 0.25);
}

.item-icon-box {
	width: 2.2em;
	height: 2.2em;
	background: rgba(2, 6, 23, 0.6);
	border: 1px solid rgba(148, 163, 184, 0.15);
	border-radius: 0.45em;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	flex-shrink: 0;
}

.item-icon-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
	image-rendering: pixelated;
}

.item-icon-fallback {
	font-size: 1.1em;
}

.item-info-box {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	gap: 0.15em;
	overflow: hidden;
}

.item-title-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.4em;
	min-width: 0;
}

.item-name {
	font-size: 0.82em;
	font-weight: 600;
	color: #f1f5f9;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	min-width: 0;
}

.item-rarity-badge {
	font-size: 0.65em;
	text-transform: uppercase;
	padding: 0.05em 0.35em;
	border-radius: 0.3em;
	font-weight: 700;
	flex-shrink: 0;
}

.item-rarity-badge.__rare {
	background: rgba(59, 130, 246, 0.2);
	color: #60a5fa;
}

.item-rarity-badge.__epic {
	background: rgba(168, 85, 247, 0.2);
	color: #c084fc;
}

.item-meta-row {
	display: flex;
	align-items: center;
	gap: 0.35em;
	font-size: 0.7em;
	color: #94a3b8;
	min-width: 0;
	flex-wrap: wrap;
}

.item-id-pill {
	background: rgba(0, 0, 0, 0.35);
	padding: 0.05em 0.35em;
	border-radius: 0.25em;
	font-family: monospace;
	max-width: 10em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-slot-pill {
	color: #cbd5e1;
	white-space: nowrap;
}

.item-status-row {
	font-size: 0.68em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.status-badge.__configured {
	color: #10b981;
}

.status-badge.__not-configured {
	color: #64748b;
}

.item-card-actions {
	display: flex;
	align-items: center;
	gap: 0.3em;
	flex-shrink: 0;
	margin-left: auto;
}

.item-action-eye-btn {
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.35em;
	font-size: 0.9em;
	padding: 0.2em 0.4em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.item-action-eye-btn.__active {
	background: rgba(16, 185, 129, 0.2);
	border-color: #10b981;
}

.item-action-add-btn {
	background: rgba(14, 165, 233, 0.15);
	border: 1px solid rgba(14, 165, 233, 0.4);
	border-radius: 0.35em;
	color: #38bdf8;
	font-size: 0.7em;
	font-weight: 600;
	padding: 0.25em 0.5em;
	cursor: pointer;
	white-space: nowrap;
}

.item-action-add-btn:hover {
	background: #0ea5e9;
	color: #ffffff;
}

.item-action-del-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.85em;
	cursor: pointer;
	padding: 0.2em;
}

.item-action-del-btn:hover {
	color: #f43f5e;
}

.equip-empty-msg {
	text-align: center;
	padding: 2.5em 1em;
	background: rgba(15, 23, 42, 0.4);
	border-radius: 0.55em;
	color: #64748b;
}

.empty-icon {
	font-size: 2em;
	margin-bottom: 0.3em;
	display: block;
}

.empty-text {
	font-weight: 600;
	color: #94a3b8;
	font-size: 0.9em;
}

.empty-sub {
	font-size: 0.75em;
	margin-top: 0.2em;
}

/* RIGHT COLUMN: INSPECTOR & PARTS BUILDER */
.equip-inspector-col {
	flex: 2;
	min-width: 20em;
	display: flex;
	flex-direction: column;
}

.inspector-card {
	background: rgba(15, 23, 42, 0.75);
	border: 1px solid rgba(148, 163, 184, 0.18);
	border-radius: 0.65em;
	padding: 0.85em 1em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	height: 100%;
}

.inspector-card.__empty {
	align-items: center;
	justify-content: center;
	text-align: center;
	color: #64748b;
	padding: 3em 2em;
}

.insp-empty-icon {
	font-size: 2.5em;
	margin-bottom: 0.4em;
}

.insp-empty-title {
	font-size: 1.1em;
	font-weight: 700;
	color: #cbd5e1;
}

.insp-empty-sub {
	font-size: 0.82em;
	max-width: 22em;
	margin-top: 0.3em;
	line-height: 1.4;
}

.insp-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid rgba(148, 163, 184, 0.12);
	padding-bottom: 0.65em;
}

.insp-title-box {
	display: flex;
	align-items: center;
	gap: 0.65em;
}

.insp-icon {
	font-size: 1.6em;
}

.insp-name {
	font-size: 1.05em;
	font-weight: 700;
	color: #f8fafc;
}

.insp-id {
	font-size: 0.75em;
	color: #94a3b8;
}

.insp-id code {
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
	color: #38bdf8;
}

.insp-header-actions {
	display: flex;
	align-items: center;
	gap: 0.45em;
}

.insp-btn-preview {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.45em;
	color: #94a3b8;
	font-size: 0.78em;
	font-weight: 600;
	padding: 0.35em 0.65em;
	cursor: pointer;
}

.insp-btn-preview.__active {
	background: rgba(16, 185, 129, 0.2);
	border-color: #10b981;
	color: #34d399;
}

.insp-btn-delete {
	background: rgba(244, 63, 94, 0.1);
	border: 1px solid rgba(244, 63, 94, 0.3);
	border-radius: 0.45em;
	color: #fb7185;
	font-size: 0.8em;
	padding: 0.35em 0.5em;
	cursor: pointer;
}

.insp-btn-delete:hover {
	background: #f43f5e;
	color: #ffffff;
}

/* Inspector props bar */
.insp-props-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8em;
	background: rgba(2, 6, 23, 0.5);
	border: 1px solid rgba(148, 163, 184, 0.1);
	border-radius: 0.5em;
	padding: 0.5em 0.75em;
	flex-wrap: wrap;
}

.prop-group {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.8em;
}

.prop-label {
	color: #94a3b8;
	font-weight: 500;
}

.prop-hint {
	font-size: 0.85em;
	color: #64748b;
}

.stepper-box {
	display: flex;
	align-items: center;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.35em;
	overflow: hidden;
}

.step-btn {
	background: transparent;
	border: none;
	color: #cbd5e1;
	font-size: 0.75em;
	padding: 0.25em 0.5em;
	cursor: pointer;
}

.step-btn:hover {
	background: rgba(51, 65, 85, 0.7);
	color: #f8fafc;
}

.step-input {
	width: 3.5em;
	background: transparent;
	border: none;
	outline: none;
	color: #f8fafc;
	font-size: 0.78em;
	text-align: center;
}

.btn-add-part {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(14, 165, 233, 0.18);
	border: 1px solid rgba(14, 165, 233, 0.4);
	border-radius: 0.45em;
	color: #38bdf8;
	font-size: 0.78em;
	font-weight: 600;
	padding: 0.35em 0.65em;
	cursor: pointer;
}

.btn-add-part:hover {
	background: #0ea5e9;
	color: #ffffff;
}

/* PARTS SCROLL */
.insp-parts-scroll {
	flex: 1;
	max-height: 38em;
	overflow-y: auto;
	scrollbar-width: thin;
	padding-right: 0.25em;
}

.parts-list {
	display: flex;
	flex-direction: column;
	gap: 0.75em;
}

/* PART LAYER CARD */
.part-layer-card {
	background: rgba(2, 6, 23, 0.5);
	border: 1px solid rgba(148, 163, 184, 0.15);
	border-radius: 0.55em;
	padding: 0.7em 0.85em;
	display: flex;
	flex-direction: column;
	gap: 0.55em;
}

.plc-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid rgba(148, 163, 184, 0.08);
	padding-bottom: 0.4em;
}

.plc-title {
	display: flex;
	align-items: center;
	gap: 0.45em;
}

.plc-num {
	font-size: 0.75em;
	font-weight: 700;
	background: rgba(14, 165, 233, 0.2);
	color: #38bdf8;
	padding: 0.1em 0.45em;
	border-radius: 0.3em;
}

.plc-bone-badge {
	font-size: 0.82em;
	font-weight: 600;
	color: #f1f5f9;
}

.plc-del-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.85em;
	cursor: pointer;
	padding: 0.1em 0.3em;
}

.plc-del-btn:hover {
	color: #f43f5e;
}

.plc-body {
	display: flex;
	flex-direction: column;
	gap: 0.55em;
}

.plc-row {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.plc-row.__zindex-row {
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
}

.plc-label {
	font-size: 0.75em;
	color: #94a3b8;
	font-weight: 500;
}

.plc-select {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.4em;
	color: #f8fafc;
	font-size: 0.8em;
	padding: 0.35em 0.6em;
	outline: none;
}

.plc-select option {
	background: #0f172a;
	color: #f8fafc;
}

.image-field-wrap {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.plc-input {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.4em;
	color: #f8fafc;
	font-size: 0.78em;
	padding: 0.35em 0.6em;
	outline: none;
	font-family: monospace;
}

.plc-img-preview-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 0.35em;
	padding: 0.3em;
	width: fit-content;
}

.plc-img-preview-img {
	height: 3.5em;
	max-width: 7em;
	object-fit: contain;
	image-rendering: pixelated;
}

/* Offset Grid */
.plc-offset-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 0.65em;
	background: rgba(15, 23, 42, 0.4);
	border: 1px solid rgba(148, 163, 184, 0.08);
	border-radius: 0.45em;
	padding: 0.5em 0.65em;
}

.offset-axis-control {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.oac-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.oac-label {
	font-size: 0.72em;
	color: #94a3b8;
}

.oac-val {
	font-size: 0.74em;
	font-weight: 700;
	color: #38bdf8;
	font-family: monospace;
}

.oac-inputs {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.oac-slider {
	width: 100%;
	accent-color: #0ea5e9;
	cursor: pointer;
}

.oac-steppers {
	display: flex;
	gap: 0.25em;
}

.oac-step-btn {
	flex: 1;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.25em;
	color: #cbd5e1;
	font-size: 0.68em;
	padding: 0.2em 0.1em;
	cursor: pointer;
}

.oac-step-btn:hover {
	background: rgba(51, 65, 85, 0.85);
	color: #f8fafc;
}

.oac-step-btn.__zero {
	color: #38bdf8;
}

/* No parts box */
.no-parts-box {
	text-align: center;
	padding: 2em 1.5em;
	background: rgba(2, 6, 23, 0.4);
	border: 1px dashed rgba(148, 163, 184, 0.2);
	border-radius: 0.55em;
	color: #64748b;
}

.np-icon {
	font-size: 2em;
	display: block;
	margin-bottom: 0.3em;
}

.np-title {
	font-size: 0.9em;
	font-weight: 600;
	color: #cbd5e1;
}

.np-sub {
	font-size: 0.75em;
	margin-top: 0.25em;
	margin-bottom: 0.8em;
	line-height: 1.4;
}

.btn-add-first-part {
	background: #0ea5e9;
	border: none;
	border-radius: 0.4em;
	color: #ffffff;
	font-size: 0.78em;
	font-weight: 600;
	padding: 0.4em 0.8em;
	cursor: pointer;
}

.btn-add-first-part:hover {
	background: #0284c7;
}

/* Footer save button */
.insp-footer {
	border-top: 1px solid rgba(148, 163, 184, 0.12);
	padding-top: 0.65em;
}

.insp-save-btn {
	width: 100%;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 0.4em;
	background: linear-gradient(135deg, #059669 0%, #10b981 100%);
	border: 1px solid #34d399;
	border-radius: 0.45em;
	color: #ffffff;
	font-size: 0.82em;
	font-weight: 700;
	padding: 0.55em 1em;
	cursor: pointer;
	transition: all 0.15s ease;
}

.insp-save-btn:hover {
	background: linear-gradient(135deg, #047857 0%, #059669 100%);
	box-shadow: 0 0 0.8em rgba(16, 185, 129, 0.4);
}
</style>
