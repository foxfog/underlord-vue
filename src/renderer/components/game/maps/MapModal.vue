<template>
	<div v-if="isVisible" class="map-modal" @click="onBackgroundClick">
		<div class="map-modal__content" @click.stop>
			<div class="map-modal__header">
				<h2 class="map-modal__title">Карта мира</h2>
				<div class="map-modal__controls">
					<button 
						class="map-modal__zoom-btn"
						@click="zoomOut"
						:disabled="scale === 1"
						title="Отдалить"
					>
						−
					</button>
					<span class="map-modal__zoom-level">{{ (scale * 100).toFixed(0) }}%</span>
					<button 
						class="map-modal__zoom-btn"
						@click="zoomIn"
						:disabled="scale === 2.5"
						title="Приблизить"
					>
						+
					</button>
				</div>
				<button class="map-modal__close" @click="close">✖</button>
			</div>

			<div 
				class="map-modal__body"
				@mousedown="startDrag"
				@mousemove="onDrag"
				@mouseup="stopDrag"
				@mouseleave="stopDrag"
				@dragstart.prevent
				@selectstart.prevent
				:class="{ '_dragging': isDragging, '_zoomable': isZoomed }"
			>
				<div class="map-modal__dynamic-map" :style="transformStyle">
				<component
					:is="mapComponent"
					:current-location="props.globalData.currentLocation || ''"
					:global-data="props.globalData"
					@goto="onChildGoto"
				/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useMapControls } from '@/composables/useMapControls'

const props = defineProps({
	isVisible: {
		type: Boolean,
		default: false
	},
	globalData: {
		type: Object,
		default: () => ({})
	}
})

const emit = defineEmits(['close', 'goto'])
const settingsStore = useSettingsStore()

const {
	scale,
	isZoomed,
	isDragging,
	zoomIn,
	zoomOut,
	startDrag,
	onDrag,
	stopDrag,
	transformStyle
} = useMapControls()

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

function onChildGoto(target) {
    emit('goto', target)
}
</script>

