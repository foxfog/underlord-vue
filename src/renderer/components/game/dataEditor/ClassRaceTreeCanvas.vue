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
						:placeholder="type === 'classes' ? 'Поиск классов...' : (type === 'races' ? 'Поиск рас...' : 'Поиск фракций...')"
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
					{{ displayedTreesCount }} {{ type === 'races' ? 'семейств' : (type === 'fractions' ? 'союзов / фракций' : 'веток') }} • {{ filteredEntitiesCount }} сущностей
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
			@wheel.passive="onWheel"
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
							<polygon points="0 0.8, 5 3, 0 5.2" fill="#94a3b8" />
						</marker>
						<marker
							id="tree-arrow-active"
							markerWidth="6"
							markerHeight="6"
							refX="5"
							refY="3"
							orient="auto"
						>
							<polygon points="0 0.8, 5 3, 0 5.2" fill="#fbbf24" />
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

						<!-- Horizontal Trees Row inside Family Cluster -->
						<div class="cluster-branches-row">
							<div
								v-for="tree in cluster.trees"
								:key="tree.treeId"
								class="cluster-branch-lane"
								:class="{ '__has-sibling-branches': cluster.trees.length > 1 }"
							>
								<!-- Sub-tree Header if cluster has multiple trees -->
								<div
									v-if="cluster.trees.length > 1"
									class="branch-lane-header"
									:title="tree.rootName"
								>
									<span class="branch-lane-icon">{{ tree.rootIcon }}</span>
									<span class="branch-lane-title">{{ tree.rootName }}</span>
								</div>

								<!-- 2D Column-Slot Grid Canvas for Tree -->
								<div
									class="tree-grid-canvas"
									:style="{
										gridTemplateColumns: `repeat(${tree.totalCols}, minmax(6.8em, 1fr))`,
										gridTemplateRows: `repeat(${tree.totalRows}, auto)`
									}"
								>
									<div
										v-for="node in tree.nodes"
										:key="node.id"
										class="tree-grid-cell"
										:style="{
											gridColumn: node.gridColumn,
											gridRow: node.gridRow
										}"
									>
										<div
											:ref="(el) => registerNodeRef(node.id, el)"
											class="tree-node-wrapper"
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
											<!-- Square Box (Skill Tree Aesthetic) -->
											<div
												class="tree-node-square"
												:class="`__tier-${node.tier || 'basic'}`"
											>
												<!-- Tier badge in corner: I, II, III -->
												<span class="node-tier-badge" :title="getTierLabel(node)">
													{{ formatTierShort(node) }}
												</span>

												<!-- Main Icon in center (large, 1.85em) -->
												<span class="node-main-icon">
													{{ node.icon || defaultIcon }}
												</span>

												<!-- Subclasses counter badge in bottom-right corner -->
												<span
													v-if="getChildCount(node.id) > 0"
													class="node-child-badge"
													:title="type === 'fractions' ? (`Подразделений/филиалов: ${getChildCount(node.id)}`) : (`Подклассов/эволюций: ${getChildCount(node.id)}`)"
												>
													↳{{ getChildCount(node.id) }}
												</span>

												<!-- Hover Action Buttons overlay -->
												<div class="node-hover-actions" @click.stop>
													<button
														type="button"
														class="node-action-btn __edit"
														:title="type === 'fractions' ? 'Редактировать фракцию' : 'Редактировать сущность'"
														@click.stop="onNodeClick(node)"
													>
														✏️
													</button>
													<button
														type="button"
														class="node-action-btn __add"
														:title="type === 'classes' ? 'Создать дочерний подкласс' : (type === 'races' ? 'Создать дочернюю подрасу' : 'Создать дочернюю организацию / подразделение')"
														@click.stop="$emit('createChild', node)"
													>
														➕
													</button>
													<button
														type="button"
														class="node-action-btn __delete"
														:title="type === 'fractions' ? 'Удалить фракцию' : 'Удалить сущность'"
														@click.stop="$emit('delete', node)"
													>
														🗑️
													</button>
												</div>
											</div>

											<!-- Node Name Under the Square -->
											<div class="node-name-under" :title="getNodeName(node)">
												{{ getNodeName(node) }}
											</div>

											<!-- Type tag under name for fractions -->
											<div v-if="type === 'fractions' && node.type" class="node-type-pill">
												{{ getFactionTypeLabel(node.type) }}
											</div>

											<!-- Node ID tag under name -->
											<div class="node-id-under">
												{{ node.id }}
											</div>
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
				<template v-if="type === 'fractions'">
					<span class="legend-item __basic">● Верховная фракция (I)</span>
					<span class="legend-item __adv">● Подразделение / База (II)</span>
					<span class="legend-item __rare">● Отряд / Внутренняя фракция (III+)</span>
				</template>
				<template v-else>
					<span class="legend-item __basic">● Базовый (I)</span>
					<span class="legend-item __adv">● Продвинутый (II)</span>
					<span class="legend-item __rare">● Редкий (III)</span>
				</template>
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

const fractionCategories = [
	{ id: 'all', label: 'Все фракции', icon: '🌐' },
	{ id: 'nation', label: 'Государства', icon: '👑' },
	{ id: 'guild', label: 'Гильдии и ордена', icon: '⚔️' },
	{ id: 'clan', label: 'Кланы и синдикаты', icon: '🖐️' },
	{ id: 'religious', label: 'Религии и культы', icon: '☀️' }
]

const availableCategories = computed(() => {
	if (props.type === 'classes') return classCategories
	if (props.type === 'races') return raceCategories
	return fractionCategories
})

// Initialize active category when type changes
watch(
	() => props.type,
	(newType) => {
		if (newType === 'classes') {
			activeCategory.value = 'combat'
		} else if (newType === 'races') {
			activeCategory.value = 'humanoid'
		} else {
			activeCategory.value = 'all'
		}
		nextTick(() => {
			recalculateConnectors()
		})
	},
	{ immediate: true }
)

const defaultIcon = computed(() => {
	if (props.type === 'classes') return '⚔️'
	if (props.type === 'races') return '👤'
	return '🏛️'
})

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

// Quick lookup map
const entityMap = computed(() => {
	const map = new Map()
	for (const item of props.items) {
		map.set(item.id, item)
	}
	return map
})

// Helper to parse parent ID(s) which can be null, string (single or comma-separated), or array
function getParentIds(item) {
	if (!item || !item.parent_id) return []
	if (Array.isArray(item.parent_id)) {
		return item.parent_id.map((id) => String(id).trim()).filter(Boolean)
	}
	if (typeof item.parent_id === 'string') {
		return item.parent_id.split(',').map((id) => id.trim()).filter(Boolean)
	}
	return []
}

// Find root ancestor for an entity
function getRootAncestor(item) {
	let current = item
	const visited = new Set()
	while (current) {
		const pids = getParentIds(current)
		if (pids.length === 0 || visited.has(current.id)) {
			break
		}
		visited.add(current.id)
		const parent = entityMap.value.get(pids[0])
		if (parent) {
			current = parent
		} else {
			break
		}
	}
	return current
}

function getFactionCategoryKey(item) {
	const root = getRootAncestor(item)
	const valid = ['nation', 'guild', 'clan', 'religious']
	if (root?.type && valid.includes(root.type)) {
		return root.type
	}
	if (item.type && valid.includes(item.type)) {
		return item.type
	}
	return 'guild'
}

function getCategoryCount(catId) {
	if (catId === 'all') return props.items.length
	if (props.type === 'fractions') {
		return props.items.filter((item) => getFactionCategoryKey(item) === catId).length
	}
	return props.items.filter((item) => item.category === catId).length
}

// Filtered entities by category
const categoryFilteredEntities = computed(() => {
	if (activeCategory.value === 'all') {
		return props.items
	}
	if (props.type === 'fractions') {
		return props.items.filter((item) => getFactionCategoryKey(item) === activeCategory.value)
	}
	return props.items.filter((item) => item.category === activeCategory.value)
})

// Calculate depth of a node from its root(s) with multi-parent support
function calculateDepth(item, visited = new Set()) {
	if (!item || visited.has(item.id)) return 0
	visited.add(item.id)
	const pids = getParentIds(item)
	if (pids.length === 0) return 0

	let maxParentDepth = 0
	for (const pid of pids) {
		const parent = entityMap.value.get(pid)
		if (parent) {
			const d = calculateDepth(parent, new Set(visited))
			if (d > maxParentDepth) maxParentDepth = d
		}
	}
	return maxParentDepth + 1
}

// Localized family definitions for metadata (name & icon)
const RACE_FAMILY_META = {
	human: { name_ru: 'Люди', name_en: 'Humans', icon: '👤' },
	elf: { name_ru: 'Эльфы', name_en: 'Elves', icon: '🧝' },
	dwarf: { name_ru: 'Дварфы', name_en: 'Dwarves', icon: '🧔' },
	goblin: { name_ru: 'Гоблины', name_en: 'Goblins', icon: '👺' },
	orc: { name_ru: 'Орки', name_en: 'Orcs', icon: '🧌' },
	ogre: { name_ru: 'Огры', name_en: 'Ogres', icon: '👹' },
	troll: { name_ru: 'Тролли', name_en: 'Trolls', icon: '🧌' },
	beastman: { name_ru: 'Зверолюди', name_en: 'Beastmen', icon: '🦎' },
	skeleton: { name_ru: 'Скелеты', name_en: 'Skeletons', icon: '💀' },
	ghost: { name_ru: 'Призраки', name_en: 'Ghosts', icon: '👻' },
	zombie: { name_ru: 'Зомби', name_en: 'Zombies', icon: '🧟' },
	vampire: { name_ru: 'Вампиры', name_en: 'Vampires', icon: '🩸' },
	werewolf: { name_ru: 'Оборотни', name_en: 'Werewolves', icon: '🐺' },
	infernal: { name_ru: 'Демоны', name_en: 'Infernals', icon: '😈' },
	celestial: { name_ru: 'Ангелы', name_en: 'Celestials', icon: '🪽' },
	slime: { name_ru: 'Слаймы', name_en: 'Slimes', icon: '🫧' },
	insectoid: { name_ru: 'Инсектоиды', name_en: 'Insectoids', icon: '🦗' },
	dragon_kin: { name_ru: 'Дракониды', name_en: 'Dragon-kin', icon: '🐉' },
	other: { name_ru: 'Прочие', name_en: 'Other', icon: '🎭' },
	beast: { name_ru: 'Звери', name_en: 'Beasts', icon: '🐾' },
	elemental: { name_ru: 'Элементали', name_en: 'Elementals', icon: '✨' },
	golem: { name_ru: 'Големы', name_en: 'Golems', icon: '🤖' },
	avian: { name_ru: 'Птицы', name_en: 'Avians', icon: '🦅' },
	aquatic: { name_ru: 'Водные', name_en: 'Aquatics', icon: '🦈' }
}

// Helper to calculate tier of a node (manual grid_tier takes priority over calculated depth)
function getNodeTier(item) {
	if (!item) return 0
	if (item.grid_tier !== undefined && item.grid_tier !== null && item.grid_tier !== '') {
		const parsed = parseInt(item.grid_tier, 10)
		if (!isNaN(parsed) && parsed >= 0) return parsed
	}
	return calculateDepth(item)
}

// Build hierarchical clusters (family trees) for bottom-to-top layout
const treeClusters = computed(() => {
	const activeList = categoryFilteredEntities.value
	if (activeList.length === 0) return []

	// Group entities into clusters by family (if present) or root ancestor
	const clusterMap = new Map()

	for (const item of activeList) {
		const root = getRootAncestor(item)
		const familyKey = item.family || (props.type === 'races' && root?.family) || root.id

		if (!clusterMap.has(familyKey)) {
			let clusterName = ''
			let clusterIcon = ''

			if (item.family && RACE_FAMILY_META[item.family]) {
				const meta = RACE_FAMILY_META[item.family]
				clusterName = props.activeLocale === 'en' ? meta.name_en : meta.name_ru
				clusterIcon = meta.icon
			} else if (item.family) {
				clusterName = item.family.charAt(0).toUpperCase() + item.family.slice(1)
				clusterIcon = root?.icon || '🌳'
			} else {
				clusterName = getNodeName(root)
				clusterIcon = root?.icon || (props.type === 'fractions' ? '🏛️' : '🌳')
			}

			clusterMap.set(familyKey, {
				rootId: familyKey,
				rootName: clusterName,
				rootIcon: clusterIcon,
				nodes: []
			})
		}
		clusterMap.get(familyKey).nodes.push(item)
	}

	const clusters = []

	for (const [clusterId, cData] of clusterMap.entries()) {
		const clusterNodes = cData.nodes
		const clusterNodeIds = new Set(clusterNodes.map((n) => n.id))

		// Identify branch roots within this cluster
		// A node is a branch root if it has no parents or none of its parents are in this cluster
		const branchRoots = clusterNodes.filter((node) => {
			const pids = getParentIds(node)
			return pids.length === 0 || !pids.some((pid) => clusterNodeIds.has(pid))
		})

		// If no root found (e.g. cycle), fallback to first node
		if (branchRoots.length === 0 && clusterNodes.length > 0) {
			branchRoots.push(clusterNodes[0])
		}

		// Sort branch roots: by lvl_min, tier, then name
		branchRoots.sort((a, b) => (a.lvl_min || 0) - (b.lvl_min || 0) || getNodeName(a).localeCompare(getNodeName(b)))

		// Map each branch root to its members
		const branchMap = new Map()
		for (const r of branchRoots) {
			branchMap.set(r.id, {
				root: r,
				nodes: [r]
			})
		}

		const assignedNodeIds = new Set(branchRoots.map((r) => r.id))

		// BFS to assign descendants to their branch
		const queue = branchRoots.map((r) => ({ node: r, branchRootId: r.id }))
		while (queue.length > 0) {
			const { node, branchRootId } = queue.shift()
			for (const item of clusterNodes) {
				if (!assignedNodeIds.has(item.id)) {
					const pids = getParentIds(item)
					if (pids.includes(node.id)) {
						assignedNodeIds.add(item.id)
						branchMap.get(branchRootId).nodes.push(item)
						queue.push({ node: item, branchRootId })
					}
				}
			}
		}

		// Any unassigned nodes form their own branch
		for (const item of clusterNodes) {
			if (!assignedNodeIds.has(item.id)) {
				assignedNodeIds.add(item.id)
				branchMap.set(item.id, {
					root: item,
					nodes: [item]
				})
			}
		}

		// Build tree structures with 2D Column-Slot Grid layout
		const trees = []
		for (const [bRootId, bData] of branchMap.entries()) {
			const bNodes = bData.nodes
			const bRoot = bData.root
			const bNodeIds = new Set(bNodes.map((n) => n.id))

			// Helper to get children of a node within this tree
			function getTreeChildren(nodeId) {
				const children = bNodes.filter((n) => {
					const pids = getParentIds(n)
					// Match primary parent in this tree
					const firstTreeParent = pids.find((p) => bNodeIds.has(p))
					return firstTreeParent === nodeId
				})
				children.sort(
					(a, b) =>
						(a.lvl_min || 0) - (b.lvl_min || 0) ||
						getNodeName(a).localeCompare(getNodeName(b))
				)
				return children
			}

			// 1. Calculate subtree width recursively
			const subtreeWidthMap = new Map()
			function calcSubtreeWidth(nodeId, visited = new Set()) {
				if (visited.has(nodeId)) return 1
				visited.add(nodeId)
				const children = getTreeChildren(nodeId)
				if (children.length === 0) {
					subtreeWidthMap.set(nodeId, 1)
					return 1
				}
				let sum = 0
				for (const ch of children) {
					sum += calcSubtreeWidth(ch.id, new Set(visited))
				}
				const w = Math.max(sum, 1)
				subtreeWidthMap.set(nodeId, w)
				return w
			}
			calcSubtreeWidth(bRoot.id)

			// 2. Assign column slot ranges [colStart, colEnd] recursively
			const layoutMap = new Map()
			function assignColumnSlots(nodeId, startCol, visited = new Set()) {
				if (visited.has(nodeId)) return
				visited.add(nodeId)
				const children = getTreeChildren(nodeId)
				if (children.length === 0) {
					layoutMap.set(nodeId, {
						colStart: startCol,
						colEnd: startCol,
						width: 1
					})
					return
				}
				let curr = startCol
				for (const ch of children) {
					const w = subtreeWidthMap.get(ch.id) || 1
					assignColumnSlots(ch.id, curr, new Set(visited))
					curr += w
				}
				layoutMap.set(nodeId, {
					colStart: startCol,
					colEnd: curr - 1,
					width: curr - startCol
				})
			}
			assignColumnSlots(bRoot.id, 0)

			// Assign any unconnected nodes
			let nextFreeCol = (layoutMap.get(bRoot.id)?.colEnd ?? -1) + 1
			for (const n of bNodes) {
				if (!layoutMap.has(n.id)) {
					layoutMap.set(n.id, {
						colStart: nextFreeCol,
						colEnd: nextFreeCol,
						width: 1
					})
					nextFreeCol++
				}
			}

			// Total columns for this tree
			const totalCols = Math.max(
				...Array.from(layoutMap.values()).map((v) => v.colEnd + 1),
				1
			)

			// Max tier in this tree
			const maxTier = Math.max(...bNodes.map(getNodeTier), 0)
			const totalRows = maxTier + 1

			// Enrich nodes with layout coordinates
			const enrichedNodes = bNodes.map((node) => {
				const slot = layoutMap.get(node.id) || { colStart: 0, colEnd: 0, width: 1 }
				const tierNum = getNodeTier(node)
				const gridRow = maxTier - tierNum + 1
				return {
					...node,
					tierNum,
					colStart: slot.colStart,
					colEnd: slot.colEnd,
					colWidth: slot.width,
					gridRow,
					gridColumn: `${slot.colStart + 1} / ${slot.colEnd + 2}`
				}
			})

			trees.push({
				treeId: bRootId,
				rootName: getNodeName(bRoot),
				rootIcon: bRoot.icon || defaultIcon.value,
				totalMembers: bNodes.length,
				totalCols,
				totalRows,
				nodes: enrichedNodes
			})
		}

		clusters.push({
			rootId: clusterId,
			rootName: cData.rootName,
			rootIcon: cData.rootIcon,
			totalMembers: cData.nodes.length,
			trees
		})
	}

	// Sort clusters: larger clusters first, then alphabetically
	clusters.sort((a, b) => b.totalMembers - a.totalMembers || a.rootName.localeCompare(b.rootName))

	return clusters
})

const displayedTreesCount = computed(() => treeClusters.value.length)
const filteredEntitiesCount = computed(() => categoryFilteredEntities.value.length)

// Child counter with multi-parent support
function getChildCount(parentId) {
	return props.items.filter((item) => getParentIds(item).includes(parentId)).length
}

// Localized name helper
function getNodeName(node) {
	if (!node) return ''
	const loc = props.activeLocale
	const locObj = props.localesData?.[loc]?.[props.type]?.[node.id]
	if (locObj?.name) return locObj.name
	return node.name || node.id
}

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

const FACTION_TYPE_LABELS = {
	nation: 'Государство',
	guild: 'Гильдия',
	clan: 'Клан',
	religious: 'Религия',
	faction: 'Фракция',
	stronghold: 'Оплот',
	settlement: 'Поселение',
	syndicate: 'Синдикат',
	tribe: 'Племя'
}

function getFactionTypeLabel(type) {
	if (!type) return ''
	return FACTION_TYPE_LABELS[type] || type
}

function formatTierShort(nodeOrTier) {
	if (props.type === 'fractions') {
		const node = typeof nodeOrTier === 'object' ? nodeOrTier : entityMap.value.get(nodeOrTier)
		const tierVal = node?.grid_tier !== undefined && node?.grid_tier !== null && node?.grid_tier !== ''
			? Number(node.grid_tier)
			: (node ? calculateDepth(node) : 0)
		return ROMAN_NUMERALS[tierVal] || `${tierVal + 1}`
	}
	const tier = typeof nodeOrTier === 'string' ? nodeOrTier : nodeOrTier?.tier
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

function getTierLabel(nodeOrTier) {
	if (props.type === 'fractions') {
		const node = typeof nodeOrTier === 'object' ? nodeOrTier : entityMap.value.get(nodeOrTier)
		const tierVal = node?.grid_tier !== undefined && node?.grid_tier !== null && node?.grid_tier !== ''
			? Number(node.grid_tier)
			: (node ? calculateDepth(node) : 0)
		switch (tierVal) {
			case 0:
				return 'Уровень I (Верховная организация / Государство)'
			case 1:
				return 'Уровень II (Подразделение / База)'
			case 2:
				return 'Уровень III (Отряд / Внутренняя фракция)'
			default:
				return `Уровень ${tierVal + 1} (Спецгруппа / Секция)`
		}
	}
	const tier = typeof nodeOrTier === 'string' ? nodeOrTier : nodeOrTier?.tier
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

// Related nodes highlighting (ancestors + children) with multi-parent support
const relatedNodeIds = computed(() => {
	const set = new Set()
	if (!hoveredNodeId.value) return set

	const hovered = entityMap.value.get(hoveredNodeId.value)
	if (!hovered) return set

	// Add ancestors (queue-based BFS to traverse all parents)
	const queue = [hovered]
	const visitedAncestors = new Set([hovered.id])
	while (queue.length > 0) {
		const curr = queue.shift()
		const pids = getParentIds(curr)
		for (const pid of pids) {
			if (!visitedAncestors.has(pid)) {
				visitedAncestors.add(pid)
				set.add(pid)
				const p = entityMap.value.get(pid)
				if (p) queue.push(p)
			}
		}
	}

	// Add direct children
	for (const item of props.items) {
		const pids = getParentIds(item)
		if (pids.includes(hovered.id)) {
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
		const parentIds = getParentIds(item)
		if (parentIds.length === 0) continue

		const childEl = nodeElementsMap.get(item.id)
		if (!childEl) continue

		for (const pid of parentIds) {
			const parentEl = nodeElementsMap.get(pid)
			if (!parentEl) continue

			const childRect = childEl.getBoundingClientRect()
			const parentRect = parentEl.getBoundingClientRect()

			// Coordinates unscaled relative to zoom content container
			const pX = (parentRect.left + parentRect.width / 2 - containerRect.left) / currentZoom
			const pY = (parentRect.top - containerRect.top) / currentZoom // Top center of parent

			const cX = (childRect.left + childRect.width / 2 - containerRect.left) / currentZoom
			const cY = (childRect.bottom - containerRect.top) / currentZoom // Bottom center of child

			// Connection curve from parent (bottom) to child (top)
			const deltaY = Math.abs(pY - cY)
			const curveOffset = Math.max(deltaY * 0.45, 25)

			let d = ''
			if (Math.abs(pX - cX) < 2) {
				// Pure vertical line when parent and child are aligned in same column
				d = `M ${pX} ${pY} L ${cX} ${cY}`
			} else {
				d = `M ${pX} ${pY} C ${pX} ${pY - curveOffset}, ${cX} ${cY + curveOffset}, ${cX} ${cY}`
			}

			lines.push({
				key: `${pid}->${item.id}`,
				parentId: pid,
				childId: item.id,
				d,
				isActive: false
			})
		}
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
		const delta = e.deltaY < 0 ? 0.08 : -0.08
		zoomScale.value = Math.min(Math.max(zoomScale.value + delta, 0.45), 2.0)
		nextTick(() => recalculateConnectors())
	} else if (e.shiftKey && scrollContainerRef.value && e.deltaY) {
		scrollContainerRef.value.scrollLeft += e.deltaY
	}
}

function onPanStart(e) {
	if (e.button !== 0 && e.button !== 1) return
	// Ignore if clicked directly on an interactive element (cards, buttons, inputs)
	const isInteractive = e.target && e.target.closest && e.target.closest(
		'.tree-node-card, button, input, textarea, select, a, .node-hover-actions'
	)
	if (isInteractive) return

	isPanning.value = true
	panStart.x = e.clientX
	panStart.y = e.clientY
	if (scrollContainerRef.value) {
		scrollStart.left = scrollContainerRef.value.scrollLeft
		scrollStart.top = scrollContainerRef.value.scrollTop
	}

	window.addEventListener('mousemove', onPanMove)
	window.addEventListener('mouseup', onPanEnd)
	e.preventDefault()
}

function onPanMove(e) {
	if (!isPanning.value || !scrollContainerRef.value) return
	const dx = e.clientX - panStart.x
	const dy = e.clientY - panStart.y
	scrollContainerRef.value.scrollLeft = scrollStart.left - dx
	scrollContainerRef.value.scrollTop = scrollStart.top - dy
}

function onPanEnd() {
	if (isPanning.value) {
		isPanning.value = false
		window.removeEventListener('mousemove', onPanMove)
		window.removeEventListener('mouseup', onPanEnd)
	}
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
	window.removeEventListener('mousemove', onPanMove)
	window.removeEventListener('mouseup', onPanEnd)
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

.__theme-fractions-nation {
	background: radial-gradient(circle at 50% 100%, #1c1808 0%, #100e05 60%, #080702 100%);
}

.__theme-fractions-guild {
	background: radial-gradient(circle at 50% 100%, #1e0d16 0%, #12070d 60%, #090306 100%);
}

.__theme-fractions-clan {
	background: radial-gradient(circle at 50% 100%, #140d24 0%, #0b0716 60%, #05030c 100%);
}

.__theme-fractions-religious {
	background: radial-gradient(circle at 50% 100%, #201a0a 0%, #130f06 60%, #090702 100%);
}

.__theme-fractions-all {
	background: radial-gradient(circle at 50% 100%, #111622 0%, #090d14 60%, #04060a 100%);
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
	z-index: 3;
}

.tree-connector-path {
	fill: none;
	stroke: #64748b;
	stroke-width: 0.18em;
	stroke-linecap: round;
	shape-rendering: geometricPrecision;
	transition: stroke 0.2s, stroke-width 0.2s, opacity 0.2s;
}

.tree-connector-path.__active {
	stroke: #fbbf24;
	stroke-width: 0.25em;
	filter: drop-shadow(0 0 0.25em rgba(251, 191, 36, 0.7));
}

.tree-connector-path.__dimmed {
	opacity: 0.2;
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
	position: relative;
	z-index: 1;
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

/* Horizontal Trees Row inside Family Cluster */
.cluster-branches-row {
	display: flex;
	align-items: flex-end;
	gap: 2.5em;
}

.cluster-branch-lane {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.cluster-branch-lane.__has-sibling-branches:not(:last-child) {
	border-right: 1px dashed rgba(255, 255, 255, 0.1);
	padding-right: 2em;
}

.branch-lane-header {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	padding: 0.25em 0.6em;
	margin-bottom: 1.25em;
	font-size: 0.8em;
	font-weight: 600;
	color: #94a3b8;
	max-width: 14em;
}

.branch-lane-icon {
	font-size: 1.15em;
}

.branch-lane-title {
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

/* 2D CSS Grid for Tree (Generous 4.5em row gap for beautiful arcs) */
.tree-grid-canvas {
	display: grid;
	row-gap: 4.5em;
	column-gap: 1.25em;
	align-items: center;
	justify-items: center;
}

.tree-grid-cell {
	display: flex;
	justify-content: center;
	align-items: center;
	width: 100%;
}

/* Skill-like Square Node */
.tree-node-wrapper {
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;
	position: relative;
	z-index: 4;
	user-select: none;
	width: 6.8em;
	transition: transform 0.15s ease;
}

.tree-node-wrapper:hover {
	transform: translateY(-0.2em);
}

.tree-node-square {
	width: 4.8em;
	height: 4.8em;
	background: rgba(20, 26, 38, 0.95);
	border: 2px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.65em;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 0.35em 1.2em rgba(0, 0, 0, 0.4);
	transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

/* Tier border and glow accents */
.tree-node-square.__tier-basic {
	border-color: rgba(148, 163, 184, 0.4);
}

.tree-node-square.__tier-advanced {
	border-color: rgba(56, 189, 248, 0.6);
	box-shadow: 0 0 0.8em rgba(56, 189, 248, 0.2);
}

.tree-node-square.__tier-rare {
	border-color: rgba(245, 158, 11, 0.7);
	box-shadow: 0 0 1em rgba(245, 158, 11, 0.25);
}

/* Selected state */
.tree-node-wrapper.__selected .tree-node-square {
	border-color: #f59e0b;
	box-shadow: 0 0 1.2em rgba(245, 158, 11, 0.6), inset 0 0 0.5em rgba(245, 158, 11, 0.25);
	outline: 2px solid #f8fafc;
	outline-offset: 0.15em;
}

/* Related highlight */
.tree-node-wrapper.__related .tree-node-square {
	border-color: rgba(245, 158, 11, 0.8);
	box-shadow: 0 0 0.8em rgba(245, 158, 11, 0.4);
}

/* Search highlight */
.tree-node-wrapper.__highlighted .tree-node-square {
	outline: 2px solid #10b981;
	outline-offset: 0.15em;
}

.node-main-icon {
	font-size: 1.85em;
	line-height: 1;
	user-select: none;
}

.node-tier-badge {
	position: absolute;
	top: 0.25em;
	left: 0.25em;
	font-size: 0.65em;
	font-weight: 700;
	padding: 0.05em 0.35em;
	border-radius: 0.25em;
	background: rgba(0, 0, 0, 0.5);
	color: #94a3b8;
	border: 1px solid rgba(255, 255, 255, 0.1);
	line-height: 1.2;
}

.tree-node-square.__tier-advanced .node-tier-badge {
	color: #7dd3fc;
	border-color: rgba(56, 189, 248, 0.3);
}

.tree-node-square.__tier-rare .node-tier-badge {
	color: #facc15;
	border-color: rgba(234, 179, 8, 0.3);
}

.node-child-badge {
	position: absolute;
	bottom: 0.25em;
	right: 0.25em;
	font-size: 0.65em;
	font-weight: 700;
	color: #38bdf8;
	background: rgba(15, 23, 42, 0.7);
	padding: 0.05em 0.3em;
	border-radius: 0.25em;
	border: 1px solid rgba(56, 189, 248, 0.3);
	line-height: 1.2;
}

.node-name-under {
	margin-top: 0.45em;
	font-size: 0.82em;
	font-weight: 700;
	color: #f1f5f9;
	text-align: center;
	line-height: 1.2;
	max-width: 7.2em;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
}

.node-id-under {
	margin-top: 0.15em;
	font-size: 0.65em;
	font-family: monospace;
	color: #64748b;
	text-align: center;
	max-width: 7.5em;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.node-type-pill {
	display: inline-block;
	font-size: 0.62em;
	font-weight: 600;
	color: #38bdf8;
	background: rgba(56, 189, 248, 0.12);
	border: 1px solid rgba(56, 189, 248, 0.25);
	padding: 0.05em 0.4em;
	border-radius: 0.6em;
	margin-top: 0.2em;
	white-space: nowrap;
	max-width: 8em;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* Hover Actions Bar */
.node-hover-actions {
	position: absolute;
	top: -0.75em;
	right: -0.5em;
	display: none;
	gap: 0.25em;
	background: rgba(15, 20, 30, 0.95);
	backdrop-filter: blur(0.4em);
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 0.4em;
	padding: 0.15em;
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.5);
	z-index: 10;
}

.tree-node-wrapper:hover .node-hover-actions {
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
