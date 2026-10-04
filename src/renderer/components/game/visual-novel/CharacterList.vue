<template>
	<div class="characters-container">
		<Character
			v-for="character in characters"
			:key="character.id"
			:character="character"
			:scene="scene"
			@character-click="$emit('character-click', $event)"
		/>
	</div>
</template>

<script setup>
import Character from '../characters/Character.vue'
const props = defineProps({
	characters: { type: Array, default: () => [] },
	scene: { type: Object, default: null }
})
defineEmits(['character-click'])
</script>
