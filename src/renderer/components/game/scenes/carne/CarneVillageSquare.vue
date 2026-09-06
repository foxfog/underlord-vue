<template>
	<div class="scene-carne-square">
		<!-- Небо Нового Мира -->
		<div class="sky-layer">
			<div class="sun-glow"></div>
			<div class="cloud cloud-1"></div>
			<div class="cloud cloud-2"></div>
		</div>

		<!-- Горы на горизонте -->
		<div class="mountains-layer"></div>

		<!-- Дальний лес -->
		<div class="forest-layer"></div>

		<!-- Деревенские дома и строения на площади -->
		<div class="village-backdrop">
			<!-- Крестьянский дом слева -->
			<div class="village-house house-left">
				<div class="house-roof"></div>
				<div class="house-body">
					<div class="house-window"></div>
				</div>
			</div>

			<!-- Крестьянский дом вдалеке по центру -->
			<div class="village-house house-center">
				<div class="house-roof roof-straw"></div>
				<div class="house-body">
					<div class="house-window"></div>
				</div>
			</div>

			<!-- Дом старосты деревни (главное здание) -->
			<div class="village-house chief-house">
				<div class="house-roof chief-roof">
					<div class="roof-gable"></div>
				</div>
				<div class="house-body chief-body">
					<div class="chief-sign">ДОМ СТАРОСТЫ</div>
					<div class="chief-windows">
						<div class="house-window carved"></div>
						<div class="house-window carved"></div>
					</div>
					<div class="chief-porch">
						<div class="porch-posts"></div>
						<div class="chief-door"></div>
					</div>
				</div>
			</div>

			<!-- Амбар / сеновал справа -->
			<div class="village-house barn-right">
				<div class="house-roof barn-roof"></div>
				<div class="house-body barn-body">
					<div class="haystack"></div>
				</div>
			</div>
		</div>

		<!-- Земля и деревенская площадь -->
		<div class="ground-layer">
			<div class="dirt-plaza"></div>

			<!-- Каменный колодец в центре площади -->
			<div class="village-well">
				<div class="well-roof"></div>
				<div class="well-rope"></div>
				<div class="well-base">
					<div class="bucket"></div>
				</div>
			</div>
		</div>

		<!-- Атмосферные частицы -->
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
	},
	globalData: {
		type: Object,
		default: () => ({})
	},
	isInDialogueMode: {
		type: Boolean,
		default: false
	}
})

defineEmits(['goto'])
</script>

<style scoped>
.scene-carne-square {
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
	top: 12%;
	right: 35%;
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
	top: 18%;
	left: 8%;
	width: 15em;
	height: 2.8em;
	animation: cloudDrift 45s infinite linear;
}

.cloud-2 {
	top: 28%;
	right: 12%;
	width: 11em;
	height: 2.4em;
	animation: cloudDrift 60s infinite linear reverse;
}

/* Горы и лес */
.mountains-layer {
	position: absolute;
	top: 28%;
	left: 0;
	width: 100%;
	height: 35%;
	background: linear-gradient(135deg, transparent 40%, #1e3a2b 40%, #162e22 70%);
	clip-path: polygon(
		0% 100%, 0% 70%, 12% 40%, 25% 62%, 45% 30%, 65% 58%, 80% 35%, 100% 65%, 100% 100%
	);
	opacity: 0.75;
}

.forest-layer {
	position: absolute;
	top: 42%;
	left: 0;
	width: 100%;
	height: 25%;
	background: #0d2818;
	clip-path: polygon(
		0% 100%, 0% 45%, 6% 30%, 14% 48%, 22% 28%, 32% 46%, 42% 22%, 52% 44%,
		62% 26%, 74% 42%, 84% 28%, 94% 45%, 100% 32%, 100% 100%
	);
}

/* Строения деревни */
.village-backdrop {
	position: absolute;
	bottom: 22%;
	left: 0;
	width: 100%;
	height: 48%;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	padding: 0 4em;
	box-sizing: border-box;
	pointer-events: none;
}

.village-house {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	pointer-events: auto;
}

/* Дом слева */
.house-left {
	width: 16em;
	margin-left: 2em;
}

.house-roof {
	width: 18em;
	height: 7em;
	background: linear-gradient(180deg, #78350f 0%, #92400e 100%);
	clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
	box-shadow: 0 0.5em 1em rgba(0, 0, 0, 0.5);
}

.roof-straw {
	background: linear-gradient(180deg, #ca8a04 0%, #a16207 100%);
}

.house-body {
	width: 14em;
	height: 8.5em;
	background: repeating-linear-gradient(
		180deg,
		#451a03 0,
		#78350f 0.9em,
		#381402 1.05em,
		#78350f 1.95em
	);
	border: 2px solid #291002;
	box-shadow: inset 0 0 1.5em rgba(0, 0, 0, 0.6);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.house-window {
	width: 2.4em;
	height: 2.8em;
	background: rgba(254, 240, 138, 0.85);
	border: 0.25em solid #291002;
	border-radius: 0.2em;
	box-shadow: 0 0 0.8em rgba(254, 240, 138, 0.6);
}

/* Дом вдалеке по центру */
.house-center {
	width: 13em;
	transform: scale(0.85);
	opacity: 0.9;
	margin-bottom: 2em;
}

/* Дом старосты (Chief House) */
.chief-house {
	width: 26em;
	z-index: 5;
	margin-right: 4em;
}

.chief-roof {
	width: 28em;
	height: 9.5em;
	background: linear-gradient(180deg, #854d0e 0%, #713f12 60%, #451a03 100%);
	clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
	position: relative;
	box-shadow: 0 0.8em 1.5em rgba(0, 0, 0, 0.6);
}

.roof-gable {
	position: absolute;
	top: 25%;
	left: 50%;
	transform: translateX(-50%);
	width: 5em;
	height: 4em;
	background: #451a03;
	clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
	border-bottom: 2px solid #ca8a04;
}

.chief-body {
	width: 24em;
	height: 11em;
	background: repeating-linear-gradient(
		180deg,
		#5c2b09 0,
		#854d0e 1.2em,
		#451a03 1.35em,
		#854d0e 2.5em
	);
	border: 3px solid #381402;
	position: relative;
	box-shadow: 0 1em 2em rgba(0, 0, 0, 0.7);
}

.chief-sign {
	position: absolute;
	top: 0.6em;
	background: #78350f;
	border: 2px solid #d4af37;
	color: #fef08a;
	font-family: 'Overlord', serif;
	font-weight: 700;
	font-size: 0.85em;
	letter-spacing: 0.12em;
	padding: 0.2em 0.9em;
	border-radius: 0.25em;
	box-shadow: 0 0.25em 0.6em rgba(0, 0, 0, 0.6);
}

.chief-windows {
	display: flex;
	gap: 6.5em;
	margin-top: 1.8em;
}

.house-window.carved {
	width: 2.8em;
	height: 3.2em;
	border: 0.3em solid #ca8a04;
	box-shadow: 0 0 1em rgba(254, 240, 138, 0.75);
}

.chief-porch {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 8.5em;
	height: 5em;
	background: #381402;
	border: 2px solid #5c2b09;
	border-bottom: none;
	display: flex;
	justify-content: center;
	align-items: flex-end;
}

.chief-door {
	width: 3.6em;
	height: 4.6em;
	background: #1c0a02;
	border: 2px solid #78350f;
	border-bottom: none;
	border-top-left-radius: 0.8em;
	border-top-right-radius: 0.8em;
	box-shadow: inset 0 0.5em 1em rgba(0, 0, 0, 0.9);
}

/* Амбар справа */
.barn-right {
	width: 15em;
}

.barn-roof {
	width: 17em;
	height: 6em;
	background: #713f12;
	clip-path: polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%);
}

.barn-body {
	width: 13em;
	height: 7em;
	background: #451a03;
}

.haystack {
	width: 5em;
	height: 3.5em;
	background: #ca8a04;
	border-radius: 2.5em 2.5em 0 0;
	margin-top: 2em;
	box-shadow: 0 0.3em 0.8em rgba(0, 0, 0, 0.5);
}

/* Земля и площадь */
.ground-layer {
	position: absolute;
	bottom: 0;
	left: 0;
	width: 100%;
	height: 25%;
	background: #14532d;
	box-shadow: inset 0 1.2em 2.5em rgba(0, 0, 0, 0.5);
}

.dirt-plaza {
	position: absolute;
	bottom: 0;
	left: 50%;
	transform: translateX(-50%);
	width: 65em;
	height: 100%;
	background: radial-gradient(ellipse at 50% 100%, #92400e 0%, #78350f 50%, #451a03 85%, transparent 100%);
	opacity: 0.92;
}

/* Колодец в центре */
.village-well {
	position: absolute;
	bottom: 3.5em;
	left: 36%;
	transform: translateX(-50%);
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 10;
}

.well-roof {
	width: 4.5em;
	height: 2.2em;
	background: #78350f;
	clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
	border-bottom: 2px solid #ca8a04;
}

.well-rope {
	width: 0.25em;
	height: 1.8em;
	background: #fde047;
}

.well-base {
	width: 4.8em;
	height: 3.2em;
	background: repeating-linear-gradient(
		180deg,
		#52525b 0,
		#71717a 0.7em,
		#3f3f46 0.85em,
		#71717a 1.5em
	);
	border: 2px solid #27272a;
	border-radius: 0.4em;
	box-shadow: 0 0.6em 1.2em rgba(0, 0, 0, 0.6);
	position: relative;
}

.bucket {
	position: absolute;
	top: -0.8em;
	right: 0.6em;
	width: 1.1em;
	height: 1.3em;
	background: #92400e;
	border: 1px solid #78350f;
	border-radius: 0.15em;
}

/* Частицы пыльцы */
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

.p-1 { top: 25%; left: 18%; animation-delay: 0s; }
.p-2 { top: 40%; left: 42%; animation-delay: 1.5s; width: 0.35em; height: 0.35em; }
.p-3 { top: 55%; left: 68%; animation-delay: 2.2s; }
.p-4 { top: 20%; left: 82%; animation-delay: 3.1s; }
.p-5 { top: 70%; left: 28%; animation-delay: 4.5s; }
.p-6 { top: 45%; left: 12%; animation-delay: 1.2s; }

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
