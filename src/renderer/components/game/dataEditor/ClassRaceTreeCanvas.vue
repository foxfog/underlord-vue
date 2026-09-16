<template>
	<div
		class="class-race-tree-wrapper"
		:class="[`__theme-${currentThemeClass}`]"
	>
		<!-- Top Controls Overlay: Search, Zoom, Reset -->
		<div class="tree-top-toolbar">
			<div class="toolbar-left">
				<div class="tree-search-box">
					<span class="search-icon">🔍</span>
					<input
						v-model="searchQuery"
						type="text"
						class="tree-search-input"
						:placeholder="type === 'classes' ? 'Поиск классов...' : 'Поиск рас...'"
					/>
					<button
						v-if="searchQuery"
						class="search-clear-btn"
						@click="searchQuery = ''"
					>
						✕
					</button>
				</div>

				<div class="active-count-badge">
					{{ displayedTreesCount }} веток • {{ filteredEntitiesCount }} сущностей
				</div>
			</div>

			<!-- Zoom Controls -->
			<div class="toolbar-right">
				<div class="zoom-controls-group">
					<button
						type="button"
						class="zoom-btn"
						title="Уменьшить масштаб (Ctrl + Колёсико вниз)"
						@click="zoomOut"
					>
						−
					</button>
					<button
						type="button"
						class="zoom-btn __label"
						title="Сбросить масштаб к 100%"
						@click="resetZoom"
					>
						{{ Math.round(zoomScale * 100) }}%
					</button>
					<button
						type="button"
						class="zoom-btn"
						title="Увеличить масштаб (Ctrl + Колёсико вверх)"
						@click="zoomIn"
					>
						+
					</button>
					<button
						type="button"
						class="zoom-btn __action"
						title="Центрировать обзор"
						@click="centerView"
					>
						🎯 Центр
					</button>
				</div>
			</div>
		</div>

		<!-- Scrollable & Grabbable Canvas Container (2D native scroll + drag-pan) -->
		<div
			ref="scrollContainerRef"
			class="tree-scroll-container"
			:class="{ '__is-panning': isPanning }"
			@mousedown="onPanStart"
			@mousemove="onPanMove"
			@mouseup="onPanEnd"
			@mouseleave="onPanEnd"
			@wheel="onWheel"
		>
			<div
				ref="zoomContentRef"
				class="tree-zoom-content"
				:style="zoomContentStyle"
			>
				<!-- SVG Connectors Layer -->
				<svg
					v-if="connectorLines.length > 0"
					class="tree-connectors-svg"
					:style="svgDimensionStyle"
				>
					<defs>
						<marker
							id="tree-arrow-default"
							markerWidth="6"
							markerHeight="6"
							refX="5"
							refY="3"
							orient="auto"
						>
							<polygon points="0 0.5, 5 3, 0 5.5" fill="#4a5568" />
						</marker>
						<marker
							id="tree-arrow-active"
							markerWidth="6"
							markerHeight="6"
							refX="5"
							refY="3"
							orient="auto"
						>
							<polygon points="0 0.5, 5 3, 0 5.5" fill="#e2b714" />
						</marker>
					</defs>

					<!-- Bézier curves from parent (bottom) to child (top) -->
					<path
						v-for="line in connectorLines"
						:key="line.key"
						:d="line.d"
						class="tree-connector-path"
						:class="{
							__active: line.isActive,
							__dimmed: hoveredNodeId && !line.isActive
						}"
						:marker-end="line.isActive ? 'url(#tree-arrow-active)' : 'url(#tree-arrow-default)'"
					/>
				</svg>

				<!-- Tree Clusters Area: Horizontal sequence of bottom-to-top trees -->
				<div class="tree-clusters-row" ref="clustersContainerRef">
					<div
						v-for="cluster in treeClusters"
						:key="cluster.rootId"
						class="tree-cluster-box"
					>
						<!-- Cluster Title & Category Pill -->
						<div class="cluster-header">
							<span class="cluster-root-icon">{{ cluster.rootIcon || '🌳' }}</span>
							<span class="cluster-root-title">{{ cluster.rootName }}</span>
							<span class="cluster-badge-count">{{ cluster.totalMembers }}</span>
						</div>

						<!-- Bottom-to-Top Tiers inside Cluster: levels ordered ascending from bottom -->
						<div class="cluster-tiers-column">
							<div
								v-for="level in cluster.levels"
								:key="'tier-' + cluster.rootId + '-' + level.depth"
								class="cluster-tier-row"
							>
								<div class="tier-depth-label">
									Ранг {{ level.depth + 1 }}
								</div>

								<div class="tier-nodes-group">
									<div
										v-for="node in level.nodes"
										:key="node.id"
										:ref="(el) => registerNodeRef(node.id, el)"
										class="tree-node-card"
										:class="[
											`__tier-${node.tier || 'basic'}`,
											{
												__selected: selectedId === node.id,
												__hovered: hoveredNodeId === node.id,
												__related: relatedNodeIds.has(node.id),
												__highlighted: isSearchMatched(node)
											}
										]"
										@click.stop="onNodeClick(node)"
										@mouseenter="onNodeMouseEnter(node)"
										@mouseleave="onNodeMouseLeave"
									>
										<!-- Top line: Icon and Tier -->
										<div class="node-top-row">
											<span class="node-icon">
												{{ node.icon || defaultIcon }}
											</span>
											<span class="node-tier-badge" :title="getTierLabel(node.tier)">
												{{ formatTierShort(node.tier) }}
											</span>
										</div>

										<!-- Node Name -->
										<div class="node-name-text" :title="getNodeName(node)">
											{{ getNodeName(node) }}
										</div>

										<!-- Bottom meta line -->
										<div class="node-bottom-row">
											<span class="node-id-tag">{{ node.id }}</span>
											<span
												v-if="getChildCount(node.id) > 0"
												class="node-sub-count"
												:title="`Подклассов/эволюций: ${getChildCount(node.id)}`"
											>
												↳ {{ getChildCount(node.id) }}
											</span>
										</div>

										<!-- Hover Action Buttons -->
										<div class="node-hover-actions" @click.stop>
											<button
												type="button"
												class="node-action-btn __edit"
												title="Редактировать сущность"
												@click.stop="onNodeClick(node)"
											>
												✏️
											</button>
											<button
												type="button"
												class="node-action-btn __add"
												:title="type === 'classes' ? 'Создать дочерний подкласс' : 'Создать дочернюю подрасу'"
												@click.stop="$emit('createChild', node)"
											>
												➕
											</button>
											<button
												type="button"
												class="node-action-btn __delete"
												title="Удалить сущность"
												@click.stop="$emit('delete', node)"
											>
												🗑️
											</button>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>

					<!-- Empty notification if nothing matches -->
					<div v-if="treeClusters.length === 0" class="tree-empty-notice">
						<span class="empty-icon">🍃</span>
						<p>По вашему запросу не найдено ни одного элемента</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Bottom Tabs Bar (Group / Category navigation buttons) -->
		<footer class="tree-bottom-bar">
			<div class="bottom-tabs-group">
				<button
					v-for="cat in availableCategories"
					:key="cat.id"
					type="button"
					class="category-tab-btn"
					:class="{ __active: activeCategory === cat.id }"
					@click="selectCategory(cat.id)"
				>
					<span class="cat-icon">{{ cat.icon }}</span>
					<span class="cat-label">{{ cat.label }}</span>
					<span class="cat-count">{{ getCategoryCount(cat.id) }}</span>
				</button>
			</div>

			<div class="bottom-legend">
				<span class="legend-item __basic">● Базовый (I)</span>
				<span class="legend-item __adv">● Продвинутый (II)</span>
				<span class="legend-item __rare">● Редкий (III)</span>
			</div>
		</footer>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = defineProps({
	type: {
		type: String,
		required: true // 'classes' | 'races'
	},
	items: {
		type: Array,
		default: () => []
	},
	selectedId: {
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
	}
})

const emit = defineEmits(['select', 'createChild', 'delete'])

// State
const activeCategory = ref('combat') // will default based on type
const searchQuery = ref('')
const zoomScale = ref(1.0)
const scrollContainerRef = ref(null)
const zoomContentRef = ref(null)
const clustersContainerRef = ref(null)

const isPanning = ref(false)
const panStart = { x: 0, y: 0 }
const scrollStart = { left: 0, top: 0 }

const hoveredNodeId = ref(null)
const nodeElementsMap = new Map()
const connectorLines = ref([])
const svgDimensions = ref({ width: 2000, height: 1200 })

// Categories definitions
const classCategories = [
	{ id: 'combat', label: 'Боевые', icon: '⚔️' },
	{ id: 'social', label: 'Социальные', icon: '👑' },
	{ id: 'craft', label: 'Ремесленные', icon: '🔨' },
	{ id: 'all', label: 'Все классы', icon: '🌐' }
]

const raceCategories = [
	{ id: 'humanoid', label: 'Гуманоиды', icon: '👤' },
	{ id: 'demi-human', label: 'Полулюди', icon: '🐾' },
	{ id: 'heteromorphic', label: 'Гетероморфы', icon: '💀' },
	{ id: 'all', label: 'Все расы', icon: '🌐' }
]

const availableCategories = computed(() => {
	return props.type === 'classes' ? classCategories : raceCategories
})

// Initialize active category when type changes
watch(
	() => props.type,
	(newType) => {
		activeCategory.value = newType === 'classes' ? 'combat' : 'humanoid'
		nextTick(() => {
			recalculateConnectors()
		})
	},
	{ immediate: true }
)

const defaultIcon = computed(() => (props.type === 'classes' ? '⚔️' : '👤'))

// Theme class for dynamic background
const currentThemeClass = computed(() => {
	return `${props.type}-${activeCategory.value}`
})

function selectCategory(catId) {
	activeCategory.value = catId
	nextTick(() => {
		recalculateConnectors()
	})
}

function getCategoryCount(catId) {
	if (catId === 'all') return props.items.length
	return props.items.filter((item) => item.category === catId).length
}

// Filtered entities by category
const categoryFilteredEntities = computed(() => {
	if (activeCategory.value === 'all') {
		return props.items
	}
	return props.items.filter((item) => item.category === activeCategory.value)
})

// Quick lookup map
const entityMap = computed(() => {
	const map = new Map()
	for (const item of props.items) {
		map.set(item.id, item)
	}
	return map
})

// Find root ancestor for an entity
function getRootAncestor(item) {
	let current = item
	const visited = new Set()
	while (current && current.parent_id && !visited.has(current.id)) {
		visited.add(current.id)
		const parent = entityMap.value.get(current.parent_id)
		if (parent) {
			current = parent
		} else {
			break
		}
	}
	return current
}

// Calculate depth of a node from its root
function calculateDepth(item) {
	let depth = 0
	let current = item
	const visited = new Set()
	while (current && current.parent_id && !visited.has(current.id)) {
		visited.add(current.id)
		const parent = entityMap.value.get(current.parent_id)
		if (parent) {
			depth++
			current = parent
		} else {
			break
		}
	}
	return depth
}

// Build hierarchical clusters (family trees) for bottom-to-top layout
const treeClusters = computed(() => {
	const activeList = categoryFilteredEntities.value
	if (activeList.length === 0) return []

	const activeIds = new Set(activeList.map((i) => i.id))

	// Group entities into clusters by root ancestor
	const clusterMap = new Map()

	for (const item of activeList) {
		const root = getRootAncestor(item)
		const rootId = root.id
		if (!clusterMap.has(rootId)) {
			clusterMap.set(rootId, {
				rootId,
				rootName: getNodeName(root),
				rootIcon: root.icon,
				nodes: []
			})
		}
		clusterMap.get(rootId).nodes.push(item)
	}

	const clusters = []

	for (const [rootId, cData] of clusterMap.entries()) {
		// Group nodes in this cluster by depth
		const depthMap = new Map()
		let maxDepth = 0

		for (const node of cData.nodes) {
			const depth = calculateDepth(node)
			if (depth > maxDepth) maxDepth = depth
			if (!depthMap.has(depth)) {
				depthMap.set(depth, [])
			}
			depthMap.get(depth).push(node)
		}

		// Sort levels descending so that highest tier is on top and level 0 (root) is at the BOTTOM!
		const levels = []
		for (let d = maxDepth; d >= 0; d--) {
			if (depthMap.has(d)) {
				levels.push({
					depth: d,
					nodes: depthMap.get(d)
				})
			}
		}

		clusters.push({
			rootId,
			rootName: cData.rootName,
			rootIcon: cData.rootIcon,
			totalMembers: cData.nodes.length,
			levels
		})
	}

	// Sort clusters: larger clusters first, then alphabetically
	clusters.sort((a, b) => b.totalMembers - a.totalMembers || a.rootName.localeCompare(b.rootName))

	return clusters
})

const displayedTreesCount = computed(() => treeClusters.value.length)
const filteredEntitiesCount = computed(() => categoryFilteredEntities.value.length)

// Child counter
function getChildCount(parentId) {
	return props.items.filter((item) => item.parent_id === parentId).length
}

// Localized name helper
function getNodeName(node) {
	if (!node) return ''
	const loc = props.activeLocale
	const locObj = props.localesData?.[loc]?.[props.type]?.[node.id]
	if (locObj?.name) return locObj.name
	return node.name || node.id
}

function formatTierShort(tier) {
	switch (tier) {
		case 'rare':
			return 'III'
		case 'advanced':
			return 'II'
		case 'basic':
		default:
			return 'I'
	}
}

function getTierLabel(tier) {
	switch (tier) {
		case 'rare':
			return 'Редкий / Высший (Ранг III)'
		case 'advanced':
			return 'Продвинутый (Ранг II)'
		case 'basic':
		default:
			return 'Базовый (Ранг I)'
	}
}

function isSearchMatched(node) {
	const q = searchQuery.value.trim().toLowerCase()
	if (!q) return false
	const name = getNodeName(node).toLowerCase()
	const id = (node.id || '').toLowerCase()
	return name.includes(q) || id.includes(q)
}

// Related nodes highlighting (ancestors + children)
const relatedNodeIds = computed(() => {
	const set = new Set()
	if (!hoveredNodeId.value) return set

	const hovered = entityMap.value.get(hoveredNodeId.value)
	if (!hovered) return set

	// Add ancestors
	let current = hovered
	while (current && current.parent_id) {
		set.add(current.parent_id)
		current = entityMap.value.get(current.parent_id)
	}

	// Add direct children
	for (const item of props.items) {
		if (item.parent_id === hovered.id) {
			set.add(item.id)
		}
	}

	return set
})

function onNodeClick(node) {
	emit('select', node)
}

function onNodeMouseEnter(node) {
	hoveredNodeId.value = node.id
	updateConnectorActiveStates()
}

function onNodeMouseLeave() {
	hoveredNodeId.value = null
	updateConnectorActiveStates()
}

// Node element references for measuring connection coordinates
function registerNodeRef(id, el) {
	if (el) {
		nodeElementsMap.set(id, el)
	} else {
		nodeElementsMap.delete(id)
	}
}

// Calculate SVG connector lines between parent (bottom) and child (top)
function recalculateConnectors() {
	if (!zoomContentRef.value) return

	const containerRect = zoomContentRef.value.getBoundingClientRect()
	const currentZoom = zoomScale.value || 1

	svgDimensions.value = {
		width: Math.max(containerRect.width / currentZoom, 1600),
		height: Math.max(containerRect.height / currentZoom, 1000)
	}

	const lines = []

	for (const item of categoryFilteredEntities.value) {
		if (!item.parent_id) continue

		const childEl = nodeElementsMap.get(item.id)
		const parentEl = nodeElementsMap.get(item.parent_id)

		if (!childEl || !parentEl) continue

		const childRect = childEl.getBoundingClientRect()
		const parentRect = parentEl.getBoundingClientRect()

		// Coordinates unscaled relative to zoom content container
		const pX = (parentRect.left + parentRect.width / 2 - containerRect.left) / currentZoom
		const pY = (parentRect.top - containerRect.top) / currentZoom // Top center of parent

		const cX = (childRect.left + childRect.width / 2 - containerRect.left) / currentZoom
		const cY = (childRect.bottom - containerRect.top) / currentZoom // Bottom center of child

		// Cubic Bézier curve from parent (bottom) to child (top)
		const deltaY = Math.abs(pY - cY)
		const curveOffset = Math.max(deltaY * 0.5, 20)

		const d = `M ${pX} ${pY} C ${pX} ${pY - curveOffset}, ${cX} ${cY + curveOffset}, ${cX} ${cY}`

		lines.push({
			key: `${item.parent_id}->${item.id}`,
			parentId: item.parent_id,
			childId: item.id,
			d,
			isActive: false
		})
	}

	connectorLines.value = lines
	updateConnectorActiveStates()
}

function updateConnectorActiveStates() {
	const hId = hoveredNodeId.value
	const sId = props.selectedId

	for (const line of connectorLines.value) {
		line.isActive =
			(hId && (line.parentId === hId || line.childId === hId)) ||
			(sId && (line.parentId === sId || line.childId === sId))
	}
}

// Zoom & Pan Engine
const zoomContentStyle = computed(() => {
	return {
		transform: `scale(${zoomScale.value})`,
		transformOrigin: '0 0'
	}
})

const svgDimensionStyle = computed(() => {
	return {
		width: `${svgDimensions.value.width}px`,
		height: `${svgDimensions.value.height}px`
	}
})

function zoomIn() {
	zoomScale.value = Math.min(zoomScale.value + 0.15, 2.0)
	nextTick(() => recalculateConnectors())
}

function zoomOut() {
	zoomScale.value = Math.max(zoomScale.value - 0.15, 0.45)
	nextTick(() => recalculateConnectors())
}

function resetZoom() {
	zoomScale.value = 1.0
	nextTick(() => recalculateConnectors())
}

function centerView() {
	if (!scrollContainerRef.value || !zoomContentRef.value) return
	const container = scrollContainerRef.value
	const content = zoomContentRef.value
	container.scrollLeft = (content.scrollWidth * zoomScale.value - container.clientWidth) / 2
	container.scrollTop = content.scrollHeight * zoomScale.value - container.clientHeight
}

function onWheel(e) {
	if (e.ctrlKey) {
		e.preventDefault()
		const delta = e.deltaY < 0 ? 0.08 : -0.08
		zoomScale.value = Math.min(Math.max(zoomScale.value + delta, 0.45), 2.0)
		nextTick(() => recalculateConnectors())
	}
}

function onPanStart(e) {
	// Only trigger pan if left clicked directly on canvas background or middle button
	if (e.button === 1 || (e.button === 0 && e.target === scrollContainerRef.value)) {
		isPanning.value = true
		panStart.x = e.clientX
		panStart.y = e.clientY
		scrollStart.left = scrollContainerRef.value.scrollLeft
		scrollStart.top = scrollContainerRef.value.scrollTop
		e.preventDefault()
	}
}

function onPanMove(e) {
	if (!isPanning.value || !scrollContainerRef.value) return
	const dx = e.clientX - panStart.x
	const dy = e.clientY - panStart.y
	scrollContainerRef.value.scrollLeft = scrollStart.left - dx
	scrollContainerRef.value.scrollTop = scrollStart.top - dy
}

function onPanEnd() {
	isPanning.value = false
}

// Recalculate on items / selection / search changes
watch(
	[() => props.items, () => props.selectedId, searchQuery],
	() => {
		nextTick(() => {
			recalculateConnectors()
		})
	},
	{ deep: true }
)

let resizeObserver = null

onMounted(() => {
	nextTick(() => {
		recalculateConnectors()
		// Auto scroll to bottom so level 0 roots are visible immediately
		if (scrollContainerRef.value) {
			scrollContainerRef.value.scrollTop = scrollContainerRef.value.scrollHeight
		}
	})

	if (typeof window !== 'undefined' && window.ResizeObserver && zoomContentRef.value) {
		resizeObserver = new ResizeObserver(() => {
			recalculateConnectors()
		})
		resizeObserver.observe(zoomContentRef.value)
	}
})

onBeforeUnmount(() => {
	if (resizeObserver) {
		resizeObserver.disconnect()
	}
})
</script>

<style scoped>
.class-race-tree-wrapper {
	position: relative;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	overflow: hidden;
	user-select: none;
	transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ==========================================================================
   Mood Themes for Background by Group
   ========================================================================== */
.__theme-classes-combat {
	background: radial-gradient(circle at 50% 100%, #200d14 0%, #11060a 60%, #080305 100%);
}

.__theme-classes-social {
	background: radial-gradient(circle at 50% 100%, #0d162a 0%, #070d1a 60%, #04070e 100%);
}

.__theme-classes-craft {
	background: radial-gradient(circle at 50% 100%, #24160a 0%, #140d05 60%, #0a0602 100%);
}

.__theme-classes-all {
	background: radial-gradient(circle at 50% 100%, #151a24 0%, #0c1017 60%, #06080c 100%);
}

.__theme-races-humanoid {
	background: radial-gradient(circle at 50% 100%, #0d2218 0%, #07150e 60%, #030a07 100%);
}

.__theme-races-demi-human {
	background: radial-gradient(circle at 50% 100%, #221808 0%, #150f04 60%, #0a0702 100%);
}

.__theme-races-heteromorphic {
	background: radial-gradient(circle at 50% 100%, #190a26 0%, #0f0517 60%, #07020b 100%);
}

.__theme-races-all {
	background: radial-gradient(circle at 50% 100%, #121420 0%, #090b12 60%, #040509 100%);
}

/* ==========================================================================
   Top Toolbar
   ========================================================================== */
.tree-top-toolbar {
	position: absolute;
	top: 0.75em;
	left: 1em;
	right: 1em;
	display: flex;
	justify-content: space-between;
	align-items: center;
	z-index: 10;
	pointer-events: none;
}

.toolbar-left,
.toolbar-right {
	display: flex;
	align-items: center;
	gap: 0.75em;
	pointer-events: auto;
}

.tree-search-box {
	position: relative;
	display: flex;
	align-items: center;
	background: rgba(18, 22, 34, 0.85);
	backdrop-filter: blur(0.5em);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.35em 0.75em;
	box-shadow: 0 0.25em 1em rgba(0, 0, 0, 0.4);
}

.search-icon {
	font-size: 0.9em;
	margin-right: 0.5em;
	opacity: 0.7;
}

.tree-search-input {
	background: transparent;
	border: none;
	outline: none;
	color: #f1f5f9;
	font-size: 0.85em;
	width: 14em;
}

.search-clear-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.8em;
	cursor: pointer;
	padding: 0.1em 0.3em;
}

.search-clear-btn:hover {
	color: #f87171;
}

.active-count-badge {
	background: rgba(18, 22, 34, 0.85);
	backdrop-filter: blur(0.5em);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.4em 0.8em;
	font-size: 0.8em;
	color: #94a3b8;
	box-shadow: 0 0.25em 1em rgba(0, 0, 0, 0.4);
}

.zoom-controls-group {
	display: flex;
	align-items: center;
	background: rgba(18, 22, 34, 0.85);
	backdrop-filter: blur(0.5em);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.2em;
	box-shadow: 0 0.25em 1em rgba(0, 0, 0, 0.4);
}

.zoom-btn {
	background: transparent;
	border: none;
	color: #cbd5e1;
	font-size: 0.85em;
	padding: 0.3em 0.65em;
	border-radius: 0.35em;
	cursor: pointer;
	transition: background 0.15s, color 0.15s;
}

.zoom-btn:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #f8fafc;
}

.zoom-btn.__label {
	font-weight: 600;
	min-width: 3.5em;
	text-align: center;
}

.zoom-btn.__action {
	border-left: 1px solid rgba(255, 255, 255, 0.1);
	margin-left: 0.2em;
}

/* ==========================================================================
   Scrollable Pan Container
   ========================================================================== */
.tree-scroll-container {
	flex: 1;
	width: 100%;
	overflow: auto;
	cursor: grab;
	position: relative;
	scrollbar-width: thin;
	scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.tree-scroll-container.__is-panning {
	cursor: grabbing;
	user-select: none;
}

.tree-zoom-content {
	position: relative;
	min-width: 100%;
	min-height: 100%;
	display: inline-block;
	padding: 4em 3em 6em 3em;
}

/* SVG Connectors */
.tree-connectors-svg {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	z-index: 1;
}

.tree-connector-path {
	fill: none;
	stroke: #4a5568;
	stroke-width: 0.15em;
	stroke-linecap: round;
	transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
}

.tree-connector-path.__active {
	stroke: #e2b714;
	stroke-width: 0.22em;
	filter: drop-shadow(0 0 0.3em rgba(226, 183, 20, 0.6));
}

.tree-connector-path.__dimmed {
	opacity: 0.25;
}

/* Clusters Row */
.tree-clusters-row {
	position: relative;
	z-index: 2;
	display: flex;
	align-items: flex-end; /* Align all cluster trees at the bottom baseline! */
	gap: 3.5em;
	min-width: max-content;
}

.tree-cluster-box {
	display: flex;
	flex-direction: column;
	background: rgba(15, 20, 30, 0.55);
	backdrop-filter: blur(0.3em);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.85em;
	padding: 1.25em;
	box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.35);
}

.cluster-header {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding-bottom: 0.85em;
	margin-bottom: 1em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.cluster-root-icon {
	font-size: 1.2em;
}

.cluster-root-title {
	font-weight: 700;
	font-size: 0.95em;
	color: #e2e8f0;
}

.cluster-badge-count {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.1);
	padding: 0.15em 0.5em;
	border-radius: 1em;
	color: #94a3b8;
	margin-left: auto;
}

/* Cluster Tiers Column (Descending from top tier to level 0 root at bottom) */
.cluster-tiers-column {
	display: flex;
	flex-direction: column;
	gap: 2.2em;
}

.cluster-tier-row {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
	position: relative;
}

.tier-depth-label {
	font-size: 0.7em;
	text-transform: uppercase;
	letter-spacing: 0.08em;
	color: #64748b;
	font-weight: 600;
}

.tier-nodes-group {
	display: flex;
	gap: 1.5em;
	align-items: center;
	justify-content: center;
}

/* ==========================================================================
   Minimalist Node Card
   ========================================================================== */
.tree-node-card {
	position: relative;
	width: 9em;
	min-height: 4.8em;
	background: rgba(20, 26, 38, 0.95);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 0.5em 0.65em;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	justify-content: space-between;
	transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s, background 0.2s;
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.35);
}

.tree-node-card:hover {
	transform: translateY(-0.2em);
	border-color: rgba(255, 255, 255, 0.3);
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.5);
}

/* Tier Glow Accents */
.__tier-basic {
	border-color: rgba(148, 163, 184, 0.25);
}

.__tier-advanced {
	border-color: rgba(56, 189, 248, 0.4);
	box-shadow: 0 0 0.8em rgba(56, 189, 248, 0.15);
}

.__tier-rare {
	border-color: rgba(234, 179, 8, 0.5);
	box-shadow: 0 0 1em rgba(234, 179, 8, 0.2);
}

.__tier-rare .node-top-row .node-tier-badge {
	background: rgba(234, 179, 8, 0.2);
	color: #facc15;
	border-color: rgba(234, 179, 8, 0.4);
}

.__tier-advanced .node-top-row .node-tier-badge {
	background: rgba(56, 189, 248, 0.2);
	color: #7dd3fc;
	border-color: rgba(56, 189, 248, 0.4);
}

/* Selected State */
.tree-node-card.__selected {
	border-color: #f59e0b;
	background: rgba(30, 36, 52, 0.98);
	box-shadow: 0 0 1.2em rgba(245, 158, 11, 0.4), inset 0 0 0.5em rgba(245, 158, 11, 0.2);
}

/* Related Highlight */
.tree-node-card.__related {
	border-color: rgba(245, 158, 11, 0.6);
}

/* Search match */
.tree-node-card.__highlighted {
	outline: 2px solid #10b981;
	outline-offset: 0.15em;
}

/* Node Internal Layout */
.node-top-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.node-icon {
	font-size: 1.15em;
}

.node-tier-badge {
	font-size: 0.65em;
	font-weight: 700;
	padding: 0.1em 0.45em;
	border-radius: 0.35em;
	background: rgba(255, 255, 255, 0.1);
	color: #cbd5e1;
	border: 1px solid rgba(255, 255, 255, 0.12);
}

.node-name-text {
	font-weight: 600;
	font-size: 0.85em;
	color: #f1f5f9;
	margin: 0.35em 0;
	line-height: 1.2;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.node-bottom-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 0.7em;
	color: #94a3b8;
}

.node-id-tag {
	font-family: monospace;
	opacity: 0.7;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	max-width: 5.5em;
}

.node-sub-count {
	font-weight: 600;
	color: #38bdf8;
}

/* Hover Actions Bar */
.node-hover-actions {
	position: absolute;
	top: -0.85em;
	right: -0.35em;
	display: none;
	gap: 0.25em;
	background: rgba(15, 20, 30, 0.95);
	backdrop-filter: blur(0.4em);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.4em;
	padding: 0.15em;
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.5);
	z-index: 5;
}

.tree-node-card:hover .node-hover-actions {
	display: flex;
}

.node-action-btn {
	background: transparent;
	border: none;
	color: #cbd5e1;
	font-size: 0.75em;
	padding: 0.2em 0.35em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: background 0.15s, transform 0.15s;
}

.node-action-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	transform: scale(1.15);
}

.node-action-btn.__delete:hover {
	background: rgba(239, 68, 68, 0.3);
}

.tree-empty-notice {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	width: 100%;
	padding: 4em;
	color: #94a3b8;
	font-size: 0.95em;
}

.empty-icon {
	font-size: 2.5em;
	margin-bottom: 0.5em;
	opacity: 0.6;
}

/* ==========================================================================
   Bottom Toolbar (Navigation buttons at bottom)
   ========================================================================== */
.tree-bottom-bar {
	position: relative;
	z-index: 10;
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.65em 1.5em;
	background: rgba(12, 16, 26, 0.92);
	backdrop-filter: blur(0.8em);
	border-top: 1px solid rgba(255, 255, 255, 0.1);
	box-shadow: 0 -0.5em 2em rgba(0, 0, 0, 0.4);
}

.bottom-tabs-group {
	display: flex;
	gap: 0.65em;
}

.category-tab-btn {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 0.45em 0.95em;
	color: #94a3b8;
	font-size: 0.85em;
	font-weight: 500;
	cursor: pointer;
	transition: background 0.2s, border-color 0.2s, color 0.2s, transform 0.15s;
}

.category-tab-btn:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #f1f5f9;
}

.category-tab-btn.__active {
	background: rgba(255, 255, 255, 0.15);
	border-color: rgba(255, 255, 255, 0.3);
	color: #ffffff;
	font-weight: 700;
	box-shadow: 0 0 1em rgba(255, 255, 255, 0.1);
}

.cat-count {
	font-size: 0.8em;
	background: rgba(0, 0, 0, 0.35);
	padding: 0.1em 0.45em;
	border-radius: 1em;
	opacity: 0.8;
}

.bottom-legend {
	display: flex;
	align-items: center;
	gap: 1em;
	font-size: 0.75em;
	color: #64748b;
}

.legend-item.__basic {
	color: #94a3b8;
}

.legend-item.__adv {
	color: #38bdf8;
}

.legend-item.__rare {
	color: #f59e0b;
}
</style>
