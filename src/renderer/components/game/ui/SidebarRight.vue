<template>
	<div class="sidebar-right">
		<!-- Кнопка быстрого перехода в нейрошлем -->
		<button
			v-if="isHelmetEquipped"
			class="sidebar-btn sidebar-btn-vr"
			:class="{ 'is-disabled': hasDialogue }"
			:disabled="hasDialogue"
			:title="hasDialogue ? 'Недоступно во время диалога' : 'Войти в виртуальное пространство нейрошлема'"
			@click="openVr"
		>
			<span class="btn-icon">🥽</span>
			<span class="btn-text">Шлем</span>
			<span v-if="!hasDialogue" class="online-indicator"></span>
		</button>
	</div>
</template>

<script setup>
const props = defineProps({
	isHelmetEquipped: {
		type: Boolean,
		default: false
	},
	hasDialogue: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['open-vr'])

function openVr() {
	if (props.hasDialogue) return
	emit('open-vr')
}
</script>

<style scoped>
.sidebar-right {
	position: absolute;
	top: 4.5em;
	right: 0.8em;
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	z-index: 100;
	pointer-events: auto;
}

.sidebar-btn {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 0.25em;
	padding: 0.6em 0.8em;
	min-width: 4.5em;
	background: rgba(15, 23, 42, 0.85);
	backdrop-filter: blur(0.5em);
	border: 1px solid rgba(0, 229, 255, 0.4);
	color: #e0f2fe;
	border-radius: 0.5em;
	cursor: pointer;
	font-family: 'Kurale', sans-serif;
	font-size: 0.85em;
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	box-shadow: 0 0.25em 0.9em rgba(0, 0, 0, 0.5);
	user-select: none;
}

.sidebar-btn-vr {
	border-color: rgba(0, 229, 255, 0.5);
}

.sidebar-btn:hover:not(:disabled) {
	background: rgba(0, 229, 255, 0.2);
	border-color: #00e5ff;
	color: #ffffff;
	transform: translateX(-0.2em);
	box-shadow: 0 0 0.9em rgba(0, 229, 255, 0.4);
}

.sidebar-btn:disabled,
.sidebar-btn.is-disabled {
	opacity: 0.4;
	cursor: not-allowed;
	transform: none !important;
	box-shadow: none !important;
	border-color: rgba(255, 255, 255, 0.15);
}

.btn-icon {
	font-size: 1.6em;
	line-height: 1;
}

.btn-text {
	font-weight: 600;
	letter-spacing: 0.04em;
}

.online-indicator {
	position: absolute;
	top: 0.35em;
	right: 0.35em;
	width: 0.45em;
	height: 0.45em;
	background-color: #00e5ff;
	border-radius: 50%;
	box-shadow: 0 0 0.4em #00e5ff;
	animation: pulseGlow 1.8s infinite alternate;
}

@keyframes pulseGlow {
	from { opacity: 0.4; transform: scale(0.9); }
	to { opacity: 1; transform: scale(1.2); }
}
</style>
