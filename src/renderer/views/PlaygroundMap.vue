<template>
	<div class="playground-content">
		<div class="map-section">
			<h2>Изометрическая карта</h2>
			<div class="map-info">
				<p>Карта {{ mapSize }}x{{ mapSize }} клеток. Игрок: ({{ player.x }}, {{ player.y }})</p>
				<div class="controls-info">
					<span>Управление: стрелки или клик по карте</span>
				</div>
			</div>
			
			<div class="map-container" @click="handleMapClick" tabindex="0" @keydown="handleKeyDown" ref="mapContainer">
				<div class="isometric-map" :style="mapStyle">
					<!-- Grid tiles -->
					<div 
						v-for="tile in visibleTiles" 
						:key="`${tile.x}-${tile.y}`"
						:class="['iso-tile', { 'highlight': tile.highlight }]"
						:style="getTileStyle(tile.x, tile.y)"
						@click.stop="movePlayerTo(tile.x, tile.y)"
					></div>
					
					<!-- Player character -->
					<div 
						class="player-character"
						:style="getPlayerStyle()"
					>
						<div class="player-sprite">🧙‍♂️</div>
						<div class="player-shadow"></div>
					</div>
				</div>
			</div>
			
			<div class="map-controls">
				<button class="control-btn" @click="zoomIn">
					<span class="icon">🔍</span>
					Увеличить
				</button>
				<button class="control-btn" @click="zoomOut">
					<span class="icon">🔎</span>
					Уменьшить
				</button>
				<button class="control-btn" @click="centerOnPlayer">
					<span class="icon">🎯</span>
					Центрировать
				</button>
				<button class="control-btn" @click="resetView">
					<span class="icon">🔄</span>
					Сброс
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
	
	// Map configuration
	const mapSize = ref(100)
	const tileSize = ref(32) // Base tile size in pixels
	const zoom = ref(1)
	const camera = ref({ x: 0, y: 0 })
	
	// Player state
	const player = ref({ x: 50, y: 50 }) // Start in center
	
	// Map container reference
	const mapContainer = ref(null)
	
	// Viewport dimensions
	const viewport = ref({ width: 800, height: 600 })
	
	// Computed properties
	const actualTileSize = computed(() => tileSize.value * zoom.value)
	
	const mapStyle = computed(() => ({
		transform: `translate(${-camera.value.x}px, ${-camera.value.y}px)`,
		transition: 'transform 0.3s ease'
	}))
	
	// Calculate visible tiles for performance
	const visibleTiles = computed(() => {
		const tiles = []
		const margin = 5 // Extra tiles around viewport
		
		// Calculate which tiles are visible
		const startX = Math.max(0, Math.floor((camera.value.x - margin * actualTileSize.value) / actualTileSize.value))
		const endX = Math.min(mapSize.value - 1, Math.ceil((camera.value.x + viewport.value.width + margin * actualTileSize.value) / actualTileSize.value))
		const startY = Math.max(0, Math.floor((camera.value.y - margin * actualTileSize.value) / actualTileSize.value))
		const endY = Math.min(mapSize.value - 1, Math.ceil((camera.value.y + viewport.value.height + margin * actualTileSize.value) / actualTileSize.value))
		
		for (let x = startX; x <= endX; x++) {
			for (let y = startY; y <= endY; y++) {
				tiles.push({ 
					x, 
					y, 
					highlight: Math.abs(x - player.value.x) <= 1 && Math.abs(y - player.value.y) <= 1
				})
			}
		}
		
		return tiles
	})
	
	// Convert grid coordinates to isometric screen position
	function gridToIso(gridX, gridY) {
		const isoX = (gridX - gridY) * (actualTileSize.value / 2)
		const isoY = (gridX + gridY) * (actualTileSize.value / 4)
		return { x: isoX, y: isoY }
	}
	
	// Convert screen coordinates to grid coordinates
	function screenToGrid(screenX, screenY) {
		// Adjust for camera position
		const localX = screenX + camera.value.x
		const localY = screenY + camera.value.y
		
		// Convert to grid coordinates
		const gridX = Math.floor((localX / (actualTileSize.value / 2) + localY / (actualTileSize.value / 4)) / 2)
		const gridY = Math.floor((localY / (actualTileSize.value / 4) - localX / (actualTileSize.value / 2)) / 2)
		
		return { x: gridX, y: gridY }
	}
	
	// Get tile style for positioning
	function getTileStyle(gridX, gridY) {
		const { x, y } = gridToIso(gridX, gridY)
		return {
			left: `${x + viewport.value.width / 2}px`,
			top: `${y + viewport.value.height / 2}px`,
			width: `${actualTileSize.value}px`,
			height: `${actualTileSize.value / 2}px`
		}
	}
	
	// Get player style for positioning
	function getPlayerStyle() {
		const { x, y } = gridToIso(player.value.x, player.value.y)
		return {
			left: `${x + viewport.value.width / 2}px`,
			top: `${y + viewport.value.height / 2 - actualTileSize.value / 4}px`,
			transition: 'all 0.3s ease'
		}
	}
	
	// Player movement
	function movePlayerTo(newX, newY) {
		if (newX >= 0 && newX < mapSize.value && newY >= 0 && newY < mapSize.value) {
			player.value.x = newX
			player.value.y = newY
			centerOnPlayer()
		}
	}
	
	function movePlayer(deltaX, deltaY) {
		const newX = player.value.x + deltaX
		const newY = player.value.y + deltaY
		movePlayerTo(newX, newY)
	}
	
	// Camera controls
	function centerOnPlayer() {
		const { x, y } = gridToIso(player.value.x, player.value.y)
		camera.value.x = x
		camera.value.y = y
	}
	
	function zoomIn() {
		zoom.value = Math.min(zoom.value * 1.2, 3)
	}
	
	function zoomOut() {
		zoom.value = Math.max(zoom.value / 1.2, 0.3)
	}
	
	function resetView() {
		zoom.value = 1
		centerOnPlayer()
	}
	
	// Event handlers
	function handleMapClick(event) {
		const rect = mapContainer.value.getBoundingClientRect()
		const screenX = event.clientX - rect.left
		const screenY = event.clientY - rect.top
		
		const { x, y } = screenToGrid(screenX, screenY)
		movePlayerTo(x, y)
	}
	
	function handleKeyDown(event) {
		switch (event.key) {
			case 'ArrowUp':
				event.preventDefault()
				movePlayer(0, -1)
				break
			case 'ArrowDown':
				event.preventDefault()
				movePlayer(0, 1)
				break
			case 'ArrowLeft':
				event.preventDefault()
				movePlayer(-1, 0)
				break
			case 'ArrowRight':
				event.preventDefault()
				movePlayer(1, 0)
				break
			case '=':
			case '+':
				event.preventDefault()
				zoomIn()
				break
			case '-':
				event.preventDefault()
				zoomOut()
				break
		}
	}
	
	// Lifecycle hooks
	onMounted(() => {
		// Set initial viewport size
		if (mapContainer.value) {
			const rect = mapContainer.value.getBoundingClientRect()
			viewport.value.width = rect.width
			viewport.value.height = rect.height
			
			// Focus for keyboard input
			mapContainer.value.focus()
		}
		
		// Center on player initially
		nextTick(() => {
			centerOnPlayer()
		})
		
		// Add window resize listener
		window.addEventListener('resize', updateViewport)
	})
	
	onUnmounted(() => {
		window.removeEventListener('resize', updateViewport)
	})
	
	function updateViewport() {
		if (mapContainer.value) {
			const rect = mapContainer.value.getBoundingClientRect()
			viewport.value.width = rect.width
			viewport.value.height = rect.height
		}
	}
</script>

<style scoped>
	.playground-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.map-section {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		padding: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.map-section h2 {
		color: var(--color-primary, #fff);
		margin-bottom: 1rem;
		font-size: 1.8rem;
	}
	
	.map-info {
		margin-bottom: 1rem;
		text-align: center;
	}
	
	.map-info p {
		color: var(--color-text-secondary, #aaa);
		font-size: 0.9rem;
		margin: 0 0 0.5rem 0;
	}
	
	.controls-info {
		color: var(--color-primary, #fff);
		font-size: 0.8rem;
		padding: 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border-radius: 4px;
	}
	
	.map-container {
		position: relative;
		width: 100%;
		height: 600px;
		background: linear-gradient(135deg, #1a2332, #2c3e50);
		border-radius: 8px;
		overflow: hidden;
		border: 2px solid rgba(255, 255, 255, 0.1);
		cursor: crosshair;
		outline: none;
	}
	
	.map-container:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
	}
	
	.isometric-map {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		transform-origin: center center;
	}
	
	.iso-tile {
		position: absolute;
		background: linear-gradient(135deg, #34495e 0%, #2c3e50 50%, #1a252f 100%);
		border: 1px solid rgba(255, 255, 255, 0.1);
		transform: rotateX(60deg) rotateY(0deg) rotateZ(45deg);
		transform-style: preserve-3d;
		cursor: pointer;
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
	}
	
	.iso-tile:hover {
		background: linear-gradient(135deg, #4a6741 0%, #3d5a32 50%, #2f4327 100%);
		border-color: var(--color-primary);
		transform: rotateX(60deg) rotateY(0deg) rotateZ(45deg) translateZ(2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
	}
	
	.iso-tile.highlight {
		background: linear-gradient(135deg, #5a7c47 0%, #4a6741 50%, #3d5a32 100%);
		border-color: rgba(76, 175, 80, 0.6);
		box-shadow: 0 0 10px rgba(76, 175, 80, 0.4);
	}
	
	.player-character {
		position: absolute;
		z-index: 1000;
		pointer-events: none;
		transform-origin: center bottom;
	}
	
	.player-sprite {
		font-size: 2rem;
		filter: drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.8));
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: radial-gradient(circle at center, rgba(255, 255, 255, 0.2) 0%, transparent 70%);
		border-radius: 50%;
		animation: playerIdle 2s ease-in-out infinite alternate;
	}
	
	.player-shadow {
		position: absolute;
		bottom: -5px;
		left: 50%;
		transform: translateX(-50%);
		width: 20px;
		height: 8px;
		background: radial-gradient(ellipse, rgba(0, 0, 0, 0.4) 0%, transparent 70%);
		border-radius: 50%;
	}
	
	@keyframes playerIdle {
		0% { transform: translateY(0px) scale(1); }
		100% { transform: translateY(-2px) scale(1.05); }
	}
	
	.map-controls {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1rem;
		flex-wrap: wrap;
	}
	
	.control-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 6px;
		color: var(--color-white);
		cursor: pointer;
		transition: all 0.3s ease;
		font-size: 0.9rem;
		min-width: 120px;
		justify-content: center;
	}
	
	.control-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: var(--color-primary);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}
	
	.control-btn:active {
		transform: translateY(0px);
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
	}
	
	.icon {
		font-size: 1rem;
	}
	
	/* Responsive adjustments */
	@media (max-width: 768px) {
		.map-container {
			height: 400px;
		}
		
		.control-btn {
			padding: 0.5rem 0.75rem;
			font-size: 0.8rem;
			min-width: 100px;
		}
		
		.player-sprite {
			font-size: 1.5rem;
			width: 24px;
			height: 24px;
		}
		
		.map-controls {
			gap: 0.5rem;
		}
	}
	
	/* Performance optimizations */
	.iso-tile {
		will-change: transform, background;
	}
	
	.player-character {
		will-change: transform;
	}
	
	.isometric-map {
		will-change: transform;
	}
</style>