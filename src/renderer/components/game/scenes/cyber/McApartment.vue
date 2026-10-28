<template>
	<div class="scene-mc-apartment">
		<!-- Фоновое изображение квартиры -->
		<img v-if="bgImage" :src="bgImage" alt="MC Apartment" class="scene-bg" />

		<!-- Интерактивные элементы комнаты -->
		<div class="scene-interactive-elements">
			<div class="apartment-item apartment-window" @click="onInteract('window')">
				<div class="item-indicator">Окно</div>
			</div>

			<div class="apartment-item apartment-terminal" @click="onInteract('terminal')">
				<div class="item-indicator">Компьютер</div>
			</div>

			<!-- Нейрошлем на кровати -->
			<div
				v-if="showHelmetOnBed"
				class="helmet-scene-item"
				:class="{ 'is-active': isMenuOpen, 'is-disabled': isInDialogueMode }"
				tabindex="0"
				role="button"
				aria-label="Нейрошлем"
				@click.stop="onHelmetClick"
				@keydown.enter.space.prevent="onHelmetClick"
			>
				<div class="helmet-pulse-halo" />
				<img
					:src="helmetImg"
					alt="Нейрошлем"
					class="helmet-sprite"
					draggable="false"
				/>
				<div v-if="!isMenuOpen && !isInDialogueMode" class="helmet-tooltip">
					Нейрошлем
				</div>
			</div>

			<slot name="interactive"></slot>
		</div>

		<!-- Контекстное меню нейрошлема -->
		<div
			v-if="isMenuOpen"
			class="helmet-menu-backdrop"
			@click.stop="closeMenu"
			@contextmenu.prevent="closeMenu"
		/>
		<div
			v-if="isMenuOpen"
			class="helmet-context-menu"
			@click.stop
			@contextmenu.prevent.stop
		>
			<div class="helmet-menu-header">
				<span class="helmet-menu-icon">🥽</span>
				<span class="helmet-menu-title">Нейрошлем Nervegear</span>
			</div>
			<div class="helmet-menu-actions">
				<button
					type="button"
					class="helmet-menu-btn helmet-btn-equip"
					@click="equipHelmet"
				>
					Надеть
				</button>
				<button
					type="button"
					class="helmet-menu-btn helmet-btn-cancel"
					@click="closeMenu"
				>
					Отмена
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useGameStore } from '@/stores/gameStore'
import { useRegisterModal } from '@/composables/useModalStack'
import { audioService } from '@/services/audioService'
import { SOUND_CLOTH } from '@/constants/sounds'
import { eventBus } from '@/utils/eventBus'

const props = defineProps({
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

const emit = defineEmits(['interact', 'goto', 'hotspot-click'])

const gameStore = useGameStore()
const isMenuOpen = ref(false)

function closeMenu() {
	isMenuOpen.value = false
}

useRegisterModal('mc-apartment-helmet-menu', isMenuOpen, closeMenu)

const basePath = computed(() => {
	return typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
})

const bgImage = computed(() => {
	return props.scene?.bg
		? `${basePath.value}${props.scene.bg}`
		: `${basePath.value}images/sprites/backgrounds/mc-apartment/default.jpg`
})

const helmetImg = computed(() => {
	return `${basePath.value}images/sprites/items/equipments/neuro_helmet.png`
})

const isHelmetEquipped = computed(() => {
	return gameStore.characterData?.mc?.equipment_slots?.head === 'neuro_helmet'
})

const hasHelmetInInventory = computed(() => {
	return gameStore.characterData?.mc?.inventory?.items?.some((it) => it.itemId === 'neuro_helmet')
})

const showHelmetOnBed = computed(() => {
	return props.scene?.id === 'mc_apartment' && !isHelmetEquipped.value && !hasHelmetInInventory.value
})

function onHelmetClick() {
	if (props.isInDialogueMode) return
	isMenuOpen.value = true
}

function equipHelmet() {
	closeMenu()

	const char = gameStore.characterData?.mc
	if (char) {
		if (!char.equipment_slots) {
			char.equipment_slots = {}
		}
		char.equipment_slots.head = 'neuro_helmet'
		if (char.inventory?.items) {
			const idx = char.inventory.items.findIndex((it) => it.itemId === 'neuro_helmet')
			if (idx !== -1) {
				char.inventory.items.splice(idx, 1)
			}
		}
	}

	audioService.playSound(SOUND_CLOTH, 'sound')
	eventBus.emit('item-equipped', { slot: 'head', itemId: 'neuro_helmet' })
}

const onInteract = (itemName) => {
	if (props.isInDialogueMode) return
	emit('interact', { item: itemName })
}
</script>

<style scoped>
.scene-mc-apartment {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	overflow: hidden;
}

.scene-bg {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	object-fit: cover;
	object-position: center;
	z-index: 0;
}

.scene-interactive-elements {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	pointer-events: auto;
}

.apartment-item {
	position: absolute;
	cursor: pointer;
	transition: all 0.3s ease;
	opacity: 0;
	pointer-events: auto;
}

.apartment-item:hover .item-indicator {
	opacity: 1;
	transform: scale(1.1);
}

.item-indicator {
	position: absolute;
	background: rgba(0, 0, 0, 0.7);
	color: #fff;
	padding: 0.25em 0.5em;
	border-radius: 0.25em;
	font-size: 0.75em;
	white-space: nowrap;
	opacity: 0;
	transition: opacity 0.3s ease;
	pointer-events: none;
	z-index: 10;
}

.apartment-window {
	right: 5%;
	top: 10%;
	width: 20%;
	height: 35%;
}

.apartment-window .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

.apartment-terminal {
	right: 8%;
	bottom: 15%;
	width: 18%;
	height: 20%;
}

.apartment-terminal .item-indicator {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
}

/* Нейрошлем на кровати */
.helmet-scene-item {
	position: absolute;
	left: 29.5%;
	top: 61.5%;
	transform: translate(-50%, -50%);
	cursor: pointer;
	z-index: 2;
	outline: none;
	user-select: none;
}

.helmet-scene-item.is-disabled {
	pointer-events: none;
	cursor: default;
}

.helmet-pulse-halo {
	position: absolute;
	top: 50%;
	left: 50%;
	width: 7.5em;
	height: 5em;
	transform: translate(-50%, -50%);
	border-radius: 50%;
	background: radial-gradient(ellipse at center, rgba(0, 229, 255, 0.4) 0%, rgba(0, 229, 255, 0) 70%);
	pointer-events: none;
	animation: helmet-glow-pulse 2.4s ease-in-out infinite;
	z-index: 1;
}

@keyframes helmet-glow-pulse {
	0%,
	100% {
		transform: translate(-50%, -50%) scale(0.9);
		opacity: 0.4;
	}

	50% {
		transform: translate(-50%, -50%) scale(1.2);
		opacity: 0.85;
	}
}

.helmet-sprite {
	width: 7.5em;
	height: auto;
	display: block;
	position: relative;
	z-index: 2;
	filter: drop-shadow(0.2em 0.4em 0.5em rgba(0, 0, 0, 0.75)) drop-shadow(0 0 0.25em rgba(0, 229, 255, 0.35));
	transition: filter 0.25s ease, transform 0.25s ease;
}

.helmet-scene-item:hover .helmet-sprite,
.helmet-scene-item.is-active .helmet-sprite {
	transform: scale(1.06);
	filter: drop-shadow(0.2em 0.4em 0.5em rgba(0, 0, 0, 0.75)) drop-shadow(0 0 0.6em rgba(0, 229, 255, 0.85));
}

.helmet-tooltip {
	position: absolute;
	top: -1.8em;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(10, 15, 25, 0.92);
	color: #e0f7fa;
	padding: 0.25em 0.6em;
	border-radius: 0.25em;
	border: 1px solid rgba(0, 229, 255, 0.5);
	font-family: Kurale, sans-serif;
	font-size: 0.8em;
	white-space: nowrap;
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.2s ease, transform 0.2s ease;
	z-index: 10;
	box-shadow: 0 0.2em 0.6em rgba(0, 0, 0, 0.6);
}

.helmet-scene-item:hover .helmet-tooltip {
	opacity: 1;
	transform: translateX(-50%) translateY(-0.2em);
}

/* Контекстное меню */
.helmet-menu-backdrop {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background: rgba(0, 0, 0, 0.35);
	z-index: 1001;
	pointer-events: auto;
}

.helmet-context-menu {
	position: absolute;
	left: 29.5%;
	top: 52%;
	transform: translate(-50%, -100%);
	width: 15em;
	background: rgba(13, 20, 32, 0.96);
	border: 1px solid rgba(0, 229, 255, 0.6);
	border-radius: 0.45em;
	padding: 0.75em 0.9em;
	box-shadow: 0 0.5em 1.8em rgba(0, 0, 0, 0.85), 0 0 0.8em rgba(0, 229, 255, 0.35);
	display: flex;
	flex-direction: column;
	gap: 0.65em;
	z-index: 1002;
	animation: helmet-menu-fade-in 0.15s ease-out;
}

.helmet-context-menu::after {
	content: '';
	position: absolute;
	bottom: -0.45em;
	left: 50%;
	transform: translateX(-50%);
	width: 0;
	height: 0;
	border-top: 0.45em solid rgba(0, 229, 255, 0.6);
	border-right: 0.45em solid transparent;
	border-left: 0.45em solid transparent;
}

@keyframes helmet-menu-fade-in {
	from {
		opacity: 0;
		transform: translate(-50%, -93%);
	}

	to {
		opacity: 1;
		transform: translate(-50%, -100%);
	}
}

.helmet-menu-header {
	display: flex;
	align-items: center;
	gap: 0.45em;
	border-bottom: 1px solid rgba(0, 229, 255, 0.25);
	padding-bottom: 0.4em;
}

.helmet-menu-icon {
	font-size: 1.1em;
	line-height: 1;
}

.helmet-menu-title {
	font-family: Kurale, sans-serif;
	font-size: 0.95em;
	font-weight: 600;
	color: #e0f7fa;
	text-shadow: 0 0 0.4em rgba(0, 229, 255, 0.5);
}

.helmet-menu-actions {
	display: flex;
	gap: 0.5em;
	justify-content: flex-end;
}

.helmet-menu-btn {
	padding: 0.35em 0.85em;
	border-radius: 0.3em;
	font-family: Kurale, sans-serif;
	font-size: 0.85em;
	cursor: pointer;
	transition: all 0.2s ease;
}

.helmet-btn-equip {
	background: rgba(0, 229, 255, 0.25);
	border: 1px solid #00e5ff;
	color: #ffffff;
}

.helmet-btn-equip:hover {
	background: rgba(0, 229, 255, 0.45);
	box-shadow: 0 0 0.8em rgba(0, 229, 255, 0.6);
}

.helmet-btn-cancel {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #cccccc;
}

.helmet-btn-cancel:hover {
	background: rgba(255, 255, 255, 0.16);
	color: #ffffff;
}
</style>
