<template>
	<div class="hexworld-map-wrap">
		<!-- Hex Canvas View -->
		<HexCanvas
			ref="canvasRef"
			:map-data="mapData"
			:read-only="true"
			:current-location="currentLocation"
			:discovered-locations="discoveredSettlementIds"
			:show-borders="showBorders"
			:factions-map="fractionsData"
			@update:show-borders="val => showBorders = val"
			@settlement-click="onSettlementClick"
			@hex-click="onHexClick"
		/>

		<!-- Selected Settlement Tactical Info Card -->
		<Transition name="fade">
			<div v-if="selectedSettlement" class="settlement-popup-card">
				<div class="popup-header">
					<div class="popup-title-box">
						<span class="popup-icon">{{ selectedSettlementTypeInfo.icon }}</span>
						<div>
							<h3 class="popup-name">{{ selectedSettlement.name }}</h3>
							<span class="popup-type-badge">{{ selectedSettlementTypeInfo.name }}</span>
						</div>
					</div>
					<button class="popup-close-btn" @click="selectedSettlement = null">✕</button>
				</div>

				<p class="popup-desc">
					{{ selectedSettlement.description || 'Стратегический пункт Нового Мира.' }}
				</p>

				<div class="popup-actions">
					<button
						v-if="selectedSettlement.hasLocalMap"
						class="popup-btn popup-btn-local"
						@click="openLocalMap(selectedSettlement)"
					>
						📍 Локальная карта
					</button>

					<button
						class="popup-btn popup-btn-goto"
						@click="navigateToLocation(selectedSettlement)"
					>
						🚶 Перейти
					</button>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import HexCanvas from '@/components/game/hexmap/HexCanvas.vue'
import {
	normalizeHexMapData,
	SETTLEMENT_TYPES
} from '@/utils/hexmap/hexLoader.js'
import newWorldHexJson from '@data/hexmaps/newworld_hex.json'
import fractionsData from '@data/fractions/fractions.json'

const showBorders = ref(true)

const props = defineProps({
	currentLocation: {
		type: String,
		default: ''
	},
	globalData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['goto', 'switch-level', 'view-local'])

const mapData = ref(normalizeHexMapData(newWorldHexJson))
const selectedSettlement = ref(null)

const discoveredSettlementIds = computed(() => {
	const list = props.globalData?.discoveredLocations?.newworld
	if (Array.isArray(list)) {
		return new Set(list)
	}
	// Default known
	return new Set(['carne_village'])
})

const selectedSettlementTypeInfo = computed(() => {
	if (!selectedSettlement.value) return SETTLEMENT_TYPES.village
	return SETTLEMENT_TYPES[selectedSettlement.value.type] || SETTLEMENT_TYPES.village
})

function onSettlementClick({ settlement }) {
	selectedSettlement.value = settlement
}

function onHexClick() {
	// Clicking outside clears selection
	selectedSettlement.value = null
}

function openLocalMap(settlement) {
	const localId = settlement.localMapId || 'carne'
	emit('view-local', localId)
	emit('switch-level', 'local')
}

function navigateToLocation(settlement) {
	const overrides = props.globalData?.mapOverrides?.newworld
	const target = overrides?.[settlement.id] || settlement.sceneId || settlement.id
	emit('goto', {
		target,
		locationId: settlement.id,
		id: target,
		name: settlement.name,
		localMapId: settlement.localMapId
	})
}
</script>

<style scoped>
.hexworld-map-wrap {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

/* Tactical Settlement Card Popup */
.settlement-popup-card {
	position: absolute;
	bottom: 1.2em;
	right: 1.2em;
	width: 20em;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.4em;
	box-shadow: 0 0.8em 2em rgba(0, 0, 0, 0.7);
	padding: 0.9em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	z-index: 30;
	backdrop-filter: blur(0.3em);
}

.popup-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.popup-title-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.popup-icon {
	font-size: 1.5em;
}

.popup-name {
	margin: 0;
	font-size: 0.95em;
	color: #f8fafc;
	font-weight: bold;
}

.popup-type-badge {
	font-size: 0.7em;
	color: #f6c445;
	background: rgba(246, 196, 69, 0.15);
	padding: 0.1em 0.4em;
	border-radius: 0.2em;
}

.popup-close-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1em;
	cursor: pointer;
}

.popup-close-btn:hover {
	color: #f8fafc;
}

.popup-desc {
	margin: 0;
	font-size: 0.8em;
	color: #cbd5e1;
	line-height: 1.4;
}

.popup-actions {
	display: flex;
	gap: 0.5em;
	margin-top: 0.2em;
}

.popup-btn {
	flex: 1;
	border: none;
	padding: 0.4em 0.6em;
	border-radius: 0.25em;
	font-size: 0.8em;
	font-weight: bold;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.3em;
	transition: all 0.2s ease;
}

.popup-btn-local {
	background: #0284c7;
	color: #f8fafc;
}

.popup-btn-local:hover {
	background: #0369a1;
}

.popup-btn-goto {
	background: #f6c445;
	color: #0f172a;
}

.popup-btn-goto:hover {
	background: #eab308;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
	transform: translateY(0.5em);
}
</style>
