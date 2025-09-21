<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">{{ $t('mainmenu.game-new') }}</div>
			</div>
			<div class="page-content">
				<div class="game-new-content">
					<h2>{{ $t('mainmenu.game-new') }}</h2>
					<p>Here you can start a new game session.</p>
					
					<div class="buttons buttons-list">
						<button class="btn btn-primary" @click="startNewGame">Start New Game</button>
						<button class="btn btn-secondary" @click="goBack">Back to Menu</button>
					</div>
				</div>
			</div>
		</div>
		<div class="menu-area __static">
			<MainMenu />
		</div>
		<div class="back-area">
			<img src="/images/wallpaper/1.jpg" />
		</div>
	</div>
</template>

<script setup>
	import { useRouter } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'

	const router = useRouter()

	function startNewGame() {
		// TODO: Implement new game logic
		console.log('Starting new game...')
		// router.push('/game/play') // Navigate to actual game when ready
	}

	function goBack() {
		router.push('/home')
	}
</script>

<style scoped>
.game-new-content {
	padding: 20px;
	text-align: center;
}

.game-new-content h2 {
	margin-bottom: 20px;
	color: #fff;
}

.game-new-content p {
	margin-bottom: 30px;
	color: #ccc;
	font-size: 16px;
}
</style>