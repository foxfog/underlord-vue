<template>
  <div class="slots-grid">
    <div
      v-for="slot in slots"
      :key="slot"
      class="slot"
      :class="{filled: hasSaveInSlot(slot)}"
    >
      <div class="thumb" @click="$emit('slot-click', slot)">
        {{ hasSaveInSlot(slot) ? saveMetadata(slot)?.timestampFormatted : $t('empty') }}
      </div>
      <div class="slot-info">
        <div class="slot-title">Слот {{ slot + 1 }}</div>
        <div class="slot-meta" v-if="hasSaveInSlot(slot)">
          <div>{{ saveMetadata(slot)?.mcName }}</div>
          <button class="delete-btn" @click.stop="$emit('delete', slot)" title="Delete save">🗑️</button>
        </div>
        <div class="slot-meta" v-else>— пусто —</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import { useSavesStore } from '@/stores/saves'

const props = defineProps({
  slots: { type: Array, required: true }
})

const emit = defineEmits(['slot-click', 'delete'])
const savesStore = useSavesStore()
const { t } = useI18n()

function hasSaveInSlot(slot) {
  return savesStore.hasSave(slot)
}

function saveMetadata(slot) {
  return savesStore.getSave(slot)
}

defineExpose({ hasSaveInSlot, saveMetadata })
</script>

<style scoped>
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
.slot:hover { border-color: #444; background: #1a1a1a }
.slot.filled { border: 2px solid #4a9eff; background: #0d2847; box-shadow: 0 0 8px rgba(74,158,255,0.3) }
.thumb { height: 90px; background: #1a1a1a; display:flex; align-items:center; justify-content:center; color:#666; border-radius:4px }
.slot-info { color:#ccc; font-size:13px }
.delete-btn { background: transparent; border: none; cursor: pointer }
</style>
