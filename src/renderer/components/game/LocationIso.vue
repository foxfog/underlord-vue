<template>
	<div class="location _isometric">
		<div class="isometric-grid" ref="gridContainer">
			<div 
				v-for="tile in locationTiles" 
				:key="`${tile.x},${tile.y}`"
				class="tile"
				:style="getTilePosition(tile.x, tile.y)"
				:data-coords="`${tile.x},${tile.y}`"
				:data-id="tile.id"
				:class="{ 'empty-tile': tile.id === 0 }"
			>
				<div class="tile-content">
					{{ tile.x }},{{ tile.y }}
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
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted } from 'vue'
	import { getTileById, getTileImageUrl } from '../../utils/tileLoader.js'
	import { getLocationById, getLocationTiles } from '../../utils/locationLoader.js'
	
	const gridContainer = ref(null)
	
	// Tile size constants
	const TILE_WIDTH = 16
	const TILE_HEIGHT = 8
	
	// Location data
	const locationData = ref(null)
	
	// Load location data
	onMounted(() => {
		// Load the mc-apartment location by default
		locationData.value = getLocationById('mc-apartment')
	})
	
	// Get tiles from location data (level-1 by default)
	const locationTiles = computed(() => {
		if (!locationData.value) return []
		
		// Get tiles for level-1
		const tiles = getLocationTiles('mc-apartment', 'level-1')
		
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
	
	// Get tile image URL based on tile ID
	function getTileImage(tileId) {
		const imageUrl = getTileImageUrl(tileId)
		return imageUrl || '/images/tiles/prototype/floor/slab.png' // fallback image
	}
	
	// Get alt text for tile image
	function getTileAltText(tileId) {
		const tile = getTileById(tileId)
		return tile ? tile.name || `Tile ${tileId}` : 'Tile'
	}
</script>

<style scoped>
	.location {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
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