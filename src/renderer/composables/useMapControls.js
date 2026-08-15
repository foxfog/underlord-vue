import { ref, computed, onUnmounted, watch } from 'vue'

const ZOOM_LEVELS = [1, 1.5, 2.5]

export function useMapControls(containerRef = null, contentRef = null) {
	const internalContainerRef = containerRef || ref(null)
	const internalContentRef = contentRef || ref(null)

	const currentZoomIndex = ref(0)
	const offsetX = ref(0)
	const offsetY = ref(0)
	const isDragging = ref(false)

	const scale = computed(() => ZOOM_LEVELS[currentZoomIndex.value])
	const isZoomed = computed(() => scale.value > 1)
	const canZoomIn = computed(() => currentZoomIndex.value < ZOOM_LEVELS.length - 1)
	const canZoomOut = computed(() => currentZoomIndex.value > 0)

	let startPointerX = 0
	let startPointerY = 0
	let startOffsetX = 0
	let startOffsetY = 0
	let isPointerDown = false
	let hasDragged = false

	let resizeObserver = null

	function getDimensions() {
		const viewportWidth = internalContainerRef.value?.clientWidth || 0
		const viewportHeight = internalContainerRef.value?.clientHeight || 0
		const contentWidth = internalContentRef.value?.offsetWidth || 0
		const contentHeight = internalContentRef.value?.offsetHeight || 0
		return { viewportWidth, viewportHeight, contentWidth, contentHeight }
	}

	function clampOffset() {
		const { viewportWidth, viewportHeight, contentWidth, contentHeight } = getDimensions()
		if (!viewportWidth || !viewportHeight || !contentWidth || !contentHeight) return

		const scaledWidth = contentWidth * scale.value
		const scaledHeight = contentHeight * scale.value

		const maxOffsetX = Math.max(0, (scaledWidth - viewportWidth) / 2)
		const maxOffsetY = Math.max(0, (scaledHeight - viewportHeight) / 2)

		offsetX.value = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX.value))
		offsetY.value = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY.value))
	}

	function zoomIn() {
		if (canZoomIn.value) {
			const oldScale = scale.value
			currentZoomIndex.value++
			const newScale = scale.value
			if (oldScale > 0) {
				offsetX.value = (offsetX.value * newScale) / oldScale
				offsetY.value = (offsetY.value * newScale) / oldScale
			}
			clampOffset()
		}
	}

	function zoomOut() {
		if (canZoomOut.value) {
			const oldScale = scale.value
			currentZoomIndex.value--
			const newScale = scale.value
			if (newScale === 1) {
				resetOffset()
			} else if (oldScale > 0) {
				offsetX.value = (offsetX.value * newScale) / oldScale
				offsetY.value = (offsetY.value * newScale) / oldScale
				clampOffset()
			}
		}
	}

	function resetOffset() {
		offsetX.value = 0
		offsetY.value = 0
	}

	function resetZoom() {
		currentZoomIndex.value = 0
		resetOffset()
	}

	let wheelTimeout = null
	function onWheel(event) {
		if (wheelTimeout) return
		if (event.deltaY < -10) {
			zoomIn()
			wheelTimeout = setTimeout(() => {
				wheelTimeout = null
			}, 120)
		} else if (event.deltaY > 10) {
			zoomOut()
			wheelTimeout = setTimeout(() => {
				wheelTimeout = null
			}, 120)
		}
	}

	function startDrag(event) {
		if (!isZoomed.value) return
		if (event.button !== 0) return // Only primary click

		isPointerDown = true
		hasDragged = false
		startPointerX = event.clientX
		startPointerY = event.clientY
		startOffsetX = offsetX.value
		startOffsetY = offsetY.value

		window.addEventListener('pointermove', onPointerMove)
		window.addEventListener('pointerup', onPointerUp)
		window.addEventListener('pointercancel', onPointerUp)
	}

	function onPointerMove(event) {
		if (!isPointerDown) return

		const deltaX = event.clientX - startPointerX
		const deltaY = event.clientY - startPointerY

		if (!hasDragged && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
			hasDragged = true
			isDragging.value = true
		}

		if (isDragging.value) {
			offsetX.value = startOffsetX + deltaX
			offsetY.value = startOffsetY + deltaY
			clampOffset()
		}
	}

	function onPointerUp() {
		if (!isPointerDown) return
		isPointerDown = false

		window.removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('pointerup', onPointerUp)
		window.removeEventListener('pointercancel', onPointerUp)

		if (isDragging.value) {
			isDragging.value = false
			clampOffset()

			// Suppress click on map places if user dragged
			const preventClick = (e) => {
				e.stopPropagation()
				e.preventDefault()
			}
			window.addEventListener('click', preventClick, { capture: true, once: true })
			setTimeout(() => {
				window.removeEventListener('click', preventClick, { capture: true })
			}, 50)
		}
	}

	function stopDrag() {
		onPointerUp()
	}

	function setContainerSize() {
		clampOffset()
	}

	// ResizeObserver for responsive bounds
	if (typeof window !== 'undefined' && window.ResizeObserver) {
		resizeObserver = new ResizeObserver(() => {
			clampOffset()
		})
	}

	watch(
		() => internalContainerRef.value,
		(newEl, oldEl) => {
			if (oldEl && resizeObserver) resizeObserver.unobserve(oldEl)
			if (newEl && resizeObserver) resizeObserver.observe(newEl)
		}
	)

	watch(
		() => internalContentRef.value,
		(newEl, oldEl) => {
			if (oldEl && resizeObserver) resizeObserver.unobserve(oldEl)
			if (newEl && resizeObserver) resizeObserver.observe(newEl)
		}
	)

	onUnmounted(() => {
		if (resizeObserver) {
			resizeObserver.disconnect()
		}
		window.removeEventListener('pointermove', onPointerMove)
		window.removeEventListener('pointerup', onPointerUp)
		window.removeEventListener('pointercancel', onPointerUp)
	})

	const transformStyle = computed(() => ({
		transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value})`,
		transformOrigin: 'center center',
		transition: isDragging.value ? 'none' : 'transform 0.2s cubic-bezier(0.25, 1, 0.5, 1)',
		'--map-scale': scale.value,
		'--map-inv-scale': (1 / scale.value).toFixed(4)
	}))

	return {
		scale,
		offsetX,
		offsetY,
		isZoomed,
		isDragging,
		canZoomIn,
		canZoomOut,
		containerRef: internalContainerRef,
		contentRef: internalContentRef,
		zoomIn,
		zoomOut,
		resetZoom,
		startDrag,
		stopDrag,
		onWheel,
		clampOffset,
		transformStyle,
		setContainerSize,
		ZOOM_LEVELS
	}
}
