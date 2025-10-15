// src/renderer/locales/index.js

import { createI18n } from 'vue-i18n'
import pluralRules from './rules/pluralization'
import datetimeFormats from './rules/datetime'

function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

function loadLocaleMessages() {
  // Load all JSON files in the translations directory
  const locales = import.meta.glob('./translations/*/**/*.json', { eager: true, import: 'default' })
  const mainLocales = import.meta.glob('./translations/*/*.json', { eager: true, import: 'default' })
  
  const messages = {}

  // Process nested JSON files first (ui/common.json, game/characters.json, etc.)
  for (const path in locales) {
    const match = path.match(/\.\/translations\/([^/]+)\/(.+)\.json$/)
    if (match) {
      const [, locale, filepath] = match
      messages[locale] ??= {}
      
      // Get the translation data
      const data = locales[path]
      
      // Deep merge the data into the messages object
      if (typeof data === 'object' && data !== null) {
        deepMerge(messages[locale], data)
      }
    }
  }

  // Process main locale files (en/en.json, ru/ru.json)
  for (const path in mainLocales) {
    const match = path.match(/\.\/translations\/([^/]+)\/([^/]+)\.json$/)
    if (match) {
      const [, locale, filename] = match
      if (filename === locale) { // Only process main files like en/en.json
        messages[locale] ??= {}
        const data = mainLocales[path]
        
        // Deep merge the data into the messages object
        if (typeof data === 'object' && data !== null) {
          deepMerge(messages[locale], data)
        }
      }
    }
  }

  return messages
}

const messages = loadLocaleMessages()

const i18n = createI18n({
  legacy: false,
  locale: 'ru',
  fallbackLocale: 'ru',
  globalInjection: true,
  messages,
  pluralRules,
  datetimeFormats
})

export default i18n