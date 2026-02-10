<template>
	<div class="saves-grid-container">
		<!-- Pagination header -->
		<div class="pagination-header" v-if="showPagination">
			<button 
				class="pagination-btn" 
				:class="{ '__active': currentPage === page }"
				v-for="page in totalPages"
				:key="page"
				@click="currentPage = page"
				:disabled="currentPage === page"
			>
				Стр. {{ page }}
			</button>
		</div>

		<!-- Slots grid -->
		<div class="slots-grid">
			<div 
				v-for="slot in slotsForPage" 
				:key="slot" 
				class="slot" 
				:class="{ filled: hasSaveInSlot(slot) }"
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
						<button class="delete-btn" @click.stop="onDeleteClick(slot)" title="Delete save">
							🗑️
						</button>
					</div>
					<div class="slot-meta" v-else>— пусто —</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useSavesStore } from '@/stores/saves'
import { useRouter } from 'vue-router'

const props = defineProps({
	mode: { type: String, default: 'load', enum: ['load', 'save'] },
	showPagination: { type: Boolean, default: true },
	inGame: { type: Boolean, default: false }
})

const emit = defineEmits(['slot-click', 'delete', 'save', 'load'])

const savesStore = useSavesStore()
const router = useRouter()
const { t } = useI18n()

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

function hasSaveInSlot(slot) {
	return savesStore.hasSave(slot)
}

function saveMetadata(slot) {
	return savesStore.getSave(slot)
}

async function onSlotClick(slot) {
	emit('slot-click', slot)

	if (props.mode === 'load') {
		await handleLoad(slot)
	} else if (props.mode === 'save') {
		await handleSave(slot)
	}
}

async function handleLoad(slot) {
	try {
		if (!hasSaveInSlot(slot)) {
			alert(t('slot_empty') || 'This slot is empty')
			return
		}

		if (props.inGame) {
			// During game - emit event, parent decides what to do
			emit('load', slot)
		} else {
			// From main menu - load and navigate
			const result = await savesStore.loadGame(slot)
			if (result.success) {
				emit('load', slot)
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

async function handleSave(slot) {
	try {
		// Emit save event for parent to handle (must provide gameState)
		emit('save', slot)
	} catch (err) {
		console.error('Error saving slot:', err)
		alert(`Error: ${err.message}`)
	}
}

async function onDeleteClick(slot) {
	if (!confirm(`Delete save in slot ${slot + 1}?`)) return
	try {
		const result = await savesStore.deleteSave(slot)
		if (result.success) {
			console.log('✔ Save deleted from slot', slot)
			await savesStore.listSaves()
			emit('delete', slot)
		} else {
			alert(`Failed to delete: ${result.error}`)
		}
	} catch (err) {
		console.error('Error deleting slot:', err)
		alert(`Error: ${err.message}`)
	}
}

onMounted(async () => {
	console.log('SavesGrid mounted')
	await savesStore.listSaves()
})
</script>
