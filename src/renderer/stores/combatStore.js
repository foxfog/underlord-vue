import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
	isTargetInPattern,
	applyWeaponToAbility,
	getAffectedUnits,
	resolveKnockback,
	WEAPON_PROFILES
} from '../utils/combat/combatGeometry.js'

/**
 * Боевое хранилище (Pinia).
 * Управляет состоянием одного боя: юниты, очередь ходов, лог.
 * Формула урона: max(1, floor(attack * power) - effectiveDefense)
 */
export const useCombatStore = defineStore('combat', () => {
	const mapId = ref('tests/arena_combat_test')
	const mapTiles = ref([])
	const mapObjects = ref([])
	const units = ref([])
	const turnQueue = ref([])
	const currentUnitIndex = ref(0)
	const round = ref(1)
	const phase = ref('idle')
	const combatLog = ref([])
	const floatingTexts = ref([])
	const selectedAction = ref(null)
	const selectedTarget = ref(null)

	let _ftId = 0
	function addFloatingText(unitId, text, type = 'damage') {
		const id = ++_ftId
		floatingTexts.value.push({ id, unitId, text, type, timestamp: Date.now() })
		setTimeout(() => {
			floatingTexts.value = floatingTexts.value.filter((ft) => ft.id !== id)
		}, 1400)
	}

	const allies = computed(() => units.value.filter((u) => u.team === 'ally' && u.hp > 0))
	const allAllies = computed(() => units.value.filter((u) => u.team === 'ally'))
	const enemies = computed(() => units.value.filter((u) => u.team === 'enemy' && u.hp > 0))

	const currentUnit = computed(() => {
		if (!turnQueue.value.length) return null
		const id = turnQueue.value[currentUnitIndex.value]
		return units.value.find((u) => u.id === id) ?? null
	})

	const isPlayerTurn = computed(
		() => currentUnit.value?.team === 'ally' && phase.value === 'player_action'
	)

	const isOver = computed(() => phase.value === 'win' || phase.value === 'lose')

	let _logId = 0
	function addLog(text, type = 'info') {
		combatLog.value.push({ id: ++_logId, text, type })
		if (combatLog.value.length > 60) combatLog.value.shift()
	}

	function getUnit(id) {
		return units.value.find((u) => u.id === id)
	}

	function setMapData({ tiles = [], objects = [] } = {}) {
		mapTiles.value = tiles || []
		mapObjects.value = objects || []
	}

	function hasStatus(unit, statusName) {
		if (!unit || !unit.statuses) return false
		return unit.statuses.some((s) => (typeof s === 'string' ? s === statusName : s.id === statusName))
	}

	function effectiveDefense(unit) {
		let def = unit.defense
		if (hasStatus(unit, 'defended')) def = Math.floor(def * 1.5)
		if (hasStatus(unit, 'evading')) def = Math.floor(def * 1.3)
		return def
	}

	function calcDamage(attacker, ability, target) {
		const rawAtk = Math.floor(attacker.attack * (ability.power ?? 1.0))
		const def = effectiveDefense(target)
		return Math.max(1, rawAtk - def)
	}

	function isTargetInRange(attacker, ability, target) {
		return isTargetInPattern(attacker, ability, target)
	}

	function moveUnit(unitId, { x, y, z = 0, facing = null, apCost = 1 }) {
		const unit = getUnit(unitId)
		if (!unit) return false
		if (unit.ap < apCost) {
			addLog(`${unit.name}: недостаточно AP для перемещения!`, 'info')
			return false
		}
		unit.x = x
		unit.y = y
		unit.z = z
		if (facing) unit.facing = facing
		unit.ap -= apCost
		unit.hasMoved = true
		addLog(`${unit.name} перемещается на (${x}, ${y}) (-${apCost} AP, осталось: ${unit.ap})`, 'info')
		if (unit.id === currentUnit.value?.id && unit.ap <= 0) {
			endTurn()
		}
		return true
	}

	function tickStatuses(unit) {
		if (!unit || !unit.statuses) return

		// 1. DoT effects (burning)
		for (const s of unit.statuses) {
			const id = typeof s === 'string' ? s : s.id
			if (id === 'burning') {
				const burnDmg = typeof s === 'object' && s.damage ? s.damage : 4
				addLog(`🔥 ${unit.name} горит! (-${burnDmg} HP)`, 'damage')
				addFloatingText(unit.id, `🔥 -${burnDmg}`, 'damage')
				applyDamage(unit.id, burnDmg)
			}
		}

		// 2. Decrement turnsLeft or expire string buffs
		unit.statuses = unit.statuses.filter((s) => {
			if (typeof s === 'string') {
				if (s === 'stunned') return true
				return false
			}
			if (s.turnsLeft !== undefined) {
				s.turnsLeft -= 1
				return s.turnsLeft > 0
			}
			return false
		})
	}

	function applyStatus(unitId, status) {
		const unit = getUnit(unitId)
		if (!unit) return

		const statusObj = typeof status === 'string'
			? (status === 'burning'
				? { id: 'burning', name: 'Горение', turnsLeft: 2, damage: 4 }
				: status)
			: status
		const statusId = typeof statusObj === 'string' ? statusObj : statusObj.id
		const statusName = typeof statusObj === 'string' ? statusObj : (statusObj.name || statusObj.id)

		const existingIdx = unit.statuses.findIndex((s) =>
			typeof s === 'string' ? s === statusId : s.id === statusId
		)

		if (existingIdx >= 0) {
			if (typeof statusObj !== 'string' && typeof unit.statuses[existingIdx] !== 'string') {
				unit.statuses[existingIdx].turnsLeft = Math.max(
					unit.statuses[existingIdx].turnsLeft,
					statusObj.turnsLeft ?? 2
				)
			}
		} else {
			unit.statuses.push(statusObj)
		}

		addLog(`${unit.name} получает статус «${statusName}»`, 'status')
	}

	function applyDamage(unitId, amount) {
		const unit = getUnit(unitId)
		if (!unit || unit.hp <= 0) return
		unit.hp = Math.max(0, unit.hp - amount)
		if (unit.hp === 0) {
			addLog(`${unit.name} повержен!`, 'damage')
			unit.statuses = []
		}
	}

	function applyHeal(unitId, amount) {
		const unit = getUnit(unitId)
		if (!unit || unit.hp <= 0) return
		const actual = Math.min(amount, unit.maxHp - unit.hp)
		unit.hp = Math.min(unit.maxHp, unit.hp + actual)
		addLog(`${unit.name} восстанавливает ${actual} HP`, 'heal')
	}

	function initCombat(encounter) {
		_logId = 0
		_ftId = 0
		mapId.value = encounter.mapId || 'tests/arena_combat_test'
		mapTiles.value = encounter.mapTiles || []
		mapObjects.value = encounter.mapObjects || []
		combatLog.value = []
		floatingTexts.value = []
		selectedAction.value = null
		selectedTarget.value = null
		round.value = 1

		const allUnits = [...(encounter.allies || []), ...(encounter.enemies || [])].map((u) => {
			const weaponId = u.weapon || (u.class === 'mage' ? 'staff' : (u.class === 'archer' ? 'bow' : 'sword'))
			const abilities = (u.abilities ?? []).map((ab) => {
				if (ab.id === 'attack' || ab.useWeapon) {
					return applyWeaponToAbility(ab, weaponId)
				}
				return ab
			})

			return {
				...u,
				weapon: weaponId,
				x: u.x,
				y: u.y,
				z: u.z ?? 0,
				facing: u.facing ?? (u.team === 'ally' ? 'NW' : 'SE'),
				moveRange: u.moveRange ?? (u.class === 'mage' ? 2 : 3),
				hasMoved: false,
				hasActed: false,
				hp: u.hp ?? u.maxHp,
				mp: u.mp ?? u.maxMp ?? 0,
				ap: u.ap ?? u.maxAp ?? 2,
				statuses: [],
				abilities,
				_usedDefendThisFight: false
			}
		})

		units.value = allUnits

		const sorted = [...allUnits].sort((a, b) => {
			if (b.initiative !== a.initiative) return b.initiative - a.initiative
			if (a.team === 'ally' && b.team === 'enemy') return -1
			if (a.team === 'enemy' && b.team === 'ally') return 1
			return 0
		})
		turnQueue.value = sorted.map((u) => u.id)
		currentUnitIndex.value = 0

		addLog(`⚔️ Бой начался! Раунд ${round.value}`, 'round')
		startTurn()
	}

	function startTurn() {
		const unit = currentUnit.value
		if (!unit || unit.hp <= 0) return
		unit.ap = unit.maxAp
		unit.hasMoved = false
		unit.hasActed = false
		if (unit.maxMp > 0) unit.mp = Math.min(unit.maxMp, unit.mp + 1)

		// 1. Environmental floor hazard check (lava/fire on current tile)
		if (mapTiles.value.length > 0 && !unit.flying) {
			const tile = mapTiles.value.find((t) => t.x === unit.x && t.y === unit.y)
			if (tile && (tile.type === 'lava' || tile.id?.includes('lava') || tile.type === 'fire')) {
				if (!unit.fireImmune) {
					addLog(`🔥 ${unit.name} начинает ход в раскалённой лаве! (-6 HP)`, 'damage')
					addFloatingText(unit.id, '🔥 -6', 'damage')
					applyDamage(unit.id, 6)
					if (unit.hp > 0 && !hasStatus(unit, 'burning')) {
						applyStatus(unit.id, { id: 'burning', name: 'Горение', turnsLeft: 2, damage: 4 })
					}
					if (unit.hp <= 0) {
						endTurn()
						return
					}
				}
			}
		}

		// 2. Status ticking (burning DoT, expiry)
		tickStatuses(unit)
		if (unit.hp <= 0) {
			endTurn()
			return
		}

		// 3. Stun reaction (-1 AP)
		if (hasStatus(unit, 'stunned')) {
			unit.ap = Math.max(0, unit.ap - 1)
			unit.statuses = unit.statuses.filter((s) =>
				typeof s === 'string' ? s !== 'stunned' : s.id !== 'stunned'
			)
			addLog(`${unit.name} ошеломлён и теряет 1 AP!`, 'status')
		}

		selectedAction.value = null
		selectedTarget.value = null
		phase.value = unit.team === 'ally' ? 'player_action' : 'enemy_action'
		addLog(`▶️ Ход: ${unit.name} (AP: ${unit.ap})`, 'info')
	}

	function endTurn() {
		const livingAllies = units.value.filter((u) => u.team === 'ally' && u.hp > 0)
		const livingEnemies = units.value.filter((u) => u.team === 'enemy' && u.hp > 0)
		if (livingEnemies.length === 0) { phase.value = 'win'; addLog('🏆 Победа! Все враги повержены!', 'info'); return }
		if (livingAllies.length === 0) { phase.value = 'lose'; addLog('💀 Поражение... Все союзники пали.', 'damage'); return }

		const total = turnQueue.value.length
		let foundLiving = false

		for (let step = 0; step < total; step++) {
			const prevIdx = currentUnitIndex.value
			currentUnitIndex.value = (currentUnitIndex.value + 1) % turnQueue.value.length

			// Wrapped around: start next round and rebuild queue with living units
			if (currentUnitIndex.value <= prevIdx) {
				round.value += 1
				addLog(`─── Раунд ${round.value} ───`, 'round')
				const living = units.value.filter((u) => u.hp > 0)
				const sorted = [...living].sort((a, b) => {
					if (b.initiative !== a.initiative) return b.initiative - a.initiative
					if (a.team === 'ally' && b.team === 'enemy') return -1
					if (a.team === 'enemy' && b.team === 'ally') return 1
					return 0
				})
				turnQueue.value = sorted.map((u) => u.id)
				currentUnitIndex.value = 0
				foundLiving = true
				break
			}

			const candidate = currentUnit.value
			if (candidate && candidate.hp > 0) {
				foundLiving = true
				break
			}
		}

		if (foundLiving && currentUnit.value && currentUnit.value.hp > 0) {
			startTurn()
		}
	}

	function executeAction(ability, targetId, targetCoords = null) {
		const actor = currentUnit.value
		if (!actor) return
		if (actor.ap < ability.apCost) { addLog(`${actor.name}: недостаточно AP!`, 'info'); return }
		if (actor.mp < ability.mpCost) { addLog(`${actor.name}: недостаточно MP!`, 'info'); return }

		const primaryTarget = getUnit(targetId)
		const targetPoint = primaryTarget
			? (primaryTarget.x !== undefined && primaryTarget.y !== undefined ? { x: primaryTarget.x, y: primaryTarget.y } : null)
			: targetCoords

		if (!primaryTarget && !targetPoint) return

		if (!isTargetInRange(actor, ability, primaryTarget || targetPoint)) {
			addLog(`${actor.name}: цель вне зоны досягаемости!`, 'info')
			return
		}

		actor.ap -= ability.apCost
		actor.mp -= ability.mpCost
		actor.hasActed = true

		// Find all units affected by this action (single target or AoE/Cleave/Pierce)
		const affectedUnits = targetPoint
			? getAffectedUnits(actor, ability, targetPoint, units.value)
			: []
		if (primaryTarget && !affectedUnits.some((u) => u.id === primaryTarget.id) && primaryTarget.hp > 0) {
			affectedUnits.unshift(primaryTarget)
		}

		if (ability.targetType === 'self' && affectedUnits.length === 0) {
			affectedUnits.push(actor)
		}

		for (const target of affectedUnits) {
			if (target.hp <= 0) continue

			if (ability.type === 'damage') {
				const dmg = calcDamage(actor, ability, target)
				addLog(`${actor.icon ?? '⚔️'} ${actor.name} → ${target.name}: ${ability.name} — ${dmg} урона`, 'damage')
				addFloatingText(target.id, `-${dmg}`, 'damage')
				applyDamage(target.id, dmg)
			} else if (ability.type === 'damage_status') {
				const dmg = calcDamage(actor, ability, target)
				addLog(`${actor.icon ?? '⚔️'} ${actor.name} → ${target.name}: ${ability.name} — ${dmg} урона`, 'damage')
				addFloatingText(target.id, `-${dmg}`, 'damage')
				applyDamage(target.id, dmg)
				if (ability.status && target.hp > 0) {
					applyStatus(target.id, ability.status)
					addFloatingText(target.id, `💥 ${ability.status}`, 'status')
				}
			} else if (ability.type === 'heal') {
				const healAmt = Math.floor((ability.healBase ?? 0) + actor.attack * (ability.power ?? 0.5))
				addLog(`${actor.icon ?? '💚'} ${actor.name} → ${target.name}: ${ability.name} — +${healAmt} HP`, 'heal')
				addFloatingText(target.id, `+${healAmt}`, 'heal')
				applyHeal(target.id, healAmt)
			} else if (ability.type === 'status') {
				applyStatus(target.id, ability.status)
				addFloatingText(target.id, `✨ ${ability.name}`, 'status')
				addLog(`${actor.icon ?? '✨'} ${actor.name} использует ${ability.name}`, 'status')
			}

			// Knockback, collision & environmental hazards resolution
			if (ability.knockback && ability.knockback > 0 && target.hp > 0) {
				const baseDmg = calcDamage(actor, ability, target)
				const kbResult = resolveKnockback({
					attacker: actor,
					target,
					ability,
					allUnits: units.value,
					mapTiles: mapTiles.value,
					mapObjects: mapObjects.value,
					strikeDamage: baseDmg
				})

				// 1. Shift target position
				if (kbResult.knockbackDistance > 0) {
					target.x = kbResult.to.x
					target.y = kbResult.to.y
					target.z = kbResult.to.z
					addLog(`💨 ${target.name} отброшен на (${target.x}, ${target.y})!`, 'info')
				}

				// 2. Unit or Obstacle collision damage
				if (kbResult.collision) {
					if (kbResult.collision.type === 'unit') {
						const other = kbResult.collision.obstacleUnit
						const dmgT = kbResult.collision.targetDamage
						const dmgO = kbResult.collision.collateralDamage
						addLog(
							`💥 ${target.name} врезается в ${other.name}! Оба получают урон от столкновения!`,
							'damage'
						)
						addFloatingText(target.id, `💥 -${dmgT}`, 'damage')
						applyDamage(target.id, dmgT)
						addFloatingText(other.id, `💥 -${dmgO}`, 'damage')
						applyDamage(other.id, dmgO)
					} else if (
						kbResult.collision.type === 'obstacle' ||
						kbResult.collision.type === 'cliff' ||
						kbResult.collision.type === 'wall'
					) {
						const obj = kbResult.collision.obstacleObject
						const dmgT = kbResult.collision.targetDamage
						const objName = obj?.name || 'препятствие'
						addLog(`🧱 ${target.name} с грохотом врезается в ${objName}! (-${dmgT} HP)`, 'damage')
						addFloatingText(target.id, `🧱 -${dmgT}`, 'damage')
						applyDamage(target.id, dmgT)
					}
				}

				// 3. Environmental Hazards (Water / Lava)
				if (kbResult.hazard) {
					if (kbResult.hazard.drown) {
						addLog(`🌊 ${target.name} падает в воду и тонет!`, 'damage')
						addFloatingText(target.id, '🌊 Утопление!', 'damage')
						applyDamage(target.id, target.hp)
					} else if (kbResult.hazard.type === 'lava') {
						const lavDmg = kbResult.hazard.damage || 6
						addLog(`🔥 ${target.name} попадает в раскалённую лаву! (-${lavDmg} HP)`, 'damage')
						addFloatingText(target.id, `🔥 -${lavDmg}`, 'damage')
						applyDamage(target.id, lavDmg)
						if (kbResult.hazard.applyStatus && target.hp > 0) {
							applyStatus(target.id, { id: 'burning', name: 'Горение', turnsLeft: 2, damage: 4 })
						}
					} else if (kbResult.hazard.quenchBurning) {
						if (hasStatus(target, 'burning')) {
							target.statuses = target.statuses.filter((s) =>
								typeof s === 'string' ? s !== 'burning' : s.id !== 'burning'
							)
							addLog(`💧 Вода гасит пламя на ${target.name}!`, 'status')
						}
					}
				}

				// 4. Chasm fall (Ring-Out)
				if (kbResult.chasmFall) {
					addLog(`💀 ${target.name} сброшен в бездну за край арены!`, 'damage')
					addFloatingText(target.id, '💀 Падение в пропасть!', 'damage')
					applyDamage(target.id, target.hp)
				}

				// 5. Height drop fall damage (cliff fall >= 2 levels)
				if (kbResult.fall && target.hp > 0) {
					const fDmg = kbResult.fall.damage
					const dropLevels = kbResult.fall.heightDrop
					addLog(
						`🤸 ${target.name} падает с уступа высотой в ${dropLevels} ур. и получает ${fDmg} урона от падения!`,
						'damage'
					)
					addFloatingText(target.id, `🤸 -${fDmg}`, 'damage')
					applyDamage(target.id, fDmg)
				}

				// 6. Ice slide
				if (kbResult.iceSlide) {
					addLog(`⛸️ ${target.name} поскальзывается и скользит по гладкому льду!`, 'info')
					addFloatingText(target.id, '⛸️ Скольжение по льду!', 'status')
				}
			}
		}

		// Immediate win / lose check after action resolution
		const livingEnemies = units.value.filter((u) => u.team === 'enemy' && u.hp > 0)
		if (livingEnemies.length === 0) {
			phase.value = 'win'
			addLog('🏆 Победа! Все враги повержены!', 'info')
			return
		}
		const livingAllies = units.value.filter((u) => u.team === 'ally' && u.hp > 0)
		if (livingAllies.length === 0) {
			phase.value = 'lose'
			addLog('💀 Поражение... Все союзники пали.', 'damage')
			return
		}

		selectedAction.value = null
		selectedTarget.value = null
		if (actor.ap <= 0) endTurn()
	}

	function skipTurn() {
		const actor = currentUnit.value
		if (!actor) return
		actor.ap = 0
		addLog(`${actor.name} пропускает ход`, 'info')
		endTurn()
	}

	function resetCombat() {
		units.value = []
		turnQueue.value = []
		currentUnitIndex.value = 0
		round.value = 1
		phase.value = 'idle'
		mapTiles.value = []
		mapObjects.value = []
		combatLog.value = []
		floatingTexts.value = []
		selectedAction.value = null
		selectedTarget.value = null
	}

	return {
		mapId, mapTiles, mapObjects, units, turnQueue, currentUnitIndex, round, phase, combatLog, floatingTexts, selectedAction, selectedTarget,
		allies, allAllies, enemies, currentUnit, isPlayerTurn, isOver,
		initCombat, setMapData, startTurn, endTurn, executeAction, skipTurn, moveUnit, isTargetInRange, addFloatingText,
		applyDamage, applyHeal, applyStatus, hasStatus, resetCombat, getUnit, calcDamage, effectiveDefense
	}
})
