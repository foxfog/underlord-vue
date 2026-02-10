<template>
	<div class="tab-content-item inventory-layout">
		<div class="left-panel">
			<div class="char-preview">
				<Character :character="character" />
			</div>
			<div class="slots-grid">
				<div
					v-for="(value, slot) in equipmentSlots"
					:key="slot"
					class="slot"
					:class="{ 'compatible': isCompatibleSlot(slot), 'incompatible': isDraggedItem && !isCompatibleSlot(slot) }"
					@dragover.prevent="onSlotDragOver($event, slot)"
					@dragleave="onSlotDragLeave"
					@drop="onDropToSlot($event, slot)"
				>
					<div v-if="value" class="slot-item inventory-item-content" draggable="true" @dragstart="onSlotDragStart($event, slot)">
						<div class="item-icon">📦</div>
						<div class="item-info">
							<div class="item-name">{{ getItemName(value) }}</div>
						</div>
					</div>
					<div v-else class="slot-empty">{{ slot }}</div>
				</div>
			</div>
		</div>

		<div class="right-panel">
			<div class="inventory-section">
				<div v-if="items && items.length > 0" class="inventory-list" @dragover.prevent @drop="onDropToInventory">
					<div
						v-for="item in items"
						:key="item.itemId"
						class="inventory-item"
						draggable="true"
						@dragstart="onInventoryDragStart($event, item)"
						@dragend="onInventoryDragEnd"
					>
						<div class="inventory-item-content">
							<div class="item-icon">📦</div>
							<div class="item-info">
								<div class="item-name">{{ getItemName(item.itemId) }}</div>
							</div>
							<div class="item-quantity" v-if="item.quantity > 1">x{{ item.quantity }}</div>
						</div>
					</div>
				</div>
				<div v-else class="empty-message">Инвентарь пуст</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import Character from '../characters/Character.vue'

const props = defineProps({
	character: { type: Object, default: null },
	items: { type: Array, default: () => [] },
	itemsData: { type: Object, default: () => ({}) },
	equipmentSlots: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['drag-inventory-drop', 'equip', 'unequip', 'swap'])

const isDraggedItem = ref(false)
const draggedItemSlots = ref([])

function getItemSlots(itemId) {
	const def = props.itemsData[itemId]
	if (!def) return []
	const slot = def.slot
	if (Array.isArray(slot)) return slot
	if (slot) return [slot]
	return []
}

function isCompatibleSlot(slot) {
	return draggedItemSlots.value.includes(slot)
}

function onInventoryDragStart(e, item) {
	isDraggedItem.value = true
	draggedItemSlots.value = getItemSlots(item.itemId)
	const payload = { type: 'item', itemId: item.itemId }
	e.dataTransfer.setData('application/json', JSON.stringify(payload))
	e.dataTransfer.effectAllowed = 'move'
}

function onInventoryDragEnd() {
	isDraggedItem.value = false
	draggedItemSlots.value = []
}

function onDropToInventory(e) {
	try {
		const raw = e.dataTransfer.getData('application/json')
		if (!raw) return
		const payload = JSON.parse(raw)
		emit('drag-inventory-drop', payload)
	} catch (err) {
		console.error('drop to inventory parse error', err)
	}
}

function onSlotDragStart(e, slot) {
	try {
		const itemId = props.equipmentSlots[slot]
		const payload = { type: 'slot', slot, itemId }
		e.dataTransfer.setData('application/json', JSON.stringify(payload))
		e.dataTransfer.effectAllowed = 'move'
	} catch (err) {
		console.error('slot drag start', err)
	}
}

function onSlotDragOver(e, slot) {
	if (!isCompatibleSlot(slot)) {
		e.dataTransfer.dropEffect = 'none'
		return
	}
	e.dataTransfer.dropEffect = 'move'
}

function onSlotDragLeave() {
	// Optional: can add visual feedback
}

function onDropToSlot(e, slot) {
	try {
		const raw = e.dataTransfer.getData('application/json')
		if (!raw) return
		const payload = JSON.parse(raw)

		if (payload.type === 'item') {
			// Check if item is compatible with this slot
			if (!isCompatibleSlot(slot)) {
				console.warn(`Item ${payload.itemId} is not compatible with slot ${slot}`)
				return
			}
			emit('equip', { slot, itemId: payload.itemId })
			return
		}

		if (payload.type === 'slot') {
			// Swapping between slots
			emit('swap', { from: payload.slot, to: slot })
			return
		}
	} catch (err) {
		console.error('drop to slot parse error', err)
	}
}

function getItemSprite(itemId) {
	if (!props.itemsData) return null
	const def = props.itemsData[itemId]
	if (!def) return null
	return def.sprite || def.image || def.icon || null
}

function getItemName(id) {
	const def = props.itemsData[id] || { name: id }
	return def.name || def.id || id
}

function getItemWeight(id) {
	const def = props.itemsData[id] || {}
	return def.weight || 0
}
</script>
