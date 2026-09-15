<template>
	<div
		v-if="isVisible"
		class="modal-overlay chest-modal-overlay"
		@mousedown="handleBackdropMouseDown"
		@click="handleBackdropClick"
	>
		<div class="modal-chest-content" @click.stop>
			<!-- Modal Header -->
			<div class="chest-header">
				<div class="chest-title-wrap">
					<span class="chest-header-icon">{{ containerIcon }}</span>
					<div>
						<h3 class="chest-header-title">{{ containerTitle }}</h3>
						<span class="chest-header-sub">Хранилище и обмен предметами</span>
					</div>
				</div>
				<button class="btn-close" title="Закрыть (Esc)" @click="handleClose">×</button>
			</div>

			<!-- Main Columns Layout -->
			<div class="chest-body">
				<!-- Left Column: Container Items -->
				<div class="chest-panel chest-container-panel">
					<div class="panel-header">
						<div class="panel-title-wrap">
							<span class="panel-icon">{{ containerIcon }}</span>
							<span class="panel-title">Сундук</span>
							<span class="panel-count-badge">{{ containerItems.length }}</span>
						</div>
						<button
							type="button"
							class="btn-panel-action __take-all"
							:disabled="containerItems.length === 0"
							@click="onTakeAll"
							title="Забрать все предметы из сундука"
						>
							📥 Взять всё
						</button>
					</div>

					<div class="items-scroll-area">
						<div v-if="containerItems.length === 0" class="panel-empty-state">
							<span class="empty-icon">📭</span>
							<span class="empty-text">Сундук пуст</span>
						</div>

						<div v-else class="items-list">
							<div
								v-for="(item, idx) in containerItemDetails"
								:key="item.uid || `c-${item.itemId}-${idx}`"
								class="item-card"
								:style="{ borderColor: item.rarityConfig.color + '44' }"
							>
								<div class="item-card-left">
									<span class="item-icon">{{ item.icon }}</span>
									<div class="item-text-info">
										<div class="item-name-row">
											<span class="item-name" :style="{ color: item.rarityConfig.color }">
												{{ item.name }}
											</span>
											<span v-if="item.rawQuantity > 1" class="item-quantity-pill">
												x{{ item.rawQuantity }}
											</span>
										</div>

										<div class="item-badges-row">
											<span class="item-rarity-pill" :style="item.badgeStyle">
												{{ item.rarityConfig.icon }} {{ item.rarityConfig.label }}
											</span>
											<span v-if="item.quality !== null" class="item-quality-pill">
												{{ Math.round(item.quality * 100) }}%
											</span>
											<span v-if="item.stats?.attack" class="item-stat-chip">
												⚔️ +{{ item.stats.attack }}
											</span>
											<span v-if="item.stats?.defense" class="item-stat-chip">
												🛡️ +{{ item.stats.defense }}
											</span>
										</div>
									</div>
								</div>

								<!-- Transfer Actions to Player -->
								<div class="item-card-actions">
									<template v-if="!item.uid && item.rawQuantity > 1">
										<button
											type="button"
											class="btn-transfer __small"
											title="Взять 1 шт."
											@click="onTransferToPlayer(item.rawItem, 1)"
										>
											1 ➡
										</button>
										<button
											type="button"
											class="btn-transfer __primary"
											title="Взять всю стопку"
											@click="onTransferToPlayer(item.rawItem, item.rawQuantity)"
										>
											Все ➡
										</button>
									</template>
									<template v-else>
										<button
											type="button"
											class="btn-transfer __primary"
											title="Взять предмет"
											@click="onTransferToPlayer(item.rawItem, 1)"
										>
											Взять ➡
										</button>
									</template>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Middle Divider with Transfer Controls -->
				<div class="chest-divider">
					<div class="divider-line"></div>
					<div class="divider-actions">
						<button
							type="button"
							class="btn-divider-action"
							:disabled="containerItems.length === 0"
							@click="onTakeAll"
							title="Забрать всё"
						>
							➡
						</button>
						<button
							type="button"
							class="btn-divider-action"
							:disabled="playerItems.length === 0"
							@click="onDepositAll"
							title="Сложить всё"
						>
							⬅
						</button>
					</div>
					<div class="divider-line"></div>
				</div>

				<!-- Right Column: Character Inventory -->
				<div class="chest-panel chest-player-panel">
					<div class="panel-header">
						<div class="panel-title-wrap">
							<span class="panel-icon">🎒</span>
							<span class="panel-title">{{ characterName }}</span>
							<span class="panel-count-badge">{{ playerItems.length }}</span>
						</div>
						<button
							type="button"
							class="btn-panel-action __deposit-all"
							:disabled="playerItems.length === 0"
							@click="onDepositAll"
							title="Сложить все предметы в сундук"
						>
							📤 Сложить всё
						</button>
					</div>

					<div class="items-scroll-area">
						<div v-if="playerItems.length === 0" class="panel-empty-state">
							<span class="empty-icon">🎒</span>
							<span class="empty-text">Инвентарь пуст</span>
						</div>

						<div v-else class="items-list">
							<div
								v-for="(item, idx) in playerItemDetails"
								:key="item.uid || `p-${item.itemId}-${idx}`"
								class="item-card"
								:style="{ borderColor: item.rarityConfig.color + '44' }"
							>
								<!-- Transfer Actions to Container -->
								<div class="item-card-actions">
									<template v-if="!item.uid && item.rawQuantity > 1">
										<button
											type="button"
											class="btn-transfer __primary"
											title="Сложить всю стопку"
											@click="onTransferToContainer(item.rawItem, item.rawQuantity)"
										>
											⬅ Все
										</button>
										<button
											type="button"
											class="btn-transfer __small"
											title="Сложить 1 шт."
											@click="onTransferToContainer(item.rawItem, 1)"
										>
											⬅ 1
										</button>
									</template>
									<template v-else>
										<button
											type="button"
											class="btn-transfer __primary"
											title="Сложить в сундук"
											@click="onTransferToContainer(item.rawItem, 1)"
										>
											⬅ Положить
										</button>
									</template>
								</div>

								<div class="item-card-left">
									<div class="item-text-info">
										<div class="item-name-row">
											<span class="item-name" :style="{ color: item.rarityConfig.color }">
												{{ item.name }}
											</span>
											<span v-if="item.rawQuantity > 1" class="item-quantity-pill">
												x{{ item.rawQuantity }}
											</span>
										</div>

										<div class="item-badges-row">
											<span class="item-rarity-pill" :style="item.badgeStyle">
												{{ item.rarityConfig.icon }} {{ item.rarityConfig.label }}
											</span>
											<span v-if="item.quality !== null" class="item-quality-pill">
												{{ Math.round(item.quality * 100) }}%
											</span>
											<span v-if="item.stats?.attack" class="item-stat-chip">
												⚔️ +{{ item.stats.attack }}
											</span>
											<span v-if="item.stats?.defense" class="item-stat-chip">
												🛡️ +{{ item.stats.defense }}
											</span>
										</div>
									</div>
									<span class="item-icon">{{ item.icon }}</span>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="chest-footer">
				<button type="button" class="btn btn-secondary" @click="handleClose">
					Закрыть хранилище (Esc)
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, watch, onMounted, onUnmounted } from 'vue'
import {
	getContainerItems,
	transferToPlayer,
	transferToContainer,
	takeAllFromContainer,
	depositAllToContainer,
	getItemDetails
} from '@/composables/useContainers.js'
import { useRegisterModal } from '@/composables/useModalStack.js'

const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	},
	chest: {
		type: Object,
		default: () => ({ id: 'default_chest', name: 'Сундук', icon: '📦', loot: null })
	},
	character: {
		type: Object,
		default: () => ({ name: 'Персонаж', inventory: { items: [] } })
	},
	globalData: {
		type: Object,
		default: null
	},
	itemsData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['close', 'transferred'])

const MODAL_ID = 'chest-transfer-modal'

const containerId = computed(() => props.chest?.id || 'default_chest')
const containerTitle = computed(() => props.chest?.name || 'Сундук')
const containerIcon = computed(() => props.chest?.icon || '📦')
const characterName = computed(() => props.character?.name || 'Инвентарь')

const containerItems = computed(() => {
	if (!props.isVisible) return []
	return getContainerItems(containerId.value, props.chest?.loot, props.globalData)
})

const playerItems = computed(() => {
	return props.character?.inventory?.items || []
})

const containerItemDetails = computed(() => {
	return containerItems.value.map((item) => {
		const details = getItemDetails(item, props.itemsData)
		return {
			...details,
			uid: item.uid,
			rawQuantity: item.uid ? 1 : (item.quantity !== undefined ? item.quantity : 1),
			rawItem: item
		}
	})
})

const playerItemDetails = computed(() => {
	return playerItems.value.map((item) => {
		const details = getItemDetails(item, props.itemsData)
		return {
			...details,
			uid: item.uid,
			rawQuantity: item.uid ? 1 : (item.quantity !== undefined ? item.quantity : 1),
			rawItem: item
		}
	})
})

function onTransferToPlayer(item, quantity = 1) {
	transferToPlayer(containerId.value, item, quantity, props.character, props.globalData)
	emit('transferred', { direction: 'to-player', item, quantity })
}

function onTransferToContainer(item, quantity = 1) {
	transferToContainer(containerId.value, item, quantity, props.character, props.globalData)
	emit('transferred', { direction: 'to-container', item, quantity })
}

function onTakeAll() {
	takeAllFromContainer(containerId.value, props.character, props.globalData)
	emit('transferred', { direction: 'take-all' })
}

function onDepositAll() {
	depositAllToContainer(containerId.value, props.character, props.globalData)
	emit('transferred', { direction: 'deposit-all' })
}

let isBackdropMouseDown = false

function handleBackdropMouseDown(e) {
	isBackdropMouseDown = e.target === e.currentTarget
}

function handleBackdropClick(e) {
	if (isBackdropMouseDown && e.target === e.currentTarget) {
		handleClose()
	}
	isBackdropMouseDown = false
}

function handleClose() {
	emit('close')
}

useRegisterModal(MODAL_ID, () => props.isVisible, handleClose)

function onKeyDown(e) {
	if (e.key === 'Escape' && props.isVisible) {
		e.stopPropagation()
		handleClose()
	}
}

onMounted(() => {
	window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.chest-modal-overlay {
	position: absolute;
	inset: 0;
	z-index: 260;
	background: rgba(0, 0, 0, 0.78);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: calc(1 * var(--size));
	backdrop-filter: blur(0.25em);
	padding: 1.5em;
}

.modal-chest-content {
	width: 90%;
	max-width: 58em;
	height: 82%;
	max-height: 38em;
	background: #0f1523;
	border: 1px solid rgba(226, 201, 126, 0.45);
	border-radius: 0.6em;
	box-shadow: 0 1.2em 3.5em rgba(0, 0, 0, 0.85);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	color: #e2e8f0;
	font-family: Kurale, sans-serif;
}

/* Header */
.chest-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.85em 1.25em;
	background: rgba(226, 201, 126, 0.08);
	border-bottom: 1px solid rgba(226, 201, 126, 0.25);
}

.chest-title-wrap {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.chest-header-icon {
	font-size: 1.8em;
}

.chest-header-title {
	margin: 0;
	font-family: Overlord, Kurale, sans-serif;
	font-size: 1.3em;
	color: #f6e2a0;
	letter-spacing: 0.04em;
}

.chest-header-sub {
	font-size: 0.8em;
	color: #94a3b8;
}

.btn-close {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.8em;
	line-height: 1;
	cursor: pointer;
	padding: 0 0.2em;
	transition: color 0.15s;
}

.btn-close:hover {
	color: #f87171;
}

/* Body */
.chest-body {
	display: flex;
	flex: 1;
	overflow: hidden;
	padding: 0.8em;
	gap: 0.7em;
}

.chest-panel {
	flex: 1;
	display: flex;
	flex-direction: column;
	background: rgba(15, 23, 42, 0.65);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	overflow: hidden;
}

.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6em 0.85em;
	background: rgba(255, 255, 255, 0.03);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.panel-title-wrap {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.panel-icon {
	font-size: 1.15em;
}

.panel-title {
	font-weight: bold;
	font-size: 0.95em;
	color: #f8fafc;
}

.panel-count-badge {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.1);
	padding: 0.15em 0.5em;
	border-radius: 1em;
	color: #cbd5e1;
}

.btn-panel-action {
	background: rgba(245, 158, 11, 0.15);
	border: 1px solid rgba(245, 158, 11, 0.35);
	color: #fde68a;
	padding: 0.3em 0.7em;
	border-radius: 0.35em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: inherit;
	transition: background-color 0.15s, border-color 0.15s;
}

.btn-panel-action:hover:not(:disabled) {
	background: rgba(245, 158, 11, 0.28);
	border-color: #f59e0b;
}

.btn-panel-action:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.items-scroll-area {
	flex: 1;
	overflow-y: auto;
	padding: 0.6em;
}

.panel-empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	color: #64748b;
	gap: 0.5em;
	padding: 3em 1em;
}

.empty-icon {
	font-size: 2.5em;
	opacity: 0.5;
}

.empty-text {
	font-size: 0.95em;
}

.items-list {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
}

/* Item Card */
.item-card {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.45em 0.7em;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.35em;
	gap: 0.6em;
	transition: background-color 0.15s, border-color 0.15s;
}

.item-card:hover {
	background: rgba(255, 255, 255, 0.06);
}

.item-card-left {
	display: flex;
	align-items: center;
	gap: 0.6em;
	flex: 1;
	min-width: 0;
}

.item-icon {
	font-size: 1.5em;
	flex-shrink: 0;
}

.item-text-info {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	min-width: 0;
	flex: 1;
}

.item-name-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.item-name {
	font-size: 0.9em;
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.item-quantity-pill {
	font-size: 0.75em;
	font-weight: bold;
	color: #e2e8f0;
	background: rgba(255, 255, 255, 0.12);
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
}

.item-badges-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
	flex-wrap: wrap;
}

.item-rarity-pill {
	font-size: 0.68em;
	padding: 0.15em 0.45em;
	border-radius: 0.25em;
	font-weight: bold;
	line-height: 1.2;
}

.item-quality-pill {
	font-size: 0.68em;
	background: rgba(255, 255, 255, 0.08);
	color: #94a3b8;
	padding: 0.15em 0.4em;
	border-radius: 0.25em;
}

.item-stat-chip {
	font-size: 0.68em;
	background: rgba(239, 68, 68, 0.15);
	color: #fca5a5;
	padding: 0.15em 0.4em;
	border-radius: 0.25em;
}

.item-card-actions {
	display: flex;
	align-items: center;
	gap: 0.35em;
	flex-shrink: 0;
}

.btn-transfer {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	padding: 0.35em 0.65em;
	border-radius: 0.3em;
	font-size: 0.78em;
	cursor: pointer;
	font-family: inherit;
	transition: background-color 0.15s, border-color 0.15s, color 0.15s;
	white-space: nowrap;
}

.btn-transfer:hover {
	background: rgba(226, 201, 126, 0.2);
	border-color: rgba(226, 201, 126, 0.5);
	color: #fef08a;
}

.btn-transfer.__primary {
	background: rgba(226, 201, 126, 0.12);
	border-color: rgba(226, 201, 126, 0.3);
	color: #fde68a;
	font-weight: bold;
}

.btn-transfer.__small {
	padding: 0.35em 0.45em;
	font-size: 0.75em;
}

/* Center Divider */
.chest-divider {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 2.2em;
	gap: 0.8em;
}

.divider-line {
	flex: 1;
	width: 0.06em;
	background: rgba(255, 255, 255, 0.08);
}

.divider-actions {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.btn-divider-action {
	width: 2em;
	height: 2em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #e2e8f0;
	border-radius: 50%;
	font-size: 0.9em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background-color 0.15s, border-color 0.15s;
}

.btn-divider-action:hover:not(:disabled) {
	background: rgba(226, 201, 126, 0.25);
	border-color: #f59e0b;
	color: #fef08a;
}

.btn-divider-action:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

/* Footer */
.chest-footer {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding: 0.7em 1.25em;
	background: rgba(10, 14, 26, 0.8);
	border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.btn-secondary {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.5em 1.2em;
	border-radius: 0.35em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: inherit;
	transition: background-color 0.15s, border-color 0.15s;
}

.btn-secondary:hover {
	background: rgba(255, 255, 255, 0.12);
	border-color: rgba(255, 255, 255, 0.3);
	color: #fff;
}
</style>
