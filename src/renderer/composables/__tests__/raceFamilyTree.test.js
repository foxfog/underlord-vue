// src/renderer/composables/__tests__/raceFamilyTree.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'
import racesData from '@data/races/races.json'
import ruRaces from '@data/locales/ru/races.json'
import enRaces from '@data/locales/en/races.json'
import tagsData from '@data/tags/tags.json'

describe('Race Family and Tree Structure', () => {
	let editor

	beforeEach(() => {
		editor = useDataEditor()
		editor.entities.value.races = racesData.map((r) => ({ ...r }))
	})

	it('loads valid races with family and standard fields', () => {
		expect(racesData.length).toBeGreaterThanOrEqual(114)

		const validCategories = ['humanoid', 'demi-human', 'heteromorphic']
		const validTiers = ['basic', 'advanced', 'rare']

		for (const race of racesData) {
			expect(race.id).toBeTruthy()
			expect(race.name).toBeTruthy()
			expect(race.icon).toBeTruthy()
			expect(race.family).toBeTruthy()
			expect(validCategories).toContain(race.category)
			expect(validTiers).toContain(race.tier)
			expect(Array.isArray(race.tags)).toBe(true)
			expect(typeof race.lvl_min).toBe('number')
			expect(race.lvl_min).toBeGreaterThanOrEqual(1)
			expect(race.description !== undefined).toBe(true)
		}
	})

	it('ensures all parent_id references point to existing race IDs', () => {
		const raceIds = new Set(racesData.map((r) => r.id))

		for (const race of racesData) {
			if (!race.parent_id) continue

			const parentIds = race.parent_id.split(',').map((s) => s.trim())
			for (const pid of parentIds) {
				expect(raceIds.has(pid), `Race ${race.id} has invalid parent_id: "${pid}"`).toBe(true)
			}
		}
	})

	it('verifies multiple-parent races exist and resolve correctly', () => {
		const multiParentRaces = racesData.filter((r) => r.parent_id && r.parent_id.includes(','))
		expect(multiParentRaces.length).toBeGreaterThan(0)

		const multiIds = multiParentRaces.map((r) => r.id)
		expect(multiIds).toContain('vampire-lord')
		expect(multiIds).toContain('devil')
		expect(multiIds).toContain('alicorn')
		expect(multiIds).toContain('fire-lord')
		expect(multiIds).toContain('tidal-lord')
		expect(multiIds).toContain('earth-lord')
		expect(multiIds).toContain('storm-lord')
	})

	it('groups multiple race branches under the same family', () => {
		const familyMap = new Map()
		for (const race of racesData) {
			if (!familyMap.has(race.family)) {
				familyMap.set(race.family, [])
			}
			familyMap.get(race.family).push(race)
		}

		// Distinct families grouped
		expect(familyMap.has('elf')).toBe(true)
		expect(familyMap.get('elf').map((r) => r.id)).toEqual(
			expect.arrayContaining(['half-elf', 'elf', 'dark-elf'])
		)

		expect(familyMap.has('beastman')).toBe(true)
		expect(familyMap.get('beastman').map((r) => r.id)).toEqual(
			expect.arrayContaining(['lizardman', 'quagoa', 'minotaur', 'centaur', 'naga', 'armot'])
		)

		expect(familyMap.has('elemental')).toBe(true)
		expect(familyMap.get('elemental').map((r) => r.id)).toEqual(
			expect.arrayContaining([
				'fire-elemental', 'elder-fire-elemental', 'magma-elemental', 'fire-lord',
				'water-elemental', 'elder-water-elemental', 'ice-elemental', 'tidal-lord',
				'earth-elemental', 'elder-earth-elemental', 'crystal-elemental', 'earth-lord',
				'air-elemental', 'elder-air-elemental', 'storm-elemental', 'storm-lord'
			])
		)

		expect(familyMap.has('beast')).toBe(true)
		expect(familyMap.get('beast').map((r) => r.id)).toEqual(
			expect.arrayContaining(['wolf', 'horse', 'pegasus', 'unicorn'])
		)
	})

	it('editor creates empty race with family: null and normalizes family correctly', () => {
		const empty = editor.createEmptyEntity('races')
		expect(empty.family).toBeNull()

		const normalized = editor.normalizeEntity('races', {
			id: 'high-elf',
			name: 'Высший эльф',
			parent_id: 'elf',
			family: 'elf'
		})
		expect(normalized.family).toBe('elf')

		// Auto-inherits family from parent if family is omitted
		const inherited = editor.normalizeEntity('races', {
			id: 'forest-elf',
			name: 'Лесной эльф',
			parent_id: 'elf'
		})
		expect(inherited.family).toBe('elf')
	})

	it('locales (ru/en) and tags are synchronized with all races', () => {
		const tagSet = new Set(tagsData)

		for (const race of racesData) {
			expect(ruRaces[race.id], `Missing RU locale for ${race.id}`).toBeDefined()
			expect(ruRaces[race.id].name).toBeTruthy()
			expect(ruRaces[race.id].description !== undefined).toBe(true)

			expect(enRaces[race.id], `Missing EN locale for ${race.id}`).toBeDefined()
			expect(enRaces[race.id].name).toBeTruthy()
			expect(enRaces[race.id].description !== undefined).toBe(true)

			for (const t of race.tags) {
				expect(tagSet.has(t), `Tag "${t}" in race "${race.id}" is not in tags.json`).toBe(true)
			}
		}
	})
})
