<template>
	<div
		v-if="isVisible"
		class="modal _inventory"
		@mousedown="handleBackdropMouseDown"
		@click="handleBackdropClick"
	>
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
						:character="effectiveCharacter"
						:items="effectiveCharacter?.inventory?.items || []"
						:items-data="propsItemsData"
						:equipment-slots="equipmentSlots"
						@equip="(e) => emit('equip', e)"
						@unequip="(e) => emit('unequip', e)"
						@swap="(e) => emit('swap', e)"
						@drop="(e) => emit('drop', e)"
						@drag-inventory-drop="handleInventoryDrop"
					/>

					<InventoryStats v-show="activeTab === 'statistics'" :character="effectiveCharacter" />

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
import { useGameStore } from '@/stores/gameStore'
import { resolveEquippedSkills } from '@/utils/itemSkills.js'
import itemSkillsData from '@data/skills/items/items.json'
import { resolveCharacterTalents } from '@/utils/talents.js'
import talentsData from '@data/skills/talents/talents.json'

const gameStore = useGameStore()

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

const effectiveCharacter = computed(() => {
	return props.character || gameStore.characterData?.mc || {}
})

const emit = defineEmits(['close', 'equip', 'unequip', 'swap', 'drop'])

const activeTab = ref('inventory')

// Create a reactive copy of itemsData to ensure it updates properly
const localItemsData = ref({})

// Watch for changes and update local copy
watch(
	() => props.itemsData,
	(newData) => {
		console.log('InventoryModal: itemsData updated', newData, Object.keys(newData))
		if (newData && typeof newData === 'object') {
			localItemsData.value = { ...newData }
		}
	},
	{ deep: true, immediate: true }
)

// Expose itemsData under a local name for template prop binding
const propsItemsData = computed(() => localItemsData.value)

const tabs = [
	{ id: 'inventory', label: 'Инвентарь' },
	{ id: 'statistics', label: 'Статистика' },
	{ id: 'abilities', label: 'Способности' }
]

const inventoryItems = computed(() => {
	const char = effectiveCharacter.value
	if (!char?.inventory?.items) return []

	return char.inventory.items.map((invItem) => {
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
	const char = effectiveCharacter.value
	const innate = Array.isArray(char?.abilities)
		? char.abilities.map((ability) => ({
				id: ability.id || ability.name,
				name: ability.name,
				icon: ability.icon || '⚔️',
				description: ability.description || 'Нет описания',
				rank: ability.rank || ability.level,
				branch: ability.branch,
				data: ability.data || {}
		  }))
		: []

	const charTalents = resolveCharacterTalents(char, talentsData)
	const gearSkills = resolveEquippedSkills(char, localItemsData.value, itemSkillsData)

	return [...innate, ...charTalents, ...gearSkills]
})

const hpPercentage = computed(() => {
	const char = effectiveCharacter.value
	if (!char) return 0
	const hp = char.stats?.hp ?? char.hp ?? 0
	const hpmax = char.stats?.hpmax ?? char.hpmax ?? 0
	return hpmax > 0 ? (hp / hpmax) * 100 : 0
})

const mpPercentage = computed(() => {
	const char = effectiveCharacter.value
	if (!char) return 0
	const mp = char.stats?.mp ?? char.mp ?? 0
	const mpmax = char.stats?.mpmax ?? char.mpmax ?? 0
	return mpmax > 0 ? (mp / mpmax) * 100 : 0
})

let isBackdropMouseDown = false

function handleBackdropMouseDown(e) {
	isBackdropMouseDown = e.target === e.currentTarget
}

function handleBackdropClick(e) {
	if (isBackdropMouseDown && e.target === e.currentTarget) {
		closeModal()
	}
	isBackdropMouseDown = false
}

function closeModal() {
	activeTab.value = 'inventory'
	emit('close')
}

const equipmentSlots = computed(() => {
	const char = effectiveCharacter.value
	if (!char) return {}
	return (
		char.equipment_slots ||
		char.equipmentSlots ||
		char.equipment ||
		{}
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
