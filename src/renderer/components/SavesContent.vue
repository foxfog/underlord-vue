<template>
  <div class="saves-page">
    <div class="page-header">
      <div class="page-title">{{ $t('mainmenu.game-saves') }}</div>
    </div>

    <div class="slots-grid">
      <div 
        v-for="slot in slotsForPage" 
        :key="slot" 
        class="slot" 
        :class="{filled: hasSaveInSlot(slot)}"
        @click="onSlotClick(slot)"
      >
        <div class="thumb">
          <span v-if="hasSaveInSlot(slot)" class="timestamp">
            {{ saveMetadata(slot)?.timestampFormatted }}
          </span>
          <span v-else class="empty">{{ $t('ui.common.empty') || 'Empty' }}</span>
        </div>
        <div class="slot-info">
          <div class="slot-title">Слот {{ slot }}</div>
          <div class="slot-meta" v-if="hasSaveInSlot(slot)">
            <div>{{ saveMetadata(slot)?.mcName }}</div>
            <button class="delete-btn" @click.stop="deleteSaveSlot(slot)" title="Delete save">
              🗑️
            </button>
          </div>
          <div class="slot-meta" v-else>— пусто —</div>
        </div>
      </div>
    </div>

    <div class="controls">
      <button @click="prevPage" :disabled="currentPage === 1">← Prev</button>
      <span class="page-indicator">Стр. {{ currentPage }} / {{ totalPages }}</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">Next →</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useSavesStore } from '../stores/saves'

const currentPage = ref(1)
const totalSlots = 20
const slotsPerPage = 6
const totalPages = Math.ceil(totalSlots / slotsPerPage)

const savesStore = useSavesStore()

const slotsForPage = computed(() => {
  const start = (currentPage.value - 1) * slotsPerPage
  const end = Math.min(start + slotsPerPage, totalSlots)
  const arr = []
  for (let i = start; i < end; i++) arr.push(i)
  return arr
})

function nextPage() {
  if (currentPage.value < totalPages) currentPage.value++
}

function prevPage() {
  if (currentPage.value > 1) currentPage.value--
}

function hasSaveInSlot(slot) {
  return savesStore.hasSave(slot)
}

function saveMetadata(slot) {
  return savesStore.getSave(slot)
}

async function onSlotClick(slot) {
  console.log('Save slot clicked:', slot)
}

async function deleteSaveSlot(slot) {
  if (confirm('Delete this save?')) {
    const result = await savesStore.deleteSave(slot)
    if (result.success) {
      console.log('✔ Save deleted from slot', slot)
    } else {
      alert(`Failed to delete: ${result.error}`)
    }
  }
}

onMounted(async () => {
  // Load saves on component mount
  await savesStore.listSaves()
})
</script>

<style scoped>
.saves-page { padding: 12px; }
.page-title { font-size: 1.4rem; margin-bottom: 12px }
.slots-grid { display:grid; grid-template-columns: repeat(3,1fr); gap:12px }
.slot { 
  background:#111; 
  border:1px solid #222; 
  padding:8px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.slot:hover { border-color: #444; }
.slot.filled { border-color: #666; }
.thumb { 
  height:80px; 
  background:#151515; 
  display:flex; 
  align-items:center; 
  justify-content:center; 
  color:#666;
  font-size: 12px;
}
.timestamp { color: #aaa; }
.empty { color: #666; }
.slot-info { 
  color:#ccc; 
  font-size:13px; 
  margin-top:6px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.slot-title { font-weight: bold; }
.slot-meta {
  display: flex;
  align-items: center;
  gap: 6px;
}
.delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  opacity: 0.7;
  transition: opacity 0.2s;
}
.delete-btn:hover { opacity: 1; }
.controls { display:flex; gap:12px; align-items:center; margin-top:12px }
</style>
