<template>
	<div class="tree-node-wrap" :style="{ marginLeft: depth * 0.75 + 'em' }">
		<div
			class="tree-node-row"
			:class="{ __selected: selectedId === node.id }"
			@click.stop="$emit('select', node)"
		>
			<button
				v-if="hasChildren"
				class="node-expander"
				:title="isExpanded ? 'Свернуть' : 'Развернуть'"
				@click.stop="isExpanded = !isExpanded"
			>
				{{ isExpanded ? '▾' : '▸' }}
			</button>
			<span v-else class="node-bullet">•</span>

			<span class="node-icon">{{ node.icon || '📦' }}</span>
			<span class="node-name" :title="node.name || node.type">{{ node.name || node.type }}</span>

			<div class="node-tags">
				<span class="tag tag-z">Z:{{ node.offsetZ || 0 }}</span>
				<span class="tag tag-order">#{{ node.zIndex || 1 }}</span>
			</div>

			<div class="node-buttons">
				<button
					class="node-btn node-btn-add"
					title="Добавить дочерний объект к этому элементу"
					@click.stop="$emit('add-child', node)"
				>
					➕
				</button>
				<button
					class="node-btn node-btn-del"
					title="Удалить этот объект"
					@click.stop="$emit('delete', node)"
				>
					✕
				</button>
			</div>
		</div>

		<!-- Recursive Children -->
		<div v-if="hasChildren && isExpanded" class="tree-node-children">
			<IsoObjectTreeNode
				v-for="child in node.children"
				:key="child.id"
				:node="child"
				:selected-id="selectedId"
				:depth="depth + 1"
				@select="$emit('select', $event)"
				@add-child="$emit('add-child', $event)"
				@delete="$emit('delete', $event)"
			/>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
	node: { type: Object, required: true },
	selectedId: { type: String, default: null },
	depth: { type: Number, default: 0 }
})

defineEmits(['select', 'add-child', 'delete'])

const isExpanded = ref(true)

const hasChildren = computed(() => {
	return Array.isArray(props.node.children) && props.node.children.length > 0
})
</script>

<style scoped>
.tree-node-wrap {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	font-family: Kurale, sans-serif;
}

.tree-node-row {
	display: flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.35em 0.5em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	font-size: 0.85em;
	color: #cbd5e1;
	cursor: pointer;
	user-select: none;
	transition: background-color 0.15s, border-color 0.15s;
}

.tree-node-row:hover {
	background: rgba(51, 65, 85, 0.8);
	border-color: rgba(56, 189, 248, 0.4);
}

.tree-node-row.__selected {
	background: rgba(56, 189, 248, 0.22);
	border-color: #38bdf8;
	color: #ffffff;
	box-shadow: 0 0 0.5em rgba(56, 189, 248, 0.25);
}

.node-expander {
	background: none;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.9em;
	padding: 0 0.2em;
	line-height: 1;
}

.node-bullet {
	color: #64748b;
	font-size: 0.9em;
	padding: 0 0.2em;
}

.node-icon {
	font-size: 1.1em;
	line-height: 1;
}

.node-name {
	flex: 1;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-weight: bold;
}

.node-tags {
	display: flex;
	gap: 0.25em;
	font-size: 0.75em;
}

.tag {
	padding: 0.1em 0.35em;
	border-radius: 0.2em;
	font-weight: bold;
}

.tag-z {
	background: rgba(147, 51, 234, 0.25);
	color: #c084fc;
	border: 1px solid rgba(147, 51, 234, 0.4);
}

.tag-order {
	background: rgba(59, 130, 246, 0.25);
	color: #93c5fd;
	border: 1px solid rgba(59, 130, 246, 0.4);
}

.node-buttons {
	display: flex;
	gap: 0.25em;
	margin-left: 0.2em;
}

.node-btn {
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	border-radius: 0.25em;
	padding: 0.15em 0.35em;
	font-size: 0.75em;
	cursor: pointer;
	line-height: 1;
	transition: all 0.15s;
}

.node-btn-add:hover {
	border-color: #10b981;
	background: rgba(16, 185, 129, 0.3);
	color: #34d399;
}

.node-btn-del:hover {
	border-color: #ef4444;
	background: rgba(239, 68, 68, 0.3);
	color: #fca5a5;
}

.tree-node-children {
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	margin-top: 0.2em;
	padding-left: 0.4em;
	border-left: 1px dashed rgba(255, 255, 255, 0.15);
}
</style>
