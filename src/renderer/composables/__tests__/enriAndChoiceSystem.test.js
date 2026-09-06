import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'
import fs from 'fs'
import path from 'path'

describe('Enri Emmot & Choice System Enhancements', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('has valid character data files for enri', () => {
		const basePath = path.resolve(process.cwd(), 'src/renderer/public/data/characters/enri')
		const values = JSON.parse(fs.readFileSync(path.join(basePath, 'values.json'), 'utf8'))
		const body = JSON.parse(fs.readFileSync(path.join(basePath, 'body.json'), 'utf8'))
		const equipment = JSON.parse(fs.readFileSync(path.join(basePath, 'equipment.json'), 'utf8'))

		expect(values.id).toBe('enri')
		expect(values.name).toBe('Энри')
		expect(values.surname).toBe('Эммот')
		expect(values.title).toBe('Энри Эммот')
		expect(body.body.image).toBe('images/sprites/characters/enri/default.png')
		expect(Array.isArray(equipment)).toBe(true)
	})

	it('resolves speaker title for enri correctly', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.characterData.value = {
			enri: {
				id: 'enri',
				name: 'Энри',
				surname: 'Эммот',
				title: 'Энри Эммот'
			}
		}

		// When explicit title is provided (e.g. before she introduces herself)
		expect(vn.resolveSpeakerTitle('enri', 'Девушка у ворот')).toBe('Девушка у ворот')

		// When no explicit title is provided, falls back to title
		expect(vn.resolveSpeakerTitle('enri')).toBe('Энри Эммот')
	})

	it('filters choices based on condition / if', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.globalData.value = {}

		const choiceStep = {
			type: 'choice',
			text: 'Выберите вариант:',
			options: [
				{
					text: 'Мысленный вариант',
					condition: '!global.enri_thought_done'
				},
				{
					text: 'Любезный ответ'
				},
				{
					text: 'Вульгарный ответ'
				}
			]
		}

		// Initially, enri_thought_done is not set, all 3 choices should be present
		vn.showChoices(choiceStep)
		expect(vn.currentChoices.value.length).toBe(3)
		expect(vn.currentChoices.value[0].text).toBe('Мысленный вариант')

		// After thought is done, condition evaluates to false and the thought option is filtered out
		vn.globalData.value.enri_thought_done = true
		vn.showChoices(choiceStep)
		expect(vn.currentChoices.value.length).toBe(2)
		expect(vn.currentChoices.value[0].text).toBe('Любезный ответ')
		expect(vn.currentChoices.value[1].text).toBe('Вульгарный ответ')
	})

	it('applies variable modifications in choice.actions and selectChoice', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.globalData.value = { enri_mc_symp: 0 }

		const choices = [
			{
				text: 'Любезный ответ',
				actions: [
					{ variable: 'global.enri_mc_symp += 1' }
				]
			},
			{
				text: 'Вульгарный ответ',
				actions: [
					{ variable: 'global.enri_mc_symp -= 1' }
				]
			}
		]

		vn.currentChoices.value = [...choices]
		vn.selectChoice(0)
		expect(vn.globalData.value.enri_mc_symp).toBe(1)

		// Test vulgar choice (-1 sympathy)
		vn.currentChoices.value = [...choices]
		vn.selectChoice(1)
		expect(vn.globalData.value.enri_mc_symp).toBe(0)

		vn.currentChoices.value = [...choices]
		vn.selectChoice(1)
		expect(vn.globalData.value.enri_mc_symp).toBe(-1)
	})

	it('applies choice.variable directly on choice object if defined', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.globalData.value = { score: 10 }

		vn.currentChoices.value = [
			{
				text: 'Бонус',
				variable: 'global.score += 5'
			}
		]

		vn.selectChoice(0)
		expect(vn.globalData.value.score).toBe(15)
	})

	it('uses center layout by default, and dialogue layout when explicitly specified', () => {
		const vn = useVisualNovel({ emit: vi.fn() })

		// Default choice layout
		vn.showChoices({
			type: 'choice',
			options: [{ text: 'Опция 1' }]
		})
		expect(vn.currentChoicesLayout.value).toBe('center')

		// Explicit dialogue layout via layout or position
		vn.showChoices({
			type: 'choice',
			layout: 'dialogue',
			options: [{ text: 'Опция диалога' }]
		})
		expect(vn.currentChoicesLayout.value).toBe('dialogue')

		vn.showChoices({
			type: 'choice',
			position: 'bottom',
			options: [{ text: 'Опция снизу' }]
		})
		expect(vn.currentChoicesLayout.value).toBe('dialogue')

		// Resets to center upon selectChoice
		vn.selectChoice(0)
		expect(vn.currentChoicesLayout.value).toBe('center')
	})

	it('handles Enri name introduction choice with name, nickname and rude options', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.characterData.value = {
			mc: {
				name: 'Анон',
				nickname: 'Анон'
			}
		}
		vn.globalData.value = {
			enri_mc_symp: 0,
			enri_mc_title: ''
		}

		const nameChoiceStep = {
			type: 'choice',
			speaker: 'mc',
			text: 'Как представиться девушке?',
			options: [
				{
					text: '{character.mc.name}',
					actions: [
						{ variable: 'global.enri_mc_title = character.mc.name' }
					]
				},
				{
					text: '{character.mc.nickname}',
					condition: 'character.mc.nickname && character.mc.nickname !== character.mc.name',
					actions: [
						{ variable: 'global.enri_mc_title = character.mc.nickname' }
					]
				},
				{
					text: 'Не твоё дело',
					actions: [
						{ variable: 'global.enri_mc_symp -= 1' },
						{ variable: "global.enri_mc_title = 'грубиян'" }
					]
				}
			]
		}

		// When name and nickname are identical, nickname option is omitted
		vn.showChoices(nameChoiceStep)
		expect(vn.currentChoices.value.length).toBe(2)
		expect(vn.currentChoices.value[0].text).toBe('Анон')
		expect(vn.currentChoices.value[1].text).toBe('Не твоё дело')

		// When name and nickname differ, all 3 options appear
		vn.characterData.value.mc.nickname = 'Момонга'
		vn.showChoices(nameChoiceStep)
		expect(vn.currentChoices.value.length).toBe(3)
		expect(vn.currentChoices.value[0].text).toBe('Анон')
		expect(vn.currentChoices.value[1].text).toBe('Момонга')
		expect(vn.currentChoices.value[2].text).toBe('Не твоё дело')

		// Selecting nickname option sets enri_mc_title to nickname
		vn.selectChoice(1)
		expect(vn.globalData.value.enri_mc_title).toBe('Момонга')

		// Selecting rude option sets enri_mc_title to 'грубиян' and decreases sympathy
		vn.showChoices(nameChoiceStep)
		vn.selectChoice(2)
		expect(vn.globalData.value.enri_mc_title).toBe('грубиян')
		expect(vn.globalData.value.enri_mc_symp).toBe(-1)
	})

	it('supports looping back to a choice step via goto in choice actions', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.globalData.value = { enri_thought_done: false, enri_mc_symp: 0 }

		const story = {
			steps: [
				{
					id: 'enri_gate_choice',
					type: 'choice',
					speaker: 'mc',
					text: 'Как ответить девушке у ворот?',
					options: [
						{
							text: 'Порассуждать',
							condition: '!global.enri_thought_done',
							actions: [
								{ variable: 'global.enri_thought_done = true' },
								{
									type: 'dialogue',
									character: 'mc',
									text: 'Мысль 1'
								},
								{
									type: 'dialogue',
									character: 'mc',
									text: 'Мысль 2'
								},
								{
									type: 'goto',
									target: 'enri_gate_choice'
								}
							]
						},
						{
							text: 'Любезный ответ',
							actions: [
								{ variable: 'global.enri_mc_symp += 1' },
								{
									type: 'dialogue',
									character: 'mc',
									text: 'Здравствуйте!'
								}
							]
						}
					]
				},
				{
					id: 'after_choice',
					type: 'dialogue',
					character: 'mc',
					text: 'Конец выбора'
				}
			]
		}

		vn.storyData.value = story
		vn.stepIndex.value = 0
		vn.processStep()

		// Initial display: 2 options (thought + polite)
		expect(vn.currentChoices.value.length).toBe(2)
		expect(vn.currentChoices.value[0].text).toBe('Порассуждать')

		// Select the thought option
		vn.selectChoice(0)
		expect(vn.globalData.value.enri_thought_done).toBe(true)
		expect(vn.currentChoices.value.length).toBe(0) // Choices hidden during monologue
		expect(vn.currentDialogue.value).toBe('Мысль 1')

		// Advance to thought 2
		vn.advanceStory()
		expect(vn.currentDialogue.value).toBe('Мысль 2')

		// Advance again -> executes goto: 'enri_gate_choice'
		vn.advanceStory()

		// Returned to enri_gate_choice!
		expect(vn.stepIndex.value).toBe(0)
		// Now thought option is filtered out because enri_thought_done is true
		expect(vn.currentChoices.value.length).toBe(1)
		expect(vn.currentChoices.value[0].text).toBe('Любезный ответ')
	})

	it('configures dynamic auto-height dialogue-box with min-height and ghost text container', () => {
		const cssPath = path.resolve(
			process.cwd(),
			'src/renderer/public/styles/game/visual-novel.css'
		)
		const css = fs.readFileSync(cssPath, 'utf8')

		// Dialogue box must have min-height and height auto
		expect(css).toMatch(/min-height:\s*20%/)
		expect(css).toMatch(/height:\s*auto/)
		expect(css).toMatch(/\.dialogue-text-container/)
		expect(css).toMatch(/\.dialogue-text-ghost/)

		// Must obey AGENTS.md: no px in dialogue-box styles
		const dialogueBoxSection = css.substring(
			css.indexOf('.dialogue-box'),
			css.indexOf('.choices-overlay')
		)
		expect(dialogueBoxSection).not.toMatch(/\d+px/)
		expect(dialogueBoxSection).not.toMatch(/\d+rem/)

		// DialogueBox.vue must have dialogue-text-container and dialogue-text-ghost
		const vuePath = path.resolve(
			process.cwd(),
			'src/renderer/components/game/visual-novel/DialogueBox.vue'
		)
		const vueContent = fs.readFileSync(vuePath, 'utf8')
		expect(vueContent).toContain('dialogue-text-container')
		expect(vueContent).toContain('dialogue-text-ghost')
	})
})
