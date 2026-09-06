import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'
import {
	extractCharacterDataDelta,
	mergeCharacterDataWithDefaults,
	createCharacterDefaults
} from '../../utils/saveGameUtils'

describe('Character Nickname and Title Resolution', () => {
	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
	})

	it('resolves speaker title using character.title by default when available', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.characterData.value = {
			mc: {
				id: 'mc',
				name: 'Анон',
				nickname: '',
				title: 'Анон'
			},
			momonga: {
				id: 'momonga',
				name: 'Момонга',
				nickname: 'Ainz',
				title: 'Владыка Аинз'
			}
		}

		// Uses title when available
		expect(vn.resolveSpeakerTitle('mc')).toBe('Анон')
		expect(vn.resolveSpeakerTitle('momonga')).toBe('Владыка Аинз')

		// When character.title is updated to nickname
		vn.characterData.value.mc.nickname = 'PlayerOne'
		vn.characterData.value.mc.title = 'PlayerOne'
		expect(vn.resolveSpeakerTitle('mc')).toBe('PlayerOne')
	})

	it('falls back to character.name if character.title is empty or missing', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.characterData.value = {
			mc: {
				id: 'mc',
				name: 'Анон',
				nickname: '',
				title: ''
			}
		}

		expect(vn.resolveSpeakerTitle('mc')).toBe('Анон')

		delete vn.characterData.value.mc.title
		expect(vn.resolveSpeakerTitle('mc')).toBe('Анон')
	})

	it('prioritizes explicit step title or speaker over character defaults', () => {
		const vn = useVisualNovel({ emit: vi.fn() })
		vn.characterData.value = {
			mc: {
				id: 'mc',
				name: 'Анон',
				title: 'Анон'
			}
		}

		// Explicit title overrides character title
		expect(vn.resolveSpeakerTitle('mc', 'Незнакомец в маске')).toBe('Незнакомец в маске')
		expect(vn.resolveSpeakerTitle(null, 'Голос из радио')).toBe('Голос из радио')
	})

	it('evaluates variable assignments between character title, name, and nickname in story flow', () => {
		const emit = vi.fn()
		const vn = useVisualNovel({ emit })
		vn.characterData.value = {
			mc: {
				id: 'mc',
				name: 'Анон',
				nickname: '',
				title: ''
			}
		}

		vn.storyData.value = {
			id: 'test_story',
			steps: [
				// Step 0: title = name
				{ variable: 'character.mc.title = character.mc.name' },
				// Step 1: Dialogue from mc (should display title "Анон")
				{ type: 'dialogue', character: 'mc', text: 'Первая реплика в реальном мире' },
				// Step 2: Nickname registration
				{ variable: 'character.mc.nickname = "Satoru"' },
				// Step 3: Arrival in new world sets title = nickname
				{ variable: 'character.mc.title = character.mc.nickname || character.mc.name' },
				// Step 4: Dialogue from mc (should display title "Satoru")
				{ type: 'dialogue', character: 'mc', text: 'Реплика в Новом Мире' },
				// Step 5: Dialogue with explicit title override
				{ type: 'dialogue', character: 'mc', title: '???', text: 'Таинственная реплика' }
			]
		}
		vn.stepIndex.value = 0

		// Step 0 + 1 (variable steps auto-advance to the dialogue step)
		vn.processStep()
		expect(vn.characterData.value.mc.title).toBe('Анон')
		expect(vn.currentSpeaker.value).toBe('Анон')
		expect(vn.currentDialogue.value).toBe('Первая реплика в реальном мире')

		// Advance to step 2 + 3 + 4
		vn.advanceStory()
		expect(vn.characterData.value.mc.nickname).toBe('Satoru')
		expect(vn.characterData.value.mc.title).toBe('Satoru')
		expect(vn.currentSpeaker.value).toBe('Satoru')
		expect(vn.currentDialogue.value).toBe('Реплика в Новом Мире')

		// Advance to step 5 (explicit title override)
		vn.advanceStory()
		expect(vn.currentSpeaker.value).toBe('???')
		expect(vn.currentDialogue.value).toBe('Таинственная реплика')
	})

	it('preserves nickname and title in delta and restores them on load', () => {
		const initialDefaults = createCharacterDefaults({
			mc: {
				id: 'mc',
				name: 'Анон',
				nickname: '',
				title: '',
				hp: 10
			}
		})

		const activeCharacterState = {
			mc: {
				id: 'mc',
				name: 'Анон',
				nickname: 'OverlordKing',
				title: 'OverlordKing',
				hp: 10
			}
		}

		// Extract delta
		const delta = extractCharacterDataDelta(activeCharacterState, initialDefaults)
		expect(delta.mc).toBeDefined()
		expect(delta.mc.nickname).toBe('OverlordKing')
		expect(delta.mc.title).toBe('OverlordKing')
		expect(delta.mc.hp).toBeUndefined() // hp didn't change, so not in delta

		// Merge delta with defaults
		const restored = mergeCharacterDataWithDefaults(initialDefaults, delta)
		expect(restored.mc.nickname).toBe('OverlordKing')
		expect(restored.mc.title).toBe('OverlordKing')
		expect(restored.mc.name).toBe('Анон')
		expect(restored.mc.hp).toBe(10)
	})
})
