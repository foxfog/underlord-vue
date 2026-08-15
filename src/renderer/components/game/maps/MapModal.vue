<template>
	<div
		v-if="isVisible"
		class="modal map-modal"
		@mousedown="onBackdropMouseDown"
		@click="onBackdropClick"
	>
		<div class="modal-content map-modal__content" @click.stop>
			<div class="map-modal__header">
				<h2 class="map-modal__title">Карта мира</h2>
				<div class="map-modal__controls">
					<button
						class="map-modal__zoom-btn"
						@click="zoomOut"
						:disabled="!canZoomOut"
						title="Отдалить"
					>
						−
					</button>
					<span class="map-modal__zoom-level">{{ (scale * 100).toFixed(0) }}%</span>
					<button
						class="map-modal__zoom-btn"
						@click="zoomIn"
						:disabled="!canZoomIn"
						title="Приблизить"
					>
						+
					</button>
				</div>
				<button class="btn-close" @click="close">×</button>
			</div>

			<div
				ref="containerRef"
				class="map-modal__body"
				@pointerdown="startDrag"
				@wheel.prevent="onWheel"
				@dragstart.prevent
				@selectstart.prevent
				:class="{ _dragging: isDragging, _zoomable: isZoomed }"
			>
				<div ref="contentRef" class="map-modal__dynamic-map" :style="transformStyle">
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
import { computed, defineAsyncComponent, ref, watch, nextTick } from 'vue'
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
	canZoomIn,
	canZoomOut,
	containerRef,
	contentRef,
	zoomIn,
	zoomOut,
	resetZoom,
	startDrag,
	onWheel,
	clampOffset,
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

let isBackdropMouseDown = false

function onBackdropMouseDown(e) {
	if (e.target === e.currentTarget) {
		isBackdropMouseDown = true
	}
}

function onBackdropClick(e) {
	if (isBackdropMouseDown && e.target === e.currentTarget) {
		close()
	}
	isBackdropMouseDown = false
}

function close() {
	emit('close')
}

function onChildGoto(target) {
	emit('goto', target)
}

watch(
	() => props.isVisible,
	(visible) => {
		if (visible) {
			resetZoom()
			nextTick(() => {
				clampOffset()
			})
		}
	}
)
</script>
