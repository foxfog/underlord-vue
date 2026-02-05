<template>
  <div class="title-box" v-if="title" @click="$emit('advance')">
    <div class="title-content" v-html="title"></div>
  </div>
</template>

<script setup>
const props = defineProps({ title: { type: String, default: '' } })
</script>
