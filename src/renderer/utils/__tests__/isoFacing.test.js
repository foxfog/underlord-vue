import { describe, it, expect, vi } from 'vitest'
import {
	getFacingVector,
	getOppositeFacing,
	getFacingLabel,
	getFacingArrowPolygon,
	getRearNotchSegment,
	getRelativeAttackAngle,
	isBackAttack,
	drawIsometricFacingIndicator
} from '../isometric/isoFacing'

describe('isoFacing utility', () => {
	it('resolves correct (u, v) direction vectors for isometric facings', () => {
		const se = getFacingVector('SE')
		expect(se.du).toBeCloseTo(Math.SQRT1_2)
		expect(se.dv).toBeCloseTo(Math.SQRT1_2)

		const nw = getFacingVector('nw')
		expect(nw.du).toBeCloseTo(-Math.SQRT1_2)
		expect(nw.dv).toBeCloseTo(-Math.SQRT1_2)

		const sw = getFacingVector('SW')
		expect(sw.du).toBeCloseTo(-Math.SQRT1_2)
		expect(sw.dv).toBeCloseTo(Math.SQRT1_2)

		const ne = getFacingVector('NE')
		expect(ne.du).toBeCloseTo(Math.SQRT1_2)
		expect(ne.dv).toBeCloseTo(-Math.SQRT1_2)

		// Fallback for unknown facing
		const fallback = getFacingVector('UNKNOWN')
		expect(fallback.du).toBeCloseTo(Math.SQRT1_2)
		expect(fallback.dv).toBeCloseTo(Math.SQRT1_2)
	})

	it('resolves opposite facing directions correctly', () => {
		expect(getOppositeFacing('SE')).toBe('NW')
		expect(getOppositeFacing('NW')).toBe('SE')
		expect(getOppositeFacing('SW')).toBe('NE')
		expect(getOppositeFacing('NE')).toBe('SW')
		expect(getOppositeFacing('se')).toBe('NW')
	})

	it('returns localized facing labels with arrow symbols', () => {
		expect(getFacingLabel('SE')).toContain('Юго-Восток')
		expect(getFacingLabel('SE')).toContain('↘')
		expect(getFacingLabel('NW')).toContain('Северо-Запад')
		expect(getFacingLabel('NW')).toContain('↖')
	})

	it('calculates polygon vertices with correct isometric symmetry', () => {
		const se = getFacingArrowPolygon('SE', { radius: 19, yOffset: 2 })
		const sw = getFacingArrowPolygon('SW', { radius: 19, yOffset: 2 })
		const nw = getFacingArrowPolygon('NW', { radius: 19, yOffset: 2 })
		const ne = getFacingArrowPolygon('NE', { radius: 19, yOffset: 2 })

		expect(se).toHaveLength(4)
		expect(sw).toHaveLength(4)
		expect(nw).toHaveLength(4)
		expect(ne).toHaveLength(4)

		// SE tip should be down-right (positive x, positive y offset)
		expect(se[0].x).toBeGreaterThan(0)
		expect(se[0].y).toBeGreaterThan(2)

		// SW tip should be down-left (negative x, positive y offset)
		expect(sw[0].x).toBeLessThan(0)
		expect(sw[0].y).toBeGreaterThan(2)

		// NW tip should be up-left (negative x, negative y offset)
		expect(nw[0].x).toBeLessThan(0)
		expect(nw[0].y).toBeLessThan(2)

		// NE tip should be up-right (positive x, negative y offset)
		expect(ne[0].x).toBeGreaterThan(0)
		expect(ne[0].y).toBeLessThan(2)

		// Exact mirror symmetry between SE and SW
		expect(se[0].x).toBeCloseTo(-sw[0].x)
		expect(se[0].y).toBeCloseTo(sw[0].y)

		// Exact mirror symmetry between NW and NE
		expect(nw[0].x).toBeCloseTo(-ne[0].x)
		expect(nw[0].y).toBeCloseTo(ne[0].y)
	})

	it('calculates rear notch segment opposite to facing', () => {
		const rearSE = getRearNotchSegment('SE', { radius: 19, yOffset: 2, width: 6 })
		// Rear of SE is in the NW direction (negative x, negative y offset)
		expect(rearSE.p1.x).toBeLessThan(0)
		expect(rearSE.p2.x).toBeLessThan(0)
		expect(rearSE.p1.y).toBeLessThan(2)
		expect(rearSE.p2.y).toBeLessThan(2)
	})

	it('detects front, side, and back attacks accurately', () => {
		const target = { x: 0, y: 0 }

		// Target facing SE (down-right, +x axis)
		expect(getRelativeAttackAngle({ x: 1, y: 0 }, target, 'SE')).toBe('front')
		expect(isBackAttack({ x: 1, y: 0 }, target, 'SE')).toBe(false)

		expect(getRelativeAttackAngle({ x: -1, y: 0 }, target, 'SE')).toBe('back')
		expect(isBackAttack({ x: -1, y: 0 }, target, 'SE')).toBe(true)

		expect(getRelativeAttackAngle({ x: 0, y: 1 }, target, 'SE')).toBe('side')
		expect(isBackAttack({ x: 0, y: 1 }, target, 'SE')).toBe(false)

		expect(getRelativeAttackAngle({ x: -1, y: 1 }, target, 'SE')).toBe('back')
		expect(isBackAttack({ x: -1, y: 1 }, target, 'SE')).toBe(true)

		// Target facing NW (up-left, -x axis)
		expect(getRelativeAttackAngle({ x: -1, y: 0 }, target, 'NW')).toBe('front')
		expect(getRelativeAttackAngle({ x: 1, y: 0 }, target, 'NW')).toBe('back')
		expect(isBackAttack({ x: 1, y: 0 }, target, 'NW')).toBe(true)
	})

	it('executes canvas drawing commands cleanly without errors', () => {
		const ctx = {
			save: vi.fn(),
			restore: vi.fn(),
			beginPath: vi.fn(),
			closePath: vi.fn(),
			ellipse: vi.fn(),
			moveTo: vi.fn(),
			lineTo: vi.fn(),
			fill: vi.fn(),
			stroke: vi.fn(),
			fillStyle: '',
			strokeStyle: '',
			lineWidth: 1,
			shadowColor: '',
			shadowBlur: 0
		}

		drawIsometricFacingIndicator(ctx, {
			facing: 'SE',
			team: 'ally',
			isActive: false,
			drawRing: true,
			drawRearNotch: true
		})

		expect(ctx.save).toHaveBeenCalled()
		expect(ctx.beginPath).toHaveBeenCalled()
		expect(ctx.ellipse).toHaveBeenCalled()
		expect(ctx.fill).toHaveBeenCalled()
		expect(ctx.stroke).toHaveBeenCalled()
		expect(ctx.restore).toHaveBeenCalled()
	})
})
