<template>
	<div class="sidebar-left">
		<slot />
	</div>
</template>

<script setup>
defineProps({
	hasDialogue: {
		type: Boolean,
		default: false
	}
})
</script>

<style scoped>
.sidebar-left {
	position: absolute;
	top: 4.5em;
	left: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	z-index: 100;
	pointer-events: auto;
}
</style>
