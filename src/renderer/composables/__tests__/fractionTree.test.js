import { describe, it, expect } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'
import fractionsData from '@/public/data/fractions/fractions.json'

describe('Fraction Tree Hierarchy & Grid Normalization', () => {
	const editor = useDataEditor()

	describe('useDataEditor: fractions normalization', () => {
		it('includes grid_tier in STANDARD_KEYS for fractions', () => {
			expect(editor.STANDARD_KEYS.fractions).toContain('grid_tier')
		})

		it('normalizes valid integer grid_tier for fractions', () => {
			const raw = {
				id: 'custom_faction',
				name: 'Специальный отдел',
				type: 'guild',
				parent_id: 'nazarick',
				grid_tier: '3'
			}
			const normalized = editor.normalizeEntity('fractions', raw)
			expect(normalized.grid_tier).toBe(3)
		})

		it('removes invalid or empty grid_tier on normalization for fractions', () => {
			const rawEmpty = {
				id: 'custom_faction_empty',
				name: 'Фракция',
				type: 'nation',
				grid_tier: ''
			}
			const normEmpty = editor.normalizeEntity('fractions', rawEmpty)
			expect(normEmpty.grid_tier).toBeUndefined()

			const rawNeg = {
				id: 'custom_faction_neg',
				name: 'Фракция Отрицательная',
				type: 'nation',
				grid_tier: -2
			}
			const normNeg = editor.normalizeEntity('fractions', rawNeg)
			expect(normNeg.grid_tier).toBeUndefined()
		})

		it('cleans empty parent_id string to null', () => {
			const raw = {
				id: 'custom_sovereign',
				name: 'Суверенная фракция',
				type: 'nation',
				parent_id: ''
			}
			const normalized = editor.normalizeEntity('fractions', raw)
			expect(normalized.parent_id).toBeNull()
		})
	})

	describe('Factions dataset tree structure', () => {
		const factionMap = new Map(fractionsData.map((f) => [f.id, f]))

		function getRootAncestor(item) {
			let current = item
			const visited = new Set()
			while (current && current.parent_id && !visited.has(current.id)) {
				visited.add(current.id)
				const parent = factionMap.get(current.parent_id)
				if (parent) {
					current = parent
				} else {
					break
				}
			}
			return current
		}

		function calculateDepth(item, visited = new Set()) {
			if (!item || visited.has(item.id)) return 0
			visited.add(item.id)
			if (!item.parent_id) return 0
			const parent = factionMap.get(item.parent_id)
			return parent ? calculateDepth(parent, visited) + 1 : 0
		}

		it('correctly maps Ainz Ooal Gown sub-factions hierarchy', () => {
			const aog = factionMap.get('ainz-ooal-gown')
			const nazarick = factionMap.get('nazarick')
			const guardians = factionMap.get('floor-guardians')
			const shalltear = factionMap.get('shalltear-faction')

			expect(aog).toBeDefined()
			expect(nazarick).toBeDefined()
			expect(guardians).toBeDefined()
			expect(shalltear).toBeDefined()

			expect(nazarick.parent_id).toBe('ainz-ooal-gown')
			expect(guardians.parent_id).toBe('nazarick')
			expect(shalltear.parent_id).toBe('floor-guardians')

			expect(calculateDepth(aog)).toBe(0)
			expect(calculateDepth(nazarick)).toBe(1)
			expect(calculateDepth(guardians)).toBe(2)
			expect(calculateDepth(shalltear)).toBe(3)

			expect(getRootAncestor(shalltear).id).toBe('ainz-ooal-gown')
		})

		it('correctly maps Re-Estize kingdom and factions', () => {
			const kingdom = factionMap.get('re-estize')
			const kingFaction = factionMap.get('king-faction')
			const nobles = factionMap.get('royal-nobles')

			expect(calculateDepth(kingdom)).toBe(0)
			expect(calculateDepth(kingFaction)).toBe(1)
			expect(calculateDepth(nobles)).toBe(1)

			expect(kingFaction.parent_id).toBe('re-estize')
			expect(nobles.parent_id).toBe('re-estize')
		})

		it('correctly categorizes root factions into category groups', () => {
			const valid = ['nation', 'guild', 'clan', 'religious']
			function getFactionCategory(item) {
				const root = getRootAncestor(item)
				if (root?.type && valid.includes(root.type)) return root.type
				if (item.type && valid.includes(item.type)) return item.type
				return 'guild'
			}

			expect(getFactionCategory(factionMap.get('re-estize'))).toBe('nation')
			expect(getFactionCategory(factionMap.get('baharuth'))).toBe('nation')
			expect(getFactionCategory(factionMap.get('ainz-ooal-gown'))).toBe('guild')
			expect(getFactionCategory(factionMap.get('adventurers'))).toBe('guild')
			expect(getFactionCategory(factionMap.get('eight-fingers'))).toBe('clan')
			expect(getFactionCategory(factionMap.get('slane-theocracy'))).toBe('religious')

			// Whole branch belongs to root category
			expect(getFactionCategory(factionMap.get('nazarick'))).toBe('guild')
			expect(getFactionCategory(factionMap.get('floor-guardians'))).toBe('guild')
			expect(getFactionCategory(factionMap.get('shalltear-faction'))).toBe('guild')
			expect(getFactionCategory(factionMap.get('king-faction'))).toBe('nation')
		})

		it('calculates recursive subtree widths and assigns non-overlapping column slots for Ainz Ooal Gown branch', () => {
			const aogTreeNodes = [
				'ainz-ooal-gown',
				'nazarick',
				'sorcerer-kingdom',
				'floor-guardians',
				'pleiades',
				'shalltear-faction',
				'albedo-faction'
			].map((id) => factionMap.get(id))

			const nodeIds = new Set(aogTreeNodes.map((n) => n.id))

			function getChildren(nodeId) {
				return aogTreeNodes.filter((n) => n.parent_id === nodeId)
			}

			const subtreeWidthMap = new Map()
			function calcWidth(nodeId) {
				const children = getChildren(nodeId)
				if (children.length === 0) {
					subtreeWidthMap.set(nodeId, 1)
					return 1
				}
				let sum = 0
				for (const ch of children) {
					sum += calcWidth(ch.id)
				}
				subtreeWidthMap.set(nodeId, sum)
				return sum
			}

			const totalWidth = calcWidth('ainz-ooal-gown')
			expect(totalWidth).toBe(4) // shalltear + albedo + pleiades + sorcerer-kingdom = 4 leaves

			expect(subtreeWidthMap.get('floor-guardians')).toBe(2) // shalltear + albedo
			expect(subtreeWidthMap.get('pleiades')).toBe(1)
			expect(subtreeWidthMap.get('nazarick')).toBe(3) // 2 + 1
			expect(subtreeWidthMap.get('sorcerer-kingdom')).toBe(1)

			const layoutMap = new Map()
			function assignSlots(nodeId, startCol) {
				const children = getChildren(nodeId)
				if (children.length === 0) {
					layoutMap.set(nodeId, { colStart: startCol, colEnd: startCol, width: 1 })
					return
				}
				let cur = startCol
				for (const ch of children) {
					const w = subtreeWidthMap.get(ch.id) || 1
					assignSlots(ch.id, cur)
					cur += w
				}
				layoutMap.set(nodeId, { colStart: startCol, colEnd: cur - 1, width: cur - startCol })
			}

			assignSlots('ainz-ooal-gown', 0)

			const aogLayout = layoutMap.get('ainz-ooal-gown')
			expect(aogLayout).toEqual({ colStart: 0, colEnd: 3, width: 4 })

			const nazarickLayout = layoutMap.get('nazarick')
			expect(nazarickLayout).toEqual({ colStart: 0, colEnd: 2, width: 3 })

			const sorcererLayout = layoutMap.get('sorcerer-kingdom')
			expect(sorcererLayout).toEqual({ colStart: 3, colEnd: 3, width: 1 })

			const guardiansLayout = layoutMap.get('floor-guardians')
			expect(guardiansLayout).toEqual({ colStart: 0, colEnd: 1, width: 2 })

			const pleiadesLayout = layoutMap.get('pleiades')
			expect(pleiadesLayout).toEqual({ colStart: 2, colEnd: 2, width: 1 })
		})
	})
})
