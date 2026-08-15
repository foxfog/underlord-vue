<template>
	<div v-if="isVisible" class="modal history-modal" @click="$emit('close')">
		<div class="modal-content history-inner" @click.stop>
			<div class="history-header">
				<h2 class="title">История диалогов</h2>
				<button class="btn-close" @click="$emit('close')">×</button>
			</div>
			<div class="history-list" ref="listRef">
				<div v-for="(entry, index) in entries" :key="index" class="history-entry">
					<div class="meta">
						<span class="speaker" v-if="entry.speaker">{{ entry.speaker }}:</span>
						<span class="type" v-else-if="entry.type === 'titles'">[Заголовок]</span>
						<span class="type" v-else-if="entry.type === 'narration'">[Наррация]</span>
					</div>
					<div class="text" v-html="entry.text"></div>
				</div>
				<div v-if="!entries || entries.length === 0" class="empty">История пуста</div>
			</div>
			<div class="history-footer">
				<button class="btn btn-primary" @click="$emit('close')">Закрыть</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
	isVisible: { type: Boolean, default: false },
	entries: { type: Array, default: () => [] }
})

defineEmits(['close'])

const listRef = ref(null)

watch(
	() => props.isVisible,
	(v) => {
		if (v) {
			// scroll to bottom when opened
			setTimeout(() => {
				if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
			}, 50)
		}
	}
)
</script>
