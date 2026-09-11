/**
 * Development-friendly conditional logger
 */

const isDev = typeof import.meta !== 'undefined' && import.meta.env ? Boolean(import.meta.env.DEV) : true

export const logger = {
	log(...args) {
		if (isDev || globalThis.__VN_DEBUG__) {
			console.log(...args)
		}
	},
	info(...args) {
		if (isDev || globalThis.__VN_DEBUG__) {
			console.info(...args)
		}
	},
	warn(...args) {
		console.warn(...args)
	},
	error(...args) {
		console.error(...args)
	},
	debug(...args) {
		if (isDev || globalThis.__VN_DEBUG__) {
			console.debug(...args)
		}
	}
}
