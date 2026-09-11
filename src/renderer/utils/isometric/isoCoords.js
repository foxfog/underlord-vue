/**
 * Isometric coordinate transformations and utility functions for 2.5D rhombic grid (2:1 ratio).
 * Standard projection:
 * screenX = originX + (x - y) * (tileWidth / 2)
 * screenY = originY + (x + y) * (tileHeight / 2) - z * heightStep
 */

export const DEFAULT_TILE_WIDTH = 64
export const DEFAULT_TILE_HEIGHT = 32
export const DEFAULT_HEIGHT_STEP = 16
export const DEFAULT_WALL_HEIGHT = 1.5
export const WALL_EDGES = ['NW', 'NE', 'SW', 'SE']

/**
 * Converts 3D isometric grid coordinates (x, y, z) to 2D screen coordinates.
 * Screen point represents the center of the top face of the tile.
 */
export function gridToScreen(
	x,
	y,
	z = 0,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const halfW = tileWidth / 2
	const halfH = tileHeight / 2
	const screenX = originX + (x - y) * halfW
	const screenY = originY + (x + y) * halfH - z * heightStep
	return { x: screenX, y: screenY }
}

/**
 * Converts 2D screen coordinates back to grid coordinates at a specific elevation layer z.
 */
export function screenToGrid(
	screenX,
	screenY,
	z = 0,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const dx = screenX - originX
	const dy = screenY - originY + z * heightStep
	const halfW = tileWidth / 2
	const halfH = tileHeight / 2

	const gx = (dx / halfW + dy / halfH) / 2
	const gy = (dy / halfH - dx / halfW) / 2

	return {
		x: Math.round(gx),
		y: Math.round(gy)
	}
}

/**
 * Calculates the 4 vertices of a tile's top rhombus face in screen space.
 * Order: Top, Right, Bottom, Left.
 */
export function getTilePolygon(
	x,
	y,
	z = 0,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const center = gridToScreen(x, y, z, originX, originY, tileWidth, tileHeight, heightStep)
	const halfW = tileWidth / 2
	const halfH = tileHeight / 2

	return [
		{ x: center.x, y: center.y - halfH }, // Top
		{ x: center.x + halfW, y: center.y }, // Right
		{ x: center.x, y: center.y + halfH }, // Bottom
		{ x: center.x - halfW, y: center.y } // Left
	]
}

/**
 * Calculates the 4 vertices of a wall quad along a specified tile edge.
 * Returns an array of 4 points in clockwise order: [TopLeft, TopRight, BottomRight, BottomLeft].
 *
 * @param {number} x - Grid X
 * @param {number} y - Grid Y
 * @param {number} [z=0] - Grid Z elevation
 * @param {'NW'|'NE'|'SW'|'SE'} edge - Tile edge where the wall is placed
 * @param {number} [wallHeight=DEFAULT_WALL_HEIGHT] - Wall height in height steps
 * @param {number} [originX=0]
 * @param {number} [originY=0]
 * @param {number} [tileWidth=DEFAULT_TILE_WIDTH]
 * @param {number} [tileHeight=DEFAULT_TILE_HEIGHT]
 * @param {number} [heightStep=DEFAULT_HEIGHT_STEP]
 * @returns {Array<{x: number, y: number}>} 4 vertices
 */
export function getWallPolygon(
	x,
	y,
	z = 0,
	edge = 'NW',
	wallHeight = DEFAULT_WALL_HEIGHT,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const center = gridToScreen(x, y, z, originX, originY, tileWidth, tileHeight, heightStep)
	const halfW = tileWidth / 2
	const halfH = tileHeight / 2
	const wallH = wallHeight * heightStep

	const top = { x: center.x, y: center.y - halfH }
	const right = { x: center.x + halfW, y: center.y }
	const bottom = { x: center.x, y: center.y + halfH }
	const left = { x: center.x - halfW, y: center.y }

	let baseA
	let baseB

	switch (edge) {
		case 'NW':
			baseA = left
			baseB = top
			break
		case 'NE':
			baseA = top
			baseB = right
			break
		case 'SW':
			baseA = left
			baseB = bottom
			break
		case 'SE':
		default:
			baseA = bottom
			baseB = right
			break
	}

	return [
		{ x: baseA.x, y: baseA.y - wallH },
		{ x: baseB.x, y: baseB.y - wallH },
		{ x: baseB.x, y: baseB.y },
		{ x: baseA.x, y: baseA.y }
	]
}

/**
 * Calculates the screen coordinate for a nested object/attachment with relative sub-tile offsets.
 *
 * @param {{x: number, y: number}} tileScreen - Parent screen position (e.g. center of tile or parent object)
 * @param {number} [offsetX=0] - Sub-tile offset along isometric X
 * @param {number} [offsetY=0] - Sub-tile offset along isometric Y
 * @param {number} [offsetZ=0] - Sub-tile vertical elevation offset
 * @param {number} [tileWidth=DEFAULT_TILE_WIDTH]
 * @param {number} [tileHeight=DEFAULT_TILE_HEIGHT]
 * @param {number} [heightStep=DEFAULT_HEIGHT_STEP]
 * @returns {{x: number, y: number}}
 */
export function getObjectScreenPos(
	tileScreen,
	offsetX = 0,
	offsetY = 0,
	offsetZ = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	if (!tileScreen) return { x: 0, y: 0 }
	const dx = (offsetX - offsetY) * (tileWidth / 64)
	const dy = (offsetX + offsetY) * (tileHeight / 64) - offsetZ * (heightStep / DEFAULT_HEIGHT_STEP)
	return {
		x: tileScreen.x + dx,
		y: tileScreen.y + dy
	}
}


/**
 * Checks if a point (px, py) is inside a 2D polygon using ray-casting.
 */
export function isPointInPolygon(px, py, vertices) {
	let inside = false
	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const xi = vertices[i].x
		const yi = vertices[i].y
		const xj = vertices[j].x
		const yj = vertices[j].y

		const intersect =
			yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi
		if (intersect) inside = !inside
	}
	return inside
}

/**
 * Picks the front-most tile clicked by mouse on the screen, taking multi-level elevation into account.
 * Tiles are tested from highest elevation and closest depth down to lowest.
 */
export function pickTileAtScreen(
	screenX,
	screenY,
	tiles,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	if (!tiles || tiles.length === 0) return null

	// Sort tiles: higher z first, then closer depth (x + y descending)
	const sorted = [...tiles].sort((a, b) => {
		const depthA = a.x + a.y + (a.z || 0) * 2
		const depthB = b.x + b.y + (b.z || 0) * 2
		return depthB - depthA
	})

	for (const tile of sorted) {
		const poly = getTilePolygon(
			tile.x,
			tile.y,
			tile.z || 0,
			originX,
			originY,
			tileWidth,
			tileHeight,
			heightStep
		)
		if (isPointInPolygon(screenX, screenY, poly)) {
			return tile
		}
	}

	return null
}

/**
 * Calculates Manhattan distance between two grid points (cardinal steps).
 */
export function manhattanDistance(a, b) {
	return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Calculates Chebyshev distance between two grid points (including diagonals).
 */
export function chebyshevDistance(a, b) {
	return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

/**
 * Checks if two grid points are adjacent.
 */
export function isAdjacent(a, b, allowDiagonal = false) {
	if (!a || !b) return false
	if (allowDiagonal) {
		const d = chebyshevDistance(a, b)
		return d === 1
	}
	return manhattanDistance(a, b) === 1
}

/**
 * Calculates a unique depth sort key for painter's rendering order.
 * Uses a safe base offset (10,000) to ensure strictly positive sort keys
 * even with negative coordinates centered around (0, 0).
 */
export function getDepthSortKey(x, y, z = 0, subLayer = 0) {
	return (x + y + 10000) * 1000 + (z + 100) * 10 + subLayer
}

/**
 * Picks a grid cell coordinate (even if empty or void) at elevation z = 0 within optional bounds.
 *
 * @param {number} screenX - Screen X (world coordinates)
 * @param {number} screenY - Screen Y (world coordinates)
 * @param {{minX: number, maxX: number, minY: number, maxY: number}|null} [bounds=null] - Optional grid boundaries
 * @param {number} [originX=0]
 * @param {number} [originY=0]
 * @param {number} [tileWidth=DEFAULT_TILE_WIDTH]
 * @param {number} [tileHeight=DEFAULT_TILE_HEIGHT]
 * @param {number} [heightStep=DEFAULT_HEIGHT_STEP]
 * @returns {{x: number, y: number, z: number}|null}
 */
export function pickGridCellAtScreen(
	screenX,
	screenY,
	bounds = null,
	originX = 0,
	originY = 0,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const grid = screenToGrid(
		screenX,
		screenY,
		0,
		originX,
		originY,
		tileWidth,
		tileHeight,
		heightStep
	)

	if (bounds) {
		if (
			grid.x < bounds.minX ||
			grid.x > bounds.maxX ||
			grid.y < bounds.minY ||
			grid.y > bounds.maxY
		) {
			return null
		}
	}

	const poly = getTilePolygon(
		grid.x,
		grid.y,
		0,
		originX,
		originY,
		tileWidth,
		tileHeight,
		heightStep
	)
	if (isPointInPolygon(screenX, screenY, poly)) {
		return { x: grid.x, y: grid.y, z: 0 }
	}

	return null
}

/**
 * Generates an array of tiles centered around (0, 0) for odd grid dimensions.
 * For example, width = 11, height = 11 creates x in [-5, 5], y in [-5, 5].
 */
export function createCenteredGrid({
	width = 11,
	height = 11,
	defaultTileType = 'grass',
	defaultZ = 0
} = {}) {
	if (defaultTileType === 'void' || defaultTileType === 'empty') {
		return []
	}

	const halfW = Math.floor(width / 2)
	const halfH = Math.floor(height / 2)
	const tiles = []

	for (let y = -halfH; y <= halfH; y++) {
		for (let x = -halfW; x <= halfW; x++) {
			tiles.push({
				x,
				y,
				z: defaultZ,
				type: defaultTileType,
				walkable: true
			})
		}
	}
	return tiles
}

/**
 * Converts percentage offset relative to parent (-100%..+100%) to sub-tile offsets.
 */
export function percentToSubTile(percentX = 0, percentY = 0, radiusX = 32, radiusY = 16) {
	return {
		offsetX: Math.round((percentX * radiusX) / 100),
		offsetY: Math.round((percentY * radiusY) / 100)
	}
}

/**
 * Converts sub-tile offsets to percentage relative to parent (-100%..+100%).
 */
export function subTileToPercent(offsetX = 0, offsetY = 0, radiusX = 32, radiusY = 16) {
	return {
		percentX: Math.round((offsetX / radiusX) * 100),
		percentY: Math.round((offsetY / radiusY) * 100)
	}
}

/**
 * Generates relative grid coordinate offsets { dx, dy } for a brush of given size and shape.
 *
 * @param {number} [size=1] - Brush diameter from 1 to 11 (1 = 1x1, 3 = 3x3, etc.)
 * @param {'square'|'round'} [shape='square'] - Brush shape ('square' or 'round')
 * @returns {Array<{dx: number, dy: number}>}
 */
export function getBrushOffsets(size = 1, shape = 'square') {
	const clampedSize = Math.max(1, Math.min(11, Math.round(size)))
	if (clampedSize === 1) {
		return [{ dx: 0, dy: 0 }]
	}

	const isEven = clampedSize % 2 === 0
	const half = Math.floor(clampedSize / 2)
	const minDx = isEven ? -half + 1 : -half
	const maxDx = half
	const minDy = isEven ? -half + 1 : -half
	const maxDy = half

	const cOffset = isEven ? 0.5 : 0
	const maxDist = clampedSize / 2 - 0.1

	const offsets = []
	for (let dy = minDy; dy <= maxDy; dy++) {
		for (let dx = minDx; dx <= maxDx; dx++) {
			if (shape === 'round') {
				const dist = Math.hypot(dx - cOffset, dy - cOffset)
				if (dist > maxDist) continue
			}
			offsets.push({ dx, dy })
		}
	}
	return offsets
}

/**
 * Resolves all absolute grid cell coordinates { x, y } under a brush centered at (centerX, centerY).
 *
 * @param {number} centerX
 * @param {number} centerY
 * @param {number} [size=1]
 * @param {'square'|'round'} [shape='square']
 * @param {{minX: number, maxX: number, minY: number, maxY: number}|null} [bounds=null]
 * @returns {Array<{x: number, y: number}>}
 */
export function getBrushGridCells(centerX, centerY, size = 1, shape = 'square', bounds = null) {
	const offsets = getBrushOffsets(size, shape)
	const cells = []
	for (const { dx, dy } of offsets) {
		const gx = centerX + dx
		const gy = centerY + dy
		if (bounds) {
			if (gx < bounds.minX || gx > bounds.maxX || gy < bounds.minY || gy > bounds.maxY) {
				continue
			}
		}
		cells.push({ x: gx, y: gy })
	}
	return cells
}

/**
 * Calculates world-space bounding extremes (minWX, maxWX, minWY, maxWY) for isometric tiles and optional map bounds.
 * World coordinates correspond to screen position at zoom = 1, camera = (0, 0).
 *
 * @param {Array<{x: number, y: number, z?: number}>} tiles
 * @param {{minX: number, maxX: number, minY: number, maxY: number}|null} [mapBounds=null]
 * @param {number} [tileWidth=DEFAULT_TILE_WIDTH]
 * @param {number} [tileHeight=DEFAULT_TILE_HEIGHT]
 * @param {number} [heightStep=DEFAULT_HEIGHT_STEP]
 * @returns {{minWX: number, maxWX: number, minWY: number, maxWY: number}}
 */
export function getIsoWorldExtremes(
	tiles = [],
	mapBounds = null,
	tileWidth = DEFAULT_TILE_WIDTH,
	tileHeight = DEFAULT_TILE_HEIGHT,
	heightStep = DEFAULT_HEIGHT_STEP
) {
	const halfW = tileWidth / 2
	const halfH = tileHeight / 2

	let minWX = Infinity
	let maxWX = -Infinity
	let minWY = Infinity
	let maxWY = -Infinity

	function includePoint(gx, gy, gz = 0) {
		const wx = (gx - gy) * halfW
		const wy = (gx + gy) * halfH - gz * heightStep
		if (wx < minWX) minWX = wx
		if (wx > maxWX) maxWX = wx
		if (wy < minWY) minWY = wy
		if (wy > maxWY) maxWY = wy
	}

	if (Array.isArray(tiles) && tiles.length > 0) {
		for (const t of tiles) {
			includePoint(t.x, t.y, t.z || 0)
		}
	}

	if (mapBounds) {
		includePoint(mapBounds.minX, mapBounds.minY, 0)
		includePoint(mapBounds.maxX, mapBounds.minY, 0)
		includePoint(mapBounds.minX, mapBounds.maxY, 0)
		includePoint(mapBounds.maxX, mapBounds.maxY, 0)
	}

	if (!isFinite(minWX)) {
		includePoint(0, 0, 0)
	}

	return { minWX, maxWX, minWY, maxWY }
}

/**
 * Calculates camera position bounds { minCameraX, maxCameraX, minCameraY, maxCameraY }
 * such that any outermost tile can reach the center of the screen (viewportWidth / 2, viewportHeight / 2),
 * but cannot move beyond it (leaving at most half the screen empty), accounting for zoom.
 *
 * Formula:
 * screenX = worldX * zoom + camera.x
 * When rightmost tile (maxWX) is at screen center cx: cx = maxWX * zoom + camera.x => minCameraX = cx - maxWX * zoom
 * When leftmost tile (minWX) is at screen center cx:  cx = minWX * zoom + camera.x => maxCameraX = cx - minWX * zoom
 * When bottommost tile (maxWY) is at screen center cy: cy = maxWY * zoom + camera.y => minCameraY = cy - maxWY * zoom
 * When topmost tile (minWY) is at screen center cy:    cy = minWY * zoom + camera.y => maxCameraY = cy - minWY * zoom
 *
 * @param {{minWX: number, maxWX: number, minWY: number, maxWY: number}} worldExtremes
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @param {number} [zoom=1]
 * @returns {{minCameraX: number, maxCameraX: number, minCameraY: number, maxCameraY: number}}
 */
export function calculateCameraClamping(worldExtremes, viewportWidth, viewportHeight, zoom = 1) {
	const cx = viewportWidth / 2
	const cy = viewportHeight / 2
	const z = zoom

	const minCameraX = cx - worldExtremes.maxWX * z
	const maxCameraX = cx - worldExtremes.minWX * z
	const minCameraY = cy - worldExtremes.maxWY * z
	const maxCameraY = cy - worldExtremes.minWY * z

	return {
		minCameraX,
		maxCameraX,
		minCameraY,
		maxCameraY
	}
}

/**
 * Calculates new map bounds after applying directional deltas to each side.
 * Coordinates of (0, 0) and existing tiles remain unaffected (World Origin is preserved).
 *
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} currentBounds
 * @param {{north?: number, south?: number, west?: number, east?: number}} deltas
 *   - north: positive expands North (decreases minY), negative shrinks
 *   - south: positive expands South (increases maxY), negative shrinks
 *   - west: positive expands West (decreases minX), negative shrinks
 *   - east: positive expands East (increases maxX), negative shrinks
 * @returns {{minX: number, maxX: number, minY: number, maxY: number, gridWidth: number, gridHeight: number}}
 */
export function calculateDirectionalBounds(currentBounds, deltas = {}) {
	const minX = currentBounds.minX - (deltas.west || 0)
	const maxX = currentBounds.maxX + (deltas.east || 0)
	const minY = currentBounds.minY - (deltas.north || 0)
	const maxY = currentBounds.maxY + (deltas.south || 0)

	const safeMinX = Math.min(minX, maxX)
	const safeMaxX = Math.max(minX, maxX)
	const safeMinY = Math.min(minY, maxY)
	const safeMaxY = Math.max(minY, maxY)

	return {
		minX: safeMinX,
		maxX: safeMaxX,
		minY: safeMinY,
		maxY: safeMaxY,
		gridWidth: safeMaxX - safeMinX + 1,
		gridHeight: safeMaxY - safeMinY + 1
	}
}

/**
 * Calculates new map bounds given target grid dimensions and an anchor position (3x3).
 *
 * Anchor options:
 * - 'top-left': fixes top and left boundaries (minX, minY), expands rightward and downward.
 * - 'top': fixes top boundary (minY), expands downward and evenly distributes deltaW horizontally.
 * - 'top-right': fixes top and right boundaries (maxX, minY), expands leftward and downward.
 * - 'left': fixes left boundary (minX), expands rightward and evenly distributes deltaH vertically.
 * - 'center': expands/shrinks symmetrically around existing boundaries.
 * - 'right': fixes right boundary (maxX), expands leftward and evenly distributes deltaH vertically.
 * - 'bottom-left': fixes bottom and left boundaries (minX, maxY), expands rightward and upward.
 * - 'bottom': fixes bottom boundary (maxY), expands upward and evenly distributes deltaW horizontally.
 * - 'bottom-right': fixes bottom and right boundaries (maxX, maxY), expands leftward and upward.
 *
 * @param {{minX: number, maxX: number, minY: number, maxY: number}} currentBounds
 * @param {number} targetWidth
 * @param {number} targetHeight
 * @param {string} [anchor='center']
 * @returns {{minX: number, maxX: number, minY: number, maxY: number, gridWidth: number, gridHeight: number}}
 */
export function calculateAnchorBounds(currentBounds, targetWidth, targetHeight, anchor = 'center') {
	const currentW = currentBounds.maxX - currentBounds.minX + 1
	const currentH = currentBounds.maxY - currentBounds.minY + 1
	const deltaW = targetWidth - currentW
	const deltaH = targetHeight - currentH

	let minX = currentBounds.minX
	let maxX = currentBounds.maxX
	let minY = currentBounds.minY
	let maxY = currentBounds.maxY

	// Horizontal distribution
	if (anchor === 'top-left' || anchor === 'left' || anchor === 'bottom-left') {
		maxX = minX + targetWidth - 1
	} else if (anchor === 'top-right' || anchor === 'right' || anchor === 'bottom-right') {
		minX = maxX - targetWidth + 1
	} else {
		const leftDelta = Math.floor(deltaW / 2)
		const rightDelta = deltaW - leftDelta
		minX = currentBounds.minX - leftDelta
		maxX = currentBounds.maxX + rightDelta
	}

	// Vertical distribution
	if (anchor === 'top-left' || anchor === 'top' || anchor === 'top-right') {
		maxY = minY + targetHeight - 1
	} else if (anchor === 'bottom-left' || anchor === 'bottom' || anchor === 'bottom-right') {
		minY = maxY - targetHeight + 1
	} else {
		const topDelta = Math.floor(deltaH / 2)
		const bottomDelta = deltaH - topDelta
		minY = currentBounds.minY - topDelta
		maxY = currentBounds.maxY + bottomDelta
	}

	return {
		minX,
		maxX,
		minY,
		maxY,
		gridWidth: maxX - minX + 1,
		gridHeight: maxY - minY + 1
	}
}



