/**
 * combatGeometry.js
 * 
 * Модуль геометрических расчётов, шаблонов направлений атак и профилей оружия
 * для пошаговой изометрической боевой системы.
 */

import { isStepBlockedByWall } from '../isometric/isoPathfinding.js'

/**
 * Манхэттенское расстояние: |dx| + |dy|
 */
export function getManhattanDistance(a, b) {
	if (!a || !b) return 0
	return Math.abs((a.x ?? 0) - (b.x ?? 0)) + Math.abs((a.y ?? 0) - (b.y ?? 0))
}

/**
 * Расстояние Чебышёва: max(|dx|, |dy|)
 * Позволяет измерять расстояние с учетом диагональных шагов (все 8 соседних клеток имеют расстояние 1).
 */
export function getChebyshevDistance(a, b) {
	if (!a || !b) return 0
	return Math.max(Math.abs((a.x ?? 0) - (b.x ?? 0)), Math.abs((a.y ?? 0) - (b.y ?? 0)))
}

/**
 * Проверка: находится ли клетка строго по прямым (ортогональным) линиям сетки
 */
export function isStraight(dx, dy) {
	return (dx === 0 && dy !== 0) || (dy === 0 && dx !== 0)
}

/**
 * Проверка: находится ли клетка строго по диагональным линиям сетки (|dx| === |dy|)
 */
export function isDiagonal(dx, dy) {
	return Math.abs(dx) === Math.abs(dy) && dx !== 0
}

/**
 * Профили оружия для базовых атак
 */
export const WEAPON_PROFILES = {
	sword: {
		id: 'sword',
		name: 'Меч',
		icon: '⚔️',
		pattern: 'adjacent',
		minRange: 1,
		maxRange: 1,
		power: 1.0,
		description: 'Удар мечом во все 8 сторон (прямые и диагонали)'
	},
	spear: {
		id: 'spear',
		name: 'Копьё',
		icon: '🔱',
		pattern: 'straight',
		minRange: 1,
		maxRange: 2,
		power: 1.0,
		description: 'Выпад копьём на 1-2 клетки строго по прямым линиям'
	},
	dagger: {
		id: 'dagger',
		name: 'Кинжал',
		icon: '🗡️',
		pattern: 'adjacent',
		minRange: 1,
		maxRange: 1,
		power: 0.9,
		backstabBonus: 1.5,
		description: 'Быстрый удар кинжалом на 1 клетку с бонусом за удар со спины'
	},
	greatsword: {
		id: 'greatsword',
		name: 'Двуручный меч',
		icon: '🪓',
		pattern: 'cleave',
		minRange: 1,
		maxRange: 1,
		power: 1.2,
		description: 'Размашистый круговой взмах, задевающий цель и соседние клетки'
	},
	bow: {
		id: 'bow',
		name: 'Лук',
		icon: '🏹',
		pattern: 'free',
		minRange: 2,
		maxRange: 4,
		power: 1.0,
		description: 'Выстрел из лука на 2-4 клетки по навесной траектории'
	},
	staff: {
		id: 'staff',
		name: 'Посох',
		icon: '🔮',
		pattern: 'free',
		minRange: 1,
		maxRange: 3,
		power: 1.0,
		description: 'Магический сгусток энергии на 1-3 клетки в любую сторону'
	}
}

/**
 * Применяет параметры оружия к способности (если это базовая атака или явная привязка)
 */
export function applyWeaponToAbility(ability, weaponIdOrProfile) {
	if (!ability || !weaponIdOrProfile) return ability

	const profile = typeof weaponIdOrProfile === 'string'
		? WEAPON_PROFILES[weaponIdOrProfile]
		: weaponIdOrProfile

	if (!profile) return ability

	const copy = { ...ability }
	// Если способность не имеет своего жесткого паттерна — перенимаем у оружия
	copy.pattern = ability.pattern || profile.pattern
	copy.minRange = ability.minRange ?? profile.minRange
	copy.maxRange = ability.maxRange ?? profile.maxRange
	if (profile.aoeRadius !== undefined && copy.aoeRadius === undefined) {
		copy.aoeRadius = profile.aoeRadius
	}
	if (!copy.weaponName) {
		copy.weaponName = profile.name
	}
	if (profile.icon && (!copy.icon || copy.icon === '⚔️')) {
		copy.icon = profile.icon
	}
	return copy
}

/**
 * Проверяет, находится ли целевая координата/юнит в зоне досягаемости способности
 * с учётом геометрического шаблона (pattern).
 * 
 * Поддерживаемые паттерны:
 * - 'adjacent': все 8 соседних клеток (Chebyshev dist 1) — меч, кинжал, кулаки
 * - 'straight' / 'line': только по прямым линиям (spear, shield charge, ray)
 * - 'diagonal': только по диагоналям (|dx| === |dy|)
 * - 'cleave': взмах перед собой (цель на расстоянии 1, поражает цель + фланги)
 * - 'line_pierce': пробитие по прямой линии до maxRange
 * - 'free' / 'circle' / 'aoe_point': свободный выбор в пределах Manhattan distance
 */
export function isTargetInPattern(attacker, ability, target) {
	if (!attacker || !target) return false

	if (ability.targetType === 'self') {
		if (target.id !== undefined) return attacker.id === target.id
		return attacker.x === target.x && attacker.y === target.y
	}

	// Нельзя атаковать самого себя способностями не на себя
	if (target.id !== undefined && attacker.id !== undefined && target.id === attacker.id) {
		return false
	}

	if (attacker.x === undefined && target.x === undefined) return true
	if (attacker.x === undefined || target.x === undefined) return false

	const dx = target.x - attacker.x
	const dy = target.y - attacker.y

	// Если цель — сам атакующий при не-self способности
	if (dx === 0 && dy === 0) {
		return (ability.minRange ?? 1) === 0
	}

	const pattern = ability.pattern || 'free'
	const minRange = ability.minRange ?? 1
	const maxRange = ability.maxRange ?? 1

	switch (pattern) {
		case 'adjacent': {
			const cheb = Math.max(Math.abs(dx), Math.abs(dy))
			return cheb >= minRange && cheb <= maxRange
		}
		case 'straight':
		case 'line':
		case 'line_pierce': {
			if (!isStraight(dx, dy)) return false
			const dist = Math.abs(dx) + Math.abs(dy)
			return dist >= minRange && dist <= maxRange
		}
		case 'diagonal': {
			if (!isDiagonal(dx, dy)) return false
			const dist = Math.abs(dx)
			return dist >= minRange && dist <= maxRange
		}
		case 'cleave': {
			const cheb = Math.max(Math.abs(dx), Math.abs(dy))
			return cheb >= minRange && cheb <= maxRange
		}
		case 'free':
		case 'circle':
		case 'aoe_point':
		default: {
			const dist = Math.abs(dx) + Math.abs(dy)
			return dist >= minRange && dist <= maxRange
		}
	}
}

/**
 * Возвращает массив клеток карты, которые атакующий может выбрать текущей способностью
 */
export function getTargetableTiles(attacker, ability, mapTiles = []) {
	if (!attacker || !ability) return []

	if (ability.targetType === 'self') {
		return [{ x: attacker.x, y: attacker.y, z: attacker.z ?? 0, type: 'self' }]
	}

	const result = []
	for (const t of mapTiles) {
		if (isTargetInPattern(attacker, ability, t)) {
			result.push({
				x: t.x,
				y: t.y,
				z: t.z ?? 0,
				type: ability.targetType || 'enemy'
			})
		}
	}
	return result
}

/**
 * Вычисляет все клетки карты, которые будут задеты способностью при атаке по targetTile.
 * Для одиночной цели возвращает [targetTile].
 * Для AoE / Cleave / Line_Pierce возвращает массив всех поражаемых клеток.
 */
export function getAreaAffectedTiles(attacker, ability, targetTile, mapTiles = []) {
	if (!targetTile) return []

	const pattern = ability?.pattern || 'free'
	const aoeRadius = ability?.aoeRadius || 0

	// 1. Взрыв по площади от точки (aoe_point или любая способность с aoeRadius > 0)
	if (aoeRadius > 0 || pattern === 'aoe_point') {
		const radius = aoeRadius > 0 ? aoeRadius : 1
		const shape = ability.aoeShape || 'diamond' // 'diamond' (Manhattan) или 'square' (Chebyshev)
		const affected = []

		if (mapTiles && mapTiles.length > 0) {
			for (const t of mapTiles) {
				const dist = shape === 'square'
					? Math.max(Math.abs(t.x - targetTile.x), Math.abs(t.y - targetTile.y))
					: Math.abs(t.x - targetTile.x) + Math.abs(t.y - targetTile.y)

				if (dist <= radius) {
					affected.push(t)
				}
			}
			return affected.length > 0 ? affected : [targetTile]
		} else {
			for (let dx = -radius; dx <= radius; dx++) {
				for (let dy = -radius; dy <= radius; dy++) {
					const dist = shape === 'square'
						? Math.max(Math.abs(dx), Math.abs(dy))
						: Math.abs(dx) + Math.abs(dy)
					if (dist <= radius) {
						affected.push({ x: targetTile.x + dx, y: targetTile.y + dy })
					}
				}
			}
			return affected
		}
	}

	// 2. Размашистый взмах перед собой (Cleave)
	if (pattern === 'cleave' && attacker && attacker.x !== undefined) {
		const dx = targetTile.x - attacker.x
		const dy = targetTile.y - attacker.y
		const affectedCoords = new Set([`${targetTile.x},${targetTile.y}`])

		if (isStraight(dx, dy)) {
			if (dx !== 0) {
				// Удар по горизонтали (dx=1 или -1): фланги по вертикали
				affectedCoords.add(`${attacker.x + dx},${attacker.y - 1}`)
				affectedCoords.add(`${attacker.x + dx},${attacker.y + 1}`)
			} else {
				// Удар по вертикали (dy=1 или -1): фланги по горизонтали
				affectedCoords.add(`${attacker.x - 1},${attacker.y + dy}`)
				affectedCoords.add(`${attacker.x + 1},${attacker.y + dy}`)
			}
		} else if (isDiagonal(dx, dy)) {
			// Удар по диагонали: задевает смежные ортогональные клетки между атакующим и целью
			affectedCoords.add(`${attacker.x + dx},${attacker.y}`)
			affectedCoords.add(`${attacker.x},${attacker.y + dy}`)
		}

		if (mapTiles && mapTiles.length > 0) {
			return mapTiles.filter((t) => affectedCoords.has(`${t.x},${t.y}`))
		}
		return Array.from(affectedCoords).map((k) => {
			const [x, y] = k.split(',').map(Number)
			return { x, y }
		})
	}

	// 3. Сквозное пробитие линии (Line Pierce)
	if (pattern === 'line_pierce' && attacker && attacker.x !== undefined) {
		const dx = targetTile.x - attacker.x
		const dy = targetTile.y - attacker.y

		if (isStraight(dx, dy)) {
			const stepX = Math.sign(dx)
			const stepY = Math.sign(dy)
			const maxR = ability.maxRange ?? Math.max(Math.abs(dx), Math.abs(dy))
			const lineCoords = new Set()

			for (let step = 1; step <= maxR; step++) {
				lineCoords.add(`${attacker.x + stepX * step},${attacker.y + stepY * step}`)
			}

			if (mapTiles && mapTiles.length > 0) {
				return mapTiles.filter((t) => lineCoords.has(`${t.x},${t.y}`))
			}
			return Array.from(lineCoords).map((k) => {
				const [x, y] = k.split(',').map(Number)
				return { x, y }
			})
		}
	}

	// 4. Обычная точечная способность
	return [targetTile]
}

/**
 * Находит всех бойцов, попавших в зону поражения способности при выборе targetTile
 */
export function getAffectedUnits(attacker, ability, targetTile, allUnits = [], mapTiles = []) {
	if (!attacker || !ability || !targetTile || !allUnits.length) return []

	const affectedTiles = getAreaAffectedTiles(attacker, ability, targetTile, mapTiles)
	const tileKeys = new Set(affectedTiles.map((t) => `${t.x},${t.y}`))

	const targetType = ability.targetType || 'enemy'

	return allUnits.filter((u) => {
		if (u.hp <= 0) return false
		if (!tileKeys.has(`${u.x},${u.y}`)) return false

		if (targetType === 'enemy') {
			return u.team !== attacker.team
		}
		if (targetType === 'ally') {
			return u.team === attacker.team
		}
		if (targetType === 'self') {
			return u.id === attacker.id
		}
		return true
	})
}

/**
 * Проверяет, является ли тайл ледяной поверхностью
 * @param {Object} tile
 * @returns {boolean}
 */
export function isIceTile(tile) {
	if (!tile) return false
	return Boolean(tile.type === 'ice' || tile.id?.includes('ice'))
}

/**
 * Вычисляет вектор и результат отталкивания цели способностью (Knockback, Collision & Hazards).
 * 
 * @param {Object} params
 * @param {Object} params.attacker Атакующий боец
 * @param {Object} params.target Атакуемая цель
 * @param {Object} params.ability Способность (knockback: N)
 * @param {Array<Object>} [params.allUnits=[]] Все бойцы на арене
 * @param {Array<Object>} [params.mapTiles=[]] Тайлы арены
 * @param {Array<Object>} [params.mapObjects=[]] Препятствия арены
 * @param {number} [params.strikeDamage=10] Базовый урон удара для расчёта урона от столкновения
 */
export function resolveKnockback({
	attacker,
	target,
	ability,
	allUnits = [],
	mapTiles = [],
	mapObjects = [],
	strikeDamage = 10
}) {
	const defaultResult = {
		knockbackDistance: 0,
		from: { x: target?.x, y: target?.y, z: target?.z ?? 0 },
		to: { x: target?.x, y: target?.y, z: target?.z ?? 0 },
		chasmFall: false,
		collision: null,
		hazard: null,
		fall: null,
		iceSlide: false
	}

	if (!target || target.x === undefined || target.y === undefined) return defaultResult
	const knockback = ability?.knockback ?? 0
	if (knockback <= 0) return defaultResult

	let stepX = 0
	let stepY = 0

	if (attacker && attacker.x !== undefined && attacker.y !== undefined) {
		const dx = target.x - attacker.x
		const dy = target.y - attacker.y

		if (dx === 0 && dy === 0) {
			const facing = attacker.facing || 'SE'
			if (facing === 'SE') { stepX = 1; stepY = 0 }
			else if (facing === 'NW') { stepX = -1; stepY = 0 }
			else if (facing === 'SW') { stepX = 0; stepY = 1 }
			else if (facing === 'NE') { stepX = 0; stepY = -1 }
			else { stepX = 0; stepY = 1 }
		} else {
			const absX = Math.abs(dx)
			const absY = Math.abs(dy)
			if (absX > absY) {
				stepX = Math.sign(dx)
				stepY = 0
			} else if (absY > absX) {
				stepX = 0
				stepY = Math.sign(dy)
			} else {
				stepX = Math.sign(dx)
				stepY = Math.sign(dy)
			}
		}
	} else {
		stepX = 0
		stepY = 1
	}

	let currentX = target.x
	let currentY = target.y
	let currentZ = target.z ?? 0
	let stepsMoved = 0
	let collision = null
	let chasmFall = false
	let hazard = null
	let fall = null
	let iceSlide = false

	const collisionDamage = Math.max(2, Math.floor(strikeDamage * 0.5))

	let maxSteps = knockback
	let hasSlidOnIce = false

	for (let step = 1; step <= maxSteps; step++) {
		const nextX = currentX + stepX
		const nextY = currentY + stepY

		// 1. Проверка на столкновение с другим живым юнитом
		const blockingUnit = allUnits.find(
			(u) => u.hp > 0 && u.id !== target.id && u.x === nextX && u.y === nextY
		)
		if (blockingUnit) {
			collision = {
				type: 'unit',
				targetDamage: collisionDamage,
				obstacleUnit: blockingUnit,
				collateralDamage: collisionDamage
			}
			break
		}

		// 2. Проверка на столкновение со сплошным объектом/укрытием
		const blockingObject = mapObjects.find((o) => {
			const ox = o.x !== undefined ? o.x : (Array.isArray(o.pos) ? o.pos[0] : null)
			const oy = o.y !== undefined ? o.y : (Array.isArray(o.pos) ? o.pos[1] : null)
			return ox === nextX && oy === nextY && o.solid !== false
		})
		if (blockingObject) {
			collision = {
				type: 'obstacle',
				targetDamage: collisionDamage,
				obstacleObject: blockingObject
			}
			break
		}

		// 3. Проверка тайла арены (пропасть, лава, вода, лед)
		if (mapTiles && mapTiles.length > 0) {
			const tile = mapTiles.find((t) => t.x === nextX && t.y === nextY)
			const isChasm = !tile || tile.type === 'empty' || tile.type === 'void' || tile.type === 'chasm'

			if (isChasm) {
				currentX = nextX
				currentY = nextY
				stepsMoved++
				if (target.flying) {
					chasmFall = false
				} else {
					chasmFall = true
					break
				}
			} else {
				const nextZ = tile.z ?? 0
				const heightDiff = nextZ - currentZ

				// Перепад высот: блок на 1 высоту выше считается лестницей/уступом (+1),
				// а вот перепад высоты >= 2 вверх для нелетающего юнита считается непреодолимой скалой/стеной!
				if (heightDiff >= 2 && !target.flying) {
					collision = {
						type: 'cliff',
						targetDamage: collisionDamage,
						obstacleObject: { name: `уступ скалы (+${heightDiff})` }
					}
					break
				}

				// Проверка граничных стен на тайле (edge walls)
				const currentTile = mapTiles.find((t) => t.x === currentX && t.y === currentY)
				if (!target.flying && isStepBlockedByWall(currentTile, tile)) {
					collision = {
						type: 'wall',
						targetDamage: collisionDamage,
						obstacleObject: { name: 'каменная стена' }
					}
					break
				}

				// Скольжение по льду: если юнит стоял на льду, толкается на лёд и не летит — дальность +1
				const wasOnIce = isIceTile(currentTile)
				const isNextIce = isIceTile(tile)
				if (!target.flying && wasOnIce && isNextIce && !hasSlidOnIce) {
					hasSlidOnIce = true
					iceSlide = true
					maxSteps = Math.max(maxSteps, knockback + 1)
				}

				// Падение с высоты: если юнит падает с уступа высотой >= 2 вниз (currentZ - nextZ >= 2)
				const heightDrop = currentZ - nextZ
				if (heightDrop >= 2 && !target.flying) {
					const fallDamage = Math.max(4 * heightDrop, Math.floor(strikeDamage * 0.5 * heightDrop))
					fall = {
						heightDrop,
						damage: fallDamage
					}
				}

				if (tile.type === 'water' || tile.id?.includes('water')) {
					currentX = nextX
					currentY = nextY
					currentZ = nextZ
					stepsMoved++
					if (!target.flying && !target.swimming) {
						hazard = { type: 'water', drown: true, damage: target.hp || 999 }
						break
					} else {
						hazard = { type: 'water', drown: false, quenchBurning: true }
					}
				} else if (tile.type === 'lava' || tile.id?.includes('lava') || tile.type === 'fire') {
					currentX = nextX
					currentY = nextY
					currentZ = nextZ
					stepsMoved++
					if (!target.flying && !target.fireImmune) {
						hazard = { type: 'lava', damage: 6, applyStatus: 'burning', turns: 2 }
					}
				} else if (isNextIce) {
					currentX = nextX
					currentY = nextY
					currentZ = nextZ
					stepsMoved++
					hazard = { type: 'ice', slide: iceSlide }
				} else {
					currentX = nextX
					currentY = nextY
					currentZ = nextZ
					stepsMoved++
				}
			}
		} else {
			currentX = nextX
			currentY = nextY
			stepsMoved++
		}
	}

	return {
		knockbackDistance: stepsMoved,
		from: { x: target.x, y: target.y, z: target.z ?? 0 },
		to: { x: currentX, y: currentY, z: currentZ },
		chasmFall,
		collision,
		hazard,
		fall,
		iceSlide
	}
}
