<template>
  <Character v-for="character in characters" :key="character.id" :character="character" />
</template>

<script setup>
import Character from '../Character.vue'
const props = defineProps({ characters: { type: Array, default: () => [] } })
</script>
