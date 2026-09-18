// src/renderer/composables/useTreePanZoom.js
import { ref, computed, getCurrentInstance, onUnmounted, nextTick } from 'vue'

/**
 * Composable for canvas panning (drag-to-pan) and zooming across tree views
 * (ClassRaceTreeCanvas, SkillTreeTesterView, etc.).
 *
 * @param {Object} [options]
 * @param {number} [options.minZoom=0.45] - Minimum zoom factor
 * @param {number} [options.maxZoom=2.0] - Maximum zoom factor
 * @param {number} [options.zoomStep=0.15] - Step size for zoomIn / zoomOut
 * @param {number} [options.initialZoom=1.0] - Initial zoom factor
 * @param {Function} [options.onZoomChange] - Optional callback triggered after zoom changes
 * @returns {Object}
 */
export function useTreePanZoom(options = {}) {
	const minZoom = options.minZoom ?? 0.45
	const maxZoom = options.maxZoom ?? 2.0
	const zoomStep = options.zoomStep ?? 0.15

	const zoomScale = ref(options.initialZoom ?? 1.0)
	const isPanning = ref(false)

	const panStart = { x: 0, y: 0 }
	const scrollStart = { left: 0, top: 0 }
	let activeScrollContainer = null

	function triggerZoomCallback() {
		if (typeof options.onZoomChange === 'function') {
			nextTick(() => {
				options.onZoomChange(zoomScale.value)
			})
		}
	}

	function clampZoom(val) {
		const num = typeof val === 'number' && !Number.isNaN(val) ? val : Number(val)
		if (Number.isNaN(num)) return zoomScale.value
		return Math.min(Math.max(Number(num.toFixed(3)), minZoom), maxZoom)
	}

	function setZoom(newZoom) {
		zoomScale.value = clampZoom(newZoom)
		triggerZoomCallback()
	}

	function getAdaptiveStep() {
		if (zoomScale.value < 0.12) return 0.02
		if (zoomScale.value < 0.35) return 0.05
		if (zoomScale.value < 0.7) return 0.1
		return zoomStep
	}

	function zoomIn(step) {
		const s = typeof step === 'number' && !Number.isNaN(step) ? step : getAdaptiveStep()
		setZoom(zoomScale.value + s)
	}

	function zoomOut(step) {
		const s = typeof step === 'number' && !Number.isNaN(step) ? step : getAdaptiveStep()
		setZoom(zoomScale.value - s)
	}

	function resetZoom() {
		setZoom(1.0)
	}

	/**
	 * Centers the canvas viewport within the scroll container.
	 * @param {HTMLElement} scrollContainer
	 * @param {HTMLElement} contentContainer
	 * @param {Object} [alignOpts]
	 * @param {'bottom' | 'center' | 'top'} [alignOpts.alignY='bottom']
	 */
	function centerView(scrollContainer, contentContainer, { alignY = 'bottom' } = {}) {
		if (!scrollContainer || !contentContainer) return

		const scale = zoomScale.value
		const contentW = contentContainer.scrollWidth * scale
		const contentH = contentContainer.scrollHeight * scale

		scrollContainer.scrollLeft = Math.max(0, (contentW - scrollContainer.clientWidth) / 2)

		if (alignY === 'bottom') {
			scrollContainer.scrollTop = Math.max(0, contentH - scrollContainer.clientHeight)
		} else if (alignY === 'center') {
			scrollContainer.scrollTop = Math.max(0, (contentH - scrollContainer.clientHeight) / 2)
		} else {
			scrollContainer.scrollTop = 0
		}
	}

	function onPanMove(e) {
		if (!isPanning.value || !activeScrollContainer) return
		const dx = e.clientX - panStart.x
		const dy = e.clientY - panStart.y
		activeScrollContainer.scrollLeft = scrollStart.left - dx
		activeScrollContainer.scrollTop = scrollStart.top - dy
	}

	function onPanEnd() {
		if (isPanning.value) {
			isPanning.value = false
			activeScrollContainer = null
			if (typeof window !== 'undefined') {
				window.removeEventListener('mousemove', onPanMove)
				window.removeEventListener('mouseup', onPanEnd)
			}
		}
	}

	function onPanStart(e, scrollContainer) {
		if (e.button !== 0 && e.button !== 1) return

		// Ignore click on interactive controls (cards, buttons, inputs)
		const isInteractive =
			e.target &&
			e.target.closest &&
			e.target.closest(
				'.tree-node-card, .skill-node-wrapper, .flow-node, button, input, textarea, select, a, .node-hover-actions, .zoom-controls-bar, .inspector-panel, .skill-inspector-panel'
			)
		if (isInteractive) return

		const container = scrollContainer || (e.currentTarget?.scrollLeft !== undefined ? e.currentTarget : null)
		isPanning.value = true
		activeScrollContainer = container
		panStart.x = e.clientX
		panStart.y = e.clientY

		if (container) {
			scrollStart.left = container.scrollLeft || 0
			scrollStart.top = container.scrollTop || 0
		}

		if (typeof window !== 'undefined') {
			window.addEventListener('mousemove', onPanMove)
			window.addEventListener('mouseup', onPanEnd)
		}
		e.preventDefault()
	}

	function onWheel(e, scrollContainer) {
		if (e.ctrlKey) {
			const step = zoomScale.value < 0.12 ? 0.015 : zoomScale.value < 0.35 ? 0.04 : 0.08
			const delta = e.deltaY < 0 ? step : -step
			setZoom(zoomScale.value + delta)
			e.preventDefault?.()
		} else if (e.shiftKey && scrollContainer && e.deltaY) {
			scrollContainer.scrollLeft += e.deltaY
			e.preventDefault?.()
		}
	}

	const zoomContentStyle = computed(() => {
		return {
			transform: `scale(${zoomScale.value})`,
			transformOrigin: '0 0'
		}
	})

	if (getCurrentInstance()) {
		onUnmounted(() => {
			onPanEnd()
		})
	}

	return {
		zoomScale,
		isPanning,
		minZoom,
		maxZoom,
		zoomStep,
		zoomContentStyle,
		setZoom,
		zoomIn,
		zoomOut,
		resetZoom,
		centerView,
		onPanStart,
		onPanMove,
		onPanEnd,
		onWheel
	}
}
