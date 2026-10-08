<template>
	<div class="saves-grid-container">
		<!-- Profile selector bar (Skyrim style) -->
		<div class="profile-selector-bar">
			<div class="profile-selector-left">
				<span class="profile-label">👤 {{ $t('profile') || 'Персонаж' }}:</span>
				<!-- В режиме сохранения (во время игры) показываем текущий профиль -->
				<span v-if="mode === 'save'" class="current-profile-badge">
					#{{ currentProfileData?.id || 1 }} {{ currentProfileData?.name || currentMcName || 'Player' }}
				</span>
				<!-- В режиме загрузки доступен выбор любого профиля или просмотр всех -->
				<select
					v-else
					v-model="selectedProfileFolder"
					class="profile-select"
					@change="onProfileChange"
				>
					<option value="all">
						🌐 {{ $t('all_profiles') || 'Все персонажи' }}
					</option>
					<option
						v-for="prof in profiles"
						:key="prof.folder"
						:value="prof.folder"
					>
						#{{ prof.id }} {{ prof.name }} ({{ prof.saveCount || 0 }})
					</option>
				</select>
			</div>

			<!-- Удаление профиля доступно в меню загрузки из главного меню -->
			<div
				class="profile-actions"
				v-if="mode === 'load' && !inGame && selectedProfileFolder !== 'all' && currentProfileData && !currentProfileData.isLegacy"
			>
				<button
					class="delete-profile-btn"
					@click="onDeleteCurrentProfile"
					:title="$t('delete_profile') || 'Удалить профиль'"
				>
					<i class="icon-trash"></i>
					<span>{{ $t('delete_profile') || 'Удалить профиль' }}</span>
				</button>
			</div>
		</div>

		<!-- Pagination header -->
		<div class="pagination-header" v-if="showPagination && selectedProfileFolder !== 'all'">
			<!-- Quick & Auto saves page "Б" -->
			<button
				class="pagination-btn"
				:class="{ __active: currentPage === 'quick' }"
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
				:class="{ __active: currentPage === page }"
				@click="currentPage = page"
				:disabled="currentPage === page"
			>
				{{ page }}
			</button>
		</div>

		<!-- Пагинация для режима "Все персонажи" -->
		<div class="pagination-header" v-else-if="showPagination && selectedProfileFolder === 'all' && allPagesCount > 1">
			<button
				class="pagination-btn"
				v-for="page in allPagesCount"
				:key="page"
				:class="{ __active: allCurrentPage === page }"
				@click="allCurrentPage = page"
				:disabled="allCurrentPage === page"
			>
				{{ page }}
			</button>
		</div>

		<!-- Slots grid (Режим выбранного профиля) -->
		<div v-if="selectedProfileFolder !== 'all'" class="seves-slots-grid">
			<div
				v-for="slot in slotsForPage"
				:key="slot"
				class="seves-slot"
				:class="{
					filled: hasSaveInSlot(slot),
					__auto: slot === 0 || saveMetadata(slot)?.saveType === 'auto',
					__quick: isQuickIndex(slot) && slot !== 0
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
						<template v-if="slot === 0 || saveMetadata(slot)?.saveType === 'auto'">
							<span class="save-type-badge __auto">⚡ {{ $t('auto_save') || 'Авто' }}</span>
						</template>
						<template v-else-if="isQuickIndex(slot)">
							<span class="save-type-badge __quick">Б{{ slot }}</span>
						</template>
						<template v-else>
							<span>Слот {{ slot - QUICK_PAGE_SLOTS_COUNT + 1 }}</span>
						</template>
					</div>
					<div class="seves-slot-meta" v-if="hasSaveInSlot(slot)">
						<div class="meta-left">
							<span class="mc-name-text">{{ saveMetadata(slot)?.mcName }}</span>
						</div>
						<button
							class="delete-btn"
							@click.stop="onDeleteClick(slot)"
							title="Delete save"
						>
							<i class="icon-trash"></i>
						</button>
					</div>
					<div class="seves-slot-meta" v-else>
						<span v-if="slot === 0">— пусто (Авто) —</span>
						<span v-else>— пусто —</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Slots grid (Режим "Все персонажи") -->
		<div v-else class="seves-slots-grid">
			<div
				v-for="save in savesForAllPage"
				:key="save.profileFolder + '_' + save.slot"
				class="seves-slot filled"
				:class="{
					__auto: save.slot === 0 || save.saveType === 'auto',
					__quick: isQuickIndex(save.slot) && save.slot !== 0
				}"
				@click="onAllSaveClick(save)"
			>
				<div class="thumb">
					<img
						v-if="save.screenshot"
						:src="save.screenshot"
						class="screenshot-img"
						alt="Save screenshot"
					/>
					<span class="timestamp-overlay">
						{{ save.timestampFormatted }}
					</span>
				</div>
				<div class="seves-slot-info">
					<div class="seves-slot-title">
						<template v-if="save.slot === 0 || save.saveType === 'auto'">
							<span class="save-type-badge __auto">⚡ {{ $t('auto_save') || 'Авто' }}</span>
						</template>
						<template v-else-if="isQuickIndex(save.slot)">
							<span class="save-type-badge __quick">Б{{ save.slot }}</span>
						</template>
						<template v-else>
							<span>Слот {{ save.slot - QUICK_PAGE_SLOTS_COUNT + 1 }}</span>
						</template>
					</div>
					<div class="seves-slot-meta">
						<div class="meta-left">
							<span class="mc-name-text">{{ save.mcName }}</span>
							<span v-if="save.profileFolder" class="profile-tag">
								#{{ save.profileId || save.profileFolder }}
							</span>
						</div>
						<button
							class="delete-btn"
							@click.stop="onDeleteSaveObject(save)"
							title="Delete save"
						>
							<i class="icon-trash"></i>
						</button>
					</div>
				</div>
			</div>
			<div v-if="savesForAllPage.length === 0" class="empty-saves-notice">
				— Сохранений не найдено —
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
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

const currentPage = ref('quick')
const allCurrentPage = ref(1)
const allItemsPerPage = 9

// 9 слотов (0..8) зарезервированы: 0 = автосохранение, 1..8 = быстрые
const QUICK_PAGE_SLOTS_COUNT = 9
const totalManualSlots = 90
const slotsPerPage = 9
const totalPages = Math.ceil(totalManualSlots / slotsPerPage)

const profiles = computed(() => savesStore.profiles || [])
const selectedProfileFolder = ref(savesStore.selectedProfileFolder || null)

const currentProfileData = computed(() => {
	if (selectedProfileFolder.value && selectedProfileFolder.value !== 'all') {
		return profiles.value.find((p) => p.folder === selectedProfileFolder.value) || savesStore.currentProfile
	}
	return savesStore.currentProfile
})

const currentMcName = computed(() => {
	return currentProfileData.value?.name || savesStore.currentProfile?.name || 'Player'
})

// Синхронизация выбранного профиля со стором
watch(
	() => savesStore.selectedProfileFolder,
	(newVal) => {
		if (newVal !== selectedProfileFolder.value) {
			selectedProfileFolder.value = newVal
		}
	}
)

const slotsForPage = computed(() => {
	// Страница "Б" (авто + быстрые): слоты 0..8
	if (currentPage.value === 'quick') {
		const arr = []
		for (let i = 0; i < QUICK_PAGE_SLOTS_COUNT; i++) {
			arr.push(i)
		}
		return arr
	}

	// Обычные страницы 1..N: слоты 9..98
	const pageNumber = typeof currentPage.value === 'number' ? currentPage.value : 1
	const startIndex = (pageNumber - 1) * slotsPerPage
	const endIndex = Math.min(startIndex + slotsPerPage, totalManualSlots)
	const arr = []
	for (let i = startIndex; i < endIndex; i++) {
		const physicalSlot = QUICK_PAGE_SLOTS_COUNT + i
		arr.push(physicalSlot)
	}
	return arr
})

// Для режима "Все персонажи"
const allSavesList = computed(() => savesStore.allSavesList || [])
const allPagesCount = computed(() => Math.ceil(allSavesList.value.length / allItemsPerPage) || 1)
const savesForAllPage = computed(() => {
	const start = (allCurrentPage.value - 1) * allItemsPerPage
	return allSavesList.value.slice(start, start + allItemsPerPage)
})

function isQuickIndex(slotIndex) {
	return slotIndex >= 0 && slotIndex < QUICK_PAGE_SLOTS_COUNT
}

function saveForIndex(slotIndex) {
	return savesStore.getSave(slotIndex)
}

function hasSaveInSlot(slotIndex) {
	return !!saveForIndex(slotIndex)
}

function saveMetadata(slotIndex) {
	return saveForIndex(slotIndex)
}

async function onProfileChange() {
	await savesStore.selectProfile(selectedProfileFolder.value)
}

async function onDeleteCurrentProfile() {
	const targetFolder = selectedProfileFolder.value
	if (!targetFolder || targetFolder === 'all') return

	const prof = currentProfileData.value
	const name = prof?.name || targetFolder
	const confirmText = t('delete_profile_confirm', { name }) || `Удалить профиль "${name}" и все его сохранения?`

	if (!confirm(confirmText)) return

	const res = await savesStore.deleteProfile(targetFolder)
	if (res.success) {
		selectedProfileFolder.value = savesStore.selectedProfileFolder
	} else {
		alert(`Не удалось удалить профиль: ${res.error}`)
	}
}

async function onSlotClick(slotIndex) {
	emit('slot-click', slotIndex)

	if (props.mode === 'load') {
		await handleLoad(slotIndex, selectedProfileFolder.value)
	} else if (props.mode === 'save') {
		await handleSave(slotIndex)
	}
}

async function onAllSaveClick(save) {
	if (props.mode === 'load') {
		await handleLoad(save.slot, save.profileFolder)
	}
}

async function handleLoad(slot, profileFolder) {
	try {
		if (selectedProfileFolder.value !== 'all' && !hasSaveInSlot(slot)) {
			alert(t('slot_empty') || 'This slot is empty')
			return
		}

		if (props.inGame) {
			emit('load', slot, profileFolder)
		} else {
			const result = await savesStore.loadGame(slot, profileFolder)
			if (result.success) {
				emit('load', slot, profileFolder)
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
		emit('save', slot)
	} catch (err) {
		console.error('Error saving slot:', err)
		alert(`Error: ${err.message}`)
	}
}

async function onDeleteClick(slotIndex) {
	const targetFolder = selectedProfileFolder.value === 'all' ? null : selectedProfileFolder.value
	if (!confirm(`Удалить сохранение в слоте ${slotIndex + 1}?`)) return
	try {
		const result = await savesStore.deleteSave(slotIndex, targetFolder)
		if (result.success) {
			console.log('✔ Save deleted from slot', slotIndex)
			await savesStore.listSaves(selectedProfileFolder.value)
			emit('delete', slotIndex)
		} else {
			alert(`Failed to delete: ${result.error}`)
		}
	} catch (err) {
		console.error('Error deleting slot:', err)
		alert(`Error: ${err.message}`)
	}
}

async function onDeleteSaveObject(save) {
	if (!confirm(`Удалить сохранение "${save.mcName}" (слот ${save.slot + 1})?`)) return
	try {
		const result = await savesStore.deleteSave(save.slot, save.profileFolder)
		if (result.success) {
			await savesStore.listSaves('all')
			emit('delete', save.slot)
		} else {
			alert(`Failed to delete: ${result.error}`)
		}
	} catch (err) {
		console.error('Error deleting save:', err)
		alert(`Error: ${err.message}`)
	}
}

onMounted(async () => {
	console.log('SavesGrid mounted')
	await savesStore.listProfiles()

	// Выбираем текущий профиль или самый свежий
	if (!selectedProfileFolder.value && savesStore.profiles.length > 0) {
		selectedProfileFolder.value =
			savesStore.currentProfile?.folder || savesStore.profiles[0]?.folder || null
	}

	await savesStore.listSaves(selectedProfileFolder.value)

	// По умолчанию открываем вкладку "Б" со свежим автосейвом/квиксеем
	currentPage.value = 'quick'
})
</script>
