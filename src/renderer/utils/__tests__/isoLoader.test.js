import { describe, it, expect } from 'vitest'
import {
	getTileDef,
	getObjectDef,
	normalizeLocationData,
	normalizeContainedObjects,
	parseLootString,
	formatLootString,
	unpackRleTerrain,
	packRleTerrain,
	compactObjectForExport,
	compactContainedObjectsForExport
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
			expect(wallDef.edge).toBe('N')

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
			expect(wallTile.walls.N).toBeDefined()
			expect(wallTile.walls.N.solid).toBe(true)

			// Check door attachment to tile
			const doorTile = normalized.tiles.find((t) => t.x === 0 && t.y === 0)
			expect(doorTile.walls.N).toBeDefined()
			expect(doorTile.walls.N.door).toBe(true)
			expect(doorTile.walls.N.open).toBe(false)

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

		it('normalizes hybrid format with terrain RLE, overrides, pos, and loot', () => {
			const hybridLocation = {
				id: 'hybrid_garden',
				name: 'Гибридный сад',
				bounds: { minX: 0, maxX: 2, minY: 0, maxY: 1 }, // 3x2 = 6 cells
				defaultSpawn: { x: 1, y: 0, z: 0, facing: 'SE' },
				terrain: {
					palette: [
						'empty',
						'grass',
						{ type: 'stone_terrace', z: 1 }
					],
					rle: '1:4, 2:2' // 4 grass tiles (z=0), 2 stone_terrace tiles (z=1)
				},
				overrides: {
					'1,0': {
						walls: {
							NE: { type: 'door', door: true, open: false, solid: true }
						}
					}
				},
				objects: [
					{
						id: 'chest_1',
						type: 'chest',
						pos: [0, 0, 0],
						loot: 'gold:50, ruby:2'
					},
					{
						id: 'table_1',
						type: 'table',
						pos: [2, 1, 1],
						children: [
							{
								id: 'plate_1',
								type: 'plate',
								pos: [0, 0, 10],
								children: [{ type: 'weed', name: 'Салат' }]
							}
						]
					}
				]
			}

			const normalized = normalizeLocationData(hybridLocation)
			expect(normalized.id).toBe('hybrid_garden')
			expect(normalized.tiles.length).toBe(6)

			// Check first row
			const t00 = normalized.tiles.find((t) => t.x === 0 && t.y === 0)
			expect(t00.type).toBe('grass')
			expect(t00.z).toBe(0)

			// Check override on 1,0
			const t10 = normalized.tiles.find((t) => t.x === 1 && t.y === 0)
			expect(t10.walls.NE).toBeDefined()
			expect(t10.walls.NE.door).toBe(true)

			// Check elevated tile from palette on 2,1
			const t21 = normalized.tiles.find((t) => t.x === 2 && t.y === 1)
			expect(t21.type).toBe('stone_terrace')
			expect(t21.z).toBe(1)

			// Check objects and loot
			expect(normalized.objects.length).toBe(2)
			const chest = normalized.objects.find((o) => o.id === 'chest_1')
			expect(chest.x).toBe(0)
			expect(chest.y).toBe(0)
			expect(chest.z).toBe(0)
			expect(chest.loot).toEqual([
				{ id: 'gold', count: 50 },
				{ id: 'ruby', count: 2 }
			])

			// Check nested children on table
			const table = normalized.objects.find((o) => o.id === 'table_1')
			expect(table.z).toBe(1)
			expect(table.children.length).toBe(1)
			expect(table.children[0].type).toBe('plate')
			expect(table.children[0].offsetZ).toBe(10)
			expect(table.children[0].children.length).toBe(1)
			expect(table.children[0].children[0].name).toBe('Салат')
		})

		it('preserves exits configuration in normalized location data', () => {
			const rawWithExits = {
				id: 'garden_with_exit',
				gridWidth: 3,
				gridHeight: 3,
				terrain: {
					palette: ['grass'],
					rle: '0:9'
				},
				exits: [
					{
						id: 'exit_house',
						label: 'Вернуться в дом старосты',
						trigger: { x: 0, y: -5, z: 0 },
						targetType: 'scene',
						target: 'carne_chief_house'
					}
				]
			}

			const normalized = normalizeLocationData(rawWithExits)
			expect(normalized.exits).toBeDefined()
			expect(normalized.exits.length).toBe(1)
			expect(normalized.exits[0].id).toBe('exit_house')
			expect(normalized.exits[0].trigger).toEqual({ x: 0, y: -5, z: 0 })
			expect(normalized.exits[0].target).toBe('carne_chief_house')
		})
	})

	describe('loot string helpers', () => {
		it('parses formatted loot string into structured array', () => {
			expect(parseLootString('')).toEqual([])
			expect(parseLootString(null)).toEqual([])
			expect(parseLootString('gold:25')).toEqual([{ id: 'gold', count: 25 }])
			expect(parseLootString('gold:25, amulet_ancient:1; ruby:5, key')).toEqual([
				{ id: 'gold', count: 25 },
				{ id: 'amulet_ancient', count: 1 },
				{ id: 'ruby', count: 5 },
				{ id: 'key', count: 1 }
			])
		})

		it('formats loot array into compact string', () => {
			expect(formatLootString([])).toBe('')
			expect(
				formatLootString([
					{ id: 'gold', count: 100 },
					{ id: 'silver', count: 5 }
				])
			).toBe('gold:100, silver:5')
		})
	})

	describe('unpackRleTerrain', () => {
		it('unpacks simple RLE string with palette indices and skips void cells', () => {
			const bounds = { minX: 0, maxX: 2, minY: 0, maxY: 1 } // 6 cells
			const terrain = {
				palette: ['empty', 'grass', 'soil'],
				rle: '0:2, 1:2, 2:2'
			}

			const tiles = unpackRleTerrain(bounds, terrain)
			// 2 empty cells are skipped, 2 grass and 2 soil remain
			expect(tiles.length).toBe(4)
			expect(tiles[0].x).toBe(2)
			expect(tiles[0].y).toBe(0)
			expect(tiles[0].type).toBe('grass')

			expect(tiles[2].x).toBe(1)
			expect(tiles[2].y).toBe(1)
			expect(tiles[2].type).toBe('soil')
		})

		it('supports palette items with custom elevations Z and extra properties', () => {
			const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 } // 2 cells
			const terrain = {
				palette: [
					'empty',
					{ type: 'stone_terrace', z: 2, walkable: true }
				],
				rle: '1:2'
			}

			const tiles = unpackRleTerrain(bounds, terrain)
			expect(tiles.length).toBe(2)
			expect(tiles[0].z).toBe(2)
			expect(tiles[0].type).toBe('stone_terrace')
			expect(tiles[1].z).toBe(2)
		})

		it('applies overrides for walls and custom properties', () => {
			const bounds = { minX: 0, maxX: 1, minY: 0, maxY: 0 }
			const terrain = {
				palette: ['empty', 'grass'],
				rle: '1:2'
			}
			const overrides = {
				'1,0': {
					walls: { NW: { type: 'wall', solid: true } },
					walkable: false
				}
			}

			const tiles = unpackRleTerrain(bounds, terrain, overrides)
			expect(tiles.length).toBe(2)
			expect(tiles[1].walkable).toBe(false)
			expect(tiles[1].walls.NW).toBeDefined()
			expect(tiles[1].walls.NW.solid).toBe(true)
		})
	})

	describe('packRleTerrain and Round-Trip', () => {
		it('packs tiles array into palette, rle and overrides', () => {
			const bounds = { minX: 0, maxX: 2, minY: 0, maxY: 1 } // 6 cells
			const tiles = [
				{ x: 0, y: 0, z: 0, type: 'grass' },
				{ x: 1, y: 0, z: 0, type: 'grass' },
				{ x: 2, y: 0, z: 0, type: 'grass' },
				{ x: 0, y: 1, z: 1, type: 'stone_terrace' },
				{ x: 1, y: 1, z: 1, type: 'stone_terrace' },
				{ x: 2, y: 1, z: 1, type: 'stone_terrace', walls: { NE: { type: 'door', solid: true } } }
			]

			const packed = packRleTerrain(bounds, tiles)
			expect(packed.terrain.palette).toBeDefined()
			expect(packed.terrain.rle).toContain('1:3') // 3 grass
			expect(packed.overrides['2,1']).toBeDefined()
			expect(packed.overrides['2,1'].walls.NE).toBeDefined()
		})

		it('performs loss-less round-trip packing and unpacking', () => {
			const bounds = { minX: -1, maxX: 1, minY: -1, maxY: 1 } // 3x3 = 9 cells
			const originalTiles = [
				{ x: -1, y: -1, z: 0, type: 'grass', walkable: true },
				{ x: 0, y: -1, z: 0, type: 'grass', walkable: true },
				{ x: 1, y: -1, z: 0, type: 'grass', walkable: true },
				{ x: -1, y: 0, z: 0, type: 'soil', walkable: true },
				{ x: 0, y: 0, z: 0, type: 'soil', walkable: true },
				{ x: 1, y: 0, z: 0, type: 'soil', walkable: true },
				{ x: -1, y: 1, z: 2, type: 'stone_wall', walkable: false },
				{ x: 0, y: 1, z: 2, type: 'stone_wall', walkable: false },
				{ x: 1, y: 1, z: 2, type: 'stone_wall', walkable: false, walls: { SW: { type: 'wall', solid: true } } }
			]

			const packed = packRleTerrain(bounds, originalTiles)
			const unpackedTiles = unpackRleTerrain(bounds, packed.terrain, packed.overrides)

			expect(unpackedTiles.length).toBe(originalTiles.length)
			for (const orig of originalTiles) {
				const match = unpackedTiles.find((t) => t.x === orig.x && t.y === orig.y)
				expect(match).toBeDefined()
				expect(match.type).toBe(orig.type)
				expect(match.z).toBe(orig.z)
				expect(match.walkable).toBe(orig.walkable)
				if (orig.walls) {
					expect(match.walls).toMatchObject(orig.walls)
				}
			}
		})
	})

	describe('compactObjectForExport', () => {
		it('strips redundant properties matching catalog and condenses coordinates to pos array', () => {
			const obj = {
				id: 'well_carne',
				type: 'well',
				name: 'Колодец (2×2)', // matches catalog def name
				icon: '⛲', // matches catalog def icon
				solid: true, // matches catalog def solid
				interactive: true, // matches catalog def interactive
				x: 8,
				y: 4,
				z: 1,
				size: [2, 2], // matches catalog size
				loot: [{ id: 'water_flask', count: 3 }]
			}

			const compact = compactObjectForExport(obj)
			expect(compact.id).toBe('well_carne')
			expect(compact.type).toBe('well')
			expect(compact.pos).toEqual([8, 4, 1])
			expect(compact.loot).toBe('water_flask:3')
			// Redundant catalog fields stripped
			expect(compact.name).toBeUndefined()
			expect(compact.icon).toBeUndefined()
			expect(compact.solid).toBeUndefined()
			expect(compact.interactive).toBeUndefined()
			expect(compact.size).toBeUndefined()
		})
	})
})
