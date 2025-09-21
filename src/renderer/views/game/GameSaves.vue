<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">{{ $t('mainmenu.game-saves') }}</div>
			</div>
			<div class="page-content">
				<div class="game-saves-content">
					<h2>{{ $t('mainmenu.game-saves') }}</h2>
					<p>Manage your saved games here.</p>
					
					<div class="saves-list" v-if="saves.length > 0">
						<div 
							v-for="save in saves" 
							:key="save.id" 
							class="save-item"
							@click="loadSave(save)"
						>
							<div class="save-info">
								<h3>{{ save.name }}</h3>
								<p>{{ save.date }}</p>
								<p>Level: {{ save.level }}</p>
							</div>
							<div class="save-actions">
								<button class="btn btn-small btn-primary" @click.stop="loadSave(save)">Load</button>
								<button class="btn btn-small btn-danger" @click.stop="deleteSave(save.id)">Delete</button>
							</div>
						</div>
					</div>
					
					<div class="no-saves" v-else>
						<p>No saved games found.</p>
						<button class="btn btn-primary" @click="createNewGame">Start New Game</button>
					</div>
					
					<div class="buttons buttons-list">
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
	import { ref, onMounted } from 'vue'
	import { useRouter } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'

	const router = useRouter()
	const saves = ref([])

	// Mock data for demonstration
	onMounted(() => {
		// TODO: Load actual save data from storage
		saves.value = [
			{
				id: 1,
				name: 'Save Game 1',
				date: '2024-12-19 14:30',
				level: 5
			},
			{
				id: 2,
				name: 'Save Game 2',
				date: '2024-12-18 09:15',
				level: 3
			},
			{
				id: 3,
				name: 'Auto Save',
				date: '2024-12-17 21:45',
				level: 8
			}
		]
	})

	function loadSave(save) {
		// TODO: Implement save loading logic
		console.log('Loading save:', save)
		// router.push('/game/play', { query: { saveId: save.id } })
	}

	function deleteSave(saveId) {
		if (confirm('Are you sure you want to delete this save?')) {
			// TODO: Implement save deletion logic
			saves.value = saves.value.filter(save => save.id !== saveId)
			console.log('Deleted save:', saveId)
		}
	}

	function createNewGame() {
		router.push('/game/new')
	}

	function goBack() {
		router.push('/home')
	}
</script>

<style scoped>
.game-saves-content {
	padding: 20px;
}

.game-saves-content h2 {
	margin-bottom: 20px;
	color: #fff;
	text-align: center;
}

.game-saves-content > p {
	margin-bottom: 30px;
	color: #ccc;
	font-size: 16px;
	text-align: center;
}

.saves-list {
	margin-bottom: 30px;
}

.save-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 8px;
	padding: 15px;
	margin-bottom: 10px;
	cursor: pointer;
	transition: background-color 0.3s;
}

.save-item:hover {
	background: rgba(255, 255, 255, 0.15);
}

.save-info h3 {
	color: #fff;
	margin: 0 0 5px 0;
	font-size: 18px;
}

.save-info p {
	color: #ccc;
	margin: 2px 0;
	font-size: 14px;
}

.save-actions {
	display: flex;
	gap: 10px;
}

.btn-small {
	padding: 5px 15px;
	font-size: 14px;
}

.btn-danger {
	background: #dc3545;
	border-color: #dc3545;
}

.btn-danger:hover {
	background: #c82333;
	border-color: #bd2130;
}

.no-saves {
	text-align: center;
	margin-bottom: 30px;
}

.no-saves p {
	color: #ccc;
	margin-bottom: 20px;
}
</style>