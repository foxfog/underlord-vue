/**
 * Hexagonal Grid Coordinate Math and Utilities (Flat-topped 2.5D with tilt)
 *
 * Orientation: Flat edges on top and bottom, pointy on left and right.
 * 6 Edges: N (Top), NE (Upper-Right), SE (Lower-Right), S (Bottom), SW (Lower-Left), NW (Upper-Left).
 * Uses odd-q offset coordinate system where odd columns are shifted down by half height.
 */

export const HEX_EDGES = ['N', 'NE', 'SE', 'S', 'SW', 'NW']

export const OPPOSITE_EDGE = Object.freeze({
	N: 'S',
	S: 'N',
	NE: 'SW',
	SW: 'NE',
	SE: 'NW',
	NW: 'SE'
})

export const DEFAULT_HEX_RADIUS = 36
export const DEFAULT_HEX_TILT = 0.70

/**
 * Returns neighbor coordinate for a given hex and edge in odd-q flat-topped system.
 *
 * @param {number} col
 * @param {number} row
 * @param {string} edge - 'N'|'NE'|'SE'|'S'|'SW'|'NW'
 * @returns {{ col: number, row: number }}
 */
export function getHexNeighbor(col, row, edge) {
	const isOdd = Math.abs(col % 2) === 1

	switch (edge) {
		case 'N':
			return { col, row: row - 1 }
		case 'S':
			return { col, row: row + 1 }
		case 'NE':
			return { col: col + 1, row: isOdd ? row : row - 1 }
		case 'SE':
			return { col: col + 1, row: isOdd ? row + 1 : row }
		case 'SW':
			return { col: col - 1, row: isOdd ? row + 1 : row }
		case 'NW':
			return { col: col - 1, row: isOdd ? row : row - 1 }
		default:
			return { col, row }
	}
}

/**
 * Converts a hex edge into a canonical unique key so shared edges between
 * two adjacent hexes are identified identically regardless of which hex references them.
 *
 * @param {number} col
 * @param {number} row
 * @param {string} edge
 * @returns {string} canonical key e.g. "3,4:SE"
 */
export function getCanonicalEdgeKey(col, row, edge) {
	const neighbor = getHexNeighbor(col, row, edge)
	// Sort by col then row to produce canonical order
	if (col < neighbor.col || (col === neighbor.col && row < neighbor.row)) {
		return `${col},${row}:${edge}`
	} else if (col > neighbor.col || (col === neighbor.col && row > neighbor.row)) {
		return `${neighbor.col},${neighbor.row}:${OPPOSITE_EDGE[edge]}`
	}
	// Border edge with no neighbor distinction
	return `${col},${row}:${edge}`
}

/**
 * Returns world ground center (x, y) on the un-tilted flat plane.
 *
 * @param {number} col
 * @param {number} row
 * @param {number} radius - Hex radius
 * @returns {{ x: number, y: number }}
 */
export function hexToWorldGroundCenter(col, row, radius = DEFAULT_HEX_RADIUS) {
	const h = Math.sqrt(3) * radius
	const x = col * 1.5 * radius
	const y = row * h + (Math.abs(col % 2) === 1 ? h / 2 : 0)
	return { x, y }
}

/**
 * Calculates the 6 vertices of a flat-topped hexagon in world ground space (un-tilted).
 *
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @returns {Array<{ x: number, y: number }>}
 */
export function getHexGroundVertices(centerX, centerY, radius = DEFAULT_HEX_RADIUS) {
	const halfH = (Math.sqrt(3) / 2) * radius
	const halfR = radius / 2

	return [
		{ x: centerX + radius, y: centerY }, // 0: Right
		{ x: centerX + halfR, y: centerY + halfH }, // 1: Bottom-Right
		{ x: centerX - halfR, y: centerY + halfH }, // 2: Bottom-Left
		{ x: centerX - radius, y: centerY }, // 3: Left
		{ x: centerX - halfR, y: centerY - halfH }, // 4: Top-Left
		{ x: centerX + halfR, y: centerY - halfH } // 5: Top-Right
	]
}

/**
 * 3D Central Perspective Camera for Flat-topped Hex Maps.
 *
 * Implements real 3D perspective projection with adjustable pitch angle,
 * horizon vanishing point, distance scaling, and 3D height parallax.
 *
 * Lateral Perspective Parallax (Vanishing Ray):
 * - Points on ground (Z = 0) project onto the tilted ground plane.
 * - Elevated points (Z > 0, like mountain peaks) project closer to the camera eye.
 * - In the center of the camera (dx = 0), a peak stands straight above its base,
 *   occluding objects directly behind it.
 * - When the camera pans sideways (dx != 0), perspective rays tilt the peak outward,
 *   revealing ground objects and settlements behind the mountain!
 */
export class HexPerspectiveCamera {
	constructor({
		viewportWidth = 1920,
		viewportHeight = 1080,
		cameraX = 0,
		cameraY = 0,
		zoom = 1.0,
		pitch = 45,
		focalDistance = 900
	} = {}) {
		this.viewportWidth = viewportWidth
		this.viewportHeight = viewportHeight
		this.cameraX = cameraX
		this.cameraY = cameraY
		this.zoom = zoom
		this.pitch = Math.max(0, Math.min(75, pitch))
		this.focalDistance = focalDistance
		this.updateTrig()
	}

	updateTrig() {
		this.theta = (this.pitch * Math.PI) / 180
		this.sinT = Math.sin(this.theta)
		this.cosT = Math.cos(this.theta)
		this.cx0 = this.viewportWidth / 2
		this.cy0 = this.viewportHeight / 2
	}

	setViewport(w, h) {
		this.viewportWidth = w
		this.viewportHeight = h
		this.updateTrig()
	}

	setPitch(pitch) {
		this.pitch = Math.max(0, Math.min(75, pitch))
		this.updateTrig()
	}

	getHorizonY() {
		if (this.sinT <= 0.01) return -999999
		return this.cy0 - this.focalDistance * (this.cosT / this.sinT) * this.zoom
	}

	project(wx, wy, wz = 0) {
		const dx = wx - this.cameraX
		const dy = wy - this.cameraY

		// Distance along line of sight into the screen
		const distZ = Math.max(100, this.focalDistance - dy * this.sinT - wz * this.cosT)
		const scale = this.focalDistance / distZ

		const x = this.cx0 + dx * scale * this.zoom
		// Elevated 2.5D billboard objects (wz > 0) face the camera upright (Don't Starve style) and never squash at pitch = 0
		const y = this.cy0 + (dy * this.cosT - wz) * scale * this.zoom

		return {
			x,
			y,
			scale: scale * this.zoom,
			distZ,
			visible: distZ > 100
		}
	}

	/**
	 * Projects a terrain surface point (wx, wy, wz) on the 3D relief mesh.
	 * Unlike upright billboards, terrain relief wz scales with sin(pitch) so it flattens
	 * to its true ground coordinate at pitch = 0° and elevates realistically in perspective.
	 */
	projectTerrain(wx, wy, wz = 0) {
		const dx = wx - this.cameraX
		const dy = wy - this.cameraY

		const distZ = Math.max(100, this.focalDistance - dy * this.sinT - wz * this.cosT)
		const scale = this.focalDistance / distZ

		const x = this.cx0 + dx * scale * this.zoom
		const y = this.cy0 + (dy * this.cosT - wz * this.sinT) * scale * this.zoom

		return {
			x,
			y,
			scale: scale * this.zoom,
			distZ,
			visible: distZ > 100
		}
	}

	unproject(sx, sy) {
		const dsx = (sx - this.cx0) / this.zoom
		const dsy = (sy - this.cy0) / this.zoom

		const denom = this.focalDistance * this.cosT + dsy * this.sinT
		if (denom <= 20) return null // Above horizon / sky

		const dy = (dsy * this.focalDistance) / denom
		const distZ = this.focalDistance - dy * this.sinT
		if (distZ <= 50) return null

		const scale = this.focalDistance / distZ
		const dx = dsx / scale

		return {
			x: this.cameraX + dx,
			y: this.cameraY + dy
		}
	}
}

/**
 * Calculates dynamic perspective pitch angle based on camera zoom.
 * - Minimum pitch at zoom-out (distance / удаление, zoom = 0.4): 0° (flat map).
 * - Maximum pitch at zoom-in (close-up / приближение, zoom = 3.0): 60°.
 *
 * @param {number} zoom - Current camera zoom level (0.4 .. 3.0)
 * @param {number} minPitch - Minimum pitch angle at zoom-out (default 0)
 * @param {number} maxPitch - Maximum pitch angle at zoom-in (default 60)
 * @param {number} minZoom - Zoom level for minPitch (default 0.4)
 * @param {number} maxZoom - Zoom level for maxPitch (default 3.0)
 * @returns {number} Dynamic pitch angle clamped between minPitch and maxPitch
 */
export function calculateDynamicPitch(
	zoom = 1.0,
	minPitch = 0,
	maxPitch = 60,
	minZoom = 0.4,
	maxZoom = 3.0
) {
	const safeZoom = Math.max(minZoom, Math.min(maxZoom, zoom))
	const logMin = Math.log(minZoom)
	const logMax = Math.log(maxZoom)
	const t = (Math.log(safeZoom) - logMin) / (logMax - logMin)
	const targetPitch = minPitch + t * (maxPitch - minPitch)
	return Math.max(minPitch, Math.min(maxPitch, Math.round(targetPitch)))
}

/**
 * Returns screen center (x, y) for a hex at (col, row).
 *
 * @param {number} col
 * @param {number} row
 * @param {number} radius - Hex radius
 * @param {number} tilt - Vertical compression factor (default ~0.7)
 * @returns {{ x: number, y: number }}
 */
export function hexToScreenCenter(col, row, radius = DEFAULT_HEX_RADIUS, tilt = DEFAULT_HEX_TILT) {
	const h = Math.sqrt(3) * radius
	const x = col * 1.5 * radius
	const y = (row * h + (Math.abs(col % 2) === 1 ? h / 2 : 0)) * tilt
	return { x, y }
}

/**
 * Calculates the 6 vertices of a flat-topped hexagon in screen space.
 * Vertices order:
 * 0: Right (R, 0)
 * 1: Bottom-Right (R/2, +h/2)
 * 2: Bottom-Left (-R/2, +h/2)
 * 3: Left (-R, 0)
 * 4: Top-Left (-R/2, -h/2)
 * 5: Top-Right (R/2, -h/2)
 *
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @param {number} tilt
 * @returns {Array<{ x: number, y: number }>}
 */
export function getHexVertices(centerX, centerY, radius = DEFAULT_HEX_RADIUS, tilt = DEFAULT_HEX_TILT) {
	const halfH = (Math.sqrt(3) / 2) * radius * tilt
	const halfR = radius / 2

	return [
		{ x: centerX + radius, y: centerY }, // 0: Right
		{ x: centerX + halfR, y: centerY + halfH }, // 1: Bottom-Right
		{ x: centerX - halfR, y: centerY + halfH }, // 2: Bottom-Left
		{ x: centerX - radius, y: centerY }, // 3: Left
		{ x: centerX - halfR, y: centerY - halfH }, // 4: Top-Left
		{ x: centerX + halfR, y: centerY - halfH } // 5: Top-Right
	]
}

/**
 * Returns start and end vertices for a specific hex edge:
 * - N:  Top-Left (4) -> Top-Right (5)   (flat top horizontal)
 * - NE: Top-Right (5) -> Right (0)
 * - SE: Right (0) -> Bottom-Right (1)
 * - S:  Bottom-Left (2) -> Bottom-Right (1) (flat bottom horizontal)
 * - SW: Left (3) -> Bottom-Left (2)
 * - NW: Top-Left (4) -> Left (3)
 *
 * @param {Array<{ x: number, y: number }>} vertices - 6 vertices from getHexVertices
 * @param {string} edge - 'N'|'NE'|'SE'|'S'|'SW'|'NW'
 * @returns {{ from: { x: number, y: number }, to: { x: number, y: number } }}
 */
export function getHexEdgeEndpoints(vertices, edge) {
	switch (edge) {
		case 'N':
			return { from: vertices[4], to: vertices[5] }
		case 'NE':
			return { from: vertices[5], to: vertices[0] }
		case 'SE':
			return { from: vertices[0], to: vertices[1] }
		case 'S':
			return { from: vertices[2], to: vertices[1] }
		case 'SW':
			return { from: vertices[3], to: vertices[2] }
		case 'NW':
			return { from: vertices[4], to: vertices[3] }
		default:
			return { from: vertices[4], to: vertices[5] }
	}
}

/**
 * Converts screen coordinates (mouseX, mouseY) into closest hex grid coordinate (col, row).
 *
 * @param {number} sx - Screen X
 * @param {number} sy - Screen Y
 * @param {number} radius
 * @param {number} tilt
 * @returns {{ col: number, row: number }}
 */
export function screenToHex(sx, sy, radius = DEFAULT_HEX_RADIUS, tilt = DEFAULT_HEX_TILT) {
	const unTiltedY = sy / (tilt || 1)
	const h = Math.sqrt(3) * radius

	// Approximate col and row
	const approxCol = Math.round(sx / (1.5 * radius))
	const isOdd = Math.abs(approxCol % 2) === 1
	const approxRow = Math.round((unTiltedY - (isOdd ? h / 2 : 0)) / h)

	// Search 3x3 surrounding candidates for minimum euclidean distance in un-tilted space
	let bestCandidate = { col: approxCol, row: approxRow }
	let minDistanceSq = Infinity

	for (let dc = -1; dc <= 1; dc++) {
		for (let dr = -1; dr <= 1; dr++) {
			const c = approxCol + dc
			const r = approxRow + dr
			const center = hexToScreenCenter(c, r, radius, 1.0)
			const distSq = (sx - center.x) ** 2 + (unTiltedY - center.y) ** 2
			if (distSq < minDistanceSq) {
				minDistanceSq = distSq
				bestCandidate = { col: c, row: r }
			}
		}
	}

	return bestCandidate
}

/**
 * Finds the closest edge of a hex to a given screen point.
 * Useful for river drawing clicks!
 *
 * @param {number} sx - Screen X
 * @param {number} sy - Screen Y
 * @param {number} col
 * @param {number} row
 * @param {number} radius
 * @param {number} tilt
 * @returns {{ edge: string, distance: number }}
 */
export function getClosestEdgeToPoint(sx, sy, col, row, radius = DEFAULT_HEX_RADIUS, tilt = DEFAULT_HEX_TILT) {
	const center = hexToScreenCenter(col, row, radius, tilt)
	const vertices = getHexVertices(center.x, center.y, radius, tilt)

	let closestEdge = 'N'
	let minDistance = Infinity

	for (const edge of HEX_EDGES) {
		const { from, to } = getHexEdgeEndpoints(vertices, edge)
		const midX = (from.x + to.x) / 2
		const midY = (from.y + to.y) / 2
		const dist = Math.hypot(sx - midX, sy - midY)
		if (dist < minDistance) {
			minDistance = dist
			closestEdge = edge
		}
	}

	return { edge: closestEdge, distance: minDistance }
}

/**
 * Converts odd-q offset coordinates to cube coordinates (x, y, z) where x + y + z = 0.
 */
export function oddQToCube(col, row) {
	const x = col
	const z = row - (col - (Math.abs(col % 2))) / 2
	const y = -x - z
	return { x, y, z }
}

/**
 * Converts cube coordinates (x, y, z) back to odd-q offset coordinates (col, row).
 */
export function cubeToOddQ(x, y, z) {
	const col = x
	const row = z + (col - (Math.abs(col % 2))) / 2
	return { col, row }
}

/**
 * Calculates distance between two hexes in hex steps.
 */
export function hexDistance(col1, row1, col2, row2) {
	const a = oddQToCube(col1, row1)
	const b = oddQToCube(col2, row2)
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z))
}

/**
 * Returns all hex coordinates within a given radius around (centerCol, centerRow).
 * Radius 1 returns only the center hex (1 hex).
 * Radius 2 returns center + 6 immediate neighbors (7 hexes).
 * Radius 3 returns center + 2 rings (19 hexes).
 *
 * @param {number} centerCol
 * @param {number} centerRow
 * @param {number} radius - 1, 2, or 3
 * @returns {Array<{ col: number, row: number, distance: number }>}
 */
export function getHexesInRadius(centerCol, centerRow, radius = 1) {
	const results = []
	const maxDist = Math.max(0, radius - 1)
	const centerCube = oddQToCube(centerCol, centerRow)

	for (let dx = -maxDist; dx <= maxDist; dx++) {
		for (let dy = Math.max(-maxDist, -dx - maxDist); dy <= Math.min(maxDist, -dx + maxDist); dy++) {
			const dz = -dx - dy
			const targetCube = {
				x: centerCube.x + dx,
				y: centerCube.y + dy,
				z: centerCube.z + dz
			}
			const coord = cubeToOddQ(targetCube.x, targetCube.y, targetCube.z)
			const dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz))
			results.push({ col: coord.col, row: coord.row, distance: dist })
		}
	}

	return results
}

/**
 * Human-readable flow direction description for an edge in flat-topped orientation.
 *
 * @param {string} edge - 'N'|'NE'|'SE'|'S'|'SW'|'NW'
 * @param {number} flowDir - 1 (forward) or -1 (reverse)
 * @returns {string} e.g. "Восток (⭢)"
 */
export function getEdgeFlowDirectionName(edge, flowDir = 1) {
	const dir = flowDir === -1 ? -1 : 1
	switch (edge) {
		case 'N':
		case 'S':
			return dir === 1 ? 'Восток (⭢)' : 'Запад (⭠)'
		case 'NE':
		case 'SW':
			return dir === 1 ? 'Юго-Восток (⭨)' : 'Северо-Запад (⭦)'
		case 'SE':
		case 'NW':
			return dir === 1 ? 'Юго-Запад (⭩)' : 'Северо-Восток (⭧)'
		default:
			return dir === 1 ? 'Вперёд (▶)' : 'Назад (◀)'
	}
}

/**
 * Fast deterministic FNV-1a 32-bit string hash.
 *
 * @param {string} str
 * @returns {number} 32-bit unsigned integer
 */
export function hashString(str) {
	let hash = 2166136261
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i)
		hash = Math.imul(hash, 16777619)
	}
	return (hash >>> 0)
}

/**
 * Generates a deterministic pseudo-random float in range [-1.0, 1.0] from a hash and seed.
 *
 * @param {number} hash - 32-bit hash integer
 * @param {number} seed - numeric seed index
 * @returns {number} float between -1.0 and 1.0
 */
export function getHashFloat(hash, seed = 0) {
	const n = (hash ^ (seed * 2654435761)) >>> 0
	return ((n % 10000) / 5000) - 1
}

/**
 * Calculates cubic Bezier control points for an organic procedural river meander (Civ style).
 *
 * River runs from `from` to `to`. The meander S-curves smoothly along the edge,
 * perfectly anchored at `from` (t=0) and `to` (t=1) so river junctions meet with zero seams.
 * Smaller river tiers (streams, brooks) have stronger, sharper micro-meanders,
 * while large rivers have gentle, sweeping curves.
 *
 * @param {{ x: number, y: number }} from - Edge start vertex
 * @param {{ x: number, y: number }} to - Edge end vertex
 * @param {string} canonKey - Canonical edge key for deterministic continuity
 * @param {number} radius - Hex radius
 * @param {number} tier - River width tier: 1 (brook), 2 (medium), 3 (wide)
 * @returns {{ cp1: { x: number, y: number }, cp2: { x: number, y: number } }}
 */
export function getRiverMeanderControls(from, to, canonKey, radius = DEFAULT_HEX_RADIUS, tier = 1) {
	const dx = to.x - from.x
	const dy = to.y - from.y
	const len = Math.hypot(dx, dy) || 1
	const ux = dx / len
	const uy = dy / len
	const nx = -uy
	const ny = ux

	const h = hashString(canonKey || `${from.x.toFixed(1)},${from.y.toFixed(1)}:${to.x.toFixed(1)},${to.y.toFixed(1)}`)
	const h1 = getHashFloat(h, 1)
	const h2 = getHashFloat(h, 2)

	// Organic S-curve meanders: Civ-style meandering riverbed.
	// Smaller river tiers (brooks, creeks) feature stronger, more winding meanders.
	let baseAmp
	let varAmp
	if (tier === 3) {
		baseAmp = 0.10
		varAmp = 0.07
	} else if (tier === 2) {
		baseAmp = 0.15
		varAmp = 0.10
	} else {
		// Tier 1: small mountain creek/brook winds vigorously with sharp micro-meanders
		baseAmp = 0.22
		varAmp = 0.14
	}

	const offset1 = (h1 >= 0 ? baseAmp + Math.abs(h1) * varAmp : -baseAmp - Math.abs(h1) * varAmp) * radius
	const offset2 = (-Math.sign(offset1 || 1) * (baseAmp + Math.abs(h2) * varAmp)) * radius

	const cp1 = {
		x: from.x + ux * (len * 0.35) + nx * offset1,
		y: from.y + uy * (len * 0.35) + ny * offset1
	}
	const cp2 = {
		x: from.x + ux * (len * 0.65) + nx * offset2,
		y: from.y + uy * (len * 0.65) + ny * offset2
	}

	return { cp1, cp2 }
}

/**
 * Calculates road path control points for organic procedural Civ-style roads.
 *
 * Road connects `fromCenter` to `toCenter`, crossing the shared hex boundary at point `mid`.
 * Because the hex boundary is at ground level (Z = 0), `mid` provides the exact crossing
 * where elevation is strictly 0. Collinear shoulder points `cp1` and `cp2` ensure C1 smooth
 * curvature through the boundary with organic wander and deflection.
 *
 * @param {{ x: number, y: number }} fromCenter - Hex 1 center
 * @param {{ x: number, y: number }} toCenter - Hex 2 center
 * @param {string} canonKey - Canonical road key
 * @param {number} radius - Hex radius
 * @returns {{ mid: { x: number, y: number }, cp1: { x: number, y: number }, cp2: { x: number, y: number }, tangent: { x: number, y: number } }}
 */
export function getRoadPathControls(fromCenter, toCenter, canonKey, radius = DEFAULT_HEX_RADIUS) {
	const dx = toCenter.x - fromCenter.x
	const dy = toCenter.y - fromCenter.y
	const len = Math.hypot(dx, dy) || 1
	const ux = dx / len
	const uy = dy / len
	const nx = -uy
	const ny = ux

	const h = hashString(canonKey || `${fromCenter.x.toFixed(1)},${fromCenter.y.toFixed(1)}:${toCenter.x.toFixed(1)},${toCenter.y.toFixed(1)}`)

	// Organic lateral shift at boundary crossing M (along the shared edge)
	const bendEdge = getHashFloat(h, 1) * (radius * 0.16)

	// Organic angular deflection for tangent at boundary crossing M
	const bendAngle = getHashFloat(h, 2) * 0.32 // up to ~18 degrees

	// Midpoint on shared boundary edge (Z = 0)
	const mid = {
		x: (fromCenter.x + toCenter.x) / 2 + nx * bendEdge,
		y: (fromCenter.y + toCenter.y) / 2 + ny * bendEdge
	}

	// Tangent vector through M
	const cosA = Math.cos(bendAngle)
	const sinA = Math.sin(bendAngle)
	const tx = ux * cosA + nx * sinA
	const ty = uy * cosA + ny * sinA

	// Collinear shoulder control points ensuring C1 smooth continuity through M
	const arm = len * 0.25
	const cp1 = {
		x: mid.x - tx * arm,
		y: mid.y - ty * arm
	}
	const cp2 = {
		x: mid.x + tx * arm,
		y: mid.y + ty * arm
	}

	return { mid, cp1, cp2, tangent: { x: tx, y: ty } }
}

/**
 * Calculates quadratic Bezier control midpoint for an organic procedural road curve (Civ style).
 *
 * @param {{ x: number, y: number }} fromCenter - Hex 1 center
 * @param {{ x: number, y: number }} toCenter - Hex 2 center
 * @param {string} canonKey - Canonical road key
 * @param {number} radius - Hex radius
 * @returns {{ x: number, y: number }}
 */
export function getRoadCurvePoint(fromCenter, toCenter, canonKey, radius = DEFAULT_HEX_RADIUS) {
	return getRoadPathControls(fromCenter, toCenter, canonKey, radius).mid
}

