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
					
					<div v-if="loading" class="loading">
						<p>Loading saves...</p>
					</div>
					
					<div class="saves-list" v-else-if="saveGroups.length > 0">
						<div 
							v-for="group in saveGroups" 
							:key="group.id" 
							class="save-group"
						>
							<h3 class="save-group-title">{{ group.name }} (Slot {{ group.slot }})</h3>
							<div class="save-group-content">
								<div 
									v-for="save in group.saveFiles" 
									:key="save.name" 
									class="save-item"
									@click="loadSave(group, save)"
								>
									<div class="save-info">
										<h4>{{ save.name }}</h4>
										<p>{{ formatDate(save.date) }}</p>
										<p>Size: {{ formatFileSize(save.size) }}</p>
									</div>
									<div class="save-actions">
										<button class="btn btn-small btn-primary" @click.stop="loadSave(group, save)">Load</button>
										<button class="btn btn-small btn-danger" @click.stop="deleteSave(group, save)">Delete</button>
									</div>
								</div>
								<div v-if="group.saveFiles.length === 0" class="no-saves-in-group">
									<p>No save files in this group.</p>
								</div>
							</div>
						</div>
					</div>
					
					<div class="no-saves" v-else-if="!loading">
						<p>No saved games found.</p>
						<button class="btn btn-primary" @click="createNewGame">Start New Game</button>
					</div>
					
					<div class="buttons buttons-list">
						<button class="btn btn-secondary" @click="goBack">Back to Menu</button>
						<button class="btn btn-primary" @click="refreshSaves">Refresh</button>
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
	const saveGroups = ref([])
	const loading = ref(true)

	// Load save data from storage
	async function loadSaveData() {
		loading.value = true
		try {
			if (window.api && typeof window.api.loadSaves === 'function') {
				const saves = await window.api.loadSaves()
				saveGroups.value = saves
				console.log('Loaded saves:', saves) // For debugging
			} else {
				console.warn('API not available or loadSaves function not found')
				saveGroups.value = []
			}
		} catch (error) {
			console.error('Error loading saves:', error)
			saveGroups.value = []
		} finally {
			loading.value = false
		}
	}

	onMounted(() => {
		loadSaveData()
	})

	function formatDate(dateString) {
		const date = new Date(dateString)
		return date.toLocaleString()
	}

	function formatFileSize(bytes) {
		if (bytes === 0) return '0 Bytes'
		const k = 1024
		const sizes = ['Bytes', 'KB', 'MB', 'GB']
		const i = Math.floor(Math.log(bytes) / Math.log(k))
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
	}

	function loadSave(group, save) {
		// TODO: Implement save loading logic
		console.log('Loading save:', group, save)
		// router.push('/game/play', { query: { saveId: save.id } })
	}

	function deleteSave(group, save) {
		if (confirm(`Are you sure you want to delete save "${save.name}"?`)) {
			// TODO: Implement save deletion logic
			console.log('Deleted save:', group, save)
		}
	}

	function createNewGame() {
		router.push('/game/new')
	}

	function goBack() {
		router.push('/home')
	}

	function refreshSaves() {
		loadSaveData()
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

.loading {
	text-align: center;
	color: #fff;
	padding: 20px;
}

.saves-list {
	margin-bottom: 30px;
}

.save-group {
	margin-bottom: 30px;
	background: rgba(0, 0, 0, 0.2);
	border-radius: 8px;
	padding: 15px;
}

.save-group-title {
	color: #fff;
	margin: 0 0 15px 0;
	font-size: 20px;
	border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	padding-bottom: 10px;
}

.save-group-content {
	padding-left: 15px;
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

.save-info h4 {
	color: #fff;
	margin: 0 0 5px 0;
	font-size: 16px;
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

.no-saves, .no-saves-in-group {
	text-align: center;
}

.no-saves p, .no-saves-in-group p {
	color: #ccc;
	margin-bottom: 20px;
}

.buttons {
	display: flex;
	justify-content: center;
	gap: 15px;
}
</style>