<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">Playground</div>
			</div>
			<div class="page-content">
				<div class="playground-content">
					<div class="audio-section">
						<h2>Аудиоплеер</h2>
						<div class="player-container">
							<div class="player-info">
								<h3>X2Download</h3>
								<p>Основная музыкальная тема (не останавливает фоновую музыку)</p>
							</div>
							<uiPlayerAudio 
								:src="musicFile" 
								volumeType="music" 
								:audioLook="1"
								:resetOnStop="false"
							/>
						</div>
						
						<div class="player-container">
							<div class="player-info">
								<h3>Random Music</h3>
								<p>Случайная музыка из папки (останавливает фоновую музыку)</p>
							</div>
							<uiPlayerAudio
								:src="''" 
								volumeType="music" 
								:audioLook="1"
								:resetOnStop="true"
								:randomMode="true"
								:audioFolder="'audio/test/music/'"
								:stopBgMusic="true"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="menu-area __static">
			<MainMenu />
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	import MainMenu from '@/components/MainMenu.vue'
	
	// Используем одну из существующих песен
	const musicFile = ref('audio/test/music/X2Download.mp3')
</script>

<style scoped>
	
	.playground-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	
	.audio-section {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.audio-section h2 {
		color: var(--color-primary, #fff);
		margin-bottom: 1.5rem;
		font-size: 1.8rem;
	}
	
	.player-container {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.player-info {
		margin-bottom: 1rem;
	}
	
	.player-info h3 {
		color: var(--color-primary, #fff);
		margin-bottom: 0.25rem;
		font-size: 1.2rem;
	}
	
	.player-info p {
		color: var(--color-text-secondary, #aaa);
		font-size: 0.9rem;
		margin: 0;
	}
</style>