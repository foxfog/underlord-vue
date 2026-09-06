// src/renderer/composables/__tests__/sympathyAndJournalVN.test.js

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ref } from 'vue'
import { initSettingsStore } from '../../stores/settings'
import { useVisualNovel } from '../useVisualNovel'
import { useEncyclopedia } from '../useEncyclopedia'

describe('Sympathy Notifications and Journal VN Integration', () => {
	let notificationComponent
	let enc

	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({})
		enc = useEncyclopedia()
		enc.resetEncyclopedia()
		notificationComponent = ref({
			showNotification: vi.fn()
		})
	})

	it('triggers positive notification when sympathy increases', () => {
		const vn = useVisualNovel({ notificationComponent })
		vn.globalData.value = { enri_mc_symp: 0 }
		vn.characterData.value = {
			enri: { id: 'enri', name: 'Энри', title: 'Энри Эммот' }
		}

		vn.applyVariable('global.enri_mc_symp += 1')

		expect(vn.globalData.value.enri_mc_symp).toBe(1)
		expect(notificationComponent.value.showNotification).toHaveBeenCalledTimes(1)
		const [html, type] = notificationComponent.value.showNotification.mock.calls[0]
		expect(type).toBe('success')
		expect(html).toContain('❤️')
		expect(html).toContain('Отношение улучшилось: Энри')
		expect(html).toContain('+1')
		expect(html).toContain('Симпатия: 1')
	})

	it('triggers warning notification when sympathy decreases', () => {
		const vn = useVisualNovel({ notificationComponent })
		vn.globalData.value = { enri_mc_symp: 2 }
		vn.characterData.value = {
			enri: { id: 'enri', name: 'Энри', title: 'Энри Эммот' }
		}

		vn.applyVariable('global.enri_mc_symp -= 1')

		expect(vn.globalData.value.enri_mc_symp).toBe(1)
		expect(notificationComponent.value.showNotification).toHaveBeenCalledTimes(1)
		const [html, type] = notificationComponent.value.showNotification.mock.calls[0]
		expect(type).toBe('warning')
		expect(html).toContain('💔')
		expect(html).toContain('Отношение ухудшилось: Энри')
		expect(html).toContain('-1')
		expect(html).toContain('Симпатия: 1')
	})

	it('processes type: "journal" step to add character and encyclopedia entries', () => {
		const vn = useVisualNovel({ notificationComponent })
		vn.characterData.value = {
			enri: { id: 'enri', name: 'Энри', title: 'Энри Эммот' }
		}

		// 1. Add character step
		vn.handleJournalStep({
			type: 'journal',
			target: 'character',
			id: 'enri',
			name: 'Энри',
			surname: 'Эммот',
			title: 'Энри Эммот',
			avatar: 'images/sprites/characters/enri/default.png',
			blocks: [
				{ id: 'meet', title: 'Знакомство', text: 'Встретила у ворот' }
			]
		})

		const char = enc.getCharacter('enri')
		expect(char).toBeDefined()
		expect(char.name).toBe('Энри')
		expect(char.blocks[0].text).toBe('Встретила у ворот')
		expect(notificationComponent.value.showNotification).toHaveBeenCalled()
		expect(notificationComponent.value.showNotification.mock.calls[0][0]).toContain('Новый персонаж в журнале')

		// 2. Add encyclopedia entry step
		vn.handleJournalStep({
			type: 'journal',
			target: 'encyclopedia',
			id: 'carne_village',
			category: 'geography',
			subCategory: 'settlements',
			title: 'Деревня Карн',
			blocks: [
				{ id: 'gen', title: 'Общие сведения', text: 'Глухая деревня' }
			]
		})

		const entry = enc.getEncyclopediaEntry('carne_village')
		expect(entry).toBeDefined()
		expect(entry.title).toBe('Деревня Карн')
		expect(entry.category).toBe('geography')
		expect(entry.subCategory).toBe('settlements')

		// 3. Update block step
		vn.handleJournalStep({
			type: 'journal',
			action: 'set-block',
			id: 'carne_village',
			blockId: 'gen',
			title: 'Общие сведения (обновлено)',
			text: 'Деревня Карн рядом с лесом'
		})

		const updatedEntry = enc.getEncyclopediaEntry('carne_village')
		expect(updatedEntry.blocks[0].title).toBe('Общие сведения (обновлено)')
		expect(updatedEntry.blocks[0].text).toBe('Деревня Карн рядом с лесом')
	})

	it('persists and restores encyclopedia state in game saves', async () => {
		const vn = useVisualNovel({ notificationComponent })
		vn.globalData.value = {}

		// Register character and entry
		enc.addCharacter({ id: 'enri', name: 'Энри' })
		enc.addEncyclopediaEntry({ id: 'carne', title: 'Карн', category: 'geography' })

		// Get game state
		const saved = vn.getGameState()
		expect(saved.globalData.encyclopedia).toBeDefined()
		expect(saved.globalData.encyclopedia.characters.length).toBe(1)
		expect(saved.globalData.encyclopedia.entries.length).toBe(1)

		// Reset encyclopedia
		enc.resetEncyclopedia()
		expect(enc.allCharacters.value.length).toBe(0)

		// Restore game state
		await vn.restoreGameState(saved)
		expect(enc.allCharacters.value.length).toBe(1)
		expect(enc.allEntries.value.length).toBe(1)
		expect(enc.getCharacter('enri')).toBeDefined()
	})
})
