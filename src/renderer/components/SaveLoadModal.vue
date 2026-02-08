<template>
  <div v-if="isVisible" class="save-load-modal">
    <div class="modal-inner">
      <header class="modal-header">
        <div class="modal-tabs">
          <button :class="{active: mode === 'save'}" @click="mode = 'save'">{{ $t('save') }}</button>
          <button :class="{active: mode === 'load'}" @click="mode = 'load'">{{ $t('load') }}</button>
        </div>
        <button class="modal-close" @click="$emit('close')">×</button>
      </header>

      <div class="modal-body">
        <SavesGrid 
          :mode="mode" 
          :in-game="true"
          :show-pagination="true"
          @load="onLoadGame"
          @save="onSaveGame"
          @delete="onDeleteSave"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavesStore } from '../stores/saves'
import SavesGrid from './saves/SavesGrid.vue'

const props = defineProps({
  isVisible: { type: Boolean, default: false },
  visualNovel: { type: Object, default: null },
  initialMode: { type: String, default: 'save' }
})

const emit = defineEmits(['close', 'slot-click', 'save-complete', 'load-complete'])
const savesStore = useSavesStore()
const { t } = useI18n()

const mode = ref('save')

async function onSaveGame(slot) {
  try {
    if (!props.visualNovel) {
      alert('VisualNovel not ready for saving')
      return
    }
    
    const gameState = props.visualNovel.getGameState()
    console.log('📦 SaveLoadModal - gameState.audioStreams:', Object.keys(gameState.audioStreams || {}))
    const mcName = gameState.characterData?.mc?.name || 'Unknown'

    const result = await savesStore.saveGame(slot, gameState, mcName)

    if (result.success) {
      console.log('✔ Game saved to slot', slot)
      await savesStore.listSaves()
      emit('save-complete', { slot, save: result.data })
    } else {
      console.error('Failed to save:', result.error)
      alert(`Failed to save: ${result.error}`)
    }
  } catch (error) {
    console.error('Error saving:', error)
    alert(`Error: ${error.message}`)
  }
}

async function onLoadGame(slot) {
  try {
    if (!props.visualNovel) {
      alert('VisualNovel not ready for loading')
      return
    }

    const result = await savesStore.loadGame(slot)

    if (result.success) {
      console.log('✔ Game loaded from slot', slot)
      await props.visualNovel.restoreGameState(result.data.gameState)
      emit('load-complete', { slot, save: result.data })
    } else {
      console.error('Failed to load:', result.error)
      alert(`Failed to load: ${result.error}`)
    }
  } catch (error) {
    console.error('Error loading:', error)
    alert(`Error: ${error.message}`)
  }
}

function onDeleteSave(slot) {
  console.log('Save deleted from slot:', slot)
}

watch(() => props.isVisible, async (v) => {
  if (v) {
    console.log('SaveLoadModal opened, refreshing save list...')
    const result = await savesStore.listSaves()
    console.log('Save list refreshed:', result)
    mode.value = props.initialMode || 'save'
  }
}, { flush: 'post' })

defineExpose({ setMode: (m) => { mode.value = m } })
</script>