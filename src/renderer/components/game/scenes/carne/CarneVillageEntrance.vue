<template>
	<div class="scene-carne-entrance">
		<!-- Фоновый градиент и пейзаж Нового Мира -->
		<div class="sky-layer">
			<div class="sun-glow"></div>
			<div class="cloud cloud-1"></div>
			<div class="cloud cloud-2"></div>
		</div>

		<!-- Горы на горизонте -->
		<div class="mountains-layer"></div>

		<!-- Деревья и лес вокруг деревни -->
		<div class="forest-layer"></div>

		<!-- Частокол и ворота деревни Карн -->
		<div class="palisade-layer">
			<div class="village-gate">
				<div class="gate-arch"></div>
				<div class="gate-sign">ДЕРЕВНЯ КАРН</div>
			</div>
		</div>

		<!-- Передний план: дорога и трава -->
		<div class="ground-layer">
			<div class="dirt-road"></div>
			<div class="grass-detail"></div>
		</div>

		<!-- Атмосферные частицы (пыльца, солнечные блики) -->
		<div class="ambient-particles">
			<div v-for="n in 12" :key="n" :class="`particle p-${n}`"></div>
		</div>
	</div>
</template>

<script setup>
defineProps({
	scene: {
		type: Object,
		required: true
	}
})
</script>

<style scoped>
.scene-carne-entrance {
	position: absolute;
	inset: 0;
	overflow: hidden;
	background: #0f2b1d;
	user-select: none;
	font-size: 1em;
}

/* Небо */
.sky-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 60%;
	background: linear-gradient(180deg, #38bdf8 0%, #7dd3fc 45%, #bae6fd 80%, #dcfce7 100%);
}

.sun-glow {
	position: absolute;
	top: 15%;
	right: 25%;
	width: 7.5em;
	height: 7.5em;
	border-radius: 50%;
	background: radial-gradient(circle, rgba(254, 240, 138, 0.9) 0%, rgba(253, 224, 71, 0.4) 50%, transparent 80%);
	box-shadow: 0 0 3.75em rgba(254, 240, 138, 0.8);
	animation: sunPulse 6s infinite alternate ease-in-out;
}

.cloud {
	position: absolute;
	background: rgba(255, 255, 255, 0.7);
	border-radius: 3em;
	filter: blur(0.25em);
}

.cloud-1 {
	top: 20%;
	left: 10%;
	width: 14em;
	height: 2.8em;
	animation: cloudDrift 45s infinite linear;
}

.cloud-2 {
	top: 32%;
	right: 15%;
	width: 10em;
	height: 2.2em;
	animation: cloudDrift 60s infinite linear reverse;
}

/* Горы */
.mountains-layer {
	position: absolute;
	top: 30%;
	left: 0;
	width: 100%;
	height: 35%;
	background: linear-gradient(135deg, transparent 40%, #1e3a2b 40%, #162e22 70%);
	clip-path: polygon(
		0% 100%, 0% 75%, 15% 45%, 30% 65%, 50% 35%, 70% 60%, 85% 40%, 100% 70%, 100% 100%
	);
	opacity: 0.85;
}

/* Лес */
.forest-layer {
	position: absolute;
	top: 45%;
	left: 0;
	width: 100%;
	height: 25%;
	background: #0d2818;
	clip-path: polygon(
		0% 100%, 0% 50%, 5% 35%, 10% 48%, 18% 30%, 25% 45%, 35% 25%, 45% 42%,
		55% 28%, 68% 45%, 78% 32%, 88% 48%, 95% 30%, 100% 45%, 100% 100%
	);
}

/* Частокол и ворота деревни Карн */
.palisade-layer {
	position: absolute;
	top: 55%;
	left: 0;
	width: 100%;
	height: 25%;
	background: repeating-linear-gradient(
		90deg,
		#5c4033 0,
		#78350f 0.75em,
		#451a03 0.9em,
		#78350f 1em,
		#5c4033 1.75em
	);
	clip-path: polygon(
		0% 100%, 0% 25%, 2% 0%, 4% 25%, 6% 0%, 8% 25%, 10% 0%, 12% 25%,
		14% 0%, 16% 25%, 18% 0%, 20% 25%, 22% 0%, 24% 25%, 26% 0%, 28% 25%,
		30% 0%, 32% 25%, 34% 0%, 36% 25%, 38% 0%, 40% 100%, 60% 100%,
		62% 25%, 64% 0%, 66% 25%, 68% 0%, 70% 25%, 72% 0%, 74% 25%,
		76% 0%, 78% 25%, 80% 0%, 82% 25%, 84% 0%, 86% 25%, 88% 0%,
		90% 25%, 92% 0%, 94% 25%, 96% 0%, 98% 25%, 100% 0%, 100% 100%
	);
	box-shadow: 0 0.6em 1.5em rgba(0, 0, 0, 0.6);
}

.village-gate {
	position: absolute;
	left: 50%;
	bottom: 0;
	transform: translateX(-50%);
	width: 14em;
	height: 7.5em;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
}

.gate-arch {
	width: 12em;
	height: 6em;
	border: 0.9em solid #451a03;
	border-bottom: none;
	border-top-left-radius: 6em;
	border-top-right-radius: 6em;
	background: rgba(15, 23, 42, 0.4);
	box-shadow: inset 0 0.6em 1.25em rgba(0, 0, 0, 0.7);
}

.gate-sign {
	position: absolute;
	top: -0.75em;
	background: #78350f;
	border: 2px solid #b45309;
	color: #fef3c7;
	font-family: 'Overlord', serif;
	font-weight: 700;
	font-size: 0.85em;
	letter-spacing: 0.12em;
	padding: 0.2em 0.8em;
	border-radius: 0.25em;
	box-shadow: 0 0.25em 0.6em rgba(0, 0, 0, 0.5);
}

/* Земля и дорога */
.ground-layer {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: 25%;
	background: #14532d;
	box-shadow: inset 0 1em 2em rgba(0, 0, 0, 0.4);
}

.dirt-road {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 20em;
	height: 100%;
	background: linear-gradient(180deg, #78350f 0%, #92400e 60%, #a16207 100%);
	clip-path: polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%);
	opacity: 0.95;
}

.ambient-particles {
	position: absolute;
	inset: 0;
	pointer-events: none;
}

.particle {
	position: absolute;
	width: 0.25em;
	height: 0.25em;
	background: #fef08a;
	border-radius: 50%;
	opacity: 0.6;
	animation: floatDust 8s infinite alternate ease-in-out;
}

.p-1 { top: 30%; left: 20%; animation-delay: 0s; }
.p-2 { top: 45%; left: 45%; animation-delay: 1.5s; width: 0.4em; height: 0.4em; }
.p-3 { top: 60%; left: 70%; animation-delay: 2.2s; }
.p-4 { top: 25%; left: 80%; animation-delay: 3.1s; }
.p-5 { top: 75%; left: 30%; animation-delay: 4.5s; }
.p-6 { top: 50%; left: 15%; animation-delay: 1.2s; }

@keyframes sunPulse {
	from { transform: scale(1); opacity: 0.9; }
	to { transform: scale(1.08); opacity: 1; }
}

@keyframes cloudDrift {
	from { transform: translateX(-2.5em); }
	to { transform: translateX(3em); }
}

@keyframes floatDust {
	0% { transform: translateY(0) translateX(0); opacity: 0.3; }
	50% { transform: translateY(-1.25em) translateX(0.6em); opacity: 0.8; }
	100% { transform: translateY(-2.5em) translateX(-0.6em); opacity: 0.2; }
}
</style>
