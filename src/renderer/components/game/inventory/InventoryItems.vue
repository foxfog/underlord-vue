<template>
	<div class="tab-content-item inventory-layout">
		<div class="left-panel">
			<div class="char-preview">
				<Character :character="character" />
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
						class="inventory-item-content draggable-item" 
						:data-item-id="value"
						:data-from="slot"
						:data-type="'slot'"
						touch-action="none"
					>
						<div class="item-icon">📦</div>
						<div class="item-info">
							<div class="item-name">{{ getItemName(value) }}</div>
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
						>
							<div class="inventory-item-content">
								<div class="item-icon">📦</div>
								<div class="item-info">
									<div class="item-name">{{ getItemName(item.itemId) }}</div>
								</div>
								<div class="item-quantity" v-if="item.quantity > 1">x{{ item.quantity }}</div>
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
import interact from 'interactjs'

const props = defineProps({
	character: { type: Object, default: null },
	items: { type: Array, default: () => [] },
	itemsData: { type: Object, default: () => ({}) },
	equipmentSlots: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['drag-inventory-drop', 'equip', 'unequip', 'swap'])

// Fallback data for items if they're not loaded yet
const fallbackItemData = {
	'gasmask': { id: 'gasmask', slot: 'mask', name: 'Gas Mask' },
	'tshirt': { id: 'tshirt', slot: 'torso-1', name: 'T-Shirt' },
	'tshirt-red': { id: 'tshirt-red', slot: 'torso-1', name: 'Red T-Shirt' },
	'sword-diamond': { id: 'sword-diamond', slot: ['hand-left', 'hand-right'], name: 'Diamond Sword' },
	'pendant-zen': { id: 'pendant-zen', slot: 'neck', name: 'Zen Pendant' },
	'ygdrasil-coin-old': { id: 'ygdrasil-coin-old', slot: [], name: 'Old Ygdrasil Coin' },
	'ygdrasil-coin-new': { id: 'ygdrasil-coin-new', slot: [], name: 'New Ygdrasil Coin' }
}

const draggedItemSlots = ref([])
const isDragging = ref(false)
const draggedElement = ref(null)
const draggedItemId = ref(null)
const draggedFromType = ref(null)
const draggedFromSlot = ref(null)
const currentCompatibleSlots = ref([])  // Сохраняем совместимые слоты отдельно

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

function goToPage(page) {
	const validPage = Math.max(1, Math.min(page, totalPages.value))
	currentPage.value = validPage
}

function getItemName(id) {
	const def = props.itemsData[id] || fallbackItemData[id] || { name: id }
	return def.name || def.id || id
}

function getItemSlots(itemId) {
	// Try to get from props.itemsData first, then fallback to fallbackItemData
	const def = props.itemsData[itemId] || fallbackItemData[itemId]
	console.log('getItemSlots:', { 
		itemId, 
		found: !!def, 
		def, 
		propsItemsDataKeys: Object.keys(props.itemsData),
		fallbackKeys: Object.keys(fallbackItemData)
	})
	if (!def) {
		console.warn(`Item ${itemId} not found in itemsData or fallback!`)
		return []
	}
	const slot = def.slot
	if (Array.isArray(slot)) return slot
	if (slot) return [slot]
	return []
}

function onItemHover(itemId) {
	draggedItemSlots.value = [...getItemSlots(itemId)]
	
	document.querySelectorAll('.slot').forEach(slot => {
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
	document.querySelectorAll('.slot').forEach(slot => {
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
	document.querySelectorAll('.slot').forEach(slot => {
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
					
					document.querySelectorAll('.slot').forEach(slot => {
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
					event.target.classList.add('drag-over')
				},
				dragleave: (event) => {
					event.target.classList.remove('drag-over')
				},
				drop: (event) => {
					event.preventDefault()
					event.target.classList.remove('drag-over')
					const slot = event.target.getAttribute('data-slot')
					const targetPanel = event.target.getAttribute('data-panel')
					
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
						console.log('Unequipping from slot to inventory:', { 
							slot: draggedFromSlot.value, 
							itemId: draggedItemId.value 
						})
						emit('unequip', { slot: draggedFromSlot.value, itemId: draggedItemId.value })
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
						emit('equip', { slot, itemId: draggedItemId.value })
					}
					// Если из слота в другой слот - меняем их местами или перемещаем
					else if (draggedFromType.value === 'slot' && targetPanel === 'equipment') {
						const fromItemId = draggedItemId.value
						const fromSlot = draggedFromSlot.value
						const toItemId = allAvailableSlots.value[slot] // Получаем текущий предмет в целевом слоте
						
						// Проверяем совместимость ПЕРЕМЕЩАЕМОГО предмета с целевым слотом
						const fromItemSlots = currentCompatibleSlots.value // Слоты, в которые может идти перемещаемый предмет
						if (!fromItemSlots.includes(slot)) {
							console.warn(`Item ${fromItemId} is not compatible with slot ${slot}`)
							if (draggedElement.value) {
								resetItemPosition(draggedElement.value)
							}
							return
						}
						
						// Если в целевом слоте есть предмет, проверяем совместимость ЦЕЛЕВОГО предмета с исходным слотом
						if (toItemId) {
							const toItemSlots = getItemSlots(toItemId)
							if (!toItemSlots.includes(fromSlot)) {
								console.warn(`Item ${toItemId} cannot be placed in slot ${fromSlot}`)
								if (draggedElement.value) {
									resetItemPosition(draggedElement.value)
								}
								return
							}
						}
						
						console.log('Swapping items:', { from: fromSlot, to: slot, fromItem: fromItemId, toItem: toItemId })
						emit('swap', { from: fromSlot, to: slot })
					}

					if (draggedElement.value) {
						resetItemPosition(draggedElement.value)
					}
				}
			}
		})

	// Setup dropzone for inventory
	interact('.inventory-grid-main')
		.dropzone({
			accept: '.draggable-item',
			overlap: 0.5,
			listeners: {
				drop: (event) => {
					event.preventDefault()
					
					if (draggedFromType.value === 'slot') {
						emit('unequip', { slot: draggedFromSlot.value, itemId: draggedItemId.value })
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
