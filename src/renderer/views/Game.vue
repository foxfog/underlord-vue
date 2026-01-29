<template>
	<div class="game-area">
		<div class="game">
			<VisualNovel src="/data/story/ru/start.json" @end="onEnd" />
		</div>
	</div>
</template>

<script setup>
import { useRouter } from 'vue-router'
import VisualNovel from '../components/game/VisualNovel.vue'

const router = useRouter()

function onEnd() {
	router.push('/home')
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
