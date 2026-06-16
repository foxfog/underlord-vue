import { ref, reactive, computed } from 'vue'

const ZOOM_LEVELS = [1, 1.5, 2.5]
const MIN_SCALE = ZOOM_LEVELS[0]
const MAX_SCALE = ZOOM_LEVELS[2]

export function useMapControls(containerWidth = 400, containerHeight = 400) {
	const currentZoomIndex = ref(0)
	const offsetX = ref(0)
	const offsetY = ref(0)
	const isDragging = ref(false)
	const dragStart = reactive({ x: 0, y: 0 })
	const containerSize = reactive({
		width: containerWidth,
		height: containerHeight
	})

	const scale = computed(() => ZOOM_LEVELS[currentZoomIndex.value])

	const isZoomed = computed(() => scale.value > 1)

	function zoomIn() {
		if (currentZoomIndex.value < ZOOM_LEVELS.length - 1) {
			currentZoomIndex.value++
			clampOffset()
		}
	}

	function zoomOut() {
		if (currentZoomIndex.value > 0) {
			currentZoomIndex.value--
			resetOffset()
		}
	}

	function resetZoom() {
		currentZoomIndex.value = 0
		offsetX.value = 0
		offsetY.value = 0
	}

	function startDrag(event) {
		if (!isZoomed.value) return

		isDragging.value = true
		dragStart.x = event.clientX - offsetX.value
		dragStart.y = event.clientY - offsetY.value
	}

	function onDrag(event) {
		if (!isDragging.value) return

		offsetX.value = event.clientX - dragStart.x
		offsetY.value = event.clientY - dragStart.y

		clampOffset()
	}

	function stopDrag() {
		isDragging.value = false
	}

	function clampOffset() {
		// Calculate how much the map extends beyond container when scaled
		const scaledWidth = containerSize.width * scale.value
		const scaledHeight = containerSize.height * scale.value
		
		const maxOffsetX = 0
		const minOffsetX = Math.min(0, containerSize.width - scaledWidth)
		const maxOffsetY = 0
		const minOffsetY = Math.min(0, containerSize.height - scaledHeight)

		offsetX.value = Math.max(Math.min(offsetX.value, maxOffsetX), minOffsetX)
		offsetY.value = Math.max(Math.min(offsetY.value, maxOffsetY), minOffsetY)
	}

	function resetOffset() {
		offsetX.value = 0
		offsetY.value = 0
	}

	function setContainerSize(width, height) {
		containerSize.width = width
		containerSize.height = height
		clampOffset()
	}

	const transformStyle = computed(() => ({
		transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
		transformOrigin: 'top left',
		transition: isDragging.value ? 'none' : 'transform 0.2s ease'
	}))

	return {
		scale,
		offsetX,
		offsetY,
		isZoomed,
		isDragging,
		zoomIn,
		zoomOut,
		resetZoom,
		startDrag,
		onDrag,
		stopDrag,
		transformStyle,
		setContainerSize,
		ZOOM_LEVELS
	}
}
