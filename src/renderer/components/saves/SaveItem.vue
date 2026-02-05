<template>
  <div :class="['slot', { filled: hasSave }]">
    <div class="thumb" @click="$emit('click', slot)">
      <slot>
        {{ hasSave ? metadata?.timestampFormatted : $t('empty') }}
      </slot>
    </div>
    <div class="slot-info">
      <div class="slot-title">Слот {{ slot + 1 }}</div>
      <div class="slot-meta" v-if="hasSave">
        <div>{{ metadata?.mcName }}</div>
        <button class="delete-btn" @click.stop="$emit('delete', slot)" title="Delete save">🗑️</button>
      </div>
      <div class="slot-meta" v-else>— пусто —</div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useSavesStore } from '@/stores/saves'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  slot: { type: Number, required: true }
})

const emit = defineEmits(['click', 'delete'])
const savesStore = useSavesStore()
const { t } = useI18n()

const metadata = computed(() => savesStore.getSave(props.slot))
const hasSave = computed(() => savesStore.hasSave(props.slot))
</script>

<style scoped>
.slot { background: #141414; border: 1px solid #222; padding: 8px; cursor: pointer; display:flex; flex-direction:column; gap:6px }
.slot:hover { border-color: #444; background: #1a1a1a }
.slot.filled { border: 2px solid #4a9eff; background: #0d2847; box-shadow: 0 0 8px rgba(74,158,255,0.3) }
.thumb { height: 90px; background: #1a1a1a; display:flex; align-items:center; justify-content:center; color:#666; border-radius:4px }
.slot.filled .thumb { background: linear-gradient(135deg, #0a1f3d 0%, #0d2847 100%); color: #4a9eff; font-weight: bold }
.slot-info { color:#ccc; font-size:13px }
.delete-btn { background: transparent; border: none; cursor: pointer }
</style>