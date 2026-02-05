<template>
  <img v-if="scene" :src="scene.bg" alt="Background" class="background-img" />
</template>

<script setup>
const props = defineProps({ scene: { type: Object, default: null } })
</script>
