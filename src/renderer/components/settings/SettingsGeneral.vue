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

		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Скорость текста:</div>
				<div class="settings-item-description">
					{{ store.general.textSpeed === 100 ? 'Мгновенно' : store.general.textSpeed }}
				</div>
			</div>
			<div class="right">
				<UiRange
					v-model="store.general.textSpeed"
					:min="1"
					:max="100"
					@change="onTextSpeedChange"
					class="settings-range"
				/>
			</div>
		</div>

		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Пропускать заставку:</div>
				<div class="settings-item-description">при запуске игры</div>
			</div>
			<div class="right">
				<UiCheckbox
					v-model="store.general.skipSplash"
					mode="switch"
					@change="onSkipSplashChange"
				>
				</UiCheckbox>
			</div>
		</div>

		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Затемнение между сценами:</div>
				<div class="settings-item-description">плавный переход при смене локаций</div>
			</div>
			<div class="right">
				<UiCheckbox
					v-model="store.general.sceneTransitions"
					mode="switch"
					@change="onSceneTransitionsChange"
				>
				</UiCheckbox>
			</div>
		</div>

		<div class="settings-item">
			<div class="left">
				<div class="settings-item-label">Анимации в бою:</div>
				<div class="settings-item-description">плавное перемещение и визуальные эффекты</div>
			</div>
			<div class="right">
				<UiCheckbox
					v-model="store.general.combatAnimations"
					mode="switch"
					@change="onCombatAnimationsChange"
				>
				</UiCheckbox>
			</div>
		</div>

		<div class="settings-item" v-if="store.general.combatAnimations">
			<div class="left">
				<div class="settings-item-label">Скорость боя:</div>
				<div class="settings-item-description">множитель скорости перемещения и эффектов</div>
			</div>
			<div class="right">
				<UiSelect
					v-model="store.general.combatSpeed"
					:options="combatSpeedOptions"
					valueKey="value"
					labelKey="label"
					placeholder="Выберите скорость..."
					@change="onCombatSpeedChange"
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

defineOptions({
	name: 'SettingsGeneral'
})

const { locale } = useI18n()
const store = useSettingsStore()
const availableLanguages = ['ru', 'en']

// Create options array with proper labels
const languageOptions = computed(() => {
	return availableLanguages.map((lang) => ({
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

function onTextSpeedChange() {
	store.setTextSpeed(store.general.textSpeed)
	console.log('Text speed changed to:', store.general.textSpeed)
	autoSaveTextSpeedSetting()
}

function onSkipSplashChange() {
	store.setSkipSplash(store.general.skipSplash)
	console.log('Skip splash changed to:', store.general.skipSplash)
	autoSaveSkipSplashSetting()
}

function onSceneTransitionsChange() {
	store.setSceneTransitions(store.general.sceneTransitions)
	console.log('Scene transitions changed to:', store.general.sceneTransitions)
	autoSaveSceneTransitionsSetting()
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

async function autoSaveTextSpeedSetting() {
	try {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			general: {
				...current.general,
				textSpeed: store.general.textSpeed
			}
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		console.log('Text speed setting auto-saved')
	} catch (error) {
		console.error('Failed to auto-save text speed setting:', error)
	}
}

async function autoSaveSkipSplashSetting() {
	try {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			general: {
				...current.general,
				skipSplash: store.general.skipSplash
			}
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		console.log('Skip splash setting auto-saved')
	} catch (error) {
		console.error('Failed to auto-save skip splash setting:', error)
	}
}

async function autoSaveSceneTransitionsSetting() {
	try {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			general: {
				...current.general,
				sceneTransitions: store.general.sceneTransitions
			}
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		console.log('Scene transitions setting auto-saved')
	} catch (error) {
		console.error('Failed to auto-save scene transitions setting:', error)
	}
}

const combatSpeedOptions = [
	{ value: 1.0, label: '1.0x (Обычная)' },
	{ value: 1.5, label: '1.5x (Быстрая)' },
	{ value: 2.0, label: '2.0x (Турбо)' }
]

function onCombatAnimationsChange() {
	store.setCombatAnimations(store.general.combatAnimations)
	console.log('Combat animations changed to:', store.general.combatAnimations)
	autoSaveCombatAnimationsSetting()
}

function onCombatSpeedChange() {
	store.setCombatSpeed(store.general.combatSpeed)
	console.log('Combat speed changed to:', store.general.combatSpeed)
	autoSaveCombatSpeedSetting()
}

async function autoSaveCombatAnimationsSetting() {
	try {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			general: {
				...current.general,
				combatAnimations: store.general.combatAnimations
			}
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		console.log('Combat animations setting auto-saved')
	} catch (error) {
		console.error('Failed to auto-save combat animations setting:', error)
	}
}

async function autoSaveCombatSpeedSetting() {
	try {
		const current = await window.electronAPI.getSettings()
		const updated = {
			...current,
			general: {
				...current.general,
				combatSpeed: store.general.combatSpeed
			}
		}
		window.electronAPI.saveSettings(JSON.parse(JSON.stringify(updated)))
		console.log('Combat speed setting auto-saved')
	} catch (error) {
		console.error('Failed to auto-save combat speed setting:', error)
	}
}
</script>
