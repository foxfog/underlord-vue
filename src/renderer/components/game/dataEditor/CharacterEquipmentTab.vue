<template>
	<div class="char-equip-tab">
		<!-- Main Two-Column Layout -->
		<div class="equip-tab-columns">
			<!-- LEFT COLUMN: Avatar Paperdoll & Unified 4-Column Equipment Grid -->
			<div class="equip-left-col">
				<!-- Paperdoll Avatar Box -->
				<div class="avatar-preview-card">
					<div class="avatar-preview-header">
						<span class="aph-icon">🪞</span>
						<span class="aph-title">Аватар и снаряжение</span>
						<span class="aph-gender-badge" :title="`Пол: ${character.gender || 'male'}`">
							{{ getGenderIcon(character.gender) }}
						</span>
					</div>

					<div class="avatar-stage">
						<!-- Real Character Component with body sprites & equipment layers -->
						<div v-if="hasBodySprites" class="avatar-char-wrapper">
							<Character :character="characterPreview" />
						</div>

						<!-- Fallback Sprite / Icon if body.json has no animated parts -->
						<div v-else class="avatar-fallback-wrapper">
							<img
								v-if="characterIconSrc"
								:src="characterIconSrc"
								class="avatar-fallback-img"
								:alt="character.name || character.id"
								@error="onAvatarImgError"
							/>
							<div v-else class="avatar-fallback-emoji">
								{{ character.gender === 'female' ? '👩' : '👤' }}
							</div>
							<div class="avatar-fallback-name">
								{{ character.name || character.id }}
							</div>
						</div>
					</div>

					<div class="avatar-footer-info">
						<span class="afi-lvl">Уровень: <strong>{{ character.lvl || 1 }}</strong></span>
						<span class="afi-sep">•</span>
						<span class="afi-equipped">Одето: <strong>{{ equippedCount }} / {{ availableSlotsList.length }}</strong></span>
						<button
							v-if="equippedCount > 0"
							type="button"
							class="unequip-all-btn"
							title="Снять все экипированные предметы"
							@click="unequipAll"
						>
							Снять всё
						</button>
					</div>
				</div>

				<!-- Unified Square Equipment Grid (4 columns, matching in-game inventory) -->
				<div class="slots-section-card">
					<div class="slots-header">
						<span class="sh-icon">🛡️</span>
						<span class="sh-title">Слоты экипировки</span>
						<span class="sh-subhint">Клик — выбор / замена</span>
					</div>

					<div class="equipment-grid">
						<div
							v-for="slot in availableSlotsList"
							:key="slot.id"
							class="inventory-grid-item"
						>
							<!-- Equipped Slot (Square) -->
							<div
								v-if="getSlotItemId(slot.id)"
								class="inventory-grid-slot __equipped"
								:style="getSlotItemRarityStyle(slot.id)"
								:title="getSlotItemTooltip(slot.id)"
								@click="openSlotPicker(slot.id)"
							>
								<!-- Top-left badge: slot icon -->
								<div class="slot-badge-top-left" :title="getSlotLabel(slot.id)">
									{{ getSlotIcon(slot.id) }}
								</div>

								<!-- Top-right button: Quick unequip -->
								<button
									type="button"
									class="slot-unequip-corner-btn"
									title="Снять предмет"
									@click.stop="unequipSlot(slot.id)"
								>
									✕
								</button>

								<!-- Item Content -->
								<div class="inventory-item-content">
									<div class="item-icon">
										<img
											v-if="getSlotItemDef(slot.id)?.sprite"
											:src="resolveAssetPath(getSlotItemDef(slot.id).sprite)"
											class="item-sprite-img"
											alt=""
											@error="(e) => e.target.style.display = 'none'"
										/>
										<span v-else class="item-fallback-icon">
											{{ getSlotItemDef(slot.id)?.icon || '📦' }}
										</span>
									</div>

									<div class="item-info">
										<div
											class="item-name"
											:style="{ color: getSlotItemRarityColor(slot.id) }"
										>
											{{ getSlotItemName(slot.id) }}
										</div>
									</div>
								</div>
							</div>

							<!-- Empty Slot (Square) -->
							<div
								v-else
								class="inventory-grid-slot __empty"
								:title="`Нажмите, чтобы надеть в слот: ${getSlotLabel(slot.id)}`"
								@click="openSlotPicker(slot.id)"
							>
								<div class="empty-slot-content">
									<span class="empty-slot-icon">{{ getSlotIcon(slot.id) }}</span>
									<span class="empty-slot-name">{{ getSlotShortName(slot.id) }}</span>
									<span class="empty-slot-plus">＋</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- RIGHT COLUMN: Character Inventory Grid (Squares) & Item Inspector -->
			<div class="equip-right-col">
				<div class="inventory-section-card">
					<div class="inv-card-header">
						<div class="ich-left">
							<span class="ich-icon">🎒</span>
							<span class="ich-title">Инвентарь персонажа</span>
							<span class="ich-badge">{{ inventoryItemsList.length }} предм.</span>
						</div>

						<div class="ich-right">
							<button
								type="button"
								class="add-inv-item-btn"
								@click="isAddModalOpen = true"
							>
								<span class="btn-plus">➕</span>
								<span>Добавить предмет...</span>
							</button>
						</div>
					</div>

					<!-- Search & Category Filters -->
					<div class="inv-toolbar">
						<div class="inv-search-box">
							<span class="search-icon">🔍</span>
							<input
								v-model="invSearchQuery"
								type="text"
								class="inv-search-input"
								placeholder="Поиск по названию или ID..."
							/>
						</div>

						<div class="inv-filters-row">
							<button
								v-for="flt in filterTabs"
								:key="flt.id"
								type="button"
								class="btn-filter"
								:class="{ active: activeFilterTab === flt.id }"
								@click="activeFilterTab = flt.id"
							>
								{{ flt.label }}
							</button>
						</div>
					</div>

					<!-- Unified Square Inventory Grid -->
					<div class="inv-grid-wrapper">
						<div class="inventory-grid inventory-grid-main">
							<!-- Populated Items -->
							<div
								v-for="(invItem, idx) in filteredInventoryItems"
								:key="`inv-${invItem.itemId}-${idx}`"
								class="inventory-grid-item"
							>
								<div
									class="inventory-grid-slot"
									:class="{
										__selected: selectedInvItem?.itemId === invItem.itemId,
										__equipped: isItemEquipped(invItem.itemId),
										__restricted: isInvItemEquippableType(invItem) && !canEquipInvItem(invItem)
									}"
									:style="getInvItemRarityStyle(invItem.itemId)"
									:title="getInvItemTooltip(invItem)"
									@click="selectInventoryItem(invItem)"
									@dblclick="onInvItemDoubleClick(invItem)"
								>
									<!-- Badges -->
									<div class="item-badges">
										<!-- Restricted badge -->
										<span
											v-if="isInvItemEquippableType(invItem) && !canEquipInvItem(invItem)"
											class="item-badge _restricted"
											:title="getEquipBlockedReasons(invItem).join('; ')"
										>
											🚫
										</span>
										<!-- Equipped badge -->
										<span
											v-else-if="isItemEquipped(invItem.itemId)"
											class="item-badge _equipped"
											title="Предмет надет на персонаже"
										>
											🛡️
										</span>
									</div>

									<!-- Item Content -->
									<div class="inventory-item-content">
										<div class="item-icon">
											<img
												v-if="getInvItemDef(invItem.itemId)?.sprite"
												:src="resolveAssetPath(getInvItemDef(invItem.itemId).sprite)"
												class="item-sprite-img"
												alt=""
												@error="(e) => e.target.style.display = 'none'"
											/>
											<span v-else class="item-fallback-icon">
												{{ getInvItemDef(invItem.itemId)?.icon || '📦' }}
											</span>
										</div>

										<div class="item-info">
											<div
												class="item-name"
												:style="{ color: getInvItemRarityColor(invItem.itemId) }"
											>
												{{ getInvItemName(invItem.itemId) }}
											</div>
										</div>

										<!-- Quantity Badge -->
										<div
											v-if="isItemStackable(invItem.itemId) && invItem.quantity > 1"
											class="item-quantity"
										>
											x{{ invItem.quantity }}
										</div>
									</div>
								</div>
							</div>

							<!-- Empty Backpack Slots (padded up to MIN_SLOTS like in game) -->
							<div
								v-for="emptyIdx in emptyInventorySlotsCount"
								:key="`empty-cell-${emptyIdx}`"
								class="inventory-grid-item"
							>
								<div class="inventory-grid-slot empty-slot" @click="selectedInvItem = null">
									<span class="empty-slot-dot">·</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Bottom Item Inspector Bar -->
					<div class="item-inspector-card">
						<div v-if="selectedInvItem" class="inspector-content">
							<!-- Left: Item Icon & Basic Meta -->
							<div class="insp-left">
								<div
									class="insp-icon-box"
									:style="getInvItemRarityStyle(selectedInvItem.itemId)"
								>
									<img
										v-if="getInvItemDef(selectedInvItem.itemId)?.sprite"
										:src="resolveAssetPath(getInvItemDef(selectedInvItem.itemId).sprite)"
										class="insp-sprite-img"
										alt=""
										@error="(e) => e.target.style.display = 'none'"
									/>
									<span v-else class="insp-fallback-icon">
										{{ getInvItemDef(selectedInvItem.itemId)?.icon || '📦' }}
									</span>
								</div>

								<div class="insp-details">
									<div class="insp-title-row">
										<span
											class="insp-name"
											:style="{ color: getInvItemRarityColor(selectedInvItem.itemId) }"
										>
											{{ getInvItemName(selectedInvItem.itemId) }}
										</span>
										<span
											v-if="getInvItemDef(selectedInvItem.itemId)?.rarity"
											class="insp-rarity-pill"
											:style="getRarityBadgeStyle(getInvItemDef(selectedInvItem.itemId).rarity)"
										>
											{{ getInvItemDef(selectedInvItem.itemId).rarity }}
										</span>
									</div>

									<div class="insp-sub-meta">
										<span class="insp-id">id: {{ selectedInvItem.itemId }}</span>
										<span v-if="getInvItemDef(selectedInvItem.itemId)?.slot" class="insp-slot-pill">
											{{ formatSlotPill(getInvItemDef(selectedInvItem.itemId).slot) }}
										</span>
										<span v-if="getInvItemDef(selectedInvItem.itemId)?.lvl_min" class="insp-lvl">
											Мин. ур: {{ getInvItemDef(selectedInvItem.itemId).lvl_min }}
										</span>
										<span v-if="getInvItemDef(selectedInvItem.itemId)?.weight" class="insp-weight">
											{{ getInvItemDef(selectedInvItem.itemId).weight }} кг
										</span>
									</div>

									<!-- Restriction Warning if cannot equip -->
									<div
										v-if="isInvItemEquippableType(selectedInvItem) && !canEquipInvItem(selectedInvItem)"
										class="insp-restriction-msg"
									>
										⚠️ {{ getEquipBlockedReasons(selectedInvItem).join(', ') }}
									</div>
								</div>
							</div>

							<!-- Right: Actions (Quantity, Equip, Delete, Close) -->
							<div class="insp-actions">
								<!-- Quantity controls -->
								<div class="qty-counter">
									<span class="qty-label">Кол-во:</span>
									<button
										type="button"
										class="qty-btn"
										title="Уменьшить"
										@click="adjustItemQty(selectedInvItem, -1)"
									>
										-
									</button>
									<input
										type="number"
										min="1"
										class="qty-input"
										:value="selectedInvItem.quantity ?? 1"
										@change="setItemQty(selectedInvItem, $event.target.value)"
									/>
									<button
										type="button"
										class="qty-btn"
										title="Увеличить"
										@click="adjustItemQty(selectedInvItem, 1)"
									>
										+
									</button>
								</div>

								<!-- Equip Buttons -->
								<div v-if="getInvItemDef(selectedInvItem.itemId)?.slot" class="equip-btn-group">
									<!-- If multiple slots (e.g. weapon 1 / weapon 2) -->
									<template v-if="Array.isArray(getInvItemDef(selectedInvItem.itemId).slot)">
										<button
											v-for="s in getInvItemDef(selectedInvItem.itemId).slot"
											:key="s"
											type="button"
											class="insp-btn-equip"
											:disabled="!canEquipInvItem(selectedInvItem)"
											@click="equipInvItemToSpecificSlot(selectedInvItem, s)"
										>
											Одеть в {{ getSlotShortName(s) }}
										</button>
									</template>
									<!-- Single slot -->
									<button
										v-else
										type="button"
										class="insp-btn-equip"
										:disabled="!canEquipInvItem(selectedInvItem)"
										@click="equipInvItem(selectedInvItem)"
									>
										🛡️ Надеть
									</button>
								</div>

								<!-- Delete Button -->
								<button
									type="button"
									class="insp-btn-delete"
									title="Удалить предмет из инвентаря"
									@click="removeInvItem(selectedInvItem)"
								>
									🗑️
								</button>

								<!-- Close Button -->
								<button
									type="button"
									class="insp-btn-close"
									title="Снять выделение"
									@click="selectedInvItem = null"
								>
									✕
								</button>
							</div>
						</div>

						<div v-else class="inspector-hint">
							<span class="ih-icon">💡</span>
							<span>Нажмите на квадрат предмета в инвентаре для просмотра и управления. Двойной клик — быстро надеть.</span>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- MODAL: Slot Item Picker -->
		<Transition name="fade">
			<div v-if="activePickerSlot" class="picker-modal-overlay" @click.self="activePickerSlot = null">
				<div class="picker-modal-card">
					<div class="pmc-header">
						<div class="pmc-title-box">
							<span class="pmc-icon">{{ getSlotIcon(activePickerSlot) }}</span>
							<div>
								<div class="pmc-title">Выбор экипировки для слота</div>
								<div class="pmc-sub">Слот: <strong>{{ getSlotLabel(activePickerSlot) }}</strong></div>
							</div>
						</div>
						<button type="button" class="pmc-close-btn" @click="activePickerSlot = null">✕</button>
					</div>

					<div class="pmc-search-bar">
						<input
							v-model="pickerSearchQuery"
							type="text"
							class="inv-search-input"
							placeholder="Поиск подходящих предметов..."
						/>
					</div>

					<div class="pmc-items-scroll">
						<div v-if="compatibleSlotItems.length > 0" class="pmc-items-grid">
							<div
								v-for="item in compatibleSlotItems"
								:key="item.id"
								class="pmc-item-tile"
								:class="{
									__cant_equip: !canEquipItemDef(item),
									__currently_equipped: getSlotItemId(activePickerSlot) === item.id
								}"
								@click="selectItemForSlot(activePickerSlot, item)"
							>
								<div class="pmc-tile-top">
									<div class="pmc-icon-box" :style="getInvItemRarityStyle(item.id)">
										<img
											v-if="item.sprite"
											:src="resolveAssetPath(item.sprite)"
											class="item-sprite-img"
											alt=""
											@error="(e) => e.target.style.display = 'none'"
										/>
										<span v-else class="item-fallback-icon">{{ item.icon || '📦' }}</span>
									</div>
									<div class="pmc-tile-info">
										<div class="pmc-item-name" :style="{ color: getInvItemRarityColor(item.id) }">
											{{ item.name || item.id }}
										</div>
										<div class="pmc-item-meta">
											<span v-if="item.lvl_min">Ур: {{ item.lvl_min }}</span>
											<span v-if="item.rarity" :style="{ color: getRarityColor(item.rarity) }">
												{{ item.rarity }}
											</span>
										</div>
									</div>
								</div>

								<div
									v-if="!canEquipItemDef(item)"
									class="pmc-restriction-warning"
								>
									⚠️ {{ getDefEquipBlockedReasons(item)[0] }}
								</div>

								<div class="pmc-tile-action">
									<span v-if="getSlotItemId(activePickerSlot) === item.id" class="equipped-badge">
										Надето ✔
									</span>
									<button
										v-else
										type="button"
										class="pick-btn"
										:disabled="!canEquipItemDef(item)"
									>
										Выбрать
									</button>
								</div>
							</div>
						</div>

						<div v-else class="pmc-empty-msg">
							Нет подходящих предметов для слота «{{ getSlotLabel(activePickerSlot) }}»
						</div>
					</div>

					<div class="pmc-footer">
						<button
							v-if="getSlotItemId(activePickerSlot)"
							type="button"
							class="pmc-unequip-btn"
							@click="unequipSlot(activePickerSlot); activePickerSlot = null"
						>
							Снять предмет из слота
						</button>
						<button
							type="button"
							class="pmc-cancel-btn"
							@click="activePickerSlot = null"
						>
							Закрыть
						</button>
					</div>
				</div>
			</div>
		</Transition>

		<!-- MODAL: Add Item To Inventory from Global Catalog -->
		<Transition name="fade">
			<div v-if="isAddModalOpen" class="picker-modal-overlay" @click.self="isAddModalOpen = false">
				<div class="picker-modal-card __catalog">
					<div class="pmc-header">
						<div class="pmc-title-box">
							<span class="pmc-icon">➕</span>
							<div>
								<div class="pmc-title">Каталог предметов игры</div>
								<div class="pmc-sub">Выберите предмет для добавления в инвентарь персонажа</div>
							</div>
						</div>
						<button type="button" class="pmc-close-btn" @click="isAddModalOpen = false">✕</button>
					</div>

					<div class="pmc-search-bar">
						<input
							v-model="catalogSearchQuery"
							type="text"
							class="inv-search-input"
							placeholder="Поиск по базе предметов (название, ID, категория)..."
						/>
					</div>

					<div class="pmc-items-scroll">
						<div v-if="catalogFilteredItems.length > 0" class="pmc-items-grid">
							<div
								v-for="item in catalogFilteredItems"
								:key="'cat-' + item.id"
								class="pmc-item-tile"
								@click="addItemToInventory(item)"
							>
								<div class="pmc-tile-top">
									<div class="pmc-icon-box" :style="getInvItemRarityStyle(item.id)">
										<img
											v-if="item.sprite"
											:src="resolveAssetPath(item.sprite)"
											class="item-sprite-img"
											alt=""
											@error="(e) => e.target.style.display = 'none'"
										/>
										<span v-else class="item-fallback-icon">{{ item.icon || '📦' }}</span>
									</div>
									<div class="pmc-tile-info">
										<div class="pmc-item-name" :style="{ color: getInvItemRarityColor(item.id) }">
											{{ item.name || item.id }}
										</div>
										<div class="pmc-item-meta">
											<span v-if="item.slot">{{ formatSlotPill(item.slot) }}</span>
											<span v-if="item.rarity" :style="{ color: getRarityColor(item.rarity) }">
												{{ item.rarity }}
											</span>
										</div>
									</div>
								</div>

								<div class="pmc-tile-action">
									<button type="button" class="pick-btn">
										＋ В инвентарь
									</button>
								</div>
							</div>
						</div>

						<div v-else class="pmc-empty-msg">
							Предметы не найдены
						</div>
					</div>

					<div class="pmc-footer">
						<button
							type="button"
							class="pmc-cancel-btn"
							@click="isAddModalOpen = false"
						>
							Готово
						</button>
					</div>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Character from '../characters/Character.vue'
import {
	EQUIPMENT_SLOTS_LIST,
	getSlotDisplayName,
	getGenderIcon
} from '@/composables/useDataEditor.js'
import {
	calculateEquipmentBySlot,
	canCharacterEquipItem,
	getEquipRestrictionReasons
} from '@/utils/equipment.js'
import { getRarityColor, getRarityBadgeStyle } from '@/constants/rarity.js'

const props = defineProps({
	character: {
		type: Object,
		required: true
	},
	itemsList: {
		type: Array,
		default: () => []
	},
	talentsRegistry: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['change'])

const availableSlotsList = EQUIPMENT_SLOTS_LIST

const SLOT_ICONS = {
	head: '🪖',
	mask: '🎭',
	neck_1: '📿',
	'torso-1': '👕',
	'torso-2': '🥋',
	'torso-3': '🧥',
	hands: '🧤',
	'legs-2': '👖',
	feet: '👢',
	'weapon-hand-1': '⚔️',
	'weapon-hand-2': '🛡️',
	underpants: '🩲'
}

const SLOT_SHORT_NAMES = {
	head: 'Голова',
	mask: 'Маска',
	neck_1: 'Шея',
	'torso-1': 'Тело 1',
	'torso-2': 'Тело 2',
	'torso-3': 'Плащ',
	hands: 'Руки',
	'legs-2': 'Ноги',
	feet: 'Ступни',
	'weapon-hand-1': 'Оружие 1',
	'weapon-hand-2': 'Оружие 2',
	underpants: 'Бельё'
}

const MIN_INVENTORY_GRID_CELLS = 24

const activeFilterTab = ref('all')
const invSearchQuery = ref('')
const selectedInvItem = ref(null)
const activePickerSlot = ref(null)
const pickerSearchQuery = ref('')
const isAddModalOpen = ref(false)
const catalogSearchQuery = ref('')
const avatarImgFailed = ref(false)

const filterTabs = [
	{ id: 'all', label: 'Все' },
	{ id: 'equipment', label: 'Экипировка' },
	{ id: 'other', label: 'Расходники / Прочее' }
]

// Item definitions map by id
const itemsMap = computed(() => {
	const map = {}
	if (Array.isArray(props.itemsList)) {
		props.itemsList.forEach((it) => {
			if (it && it.id) map[it.id] = it
		})
	}
	return map
})

// Check if character has body sprites
const hasBodySprites = computed(() => {
	return Boolean(props.character?.sprites && Object.keys(props.character.sprites).length > 0)
})

const characterIconSrc = computed(() => {
	if (avatarImgFailed.value) return null
	const icon = props.character?.icon
	if (!icon || icon.includes(' ') || icon.length <= 4) return null
	return resolveAssetPath(icon)
})

function onAvatarImgError() {
	avatarImgFailed.value = true
}

// Preview object for Character.vue
const characterPreview = computed(() => {
	if (!props.character) return null
	return {
		...props.character,
		orientation: 'right',
		back: false,
		position: { l: 0, t: 0 },
		fromPosition: null,
		animationDuration: 0,
		sprites: props.character.sprites || null,
		equipment: props.character.equipment || [],
		equipmentBySlot: props.character.equipmentBySlot || {}
	}
})

// Equipment slots helpers
const equippedCount = computed(() => {
	if (!props.character?.equipment_slots) return 0
	return Object.values(props.character.equipment_slots).filter(Boolean).length
})

function getSlotItemId(slotId) {
	return props.character?.equipment_slots?.[slotId] || null
}

function getSlotLabel(slotId) {
	return getSlotDisplayName(slotId)
}

function getSlotIcon(slotId) {
	return SLOT_ICONS[slotId] || '🛡️'
}

function getSlotShortName(slotId) {
	return SLOT_SHORT_NAMES[slotId] || slotId
}

function getSlotItemDef(slotId) {
	const itemId = getSlotItemId(slotId)
	return itemId ? itemsMap.value[itemId] || { id: itemId, name: itemId } : null
}

function getSlotItemName(slotId) {
	const def = getSlotItemDef(slotId)
	return def?.name || def?.id || slotId
}

function getSlotItemRarityColor(slotId) {
	const def = getSlotItemDef(slotId)
	return def?.rarity ? getRarityColor(def.rarity) : '#e2e8f0'
}

function getSlotItemRarityStyle(slotId) {
	const def = getSlotItemDef(slotId)
	return def?.rarity ? getRarityBadgeStyle(def.rarity) : {}
}

function getSlotItemTooltip(slotId) {
	const def = getSlotItemDef(slotId)
	if (!def) return ''
	const lines = [`[${getSlotLabel(slotId)}] ${def.name || def.id}`]
	if (def.rarity) lines.push(`Редкость: ${def.rarity}`)
	if (def.lvl_min) lines.push(`Минимальный уровень: ${def.lvl_min}`)
	if (def.stats) {
		lines.push('Параметры:')
		for (const [k, v] of Object.entries(def.stats)) {
			lines.push(`  ${k}: ${v}`)
		}
	}
	return lines.join('\n')
}

function isItemEquipped(itemId) {
	if (!props.character?.equipment_slots || !itemId) return false
	return Object.values(props.character.equipment_slots).includes(itemId)
}

function syncEquipmentBySlot() {
	if (!props.character) return
	props.character.equipmentBySlot = calculateEquipmentBySlot(
		props.character.equipment_slots || {},
		Array.isArray(props.character.equipment) ? props.character.equipment : []
	)
	emit('change')
}

function unequipSlot(slotId) {
	if (!props.character.equipment_slots) return
	const removedItemId = props.character.equipment_slots[slotId]
	props.character.equipment_slots[slotId] = null

	// Return to inventory if not already present
	if (removedItemId) {
		if (!props.character.inventory) props.character.inventory = { items: [] }
		if (!Array.isArray(props.character.inventory.items)) props.character.inventory.items = []
		const existing = props.character.inventory.items.find((it) => it.itemId === removedItemId)
		if (existing) {
			existing.quantity = (existing.quantity || 1) + 1
		} else {
			props.character.inventory.items.push({ itemId: removedItemId, quantity: 1 })
		}
	}

	syncEquipmentBySlot()
}

function unequipAll() {
	if (!props.character.equipment_slots) return
	for (const slotId of Object.keys(props.character.equipment_slots)) {
		unequipSlot(slotId)
	}
}

// Slot picker
function openSlotPicker(slotId) {
	activePickerSlot.value = slotId
	pickerSearchQuery.value = ''
}

const compatibleSlotItems = computed(() => {
	if (!activePickerSlot.value) return []
	const slotId = activePickerSlot.value
	const q = pickerSearchQuery.value.trim().toLowerCase()

	return props.itemsList.filter((item) => {
		if (!item || !item.id) return false
		const itemSlot = item.slot
		const matchesSlot = Array.isArray(itemSlot) ? itemSlot.includes(slotId) : itemSlot === slotId
		if (!matchesSlot) return false

		if (!q) return true
		const name = (item.name || '').toLowerCase()
		const id = (item.id || '').toLowerCase()
		return name.includes(q) || id.includes(q)
	})
})

function selectItemForSlot(slotId, item) {
	if (!props.character.equipment_slots) props.character.equipment_slots = {}
	props.character.equipment_slots[slotId] = item.id
	syncEquipmentBySlot()
	activePickerSlot.value = null
}

// Inventory helpers
const inventoryItemsList = computed(() => {
	return Array.isArray(props.character?.inventory?.items) ? props.character.inventory.items : []
})

const filteredInventoryItems = computed(() => {
	const q = invSearchQuery.value.trim().toLowerCase()
	return inventoryItemsList.value.filter((invItem) => {
		if (!invItem || !invItem.itemId) return false
		const def = itemsMap.value[invItem.itemId]
		const name = (def?.name || invItem.itemId).toLowerCase()
		const id = invItem.itemId.toLowerCase()

		if (q && !name.includes(q) && !id.includes(q)) return false

		if (activeFilterTab.value === 'equipment') {
			return Boolean(def?.slot)
		}
		if (activeFilterTab.value === 'other') {
			return !def?.slot
		}
		return true
	})
})

const emptyInventorySlotsCount = computed(() => {
	const current = filteredInventoryItems.value.length
	if (current >= MIN_INVENTORY_GRID_CELLS) {
		const remainder = current % 4
		return remainder === 0 ? 0 : 4 - remainder
	}
	return MIN_INVENTORY_GRID_CELLS - current
})

function selectInventoryItem(invItem) {
	selectedInvItem.value = invItem
}

function onInvItemDoubleClick(invItem) {
	if (isInvItemEquippableType(invItem) && canEquipInvItem(invItem)) {
		equipInvItem(invItem)
	}
}

function getInvItemDef(itemId) {
	return itemsMap.value[itemId] || { id: itemId, name: itemId }
}

function getInvItemName(itemId) {
	const def = getInvItemDef(itemId)
	return def?.name || def?.id || itemId
}

function getInvItemRarityColor(itemId) {
	const def = getInvItemDef(itemId)
	return def?.rarity ? getRarityColor(def.rarity) : '#e2e8f0'
}

function getInvItemRarityStyle(itemId) {
	const def = getInvItemDef(itemId)
	return def?.rarity ? getRarityBadgeStyle(def.rarity) : {}
}

function formatSlotPill(slot) {
	if (!slot) return ''
	if (Array.isArray(slot)) return slot.map((s) => getSlotShortName(s)).join(' / ')
	return getSlotShortName(slot)
}

function isItemStackable(itemId) {
	const def = getInvItemDef(itemId)
	return def?.stackable !== false
}

function isInvItemEquippableType(invItem) {
	const def = getInvItemDef(invItem.itemId)
	return Boolean(def?.slot)
}

function getInvItemTooltip(invItem) {
	const def = getInvItemDef(invItem.itemId)
	const lines = [def.name || invItem.itemId]
	if (def.rarity) lines.push(`Редкость: ${def.rarity}`)
	if (def.slot) lines.push(`Слот: ${formatSlotPill(def.slot)}`)
	if (def.lvl_min) lines.push(`Минимальный уровень: ${def.lvl_min}`)
	if (invItem.quantity > 1) lines.push(`Количество: ${invItem.quantity}`)
	if (isItemEquipped(invItem.itemId)) lines.push(`(Надето на персонаже)`)
	if (def.stats) {
		lines.push('Параметры:')
		for (const [k, v] of Object.entries(def.stats)) {
			lines.push(`  ${k}: ${v}`)
		}
	}
	return lines.join('\n')
}

function canEquipInvItem(invItem) {
	const def = getInvItemDef(invItem.itemId)
	if (!def?.slot) return false
	return canCharacterEquipItem(props.character, def, invItem)
}

function canEquipItemDef(itemDef) {
	if (!itemDef) return false
	return canCharacterEquipItem(props.character, itemDef, null)
}

function getEquipBlockedReasons(invItem) {
	const def = getInvItemDef(invItem.itemId)
	return getEquipRestrictionReasons(props.character, def)
}

function getDefEquipBlockedReasons(itemDef) {
	return getEquipRestrictionReasons(props.character, itemDef)
}

function adjustItemQty(invItem, delta) {
	const current = invItem.quantity || 1
	const next = current + delta
	if (next <= 0) {
		removeInvItem(invItem)
	} else {
		invItem.quantity = next
		emit('change')
	}
}

function setItemQty(invItem, value) {
	const num = parseInt(value, 10)
	if (isNaN(num) || num <= 0) {
		removeInvItem(invItem)
	} else {
		invItem.quantity = num
		emit('change')
	}
}

function removeInvItem(invItem) {
	if (!props.character?.inventory?.items) return
	const idx = props.character.inventory.items.indexOf(invItem)
	if (idx !== -1) {
		props.character.inventory.items.splice(idx, 1)
		if (selectedInvItem.value === invItem) {
			selectedInvItem.value = null
		}
		emit('change')
	}
}

function equipInvItem(invItem) {
	const def = getInvItemDef(invItem.itemId)
	if (!def?.slot) return

	let targetSlot = null
	if (Array.isArray(def.slot)) {
		targetSlot = def.slot.find((s) => !props.character.equipment_slots?.[s]) || def.slot[0]
	} else {
		targetSlot = def.slot
	}

	equipInvItemToSpecificSlot(invItem, targetSlot)
}

function equipInvItemToSpecificSlot(invItem, targetSlot) {
	if (!targetSlot) return

	const oldItem = props.character.equipment_slots?.[targetSlot]
	if (!props.character.equipment_slots) props.character.equipment_slots = {}
	props.character.equipment_slots[targetSlot] = invItem.itemId

	// Decrease quantity or remove from inventory
	if ((invItem.quantity || 1) > 1) {
		invItem.quantity -= 1
	} else {
		removeInvItem(invItem)
	}

	// Put old item in inventory if there was one
	if (oldItem) {
		const existing = props.character.inventory.items.find((it) => it.itemId === oldItem)
		if (existing) {
			existing.quantity = (existing.quantity || 1) + 1
		} else {
			props.character.inventory.items.push({ itemId: oldItem, quantity: 1 })
		}
	}

	syncEquipmentBySlot()
}

// Catalog modal
const catalogFilteredItems = computed(() => {
	const q = catalogSearchQuery.value.trim().toLowerCase()
	return props.itemsList.filter((it) => {
		if (!it || !it.id) return false
		if (!q) return true
		const name = (it.name || '').toLowerCase()
		const id = it.id.toLowerCase()
		return name.includes(q) || id.includes(q)
	})
})

function addItemToInventory(item) {
	if (!props.character.inventory) props.character.inventory = { items: [] }
	if (!Array.isArray(props.character.inventory.items)) props.character.inventory.items = []

	const existing = props.character.inventory.items.find((it) => it.itemId === item.id)
	if (existing && item.stackable !== false) {
		existing.quantity = (existing.quantity || 1) + 1
	} else {
		props.character.inventory.items.push({
			itemId: item.id,
			quantity: 1
		})
	}
	emit('change')
}

function resolveAssetPath(path) {
	if (!path) return ''
	if (path.startsWith('http://') || path.startsWith('https://')) return path
	return path.startsWith('/') ? path : `/${path}`
}
</script>

<style scoped>
.char-equip-tab {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	color: #e2e8f0;
}

.equip-tab-columns {
	display: grid;
	grid-template-columns: 26em 1fr;
	gap: 1.4em;
	align-items: start;
}

/* LEFT COLUMN: Avatar & Equipment */
.equip-left-col {
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.avatar-preview-card,
.slots-section-card,
.inventory-section-card {
	background: rgba(18, 26, 43, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 1.2em;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.35);
}

.avatar-preview-header,
.slots-header,
.inv-card-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
	margin-bottom: 0.8em;
	padding-bottom: 0.6em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.aph-icon,
.sh-icon,
.ich-icon {
	font-size: 1.3em;
}

.aph-title,
.sh-title,
.ich-title {
	font-size: 1.05em;
	font-weight: 700;
	color: #f8fafc;
	flex: 1;
}

.sh-subhint {
	font-size: 0.8em;
	color: #94a3b8;
	font-style: italic;
}

.aph-gender-badge {
	font-size: 1.1em;
	background: rgba(255, 255, 255, 0.08);
	padding: 0.15em 0.5em;
	border-radius: 0.4em;
}

.avatar-stage {
	width: 100%;
	height: 16em;
	background: radial-gradient(circle at center, rgba(30, 41, 59, 0.7) 0%, rgba(10, 15, 29, 0.95) 100%);
	border-radius: 0.5em;
	border: 1px solid rgba(255, 255, 255, 0.08);
	overflow: hidden;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: inset 0 0 2em rgba(0, 0, 0, 0.7);
}

.avatar-char-wrapper {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: scale(0.85);
}

.avatar-fallback-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.8em;
}

.avatar-fallback-img {
	max-height: 10em;
	object-fit: contain;
	filter: drop-shadow(0 0.4em 1em rgba(0, 0, 0, 0.6));
}

.avatar-fallback-emoji {
	font-size: 4em;
}

.avatar-fallback-name {
	font-size: 1.05em;
	font-weight: bold;
	color: #cbd5e1;
}

.avatar-footer-info {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.6em;
	margin-top: 0.8em;
	font-size: 0.85em;
	color: #94a3b8;
}

.avatar-footer-info strong {
	color: #fbbf24;
}

.unequip-all-btn {
	background: rgba(239, 68, 68, 0.18);
	border: 1px solid rgba(239, 68, 68, 0.35);
	color: #fca5a5;
	font-size: 0.85em;
	padding: 0.2em 0.6em;
	border-radius: 0.3em;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;
}

.unequip-all-btn:hover {
	background: rgba(239, 68, 68, 0.35);
	border-color: #ef4444;
}

/* ==========================================================================
   UNIFIED SQUARE GRIDS: Equipment (4 cols) & Inventory (auto-fill)
   ========================================================================== */

.equipment-grid {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 0.5em;
	width: 100%;
}

.inventory-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(5.2em, 1fr));
	gap: 0.5em;
	width: 100%;

	&.inventory-grid-main {
		overflow-y: auto;
		max-height: 25em;
		padding-right: 0.3em;
	}
}

.inventory-grid-item {
	aspect-ratio: 1;
	width: 100%;
	height: 100%;
	display: flex;
}

.inventory-grid-slot {
	aspect-ratio: 1;
	background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
	background-color: var(--card-bg, #1e293b);
	border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
	border-radius: 0.35em;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	width: 100%;
	height: 100%;
	cursor: pointer;
	overflow: hidden;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

	&:hover {
		border-color: rgba(212, 175, 55, 0.6);
		background-color: var(--card-bg-hover, rgba(30, 41, 59, 0.9));
		box-shadow: 0 0 0.6em rgba(212, 175, 55, 0.25);
		transform: translateY(-0.1em);
	}

	&.__selected {
		border-color: var(--color-primary, #d4af37) !important;
		background-color: rgba(212, 175, 55, 0.15) !important;
		box-shadow:
			inset 0 0 0.6em rgba(212, 175, 55, 0.3),
			0 0 0.8em rgba(212, 175, 55, 0.4) !important;
	}

	&.__restricted {
		opacity: 0.65;
	}

	&.__empty {
		background: rgba(15, 23, 42, 0.4);
		border: 1px dashed rgba(255, 255, 255, 0.12);

		&:hover {
			border-color: var(--color-primary, #d4af37);
			border-style: solid;
			background: rgba(212, 175, 55, 0.08);
		}
	}

	&.empty-slot {
		background: rgba(0, 0, 0, 0.2);
		border: 1px dashed rgba(255, 255, 255, 0.06);
		cursor: default;

		&:hover {
			border-color: rgba(255, 255, 255, 0.1);
			transform: none;
			box-shadow: none;
		}

		.empty-slot-dot {
			color: rgba(255, 255, 255, 0.15);
			font-size: 1.2em;
		}
	}
}

/* Empty Slot Placeholder Inside Square */
.empty-slot-content {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.15em;
	padding: 0.25em;
	position: relative;
	text-align: center;
}

.empty-slot-icon {
	font-size: 1.3em;
	line-height: 1;
	opacity: 0.6;
}

.empty-slot-name {
	font-size: 0.68em;
	line-height: 1.1;
	color: #94a3b8;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 95%;
}

.empty-slot-plus {
	display: none;
	position: absolute;
	inset: 0;
	align-items: center;
	justify-content: center;
	background: rgba(212, 175, 55, 0.2);
	color: #fbbf24;
	font-size: 1.6em;
	font-weight: bold;
}

.inventory-grid-slot.__empty:hover .empty-slot-plus {
	display: flex;
}

/* Slot Badges & Controls in Square */
.slot-badge-top-left {
	position: absolute;
	top: 0.2em;
	left: 0.25em;
	font-size: 0.75em;
	line-height: 1;
	opacity: 0.8;
	z-index: 2;
	pointer-events: none;
}

.slot-unequip-corner-btn {
	position: absolute;
	top: 0.15em;
	right: 0.15em;
	background: rgba(239, 68, 68, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.3);
	color: #fff;
	border-radius: 0.2em;
	width: 1.25em;
	height: 1.25em;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 0.7em;
	line-height: 1;
	cursor: pointer;
	opacity: 0;
	transition: opacity 0.15s, background 0.15s;
	z-index: 3;
}

.inventory-grid-slot:hover .slot-unequip-corner-btn {
	opacity: 1;
}

.slot-unequip-corner-btn:hover {
	background: #ef4444;
}

/* Item Content Inside Square */
.inventory-item-content {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.15em;
	padding: 0.3em 0.2em;
	position: relative;
}

.item-icon {
	font-size: 1.25em;
	line-height: 1;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 2.3em;
	height: 2.3em;
}

.item-sprite-img {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
	image-rendering: pixelated;
}

.item-fallback-icon {
	font-size: 1.4em;
	line-height: 1;
}

.item-info {
	width: 100%;
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 0;
}

.item-name {
	font-size: 0.68em;
	text-align: center;
	word-break: break-word;
	line-height: 1.15;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-box-orient: vertical;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	padding: 0 0.15em;
}

.item-badges {
	position: absolute;
	top: 0.2em;
	left: 0.2em;
	display: flex;
	gap: 0.2em;
	z-index: 2;
	pointer-events: none;
}

.item-badge {
	font-size: 0.65em;
	line-height: 1;
	background: rgba(0, 0, 0, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.2em;
	padding: 0.1em 0.25em;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.item-quantity {
	position: absolute;
	bottom: 0.15em;
	right: 0.2em;
	background: rgba(0, 0, 0, 0.88);
	color: #fbbf24;
	border: 1px solid rgba(251, 191, 36, 0.4);
	font-size: 0.65em;
	font-weight: bold;
	padding: 0.08em 0.3em;
	border-radius: 0.25em;
	min-width: 1.2em;
	text-align: center;
	line-height: 1;
}

/* RIGHT COLUMN: Inventory Section */
.equip-right-col {
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.add-inv-item-btn {
	background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(37, 99, 235, 0.15));
	border: 1px solid rgba(59, 130, 246, 0.45);
	color: #93c5fd;
	font-size: 0.85em;
	padding: 0.4em 0.85em;
	border-radius: 0.35em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.add-inv-item-btn:hover {
	background: rgba(59, 130, 246, 0.4);
	border-color: #60a5fa;
	color: #ffffff;
}

.inv-toolbar {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	margin-bottom: 0.8em;
}

.inv-search-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.4em 0.8em;
}

.inv-search-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: #f8fafc;
	font-size: 0.9em;
	font-family: Kurale, sans-serif;
}

.inv-filters-row {
	display: flex;
	gap: 0.4em;
	flex-wrap: wrap;
}

.btn-filter {
	background-color: var(--card-bg, rgba(15, 23, 42, 0.6));
	border: 1px solid var(--card-border, rgba(255, 255, 255, 0.1));
	border-radius: 0.35em;
	color: #ccc;
	padding: 0.35em 0.85em;
	font-family: Kurale, sans-serif;
	font-size: 0.85em;
	cursor: pointer;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

	&:hover {
		background-color: var(--card-bg-hover, rgba(30, 41, 59, 0.8));
		border-color: rgba(255, 255, 255, 0.25);
		color: #fff;
	}

	&.active {
		background-color: rgba(212, 175, 55, 0.15);
		border-color: var(--color-primary, #d4af37);
		color: #fbbf24;
		box-shadow: 0 0 0.6em rgba(212, 175, 55, 0.3);
		font-weight: 600;
	}
}

.inv-grid-wrapper {
	background: rgba(0, 0, 0, 0.2);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.8em;
	margin-bottom: 0.8em;
}

/* Bottom Item Inspector Panel */
.item-inspector-card {
	background: rgba(15, 23, 42, 0.95);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.8em 1em;
	min-height: 4.8em;
	display: flex;
	align-items: center;
}

.inspector-content {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1.2em;
	flex-wrap: wrap;
}

.insp-left {
	display: flex;
	align-items: center;
	gap: 0.8em;
	flex: 1;
	min-width: 14em;
}

.insp-icon-box {
	width: 3.2em;
	height: 3.2em;
	background: rgba(0, 0, 0, 0.5);
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.15);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	flex-shrink: 0;
}

.insp-sprite-img {
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
	image-rendering: pixelated;
}

.insp-fallback-icon {
	font-size: 1.8em;
}

.insp-details {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.insp-title-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.insp-name {
	font-size: 1.05em;
	font-weight: 700;
}

.insp-rarity-pill {
	font-size: 0.72em;
	padding: 0.1em 0.5em;
	border-radius: 0.25em;
	border: 1px solid rgba(255, 255, 255, 0.2);
}

.insp-sub-meta {
	display: flex;
	align-items: center;
	gap: 0.6em;
	font-size: 0.8em;
	color: #94a3b8;
}

.insp-slot-pill {
	background: rgba(255, 255, 255, 0.08);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	color: #cbd5e1;
}

.insp-restriction-msg {
	font-size: 0.78em;
	color: #fca5a5;
}

.insp-actions {
	display: flex;
	align-items: center;
	gap: 0.8em;
	flex-wrap: wrap;
}

.qty-counter {
	display: flex;
	align-items: center;
	gap: 0.3em;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.35em;
	padding: 0.2em 0.4em;
}

.qty-label {
	font-size: 0.78em;
	color: #94a3b8;
}

.qty-btn {
	width: 1.6em;
	height: 1.6em;
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f8fafc;
	border-radius: 0.25em;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	font-weight: bold;
	font-size: 0.9em;
}

.qty-btn:hover {
	background: rgba(255, 255, 255, 0.18);
}

.qty-input {
	width: 2.8em;
	background: transparent;
	border: none;
	color: #fbbf24;
	font-weight: bold;
	text-align: center;
	font-size: 0.9em;
	font-family: Kurale, sans-serif;
	outline: none;
}

.equip-btn-group {
	display: flex;
	gap: 0.4em;
}

.insp-btn-equip {
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.3), rgba(5, 150, 105, 0.2));
	border: 1px solid rgba(16, 185, 129, 0.5);
	color: #6ee7b7;
	font-size: 0.85em;
	padding: 0.4em 0.85em;
	border-radius: 0.35em;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;
}

.insp-btn-equip:hover:not(:disabled) {
	background: rgba(16, 185, 129, 0.45);
	color: #ffffff;
}

.insp-btn-equip:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	border-color: rgba(255, 255, 255, 0.1);
	color: #94a3b8;
}

.insp-btn-delete {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid rgba(239, 68, 68, 0.4);
	color: #fca5a5;
	font-size: 0.85em;
	padding: 0.4em 0.6em;
	border-radius: 0.35em;
	cursor: pointer;
}

.insp-btn-delete:hover {
	background: rgba(239, 68, 68, 0.35);
}

.insp-btn-close {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.1em;
	cursor: pointer;
	padding: 0.2em 0.4em;
}

.insp-btn-close:hover {
	color: #fff;
}

.inspector-hint {
	display: flex;
	align-items: center;
	gap: 0.6em;
	color: #94a3b8;
	font-size: 0.88em;
	font-style: italic;
	width: 100%;
}

.ih-icon {
	font-size: 1.2em;
}

/* ==========================================================================
   MODAL OVERLAYS & PICKERS
   ========================================================================== */

.picker-modal-overlay {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(0.25em);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 999;
	padding: 1.5em;
}

.picker-modal-card {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.18);
	border-radius: 0.7em;
	width: min(44em, 92%);
	max-height: 85%;
	display: flex;
	flex-direction: column;
	box-shadow: 0 1.5em 3em rgba(0, 0, 0, 0.7);
	overflow: hidden;
}

.pmc-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1em 1.2em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	background: rgba(30, 41, 59, 0.6);
}

.pmc-title-box {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.pmc-icon {
	font-size: 1.6em;
}

.pmc-title {
	font-size: 1.15em;
	font-weight: 700;
	color: #f8fafc;
}

.pmc-sub {
	font-size: 0.85em;
	color: #94a3b8;
}

.pmc-sub strong {
	color: #fbbf24;
}

.pmc-close-btn {
	background: none;
	border: none;
	color: #94a3b8;
	font-size: 1.2em;
	cursor: pointer;
	padding: 0.2em 0.5em;
	border-radius: 0.3em;
}

.pmc-close-btn:hover {
	color: #fff;
	background: rgba(255, 255, 255, 0.1);
}

.pmc-search-bar {
	padding: 0.8em 1.2em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(15, 23, 42, 0.5);
}

.pmc-items-scroll {
	padding: 1em 1.2em;
	overflow-y: auto;
	flex: 1;
	max-height: 25em;
}

.pmc-items-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(12em, 1fr));
	gap: 0.6em;
}

.pmc-item-tile {
	background: rgba(30, 41, 59, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.45em;
	padding: 0.6em;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
	cursor: pointer;
	transition: background 0.15s, border-color 0.15s;

	&:hover {
		background: rgba(51, 65, 85, 0.8);
		border-color: rgba(212, 175, 55, 0.5);
	}

	&.__cant_equip {
		opacity: 0.6;
	}

	&.__currently_equipped {
		border-color: rgba(16, 185, 129, 0.5);
		background: rgba(16, 185, 129, 0.1);
	}
}

.pmc-tile-top {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.pmc-icon-box {
	width: 2.4em;
	height: 2.4em;
	background: rgba(0, 0, 0, 0.4);
	border-radius: 0.35em;
	border: 1px solid rgba(255, 255, 255, 0.12);
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	flex-shrink: 0;
}

.pmc-tile-info {
	flex: 1;
	min-width: 0;
}

.pmc-item-name {
	font-size: 0.88em;
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.pmc-item-meta {
	font-size: 0.75em;
	color: #94a3b8;
	display: flex;
	gap: 0.4em;
}

.pmc-restriction-warning {
	font-size: 0.72em;
	color: #fca5a5;
}

.pmc-tile-action {
	display: flex;
	align-items: center;
	justify-content: flex-end;
}

.pick-btn {
	background: rgba(212, 175, 55, 0.2);
	border: 1px solid rgba(212, 175, 55, 0.5);
	color: #fbbf24;
	font-size: 0.78em;
	padding: 0.25em 0.6em;
	border-radius: 0.3em;
	cursor: pointer;
	width: 100%;
}

.pick-btn:hover:not(:disabled) {
	background: rgba(212, 175, 55, 0.35);
}

.pick-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
	border-color: rgba(255, 255, 255, 0.1);
	color: #94a3b8;
}

.equipped-badge {
	color: #34d399;
	font-size: 0.8em;
	font-weight: bold;
	text-align: center;
	width: 100%;
}

.pmc-empty-msg {
	text-align: center;
	color: #94a3b8;
	font-style: italic;
	padding: 2em;
}

.pmc-footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 0.8em;
	padding: 0.8em 1.2em;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(15, 23, 42, 0.7);
}

.pmc-unequip-btn {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid rgba(239, 68, 68, 0.4);
	color: #fca5a5;
	font-size: 0.85em;
	padding: 0.4em 0.85em;
	border-radius: 0.35em;
	cursor: pointer;
}

.pmc-unequip-btn:hover {
	background: rgba(239, 68, 68, 0.35);
}

.pmc-cancel-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	font-size: 0.85em;
	padding: 0.4em 0.85em;
	border-radius: 0.35em;
	cursor: pointer;
}

.pmc-cancel-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}
</style>
