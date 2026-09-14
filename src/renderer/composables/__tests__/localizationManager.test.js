import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLocalizationManager } from '../useLocalizationManager'
import { useDataEditor } from '../useDataEditor'

describe('useLocalizationManager Composable', () => {
	let manager

	beforeEach(() => {
		manager = useLocalizationManager()
		// Reset state
		manager.installedLocales.value = [
			{ code: 'ru', label: 'Русский', flag: '🇷🇺', isDefault: true, entityFiles: 5, storyFiles: 0 },
			{ code: 'en', label: 'English', flag: '🇬🇧', isDefault: false, entityFiles: 5, storyFiles: 0 }
		]
		manager.sourceLocale.value = 'ru'
		manager.targetCode.value = ''
		manager.targetLabel.value = ''
		manager.targetFlag.value = '🌐'
		manager.copyEntities.value = true
		manager.copyStory.value = true
	})

	it('initializes with default installed locales and presets', () => {
		expect(manager.installedLocales.value.length).toBeGreaterThanOrEqual(2)
		expect(manager.sourceLocale.value).toBe('ru')
		expect(manager.sourceLocaleObj.value.code).toBe('ru')
		expect(manager.PRESET_LOCALES.length).toBeGreaterThan(5)
	})

	it('selects a preset and sets target form fields correctly', () => {
		const preset = manager.PRESET_LOCALES.find((p) => p.code === 'ja')
		expect(preset).toBeDefined()

		manager.selectPreset(preset)
		expect(manager.targetCode.value).toBe('ja')
		expect(manager.targetLabel.value).toContain('日本語')
		expect(manager.targetFlag.value).toBe('🇯🇵')
	})

	it('validates target language code and disallows invalid or matching codes', async () => {
		// Empty code
		manager.targetCode.value = ''
		await expect(manager.createLocale()).rejects.toThrow('Код языка не указан')

		// Invalid code (numbers)
		manager.targetCode.value = '123'
		await expect(manager.createLocale()).rejects.toThrow('Некорректный формат кода языка')

		// Same as source language
		manager.targetCode.value = 'ru'
		await expect(manager.createLocale()).rejects.toThrow('Языки совпадают')
	})

	it('creates new locale and clones metadata into installedLocales', async () => {
		manager.targetCode.value = 'de'
		manager.targetLabel.value = 'Deutsch'
		manager.targetFlag.value = '🇩🇪'

		const res = await manager.createLocale()
		expect(res.success).toBe(true)

		const created = manager.installedLocales.value.find((l) => l.code === 'de')
		expect(created).toBeDefined()
		expect(created.label).toBe('Deutsch')
		expect(created.flag).toBe('🇩🇪')

		// Target fields should be reset
		expect(manager.targetCode.value).toBe('')
		expect(manager.targetLabel.value).toBe('')
	})

	it('protects default russian locale from deletion', async () => {
		expect(manager.canDeleteLocale('ru')).toBe(false)
		const success = await manager.deleteLocale('ru')
		expect(success).toBe(false)
		expect(manager.installedLocales.value.some((l) => l.code === 'ru')).toBe(true)
	})

	it('allows deleting custom localizations', async () => {
		// Add custom locale
		manager.installedLocales.value.push({
			code: 'fr',
			label: 'Français',
			flag: '🇫🇷',
			isDefault: false,
			entityFiles: 5,
			storyFiles: 0
		})

		expect(manager.canDeleteLocale('fr')).toBe(true)
		const deleted = await manager.deleteLocale('fr')
		expect(deleted).toBe(true)
		expect(manager.installedLocales.value.some((l) => l.code === 'fr')).toBe(false)
	})

	it('supports switching locale in useDataEditor seamlessly', () => {
		const editor = useDataEditor()
		editor.addLocale({ code: 'es', label: 'Español', flag: '🇪🇸' })
		editor.switchLocale('es')
		expect(editor.activeLocale.value).toBe('es')
	})
})
