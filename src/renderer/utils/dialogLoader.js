// src/renderer/utils/dialogLoader.js
import i18n from '@/locales'

// Function to dynamically import dialog data
export async function loadDialogData(dialogId) {
  try {
    // Get the current locale from the i18n instance
    const currentLocale = i18n.global.locale.value || 'en'
    
    // Use fetch to load the dialog JSON file from the public directory
    // The files are now organized by language in /dialogs/[lang]/[dialogId].json
    const response = await fetch(`/dialogs/${currentLocale}/${dialogId}.json`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch dialog data for ${dialogId} in ${currentLocale}`)
    }
    
    const dialogData = await response.json()
    return dialogData
  } catch (error) {
    console.error(`Failed to load dialog data for ${dialogId}:`, error)
    return null
  }
}

export default {
  loadDialogData
}