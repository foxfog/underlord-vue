<template>
	<div class="saves-grid-container">
		<!-- Pagination header -->
		<div class="pagination-header" v-if="showPagination">
			<!-- Quick saves page -->
			<button
				class="pagination-btn"
				:class="{ '__active': currentPage === 'quick' }"
				@click="currentPage = 'quick'"
				:disabled="currentPage === 'quick'"
			>
				Б
			</button>

			<!-- Normal saves pages -->
			<button 
				class="pagination-btn" 
				v-for="page in totalPages"
				:key="page"
				:class="{ '__active': currentPage === page }"
				@click="currentPage = page"
				:disabled="currentPage === page"
			>
				{{ page }}
			</button>
		</div>

		<!-- Slots grid -->
		<div class="seves-slots-grid">
			<div 
				v-for="slot in slotsForPage" 
				:key="slot" 
				class="seves-slot" 
				:class="{
					filled: hasSaveInSlot(slot),
					'__quick': isQuickIndex(slot)
				}"
				@click="onSlotClick(slot)"
			>
				<div class="thumb">
					<template v-if="hasSaveInSlot(slot)">
						<img 
							v-if="saveMetadata(slot)?.screenshot" 
							:src="saveMetadata(slot)?.screenshot" 
							class="screenshot-img" 
							alt="Save screenshot"
						/>
						<span class="timestamp-overlay">
							{{ saveMetadata(slot)?.timestampFormatted }}
						</span>
					</template>
					<span v-else class="empty">{{ $t('empty') || 'Empty' }}</span>
				</div>
				<div class="seves-slot-info">
					<div class="seves-slot-title">
						<span v-if="isQuickIndex(slot)">
							Б{{ slot + 1 }}
						</span>
						<span v-else>
							Слот {{ slot - QUICK_SAVE_SLOTS_COUNT + 1 }}
						</span>
					</div>
					<div class="seves-slot-meta" v-if="hasSaveInSlot(slot)">
						<span class="mc-name-text">{{ saveMetadata(slot)?.mcName }}</span>
						<button class="delete-btn" @click.stop="onDeleteClick(slot)" title="Delete save">
							🗑️
						</button>
					</div>
					<div class="seves-slot-meta" v-else>— пусто —</div>
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

	// 9 слотов (0-8) зарезервированы под быстрые сохранения
	const QUICK_SAVE_SLOTS_COUNT = 9
	// Обычные слоты: 90 штук, начиная с индекса 9 (после быстрых)
	const totalManualSlots = 90
	const slotsPerPage = 9
	const totalPages = Math.ceil(totalManualSlots / slotsPerPage)

	const slotsForPage = computed(() => {
		// Страница быстрых сохранений "Б"
		if (currentPage.value === 'quick') {
			const arr = []
			for (let i = 0; i < QUICK_SAVE_SLOTS_COUNT; i++) {
				arr.push(i)
			}
			return arr
		}

		// Обычные страницы 1..N
		const pageNumber = typeof currentPage.value === 'number' ? currentPage.value : 1
		const startIndex = (pageNumber - 1) * slotsPerPage
		const endIndex = Math.min(startIndex + slotsPerPage, totalManualSlots)
		const arr = []
		for (let i = startIndex; i < endIndex; i++) {
			// Сдвигаем индексы на 9, чтобы обычные слоты начинались после быстрых
			const physicalSlot = QUICK_SAVE_SLOTS_COUNT + i
			arr.push(physicalSlot)
		}
		return arr
	})

	// Быстрые сохранения (0-8), уже отсортированы по свежести в сторе
	const quickSaves = computed(() => savesStore.quickSaves || [])

	function isQuickIndex(slotIndex) {
		return slotIndex >= 0 && slotIndex < QUICK_SAVE_SLOTS_COUNT
	}

	function resolvePhysicalSlot(slotIndex) {
		if (isQuickIndex(slotIndex)) {
			const quick = quickSaves.value[slotIndex]
			return quick ? quick.slot : null
		}
		return slotIndex
	}

	function saveForIndex(slotIndex) {
		if (isQuickIndex(slotIndex)) {
			return quickSaves.value[slotIndex] || null
		}
		return savesStore.getSave(slotIndex)
	}

	function hasSaveInSlot(slotIndex) {
		return !!saveForIndex(slotIndex)
	}

	function saveMetadata(slotIndex) {
		return saveForIndex(slotIndex)
	}

	async function onSlotClick(slotIndex) {
		const physicalSlot = resolvePhysicalSlot(slotIndex)

		if (physicalSlot === null || typeof physicalSlot !== 'number') {
			alert(t('slot_empty') || 'This slot is empty')
			return
		}

		emit('slot-click', physicalSlot)

		if (props.mode === 'load') {
			await handleLoad(physicalSlot)
		} else if (props.mode === 'save') {
			await handleSave(physicalSlot)
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

	async function onDeleteClick(slotIndex) {
		const physicalSlot = resolvePhysicalSlot(slotIndex)
		if (physicalSlot === null || typeof physicalSlot !== 'number') return

		if (!confirm(`Delete save in slot ${slotIndex + 1}?`)) return
		try {
			const result = await savesStore.deleteSave(physicalSlot)
			if (result.success) {
				console.log('✔ Save deleted from slot', physicalSlot)
				await savesStore.listSaves()
				emit('delete', physicalSlot)
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

		// Открываем страницу с крайним имеющимся обычным сохранением (без учёта быстрых)
		try {
			const manualSaves = (savesStore.allSaves && savesStore.allSaves.value) || []
			if (manualSaves.length > 0) {
				const lastSave = manualSaves[manualSaves.length - 1]
				const lastSlot = lastSave?.slot

				if (typeof lastSlot === 'number' && lastSlot >= QUICK_SAVE_SLOTS_COUNT) {
					// Индекс среди обычных слотов (0..totalManualSlots-1)
					const manualIndex = lastSlot - QUICK_SAVE_SLOTS_COUNT
					const page = Math.floor(manualIndex / slotsPerPage) + 1
					// Страхуемся от выхода за границы
					const clampedPage = Math.min(Math.max(page, 1), totalPages)
					currentPage.value = clampedPage
				} else {
					currentPage.value = 1
				}
			} else {
				currentPage.value = 1
			}
		} catch (e) {
			console.warn('Failed to auto-select last saves page:', e)
			currentPage.value = 1
		}
	})
</script>
