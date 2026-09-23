import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCombatStore } from '../../stores/combatStore'
import { processEnemyTurn } from '../useCombatAI'

// Минимальный encounter для тестов
const mockEncounter = {
	allies: [
		{
			id: 'mc', name: 'МС', team: 'ally', class: 'fighter',
			hp: 40, maxHp: 40, mp: 0, maxMp: 0, ap: 2, maxAp: 2,
			attack: 8, defense: 4, initiative: 7, icon: '⚔️',
			abilities: [
				{ id: 'attack', name: 'Атака', apCost: 1, mpCost: 0, type: 'damage', power: 1.0, targetType: 'enemy' },
				{ id: 'heal_self', name: 'Лечение', apCost: 1, mpCost: 0, type: 'heal', power: 0, healBase: 10, targetType: 'ally' }
			]
		},
		{
			id: 'albedo', name: 'Альбедо', team: 'ally', class: 'warrior',
			hp: 60, maxHp: 60, mp: 0, maxMp: 0, ap: 2, maxAp: 2,
			attack: 10, defense: 8, initiative: 5, icon: '🛡️',
			abilities: [
				{ id: 'attack', name: 'Атака', apCost: 1, mpCost: 0, type: 'damage', power: 1.0, targetType: 'enemy' },
				{ id: 'defend', name: 'Защита', apCost: 1, mpCost: 0, type: 'status', status: 'defended', targetType: 'self' }
			]
		},
		{
			id: 'ainz', name: 'Аинз', team: 'ally', class: 'mage',
			hp: 30, maxHp: 30, mp: 8, maxMp: 8, ap: 2, maxAp: 2,
			attack: 12, defense: 2, initiative: 9, icon: '🔮',
			abilities: [
				{ id: 'fire_bolt', name: 'Огненный болт', apCost: 1, mpCost: 2, type: 'damage', power: 1.4, targetType: 'enemy' },
				{ id: 'heal_allies', name: 'Исцеление', apCost: 1, mpCost: 3, type: 'heal', power: 0.5, healBase: 10, targetType: 'ally' }
			]
		}
	],
	enemies: [
		{
			id: 'bandit_archer', name: 'Лучник', team: 'enemy', class: 'archer',
			hp: 30, maxHp: 30, mp: 0, maxMp: 0, ap: 2, maxAp: 2,
			attack: 7, defense: 2, initiative: 8, icon: '🏹',
			abilities: [
				{ id: 'attack', name: 'Выстрел', apCost: 1, mpCost: 0, type: 'damage', power: 1.0, targetType: 'enemy' }
			]
		},
		{
			id: 'bandit_mage', name: 'Маг', team: 'enemy', class: 'mage',
			hp: 25, maxHp: 25, mp: 6, maxMp: 6, ap: 2, maxAp: 2,
			attack: 9, defense: 1, initiative: 6, icon: '🧙',
			abilities: [
				{ id: 'arcane_bolt', name: 'Магический болт', apCost: 1, mpCost: 2, type: 'damage', power: 1.3, targetType: 'enemy' }
			]
		},
		{
			id: 'bandit_warrior', name: 'Воин', team: 'enemy', class: 'warrior',
			hp: 45, maxHp: 45, mp: 0, maxMp: 0, ap: 2, maxAp: 2,
			attack: 8, defense: 5, initiative: 4, icon: '🗡️',
			abilities: [
				{ id: 'attack', name: 'Удар', apCost: 1, mpCost: 0, type: 'damage', power: 1.0, targetType: 'enemy' }
			]
		}
	]
}

describe('combatStore', () => {
	let store

	beforeEach(() => {
		setActivePinia(createPinia())
		store = useCombatStore()
	})

	it('initCombat создаёт 6 юнитов (3 союзника + 3 врага)', () => {
		store.initCombat(mockEncounter)
		expect(store.units).toHaveLength(6)
		expect(store.allies).toHaveLength(3)
		expect(store.enemies).toHaveLength(3)
	})

	it('turnQueue отсортирован по убыванию инициативы', () => {
		store.initCombat(mockEncounter)
		// Ожидаемый порядок по initiative: ainz(9), bandit_archer(8), mc(7), albedo(5), bandit_mage(6), bandit_warrior(4)
		// Точная сортировка: 9>8>7>6>5>4
		const queue = store.turnQueue
		expect(queue).toHaveLength(6)
		// Первый — ainz (initiative 9)
		expect(queue[0]).toBe('ainz')
		// Последний — bandit_warrior (initiative 4)
		expect(queue[queue.length - 1]).toBe('bandit_warrior')
	})

	it('очередь ходов: при равной инициативе союзники раньше врагов', () => {
		const tiedEncounter = {
			allies: [
				{ ...mockEncounter.allies[0], initiative: 5 }
			],
			enemies: [
				{ ...mockEncounter.enemies[0], initiative: 5 }
			]
		}
		store.initCombat(tiedEncounter)
		// Союзник должен идти первым
		expect(store.units.find((u) => u.id === store.turnQueue[0]).team).toBe('ally')
	})

	it('executeAction attack уменьшает HP цели', () => {
		store.initCombat(mockEncounter)
		// Делаем текущим юнитом mc вручную — найдём его в очереди
		const mcIdx = store.turnQueue.indexOf('mc')
		store.currentUnitIndex = mcIdx
		store.phase = 'player_action'
		const mcUnit = store.getUnit('mc')
		mcUnit.ap = 2

		const archerHpBefore = store.getUnit('bandit_archer').hp
		const attackAbility = mcUnit.abilities.find((a) => a.id === 'attack')
		store.executeAction(attackAbility, 'bandit_archer')

		const archerHpAfter = store.getUnit('bandit_archer').hp
		expect(archerHpAfter).toBeLessThan(archerHpBefore)
	})

	it('executeAction не выполняется если AP = 0', () => {
		store.initCombat(mockEncounter)
		const mcIdx = store.turnQueue.indexOf('mc')
		store.currentUnitIndex = mcIdx
		store.phase = 'player_action'
		const mcUnit = store.getUnit('mc')
		mcUnit.ap = 0 // Нет AP

		const archerHpBefore = store.getUnit('bandit_archer').hp
		const attackAbility = mcUnit.abilities.find((a) => a.id === 'attack')
		store.executeAction(attackAbility, 'bandit_archer')

		expect(store.getUnit('bandit_archer').hp).toBe(archerHpBefore)
	})

	it('skipTurn завершает ход и переходит к следующему юниту', () => {
		store.initCombat(mockEncounter)
		const firstId = store.turnQueue[0]
		const firstUnit = store.getUnit(firstId)
		firstUnit.ap = 2
		store.phase = firstUnit.team === 'ally' ? 'player_action' : 'enemy_action'

		const indexBefore = store.currentUnitIndex
		store.skipTurn()

		// Либо индекс увеличился, либо бой завершился (маловероятно за 1 ход)
		if (!store.isOver) {
			expect(store.currentUnitIndex).not.toBe(indexBefore)
		}
	})

	it('уничтожение всех врагов переводит phase в win', () => {
		store.initCombat(mockEncounter)
		// Убиваем всех врагов напрямую
		for (const e of store.enemies) {
			store.applyDamage(e.id, 9999)
		}
		// Вызываем endTurn, чтобы проверить условие
		store.endTurn()
		expect(store.phase).toBe('win')
	})

	it('уничтожение всех союзников переводит phase в lose', () => {
		store.initCombat(mockEncounter)
		for (const a of store.allies) {
			store.applyDamage(a.id, 9999)
		}
		store.endTurn()
		expect(store.phase).toBe('lose')
	})

	it('нельзя кастовать заклинание если недостаточно MP', () => {
		store.initCombat(mockEncounter)
		const ainzIdx = store.turnQueue.indexOf('ainz')
		store.currentUnitIndex = ainzIdx
		store.phase = 'player_action'
		const ainz = store.getUnit('ainz')
		ainz.mp = 0 // Нет маны
		ainz.ap = 2

		const targetHpBefore = store.getUnit('bandit_archer').hp
		const fireBolt = ainz.abilities.find((a) => a.id === 'fire_bolt')
		store.executeAction(fireBolt, 'bandit_archer')

		// HP врага не должно измениться
		expect(store.getUnit('bandit_archer').hp).toBe(targetHpBefore)
	})

	it('формула урона: max(1, floor(attack*power) - defense)', () => {
		store.initCombat(mockEncounter)
		const mc = store.getUnit('mc')
		const archer = store.getUnit('bandit_archer')
		const attackAbility = mc.abilities.find((a) => a.id === 'attack')

		// attack=8, power=1.0, defense=2 → rawAtk=8, def=2, damage=6
		const dmg = store.calcDamage(mc, attackAbility, archer)
		expect(dmg).toBe(Math.max(1, Math.floor(8 * 1.0) - 2))
	})

	it('processEnemyTurn: лучник атакует слабейшего союзника и тратит AP', () => {
		store.initCombat(mockEncounter)
		// Устанавливаем текущим юнитом bandit_archer
		const archerIdx = store.turnQueue.indexOf('bandit_archer')
		store.currentUnitIndex = archerIdx
		store.phase = 'enemy_action'
		const archer = store.getUnit('bandit_archer')
		archer.ap = 2

		// Делаем Аинза самым раненым (hp = 10)
		const ainz = store.getUnit('ainz')
		ainz.hp = 10

		processEnemyTurn(store)

		// Лучник должен был атаковать Аинза
		expect(ainz.hp).toBeLessThan(10)
		// Ход должен был завершиться после исчерпания AP
		expect(store.currentUnitIndex).not.toBe(archerIdx)
	})

	it('processEnemyTurn: маг лечит раненого союзника если хватает MP', () => {
		store.initCombat(mockEncounter)
		const mageIdx = store.turnQueue.indexOf('bandit_mage')
		store.currentUnitIndex = mageIdx
		store.phase = 'enemy_action'
		const mage = store.getUnit('bandit_mage')
		mage.mp = 6
		mage.ap = 2

		// Добавим способность mend магу
		mage.abilities.push({
			id: 'mend', name: 'Лечение', apCost: 1, mpCost: 3,
			type: 'heal', power: 0.4, healBase: 8, targetType: 'ally'
		})

		// Раним воина-бандита на 20 HP (дефицит 20 >= 15)
		const warrior = store.getUnit('bandit_warrior')
		warrior.hp = warrior.maxHp - 20 // 25/45

		processEnemyTurn(store)

		// Маг должен был применить mend и подлечить воина
		expect(warrior.hp).toBeGreaterThan(25)
	})

	it('router и TestsContent содержат разблокированный тактический бой (/test/combat)', async () => {
		const fs = await import('fs')
		const path = await import('path')

		// Проверка маршрута в router/index.js
		const routerPath = path.resolve(__dirname, '../../router/index.js')
		const routerContent = fs.readFileSync(routerPath, 'utf-8')
		expect(routerContent).toContain("path: '/test/combat'")
		expect(routerContent).toContain("CombatTesterView.vue")

		// Проверка TestsContent.vue
		const testsContentPath = path.resolve(__dirname, '../../components/tests/TestsContent.vue')
		const testsContent = fs.readFileSync(testsContentPath, 'utf-8')
		expect(testsContent).toContain("launchCombatTester")
		expect(testsContent).toContain("/test/combat")
		expect(testsContent).toContain("Пошаговый тактический бой")
		expect(testsContent).toContain("__active")
	})

	it('moveUnit перемещает юнита и выставляет hasMoved = true', () => {
		store.initCombat(mockEncounter)
		const mc = store.getUnit('mc')
		expect(mc.hasMoved).toBe(false)
		const moved = store.moveUnit('mc', { x: 2, y: 1, z: 0, facing: 'SE' })
		expect(moved).toBe(true)
		expect(mc.x).toBe(2)
		expect(mc.y).toBe(1)
		expect(mc.facing).toBe('SE')
		expect(mc.hasMoved).toBe(true)
	})

	it('isTargetInRange валидирует дальность атаки на сетке', () => {
		store.initCombat(mockEncounter)
		const mc = store.getUnit('mc')
		const archer = store.getUnit('bandit_archer')
		mc.x = 0
		mc.y = 0
		archer.x = 3
		archer.y = 0 // distance = 3

		const meleeAbility = { minRange: 1, maxRange: 1, targetType: 'enemy' }
		const rangedAbility = { minRange: 2, maxRange: 4, targetType: 'enemy' }
		const selfAbility = { minRange: 0, maxRange: 0, targetType: 'self' }

		// Ближний бой (радиус 1) не достаёт до цели на расстоянии 3
		expect(store.isTargetInRange(mc, meleeAbility, archer)).toBe(false)
		// Удар по диагонали / «вбок» на экране (dx=1, dy=-1 → Manhattan distance = 2) вне радиуса 1
		const diagonalTarget = { x: 1, y: -1 }
		expect(store.isTargetInRange(mc, meleeAbility, diagonalTarget)).toBe(false)
		// Удар строго по прямой сетки (dx=1, dy=0 → Manhattan distance = 1) в радиусе 1
		const straightTarget = { x: 1, y: 0 }
		expect(store.isTargetInRange(mc, meleeAbility, straightTarget)).toBe(true)
		// Дальний бой (радиус 2-4) достаёт до цели на расстоянии 3
		expect(store.isTargetInRange(mc, rangedAbility, archer)).toBe(true)
		// Навык на себя
		expect(store.isTargetInRange(mc, selfAbility, mc)).toBe(true)
		expect(store.isTargetInRange(mc, selfAbility, archer)).toBe(false)
	})

	it('executeAction не наносит урон если цель вне радиуса', () => {
		store.initCombat(mockEncounter)
		const mcIdx = store.turnQueue.indexOf('mc')
		store.currentUnitIndex = mcIdx
		store.phase = 'player_action'
		const mc = store.getUnit('mc')
		const archer = store.getUnit('bandit_archer')
		mc.x = 0
		mc.y = 0
		archer.x = 5
		archer.y = 5 // distance = 10
		mc.ap = 2

		const meleeAbility = { id: 'strike', name: 'Удар', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, type: 'damage', power: 1.0, targetType: 'enemy' }
		const archerHpBefore = archer.hp
		store.executeAction(meleeAbility, 'bandit_archer')

		// Урон не должен быть нанесён
		expect(archer.hp).toBe(archerHpBefore)
		expect(mc.ap).toBe(2) // AP не должно было списаться
	})

	it('processEnemyTurn перемещает врага ближе к союзнику если тот вне радиуса', () => {
		store.initCombat(mockEncounter)
		const warriorIdx = store.turnQueue.indexOf('bandit_warrior')
		store.currentUnitIndex = warriorIdx
		store.phase = 'enemy_action'

		const warrior = store.getUnit('bandit_warrior')
		warrior.x = 0
		warrior.y = -5
		warrior.moveRange = 3

		const mc = store.getUnit('mc')
		mc.x = 0
		mc.y = 0 // расстояние 5 > 1

		processEnemyTurn(store)

		// Воин должен был сделать шаг ближе по сетке (расстояние уменьшилось)
		const newDistance = Math.abs(warrior.x - mc.x) + Math.abs(warrior.y - mc.y)
		expect(newDistance).toBeLessThan(5)
		expect(warrior.hasMoved).toBe(true)
	})

	it('moveUnit корректно обновляет координаты, направление и флаг hasMoved', () => {
		store.initCombat(mockEncounter)
		const ainz = store.getUnit('ainz')
		expect(ainz.hasMoved).toBe(false)

		const moved = store.moveUnit('ainz', { x: 2, y: 3, z: 0, facing: 'NE' })
		expect(moved).toBe(true)
		expect(ainz.x).toBe(2)
		expect(ainz.y).toBe(3)
		expect(ainz.z).toBe(0)
		expect(ainz.facing).toBe('NE')
		expect(ainz.hasMoved).toBe(true)
		expect(store.combatLog.some((l) => l.text.includes('Аинз перемещается на (2, 3)'))).toBe(true)
	})

	it('Аинз имеет наивысшую инициативу в mockEncounter и начинает бой первым', () => {
		store.initCombat(mockEncounter)
		expect(store.currentUnit.id).toBe('ainz')
		expect(store.isPlayerTurn).toBe(true)
		expect(store.currentUnit.hasMoved).toBe(false)
	})

	it('processEnemyTurn вызывает animateUnitMovement и playActionVfx если передан arenaRef', async () => {
		store.initCombat(mockEncounter)
		const warriorIdx = store.turnQueue.indexOf('bandit_warrior')
		store.currentUnitIndex = warriorIdx
		store.phase = 'enemy_action'

		const warrior = store.getUnit('bandit_warrior')
		warrior.x = 0
		warrior.y = -2
		warrior.moveRange = 3
		warrior.ap = 2

		const mc = store.getUnit('mc')
		mc.x = 0
		mc.y = 0

		const mockArena = {
			tiles: [
				{ x: 0, y: -2, z: 0 },
				{ x: 0, y: -1, z: 0 },
				{ x: 0, y: 0, z: 0 }
			],
			animateUnitMovement: vi.fn().mockImplementation((unitId, path) => {
				const dest = path[path.length - 1]
				store.moveUnit(unitId, { ...dest, facing: 'SE' })
				return Promise.resolve()
			}),
			playActionVfx: vi.fn().mockResolvedValue()
		}

		await processEnemyTurn(store, mockArena, { speed: 100, animations: true })

		expect(mockArena.animateUnitMovement).toHaveBeenCalled()
		expect(mockArena.playActionVfx).toHaveBeenCalled()
	})

	it('processEnemyTurn успешно завершает ход и наносит урон даже если playActionVfx выбросил ошибку', async () => {
		store.initCombat(mockEncounter)
		const archerIdx = store.turnQueue.indexOf('bandit_archer')
		store.currentUnitIndex = archerIdx
		store.phase = 'enemy_action'

		const archer = store.getUnit('bandit_archer')
		archer.x = 0
		archer.y = -2
		archer.moveRange = 3
		archer.ap = 2

		const mc = store.getUnit('mc')
		mc.x = 0
		mc.y = 0
		const mcInitialHp = mc.hp

		const mockArenaWithError = {
			tiles: [
				{ x: 0, y: -2, z: 0 },
				{ x: 0, y: -1, z: 0 },
				{ x: 0, y: 0, z: 0 }
			],
			animateUnitMovement: vi.fn().mockResolvedValue(),
			playActionVfx: vi.fn().mockRejectedValue(new Error('VFX failed'))
		}

		await processEnemyTurn(store, mockArenaWithError, { speed: 100, animations: true })

		// Should not hang, should still deal damage and advance/finish turn
		expect(mc.hp).toBeLessThan(mcInitialHp)
		expect(store.currentUnit?.id).not.toBe('bandit_archer')
	})

	it('убийство врага с сохранением AP сохраняет ход текущего юнита и не сдвигает очередь', () => {
		store.initCombat(mockEncounter)

		// Находим альбедо и лучника (лучник имеет более высокую инициативу и стоит раньше в turnQueue)
		const archerIdx = store.turnQueue.indexOf('bandit_archer')
		const albedoIdx = store.turnQueue.indexOf('albedo')
		expect(archerIdx).toBeLessThan(albedoIdx)

		// Устанавливаем ход Альбедо
		store.currentUnitIndex = albedoIdx
		store.phase = 'player_action'

		const albedo = store.currentUnit
		expect(albedo.id).toBe('albedo')
		albedo.ap = 2
		albedo.x = 0
		albedo.y = 1

		const archer = store.getUnit('bandit_archer')
		archer.x = 0
		archer.y = 0
		archer.hp = 5 // мало HP, чтобы погибнуть от 1 удара

		// Наносим удар мечом (1 AP)
		const swordAttack = albedo.abilities.find((a) => a.id === 'attack')
		store.executeAction(swordAttack, archer.id)

		// Лучник погиб
		expect(archer.hp).toBe(0)

		// У Альбедо остался 1 AP
		expect(albedo.ap).toBe(1)

		// КРИТИЧЕСКАЯ ПРОВЕРКА: Ход остался за Альбедо!
		expect(store.currentUnit.id).toBe('albedo')
		expect(store.currentUnitIndex).toBe(albedoIdx)
		expect(store.isPlayerTurn).toBe(true)
		expect(store.phase).toBe('player_action')

		// Альбедо может потратить последний 1 AP на движение
		store.moveUnit('albedo', { x: 1, y: 1, z: 0, apCost: 1 })
		expect(albedo.ap).toBe(0)

		// После траты всех AP ход передается следующему живому бойцу (минуя погибших)
		expect(store.currentUnit.id).not.toBe('albedo')
		expect(store.currentUnit.hp).toBeGreaterThan(0)
	})

	it('settings.def.json и SettingsGeneral.vue поддерживают combatAnimations и combatSpeed', async () => {
		const fs = await import('fs')
		const path = await import('path')

		// 1. settings.def.json
		const defPath = path.resolve(__dirname, '../../public/settings.def.json')
		const defContent = JSON.parse(fs.readFileSync(defPath, 'utf-8'))
		expect(defContent.general.combatAnimations).toBe(true)
		expect(defContent.general.combatSpeed).toBe(1.0)

		// 2. SettingsGeneral.vue
		const vuePath = path.resolve(__dirname, '../../components/settings/SettingsGeneral.vue')
		const vueContent = fs.readFileSync(vuePath, 'utf-8')
		expect(vueContent).toContain('combatAnimations')
		expect(vueContent).toContain('combatSpeed')
		expect(vueContent).toContain('Анимации в бою')
		expect(vueContent).toContain('Скорость боя')
	})

	it('moveUnit списывает 1 AP и завершает ход при исчерпании всех AP', () => {
		store.initCombat(mockEncounter)
		const ainz = store.getUnit('ainz')
		expect(store.currentUnit.id).toBe('ainz')
		expect(ainz.ap).toBe(2)

		// 1-й шаг: тратит 1 AP, остаётся 1 AP, ход продолжается
		const move1 = store.moveUnit('ainz', { x: 1, y: 1, z: 0, facing: 'SE' })
		expect(move1).toBe(true)
		expect(ainz.ap).toBe(1)
		expect(store.currentUnit.id).toBe('ainz')

		// 2-й шаг: тратит последний 1 AP, остаётся 0 AP, ход передаётся дальше!
		const move2 = store.moveUnit('ainz', { x: 2, y: 1, z: 0, facing: 'SE' })
		expect(move2).toBe(true)
		expect(ainz.ap).toBe(0)
		expect(store.currentUnit.id).not.toBe('ainz')

		// Попытка ходить при 0 AP отклоняется
		const move3 = store.moveUnit('ainz', { x: 3, y: 1, z: 0, facing: 'SE' })
		expect(move3).toBe(false)
	})

	it('после перемещения способность стоимостью 2 AP блокируется из-за нехватки AP', () => {
		store.initCombat(mockEncounter)
		const mcIdx = store.turnQueue.indexOf('mc')
		store.currentUnitIndex = mcIdx
		store.phase = 'player_action'
		const mc = store.getUnit('mc')
		mc.ap = 2

		// Добавим способность стоимостью 2 AP
		const heavyStrike = {
			id: 'power_attack', name: 'Мощный удар', apCost: 2, mpCost: 0,
			minRange: 1, maxRange: 1, type: 'damage', power: 1.6, targetType: 'enemy'
		}
		mc.abilities.push(heavyStrike)

		const archer = store.getUnit('bandit_archer')
		archer.x = 1
		archer.y = 0
		mc.x = 0
		mc.y = 0

		// Делаем перемещение на 1 клетку (-1 AP)
		store.moveUnit('mc', { x: 0, y: 0, z: 0, facing: 'SE' })
		expect(mc.ap).toBe(1)

		// Теперь пытаемся применить heavyStrike (требует 2 AP)
		const archerHpBefore = archer.hp
		store.executeAction(heavyStrike, 'bandit_archer')

		// Действие не должно выполниться
		expect(archer.hp).toBe(archerHpBefore)
		expect(mc.ap).toBe(1)
	})

	it('Hit & Run: юнит с 3 AP может сделать шаг (1 AP), атаку (1 AP) и ещё один шаг (1 AP)', () => {
		store.initCombat(mockEncounter)
		const ainz = store.getUnit('ainz')
		ainz.ap = 3
		ainz.maxAp = 3

		const archer = store.getUnit('bandit_archer')
		ainz.x = 0
		ainz.y = 0
		archer.x = 2
		archer.y = 0

		// Шаг 1: сближение на 1 клетку
		store.moveUnit('ainz', { x: 1, y: 0, z: 0, facing: 'SE' })
		expect(ainz.ap).toBe(2)

		// Шаг 2: атака огненным болтом (1 AP)
		const fireBolt = ainz.abilities.find((a) => a.id === 'fire_bolt')
		const archerHpBefore = archer.hp
		store.executeAction(fireBolt, 'bandit_archer')
		expect(archer.hp).toBeLessThan(archerHpBefore)
		expect(ainz.ap).toBe(1)
		expect(store.currentUnit.id).toBe('ainz')

		// Шаг 3: отход назад в укрытие (1 AP)
		store.moveUnit('ainz', { x: 0, y: 0, z: 0, facing: 'NW' })
		expect(ainz.ap).toBe(0)
		// После исчерпания AP ход завершается
		expect(store.currentUnit.id).not.toBe('ainz')
	})

	it('ИИ противников: если тяжелое заклинание (2 AP) уже достает до цели, маг не тратит AP на движение', () => {
		store.initCombat(mockEncounter)
		const mageIdx = store.turnQueue.indexOf('bandit_mage')
		store.currentUnitIndex = mageIdx
		store.phase = 'enemy_action'
		const mage = store.getUnit('bandit_mage')
		mage.ap = 2
		mage.mp = 6
		mage.x = 0
		mage.y = 2

		// Добавим магу тяжелое заклинание 2 AP
		mage.abilities.push({
			id: 'fire_pillar', name: 'Огненный столп', apCost: 2, mpCost: 4,
			minRange: 1, maxRange: 3, type: 'damage', power: 2.0, targetType: 'enemy'
		})

		const ainz = store.getUnit('ainz')
		ainz.x = 0
		ainz.y = 0 // расстояние 2 кл (в радиусе 1-3)
		const ainzHpBefore = ainz.hp

		processEnemyTurn(store)

		// Маг не должен был менять координаты, а сразу применить заклинание
		expect(mage.x).toBe(0)
		expect(mage.y).toBe(2)
		expect(ainz.hp).toBeLessThan(ainzHpBefore)
	})

	it('профиль оружия: меч (sword) бьет по диагонали на 1 клетку, а копье (spear) бьет по прямой на 2 клетки', () => {
		const encounterWithWeapons = {
			allies: [
				{
					id: 'swordsman', name: 'Мечник', team: 'ally', class: 'fighter', weapon: 'sword',
					hp: 40, maxHp: 40, ap: 2, attack: 10, defense: 4, initiative: 10,
					x: 0, y: 0,
					abilities: [{ id: 'attack', name: 'Атака', apCost: 1, type: 'damage', power: 1.0, targetType: 'enemy' }]
				},
				{
					id: 'spearman', name: 'Копейщик', team: 'ally', class: 'warrior', weapon: 'spear',
					hp: 40, maxHp: 40, ap: 2, attack: 10, defense: 4, initiative: 8,
					x: 0, y: 0,
					abilities: [{ id: 'attack', name: 'Атака', apCost: 1, type: 'damage', power: 1.0, targetType: 'enemy' }]
				}
			],
			enemies: [
				{ id: 'diagEnemy', name: 'Враг диагональ', team: 'enemy', hp: 30, maxHp: 30, defense: 0, x: 1, y: 1 },
				{ id: 'straight2Enemy', name: 'Враг прямая 2кл', team: 'enemy', hp: 30, maxHp: 30, defense: 0, x: 0, y: 2 }
			]
		}

		store.initCombat(encounterWithWeapons)
		const swordsman = store.getUnit('swordsman')
		const spearman = store.getUnit('spearman')
		const diagEnemy = store.getUnit('diagEnemy')
		const straight2Enemy = store.getUnit('straight2Enemy')

		const swordAttack = swordsman.abilities.find((a) => a.id === 'attack')
		const spearAttack = spearman.abilities.find((a) => a.id === 'attack')

		// Меч может бить по диагонали (1, 1), но не достает по прямой до (0, 2)
		expect(store.isTargetInRange(swordsman, swordAttack, diagEnemy)).toBe(true)
		expect(store.isTargetInRange(swordsman, swordAttack, straight2Enemy)).toBe(false)

		// Копье достает по прямой до (0, 2), но НЕ может бить по диагонали (1, 1)
		expect(store.isTargetInRange(spearman, spearAttack, straight2Enemy)).toBe(true)
		expect(store.isTargetInRange(spearman, spearAttack, diagEnemy)).toBe(false)
	})

	it('способность с AoE (по площади) наносит урон сразу нескольким врагам в радиусе взрыва', () => {
		const aoeEncounter = {
			allies: [
				{
					id: 'mage', name: 'Маг', team: 'ally', class: 'mage',
					hp: 30, maxHp: 30, ap: 2, mp: 4, attack: 10, defense: 2, initiative: 10,
					x: 0, y: 0,
					abilities: [
						{
							id: 'fireball', name: 'Огненный шар', apCost: 2, mpCost: 0,
							minRange: 1, maxRange: 3, pattern: 'aoe_point', aoeRadius: 1,
							type: 'damage', power: 1.0, targetType: 'enemy'
						}
					]
				}
			],
			enemies: [
				{ id: 'e1', name: 'Враг 1 (центр)', team: 'enemy', hp: 30, maxHp: 30, defense: 0, x: 2, y: 0 },
				{ id: 'e2', name: 'Враг 2 (смежный)', team: 'enemy', hp: 30, maxHp: 30, defense: 0, x: 2, y: 1 },
				{ id: 'eFar', name: 'Враг вдали', team: 'enemy', hp: 30, maxHp: 30, defense: 0, x: 5, y: 5 }
			]
		}

		store.initCombat(aoeEncounter)
		const mage = store.getUnit('mage')
		const fireball = mage.abilities.find((a) => a.id === 'fireball')

		// Маг применяет fireball по цели e1 (центр взрыва)
		store.executeAction(fireball, 'e1')

		const e1 = store.getUnit('e1')
		const e2 = store.getUnit('e2')
		const eFar = store.getUnit('eFar')

		// И e1, и e2 попали под радиус 1 взрыва и получили урон
		expect(e1.hp).toBeLessThan(30)
		expect(e2.hp).toBeLessThan(30)
		// eFar остался невредим
		expect(eFar.hp).toBe(30)
	})

	describe('Knockback, Collision & Environmental Hazards', () => {
		let store

		beforeEach(() => {
			setActivePinia(createPinia())
			store = useCombatStore()
		})

		it('отталкивание перемещает цель на свободную клетку', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally', class: 'warrior',
						attack: 10, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'bandit', name: 'Бандит', team: 'enemy', class: 'fighter', hp: 50, maxHp: 50, defense: 2, initiative: 5, x: 1, y: 0 }
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'bandit')

			const bandit = store.getUnit('bandit')
			// Отброшен с (1, 0) на (2, 0)
			expect(bandit.x).toBe(2)
			expect(bandit.y).toBe(0)
			expect(bandit.hp).toBeLessThan(50)
		})

		it('столкновение с другим юнитом наносит урон обоим бойцам', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally',
						attack: 12, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0 },
					{ id: 'blocker', name: 'Преграда', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 4, x: 2, y: 0 }
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			const blocker = store.getUnit('blocker')

			// Цель не сдвинулась на клетку блокирующего
			expect(target.x).toBe(1)
			expect(target.y).toBe(0)

			// Цель получила базовый урон (12) + урон столкновения (6) = 18 урона -> hp = 32
			expect(target.hp).toBe(32)
			// Блокирующий юнит получил сопутствующий урон столкновения (6) -> hp = 44
			expect(blocker.hp).toBe(44)
		})

		it('столкновение со сплошным укрытием наносит урон от удара о стену', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally',
						attack: 10, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0 }
				],
				mapObjects: [
					{ id: 'wall', name: 'Каменная стена', x: 2, y: 0, solid: true }
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			// Не проник в стену
			expect(target.x).toBe(1)
			expect(target.y).toBe(0)
			// 10 базовый урон + 5 урон от стены = 15 -> hp = 35
			expect(target.hp).toBe(35)
		})

		it('сброс в бездну за край арены мгновенно уничтожает цель (Ring-Out)', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally',
						attack: 10, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель у края', team: 'enemy', hp: 100, maxHp: 100, defense: 0, initiative: 5, x: 1, y: 0 }
				],
				mapTiles: [
					{ x: 0, y: 0, type: 'stone' },
					{ x: 1, y: 0, type: 'stone' }
					// на (2, 0) тайла нет — пропасть!
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			expect(target.x).toBe(2)
			expect(target.hp).toBe(0) // мгновенная смерть
			expect(store.phase).toBe('win') // все враги повержены
		})

		it('летающий юнит не падает в пропасть при отталкивании', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally',
						attack: 5, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'gargoyle', name: 'Горгулья', flying: true, team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0 }
				],
				mapTiles: [
					{ x: 0, y: 0, type: 'stone' },
					{ x: 1, y: 0, type: 'stone' }
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'gargoyle')

			const gargoyle = store.getUnit('gargoyle')
			expect(gargoyle.x).toBe(2)
			expect(gargoyle.hp).toBe(45) // получил только базовый урон, жив и парит над бездной!
		})

		it('отталкивание в лаву наносит урон лавы и накладывает горение', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally',
						attack: 10, defense: 5, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0 }
				],
				mapTiles: [
					{ x: 0, y: 0, type: 'stone' },
					{ x: 1, y: 0, type: 'stone' },
					{ x: 2, y: 0, type: 'lava' }
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			expect(target.x).toBe(2)
			// 10 базовый урон + 6 урон лавы = 16 -> hp = 34
			expect(target.hp).toBe(34)
			expect(store.hasStatus(target, 'burning')).toBe(true)
		})

		it('горение наносит периодический урон в начале хода и уменьшает счетчик', () => {
			const encounter = {
				allies: [
					{ id: 'hero', name: 'Герой', team: 'ally', hp: 50, maxHp: 50, defense: 0, initiative: 10, ap: 2, maxAp: 2, x: 0, y: 0 }
				],
				enemies: [
					{ id: 'boss', name: 'Босс', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 1, ap: 2, maxAp: 2, x: 1, y: 1 }
				]
			}

			store.initCombat(encounter)
			const hero = store.getUnit('hero')
			// Накладываем горение на героя
			store.applyStatus('hero', { id: 'burning', name: 'Горение', turnsLeft: 2, damage: 4 })

			expect(hero.hp).toBe(50)
			expect(store.hasStatus(hero, 'burning')).toBe(true)

			// Передаем ход (пропускаем раунд)
			store.skipTurn() // hero skip -> boss turn
			store.skipTurn() // boss skip -> round 2 -> hero turn begins

			// В начале 2-го раунда герой получает 4 урона от горения
			expect(hero.hp).toBe(46)
		})

		it('отталкивание с уступа высотой >= 2 наносит цели урон от падения', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally', hp: 50, maxHp: 50,
						attack: 10, defense: 0, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0, z: 2,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0, z: 2 }
				],
				mapTiles: [
					{ x: 0, y: 0, z: 2, type: 'stone' },
					{ x: 1, y: 0, z: 2, type: 'stone' },
					{ x: 2, y: 0, z: 0, type: 'stone' } // уступ на 2 уровня вниз!
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			expect(target.x).toBe(2)
			expect(target.z).toBe(0)
			// Удар: attack 10 - def 0 = 10 урона.
			// Падение: heightDrop = 2, damage = Math.max(4*2, floor(10*0.5*2)) = 10 урона.
			// Всего 20 урона -> HP 30
			expect(target.hp).toBe(30)
		})

		it('удар щитом по врагу на льду (если сзади тоже лёд) отталкивает цель на 2 клетки вместо 1', () => {
			const encounter = {
				allies: [
					{
						id: 'albedo', name: 'Альбедо', team: 'ally', hp: 50, maxHp: 50,
						attack: 10, defense: 0, initiative: 10, ap: 2, maxAp: 2,
						x: 0, y: 0,
						abilities: [
							{ id: 'bash', name: 'Удар щитом', apCost: 1, mpCost: 0, minRange: 1, maxRange: 1, pattern: 'straight', type: 'damage', power: 1.0, knockback: 1, targetType: 'enemy' }
						]
					}
				],
				enemies: [
					{ id: 'target', name: 'Цель', team: 'enemy', hp: 50, maxHp: 50, defense: 0, initiative: 5, x: 1, y: 0 }
				],
				mapTiles: [
					{ x: 0, y: 0, type: 'stone' },
					{ x: 1, y: 0, type: 'ice' }, // враг стоит на льду
					{ x: 2, y: 0, type: 'ice' }, // сзади врага тоже лёд
					{ x: 3, y: 0, type: 'stone' } // конечная точка скольжения
				]
			}

			store.initCombat(encounter)
			const bash = store.getUnit('albedo').abilities[0]
			store.executeAction(bash, 'target')

			const target = store.getUnit('target')
			// Враг должен оказаться на x=3 (сдвиг на 2 клетки вместо 1!)
			expect(target.x).toBe(3)
			expect(store.combatLog.some((l) => l.text.includes('скользит по гладкому льду'))).toBe(true)
		})

		it('экспортирует функцию addLog и добавляет записи в combatLog', () => {
			expect(typeof store.addLog).toBe('function')
			store.addLog('Тестовое сообщение', 'info')
			expect(store.combatLog.some((l) => l.text === 'Тестовое сообщение')).toBe(true)
		})
	})
})


