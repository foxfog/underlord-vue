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

						<div class="player-container">
							<div class="player-info">
								<h3>Селектор треков</h3>
								<p>Кликните на кнопку для смены трека в плеере</p>
							</div>
							
							<div class="track-selector">
								<div class="track-buttons">
									<button 
										v-for="(track, index) in predefinedTracks" 
										:key="track.id"
										:class="['track-btn', { 'active': currentTrackId === track.id }]"
										@click="selectTrack(track)"
									>
										<div class="track-number">{{ index + 1 }}</div>
										<div class="track-info">
											<div class="track-title">{{ track.title }}</div>
											<div class="track-artist">{{ track.artist }}</div>
										</div>
									</button>
								</div>
								
								<uiPlayerAudio
									ref="trackSelectorPlayer"
									:src="selectedTrack" 
									volumeType="music" 
									:audioLook="1"
									:resetOnStop="false"
									:stopBgMusic="true"
									:showThumb="false"
								/>
							</div>
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
	
	// Предопределённые треки для селектора
	const predefinedTracks = ref([
		{
			id: 1,
			title: 'Breaking Bad Intro',
			artist: 'TV Theme',
			src: 'audio/test/music/breaking-bad-intro.mp3'
		},
		{
			id: 2,
			title: 'Gigachad Theme',
			artist: 'Meme Music',
			src: 'audio/test/music/gigachad-theme-music.mp3'
		},
		{
			id: 3,
			title: 'GTA San Andreas',
			artist: 'Game SFX',
			src: 'audio/test/music/gta-san-andreas-mission-complete-sound-hq.mp3'
		},
		{
			id: 4,
			title: 'Wild Wild Web',
			artist: 'John The Whistler',
			src: 'audio/test/music/John The Whistler - Wild Wild Web.mp3'
		}
	])
	
	// Состояние селектора треков
	const selectedTrack = ref('')
	const currentTrackId = ref(null)
	const trackSelectorPlayer = ref(null)
	
	// Функция выбора трека
	function selectTrack(track) {
		currentTrackId.value = track.id
		selectedTrack.value = track.src
		
		console.log(`Selected track: ${track.title} by ${track.artist}`)
		
		// Если плеер уже смонтирован, сменяем трек напрямую
		if (trackSelectorPlayer.value) {
			trackSelectorPlayer.value.changeTrack(track.src)
		}
	}
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
	
	/* Track Selector Styles */
	.track-selector {
		margin-top: 1rem;
	}
	
	.track-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	
	.track-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		color: var(--color-white);
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
		min-height: 4rem;
	}
	
	.track-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: var(--color-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.track-btn.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-black);
		box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
	}
	
	.track-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		font-weight: bold;
		font-size: 1.2rem;
		flex-shrink: 0;
	}
	
	.track-btn.active .track-number {
		background: rgba(0, 0, 0, 0.2);
		color: var(--color-black);
	}
	
	.track-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.track-title {
		font-weight: bold;
		font-size: 1rem;
		line-height: 1.2;
	}
	
	.track-artist {
		font-size: 0.85rem;
		opacity: 0.8;
		line-height: 1.2;
	}
	
	.track-btn.active .track-artist {
		opacity: 0.7;
	}
	
	/* Responsive adjustments */
	@media (max-width: 768px) {
		.track-buttons {
			grid-template-columns: 1fr;
		}
		
		.track-btn {
			min-height: 3.5rem;
			padding: 0.75rem;
		}
		
		.track-number {
			width: 2rem;
			height: 2rem;
			font-size: 1rem;
		}
	}
</style>