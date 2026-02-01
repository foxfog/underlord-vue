<template>
  <div v-if="isVisible" class="save-load-modal">
    <div class="modal-inner">
      <header class="modal-header">
        <div class="tabs">
          <button :class="{active: mode === 'save'}" @click="mode = 'save'">{{ $t('save') }}</button>
          <button :class="{active: mode === 'load'}" @click="mode = 'load'">{{ $t('load') }}</button>
        </div>
        <button class="close" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <SaveSlotsGrid :slots="slotsForPage" @slot-click="onSlotClick" @delete="deleteSaveSlot" />
      </div>

      <footer class="modal-footer">
        <div class="pagination">
          <button @click="prevPage" :disabled="currentPage === 1">← Prev</button>
          <div class="page-indicator">Стр. {{ currentPage }} / {{ totalPages }}</div>
          <button @click="nextPage" :disabled="currentPage === totalPages">Next →</button>
        </div>
      </footer>
      <ConfirmModal :visible="confirmState.visible" :message="confirmState.message" :title="confirmState.title" confirmText="OK" cancelText="Cancel" @confirm="onConfirm" @cancel="onCancelConfirm" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavesStore } from '../stores/saves'
import SaveSlotsGrid from './SaveSlotsGrid.vue'
import ConfirmModal from './ConfirmModal.vue'

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  visualNovel: { type: Object, default: null }
})

const emit = defineEmits(['close', 'slot-click', 'save-complete', 'load-complete'])
const savesStore = useSavesStore()
const { t } = useI18n()

const mode = ref('save')
const currentPage = ref(1)
const totalSlots = 20
const slotsPerPage = 6

const totalPages = Math.ceil(totalSlots / slotsPerPage)

const slotsForPage = computed(() => {
  const start = (currentPage.value - 1) * slotsPerPage
  const end = Math.min(start + slotsPerPage, totalSlots)
  const arr = []
  for (let i = start; i < end; i++) arr.push(i)
  return arr
})

// Confirm modal state and helper
const confirmState = ref({ visible: false, title: '', message: '', resolve: null })
function confirmDialog(message, title = '') {
  return new Promise((resolve) => {
    confirmState.value = { visible: true, title, message, resolve }
  })
}
function onConfirm() {
  const resolver = confirmState.value.resolve
  confirmState.value = { visible: false, title: '', message: '', resolve: null }
  if (resolver) resolver(true)
}
function onCancelConfirm() {
  const resolver = confirmState.value.resolve
  confirmState.value = { visible: false, title: '', message: '', resolve: null }
  if (resolver) resolver(false)
}

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

async function deleteSaveSlot(slot) {
  const confirmed = await confirmDialog(t('delete_confirm'), t('confirm_delete'))
  if (confirmed) {
    await savesStore.deleteSave(slot)
    console.log('✔ Save deleted from slot', slot)
    await savesStore.listSaves()
  }
}

async function onSlotClick(slot) {
  try {
    if (mode.value === 'save') {
      // If slot already has a save, ask for overwrite confirmation
      if (hasSaveInSlot(slot)) {
        const meta = saveMetadata(slot)
        const message = t('overwrite_confirm', {
          slot: slot + 1,
          mcName: meta?.mcName || 'Unknown',
          timestamp: meta?.timestampFormatted || ''
        })
        const ok = await confirmDialog(message)
        if (!ok) return
      }

      // Get current game state
        if (!props.visualNovel) {
          alert('VisualNovel not ready for saving')
          return
        }
      const gameState = props.visualNovel.getGameState()
      const mcName = gameState.characterData?.mc?.name || 'Unknown'

      // Save the game
      const result = await savesStore.saveGame(slot, gameState, mcName)

      if (result.success) {
        console.log('✔ Game saved to slot', slot)
        // Refresh list from disk to ensure UI consistency
        await savesStore.listSaves()
        emit('save-complete', { slot, save: result.data })
      } else {
        console.error('Failed to save:', result.error)
        alert(`Failed to save: ${result.error}`)
      }
    } else if (mode.value === 'load') {
      if (!hasSaveInSlot(slot)) {
        alert(t('slot_empty') || 'This slot is empty')
        return
      }

      // Confirm that unsaved progress will be lost
      const okLoad = await confirmDialog(t('load_confirm_loss'))
      if (!okLoad) return

        // Restore the game state
        if (!props.visualNovel) {
          alert('VisualNovel not ready for loading')
          return
        }
      // Load the game
      const result = await savesStore.loadGame(slot)

      if (result.success) {
        console.log('✔ Game loaded from slot', slot)
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
    console.log('SaveLoadModal opened, refreshing save list...')
    const result = await savesStore.listSaves()
    console.log('Save list refreshed:', result)
    currentPage.value = 1
    mode.value = 'save'
  }
}, { flush: 'post' })
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
  transition: all 0.2s ease;
}
.slot:hover {
  border-color: #444;
  background: #1a1a1a;
}
.slot.filled {
  border: 2px solid #4a9eff;
  background: #0d2847;
  box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
}
.slot.filled:hover {
  border-color: #6ab3ff;
  background: #0f3050;
  box-shadow: 0 0 12px rgba(74, 158, 255, 0.5);
}
.thumb {
  height: 90px;
  background: #1a1a1a;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  border-radius: 4px;
}
.slot.filled .thumb {
  background: linear-gradient(135deg, #0a1f3d 0%, #0d2847 100%);
  color: #4a9eff;
  font-weight: bold;
}
.slot-info { color: #ccc; font-size: 13px }
.modal-footer { display:flex; justify-content:space-between; align-items:center; margin-top:8px }
.pagination button { padding:6px 10px }
.hint { color:#777; font-size:12px }
</style>
