<template>
	<div
		v-if="isVisible"
		class="modal-overlay"
		@mousedown="handleBackdropMouseDown"
		@click="handleBackdropClick"
	>
		<div class="modal-item-info" @click.stop>
			<div class="modal-header">
				<h4 class="modal-title" :style="{ color: rarityConfig.color }">
					{{ displayName }}
					<span v-if="itemId" class="item-id">({{ itemId }})</span>
					<span
						v-if="rarityConfig"
						class="item-rarity-badge"
						:style="rarityBadgeStyle"
					>
						{{ rarityConfig.icon }} {{ rarityConfig.label }}
					</span>
				</h4>
				<button class="btn-close" @click="handleClose">×</button>
			</div>

			<div class="modal-body">
				<div v-if="itemDef" class="item-info-grid">
					<div class="item-info-row" v-if="categoriesDisplay">
						<span class="label">Категории:</span>
						<span class="value">{{ categoriesDisplay }}</span>
					</div>
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

					<div class="item-info-section" v-if="requirementsEntries.length">
						<div class="section-title">Требования экипировки</div>
						<ul class="stats-list">
							<li v-for="(entry, idx) in requirementsEntries" :key="idx">
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

				<div v-else class="item-info-empty">Нет подробной информации об этом предмете.</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-primary" @click="handleClose">Закрыть</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import { getRarity, getRarityBadgeStyle } from '@/constants/rarity.js'

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
		default: null // 'inventory' | 'equipment'
	},
	slot: {
		type: String,
		default: null
	}
})

const emit = defineEmits(['close'])

const rarity = computed(() => props.itemDef?.rarity || 'common')
const rarityConfig = computed(() => getRarity(rarity.value))
const rarityBadgeStyle = computed(() => getRarityBadgeStyle(rarity.value))

const displayName = computed(() => {
	return props.itemDef?.name || props.itemId || 'предмет'
})

const categoriesDisplay = computed(() => {
	if (!props.itemDef?.categories || !props.itemDef.categories.length) return null
	return props.itemDef.categories.join(', ')
})

const isStackable = computed(() => {
	if (!props.itemDef) return null
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

const requirementsEntries = computed(() => {
	if (!props.itemDef) return []
	const res = []
	const minLvl = props.itemDef.lvl_min ?? props.itemDef.lvl
	if (minLvl && minLvl > 1) {
		res.push({ label: 'Мин. уровень', value: minLvl })
	}
	const genders = props.itemDef.genders || (props.itemDef.gender ? [props.itemDef.gender] : null)
	if (Array.isArray(genders) && genders.length > 0) {
		const genderLabels = {
			male: 'Мужской',
			female: 'Женский',
			genderless: 'Бесполое',
			hermaphrodite: 'Гермафродит'
		}
		res.push({ label: 'Пол', value: genders.map((g) => genderLabels[g] || g).join(', ') })
	}
	const classes =
		props.itemDef.classs ||
		props.itemDef.classes ||
		(props.itemDef.class ? (Array.isArray(props.itemDef.class) ? props.itemDef.class : [props.itemDef.class]) : null)
	if (Array.isArray(classes) && classes.length > 0) {
		res.push({ label: 'Классы', value: classes.join(', ') })
	}
	if (Array.isArray(props.itemDef.races) && props.itemDef.races.length > 0) {
		res.push({ label: 'Расы', value: props.itemDef.races.join(', ') })
	}
	if (Array.isArray(props.itemDef.characters) && props.itemDef.characters.length > 0) {
		res.push({ label: 'Персонажи', value: props.itemDef.characters.join(', ') })
	}
	return res
})

const sourceLabel = computed(() => {
	if (props.source === 'inventory') return 'в инвентаре'
	if (props.source === 'equipment')
		return props.slot ? `надето в слоте "${props.slot}"` : 'надето на персонаже'
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
