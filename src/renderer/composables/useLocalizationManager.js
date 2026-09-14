// src/renderer/composables/useLocalizationManager.js
import { ref, computed } from 'vue'

const PRESET_LOCALES = [
	{ code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
	{ code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
	{ code: 'de', label: 'Deutsch (German)', flag: '🇩🇪' },
	{ code: 'es', label: 'Español (Spanish)', flag: '🇪🇸' },
	{ code: 'fr', label: 'Français (French)', flag: '🇫🇷' },
	{ code: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
	{ code: 'it', label: 'Italiano (Italian)', flag: '🇮🇹' },
	{ code: 'pt', label: 'Português (Portuguese)', flag: '🇵🇹' },
	{ code: 'pl', label: 'Polski (Polish)', flag: '🇵🇱' },
	{ code: 'uk', label: 'Українська (Ukrainian)', flag: '🇺🇦' },
	{ code: 'tr', label: 'Türkçe (Turkish)', flag: '🇹🇷' }
]

// Singleton state across components
const installedLocales = ref([
	{ code: 'ru', label: 'Русский', flag: '🇷🇺', isDefault: true, entityFiles: 5, storyFiles: 0 },
	{ code: 'en', label: 'English', flag: '🇬🇧', isDefault: false, entityFiles: 5, storyFiles: 0 }
])
const sourceLocale = ref('ru')
const targetCode = ref('')
const targetLabel = ref('')
const targetFlag = ref('🌐')
const copyEntities = ref(true)
const copyStory = ref(true)
const isLoading = ref(false)
const statusMessage = ref(null)
let statusTimeout = null

export function useLocalizationManager() {
	function setStatus(text, type = 'success', duration = 5000) {
		if (statusTimeout) clearTimeout(statusTimeout)
		statusMessage.value = { text, type }
		if (duration > 0) {
			statusTimeout = setTimeout(() => {
				statusMessage.value = null
			}, duration)
		}
	}

	function selectPreset(preset) {
		if (!preset) return
		targetCode.value = preset.code
		targetLabel.value = preset.label
		targetFlag.value = preset.flag
	}

	function resetForm() {
		targetCode.value = ''
		targetLabel.value = ''
		targetFlag.value = '🌐'
	}

	function isLocaleInstalled(code) {
		const clean = String(code || '').trim().toLowerCase()
		return installedLocales.value.some((l) => l.code.toLowerCase() === clean)
	}

	// Fetch updated list of installed locales
	async function refreshLocales() {
		isLoading.value = true
		try {
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.listLocales) {
				const res = await window.electronAPI.dataEditor.listLocales()
				if (res.success && Array.isArray(res.locales)) {
					installedLocales.value = res.locales
					return res.locales
				}
			}

			// Fallback: fetch locales.json via HTTP / relative path
			const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			const fullUrl = `${base}data/locales/locales.json`
			const res = await fetch(fullUrl)
			if (res.ok) {
				const list = await res.json()
				if (Array.isArray(list)) {
					installedLocales.value = list.map((l) => ({
						...l,
						isDefault: l.code === 'ru' || !!l.isDefault,
						entityFiles: 5,
						storyFiles: 0
					}))
					return installedLocales.value
				}
			}
		} catch (err) {
			console.warn('[useLocalizationManager] Ошибка загрузки списка локализаций:', err)
		} finally {
			isLoading.value = false
		}
		return installedLocales.value
	}

	// Create and clone localization
	async function createLocale() {
		const cleanTarget = String(targetCode.value || '').trim().toLowerCase()
		const cleanLabel = String(targetLabel.value || cleanTarget.toUpperCase()).trim()
		const cleanFlag = String(targetFlag.value || '🌐').trim()

		if (!cleanTarget) {
			setStatus('Пожалуйста, укажите код нового языка', 'error')
			throw new Error('Код языка не указан')
		}
		if (!/^[a-z]{2,5}(-[a-z0-9]+)?$/i.test(cleanTarget)) {
			setStatus('Код языка должен состоять из 2-5 латинских букв (например: de, ja, zh)', 'error')
			throw new Error('Некорректный формат кода языка')
		}
		if (cleanTarget === sourceLocale.value) {
			setStatus('Язык-источник и создаваемый язык не могут совпадать', 'error')
			throw new Error('Языки совпадают')
		}

		isLoading.value = true
		try {
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.copyLocale) {
				const res = await window.electronAPI.dataEditor.copyLocale({
					sourceLang: sourceLocale.value,
					targetLang: cleanTarget,
					targetLabel: cleanLabel,
					targetFlag: cleanFlag,
					copyEntities: copyEntities.value,
					copyStory: copyStory.value
				})

				if (!res.success) throw new Error(res.error || 'Ошибка копирования локализации')

				setStatus(
					`✔ Локализация «${cleanLabel}» (${cleanTarget}) успешно создана! Скопировано словарей: ${res.copiedEntitiesCount || 0}, сценариев: ${res.copiedStoryCount || 0}`,
					'success'
				)
				resetForm()
				await refreshLocales()
				return res
			}

			// Web / test fallback: add to in-memory list
			const newLoc = {
				code: cleanTarget,
				label: cleanLabel,
				flag: cleanFlag,
				isDefault: false,
				entityFiles: copyEntities.value ? 5 : 0,
				storyFiles: copyStory.value ? 1 : 0
			}
			const idx = installedLocales.value.findIndex((l) => l.code === cleanTarget)
			if (idx >= 0) {
				installedLocales.value[idx] = newLoc
			} else {
				installedLocales.value.push(newLoc)
			}
			setStatus(`✔ Локализация «${cleanLabel}» (${cleanTarget}) добавлена!`, 'success')
			resetForm()
			return { success: true, locale: newLoc }
		} catch (err) {
			setStatus(`⛔ Ошибка создания локализации: ${err.message}`, 'error')
			throw err
		} finally {
			isLoading.value = false
		}
	}

	// Delete localization
	async function deleteLocale(code) {
		const clean = String(code || '').trim().toLowerCase()
		if (!clean) return false
		if (clean === 'ru') {
			setStatus('Нельзя удалить основной язык проекта (Русский)', 'error')
			return false
		}

		isLoading.value = true
		try {
			if (typeof window !== 'undefined' && window.electronAPI?.dataEditor?.deleteLocale) {
				const res = await window.electronAPI.dataEditor.deleteLocale(clean)
				if (!res.success) throw new Error(res.error || 'Ошибка удаления локализации')
				setStatus(`✔ Локализация «${clean}» удалена`, 'success')
				await refreshLocales()
				return true
			}

			// Fallback
			installedLocales.value = installedLocales.value.filter((l) => l.code !== clean)
			setStatus(`✔ Локализация «${clean}» удалена`, 'success')
			return true
		} catch (err) {
			setStatus(`⛔ Ошибка удаления: ${err.message}`, 'error')
			throw err
		} finally {
			isLoading.value = false
		}
	}

	function canDeleteLocale(code) {
		return code !== 'ru'
	}

	const sourceLocaleObj = computed(() => {
		return installedLocales.value.find((l) => l.code === sourceLocale.value) || {
			code: 'ru',
			label: 'Русский',
			flag: '🇷🇺'
		}
	})

	return {
		installedLocales,
		sourceLocale,
		sourceLocaleObj,
		targetCode,
		targetLabel,
		targetFlag,
		copyEntities,
		copyStory,
		isLoading,
		statusMessage,
		PRESET_LOCALES,
		selectPreset,
		resetForm,
		isLocaleInstalled,
		refreshLocales,
		createLocale,
		deleteLocale,
		canDeleteLocale,
		setStatus
	}
}
