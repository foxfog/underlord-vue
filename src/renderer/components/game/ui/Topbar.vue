<template>
	<div class="topbar">
		<button
			v-if="showInventoryButton"
			class="topbar-btn"
			@click="openInventory"
			title="Открыть инвентарь"
		>
			🎒 Инвентарь
		</button>
		<button
			v-if="showJournalButton"
			class="topbar-btn"
			@click="openJournal"
			title="Открыть журнал"
		>
			📔 Журнал
		</button>
		<button v-if="showMapButton" class="topbar-btn" @click="openMap" title="Открыть карту мира">
			🗺 Карта
		</button>
	</div>
</template>

<script setup>
const props = defineProps({
	character: {
		type: Object,
		default: null
	},
	showInventoryButton: {
		type: Boolean,
		default: false
	},
	showJournalButton: {
		type: Boolean,
		default: false
	},
	showMapButton: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['open-inventory', 'open-map', 'open-journal'])

function openInventory() {
	emit('open-inventory')
}

function openMap() {
	emit('open-map')
}

function openJournal() {
	emit('open-journal')
}
</script>
