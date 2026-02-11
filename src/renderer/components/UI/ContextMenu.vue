<template>
	<div
		v-show="isVisible"
		class="context-menu"
		:style="{ top: position.y + 'px', left: position.x + 'px' }"
		@click.stop
	>
		<button
			v-for="(action, index) in actions"
			:key="index"
			class="context-menu-item"
			@click="handleAction(action)"
		>
			{{ action.label }}
		</button>
	</div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
	actions: { type: Array, default: () => [] }
})

const emit = defineEmits(['action'])

const isVisible = ref(false)
const position = ref({ x: 0, y: 0 })

function show(event, actions = null) {
	// Можно передать actions при вызове show или использовать из props
	if (actions) {
		// Дочерний компонент передал свои actions
	}

	// Получаем позицию мыши
	position.value = {
		x: event.clientX,
		y: event.clientY
	}

	isVisible.value = true

	// Закрываем меню при клике вне его
	setTimeout(() => {
		document.addEventListener('click', handleClickOutside)
	}, 0)
}

function hide() {
	isVisible.value = false
	document.removeEventListener('click', handleClickOutside)
}

function handleClickOutside() {
	hide()
}

function handleAction(action) {
	emit('action', action)
	hide()
}

defineExpose({
	show,
	hide
})
</script>
