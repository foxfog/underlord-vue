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
          <span v-else class="empty">{{ $t('empty') || 'Empty' }}</span>
        </div>
        <div class="slot-info">
          <div class="slot-title">Слот {{ slot + 1 }}</div>
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
    <ConfirmModal :visible="confirmState.visible" :message="confirmState.message" :title="confirmState.title" confirmText="OK" cancelText="Cancel" @confirm="onConfirm" @cancel="onCancelConfirm" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavesStore } from '../stores/saves'
import { useRouter } from 'vue-router'
import ConfirmModal from './ConfirmModal.vue'

const emit = defineEmits(['load-request'])
const props = defineProps({ inGame: { type: Boolean, default: false } })
const router = useRouter()
const { t } = useI18n()

const currentPage = ref(1)
const totalSlots = 20
const slotsPerPage = 6
const totalPages = Math.ceil(totalSlots / slotsPerPage)

const savesStore = useSavesStore()

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
  try {
    if (!hasSaveInSlot(slot)) {
      alert(t('slot_empty') || 'This slot is empty')
      return
    }

    if (props.inGame) {
      const ok = await confirmDialog(t('load_confirm_loss') || 'All unsaved progress will be lost. Load this save?')
      if (!ok) return

      const result = await savesStore.loadGame(slot)
      if (result.success) {
        emit('load-request', result.data)
      } else {
        alert(`Failed to load: ${result.error}`)
      }
    } else {
      // Main menu: load immediately and navigate to game (no confirmation)
      const result = await savesStore.loadGame(slot)
      if (result.success) {
        // loadGame sets pendingLoad in store; navigate to game where it will be consumed
        await router.push({ path: '/game' })
      } else {
        alert(`Failed to load: ${result.error}`)
      }
    }
  } catch (err) {
    console.error('Error loading slot:', err)
    alert(`Error: ${err.message}`)
  }
}

async function deleteSaveSlot(slot) {
  const ok = await confirmDialog('Delete this save?', 'Delete')
  if (!ok) return
  const result = await savesStore.deleteSave(slot)
  if (result.success) {
    console.log('✔ Save deleted from slot', slot)
  } else {
    alert(`Failed to delete: ${result.error}`)
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
  height:80px; 
  background:#151515; 
  display:flex; 
  align-items:center; 
  justify-content:center; 
  color:#666;
  font-size: 12px;
  border-radius: 4px;
}
.slot.filled .thumb {
  background: linear-gradient(135deg, #0a1f3d 0%, #0d2847 100%);
  color: #4a9eff;
  font-weight: bold;
}
.timestamp { color: #4a9eff; }
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
