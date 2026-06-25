<template>
	<div class="topbar">
		<button class="topbar-btn" @click="openStats" title="Статистика персонажа">
			📊 Статы
		</button>
		<button v-if="showInventoryButton" class="topbar-btn" @click="openInventory" title="Открыть инвентарь">
			🎒 Инвентарь
		</button>	<button class="topbar-btn" @click="openJournal" title="Открыть журнал">
		📔 Журнал
	</button>		<button v-if="showMapButton" class="topbar-btn" @click="openMap" title="Открыть карту мира">
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
		showMapButton: {
			type: Boolean,
			default: true
		},
		showInventoryButton: {
			type: Boolean,
			default: true
		}
	})

	const emit = defineEmits(['open-stats', 'open-inventory', 'open-map', 'open-journal'])

	function openStats() {
		emit('open-stats')
	}

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

