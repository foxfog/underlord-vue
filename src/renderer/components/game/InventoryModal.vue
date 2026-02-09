<template>
	<div v-if="isVisible" class="modal" @click="closeModal">
		<div class="modal-content" @click.stop>
			<div class="modal-header">
				<h2 class="modal-title">{{ character?.name }} - Инвентарь</h2>
				<button class="btn-close" @click="closeModal">×</button>
			</div>

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
			<div class="modal-body">
				<!-- Inventory Tab -->
				<div v-show="activeTab === 'inventory'" class="tab-content">
					<div v-if="inventoryItems.length > 0" class="inventory-list">
						<div v-for="item in inventoryItems" :key="item.itemId" class="inventory-item">
							<div class="item-icon">📦</div>
							<div class="item-info">
								<div class="item-name">{{ item.itemName }}</div>
								<div class="item-weight">Вес: {{ item.weight }}</div>
							</div>
							<div class="item-quantity" v-if="item.quantity > 1">
								x{{ item.quantity }}
							</div>
						</div>
					</div>
					<div v-else class="empty-message">
						Инвентарь пуст
					</div>
				</div>

				<!-- Statistics Tab -->
				<div v-show="activeTab === 'statistics'" class="tab-content">
					<div class="stats-grid">
						<div class="stat-item">
							<span class="stat-label">HP:</span>
							<span class="stat-value">{{ (character?.stats?.hp ?? character?.hp) }} / {{ (character?.stats?.hpmax ?? character?.hpmax) }}</span>
							<div class="stat-bar">
								<div 
									class="stat-fill" 
									:style="{ width: hpPercentage + '%' }"
								></div>
							</div>
						</div>
						
						<div class="stat-item">
							<span class="stat-label">MP:</span>
							<span class="stat-value">{{ (character?.stats?.mp ?? character?.mp) }} / {{ (character?.stats?.mpmax ?? character?.mpmax) }}</span>
							<div class="stat-bar">
								<div 
									class="stat-fill mp" 
									:style="{ width: mpPercentage + '%' }"
								></div>
							</div>
						</div>
						
						<div class="stat-item">
							<span class="stat-label">Атака:</span>
							<span class="stat-value">{{ character?.stats?.attack ?? character?.attack }}</span>
						</div>

						<div class="stat-item">
							<span class="stat-label">Защита:</span>
							<span class="stat-value">{{ character?.stats?.defense ?? character?.defense ?? 0 }}</span>
						</div>
					</div>
				</div>

				<!-- Abilities Tab -->
				<div v-show="activeTab === 'abilities'" class="tab-content">
					<div v-if="abilities.length > 0" class="abilities-list">
						<div v-for="ability in abilities" :key="ability.id" class="ability-item">
							<div class="ability-name">{{ ability.name }}</div>
							<div class="ability-description">{{ ability.description }}</div>
						</div>
					</div>
					<div v-else class="empty-message">
						Способности не найдены
					</div>
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-primary" @click="closeModal">Закрыть</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'

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

const emit = defineEmits(['close'])

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
</script>
