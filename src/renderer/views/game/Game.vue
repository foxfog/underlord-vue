<template>
	<div class="game-area">
		<div class="game">
			<div class="game-background"></div>
			<div class="location _isometric">
				<div v-if="g.mc.name">
					Игра началась, {{ g.mc.name }}!
				</div>
				<div v-else>
					Игра началась
				</div>
			</div>
		</div>
		<div class="game-ui">
		</div>
		<div class="game-modals">
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'
	import { useGameStore } from '@/stores/game'
	
	const g = useGameStore()
	// Removed McName computed property - accessing g.mc.name directly instead
</script>