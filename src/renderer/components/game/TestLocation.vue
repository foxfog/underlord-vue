<template>
  <div class="test-location">
    <h2>Location Data Test</h2>
    
    <div v-if="locationData">
      <h3>{{ locationData.name }}</h3>
      <p>{{ locationData.description }}</p>
      
      <div class="location-info">
        <p>Dimensions: {{ locationData.dimensions.width }} x {{ locationData.dimensions.height }}</p>
        <p>Total Tiles (Level 1): {{ totalTiles }}</p>
        <p>Empty Tiles: {{ emptyTilesCount }}</p>
        <p>Objects (Level 1): {{ topLevelObjects?.length || 0 }}</p>
        <p>Total Objects (including nested): {{ allObjects?.length || 0 }}</p>
        <p>Spawn Points: {{ locationData.spawnPoints?.length || 0 }}</p>
      </div>
      
      <div class="tile-grid">
        <div 
          v-for="(row, rowIndex) in levelFloorTiles" 
          :key="rowIndex"
          class="tile-row"
        >
          <div 
            v-for="(tile, colIndex) in row" 
            :key="colIndex"
            class="tile-preview"
            :class="{ 'empty-tile': tile.id === 0 }"
            :style="{ backgroundColor: getTileColor(tile.id) }"
          >
            {{ tile.id }}
          </div>
        </div>
      </div>
      
      <div class="objects-list" v-if="topLevelObjects?.length">
        <h4>Top Level Objects:</h4>
        <ul>
          <li v-for="obj in topLevelObjects" :key="obj.id">
            {{ obj.name }} ({{ obj.id }}) at position {{ obj.position.x }}, {{ obj.position.y }}
            <span v-if="obj.tags && obj.tags.length > 0">
              [{{ obj.tags.join(', ') }}]
            </span>
            <div v-if="obj.left || obj.top" class="position-offset">
              Offset: left={{ obj.left || '0' }}, top={{ obj.top || '0' }}
            </div>
            <div v-if="obj.containedObjects && obj.containedObjects.length > 0" class="nested-objects">
              <h5>Contains:</h5>
              <ul>
                <li v-for="nestedObj in obj.containedObjects" :key="nestedObj.id">
                  {{ nestedObj.name }} ({{ nestedObj.id }})
                  <span v-if="nestedObj.tags && nestedObj.tags.length > 0">
                    [{{ nestedObj.tags.join(', ') }}]
                  </span>
                  <div v-if="nestedObj.containedObjects && nestedObj.containedObjects.length > 0" class="nested-objects">
                    <h6>Contains:</h6>
                    <ul>
                      <li v-for="deepNestedObj in nestedObj.containedObjects" :key="deepNestedObj.id">
                        {{ deepNestedObj.name }} ({{ deepNestedObj.id }})
                        <span v-if="deepNestedObj.tags && deepNestedObj.tags.length > 0">
                          [{{ deepNestedObj.tags.join(', ') }}]
                        </span>
                      </li>
                    </ul>
                  </div>
                </li>
              </ul>
            </div>
          </li>
        </ul>
      </div>
    </div>
    
    <div v-else>
      <p>Loading location data...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getLocationById, getLocationTiles, getLocationObjects, getAllLocationObjects } from '../../utils/locationLoader.js'

const locationData = ref(null)

onMounted(() => {
  // Load the mc-apartment location
  locationData.value = getLocationById('mc-apartment')
})

const levelFloorTiles = computed(() => {
  if (!locationData.value) return []
  return getLocationTiles('mc-apartment', 'level-1') || []
})

const topLevelObjects = computed(() => {
  if (!locationData.value) return []
  return getLocationObjects('mc-apartment', 'level-1') || []
})

const allObjects = computed(() => {
  if (!locationData.value) return []
  return getAllLocationObjects('mc-apartment', 'level-1') || []
})

const totalTiles = computed(() => {
  if (!levelFloorTiles.value) return 0
  return levelFloorTiles.value.reduce((total, row) => total + row.length, 0)
})

const emptyTilesCount = computed(() => {
  if (!levelFloorTiles.value) return 0
  return levelFloorTiles.value.reduce((count, row) => {
    return count + row.filter(tile => tile.id === 0).length
  }, 0)
})

function getTileColor(tileId) {
  if (tileId === 0) return 'transparent' // Empty tile
  const colors = {
    1: '#8B4513', // Brown for floor
    2: '#A0522D', // Darker brown for special floor
    3: '#228B22', // Green for grass
    4: '#1E90FF', // Blue for water
    5: '#696969'  // Gray for walls
  }
  return colors[tileId] || '#CCCCCC'
}
</script>

<style scoped>
.test-location {
  padding: 20px;
  background-color: #2d2d2d;
  color: white;
  min-height: 100vh;
}

.location-info {
  background-color: #3d3d3d;
  padding: 15px;
  border-radius: 5px;
  margin: 15px 0;
}

.tile-grid {
  margin: 20px 0;
}

.tile-row {
  display: flex;
}

.tile-preview {
  width: 30px;
  height: 30px;
  border: 1px solid #555;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin: 1px;
}

.tile-preview.empty-tile {
  background-color: transparent !important;
  border: 1px dashed #555;
}

.objects-list {
  background-color: #3d3d3d;
  padding: 15px;
  border-radius: 5px;
  margin: 20px 0;
}

.nested-objects {
  margin-left: 20px;
  padding-left: 10px;
  border-left: 1px solid #666;
}

.nested-objects h5, .nested-objects h6 {
  margin: 10px 0 5px 0;
  color: #ccc;
}

.position-offset {
  font-size: 0.9em;
  color: #aaa;
  margin-top: 3px;
}
</style>