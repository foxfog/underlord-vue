<template>
	<div 
		class="location _isometric _active"
		@mousedown="handleMouseDown"
		@mousemove="handleMouseMove"
		@mouseup="handleMouseUp"
		@mouseleave="handleMouseUp"
		@wheel="handleWheel"
		ref="locationElement"
	>
		<div class="isometric-grid" ref="gridContainer">
			<div 
				v-for="tile in displayedTiles" 
				:key="`${tile.cord[0]},${tile.cord[1]}`"
				class="tile"
				:style="getTilePosition(tile.cord[0], tile.cord[1])"
				:data-coords="`${tile.cord[0]},${tile.cord[1]}`"
				:data-id="tile.id"
				:class="{ 'empty-tile': tile.id === 0 }"
				@click="handleTileClick(tile)"
			>
				<div class="tile-content">
					{{ tile.cord[0] }},{{ tile.cord[1] }}
				</div>
				<div class="rhomb"></div>
				<!-- Using img element instead of background-image -->
				<div v-if="tile.id !== 0" class="tile-image">
					<img 
						:src="getTileImage(tile.id)" 
						:alt="getTileAltText(tile.id)"
						class="tile-img"
					/>
				</div>
				<!-- Display objects on the tile -->
				<div v-if="getObjectsOnTile(tile.cord[0], tile.cord[1]).length > 0" class="tile-objects">
					<div 
						v-for="(obj, index) in getObjectsOnTile(tile.cord[0], tile.cord[1])" 
						:key="`${tile.cord[0]},${tile.cord[1]},${index}`"
						class="tile-object"
						:style="getObjectPositionStyle(obj)"
					>
						<img 
							:src="getObjectImage(obj.id)" 
							:alt="getObjectAltText(obj.id)"
							class="object-img"
						/>
						<!-- Display contained objects recursively -->
						<template v-if="obj.containedObjects && obj.containedObjects.length > 0">
							<div 
								v-for="(containedObj, containedIndex) in getAllContainedObjects(obj.containedObjects)" 
								:key="`${tile.cord[0]},${tile.cord[1]},${index},${containedIndex}`"
								class="contained-object"
							>
								<img 
									:src="getObjectImage(containedObj.id)" 
									:alt="getObjectAltText(containedObj.id)"
									class="contained-object-img"
								/>
							</div>
						</template>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, watch } from 'vue'
	import { useGameStore } from '@/stores/game'
	import { getTileById, getTileImageUrl } from '../../utils/tileLoader.js'
	import { getObjectById, getObjectImageUrl } from '../../utils/objectLoader.js'
	import { getLocationById, getLocationTiles } from '../../utils/locationLoader.js'
	
	const props = defineProps({
		locationData: {
			type: Object,
			default: null
		}
	})
	
	const gridContainer = ref(null)
	const locationElement = ref(null)
	const gameStore = useGameStore()
	
	// Mouse drag state
	const isDragging = ref(false)
	const dragStart = ref({ x: 0, y: 0 })
	const locationPosition = ref({ x: 0, y: 0 })
	
	// Zoom scale levels (3 gradations)
	const scaleLevels = [0.75, 1, 1.25]
	const currentScaleIndex = ref(1) // Start at normal scale (1.0)
	
	// Tile size constants
	const TILE_WIDTH = 16
	const TILE_HEIGHT = 8
	
	// Define emit for tile click events
	const emit = defineEmits(['tile-clicked'])
	
	// Handle tile click
	const handleTileClick = (tileData) => {
		// Emit tile click event with tile data
		emit('tile-clicked', tileData)
	}
	
	// Handle mouse down event
	function handleMouseDown(event) {
		// Check if middle mouse button is pressed (button === 1) and location has _active class
		if (event.button === 1 && locationElement.value.classList.contains('_active')) {
			isDragging.value = true
			dragStart.value = { x: event.clientX, y: event.clientY }
			
			// Prevent default behavior
			event.preventDefault()
		}
	}
	
	// Handle mouse move event with boundary constraints
	function handleMouseMove(event) {
		if (isDragging.value && locationElement.value.classList.contains('_active')) {
			const deltaX = event.clientX - dragStart.value.x
			const deltaY = event.clientY - dragStart.value.y
			
			// Calculate new position
			let newX = locationPosition.value.x + deltaX
			let newY = locationPosition.value.y + deltaY
			
			// Apply boundary constraints based on actual container size
			const bounds = getLocationBounds()
			newX = constrainPosition(newX, bounds.minX, bounds.maxX)
			newY = constrainPosition(newY, bounds.minY, bounds.maxY)
			
			// Update location position
			locationPosition.value.x = newX
			locationPosition.value.y = newY
			
			// Apply transform to location element (including scale)
			if (locationElement.value) {
				const scale = scaleLevels[currentScaleIndex.value]
				locationElement.value.style.transform = `translate(${locationPosition.value.x}px, ${locationPosition.value.y}px) scale(${scale})`
			}
			
			// Update drag start position for next move
			dragStart.value = { x: event.clientX, y: event.clientY }
			
			// Prevent default behavior
			event.preventDefault()
		}
	}
	
	// Handle mouse wheel for zooming
	function handleWheel(event) {
		// Only zoom when location has _active class
		if (locationElement.value.classList.contains('_active')) {
			// Prevent default scrolling behavior
			event.preventDefault()
			
			// Determine zoom direction
			if (event.deltaY < 0) {
				// Zoom in (scroll up) - move to next scale level if possible
				if (currentScaleIndex.value < scaleLevels.length - 1) {
					currentScaleIndex.value++
				}
			} else {
				// Zoom out (scroll down) - move to previous scale level if possible
				if (currentScaleIndex.value > 0) {
					currentScaleIndex.value--
				}
			}
			
			// Apply new scale
			const scale = scaleLevels[currentScaleIndex.value]
			if (locationElement.value) {
				locationElement.value.style.transform = `translate(${locationPosition.value.x}px, ${locationPosition.value.y}px) scale(${scale})`
			}
		}
	}
	
	// Get location bounds for constraining movement based on actual content
	function getLocationBounds() {
		if (!locationElement.value) return { minX: -200, maxX: 200, minY: -200, maxY: 200 }
		
		// Get the container dimensions
		const containerRect = locationElement.value.getBoundingClientRect()
		const containerWidth = containerRect.width
		const containerHeight = containerRect.height
		
		// Get the parent container dimensions (viewport)
		const parentElement = locationElement.value.parentElement
		if (!parentElement) return { minX: -200, maxX: 200, minY: -200, maxY: 200 }
		
		const parentRect = parentElement.getBoundingClientRect()
		const parentWidth = parentRect.width
		const parentHeight = parentRect.height
		
		// Calculate boundaries based on actual sizes
		// Allow movement so that the map can be fully visible but not excessively off-screen
		const padding = 100 // pixels of allowable overflow
		
		// Maximum positive movement (moving right/down)
		const maxX = Math.max(padding, 0)
		const maxY = Math.max(padding, 0)
		
		// Maximum negative movement (moving left/up) - based on map size
		const minX = Math.min(-containerWidth + parentWidth - padding, 0)
		const minY = Math.min(-containerHeight + parentHeight - padding, 0)
		
		return { minX, maxX, minY, maxY }
	}
	
	// Constrain a position value between min and max
	function constrainPosition(value, min, max) {
		return Math.max(min, Math.min(max, value))
	}
	
	// Handle mouse up event
	function handleMouseUp() {
		isDragging.value = false
	}
	
	// Get tiles from location data (level-1 by default)
	const locationTiles = computed(() => {
		// Use location from game store, fallback to 'mc-apartment' if not set
		const locationId = gameStore.location || 'mc-apartment'
		const locationData = getLocationById(locationId)
		
		if (!locationData) return []
		
		// Get tiles for level-1
		const tiles = getLocationTiles(locationId, 'level-1')
		
		// Flatten the 2D array of tiles into a 1D array
		if (tiles) {
			const flatTiles = []
			tiles.forEach(row => {
				flatTiles.push(...row)
			})
			return flatTiles
		}
		
		return []
	})
	
	// Displayed tiles - use edited data when in edit mode, otherwise use regular location data
	const displayedTiles = computed(() => {
		// If we have edited location data, use that
		if (props.locationData && props.locationData.levels && props.locationData.levels['level-1']) {
			const level = props.locationData.levels['level-1']
			if (level.floor) {
				// Flatten the 2D array of tiles into a 1D array
				const flatTiles = []
				level.floor.forEach(row => {
					flatTiles.push(...row)
				})
				return flatTiles
			}
		}
		
		// Otherwise, use the regular location tiles
		return locationTiles.value
	})
	
	// Get objects on a specific tile
	const getObjectsOnTile = (x, y) => {
		// If we have edited location data, use that
		if (props.locationData && props.locationData.levels && props.locationData.levels['level-1']) {
			const level = props.locationData.levels['level-1']
			if (level.objects) {
				// Filter objects that are on the specified tile
				return level.objects.filter(obj => 
					obj.position && obj.position.cord && obj.position.cord[0] === x && obj.position.cord[1] === y
				)
			}
		}
		
		// Otherwise, use the regular location data
		const locationId = gameStore.location || 'mc-apartment'
		const locationData = getLocationById(locationId)
		
		if (locationData && locationData.levels && locationData.levels['level-1']) {
			const level = locationData.levels['level-1']
			if (level.objects) {
				// Filter objects that are on the specified tile
				return level.objects.filter(obj => 
					obj.position && obj.position.cord && obj.position.cord[0] === x && obj.position.cord[1] === y
				)
			}
		}
		
		return []
	}
	
	// Get all contained objects recursively (flatten nested structure)
	const getAllContainedObjects = (containedObjects) => {
		const allObjects = []
		
		const traverse = (objects) => {
			if (!objects || !Array.isArray(objects)) return
			
			objects.forEach(obj => {
				allObjects.push(obj)
				if (obj.containedObjects && Array.isArray(obj.containedObjects)) {
					traverse(obj.containedObjects)
				}
			})
		}
		
		traverse(containedObjects)
		return allObjects
	}
	
	// Calculate isometric position for a tile
	function getTilePosition(x, y) {
		// Isometric projection formulas
		const isoX = (x - y) * (TILE_WIDTH / 2)
		const isoY = (x + y) * (TILE_HEIGHT / 2)
		
		return {
			left: `${isoX}em`,
			top: `${isoY}em`
		}
	}
	
	// Get object position style with offset
	function getObjectPositionStyle(obj) {
		if (!obj.pos) return {}
		
		// Convert percentage offsets to CSS transform
		const xOffset = obj.pos[0] || 0
		const yOffset = obj.pos[1] || 0
		
		return {
			transform: `translate(${xOffset}%, ${yOffset}%)`
		}
	}
	
	// Get tile image URL based on tile ID
	function getTileImage(tileId) {
		const imageUrl = getTileImageUrl(tileId)
		return imageUrl || '/images/tiles/prototype/floor/slab.png' // fallback image
	}
	
	// Get object image URL based on object ID
	function getObjectImage(objectId) {
		const imageUrl = getObjectImageUrl(objectId)
		return imageUrl || '/images/tiles/prototype/object/default.png' // fallback image
	}
	
	// Get alt text for tile image
	function getTileAltText(tileId) {
		const tile = getTileById(tileId)
		return tile ? tile.name || `Tile ${tileId}` : 'Tile'
	}
	
	// Get alt text for object image
	function getObjectAltText(objectId) {
		const object = getObjectById(objectId)
		return object ? object.name || `Object ${objectId}` : 'Object'
	}
	
	// Calculate the bounding box for all tiles
	const locationBounds = computed(() => {
		if (!displayedTiles.value.length) return { minX: 0, maxX: 0, minY: 0, maxY: 0 }
		
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
		
		displayedTiles.value.forEach(tile => {
			const pos = getTilePosition(tile.cord[0], tile.cord[1])
			const x = parseFloat(pos.left)
			const y = parseFloat(pos.top)
			
			// Convert from em to numeric value for calculations
			if (x < minX) minX = x
			if (x > maxX) maxX = x
			if (y < minY) minY = y
			if (y > maxY) maxY = y
		})
		
		// Add padding for tile dimensions
		minX -= TILE_WIDTH / 2
		maxX += TILE_WIDTH / 2
		minY -= TILE_HEIGHT / 2
		maxY += TILE_HEIGHT / 2
		
		return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY }
	})
</script>

<style scoped>
	.location {
		position: relative;
		width: v-bind('locationBounds.width + "em"');
		height: v-bind('locationBounds.height + "em"');
		overflow: visible;
		background: green;
		.isometric-grid {
			position: relative;
			width: 100%;
			height: 100%;
			transform: translate(50%, 50%);
			.tile {
				position: absolute;
				width: v-bind('TILE_WIDTH + "em"');
				height: v-bind('TILE_HEIGHT + "em"');
				display: flex;
				align-items: center;
				justify-content: center;
				transition: all 0.2s ease;
				z-index: 1;
				pointer-events: none;
				&.empty-tile {
					visibility: hidden;
				}
				.tile-content {
					position: absolute;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 1em;
					color: white;
					font-weight: bold;
					z-index: 3;
				}
				.rhomb {
					width: 100%;
					height: 200%;
					border: 1px solid red;
					position: absolute;
					z-index: 2;
					transform: rotateX(60deg) rotateZ(45deg);
					scale: 0.7111;
					pointer-events: all;
				}
				.tile-image {
					width: 100%;
					height: 100%;
					.tile-img {
						width: 100%;
						height: auto;
						object-fit: cover; /* This will prevent clipping */
						display: block;
					}
				}
				.tile-objects {
					position: absolute;
					width: 100%;
					height: 100%;
					z-index: 4;
					pointer-events: none;
					.tile-object {
						position: absolute;
						width: 100%;
						height: 100%;
						.object-img {
							width: 100%;
							height: auto;
							object-fit: contain;
							display: block;
						}
						.contained-object {
							position: absolute;
							width: 100%;
							height: 100%;
							.contained-object-img {
								width: 100%;
								height: auto;
								object-fit: contain;
								display: block;
							}
						}
					}
				}
				&:has(.rhomb:hover) {
					.rhomb {
						background: red;
					}
				}
				/* Removed the background-image CSS since we're now using img element */
			}
		}
	}
</style>