<template>
  <div class="characters-container">
    <Character v-for="character in characters" :key="character.id" :character="character" />
  </div>
</template>

<script setup>
import Character from '../characters/Character.vue'
const props = defineProps({ characters: { type: Array, default: () => [] } })
</script>