// src/renderer/composables/__tests__/encyclopedia.test.js

import { describe, it, expect, beforeEach } from 'vitest'
import { useEncyclopedia, getAttitudeInfo } from '../useEncyclopedia'

describe('useEncyclopedia composable', () => {
	const enc = useEncyclopedia()

	beforeEach(() => {
		enc.resetEncyclopedia()
	})

	it('adds and retrieves characters with modular blocks', () => {
		const char = enc.addCharacter({
			id: 'enri',
			name: 'Энри',
			surname: 'Эммот',
			avatar: 'images/sprites/characters/enri/default.png',
			sympVariable: 'enri_mc_symp',
			titleVariable: 'enri_mc_title',
			blocks: [
				{ id: 'intro', title: 'Знакомство', text: 'Встретила нас у ворот.' }
			]
		})

		expect(char).toBeDefined()
		expect(char.id).toBe('enri')
		expect(char.title).toBe('Энри Эммот')
		expect(char.blocks.length).toBe(1)
		expect(char.blocks[0].text).toBe('Встретила нас у ворот.')

		const retrieved = enc.getCharacter('enri')
		expect(retrieved).toEqual(char)
		expect(enc.allCharacters.value.length).toBe(1)
	})

	it('adds and retrieves encyclopedia entries with categories and subcategories', () => {
		const entry = enc.addEncyclopediaEntry({
			id: 'carne_village',
			category: 'geography',
			subCategory: 'settlements',
			title: 'Деревня Карн',
			icon: '🏡',
			blocks: [
				{ id: 'loc', title: 'Расположение', text: 'Огорожена частоколом.' }
			]
		})

		expect(entry).toBeDefined()
		expect(entry.id).toBe('carne_village')
		expect(entry.category).toBe('geography')
		expect(entry.subCategory).toBe('settlements')

		const found = enc.getEncyclopediaEntry('carne_village')
		expect(found).toEqual(entry)

		const filtered = enc.getEntriesByCategory('geography', 'settlements')
		expect(filtered.length).toBe(1)
		expect(filtered[0].id).toBe('carne_village')
	})

	it('updates existing blocks and adds new blocks via setBlock', () => {
		enc.addCharacter({
			id: 'enri',
			name: 'Энри',
			blocks: [{ id: 'b1', title: 'Факт 1', text: 'Старый текст' }]
		})

		// Update existing block
		enc.setBlock({
			target: 'character',
			id: 'enri',
			blockId: 'b1',
			title: 'Факт 1 обновлен',
			text: 'Новый текст'
		})

		let enri = enc.getCharacter('enri')
		expect(enri.blocks.length).toBe(1)
		expect(enri.blocks[0].title).toBe('Факт 1 обновлен')
		expect(enri.blocks[0].text).toBe('Новый текст')

		// Add new block
		enc.setBlock({
			target: 'character',
			id: 'enri',
			blockId: 'b2',
			title: 'Факт 2',
			text: 'Дополнительный факт'
		})

		enri = enc.getCharacter('enri')
		expect(enri.blocks.length).toBe(2)
		expect(enri.blocks[1].id).toBe('b2')
		expect(enri.blocks[1].text).toBe('Дополнительный факт')
	})

	it('removes blocks via removeBlock', () => {
		enc.addEncyclopediaEntry({
			id: 'human',
			category: 'races',
			title: 'Люди',
			blocks: [
				{ id: 'b1', title: 'T1', text: 'Text 1' },
				{ id: 'b2', title: 'T2', text: 'Text 2' }
			]
		})

		enc.removeBlock({ target: 'encyclopedia', id: 'human', blockId: 'b1' })
		const entry = enc.getEncyclopediaEntry('human')
		expect(entry.blocks.length).toBe(1)
		expect(entry.blocks[0].id).toBe('b2')
	})

	it('correctly maps sympathy scores to attitude labels and colors', () => {
		expect(getAttitudeInfo(6).label).toBe('Преданное')
		expect(getAttitudeInfo(3).label).toBe('Дружелюбное')
		expect(getAttitudeInfo(1).label).toBe('Тёплое')
		expect(getAttitudeInfo(0).label).toBe('Нейтральное')
		expect(getAttitudeInfo(-1).label).toBe('Настороженное')
		expect(getAttitudeInfo(-3).label).toBe('Неприязненное')
		expect(getAttitudeInfo(-6).label).toBe('Враждебное')
	})

	it('persists and restores state via getState and loadState', () => {
		enc.addCharacter({ id: 'c1', name: 'Char 1' })
		enc.addEncyclopediaEntry({ id: 'e1', title: 'Entry 1', category: 'lore' })

		const state = enc.getState()
		expect(state.characters.length).toBe(1)
		expect(state.entries.length).toBe(1)

		enc.resetEncyclopedia()
		expect(enc.allCharacters.value.length).toBe(0)
		expect(enc.allEntries.value.length).toBe(0)

		enc.loadState(state)
		expect(enc.allCharacters.value.length).toBe(1)
		expect(enc.allEntries.value.length).toBe(1)
		expect(enc.getCharacter('c1').name).toBe('Char 1')
		expect(enc.getEncyclopediaEntry('e1').title).toBe('Entry 1')
	})
})
