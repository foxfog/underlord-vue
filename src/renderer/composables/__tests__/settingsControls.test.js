import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import ruCommon from '../../locales/translations/ru/ui/common.json'
import enCommon from '../../locales/translations/en/ui/common.json'

describe('Settings Controls Reference (Управление)', () => {
	it('defines settings.controls in ru and en common translations', () => {
		expect(ruCommon.settings.controls).toBe('Управление')
		expect(enCommon.settings.controls).toBe('Controls')
	})

	it('SettingsControls.vue file exists and contains essential control key descriptions', () => {
		const filePath = path.resolve(__dirname, '../../components/settings/SettingsControls.vue')
		expect(fs.existsSync(filePath)).toBe(true)

		const content = fs.readFileSync(filePath, 'utf-8')
		// Fast-forward / Skip mode with Ctrl
		expect(content).toContain('Ctrl')
		expect(content).toContain('Быстрая перемотка')

		// UI hide with H
		expect(content).toContain('Скрыть интерфейс')
		expect(content).toContain('>H<')

		// Main menu / Pause with Esc
		expect(content).toContain('Главное меню')
		expect(content).toContain('>Esc<')

		// Map mode switch with L
		expect(content).toContain('Переключение режима карты')
		expect(content).toContain('>L<')
	})

	it('SettingsContent.vue includes the controls tab header and content', () => {
		const contentPath = path.resolve(__dirname, '../../components/settings/SettingsContent.vue')
		expect(fs.existsSync(contentPath)).toBe(true)

		const content = fs.readFileSync(contentPath, 'utf-8')
		expect(content).toContain("activeSection === 'controls'")
		expect(content).toContain("$t('settings.controls')")
		expect(content).toContain('<SettingsControls')
	})
})

