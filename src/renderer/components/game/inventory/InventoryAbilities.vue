<template>
	<div class="tab-content-item">
		<div v-if="abilities && abilities.length > 0" class="abilities-list">
			<div v-for="ability in abilities" :key="ability.id" class="ability-item">
				<div class="ability-name">{{ ability.name }}</div>
				<div class="ability-description">{{ ability.description }}</div>
			</div>
		</div>
		<div v-else class="empty-message">Способности не найдены</div>
	</div>
</template>

<script setup>
const props = defineProps({ abilities: { type: Array, default: () => [] } })
</script>
