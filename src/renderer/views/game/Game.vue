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
			<div v-if="showMainMenu" class="main-menu-modal" @keydown.esc="toggleMainMenu">
				<div class="modal-backdrop" @click="toggleMainMenu"></div>
				<div class="modal-container">
					<div class="menu-area __static">
						<MainMenu :in-game-context="true" :on-continue="toggleMainMenu" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed, ref, onMounted, onUnmounted } from 'vue'
	import { useGameStore } from '@/stores/game'
	import MainMenu from '@/components/MainMenu.vue'
	
	const g = useGameStore()
	const showMainMenu = ref(false)
	
	// Toggle main menu visibility
	const toggleMainMenu = () => {
		showMainMenu.value = !showMainMenu.value
	}
	
	// Handle ESC key press
	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			toggleMainMenu()
		}
	}
	
	// Add event listener when component mounts
	onMounted(() => {
		document.addEventListener('keydown', handleKeyDown)
	})
	
	// Remove event listener when component unmounts
	onUnmounted(() => {
		document.removeEventListener('keydown', handleKeyDown)
	})
	
	// Expose toggle function to be called from other components if needed
	defineExpose({
		toggleMainMenu
	})
</script>

<style scoped>
.main-menu-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1000;
	display: flex;
	justify-content: center;
	align-items: center;
}

.modal-backdrop {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	backdrop-filter: blur(5px);
	background-color: rgba(0, 0, 0, 0.3);
}

.modal-container {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background-color: rgba(30, 30, 30, 0.8);
	backdrop-filter: blur(10px);
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.mainmenu {
	width: 100%;
	max-width: 500px;
	background-color: transparent;
	position: relative;
}

.nav {
	position: relative;
}
</style>