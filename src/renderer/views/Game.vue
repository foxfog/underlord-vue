<template>
	<div class="game-area">
		<div class="game">
			
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useRouter, useRoute } from 'vue-router'

	const router = useRouter()
	const route = useRoute()
	const { t } = useI18n()

	
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
