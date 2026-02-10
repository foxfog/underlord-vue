<template>
	<div v-if="visible" class="hotbar">
		<button class="hotbar-btn" @click="$emit('open-history')">История</button>
		<button class="hotbar-btn" @click="$emit('open-menu')">Главное меню</button>
		<button class="hotbar-btn" @click="$emit('open-settings')">Настройки</button>
		<button class="hotbar-btn" @click="$emit('open-save')">Сохранить</button>
		<button class="hotbar-btn" @click="$emit('open-load')">Загрузить</button>
	</div>
</template>

<script setup>
defineProps({
	visible: {
		type: Boolean,
		default: true
	}
})

defineEmits(['open-history', 'open-menu', 'open-settings', 'open-save', 'open-load'])
</script>