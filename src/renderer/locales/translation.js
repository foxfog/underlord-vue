// src/renderer/locales/translation.js

import i18n from "./index.js"

const Trans = {
	get supportedLocales() {
		return "ru,en"
	},

	set currentLocale(newLocale) {
		i18n.global.locale.value = newLocale
	},

	async switchLanguage(newLocale) {
		Trans.currentLocale = newLocale
		document.querySelector("html").setAttribute("lang", newLocale)
	}
}

export default Trans