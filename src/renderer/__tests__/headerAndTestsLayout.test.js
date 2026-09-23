import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('Page Header and Tests Layout Architecture', () => {
	const dynamicContentPath = path.resolve(__dirname, '../components/DynamicContentArea.vue')
	const testsContentPath = path.resolve(__dirname, '../components/tests/TestsContent.vue')
	const baseCssPath = path.resolve(__dirname, '../public/styles/base.css')

	const dynamicContent = fs.readFileSync(dynamicContentPath, 'utf-8')
	const testsContent = fs.readFileSync(testsContentPath, 'utf-8')
	const baseCss = fs.readFileSync(baseCssPath, 'utf-8')

	it('DynamicContentArea.vue has static page-header outside page-content', () => {
		// Root container is dynamic-content-area
		expect(dynamicContent).toContain('<div class="dynamic-content-area">')

		// Header is placed as sibling above page-content
		const headerIndex = dynamicContent.indexOf('<header v-if="headerTitle" class="page-header">')
		const pageContentIndex = dynamicContent.indexOf('<div class="page-content">')
		expect(headerIndex).toBeGreaterThan(0)
		expect(pageContentIndex).toBeGreaterThan(headerIndex)

		// Page title displays dynamic headerTitle
		expect(dynamicContent).toContain('{{ headerTitle }}')

		// Inner wrappers must NOT contain their own page-header
		const settingsWrapperIndex = dynamicContent.indexOf('class="settings-wrapper"')
		const savesWrapperIndex = dynamicContent.indexOf('class="saves-wrapper"')
		const testsWrapperIndex = dynamicContent.indexOf('class="tests-wrapper"')

		expect(settingsWrapperIndex).toBeGreaterThan(pageContentIndex)
		expect(savesWrapperIndex).toBeGreaterThan(pageContentIndex)
		expect(testsWrapperIndex).toBeGreaterThan(pageContentIndex)

		// Ensure no nested .page-header inside wrappers
		const postPageContent = dynamicContent.slice(pageContentIndex)
		expect(postPageContent).not.toContain('class="page-header"')
	})

	it('base.css correctly handles static header and flex scrollable page-content with compensating safety space', () => {
		expect(baseCss).toContain('.dynamic-content-area')
		expect(baseCss).toContain('flex-shrink: 0')
		expect(baseCss).toContain('overflow-y: auto')
		// Safety space and compensating offset to prevent hover clipping
		expect(baseCss).toContain('padding: 0.5em 0.6em 0 0.6em')
		expect(baseCss).toContain('margin-top: -0.5em')
		expect(baseCss).toContain('width: calc(100% + 1.2em)')
	})

	it('TestsContent.vue has compact card layout with inline title and icon', () => {
		// Check compact structure elements
		expect(testsContent).toContain('test-card-title-group')
		expect(testsContent).toContain('test-card-icon')
		expect(testsContent).toContain('test-card-title')
		expect(testsContent).toContain('__disabled')
		expect(testsContent).toContain('test-card-desc')
		expect(testsContent).toContain('test-tags')
		expect(testsContent).toContain('test-btn-primary')
		expect(testsContent).toContain('position: relative')
		expect(testsContent).toContain('z-index: 1')

		// All 8 test cards present
		expect(testsContent).toContain('Изометрическая локация')
		expect(testsContent).toContain('Редактор изометрических карт')
		expect(testsContent).toContain('Пошаговый тактический бой')
		expect(testsContent).toContain('Редактор данных')
		expect(testsContent).toContain('Добавить локализацию')
		expect(testsContent).toContain('Древо навыков и прокачка')
		expect(testsContent).toContain('Студия спрайтов и риггинга (Live2D-Lite)')
		expect(testsContent).toContain('Редактор сценариев и сторилейна')
	})

	it('TestsContent.vue styles adhere to em-only Rule 1', () => {
		const styleMatch = testsContent.match(/<style[^>]*>([\s\S]*?)<\/style>/)
		expect(styleMatch).not.toBeNull()
		const styleContent = styleMatch[1]

		// Must not contain px (except border: 1px)
		const pxMatches = styleContent.match(/(?<!border[^;:]*)\b\d+px\b/gi) || []
		const nonAllowedPx = pxMatches.filter((m) => !m.includes('1px'))
		expect(nonAllowedPx).toEqual([])

		// Must not contain rem
		expect(styleContent).not.toMatch(/\b\d+rem\b/)
		// Must not contain vw/vh
		expect(styleContent).not.toMatch(/\b\d+(vw|vh)\b/)
	})
})
