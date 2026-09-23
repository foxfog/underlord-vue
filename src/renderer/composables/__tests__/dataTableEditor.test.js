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

	it('verifies race resistances columns, water resistance in scaling, and presets', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')
		const charTabPath = path.resolve(__dirname, '../../components/game/dataEditor/CharacterStatsTab.vue')
		const charTabContent = fs.readFileSync(charTabPath, 'utf-8')
		const viewPath = path.resolve(__dirname, '../../views/DataEditorView.vue')
		const viewContent = fs.readFileSync(viewPath, 'utf-8')

		// 1. Column group: resistances with all 8 resistances
		expect(content).toContain("id: 'resistances'")
		expect(content).toContain('__grp-resistances')
		expect(content).toContain("key: 'res_physical'")
		expect(content).toContain("key: 'res_water'")
		expect(content).toContain("key: 'res_fire'")
		expect(content).toContain("key: 'res_cold'")
		expect(content).toContain("key: 'res_lightning'")
		expect(content).toContain("key: 'res_poison'")
		expect(content).toContain("key: 'res_holy'")
		expect(content).toContain("key: 'res_dark'")

		// 2. Water resistance in scaling / availableConverterStats & meta
		expect(content).toContain("key: 'res.water'")
		expect(content).toContain("'res.water': { label: 'Вода'")
		expect(charTabContent).toContain("water: 'Вода'")
		expect(charTabContent).toContain("'res.water': 'Сопр.Вода'")

		// 3. Preset support
		expect(content).toContain("setColPreset('resistances')")
		expect(content).toContain("preset === 'resistances'")

		// 4. DataEditorView inspector drawer inputs
		expect(viewContent).toContain('race-resistances-form-grid')
		expect(viewContent).toContain('ensureRaceResistances')
		expect(viewContent).toContain('ensureRaceResistances().water')

		// 5. Positive / negative / zero resistance color coding classes
		expect(content).toContain('__positive-res')
		expect(content).toContain('__negative-res')
		expect(content).toContain('__zero-res')
		expect(content).toContain('getRawColValue')
	})

	it('verifies column header sorting from larger values to smaller and vice versa across all grouping modes', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// 1. Column headers have toggleSort on click and sortable classes in template
		expect(content).toContain('@click="toggleSort(col.key)"')
		expect(content).toContain('__sortable: true')
		expect(content).toContain('__sorted: sortKey === col.key')
		expect(content).toContain("sortOrder === 'desc' ? '▼' : '▲'")

		// 2. Sorting state and methods
		expect(content).toContain('const sortKey = ref(null)')
		expect(content).toContain("const sortOrder = ref('desc')")
		expect(content).toContain('function toggleSort(key)')
		expect(content).toContain('function clearSort()')
		expect(content).toContain('function getSortColumnLabel()')
		expect(content).toContain('function compareItems(a, b, key, order)')
		expect(content).toContain('function getFieldValue(item, key)')

		// 3. Numeric columns default to 'desc' (high-to-low / от больших значений к меньшему) on first click
		expect(content).toContain("sortOrder.value = isText ? 'asc' : 'desc'")

		// 4. Toggle between desc and asc on repeated clicks
		expect(content).toContain("sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc'")

		// 5. Active sort indicator badge in toolbar and clear button
		expect(content).toContain('dte-active-sort-badge')
		expect(content).toContain('dte-btn-clear-sort')
		expect(content).toContain('dte-reset-sort-icon')

		// 6. Sorting applied across all modes: tree, category, family, flat
		expect(content).toContain('roots.sort((a, b) => compareItems(a, b, sortKey.value, sortOrder.value))')
		expect(content).toContain('children.sort((a, b) => compareItems(a, b, sortKey.value, sortOrder.value))')
		expect(content).toContain('sortedCatItems.sort((a, b) => compareItems(a, b, sortKey.value, sortOrder.value))')
		expect(content).toContain('sortedFamItems.sort((a, b) => compareItems(a, b, sortKey.value, sortOrder.value))')
		expect(content).toContain('sorted.sort((a, b) => compareItems(a, b, sortKey.value, sortOrder.value))')

		// 7. Test sorting simulation on actual race data structures
		const mockRaces = [
			{ id: 'human', name: 'Человек', tier: 'basic', base_stats: { hp: 100, atk_phys: 10 } },
			{ id: 'dragon', name: 'Драконид', tier: 'rare', base_stats: { hp: 350, atk_phys: 24 } },
			{ id: 'goblin', name: 'Гоблин', tier: 'basic', base_stats: { hp: 50, atk_phys: 5 } },
			{ id: 'lich', name: 'Лич', tier: 'advanced', base_stats: { hp: 220, atk_phys: 14 } }
		]

		// Descending numeric sort simulation (от больших к меньшим)
		const sortedDescHp = [...mockRaces].sort((a, b) => b.base_stats.hp - a.base_stats.hp)
		expect(sortedDescHp.map((r) => r.id)).toEqual(['dragon', 'lich', 'human', 'goblin'])
		expect(sortedDescHp[0].base_stats.hp).toBe(350)
		expect(sortedDescHp[3].base_stats.hp).toBe(50)

		// Ascending numeric sort simulation (и наоборот: от меньших к большим)
		const sortedAscHp = [...mockRaces].sort((a, b) => a.base_stats.hp - b.base_stats.hp)
		expect(sortedAscHp.map((r) => r.id)).toEqual(['goblin', 'human', 'lich', 'dragon'])
		expect(sortedAscHp[0].base_stats.hp).toBe(50)
		expect(sortedAscHp[3].base_stats.hp).toBe(350)
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

	it('verifies that digits (#) are unpinned and names follow horizontal scroll (sticky left)', () => {
		const content = fs.readFileSync(editorPath, 'utf-8')

		// 1. Index column (# digits) does NOT have __sticky-left in header and data row
		expect(content).not.toContain('class="dte-super-th __sticky-left __index-col"')
		expect(content).not.toContain('class="dte-td __sticky-left __index-col"')
		expect(content).toContain('class="dte-super-th __index-col"')
		expect(content).toContain('class="dte-td __index-col"')

		// 2. Name column follows horizontal scroll with __sticky-left in both sub-th and td
		expect(content).toContain("'__sticky-left': col.key === 'name'")
		expect(content).toContain("'__name-col': col.key === 'name'")

		// 3. CSS rules for .dte-sub-th.__sticky-left and .dte-td.__sticky-left
		expect(content).toContain('.dte-sub-th.__sticky-left')
		expect(content).toContain('.dte-td.__sticky-left')
		expect(content).toContain('left: 0 !important;')
		expect(content).toContain('.__name-col')

		// 4. Group divider titles follow horizontal scroll
		expect(content).toContain('.dte-divider-content {')
		expect(content).toContain('position: sticky;')
		expect(content).toContain('left: 0.8em;')

		// 5. Header stacking prevents data cells from overlapping headers on vertical scroll
		expect(content).toContain('.dte-super-header-row')
		expect(content).toContain('z-index: 28;')
		expect(content).toContain('.dte-sub-header-row')
		expect(content).toContain('z-index: 26;')
		expect(content).toContain('.dte-td.__sticky-left')
		expect(content).toContain('z-index: 22 !important;')
	})
})

