<template>
	<div v-if="isVisible" class="map-modal" @click="onBackgroundClick">
		<div class="map-modal__content" @click.stop>
			<div class="map-modal__header">
				<h2 class="map-modal__title">Карта мира</h2>
				<button class="map-modal__close" @click="close">✖</button>
			</div>

			<div class="map-modal__body">
				<div class="map-modal__hint">
					Это схематичная версия карты. Здесь позже появится интерактив.
				</div>

				<div class="map-grid">
					<div class="map-grid__row">
						<div class="map-grid__cell __inactive">Туманы севера</div>
						<div class="map-grid__cell">Столичный район</div>
						<div class="map-grid__cell __inactive">Пограничье</div>
					</div>
					<div class="map-grid__row">
						<div class="map-grid__cell">Старый квартал</div>
						<div class="map-grid__cell __current">Текущая локация</div>
						<div class="map-grid__cell">Нижний рынок</div>
					</div>
					<div class="map-grid__row">
						<div class="map-grid__cell __inactive">Доковые районы</div>
						<div class="map-grid__cell">Арканы</div>
						<div class="map-grid__cell __inactive">Запретные земли</div>
					</div>
				</div>
			</div>

			<div class="map-modal__footer">
				<button class="map-modal__button" @click="close">
					Закрыть карту
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['close'])

function close() {
	emit('close')
}

function onBackgroundClick() {
	close()
}
</script>

<style scoped>
.map-modal {
	position: fixed;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
}

.map-modal__content {
	background: #11151f;
	border-radius: 10px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
	min-width: 640px;
	max-width: 960px;
	padding: 16px 18px 18px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.map-modal__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.map-modal__title {
	margin: 0;
	font-size: 20px;
	font-weight: 600;
	color: #f5f7ff;
}

.map-modal__close {
	border: none;
	background: transparent;
	color: #f5f7ff;
	font-size: 18px;
	cursor: pointer;
	padding: 4px 8px;
	border-radius: 4px;
	transition: background 0.15s ease, transform 0.1s ease;
}

.map-modal__close:hover {
	background: rgba(255, 255, 255, 0.08);
	transform: translateY(-1px);
}

.map-modal__body {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.map-modal__hint {
	font-size: 13px;
	color: #b0b6d4;
	opacity: 0.9;
}

.map-grid {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 10px;
	background: radial-gradient(circle at top left, #28324a 0, #151822 60%, #0a0c12 100%);
	border-radius: 8px;
	border: 1px solid rgba(255, 255, 255, 0.04);
}

.map-grid__row {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.map-grid__cell {
	min-height: 64px;
	border-radius: 6px;
	border: 1px solid rgba(255, 255, 255, 0.08);
	background: rgba(12, 18, 30, 0.85);
	display: flex;
	align-items: center;
	justify-content: center;
	text-align: center;
	font-size: 13px;
	color: #e0e5ff;
	padding: 8px;
	box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.02);
}

.map-grid__cell.__current {
	border-color: #4fd1c5;
	box-shadow:
		0 0 12px rgba(79, 209, 197, 0.4),
		inset 0 0 0 1px rgba(79, 209, 197, 0.35);
	background: radial-gradient(circle at top, rgba(79, 209, 197, 0.15), rgba(8, 14, 24, 0.95));
	font-weight: 600;
}

.map-grid__cell.__inactive {
	opacity: 0.5;
	border-style: dashed;
}

.map-modal__footer {
	display: flex;
	justify-content: flex-end;
	margin-top: 4px;
}

.map-modal__button {
	border-radius: 6px;
	border: none;
	padding: 8px 16px;
	font-size: 14px;
	font-weight: 500;
	background: linear-gradient(135deg, #4c6fff, #7f5dff);
	color: #f7f8ff;
	cursor: pointer;
	transition: transform 0.1s ease, box-shadow 0.1s ease, filter 0.15s ease;
	box-shadow: 0 10px 20px rgba(76, 111, 255, 0.25);
}

.map-modal__button:hover {
	filter: brightness(1.05);
	transform: translateY(-1px);
	box-shadow: 0 14px 26px rgba(76, 111, 255, 0.35);
}

.map-modal__button:active {
	transform: translateY(0);
	box-shadow: 0 8px 16px rgba(76, 111, 255, 0.25);
}

@media (max-width: 768px) {
	.map-modal__content {
		min-width: 0;
		width: calc(100% - 40px);
	}

	.map-grid__cell {
		min-height: 52px;
		font-size: 12px;
	}
}
</style>

