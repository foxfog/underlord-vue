<template>
	<div class="settings-list">
		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Язык:</div>
			</div>
			<div class="right">
				<UiSelect
					v-model="store.general.language"
					:options="languageOptions"
					valueKey="value"
					labelKey="label"
					placeholder="Выберите язык..."
					@change="onLanguageChange"
					class="settings-select"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useSettingsStore } from '@/stores/settings'
	import languageNames from '@/locales/languageNames.js'
	import UiSelect from '@/components/UI/UiSelect.vue'

	defineOptions({
		name: 'SettingsGeneral'
	})

	const { locale } = useI18n()
	const store = useSettingsStore()
	const availableLanguages = ['ru', 'en']

	// Create options array with proper labels
	const languageOptions = computed(() => {
		return availableLanguages.map(lang => ({
			value: lang,
			label: languageNames[lang] || lang.toUpperCase()
		}))
	})

	function onLanguageChange() {
		// Update store
		store.setLanguage(store.general.language)
		// Update i18n locale
		locale.value = store.general.language
		console.log('Language changed to:', store.general.language)
		
		// Auto-save the language setting
		autoSaveLanguageSetting()
	}
	
	async function autoSaveLanguageSetting() {
		try {
			const current = await window.electronAPI.getSettings()
			const updated = {
				...current,
				general: {
					...current.general,
					language: store.general.language
				}
			}
			window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
			console.log('Language setting auto-saved')
		} catch (error) {
			console.error('Failed to auto-save language setting:', error)
		}
	}
</script>