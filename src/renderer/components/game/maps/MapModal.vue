<template>
	<div v-if="isVisible" class="map-modal" @click="onBackgroundClick">
		<div class="map-modal__content" @click.stop>
			<div class="map-modal__header">
				<h2 class="map-modal__title">Карта мира</h2>
				<button class="map-modal__close" @click="close">✖</button>
			</div>

			<div class="map-modal__body">
				<div class="map-modal__dynamic-map">
					<component :is="mapComponent" />
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
import { computed, defineAsyncComponent } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['close'])
const settingsStore = useSettingsStore()

const mapComponent = computed(() => {
	const name = (settingsStore.currentMap || 'default').toLowerCase()
	const mapComponents = {
		default: defineAsyncComponent(() => import('./default.vue')),
		cybercity: defineAsyncComponent(() => import('./cybercity.vue'))
	}
	return mapComponents[name] || mapComponents.default
})

function close() {
	emit('close')
}

function onBackgroundClick() {
	close()
}
</script>

