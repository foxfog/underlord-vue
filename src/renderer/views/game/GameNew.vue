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
		
		<!-- Age Verification Modal -->
		<div v-if="showAgeVerification" class="modal-overlay" @click="closeModal">
			<div class="modal-content" @click.stop>
				<div class="modal-header">
					<h3>{{ $t('ageVerification.title') }}</h3>
				</div>
				<div class="modal-body">
					<p>{{ $t('ageVerification.message') }}</p>
					<p>{{ $t('ageVerification.question') }}</p>
				</div>
				<div class="modal-footer">
					<button class="btn btn-secondary" @click="declineAge">{{ $t('ageVerification.no') }}</button>
					<button class="btn btn-primary" @click="confirmAge">{{ $t('ageVerification.yes') }}</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import { useRouter } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'

	const router = useRouter()
	const showAgeVerification = ref(false)

	function startNewGame() {
		// Show age verification modal instead of directly starting the game
		showAgeVerification.value = true
	}

	function goBack() {
		router.push('/home')
	}

	function closeModal() {
		showAgeVerification.value = false
	}

	function confirmAge() {
		// User confirmed they are 18 or older
		showAgeVerification.value = false
		// Navigate to the actual game
		router.push('/game')
	}

	function declineAge() {
		// User indicated they are under 18
		showAgeVerification.value = false
		// Could show a message or redirect to home
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

/* Age Verification Modal Styles */
.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.modal-content {
	background: #1e1e1e;
	border: 1px solid #444;
	border-radius: 8px;
	padding: 20px;
	min-width: 300px;
	max-width: 500px;
	text-align: center;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.modal-header h3 {
	color: #fff;
	margin: 0 0 15px 0;
}

.modal-body p {
	color: #ccc;
	margin: 10px 0;
	font-size: 16px;
}

.modal-footer {
	margin-top: 20px;
	display: flex;
	justify-content: center;
	gap: 15px;
}
</style>