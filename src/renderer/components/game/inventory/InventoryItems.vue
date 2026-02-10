<template>
	<div>
		<div v-if="items && items.length > 0" class="inventory-list" @dragover.prevent @drop="onDropToInventory">
			<div
				v-for="item in items"
				:key="item.itemId"
				class="inventory-item"
				draggable="true"
				@dragstart="onDragStart($event, item)"
			>
				<div class="item-icon">📦</div>
				<div class="item-info">
					<div class="item-name">{{ getItemName(item.itemId) }}</div>
					<div class="item-weight">Вес: {{ getItemWeight(item.itemId) }}</div>
				</div>
				<div class="item-quantity" v-if="item.quantity > 1">x{{ item.quantity }}</div>
			</div>
		</div>
		<div v-else class="empty-message">Инвентарь пуст</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	items: { type: Array, default: () => [] },
	itemsData: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['drag-inventory-drop'])

function onDragStart(e, item) {
	const payload = { type: 'item', itemId: item.itemId }
	e.dataTransfer.setData('application/json', JSON.stringify(payload))
	e.dataTransfer.effectAllowed = 'move'
}

function onDropToInventory(e) {
	try {
		const raw = e.dataTransfer.getData('application/json')
		if (!raw) return
		const payload = JSON.parse(raw)
		// forward to parent modal: e.g., unequip from slot
		emit('drag-inventory-drop', payload)
	} catch (err) {
		console.error('drop to inventory parse error', err)
	}
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
