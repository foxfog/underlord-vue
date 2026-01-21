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
							<button class="btn btn-primary" @click="confirmAge(true)">{{ $t('yes') }}</button>
							<button class="btn btn-primary" @click="confirmAge(false)">{{ $t('no') }}</button>
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
							<button class="btn btn-primary" @click="startGame" :disabled="!g.mc.name.trim()">{{ $t('confirm') }}</button>
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
	import { useI18n } from 'vue-i18n'
	import { useGameStore } from '@/stores/game'
	
	const router = useRouter()
	const { locale } = useI18n()
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
			// Prepare game checkpoint data with scene state
			const checkpoint = {
				mc: {
					name: g.mc.name.trim()
				},
				location: 'start',
				currentScene: 'start',
				currentLabel: 'start',
				currentCommandIndex: 0,
				timestamp: new Date().toISOString()
			}
			
			// Save the checkpoint
			const result = await window.electronAPI.saveGame(checkpoint)
			
			if (result.success) {
				// Set the player name in the game store
				g.updateMcName(g.mc.name.trim())
				
				// Load the start scene
				await g.loadScene('start', locale.value)
				
				// Navigate to the game view
				router.push('/game')
			} else {
				console.error('Failed to save game:', result.error)
			}
		} catch (error) {
			console.error('Error starting game:', error)
		}
	}
</script>