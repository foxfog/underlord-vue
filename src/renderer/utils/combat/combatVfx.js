/**
 * combatVfx.js
 * Extensible Visual Effects (VFX) Manager for Isometric Tactical Combat.
 * Handles projectiles (arrows, magic bolts), healing beams, melee slash arcs,
 * hit sparks, and unit flinch / damage shake reactions.
 */

export function createVfxManager() {
	/** @type {Array<Object>} */
	const projectiles = []
	/** @type {Array<Object>} */
	const areaEffects = []
	/** @type {Array<Object>} */
	const particles = []
	/** @type {Map<string, Object>} */
	const flinches = new Map()

	let nextId = 1

	/**
	 * Spawn a flying projectile from one screen coordinate to another.
	 * @param {Object} params
	 * @param {{x: number, y: number}} params.from Screen start pos
	 * @param {{x: number, y: number}} params.to Screen target pos
	 * @param {'arrow'|'magic'|'void'|'fire'} [params.type='arrow']
	 * @param {string} [params.color] Main color
	 * @param {number} [params.duration=320] Duration in ms at 1x speed
	 * @param {Function} [params.onHit] Called when projectile reaches target
	 */
	function spawnProjectile({
		from,
		to,
		type = 'arrow',
		color = '#38bdf8',
		duration = 320,
		onHit = null
	}) {
		const dx = to.x - from.x
		const dy = to.y - from.y
		const distance = Math.hypot(dx, dy)
		// Scale duration slightly by distance, minimum 180ms
		const actualDuration = Math.max(180, Math.min(550, duration * (distance / 200)))

		projectiles.push({
			id: nextId++,
			from: { ...from },
			to: { ...to },
			type,
			color,
			duration: actualDuration,
			elapsed: 0,
			onHit,
			trailTimer: 0
		})
	}

	/**
	 * Spawn a descending beam of healing light from the heavens onto the target.
	 * @param {Object} params
	 * @param {{x: number, y: number}} params.target Screen coordinate of target base
	 * @param {string} [params.color='#22c55e'] Emerald or gold glow
	 * @param {number} [params.duration=500]
	 */
	function spawnHealBeam({ target, color = '#22c55e', duration = 500 }) {
		areaEffects.push({
			id: nextId++,
			type: 'heal_beam',
			target: { ...target },
			color,
			duration,
			elapsed: 0
		})

		// Spawn rising heal sparkle particles
		const particleCount = 14
		for (let i = 0; i < particleCount; i++) {
			particles.push({
				x: target.x + (Math.random() - 0.5) * 36,
				y: target.y - Math.random() * 25,
				vx: (Math.random() - 0.5) * 0.8,
				vy: -1.2 - Math.random() * 1.5,
				size: 2 + Math.random() * 2.5,
				color: Math.random() > 0.4 ? '#4ade80' : '#facc15',
				isCross: Math.random() > 0.5,
				alpha: 1.0,
				life: 400 + Math.random() * 300,
				elapsed: 0
			})
		}
	}

	/**
	 * Spawn a quick sweeping melee slash arc on the target.
	 * @param {Object} params
	 * @param {{x: number, y: number}} params.target Screen coordinate of target
	 * @param {number} [params.angle=0] Angle of strike in radians
	 * @param {string} [params.color='#ffffff']
	 * @param {number} [params.duration=200]
	 */
	function spawnMeleeSlash({ target, angle = 0, color = '#ffffff', duration = 200 }) {
		areaEffects.push({
			id: nextId++,
			type: 'melee_slash',
			target: { ...target },
			angle,
			color,
			duration,
			elapsed: 0
		})

		// Spawn impact sparks
		spawnImpactSparks(target.x, target.y - 15, color, 8)
	}

	/**
	 * Spawn radial impact sparks.
	 */
	function spawnImpactSparks(x, y, color = '#ffffff', count = 10) {
		for (let i = 0; i < count; i++) {
			const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5
			const speed = 1.5 + Math.random() * 2.5
			particles.push({
				x,
				y,
				vx: Math.cos(a) * speed,
				vy: Math.sin(a) * speed,
				size: 1.5 + Math.random() * 2,
				color,
				alpha: 1.0,
				life: 250 + Math.random() * 150,
				elapsed: 0
			})
		}
	}

	/**
	 * Trigger hit reaction (flinch/shake + flash) on a unit.
	 * @param {string} unitId
	 * @param {number} [intensity=1.0]
	 * @param {number} [duration=260]
	 */
	function triggerFlinch(unitId, intensity = 1.0, duration = 260) {
		flinches.set(unitId, {
			elapsed: 0,
			duration,
			intensity
		})
	}

	/**
	 * Get current flinch offset and flash alpha for unit rendering.
	 * @param {string} unitId
	 * @returns {{offsetX: number, offsetY: number, flashAlpha: number}}
	 */
	function getUnitFlinch(unitId) {
		const flinch = flinches.get(unitId)
		if (!flinch) return { offsetX: 0, offsetY: 0, flashAlpha: 0 }

		const progress = Math.min(1, flinch.elapsed / flinch.duration)
		const decay = 1 - progress
		// Rapid oscillation in X
		const offsetX = Math.sin(flinch.elapsed * 0.08) * 6 * flinch.intensity * decay
		// Flash alpha (peaks at start, fades within first 60% of duration)
		const flashAlpha = progress < 0.6 ? (1 - progress / 0.6) * 0.6 * flinch.intensity : 0

		return { offsetX, offsetY: 0, flashAlpha }
	}

	/**
	 * Update all active VFX over time.
	 * @param {number} deltaMs Elapsed time in milliseconds
	 * @param {number} [speedMultiplier=1.0] Game settings combat speed multiplier
	 */
	function update(deltaMs, speedMultiplier = 1.0) {
		const effectiveDelta = deltaMs * Math.max(0.5, speedMultiplier)

		// 1. Update Projectiles
		for (let i = projectiles.length - 1; i >= 0; i--) {
			const p = projectiles[i]
			p.elapsed += effectiveDelta
			const t = Math.min(1, p.elapsed / p.duration)

			// Spawn motion trail particles while flying
			p.trailTimer += effectiveDelta
			if (p.trailTimer >= 25 && t < 0.95) {
				p.trailTimer = 0
				const currentX = p.from.x + (p.to.x - p.from.x) * t
				const currentY =
					p.from.y +
					(p.to.y - p.from.y) * t +
					(p.type === 'arrow' ? -25 * Math.sin(t * Math.PI) : 0)

				particles.push({
					x: currentX,
					y: currentY,
					vx: (Math.random() - 0.5) * 0.4,
					vy: (Math.random() - 0.5) * 0.4,
					size: p.type === 'arrow' ? 1.5 : 2.5 + Math.random() * 2,
					color: p.color,
					alpha: 0.8,
					life: p.type === 'arrow' ? 120 : 200,
					elapsed: 0
				})
			}

			// On impact
			if (t >= 1) {
				if (p.onHit) {
					try {
						p.onHit()
					} catch (e) {
						console.error('[combatVfx] onHit callback error:', e)
					}
				}
				spawnImpactSparks(p.to.x, p.to.y, p.color, p.type === 'arrow' ? 7 : 12)
				projectiles.splice(i, 1)
			}
		}

		// 2. Update Area Effects
		for (let i = areaEffects.length - 1; i >= 0; i--) {
			const effect = areaEffects[i]
			effect.elapsed += effectiveDelta
			if (effect.elapsed >= effect.duration) {
				areaEffects.splice(i, 1)
			}
		}

		// 3. Update Particles
		for (let i = particles.length - 1; i >= 0; i--) {
			const pt = particles[i]
			pt.elapsed += effectiveDelta
			if (pt.elapsed >= pt.life) {
				particles.splice(i, 1)
				continue
			}
			pt.x += pt.vx * (effectiveDelta / 16.6)
			pt.y += pt.vy * (effectiveDelta / 16.6)
			pt.alpha = Math.max(0, 1 - pt.elapsed / pt.life)
		}

		// 4. Update Flinches
		for (const [unitId, flinch] of flinches.entries()) {
			flinch.elapsed += effectiveDelta
			if (flinch.elapsed >= flinch.duration) {
				flinches.delete(unitId)
			}
		}
	}

	/**
	 * Render all active VFX on canvas.
	 * @param {CanvasRenderingContext2D} ctx
	 */
	function render(ctx) {
		ctx.save()

		// 1. Render Area Effects (Heal Beam, Melee Slash)
		for (const effect of areaEffects) {
			const progress = Math.min(1, effect.elapsed / effect.duration)
			const fadeAlpha = 1 - progress

			if (effect.type === 'heal_beam') {
				const tx = effect.target.x
				const ty = effect.target.y
				const beamWidth = 44 + Math.sin(progress * Math.PI) * 12
				const beamHeight = 220

				ctx.save()
				// Vertical light column
				const grad = ctx.createLinearGradient(tx, ty - beamHeight, tx, ty)
				grad.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
				grad.addColorStop(0.3, effect.color === '#eab308' ? 'rgba(234, 179, 8, 0.5)' : 'rgba(34, 197, 94, 0.5)')
				grad.addColorStop(0.9, effect.color === '#eab308' ? 'rgba(250, 204, 21, 0.75)' : 'rgba(74, 222, 128, 0.75)')
				grad.addColorStop(1, 'rgba(255, 255, 255, 0.95)')

				ctx.fillStyle = grad
				ctx.globalAlpha = Math.sin(progress * Math.PI) * 0.85
				ctx.beginPath()
				ctx.rect(tx - beamWidth / 2, ty - beamHeight, beamWidth, beamHeight)
				ctx.fill()

				// Ground light ring
				ctx.beginPath()
				ctx.ellipse(tx, ty, beamWidth * 0.7, beamWidth * 0.35, 0, 0, Math.PI * 2)
				ctx.fillStyle = effect.color
				ctx.shadowColor = effect.color
				ctx.shadowBlur = 15
				ctx.fill()
				ctx.restore()
			} else if (effect.type === 'melee_slash') {
				const tx = effect.target.x
				const ty = effect.target.y - 20
				const radius = 28
				const startAngle = effect.angle - Math.PI * 0.4
				const endAngle = effect.angle + Math.PI * 0.4

				ctx.save()
				ctx.beginPath()
				ctx.arc(tx, ty, radius, startAngle, endAngle)
				ctx.strokeStyle = effect.color || '#ffffff'
				ctx.lineWidth = 3.5 * fadeAlpha
				ctx.shadowColor = effect.color || '#ffffff'
				ctx.shadowBlur = 10
				ctx.stroke()

				// Glowing inner arc
				ctx.beginPath()
				ctx.arc(tx, ty, radius * 0.8, startAngle + 0.2, endAngle - 0.2)
				ctx.strokeStyle = '#fef08a'
				ctx.lineWidth = 2 * fadeAlpha
				ctx.stroke()
				ctx.restore()
			}
		}

		// 2. Render Flying Projectiles
		for (const p of projectiles) {
			const t = Math.min(1, p.elapsed / p.duration)
			const px = p.from.x + (p.to.x - p.from.x) * t
			const arc = p.type === 'arrow' ? -25 * Math.sin(t * Math.PI) : 0
			const py = p.from.y + (p.to.y - p.from.y) * t + arc

			// Tangent angle
			const nextT = Math.min(1, t + 0.05)
			const nextArc = p.type === 'arrow' ? -25 * Math.sin(nextT * Math.PI) : 0
			const nextX = p.from.x + (p.to.x - p.from.x) * nextT
			const nextY = p.from.y + (p.to.y - p.from.y) * nextT + nextArc
			const angle = Math.atan2(nextY - py, nextX - px)

			ctx.save()
			ctx.translate(px, py)
			ctx.rotate(angle)

			if (p.type === 'arrow') {
				// Wooden shaft
				ctx.strokeStyle = '#92400e'
				ctx.lineWidth = 2
				ctx.beginPath()
				ctx.moveTo(-16, 0)
				ctx.lineTo(8, 0)
				ctx.stroke()

				// Arrowhead
				ctx.fillStyle = '#cbd5e1'
				ctx.beginPath()
				ctx.moveTo(12, 0)
				ctx.lineTo(6, -3.5)
				ctx.lineTo(7, 0)
				ctx.lineTo(6, 3.5)
				ctx.closePath()
				ctx.fill()

				// White Fletching
				ctx.fillStyle = '#ffffff'
				ctx.beginPath()
				ctx.moveTo(-16, -3)
				ctx.lineTo(-11, 0)
				ctx.lineTo(-16, 3)
				ctx.closePath()
				ctx.fill()
			} else {
				// Magic Bolt (Glowing Orb + Pulsing Core)
				const radius = 6 + Math.sin(p.elapsed * 0.03) * 1.5
				ctx.shadowColor = p.color
				ctx.shadowBlur = 12

				// Outer glow
				ctx.fillStyle = p.color
				ctx.beginPath()
				ctx.arc(0, 0, radius, 0, Math.PI * 2)
				ctx.fill()

				// Inner hot core
				ctx.fillStyle = '#ffffff'
				ctx.beginPath()
				ctx.arc(1, 0, radius * 0.5, 0, Math.PI * 2)
				ctx.fill()
			}

			ctx.restore()
		}

		// 3. Render Particles
		for (const pt of particles) {
			ctx.save()
			ctx.globalAlpha = pt.alpha
			ctx.fillStyle = pt.color

			if (pt.isCross) {
				// Little '+' cross for heals
				const s = pt.size
				ctx.fillRect(pt.x - s / 2, pt.y - s * 1.5, s, s * 3)
				ctx.fillRect(pt.x - s * 1.5, pt.y - s / 2, s * 3, s)
			} else {
				// Glowing spark circle
				ctx.shadowColor = pt.color
				ctx.shadowBlur = 4
				ctx.beginPath()
				ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
				ctx.fill()
			}
			ctx.restore()
		}

		ctx.restore()
	}

	/**
	 * Check if any visual effects or animations are currently playing.
	 * @returns {boolean}
	 */
	function hasActiveEffects() {
		return projectiles.length > 0 || areaEffects.length > 0 || particles.length > 0 || flinches.size > 0
	}

	/**
	 * Clear all active effects.
	 */
	function clear() {
		projectiles.length = 0
		areaEffects.length = 0
		particles.length = 0
		flinches.clear()
	}

	return {
		spawnProjectile,
		spawnHealBeam,
		spawnMeleeSlash,
		spawnImpactSparks,
		triggerFlinch,
		getUnitFlinch,
		update,
		render,
		hasActiveEffects,
		clear
	}
}
