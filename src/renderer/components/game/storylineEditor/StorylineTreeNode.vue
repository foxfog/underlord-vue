<template>
	<div class="tree-node" :class="{ __directory: node.isDirectory }">
		<div
			class="node-row"
			:class="{
				__active: !node.isDirectory && selectedPath === node.path,
				__expanded: node.isDirectory && isNodeExpanded(node.path)
			}"
			@click="handleClick"
		>
			<!-- Toggle chevron / indent -->
			<span v-if="node.isDirectory" class="node-arrow">
				{{ isNodeExpanded(node.path) ? '▼' : '▶' }}
			</span>
			<span v-else class="node-spacer"></span>

			<!-- Icon -->
			<span class="node-icon">
				<template v-if="node.isDirectory">
					{{ isNodeExpanded(node.path) ? '📂' : '📁' }}
				</template>
				<template v-else>
					📄
				</template>
			</span>

			<!-- Title -->
			<span class="node-label" :title="node.path">
				{{ node.name }}
			</span>

			<!-- Children count badge -->
			<span v-if="node.isDirectory && node.children?.length" class="node-count">
				{{ node.children.length }}
			</span>

			<!-- Hover Context Actions -->
			<div class="node-actions" @click.stop>
				<template v-if="node.isDirectory">
					<button
						type="button"
						class="node-action-btn"
						title="Создать файл в этой папке"
						@click.stop="emit('create-file', node.path)"
					>
						+📄
					</button>
					<button
						type="button"
						class="node-action-btn"
						title="Создать подпапку"
						@click.stop="emit('create-folder', node.path)"
					>
						+📁
					</button>
					<button
						type="button"
						class="node-action-btn __danger"
						title="Удалить папку"
						@click.stop="emit('delete-item', node)"
					>
						🗑️
					</button>
				</template>
				<template v-else>
					<button
						type="button"
						class="node-action-btn __danger"
						title="Удалить файл"
						@click.stop="emit('delete-item', node)"
					>
						🗑️
					</button>
				</template>
			</div>
		</div>

		<!-- Recursive Children for Folder -->
		<div
			v-if="node.isDirectory && isNodeExpanded(node.path) && node.children?.length"
			class="node-children"
		>
			<StorylineTreeNode
				v-for="child in node.children"
				:key="child.path"
				:node="child"
				:selected-path="selectedPath"
				:is-expanded-fn="isExpandedFn"
				@toggle-folder="(p) => emit('toggle-folder', p)"
				@select-file="(p) => emit('select-file', p)"
				@create-file="(p) => emit('create-file', p)"
				@create-folder="(p) => emit('create-folder', p)"
				@delete-item="(item) => emit('delete-item', item)"
			/>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	node: {
		type: Object,
		required: true
	},
	selectedPath: {
		type: String,
		default: ''
	},
	isExpandedFn: {
		type: Function,
		default: () => false
	}
})

const emit = defineEmits([
	'toggle-folder',
	'select-file',
	'create-file',
	'create-folder',
	'delete-item'
])

function isNodeExpanded(path) {
	return typeof props.isExpandedFn === 'function' ? props.isExpandedFn(path) : false
}

function handleClick() {
	if (props.node.isDirectory) {
		emit('toggle-folder', props.node.path)
	} else {
		emit('select-file', props.node.path)
	}
}
</script>

<style scoped>
.tree-node {
	display: flex;
	flex-direction: column;
}

.node-row {
	display: flex;
	align-items: center;
	padding: 0.35em 0.5em;
	border-radius: 0.35em;
	cursor: pointer;
	user-select: none;
	transition: background 0.15s, color 0.15s;
	position: relative;
	gap: 0.35em;
}

.node-row:hover {
	background: rgba(255, 255, 255, 0.07);
}

.node-row.__active {
	background: rgba(246, 196, 69, 0.2);
	border-left: 2px solid #f6c445;
	color: #fff;
	font-weight: 600;
}

.node-arrow {
	font-size: 0.65em;
	width: 1em;
	color: #94a3b8;
	display: inline-flex;
	justify-content: center;
}

.node-spacer {
	width: 1em;
}

.node-icon {
	font-size: 0.95em;
}

.node-label {
	flex: 1;
	font-size: 0.88em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: inherit;
}

.node-count {
	font-size: 0.72em;
	color: #64748b;
	background: rgba(255, 255, 255, 0.05);
	padding: 0.1em 0.4em;
	border-radius: 0.8em;
}

.node-actions {
	display: none;
	align-items: center;
	gap: 0.2em;
}

.node-row:hover .node-actions {
	display: flex;
}

.node-action-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.8em;
	padding: 0.1em 0.3em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: all 0.15s;
}

.node-action-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.node-action-btn.__danger:hover {
	background: rgba(239, 68, 68, 0.3);
	color: #ef4444;
}

.node-children {
	margin-left: 0.9em;
	padding-left: 0.4em;
	border-left: 1px solid rgba(255, 255, 255, 0.07);
	display: flex;
	flex-direction: column;
	gap: 0.15em;
}
</style>
