<template>
  <div class="dialogue-box" v-if="dialogue || narration || choices.length > 0">
    <div class="speaker" v-if="speaker">{{ speaker }}</div>
    <div class="dialogue-text" v-if="dialogue" v-html="dialogue"></div>
    <div class="narration-text" v-if="narration" v-html="narration"></div>

    <div class="choices" v-if="choices.length > 0">
      <button v-for="(choice, index) in choices" :key="index" @click="$emit('selectChoice', index)" class="choice-btn">
        {{ choice.text }}
      </button>
    </div>

    <button v-if="!choices.length && (dialogue || narration)" @click="$emit('advance')" class="continue-btn">Продолжить</button>
  </div>
</template>

<script setup>
const props = defineProps({
  dialogue: { type: String, default: '' },
  narration: { type: String, default: '' },
  speaker: { type: String, default: '' },
  choices: { type: Array, default: () => [] }
})
</script>
