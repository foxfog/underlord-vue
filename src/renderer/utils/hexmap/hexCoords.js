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
export const DEFAULT_HEX_TILT = 0.7
export const DEFAULT_HEX_MIN_ZOOM = 0.75
export const DEFAULT_HEX_MAX_ZOOM = 5

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
 * Calculates a deterministically jittered organic vertex from an ideal ground vertex.
 * Ensures the hex corner is not a rigid ironclad coordinate, providing natural
 * organic variability across the world while guaranteeing that adjacent cells and
 * rivers sharing the vertex arrive at the exact same perturbed point.
 *
 * @param {{ x: number, y: number }} v - Ideal ground vertex
 * @param {number} radius - Hex radius
 * @param {number} seed - Map seed
 * @returns {{ x: number, y: number }} Perturbed organic vertex
 */
export function getOrganicGroundVertex(v, radius = DEFAULT_HEX_RADIUS, seed = 0) {
	if (!v) return v
	const key = `${Math.round(v.x * 10) / 10},${Math.round(v.y * 10) / 10}`
	const h = hashString(`${key}:${seed || 0}`)
	const jX = getHashFloat(h, 1) * (0.16 * radius)
	const jY = getHashFloat(h, 2) * (0.16 * radius)
	return {
		x: v.x + jX,
		y: v.y + jY
	}
}

/**
 * Returns the 6 organic ground vertices of a hex with natural corner variability.
 *
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} radius
 * @param {number} seed
 * @returns {Array<{ x: number, y: number }>}
 */
export function getOrganicHexGroundVertices(
	centerX,
	centerY,
	radius = DEFAULT_HEX_RADIUS,
	seed = 0
) {
	const verts = getHexGroundVertices(centerX, centerY, radius)
	return verts.map((v) => getOrganicGroundVertex(v, radius, seed))
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
 * Calculates the bounding range of visible hex columns and rows on the ground plane.
 * Drastically accelerates frustum culling on large maps (e.g. 100x100 = 10,000 cells)
 * from O(N_total) down to O(N_visible) by only inspecting cells within the camera's viewport window.
 *
 * @param {HexPerspectiveCamera} camera
 * @param {number} [radius=DEFAULT_HEX_RADIUS]
 * @param {Object} [mapBounds=null] - { minCol, maxCol, minRow, maxRow }
 * @returns {{ minCol: number, maxCol: number, minRow: number, maxRow: number }}
 */
export function getVisibleHexGridBounds(camera, radius = DEFAULT_HEX_RADIUS, mapBounds = null) {
	const bMinCol = mapBounds?.minCol ?? -999999
	const bMaxCol = mapBounds?.maxCol ?? 999999
	const bMinRow = mapBounds?.minRow ?? -999999
	const bMaxRow = mapBounds?.maxRow ?? 999999

	const stepX = 1.5 * radius
	const stepY = Math.sqrt(3) * radius

	const horizonY = camera.getHorizonY ? camera.getHorizonY() : -999999
	let syTop = 0
	if (horizonY > -5000) {
		syTop = Math.max(0, horizonY + 14)
	}

	const vw = camera.viewportWidth || 960
	const vh = camera.viewportHeight || 540

	const pts = [
		camera.unproject(-60, syTop),
		camera.unproject(vw + 60, syTop),
		camera.unproject(-60, vh + 60),
		camera.unproject(vw + 60, vh + 60),
		camera.unproject(vw / 2, syTop),
		camera.unproject(vw / 2, vh + 60)
	].filter(Boolean)

	if (pts.length === 0) {
		return {
			minCol: mapBounds?.minCol ?? 0,
			maxCol: mapBounds?.maxCol ?? (mapBounds?.cols || 20) - 1,
			minRow: mapBounds?.minRow ?? 0,
			maxRow: mapBounds?.maxRow ?? (mapBounds?.rows || 15) - 1
		}
	}

	let minX = Infinity,
		maxX = -Infinity,
		minY = Infinity,
		maxY = -Infinity
	for (const p of pts) {
		if (p.x < minX) minX = p.x
		if (p.x > maxX) maxX = p.x
		if (p.y < minY) minY = p.y
		if (p.y > maxY) maxY = p.y
	}

	// Depth clamping for far-plane horizon fog (scale < 0.10)
	if (camera.sinT > 0.05) {
		const targetMinScale = 0.1
		const maxDistZ = camera.focalDistance / (targetMinScale / camera.zoom)
		const minFarGroundY = camera.cameraY + (camera.focalDistance - maxDistZ) / camera.sinT
		if (minY < minFarGroundY) {
			minY = minFarGroundY
			// Re-bound minX and maxX to the actual frustum width at the far fog boundary
			const scaleAtFar = targetMinScale
			const xFarLeft = camera.cameraX + (-60 - camera.cx0) / scaleAtFar
			const xFarRight = camera.cameraX + (vw + 60 - camera.cx0) / scaleAtFar
			const pBottomL = camera.unproject(-60, vh + 60)
			const pBottomR = camera.unproject(vw + 60, vh + 60)
			const xNearLeft = pBottomL ? pBottomL.x : camera.cameraX - 2000
			const xNearRight = pBottomR ? pBottomR.x : camera.cameraX + 2000

			minX = Math.min(xFarLeft, xNearLeft)
			maxX = Math.max(xFarRight, xNearRight)
		}
	}

	const padX = radius * 3
	const padY = radius * 3

	const minCol = Math.max(bMinCol, Math.floor((minX - padX) / stepX) - 1)
	const maxCol = Math.min(bMaxCol, Math.ceil((maxX + padX) / stepX) + 1)
	const minRow = Math.max(bMinRow, Math.floor((minY - padY) / stepY) - 1)
	const maxRow = Math.min(bMaxRow, Math.ceil((maxY + padY) / stepY) + 1)

	return { minCol, maxCol, minRow, maxRow }
}

/**
 * Calculates dynamic perspective pitch angle based on camera zoom.
 * - Minimum pitch at zoom-out (distance / удаление, zoom = 0.5): 0° (flat map).
 * - Maximum pitch at zoom-in (close-up / приближение, zoom = 3.75): 60°.
 *
 * @param {number} zoom - Current camera zoom level (0.5 .. 3.75)
 * @param {number} minPitch - Minimum pitch angle at zoom-out (default 0)
 * @param {number} maxPitch - Maximum pitch angle at zoom-in (default 60)
 * @param {number} minZoom - Zoom level for minPitch (default 0.5)
 * @param {number} maxZoom - Zoom level for maxPitch (default 3.75)
 * @returns {number} Dynamic pitch angle clamped between minPitch and maxPitch
 */
export function calculateDynamicPitch(
	zoom = 1.0,
	minPitch = 0,
	maxPitch = 60,
	minZoom = DEFAULT_HEX_MIN_ZOOM,
	maxZoom = DEFAULT_HEX_MAX_ZOOM
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
export function getHexVertices(
	centerX,
	centerY,
	radius = DEFAULT_HEX_RADIUS,
	tilt = DEFAULT_HEX_TILT
) {
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
export function getClosestEdgeToPoint(
	sx,
	sy,
	col,
	row,
	radius = DEFAULT_HEX_RADIUS,
	tilt = DEFAULT_HEX_TILT
) {
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
	const z = row - (col - Math.abs(col % 2)) / 2
	const y = -x - z
	return { x, y, z }
}

/**
 * Converts cube coordinates (x, y, z) back to odd-q offset coordinates (col, row).
 */
export function cubeToOddQ(x, y, z) {
	const col = x
	const row = z + (col - Math.abs(col % 2)) / 2
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
		for (
			let dy = Math.max(-maxDist, -dx - maxDist);
			dy <= Math.min(maxDist, -dx + maxDist);
			dy++
		) {
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
	return hash >>> 0
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
	return (n % 10000) / 5000 - 1
}

export const HEX_PERIMETER_EDGES = Object.freeze([
	{ edge: 'SE', fromIdx: 0, toIdx: 1 },
	{ edge: 'S', fromIdx: 1, toIdx: 2 },
	{ edge: 'SW', fromIdx: 2, toIdx: 3 },
	{ edge: 'NW', fromIdx: 3, toIdx: 4 },
	{ edge: 'N', fromIdx: 4, toIdx: 5 },
	{ edge: 'NE', fromIdx: 5, toIdx: 0 }
])

export const DEFAULT_TEXTURE_BLEED_RATIO = 1.18

/**
 * Calculates organic curve control points and parameters for a canonical hex edge.
 *
 * Supports 4 distinct harmonic profiles:
 * - Profile 0: C-arc (single wide natural bend / bay / promontory)
 * - Profile 1: Asymmetric S-meander (classic natural riverbed winding)
 * - Profile 2: Serpentine / multi-bend (sharper winding / rocky shores)
 * - Profile 3: Compound asymmetric lobe (bulge with long taper)
 *
 * Provides variable protrusion depths (0.08 .. 0.42 * radius),
 * aligned endpoint tangents, deterministic canonical symmetry,
 * and optional corner tangent blending.
 *
 * @param {{ x: number, y: number }} from - Edge start vertex
 * @param {{ x: number, y: number }} to - Edge end vertex
 * @param {string} canonKey - Canonical edge key e.g. "4,7:SE"
 * @param {number} radius - Hex radius
 * @param {number} tier - River/border tier (1=brook/default, 2=medium, 3=broad)
 * @param {Object} options - Optional configuration (tangentFrom, tangentTo, seed)
 * @returns {{ cp1: { x: number, y: number }, cp2: { x: number, y: number }, profileType: number, protrusion: number }}
 */
export function getHexEdgeCurve(
	from,
	to,
	canonKey,
	radius = DEFAULT_HEX_RADIUS,
	tier = 1,
	options = {}
) {
	const seed = options.seed !== undefined ? options.seed : 0
	let cnx = 0
	let cny = 1
	let cux = 1
	let cuy = 0
	let canFrom = null
	let canTo = null
	let clen = 1
	let canTFrom = null
	let canTTo = null

	if (canonKey && canonKey.includes(':')) {
		const parts = canonKey.split(':')
		const coords = parts[0]?.split(',')
		if (coords && coords.length === 2 && parts[1]) {
			const c0 = Number(coords[0])
			const r0 = Number(coords[1])
			const e0 = parts[1]
			const center0 = hexToWorldGroundCenter(c0, r0, radius)
			const gv0 = getOrganicHexGroundVertices(center0.x, center0.y, radius, seed)
			const ep0 = getHexEdgeEndpoints(gv0, e0)
			canFrom = ep0.from
			canTo = ep0.to
			const cdx = ep0.to.x - ep0.from.x
			const cdy = ep0.to.y - ep0.from.y
			clen = Math.hypot(cdx, cdy) || 1
			cux = cdx / clen
			cuy = cdy / clen
			cnx = -cuy
			cny = cux

			// Find vertex indices in gv0 (0..5)
			let idxFrom = -1
			let idxTo = -1
			for (let i = 0; i < 6; i++) {
				if (gv0[i].x === canFrom.x && gv0[i].y === canFrom.y) idxFrom = i
				if (gv0[i].x === canTo.x && gv0[i].y === canTo.y) idxTo = i
			}

			if (idxFrom !== -1 && idxTo !== -1) {
				const otherFromIdx =
					(idxFrom + 1) % 6 === idxTo ? (idxFrom + 5) % 6 : (idxFrom + 1) % 6
				const vOtherFrom = gv0[otherFromIdx]
				const dInX = canFrom.x - vOtherFrom.x
				const dInY = canFrom.y - vOtherFrom.y
				const lIn = Math.hypot(dInX, dInY) || 1
				const uInX = dInX / lIn
				const uInY = dInY / lIn

				const otherToIdx = (idxTo + 1) % 6 === idxFrom ? (idxTo + 5) % 6 : (idxTo + 1) % 6
				const vOtherTo = gv0[otherToIdx]
				const dOutX = vOtherTo.x - canTo.x
				const dOutY = vOtherTo.y - canTo.y
				const lOut = Math.hypot(dOutX, dOutY) || 1
				const uOutX = dOutX / lOut
				const uOutY = dOutY / lOut

				const sFx = uInX + cux
				const sFy = uInY + cuy
				const sFLen = Math.hypot(sFx, sFy) || 1
				canTFrom = { x: sFx / sFLen, y: sFy / sFLen }

				const sTx = cux + uOutX
				const sTy = cuy + uOutY
				const sTLen = Math.hypot(sTx, sTy) || 1
				canTTo = { x: sTx / sTLen, y: sTy / sTLen }
			}
		}
	}

	const edx = to.x - from.x
	const edy = to.y - from.y
	const elen = Math.hypot(edx, edy) || 1
	const ux = edx / elen
	const uy = edy / elen
	const nx = -uy
	const ny = ux

	if (!canFrom) {
		canFrom = from
		canTo = to
		clen = elen
		cux = ux
		cuy = uy
		cnx = nx
		cny = ny
	}

	const h = hashString(
		canonKey
			? `${canonKey}:${seed}`
			: `${from.x.toFixed(1)},${from.y.toFixed(1)}:${to.x.toFixed(1)},${to.y.toFixed(1)}:${seed}`
	)

	// 4 distinct curve profile archetypes:
	// 0: C-arc (single wide natural bend / bay / promontory)
	// 1: Asymmetric S-meander (classic natural riverbed winding)
	// 2: Serpentine / multi-bend (sharper winding / rocky shores)
	// 3: Compound asymmetric lobe (bulge with long taper)
	const profileType = Math.abs(h) % 4

	// Tier scaling factor: tier 1 (brook) winds strongest, tier 3 (broad river) gentlest
	let tierFactor = 1.0
	if (tier === 3) tierFactor = 0.52
	else if (tier === 2) tierFactor = 0.76
	else tierFactor = 1.05

	// Protrusion depth: bold, prominent arcs (0.20 to 0.40 * radius)
	const hAmp = Math.abs(getHashFloat(h, 7)) // 0.0 .. 1.0
	const protrusion = (0.22 + hAmp * 0.16) * tierFactor * radius
	const h1 = getHashFloat(h, 1)
	const h2 = getHashFloat(h, 2)
	const h3 = getHashFloat(h, 3)
	const h4 = getHashFloat(h, 4)
	const sign1 = h1 >= 0 ? 1 : -1

	// Check traversal direction relative to canonical edge orientation
	const dot = edx * cux + edy * cuy
	const isForward = dot >= 0

	// Intermediate points M1 and M2 positions along chord (u1 ~ 0.34, u2 ~ 0.66)
	const uFrac = 0.34 + 0.03 * Math.abs(h2)
	const u1 = uFrac
	const u2 = 1 - uFrac

	let mOffset1, mOffset2

	switch (profileType) {
		case 0:
			// Profile 0: C-arc (wide bowing bay / promontory to one side with 2 apex points)
			mOffset1 = sign1 * protrusion * 0.85
			mOffset2 = sign1 * protrusion * 0.85
			break
		case 1:
			// Profile 1: Asymmetric S-meander (lobe 1 to sign1, lobe 2 to -sign1)
			mOffset1 = sign1 * protrusion * 0.82
			mOffset2 = -sign1 * protrusion * 0.82
			break
		case 2:
			// Profile 2: Serpentine (multiple alternating micro-bends and lobes)
			mOffset1 = -sign1 * protrusion * 0.78
			mOffset2 = sign1 * protrusion * 0.78
			break
		case 3:
		default:
			// Profile 3: Compound asymmetric lobe (crest at M1, shoulder at M2)
			mOffset1 = sign1 * protrusion * 0.9
			mOffset2 = sign1 * protrusion * 0.55
			break
	}

	// Guarantee minimum protrusion on BOTH intermediate points M1 and M2
	// Ensures every edge has at least 2 prominent additional points between the 2 main hex corners
	const minOffset = 0.5 * protrusion
	if (Math.abs(mOffset1) < minOffset) {
		mOffset1 = (mOffset1 >= 0 ? 1 : -1) * minOffset
	}
	if (Math.abs(mOffset2) < minOffset) {
		mOffset2 = (mOffset2 >= 0 ? 1 : -1) * minOffset
	}

	const u_used1 = isForward ? u1 : 1 - u2
	const u_used2 = isForward ? u2 : 1 - u1
	const off_used1 = isForward ? mOffset1 : -mOffset2
	const off_used2 = isForward ? mOffset2 : -mOffset1

	// Single-bezier compatibility controls
	let cp1 = {
		x: from.x + ux * (elen * u_used1) + nx * off_used1,
		y: from.y + uy * (elen * u_used1) + ny * off_used1
	}
	let cp2 = {
		x: to.x - ux * (elen * (1 - u_used2)) + nx * off_used2,
		y: to.y - uy * (elen * (1 - u_used2)) + ny * off_used2
	}

	// Two intermediate organic apex points between hex corners (minimum 2 guaranteed!)
	const mid1 = {
		x: from.x + ux * (elen * u_used1) + nx * off_used1,
		y: from.y + uy * (elen * u_used1) + ny * off_used1
	}
	const mid2 = {
		x: from.x + ux * (elen * u_used2) + nx * off_used2,
		y: from.y + uy * (elen * u_used2) + ny * off_used2
	}

	// 3 subsegments:
	// Subsegment A: from -> mid1 (L1)
	// Subsegment B: mid1 -> mid2 (L2)
	// Subsegment C: mid2 -> to (L3)
	const d1x = mid1.x - from.x
	const d1y = mid1.y - from.y
	const L1 = Math.hypot(d1x, d1y) || 1
	const u1x = d1x / L1
	const u1y = d1y / L1

	const d2x = mid2.x - mid1.x
	const d2y = mid2.y - mid1.y
	const L2 = Math.hypot(d2x, d2y) || 1
	const u2x = d2x / L2
	const u2y = d2y / L2

	const d3x = to.x - mid2.x
	const d3y = to.y - mid2.y
	const L3 = Math.hypot(d3x, d3y) || 1
	const u3x = d3x / L3
	const u3y = d3y / L3

	// Tangent direction at M1 (smooth through-vector between L1 and L2)
	const sumM1x = u1x + u2x
	const sumM1y = u1y + u2y
	const lenM1 = Math.hypot(sumM1x, sumM1y) || 1
	const tM1x = sumM1x / lenM1
	const tM1y = sumM1y / lenM1

	// Tangent direction at M2 (smooth through-vector between L2 and L3)
	const sumM2x = u2x + u3x
	const sumM2y = u2y + u3y
	const lenM2 = Math.hypot(sumM2x, sumM2y) || 1
	const tM2x = sumM2x / lenM2
	const tM2y = sumM2y / lenM2

	const armA = Math.min(L1 * 0.4, 14 * (radius / DEFAULT_HEX_RADIUS))
	const armB1 = Math.min(L2 * 0.38, 14 * (radius / DEFAULT_HEX_RADIUS))
	const armB2 = Math.min(L2 * 0.38, 14 * (radius / DEFAULT_HEX_RADIUS))
	const armC = Math.min(L3 * 0.4, 14 * (radius / DEFAULT_HEX_RADIUS))

	let tFrom = options.tangentFrom || null
	let tTo = options.tangentTo || null

	if (!tFrom && canTFrom) {
		tFrom = isForward ? canTFrom : { x: -canTTo.x, y: -canTTo.y }
	}
	if (!tTo && canTTo) {
		tTo = isForward ? canTTo : { x: -canTFrom.x, y: -canTFrom.y }
	}

	let cp1A
	if (tFrom) {
		const tFLen = Math.hypot(tFrom.x, tFrom.y) || 1
		const uTFx = tFrom.x / tFLen
		const uTFy = tFrom.y / tFLen
		cp1A = {
			x: from.x + uTFx * armA,
			y: from.y + uTFy * armA
		}
	} else {
		cp1A = {
			x: from.x + u1x * armA,
			y: from.y + u1y * armA
		}
	}

	let cp2C
	if (tTo) {
		const tTLen = Math.hypot(tTo.x, tTo.y) || 1
		const uTTx = tTo.x / tTLen
		const uTTy = tTo.y / tTLen
		cp2C = {
			x: to.x - uTTx * armC,
			y: to.y - uTTy * armC
		}
	} else {
		cp2C = {
			x: to.x - u3x * armC,
			y: to.y - u3y * armC
		}
	}

	// At M1: incoming handle cp2A and outgoing handle cp1B are collinear 180° along tM1
	let cp2A = {
		x: mid1.x - tM1x * armA,
		y: mid1.y - tM1y * armA
	}
	let cp1B = {
		x: mid1.x + tM1x * armB1,
		y: mid1.y + tM1y * armB1
	}

	// At M2: incoming handle cp2B and outgoing handle cp1C are collinear 180° along tM2
	let cp2B = {
		x: mid2.x - tM2x * armB2,
		y: mid2.y - tM2y * armB2
	}
	let cp1C = {
		x: mid2.x + tM2x * armC,
		y: mid2.y + tM2y * armC
	}

	return {
		from,
		to,
		cp1,
		cp2,
		// Multi-bend organic intermediate apex points (minimum 2 guaranteed!)
		mid1,
		mid2,
		midPoints: [mid1, mid2],
		mid: mid1, // backward compatibility
		// 3 Bezier subsegments
		cp1A,
		cp2A,
		cp1B,
		cp2B,
		cp1C,
		cp2C,
		profileType,
		protrusion
	}
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
export function getRiverMeanderControls(
	from,
	to,
	canonKey,
	radius = DEFAULT_HEX_RADIUS,
	tier = 1,
	options = {}
) {
	const seed = options.seed !== undefined ? options.seed : 0
	let cnx = 0
	let cny = 1
	let cux = 1
	let cuy = 0
	let canFrom = null

	if (canonKey && canonKey.includes(':')) {
		const parts = canonKey.split(':')
		const coords = parts[0]?.split(',')
		if (coords && coords.length === 2 && parts[1]) {
			const c0 = Number(coords[0])
			const r0 = Number(coords[1])
			const e0 = parts[1]
			const center0 = hexToWorldGroundCenter(c0, r0, radius)
			const gv0 = getHexGroundVertices(center0.x, center0.y, radius)
			const ep0 = getHexEdgeEndpoints(gv0, e0)
			canFrom = ep0.from
			const cdx = ep0.to.x - ep0.from.x
			const cdy = ep0.to.y - ep0.from.y
			const clen = Math.hypot(cdx, cdy) || 1
			cux = cdx / clen
			cuy = cdy / clen
			cnx = -cuy
			cny = cux
		}
	}

	if (!canFrom) {
		const edx = to.x - from.x
		const edy = to.y - from.y
		const elen = Math.hypot(edx, edy) || 1
		cux = edx / elen
		cuy = edy / elen
		cnx = -cuy
		cny = cux
	}

	const edx = to.x - from.x
	const edy = to.y - from.y
	const elen = Math.hypot(edx, edy) || 1
	const ux = edx / elen
	const uy = edy / elen
	const nx = -uy
	const ny = ux

	const h = hashString(
		canonKey
			? `${canonKey}:${seed}`
			: `${from.x.toFixed(1)},${from.y.toFixed(1)}:${to.x.toFixed(1)},${to.y.toFixed(1)}:${seed}`
	)
	const h1 = getHashFloat(h, 1)
	const h2 = getHashFloat(h, 2)

	// Organic S-curve meanders: Civ-style meandering riverbed.
	// Smaller river tiers (brooks, creeks) feature stronger, more winding meanders.
	let baseAmp
	let varAmp
	if (tier === 3) {
		baseAmp = 0.1
		varAmp = 0.07
	} else if (tier === 2) {
		baseAmp = 0.15
		varAmp = 0.1
	} else {
		// Tier 1: small mountain creek/brook winds vigorously with sharp micro-meanders
		baseAmp = 0.22
		varAmp = 0.14
	}

	const offset1 =
		(h1 >= 0 ? baseAmp + Math.abs(h1) * varAmp : -baseAmp - Math.abs(h1) * varAmp) * radius
	const offset2 = -Math.sign(offset1 || 1) * (baseAmp + Math.abs(h2) * varAmp) * radius

	// Check traversal direction relative to canonical edge orientation
	const dot = edx * cux + edy * cuy

	if (dot >= 0) {
		// Forward traversal along canonical edge
		return {
			from,
			to,
			cp1: {
				x: from.x + ux * (elen * 0.35) + nx * offset1,
				y: from.y + uy * (elen * 0.35) + ny * offset1
			},
			cp2: {
				x: from.x + ux * (elen * 0.65) + nx * offset2,
				y: from.y + uy * (elen * 0.65) + ny * offset2
			}
		}
	} else {
		// Reverse traversal: identical physical curve in reverse
		return {
			from,
			to,
			cp1: {
				x: from.x + ux * (elen * 0.35) - nx * offset2,
				y: from.y + uy * (elen * 0.35) - ny * offset2
			},
			cp2: {
				x: from.x + ux * (elen * 0.65) - nx * offset1,
				y: from.y + uy * (elen * 0.65) - ny * offset1
			}
		}
	}
}

/**
 * Calculates cubic Bezier control points for an organic procedural Civ-style country border.
 *
 * Fully unified with the river meander curve generator so that country borders running
 * along rivers share the exact same contours, bends, and harmonic undulations.
 *
 * @param {{ x: number, y: number }} from - Edge start vertex
 * @param {{ x: number, y: number }} to - Edge end vertex
 * @param {string} canonKey - Canonical edge key e.g. "4,7:SE"
 * @param {number} radius - Hex radius
 * @param {number} tier - River width tier for meander amplitude scaling (default 1)
 * @param {Object} options - Optional config (seed, etc.)
 * @returns {{ cp1: { x: number, y: number }, cp2: { x: number, y: number } }}
 */
export function getBorderMeanderControls(
	from,
	to,
	canonKey,
	radius = DEFAULT_HEX_RADIUS,
	tier = 1,
	options = {}
) {
	return getHexEdgeCurve(from, to, canonKey, radius, tier, options)
}

/**
 * Returns the 6 organic edges comprising the outer boundary of a given hex cell.
 * Each edge includes from, to, cp1, cp2 for clipping masks and texture overlay mapping,
 * plus multi-bend points (mid, cp1A, cp2A, cp1B, cp2B) and an ordered clockwise perimeter array.
 *
 * @param {number} col
 * @param {number} row
 * @param {number} radius
 * @param {number} seed
 * @param {Map} riverMap - Optional Map of canonicalEdgeKey -> river data for tier matching
 * @returns {{ col: number, row: number, center: { x: number, y: number }, vertices: Array, edges: Array, perimeter: Array }}
 */
// Singleton cache for precomputed organic cell polygons to eliminate redundant trigonometric math
const _organicPolygonCache = new Map()
const MAX_POLYGON_CACHE = 8000

/**
 * Clears the organic polygon cache (useful when editing rivers or resizing).
 */
export function clearOrganicPolygonCache() {
	_organicPolygonCache.clear()
}

export function getOrganicCellPolygon(
	col,
	row,
	radius = DEFAULT_HEX_RADIUS,
	seed = 0,
	riverMap = null
) {
	const rSig = riverMap ? riverMap.size : 0
	const cacheKey = `${col},${row}:${radius}:${seed}:${rSig}`
	const cached = _organicPolygonCache.get(cacheKey)
	if (cached) return cached

	if (_organicPolygonCache.size > MAX_POLYGON_CACHE) {
		_organicPolygonCache.clear()
	}

	const center = hexToWorldGroundCenter(col, row, radius)
	const groundVerts = getOrganicHexGroundVertices(center.x, center.y, radius, seed)
	const edges = []

	for (const edge of HEX_EDGES) {
		const { from, to } = getHexEdgeEndpoints(groundVerts, edge)
		const canonKey = getCanonicalEdgeKey(col, row, edge)
		const river = riverMap?.get(canonKey)
		const tier = river ? river.width || 1 : 1
		const curve = getHexEdgeCurve(from, to, canonKey, radius, tier, { seed })
		edges.push({
			edge,
			canonKey,
			from,
			to,
			cp1: curve.cp1,
			cp2: curve.cp2,
			mid: curve.mid,
			mid1: curve.mid1,
			mid2: curve.mid2,
			midPoints: curve.midPoints,
			cp1A: curve.cp1A,
			cp2A: curve.cp2A,
			cp1B: curve.cp1B,
			cp2B: curve.cp2B,
			cp1C: curve.cp1C,
			cp2C: curve.cp2C
		})
	}

	const perimeter = []
	for (const pe of HEX_PERIMETER_EDGES) {
		const from = groundVerts[pe.fromIdx]
		const to = groundVerts[pe.toIdx]
		const canonKey = getCanonicalEdgeKey(col, row, pe.edge)
		const river = riverMap?.get(canonKey)
		const tier = river ? river.width || 1 : 1
		const curve = getHexEdgeCurve(from, to, canonKey, radius, tier, { seed })
		perimeter.push({
			edge: pe.edge,
			canonKey,
			from,
			to,
			cp1: curve.cp1,
			cp2: curve.cp2,
			mid: curve.mid,
			mid1: curve.mid1,
			mid2: curve.mid2,
			midPoints: curve.midPoints,
			cp1A: curve.cp1A,
			cp2A: curve.cp2A,
			cp1B: curve.cp1B,
			cp2B: curve.cp2B,
			cp1C: curve.cp1C,
			cp2C: curve.cp2C
		})
	}

	const result = {
		col,
		row,
		center,
		vertices: groundVerts,
		edges,
		perimeter
	}
	_organicPolygonCache.set(cacheKey, result)
	return result
}

/**
 * Returns the 6 ordered clockwise perimeter edges of a given hex cell,
 * forming a continuous watertight organic boundary.
 *
 * @param {number} col
 * @param {number} row
 * @param {number} radius
 * @param {number} seed
 * @param {Map} riverMap - Optional Map of canonicalEdgeKey -> river data for tier matching
 * @returns {Array} Ordered array of 6 curved edges around the perimeter
 */
export function getOrganicCellPerimeter(
	col,
	row,
	radius = DEFAULT_HEX_RADIUS,
	seed = 0,
	riverMap = null
) {
	return getOrganicCellPolygon(col, row, radius, seed, riverMap).perimeter
}

/**
 * Determines if a given hex edge is a coastline boundary between land and water.
 * Coast edges require sharp rendering without blending.
 *
 * @param {Object} cellA - First cell object { col, row, terrain }
 * @param {Object} cellB - Neighbor cell object { col, row, terrain }
 * @returns {boolean} True if one cell is water/ocean and the other is land
 */
export function isCoastEdge(cellA, cellB) {
	if (!cellA || !cellB) return false
	const isWaterA = cellA.terrain === 'water' || cellA.terrain === 'ocean'
	const isWaterB = cellB.terrain === 'water' || cellB.terrain === 'ocean'
	return (isWaterA && !isWaterB) || (!isWaterA && isWaterB)
}

/**
 * Deterministically resolves a texture sprite variant index for a cell.
 *
 * @param {number} col
 * @param {number} row
 * @param {number} variantsCount - Total number of sprite variants for this biome
 * @param {number} seed - Map seed
 * @returns {number} 0-based variant index
 */
export function getBiomeTextureVariant(col, row, variantsCount = 3, seed = 0) {
	if (variantsCount <= 1) return 0
	const h = hashString(`${col},${row}:biomeVariant:${seed}`)
	return Math.abs(h) % variantsCount
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

	const h = hashString(
		canonKey ||
			`${fromCenter.x.toFixed(1)},${fromCenter.y.toFixed(1)}:${toCenter.x.toFixed(1)},${toCenter.y.toFixed(1)}`
	)

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

/**
 * Calculates new map bounds after applying directional deltas (North, South, West, East).
 * Preserves world coordinate system and (0,0) origin.
 *
 * @param {{minCol?: number, maxCol?: number, minRow?: number, maxRow?: number, cols?: number, rows?: number}} currentBounds
 * @param {{north?: number, south?: number, west?: number, east?: number}} deltas
 *   - north: positive expands North (decreases minRow), negative shrinks
 *   - south: positive expands South (increases maxRow), negative shrinks
 *   - west: positive expands West (decreases minCol), negative shrinks
 *   - east: positive expands East (increases maxCol), negative shrinks
 * @returns {{minCol: number, maxCol: number, minRow: number, maxRow: number, cols: number, rows: number}}
 */
export function calculateDirectionalBounds(currentBounds, deltas = {}) {
	const curMinCol = currentBounds.minCol !== undefined ? currentBounds.minCol : 0
	const curMaxCol =
		currentBounds.maxCol !== undefined ? currentBounds.maxCol : (currentBounds.cols || 1) - 1
	const curMinRow = currentBounds.minRow !== undefined ? currentBounds.minRow : 0
	const curMaxRow =
		currentBounds.maxRow !== undefined ? currentBounds.maxRow : (currentBounds.rows || 1) - 1

	const minCol = curMinCol - (deltas.west || 0)
	const maxCol = curMaxCol + (deltas.east || 0)
	const minRow = curMinRow - (deltas.north || 0)
	const maxRow = curMaxRow + (deltas.south || 0)

	const safeMinCol = Math.min(minCol, maxCol)
	const safeMaxCol = Math.max(minCol, maxCol)
	const safeMinRow = Math.min(minRow, maxRow)
	const safeMaxRow = Math.max(minRow, maxRow)

	return {
		minCol: safeMinCol,
		maxCol: safeMaxCol,
		minRow: safeMinRow,
		maxRow: safeMaxRow,
		cols: safeMaxCol - safeMinCol + 1,
		rows: safeMaxRow - safeMinRow + 1
	}
}

/**
 * Calculates new map bounds given target dimensions and an anchor position (3x3 matrix).
 *
 * Anchor options:
 * - 'top-left': fixes top and left boundaries (minCol, minRow), expands right and down.
 * - 'top': fixes top boundary (minRow), expands down and centers deltaW horizontally.
 * - 'top-right': fixes top and right boundaries (maxCol, minRow), expands left and down.
 * - 'left': fixes left boundary (minCol), expands right and centers deltaH vertically.
 * - 'center': expands/shrinks symmetrically around existing boundaries.
 * - 'right': fixes right boundary (maxCol), expands left and centers deltaH vertically.
 * - 'bottom-left': fixes bottom and left boundaries (minCol, maxRow), expands right and up.
 * - 'bottom': fixes bottom boundary (maxRow), expands up and centers deltaW horizontally.
 * - 'bottom-right': fixes bottom and right boundaries (maxCol, maxRow), expands left and up.
 *
 * @param {{minCol?: number, maxCol?: number, minRow?: number, maxRow?: number, cols?: number, rows?: number}} currentBounds
 * @param {number} targetCols
 * @param {number} targetRows
 * @param {string} [anchor='center']
 * @returns {{minCol: number, maxCol: number, minRow: number, maxRow: number, cols: number, rows: number}}
 */
export function calculateAnchorBounds(currentBounds, targetCols, targetRows, anchor = 'center') {
	const curMinCol = currentBounds.minCol !== undefined ? currentBounds.minCol : 0
	const curMaxCol =
		currentBounds.maxCol !== undefined ? currentBounds.maxCol : (currentBounds.cols || 1) - 1
	const curMinRow = currentBounds.minRow !== undefined ? currentBounds.minRow : 0
	const curMaxRow =
		currentBounds.maxRow !== undefined ? currentBounds.maxRow : (currentBounds.rows || 1) - 1

	const currentW = curMaxCol - curMinCol + 1
	const currentH = curMaxRow - curMinRow + 1
	const safeTargetCols = Math.max(1, targetCols)
	const safeTargetRows = Math.max(1, targetRows)
	const deltaW = safeTargetCols - currentW
	const deltaH = safeTargetRows - currentH

	let minCol = curMinCol
	let maxCol = curMaxCol
	let minRow = curMinRow
	let maxRow = curMaxRow

	// Horizontal distribution
	if (anchor === 'top-left' || anchor === 'left' || anchor === 'bottom-left') {
		maxCol = minCol + safeTargetCols - 1
	} else if (anchor === 'top-right' || anchor === 'right' || anchor === 'bottom-right') {
		minCol = maxCol - safeTargetCols + 1
	} else {
		const leftDelta = Math.floor(deltaW / 2)
		const rightDelta = deltaW - leftDelta
		minCol = curMinCol - leftDelta
		maxCol = curMaxCol + rightDelta
	}

	// Vertical distribution
	if (anchor === 'top-left' || anchor === 'top' || anchor === 'top-right') {
		maxRow = minRow + safeTargetRows - 1
	} else if (anchor === 'bottom-left' || anchor === 'bottom' || anchor === 'bottom-right') {
		minRow = maxRow - safeTargetRows + 1
	} else {
		const topDelta = Math.floor(deltaH / 2)
		const bottomDelta = deltaH - topDelta
		minRow = curMinRow - topDelta
		maxRow = curMaxRow + bottomDelta
	}

	const safeMinCol = Math.min(minCol, maxCol)
	const safeMaxCol = Math.max(minCol, maxCol)
	const safeMinRow = Math.min(minRow, maxRow)
	const safeMaxRow = Math.max(minRow, maxRow)

	return {
		minCol: safeMinCol,
		maxCol: safeMaxCol,
		minRow: safeMinRow,
		maxRow: safeMaxRow,
		cols: safeMaxCol - safeMinCol + 1,
		rows: safeMaxRow - safeMinRow + 1
	}
}
