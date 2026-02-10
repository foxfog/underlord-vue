<template>
	<div class="slots-grid">
		<SaveItem v-for="slot in slots" :key="slot" :slot="slot" @click="onSlotClick" @delete="onDelete" />
	</div>
</template>

<script setup>
import SaveItem from './SaveItem.vue'
const props = defineProps({ slots: { type: Array, required: true } })
const emit = defineEmits(['slot-click', 'delete'])

function onSlotClick(slot) { emit('slot-click', slot) }
function onDelete(slot) { emit('delete', slot) }
</script>