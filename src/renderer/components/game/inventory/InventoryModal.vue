<template>
	<div v-if="isVisible" class="modal _inventory" @click="closeModal">
		<div class="modal-content" @click.stop>
			<div class="modal-header">
				<h2 class="modal-title">{{ character?.name }} - Инвентарь</h2>
				<button class="btn-close" @click="closeModal">×</button>
			</div>

			<div class="modal-body inventory-layout">
				<div class="left-panel">
					<div class="char-preview">
						<Character :character="character" />
					</div>

					<div class="slots-grid">
						<div
							v-for="(value, slot) in equipmentSlots"
							:key="slot"
							class="slot"
							@dragover.prevent
							@drop="onDropToSlot($event, slot)"
						>
							<div
								v-if="value"
								class="slot-item"
								draggable="true"
								@dragstart="onSlotDragStart($event, slot)"
							>
								<img v-if="getItemSprite(value)" :src="getItemSprite(value)" :alt="value" />
								<span v-else class="slot-id">{{ value }}</span>
							</div>
							<div v-else class="slot-empty">—</div>
						</div>
					</div>
				</div>

				<div class="right-panel">
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
					</div>

					<!-- Tab Content -->
					<div class="tab-content">
						<InventoryItems
							v-show="activeTab === 'inventory'"
							:items="inventoryItems"
							:items-data="propsItemsData"
							@drag-inventory-drop="handleInventoryDrop"
						/>

						<InventoryStats v-show="activeTab === 'statistics'" :character="character" />

						<InventoryAbilities v-show="activeTab === 'abilities'" :abilities="abilities" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import InventoryItems from './InventoryItems.vue'
import InventoryStats from './InventoryStats.vue'
import InventoryAbilities from './InventoryAbilities.vue'
import Character from '../characters/Character.vue'

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

const emit = defineEmits(['close', 'equip', 'unequip', 'swap'])

const activeTab = ref('inventory')

const tabs = [
	{ id: 'inventory', label: '🎒 Инвентарь' },
	{ id: 'statistics', label: '📊 Статистика' },
	{ id: 'abilities', label: '✨ Способности' }
]

const inventoryItems = computed(() => {
	if (!props.character?.inventory?.items) return []

	return props.character.inventory.items.map(invItem => {
		// Получаем описание предмета из itemsData (equipment или other)
		const itemDef = props.itemsData[invItem.itemId] || {
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

// expose itemsData under a local name for template prop binding
const propsItemsData = props.itemsData

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

function getItemSprite(itemId) {
	if (!props.itemsData) return null
	const def = props.itemsData[itemId]
	if (!def) return null
	return def.sprite || def.image || def.icon || null
}

function onSlotDragStart(e, slot) {
	try {
		const payload = { type: 'slot', slot, itemId: equipmentSlots.value[slot] }
		e.dataTransfer.setData('application/json', JSON.stringify(payload))
		e.dataTransfer.effectAllowed = 'move'
	} catch (err) {
		console.error('slot drag start', err)
	}
}

function onDropToSlot(e, slot) {
	try {
		const raw = e.dataTransfer.getData('application/json')
		if (!raw) return
		const payload = JSON.parse(raw)

		if (payload.type === 'item') {
			// equipping an item from inventory into slot
			emit('equip', { slot, itemId: payload.itemId })
			return
		}

		if (payload.type === 'slot') {
			// swapping between slots
			emit('swap', { from: payload.slot, to: slot })
			return
		}
	} catch (err) {
		console.error('drop to slot parse error', err)
	}
}

function handleInventoryDrop(payload) {
	// payload forwarded from InventoryItems when user drops something onto inventory
	if (!payload || !payload.type) return
	if (payload.type === 'slot') {
		emit('unequip', { slot: payload.slot })
	}
}
</script>

