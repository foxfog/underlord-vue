<template>
  <div class="test-objects">
    <h2>Object Data Test</h2>
    
    <div class="object-types">
      <h3>Object Types</h3>
      <div v-for="type in objectTypes" :key="type" class="type-section">
        <h4>{{ type }}</h4>
        <div class="object-grid">
          <div 
            v-for="obj in getObjectsByType(type)" 
            :key="obj.id"
            class="object-card"
          >
            <div class="object-preview" :style="{ backgroundColor: getObjectColor(obj.id) }">
              {{ obj.id }}
            </div>
            <div class="object-info">
              <h5>{{ obj.name }}</h5>
              <p>ID: {{ obj.id }}</p>
              <p>Type: {{ obj.type }}</p>
              <div class="tags">
                <span 
                  v-for="tag in obj.tags" 
                  :key="tag" 
                  class="tag"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="common-tags">
      <h3>Common Tags</h3>
      <div class="tag-cloud">
        <button 
          v-for="tag in commonTags" 
          :key="tag"
          @click="filterByTag(tag)"
          class="tag-button"
        >
          {{ tag }} ({{ getObjectsByTag(tag).length }})
        </button>
      </div>
      
      <div v-if="selectedTag" class="filtered-objects">
        <h4>Objects with tag: {{ selectedTag }}</h4>
        <div class="object-list">
          <div 
            v-for="obj in getObjectsByTag(selectedTag)" 
            :key="obj.id"
            class="object-item"
          >
            {{ obj.name }} ({{ obj.id }})
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { 
  getAllObjects, 
  getObjectsByType, 
  getObjectsByTag,
  getObjectById
} from '../../utils/objectLoader.js'

const selectedTag = ref('')

const objectTypes = computed(() => {
  const types = new Set()
  Object.values(getAllObjects()).forEach(obj => {
    types.add(obj.type)
  })
  return Array.from(types).sort()
})

const commonTags = computed(() => {
  const tagCount = {}
  Object.values(getAllObjects()).forEach(obj => {
    if (obj.tags) {
      obj.tags.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1
      })
    }
  })
  
  return Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => tag)
})

function filterByTag(tag) {
  selectedTag.value = tag
}

function getObjectColor(objectId) {
  const colors = {
    'wall-1': '#696969',
    'wall-2': '#708090',
    'door-1': '#8B4513',
    'window-1': '#87CEEB',
    'window-2': '#87CEFA',
    'table-1': '#D2691E',
    'chair-1': '#A0522D',
    'bed-1': '#654321',
    'sofa-1': '#9370DB',
    'book-1': '#FFD700',
    'plate-1': '#F5F5F5',
    'vase-1': '#FFB6C1'
  }
  return colors[objectId] || '#CCCCCC'
}
</script>

<style scoped>
.test-objects {
  padding: 20px;
  background-color: #2d2d2d;
  color: white;
  min-height: 100vh;
}

.object-types {
  margin-bottom: 30px;
}

.type-section {
  margin-bottom: 20px;
}

.object-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
}

.object-card {
  background-color: #3d3d3d;
  border-radius: 5px;
  padding: 15px;
  display: flex;
  gap: 15px;
}

.object-preview {
  width: 60px;
  height: 60px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
}

.object-info h5 {
  margin: 0 0 5px 0;
  font-size: 1.1em;
}

.object-info p {
  margin: 2px 0;
  font-size: 0.9em;
  color: #ccc;
}

.tags {
  margin-top: 8px;
}

.tag {
  display: inline-block;
  background-color: #555;
  color: #fff;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  margin-right: 4px;
  margin-bottom: 4px;
}

.common-tags {
  background-color: #3d3d3d;
  padding: 20px;
  border-radius: 5px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.tag-button {
  background-color: #555;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.tag-button:hover {
  background-color: #666;
}

.filtered-objects {
  margin-top: 20px;
}

.object-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.object-item {
  background-color: #555;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 0.9em;
}
</style>