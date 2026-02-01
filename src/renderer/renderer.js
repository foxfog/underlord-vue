// src/renderer/renderer.js

import './public/styles/main.css'
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
  
  
  // Синхронизируем i18n locale с настройками
  if (settings?.general?.language) {
    i18n.global.locale.value = settings.general.language
  }
  
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

  // Отслеживаем размеры #app в реальном времени
  const appElement = document.getElementById('app')
  if (appElement) {
    const updateAppSize = () => {
      const width = appElement.offsetWidth
      const height = appElement.offsetHeight
      appElement.style.setProperty('--appW', `${width}px`)
      appElement.style.setProperty('--appH', `${height}px`)
    }

    // Первый вызов
    updateAppSize()

    // ResizeObserver для отслеживания изменений размера
    const resizeObserver = new ResizeObserver(() => {
      updateAppSize()
    })

    resizeObserver.observe(appElement)
  }
}
main()