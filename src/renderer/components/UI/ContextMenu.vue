<template>
	<div
		v-show="isVisible"
		ref="menuRef"
		class="context-menu"
		:style="{ top: position.y + 'px', left: position.x + 'px' }"
		@click.stop
		@contextmenu.stop
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
	import { ref, onBeforeUnmount } from 'vue'

	const props = defineProps({
		actions: { type: Array, default: () => [] }
	})

	const emit = defineEmits(['action'])

	const isVisible = ref(false)
	const menuRef = ref(null)
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

		// Закрываем меню при клике вне него (используем capture, чтобы не мешали .stop)
		setTimeout(() => {
			document.addEventListener('mousedown', handleClickOutside, true)
		}, 0)
	}

	function hide() {
		isVisible.value = false
		document.removeEventListener('mousedown', handleClickOutside, true)
	}

	function handleClickOutside(event) {
		// Если клик был вне самого меню — закрываем
		if (menuRef.value && !menuRef.value.contains(event.target)) {
			hide()
		}
	}

	function handleAction(action) {
		emit('action', action)
		hide()
	}

	onBeforeUnmount(() => {
		document.removeEventListener('mousedown', handleClickOutside, true)
	})

	defineExpose({
		show,
		hide
	})
</script>
