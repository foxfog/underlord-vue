import { describe, it, expect } from 'vitest'
import {
	getTileDef,
	getObjectDef,
	normalizeLocationData,
	normalizeContainedObjects
} from '../isometric/isoLoader'

describe('isoLoader', () => {
	describe('catalog lookups', () => {
		it('looks up tile by numeric string id or key from tiles.json', () => {
			const slabDef = getTileDef('1')
			expect(slabDef).toBeDefined()
			expect(slabDef.id).toBe('slab')
			expect(slabDef.image.url).toContain('slab.png')

			const grassDef = getTileDef('grass')
			expect(grassDef).toBeDefined()
			expect(grassDef.id).toBe('grass')
		})

		it('looks up object by id from objects.json', () => {
			const wallDef = getObjectDef('wall-e')
			expect(wallDef).toBeDefined()
			expect(wallDef.type).toBe('wall')
			expect(wallDef.edge).toBe('NE')

			const doorDef = getObjectDef('door-e')
			expect(doorDef).toBeDefined()
			expect(doorDef.type).toBe('door')
			expect(doorDef.image.urlOpen).toContain('door-e-open.png')
		})
	})

	describe('normalizeContainedObjects', () => {
		it('recursively normalizes nested containedObjects', () => {
			const rawContained = [
				{
					id: 'sofa-1',
					pos: [10, -5],
					containedObjects: [
						{
							id: 'plate-1',
							containedObjects: [{ id: 'vase-1' }]
						}
					]
				}
			]

			const normalized = normalizeContainedObjects(rawContained)
			expect(normalized.length).toBe(1)
			expect(normalized[0].name).toBe('Диван')
			expect(normalized[0].offsetX).toBe(10)
			expect(normalized[0].offsetY).toBe(-5)
			expect(normalized[0].children.length).toBe(1)
			expect(normalized[0].children[0].name).toBe('Тарелка')
			expect(normalized[0].children[0].children[0].name).toBe('Ваза')
		})
	})

	describe('normalizeLocationData', () => {
		it('normalizes prototype format with levels, floor 2D array, and cord', () => {
			const prototypeLocation = {
				id: 'test-apartment',
				name: 'Test Apartment',
				dimensions: { width: 3, height: 3 },
				levels: {
					'level-1': {
						floor: [
							[
								{ id: 1, cord: [-1, -1] },
								{ id: 3, cord: [0, -1] }
							],
							[
								{ id: 1, cord: [-1, 0] },
								{ id: 2, cord: [0, 0] }
							]
						],
						objects: [
							{
								id: 'wall-3',
								cord: [0, -1]
							},
							{
								id: 'door-e',
								cord: [0, 0],
								status: 'close'
							},
							{
								id: 'table',
								cord: [-1, 0],
								pos: [5, 5]
							}
						]
					}
				},
				characters: [
					{ id: 'mc', cord: [0, 0] },
					{ id: 'momonga', cord: [-1, -1] }
				]
			}

			const normalized = normalizeLocationData(prototypeLocation)
			expect(normalized.id).toBe('test-apartment')
			expect(normalized.tiles.length).toBe(4)

			// Check first tile
			const t0 = normalized.tiles.find((t) => t.x === -1 && t.y === -1)
			expect(t0).toBeDefined()
			expect(t0.type).toBe('slab')

			// Check wall attachment to tile
			const wallTile = normalized.tiles.find((t) => t.x === 0 && t.y === -1)
			expect(wallTile.walls.NE).toBeDefined()
			expect(wallTile.walls.NE.solid).toBe(true)

			// Check door attachment to tile
			const doorTile = normalized.tiles.find((t) => t.x === 0 && t.y === 0)
			expect(doorTile.walls.NE).toBeDefined()
			expect(doorTile.walls.NE.door).toBe(true)
			expect(doorTile.walls.NE.open).toBe(false)

			// Check furniture object
			expect(normalized.objects.length).toBe(1)
			expect(normalized.objects[0].id).toBe('table')
			expect(normalized.objects[0].offsetX).toBe(5)

			// Check characters
			expect(normalized.characters.length).toBe(2)
			expect(normalized.characters[0].id).toBe('mc')
			expect(normalized.characters[0].x).toBe(0)
			expect(normalized.characters[0].y).toBe(0)
			expect(normalized.characters[1].id).toBe('momonga')
			expect(normalized.characters[1].x).toBe(-1)
		})

		it('normalizes flat format directly and enriches with catalog metadata', () => {
			const flatLocation = {
				id: 'flat_loc',
				tiles: [
					{ x: 0, y: 0, z: 1, type: 'grass' }
				],
				objects: [
					{ id: 'weed_1', type: 'weed', x: 0, y: 0 }
				]
			}

			const normalized = normalizeLocationData(flatLocation)
			expect(normalized.tiles.length).toBe(1)
			expect(normalized.tiles[0].walkable).toBe(true)
			expect(normalized.objects.length).toBe(1)
			expect(normalized.objects[0].icon).toBe('🌿')
		})
	})
})
