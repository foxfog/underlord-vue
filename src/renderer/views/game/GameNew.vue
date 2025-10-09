<template>
	<div class="game-area">
		<div class="game">
			<div class="game-background"></div>
		</div>
		<div class="game-ui">
		</div>
		<div class="game-modals">
			<div class="modal" v-if="showAgeVerification">
				<div class="modal-content">
					<div class="modal-header">
						<div class="modal-title h3">{{ $t('ageVerification.title') }}</div>
					</div>
					<div class="modal-body">
						<p>{{ $t('ageVerification.message') }}</p>
						<div class="btn-list _center">
							<button class="btn btn-primary" @click="confirmAge(true)">{{ $t('ageVerification.yes') }}</button>
							<button class="btn btn-primary" @click="confirmAge(false)">{{ $t('ageVerification.no') }}</button>
						</div>
					</div>
				</div>
			</div>
			<div class="modal" v-if="showNameInput">
				<div class="modal-content">
					<div class="modal-header">
						<div class="modal-title h3">Придумайте свое имя</div>
					</div>
					<div class="modal-body">
						<input 
							class="form-control _line" 
							type="text" 
							placeholder="Имя" 
							v-model="g.mc.name"
							@keyup.enter="startGame"
						>
					</div>
					<div class="modal-footer">
						<div class="btn-list">
							<button class="btn btn-primary" @click="startGame" :disabled="!g.mc.name.trim()">Начать новое приключение</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import { useRouter } from 'vue-router'
	import { useGameStore } from '@/stores/game'
	
	const router = useRouter()
	const g = useGameStore()
	const showAgeVerification = ref(true)
	const showNameInput = ref(false)
	
	function confirmAge(isOver18) {
		if (isOver18) {
			showAgeVerification.value = false
			showNameInput.value = true
		} else {
			// If under 18, go back to home
			router.push('/home')
		}
	}
	
	async function startGame() {
		if (!g.mc.name.trim()) return
		
		try {
			// Save the game data
			const result = await window.electronAPI.saveGame(g.mc.name.trim())
			
			if (result.success) {
				// Set the player name in the game store
				g.updateMcName(g.mc.name.trim())
				
				// Navigate to the game view
				router.push('/game')
			} else {
				console.error('Failed to save game:', result.error)
				// In a real app, you might want to show an error message to the user
			}
		} catch (error) {
			console.error('Error saving game:', error)
			// In a real app, you might want to show an error message to the user
		}
	}
</script>