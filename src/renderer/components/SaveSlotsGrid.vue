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