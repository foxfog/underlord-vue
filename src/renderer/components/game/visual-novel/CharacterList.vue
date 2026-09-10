<template>
	<div class="characters-container">
		<Character
			v-for="character in characters"
			:key="character.id"
			:character="character"
			@character-click="$emit('character-click', $event)"
		/>
	</div>
</template>

<script setup>
import Character from '../characters/Character.vue'
const props = defineProps({ characters: { type: Array, default: () => [] } })
defineEmits(['character-click'])
</script>
