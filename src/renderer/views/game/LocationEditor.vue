<template>
	<div class="location-editor">
		
		<!-- Location list view -->
		<div v-if="!selectedLocation" class="location-list-view">
			
			<div class="editor-header">
				<button @click="goBack" class="back-button">Назад к главному меню</button>
			</div>
			<p>Список локаций</p>
			<div class="location-list">
				<div 
					v-for="location in availableLocations" 
					:key="location.id"
					class="location-item"
					@click="selectLocation(location.id)"
				>
					<div class="location-info">
						<p>{{ location.name }}</p>
						<p>{{ location.description }}</p>
					</div>
					<div class="location-actions">
						<button class="edit-button">Редактировать</button>
					</div>
				</div>
			</div>
		</div>
		
		<!-- Location editor view -->
		<div v-else class="location-editor-view">
			<div class="editor-toolbar">
				<div class="editor-header">
					<button @click="goBack" class="back-button">Назад к главному меню</button>
				</div>
				<p>Редактирование: {{ currentLocationData?.name }}</p>
				<div class="toolbar-actions">
					<button @click="saveLocation" class="save-button">Сохранить</button>
					<button @click="deselectLocation" class="cancel-button">Отмена</button>
				</div>
			</div>
			<div class="editor-content">
				<div class="editor-content-left">
					<!-- Location properties -->
					<div class="location-properties">
						<p>Свойства локации</p>
						<div class="property-group">
							<label for="location-name">Название:</label>
							<input 
								id="location-name" 
								v-model="currentLocationData.name" 
								type="text" 
								class="form-control"
							/>
						</div>
						<div class="property-group">
							<label for="location-description">Описание:</label>
							<textarea 
								id="location-description" 
								v-model="currentLocationData.description" 
								class="form-control"
							></textarea>
						</div>
						
						<!-- Tile selection panel -->
						<div class="tile-selection-panel">
							<h4>Выбор тайлов</h4>
							<div class="tile-types">
								<div 
									v-for="(tile, id) in availableTiles" 
									:key="id"
									class="tile-type"
									:class="{ 'selected': selectedTileType == id }"
									@click="selectTileType(id)"
								>
									<img :src="tile.image.url" :alt="tile.name" class="tile-preview" />
									<span>{{ tile.name }}</span>
								</div>
							</div>
						</div>
						
						<!-- Object selection panel -->
						<div class="object-selection-panel">
							<h4>Выбор объектов</h4>
							<div class="object-types">
								<div 
									v-for="(object, id) in availableObjects" 
									:key="id"
									class="object-type"
									:class="{ 'selected': selectedObjectType == id }"
									@click="selectObjectType(id)"
								>
									<img :src="object.image.url" :alt="object.name" class="object-preview" />
									<span>{{ object.name }}</span>
								</div>
							</div>
						</div>
					</div>
					
					<!-- Tile editor -->
					<div class="tile-editor">
						<p>Редактирование тайлов</p>
						<div class="tile-editor-content" v-if="selectedTileForEditing">
							<h4>Тайл ({{ selectedTileForEditing.cord[0] }}, {{ selectedTileForEditing.cord[1] }})</h4>
							<div class="tile-info">
								<p>Текущий тип пола: {{ getTileName(selectedTileForEditing.id) }}</p>
								<button @click="changeFloorTile(selectedTileType)" class="change-tile-button">
									Изменить на {{ getTileName(selectedTileType) }}
								</button>
							</div>
							
							<!-- Object management for selected tile -->
							<div class="object-management">
								<h5>Объекты на тайле:</h5>
								<div v-if="getObjectsOnTile(selectedTileForEditing.cord[0], selectedTileForEditing.cord[1]).length === 0" class="no-objects">
									Нет объектов
								</div>
								<div v-else class="tile-objects">
									<div 
										v-for="(obj, index) in getObjectsOnTile(selectedTileForEditing.cord[0], selectedTileForEditing.cord[1])" 
										:key="index"
										class="tile-object"
									>
										<span>{{ getObjectDisplayName(obj.id) }}</span>
										<!-- Position offset fields -->
										<div class="position-offset-fields">
											<label>X Offset (%):</label>
											<input 
												type="number" 
												:value="obj.pos ? obj.pos[0] : 0" 
												@change="updateObjectPositionOffset(obj, selectedTileForEditing.cord[0], selectedTileForEditing.cord[1], 0, $event.target.value)"
												class="form-control small-input"
											/>
											<label>Y Offset (%):</label>
											<input 
												type="number" 
												:value="obj.pos ? obj.pos[1] : 0" 
												@change="updateObjectPositionOffset(obj, selectedTileForEditing.cord[0], selectedTileForEditing.cord[1], 1, $event.target.value)"
												class="form-control small-input"
											/>
										</div>
										
										<!-- Nested objects management -->
										<div class="nested-objects-management">
											<h6>Вложенные объекты:</h6>
											<div v-if="obj.containedObjects && obj.containedObjects.length > 0" class="nested-objects-list">
												<NestedObjectEditor 
													v-for="(nestedObj, nestedIndex) in obj.containedObjects" 
													:key="nestedIndex"
													:object="nestedObj"
													:level="1"
													:selected-object-type="selectedObjectType"
													:get-object-display-name="getObjectDisplayName"
													@add-nested-object="addNestedObject"
													@remove-nested-object="removeNestedObjectAt(obj, nestedIndex)"
												/>
											</div>
											<div v-else class="no-nested-objects">
												Нет вложенных объектов
											</div>
											<button 
												v-if="selectedObjectType" 
												@click="addNestedObject(obj)" 
												class="add-nested-object-button"
											>
												Добавить вложенный {{ getObjectDisplayName(selectedObjectType) }}
											</button>
										</div>
										
										<button @click="removeObjectFromTile(obj.id, selectedTileForEditing.cord[0], selectedTileForEditing.cord[1])" class="remove-object-button">
											Удалить
										</button>
									</div>
								</div>
								<div class="object-actions">
									<button 
										v-if="selectedObjectType" 
										@click="addObjectToTile(selectedObjectType, selectedTileForEditing.cord[0], selectedTileForEditing.cord[1])" 
										class="add-object-button"
									>
										Добавить {{ getObjectDisplayName(selectedObjectType) }}
									</button>
								</div>
							</div>
						</div>
						<div class="tile-editor-content" v-else>
							<p>Выберите тайл на визуализации для редактирования</p>
						</div>
					</div>
				</div>
				<!-- Location visualization -->
				<div class="location-visualization">
					<div class="location-preview">
						<LocationIso 
							:location-data="currentLocationData" 
							@tile-clicked="handleTileClick"
						/>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed } from 'vue'
	import { useRouter } from 'vue-router'
	import { useGameStore } from '@/stores/game'
	import { getLocationById, getAllLocations } from '@/utils/locationLoader.js'
	import { getAllTiles } from '@/utils/tileLoader.js'
	import { getAllObjects } from '@/utils/objectLoader.js'
	import LocationIso from '@/components/game/LocationIso.vue'
	import NestedObjectEditor from '@/components/game/NestedObjectEditor.vue'
	
	const router = useRouter()
	const gameStore = useGameStore()
	
	// State
	const selectedLocation = ref(null)
	const currentLocationData = ref(null)
	const selectedTileForEditing = ref(null)
	const selectedTileType = ref('1') // Default to stone slab floor
	const selectedObjectType = ref(null) // Selected object type for placement
	
	// Available locations, tiles and objects
	const availableLocations = computed(() => {
		const locations = getAllLocations()
		return Object.values(locations).map(location => ({
			id: location.id,
			name: location.name,
			description: location.description
		}))
	})
	
	const availableTiles = getAllTiles()
	const availableObjects = getAllObjects()
	
	// Navigation
	const goBack = () => {
		router.push('/home')
	}
	
	// Select a location for editing
	const selectLocation = (locationId) => {
		selectedLocation.value = locationId
		const locationData = getLocationById(locationId)
		currentLocationData.value = JSON.parse(JSON.stringify(locationData))
	}
	
	// Deselect current location
	const deselectLocation = () => {
		selectedLocation.value = null
		currentLocationData.value = null
		selectedTileForEditing.value = null
		selectedObjectType.value = null
	}
	
	// Handle tile click in the location visualization
	const handleTileClick = (tileData) => {
		selectedTileForEditing.value = tileData
	}
	
	// Select tile type for placement
	const selectTileType = (tileId) => {
		selectedTileType.value = tileId
	}
	
	// Select object type for placement
	const selectObjectType = (objectId) => {
		selectedObjectType.value = objectId
	}
	
	// Get tile name by ID
	const getTileName = (tileId) => {
		const tile = availableTiles[tileId]
		return tile ? tile.name : `Tile ${tileId}`
	}
	
	// Get object display name by ID
	const getObjectDisplayName = (objectId) => {
		const object = availableObjects[objectId]
		return object ? object.name : `Object ${objectId}`
	}
	
	// Get objects on a specific tile
	const getObjectsOnTile = (x, y) => {
		if (!currentLocationData.value || !currentLocationData.value.levels['level-1']) return []
		
		const level = currentLocationData.value.levels['level-1']
		if (!level.objects) return []
		
		// Filter objects that are on the specified tile
		return level.objects.filter(obj => 
			obj.position && obj.position.cord && obj.position.cord[0] === x && obj.position.cord[1] === y
		)
	}
	
	// Add object to tile
	const addObjectToTile = (objectId, x, y) => {
		if (!currentLocationData.value) return
		
		const level = currentLocationData.value.levels['level-1']
		if (!level.objects) {
			level.objects = []
		}
		
		// Create a new object instance with a unique ID
		const newObject = {
			id: objectId,
			position: { cord: [x, y] }
		}
		
		level.objects.push(newObject)
	}
	
	// Remove object from tile
	const removeObjectFromTile = (objectId, x, y) => {
		if (!currentLocationData.value) return
		
		const level = currentLocationData.value.levels['level-1']
		if (!level.objects) return
		
		// Find and remove the object
		const objectIndex = level.objects.findIndex(obj => 
			obj.id === objectId && 
			obj.position.cord[0] === x && 
			obj.position.cord[1] === y
		)
		
		if (objectIndex !== -1) {
			level.objects.splice(objectIndex, 1)
		}
	}
	
	// Add nested object to an existing object
	const addNestedObject = (parentObject) => {
		if (!selectedObjectType.value) return
		
		// Initialize containedObjects array if it doesn't exist
		if (!parentObject.containedObjects) {
			parentObject.containedObjects = []
		}
		
		// Create a new nested object
		const newNestedObject = {
			id: selectedObjectType.value
		}
		
		parentObject.containedObjects.push(newNestedObject)
	}
	
	// Remove nested object at a specific index
	const removeNestedObjectAt = (parentObject, index) => {
		if (parentObject.containedObjects && parentObject.containedObjects.length > index) {
			parentObject.containedObjects.splice(index, 1)
		}
	}
	
	// Update object position offset
	const updateObjectPositionOffset = (obj, tileX, tileY, index, value) => {
		if (!currentLocationData.value) return
		
		const level = currentLocationData.value.levels['level-1']
		if (!level.objects) return
		
		// Find the object
		const objectIndex = level.objects.findIndex(o => 
			o.id === obj.id && 
			o.position.cord[0] === tileX && 
			o.position.cord[1] === tileY
		)
		
		if (objectIndex !== -1) {
			const targetObject = level.objects[objectIndex]
			
			// Initialize pos array if it doesn't exist
			if (!targetObject.pos) {
				targetObject.pos = [0, 0]
			}
			
			// Update the specific index
			targetObject.pos[index] = parseInt(value) || 0
			
			// Clean up if both values are zero
			if (targetObject.pos[0] === 0 && targetObject.pos[1] === 0) {
				delete targetObject.pos
			}
		}
	}
	
	// Change floor tile
	const changeFloorTile = (tileId) => {
		if (!selectedTileForEditing.value || !currentLocationData.value) return
		
		const x = selectedTileForEditing.value.cord[0]
		const y = selectedTileForEditing.value.cord[1]
		
		// Find the tile in the location data and update it
		const level = currentLocationData.value.levels['level-1']
		if (level && level.floor) {
			// Find the row and column for this tile
			let tileFound = false
			for (let rowIdx = 0; rowIdx < level.floor.length; rowIdx++) {
				const row = level.floor[rowIdx]
				for (let colIdx = 0; colIdx < row.length; colIdx++) {
					const tile = row[colIdx]
					if (tile.cord && tile.cord[0] === x && tile.cord[1] === y) {
						tile.id = parseInt(tileId)
						// Update the selected tile reference
						selectedTileForEditing.value.id = parseInt(tileId)
						tileFound = true
						break
					}
				}
				if (tileFound) break
			}
		}
	}
	
	// Save location
	const saveLocation = async () => {
		if (!currentLocationData.value) return
		
		try {
			const result = await window.electronAPI.saveLocation(
				currentLocationData.value.id, 
				currentLocationData.value
			)
			
			if (result && result.success) {
				alert('Локация сохранена успешно!')
			} else {
				const errorMessage = (result && result.error) ? result.error : 'Unknown error'
				throw new Error(errorMessage)
			}
		} catch (error) {
			console.error('Error saving location:', error)
			const errorMessage = error.message || error.toString() || 'Unknown error occurred'
			alert('Ошибка при сохранении локации: ' + errorMessage)
		}
	}
</script>

<style scoped>
.location-editor {
	width: 100%;
	height: 100%;
}
.location-editor-view {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
}
.editor-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.editor-header h1 {
	color: #fff;
	margin: 0;
}

.back-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a4a6a, #2a2a4a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
}

.back-button:hover {
	background: linear-gradient(145deg, #5a5a8a, #3a3a6a);
}

.location-list-view h2 {
	color: #fff;
	margin-bottom: 20px;
}

.location-list {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 20px;
}

.location-item {
	background: rgba(50, 50, 70, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 8px;
	padding: 15px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.location-item:hover {
	background: rgba(70, 70, 100, 0.9);
	border-color: rgba(255, 255, 255, 0.4);
	transform: translateY(-2px);
}

.location-info h3 {
	color: #fff;
	margin: 0 0 10px 0;
}

.location-info p {
	color: #ccc;
	margin: 0;
	font-size: 0.9em;
}

.edit-button {
	padding: 6px 12px;
	background: linear-gradient(145deg, #4a4a6a, #2a2a4a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	font-size: 0.8em;
	cursor: pointer;
}

.editor-toolbar {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.editor-toolbar h2 {
	color: #fff;
	margin: 0;
}

.toolbar-actions {
	display: flex;
	gap: 10px;
}

.save-button, .cancel-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a4a6a, #2a2a4a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
}

.save-button {
	background: linear-gradient(145deg, #4a8a4a, #2a6a2a);
}

.save-button:hover {
	background: linear-gradient(145deg, #5aa55a, #3a8a3a);
}

.cancel-button {
	background: linear-gradient(145deg, #8a4a4a, #6a2a2a);
}

.cancel-button:hover {
	background: linear-gradient(145deg, #a55a5a, #8a3a3a);
}

.editor-content {
	display: flex;
	height: 100%;
	column-gap: 5px;
}

.editor-content-left {
	width: 20%;
	display: flex;
	flex-direction: column;
}

.location-properties {
	background: rgba(50, 50, 70, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 8px;
	padding: 20px;
	height: 50%;
	overflow-y: auto;
}

.location-properties h3 {
	color: #fff;
	margin-top: 0;
}

.property-group {
	margin-bottom: 15px;
}

.property-group label {
	display: block;
	color: #ccc;
	margin-bottom: 5px;
}

.form-control {
	width: 100%;
	padding: 8px;
	background: rgba(30, 30, 50, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	color: #fff;
}

.form-control:focus {
	outline: none;
	border-color: #4a8a4a;
}

.small-input {
	width: 60px;
	display: inline-block;
	margin-right: 10px;
}

.tile-selection-panel {
	margin-top: 20px;
}

.tile-selection-panel h4 {
	color: #fff;
	margin-top: 0;
}

.tile-types {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

.tile-type {
	flex: 0 0 calc(50% - 5px);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 10px;
	background: rgba(30, 30, 50, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.tile-type:hover {
	background: rgba(40, 40, 60, 0.9);
	border-color: rgba(255, 255, 255, 0.4);
}

.tile-type.selected {
	background: rgba(70, 100, 70, 0.9);
	border-color: #4a8a4a;
}

.tile-preview {
	width: 50px;
	height: 50px;
	object-fit: contain;
	margin-bottom: 5px;
}

.tile-type span {
	color: #fff;
	font-size: 0.8em;
	text-align: center;
}

.object-selection-panel {
	margin-top: 20px;
}

.object-selection-panel h4 {
	color: #fff;
	margin-top: 0;
}

.object-types {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

.object-type {
	flex: 0 0 calc(50% - 5px);
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 10px;
	background: rgba(30, 30, 50, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	cursor: pointer;
	transition: all 0.2s ease;
}

.object-type:hover {
	background: rgba(40, 40, 60, 0.9);
	border-color: rgba(255, 255, 255, 0.4);
}

.object-type.selected {
	background: rgba(70, 100, 70, 0.9);
	border-color: #4a8a4a;
}

.object-preview {
	width: 50px;
	height: 50px;
	object-fit: contain;
	margin-bottom: 5px;
}

.object-type span {
	color: #fff;
	font-size: 0.8em;
	text-align: center;
}

.location-visualization {
	background: rgba(50, 50, 70, 0.7);
	width: 80%;
	height: 92%;
}

.location-visualization h3 {
	color: #fff;
	margin-top: 0;
}

.location-preview {
	height: 100%;
	width: 100%;
	overflow: hidden;
	background: rgba(30, 30, 50, 0.7);
}

.tile-editor {
	grid-column: 1 / -1;
	background: rgba(50, 50, 70, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 8px;
	padding: 15px;
	height: 50%;
	overflow-y: auto;
}

.tile-editor h3 {
	color: #fff;
	margin-top: 0;
}

.tile-editor-content h4 {
	color: #fff;
	margin-top: 0;
}

.tile-editor-content h6 {
	color: #ddd;
	margin: 10px 0 5px 0;
	font-size: 0.9em;
}

.tile-info p {
	color: #ccc;
	margin: 10px 0;
}

.change-tile-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a8a4a, #2a6a2a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
}

.change-tile-button:hover {
	background: linear-gradient(145deg, #5aa55a, #3a8a3a);
}

.object-management {
	margin-top: 20px;
}

.object-management h5 {
	color: #fff;
	margin-top: 0;
	margin-bottom: 10px;
}

.no-objects {
	color: #ccc;
	font-style: italic;
}

.tile-objects {
	margin-bottom: 15px;
}

.tile-object {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 5px;
	background: rgba(30, 30, 50, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	margin-bottom: 5px;
}

.tile-object span {
	color: #fff;
	font-size: 0.9em;
	margin-bottom: 5px;
}

.position-offset-fields {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 5px;
	margin: 5px 0;
}

.position-offset-fields label {
	color: #ccc;
	font-size: 0.8em;
}

.nested-objects-management {
	margin: 10px 0;
	padding: 10px;
	background: rgba(40, 40, 60, 0.5);
	border-radius: 4px;
}

.nested-objects-management h6 {
	color: #ddd;
	margin: 0 0 5px 0;
}

.nested-objects-list {
	margin: 5px 0;
}

.no-nested-objects {
	color: #aaa;
	font-style: italic;
	font-size: 0.8em;
}

.remove-nested-object-button, .add-nested-object-button {
	padding: 3px 6px;
	background: linear-gradient(145deg, #6a4a4a, #4a2a2a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 3px;
	font-size: 0.7em;
	cursor: pointer;
}

.remove-nested-object-button:hover, .add-nested-object-button:hover {
	background: linear-gradient(145deg, #8a5a5a, #6a3a3a);
}

.add-nested-object-button {
	align-self: flex-start;
	margin-top: 5px;
	width: auto;
}

.remove-object-button {
	align-self: flex-end;
	padding: 4px 8px;
	background: linear-gradient(145deg, #8a4a4a, #6a2a2a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 4px;
	font-size: 0.8em;
	cursor: pointer;
	margin-top: 5px;
}

.remove-object-button:hover {
	background: linear-gradient(145deg, #a55a5a, #8a3a3a);
}

.add-object-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a8a4a, #2a6a2a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
	width: 100%;
}

.add-object-button:hover {
	background: linear-gradient(145deg, #5aa55a, #3a8a3a);
}
</style>