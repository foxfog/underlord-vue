<template>
	<div class="topbar">
		<button class="topbar-btn" @click="openStats" title="Статистика персонажа">
			📊 Статы
		</button>
		<button class="topbar-btn" @click="openInventory" title="Открыть инвентарь">
			🎒 Инвентарь
		</button>
	</div>
</template>

<script setup>
const props = defineProps({
	character: {
		type: Object,
		default: null
	}
})

const emit = defineEmits(['open-stats', 'open-inventory'])

function openStats() {
	emit('open-stats')
}

function openInventory() {
	emit('open-inventory')
}
</script>
