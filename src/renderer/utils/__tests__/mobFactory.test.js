import { describe, it, expect } from 'vitest'
import {
	calculateStatsFromRaceAndClass,
	resolveMobLevel,
	resolveEquipmentForMob,
	resolveAbilitiesForMob,
	createMobInstance,
	resolveEncounterFromSquad,
	getMobTemplate,
	getMobPack
} from '../combat/mobFactory.js'
import { getStarRatingMeta, rollStarRating, isMobActiveInPhase } from '@/constants/mobs.js'

describe('mobFactory - Race and Class Stat Calculation', () => {
	it('calculates stats for human warrior level 1 and scales at level 5 without manual stats', () => {
		const lvl1 = calculateStatsFromRaceAndClass({
			raceId: 'human',
			classId: 'warrior',
			level: 1
		})

		expect(lvl1.hp).toBe(24)
		expect(lvl1.attack).toBe(6)
		expect(lvl1.defense).toBe(3)
		expect(lvl1.ap).toBe(2)
		expect(lvl1.classLevel).toBe(1)
		expect(lvl1.raceLevel).toBe(0) // humans have 0 race levels

		const lvl5 = calculateStatsFromRaceAndClass({
			raceId: 'human',
			classId: 'warrior',
			level: 5
		})

		expect(lvl5.hp).toBeGreaterThan(lvl1.hp)
		expect(lvl5.attack).toBeGreaterThan(lvl1.attack)
		expect(lvl5.defense).toBeGreaterThan(lvl1.defense)
		expect(lvl5.classLevel).toBe(5)
	})

	it('calculates stats for non-humanoid (skeleton) sharing levels between race and class', () => {
		const skeletonLvl5 = calculateStatsFromRaceAndClass({
			raceId: 'skeleton',
			classId: 'warrior',
			level: 5,
			raceRatio: 0.3
		})

		expect(skeletonLvl5.raceLevel).toBe(1)
		expect(skeletonLvl5.classLevel).toBe(4)
		expect(skeletonLvl5.hp).toBeGreaterThan(20)
		expect(skeletonLvl5.defense).toBeGreaterThan(3)
	})
})

describe('mobFactory - Level Resolution & Dynamic Scaling', () => {
	it('resolves direct number or range array', () => {
		expect(resolveMobLevel(4)).toBe(4)

		const ranged = resolveMobLevel([3, 5])
		expect(ranged).toBeGreaterThanOrEqual(3)
		expect(ranged).toBeLessThanOrEqual(5)
	})

	it('scales level dynamically with MC level, applying offset and bounds', () => {
		const scaled = resolveMobLevel(
			{
				scaleWith: 'mc',
				levelOffset: [-1, 1],
				minLevel: 2,
				maxLevel: 10
			},
			{ mcLevel: 5 }
		)

		expect(scaled).toBeGreaterThanOrEqual(4)
		expect(scaled).toBeLessThanOrEqual(6)

		// Check clamps
		const clampedMin = resolveMobLevel(
			{ scaleWith: 'mc', levelOffset: -10, minLevel: 3, maxLevel: 20 },
			{ mcLevel: 2 }
		)
		expect(clampedMin).toBe(3)

		const clampedMax = resolveMobLevel(
			{ scaleWith: 'mc', levelOffset: +10, minLevel: 1, maxLevel: 8 },
			{ mcLevel: 15 }
		)
		expect(clampedMax).toBe(8)
	})

	it('scales level dynamically with average party level', () => {
		const partyScaled = resolveMobLevel(
			{ scaleWith: 'party_avg', levelOffset: 0 },
			{ partyLevels: [3, 5, 7] }
		)
		expect(partyScaled).toBe(5)
	})
})

describe('mobFactory - Star Ratings & Equipment Loadouts', () => {
	it('resolves star rating metadata properly', () => {
		const weak = getStarRatingMeta(1)
		expect(weak.id).toBe('weak')
		expect(weak.hpMult).toBe(0.85)
		expect(weak.bonusAp).toBe(0)

		const elite = getStarRatingMeta(4)
		expect(elite.id).toBe('elite')
		expect(elite.hpMult).toBe(1.6)
		expect(elite.bonusAp).toBe(1)

		const legendary = getStarRatingMeta(5)
		expect(legendary.id).toBe('legendary')
		expect(legendary.hpMult).toBe(2.2)
		expect(legendary.bonusAp).toBe(1)
	})

	it('picks equipment tier matching mob level and star rating loadout', () => {
		const template = getMobTemplate('skeleton_warrior')
		expect(template).toBeDefined()

		// Level 2 with 1★ (weak)
		const eqWeak = resolveEquipmentForMob(template, 2, getStarRatingMeta(1))
		expect(eqWeak.weaponId).toBe('rusty_sword')

		// Level 2 with 3★ (strong)
		const eqStrong = resolveEquipmentForMob(template, 2, getStarRatingMeta(3))
		expect(eqStrong.weaponId).toBe('iron_sword')
		expect(eqStrong.shieldId).toBe('wooden_buckler')

		// Level 5 with 4★ (elite)
		const eqElite = resolveEquipmentForMob(template, 5, getStarRatingMeta(4))
		expect(eqElite.weaponId).toBe('adamantite_sword')
		expect(eqElite.shieldId).toBe('iron_shield')
	})

	it('generates 1-3 custom named artifact items for 5★ legendary mobs with regressive probability', () => {
		const template = getMobTemplate('skeleton_warrior')
		const star5 = getStarRatingMeta(5)

		// Test multiple rolls; 1st item is guaranteed 100%
		const eqLegendary = resolveEquipmentForMob(template, 6, star5)
		expect(eqLegendary.uniqueArtifacts.length).toBeGreaterThanOrEqual(1)
		expect(eqLegendary.uniqueArtifacts.length).toBeLessThanOrEqual(3)

		const firstArtifact = eqLegendary.uniqueArtifacts[0]
		expect(firstArtifact.isUnique).toBe(true)
		expect(firstArtifact.customName).toBeDefined()
		expect(typeof firstArtifact.customName).toBe('string')
		expect(firstArtifact.customName.length).toBeGreaterThan(3)
		expect(firstArtifact.quality).toBeGreaterThanOrEqual(1.3)
	})
})

describe('mobFactory - Abilities & Weapon Pattern Application', () => {
	it('combines guaranteed and level-appropriate pool abilities and applies weapon patterns', () => {
		const template = getMobTemplate('skeleton_warrior')
		const star3 = getStarRatingMeta(3)

		const abilities = resolveAbilitiesForMob(template, 3, star3, 'spear')
		expect(abilities.length).toBeGreaterThanOrEqual(2)

		// The attack ability should have spear pattern ('straight', minRange 1, maxRange 2)
		const basicAttack = abilities.find((a) => a.id === 'attack')
		expect(basicAttack).toBeDefined()
		expect(basicAttack.pattern).toBe('straight')
		expect(basicAttack.maxRange).toBe(2)
	})
})

describe('mobFactory - Complete Mob Instance & Encounter Generation', () => {
	it('creates full CombatUnit with calculated stats and star bonuses', () => {
		const mob = createMobInstance('skeleton_warrior', {
			level: 3,
			star: 3,
			x: 1,
			y: 2,
			z: 0
		})

		expect(mob.id).toBeDefined()
		expect(mob.team).toBe('enemy')
		expect(mob.level).toBe(3)
		expect(mob.star).toBe(3)
		expect(mob.hp).toBeGreaterThan(25)
		expect(mob.attack).toBeGreaterThan(6)
		expect(mob.ap).toBe(2)
		expect(mob.x).toBe(1)
		expect(mob.y).toBe(2)
		expect(mob.abilities.length).toBeGreaterThanOrEqual(1)
		expect(Array.isArray(mob.loot)).toBe(true)
		expect(mob.exp).toBeGreaterThan(10)
	})

	it('creates elite mob (4★) with +1 AP (total 3 AP) and increased stats', () => {
		const normalMob = createMobInstance('bandit_melee', { level: 3, star: 2 })
		const eliteMob = createMobInstance('bandit_melee', { level: 3, star: 4 })

		expect(normalMob.ap).toBe(2)
		expect(eliteMob.ap).toBe(3) // 2 + 1 bonus AP
		expect(eliteMob.hp).toBeGreaterThan(normalMob.hp)
		expect(eliteMob.attack).toBeGreaterThan(normalMob.attack)
		expect(eliteMob.name).toContain('Элитный')
	})

	it('supports direct manual stat overrides', () => {
		const customMob = createMobInstance('dire_wolf', {
			level: 2,
			star: 2,
			stats: { hp: 150, attack: 25 }
		})

		expect(customMob.hp).toBe(150)
		expect(customMob.attack).toBe(25)
	})

	it('resolves an entire tactical encounter from a squad pack', () => {
		const encounter = resolveEncounterFromSquad('skeleton_patrol', {
			mcLevel: 3,
			mcName: 'Анон'
		})

		expect(encounter.id).toBeDefined()
		expect(encounter.mapId).toBe('tests/arena_combat_test')
		expect(encounter.allies.length).toBeGreaterThanOrEqual(1)
		expect(encounter.enemies.length).toBe(3)

		// Each enemy has valid combat parameters
		for (const enemy of encounter.enemies) {
			expect(enemy.team).toBe('enemy')
			expect(enemy.hp).toBeGreaterThan(0)
			expect(enemy.ap).toBeGreaterThanOrEqual(2)
			expect(enemy.abilities.length).toBeGreaterThan(0)
		}
	})
})

describe('mobFactory - Time Phase Filters', () => {
	it('checks phase availability properly', () => {
		const dayMob = { activePhases: ['morning', 'day'] }
		expect(isMobActiveInPhase(dayMob, 'day')).toBe(true)
		expect(isMobActiveInPhase(dayMob, 'night')).toBe(false)

		const allPhasesMob = {}
		expect(isMobActiveInPhase(allPhasesMob, 'night')).toBe(true)
	})
})
