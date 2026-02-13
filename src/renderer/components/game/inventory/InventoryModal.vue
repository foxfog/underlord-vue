<template>
	<div v-if="isVisible" class="modal _inventory" @click="closeModal">
		<div class="modal-content" @click.stop>
			<div class="modal-body">
				<!-- Tabs Navigation -->
				<div class="modal-tabs">
					<button
						v-for="tab in tabs"
						:key="tab.id"
						class="modal-tab"
						:class="{ active: activeTab === tab.id }"
						@click="activeTab = tab.id"
					>
						{{ tab.label }}
					</button>
					<button class="btn-close" @click="closeModal">×</button>
				</div>

				<!-- Tab Content -->
				<div class="tab-content">
					<InventoryItems
						v-show="activeTab === 'inventory'"
						:character="character"
						:items="props.character?.inventory?.items || []"
						:items-data="propsItemsData"
						:equipment-slots="equipmentSlots"
						@equip="(e) => emit('equip', e)"
						@unequip="(e) => emit('unequip', e)"
						@swap="(e) => emit('swap', e)"
						@drop="(e) => emit('drop', e)"
						@drag-inventory-drop="handleInventoryDrop"
					/>

					<InventoryStats v-show="activeTab === 'statistics'" :character="character" />

					<InventoryAbilities v-show="activeTab === 'abilities'" :abilities="abilities" />
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed, ref, watch } from 'vue'
	import InventoryItems from './InventoryItems.vue'
	import InventoryStats from './InventoryStats.vue'
	import InventoryAbilities from './InventoryAbilities.vue'

	const props = defineProps({
		isVisible: {
			type: Boolean,
			default: false
		},
		character: {
			type: Object,
			default: null
		},
		itemsData: {
			type: Object,
			default: () => ({})
		}
	})

	const emit = defineEmits(['close', 'equip', 'unequip', 'swap', 'drop'])

	const activeTab = ref('inventory')

	// Create a reactive copy of itemsData to ensure it updates properly
	const localItemsData = ref({})

	// Watch for changes and update local copy
	watch(() => props.itemsData, (newData) => {
		console.log('InventoryModal: itemsData updated', newData, Object.keys(newData))
		if (newData && typeof newData === 'object') {
			localItemsData.value = { ...newData }
		}
	}, { deep: true, immediate: true })

	// Expose itemsData under a local name for template prop binding
	const propsItemsData = computed(() => localItemsData.value)

	const tabs = [
		{ id: 'inventory', label: 'Инвентарь' },
		{ id: 'statistics', label: 'Статистика' },
		{ id: 'abilities', label: 'Способности' }
	]

	const inventoryItems = computed(() => {
		if (!props.character?.inventory?.items) return []

		return props.character.inventory.items.map(invItem => {
			// Получаем описание предмета из itemsData (equipment или other)
			const itemDef = localItemsData.value[invItem.itemId] || {
				id: invItem.itemId,
				name: invItem.itemId
			}

			return {
				itemId: invItem.itemId,
				itemName: itemDef.name || itemDef.id,
				weight: itemDef.weight || 0,
				quantity: invItem.quantity || 1
			}
		})
	})

	const abilities = computed(() => {
		if (!props.character?.abilities) return []

		return props.character.abilities.map(ability => ({
			id: ability.id || ability.name,
			name: ability.name,
			description: ability.description || 'Нет описания'
		}))
	})

	const hpPercentage = computed(() => {
		if (!props.character) return 0
		const hp = props.character.stats?.hp ?? props.character.hp ?? 0
		const hpmax = props.character.stats?.hpmax ?? props.character.hpmax ?? 0
		return hpmax > 0 ? (hp / hpmax) * 100 : 0
	})

	const mpPercentage = computed(() => {
		if (!props.character) return 0
		const mp = props.character.stats?.mp ?? props.character.mp ?? 0
		const mpmax = props.character.stats?.mpmax ?? props.character.mpmax ?? 0
		return mpmax > 0 ? (mp / mpmax) * 100 : 0
	})

	function closeModal() {
		activeTab.value = 'inventory'
		emit('close')
	}

	const equipmentSlots = computed(() => {
		if (!props.character) return {}
		return (
			props.character.equipment_slots ||
			props.character.equipmentSlots ||
			props.character.equipment || {}
		)
	})

	function handleInventoryDrop(payload) {
		// payload forwarded from InventoryItems when user drops something onto inventory
		if (!payload || !payload.type) return
		if (payload.type === 'slot') {
			emit('unequip', { slot: payload.slot })
		}
	}
</script>

