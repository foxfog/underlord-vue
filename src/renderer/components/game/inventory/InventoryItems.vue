<template>
	<div class="tab-content-item inventory-layout">
		<InventoryContextMenu
			:character="character"
			:items-data="itemsData"
			:equipment-slots="equipmentSlots"
			:inventory-items="items"
			@equip="handleContextMenuEquip"
			@unequip="handleContextMenuUnequip"
			@drop="handleContextMenuDrop"
			ref="contextMenu"
		/>
		<div class="left-panel">
			<div class="char-preview">
				<Character :character="characterPreview" />
			</div>
			<div class="equipment-grid">
				<div
					v-for="(value, slot) in allAvailableSlots"
					:key="slot"
					class="inventory-grid-item"
				>
					<div class="inventory-grid-slot" :data-slot="slot" data-panel="equipment">
						<div
							v-if="value"
							class="inventory-item draggable-item"
							:data-item-id="value"
							:data-from="slot"
							:data-type="'slot'"
							touch-action="none"
							@mouseenter="onItemHover(value)"
							@mouseleave="onItemLeave"
							@contextmenu.prevent="showEquipmentContextMenu($event, value, slot)"
						>
							<div class="inventory-item-content">
								<div class="item-badges" v-if="!isItemIdDroppable(value) || !isItemIdEquippable(value)">
									<span v-if="!isItemIdDroppable(value)" class="item-badge _undroppable" title="Нельзя выбросить">
										🔒
									</span>
									<span v-if="!isItemIdEquippable(value)" class="item-badge _unequippable" title="Нельзя снять">
										🚫
									</span>
								</div>
								<div v-if="getItemSprite(value)" class="item-icon">
									<img :src="getItemSprite(value)" :alt="getItemName(value)" />
								</div>
								<div v-else class="item-icon">📦</div>
								<div class="item-info">
									<div class="item-name">{{ getItemName(value) }}</div>
								</div>
							</div>
						</div>
						<div v-else class="inventory-slot-empty">{{ slot }}</div>
					</div>
				</div>
			</div>
		</div>

		<div class="right-panel">
			<div class="inventory-section">
				<div class="inventory-filters">
					<button
						v-for="filter in filters"
						:key="filter.value"
						class="btn-filter"
						:class="{ active: currentFilter === filter.value }"
						@click="setFilter(filter.value)"
					>
						{{ filter.label }}
					</button>
				</div>

				<!-- Inventory Grid with Empty Slots -->
				<div class="inventory-grid inventory-grid-main">
					<div
						v-for="(item, index) in currentPageSlots"
						:key="`slot-${(currentPage - 1) * SLOTS_PER_PAGE + index}`"
						class="inventory-grid-item"
					>
						<div class="inventory-grid-slot" data-panel="inventory">
							<div
								v-if="item"
								class="inventory-item draggable-item"
								:data-item-id="item.itemId"
								:data-quantity="item.quantity"
								:data-type="'item'"
								touch-action="none"
								@mouseenter="onItemHover(item.itemId)"
								@mouseleave="onItemLeave"
								@contextmenu.prevent="
									showInventoryContextMenu(
										$event,
										item.itemId,
										(currentPage - 1) * SLOTS_PER_PAGE +
											currentPageSlots.indexOf(item)
									)
								"
							>
								<div class="inventory-item-content">
									<div
										v-if="!isItemDroppable(item) || !isItemEquippable(item)"
										class="item-badges"
									>
										<span
											v-if="!isItemDroppable(item)"
											class="item-badge _undroppable"
											title="Нельзя выбросить"
										>
											🔒
										</span>
										<span
											v-if="!isItemEquippable(item)"
											class="item-badge _unequippable"
											title="Нельзя экипировать"
										>
											🚫
										</span>
									</div>
									<div v-if="getItemSprite(item.itemId)" class="item-icon">
										<img
											:src="getItemSprite(item.itemId)"
											:alt="getItemName(item.itemId)"
										/>
									</div>
									<div v-else class="item-icon">📦</div>
									<div class="item-info">
										<div class="item-name">{{ getItemName(item.itemId) }}</div>
									</div>
									<div
										v-if="isItemStackable(item.itemId) && item.quantity > 1"
										class="item-quantity"
									>
										x{{ item.quantity }}
									</div>
								</div>
							</div>
							<div v-else class="empty-slot"></div>
						</div>
					</div>
				</div>

				<!-- Pagination Controls -->
				<div class="pagination-controls">
					<button
						:disabled="currentPage <= 1"
						@click="goToPage(currentPage - 1)"
						class="btn-pagination"
					>
						← Назад
					</button>

					<div class="page-info">Страница {{ currentPage }} / {{ totalPages }}</div>

					<button
						:disabled="currentPage >= totalPages"
						@click="goToPage(currentPage + 1)"
						class="btn-pagination"
					>
						Вперед →
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import Character from '../characters/Character.vue'
import InventoryContextMenu from './InventoryContextMenu.vue'
import interact from 'interactjs'
import { canCharacterEquipItem } from '@/utils/equipment'

const props = defineProps({
	character: { type: Object, default: null },
	items: { type: Array, default: () => [] },
	itemsData: { type: Object, default: () => ({}) },
	equipmentSlots: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['drag-inventory-drop', 'equip', 'unequip', 'swap', 'drop'])

const contextMenu = ref(null)

const filters = [
	{ value: 'all', label: 'Все' },
	{ value: 'equipment', label: 'Экипировка' },
	{ value: 'other', label: 'Остальное' },
	{ value: 'junk', label: 'Мусор' },
	{ value: 'currency', label: 'Валюта' }
]

const currentFilter = ref('all')

const draggedItemSlots = ref([])
const isDragging = ref(false)
const draggedElement = ref(null)
const draggedItemId = ref(null)
const draggedFromType = ref(null)
const draggedFromSlot = ref(null)
const currentCompatibleSlots = ref([])
const dropWasSuccessful = ref(false)

let dragAvatar = null
let dragDelta = { x: 0, y: 0 }

// Inventory pagination
const SLOTS_PER_PAGE = 60
const currentPage = ref(1)

const filteredItems = computed(() => {
	const filtered = props.items.filter((item) => matchesFilter(item))
	const totalSlots = SLOTS_PER_PAGE * 10
	const slots = [...filtered]
	while (slots.length < totalSlots) {
		slots.push(null)
	}
	return slots
})

const currentPageSlots = computed(() => {
	const startIdx = (currentPage.value - 1) * SLOTS_PER_PAGE
	const endIdx = startIdx + SLOTS_PER_PAGE
	return filteredItems.value.slice(startIdx, endIdx)
})

const totalPages = computed(() => {
	return Math.ceil(filteredItems.value.length / SLOTS_PER_PAGE)
})

function setFilter(value) {
	currentFilter.value = value
	currentPage.value = 1
}

const allAvailableSlots = computed(() => {
	if (!props.character?.equipment_slots) return {}
	return props.character.equipment_slots
})

const characterPreview = computed(() => {
	if (!props.character) return null
	return {
		...props.character,
		orientation: 'right',
		back: false,
		position: { l: 0, t: 0 },
		fromPosition: null,
		animationDuration: 0
	}
})

function goToPage(page) {
	const validPage = Math.max(1, Math.min(page, totalPages.value))
	currentPage.value = validPage
}

function getItemName(id) {
	const def = props.itemsData[id]
	if (!def) return id
	return def.name || def.id || id
}

function getItemSprite(id) {
	const def = props.itemsData[id]
	return def?.sprite || null
}

function isItemStackable(id) {
	const def = props.itemsData[id]
	return def?.stackable !== false
}

function isItemDroppable(item) {
	if (!item) return true
	const itemDef = props.itemsData[item.itemId]
	return (
		item.can_drop !== false &&
		item.droppable !== false &&
		itemDef?.can_drop !== false &&
		itemDef?.droppable !== false
	)
}

function isItemIdDroppable(itemId) {
	if (!itemId) return true
	const itemDef = props.itemsData[itemId]
	return itemDef?.can_drop !== false && itemDef?.droppable !== false
}

function isItemIdEquippable(itemId) {
	if (!itemId) return true
	const itemDef = props.itemsData[itemId]
	return (
		itemDef?.can_equip !== false &&
		itemDef?.equippable !== false &&
		itemDef?.can_unequip !== false
	)
}

function isItemEquippable(item) {
	if (!item) return true
	const itemDef = props.itemsData[item.itemId]
	return (
		item.can_equip !== false &&
		item.equippable !== false &&
		itemDef?.can_equip !== false &&
		itemDef?.equippable !== false
	)
}

function getItemTags(id) {
	const def = props.itemsData[id]
	if (!def || !def.tags) return []
	if (Array.isArray(def.tags)) return def.tags
	if (typeof def.tags === 'string') return [def.tags]
	return []
}

function isEquipmentItem(id) {
	const def = props.itemsData[id]
	return !!def?.slot
}

function matchesFilter(item) {
	if (!item) return false
	const itemId = item.itemId
	const tags = getItemTags(itemId)

	switch (currentFilter.value) {
		case 'equipment':
			return isEquipmentItem(itemId)
		case 'other':
			return !isEquipmentItem(itemId)
		case 'junk':
			return tags.includes('junk')
		case 'currency':
			return tags.includes('currency')
		default:
			return true
	}
}

function getItemSlots(itemId) {
	const def = props.itemsData[itemId]
	if (!def) {
		console.warn(`Item ${itemId} not found in itemsData!`)
		return []
	}
	const slot = def.slot
	if (Array.isArray(slot)) return slot
	if (slot) return [slot]
	return []
}

function showEquipmentContextMenu(event, itemId, slot) {
	contextMenu.value?.show(event, itemId, 'equipment', slot)
}

function showInventoryContextMenu(event, itemId, inventoryIndex) {
	contextMenu.value?.show(event, itemId, 'inventory', null, inventoryIndex)
}

function handleContextMenuEquip({ itemId, slot, inventoryIndex }) {
	emit('equip', { slot, itemId, inventoryIndex })
}

function handleContextMenuUnequip({ slot, itemId, stackable }) {
	emit('unequip', { slot, itemId, stackable })
}

function handleContextMenuDrop({ itemId, source, slot, quantity = 1 }) {
	if (source === 'equipment') {
		const itemDef = props.itemsData[itemId]
		const isStackable = itemDef?.stackable !== false
		emit('unequip', { slot, itemId, stackable: isStackable })
	}
	emit('drop', { itemId, source, slot, quantity })
}

function highlightCompatibleSlots(itemId) {
	if (!itemId) {
		clearSlotHighlights()
		return
	}
	const invItem = props.items.find((item) => item && item.itemId === itemId)
	const itemDef = props.itemsData[itemId]
	const canEquip = canCharacterEquipItem(props.character, itemDef, invItem)

	if (!canEquip) {
		clearSlotHighlights()
		return
	}

	const compatibleSlots = getItemSlots(itemId)
	currentCompatibleSlots.value = compatibleSlots

	document.querySelectorAll('.left-panel .inventory-grid-slot').forEach((slot) => {
		const slotName = slot.getAttribute('data-slot')
		if (compatibleSlots.includes(slotName)) {
			slot.classList.add('compatible')
			slot.classList.remove('incompatible')
		} else {
			slot.classList.remove('compatible')
			slot.classList.add('incompatible')
		}
	})
}

function clearSlotHighlights() {
	document.querySelectorAll('.left-panel .inventory-grid-slot').forEach((slot) => {
		slot.classList.remove('compatible')
		slot.classList.remove('incompatible')
		slot.classList.remove('drag-over')
		slot.classList.remove('invalid-drag-over')
	})
	document.querySelectorAll('.inventory-grid-main .inventory-grid-slot').forEach((slot) => {
		slot.classList.remove('drag-over')
	})
	currentCompatibleSlots.value = []
	draggedItemSlots.value = []
}

function onItemHover(itemId) {
	if (isDragging.value) return
	highlightCompatibleSlots(itemId)
}

function onItemLeave() {
	if (isDragging.value) return
	clearSlotHighlights()
}

function isDropAllowed(targetSlot, targetPanel) {
	if (!draggedItemId.value) return false

	if (targetPanel === 'inventory') {
		if (draggedFromType.value === 'slot') {
			if (!isItemIdEquippable(draggedItemId.value)) {
				return false
			}
		}
		return true
	}

	if (targetPanel === 'equipment') {
		const invItem = props.items.find(
			(item) => item && item.itemId === draggedItemId.value
		)
		const itemDef = props.itemsData[draggedItemId.value]
		const canEquip = canCharacterEquipItem(props.character, itemDef, invItem)

		if (!canEquip) return false

		const compatibleSlots = getItemSlots(draggedItemId.value)
		if (!compatibleSlots.includes(targetSlot)) {
			return false
		}

		if (draggedFromType.value === 'slot') {
			const fromSlot = draggedFromSlot.value
			if (fromSlot === targetSlot) return false

			if (!isItemIdEquippable(draggedItemId.value)) {
				return false
			}

			const toItemId = allAvailableSlots.value[targetSlot]
			if (toItemId) {
				if (!isItemIdEquippable(toItemId)) {
					return false
				}
				const toItemSlots = getItemSlots(toItemId)
				if (!toItemSlots.includes(fromSlot)) {
					return false
				}
			}
		}

		return true
	}

	return false
}

function handleDragOutsideDrop({ itemId, source, slot }) {
	if (source === 'inventory') {
		const invIndex = props.items.findIndex((item) => item && item.itemId === itemId)
		if (invIndex === -1) return
		const invItem = props.items[invIndex]
		if (!isItemDroppable(invItem)) return

		contextMenu.value?.initiateDrop({
			itemId,
			source: 'inventory',
			slot: null,
			inventoryIndex: invIndex
		})
	} else if (source === 'equipment') {
		if (!isItemIdDroppable(itemId)) return
		if (!isItemIdEquippable(itemId)) return

		contextMenu.value?.initiateDrop({
			itemId,
			source: 'equipment',
			slot
		})
	}
}

function resetItemPosition(element) {
	if (element) {
		element.style.transform = ''
		element.removeAttribute('data-x')
		element.removeAttribute('data-y')
		element.style.zIndex = ''
		element.style.opacity = ''
	}

	isDragging.value = false
	clearSlotHighlights()
}

function setupDragAndDrop() {
	interact('.draggable-item')
		.resizable(false)
		.draggable({
			inertia: false,
			autoScroll: false,
			listeners: {
				start: (event) => {
					dropWasSuccessful.value = false
					const originalEl = event.target
					draggedElement.value = originalEl
					const itemId = originalEl.getAttribute('data-item-id')
					const fromType = originalEl.getAttribute('data-type')
					const fromSlot = originalEl.getAttribute('data-from')

					draggedItemId.value = itemId
					draggedFromType.value = fromType
					draggedFromSlot.value = fromSlot
					isDragging.value = true

					// Highlight equipment slots for the dragged item
					highlightCompatibleSlots(itemId)

					// Create unconstrained drag avatar on body so it is not hidden by overflow
					const rect = originalEl.getBoundingClientRect()
					dragAvatar = originalEl.cloneNode(true)
					dragAvatar.classList.add('_drag-avatar')
					dragAvatar.style.position = 'fixed'
					dragAvatar.style.left = `${rect.left}px`
					dragAvatar.style.top = `${rect.top}px`
					dragAvatar.style.width = `${rect.width}px`
					dragAvatar.style.height = `${rect.height}px`
					dragAvatar.style.zIndex = '99999'
					dragAvatar.style.pointerEvents = 'none'
					dragAvatar.style.margin = '0'
					dragAvatar.style.transform = 'translate3d(0, 0, 0)'
					dragAvatar.style.boxShadow =
						'0 0.6em 1.8em rgba(0, 0, 0, 0.8), 0 0 0.8em var(--color-primary-alpha)'
					dragAvatar.style.opacity = '0.95'
					dragAvatar.style.borderRadius = '0.35em'
					dragAvatar.style.backgroundColor = 'var(--card-bg)'
					dragAvatar.style.border = '1px solid var(--color-primary)'

					document.body.appendChild(dragAvatar)
					originalEl.style.opacity = '0.25'
					dragDelta = { x: 0, y: 0 }
				},
				move: (event) => {
					dragDelta.x += event.delta.x
					dragDelta.y += event.delta.y
					if (dragAvatar) {
						dragAvatar.style.transform = `translate3d(${dragDelta.x}px, ${dragDelta.y}px, 0)`
					}
				},
				end: (event) => {
					if (dragAvatar && dragAvatar.parentNode) {
						dragAvatar.parentNode.removeChild(dragAvatar)
					}
					dragAvatar = null

					const target = event.target
					resetItemPosition(target)

					if (!dropWasSuccessful.value && draggedItemId.value) {
						const clientX =
							event.clientX ||
							(event.client && event.client.x) ||
							(event.page && event.page.x) ||
							0
						const clientY =
							event.clientY ||
							(event.client && event.client.y) ||
							(event.page && event.page.y) ||
							0
						const dropTarget = document.elementFromPoint(clientX, clientY)
						const isInsideLayout = dropTarget && dropTarget.closest('.inventory-layout')

						if (!isInsideLayout) {
							const itemId = draggedItemId.value
							const source =
								draggedFromType.value === 'slot' ? 'equipment' : 'inventory'
							const slot = draggedFromSlot.value
							handleDragOutsideDrop({ itemId, source, slot })
						}
					}

					draggedItemId.value = null
					draggedFromType.value = null
					draggedFromSlot.value = null
					draggedElement.value = null
					dropWasSuccessful.value = false
				}
			}
		})

	interact('.inventory-grid-slot').dropzone({
		accept: '.draggable-item',
		overlap: 'pointer',
		listeners: {
			dragenter: (event) => {
				const targetPanel = event.target.getAttribute('data-panel')
				const slot = event.target.getAttribute('data-slot')

				if (isDropAllowed(slot, targetPanel)) {
					event.target.classList.add('drag-over')
					event.target.classList.remove('invalid-drag-over')
				} else if (targetPanel === 'equipment') {
					event.target.classList.add('invalid-drag-over')
					event.target.classList.remove('drag-over')
				}
			},
			dragleave: (event) => {
				event.target.classList.remove('drag-over')
				event.target.classList.remove('invalid-drag-over')
			},
			drop: (event) => {
				event.preventDefault()
				event.target.classList.remove('drag-over')
				event.target.classList.remove('invalid-drag-over')
				const slot = event.target.getAttribute('data-slot')
				const targetPanel = event.target.getAttribute('data-panel')

				if (!isDropAllowed(slot, targetPanel)) {
					if (draggedElement.value) resetItemPosition(draggedElement.value)
					return
				}

				dropWasSuccessful.value = true

				if (draggedFromType.value === 'slot' && targetPanel === 'inventory') {
					const itemDef = props.itemsData[draggedItemId.value]
					const isStackable = itemDef?.stackable !== false
					emit('unequip', {
						slot: draggedFromSlot.value,
						itemId: draggedItemId.value,
						stackable: isStackable
					})
				} else if (draggedFromType.value === 'item' && targetPanel === 'equipment') {
					const currentItemInSlot = allAvailableSlots.value[slot]
					if (currentItemInSlot === draggedItemId.value) {
						if (draggedElement.value) resetItemPosition(draggedElement.value)
						return
					}
					const inventoryIndex = props.items.findIndex(
						(item) => item && item.itemId === draggedItemId.value
					)
					emit('equip', { slot, itemId: draggedItemId.value, inventoryIndex })
				} else if (draggedFromType.value === 'slot' && targetPanel === 'equipment') {
					const fromItemId = draggedItemId.value
					const fromSlot = draggedFromSlot.value
					const toItemId = allAvailableSlots.value[slot]

					if (!toItemId) {
						if (draggedElement.value) resetItemPosition(draggedElement.value)
						return
					}
					emit('swap', { from: fromSlot, to: slot })
				}

				if (draggedElement.value) {
					resetItemPosition(draggedElement.value)
				}
			}
		}
	})

	interact('.inventory-grid-main').dropzone({
		accept: '.draggable-item',
		overlap: 'pointer',
		listeners: {
			drop: (event) => {
				event.preventDefault()
				if (draggedFromType.value === 'slot') {
					if (!isItemIdEquippable(draggedItemId.value)) {
						if (draggedElement.value) resetItemPosition(draggedElement.value)
						return
					}
					dropWasSuccessful.value = true
					const itemDef = props.itemsData[draggedItemId.value]
					const isStackable = itemDef?.stackable !== false
					emit('unequip', {
						slot: draggedFromSlot.value,
						itemId: draggedItemId.value,
						stackable: isStackable
					})
				}
				if (draggedElement.value) {
					resetItemPosition(draggedElement.value)
				}
			}
		}
	})
}

function cleanupDragAndDrop() {
	if (dragAvatar && dragAvatar.parentNode) {
		dragAvatar.parentNode.removeChild(dragAvatar)
	}
	dragAvatar = null
	try {
		interact('.draggable-item').unset()
		interact('.inventory-grid-slot').unset()
		interact('.inventory-grid-main').unset()
	} catch (e) {
		// ignore
	}
}

onMounted(() => {
	setTimeout(() => {
		setupDragAndDrop()
	}, 100)
})

onBeforeUnmount(() => {
	cleanupDragAndDrop()
})

watch(
	() => [props.items, props.equipmentSlots],
	() => {
		cleanupDragAndDrop()
		setTimeout(() => {
			setupDragAndDrop()
		}, 50)
	},
	{ deep: true }
)
</script>
