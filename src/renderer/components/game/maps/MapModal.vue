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

