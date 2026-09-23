import { describe, it, expect } from 'vitest'
import { useDataEditor } from '../useDataEditor.js'
import { splitIconEmojis } from '../../utils/treeIcons.js'

describe('Class and Race Grid Tier & Branch Lane Separation', () => {
	const editor = useDataEditor()

	describe('useDataEditor: grid_tier normalization', () => {
		it('includes grid_tier in STANDARD_KEYS for classes and races', () => {
			expect(editor.STANDARD_KEYS.classes).toContain('grid_tier')
			expect(editor.STANDARD_KEYS.races).toContain('grid_tier')
		})

		it('normalizes valid integer grid_tier for classes', () => {
			const raw = {
				id: 'custom_warrior',
				name: 'Воин',
				category: 'combat',
				tier: 'basic',
				grid_tier: '2'
			}
			const normalized = editor.normalizeEntity('classes', raw)
			expect(normalized.grid_tier).toBe(2)
		})

		it('normalizes valid integer grid_tier for races', () => {
			const raw = {
				id: 'custom_elf',
				name: 'Эльф',
				category: 'humanoid',
				tier: 'basic',
				grid_tier: 0
			}
			const normalized = editor.normalizeEntity('races', raw)
			expect(normalized.grid_tier).toBe(0)
		})

		it('removes invalid or empty grid_tier on normalization', () => {
			const rawWithEmpty = {
				id: 'custom_race',
				name: 'Раса',
				category: 'humanoid',
				tier: 'basic',
				grid_tier: ''
			}
			const normEmpty = editor.normalizeEntity('races', rawWithEmpty)
			expect(normEmpty.grid_tier).toBeUndefined()

			const rawWithNegative = {
				id: 'custom_race_2',
				name: 'Раса 2',
				category: 'humanoid',
				tier: 'basic',
				grid_tier: -1
			}
			const normNegative = editor.normalizeEntity('races', rawWithNegative)
			expect(normNegative.grid_tier).toBeUndefined()
		})
	})

	describe('Manual grid_tier vs ancestor depth resolution', () => {
		function calculateDepth(item, entityMap, visited = new Set()) {
			if (!item || visited.has(item.id)) return 0
			visited.add(item.id)
			const pid = item.parent_id
			if (!pid) return 0
			const parent = entityMap.get(pid)
			return parent ? calculateDepth(parent, entityMap, new Set(visited)) + 1 : 0
		}

		function getNodeTier(item, entityMap) {
			if (!item) return 0
			if (item.grid_tier !== undefined && item.grid_tier !== null && item.grid_tier !== '') {
				const parsed = parseInt(item.grid_tier, 10)
				if (!isNaN(parsed) && parsed >= 0) return parsed
			}
			return calculateDepth(item, entityMap)
		}

		it('uses manual grid_tier when set, overriding calculated depth', () => {
			const map = new Map([
				['root_class', { id: 'root_class', parent_id: null }],
				['child_class', { id: 'child_class', parent_id: 'root_class', grid_tier: 3 }]
			])

			const rootTier = getNodeTier(map.get('root_class'), map)
			const childTier = getNodeTier(map.get('child_class'), map)

			expect(rootTier).toBe(0)
			expect(childTier).toBe(3) // overridden manually to 3 instead of 1
		})

		it('falls back to calculated depth when grid_tier is not provided', () => {
			const map = new Map([
				['root_class', { id: 'root_class', parent_id: null }],
				['child_class', { id: 'child_class', parent_id: 'root_class' }],
				['grandchild_class', { id: 'grandchild_class', parent_id: 'child_class' }]
			])

			expect(getNodeTier(map.get('root_class'), map)).toBe(0)
			expect(getNodeTier(map.get('child_class'), map)).toBe(1)
			expect(getNodeTier(map.get('grandchild_class'), map)).toBe(2)
		})
	})

	describe('Branch lane partitioning and parent DFS alignment', () => {
		it('partitions multi-root families into separate branch lanes and orders children above parents', () => {
			// Simulated elemental family with Fire and Water branches
			const familyNodes = [
				{ id: 'fire_elem', parent_id: null, family: 'elemental', name: 'Огонь' },
				{ id: 'water_elem', parent_id: null, family: 'elemental', name: 'Вода' },
				{ id: 'fire_great', parent_id: 'fire_elem', family: 'elemental', name: 'Высший Огонь' },
				{ id: 'water_great', parent_id: 'water_elem', family: 'elemental', name: 'Высшая Вода' },
				{ id: 'fire_lord', parent_id: 'fire_great', family: 'elemental', name: 'Лорд Огня' }
			]

			const nodeIds = new Set(familyNodes.map((n) => n.id))
			const branchRoots = familyNodes.filter((n) => !n.parent_id || !nodeIds.has(n.parent_id))

			expect(branchRoots.map((r) => r.id)).toEqual(['fire_elem', 'water_elem'])

			// Map descendants
			const branchMap = new Map()
			for (const r of branchRoots) {
				branchMap.set(r.id, [r])
			}
			const assigned = new Set(branchRoots.map((r) => r.id))
			const queue = branchRoots.map((r) => ({ node: r, rootId: r.id }))

			while (queue.length > 0) {
				const { node, rootId } = queue.shift()
				for (const item of familyNodes) {
					if (!assigned.has(item.id) && item.parent_id === node.id) {
						assigned.add(item.id)
						branchMap.get(rootId).push(item)
						queue.push({ node: item, rootId })
					}
				}
			}

			// Fire branch must contain only fire nodes
			const fireBranchIds = branchMap.get('fire_elem').map((n) => n.id)
			expect(fireBranchIds).toEqual(['fire_elem', 'fire_great', 'fire_lord'])

			// Water branch must contain only water nodes
			const waterBranchIds = branchMap.get('water_elem').map((n) => n.id)
			expect(waterBranchIds).toEqual(['water_elem', 'water_great'])
		})

		it('calculates column-slot ranges such that subtree descendants stay strictly in their ancestor column slots', () => {
			// Exact reproduction of user's Warrior scenario
			const warriorNodes = [
				{ id: 'warrior', parent_id: null },
				{ id: 'berserker', parent_id: 'warrior' },
				{ id: 'fencer', parent_id: 'warrior' },
				{ id: 'guardian', parent_id: 'warrior' },
				{ id: 'knight', parent_id: 'warrior' },
				{ id: 'champion', parent_id: 'warrior' },
				{ id: 'cursed_paladin', parent_id: 'knight' },
				{ id: 'dark_knight', parent_id: 'knight' },
				{ id: 'paladin', parent_id: 'knight' },
				{ id: 'valkyrie', parent_id: 'knight' },
				{ id: 'niflheim_knight', parent_id: 'knight' },
				{ id: 'slayer_of_evil', parent_id: 'paladin' },
				{ id: 'holy_lord', parent_id: 'paladin' },
				{ id: 'world_champion', parent_id: 'champion' }
			]

			const nodeMap = new Map(warriorNodes.map((n) => [n.id, n]))
			function getChildren(id) {
				return warriorNodes.filter((n) => n.parent_id === id)
			}

			const widthMap = new Map()
			function calcWidth(id) {
				const ch = getChildren(id)
				if (ch.length === 0) {
					widthMap.set(id, 1)
					return 1
				}
				let sum = 0
				for (const c of ch) sum += calcWidth(c.id)
				widthMap.set(id, sum)
				return sum
			}
			calcWidth('warrior')

			const slotMap = new Map()
			function assignSlots(id, startCol) {
				const ch = getChildren(id)
				if (ch.length === 0) {
					slotMap.set(id, { start: startCol, end: startCol, width: 1 })
					return
				}
				let curr = startCol
				for (const c of ch) {
					const w = widthMap.get(c.id)
					assignSlots(c.id, curr)
					curr += w
				}
				slotMap.set(id, { start: startCol, end: curr - 1, width: curr - startCol })
			}
			assignSlots('warrior', 0)

			// Total width of warrior tree is 10 slots (slots 0..9)
			expect(widthMap.get('warrior')).toBe(10)
			expect(slotMap.get('warrior')).toEqual({ start: 0, end: 9, width: 10 })

			// Leaves with no children have width 1 in distinct slots
			expect(slotMap.get('berserker')).toEqual({ start: 0, end: 0, width: 1 })
			expect(slotMap.get('fencer')).toEqual({ start: 1, end: 1, width: 1 })
			expect(slotMap.get('guardian')).toEqual({ start: 2, end: 2, width: 1 })

			// Knight spans 6 slots (slots 3..8)
			expect(slotMap.get('knight')).toEqual({ start: 3, end: 8, width: 6 })

			// All children of Knight are strictly within slots 3..8
			const knightChildren = ['cursed_paladin', 'dark_knight', 'paladin', 'valkyrie', 'niflheim_knight']
			for (const kId of knightChildren) {
				const s = slotMap.get(kId)
				expect(s.start).toBeGreaterThanOrEqual(3)
				expect(s.end).toBeLessThanOrEqual(8)
			}

			// Paladin spans 2 slots (5..6), and its children are strictly in slots 5 and 6
			expect(slotMap.get('paladin')).toEqual({ start: 5, end: 6, width: 2 })
			expect(slotMap.get('slayer_of_evil')).toEqual({ start: 5, end: 5, width: 1 })
			expect(slotMap.get('holy_lord')).toEqual({ start: 6, end: 6, width: 1 })

			// Champion is in slot 9, and Champion of the World is strictly in slot 9
			expect(slotMap.get('champion')).toEqual({ start: 9, end: 9, width: 1 })
			expect(slotMap.get('world_champion')).toEqual({ start: 9, end: 9, width: 1 })

			// NO knight child ever overlaps with Berserker (0), Fencer (1), Guardian (2), or Champion (9)
			for (const kId of knightChildren) {
				const s = slotMap.get(kId)
				expect([0, 1, 2, 9]).not.toContain(s.start)
			}
		})

		it('ends connector path at arrowhead base with vertical lead-in to prevent side entry', () => {
			const pX = 100
			const pY = 300 // Parent at bottom
			const cX = 250 // Child to the right
			const cY = 100 // Child at top

			const arrowLength = 9
			const deltaY = pY - cY
			const endY = deltaY > arrowLength + 4 ? cY + arrowLength : cY
			const actualDeltaY = Math.abs(pY - endY)
			const curveOffset = Math.max(actualDeltaY * 0.45, 25)

			const leadIn = Math.min(10, actualDeltaY * 0.2)
			const curveEndY = endY + leadIn

			const d = `M ${pX} ${pY} C ${pX} ${pY - curveOffset}, ${cX} ${curveEndY + curveOffset}, ${cX} ${curveEndY} L ${cX} ${endY}`

			// Path must end at endY (cY + 9 = 109), NOT at cY (100)
			expect(endY).toBe(109)
			expect(d.endsWith(`L ${cX} ${endY}`)).toBe(true)

			// Lead-in must be strictly vertical (same X coordinate cX)
			expect(d).toContain(`L 250 109`)
			expect(curveEndY).toBe(119) // 109 + 10 = 119
		})
	})

	describe('splitIconEmojis multi-emoji badge parsing', () => {
		it('handles single emoji without secondary emojis', () => {
			expect(splitIconEmojis('🦄')).toEqual({ primary: '🦄', secondary: [] })
			expect(splitIconEmojis('⚔️')).toEqual({ primary: '⚔️', secondary: [] })
		})

		it('splits dual emojis into centered primary and raised secondary', () => {
			expect(splitIconEmojis('🦄🪽')).toEqual({ primary: '🦄', secondary: ['🪽'] })
			expect(splitIconEmojis('🧝👤')).toEqual({ primary: '🧝', secondary: ['👤'] })
			expect(splitIconEmojis('😈👑')).toEqual({ primary: '😈', secondary: ['👑'] })
			expect(splitIconEmojis('😈♀️')).toEqual({ primary: '😈', secondary: ['♀️'] })
			expect(splitIconEmojis('😈♂️')).toEqual({ primary: '😈', secondary: ['♂️'] })
		})

		it('splits three or more emojis into primary and secondary array', () => {
			expect(splitIconEmojis('👤🐺🌕')).toEqual({ primary: '👤', secondary: ['🐺', '🌕'] })
		})

		it('handles edge cases gracefully', () => {
			expect(splitIconEmojis('')).toEqual({ primary: '', secondary: [] })
			expect(splitIconEmojis(null)).toEqual({ primary: '', secondary: [] })
			expect(splitIconEmojis('img/icon.png')).toEqual({ primary: 'img/icon.png', secondary: [] })
		})
	})

	describe('tree grid cell top-alignment for multi-line titles', () => {
		it('ensures ClassRaceTreeCanvas aligns node cells to top so squares remain horizontally aligned', async () => {
			const fs = await import('fs')
			const path = await import('path')
			const canvasContent = fs.readFileSync(
				path.resolve(__dirname, '../../components/game/dataEditor/ClassRaceTreeCanvas.vue'),
				'utf-8'
			)

			// .tree-grid-canvas must align items to start
			expect(canvasContent).toMatch(/\.tree-grid-canvas\s*\{[^}]*align-items:\s*start;/s)
			// .tree-grid-cell must align items to flex-start
			expect(canvasContent).toMatch(/\.tree-grid-cell\s*\{[^}]*align-items:\s*flex-start;/s)
			// .tree-node-wrapper must have align-self: flex-start
			expect(canvasContent).toMatch(/\.tree-node-wrapper\s*\{[^}]*align-self:\s*flex-start;/s)
		})
	})
})

