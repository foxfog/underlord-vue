<template>
  <div class="history-modal" v-if="isVisible">
    <div class="history-inner">
      <div class="history-header">
        <div class="title">История диалогов</div>
        <button class="close-btn" @click="$emit('close')">✖</button>
      </div>
      <div class="history-list" ref="listRef">
        <div v-for="(entry, index) in entries" :key="index" class="history-entry">
          <div class="meta">
            <span class="speaker" v-if="entry.speaker">{{ entry.speaker }}:</span>
            <span class="type" v-else-if="entry.type==='titles'">[Заголовок]</span>
            <span class="type" v-else-if="entry.type==='narration'">[Наррация]</span>
          </div>
          <div class="text" v-html="entry.text"></div>
        </div>
        <div v-if="!entries || entries.length === 0" class="empty">История пуста</div>
      </div>
      <div class="history-footer">
        <button @click="$emit('close')">Закрыть</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  entries: { type: Array, default: () => [] }
})

const listRef = ref(null)

watch(() => props.isVisible, (v) => {
  if (v) {
    // scroll to bottom when opened
    setTimeout(() => {
      if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
    }, 50)
  }
})
</script>