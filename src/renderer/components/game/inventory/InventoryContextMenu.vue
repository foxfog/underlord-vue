<template>
	<div>
		<ContextMenu ref="contextMenu" :actions="currentActions" @action="handleMenuAction" />
		<DropQuantityModal
			:is-visible="showDropModal"
			:item-name="currentItemName"
			:max-quantity="currentItemQuantity"
			@confirm="handleDropConfirm"
			@cancel="handleDropCancel"
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
	import ContextMenu from '../../UI/ContextMenu.vue'
	import DropQuantityModal from './DropQuantityModal.vue'
	import ItemInfoModal from './ItemInfoModal.vue'

	const props = defineProps({
		itemsData: { type: Object, default: () => ({}) },
		equipmentSlots: { type: Object, default: () => ({}) },
		inventoryItems: { type: Array, default: () => [] }
	})

	const emit = defineEmits(['equip', 'unequip', 'drop'])

	const contextMenu = ref(null)

	const showDropModal = ref(false)
	const dropPendingData = ref(null)

	const showInfoModal = ref(false)

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
	const currentItemSource = ref(null)  // 'equipment' or 'inventory'
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
		const result = []

		// Опция "Инфо" - для всех предметов
		result.push({
			label: 'Инфо',
			action: 'info'
		})

		// Опция "Выбросить" - для всех предметов
		result.push({
			label: 'Выбросить',
			action: 'drop'
		})

		// Опции одевания - только для предметов в инвентаре
		if (currentItemSource.value === 'inventory' && itemDef?.slot) {
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

		// Опция "Снять" - только для одетых предметов
		if (currentItemSource.value === 'equipment') {
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

	function handleMenuAction(action) {
		switch (action.action) {
			case 'info':
				showInfoModal.value = true
				break

			case 'drop':
				// Если в инвентаре и больше одного предмета - показываем модалку
				if (currentItemSource.value === 'inventory' && currentItemQuantity.value > 1) {
					dropPendingData.value = {
						itemId: currentItem.value,
						source: currentItemSource.value,
						slot: currentSlot.value
					}
					showDropModal.value = true
				} else {
					// Иначе сразу выбрасываем
					emit('drop', {
						itemId: currentItem.value,
						source: currentItemSource.value,
						slot: currentSlot.value,
						quantity: 1
					})
				}
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

	function handleDropConfirm(quantity) {
		showDropModal.value = false
		if (dropPendingData.value) {
			emit('drop', {
				...dropPendingData.value,
				quantity
			})
			dropPendingData.value = null
		}
	}

	function handleDropCancel() {
		showDropModal.value = false
		dropPendingData.value = null
	}

	function handleInfoClose() {
		showInfoModal.value = false
	}

	defineExpose({
		show
	})
</script>
