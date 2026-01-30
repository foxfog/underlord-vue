<template>
  <div v-if="isVisible" class="save-load-modal">
    <div class="modal-inner">
      <header class="modal-header">
        <div class="tabs">
          <button :class="{active: mode === 'save'}" @click="mode = 'save'">{{ $t('ui.common.save') }}</button>
          <button :class="{active: mode === 'load'}" @click="mode = 'load'">{{ $t('ui.common.load') }}</button>
        </div>
        <button class="close" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <div class="slots-grid">
          <div v-for="slot in slotsForPage" :key="slot" class="slot" :class="{filled: hasSaveInSlot(slot)}" @click="onSlotClick(slot)">
            <div class="thumb">{{ hasSaveInSlot(slot) ? saveMetadata(slot)?.timestampFormatted : 'Empty' }}</div>
            <div class="slot-info">
              <div class="slot-title">Слот {{ slot }}</div>
              <div class="slot-meta" v-if="hasSaveInSlot(slot)">{{ saveMetadata(slot)?.mcName }}</div>
              <div class="slot-meta" v-else>— пусто —</div>
            </div>
          </div>
        </div>
      </div>

      <footer class="modal-footer">
        <div class="pagination">
          <button @click="prevPage" :disabled="currentPage === 1">← Prev</button>
          <div class="page-indicator">Стр. {{ currentPage }} / {{ totalPages }}</div>
          <button @click="nextPage" :disabled="currentPage === totalPages">Next →</button>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useSavesStore } from '../stores/saves'

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  visualNovel: { type: Object, required: true }
})

const emit = defineEmits(['close', 'slot-click', 'save-complete', 'load-complete'])
const savesStore = useSavesStore()

const mode = ref('save')
const currentPage = ref(1)
const totalSlots = 20
const slotsPerPage = 6

const totalPages = Math.ceil(totalSlots / slotsPerPage)

const slotsForPage = computed(() => {
  const start = (currentPage.value - 1) * slotsPerPage + 1
  const end = Math.min(start + slotsPerPage - 1, totalSlots)
  const arr = []
  for (let i = start; i <= end; i++) arr.push(i - 1) // Convert to 0-indexed
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
  try {
    if (mode.value === 'save') {
      // Get current game state
      const gameState = props.visualNovel.getGameState()
      const mcName = gameState.characterData?.mc?.name || 'Unknown'
      
      // Save the game
      const result = await savesStore.saveGame(slot, gameState, mcName)
      
      if (result.success) {
        console.log('✔ Game saved to slot', slot)
        emit('save-complete', { slot, save: result.data })
      } else {
        console.error('Failed to save:', result.error)
        alert(`Failed to save: ${result.error}`)
      }
    } else if (mode.value === 'load') {
      if (!hasSaveInSlot(slot)) {
        alert('This slot is empty')
        return
      }
      
      // Load the game
      const result = await savesStore.loadGame(slot)
      
      if (result.success) {
        console.log('✔ Game loaded from slot', slot)
        // Restore the game state
        await props.visualNovel.restoreGameState(result.data.gameState)
        emit('load-complete', { slot, save: result.data })
      } else {
        console.error('Failed to load:', result.error)
        alert(`Failed to load: ${result.error}`)
      }
    }
  } catch (error) {
    console.error('Error:', error)
    alert(`Error: ${error.message}`)
  }
}

watch(() => props.isVisible, async (v) => {
  if (v) {
    // Reload save list when modal opens
    await savesStore.listSaves()
    currentPage.value = 1
    mode.value = 'save'
  }
})
</script>

<style scoped>
.save-load-modal {
  width: 100%;
  height: 100%;
}
.modal-inner {
  background: #0f0f0f;
  border: 1px solid #222;
  padding: 12px;
  height: 100%;
  display: flex;
  flex-direction: column;
}
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.tabs button {
  background: transparent;
  color: #ddd;
  border: 1px solid transparent;
  padding: 6px 10px;
  margin-right: 6px;
  cursor: pointer;
}
.tabs button.active {
  background: #222;
  border-color: #444;
}
.close {
  background: transparent;
  color: #fff;
  border: none;
  font-size: 20px;
  cursor: pointer;
}
.modal-body { flex: 1; overflow: auto; }
.slots-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.slot {
  background: #141414;
  border: 1px solid #222;
  padding: 8px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.thumb {
  height: 90px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
}
.slot-info { color: #ccc; font-size: 13px }
.modal-footer { display:flex; justify-content:space-between; align-items:center; margin-top:8px }
.pagination button { padding:6px 10px }
.hint { color:#777; font-size:12px }
</style>
