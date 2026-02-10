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
