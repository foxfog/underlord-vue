<template>
	<div
		class="quest-tree-node"
		:class="[`status-${quest.status}`, `depth-${depth}`, { 'is-root': depth === 0 }]"
	>
		<div class="quest-node-card clickable" @click="onCardClick">
			<div class="quest-node-header">
				<span class="quest-status-icon">
					<template v-if="quest.status === 'completed'">✔</template>
					<template v-else-if="quest.status === 'failed'">❌</template>
					<template v-else>⚡</template>
				</span>

				<span class="quest-node-title">{{ quest.title }}</span>

				<span class="quest-status-pill" :class="`pill-${quest.status}`">
					<template v-if="quest.status === 'completed'">Выполнено</template>
					<template v-else-if="quest.status === 'failed'">Провалено</template>
					<template v-else>В процессе</template>
				</span>

				<span class="quest-inspect-btn" title="Посмотреть задачи и хронику">
					🔍
				</span>
			</div>

			<div v-if="quest.description" class="quest-node-desc">
				{{ quest.description }}
			</div>

			<div v-if="quest.tasks && quest.tasks.length > 0" class="quest-tasks-badge-bar">
				<span class="tasks-mini-counter">
					📋 Задачи: {{ completedTasksCount }}/{{ quest.tasks.length }}
				</span>
			</div>
		</div>

		<!-- Рекурсивный рендеринг дочерних квестов произвольной вложенности -->
		<div
			v-if="quest.children && quest.children.length > 0"
			class="quest-children-container"
		>
			<QuestTreeItem
				v-for="child in quest.children"
				:key="child.id"
				:quest="child"
				:depth="depth + 1"
				@select-quest="$emit('select-quest', $event)"
			/>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
	quest: {
		type: Object,
		required: true
	},
	depth: {
		type: Number,
		default: 0
	}
})

const emit = defineEmits(['select-quest'])

const completedTasksCount = computed(() => {
	if (!props.quest.tasks || !Array.isArray(props.quest.tasks)) return 0
	return props.quest.tasks.filter((t) => t.completed).length
})

function onCardClick() {
	emit('select-quest', props.quest)
}
</script>

<style scoped>
.quest-tree-node {
	display: flex;
	flex-direction: column;
	position: relative;
	margin-bottom: 0.6em;
}

.quest-node-card {
	background: rgba(255, 255, 255, 0.04);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.75em 1em;
	transition: all 0.2s ease;
}

.quest-node-card.clickable {
	cursor: pointer;
}

.quest-node-card.clickable:hover {
	background: rgba(255, 255, 255, 0.09);
	border-color: rgba(56, 189, 248, 0.5);
	transform: translateX(0.2em);
}

.quest-inspect-btn {
	font-size: 0.95em;
	opacity: 0.6;
	transition: opacity 0.2s ease, transform 0.2s ease;
	margin-left: 0.4em;
}

.quest-node-card.clickable:hover .quest-inspect-btn {
	opacity: 1;
	transform: scale(1.15);
}

.quest-tasks-badge-bar {
	margin-top: 0.5em;
	padding-left: 1.7em;
	display: flex;
	gap: 0.5em;
}

.tasks-mini-counter {
	font-size: 0.76em;
	color: #94a3b8;
	background: rgba(255, 255, 255, 0.06);
	padding: 0.15em 0.5em;
	border-radius: 0.25em;
	border: 1px solid rgba(255, 255, 255, 0.08);
}

.is-root .quest-node-card {
	background: rgba(255, 255, 255, 0.07);
	border-color: rgba(255, 255, 255, 0.18);
	box-shadow: 0 0.25em 0.75em rgba(0, 0, 0, 0.2);
}

.status-active .quest-node-card {
	border-left: 4px solid #38bdf8;
}

.status-completed .quest-node-card {
	border-left: 4px solid #4ade80;
	opacity: 0.85;
}

.status-failed .quest-node-card {
	border-left: 4px solid #f87171;
	opacity: 0.7;
}

.quest-node-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.quest-status-icon {
	font-size: 1.1em;
	line-height: 1;
}

.status-active .quest-status-icon {
	color: #38bdf8;
	text-shadow: 0 0 0.5em rgba(56, 189, 248, 0.6);
}

.status-completed .quest-status-icon {
	color: #4ade80;
	text-shadow: 0 0 0.5em rgba(74, 222, 128, 0.6);
}

.status-failed .quest-status-icon {
	color: #f87171;
}

.quest-node-title {
	font-weight: 600;
	font-size: 1em;
	color: #f8fafc;
	flex: 1;
}

.status-completed .quest-node-title {
	color: #cbd5e1;
	text-decoration: line-through;
}

.quest-status-pill {
	font-size: 0.72em;
	padding: 0.15em 0.5em;
	border-radius: 0.75em;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.pill-active {
	background: rgba(56, 189, 248, 0.2);
	color: #7dd3fc;
	border: 1px solid rgba(56, 189, 248, 0.4);
}

.pill-completed {
	background: rgba(74, 222, 128, 0.2);
	color: #86efac;
	border: 1px solid rgba(74, 222, 128, 0.4);
}

.pill-failed {
	background: rgba(248, 113, 113, 0.2);
	color: #fca5a5;
	border: 1px solid rgba(248, 113, 113, 0.4);
}

.quest-node-desc {
	margin-top: 0.4em;
	padding-left: 1.7em;
	font-size: 0.88em;
	color: #94a3b8;
	line-height: 1.4;
}

/* Древовидная связь для потомков */
.quest-children-container {
	margin-left: 1.5em;
	padding-left: 1em;
	border-left: 2px dashed rgba(255, 255, 255, 0.15);
	margin-top: 0.5em;
}
</style>
