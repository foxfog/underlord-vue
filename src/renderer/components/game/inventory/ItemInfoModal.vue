<template>
	<div v-if="isVisible" class="modal-overlay" @click="handleClose">
		<div class="modal-item-info" @click.stop>
			<div class="modal-header">
				<h4 class="modal-title">
					{{ displayName }}
					<span v-if="itemId" class="item-id">({{ itemId }})</span>
				</h4>
				<button class="btn-close" @click="handleClose">×</button>
			</div>

			<div class="modal-body">
				<div v-if="itemDef" class="item-info-grid">
					<div class="item-info-row" v-if="itemDef.weight !== undefined">
						<span class="label">Вес:</span>
						<span class="value">{{ itemDef.weight }}</span>
					</div>

					<div class="item-info-row" v-if="isStackable !== null">
						<span class="label">Складируемый:</span>
						<span class="value">{{ isStackable ? 'да' : 'нет' }}</span>
					</div>

					<div class="item-info-row" v-if="quantity && quantity > 1">
						<span class="label">Количество:</span>
						<span class="value">x{{ quantity }}</span>
					</div>

					<div class="item-info-row" v-if="slotDisplay">
						<span class="label">Слот:</span>
						<span class="value">{{ slotDisplay }}</span>
					</div>

					<div class="item-info-section" v-if="statsEntries.length">
						<div class="section-title">Бонусы / характеристики</div>
						<ul class="stats-list">
							<li v-for="(entry, idx) in statsEntries" :key="idx">
								<span class="stat-key">{{ entry.label }}:</span>
								<span class="stat-value">{{ entry.value }}</span>
							</li>
						</ul>
					</div>

					<div class="item-info-section" v-if="effectsEntries.length">
						<div class="section-title">Эффекты</div>
						<ul class="stats-list">
							<li v-for="(entry, idx) in effectsEntries" :key="idx">
								<span class="stat-key">{{ entry.label }}:</span>
								<span class="stat-value">{{ entry.value }}</span>
							</li>
						</ul>
					</div>

					<div class="item-info-row" v-if="sourceLabel">
						<span class="label">Где находится:</span>
						<span class="value">{{ sourceLabel }}</span>
					</div>
				</div>

				<div v-else class="item-info-empty">
					Нет подробной информации об этом предмете.
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-primary" @click="handleClose">Закрыть</button>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'

	const props = defineProps({
		isVisible: {
			type: Boolean,
			default: false
		},
		itemId: {
			type: String,
			default: null
		},
		itemDef: {
			type: Object,
			default: null
		},
		quantity: {
			type: Number,
			default: 1
		},
		source: {
			type: String,
			default: null  // 'inventory' | 'equipment'
		},
		slot: {
			type: String,
			default: null
		}
	})

	const emit = defineEmits(['close'])

	const displayName = computed(() => {
		return props.itemDef?.name || props.itemId || 'предмет'
	})

	const isStackable = computed(() => {
		if (!props.itemDef) return null
		// по умолчанию предмет складируемый, если не указано stackable: false
		return props.itemDef.stackable !== false
	})

	const slotDisplay = computed(() => {
		if (!props.itemDef?.slot) return null
		if (Array.isArray(props.itemDef.slot)) {
			return props.itemDef.slot.join(', ')
		}
		return props.itemDef.slot
	})

	const statsEntries = computed(() => {
		const stats = props.itemDef?.stats
		if (!stats || typeof stats !== 'object') return []

		return Object.entries(stats).map(([key, value]) => ({
			key,
			label: mapStatKeyToLabel(key),
			value
		}))
	})

	const effectsEntries = computed(() => {
		const effects = props.itemDef?.effects
		if (!effects || typeof effects !== 'object') return []

		return Object.entries(effects).map(([key, value]) => ({
			key,
			label: mapStatKeyToLabel(key),
			value
		}))
	})

	const sourceLabel = computed(() => {
		if (props.source === 'inventory') return 'в инвентаре'
		if (props.source === 'equipment') return props.slot ? `надето в слоте "${props.slot}"` : 'надето на персонаже'
		return null
	})

	function mapStatKeyToLabel(key) {
		switch (key) {
			case 'hp':
				return 'HP'
			case 'mp':
				return 'MP'
			case 'attack':
				return 'Атака'
			case 'defense':
				return 'Защита'
			default:
				return key
		}
	}

	function handleClose() {
		emit('close')
	}
</script>

