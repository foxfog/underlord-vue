import { findPath } from '../utils/isometric/isoPathfinding'

/**
 * useCombatAI.js
 * Логика автоматических ходов врагов (и союзников под управлением AI).
 * Поддерживает как текстовый режим, так и изометрическое перемещение на сетке в стиле Sword of Convallaria.
 */

/**
 * Найти клетку для оптимального перемещения юнита на сетке.
 */
function findBestMoveTile(actor, target, desiredMinRange, desiredMaxRange, store) {
	if (!actor || !target || actor.x === undefined || target.x === undefined) return null

	const moveRange = actor.moveRange ?? 3
	const occupied = new Set(
		store.units
			.filter((u) => u.hp > 0 && u.id !== actor.id && u.x !== undefined)
			.map((u) => `${u.x},${u.y}`)
	)

	let bestTile = null
	let bestScore = -Infinity

	for (let dx = -moveRange; dx <= moveRange; dx++) {
		for (let dy = -moveRange; dy <= moveRange; dy++) {
			const distFromActor = Math.abs(dx) + Math.abs(dy)
			if (distFromActor > moveRange) continue

			const nx = actor.x + dx
			const ny = actor.y + dy
			if (occupied.has(`${nx},${ny}`)) continue

			const distToTarget = Math.abs(nx - target.x) + Math.abs(ny - target.y)
			const isStraightToTarget = nx === target.x || ny === target.y
			const isSpearOrStraight = actor.weapon === 'spear' || actor.abilities?.some((a) => a.pattern === 'straight')

			let score = 0

			if (distToTarget >= desiredMinRange && distToTarget <= desiredMaxRange) {
				score = 1000 - distToTarget
				if (isSpearOrStraight) {
					score += isStraightToTarget ? 400 : -500
				}
			} else if (distToTarget > desiredMaxRange) {
				score = 500 - distToTarget
				if (isSpearOrStraight && isStraightToTarget) score += 100
			} else {
				score = 200 + distToTarget
			}

			score -= distFromActor * 0.1

			if (score > bestScore) {
				bestScore = score
				bestTile = { x: nx, y: ny, z: actor.z ?? 0 }
			}
		}
	}

	return bestTile
}

/**
 * Выбрать цель с минимальным HP среди кандидатов.
 */
function getDesiredCombatRange(actor) {
	if (actor.class === 'archer' || actor.weapon === 'bow') return { minR: 2, maxR: 4 }
	if (actor.class === 'mage' || actor.weapon === 'staff') return { minR: 1, maxR: 3 }
	if (actor.weapon === 'spear') return { minR: 1, maxR: 2 }
	return { minR: 1, maxR: 1 }
}

function weakest(candidates) {
	return candidates.filter((u) => u.hp > 0).sort((a, b) => a.hp - b.hp)[0] ?? null
}

/**
 * Выбрать юнита с максимальным дефицитом HP.
 */
function mostInjured(candidates) {
	return candidates
		.filter((u) => u.hp > 0 && u.hp < u.maxHp)
		.sort((a, b) => (b.maxHp - b.hp) - (a.maxHp - a.hp))[0] ?? null
}

function findAbility(unit, id) {
	return unit.abilities?.find((a) => a.id === id) ?? null
}

function getValidTargets(actor, ability, candidates, store) {
	if (actor.x === undefined) return candidates.filter((c) => c.hp > 0)
	return candidates.filter((c) => c.hp > 0 && store.isTargetInRange(actor, ability, c))
}

function hasReady2ApAction(actor, targets, friendlies, store) {
	if (actor.ap < 2) return false
	const abilities2Ap = (actor.abilities || []).filter(
		(a) => a.apCost >= 2 && (!a.mpCost || actor.mp >= a.mpCost)
	)
	for (const ab of abilities2Ap) {
		const pool = ab.targetType === 'ally' ? friendlies : targets
		const valid = getValidTargets(actor, ab, pool, store)
		if (valid.length > 0) return true
	}
	return false
}

/**
 * Обработать ход текущего врага (или AI-союзника).
 */
export async function processEnemyTurn(store, arenaRef = null, { speed = 1.0, animations = true } = {}) {
	const actor = store.currentUnit
	if (!actor || actor.team !== 'enemy') return

	const allFriendlies = store.units.filter((u) => u.team === 'enemy' && u.hp > 0)
	const allTargets = store.units.filter((u) => u.team === 'ally' && u.hp > 0)
	if (allTargets.length === 0) return

	const friendlies = actor.x !== undefined ? allFriendlies.filter((u) => u.x !== undefined) : allFriendlies
	const targets = actor.x !== undefined
		? (allTargets.some((u) => u.x !== undefined) ? allTargets.filter((u) => u.x !== undefined) : allTargets)
		: allTargets

	// 1. Позиционирование на сетке
	// Если у юнита есть готовая тяжелая способность (2 AP) и цель в радиусе — не тратим 1 AP на движение!
	const saveApFor2ApAbility = hasReady2ApAction(actor, targets, friendlies, store)

	if (!saveApFor2ApAbility && actor.ap >= 1 && actor.x !== undefined) {
		const target = weakest(targets)
		if (target) {
			const { minR, maxR } = getDesiredCombatRange(actor)
			const bestTile = findBestMoveTile(actor, target, minR, maxR, store)
			if (bestTile && (bestTile.x !== actor.x || bestTile.y !== actor.y)) {
				let facing = actor.facing
				if (bestTile.x > actor.x) facing = 'SE'
				else if (bestTile.x < actor.x) facing = 'NW'
				else if (bestTile.y > actor.y) facing = 'SW'
				else if (bestTile.y < actor.y) facing = 'NE'

				if (arenaRef && animations && arenaRef.animateUnitMovement) {
					const livingObstacles = store.units
						.filter((u) => u.hp > 0 && u.id !== actor.id && u.x !== undefined)
						.map((u) => ({ x: u.x, y: u.y, solid: true }))

					const path = findPath({
						start: { x: actor.x, y: actor.y, z: actor.z ?? 0 },
						target: bestTile,
						tiles: arenaRef.tiles || [],
						obstacles: livingObstacles,
						maxClimbHeight: 1
					})

					const pathToWalk = path && path.length > 0 ? path : [{ ...bestTile, z: actor.z ?? 0 }]
					await arenaRef.animateUnitMovement(actor.id, pathToWalk)
					await new Promise((r) => setTimeout(r, 200 / speed))
				} else {
					store.moveUnit(actor.id, { ...bestTile, facing })
				}
			}
		}
	}

	// 2. Выбор и исполнение действий (и возможно дополнительное движение/отход при наличии AP)
	while (actor.ap > 0 && !store.isOver) {
		const decision = decide(actor, targets, friendlies, store)
		if (!decision) {
			// Если действий нет, но есть AP >= 1 и враг вне зоны поражения — пробуем подойти
			if (actor.ap >= 1 && actor.x !== undefined) {
				const target = weakest(targets)
				if (target) {
					const { minR, maxR } = getDesiredCombatRange(actor)
					const bestTile = findBestMoveTile(actor, target, minR, maxR, store)
					if (bestTile && (bestTile.x !== actor.x || bestTile.y !== actor.y)) {
						let facing = actor.facing
						if (bestTile.x > actor.x) facing = 'SE'
						else if (bestTile.x < actor.x) facing = 'NW'
						else if (bestTile.y > actor.y) facing = 'SW'
						else if (bestTile.y < actor.y) facing = 'NE'

						if (arenaRef && animations && arenaRef.animateUnitMovement) {
							const livingObstacles = store.units
								.filter((u) => u.hp > 0 && u.id !== actor.id && u.x !== undefined)
								.map((u) => ({ x: u.x, y: u.y, solid: true }))

							const path = findPath({
								start: { x: actor.x, y: actor.y, z: actor.z ?? 0 },
								target: bestTile,
								tiles: arenaRef.tiles || [],
								obstacles: livingObstacles,
								maxClimbHeight: 1
							})

							const pathToWalk = path && path.length > 0 ? path : [{ ...bestTile, z: actor.z ?? 0 }]
							await arenaRef.animateUnitMovement(actor.id, pathToWalk)
							await new Promise((r) => setTimeout(r, 200 / speed))
						} else {
							store.moveUnit(actor.id, { ...bestTile, facing })
						}
						continue
					}
				}
			}
			break
		}

		if (arenaRef && animations && arenaRef.playActionVfx) {
			try {
				await arenaRef.playActionVfx({
					casterId: actor.id,
					targetId: decision.targetId,
					ability: decision.ability
				})
			} catch (vfxErr) {
				console.warn('[useCombatAI] playActionVfx failed:', vfxErr)
			}
		}

		store.executeAction(decision.ability, decision.targetId)
		if (store.isOver) return
		if (store.currentUnit?.id !== actor.id) return

		if (arenaRef && animations && actor.ap > 0) {
			await new Promise((r) => setTimeout(r, 220 / speed))
		}
	}

	if (!store.isOver && store.currentUnit?.id === actor.id) {
		store.skipTurn()
	}
}

function decide(actor, targets, friendlies, store) {
	if (targets.length === 0) return null

	switch (actor.class) {
		case 'archer':
			return decideArcher(actor, targets, store)
		case 'mage':
			return decideMage(actor, targets, friendlies, store)
		case 'warrior':
			return decideWarrior(actor, targets, store)
		default:
			return decideBasic(actor, targets, store)
	}
}

/** Лучник: прицельный выстрел (2 AP) или обычный (1 AP) */
function decideArcher(actor, targets, store) {
	const aimedShot = findAbility(actor, 'aimed_shot')
	if (aimedShot && actor.ap >= aimedShot.apCost) {
		const valid = getValidTargets(actor, aimedShot, targets, store)
		const target = weakest(valid)
		if (target) return { ability: aimedShot, targetId: target.id }
	}

	const attack = findAbility(actor, 'attack')
	if (attack && actor.ap >= attack.apCost) {
		const valid = getValidTargets(actor, attack, targets, store)
		const target = weakest(valid)
		if (target) return { ability: attack, targetId: target.id }
	}

	return null
}

/** Маг: лечение раненого союзника, тяжелое заклинание (2 AP), болт (1 AP), удар посохом */
function decideMage(actor, targets, friendlies, store) {
	const mend = findAbility(actor, 'mend') ?? findAbility(actor, 'heal_allies')
	const injured = mostInjured(friendlies)
	if (mend && injured && (injured.maxHp - injured.hp) >= 15 && actor.mp >= mend.mpCost && actor.ap >= mend.apCost) {
		if (actor.x === undefined || store.isTargetInRange(actor, mend, injured)) {
			return { ability: mend, targetId: injured.id }
		}
	}

	// Тяжелое заклинание на 2 AP (Огненный столп или Драконья молния)
	const heavySpell = findAbility(actor, 'fire_pillar') ?? findAbility(actor, 'dragon_lightning')
	if (heavySpell && actor.mp >= heavySpell.mpCost && actor.ap >= heavySpell.apCost) {
		const valid = getValidTargets(actor, heavySpell, targets, store)
		const target = weakest(valid)
		if (target) return { ability: heavySpell, targetId: target.id }
	}

	const bolt = findAbility(actor, 'arcane_bolt') ?? findAbility(actor, 'fire_bolt')
	if (bolt && actor.mp >= bolt.mpCost && actor.ap >= bolt.apCost) {
		const valid = getValidTargets(actor, bolt, targets, store)
		const target = weakest(valid)
		if (target) return { ability: bolt, targetId: target.id }
	}

	const staff = findAbility(actor, 'staff_hit')
	if (staff && actor.ap >= staff.apCost) {
		const valid = getValidTargets(actor, staff, targets, store)
		const target = weakest(valid)
		if (target) return { ability: staff, targetId: target.id }
	}

	return null
}

/** Воин: защитная стойка при низком HP, тяжёлый удар или обычный удар */
function decideWarrior(actor, targets, store) {
	if (!actor._usedDefendThisFight && actor.hp < actor.maxHp * 0.5) {
		const defend = findAbility(actor, 'defend')
		if (defend && actor.ap >= defend.apCost) {
			actor._usedDefendThisFight = true
			return { ability: defend, targetId: actor.id }
		}
	}

	const heavyStrike = findAbility(actor, 'heavy_strike')
	if (heavyStrike && actor.ap >= heavyStrike.apCost) {
		const valid = getValidTargets(actor, heavyStrike, targets, store)
		const target = weakest(valid)
		if (target) return { ability: heavyStrike, targetId: target.id }
	}

	const attack = findAbility(actor, 'attack')
	if (attack && actor.ap >= attack.apCost) {
		const valid = getValidTargets(actor, attack, targets, store)
		const target = weakest(valid)
		if (target) return { ability: attack, targetId: target.id }
	}

	return null
}

function decideBasic(actor, targets, store) {
	const attack = findAbility(actor, 'attack')
	if (attack && actor.ap >= attack.apCost) {
		const valid = getValidTargets(actor, attack, targets, store)
		const target = weakest(valid)
		if (target) return { ability: attack, targetId: target.id }
	}
	return null
}
