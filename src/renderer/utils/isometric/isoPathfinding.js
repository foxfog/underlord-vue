import { manhattanDistance } from './isoCoords'

/**
 * Creates a unique string key for a tile at grid coordinate (x, y).
 */
export function tileKey(x, y) {
	return `${x},${y}`
}

/**
 * Builds a fast lookup map for blocked coordinates from solid obstacles.
 */
export function buildObstacleMap(obstacles = []) {
	const map = new Set()
	for (const obs of obstacles) {
		if (obs.solid !== false) {
			const w = obs.size?.[0] || 1
			const h = obs.size?.[1] || 1
			for (let dx = 0; dx < w; dx++) {
				for (let dy = 0; dy < h; dy++) {
					map.add(tileKey(obs.x + dx, obs.y + dy))
				}
			}
		}
	}
	return map
}

/**
 * Builds a fast lookup map of tiles keyed by 'x,y'.
 */
export function buildTileMap(tiles = []) {
	const map = new Map()
	for (const tile of tiles) {
		map.set(tileKey(tile.x, tile.y), tile)
	}
	return map
}

/**
 * Checks if a step between adjacent tiles is blocked by an edge wall or closed door.
 */
export function isStepBlockedByWall(fromTile, toTile) {
	if (!fromTile || !toTile) return false
	const dx = toTile.x - fromTile.x
	const dy = toTile.y - fromTile.y

	const isWallSolid = (wall) => {
		if (!wall) return false
		if (wall.solid === false) return false
		// If it's an open door, allow passing through
		if (wall.door && wall.open === true) return false
		return true
	}

	const fromWalls = fromTile.walls || {}
	const toWalls = toTile.walls || {}

	if (dx === -1 && dy === 0) {
		// Moving W / NW: crosses W of fromTile or E of toTile
		if (isWallSolid(fromWalls.W || fromWalls.NW) || isWallSolid(toWalls.E || toWalls.SE)) return true
	} else if (dx === 0 && dy === -1) {
		// Moving N / NE: crosses N of fromTile or S of toTile
		if (isWallSolid(fromWalls.N || fromWalls.NE) || isWallSolid(toWalls.S || toWalls.SW)) return true
	} else if (dx === 1 && dy === 0) {
		// Moving E / SE: crosses E of fromTile or W of toTile
		if (isWallSolid(fromWalls.E || fromWalls.SE) || isWallSolid(toWalls.W || toWalls.NW)) return true
	} else if (dx === 0 && dy === 1) {
		// Moving S / SW: crosses S of fromTile or N of toTile
		if (isWallSolid(fromWalls.S || fromWalls.SW) || isWallSolid(toWalls.N || toWalls.NE)) return true
	}

	return false
}

/**
 * Checks if a specific tile is traversable from the current tile.
 */
export function isStepTraversable(
	fromTile,
	toTile,
	obstacleMap,
	maxClimbHeight = 1
) {
	if (!toTile) return false
	if (toTile.walkable === false) return false

	const toKey = tileKey(toTile.x, toTile.y)
	if (obstacleMap.has(toKey)) return false

	// Height difference constraint
	const dz = Math.abs((toTile.z || 0) - (fromTile?.z || 0))
	if (dz > maxClimbHeight) return false

	// Wall edge constraints
	if (isStepBlockedByWall(fromTile, toTile)) return false

	return true
}

/**
 * Finds the shortest path between start and target on an isometric grid using A*.
 *
 * @param {Object} options
 * @param {{x: number, y: number, z?: number}} options.start - Starting tile
 * @param {{x: number, y: number}} options.target - Destination tile
 * @param {Array|Map} options.tiles - Grid tiles
 * @param {Array} [options.obstacles] - Solid objects/walls
 * @param {number} [options.maxClimbHeight=1] - Maximum elevation step
 * @returns {Array<{x: number, y: number, z: number}>|null} Array of steps (excluding start) or null if no path
 */
export function findPath({
	start,
	target,
	tiles,
	obstacles = [],
	maxClimbHeight = 1
}) {
	if (!start || !target) return null
	if (start.x === target.x && start.y === target.y) return []

	const tileMap = tiles instanceof Map ? tiles : buildTileMap(tiles)
	const obstacleMap = obstacles instanceof Set ? obstacles : buildObstacleMap(obstacles)

	const startTile = tileMap.get(tileKey(start.x, start.y))
	const targetTile = tileMap.get(tileKey(target.x, target.y))

	if (!startTile || !targetTile) return null
	if (targetTile.walkable === false || obstacleMap.has(tileKey(target.x, target.y))) {
		return null
	}

	const startKey = tileKey(start.x, start.y)
	const targetKey = tileKey(target.x, target.y)

	const openSet = new Set([startKey])
	const cameFrom = new Map()

	const gScore = new Map()
	gScore.set(startKey, 0)

	const fScore = new Map()
	fScore.set(startKey, manhattanDistance(start, target))

	const cardinalDirs = [
		{ x: 1, y: 0 },
		{ x: -1, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: -1 }
	]

	while (openSet.size > 0) {
		// Pick node with lowest fScore
		let currentKey = null
		let lowestF = Infinity

		for (const key of openSet) {
			const score = fScore.get(key) ?? Infinity
			if (score < lowestF) {
				lowestF = score
				currentKey = key
			}
		}

		if (currentKey === targetKey) {
			// Reconstruct path
			const path = []
			let curr = currentKey
			while (cameFrom.has(curr)) {
				const [x, y] = curr.split(',').map(Number)
				const tile = tileMap.get(curr)
				path.unshift({ x, y, z: tile?.z || 0 })
				curr = cameFrom.get(curr)
			}
			return path
		}

		openSet.delete(currentKey)
		const [curX, curY] = currentKey.split(',').map(Number)
		const currentTile = tileMap.get(currentKey)
		const currentG = gScore.get(currentKey) ?? Infinity

		for (const dir of cardinalDirs) {
			const nextX = curX + dir.x
			const nextY = curY + dir.y
			const nextKey = tileKey(nextX, nextY)
			const nextTile = tileMap.get(nextKey)

			if (!isStepTraversable(currentTile, nextTile, obstacleMap, maxClimbHeight)) {
				continue
			}

			const tentativeG = currentG + 1
			const existingG = gScore.get(nextKey) ?? Infinity

			if (tentativeG < existingG) {
				cameFrom.set(nextKey, currentKey)
				gScore.set(nextKey, tentativeG)
				fScore.set(nextKey, tentativeG + manhattanDistance({ x: nextX, y: nextY }, target))

				if (!openSet.has(nextKey)) {
					openSet.add(nextKey)
				}
			}
		}
	}

	return null
}

/**
 * Calculates all tiles reachable within a maximum movement range (Dijkstra / BFS),
 * matching the tactical range highlights in Sword of Convallaria.
 *
 * @param {Object} options
 * @param {{x: number, y: number, z?: number}} options.start
 * @param {Array|Map} options.tiles
 * @param {Array} [options.obstacles]
 * @param {number} [options.maxRange=3]
 * @param {number} [options.maxClimbHeight=1]
 * @returns {Array<{x: number, y: number, z: number, distance: number}>}
 */
export function getReachableTiles({
	start,
	tiles,
	obstacles = [],
	maxRange = 3,
	maxClimbHeight = 1
}) {
	if (!start) return []

	const tileMap = tiles instanceof Map ? tiles : buildTileMap(tiles)
	const obstacleMap = obstacles instanceof Set ? obstacles : buildObstacleMap(obstacles)

	const startKey = tileKey(start.x, start.y)
	const startTile = tileMap.get(startKey)
	if (!startTile) return []

	const distances = new Map()
	distances.set(startKey, 0)

	const queue = [{ x: start.x, y: start.y, dist: 0 }]
	const cardinalDirs = [
		{ x: 1, y: 0 },
		{ x: -1, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: -1 }
	]

	const result = []

	while (queue.length > 0) {
		const curr = queue.shift()
		const currentTile = tileMap.get(tileKey(curr.x, curr.y))

		if (curr.dist > 0) {
			result.push({
				x: curr.x,
				y: curr.y,
				z: currentTile?.z || 0,
				distance: curr.dist
			})
		}

		if (curr.dist >= maxRange) continue

		for (const dir of cardinalDirs) {
			const nx = curr.x + dir.x
			const ny = curr.y + dir.y
			const nextKey = tileKey(nx, ny)
			const nextTile = tileMap.get(nextKey)

			if (!isStepTraversable(currentTile, nextTile, obstacleMap, maxClimbHeight)) {
				continue
			}

			const nextDist = curr.dist + 1
			const prevDist = distances.get(nextKey)

			if (prevDist === undefined || nextDist < prevDist) {
				distances.set(nextKey, nextDist)
				queue.push({ x: nx, y: ny, dist: nextDist })
			}
		}
	}

	return result
}
