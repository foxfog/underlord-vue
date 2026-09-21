import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

describe('DataTableEditor Component (Google Sheets Spreadsheet Mode)', () => {
	const editorPath = path.resolve(__dirname, '../../components/game/dataEditor/DataTableEditor.vue')
	const viewPath = path.resolve(__dirname, '../../views/DataEditorView.vue')

	it('verifies DataTableEditor component file exists and has correct script and template structure', () => {
		expect(fs.existsSync(editorPath)).toBe(true)
		const content = fs.readFileSync(editorPath, 'utf-8')

		// Props
		expect(content).toContain('type: {')
		expect(content).toContain('items: {')
		expect(content).toContain('selectedId: {')
		expect(content).toContain('activeLocale: {')
		expect(content).toContain('localesData: {')

		// Emits
		expect(content).toContain("'select'")
		expect(content).toContain("'create'")
		expect(content).toContain("'delete'")
		expect(content).toContain("'saveBatch'")
		expect(content).toContain("'change'")
	})

	it('verifies column grouping and collapse mechanics in DataTableEditor', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// Super-header row with functional groups
		expect(content).toContain('dte-super-header-row')
		expect(content).toContain('dte-group-collapse-btn')
		expect(content).toContain('toggleGroupCollapse')
		expect(content).toContain('isGroupCollapsed')

		// Column groups definitions: Core, Hierarchy, Stats, Converters, Progression
		expect(content).toContain("id: 'core'")
		expect(content).toContain("id: 'hierarchy'")
		expect(content).toContain("id: 'stats'")
		expect(content).toContain("id: 'converters'")
		expect(content).toContain("id: 'progression'")

		// Distinct column theme classes
		expect(content).toContain('__grp-stats')
		expect(content).toContain('__grp-converters')
		expect(content).toContain('__grp-progression')
	})

	it('verifies row hierarchy tree and divider grouping modes', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// Grouping modes: tree, category, family, flat
		expect(content).toContain("groupingMode = ref('tree')")
		expect(content).toContain('buildTreeRows')
		expect(content).toContain('buildCategoryRows')
		expect(content).toContain('buildFamilyRows')
		expect(content).toContain('buildFlatRows')

		// Tree folding
		expect(content).toContain('toggleRowCollapse')
		expect(content).toContain('isRowCollapsed')
		expect(content).toContain('dte-row-fold-btn')
		expect(content).toContain('dte-tree-branch')

		// Divider folding
		expect(content).toContain('dte-divider-row')
		expect(content).toContain('toggleGroupDivider')
		expect(content).toContain('isDividerCollapsed')
	})

	it('verifies user color coding for categories and Google Sheets style active cell', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// User screenshot specs: humanoid (blue), demi-human (green), heteromorphic (magenta/red)
		expect(content).toContain('.dte-cat-badge.__cat-humanoid')
		expect(content).toContain('background: #2563eb')
		expect(content).toContain('.dte-cat-badge.__cat-demi-human')
		expect(content).toContain('background: #16a34a')
		expect(content).toContain('.dte-cat-badge.__cat-heteromorphic')
		expect(content).toContain('background: #be185d')

		// Active cell outline and bottom-right handle square
		expect(content).toContain('.dte-td.__active_cell')
		expect(content).toContain('.dte-td.__active_cell::after')
	})

	it('verifies in-place cell editing capabilities', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		expect(content).toContain('startEditCell')
		expect(content).toContain('commitEditCell')
		expect(content).toContain('cancelEditCell')
		expect(content).toContain('dte-inline-input')
		expect(content).toContain('dte-inline-select')
		expect(content).toContain('dirtyItemIds')
		expect(content).toContain('handleSaveBatch')
	})

	it('verifies DataEditorView.vue integration with DataTableEditor', () => {
		expect(fs.existsSync(viewPath)).toBe(true)
		const content = fs.readFileSync(viewPath, 'utf-8')

		// Import
		expect(content).toContain("import DataTableEditor from '@/components/game/dataEditor/DataTableEditor.vue'")

		// Mode toggle: tree | table | list
		expect(content).toContain("classRaceViewMode = ref('tree')")
		expect(content).toContain("classRaceViewMode === 'table'")
		expect(content).toContain('<span>Таблица</span>')

		// Template integration
		expect(content).toContain('v-else-if="isTableMode"')
		expect(content).toContain('<DataTableEditor')
		expect(content).toContain(':type="activeTab"')
		expect(content).toContain('@save-batch="handleTableSaveBatch"')
		expect(content).toContain('@change="onTableEntityChange"')

		// Form drawer support
		expect(content).toContain("__table-drawer': isTableMode")
		expect(content).toContain('.form-pane.__table-drawer')
		expect(content).toContain('.table-canvas-column')
	})

	it('verifies compact collapsed group header ribbons (narrow width, no text when collapsed)', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// Header template hides group name when collapsed, showing only the [+] button
		expect(content).toContain('v-if="!isGroupCollapsed(grp.id)"')
		expect(content).toContain('<span class="dte-group-name">{{ grp.label }}</span>')
		expect(content).toContain("isGroupCollapsed(grp.id) ? '➕' : '➖'")

		// Collapsed column CSS enforces compact ribbon width and hides overflow
		expect(content).toContain('.dte-super-th.__collapsed')
		expect(content).toContain('.dte-sub-th.__collapsed-placeholder')
		expect(content).toContain('.dte-td.__collapsed-cell')
		expect(content).toContain('width: 2.2em !important;')
		expect(content).toContain('overflow: hidden !important;')
	})

	it('verifies multi-stat converter scaling support (0 to many combat parameters, badges, modal)', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// Converter columns defined with type: 'converter'
		expect(content).toContain("key: 'conv_str'")
		expect(content).toContain("attrKey: 'str'")
		expect(content).toContain("type: 'converter'")
		expect(content).toContain("key: 'conv_end'")
		expect(content).toContain("key: 'conv_agi'")
		expect(content).toContain("key: 'conv_int'")

		// Logic for extracting 0 to many parameters
		expect(content).toContain('parseConverterEntries')
		expect(content).toContain('getConverterScales')
		expect(content).toContain('getConverterEntries')
		expect(content).toContain('availableConverterStats')

		// Supports resistances (res.physical, etc.)
		expect(content).toContain("'res.physical'")
		expect(content).toContain('resKey')

		// Pill rendering & themes
		expect(content).toContain('dte-conv-pills')
		expect(content).toContain('dte-conv-pill')
		expect(content).toContain('.dte-conv-pill.__hp')
		expect(content).toContain('.dte-conv-pill.__atk_phys')
		expect(content).toContain('.dte-conv-pill.__def_phys')

		// Modal for editing 0 to many scalings
		expect(content).toContain('converterModal')
		expect(content).toContain('openConverterModal')
		expect(content).toContain('closeConverterModal')
		expect(content).toContain('addConverterEntry')
		expect(content).toContain('removeConverterEntry')
		expect(content).toContain('clearConverterEntries')
		expect(content).toContain('applyConverterModal')
		expect(content).toContain('dte-modal-overlay')
		expect(content).toContain('dte-modal-card')
	})

	it('verifies critical chance and critical damage scaling with 0.1 step in DataTableEditor and CharacterStatsTab', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')
		const charTabPath = path.resolve(__dirname, '../../components/game/dataEditor/CharacterStatsTab.vue')
		expect(fs.existsSync(charTabPath)).toBe(true)
		const charTabContent = fs.readFileSync(charTabPath, 'utf-8')

		// DataTableEditor: crit_chance and crit_dmg in availableConverterStats
		expect(content).toContain("key: 'crit_chance'")
		expect(content).toContain("key: 'crit_dmg'")
		expect(content).toContain('isPercentStat')

		// DataTableEditor: step 0.1 for percentages
		expect(content).toContain("isPercentStat(col.key) ? 0.1 : (col.key === 'spd' ? 0.05 : 1)")
		expect(content).toContain("isPercentStat(entry.key) ? 0.1 : (entry.key.includes('spd') ? 0.05 : 1)")

		// DataTableEditor: column definitions
		expect(content).toContain("key: 'crit_chance'")
		expect(content).toContain("key: 'crit_dmg'")
		expect(content).toContain("step: 0.1")

		// CharacterStatsTab: combatStatConfigs & formatting
		expect(charTabContent).toContain("id: 'crit_chance'")
		expect(charTabContent).toContain("id: 'crit_dmg'")
		expect(charTabContent).toContain("crit_chance: 'Крит.Шанс'")
		expect(charTabContent).toContain("crit_dmg: 'Крит.Урон'")
		expect(charTabContent).toContain("st.isPercent ? '%' : ''")
	})

	it('verifies Actions column pinning and unpinning mechanism (header and cells stick synchronously)', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// State and toggles
		expect(content).toContain('isActionsPinned = ref(')
		expect(content).toContain('togglePinActions')
		expect(content).toContain('dte_pin_actions')

		// Template bindings: both th and td are conditionally pinned together
		expect(content).toContain('class="dte-super-th __actions-col"')
		expect(content).toContain(":class=\"{ '__sticky-right': isActionsPinned }\"")
		expect(content).toContain('class="dte-td __actions-col"')
		expect(content).toContain("dte-pin-col-btn")
		expect(content).toContain("dte-actions-th-inner")

		// CSS sticky rules: th and td both enforce sticky with high z-index and no relative override
		expect(content).toContain('.dte-super-th.__sticky-right')
		expect(content).toContain('.dte-td.__sticky-right')
		expect(content).toContain('position: sticky !important;')
		expect(content).toContain('z-index: 35 !important;')
		expect(content).toContain('z-index: 22 !important;')
	})

	it('ensures AGENTS.md Rule 1 compliance (strictly em units, no fixed px or rem)', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')
		const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/)
		expect(styleMatch).toBeTruthy()
		const styleContent = styleMatch[1]

		// Check for forbidden rem
		expect(styleContent).not.toMatch(/\d+rem\b/)

		// Check for forbidden fixed px (except 1px/2px border)
		const lines = styleContent.split('\n')
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i]
			const pxMatches = line.match(/\b(\d+)px\b/g)
			if (pxMatches) {
				const isAllowedBorder = /border(-\w+)?:.*[12]px (solid|dashed)/.test(line) || /outline:.*[12]px solid/.test(line)
				expect(isAllowedBorder).toBe(true)
			}
		}

		// Also check CharacterStatsTab.vue for Rule 1 compliance
		const charTabPath = path.resolve(__dirname, '../../components/game/dataEditor/CharacterStatsTab.vue')
		const charTabContent = fs.readFileSync(charTabPath, 'utf-8')
		const charTabStyleMatch = charTabContent.match(/<style[^>]*>([\s\S]*?)<\/style>/)
		expect(charTabStyleMatch).toBeTruthy()
		const charTabStyleContent = charTabStyleMatch[1]
		expect(charTabStyleContent).not.toMatch(/\d+rem\b/)
		const charTabLines = charTabStyleContent.split('\n')
		for (let i = 0; i < charTabLines.length; i++) {
			const line = charTabLines[i]
			const pxMatches = line.match(/\b(\d+)px\b/g)
			if (pxMatches) {
				const isAllowedBorder = /border(-\w+)?:.*[12]px (solid|dashed)/.test(line) || /outline:.*[12]px solid/.test(line)
				expect(isAllowedBorder).toBe(true)
			}
		}
	})
})

