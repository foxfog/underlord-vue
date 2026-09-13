<template>
	<div class="combat-tester-view">
		<!-- Header Bar -->
		<header class="combat-tester-header">
			<div class="header-left">
				<button class="tester-btn tester-btn-back" @click="returnToHome">
					<span class="btn-icon">‹</span>
					<span>Меню</span>
				</button>
				<div class="header-selector-box">
					<span class="selector-icon">⚔️</span>
					<label class="selector-label">Сражение:</label>
					<select v-model="selectedEncounterId" class="tester-select" @change="restartCombat">
						<option v-for="enc in availableEncounters" :key="enc.id" :value="enc.id">
							{{ enc.name }}
						</option>
					</select>
				</div>
			</div>
			<div class="header-right">
				<button class="tester-btn tester-btn-restart" @click="restartCombat">
					<span>🔄 Заново</span>
				</button>
			</div>
		</header>

		<!-- Combat Engine Overlay -->
		<CombatOverlay
			:key="combatKey"
			:encounter-id="selectedEncounterId"
			@combat-end="onCombatEnd"
		/>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import CombatOverlay from '@/components/game/CombatOverlay.vue'

const router = useRouter()

const availableEncounters = [
	{ id: 'carne_bandits', name: 'Нападение бандитов (3v3)' }
]

const selectedEncounterId = ref('carne_bandits')
const combatKey = ref(1)

function returnToHome() {
	router.push('/home')
}

function restartCombat() {
	combatKey.value += 1
}

function onCombatEnd({ result }) {
	console.log('[CombatTester] Combat finished with result:', result)
	// При клике «Продолжить» перезапускаем бой для повторного тестирования
	restartCombat()
}
</script>

<style scoped>
.combat-tester-view {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	background-color: #0b0f19;
	overflow: hidden;
	font-family: Kurale, sans-serif;
	color: #e2e8f0;
	font-size: calc(1 * var(--size));
}

/* Header */
.combat-tester-header {
	position: absolute;
	top: 0.5em;
	left: 1em;
	right: 1em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	z-index: 310;
	pointer-events: none;
}

.combat-tester-header > * {
	pointer-events: auto;
}

.header-left,
.header-right {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.tester-btn {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.4);
	color: #f6c445;
	padding: 0.35em 0.85em;
	border-radius: 0.4em;
	font-size: 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s, box-shadow 0.2s;
	backdrop-filter: blur(0.4em);
}

.tester-btn:hover {
	background: rgba(246, 196, 69, 0.2);
	border-color: #f6c445;
	color: #ffffff;
	box-shadow: 0 0 0.8em rgba(246, 196, 69, 0.3);
}

.btn-icon {
	font-size: 1.2em;
	line-height: 1;
}

.header-selector-box {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.35);
	border-radius: 0.4em;
	padding: 0.3em 0.8em;
	backdrop-filter: blur(0.4em);
}

.selector-icon {
	font-size: 1em;
}

.selector-label {
	font-size: 0.85em;
	color: #cbd5e1;
	font-weight: bold;
}

.tester-select {
	background: rgba(30, 41, 59, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f6c445;
	padding: 0.25em 0.5em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	outline: none;
	font-family: Kurale, sans-serif;
}

.tester-select:focus {
	border-color: #f6c445;
}
</style>
