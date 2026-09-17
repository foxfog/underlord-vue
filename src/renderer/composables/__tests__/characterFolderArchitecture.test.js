import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { useDataEditor } from '../useDataEditor.js'

describe('Character Folder Architecture & Canon Spellings', () => {
	const charactersDir = path.resolve(__dirname, '../../public/data/characters')
	const fractionsPath = path.resolve(__dirname, '../../public/data/fractions/fractions.json')
	const localesRuFractionsPath = path.resolve(__dirname, '../../public/data/locales/ru/fractions.json')
	const localesEnFractionsPath = path.resolve(__dirname, '../../public/data/locales/en/fractions.json')

	it('ensures characters_data.json is completely removed', () => {
		const deprecatedFile = path.join(charactersDir, 'characters_data.json')
		expect(fs.existsSync(deprecatedFile)).toBe(false)
	})

	it('ensures all registered characters in characters.json have valid folder structure', () => {
		const registryPath = path.join(charactersDir, 'characters.json')
		expect(fs.existsSync(registryPath)).toBe(true)

		const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'))
		expect(Array.isArray(registry.characters)).toBe(true)
		expect(registry.characters).toEqual(
			expect.arrayContaining(['mc', 'momonga', 'albedo', 'enri', 'carne-chief'])
		)

		for (const charId of registry.characters) {
			const charDir = path.join(charactersDir, charId)
			expect(fs.existsSync(charDir)).toBe(true)

			const valuesFile = path.join(charDir, 'values.json')
			expect(fs.existsSync(valuesFile)).toBe(true)

			const values = JSON.parse(fs.readFileSync(valuesFile, 'utf-8'))
			expect(values.id).toBe(charId)
			expect(values.name).toBeTruthy()
			expect(Array.isArray(values.races)).toBe(true)
			expect(Array.isArray(values.classs)).toBe(true)
			expect(Array.isArray(values.fractions)).toBe(true)
			expect(Array.isArray(values.tags)).toBe(true)

			const bodyFile = path.join(charDir, 'body.json')
			expect(fs.existsSync(bodyFile)).toBe(true)

			const equipFile = path.join(charDir, 'equipment.json')
			expect(fs.existsSync(equipFile)).toBe(true)
		}
	})

	it('ensures Nazarick is spelled canonically as "nazarick" across character files and fractions', () => {
		const momongaValues = JSON.parse(
			fs.readFileSync(path.join(charactersDir, 'momonga/values.json'), 'utf-8')
		)
		expect(momongaValues.fractions).toContain('nazarick')
		expect(momongaValues.fractions).not.toContain('nazaric')
		expect(momongaValues.tags).toContain('nazarick-leader')
		expect(momongaValues.tags).not.toContain('nazaric-leader')

		const albedoValues = JSON.parse(
			fs.readFileSync(path.join(charactersDir, 'albedo/values.json'), 'utf-8')
		)
		expect(albedoValues.fractions).toContain('nazarick')
		expect(albedoValues.fractions).not.toContain('nazaric')

		const fractions = JSON.parse(fs.readFileSync(fractionsPath, 'utf-8'))
		const nazarickFraction = fractions.find((f) => f.id === 'nazarick')
		expect(nazarickFraction).toBeDefined()
		expect(nazarickFraction.name).toContain('Назарик')

		const invalidNazaric = fractions.find((f) => f.id === 'nazaric')
		expect(invalidNazaric).toBeUndefined()
	})

	it('ensures carne-village is registered in fractions.json and correctly referenced', () => {
		const fractions = JSON.parse(fs.readFileSync(fractionsPath, 'utf-8'))
		const carneVillage = fractions.find((f) => f.id === 'carne-village')
		expect(carneVillage).toBeDefined()
		expect(carneVillage.type).toBe('settlement')
		expect(carneVillage.parent_id).toBe('re-estize')

		const enriValues = JSON.parse(
			fs.readFileSync(path.join(charactersDir, 'enri/values.json'), 'utf-8')
		)
		expect(enriValues.fractions).toContain('carne-village')

		const chiefValues = JSON.parse(
			fs.readFileSync(path.join(charactersDir, 'carne-chief/values.json'), 'utf-8')
		)
		expect(chiefValues.fractions).toContain('carne-village')
	})

	it('ensures locales have no "pnines-own-goal" or "nazaric" and no "Э-Рантgroups" typo', () => {
		const ruFractions = JSON.parse(fs.readFileSync(localesRuFractionsPath, 'utf-8'))
		expect(ruFractions['nazaric']).toBeUndefined()
		expect(ruFractions['pnines-own-goal']).toBeUndefined()
		expect(ruFractions['nazarick']).toBeDefined()
		expect(ruFractions['sorcerer-kingdom']?.description).not.toContain('Э-Рантgroups')
		expect(ruFractions['sorcerer-kingdom']?.description).toContain('Э-Рантеле')

		const enFractions = JSON.parse(fs.readFileSync(localesEnFractionsPath, 'utf-8'))
		expect(enFractions['nazaric']).toBeUndefined()
		expect(enFractions['pnines-own-goal']).toBeUndefined()
		expect(enFractions['nazarick']).toBeDefined()
	})

	it('useDataEditor loads characters from folder and saves to characters/{id}/values.json with scaffolding', async () => {
		const editor = useDataEditor()
		const writtenFiles = {}

		vi.stubGlobal('window', {
			electronAPI: {
				dataEditor: {
					readFile: vi.fn(async (relPath) => {
						if (relPath === 'characters/characters.json') {
							return { success: true, data: { characters: ['test_scaffold_hero'] } }
						}
						if (relPath === 'characters/test_scaffold_hero/values.json') {
							return {
								success: true,
								data: {
									id: 'test_scaffold_hero',
									name: 'Тестовый герой',
									gender: 'male',
									races: ['human'],
									classs: ['warrior'],
									fractions: [],
									tags: ['hero']
								}
							}
						}
						if (writtenFiles[relPath]) {
							return { success: true, data: writtenFiles[relPath] }
						}
						return { success: false, notFound: true }
					}),
					writeFile: vi.fn(async (relPath, data) => {
						writtenFiles[relPath] = data
						return { success: true, path: relPath }
					}),
					deleteFile: vi.fn(async (relPath) => {
						delete writtenFiles[relPath]
						return { success: true }
					})
				}
			}
		})

		await editor.loadAll()
		const hero = editor.entities.value.characters.find((c) => c.id === 'test_scaffold_hero')
		expect(hero).toBeDefined()
		expect(hero.name).toBe('Тестовый герой')

		// Save new character
		const newChar = {
			id: 'test_new_npc',
			name: 'Новый НИП',
			gender: 'female',
			races: ['human'],
			classs: ['cleric'],
			fractions: ['carne-village'],
			tags: ['villager']
		}
		editor.activeTab.value = 'characters'
		editor.startCreate()
		await editor.saveEntity('characters', newChar)

		// Check values.json written
		expect(writtenFiles['characters/test_new_npc/values.json']).toBeDefined()
		expect(writtenFiles['characters/test_new_npc/values.json'].id).toBe('test_new_npc')
		expect(writtenFiles['characters/test_new_npc/values.json'].classs).toEqual(['cleric'])

		// Check scaffolding of body.json and equipment.json
		expect(writtenFiles['characters/test_new_npc/body.json']).toBeDefined()
		expect(writtenFiles['characters/test_new_npc/equipment.json']).toBeDefined()

		// Check characters.json registry updated
		expect(writtenFiles['characters/characters.json']).toBeDefined()
		expect(writtenFiles['characters/characters.json'].characters).toContain('test_new_npc')

		// Delete character
		await editor.deleteEntity('characters', 'test_new_npc')
		expect(editor.entities.value.characters.some((c) => c.id === 'test_new_npc')).toBe(false)
		expect(writtenFiles['characters/characters.json'].characters).not.toContain('test_new_npc')

		vi.unstubAllGlobals()
	})
})