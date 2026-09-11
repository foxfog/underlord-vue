import { describe, it, expect } from 'vitest'
import {
	findPath,
	getReachableTiles,
	buildObstacleMap,
	buildTileMap,
	isStepTraversable
} from '../isometric/isoPathfinding'

describe('isoPathfinding', () => {
	// Create a simple 5x5 grid
	const tiles = []
	for (let x = 0; x < 5; x++) {
		for (let y = 0; y < 5; y++) {
			tiles.push({ x, y, z: 0, walkable: true })
		}
	}

	it('finds direct straight path on empty flat grid', () => {
		const path = findPath({
			start: { x: 0, y: 0, z: 0 },
			target: { x: 0, y: 3 },
			tiles
		})
		expect(path).not.toBeNull()
		expect(path.length).toBe(3)
		expect(path[2]).toEqual({ x: 0, y: 3, z: 0 })
	})

	it('returns empty array when start equals target', () => {
		const path = findPath({
			start: { x: 2, y: 2, z: 0 },
			target: { x: 2, y: 2 },
			tiles
		})
		expect(path).toEqual([])
	})

	it('navigates around solid obstacles', () => {
		// Wall blocking direct path at (1, 1), (1, 2)
		const obstacles = [
			{ x: 1, y: 0, solid: true },
			{ x: 1, y: 1, solid: true },
			{ x: 1, y: 2, solid: true }
		]
		const path = findPath({
			start: { x: 0, y: 1, z: 0 },
			target: { x: 2, y: 1 },
			tiles,
			obstacles
		})
		expect(path).not.toBeNull()
		// Path should circumvent obstacle by going through (0, 3) or (0, 4)
		for (const step of path) {
			const isBlocked = obstacles.some((o) => o.x === step.x && o.y === step.y)
			expect(isBlocked).toBe(false)
		}
	})

	it('respects elevation limits (maxClimbHeight)', () => {
		const elevationTiles = [
			{ x: 0, y: 0, z: 0 },
			{ x: 1, y: 0, z: 2 } // Height jump of 2 levels (cliff)
		]
		// Cannot jump 2 levels
		const blockedPath = findPath({
			start: { x: 0, y: 0, z: 0 },
			target: { x: 1, y: 0 },
			tiles: elevationTiles,
			maxClimbHeight: 1
		})
		expect(blockedPath).toBeNull()

		// Can climb 1 level
		elevationTiles[1].z = 1
		const allowedPath = findPath({
			start: { x: 0, y: 0, z: 0 },
			target: { x: 1, y: 0 },
			tiles: elevationTiles,
			maxClimbHeight: 1
		})
		expect(allowedPath).not.toBeNull()
		expect(allowedPath.length).toBe(1)
		expect(allowedPath[0]).toEqual({ x: 1, y: 0, z: 1 })
	})

	it('computes reachable tiles within maxRange (Convallaria movement range)', () => {
		const reachable = getReachableTiles({
			start: { x: 2, y: 2, z: 0 },
			tiles,
			maxRange: 1
		})
		// 4 cardinal neighbors
		expect(reachable.length).toBe(4)
		const coords = reachable.map((r) => `${r.x},${r.y}`)
		expect(coords).toContain('3,2')
		expect(coords).toContain('1,2')
		expect(coords).toContain('2,3')
		expect(coords).toContain('2,1')
	})
})
