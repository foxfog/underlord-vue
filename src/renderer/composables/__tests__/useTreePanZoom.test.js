import { describe, it, expect, vi } from 'vitest'
import { useTreePanZoom } from '../useTreePanZoom.js'

describe('useTreePanZoom composable', () => {
	it('initializes with default zoom and clamps zoom values', () => {
		const { zoomScale, zoomIn, zoomOut, resetZoom, minZoom, maxZoom } = useTreePanZoom()

		expect(zoomScale.value).toBe(1.0)
		expect(minZoom).toBe(0.45)
		expect(maxZoom).toBe(2.0)

		zoomIn(0.2)
		expect(zoomScale.value).toBe(1.2)

		zoomOut(0.5)
		expect(zoomScale.value).toBe(0.7)

		resetZoom()
		expect(zoomScale.value).toBe(1.0)

		// Clamping to maxZoom
		zoomIn(10)
		expect(zoomScale.value).toBe(2.0)

		// Clamping to minZoom
		zoomOut(10)
		expect(zoomScale.value).toBe(0.45)
	})

	it('computes correct zoomContentStyle', () => {
		const { zoomScale, zoomContentStyle, setZoom } = useTreePanZoom()

		setZoom(1.5)
		expect(zoomContentStyle.value).toEqual({
			transform: 'scale(1.5)',
			transformOrigin: '0 0'
		})
	})

	it('calculates centerView scroll positions properly for bottom-up trees', () => {
		const { centerView, setZoom } = useTreePanZoom()
		setZoom(1.0)

		const scrollContainer = {
			clientWidth: 800,
			clientHeight: 600,
			scrollLeft: 0,
			scrollTop: 0
		}
		const contentContainer = {
			scrollWidth: 1600,
			scrollHeight: 1200
		}

		centerView(scrollContainer, contentContainer, { alignY: 'bottom' })

		// scrollLeft = (1600 - 800) / 2 = 400
		expect(scrollContainer.scrollLeft).toBe(400)
		// scrollTop = 1200 - 600 = 600 (bottom aligned)
		expect(scrollContainer.scrollTop).toBe(600)

		// Center Y alignment
		centerView(scrollContainer, contentContainer, { alignY: 'center' })
		expect(scrollContainer.scrollTop).toBe(300)
	})

	it('ignores onPanStart when clicking on interactive elements', () => {
		const { isPanning, onPanStart } = useTreePanZoom()

		const mockButton = {
			closest: (selector) => selector.includes('button')
		}
		const mockEvent = {
			button: 0,
			target: mockButton,
			clientX: 100,
			clientY: 100,
			preventDefault: vi.fn()
		}

		onPanStart(mockEvent, {})
		expect(isPanning.value).toBe(false)
		expect(mockEvent.preventDefault).not.toHaveBeenCalled()
	})

	it('activates isPanning when clicking on background', () => {
		const { isPanning, onPanStart, onPanEnd } = useTreePanZoom()

		const mockBackground = {
			closest: () => null
		}
		const mockEvent = {
			button: 0,
			target: mockBackground,
			clientX: 100,
			clientY: 100,
			preventDefault: vi.fn()
		}

		onPanStart(mockEvent, { scrollLeft: 0, scrollTop: 0 })
		expect(isPanning.value).toBe(true)
		expect(mockEvent.preventDefault).toHaveBeenCalled()

		onPanEnd()
		expect(isPanning.value).toBe(false)
	})

	it('adds and removes window event listeners during pan cycle when window exists', () => {
		const addSpy = vi.fn()
		const removeSpy = vi.fn()
		vi.stubGlobal('window', {
			addEventListener: addSpy,
			removeEventListener: removeSpy
		})

		const { isPanning, onPanStart, onPanEnd } = useTreePanZoom()
		const mockEvent = {
			button: 0,
			target: { closest: () => null },
			clientX: 50,
			clientY: 50,
			preventDefault: vi.fn()
		}

		onPanStart(mockEvent, { scrollLeft: 0, scrollTop: 0 })
		expect(isPanning.value).toBe(true)
		expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
		expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

		onPanEnd()
		expect(isPanning.value).toBe(false)
		expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
		expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

		vi.unstubAllGlobals()
	})

	it('ensures ClassRaceTreeCanvas does not reference undeclared onPanMove or onPanEnd', async () => {
		const fs = await import('fs')
		const path = await import('path')
		const componentPath = path.resolve(__dirname, '../../components/game/dataEditor/ClassRaceTreeCanvas.vue')
		const content = fs.readFileSync(componentPath, 'utf-8')

		expect(content).not.toContain('@mousemove="onPanMove"')
		expect(content).not.toContain('@mouseup="onPanEnd"')
		expect(content).not.toContain('@mouseleave="onPanEnd"')
		expect(content).not.toContain("removeEventListener('mousemove', onPanMove)")
		expect(content).not.toContain("removeEventListener('mouseup', onPanEnd)")
	})

	it('supports deep zoom out down to 0.02 and smooth adaptive stepping', () => {
		const { zoomScale, zoomOut, zoomIn, setZoom } = useTreePanZoom({
			minZoom: 0.02,
			initialZoom: 0.1
		})

		expect(zoomScale.value).toBe(0.1)

		// At zoom < 0.12, adaptive step should be 0.02
		zoomOut()
		expect(zoomScale.value).toBe(0.08)

		zoomOut()
		expect(zoomScale.value).toBe(0.06)

		zoomIn()
		expect(zoomScale.value).toBe(0.08)

		setZoom(0.02)
		expect(zoomScale.value).toBe(0.02)

		// Clamps at 0.02
		zoomOut()
		expect(zoomScale.value).toBe(0.02)
	})

	it('gracefully handles native MouseEvent when bound directly to @click handlers', () => {
		const { zoomScale, zoomIn, zoomOut } = useTreePanZoom({
			minZoom: 0.1,
			initialZoom: 1.0,
			zoomStep: 0.15
		})

		const mockMouseEvent = {
			type: 'click',
			clientX: 100,
			clientY: 100
		}

		// When @click="zoomIn" passes MouseEvent as first argument
		expect(() => zoomIn(mockMouseEvent)).not.toThrow()
		expect(zoomScale.value).toBe(1.15)

		// When @click="zoomOut" passes MouseEvent as first argument
		expect(() => zoomOut(mockMouseEvent)).not.toThrow()
		expect(zoomScale.value).toBe(1.0)
	})
})
