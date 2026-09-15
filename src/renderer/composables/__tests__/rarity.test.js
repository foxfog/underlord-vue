import { describe, it, expect } from 'vitest'
import {
	ITEM_RARITIES,
	RARITY_MAP,
	getRarity,
	getRarityColor,
	getRarityBadgeStyle
} from '../../constants/rarity.js'

describe('Item Rarities System (9 tiers)', () => {
	it('defines exactly 9 tiers of item rarity in correct progression', () => {
		expect(ITEM_RARITIES).toHaveLength(9)
		const ids = ITEM_RARITIES.map((r) => r.id)
		expect(ids).toEqual([
			'junk',
			'common',
			'uncommon',
			'rare',
			'epic',
			'legendary',
			'ancient',
			'divine',
			'world'
		])
	})

	it('includes ancient (древний) tier with black styling', () => {
		const ancient = getRarity('ancient')
		expect(ancient).toBeDefined()
		expect(ancient.label).toBe('Древний')
		expect(ancient.bg).toBe('#0f172a')
		expect(ancient.border).toBe('#475569')
		expect(ancient.icon).toBe('🖤')
	})

	it('includes world (мировой) tier with rainbow styling', () => {
		const world = getRarity('world')
		expect(world).toBeDefined()
		expect(world.label).toBe('Мировой')
		expect(world.isRainbow).toBe(true)
		expect(world.icon).toBe('🌈')
	})

	it('getRarity returns fallback common for unknown rarity', () => {
		const unknown = getRarity('mythic_unknown')
		expect(unknown.id).toBe('common')
		expect(unknown.label).toBe('Обычный')
	})

	it('getRarityColor returns appropriate text color', () => {
		expect(getRarityColor('common')).toBe('#f8fafc')
		expect(getRarityColor('uncommon')).toBe('#4ade80')
		expect(getRarityColor('rare')).toBe('#60a5fa')
		expect(getRarityColor('epic')).toBe('#c084fc')
		expect(getRarityColor('legendary')).toBe('#facc15')
		expect(getRarityColor('ancient')).toBe('#e2e8f0')
		expect(getRarityColor('divine')).toBe('#f87171')
	})

	it('getRarityBadgeStyle produces correct styles for regular and rainbow tiers', () => {
		const rareStyle = getRarityBadgeStyle('rare')
		expect(rareStyle.color).toBe('#60a5fa')
		expect(rareStyle.borderColor).toBe('#60a5fa')

		const worldStyle = getRarityBadgeStyle('world')
		expect(worldStyle.color).toBe('#ffffff')
		expect(worldStyle.background).toContain('linear-gradient')
	})
})
