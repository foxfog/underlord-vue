import { describe, it, expect } from 'vitest'
import { buildBottomUpConnectorPath, TREE_MARKER_CONFIG } from '../treeConnectors.js'

describe('treeConnectors utility', () => {
	it('exports standard SVG marker configuration', () => {
		expect(TREE_MARKER_CONFIG).toBeDefined()
		expect(TREE_MARKER_CONFIG.viewBox).toBe('0 0 12 12')
		expect(TREE_MARKER_CONFIG.markerUnits).toBe('userSpaceOnUse')
		expect(TREE_MARKER_CONFIG.refX).toBe(1)
		expect(TREE_MARKER_CONFIG.refY).toBe(6)
		expect(TREE_MARKER_CONFIG.arrowLength).toBe(9)
		expect(TREE_MARKER_CONFIG.points).toBe('1 2.2, 10.5 6, 1 9.8')
	})

	it('builds a pure vertical line when parent and child are aligned in X', () => {
		const pX = 200
		const pY = 400
		const cX = 200.5 // Difference < 2
		const cY = 150

		const d = buildBottomUpConnectorPath({ pX, pY, cX, cY })

		// Arrow length = 9, so endY = 150 + 9 = 159
		expect(d).toBe('M 200 400 L 200.5 159')
	})

	it('builds a smooth cubic Bézier curve with vertical lead-in when X is offset', () => {
		const pX = 100
		const pY = 500
		const cX = 350
		const cY = 200

		const d = buildBottomUpConnectorPath({ pX, pY, cX, cY })

		// endY = 200 + 9 = 209
		// actualDeltaY = 500 - 209 = 291
		// leadIn = min(10, 291 * 0.2) = 10
		// curveEndY = 209 + 10 = 219
		expect(d.startsWith('M 100 500 C 100 ')).toBe(true)
		expect(d).toContain('350 219')
		expect(d.endsWith('L 350 209')).toBe(true)
	})

	it('falls back to cY if deltaY is too small for arrow docking', () => {
		const pX = 100
		const pY = 110
		const cX = 100
		const cY = 105 // deltaY = 5 <= 9 + 4 = 13

		const d = buildBottomUpConnectorPath({ pX, pY, cX, cY })
		expect(d).toBe('M 100 110 L 100 105')
	})
})
