<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">Game</div>
			</div>
			<div class="page-content">
				<div class="game-content">
					<h2>Game in Progress</h2>
					<p>Welcome to the game! This is where the actual game content would be displayed.</p>
					<div class="game-stats">
						<div class="stat">
							<span class="stat-label">Level:</span>
							<span class="stat-value">1</span>
						</div>
						<div class="stat">
							<span class="stat-label">Score:</span>
							<span class="stat-value">0</span>
						</div>
					</div>
					<div class="buttons buttons-list">
						<button class="btn btn-primary" @click="saveGame">Save Game</button>
						<button class="btn btn-secondary" @click="goToMenu">Main Menu</button>
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

	function saveGame() {
		// TODO: Implement game saving logic
		console.log('Game saved!')
		alert('Game saved successfully!')
	}

	function goToMenu() {
		router.push('/home')
	}
</script>

<style scoped>
.game-content {
	padding: 20px;
	text-align: center;
}

.game-content h2 {
	color: #fff;
	margin-bottom: 15px;
}

.game-content p {
	color: #ccc;
	margin-bottom: 30px;
	font-size: 16px;
}

.game-stats {
	display: flex;
	justify-content: center;
	gap: 30px;
	margin-bottom: 30px;
}

.stat {
	background: rgba(255, 255, 255, 0.1);
	padding: 15px;
	border-radius: 8px;
	min-width: 120px;
}

.stat-label {
	display: block;
	color: #aaa;
	font-size: 14px;
	margin-bottom: 5px;
}

.stat-value {
	display: block;
	color: #fff;
	font-size: 24px;
	font-weight: bold;
}
</style>