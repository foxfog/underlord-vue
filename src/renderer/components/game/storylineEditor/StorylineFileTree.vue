<template>
	<div class="storyline-file-tree">
		<!-- Header Toolbar -->
		<div class="tree-header">
			<div class="tree-title-row">
				<span class="tree-icon">📂</span>
				<span class="tree-title">Сценарии</span>
				<span class="tree-badge">({{ totalFilesCount }})</span>
			</div>
			<div class="tree-actions">
				<button
					type="button"
					class="tree-action-btn"
					title="Создать сценарий (.json)"
					@click="openCreateFileModal"
				>
					<span>📄+</span>
				</button>
				<button
					type="button"
					class="tree-action-btn"
					title="Создать подпапку"
					@click="openCreateFolderModal"
				>
					<span>📁+</span>
				</button>
				<button
					type="button"
					class="tree-action-btn"
					title="Обновить дерево"
					@click="emit('refresh')"
				>
					<span>🔄</span>
				</button>
				<button
					type="button"
					class="tree-action-btn tree-collapse-btn"
					title="Свернуть панель файлов"
					@click="emit('toggle-collapse')"
				>
					<span>◀</span>
				</button>
			</div>
		</div>

		<!-- Search / Filter -->
		<div class="tree-search">
			<input
				v-model="searchFilter"
				type="text"
				placeholder="Поиск по файлам..."
				class="tree-search-input"
			/>
			<button
				v-if="searchFilter"
				class="tree-search-clear"
				@click="searchFilter = ''"
			>
				×
			</button>
		</div>

		<!-- Tree Content -->
		<div class="tree-list-wrapper">
			<div v-if="isLoading" class="tree-loading">
				<span>Загрузка файлов...</span>
			</div>
			<div v-else-if="filteredItems.length === 0" class="tree-empty">
				<span>Файлы не найдены</span>
			</div>
			<div v-else class="tree-nodes">
				<template v-for="node in filteredItems" :key="node.path">
					<StorylineTreeNode
						:node="node"
						:selected-path="selectedPath"
						:is-expanded-fn="checkFolderExpanded"
						@toggle-folder="toggleFolder"
						@select-file="selectFile"
						@create-file="openCreateFileModalForFolder"
						@create-folder="openCreateFolderModalForFolder"
						@delete-item="confirmDelete"
					/>
				</template>
			</div>
		</div>

		<!-- Modal: Create File -->
		<div v-if="showCreateFileModal" class="tree-modal-backdrop" @click.self="closeModal">
			<div class="tree-modal">
				<h3 class="tree-modal-title">📄 Новый сценарий</h3>
				<p class="tree-modal-subtitle">
					Папка: <code>{{ targetFolder || '/' }}</code>
				</p>
				<div class="tree-modal-body">
					<label class="tree-input-label">Имя файла:</label>
					<input
						v-model="newFileName"
						type="text"
						placeholder="chapter1.json"
						class="tree-modal-input"
						@keydown.enter="submitCreateFile"
					/>
				</div>
				<div class="tree-modal-footer">
					<button type="button" class="modal-btn modal-btn-cancel" @click="closeModal">
						Отмена
					</button>
					<button
						type="button"
						class="modal-btn modal-btn-confirm"
						:disabled="!newFileName.trim()"
						@click="submitCreateFile"
					>
						Создать
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: Create Folder -->
		<div v-if="showCreateFolderModal" class="tree-modal-backdrop" @click.self="closeModal">
			<div class="tree-modal">
				<h3 class="tree-modal-title">📁 Новая подпапка</h3>
				<p class="tree-modal-subtitle">
					Родительская папка: <code>{{ targetFolder || '/' }}</code>
				</p>
				<div class="tree-modal-body">
					<label class="tree-input-label">Имя папки:</label>
					<input
						v-model="newFolderName"
						type="text"
						placeholder="chapter_one"
						class="tree-modal-input"
						@keydown.enter="submitCreateFolder"
					/>
				</div>
				<div class="tree-modal-footer">
					<button type="button" class="modal-btn modal-btn-cancel" @click="closeModal">
						Отмена
					</button>
					<button
						type="button"
						class="modal-btn modal-btn-confirm"
						:disabled="!newFolderName.trim()"
						@click="submitCreateFolder"
					>
						Создать
					</button>
				</div>
			</div>
		</div>

		<!-- Modal: Confirm Delete -->
		<div v-if="itemToDelete" class="tree-modal-backdrop" @click.self="itemToDelete = null">
			<div class="tree-modal">
				<h3 class="tree-modal-title">⚠️ Удаление</h3>
				<p class="tree-modal-subtitle">
					Вы действительно хотите удалить {{ itemToDelete.isDirectory ? 'папку' : 'файл' }}
					<code>{{ itemToDelete.name }}</code>?
				</p>
				<div class="tree-modal-footer">
					<button type="button" class="modal-btn modal-btn-cancel" @click="itemToDelete = null">
						Отмена
					</button>
					<button
						type="button"
						class="modal-btn modal-btn-danger"
						@click="executeDelete"
					>
						Удалить
					</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StorylineTreeNode from './StorylineTreeNode.vue'

const props = defineProps({
	tree: {
		type: Array,
		default: () => []
	},
	selectedPath: {
		type: String,
		default: ''
	},
	isLoading: {
		type: Boolean,
		default: false
	},
	isFolderExpanded: {
		type: Function,
		default: null
	},
	isFolderExpandedFn: {
		type: Function,
		default: null
	}
})

function checkFolderExpanded(path) {
	if (typeof props.isFolderExpanded === 'function') return props.isFolderExpanded(path)
	if (typeof props.isFolderExpandedFn === 'function') return props.isFolderExpandedFn(path)
	return false
}

const emit = defineEmits([
	'select-file',
	'toggle-folder',
	'create-file',
	'create-folder',
	'delete-item',
	'refresh',
	'toggle-collapse'
])

const searchFilter = ref('')
const showCreateFileModal = ref(false)
const showCreateFolderModal = ref(false)
const targetFolder = ref('')
const newFileName = ref('')
const newFolderName = ref('')
const itemToDelete = ref(null)

// Total count of json files
const totalFilesCount = computed(() => {
	let count = 0
	function countRecursive(nodes) {
		for (const n of nodes) {
			if (!n.isDirectory) count++
			if (n.children) countRecursive(n.children)
		}
	}
	countRecursive(props.tree)
	return count
})

// Filtered tree nodes
const filteredItems = computed(() => {
	if (!searchFilter.value.trim()) return props.tree

	const q = searchFilter.value.toLowerCase().trim()
	function filterNodes(nodes) {
		const res = []
		for (const node of nodes) {
			if (node.isDirectory) {
				const filteredChildren = filterNodes(node.children || [])
				if (filteredChildren.length > 0 || node.name.toLowerCase().includes(q)) {
					res.push({
						...node,
						children: filteredChildren
					})
				}
			} else if (node.name.toLowerCase().includes(q)) {
				res.push(node)
			}
		}
		return res
	}
	return filterNodes(props.tree)
})

function toggleFolder(path) {
	emit('toggle-folder', path)
}

function selectFile(path) {
	emit('select-file', path)
}

function openCreateFileModal() {
	targetFolder.value = ''
	newFileName.value = ''
	showCreateFileModal.value = true
}

function openCreateFileModalForFolder(folderPath) {
	targetFolder.value = folderPath
	newFileName.value = ''
	showCreateFileModal.value = true
}

function openCreateFolderModal() {
	targetFolder.value = ''
	newFolderName.value = ''
	showCreateFolderModal.value = true
}

function openCreateFolderModalForFolder(folderPath) {
	targetFolder.value = folderPath
	newFolderName.value = ''
	showCreateFolderModal.value = true
}

function closeModal() {
	showCreateFileModal.value = false
	showCreateFolderModal.value = false
	targetFolder.value = ''
}

function submitCreateFile() {
	if (!newFileName.value.trim()) return
	emit('create-file', {
		folderPath: targetFolder.value,
		fileName: newFileName.value.trim()
	})
	closeModal()
}

function submitCreateFolder() {
	if (!newFolderName.value.trim()) return
	emit('create-folder', {
		parentPath: targetFolder.value,
		folderName: newFolderName.value.trim()
	})
	closeModal()
}

function confirmDelete(item) {
	itemToDelete.value = item
}

function executeDelete() {
	if (!itemToDelete.value) return
	emit('delete-item', {
		path: itemToDelete.value.path,
		isDirectory: itemToDelete.value.isDirectory
	})
	itemToDelete.value = null
}
</script>

<style scoped>
.storyline-file-tree {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: rgba(14, 18, 28, 0.85);
	border-right: 1px solid rgba(255, 255, 255, 0.1);
	font-family: inherit;
	color: #e2e8f0;
	box-sizing: border-box;
}

.tree-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1em;
	background: rgba(20, 26, 40, 0.9);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tree-title-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
}

.tree-icon {
	font-size: 1.2em;
}

.tree-title {
	font-weight: 700;
	font-size: 1em;
	color: #f1f5f9;
}

.tree-badge {
	font-size: 0.8em;
	color: #94a3b8;
}

.tree-actions {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.tree-action-btn {
	background: rgba(255, 255, 255, 0.06);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.35em;
	padding: 0.25em 0.55em;
	color: #cbd5e1;
	font-size: 0.85em;
	cursor: pointer;
	transition: all 0.2s;
}

.tree-action-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	border-color: rgba(246, 196, 69, 0.4);
	color: #fff;
}

.tree-search {
	position: relative;
	padding: 0.6em 0.8em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.tree-search-input {
	width: 100%;
	background: rgba(10, 14, 22, 0.9);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.4em 0.8em;
	font-size: 0.85em;
	color: #f8fafc;
	box-sizing: border-box;
	outline: none;
	transition: border-color 0.2s;
}

.tree-search-input:focus {
	border-color: #f6c445;
}

.tree-search-clear {
	position: absolute;
	right: 1.2em;
	top: 50%;
	transform: translateY(-50%);
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.1em;
	cursor: pointer;
}

.tree-list-wrapper {
	flex: 1;
	overflow-y: auto;
	padding: 0.5em;
}

.tree-loading,
.tree-empty {
	padding: 2em 1em;
	text-align: center;
	color: #64748b;
	font-size: 0.9em;
}

.tree-nodes {
	display: flex;
	flex-direction: column;
	gap: 0.15em;
}

/* Modal Dialogs */
.tree-modal-backdrop {
	position: absolute;
	inset: 0;
	background: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 100;
	backdrop-filter: blur(0.2em);
}

.tree-modal {
	background: #172033;
	border: 1px solid rgba(246, 196, 69, 0.3);
	border-radius: 0.6em;
	padding: 1.4em;
	width: 22em;
	max-width: 90%;
	box-shadow: 0 0.8em 2em rgba(0, 0, 0, 0.6);
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.tree-modal-title {
	margin: 0;
	font-size: 1.1em;
	color: #f6c445;
	font-weight: 700;
}

.tree-modal-subtitle {
	margin: 0;
	font-size: 0.82em;
	color: #94a3b8;
	word-break: break-all;
}

.tree-modal-subtitle code {
	color: #38bdf8;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.1em 0.3em;
	border-radius: 0.25em;
}

.tree-modal-body {
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.tree-input-label {
	font-size: 0.8em;
	color: #cbd5e1;
}

.tree-modal-input {
	background: #0f172a;
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.35em;
	padding: 0.5em 0.8em;
	font-size: 0.9em;
	color: #fff;
	outline: none;
}

.tree-modal-input:focus {
	border-color: #f6c445;
}

.tree-modal-footer {
	display: flex;
	justify-content: flex-end;
	gap: 0.6em;
	margin-top: 0.4em;
}

.modal-btn {
	padding: 0.45em 1em;
	border-radius: 0.35em;
	font-size: 0.85em;
	cursor: pointer;
	border: none;
	font-weight: 600;
	transition: opacity 0.2s;
}

.modal-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.modal-btn-cancel {
	background: rgba(255, 255, 255, 0.1);
	color: #cbd5e1;
}

.modal-btn-cancel:hover {
	background: rgba(255, 255, 255, 0.18);
}

.modal-btn-confirm {
	background: #f6c445;
	color: #0f172a;
}

.modal-btn-confirm:hover:not(:disabled) {
	opacity: 0.9;
}

.modal-btn-danger {
	background: #ef4444;
	color: #fff;
}

.modal-btn-danger:hover {
	opacity: 0.9;
}
</style>
