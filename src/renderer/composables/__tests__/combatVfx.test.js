import { describe, it, expect, vi } from 'vitest'
import { createVfxManager } from '../../utils/combat/combatVfx'

describe('combatVfx', () => {
	it('creates vfx manager with empty effects', () => {
		const vfx = createVfxManager()
		expect(vfx.hasActiveEffects()).toBe(false)
	})

	it('spawns and updates projectile until hit', () => {
		const vfx = createVfxManager()
		const onHit = vi.fn()

		vfx.spawnProjectile({
			from: { x: 0, y: 0 },
			to: { x: 100, y: 50 },
			type: 'arrow',
			duration: 200,
			onHit
		})

		expect(vfx.hasActiveEffects()).toBe(true)
		expect(onHit).not.toHaveBeenCalled()

		// Halfway through
		vfx.update(100, 1.0)
		expect(onHit).not.toHaveBeenCalled()

		// Finish duration
		vfx.update(200, 1.0)
		expect(onHit).toHaveBeenCalledTimes(1)
	})

	it('spawns heal beam and particles', () => {
		const vfx = createVfxManager()
		vfx.spawnHealBeam({
			target: { x: 50, y: 50 },
			color: '#22c55e',
			duration: 300
		})

		expect(vfx.hasActiveEffects()).toBe(true)

		// Finish duration
		vfx.update(350, 1.0)
		// Should still have lingering particles or finish
		vfx.update(800, 1.0)
		expect(vfx.hasActiveEffects()).toBe(false)
	})

	it('triggers and calculates unit hit flinch', () => {
		const vfx = createVfxManager()
		vfx.triggerFlinch('unit_1', 1.0, 200)

		const initialFlinch = vfx.getUnitFlinch('unit_1')
		expect(initialFlinch.flashAlpha).toBeGreaterThan(0)

		// Advance time
		vfx.update(100, 1.0)
		const midFlinch = vfx.getUnitFlinch('unit_1')
		expect(midFlinch).toBeDefined()

		// After duration
		vfx.update(200, 1.0)
		const finalFlinch = vfx.getUnitFlinch('unit_1')
		expect(finalFlinch.offsetX).toBe(0)
		expect(finalFlinch.flashAlpha).toBe(0)
	})

	it('respects speedMultiplier during update', () => {
		const vfx = createVfxManager()
		const onHit = vi.fn()

		vfx.spawnProjectile({
			from: { x: 0, y: 0 },
			to: { x: 100, y: 50 },
			type: 'magic',
			duration: 200,
			onHit
		})

		// At 2.0x speed, 100ms real time acts as 200ms
		vfx.update(100, 2.0)
		expect(onHit).toHaveBeenCalledTimes(1)
	})

	it('spawns melee slash and resolves after completion', () => {
		const vfx = createVfxManager()
		vfx.spawnMeleeSlash({
			target: { x: 50, y: 50 },
			angle: 0,
			color: '#fef08a',
			duration: 200
		})

		expect(vfx.hasActiveEffects()).toBe(true)
		vfx.update(250, 1.0)
		// Lingering impact sparks settle
		vfx.update(600, 1.0)
		expect(vfx.hasActiveEffects()).toBe(false)
	})
})

