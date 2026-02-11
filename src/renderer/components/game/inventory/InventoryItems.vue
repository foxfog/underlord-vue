<template>
	<div class="tab-content-item inventory-layout">
		<InventoryContextMenu
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
			<div class="inventory-grid">
				<div
					v-for="(value, slot) in allAvailableSlots"
					:key="slot"
					class="inventory-grid-slot"
					:data-slot="slot"
					data-panel="equipment"
				>
					<div v-if="value" 
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

		<div class="right-panel">
			<div class="inventory-section">
				<!-- Inventory Grid with Empty Slots -->
				<div class="inventory-grid inventory-grid-main">
					<div
						v-for="(item, index) in currentPageSlots"
						:key="`slot-${(currentPage - 1) * SLOTS_PER_PAGE + index}`"
						class="inventory-grid-slot"
						data-panel="inventory"
					>
						<div
							v-if="item"
							class="inventory-item draggable-item"
							:data-item-id="item.itemId"
							:data-quantity="item.quantity"
							:data-type="'item'"
							touch-action="none"
							@mouseenter="onItemHover(item.itemId)"
						@mouseleave="onItemLeave"
						@contextmenu.prevent="showInventoryContextMenu($event, item.itemId, (currentPage - 1) * SLOTS_PER_PAGE + currentPageSlots.indexOf(item))"
					>
							<div class="inventory-item-content">
								<div v-if="getItemSprite(item.itemId)" class="item-icon">
									<img :src="getItemSprite(item.itemId)" :alt="getItemName(item.itemId)" />
								</div>
								<div v-else class="item-icon">📦</div>
								<div class="item-info">
									<div class="item-name">{{ getItemName(item.itemId) }}</div>
								</div>
							<div v-if="isItemStackable(item.itemId) && item.quantity > 1" class="item-quantity">x{{ item.quantity }}</div>
							</div>
						</div>
						<div v-else class="empty-slot"></div>
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

					<div class="page-info">
						Страница {{ currentPage }} / {{ totalPages }}
					</div>

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

const props = defineProps({
	character: { type: Object, default: null },
	items: { type: Array, default: () => [] },
	itemsData: { type: Object, default: () => ({}) },
	equipmentSlots: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['drag-inventory-drop', 'equip', 'unequip', 'swap', 'drop'])

const contextMenu = ref(null)

const draggedItemSlots = ref([])
const isDragging = ref(false)
const draggedElement = ref(null)
const draggedItemId = ref(null)
const draggedFromType = ref(null)
const draggedFromSlot = ref(null)
const currentCompatibleSlots = ref([])  // Сохраняем совместимые слоты отдельно
const dropWasSuccessful = ref(false)  // Track if drop landed on valid zone

// Inventory pagination
const SLOTS_PER_PAGE = 30
const currentPage = ref(1)

const inventorySlots = computed(() => {
	// Create array of 30 pages worth of slots, filled with items or empty
	const totalSlots = SLOTS_PER_PAGE * 10  // 300 total slots (10 pages)
	const slots = []
	
	// Fill slots with items
	for (let i = 0; i < totalSlots; i++) {
		if (i < props.items.length) {
			slots.push(props.items[i])
		} else {
			slots.push(null)  // Empty slot
		}
	}
	
	return slots
})

const currentPageSlots = computed(() => {
	const startIdx = (currentPage.value - 1) * SLOTS_PER_PAGE
	const endIdx = startIdx + SLOTS_PER_PAGE
	return inventorySlots.value.slice(startIdx, endIdx)
})

const totalPages = computed(() => {
	return Math.ceil(inventorySlots.value.length / SLOTS_PER_PAGE)
})

// Получаем все доступные слоты (всегда показываем все слоты, даже если они пусты)
const allAvailableSlots = computed(() => {
	if (!props.character?.equipment_slots) return {}
	// Возвращаем ВСЕ слоты с их текущими значениями из equipmentSlots
	return props.character.equipment_slots
})

// Создаём объект персонажа для превью с дефолтной ориентацией
const characterPreview = computed(() => {
	if (!props.character) return null
	
	// Копируем все свойства персонажа, но переопределяем ориентацию на дефолтную
	return {
		...props.character,
		orientation: 'right',      // Всегда смотрит вправо в превью
		back: false,               // Всегда спереди в превью
		position: { l: 0, t: 0 },  // Центрируем в превью
		fromPosition: null,        // Отключаем анимацию входа в превью
		animationDuration: 0,      // Нет длительности анимации в превью
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
	return def?.stackable !== false  // по умолчанию stackable если не указано false
}

function getItemSlots(itemId) {
	const def = props.itemsData[itemId]
	console.log('getItemSlots:', { 
		itemId, 
		found: !!def, 
		def, 
		propsItemsDataKeys: Object.keys(props.itemsData)
	})
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
		// Dropping from equipment - unequip first
		const itemDef = props.itemsData[itemId]
		const isStackable = itemDef?.stackable !== false
		emit('unequip', { slot, itemId, stackable: isStackable })
	}
	// After unequipping (or if from inventory), emit drop event
	emit('drop', { itemId, source, slot, quantity })
}

function onItemHover(itemId) {
	draggedItemSlots.value = [...getItemSlots(itemId)]
	
	// Подсвечиваем только слоты оборудования в левой панели
	document.querySelectorAll('.left-panel .inventory-grid-slot').forEach(slot => {
		const slotName = slot.getAttribute('data-slot')
		if (draggedItemSlots.value.includes(slotName)) {
			slot.classList.add('compatible')
		} else {
			slot.classList.add('incompatible')
		}
	})
}

function onItemLeave() {
	draggedItemSlots.value = []
	// Очищаем подсвечивание только в левой панели
	document.querySelectorAll('.left-panel .inventory-grid-slot').forEach(slot => {
		slot.classList.remove('compatible')
		slot.classList.remove('incompatible')
	})
}

function dragMoveListener(event) {
	const target = event.target
	const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.delta.x
	const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.delta.y

	target.style.transform = `translate(${x}px, ${y}px)`
	target.setAttribute('data-x', x)
	target.setAttribute('data-y', y)
	target.style.zIndex = 1000
}

function resetItemPosition(element) {
	element.style.transform = 'translate(0px, 0px)'
	element.removeAttribute('data-x')
	element.removeAttribute('data-y')
	element.style.zIndex = ''
	
	// Очищаем подсвечивание слотов
	isDragging.value = false
	draggedItemSlots.value = []
	// НЕ очищаем currentCompatibleSlots здесь, так как он используется в drop событии
	document.querySelectorAll('.left-panel .inventory-grid-slot').forEach(slot => {
		slot.classList.remove('compatible')
		slot.classList.remove('incompatible')
	})
	
	// Очищаем currentCompatibleSlots после небольшой задержки
	setTimeout(() => {
		currentCompatibleSlots.value = []
	}, 100)
}

// Watch for itemsData changes
watch(() => props.itemsData, (newData) => {
	console.log('InventoryItems: itemsData updated', Object.keys(newData), newData)
}, { deep: true })

function setupDragAndDrop() {
	// Setup draggable items
	interact('.draggable-item')
		.resizable(false)
		.draggable({
			inertia: false,
			autoScroll: true,
			listeners: {
				start: (event) => {
					// Reset drop tracking
					dropWasSuccessful.value = false
					
					// Сохраняем информацию о перетаскиваемом элементе
					draggedElement.value = event.target
					const itemId = event.target.getAttribute('data-item-id')
					const fromType = event.target.getAttribute('data-type')
					const fromSlot = event.target.getAttribute('data-from')
					
					draggedItemId.value = itemId
					draggedFromType.value = fromType
					draggedFromSlot.value = fromSlot
					
					console.log('Drag start - before getItemSlots:', { 
						itemId, 
						fromType, 
						fromSlot,
						itemsDataKeys: Object.keys(props.itemsData),
						itemsDataLength: Object.keys(props.itemsData).length,
						itemsData: props.itemsData
					})
					
					// Сохраняем совместимые слоты для последующей проверки
					const slots = [...getItemSlots(itemId)]
					draggedItemSlots.value = slots
					currentCompatibleSlots.value = slots  // Сохраняем отдельно для drop события
					isDragging.value = true
					
					console.log('Drag start:', { itemId, fromType, fromSlot, slots })
					
					// Подсвечиваем только слоты оборудования в левой панели при перетаскивании
					document.querySelectorAll('.left-panel .inventory-grid-slot').forEach(slot => {
						const slotName = slot.getAttribute('data-slot')
						if (slots.includes(slotName)) {
							slot.classList.add('compatible')
						} else {
							slot.classList.add('incompatible')
						}
					})
				},
				move: dragMoveListener,
				end: (event) => {
					const target = event.target
					resetItemPosition(target)
					
					// If dragging from equipment slot to somewhere else without hitting a valid dropzone,
					// don't unequip. The drop handlers will mark dropWasSuccessful = true if valid.
					// This prevents items from disappearing when dropped outside the inventory.
					if (draggedFromType.value === 'slot' && dropWasSuccessful.value) {
						// For unequip to inventory (if drop was in empty space), emit unequip
						emit('unequip', { slot: draggedFromSlot.value, itemId: draggedItemId.value })
					}
					
					// Reset state
					draggedItemId.value = null
					draggedFromType.value = null
					draggedFromSlot.value = null
					draggedElement.value = null
					dropWasSuccessful.value = false
				}
			}
		})

	// Setup dropzones for slots
	interact('.inventory-grid-slot')
		.dropzone({
			accept: '.draggable-item',
			overlap: 0.5,
			listeners: {
				dragenter: (event) => {
					// Подсвечиваем желтым только совместимые слоты
					const targetPanel = event.target.getAttribute('data-panel')
					if (targetPanel === 'equipment') {
						const slot = event.target.getAttribute('data-slot')
						const compatibleSlots = currentCompatibleSlots.value
						if (compatibleSlots.includes(slot)) {
							event.target.classList.add('drag-over')
						}
					} else {
						// Для инвентаря подсвечиваем всегда
						event.target.classList.add('drag-over')
					}
				},
				dragleave: (event) => {
					event.target.classList.remove('drag-over')
				},
				drop: (event) => {
					event.preventDefault()
					event.target.classList.remove('drag-over')
					const slot = event.target.getAttribute('data-slot')
					const targetPanel = event.target.getAttribute('data-panel')
					
					// Mark drop as successful since we reached a valid dropzone
					dropWasSuccessful.value = true
					
					// Используем сохраненные совместимые слоты
					const compatibleSlots = currentCompatibleSlots.value
					
					console.log('Drop event:', { 
						slot, 
						targetPanel,
						draggedItemId: draggedItemId.value, 
						draggedFromType: draggedFromType.value, 
						compatibleSlots,
						match: compatibleSlots.includes(slot)
					})
					
					// Если из слота перетаскиваем в инвентарь - разэкипируем
					if (draggedFromType.value === 'slot' && targetPanel === 'inventory') {
					const itemDef = props.itemsData[draggedItemId.value]
						const isStackable = itemDef?.stackable !== false  // по умолчанию stackable если не указано false
						console.log('Unequipping from slot to inventory:', { 
							slot: draggedFromSlot.value, 
							itemId: draggedItemId.value,
							stackable: isStackable
						})
						emit('unequip', { slot: draggedFromSlot.value, itemId: draggedItemId.value, stackable: isStackable })
					}
					// Если из инвентаря в слот - экипируем
					else if (draggedFromType.value === 'item' && targetPanel === 'equipment') {
						// Проверяем совместимость слота
						if (!compatibleSlots.includes(slot)) {
							console.warn(`Item ${draggedItemId.value} is not compatible with slot ${slot}`)
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						// Проверяем, что слот либо пуст, либо содержит другой предмет
						const currentItemInSlot = allAvailableSlots.value[slot]
						if (currentItemInSlot === draggedItemId.value) {
							console.warn(`Cannot equip: slot ${slot} already contains the same item. Use swap to exchange items.`)
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						// Находим индекс предмета в инвентаре
						const inventoryIndex = inventorySlots.value.findIndex((item, idx) => {
							if (!item) return false
							return item.itemId === draggedItemId.value && idx >= (currentPage.value - 1) * SLOTS_PER_PAGE
						})
						console.log('Equipping item from inventory:', { slot, itemId: draggedItemId.value, inventoryIndex })
						emit('equip', { slot, itemId: draggedItemId.value, inventoryIndex })
					}
					// Если из слота в другой слот - меняем их местами только если оба содержат предметы
					else if (draggedFromType.value === 'slot' && targetPanel === 'equipment') {
						const fromItemId = draggedItemId.value
						const fromSlot = draggedFromSlot.value
						const toItemId = allAvailableSlots.value[slot]
						
						// Swap возможен ТОЛЬКО если в обоих слотах есть предметы
						if (!toItemId) {
							console.warn('Cannot swap: target slot is empty. Use unequip to move to inventory.')
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						// Проверяем совместимость ПЕРЕМЕЩАЕМОГО предмета с целевым слотом
						const fromItemSlots = currentCompatibleSlots.value
						if (!fromItemSlots.includes(slot)) {
							console.warn(`Item ${fromItemId} is not compatible with slot ${slot}`)
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						// Проверяем совместимость ЦЕЛЕВОГО предмета с исходным слотом
						const toItemSlots = getItemSlots(toItemId)
						if (!toItemSlots.includes(fromSlot)) {
							console.warn(`Item ${toItemId} cannot be placed in slot ${fromSlot}`)
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						console.log('Swapping items between slots:', { from: fromSlot, to: slot, fromItem: fromItemId, toItem: toItemId })
						emit('swap', { from: fromSlot, to: slot })
					}

					if (draggedElement.value) {
						resetItemPosition(draggedElement.value)
					}
				}
			}
		})

	// Setup dropzone for inventory - only handle drops that specifically missed other dropzones
	interact('.inventory-grid-main')
		.dropzone({
			accept: '.draggable-item',
			overlap: 0.5,
			listeners: {
				drop: (event) => {
					event.preventDefault()
					
					// Mark that drop was successful on inventory grid container
					// This handles drops in empty spaces of the inventory
					if (draggedFromType.value === 'slot') {
						dropWasSuccessful.value = true
					}

					if (draggedElement.value) {
						resetItemPosition(draggedElement.value)
					}
				}
			}
		})
}

function cleanupDragAndDrop() {
	interact('.draggable-item').unset()
	interact('.inventory-grid-slot').unset()
	interact('.inventory-grid-main').unset()
}

onMounted(() => {
	setTimeout(() => {
		setupDragAndDrop()
	}, 100)
})

onBeforeUnmount(() => {
	cleanupDragAndDrop()
})

// Re-setup when items change
watch(() => [props.items, props.equipmentSlots], () => {
	cleanupDragAndDrop()
	setTimeout(() => {
		setupDragAndDrop()
	}, 50)
}, { deep: true })
</script>
