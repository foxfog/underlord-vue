<template>
	<div
		class="class-race-tree-drawer"
		:class="{ '__overlay': overlay }"
	>
		<!-- Header with Title, Description, Counter and Close Button -->
		<header class="crtd-header">
			<div class="crtd-title-box">
				<span class="crtd-icon">{{ type === 'classes' ? '⚔️' : (type === 'races' ? '🧬' : '🏛️') }}</span>
				<div class="crtd-text-col">
					<h3 class="crtd-title">{{ computedTitle }}</h3>
					<p class="crtd-subtitle">{{ computedSubtitle }}</p>
				</div>
			</div>

			<div class="crtd-actions">
				<div class="crtd-assigned-count">
					Выбрано: <strong>{{ assignedIds.length }}</strong>
				</div>
				<button
					type="button"
					class="crtd-close-btn"
					title="Закрыть древо выбора"
					@click="$emit('close')"
				>
					✕ Закрыть древо
				</button>
			</div>
		</header>

		<!-- Main Canvas Area Embedding Unified ClassRaceTreeCanvas -->
		<div class="crtd-canvas-wrapper">
			<ClassRaceTreeCanvas
				:type="type"
				:items="items"
				:selected-id="activeEntityId"
				:selection-mode="true"
				:assigned-ids="assignedIds"
				:active-locale="activeLocale"
				:locales-data="localesData"
				@select="onNodeSelect"
				@toggle-assign="onToggleAssign"
			/>
		</div>
	</div>
</template>

<script setup>
import { computed } from 'vue'
import ClassRaceTreeCanvas from './ClassRaceTreeCanvas.vue'

const props = defineProps({
	type: {
		type: String,
		required: true
	},
	items: {
		type: Array,
		default: () => []
	},
	assignedIds: {
		type: Array,
		default: () => []
	},
	activeEntityId: {
		type: String,
		default: null
	},
	activeLocale: {
		type: String,
		default: 'ru'
	},
	localesData: {
		type: Object,
		default: () => ({})
	},
	title: {
		type: String,
		default: ''
	},
	subtitle: {
		type: String,
		default: ''
	},
	overlay: {
		type: Boolean,
		default: false
	}
})

const emit = defineEmits(['close', 'select', 'toggle-assign'])

const computedTitle = computed(() => {
	if (props.title) return props.title
	if (props.type === 'classes') return 'Древо специализаций классов'
	if (props.type === 'races') return 'Древо рас и семейств'
	return 'Древо иерархии'
})

const computedSubtitle = computed(() => {
	if (props.subtitle) return props.subtitle
	if (props.type === 'classes') {
		return 'Выберите классы персонажа (базовые, высшие, редкие). Кликните по узлу или кнопке «Взять», чтобы назначить.'
	}
	if (props.type === 'races') {
		return 'Выберите расы персонажа (гетероморфы, полулюди, гуманоиды). Кликните по узлу или кнопке «Взять», чтобы назначить.'
	}
	return 'Кликните по узлу, чтобы выбрать или назначить.'
})

function onNodeSelect(node) {
	emit('select', node)
}

function onToggleAssign(node) {
	emit('toggle-assign', node)
}
</script>

<style scoped>
.class-race-tree-drawer {
	width: 100%;
	height: 44em;
	display: flex;
	flex-direction: column;
	background: rgba(13, 17, 26, 0.98);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.6em;
	box-shadow: 0 0.8em 2em rgba(0, 0, 0, 0.5);
	overflow: hidden;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	color: #e2e8f0;
	position: relative;
}

.class-race-tree-drawer.__overlay {
	position: absolute;
	inset: 0;
	z-index: 50;
	height: auto;
	box-shadow: 0 1em 3em rgba(0, 0, 0, 0.8);
}

.crtd-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.8em 1.2em;
	background: rgba(18, 26, 43, 0.95);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	gap: 1em;
	flex-wrap: wrap;
	z-index: 10;
}

.crtd-title-box {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.crtd-icon {
	font-size: 1.8em;
}

.crtd-text-col {
	display: flex;
	flex-direction: column;
	gap: 0.15em;
}

.crtd-title {
	margin: 0;
	font-size: 1.15em;
	font-weight: 700;
	color: #f8fafc;
	font-family: Overlord, Kurale, serif;
}

.crtd-subtitle {
	margin: 0;
	font-size: 0.82em;
	color: #94a3b8;
	line-height: 1.25;
}

.crtd-actions {
	display: flex;
	align-items: center;
	gap: 1em;
}

.crtd-assigned-count {
	font-size: 0.88em;
	color: #94a3b8;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	padding: 0.3em 0.7em;
	border-radius: 0.35em;
}

.crtd-assigned-count strong {
	color: #10b981;
}

.crtd-close-btn {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f1f5f9;
	border-radius: 0.4em;
	padding: 0.4em 0.9em;
	font-size: 0.88em;
	font-weight: 600;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.crtd-close-btn:hover {
	background: rgba(239, 68, 68, 0.2);
	border-color: rgba(239, 68, 68, 0.5);
	color: #fca5a5;
}

.crtd-canvas-wrapper {
	flex: 1;
	min-height: 0;
	position: relative;
	overflow: hidden;
}
</style>
