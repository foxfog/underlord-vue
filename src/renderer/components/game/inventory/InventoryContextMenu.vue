<template>
	<div>
		<ContextMenu ref="contextMenu" :actions="currentActions" @action="handleMenuAction" />
		<DropQuantityModal
			:is-visible="showDropModal"
			:item-name="currentItemName"
			:max-quantity="currentItemQuantity"
			@confirm="handleDropQuantityConfirm"
			@cancel="handleDropCancel"
		/>
		<ConfirmModal
			:visible="showConfirmModal"
			:title="confirmTitle"
			:message="confirmMessage"
			confirm-text="Выбросить"
			cancel-text="Отмена"
			@confirm="handleConfirmDrop"
			@cancel="handleConfirmCancel"
		/>
		<ItemInfoModal
			:is-visible="showInfoModal"
			:item-id="currentItem"
			:item-def="currentItemDef"
			:quantity="currentItemQuantity"
			:source="currentItemSource"
			:slot="currentSlot"
			@close="handleInfoClose"
		/>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRegisterModal } from '@/composables/useModalStack'
import ContextMenu from '../../UI/ContextMenu.vue'
import ConfirmModal from '@/components/ConfirmModal.vue'
import DropQuantityModal from './DropQuantityModal.vue'
import ItemInfoModal from './ItemInfoModal.vue'
import { canCharacterEquipItem } from '@/utils/equipment'

const props = defineProps({
	character: { type: Object, default: null },
	itemsData: { type: Object, default: () => ({}) },
	equipmentSlots: { type: Object, default: () => ({}) },
	inventoryItems: { type: Array, default: () => [] }
})

const emit = defineEmits(['equip', 'unequip', 'drop'])

const contextMenu = ref(null)

const showDropModal = ref(false)
const dropPendingData = ref(null)

const showConfirmModal = ref(false)
const confirmTitle = ref('Выбросить предмет?')
const confirmMessage = ref('')
const dropPendingPayload = ref(null)

const showInfoModal = ref(false)

useRegisterModal('inventory-drop-modal', showDropModal, handleDropCancel)
useRegisterModal('inventory-drop-confirm-modal', showConfirmModal, handleConfirmCancel)
useRegisterModal('inventory-info-modal', showInfoModal, handleInfoClose)

const slotNames = {
	head: 'голова',
	neck: 'шея',
	neck_1: 'шея (1)',
	neck_2: 'шея (2)',
	chest: 'грудь',
	back: 'спина',
	hands: 'руки',
	left_hand: 'левая рука',
	right_hand: 'правая рука',
	legs: 'ноги',
	feet: 'ноги',
	mask: 'лицо',
	waist: 'пояс'
}

const currentItem = ref(null)
const currentItemSource = ref(null) // 'equipment' or 'inventory'
const currentSlot = ref(null)
const currentInventoryIndex = ref(null)

function getSlotDisplayName(slot) {
	return slotNames[slot] || slot.charAt(0).toUpperCase() + slot.slice(1)
}

const currentItemName = computed(() => {
	const itemDef = props.itemsData[currentItem.value]
	return itemDef?.name || currentItem.value || 'предмет'
})

const currentItemDef = computed(() => {
	return currentItem.value ? props.itemsData[currentItem.value] || null : null
})

const currentItemQuantity = computed(() => {
	if (currentItemSource.value === 'inventory' && currentInventoryIndex.value !== null) {
		const item = props.inventoryItems[currentInventoryIndex.value]
		return item?.quantity || 1
	}
	return 1
})

const currentActions = computed(() => {
	if (!currentItem.value) return []

	const itemDef = props.itemsData[currentItem.value]
	const invItem =
		currentItemSource.value === 'inventory' && currentInventoryIndex.value !== null
			? props.inventoryItems[currentInventoryIndex.value]
			: null

	const canDrop =
		invItem?.can_drop !== false &&
		invItem?.droppable !== false &&
		itemDef?.can_drop !== false &&
		itemDef?.droppable !== false

	const canEquip = canCharacterEquipItem(props.character, itemDef, invItem)

	const canUnequip =
		itemDef?.can_equip !== false &&
		itemDef?.equippable !== false &&
		itemDef?.can_unequip !== false

	const result = []

	// Опция "Инфо" - для всех предметов
	result.push({
		label: 'Инфо',
		action: 'info'
	})

	// Опция "Выбросить" - только для предметов, которые можно выбрасывать
	if (canDrop && (currentItemSource.value !== 'equipment' || canUnequip)) {
		result.push({
			label: 'Выбросить',
			action: 'drop'
		})
	}

	// Опции одевания - только для предметов в инвентаре, которые можно экипировать
	if (currentItemSource.value === 'inventory' && itemDef?.slot && canEquip) {
		const slots = Array.isArray(itemDef.slot) ? itemDef.slot : [itemDef.slot]

		for (const slot of slots) {
			const slotDisplayName = getSlotDisplayName(slot)
			result.push({
				label: `Одеть на ${slotDisplayName}`,
				action: 'equip',
				slot: slot
			})
		}
	}

	// Опция "Снять" - только для одетых предметов, которые можно снять
	if (currentItemSource.value === 'equipment' && canUnequip) {
		result.push({
			label: 'Снять',
			action: 'unequip'
		})
	}

	return result
})

function show(event, itemId, source, slot = null, inventoryIndex = null) {
	currentItem.value = itemId
	currentItemSource.value = source
	currentSlot.value = slot
	currentInventoryIndex.value = inventoryIndex

	contextMenu.value?.show(event)
}

function initiateDrop({ itemId, source, slot = null, inventoryIndex = null }) {
	currentItem.value = itemId
	currentItemSource.value = source
	currentSlot.value = slot
	currentInventoryIndex.value =
		inventoryIndex !== null && inventoryIndex !== undefined
			? inventoryIndex
			: source === 'inventory'
				? props.inventoryItems.findIndex((i) => i && i.itemId === itemId)
				: null

	const itemDef = props.itemsData[itemId]
	const invItem =
		source === 'inventory' && currentInventoryIndex.value !== null
			? props.inventoryItems[currentInventoryIndex.value]
			: null

	const canDrop =
		invItem?.can_drop !== false &&
		invItem?.droppable !== false &&
		itemDef?.can_drop !== false &&
		itemDef?.droppable !== false

	const canUnequip =
		itemDef?.can_equip !== false &&
		itemDef?.equippable !== false &&
		itemDef?.can_unequip !== false

	if (!canDrop) return
	if (source === 'equipment' && !canUnequip) return

	const itemName = itemDef?.name || itemDef?.id || itemId || 'предмет'
	const qty = currentItemQuantity.value

	if (source === 'inventory' && qty > 1) {
		dropPendingData.value = {
			itemId,
			source,
			slot,
			itemName
		}
		showDropModal.value = true
	} else {
		dropPendingPayload.value = {
			itemId,
			source,
			slot,
			quantity: 1
		}
		confirmTitle.value = 'Выбросить предмет?'
		confirmMessage.value = `Вы действительно хотите выбросить «${itemName}»?`
		showConfirmModal.value = true
	}
}

function handleMenuAction(action) {
	switch (action.action) {
		case 'info':
			showInfoModal.value = true
			break

		case 'drop':
			initiateDrop({
				itemId: currentItem.value,
				source: currentItemSource.value,
				slot: currentSlot.value,
				inventoryIndex: currentInventoryIndex.value
			})
			break

		case 'equip':
			emit('equip', {
				itemId: currentItem.value,
				slot: action.slot,
				inventoryIndex: currentInventoryIndex.value
			})
			break

		case 'unequip':
			const itemDef = props.itemsData[currentItem.value]
			const isStackable = itemDef?.stackable !== false
			emit('unequip', {
				slot: currentSlot.value,
				itemId: currentItem.value,
				stackable: isStackable
			})
			break
	}
}

function handleDropQuantityConfirm(quantity) {
	showDropModal.value = false
	if (dropPendingData.value) {
		const data = { ...dropPendingData.value }
		dropPendingPayload.value = {
			itemId: data.itemId,
			source: data.source,
			slot: data.slot,
			quantity
		}
		confirmTitle.value = 'Выбросить предмет?'
		confirmMessage.value = `Вы действительно хотите выбросить «${data.itemName}» (${quantity} шт.)?`
		showConfirmModal.value = true
		dropPendingData.value = null
	}
}

function handleDropCancel() {
	showDropModal.value = false
	dropPendingData.value = null
}

function handleConfirmDrop() {
	showConfirmModal.value = false
	if (dropPendingPayload.value) {
		const payload = { ...dropPendingPayload.value }
		if (payload.source === 'equipment') {
			const itemDef = props.itemsData[payload.itemId]
			const isStackable = itemDef?.stackable !== false
			emit('unequip', {
				slot: payload.slot,
				itemId: payload.itemId,
				stackable: isStackable
			})
		}
		emit('drop', payload)
		dropPendingPayload.value = null
	}
}

function handleConfirmCancel() {
	showConfirmModal.value = false
	dropPendingPayload.value = null
}

function handleInfoClose() {
	showInfoModal.value = false
}

defineExpose({
	show,
	initiateDrop
})
</script>
