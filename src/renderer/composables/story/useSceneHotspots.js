export function useSceneHotspots({
	globalData,
	sceneData,
	currentScene,
	emit,
	showNotification,
	showNarration,
	playSound,
	goToLabel,
	evaluateCondition
} = {}) {
	function discoverLocation(mapId, locationInput, options = {}) {
		if (!mapId || !locationInput) return false

		if (!globalData.value) {
			globalData.value = {}
		}
		if (!globalData.value.discoveredLocations) {
			globalData.value.discoveredLocations = {}
		}
		if (!Array.isArray(globalData.value.discoveredLocations[mapId])) {
			globalData.value.discoveredLocations[mapId] = []
		}

		const list = globalData.value.discoveredLocations[mapId]
		const locationsToAdd = Array.isArray(locationInput) ? locationInput : [locationInput]
		const newlyDiscovered = []

		locationsToAdd.forEach((locId) => {
			if (locId && typeof locId === 'string' && !list.includes(locId)) {
				list.push(locId)
				newlyDiscovered.push(locId)
			}
		})

		if (newlyDiscovered.length > 0) {
			console.log(`🗺 [Location Discovered] map="${mapId}":`, newlyDiscovered)

			if (options.notification || options.title || options.notify) {
				const label =
					options.title ||
					(typeof options.notification === 'string' ? options.notification : null)
				if (label || options.notification) {
					const notifText =
						typeof options.notification === 'string'
							? options.notification
							: `<p><b>📍 Открыта новая локация</b></p><p>${label}</p>`
					if (showNotification) {
						showNotification(notifText, 'info', options.duration || 3500)
					}
				}
			}

			if (emit) {
				emit('global-data-changed', globalData.value)
			}
			return true
		}
		return false
	}

	function undiscoverLocation(mapId, locationInput) {
		if (!mapId || !locationInput) return false
		if (!globalData.value?.discoveredLocations?.[mapId]) return false

		const list = globalData.value.discoveredLocations[mapId]
		const locationsToRemove = Array.isArray(locationInput) ? locationInput : [locationInput]
		const initialLen = list.length
		globalData.value.discoveredLocations[mapId] = list.filter(
			(locId) => !locationsToRemove.includes(locId)
		)

		if (globalData.value.discoveredLocations[mapId].length !== initialLen) {
			console.log(`🗺 [Location Undiscovered] map="${mapId}":`, locationsToRemove)
			if (emit) {
				emit('global-data-changed', globalData.value)
			}
			return true
		}
		return false
	}

	function isLocationDiscovered(mapId, locationId) {
		if (!globalData.value?.discoveredLocations) return false
		const list = globalData.value.discoveredLocations[mapId]
		return Array.isArray(list) && list.includes(locationId)
	}

	function setHotspotStatus(sceneId, hotspotId, status = 'active', lockedAction = null) {
		if (!sceneId || !hotspotId) return

		if (!globalData.value) {
			globalData.value = {}
		}
		if (!globalData.value.sceneHotspots) {
			globalData.value.sceneHotspots = {}
		}
		if (!globalData.value.sceneHotspots[sceneId]) {
			globalData.value.sceneHotspots[sceneId] = {}
		}

		if (lockedAction) {
			globalData.value.sceneHotspots[sceneId][hotspotId] = {
				status,
				lockedAction
			}
		} else {
			globalData.value.sceneHotspots[sceneId][hotspotId] = status
		}

		console.log(
			`🚪 [Hotspot Updated] scene="${sceneId}" id="${hotspotId}" status="${status}"`
		)

		if (emit) {
			emit('global-data-changed', globalData.value)
		}
	}

	function getHotspotStatus(sceneId, hotspot) {
		if (!sceneId || !hotspot) return 'active'
		const hotspotId = typeof hotspot === 'string' ? hotspot : hotspot.id
		if (!hotspotId) return 'active'

		// 1. Saved delta override in globalData.sceneHotspots
		const delta = globalData.value?.sceneHotspots?.[sceneId]?.[hotspotId]
		if (delta !== undefined && delta !== null) {
			if (typeof delta === 'string') return delta
			if (typeof delta === 'object' && delta.status) return delta.status
		}

		if (typeof hotspot === 'string') return 'active'

		// 2. Dynamic condition
		if (hotspot.condition && evaluateCondition) {
			const isPassed = evaluateCondition(hotspot.condition)
			return isPassed ? 'active' : hotspot.fallbackStatus || 'locked'
		}

		// 3. Static status
		return hotspot.status || 'active'
	}

	function handleHotspotStep(step) {
		if (!step || typeof step !== 'object') return
		const sceneId =
			step.scene ||
			step.sceneId ||
			(currentScene.value ? currentScene.value.id : null)
		const hotspotId = step.id || step.hotspot || step.hotspotId
		if (!sceneId || !hotspotId) {
			console.warn('⚠️ [Hotspot Step] Missing scene or hotspot id:', step)
			return
		}

		let status = step.status
		if (step.type === 'unlock-hotspot' || step.type === 'show-hotspot') {
			status = 'active'
		} else if (step.type === 'lock-hotspot') {
			status = 'locked'
		} else if (step.type === 'hide-hotspot') {
			status = 'hidden'
		} else if (!status) {
			status = 'active'
		}

		let lockedAction = step.lockedAction || null
		if (!lockedAction && (step.text || step.sound || step.notification || step.goto)) {
			lockedAction = {
				text: step.text,
				sound: step.sound,
				notification: step.notification,
				notificationType: step.notificationType || 'warning',
				duration: step.duration,
				goto: step.goto
			}
		}

		setHotspotStatus(sceneId, hotspotId, status, lockedAction)
	}

	function handleHotspotClick(sceneId, hotspot) {
		if (!hotspot) return
		const resolvedSceneId = sceneId || currentScene.value?.id
		const status = getHotspotStatus(resolvedSceneId, hotspot)

		if (status === 'active') {
			let target = hotspot.target
			const scene = sceneData.value?.[resolvedSceneId] || currentScene.value
			const localMap = scene?.localMap || globalData.value?.localMap
			if (localMap && globalData.value?.mapOverrides?.[localMap]) {
				const overrides = globalData.value.mapOverrides[localMap]
				const overrideKey = hotspot.locationId || hotspot.target || hotspot.id
				if (overrides[overrideKey]) {
					target = overrides[overrideKey]
				}
			}
			if (target && goToLabel) {
				goToLabel(target)
			}
		} else if (status === 'locked') {
			const delta = globalData.value?.sceneHotspots?.[resolvedSceneId]?.[hotspot.id]
			const lockedAction =
				typeof delta === 'object' && delta?.lockedAction
					? delta.lockedAction
					: hotspot.lockedAction || {}

			if (lockedAction.sound && playSound) {
				playSound({ file: lockedAction.sound, loop: false })
			}
			if (lockedAction.notification && showNotification) {
				showNotification(
					lockedAction.notification,
					lockedAction.notificationType || 'warning',
					lockedAction.duration || 3000
				)
			}
			if (lockedAction.text && showNarration) {
				showNarration(lockedAction.text)
			}
			if (lockedAction.goto && goToLabel) {
				goToLabel(lockedAction.goto)
			}
		}
	}

	return {
		discoverLocation,
		undiscoverLocation,
		isLocationDiscovered,
		setHotspotStatus,
		getHotspotStatus,
		handleHotspotStep,
		handleHotspotClick
	}
}
