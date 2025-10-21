<template>
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
					>
						<div class="save-info">
							<h4>{{ save.name }}</h4>
							<p>{{ formatDate(save.date) }}</p>
							<p>Size: {{ formatFileSize(save.size) }}</p>
						</div>
						<div class="save-actions">
							<button class="btn btn-small btn-primary" @click="loadSave(group, save)">Load</button>
							<button class="btn btn-small btn-danger" @click="deleteSave(group, save)">Delete</button>
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
</template>

<script setup>
	import { ref, onMounted } from 'vue'
	import { useRouter } from 'vue-router'
	import { useGameStore } from '@/stores/game'

	const router = useRouter()
	const saveGroups = ref([])
	const loading = ref(true)
	const emit = defineEmits(['back'])

	// Load save data from storage
	async function loadSaveData() {
		loading.value = true
		try {
			if (window.api && typeof window.api.loadSaves === 'function') {
				const saves = await window.api.loadSaves()
				saveGroups.value = saves
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

	async function loadSave(group, save) {
		try {
			// Load the save data from the file
			const savePath = `saves/${group.slot}/${save.name === 'Auto Save' ? 'autosave.json' : save.name + '.json'}`
			const saveData = await window.api.loadSaveFile(savePath)
			
			if (saveData) {
				// Get the game store instance
				const gameStore = useGameStore()
				
				// Log the loaded save data to console
				console.log('Loaded save data:', saveData)
				console.log('Current game store state before loading:', {...gameStore.$state})
				
				// Load the save data into the store
				gameStore.loadSaveData(saveData)
				
				// Log the game store state after loading
				console.log('Game store state after loading:', {...gameStore.$state})
				
				// Navigate to the game view
				router.push('/game')
			} else {
				console.error('Failed to load save data')
			}
		} catch (error) {
			console.error('Error loading save:', error)
		}
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
		emit('back')
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