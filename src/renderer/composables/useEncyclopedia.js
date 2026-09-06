// src/renderer/composables/useEncyclopedia.js

import { ref, computed } from 'vue'

// Singleton reactive state shared across components
const characters = ref([])
const encyclopediaEntries = ref([])

let globalGameStateRef = null

export const ENCYCLOPEDIA_CATEGORIES = [
	{
		id: 'races',
		title: 'Расы',
		icon: '👥'
	},
	{
		id: 'geography',
		title: 'География',
		icon: '🗺️',
		subCategories: [
			{ id: 'settlements', title: 'Населённые пункты', icon: '🏡' },
			{ id: 'regions', title: 'Регионы и земли', icon: '🌲' },
			{ id: 'dungeons', title: 'Подземелья и руины', icon: '🏛️' }
		]
	},
	{
		id: 'factions',
		title: 'Фракции и организации',
		icon: '⚔️'
	},
	{
		id: 'lore',
		title: 'Мир и история',
		icon: '📜'
	}
]

export function getAttitudeInfo(symp) {
	const val = typeof symp === 'number' ? symp : Number(symp) || 0
	if (val >= 5) return { label: 'Преданное', color: '#ec4899', icon: '💖', val }
	if (val >= 2) return { label: 'Дружелюбное', color: '#22c55e', icon: '💚', val }
	if (val === 1) return { label: 'Тёплое', color: '#4ade80', icon: '😊', val }
	if (val === 0) return { label: 'Нейтральное', color: '#94a3b8', icon: '😐', val }
	if (val === -1) return { label: 'Настороженное', color: '#f59e0b', icon: '🤨', val }
	if (val <= -2 && val > -5) return { label: 'Неприязненное', color: '#ef4444', icon: '😠', val }
	return { label: 'Враждебное', color: '#dc2626', icon: '😡', val }
}

export function useEncyclopedia(gameState = null) {
	if (gameState) {
		globalGameStateRef = gameState
	}

	const allCharacters = computed(() => characters.value)
	const allEntries = computed(() => encyclopediaEntries.value)

	function syncToGameState() {
		if (globalGameStateRef && globalGameStateRef.global) {
			globalGameStateRef.global.encyclopedia = getState()
		}
	}

	function addCharacter({
		id,
		name,
		surname = '',
		title = '',
		avatar = '',
		sympVariable = '',
		titleVariable = '',
		defaultTitle = 'Путник',
		blocks = []
	}) {
		if (!id) return null

		const existing = characters.value.find((c) => c.id === id)
		const formattedBlocks = Array.isArray(blocks)
			? blocks.map((b, idx) => ({
					id: b.id || `block_${idx}`,
					title: b.title || '',
					text: b.text || ''
			  }))
			: []

		if (existing) {
			if (name) existing.name = name
			if (surname) existing.surname = surname
			if (title) existing.title = title
			if (avatar) existing.avatar = avatar
			if (sympVariable) existing.sympVariable = sympVariable
			if (titleVariable) existing.titleVariable = titleVariable
			if (defaultTitle) existing.defaultTitle = defaultTitle

			if (formattedBlocks.length > 0) {
				existing.blocks = existing.blocks || []
				formattedBlocks.forEach((newBlock) => {
					const bIndex = existing.blocks.findIndex((b) => b.id === newBlock.id)
					if (bIndex !== -1) {
						existing.blocks[bIndex] = { ...existing.blocks[bIndex], ...newBlock }
					} else {
						existing.blocks.push(newBlock)
					}
				})
			}
			syncToGameState()
			return existing
		}

		const newChar = {
			id,
			name: name || id,
			surname,
			title: title || (name ? (surname ? `${name} ${surname}` : name) : id),
			avatar,
			sympVariable: sympVariable || `${id}_mc_symp`,
			titleVariable: titleVariable || `${id}_mc_title`,
			defaultTitle,
			blocks: formattedBlocks,
			discoveredAt: Date.now()
		}

		characters.value.push(newChar)
		syncToGameState()

		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('journal-character-added', { detail: newChar }))
		}

		console.log(`👤 [Journal Character Added] ${newChar.title} (${newChar.id})`)
		return newChar
	}

	function addEncyclopediaEntry({
		id,
		category = 'lore',
		subCategory = null,
		title = '',
		icon = null,
		image = null,
		blocks = []
	}) {
		if (!id) return null

		const existing = encyclopediaEntries.value.find((e) => e.id === id)
		const formattedBlocks = Array.isArray(blocks)
			? blocks.map((b, idx) => ({
					id: b.id || `block_${idx}`,
					title: b.title || '',
					text: b.text || ''
			  }))
			: []

		if (existing) {
			if (category) existing.category = category
			if (subCategory !== undefined) existing.subCategory = subCategory
			if (title) existing.title = title
			if (icon) existing.icon = icon
			if (image) existing.image = image

			if (formattedBlocks.length > 0) {
				existing.blocks = existing.blocks || []
				formattedBlocks.forEach((newBlock) => {
					const bIndex = existing.blocks.findIndex((b) => b.id === newBlock.id)
					if (bIndex !== -1) {
						existing.blocks[bIndex] = { ...existing.blocks[bIndex], ...newBlock }
					} else {
						existing.blocks.push(newBlock)
					}
				})
			}
			syncToGameState()
			return existing
		}

		const newEntry = {
			id,
			category,
			subCategory,
			title: title || id,
			icon,
			image,
			blocks: formattedBlocks,
			discoveredAt: Date.now()
		}

		encyclopediaEntries.value.push(newEntry)
		syncToGameState()

		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('encyclopedia-entry-added', { detail: newEntry }))
		}

		console.log(`📖 [Encyclopedia Entry Added] ${newEntry.title} (${newEntry.id})`)
		return newEntry
	}

	function findEntity(target, id) {
		if (target === 'character') {
			return characters.value.find((c) => c.id === id) || null
		}
		if (target === 'encyclopedia' || target === 'entry') {
			return encyclopediaEntries.value.find((e) => e.id === id) || null
		}
		// Search both
		return (
			characters.value.find((c) => c.id === id) ||
			encyclopediaEntries.value.find((e) => e.id === id) ||
			null
		)
	}

	function setBlock({ target, id, blockId, title = '', text = '' }) {
		if (!id || !blockId) return null
		const entity = findEntity(target, id)
		if (!entity) return null

		if (!Array.isArray(entity.blocks)) {
			entity.blocks = []
		}

		const existing = entity.blocks.find((b) => b.id === blockId)
		if (existing) {
			if (title) existing.title = title
			existing.text = text
		} else {
			entity.blocks.push({
				id: blockId,
				title,
				text
			})
		}

		syncToGameState()
		console.log(`📝 [Journal Block Updated] ${entity.id} -> ${blockId}`)
		return entity
	}

	function removeBlock({ target, id, blockId }) {
		if (!id || !blockId) return null
		const entity = findEntity(target, id)
		if (!entity || !Array.isArray(entity.blocks)) return null

		entity.blocks = entity.blocks.filter((b) => b.id !== blockId)
		syncToGameState()
		console.log(`🗑️ [Journal Block Removed] ${entity.id} -> ${blockId}`)
		return entity
	}

	function getCharacter(id) {
		return characters.value.find((c) => c.id === id) || null
	}

	function getEncyclopediaEntry(id) {
		return encyclopediaEntries.value.find((e) => e.id === id) || null
	}

	function getEntriesByCategory(category, subCategory = null) {
		return encyclopediaEntries.value.filter((e) => {
			if (e.category !== category) return false
			if (subCategory !== null) return e.subCategory === subCategory
			return true
		})
	}

	function getState() {
		return {
			characters: JSON.parse(JSON.stringify(characters.value)),
			entries: JSON.parse(JSON.stringify(encyclopediaEntries.value))
		}
	}

	function loadState(savedState) {
		if (!savedState || typeof savedState !== 'object') return
		if (Array.isArray(savedState.characters)) {
			characters.value = savedState.characters.map((c) => ({
				...c,
				blocks: Array.isArray(c.blocks) ? [...c.blocks] : []
			}))
			console.log(`👤 [Characters Restored] ${characters.value.length} characters loaded`)
		}
		if (Array.isArray(savedState.entries)) {
			encyclopediaEntries.value = savedState.entries.map((e) => ({
				...e,
				blocks: Array.isArray(e.blocks) ? [...e.blocks] : []
			}))
			console.log(`📖 [Encyclopedia Restored] ${encyclopediaEntries.value.length} entries loaded`)
		}
	}

	function resetEncyclopedia() {
		characters.value = []
		encyclopediaEntries.value = []
		syncToGameState()
	}

	return {
		characters,
		encyclopediaEntries,
		allCharacters,
		allEntries,
		categories: ENCYCLOPEDIA_CATEGORIES,
		addCharacter,
		addEncyclopediaEntry,
		setBlock,
		removeBlock,
		getCharacter,
		getEncyclopediaEntry,
		getEntriesByCategory,
		getAttitudeInfo,
		getState,
		loadState,
		resetEncyclopedia
	}
}
