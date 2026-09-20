import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'

describe('Class & Race Skill File Separation and Management', () => {
	let editor
	let writtenFiles = {}
	let deletedFiles = []

	beforeEach(() => {
		writtenFiles = {}
		deletedFiles = []
		editor = useDataEditor()
		editor.isCreating.value = false
		editor.selectedEntity.value = null

		globalThis.window = {
			electronAPI: {
				dataEditor: {
					readFile: vi.fn(async (relPath) => {
						if (relPath === 'classes/classes.json') {
							return {
								success: true,
								data: [
									{ id: 'warrior', name: 'Воин', parent_id: null, category: 'combat' },
									{ id: 'wizard', name: 'Маг', parent_id: null, category: 'combat' }
								]
							}
						}
						if (relPath === 'races/races.json') {
							return {
								success: true,
								data: [
									{ id: 'human', name: 'Человек', parent_id: null, category: 'humanoid' },
									{ id: 'skeleton', name: 'Скелет', parent_id: null, category: 'heteromorphic' }
								]
							}
						}
						if (relPath === 'skills/classes/warrior.json') {
							return {
								success: true,
								data: {
									skill_branches: [{ id: 'sword', name: 'Владение мечом' }],
									skills: [{ id: 'slash', name: 'Рубящий удар', branch: 'sword' }]
								}
							}
						}
						if (relPath === 'skills/races/skeleton.json') {
							return {
								success: true,
								data: {
									skill_branches: [{ id: 'bone', name: 'Костяная защита' }],
									skills: [{ id: 'bone_armor', name: 'Костяной доспех', branch: 'bone' }]
								}
							}
						}
						if (relPath === 'skills/skills.json') {
							return {
								success: true,
								data: [
									{ id: 'slash', name: 'Рубящий удар', icon: '⚔️', category: 'active' }
								]
							}
						}
						return { success: false, notFound: true }
					}),
					writeFile: vi.fn(async (relPath, data) => {
						writtenFiles[relPath] = data
						return { success: true }
					}),
					deleteFile: vi.fn(async (relPath) => {
						deletedFiles.push(relPath)
						return { success: true }
					}),
					listFiles: vi.fn(async (relDir) => {
						if (relDir === 'skills/classes') {
							return { success: true, files: ['warrior.json'] }
						}
						if (relDir === 'skills/races') {
							return { success: true, files: ['skeleton.json'] }
						}
						return { success: true, files: [] }
					})
				}
			}
		}
	})

	it('loadAll attaches skills and skill_branches from dedicated skill files into in-memory entities', async () => {
		await editor.loadAll()

		const warrior = editor.entities.value.classes.find((c) => c.id === 'warrior')
		expect(warrior).toBeDefined()
		expect(warrior.skill_branches).toEqual([{ id: 'sword', name: 'Владение мечом' }])
		expect(warrior.skills).toEqual([{ id: 'slash', name: 'Рубящий удар', branch: 'sword' }])

		const wizard = editor.entities.value.classes.find((c) => c.id === 'wizard')
		expect(wizard).toBeDefined()
		expect(wizard.skills).toBeUndefined()

		const skeleton = editor.entities.value.races.find((r) => r.id === 'skeleton')
		expect(skeleton).toBeDefined()
		expect(skeleton.skill_branches).toEqual([{ id: 'bone', name: 'Костяная защита' }])
		expect(skeleton.skills).toEqual([{ id: 'bone_armor', name: 'Костяной доспех', branch: 'bone' }])
	})

	it('persistTypeToFile strips skill_branches and skills from classes.json and races.json', async () => {
		editor.entities.value.classes = [
			{
				id: 'warrior',
				name: 'Воин',
				category: 'combat',
				skill_branches: [{ id: 'sword', name: 'Меч' }],
				skills: [{ id: 'slash', name: 'Удар' }]
			}
		]
		editor.entities.value.races = [
			{
				id: 'skeleton',
				name: 'Скелет',
				category: 'heteromorphic',
				skill_branches: [{ id: 'bone', name: 'Кость' }],
				skills: [{ id: 'bone_armor', name: 'Броня' }]
			}
		]

		await editor.persistTypeToFile('classes')
		expect(writtenFiles['classes/classes.json']).toBeDefined()
		expect(writtenFiles['classes/classes.json'][0].skill_branches).toBeUndefined()
		expect(writtenFiles['classes/classes.json'][0].skills).toBeUndefined()
		expect(writtenFiles['classes/classes.json'][0].id).toBe('warrior')

		await editor.persistTypeToFile('races')
		expect(writtenFiles['races/races.json']).toBeDefined()
		expect(writtenFiles['races/races.json'][0].skill_branches).toBeUndefined()
		expect(writtenFiles['races/races.json'][0].skills).toBeUndefined()
		expect(writtenFiles['races/races.json'][0].id).toBe('skeleton')
	})

	it('saveEntity writes skills/<type>/<id>.json when skills are present', async () => {
		editor.entities.value.classes = [
			{
				id: 'archer',
				name: 'Лучник',
				category: 'combat',
				parent_id: null
			}
		]

		const archerWithSkills = {
			id: 'archer',
			name: 'Лучник',
			category: 'combat',
			parent_id: null,
			skill_branches: [{ id: 'bow', name: 'Луки' }],
			skills: [{ id: 'pierce', name: 'Пронзающий выстрел', branch: 'bow' }]
		}

		await editor.saveEntity('classes', archerWithSkills)

		// Check classes.json has no skills
		expect(writtenFiles['classes/classes.json']).toBeDefined()
		const savedClass = writtenFiles['classes/classes.json'].find((c) => c.id === 'archer')
		expect(savedClass.skill_branches).toBeUndefined()
		expect(savedClass.skills).toBeUndefined()

		// Check skills/classes/archer.json was written
		expect(writtenFiles['skills/classes/archer.json']).toBeDefined()
		expect(writtenFiles['skills/classes/archer.json'].skill_branches).toEqual([
			expect.objectContaining({ id: 'bow', name: 'Луки' })
		])
		expect(writtenFiles['skills/classes/archer.json'].skills).toEqual([
			expect.objectContaining({ id: 'pierce', name: 'Пронзающий выстрел', branch: 'bow' })
		])
	})

	it('saveEntity deletes skills/<type>/<id>.json when entity has no skills', async () => {
		editor.entities.value.classes = [
			{
				id: 'novice',
				name: 'Новичок',
				category: 'combat',
				parent_id: null,
				skills: [],
				skill_branches: []
			}
		]

		await editor.saveEntity('classes', {
			id: 'novice',
			name: 'Новичок',
			category: 'combat',
			parent_id: null
		})

		expect(deletedFiles).toContain('skills/classes/novice.json')
	})

	it('deleteEntity deletes associated skills/<type>/<id>.json', async () => {
		editor.entities.value.classes = [
			{
				id: 'warrior',
				name: 'Воин',
				category: 'combat',
				parent_id: null
			}
		]

		await editor.deleteEntity('classes', 'warrior')

		expect(deletedFiles).toContain('skills/classes/warrior.json')
	})

	it('loads central skillsCatalog from skills/skills.json on loadAll', async () => {
		await editor.loadAll()
		expect(editor.skillsCatalog.value).toHaveLength(1)
		expect(editor.skillsCatalog.value[0].id).toBe('slash')
		expect(editor.skillsCatalog.value[0].name).toBe('Рубящий удар')
	})

	it('saveSkillToCatalog adds/updates central catalog and writes skills/skills.json', async () => {
		await editor.loadAll()

		await editor.saveSkillToCatalog({
			id: 'night_vision',
			name: 'Ночное зрение',
			icon: '👁️',
			category: 'passive',
			description: 'Видит в темноте',
			data: { radius: 15 }
		})

		expect(writtenFiles['skills/skills.json']).toBeDefined()
		const saved = writtenFiles['skills/skills.json'].find((s) => s.id === 'night_vision')
		expect(saved).toBeDefined()
		expect(saved.name).toBe('Ночное зрение')
		expect(saved.data).toEqual({ radius: 15 })

		// Update existing
		await editor.saveSkillToCatalog({
			id: 'night_vision',
			name: 'Ночное зрение II',
			icon: '👁️',
			category: 'passive',
			description: 'Улучшенное видение',
			data: { radius: 25 }
		})

		const updated = writtenFiles['skills/skills.json'].find((s) => s.id === 'night_vision')
		expect(updated.name).toBe('Ночное зрение II')
		expect(updated.data.radius).toBe(25)
	})

	it('deleteSkillFromCatalog removes skill from catalog and writes skills/skills.json', async () => {
		await editor.loadAll()

		await editor.saveSkillToCatalog({
			id: 'temp_skill',
			name: 'Временный скил'
		})

		expect(editor.skillsCatalog.value.some((s) => s.id === 'temp_skill')).toBe(true)

		await editor.deleteSkillFromCatalog('temp_skill')

		expect(editor.skillsCatalog.value.some((s) => s.id === 'temp_skill')).toBe(false)
		expect(writtenFiles['skills/skills.json'].some((s) => s.id === 'temp_skill')).toBe(false)
	})
})
