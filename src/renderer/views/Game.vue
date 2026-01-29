<template>
	<div class="game-area">
		<!-- Stats Button -->
		<button class="stats-button" @click="toggleStatsModal">
			📊 Статы
		</button>
		
		<div class="game">
			<VisualNovel 
				ref="visualNovel" 
				src="/data/story/ru/start.json" 
				@end="onEnd" 
				@character-loaded="onCharacterLoaded"
			/>
		</div>
		
		<!-- Stats Modal -->
		<CharacterStatsModal 
			:is-visible="showStatsModal"
			:character="mcCharacter"
			@close="toggleStatsModal"
		/>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import VisualNovel from '../components/game/VisualNovel.vue'
import CharacterStatsModal from '../components/game/CharacterStatsModal.vue'

const router = useRouter()
const visualNovel = ref(null)
const showStatsModal = ref(false)
const mcCharacter = ref(null)

function onEnd() {
	router.push('/home')
}

function toggleStatsModal() {
	showStatsModal.value = !showStatsModal.value
}

function onCharacterLoaded(characterData) {
	// Store the MC character data when it's loaded
	if (characterData?.mc) {
		mcCharacter.value = characterData.mc
	}
}
</script>

<style scoped>
.game-area {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: #1a1a1a;
	color: #fff;
	position: relative;
}

.stats-button {
	position: absolute;
	top: 20px;
	left: 20px;
	z-index: 100;
	background-color: #2c2c2c;
	color: white;
	border: 2px solid #444;
	border-radius: 8px;
	padding: 10px 15px;
	font-size: 1rem;
	cursor: pointer;
	transition: all 0.2s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.stats-button:hover {
	background-color: #3a3a3a;
	border-color: #007bff;
	transform: translateY(-2px);
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
}

.game {
	flex: 1;
	position: relative;
	overflow: hidden;
}

.game-background {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-size: cover;
	background-position: center;
	transition: background 0.5s ease;
}

</style>
