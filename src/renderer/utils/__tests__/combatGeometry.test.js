import { describe, it, expect } from 'vitest'
import {
	getManhattanDistance,
	getChebyshevDistance,
	isStraight,
	isDiagonal,
	WEAPON_PROFILES,
	applyWeaponToAbility,
	isTargetInPattern,
	getTargetableTiles,
	getAreaAffectedTiles,
	getAffectedUnits,
	resolveKnockback,
	isIceTile
} from '../combat/combatGeometry.js'

describe('combatGeometry', () => {
	describe('distance and direction helpers', () => {
		it('calculates Manhattan and Chebyshev distances correctly', () => {
			const a = { x: 0, y: 0 }
			const b = { x: 1, y: 1 }
			const c = { x: 2, y: 0 }

			expect(getManhattanDistance(a, b)).toBe(2)
			expect(getChebyshevDistance(a, b)).toBe(1)

			expect(getManhattanDistance(a, c)).toBe(2)
			expect(getChebyshevDistance(a, c)).toBe(2)
		})

		it('identifies straight (orthogonal) lines', () => {
			expect(isStraight(1, 0)).toBe(true)
			expect(isStraight(-2, 0)).toBe(true)
			expect(isStraight(0, 3)).toBe(true)
			expect(isStraight(0, -1)).toBe(true)

			expect(isStraight(1, 1)).toBe(false)
			expect(isStraight(0, 0)).toBe(false)
			expect(isStraight(2, 1)).toBe(false)
		})

		it('identifies diagonal lines', () => {
			expect(isDiagonal(1, 1)).toBe(true)
			expect(isDiagonal(1, -1)).toBe(true)
			expect(isDiagonal(-2, 2)).toBe(true)

			expect(isDiagonal(1, 0)).toBe(false)
			expect(isDiagonal(0, 0)).toBe(false)
			expect(isDiagonal(2, 1)).toBe(false)
		})
	})

	describe('weapon profiles & applyWeaponToAbility', () => {
		it('applies sword profile: adjacent 1 tile (straight + diagonal)', () => {
			const baseAbility = { id: 'attack', name: 'Атака', type: 'damage' }
			const swordAbility = applyWeaponToAbility(baseAbility, 'sword')

			expect(swordAbility.pattern).toBe('adjacent')
			expect(swordAbility.minRange).toBe(1)
			expect(swordAbility.maxRange).toBe(1)
		})

		it('applies spear profile: straight 1-2 tiles', () => {
			const baseAbility = { id: 'attack', name: 'Атака', type: 'damage' }
			const spearAbility = applyWeaponToAbility(baseAbility, 'spear')

			expect(spearAbility.pattern).toBe('straight')
			expect(spearAbility.minRange).toBe(1)
			expect(spearAbility.maxRange).toBe(2)
		})

		it('preserves existing explicit pattern on ability if defined', () => {
			const specialAbility = { id: 'shield_bash', pattern: 'straight', minRange: 1, maxRange: 1 }
			const merged = applyWeaponToAbility(specialAbility, 'sword')

			// Keeps straight from ability
			expect(merged.pattern).toBe('straight')
		})
	})

	describe('isTargetInPattern', () => {
		const attacker = { id: 'mc', x: 2, y: 2 }

		it('sword (adjacent): hits all 8 surrounding cells (straight + diagonal)', () => {
			const sword = { id: 'attack', pattern: 'adjacent', minRange: 1, maxRange: 1 }

			// 4 straight
			expect(isTargetInPattern(attacker, sword, { x: 3, y: 2 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 1, y: 2 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 2, y: 3 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 2, y: 1 })).toBe(true)

			// 4 diagonal
			expect(isTargetInPattern(attacker, sword, { x: 3, y: 3 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 3, y: 1 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 1, y: 3 })).toBe(true)
			expect(isTargetInPattern(attacker, sword, { x: 1, y: 1 })).toBe(true)

			// 2 tiles away: out of range
			expect(isTargetInPattern(attacker, sword, { x: 4, y: 2 })).toBe(false)
			expect(isTargetInPattern(attacker, sword, { x: 4, y: 4 })).toBe(false)
		})

		it('spear (straight 1..2): hits straight up to 2 tiles, rejects diagonals', () => {
			const spear = { id: 'attack', pattern: 'straight', minRange: 1, maxRange: 2 }

			// Straight distance 1 and 2
			expect(isTargetInPattern(attacker, spear, { x: 3, y: 2 })).toBe(true)
			expect(isTargetInPattern(attacker, spear, { x: 4, y: 2 })).toBe(true)
			expect(isTargetInPattern(attacker, spear, { x: 2, y: 0 })).toBe(true)

			// Straight distance 3: out of range
			expect(isTargetInPattern(attacker, spear, { x: 5, y: 2 })).toBe(false)

			// Diagonals: not allowed for spear
			expect(isTargetInPattern(attacker, spear, { x: 3, y: 3 })).toBe(false)
			expect(isTargetInPattern(attacker, spear, { x: 4, y: 4 })).toBe(false)
		})

		it('diagonal pattern: hits only diagonals', () => {
			const diagonalStrike = { id: 'flank', pattern: 'diagonal', minRange: 1, maxRange: 1 }

			expect(isTargetInPattern(attacker, diagonalStrike, { x: 3, y: 3 })).toBe(true)
			expect(isTargetInPattern(attacker, diagonalStrike, { x: 3, y: 2 })).toBe(false)
		})

		it('bow (free 2..4): hits any cell in Manhattan distance 2..4', () => {
			const bow = { id: 'shot', pattern: 'free', minRange: 2, maxRange: 4 }

			// Distance 1: too close (minRange 2)
			expect(isTargetInPattern(attacker, bow, { x: 3, y: 2 })).toBe(false)

			// Distance 2: valid
			expect(isTargetInPattern(attacker, bow, { x: 4, y: 2 })).toBe(true)
			expect(isTargetInPattern(attacker, bow, { x: 3, y: 3 })).toBe(true)

			// Distance 4: valid
			expect(isTargetInPattern(attacker, bow, { x: 6, y: 2 })).toBe(true)

			// Distance 5: too far
			expect(isTargetInPattern(attacker, bow, { x: 7, y: 2 })).toBe(false)
		})

		it('self targetType: only matches attacker self', () => {
			const defend = { id: 'defend', targetType: 'self' }
			expect(isTargetInPattern(attacker, defend, attacker)).toBe(true)
			expect(isTargetInPattern(attacker, defend, { id: 'enemy', x: 2, y: 2 })).toBe(false)
		})
	})

	describe('getTargetableTiles', () => {
		const attacker = { id: 'mc', x: 1, y: 1 }
		const mapTiles = [
			{ x: 0, y: 1 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 },
			{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: 2, y: 2 },
			{ x: 3, y: 1 }, { x: 1, y: 3 }
		]

		it('returns all 8 surrounding tiles for sword', () => {
			const sword = { id: 'attack', pattern: 'adjacent', minRange: 1, maxRange: 1 }
			const tiles = getTargetableTiles(attacker, sword, mapTiles)
			expect(tiles.length).toBe(8)
			expect(tiles.some(t => t.x === 1 && t.y === 1)).toBe(false) // Not self
		})

		it('returns cross tiles up to distance 2 for spear', () => {
			const spear = { id: 'attack', pattern: 'straight', minRange: 1, maxRange: 2 }
			const tiles = getTargetableTiles(attacker, spear, mapTiles)
			// Straight tiles in mapTiles: (0,1), (2,1), (3,1), (1,0), (1,2), (1,3) = 6 tiles
			expect(tiles.length).toBe(6)
			// Diagonals not present
			expect(tiles.some(t => t.x === 0 && t.y === 0)).toBe(false)
			expect(tiles.some(t => t.x === 2 && t.y === 2)).toBe(false)
		})
	})

	describe('getAreaAffectedTiles & getAffectedUnits', () => {
		const attacker = { id: 'mc', team: 'ally', x: 2, y: 2 }
		const mapTiles = [
			{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 },
			{ x: 2, y: 1 }, { x: 2, y: 3 },
			{ x: 3, y: 1 }, { x: 3, y: 3 }
		]

		it('cleave: strikes target and flanking cells in arc', () => {
			const cleaveAbility = { id: 'cleave', pattern: 'cleave', minRange: 1, maxRange: 1 }
			const targetTile = { x: 3, y: 2 } // Straight to the right

			const affected = getAreaAffectedTiles(attacker, cleaveAbility, targetTile, mapTiles)
			const keys = affected.map(t => `${t.x},${t.y}`)

			expect(keys).toContain('3,2') // Primary
			expect(keys).toContain('3,1') // Flank 1
			expect(keys).toContain('3,3') // Flank 2
			expect(keys.length).toBe(3)
		})

		it('aoe_point: hits blast radius around center', () => {
			const fireball = { id: 'fireball', aoeRadius: 1, targetType: 'enemy' }
			const center = { x: 2, y: 2 }

			const affected = getAreaAffectedTiles(attacker, fireball, center, mapTiles)
			expect(affected.length).toBe(5) // (2,2), (1,2), (3,2), (2,1), (2,3)
		})

		it('getAffectedUnits filters units in area by team and alive status', () => {
			const fireball = { id: 'fireball', aoeRadius: 1, targetType: 'enemy' }
			const units = [
				{ id: 'mc', team: 'ally', hp: 30, x: 2, y: 2 },
				{ id: 'bandit1', team: 'enemy', hp: 20, x: 3, y: 2 },
				{ id: 'bandit2', team: 'enemy', hp: 15, x: 2, y: 3 },
				{ id: 'banditDead', team: 'enemy', hp: 0, x: 2, y: 1 },
				{ id: 'banditFar', team: 'enemy', hp: 25, x: 10, y: 10 }
			]

			const hitUnits = getAffectedUnits(attacker, fireball, { x: 2, y: 2 }, units, mapTiles)
			const hitIds = hitUnits.map(u => u.id)

			expect(hitIds).toContain('bandit1')
			expect(hitIds).toContain('bandit2')
			expect(hitIds).not.toContain('banditDead') // Dead
			expect(hitIds).not.toContain('mc') // Ally (targetType is enemy)
			expect(hitIds).not.toContain('banditFar') // Out of AoE
		})
	})

	describe('resolveKnockback', () => {
		const attacker = { id: 'albedo', x: 2, y: 2, facing: 'SE' }
		const ability = { id: 'shield_bash', knockback: 1 }

		it('pushes target along +X when target is east of attacker', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const res = resolveKnockback({ attacker, target, ability })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.chasmFall).toBe(false)
			expect(res.collision).toBeNull()
		})

		it('pushes target along -X when target is west of attacker', () => {
			const target = { id: 'enemy', x: 1, y: 2 }
			const res = resolveKnockback({ attacker, target, ability })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 0, y: 2, z: 0 })
		})

		it('pushes target along +Y when target is south of attacker', () => {
			const target = { id: 'enemy', x: 2, y: 3 }
			const res = resolveKnockback({ attacker, target, ability })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 2, y: 4, z: 0 })
		})

		it('pushes target along -Y when target is north of attacker', () => {
			const target = { id: 'enemy', x: 2, y: 1 }
			const res = resolveKnockback({ attacker, target, ability })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 2, y: 0, z: 0 })
		})

		it('pushes target diagonally when deltaX == deltaY', () => {
			const target = { id: 'enemy', x: 3, y: 3 }
			const res = resolveKnockback({ attacker, target, ability })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 4, z: 0 })
		})

		it('stops and inflicts collision damage when blocked by another unit', () => {
			const target = { id: 'enemy1', x: 3, y: 2 }
			const otherEnemy = { id: 'enemy2', x: 4, y: 2, hp: 20 }
			const res = resolveKnockback({
				attacker,
				target,
				ability,
				allUnits: [attacker, target, otherEnemy],
				strikeDamage: 12
			})

			expect(res.knockbackDistance).toBe(0)
			expect(res.to).toEqual({ x: 3, y: 2, z: 0 }) // did not enter (4,2)
			expect(res.collision).toEqual({
				type: 'unit',
				targetDamage: 6,
				collateralDamage: 6,
				obstacleUnit: otherEnemy
			})
		})

		it('stops and inflicts collision damage when hitting a solid obstacle', () => {
			const target = { id: 'enemy1', x: 3, y: 2 }
			const obstacle = { id: 'fence', x: 4, y: 2, solid: true }
			const res = resolveKnockback({
				attacker,
				target,
				ability,
				mapObjects: [obstacle],
				strikeDamage: 10
			})

			expect(res.knockbackDistance).toBe(0)
			expect(res.to).toEqual({ x: 3, y: 2, z: 0 })
			expect(res.collision).toEqual({
				type: 'obstacle',
				targetDamage: 5,
				obstacleObject: obstacle
			})
		})

		it('triggers chasmFall when knocked off the arena platform (void tile)', () => {
			const target = { id: 'enemy1', x: 3, y: 2 }
			// Map has tiles at (2,2) and (3,2), but void at (4,2)
			const mapTiles = [
				{ x: 2, y: 2, type: 'stone' },
				{ x: 3, y: 2, type: 'stone' }
			]
			const res = resolveKnockback({
				attacker,
				target,
				ability,
				mapTiles
			})

			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.chasmFall).toBe(true)
		})

		it('flying unit hovers safely over chasm without falling', () => {
			const target = { id: 'ainz', x: 3, y: 2, flying: true }
			const mapTiles = [
				{ x: 2, y: 2, type: 'stone' },
				{ x: 3, y: 2, type: 'stone' }
			]
			const res = resolveKnockback({
				attacker,
				target,
				ability,
				mapTiles
			})

			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.chasmFall).toBe(false)
		})

		it('applies lava damage and burning status to grounded unit', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const mapTiles = [
				{ x: 2, y: 2, type: 'stone' },
				{ x: 3, y: 2, type: 'stone' },
				{ x: 4, y: 2, type: 'lava' }
			]
			const res = resolveKnockback({ attacker, target, ability, mapTiles })

			expect(res.hazard).toEqual({
				type: 'lava',
				damage: 6,
				applyStatus: 'burning',
				turns: 2
			})
		})

		it('flying or fireImmune unit ignores lava hazards', () => {
			const flyingTarget = { id: 'flyer', x: 3, y: 2, flying: true }
			const immuneTarget = { id: 'elemental', x: 3, y: 2, fireImmune: true }
			const mapTiles = [
				{ x: 3, y: 2, type: 'stone' },
				{ x: 4, y: 2, type: 'lava' }
			]

			const resFly = resolveKnockback({ attacker, target: flyingTarget, ability, mapTiles })
			expect(resFly.hazard).toBeNull()

			const resImmune = resolveKnockback({ attacker, target: immuneTarget, ability, mapTiles })
			expect(resImmune.hazard).toBeNull()
		})

		it('non-swimmer drowns in water, while swimming unit quenches burning', () => {
			const normalTarget = { id: 'footman', x: 3, y: 2, hp: 30 }
			const swimmerTarget = { id: 'merman', x: 3, y: 2, swimming: true }
			const mapTiles = [
				{ x: 3, y: 2, type: 'stone' },
				{ x: 4, y: 2, type: 'water' }
			]

			const resDrown = resolveKnockback({ attacker, target: normalTarget, ability, mapTiles })
			expect(resDrown.hazard?.drown).toBe(true)

			const resSwim = resolveKnockback({ attacker, target: swimmerTarget, ability, mapTiles })
			expect(resSwim.hazard?.drown).toBe(false)
			expect(resSwim.hazard?.quenchBurning).toBe(true)
		})

		it('блок на 1 выше (+1 Z) считается уступом/лестницей — цель заталкивается на него', () => {
			const target = { id: 'enemy', x: 3, y: 2, z: 0 }
			const mapTiles = [
				{ x: 2, y: 2, z: 0, type: 'stone' },
				{ x: 3, y: 2, z: 0, type: 'stone' },
				{ x: 4, y: 2, z: 1, type: 'stone' } // разница +1
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 1 })
			expect(res.collision).toBeNull()
		})

		it('блок с разницей 2 по высоте (+2 Z) считается скалой/стеной — цель останавливается и получает урон', () => {
			const target = { id: 'enemy', x: 3, y: 2, z: 0 }
			const mapTiles = [
				{ x: 2, y: 2, z: 0, type: 'stone' },
				{ x: 3, y: 2, z: 0, type: 'stone' },
				{ x: 4, y: 2, z: 2, type: 'stone' } // разница +2!
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles, strikeDamage: 12 })
			expect(res.knockbackDistance).toBe(0)
			expect(res.to).toEqual({ x: 3, y: 2, z: 0 }) // остался перед скалой
			expect(res.collision).toEqual({
				type: 'cliff',
				targetDamage: 6,
				obstacleObject: { name: 'уступ скалы (+2)' }
			})
		})

		it('летающий юнит свободно преодолевает уступ любой высоты (+2 Z)', () => {
			const flyer = { id: 'ainz', x: 3, y: 2, z: 0, flying: true }
			const mapTiles = [
				{ x: 3, y: 2, z: 0, type: 'stone' },
				{ x: 4, y: 2, z: 2, type: 'stone' }
			]

			const res = resolveKnockback({ attacker, target: flyer, ability, mapTiles })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 2 })
			expect(res.collision).toBeNull()
		})

		it('граничная стена (edge wall) останавливает отталкивание и наносит урон', () => {
			const target = { id: 'enemy', x: 3, y: 2, z: 0 }
			const mapTiles = [
				{
					x: 3, y: 2, z: 0, type: 'stone',
					walls: { SE: { solid: true } } // стена на стыке в сторону (4,2)
				},
				{ x: 4, y: 2, z: 0, type: 'stone' }
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles, strikeDamage: 10 })
			expect(res.knockbackDistance).toBe(0)
			expect(res.to).toEqual({ x: 3, y: 2, z: 0 })
			expect(res.collision).toEqual({
				type: 'wall',
				targetDamage: 5,
				obstacleObject: { name: 'каменная стена' }
			})
		})

		it('падение с уступа высотой >= 2 наносит урон от падения (fall damage)', () => {
			const target = { id: 'enemy', x: 3, y: 2, z: 2 } // на высоте 2
			const mapTiles = [
				{ x: 2, y: 2, z: 2, type: 'stone' },
				{ x: 3, y: 2, z: 2, type: 'stone' },
				{ x: 4, y: 2, z: 0, type: 'stone' } // уступ вниз: разница -2
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles, strikeDamage: 10 })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.fall).toEqual({
				heightDrop: 2,
				damage: 10 // Math.max(4*2, Math.floor(10*0.5*2)) = 10
			})
		})

		it('летающий юнит не получает урон от падения с уступа (fall damage)', () => {
			const flyer = { id: 'ainz', x: 3, y: 2, z: 2, flying: true }
			const mapTiles = [
				{ x: 3, y: 2, z: 2, type: 'stone' },
				{ x: 4, y: 2, z: 0, type: 'stone' }
			]

			const res = resolveKnockback({ attacker, target: flyer, ability, mapTiles, strikeDamage: 10 })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.fall).toBeNull()
		})

		it('спуск с уступа высотой 1 (+1 Z drop) не наносит урон от падения', () => {
			const target = { id: 'enemy', x: 3, y: 2, z: 1 }
			const mapTiles = [
				{ x: 3, y: 2, z: 1, type: 'stone' },
				{ x: 4, y: 2, z: 0, type: 'stone' }
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles, strikeDamage: 10 })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.fall).toBeNull()
		})

		it('isIceTile определяет лед по type и по id', () => {
			expect(isIceTile({ type: 'ice' })).toBe(true)
			expect(isIceTile({ id: 'ice_tile' })).toBe(true)
			expect(isIceTile({ type: 'stone' })).toBe(false)
			expect(isIceTile(null)).toBe(false)
		})

		it('скольжение по льду: если цель стоит на льду и сзади лёд, отталкивание увеличивается с 1 до 2 клеток', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const mapTiles = [
				{ x: 2, y: 2, type: 'stone' },
				{ x: 3, y: 2, type: 'ice' }, // стоит на льду
				{ x: 4, y: 2, type: 'ice' }, // сзади тоже лёд
				{ x: 5, y: 2, type: 'stone' } // дальше камень
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles })
			expect(res.knockbackDistance).toBe(2)
			expect(res.to).toEqual({ x: 5, y: 2, z: 0 })
			expect(res.iceSlide).toBe(true)
		})

		it('если цель стоит на льду, но сзади не лёд (камень), цель отталкивается только на 1 клетку', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const mapTiles = [
				{ x: 3, y: 2, type: 'ice' },
				{ x: 4, y: 2, type: 'stone' } // не лед!
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.iceSlide).toBe(false)
		})

		it('если цель стоит на камне, а сзади лёд, отталкивание не увеличивается (цель не поскальзывается)', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const mapTiles = [
				{ x: 3, y: 2, type: 'stone' }, // камень
				{ x: 4, y: 2, type: 'ice' }, // лед
				{ x: 5, y: 2, type: 'ice' }
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.iceSlide).toBe(false)
		})

		it('летающий юнит не поскальзывается на льду', () => {
			const flyer = { id: 'ainz', x: 3, y: 2, flying: true }
			const mapTiles = [
				{ x: 3, y: 2, type: 'ice' },
				{ x: 4, y: 2, type: 'ice' },
				{ x: 5, y: 2, type: 'ice' }
			]

			const res = resolveKnockback({ attacker, target: flyer, ability, mapTiles })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.iceSlide).toBe(false)
		})

		it('скольжение по льду во врага/препятствие на 2 шаге вызывает столкновение', () => {
			const target = { id: 'enemy', x: 3, y: 2 }
			const mapTiles = [
				{ x: 3, y: 2, type: 'ice' },
				{ x: 4, y: 2, type: 'ice' },
				{ x: 5, y: 2, type: 'stone' }
			]
			const mapObjects = [
				{ pos: [5, 2], name: 'Каменная стена', solid: true }
			]

			const res = resolveKnockback({ attacker, target, ability, mapTiles, mapObjects, strikeDamage: 10 })
			expect(res.knockbackDistance).toBe(1)
			expect(res.to).toEqual({ x: 4, y: 2, z: 0 })
			expect(res.collision).toEqual({
				type: 'obstacle',
				targetDamage: 5,
				obstacleObject: { pos: [5, 2], name: 'Каменная стена', solid: true }
			})
		})
	})
})
