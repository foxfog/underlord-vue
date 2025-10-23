<template>
  <div 
    class="contained-object"
    :data-id="object.id"
    :data-type="getObjectType(object.id)"
    :data-tags="getObjectTags(object.id)?.join(' ')"
  >
    <img 
      :src="getObjectImage(object.id)" 
      :alt="getObjectAltText(object.id)"
      class="contained-object-img"
    />
    <!-- Recursively render nested objects -->
    <template v-if="object.containedObjects && object.containedObjects.length > 0">
      <NestedObjectRenderer 
        v-for="(nestedObj, index) in object.containedObjects" 
        :key="index"
        :object="nestedObj"
      />
    </template>
  </div>
</template>

<script setup>
import { getObjectById, getObjectImageUrl, getObjectType, getObjectTags } from '@/utils/objectLoader.js'

const props = defineProps({
  object: {
    type: Object,
    required: true
  }
})

// Get object image URL based on object ID
function getObjectImage(objectId) {
  const imageUrl = getObjectImageUrl(objectId)
  return imageUrl || '/images/tiles/prototype/object/default.png' // fallback image
}

// Get alt text for object image
function getObjectAltText(objectId) {
  const object = getObjectById(objectId)
  return object ? object.name || `Object ${objectId}` : 'Object'
}
</script>

<style scoped>
.contained-object {
  position: absolute;
  width: 100%;
  height: 100%;
}

.contained-object-img {
  width: 100%;
  height: auto;
  object-fit: contain;
  display: block;
}
</style>