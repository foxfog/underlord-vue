import { ref, computed } from 'vue'
import { normalizeLocationData, loadCatalogs } from '@/utils/isometric/isoLoader.js'

export function useIsometricLocations() {
	const manifest = ref(null)
	const currentLocation = ref(null)
	const activeCategory = ref('tests')
	const activeLocationId = ref('carne_chief_garden')
	const isLoading = ref(false)
	const error = ref(null)

	async function loadManifest() {
		try {
			const basePath =
				typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			const fullPath = (basePath + 'data/isometric/index.json').replace(/^\/\//, '/')
			const response = await fetch(fullPath)
			if (!response.ok) {
				throw new Error(`Failed to load isometric manifest: HTTP ${response.status}`)
			}
			manifest.value = await response.json()
			return manifest.value
		} catch (err) {
			console.error('Error loading isometric manifest:', err)
			error.value = err.message
			return null
		}
	}

	async function loadLocationByPath(path) {
		isLoading.value = true
		error.value = null
		try {
			const basePath =
				typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
			const normalizedPath = path.replace(/^\//, '')
			const fullPath = basePath ? basePath + normalizedPath : '/' + normalizedPath
			const response = await fetch(fullPath)
			if (!response.ok) {
				throw new Error(`Failed to load location from ${fullPath}: HTTP ${response.status}`)
			}
			const rawData = await response.json()
			await loadCatalogs()
			const data = normalizeLocationData(rawData)
			currentLocation.value = data
			activeLocationId.value = data.id
			return data
		} catch (err) {
			console.error('Error loading location:', err)
			error.value = err.message
			return null
		} finally {
			isLoading.value = false
		}
	}

	async function loadLocationById(locationId) {
		if (!manifest.value) {
			await loadManifest()
		}

		for (const cat of manifest.value?.categories || []) {
			const loc = cat.locations.find((l) => l.id === locationId)
			if (loc) {
				activeCategory.value = cat.id
				return await loadLocationByPath(loc.path)
			}
		}

		// Fallback to test path
		return await loadLocationByPath(`/data/isometric/tests/${locationId}.json`)
	}

	// Scenario Presets & Procedural Randomizer (Answer to requirement 5)
	function applyScenarioPreset(location, presetName) {
		if (!location) return location
		const cloned = JSON.parse(JSON.stringify(location))

		if (presetName === 'weeds') {
			// Ensure weeds exist on soil or ground
			const existingWeeds = cloned.objects.filter((o) => o.type === 'weed')
			if (existingWeeds.length === 0) {
				randomizeWeeds(cloned, 5)
			}
		} else if (presetName === 'combat') {
			// Remove weeds, ensure tactical barrels and crates exist
			cloned.objects = cloned.objects.filter((o) => o.type !== 'weed')
			cloned.objects.push(
				{ id: 'arena_barrel_1', type: 'barrel', name: 'Взрывная бочка', x: -1, y: 1, z: 0, solid: true, icon: '🛢️' },
				{ id: 'arena_barrel_2', type: 'barrel', name: 'Взрывная бочка', x: 1, y: -1, z: 0, solid: true, icon: '🛢️' }
			)
		} else if (presetName === 'sandbox') {
			// Clean sandbox with only permanent landmarks (wells)
			cloned.objects = cloned.objects.filter((o) => o.type === 'well' || o.type === 'fence')
		}

		currentLocation.value = cloned
		return cloned
	}

	function randomizeWeeds(location, count = 5) {
		if (!location || !location.tiles) return
		// Remove existing weeds
		location.objects = location.objects.filter((o) => o.type !== 'weed')

		const candidates = location.tiles.filter(
			(t) =>
				(t.z === 0 || t.z === undefined) &&
				t.walkable !== false &&
				t.type !== 'stone_wall' &&
				!(t.x === (location.defaultSpawn?.x || 0) && t.y === (location.defaultSpawn?.y || 0)) &&
				!location.objects.some((o) => o.x === t.x && o.y === t.y)
		)

		// Shuffle candidates
		const shuffled = [...candidates].sort(() => Math.random() - 0.5)
		const picked = shuffled.slice(0, count)

		picked.forEach((t, i) => {
			location.objects.push({
				id: `random_weed_${i + 1}`,
				type: 'weed',
				name: 'Сорняк',
				x: t.x,
				y: t.y,
				z: t.z || 0,
				size: [1, 1],
				solid: false,
				interactive: true,
				action: 'weed',
				icon: '🌿',
				description: 'Случайно выросший сорняк.'
			})
		})
	}

	const testLocations = computed(() => {
		const testCat = manifest.value?.categories?.find((c) => c.id === 'tests')
		return testCat?.locations || []
	})

	const allCategories = computed(() => {
		return manifest.value?.categories || []
	})

	return {
		manifest,
		currentLocation,
		activeCategory,
		activeLocationId,
		isLoading,
		error,
		loadManifest,
		loadLocationByPath,
		loadLocationById,
		applyScenarioPreset,
		randomizeWeeds,
		testLocations,
		allCategories
	}
}
