<template>
	<div
		v-if="isVisible"
		class="modal map-modal"
		@mousedown="onBackdropMouseDown"
		@click="onBackdropClick"
	>
		<div class="modal-content map-modal__content" @click.stop>
			<div class="map-modal__header">
				<h2 class="map-modal__title">{{ modalTitle }}</h2>

				<div class="map-modal__level-toggle" v-if="hasLevelToggle">
					<button
						class="map-modal__level-btn"
						:class="{ _active: activeLevel === 'local' }"
						@click="switchLevel('local')"
						title="Локальная карта местности (L)"
					>
						📍 Локальная
					</button>
					<button
						class="map-modal__level-btn"
						:class="{ _active: activeLevel === 'world' }"
						@click="switchLevel('world')"
						title="Глобальная карта мира (L)"
					>
						🌍 Мир
					</button>
				</div>

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
						@switch-level="switchLevel"
						@view-local="onViewLocal"
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch, nextTick, onUnmounted } from 'vue'
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

const mapComponents = {
	default: defineAsyncComponent(() => import('./default.vue')),
	cybercity: defineAsyncComponent(() => import('./cybercity.vue')),
	newworld: defineAsyncComponent(() => import('./newworld.vue')),
	carne: defineAsyncComponent(() => import('./carne.vue'))
}

const activeLevel = ref('local') // 'local' | 'world'

const isNewWorld = computed(() => {
	const g = props.globalData
	return (
		g?.calendarType === 'new_world' ||
		g?.worldMap === 'newworld' ||
		g?.currentMap === 'carne' ||
		g?.localMap === 'carne' ||
		(settingsStore.currentMap || '').toLowerCase() === 'carne' ||
		(settingsStore.currentMap || '').toLowerCase() === 'newworld'
	)
})

const currentLocalMap = computed(() => {
	const local = (props.globalData?.localMap || settingsStore.currentMap || '').toLowerCase()
	if (local && mapComponents[local]) return local
	if (isNewWorld.value) return 'carne'
	return 'cybercity'
})

const currentWorldMap = computed(() => {
	const world = (props.globalData?.worldMap || '').toLowerCase()
	if (world && mapComponents[world]) return world
	if (isNewWorld.value) return 'newworld'
	return 'cybercity'
})

const hasLevelToggle = computed(() => {
	return isNewWorld.value || currentLocalMap.value !== currentWorldMap.value
})

const activeMapName = computed(() => {
	if (activeLevel.value === 'world') {
		return currentWorldMap.value
	}
	return currentLocalMap.value
})

const mapComponent = computed(() => {
	const name = activeMapName.value
	return mapComponents[name] || mapComponents.default
})

const modalTitle = computed(() => {
	if (activeLevel.value === 'world') {
		return 'Карта мира: Новый Мир'
	}
	if (activeMapName.value === 'carne') {
		return 'Локальная карта: Деревня Карн'
	}
	if (activeMapName.value === 'cybercity') {
		return 'Карта: Кибергород 2138'
	}
	return 'Карта местности'
})

function switchLevel(level) {
	if (activeLevel.value === level) return
	activeLevel.value = level
	resetZoom()
	nextTick(() => {
		clampOffset()
	})
}

function onViewLocal(localMapId) {
	switchLevel('local')
}

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

function onKeyDown(e) {
	if (!props.isVisible) return
	if (e.key === 'l' || e.key === 'L' || e.key === 'д' || e.key === 'Д') {
		if (hasLevelToggle.value) {
			switchLevel(activeLevel.value === 'local' ? 'world' : 'local')
		}
	}
}

watch(
	() => props.isVisible,
	(visible) => {
		if (visible) {
			activeLevel.value = 'local'
			resetZoom()
			nextTick(() => {
				clampOffset()
			})
			window.addEventListener('keydown', onKeyDown)
		} else {
			window.removeEventListener('keydown', onKeyDown)
		}
	}
)

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown)
})
</script>
