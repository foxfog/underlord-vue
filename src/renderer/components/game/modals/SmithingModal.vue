<template>
	<div
		v-if="isVisible"
		class="modal-overlay smithing-modal-overlay"
		@mousedown="handleBackdropMouseDown"
		@click="handleBackdropClick"
	>
		<div class="modal-smithing-content" @click.stop>
			<!-- Header -->
			<div class="smithing-header">
				<div class="smithing-title-wrap">
					<span class="smithing-header-icon">⚒️</span>
					<h3 class="smithing-header-title">Кузница Карна — Ковка клинков</h3>
				</div>
				<button class="btn-close" title="Закрыть" @click="handleClose">×</button>
			</div>

			<div class="smithing-body">
				<!-- Left Column: Recipe list -->
				<div class="smithing-recipes-sidebar">
					<div class="sidebar-title">Чертежи оружия</div>
					<div class="recipe-cards-list">
						<button
							v-for="recipe in recipes"
							:key="recipe.id"
							type="button"
							class="recipe-card-btn"
							:class="{ __selected: selectedRecipe?.id === recipe.id }"
							@click="onSelectRecipe(recipe)"
						>
							<span class="recipe-card-icon">{{ recipe.icon }}</span>
							<div class="recipe-card-info">
								<span class="recipe-card-name">{{ recipe.name }}</span>
								<span class="recipe-card-base-atk">Базовая атака: +{{ recipe.baseStats.attack }}</span>
							</div>
						</button>
					</div>
				</div>

				<!-- Right Column: Details & Forging -->
				<div class="smithing-details-panel">
					<template v-if="selectedRecipe">
						<!-- Recipe Info Banner -->
						<div class="recipe-info-banner">
							<div class="recipe-banner-top">
								<span class="recipe-banner-icon">{{ selectedRecipe.icon }}</span>
								<div>
									<h4 class="recipe-banner-name">{{ selectedRecipe.name }}</h4>
									<p class="recipe-banner-desc">{{ selectedRecipe.description }}</p>
								</div>
							</div>
						</div>

						<!-- Required Materials Card -->
						<div class="materials-box">
							<div class="box-label">Необходимые материалы:</div>
							<div class="materials-list">
								<div
									v-for="mat in materialChecks.materials"
									:key="mat.itemId"
									class="material-item-row"
									:class="{ '__has-enough': mat.owned >= mat.required, '__missing': mat.owned < mat.required }"
								>
									<span class="mat-icon">{{ mat.icon }}</span>
									<span class="mat-name">{{ mat.name }}</span>
									<span class="mat-count">
										<b>{{ mat.owned }}</b> / {{ mat.required }}
										<span v-if="mat.owned >= mat.required" class="mat-status-check">✓</span>
										<span v-else class="mat-status-cross">✕</span>
									</span>
								</div>
							</div>
						</div>

						<!-- Rarity chances -->
						<div class="rarity-chances-box">
							<div class="box-label">Возможная редкость при ковке:</div>
							<div class="rarity-chances-row">
								<span
									v-for="(weight, rId) in selectedRecipe.rarityWeights"
									:key="rId"
									class="rarity-chance-badge"
									:style="getRarityBadgeStyle(rId)"
								>
									{{ getRarity(rId).icon }} {{ getRarity(rId).label }} ({{ weight }}%)
								</span>
							</div>
						</div>

						<!-- Forging Action Button -->
						<div class="smithing-action-row">
							<button
								type="button"
								class="btn-forge"
								:disabled="!materialChecks.canCraft || isForging"
								@click="handleForge"
							>
								<span v-if="isForging" class="forge-spinner">⚒️ Идет ковка...</span>
								<span v-else>
									⚒️ Выковать {{ selectedRecipe.name }}
								</span>
							</button>

							<p v-if="!materialChecks.canCraft" class="materials-warning-text">
								⚠️ Недостаточно материалов в инвентаре. Загляните в сундук кузницы!
							</p>
						</div>

						<!-- Crafted Result Display -->
						<Transition name="fade-result">
							<div
								v-if="craftedResult"
								class="crafted-result-card"
								:class="{ '__is-rainbow': getRarity(craftedResult.rarity).isRainbow }"
								:style="getResultCardStyle(craftedResult.rarity)"
							>
								<div class="crafted-result-header">
									<span class="crafted-sparkle">✨</span>
									<span class="crafted-header-text">Клинок успешно выкован!</span>
									<span class="crafted-sparkle">✨</span>
								</div>

								<div class="crafted-item-main">
									<span class="crafted-item-icon">{{ selectedRecipe.icon }}</span>
									<div class="crafted-item-titles">
										<h4 class="crafted-item-name" :style="{ color: getRarity(craftedResult.rarity).color }">
											{{ craftedResult.customName }}
										</h4>
										<div class="crafted-badges-row">
											<span
												class="crafted-rarity-badge"
												:style="getRarityBadgeStyle(craftedResult.rarity)"
											>
												{{ getRarity(craftedResult.rarity).icon }} {{ getRarity(craftedResult.rarity).label }}
											</span>
											<span class="crafted-quality-badge">
												Качество: {{ Math.round(craftedResult.quality * 100) }}%
											</span>
										</div>
									</div>
								</div>

								<!-- Stats row -->
								<div class="crafted-stats-box">
									<div class="stat-bubble">
										<span class="stat-title">⚔️ Атака:</span>
										<span class="stat-num">+{{ craftedResult.stats.attack }}</span>
									</div>
									<div v-if="craftedResult.stats.defense" class="stat-bubble">
										<span class="stat-title">🛡️ Защита:</span>
										<span class="stat-num">+{{ craftedResult.stats.defense }}</span>
									</div>
									<div v-if="craftedResult.stats.crit_rate" class="stat-bubble">
										<span class="stat-title">💥 Крит. удар:</span>
										<span class="stat-num">+{{ craftedResult.stats.crit_rate }}%</span>
									</div>
								</div>

								<div class="crafted-inventory-note">
									✔ Меч помещен в инвентарь персонажа ({{ character?.name || 'ГГ' }})
								</div>
							</div>
						</Transition>
					</template>
				</div>
			</div>

			<!-- Footer -->
			<div class="smithing-footer">
				<button class="btn btn-secondary" @click="handleClose">
					Закрыть кузницу
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
	useSmithing,
	checkRecipeMaterials,
	getInventoryItemCount
} from '@/composables/useSmithing.js'
import { getRarity, getRarityBadgeStyle } from '@/constants/rarity.js'

const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	},
	character: {
		type: Object,
		default: () => ({ inventory: { items: [] } })
	}
})

const emit = defineEmits(['close', 'item-crafted'])

const {
	recipes,
	selectedRecipe,
	craftedResult,
	selectRecipe,
	craftItem
} = useSmithing()

const isForging = ref(false)

const materialChecks = computed(() => {
	if (!selectedRecipe.value) return { canCraft: false, materials: [] }
	const inv = props.character?.inventory || { items: [] }
	const result = checkRecipeMaterials(selectedRecipe.value, inv)
	const matsWithCounts = (selectedRecipe.value.materials || []).map((m) => {
		const owned = getInventoryItemCount(inv, m.itemId)
		return {
			...m,
			owned,
			required: m.count
		}
	})
	return {
		canCraft: result.canCraft,
		materials: matsWithCounts
	}
})

function onSelectRecipe(recipe) {
	selectRecipe(recipe)
	craftedResult.value = null
}

function handleForge() {
	if (isForging.value || !selectedRecipe.value) return

	isForging.value = true
	craftedResult.value = null

	// Small delay for forging sound / feel
	setTimeout(() => {
		const res = craftItem(selectedRecipe.value, props.character)
		isForging.value = false

		if (res.success) {
			emit('item-crafted', res.item)
		}
	}, 500)
}

function getResultCardStyle(rarityId) {
	const r = getRarity(rarityId)
	if (r.isRainbow) {
		return {
			background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(234, 179, 8, 0.2), rgba(59, 130, 246, 0.2), rgba(168, 85, 247, 0.2))',
			borderColor: '#f43f5e'
		}
	}
	return {
		background: r.bg,
		borderColor: r.border
	}
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
</script>

<style scoped>
.smithing-modal-overlay {
	position: absolute;
	inset: 0;
	z-index: 1200;
	background: rgba(0, 0, 0, 0.75);
	backdrop-filter: blur(0.25em);
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: Kurale, sans-serif;
}

.modal-smithing-content {
	width: min(52em, 92%);
	max-height: 90%;
	display: flex;
	flex-direction: column;
	background: #141824;
	border: 1px solid rgba(245, 158, 11, 0.4);
	border-radius: 0.6em;
	box-shadow: 0 0.8em 2.5em rgba(0, 0, 0, 0.9), 0 0 1em rgba(245, 158, 11, 0.15);
	color: #f1f5f9;
	overflow: hidden;
}

/* Header */
.smithing-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.85em 1.2em;
	background: rgba(15, 23, 42, 0.85);
	border-bottom: 1px solid rgba(245, 158, 11, 0.3);
}

.smithing-title-wrap {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.smithing-header-icon {
	font-size: 1.4em;
}

.smithing-header-title {
	margin: 0;
	font-family: Overlord, Kurale, sans-serif;
	font-size: 1.25em;
	color: #fbbf24;
	letter-spacing: 0.04em;
}

.btn-close {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.5em;
	line-height: 1;
	cursor: pointer;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
	transition: color 0.15s, background-color 0.15s;
}

.btn-close:hover {
	color: #f87171;
	background: rgba(248, 113, 113, 0.15);
}

/* Body Layout */
.smithing-body {
	display: flex;
	flex: 1;
	overflow: hidden;
	min-height: 28em;
}

/* Sidebar */
.smithing-recipes-sidebar {
	width: 15em;
	background: rgba(10, 14, 26, 0.7);
	border-right: 1px solid rgba(255, 255, 255, 0.08);
	padding: 1em 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.sidebar-title {
	font-size: 0.9em;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: #94a3b8;
	padding: 0 0.4em;
}

.recipe-cards-list {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.recipe-card-btn {
	display: flex;
	align-items: center;
	gap: 0.7em;
	padding: 0.65em 0.75em;
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	color: #cbd5e1;
	cursor: pointer;
	text-align: left;
	font-family: inherit;
	transition: background-color 0.15s, border-color 0.15s, transform 0.15s;
}

.recipe-card-btn:hover {
	background: rgba(245, 158, 11, 0.1);
	border-color: rgba(245, 158, 11, 0.3);
	transform: translateX(0.15em);
}

.recipe-card-btn.__selected {
	background: rgba(245, 158, 11, 0.18);
	border-color: #f59e0b;
	color: #fef08a;
	font-weight: bold;
}

.recipe-card-icon {
	font-size: 1.4em;
}

.recipe-card-info {
	display: flex;
	flex-direction: column;
	gap: 0.15em;
}

.recipe-card-name {
	font-size: 0.95em;
}

.recipe-card-base-atk {
	font-size: 0.75em;
	color: #94a3b8;
}

/* Details Panel */
.smithing-details-panel {
	flex: 1;
	padding: 1.2em 1.4em;
	overflow-y: auto;
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.recipe-info-banner {
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.85em 1em;
}

.recipe-banner-top {
	display: flex;
	align-items: center;
	gap: 0.9em;
}

.recipe-banner-icon {
	font-size: 2em;
}

.recipe-banner-name {
	margin: 0 0 0.25em 0;
	font-family: Overlord, Kurale, sans-serif;
	font-size: 1.2em;
	color: #f8fafc;
}

.recipe-banner-desc {
	margin: 0;
	font-size: 0.85em;
	color: #94a3b8;
	line-height: 1.4;
}

/* Materials Card */
.materials-box {
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.45em;
	padding: 0.85em 1em;
}

.box-label {
	font-size: 0.85em;
	color: #cbd5e1;
	margin-bottom: 0.6em;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.materials-list {
	display: flex;
	flex-direction: column;
	gap: 0.45em;
}

.material-item-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.45em 0.75em;
	border-radius: 0.3em;
	border: 1px solid transparent;
	font-size: 0.9em;
}

.material-item-row.__has-enough {
	background: rgba(34, 197, 94, 0.08);
	border-color: rgba(34, 197, 94, 0.25);
	color: #86efac;
}

.material-item-row.__missing {
	background: rgba(239, 68, 68, 0.08);
	border-color: rgba(239, 68, 68, 0.25);
	color: #fca5a5;
}

.mat-icon {
	margin-right: 0.5em;
}

.mat-name {
	flex: 1;
}

.mat-count {
	font-family: monospace;
	font-size: 1em;
}

.mat-status-check {
	color: #22c55e;
	font-weight: bold;
	margin-left: 0.4em;
}

.mat-status-cross {
	color: #ef4444;
	font-weight: bold;
	margin-left: 0.4em;
}

/* Rarity chances row */
.rarity-chances-box {
	background: rgba(15, 23, 42, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.45em;
	padding: 0.75em 0.9em;
}

.rarity-chances-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.5em;
}

.rarity-chance-badge {
	font-size: 0.75em;
	padding: 0.25em 0.55em;
	border-radius: 0.3em;
	border: 1px solid transparent;
}

/* Action button */
.smithing-action-row {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5em;
	margin-top: 0.4em;
}

.btn-forge {
	width: 100%;
	padding: 0.75em 1.2em;
	background: linear-gradient(180deg, #f59e0b, #d97706);
	border: 1px solid #fbbf24;
	border-radius: 0.45em;
	color: #0f172a;
	font-family: Overlord, Kurale, sans-serif;
	font-size: 1.1em;
	font-weight: bold;
	cursor: pointer;
	box-shadow: 0 0.3em 1em rgba(245, 158, 11, 0.3);
	transition: background-color 0.2s, transform 0.15s, box-shadow 0.2s;
}

.btn-forge:hover:not(:disabled) {
	background: linear-gradient(180deg, #fbbf24, #f59e0b);
	transform: translateY(-0.08em);
	box-shadow: 0 0.5em 1.4em rgba(245, 158, 11, 0.45);
}

.btn-forge:disabled {
	opacity: 0.45;
	cursor: not-allowed;
	filter: grayscale(0.6);
	box-shadow: none;
}

.materials-warning-text {
	margin: 0;
	font-size: 0.85em;
	color: #fca5a5;
	text-align: center;
}

/* Crafted Result Card */
.crafted-result-card {
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.5em;
	padding: 1em 1.2em;
	display: flex;
	flex-direction: column;
	gap: 0.75em;
	box-shadow: 0 0.5em 1.8em rgba(0, 0, 0, 0.8);
	animation: pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.crafted-result-card.__is-rainbow {
	animation: rainbow-border-glow 3s linear infinite alternate;
}

@keyframes pop-in {
	0% {
		opacity: 0;
		transform: scale(0.95);
	}
	100% {
		opacity: 1;
		transform: scale(1);
	}
}

.crafted-result-header {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
	font-size: 0.9em;
	color: #facc15;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.crafted-item-main {
	display: flex;
	align-items: center;
	gap: 0.9em;
}

.crafted-item-icon {
	font-size: 2.2em;
}

.crafted-item-titles {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.crafted-item-name {
	margin: 0;
	font-family: Overlord, Kurale, sans-serif;
	font-size: 1.25em;
	letter-spacing: 0.02em;
}

.crafted-badges-row {
	display: flex;
	gap: 0.5em;
	align-items: center;
}

.crafted-rarity-badge {
	font-size: 0.75em;
	font-weight: bold;
	padding: 0.2em 0.55em;
	border-radius: 0.25em;
	border: 1px solid transparent;
}

.crafted-quality-badge {
	font-size: 0.75em;
	color: #94a3b8;
	background: rgba(255, 255, 255, 0.08);
	padding: 0.2em 0.5em;
	border-radius: 0.25em;
}

.crafted-stats-box {
	display: flex;
	gap: 0.8em;
	flex-wrap: wrap;
	padding: 0.5em 0.7em;
	background: rgba(0, 0, 0, 0.3);
	border-radius: 0.35em;
}

.stat-bubble {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.9em;
}

.stat-title {
	color: #cbd5e1;
}

.stat-num {
	color: #f8fafc;
	font-weight: bold;
}

.crafted-inventory-note {
	font-size: 0.8em;
	color: #86efac;
	text-align: center;
}

/* Footer */
.smithing-footer {
	padding: 0.75em 1.2em;
	background: rgba(15, 23, 42, 0.9);
	border-top: 1px solid rgba(255, 255, 255, 0.08);
	display: flex;
	justify-content: flex-end;
}

.btn {
	padding: 0.45em 1.1em;
	font-size: 0.9em;
	font-family: inherit;
	border-radius: 0.35em;
	cursor: pointer;
	transition: background-color 0.15s;
}

.btn-secondary {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
}

.btn-secondary:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}
</style>
