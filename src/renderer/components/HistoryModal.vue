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
            <span class="step">#{{ entry.stepIndex }}</span>
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

<style scoped>
.history-modal {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  background: rgba(0,0,0,0.6);
}
.history-inner {
  width: min(900px, 95%);
  max-height: 80vh;
  background: #0f0f0f;
  border: 1px solid #222;
  padding: 12px;
  display: flex;
  flex-direction: column;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.history-list {
  overflow: auto;
  flex: 1 1 auto;
  padding-right: 8px;
}
.history-entry {
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.meta { font-size: 12px; color: #aaa; margin-bottom: 4px }
.speaker { font-weight: 700; margin-right: 6px }
.text { color: #fff }
.empty { color: #888; text-align: center; padding: 12px }
.history-footer { margin-top: 8px; text-align: right }
.close-btn { background: transparent; border: none; color: #ddd; font-size: 18px }
</style>