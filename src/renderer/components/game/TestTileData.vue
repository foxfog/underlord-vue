<template>
  <div class="test-tile-data">
    <h1>Tile Data Test</h1>
    <div v-for="(tile, key) in tiles" :key="key" class="tile-item">
      <h3>Tile ID: {{ tile.id }}</h3>
      <p>Type: {{ tile.type }}</p>
      <p>Tags: {{ tile.tags?.join(', ') }}</p>
      <p>Name: {{ tile.name }}</p>
    </div>
    
    <h1>Object Data Test</h1>
    <div v-for="(object, key) in objects" :key="key" class="object-item">
      <h3>Object ID: {{ object.id }}</h3>
      <p>Type: {{ object.type }}</p>
      <p>Tags: {{ object.tags?.join(', ') }}</p>
      <p>Name: {{ object.name }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getAllTiles } from '../../utils/tileLoader.js'
import { getAllObjects } from '../../utils/objectLoader.js'

const tiles = ref({})
const objects = ref({})

onMounted(() => {
  tiles.value = getAllTiles()
  objects.value = getAllObjects()
})
</script>

<style scoped>
.test-tile-data {
  padding: 20px;
}

.tile-item, .object-item {
  border: 1px solid #ccc;
  padding: 10px;
  margin: 10px 0;
  border-radius: 5px;
}

.tile-item h3, .object-item h3 {
  margin-top: 0;
  color: #333;
}
</style>