/**
 * PixiJS Isometric GPU VFX & Particle Layer
 *
 * Implements GPU-batched particle rendering via PixiJS ParticleContainer:
 * - Ultra-fast hardware batching for thousands of particles in 1 draw call.
 * - Physics simulation (velocity, gravity, fade, scale decay) per frame.
 * - Pool-friendly allocation to prevent GC spikes.
 * - Support for environmental effects, weed bursts, and spell VFX.
 */

import { Container, ParticleContainer, Particle, Texture } from 'pixi.js'

export class PixiVfxLayer {
	constructor() {
		this.container = new Container()
		this.container.label = 'vfxLayer'

		// PixiJS v8 GPU Particle Container
		this.particleContainer = new ParticleContainer()
		this.container.addChild(this.particleContainer)

		// Active particle descriptors
		this.activeParticles = []
		// Reusable particle object pool
		this.particlePool = []
	}

	/**
	 * Allocates or reuses a Particle instance.
	 *
	 * @private
	 * @returns {Particle}
	 */
	_acquireParticle() {
		if (this.particlePool.length > 0) {
			return this.particlePool.pop()
		}
		return new Particle({ texture: Texture.WHITE })
	}

	/**
	 * Releases a Particle back to the pool.
	 *
	 * @private
	 * @param {Particle} particle
	 */
	_releaseParticle(particle) {
		this.particleContainer.removeParticle(particle)
		if (this.particlePool.length < 500) {
			this.particlePool.push(particle)
		}
	}

	/**
	 * Spawns a batch of particles at world coordinates.
	 *
	 * @param {Object} options
	 * @param {number} options.x - World X position
	 * @param {number} options.y - World Y position
	 * @param {number} [options.count=16] - Particle count
	 * @param {number|string} [options.color=0x48bb78] - Hex color
	 * @param {number} [options.speed=3] - Maximum initial speed
	 * @param {number} [options.gravity=0.15] - Vertical gravity acceleration
	 * @param {number} [options.size=3] - Pixel size
	 * @param {number} [options.life=1.0] - Lifetime (0..1)
	 * @param {number} [options.decay=0.03] - Life reduction per tick
	 */
	spawn({
		x,
		y,
		count = 16,
		color = 0x48bb78,
		speed = 3,
		gravity = 0.15,
		size = 3,
		life = 1.0,
		decay = 0.03
	}) {
		const numColor = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color

		for (let i = 0; i < count; i++) {
			const p = this._acquireParticle()
			p.x = x + (Math.random() - 0.5) * 24
			p.y = y + (Math.random() - 0.5) * 16
			p.anchorX = 0.5
			p.anchorY = 0.5
			p.scaleX = size
			p.scaleY = size
			p.alpha = life
			p.tint = numColor

			this.particleContainer.addParticle(p)

			this.activeParticles.push({
				particle: p,
				vx: (Math.random() - 0.5) * speed * 2,
				vy: -Math.random() * speed - 1,
				gravity,
				life,
				decay: decay * (0.8 + Math.random() * 0.4),
				initialSize: size
			})
		}
	}

	/**
	 * Preset: Spawns weeding particles (green & gold leaves bursting upwards).
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {number} [count=16]
	 */
	spawnWeedParticles(x, y, count = 16) {
		for (let i = 0; i < count; i++) {
			const isGold = Math.random() > 0.65
			const color = isGold ? 0xf6e05e : 0x48bb78
			const size = Math.random() * 3 + 2

			const p = this._acquireParticle()
			p.x = x + (Math.random() - 0.5) * 26
			p.y = y + (Math.random() - 0.5) * 14
			p.anchorX = 0.5
			p.anchorY = 0.5
			p.scaleX = size
			p.scaleY = size
			p.alpha = 1.0
			p.tint = color

			this.particleContainer.addParticle(p)

			this.activeParticles.push({
				particle: p,
				vx: (Math.random() - 0.5) * 3,
				vy: -Math.random() * 3.5 - 1.2,
				gravity: 0.16,
				life: 1.0,
				decay: 0.028 + Math.random() * 0.015,
				initialSize: size
			})
		}
	}

	/**
	 * Synchronizes external particles (e.g. from IsoCanvas.vue) into the GPU batch.
	 *
	 * @param {Array} externalParticles
	 */
	syncExternal(externalParticles = []) {
		if (!externalParticles || externalParticles.length === 0) {
			this.clear()
			return
		}

		// Fast reconciliation: reuse active particles or allocate
		const targetLen = externalParticles.length
		while (this.activeParticles.length > targetLen) {
			const desc = this.activeParticles.pop()
			this._releaseParticle(desc.particle)
		}

		for (let i = 0; i < targetLen; i++) {
			const ext = externalParticles[i]
			let desc = this.activeParticles[i]

			if (!desc) {
				const p = this._acquireParticle()
				this.particleContainer.addParticle(p)
				desc = { particle: p, ext: true }
				this.activeParticles.push(desc)
			}

			const p = desc.particle
			p.x = ext.x
			p.y = ext.y
			p.scaleX = ext.size || 3
			p.scaleY = ext.size || 3
			p.alpha = Math.max(0, Math.min(1, ext.life ?? 1.0))

			if (ext.color) {
				const numColor = typeof ext.color === 'string'
					? parseInt(ext.color.replace('#', ''), 16)
					: ext.color
				p.tint = numColor
			}
		}
	}

	/**
	 * Updates particle physics for internally managed particles.
	 * Call once per frame if not synchronizing externally.
	 */
	update() {
		for (let i = this.activeParticles.length - 1; i >= 0; i--) {
			const d = this.activeParticles[i]
			if (d.ext) continue // skip externally managed particles

			const p = d.particle
			p.x += d.vx
			p.y += d.vy
			d.vy += d.gravity
			d.life -= d.decay

			if (d.life <= 0) {
				this._releaseParticle(p)
				this.activeParticles.splice(i, 1)
				continue
			}

			p.alpha = d.life
			const scale = d.initialSize * (0.4 + 0.6 * d.life)
			p.scaleX = scale
			p.scaleY = scale
		}
	}

	/**
	 * Returns true if there are currently active particles animating.
	 *
	 * @returns {boolean}
	 */
	hasActiveParticles() {
		return this.activeParticles.length > 0
	}

	/**
	 * Clears all active particles.
	 */
	clear() {
		for (const d of this.activeParticles) {
			this.particleContainer.removeParticle(d.particle)
			if (this.particlePool.length < 500) {
				this.particlePool.push(d.particle)
			}
		}
		this.activeParticles.length = 0
	}

	/**
	 * Destroys all GPU resources on unmount.
	 */
	destroy() {
		this.clear()
		this.particlePool.length = 0
		if (this.particleContainer) {
			this.particleContainer.destroy({ children: true })
			this.particleContainer = null
		}
		if (this.container) {
			this.container.destroy({ children: true })
			this.container = null
		}
	}
}
