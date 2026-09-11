/**
 * Lightweight Game Event Bus
 * Provides typed event handling and maintains backward compatibility with window.dispatchEvent
 */

class EventBus {
	constructor() {
		this.listeners = new Map()
	}

	on(event, callback) {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set())
		}
		this.listeners.get(event).add(callback)
		return () => this.off(event, callback)
	}

	off(event, callback) {
		if (this.listeners.has(event)) {
			this.listeners.get(event).delete(callback)
		}
	}

	emit(event, payload) {
		// 1. Notify internal subscribers
		if (this.listeners.has(event)) {
			for (const callback of this.listeners.get(event)) {
				try {
					callback(payload)
				} catch (err) {
					console.error(`[EventBus] Error in listener for ${event}:`, err)
				}
			}
		}

		// 2. Dispatch CustomEvent to window for backward compatibility
		if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
			try {
				window.dispatchEvent(new CustomEvent(event, { detail: payload }))
			} catch (err) {
				console.error(`[EventBus] Error dispatching window event for ${event}:`, err)
			}
		}
	}

	clear() {
		this.listeners.clear()
	}
}

export const eventBus = new EventBus()
