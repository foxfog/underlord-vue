<template>
	<div class="entity-tag-picker" :class="[`__type-${type}`]">
		<!-- Header row: Label + Clear button -->
		<div class="picker-header-row">
			<label class="picker-label">
				{{ label }}
				<span class="picker-hint">{{ isValueEmpty ? emptyHint : `Выбрано: ${selectedCount}` }}</span>
			</label>
			<button
				v-if="allowClear && !isValueEmpty"
				type="button"
				class="picker-clear-btn"
				@click="clearAll"
			>
				✕ Сбросить (Все)
			</button>
		</div>

		<!-- Selected Chips List -->
		<div class="picker-chips-list">
			<span
				v-for="id in selectedIds"
				:key="id"
				class="picker-chip"
				:class="[`__chip-${type}`]"
			>
				<span class="chip-icon-wrap">
					<span v-if="isEmojiIcon(getItemIcon(id))" class="chip-icon">{{ getItemIcon(id) }}</span>
					<img v-else :src="resolveIcon(getItemIcon(id))" class="chip-icon-img" alt="" />
				</span>
				<span class="chip-name">{{ getItemName(id) }}</span>
				<span class="chip-id">({{ id }})</span>
				<button
					type="button"
					class="chip-remove-btn"
					:title="`Удалить ${getItemName(id)}`"
					@click="removeItem(id)"
				>
					✕
				</button>
			</span>

			<span v-if="isValueEmpty" class="picker-empty-hint">
				{{ emptyHint }}
			</span>
		</div>

		<!-- Search / Autocomplete Input with Dropdown -->
		<div ref="wrapperRef" class="picker-search-wrapper">
			<div class="picker-input-row">
				<span class="search-icon">🔍</span>
				<input
					ref="inputRef"
					v-model="searchQuery"
					type="text"
					class="picker-input"
					:placeholder="placeholder"
					autocomplete="off"
					@focus="openDropdown"
					@input="onSearchInput"
					@keydown.down.prevent="navigateDown"
					@keydown.up.prevent="navigateUp"
					@keydown.enter.prevent="selectHighlighted"
					@keydown.esc="closeDropdown"
				/>
				<button
					v-if="searchQuery"
					type="button"
					class="picker-input-clear-btn"
					title="Очистить поиск"
					@click="clearSearch"
				>
					✕
				</button>
			</div>

			<!-- Dropdown list -->
			<div
				v-if="isDropdownOpen && filteredOptions.length > 0"
				class="picker-dropdown"
			>
				<div class="dropdown-header">
					<span>Найдено вариантов: {{ filteredOptions.length }}</span>
					<span class="dropdown-tip">↑↓ навигация, Enter выбор</span>
				</div>
				<div class="dropdown-scroll-area">
					<div
						v-for="(opt, idx) in filteredOptions"
						:key="opt.id"
						class="dropdown-item"
						:class="{ __highlighted: highlightedIndex === idx }"
						@mousedown.prevent="selectOption(opt.id)"
						@mouseenter="highlightedIndex = idx"
					>
						<div class="dropdown-item-left">
							<span class="item-icon-wrap">
								<span v-if="isEmojiIcon(getItemIcon(opt.id, opt))" class="item-icon">
									{{ getItemIcon(opt.id, opt) }}
								</span>
								<img v-else :src="resolveIcon(getItemIcon(opt.id, opt))" class="item-icon-img" alt="" />
							</span>
							<span class="item-title">
								{{ getItemName(opt.id, opt) }}
							</span>
							<span class="item-id-badge">({{ opt.id }})</span>
						</div>
						<div class="dropdown-item-right">
							<span class="add-badge">+ Добавить</span>
						</div>
					</div>
				</div>
			</div>

			<div
				v-else-if="isDropdownOpen && searchQuery.trim()"
				class="picker-dropdown __empty"
			>
				<div class="dropdown-empty-msg">
					Ничего не найдено по запросу «{{ searchQuery }}»
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
	modelValue: {
		type: Array,
		default: () => []
	},
	options: {
		type: Array,
		default: () => []
	},
	type: {
		type: String,
		default: 'class' // 'class' | 'race' | 'character' | 'fraction'
	},
	label: {
		type: String,
		default: ''
	},
	emptyHint: {
		type: String,
		default: 'Разрешено всем (без ограничений)'
	},
	placeholder: {
		type: String,
		default: 'Поиск и добавление...'
	},
	getName: {
		type: Function,
		default: null
	},
	getIcon: {
		type: Function,
		default: null
	},
	allowClear: {
		type: Boolean,
		default: true
	}
})

const emit = defineEmits(['update:modelValue'])

const wrapperRef = ref(null)
const inputRef = ref(null)
const searchQuery = ref('')
const isDropdownOpen = ref(false)
const highlightedIndex = ref(0)

const selectedIds = computed(() => {
	return Array.isArray(props.modelValue) ? props.modelValue : []
})

const isValueEmpty = computed(() => selectedIds.value.length === 0)
const selectedCount = computed(() => selectedIds.value.length)

const defaultIconForType = computed(() => {
	switch (props.type) {
		case 'class': return '⚔️'
		case 'race': return '🧬'
		case 'character': return '👤'
		case 'fraction': return '🏛️'
		default: return '🏷️'
	}
})

function findOption(id) {
	return (props.options || []).find((opt) => opt.id === id)
}

function getItemName(id, opt = null) {
	if (props.getName) {
		const name = props.getName(id)
		if (name) return name
	}
	const item = opt || findOption(id)
	return item?.name || id
}

function getItemIcon(id, opt = null) {
	if (props.getIcon) {
		const icon = props.getIcon(opt || findOption(id))
		if (icon) return icon
	}
	const item = opt || findOption(id)
	return item?.icon || defaultIconForType.value
}

function isEmojiIcon(str) {
	if (!str) return true
	return str.length <= 4 && !str.includes('/') && !str.includes('.')
}

function resolveIcon(iconPath) {
	if (!iconPath) return ''
	if (iconPath.startsWith('http') || iconPath.startsWith('data:')) return iconPath
	const base = typeof window !== 'undefined' && window.__APP_BASE__ ? window.__APP_BASE__ : ''
	return base + iconPath.replace(/^\//, '')
}

// Filtered options not currently selected, matching query
const filteredOptions = computed(() => {
	const current = selectedIds.value
	const list = props.options || []
	const q = searchQuery.value.trim().toLowerCase()

	return list
		.filter((opt) => !current.includes(opt.id))
		.filter((opt) => {
			if (!q) return true
			const idMatch = opt.id.toLowerCase().includes(q)
			const name = getItemName(opt.id, opt).toLowerCase()
			const nameMatch = name.includes(q)
			const synMatch = Array.isArray(opt.names) && opt.names.some((n) => n.toLowerCase().includes(q))
			return idMatch || nameMatch || synMatch
		})
		.sort((a, b) => {
			if (!q) return 0
			const aName = getItemName(a.id, a).toLowerCase()
			const bName = getItemName(b.id, b).toLowerCase()
			const aStarts = a.id.toLowerCase().startsWith(q) || aName.startsWith(q)
			const bStarts = b.id.toLowerCase().startsWith(q) || bName.startsWith(q)
			if (aStarts && !bStarts) return -1
			if (!aStarts && bStarts) return 1
			return aName.localeCompare(bName)
		})
})

function openDropdown() {
	isDropdownOpen.value = true
	highlightedIndex.value = 0
}

function closeDropdown() {
	isDropdownOpen.value = false
}

function onSearchInput() {
	isDropdownOpen.value = true
	highlightedIndex.value = 0
}

function clearSearch() {
	searchQuery.value = ''
	inputRef.value?.focus()
}

function selectOption(id) {
	if (!id) return
	const next = [...selectedIds.value]
	if (!next.includes(id)) {
		next.push(id)
		emit('update:modelValue', next)
	}
	searchQuery.value = ''
	highlightedIndex.value = 0
	inputRef.value?.focus()
}

function removeItem(id) {
	const next = selectedIds.value.filter((item) => item !== id)
	emit('update:modelValue', next)
}

function clearAll() {
	emit('update:modelValue', [])
}

function navigateDown() {
	if (!isDropdownOpen.value) {
		openDropdown()
		return
	}
	if (highlightedIndex.value < filteredOptions.value.length - 1) {
		highlightedIndex.value++
	}
}

function navigateUp() {
	if (highlightedIndex.value > 0) {
		highlightedIndex.value--
	}
}

function selectHighlighted() {
	if (
		isDropdownOpen.value &&
		filteredOptions.value.length > 0 &&
		filteredOptions.value[highlightedIndex.value]
	) {
		selectOption(filteredOptions.value[highlightedIndex.value].id)
	}
}

function onDocumentClick(e) {
	if (wrapperRef.value && !wrapperRef.value.contains(e.target)) {
		closeDropdown()
	}
}

onMounted(() => {
	window.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
	window.removeEventListener('click', onDocumentClick)
})
</script>

<style scoped>
.entity-tag-picker {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
	padding: 0.6em 0.8em;
	background: rgba(15, 23, 42, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	transition: border-color 0.2s;
}

.entity-tag-picker:focus-within {
	border-color: rgba(255, 255, 255, 0.2);
}

/* Header */
.picker-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.8em;
}

.picker-label {
	font-size: 0.9em;
	font-weight: bold;
	color: #e2e8f0;
	display: flex;
	align-items: center;
	gap: 0.5em;
	flex-wrap: wrap;
}

.picker-hint {
	font-size: 0.85em;
	font-weight: normal;
	color: #94a3b8;
	font-style: italic;
}

.picker-clear-btn {
	background: transparent;
	border: 1px solid rgba(239, 68, 68, 0.3);
	color: #fca5a5;
	font-size: 0.75em;
	font-family: Kurale, sans-serif;
	padding: 0.2em 0.5em;
	border-radius: 0.3em;
	cursor: pointer;
	transition: background-color 0.2s, color 0.2s, border-color 0.2s;
}

.picker-clear-btn:hover {
	background: rgba(239, 68, 68, 0.2);
	color: #ffffff;
	border-color: rgba(239, 68, 68, 0.6);
}

/* Chips List */
.picker-chips-list {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
	min-height: 1.8em;
	align-items: center;
}

.picker-empty-hint {
	font-size: 0.82em;
	color: #64748b;
	font-style: italic;
}

/* Chips Styling */
.picker-chip {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.25em 0.55em;
	border-radius: 0.35em;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	border: 1px solid transparent;
	transition: background-color 0.15s, border-color 0.15s;
}

.chip-icon-wrap {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.chip-icon {
	font-size: 0.9em;
}

.chip-icon-img {
	width: 1.1em;
	height: 1.1em;
	object-fit: contain;
	border-radius: 0.2em;
}

.chip-name {
	font-weight: 500;
}

.chip-id {
	font-size: 0.8em;
	opacity: 0.7;
}

.chip-remove-btn {
	background: transparent;
	border: none;
	color: inherit;
	opacity: 0.7;
	cursor: pointer;
	font-size: 0.8em;
	padding: 0 0.15em;
	line-height: 1;
	border-radius: 0.2em;
	margin-left: 0.2em;
	transition: opacity 0.15s, background-color 0.15s;
}

.chip-remove-btn:hover {
	opacity: 1;
	background: rgba(0, 0, 0, 0.25);
}

/* Specific Chip Colors */
.picker-chip.__chip-class {
	background: rgba(239, 68, 68, 0.16);
	border-color: rgba(239, 68, 68, 0.4);
	color: #fca5a5;
}

.picker-chip.__chip-race {
	background: rgba(59, 130, 246, 0.16);
	border-color: rgba(59, 130, 246, 0.4);
	color: #93c5fd;
}

.picker-chip.__chip-character {
	background: rgba(168, 85, 247, 0.16);
	border-color: rgba(168, 85, 247, 0.4);
	color: #e9d5ff;
}

.picker-chip.__chip-fraction {
	background: rgba(16, 185, 129, 0.16);
	border-color: rgba(16, 185, 129, 0.4);
	color: #6ee7b7;
}

.picker-chip.__chip-category {
	background: rgba(234, 179, 8, 0.16);
	border-color: rgba(234, 179, 8, 0.4);
	color: #fef08a;
}

/* Search Wrapper & Input */
.picker-search-wrapper {
	position: relative;
	width: 100%;
}

.picker-input-row {
	position: relative;
	display: flex;
	align-items: center;
}

.search-icon {
	position: absolute;
	left: 0.6em;
	font-size: 0.85em;
	color: #64748b;
	pointer-events: none;
}

.picker-input {
	width: 100%;
	padding: 0.45em 2em 0.45em 2.2em;
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	color: #f8fafc;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	outline: none;
	transition: border-color 0.2s, background-color 0.2s;
}

.picker-input:focus {
	background: rgba(15, 23, 42, 0.9);
	border-color: rgba(246, 196, 69, 0.6);
}

.picker-input-clear-btn {
	position: absolute;
	right: 0.6em;
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.8em;
	cursor: pointer;
	padding: 0.1em;
	line-height: 1;
}

.picker-input-clear-btn:hover {
	color: #ffffff;
}

/* Dropdown */
.picker-dropdown {
	position: absolute;
	top: 100%;
	left: 0;
	right: 0;
	margin-top: 0.3em;
	background: #111827;
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.4em;
	box-shadow: 0 0.6em 2em rgba(0, 0, 0, 0.8);
	z-index: 70;
	display: flex;
	flex-direction: column;
	backdrop-filter: blur(0.4em);
	overflow: hidden;
}

.picker-dropdown.__empty {
	border-color: rgba(255, 255, 255, 0.15);
}

.dropdown-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.35em 0.7em;
	background: rgba(0, 0, 0, 0.4);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	font-size: 0.75em;
	color: #94a3b8;
}

.dropdown-tip {
	font-size: 0.9em;
	opacity: 0.7;
}

.dropdown-scroll-area {
	max-height: 13em;
	overflow-y: auto;
}

.dropdown-item {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.45em 0.7em;
	cursor: pointer;
	border-bottom: 1px solid rgba(255, 255, 255, 0.04);
	transition: background-color 0.12s, color 0.12s;
	font-family: Kurale, sans-serif;
}

.dropdown-item:last-child {
	border-bottom: none;
}

.dropdown-item:hover,
.dropdown-item.__highlighted {
	background: rgba(246, 196, 69, 0.18);
}

.dropdown-item-left {
	display: flex;
	align-items: center;
	gap: 0.5em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.item-icon-wrap {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.item-icon {
	font-size: 0.95em;
}

.item-icon-img {
	width: 1.2em;
	height: 1.2em;
	object-fit: contain;
	border-radius: 0.2em;
}

.item-title {
	font-size: 0.85em;
	color: #f1f5f9;
}

.item-id-badge {
	font-size: 0.75em;
	color: #94a3b8;
}

.dropdown-item-right {
	flex-shrink: 0;
	margin-left: 0.6em;
}

.add-badge {
	font-size: 0.72em;
	padding: 0.15em 0.45em;
	border-radius: 0.25em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	border: 1px solid rgba(255, 255, 255, 0.12);
}

.dropdown-item:hover .add-badge,
.dropdown-item.__highlighted .add-badge {
	background: rgba(246, 196, 69, 0.3);
	color: #f6c445;
	border-color: rgba(246, 196, 69, 0.5);
}

.dropdown-empty-msg {
	padding: 0.8em;
	text-align: center;
	font-size: 0.85em;
	color: #94a3b8;
	font-style: italic;
}
</style>
