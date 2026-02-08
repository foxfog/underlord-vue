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

<style scoped>
.modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000;
}

.modal-content {
	background-color: #2c2c2c;
	border-radius: 8px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	min-width: 400px;
	max-width: 650px;
	width: 90%;
	max-height: 80vh;
	display: flex;
	flex-direction: column;
}

.modal-header {
	padding: 15px 20px;
	border-bottom: 1px solid #444;
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-shrink: 0;
}

.modal-title {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 500;
}

.btn-close {
	background: none;
	border: none;
	color: #fff;
	font-size: 24px;
	cursor: pointer;
	padding: 0;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: color 0.2s;
}

.btn-close:hover {
	color: #ff6b6b;
}

/* Tabs */
.modal-tabs {
	display: flex;
	gap: 5px;
	padding: 10px 15px;
	background: #252525;
	border-bottom: 1px solid #444;
	flex-shrink: 0;
}

.modal-tab {
	padding: 8px 16px;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #ccc;
	border-radius: 4px 4px 0 0;
	cursor: pointer;
	font-size: 13px;
	font-weight: 500;
	transition: all 0.2s ease;
}

.modal-tab:hover {
	background: rgba(255, 255, 255, 0.15);
	border-color: rgba(255, 255, 255, 0.3);
}

.modal-tab.active {
	background: #4a9eff;
	color: #fff;
	border-color: #3a8fef;
}

/* Body */
.modal-body {
	padding: 20px;
	overflow-y: auto;
	flex: 1;
}

.tab-content {
	min-height: 200px;
}

/* Inventory */
.inventory-list {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.inventory-item {
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 10px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 4px;
	transition: background 0.2s;
}

.inventory-item:hover {
	background: rgba(255, 255, 255, 0.08);
}

.item-icon {
	font-size: 24px;
	min-width: 32px;
	text-align: center;
}

.item-info {
	flex: 1;
	min-width: 0;
}

.item-name {
	font-weight: 500;
	color: #fff;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.item-weight {
	font-size: 12px;
	color: #aaa;
	margin-top: 2px;
}

.item-quantity {
	font-weight: 600;
	color: #4a9eff;
	min-width: 40px;
	text-align: right;
}

/* Stats */
.stats-grid {
	display: grid;
	grid-template-columns: 1fr;
	gap: 15px;
}

.stat-item {
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.stat-label {
	font-weight: 600;
	color: #4a9eff;
	font-size: 14px;
}

.stat-value {
	color: #fff;
	font-size: 16px;
	font-weight: 500;
}

.stat-bar {
	height: 20px;
	background: #1a1a1a;
	border-radius: 3px;
	border: 1px solid #444;
	overflow: hidden;
}

.stat-fill {
	height: 100%;
	background: linear-gradient(to right, #4a9eff, #6bb3ff);
	transition: width 0.3s ease;
}

.stat-fill.mp {
	background: linear-gradient(to right, #7c3aed, #a855f7);
}

/* Abilities */
.abilities-list {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.ability-item {
	padding: 12px;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 4px;
	transition: background 0.2s;
}

.ability-item:hover {
	background: rgba(255, 255, 255, 0.08);
}

.ability-name {
	font-weight: 600;
	color: #ffd700;
	margin-bottom: 5px;
}

.ability-description {
	font-size: 13px;
	color: #bbb;
	line-height: 1.4;
}

/* Footer */
.modal-footer {
	padding: 15px 20px;
	border-top: 1px solid #444;
	display: flex;
	justify-content: flex-end;
	flex-shrink: 0;
}

.btn {
	padding: 8px 16px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-weight: 500;
	transition: all 0.2s;
}

.btn-primary {
	background: #4a9eff;
	color: #fff;
}

.btn-primary:hover {
	background: #3a8fef;
}

/* Empty State */
.empty-message {
	text-align: center;
	padding: 40px 20px;
	color: #888;
	font-size: 14px;
}

/* Scrollbar */
.modal-body::-webkit-scrollbar {
	width: 8px;
}

.modal-body::-webkit-scrollbar-track {
	background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
	background: rgba(255, 255, 255, 0.2);
	border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
	background: rgba(255, 255, 255, 0.3);
}
</style>
