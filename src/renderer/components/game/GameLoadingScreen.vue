<template>
	<div
		v-if="!isDestroyed"
		class="game-loading-screen"
		:class="{ 'is-hiding': !active }"
	>
		<div class="loading-indicator-wrap">
			<!-- Магический круг в стиле Yggdrasil / Overlord -->
			<div class="magic-circle">
				<div class="circle-outer"></div>
				<div class="circle-middle"></div>
				<div class="circle-inner"></div>
				<div class="circle-core"></div>
			</div>

			<!-- Блок информации о загрузке -->
			<div class="loading-info">
				<div class="loading-title">
					<span>{{ titleText }}</span>
					<span class="loading-dots">
						<span class="dot d-1">.</span>
						<span class="dot d-2">.</span>
						<span class="dot d-3">.</span>
					</span>
				</div>
				<div v-if="statusText" class="loading-status">{{ statusText }}</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
	active: {
		type: Boolean,
		default: true
	},
	titleText: {
		type: String,
		default: 'ЗАГРУЗКА'
	},
	statusText: {
		type: String,
		default: 'Синхронизация данных...'
	}
})

const isDestroyed = ref(!props.active)

watch(
	() => props.active,
	(val) => {
		if (val) {
			isDestroyed.value = false
		} else {
			setTimeout(() => {
				if (!props.active) {
					isDestroyed.value = true
				}
			}, 550)
		}
	},
	{ immediate: true }
)
</script>

<style scoped>
.game-loading-screen {
	position: absolute;
	inset: 0;
	z-index: 99999;
	background: #000000;
	display: flex;
	pointer-events: auto;
	user-select: none;
	transition: opacity 0.5s ease-out;
	font-size: calc(1 * var(--size));
	opacity: 1;
}

.game-loading-screen.is-hiding {
	opacity: 0;
	pointer-events: none;
}

/* Индикатор в нижнем правом углу */
.loading-indicator-wrap {
	position: absolute;
	right: 3em;
	bottom: 2.5em;
	display: flex;
	align-items: center;
	gap: 1.25em;
}

/* Магический круг с концентрическими кольцами */
.magic-circle {
	position: relative;
	width: 3.6em;
	height: 3.6em;
	flex-shrink: 0;
}

.circle-outer {
	position: absolute;
	inset: 0;
	border: 0.15em dashed #d4af37;
	border-radius: 50%;
	animation: rotateCw 10s linear infinite;
	box-shadow: 0 0 0.8em rgba(212, 175, 55, 0.4);
}

.circle-middle {
	position: absolute;
	inset: 0.45em;
	border: 0.1em solid rgba(56, 189, 248, 0.4);
	border-top-color: #38bdf8;
	border-bottom-color: #38bdf8;
	border-radius: 50%;
	animation: rotateCcw 4s linear infinite;
}

.circle-inner {
	position: absolute;
	inset: 0.9em;
	border: 0.08em dashed #86efac;
	border-radius: 50%;
	animation: rotateCw 6s linear infinite;
}

.circle-core {
	position: absolute;
	inset: 1.35em;
	background: radial-gradient(circle, #fef08a 0%, #ca8a04 70%, transparent 100%);
	border-radius: 50%;
	animation: pulseCore 1.6s ease-in-out infinite alternate;
	box-shadow: 0 0 0.6em rgba(254, 240, 138, 0.8);
}

/* Текстовая плашка */
.loading-info {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	text-align: left;
}

.loading-title {
	font-family: 'Overlord', serif, monospace;
	font-size: 1.15em;
	font-weight: 700;
	letter-spacing: 0.18em;
	color: #fef08a;
	text-shadow: 0 0 0.5em rgba(254, 240, 138, 0.5);
	display: flex;
	align-items: center;
}

.loading-dots {
	display: inline-flex;
	width: 1.2em;
}

.dot {
	opacity: 0;
	animation: blinkDot 1.4s infinite;
}

.d-1 {
	animation-delay: 0s;
}

.d-2 {
	animation-delay: 0.25s;
}

.d-3 {
	animation-delay: 0.5s;
}

.loading-status {
	font-family: 'Segoe UI', monospace, sans-serif;
	font-size: 0.75em;
	letter-spacing: 0.08em;
	color: #94a3b8;
	margin-top: 0.25em;
}

@keyframes rotateCw {
	from {
		transform: rotate(0deg);
	}
	to {
		transform: rotate(360deg);
	}
}

@keyframes rotateCcw {
	from {
		transform: rotate(360deg);
	}
	to {
		transform: rotate(0deg);
	}
}

@keyframes pulseCore {
	from {
		transform: scale(0.85);
		opacity: 0.7;
	}
	to {
		transform: scale(1.15);
		opacity: 1;
	}
}

@keyframes blinkDot {
	0%,
	20% {
		opacity: 0;
	}
	40%,
	100% {
		opacity: 1;
	}
}
</style>
