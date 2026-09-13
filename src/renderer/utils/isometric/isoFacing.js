/**
 * Isometric unit facing and tactical directional indicator utilities.
 * Handles 2.5D rhombic ground projections (2:1 ratio) for unit orientation (SE, SW, NW, NE),
 * directional arrow chevron rendering, back (rear) notches, and relative attack angles.
 */

export const FACING_VECTORS = Object.freeze({
	SE: { du: Math.SQRT1_2, dv: Math.SQRT1_2 },
	SW: { du: -Math.SQRT1_2, dv: Math.SQRT1_2 },
	NW: { du: -Math.SQRT1_2, dv: -Math.SQRT1_2 },
	NE: { du: Math.SQRT1_2, dv: -Math.SQRT1_2 },
	// Cardinal fallback directions
	S: { du: 0, dv: 1 },
	N: { du: 0, dv: -1 },
	E: { du: 1, dv: 0 },
	W: { du: -1, dv: 0 }
})

export const OPPOSITE_FACING = Object.freeze({
	SE: 'NW',
	NW: 'SE',
	SW: 'NE',
	NE: 'SW',
	S: 'N',
	N: 'S',
	E: 'W',
	W: 'E'
})

export const FACING_LABELS = Object.freeze({
	SE: 'Юго-Восток (SE) ↘',
	SW: 'Юго-Запад (SW) ↙',
	NW: 'Северо-Запад (NW) ↖',
	NE: 'Северо-Восток (NE) ↗',
	S: 'Юг (S) ↓',
	N: 'Север (N) ↑',
	E: 'Восток (E) →',
	W: 'Запад (W) ←'
})

/**
 * Normalizes facing string and returns (u, v) direction vector.
 */
export function getFacingVector(facing = 'SE') {
	const key = String(facing || 'SE').toUpperCase()
	return FACING_VECTORS[key] || FACING_VECTORS.SE
}

/**
 * Returns the opposite facing direction (e.g. SE -> NW).
 */
export function getOppositeFacing(facing = 'SE') {
	const key = String(facing || 'SE').toUpperCase()
	return OPPOSITE_FACING[key] || 'NW'
}

/**
 * Returns localized human-readable label with directional arrow symbol.
 */
export function getFacingLabel(facing = 'SE') {
	const key = String(facing || 'SE').toUpperCase()
	return FACING_LABELS[key] || key
}

/**
 * Calculates 4 screen vertices for the 2.5D isometric directional chevron arrow.
 * Vertex order: Tip -> Left Wing -> Inner Notch -> Right Wing.
 *
 * @param {string} facing - 'SE' | 'SW' | 'NW' | 'NE'
 * @param {object} options
 * @param {number} options.radius - base ground circle radius (default 19)
 * @param {number} options.yOffset - ground elevation offset on screen (default 2)
 * @param {number} options.arrowLength - extension past base radius (default 13)
 * @param {number} options.wingWidth - perpendicular spread of wings (default 7.5)
 * @returns {Array<{x: number, y: number}>}
 */
export function getFacingArrowPolygon(facing = 'SE', {
	radius = 19,
	yOffset = 2,
	arrowLength = 13,
	wingWidth = 7.5
} = {}) {
	const v = getFacingVector(facing)
	const pu = -v.dv
	const pv = v.du

	const rTip = radius + arrowLength
	const rWing = radius - 2
	const rNotch = radius + 2
	const w = wingWidth

	// u-v coordinates with 2:1 vertical compression for 2.5D isometric projection
	return [
		// 1. Arrow Tip
		{
			x: rTip * v.du,
			y: yOffset + (rTip * v.dv) * 0.5
		},
		// 2. Left Wing
		{
			x: rWing * v.du + w * pu,
			y: yOffset + (rWing * v.dv + w * pv) * 0.5
		},
		// 3. Inner Notch
		{
			x: rNotch * v.du,
			y: yOffset + (rNotch * v.dv) * 0.5
		},
		// 4. Right Wing
		{
			x: rWing * v.du - w * pu,
			y: yOffset + (rWing * v.dv - w * pv) * 0.5
		}
	]
}

/**
 * Calculates screen endpoints for the rear notch bar (on the opposite side of facing).
 */
export function getRearNotchSegment(facing = 'SE', {
	radius = 19,
	yOffset = 2,
	width = 6
} = {}) {
	const v = getFacingVector(facing)
	const pu = -v.dv
	const pv = v.du

	// Rear is in -v direction
	const ru = -radius * v.du
	const rv = -radius * v.dv
	const halfW = width * 0.5

	return {
		p1: {
			x: ru + halfW * pu,
			y: yOffset + (rv + halfW * pv) * 0.5
		},
		p2: {
			x: ru - halfW * pu,
			y: yOffset + (rv - halfW * pv) * 0.5
		}
	}
}

/**
 * Determines relative attack angle from attacker to target: 'front', 'side', or 'back'.
 * Uses dot product between target's facing vector and attacker's direction relative to target.
 */
export function getRelativeAttackAngle(attackerPos, targetPos, targetFacing = 'SE') {
	if (!attackerPos || !targetPos) return 'front'

	const dx = attackerPos.x - targetPos.x
	const dy = attackerPos.y - targetPos.y
	if (dx === 0 && dy === 0) return 'front'

	// Convert grid delta to orthogonal (u, v) vector
	const u = (dx - dy) * 32
	const v = (dx + dy) * 32
	const len = Math.hypot(u, v)
	if (len === 0) return 'front'

	const normU = u / len
	const normV = v / len

	const facingV = getFacingVector(targetFacing)
	const dot = normU * facingV.du + normV * facingV.dv

	// dot > 0.5 => within 60 deg cone of front
	// dot < -0.5 => within 60 deg cone of back
	// otherwise => flank / side attack
	if (dot > 0.5) return 'front'
	if (dot < -0.5) return 'back'
	return 'side'
}

/**
 * Convenience helper to check if an attack is a back attack.
 */
export function isBackAttack(attackerPos, targetPos, targetFacing = 'SE') {
	return getRelativeAttackAngle(attackerPos, targetPos, targetFacing) === 'back'
}

/**
 * Renders the tactical directional indicator on a CanvasRenderingContext2D.
 * Draws:
 * 1. Base team-colored ground ellipse
 * 2. Rear notch indicating back / guard boundary
 * 3. Directional chevron arrow pointing in the facing direction
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} options
 */
export function drawIsometricFacingIndicator(ctx, {
	facing = 'SE',
	team = 'ally',
	isActive = false,
	isTargetable = false,
	isHovered = false,
	radius = 19,
	yOffset = 2,
	drawRing = true,
	drawRearNotch = true
} = {}) {
	ctx.save()

	// Color definitions
	let fillColor = '#38bdf8' // Cyan for allies
	let strokeColor = '#0369a1'
	let glowColor = 'rgba(56, 189, 248, 0.6)'
	let ringStroke = 'rgba(56, 189, 248, 0.45)'
	let rearStroke = 'rgba(56, 189, 248, 0.65)'

	if (team === 'enemy') {
		fillColor = '#f87171' // Coral red for enemies
		strokeColor = '#991b1b'
		glowColor = 'rgba(248, 113, 113, 0.6)'
		ringStroke = 'rgba(248, 113, 113, 0.45)'
		rearStroke = 'rgba(248, 113, 113, 0.65)'
	}

	if (isActive) {
		fillColor = '#f6c445' // Golden for active unit
		strokeColor = '#78350f'
		glowColor = 'rgba(246, 196, 69, 0.85)'
		ringStroke = '#f6c445'
		rearStroke = 'rgba(246, 196, 69, 0.75)'
	}

	if (isTargetable && !isActive) {
		ringStroke = team === 'ally' ? 'rgba(34, 197, 94, 0.6)' : 'rgba(239, 68, 68, 0.6)'
	}

	const rx = radius
	const ry = radius * 0.5

	// 1. Tactical Ground Ring
	if (drawRing && !isActive) {
		ctx.beginPath()
		ctx.ellipse(0, yOffset, rx, ry, 0, 0, Math.PI * 2)
		ctx.strokeStyle = ringStroke
		ctx.lineWidth = isHovered ? 2 : 1.2
		ctx.stroke()
	}

	// 2. Rear Notch (indicating back / rear side)
	if (drawRearNotch) {
		const rear = getRearNotchSegment(facing, { radius, yOffset, width: 7 })
		ctx.beginPath()
		ctx.moveTo(rear.p1.x, rear.p1.y)
		ctx.lineTo(rear.p2.x, rear.p2.y)
		ctx.strokeStyle = rearStroke
		ctx.lineWidth = isHovered ? 2.5 : 2
		ctx.stroke()
	}

	// 3. Directional Chevron Arrow (pointing forward)
	const poly = getFacingArrowPolygon(facing, {
		radius,
		yOffset,
		arrowLength: 13,
		wingWidth: 7.5
	})

	ctx.beginPath()
	ctx.moveTo(poly[0].x, poly[0].y)
	ctx.lineTo(poly[1].x, poly[1].y)
	ctx.lineTo(poly[2].x, poly[2].y)
	ctx.lineTo(poly[3].x, poly[3].y)
	ctx.closePath()

	ctx.shadowColor = glowColor
	ctx.shadowBlur = isActive ? 8 : (isHovered ? 6 : 4)
	ctx.fillStyle = fillColor
	ctx.fill()

	ctx.shadowBlur = 0
	ctx.strokeStyle = strokeColor
	ctx.lineWidth = 1.2
	ctx.stroke()

	ctx.restore()
}
