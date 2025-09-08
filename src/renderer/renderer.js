// src/renderer/renderer.js

import './public/styles/main.scss'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import i18n from './locales'
import router from './router'
import { initSettingsStore } from './stores/settings'
import uiCompontents from './components/UI'


async function main() {
	const settings = await window.electronAPI.getSettings() // получить настройки из userData/settings.json
	initSettingsStore(settings) // обязательно перед первым useSettingsStore()
	// Синхронизируем fullscreen с настройками
	if (settings?.video?.fullscreen !== undefined) {
		window.electronAPI.setFullscreen(settings.video.fullscreen)
	}
	const app = createApp(App)
	const pinia = createPinia()

	uiCompontents.forEach(uiComponent => {
		app.component(uiComponent.name, uiComponent)
	})

	app.config.globalProperties.$t = i18n.global.t

	app.use(pinia)
	app.use(i18n)
	app.use(router)
	app.mount('#app')
}
main()