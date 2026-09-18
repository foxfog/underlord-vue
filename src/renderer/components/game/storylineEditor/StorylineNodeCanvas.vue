<template>
	<div class="storyline-node-canvas-wrapper">
		<!-- Top Floating Controls Toolbar -->
		<div class="canvas-top-toolbar">
			<div class="toolbar-left">
				<div class="search-box">
					<span class="search-icon">🔍</span>
					<input
						v-model="searchQuery"
						type="text"
						placeholder="Поиск нод на графе..."
						class="search-input"
					/>
					<button
						v-if="searchQuery"
						type="button"
						class="search-clear"
						@click="searchQuery = ''"
					>
						✕
					</button>
				</div>

				<div class="stats-badge">
					{{ graphData.nodes.length }} шагов • {{ graphData.links.length }} связей
					<span v-if="loopCount > 0" class="loop-count-tag">
						• 🔁 {{ loopCount }} зацикливаний
					</span>
				</div>
			</div>

			<!-- Zoom Controls (Pan & Zoom) -->
			<div class="toolbar-right">
				<div class="zoom-group">
					<button
						type="button"
						class="zoom-btn"
						title="Уменьшить масштаб (Ctrl + Колёсико вниз)"
						@click="() => zoomOut()"
					>
						−
					</button>
					<button
						type="button"
						class="zoom-btn __label"
						title="Сбросить масштаб к 100%"
						@click="() => resetZoom()"
					>
						{{ Math.round(zoomScale * 100) }}%
					</button>
					<button
						type="button"
						class="zoom-btn"
						title="Увеличить масштаб (Ctrl + Колёсико вверх)"
						@click="() => zoomIn()"
					>
						+
					</button>
					<button
						type="button"
						class="zoom-btn __action"
						title="Показать всю схему целиком"
						@click="() => handleFitView()"
					>
						🗺️ Обзор
					</button>
					<button
						type="button"
						class="zoom-btn __action"
						title="Центрировать обзор на текущем шаге"
						@click="() => handleCenter()"
					>
						🎯 Центр
					</button>
				</div>
			</div>
		</div>

		<!-- Scrollable & Panning Canvas Area -->
		<div
			ref="scrollContainerRef"
			class="canvas-scroll-container"
			:class="{ '__is-panning': isPanning }"
			@mousedown="onPanStart"
			@wheel.passive="onWheel"
		>
			<div
				ref="zoomContentRef"
				class="canvas-zoom-content"
				:style="[
					zoomContentStyle,
					{
						width: `${canvasDimensions.width}px`,
						height: `${canvasDimensions.height}px`,
						top: `${contentTop}px`
					}
				]"
			>
				<!-- SVG Connectors Layer -->
				<svg
					v-if="connectorLines.length > 0"
					class="connectors-svg"
					:style="{ width: `${canvasDimensions.width}px`, height: `${canvasDimensions.height}px` }"
				>
					<defs>
						<!-- Standard Arrow Marker -->
						<marker
							id="node-arrow-seq"
							viewBox="0 0 12 12"
							:markerWidth="11 / svgScaleFactor"
							:markerHeight="11 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#94a3b8" />
						</marker>

						<!-- Choice Arrow Marker -->
						<marker
							id="node-arrow-choice"
							viewBox="0 0 12 12"
							:markerWidth="11 / svgScaleFactor"
							:markerHeight="11 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#fb923c" />
						</marker>

						<!-- Loop Arrow Marker -->
						<marker
							id="node-arrow-loop"
							viewBox="0 0 12 12"
							:markerWidth="12 / svgScaleFactor"
							:markerHeight="12 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#f43f5e" />
						</marker>

						<!-- Active Link Arrow Marker -->
						<marker
							id="node-arrow-active"
							viewBox="0 0 12 12"
							:markerWidth="12 / svgScaleFactor"
							:markerHeight="12 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#f6c445" />
						</marker>

						<!-- Inbound Link Arrow Marker -->
						<marker
							id="node-arrow-inbound"
							viewBox="0 0 12 12"
							:markerWidth="12 / svgScaleFactor"
							:markerHeight="12 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#a855f7" />
						</marker>

						<!-- Return Link Arrow Marker -->
						<marker
							id="node-arrow-return"
							viewBox="0 0 12 12"
							:markerWidth="12 / svgScaleFactor"
							:markerHeight="12 / svgScaleFactor"
							refX="10"
							refY="6"
							markerUnits="userSpaceOnUse"
							orient="auto"
						>
							<polygon points="1 2, 10.5 6, 1 10" fill="#2dd4bf" />
						</marker>
					</defs>

					<!-- Connector Paths -->
					<g v-for="link in connectorLines" :key="link.key">
						<!-- Background wide path for contrast and easy hover -->
						<path
							:d="link.d"
							class="link-path-bg"
							:style="{ strokeWidth: getBgStrokeWidth() }"
						/>
						<!-- Foreground Styled Path -->
						<path
							:d="link.d"
							class="link-path"
							:class="{
								'__seq': link.type === 'sequence',
								'__choice': link.type === 'choice' || link.type === 'choice-fallthrough' || link.type === 'choice-outbound',
								'__loop': link.isLoop,
								'__return': link.type === 'return',
								'__inbound': link.type === 'inbound' || link.type === 'goto-outbound',
								'__active': isLinkActive(link)
							}"
							:style="{
								strokeWidth: getFgStrokeWidth(link),
								strokeDasharray: (link.isLoop || link.type === 'inbound' || link.type === 'goto-outbound') ? getLoopDashArray() : undefined
							}"
							:marker-end="getMarkerUrl(link)"
						/>

						<!-- Link Condition/Choice Label with Pill Badge -->
						<g v-if="link.label && zoomScale >= 0.25" class="link-label-group">
							<title>{{ link.label }}</title>
							<rect
								:x="link.midX - getLabelPillWidth(link.label) / 2"
								:y="link.midY - 17"
								:width="getLabelPillWidth(link.label)"
								height="18"
								rx="4"
								class="link-label-pill"
								:class="{
									'__return-pill': link.type === 'return',
									'__inbound-pill': link.type === 'inbound' || link.type === 'goto-outbound',
									'__choice-pill': link.type.startsWith('choice')
								}"
							/>
							<text
								:x="link.midX"
								:y="link.midY - 4"
								text-anchor="middle"
								class="link-label"
								:class="{
									'__return-label': link.type === 'return',
									'__inbound-label': link.type === 'inbound' || link.type === 'goto-outbound'
								}"
							>
								{{ formatLinkLabel(link.label) }}
							</text>
						</g>
					</g>
				</svg>

				<!-- Nodes Layer -->
				<div class="nodes-container" :class="{ '__far-zoom': zoomScale < 0.25 }">
					<!-- Inbound Referrers (Incoming paths from other story scenarios) -->
					<div
						v-for="(inbound, inIdx) in inboundReferences"
						:key="'inbound_' + inIdx"
						:ref="(el) => registerInboundRef(inIdx, el)"
						class="flow-node __inbound-node"
						:style="{
							left: '4.5em',
							top: inboundNodeTopY(inIdx) + 'em',
							width: '18em'
						}"
					>
						<div class="node-header">
							<span class="inbound-badge">📥 ВХОДЯЩИЙ ПУТЬ</span>
							<span class="readonly-pill" title="Внешний сценарий, ссылающийся на данный файл">🔒 Только чтение</span>
						</div>
						<div class="node-body">
							<div class="inbound-source-info">
								<span class="inbound-file-label">📄 {{ inbound.sourceFileName }}</span>
								<span class="inbound-trigger-desc">
									{{ inbound.stepType === 'choice' ? `Шаг #${inbound.stepIndex + 1}: выбор "${inbound.optionText}"` : `Шаг #${inbound.stepIndex + 1}: goto ${inbound.target}` }}
								</span>
								<span v-if="inbound.condition" class="inbound-cond-tag">
									if: {{ inbound.condition }}
								</span>
							</div>
							<button
								type="button"
								class="inbound-jump-btn"
								:title="`Открыть ${inbound.sourceFileName} на шаге #${inbound.stepIndex + 1}`"
								@click.stop="emit('jump-scenario', inbound.sourceFile, inbound.stepIndex)"
							>
								↗ Открыть источник (шаг #{{ inbound.stepIndex + 1 }})
							</button>
						</div>
					</div>

					<!-- Outbound Nodes (External scenario exits / transition destinations) -->
					<div
						v-for="outNode in graphData.outboundNodes"
						:key="outNode.id"
						:ref="(el) => registerOutboundRef(outNode.id, el)"
						class="flow-node __outbound-node"
						:style="{
							left: (baseX + outNode.x) + 'em',
							top: (baseY + outNode.y) + 'em',
							width: outNode.width + 'em'
						}"
					>
						<div class="node-header">
							<span class="outbound-badge">📤 ВЫХОДНОЙ ПУТЬ</span>
							<span class="readonly-pill" title="Точка перехода в другой сценарий">🔒 Только чтение</span>
						</div>
						<div class="node-body">
							<div class="outbound-source-info">
								<span class="outbound-file-label">📄 {{ outNode.targetClean }}.json</span>
								<span
									class="outbound-trigger-desc"
									:title="outNode.optionText ? `Выбор: ${outNode.optionText}` : ''"
								>
									{{ outNode.optionText ? `Выбор "${outNode.optionText}" → goto ${outNode.targetClean}` : `Переход: goto ${outNode.targetClean}` }}
								</span>
								<span v-if="outNode.condition" class="outbound-cond-tag">
									if: {{ outNode.condition }}
								</span>
							</div>
							<button
								type="button"
								class="outbound-jump-btn"
								:title="`Открыть файл ${outNode.targetClean}.json в редакторе`"
								@click.stop="emit('jump-scenario', outNode.target)"
							>
								↗ Открыть файл ({{ outNode.targetClean }})
							</button>
						</div>
					</div>

					<!-- Storyline Nodes -->
					<div
						v-for="node in graphData.nodes"
						:key="node.index"
						:ref="(el) => registerNodeRef(node.index, el)"
						class="flow-node"
						:class="{
							__active: activeIndex === node.index,
							__highlighted: isNodeHighlighted(node),
							__loop: node.isLoop,
							__portal: node.isExternalJump
						}"
						:style="{
							left: (baseX + node.x) + 'em',
							top: (baseY + node.y) + 'em',
							width: node.width + 'em'
						}"
						@click="emit('select-step', node.index)"
					>
						<!-- Node Header -->
						<div class="node-header">
							<span class="node-index">#{{ node.index + 1 }}</span>
							<span class="node-type-badge" :class="`__type-${node.type}`">
								{{ getStepIcon(node.step) }} {{ node.type }}
							</span>
							<span v-if="node.step.if || node.step.condition" class="node-cond-pill" :title="'if: ' + (node.step.if || node.step.condition)">
								if
							</span>
						</div>

						<!-- Node Content / Summary -->
						<div class="node-body">
							<div class="node-summary-text" :title="getSummaryFn(node.step)">
								{{ getSummaryFn(node.step) }}
							</div>

							<!-- Special: Choice Options List in Node -->
							<div v-if="node.isChoice && node.choiceBranches.length > 0" class="node-choice-options">
								<div
									v-for="(b, bIdx) in node.choiceBranches"
									:key="bIdx"
									:ref="(el) => registerBranchRef(node.index, bIdx, el)"
									class="node-choice-branch"
									:title="b.text"
								>
									<span class="branch-arrow">↳</span>
									<span class="branch-text" :title="b.text">{{ b.text }}</span>
									<span v-if="b.externalReturnInfo" class="branch-return-tag" title="Сценарий возвращает управление (continue)">
										{{ b.externalReturnInfo.label }}
									</span>
									<button
										v-if="b.isExternal && b.target"
										type="button"
										class="branch-portal-btn"
										:title="'Перейти к сценарию ' + b.target"
										@click.stop="emit('jump-scenario', b.target)"
									>
										↗ {{ getCleanTarget(b.target) }}
									</button>
								</div>
							</div>

							<!-- Special: External Scenario Jump Portal (goto) -->
							<div v-if="node.isExternalJump && node.gotoTarget" class="node-portal-box">
								<span class="portal-icon">🚪</span>
								<div class="portal-details">
									<span class="portal-text">Файл: {{ getCleanTarget(node.gotoTarget) }}</span>
									<span v-if="node.externalReturnInfo" class="portal-return-badge" title="Этот сценарий возвращает управление (continue)">
										↳ {{ node.externalReturnInfo.label }}
									</span>
								</div>
								<button
									type="button"
									class="portal-jump-btn"
									title="Открыть файл этого сценария в редакторе"
									@click.stop="emit('jump-scenario', node.gotoTarget)"
								>
									↗ Открыть
								</button>
							</div>

							<!-- Special: Loop indicator -->
							<div v-if="node.isLoop" class="node-loop-box">
								<span class="loop-icon">🔁</span>
								<span>Зацикливание на шаг #{{ node.targetInternalIndex + 1 }}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useTreePanZoom } from '@/composables/useTreePanZoom'

const props = defineProps({
	steps: {
		type: Array,
		default: () => []
	},
	activeIndex: {
		type: Number,
		default: 0
	},
	inboundReferences: {
		type: Array,
		default: () => []
	},
	buildGraphFn: {
		type: Function,
		required: true
	},
	getSummaryFn: {
		type: Function,
		required: true
	},
	getStepIcon: {
		type: Function,
		required: true
	}
})

const emit = defineEmits(['select-step', 'jump-scenario'])

const scrollContainerRef = ref(null)
const zoomContentRef = ref(null)
const searchQuery = ref('')
const baseX = computed(() => (props.inboundReferences && props.inboundReferences.length > 0 ? 25.5 : 4.5))
const baseY = 30 // Base Y coordinate in em allowing upper branch headroom and vertical centering

const {
	zoomScale,
	isPanning,
	zoomContentStyle,
	setZoom,
	zoomIn,
	zoomOut,
	resetZoom,
	centerView: panZoomCenterView,
	onPanStart: handlePanStart,
	onWheel: handleWheel
} = useTreePanZoom({
	minZoom: 0.02,
	maxZoom: 2.0,
	initialZoom: 0.9,
	zoomStep: 0.15
})

const svgScaleFactor = computed(() => Math.min(1, zoomScale.value || 1))

const panY = ref(0)
const containerClientHeight = ref(800)
const isLocalDragging = ref(false)
let dragStartY = 0
let initialPanY = 0

// Dynamically compute the top offset for canvas-zoom-content so that the baseline
// row of nodes stays dead-centered vertically at any zoom level, while panY allows free vertical panning.
const contentTop = computed(() => {
	const clientH = containerClientHeight.value || 800
	const fontPx = parseFloat(getComputedStyle(zoomContentRef.value || document.documentElement).fontSize) || 16

	// Unscaled vertical center of the main baseline row
	const nodeCenterY_unscaled = (baseY + 3.5) * fontPx
	const renderedCenterY = nodeCenterY_unscaled * (zoomScale.value || 1)

	// Target: keep the baseline row at exactly clientH / 2 + panY
	const baseOffset = (clientH / 2) - renderedCenterY
	return Math.round(baseOffset + panY.value)
})

function formatLinkLabel(text, maxChars = 18) {
	if (!text) return ''
	const clean = String(text).trim()
	if (clean.length <= maxChars) return clean
	return clean.slice(0, maxChars - 1).trim() + '…'
}

function getLabelPillWidth(text, maxChars = 18) {
	const formatted = formatLinkLabel(text, maxChars)
	return Math.max(28, Math.round(formatted.length * 6.8 + 14))
}

/**
 * Вертикальная позиция i-го входящего нода.
 * Группа inbound-нодов центруется относительно baseY,
 * чтобы визуально соответствовать позиции основных шагов.
 */
function inboundNodeTopY(inIdx) {
	const n = props.inboundReferences?.length || 1
	const centerOffset = -((n - 1) * 11.5) / 2
	return baseY + centerOffset + inIdx * 11.5
}

function getBgStrokeWidth() {
	return 6 / svgScaleFactor.value
}

function getFgStrokeWidth(link) {
	const base = isLinkActive(link)
		? 3.5
		: link.isLoop
			? 2.5
			: link.type === 'return'
				? 2.6
				: link.type === 'inbound'
					? 2.4
					: link.type === 'choice'
						? 2.4
						: 2.2
	return base / svgScaleFactor.value
}

function getLoopDashArray() {
	const dash = 6 / svgScaleFactor.value
	const gap = 4 / svgScaleFactor.value
	return `${dash}, ${gap}`
}

function onPanStart(e) {
	if (e.button !== 0 && e.button !== 1) return
	const isInteractive = e.target?.closest?.(
		'.flow-node, button, input, textarea, select, a, .zoom-group, .inspector-panel, .node-choice-branch'
	)
	if (isInteractive) return

	isLocalDragging.value = true
	dragStartY = e.clientY
	initialPanY = panY.value

	handlePanStart(e, scrollContainerRef.value)

	const onMouseMove = (moveEvt) => {
		if (!isLocalDragging.value) return
		const dy = moveEvt.clientY - dragStartY
		panY.value = initialPanY + dy
	}

	const onMouseUp = () => {
		isLocalDragging.value = false
		window.removeEventListener('mousemove', onMouseMove)
		window.removeEventListener('mouseup', onMouseUp)
	}

	window.addEventListener('mousemove', onMouseMove)
	window.addEventListener('mouseup', onMouseUp)
}

function onWheel(e) {
	if (e.ctrlKey) {
		handleWheel(e, scrollContainerRef.value)
	} else if (e.shiftKey && scrollContainerRef.value && e.deltaY) {
		scrollContainerRef.value.scrollLeft += e.deltaY
	} else if (e.deltaY) {
		panY.value -= e.deltaY * 0.7
	}
}

// Graph topology
const graphData = computed(() => {
	return props.buildGraphFn(props.steps)
})

const loopCount = computed(() => {
	return graphData.value.links.filter((l) => l.isLoop).length
})

// DOM elements maps
const nodeElementsMap = new Map()
const branchElementsMap = new Map()
const inboundElementsMap = new Map()
const outboundElementsMap = new Map()

function registerNodeRef(idx, el) {
	if (el) {
		nodeElementsMap.set(idx, el)
	} else {
		nodeElementsMap.delete(idx)
	}
}

function registerBranchRef(nodeIdx, optIdx, el) {
	const key = `${nodeIdx}_${optIdx}`
	if (el) {
		branchElementsMap.set(key, el)
	} else {
		branchElementsMap.delete(key)
	}
}

function registerInboundRef(idx, el) {
	if (el) {
		inboundElementsMap.set(idx, el)
	} else {
		inboundElementsMap.delete(idx)
	}
}

function registerOutboundRef(id, el) {
	if (el) {
		outboundElementsMap.set(id, el)
	} else {
		outboundElementsMap.delete(id)
	}
}

const connectorLines = ref([])
const canvasDimensions = ref({ width: 2000, height: 1200 })

function recalculateConnectors() {
	if (!zoomContentRef.value) return

	const containerRect = zoomContentRef.value.getBoundingClientRect()
	const currentZoom = zoomScale.value || 1

	const nodes = graphData.value.nodes
	if (!nodes.length && !props.inboundReferences?.length && !graphData.value.outboundNodes?.length) {
		connectorLines.value = []
		return
	}

	let maxX = 0
	let maxY = 0

	for (const node of nodes) {
		const el = nodeElementsMap.get(node.index)
		if (el) {
			const rect = el.getBoundingClientRect()
			const relRight = (rect.right - containerRect.left) / currentZoom
			const relBottom = (rect.bottom - containerRect.top) / currentZoom
			if (relRight > maxX) maxX = relRight
			if (relBottom > maxY) maxY = relBottom
		}
	}

	for (const [_, el] of inboundElementsMap) {
		if (el) {
			const rect = el.getBoundingClientRect()
			const relRight = (rect.right - containerRect.left) / currentZoom
			const relBottom = (rect.bottom - containerRect.top) / currentZoom
			if (relRight > maxX) maxX = relRight
			if (relBottom > maxY) maxY = relBottom
		}
	}

	for (const [_, el] of outboundElementsMap) {
		if (el) {
			const rect = el.getBoundingClientRect()
			const relRight = (rect.right - containerRect.left) / currentZoom
			const relBottom = (rect.bottom - containerRect.top) / currentZoom
			if (relRight > maxX) maxX = relRight
			if (relBottom > maxY) maxY = relBottom
		}
	}

	if (maxX === 0) {
		const fontPx = parseFloat(getComputedStyle(zoomContentRef.value).fontSize) || 16
		maxX = ((baseX.value + nodes.length * 21) + 20) * fontPx
		maxY = (baseY + 30) * fontPx
	}

	canvasDimensions.value = {
		width: Math.max(maxX + 450, (scrollContainerRef.value?.clientWidth || 1000) / currentZoom + 300),
		height: Math.max(maxY + 700, (scrollContainerRef.value?.clientHeight || 800) / currentZoom + 600)
	}

	const lines = []

	// Inbound connectors from external scenarios to step 0
	if (props.inboundReferences?.length > 0 && nodes.length > 0) {
		const firstNodeEl = nodeElementsMap.get(0)
		props.inboundReferences.forEach((inbound, inIdx) => {
			const inEl = inboundElementsMap.get(inIdx)
			let startX, startY, endX, endY

			if (inEl && firstNodeEl) {
				const inRect = inEl.getBoundingClientRect()
				const targetRect = firstNodeEl.getBoundingClientRect()
				startX = (inRect.right - containerRect.left) / currentZoom
				startY = (inRect.top + inRect.height / 2 - containerRect.top) / currentZoom
				endX = (targetRect.left - containerRect.left) / currentZoom
				endY = (targetRect.top + targetRect.height / 2 - containerRect.top) / currentZoom
			} else {
				const fontPx = parseFloat(getComputedStyle(zoomContentRef.value).fontSize) || 16
				startX = (4.5 + 18) * fontPx
				const n = props.inboundReferences?.length || 1
				const inboundCenterOffset = -((n - 1) * 11.5) / 2
				startY = (baseY + inboundCenterOffset + inIdx * 11.5 + 3.5) * fontPx
				endX = baseX.value * fontPx
				endY = (baseY + 3.5) * fontPx
			}

			const dx = Math.abs(endX - startX)
			const cx1 = startX + Math.max(20, dx * 0.45)
			const cx2 = endX - Math.max(20, dx * 0.45)
			const d = `M ${startX} ${startY} C ${cx1} ${startY}, ${cx2} ${endY}, ${endX} ${endY}`
			const midPoint = { x: (startX + endX) / 2, y: (startY + endY) / 2 }

			lines.push({
				key: `inbound_${inIdx}_to_0`,
				type: 'inbound',
				isLoop: false,
				fromIndex: -1,
				toIndex: 0,
				label: inbound.condition ? `if: ${inbound.condition}` : 'вход',
				d,
				midX: midPoint.x,
				midY: midPoint.y
			})
		})
	}

	// Regular story links (sequential, goto, choice, loop, return, outbound)
	for (const link of graphData.value.links) {
		const fromEl = nodeElementsMap.get(link.fromIndex)
		const toEl = link.outboundId ? outboundElementsMap.get(link.outboundId) : nodeElementsMap.get(link.toIndex)

		let startX, startY, endX, endY

		if (fromEl && toEl) {
			const toRect = toEl.getBoundingClientRect()
			let fromRect = fromEl.getBoundingClientRect()

			if (link.optionIndex !== undefined) {
				const branchEl = branchElementsMap.get(`${link.fromIndex}_${link.optionIndex}`)
				if (branchEl) {
					fromRect = branchEl.getBoundingClientRect()
				}
			}

			startX = (fromRect.right - containerRect.left) / currentZoom
			startY = (fromRect.top + fromRect.height / 2 - containerRect.top) / currentZoom
			endX = (toRect.left - containerRect.left) / currentZoom
			endY = (toRect.top + toRect.height / 2 - containerRect.top) / currentZoom
		} else {
			const fontPx = parseFloat(getComputedStyle(zoomContentRef.value).fontSize) || 16
			const fromNode = nodes[link.fromIndex]
			const toNode = link.outboundId
				? (graphData.value.outboundNodes || []).find((o) => o.id === link.outboundId)
				: nodes[link.toIndex]
			if (!fromNode || !toNode) continue
			startX = (baseX.value + fromNode.x + fromNode.width) * fontPx
			startY = (baseY + (fromNode.y || 0) + (link.optionIndex !== undefined ? 2.0 + link.optionIndex * 1.5 : 3)) * fontPx
			endX = (baseX.value + toNode.x) * fontPx
			endY = (baseY + (toNode.y || 0) + 3) * fontPx
		}

		let d = ''
		let midPoint = { x: (startX + endX) / 2, y: (startY + endY) / 2 }

		if (link.isLoop) {
			// Backward loop: control points go straight up, no rightward swing that would cross adjacent nodes
			const arcOffset = 90 + Math.abs(startX - endX) * 0.18
			const cy = Math.min(startY, endY) - arcOffset
			d = `M ${startX} ${startY} C ${startX} ${cy}, ${endX} ${cy}, ${endX} ${endY}`
			midPoint = { x: (startX + endX) / 2, y: cy + 18 }
		} else if (link.type === 'return') {
			const arcOffset = 28
			const cy = Math.min(startY, endY) - arcOffset
			d = `M ${startX} ${startY} C ${startX + 20} ${cy}, ${endX - 20} ${cy}, ${endX} ${endY}`
			midPoint = { x: (startX + endX) / 2, y: cy - 6 }
		} else if (endY < startY - 80) {
			// Outbound node significantly above source row — arc goes UP first to avoid crossing right-side nodes
			const clearY = endY - 28
			d = `M ${startX} ${startY} C ${startX} ${clearY}, ${endX} ${clearY}, ${endX} ${endY}`
			midPoint = { x: (startX + endX) / 2, y: clearY + 14 }
		} else if (link.toIndex > link.fromIndex + 1) {
			// Long forward jump skipping steps: arc cleanly over or under intermediate nodes
			const arcOffset = 38 + Math.abs(endX - startX) * 0.05
			const isBottomOption = link.optionIndex !== undefined && link.optionIndex > 0
			const cy = isBottomOption ? Math.max(startY, endY) + arcOffset : Math.min(startY, endY) - arcOffset
			d = `M ${startX} ${startY} C ${startX + 30} ${cy}, ${endX - 30} ${cy}, ${endX} ${endY}`
			midPoint = { x: (startX + endX) / 2, y: cy + (isBottomOption ? -10 : 10) }
		} else {
			const dx = Math.abs(endX - startX)
			const cx1 = startX + Math.max(25, dx * 0.45)
			const cx2 = endX - Math.max(25, dx * 0.45)
			d = `M ${startX} ${startY} C ${cx1} ${startY}, ${cx2} ${endY}, ${endX} ${endY}`
			midPoint = { x: (startX + endX) / 2, y: (startY + endY) / 2 }
		}

		lines.push({
			key: link.key,
			type: link.type,
			isLoop: link.isLoop,
			fromIndex: link.fromIndex,
			toIndex: link.toIndex,
			outboundId: link.outboundId,
			label: link.label || link.condition || null,
			d,
			midX: midPoint.x,
			midY: midPoint.y
		})
	}

	connectorLines.value = lines
}

function handleFitView() {
	if (!scrollContainerRef.value || !graphData.value.nodes.length) return
	const container = scrollContainerRef.value
	const clientW = container.clientWidth
	const clientH = container.clientHeight
	if (clientW <= 0 || clientH <= 0) return

	const nodes = graphData.value.nodes
	const outbound = graphData.value.outboundNodes || []
	const fontPx = parseFloat(getComputedStyle(zoomContentRef.value || document.body).fontSize) || 16

	let maxNodeX = 0
	let minNodeY = 0
	let maxNodeY = 7.5
	for (const n of [...nodes, ...outbound]) {
		if (n.x + n.width > maxNodeX) maxNodeX = n.x + n.width
		if (n.y < minNodeY) minNodeY = n.y
		if (n.y + n.height > maxNodeY) maxNodeY = n.y + n.height
	}

	const totalW = (baseX.value + maxNodeX + 10) * fontPx
	const totalH = (baseY + maxNodeY - minNodeY + 15) * fontPx

	const scaleX = (clientW - 60) / totalW
	const scaleY = (clientH - 60) / totalH
	const optimalZoom = Math.max(0.02, Math.min(1.0, Math.min(scaleX, scaleY)))

	panY.value = 0
	setZoom(optimalZoom)
	nextTick(() => {
		container.scrollLeft = 0
		recalculateConnectors()
	})
}

function handleCenter(centerHorizontal = true) {
	if (!scrollContainerRef.value || !zoomContentRef.value) return
	const container = scrollContainerRef.value
	const containerRect = container.getBoundingClientRect()
	const targetIdx = props.activeIndex >= 0 ? props.activeIndex : 0
	const activeEl = nodeElementsMap.get(targetIdx) || nodeElementsMap.get(0)

	panY.value = 0 // Reset vertical pan to dead-center

	if (activeEl) {
		const nodeRect = activeEl.getBoundingClientRect()

		// Horizontal scroll: center horizontally if requested and not first node
		if (centerHorizontal && targetIdx > 0) {
			const offsetLeft = (nodeRect.left - containerRect.left) + container.scrollLeft
			container.scrollLeft = Math.max(0, offsetLeft - containerRect.width / 2 + (nodeRect.width / 2))
		} else if (!centerHorizontal || targetIdx === 0) {
			container.scrollLeft = 0
		}
	} else {
		container.scrollLeft = 0
	}
}

function getCleanTarget(target) {
	if (!target) return ''
	const parts = target.split('/')
	return parts[parts.length - 1].replace(/\.json$/, '')
}

function isNodeHighlighted(node) {
	if (!searchQuery.value.trim()) return false
	const q = searchQuery.value.toLowerCase().trim()
	const summary = props.getSummaryFn(node.step).toLowerCase()
	const typeStr = (node.type || '').toLowerCase()
	return summary.includes(q) || typeStr.includes(q) || `#${node.index + 1}`.includes(q)
}

function isLinkActive(link) {
	return props.activeIndex === link.fromIndex || props.activeIndex === link.toIndex
}

function getMarkerUrl(link) {
	if (isLinkActive(link)) return 'url(#node-arrow-active)'
	if (link.type === 'return') return 'url(#node-arrow-return)'
	if (link.type === 'inbound' || link.type === 'goto-outbound') return 'url(#node-arrow-inbound)'
	if (link.isLoop) return 'url(#node-arrow-loop)'
	if (link.type === 'choice' || link.type === 'choice-fallthrough' || link.type === 'choice-outbound') return 'url(#node-arrow-choice)'
	return 'url(#node-arrow-seq)'
}

let resizeObserver = null

watch(
	[() => props.steps, () => props.activeIndex, () => props.inboundReferences, zoomScale],
	() => {
		nextTick(() => {
			recalculateConnectors()
		})
	},
	{ deep: true }
)

onMounted(() => {
	if (scrollContainerRef.value) {
		containerClientHeight.value = scrollContainerRef.value.clientHeight
	}
	nextTick(() => {
		recalculateConnectors()
		setTimeout(() => {
			handleCenter(false) // Start at left, vertically centered
		}, 80)
	})

	if (typeof window !== 'undefined' && window.ResizeObserver && scrollContainerRef.value) {
		resizeObserver = new ResizeObserver(() => {
			if (scrollContainerRef.value) {
				containerClientHeight.value = scrollContainerRef.value.clientHeight
			}
			recalculateConnectors()
		})
		resizeObserver.observe(scrollContainerRef.value)
	}
})

onBeforeUnmount(() => {
	if (resizeObserver) {
		resizeObserver.disconnect()
	}
})
</script>

<style scoped>
.storyline-node-canvas-wrapper {
	position: relative;
	width: 100%;
	height: 100%;
	background: #090d16;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	font-family: inherit;
	color: #e2e8f0;
	box-sizing: border-box;
}

/* Floating Top Toolbar */
.canvas-top-toolbar {
	position: absolute;
	top: 0.8em;
	left: 1em;
	right: 1em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	z-index: 20;
	pointer-events: none;
}

.toolbar-left,
.toolbar-right {
	display: flex;
	align-items: center;
	gap: 0.6em;
	pointer-events: auto;
}

.search-box {
	position: relative;
	display: flex;
	align-items: center;
}

.search-icon {
	position: absolute;
	left: 0.6em;
	font-size: 0.85em;
	color: #94a3b8;
}

.search-input {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.4em 0.8em 0.4em 2em;
	font-size: 0.85em;
	color: #f8fafc;
	outline: none;
	width: 14em;
	backdrop-filter: blur(0.3em);
	box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.4);
	transition: border-color 0.2s;
}

.search-input:focus {
	border-color: #f6c445;
}

.search-clear {
	position: absolute;
	right: 0.6em;
	background: transparent;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.85em;
}

.stats-badge {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.4em 0.8em;
	font-size: 0.82em;
	color: #cbd5e1;
	backdrop-filter: blur(0.3em);
	box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.4);
}

.loop-count-tag {
	color: #f43f5e;
	font-weight: 700;
}

.zoom-group {
	display: flex;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	padding: 0.15em;
	backdrop-filter: blur(0.3em);
	box-shadow: 0 0.2em 0.8em rgba(0, 0, 0, 0.4);
}

.zoom-btn {
	background: transparent;
	border: none;
	color: #cbd5e1;
	padding: 0.3em 0.65em;
	font-size: 0.82em;
	cursor: pointer;
	border-radius: 0.3em;
	transition: background 0.15s;
}

.zoom-btn:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.zoom-btn.__label {
	font-family: Consolas, monospace;
	font-weight: 600;
	color: #f6c445;
	min-width: 3.5em;
	text-align: center;
}

.zoom-btn.__action {
	border-left: 1px solid rgba(255, 255, 255, 0.1);
}

/* Scroll Container */
.canvas-scroll-container {
	flex: 1;
	width: 100%;
	height: 100%;
	overflow-x: auto;
	overflow-y: hidden;
	cursor: grab;
	position: relative;
	background-color: #0b0f19;
	background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px);
	background-size: 1.5em 1.5em;
}

.canvas-scroll-container.__is-panning {
	cursor: grabbing;
	user-select: none;
}

.canvas-zoom-content {
	position: absolute;
	top: 0;
	left: 0;
	min-width: 100%;
	min-height: 100%;
}

/* SVG Layer */
.connectors-svg {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	z-index: 2;
}

.link-path-bg {
	fill: none;
	stroke: rgba(0, 0, 0, 0.8);
	stroke-width: 6;
}

.link-path {
	fill: none;
	stroke: #94a3b8;
	stroke-width: 2.2;
	transition: stroke 0.2s, stroke-width 0.2s;
}

.link-path.__choice {
	stroke: #fb923c;
	stroke-width: 2.4;
}

.link-path.__loop {
	stroke: #f43f5e;
	stroke-dasharray: 6, 4;
	stroke-width: 2.5;
}

.link-path.__return {
	stroke: #2dd4bf;
	stroke-width: 2.6;
}

.link-path.__inbound {
	stroke: #a855f7;
	stroke-dasharray: 6, 4;
	stroke-width: 2.4;
}

.link-path.__active {
	stroke: #f6c445;
	stroke-width: 3.2;
	filter: drop-shadow(0 0 0.3em rgba(246, 196, 69, 0.7));
}

.link-label-group {
	cursor: default;
}

.link-label-pill {
	fill: rgba(15, 23, 42, 0.92);
	stroke: rgba(148, 163, 184, 0.4);
	stroke-width: 1;
	pointer-events: all;
}

.link-label-pill.__choice-pill {
	stroke: rgba(251, 146, 60, 0.6);
	fill: rgba(30, 20, 15, 0.94);
}

.link-label-pill.__return-pill {
	stroke: rgba(45, 212, 191, 0.6);
	fill: rgba(13, 30, 30, 0.94);
}

.link-label-pill.__inbound-pill {
	stroke: rgba(168, 85, 247, 0.6);
	fill: rgba(30, 15, 45, 0.94);
}

.link-label {
	fill: #fbbf24;
	font-size: 0.72em;
	font-weight: 700;
	font-family: inherit;
	pointer-events: none;
}

.link-label.__return-label {
	fill: #2dd4bf;
}

.link-label.__inbound-label {
	fill: #d8b4fe;
}

/* Nodes Container */
.nodes-container {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 5;
}

.flow-node {
	position: absolute;
	background: rgba(18, 24, 38, 0.92);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.6em;
	box-sizing: border-box;
	cursor: pointer;
	user-select: none;
	box-shadow: 0 0.4em 1.2em rgba(0, 0, 0, 0.5);
	backdrop-filter: blur(0.3em);
	transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
	display: flex;
	flex-direction: column;
	gap: 0.4em;
}

.flow-node:hover {
	transform: translateY(-0.15em);
	border-color: rgba(255, 255, 255, 0.3);
}

.flow-node.__active {
	border-color: #f6c445;
	box-shadow: 0 0 1.2em rgba(246, 196, 69, 0.45);
	background: rgba(24, 32, 50, 0.96);
}

.flow-node.__highlighted {
	border-color: #38bdf8;
	box-shadow: 0 0 1em rgba(56, 189, 248, 0.4);
}

.flow-node.__loop {
	border-top: 2px solid #f43f5e;
}

.flow-node.__portal {
	border-right: 2px solid #38bdf8;
}

/* Enhancements for deep zoom-out / bird's-eye view */
.nodes-container.__far-zoom .flow-node {
	border-width: 0.12em;
	box-shadow: 0 0.4em 1.2em rgba(0, 0, 0, 0.8);
}

.nodes-container.__far-zoom .flow-node.__active {
	border-width: 0.22em;
	box-shadow: 0 0 2em rgba(246, 196, 69, 0.9), 0 0 0.8em #f6c445;
}

/* Node Header */
.node-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.4em;
}

.node-index {
	font-weight: 700;
	font-size: 0.82em;
	color: #94a3b8;
}

.flow-node.__active .node-index {
	color: #f6c445;
}

.node-type-badge {
	font-size: 0.72em;
	font-weight: 700;
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	text-transform: uppercase;
}

.node-type-badge.__type-dialogue {
	background: rgba(56, 189, 248, 0.2);
	color: #38bdf8;
}

.node-type-badge.__type-scene {
	background: rgba(168, 85, 247, 0.2);
	color: #c084fc;
}

.node-type-badge.__type-music,
.node-type-badge.__type-sound {
	background: rgba(34, 197, 94, 0.2);
	color: #4ade80;
}

.node-type-badge.__type-choice {
	background: rgba(249, 115, 22, 0.2);
	color: #fb923c;
}

.node-type-badge.__type-variable {
	background: rgba(234, 179, 8, 0.2);
	color: #facc15;
}

.node-cond-pill {
	background: rgba(99, 102, 241, 0.3);
	border: 1px solid rgba(99, 102, 241, 0.5);
	color: #a5b4fc;
	font-size: 0.68em;
	font-weight: 700;
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
	font-family: Consolas, monospace;
}

/* Node Body */
.node-body {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.node-summary-text {
	font-size: 0.82em;
	color: #e2e8f0;
	line-height: 1.35;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}

/* Choice Branches */
.node-choice-options {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	margin-top: 0.2em;
	padding-top: 0.3em;
	border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.node-choice-branch {
	display: flex;
	align-items: flex-start;
	gap: 0.3em;
	font-size: 0.76em;
	color: #cbd5e1;
}

.branch-arrow {
	color: #fb923c;
	font-weight: 700;
	margin-top: 0.1em;
}

.branch-text {
	flex: 1;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	line-height: 1.25;
	word-break: break-word;
}

.branch-portal-btn {
	background: rgba(56, 189, 248, 0.2);
	border: 1px solid rgba(56, 189, 248, 0.4);
	color: #38bdf8;
	border-radius: 0.25em;
	padding: 0.1em 0.4em;
	font-size: 0.72em;
	cursor: pointer;
	white-space: nowrap;
	transition: all 0.15s;
	margin-top: 0.1em;
}

.branch-portal-btn:hover {
	background: rgba(56, 189, 248, 0.35);
	color: #fff;
}

/* Portal Jump Box */
.node-portal-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(56, 189, 248, 0.12);
	border: 1px solid rgba(56, 189, 248, 0.3);
	border-radius: 0.35em;
	padding: 0.25em 0.5em;
	margin-top: 0.2em;
}

.portal-icon {
	font-size: 0.9em;
}

.portal-text {
	flex: 1;
	font-size: 0.78em;
	color: #38bdf8;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	font-family: Consolas, monospace;
}

.portal-jump-btn {
	background: #38bdf8;
	border: none;
	color: #0f172a;
	font-weight: 700;
	font-size: 0.72em;
	padding: 0.2em 0.5em;
	border-radius: 0.25em;
	cursor: pointer;
	transition: opacity 0.15s;
}

.portal-jump-btn:hover {
	opacity: 0.9;
}

/* Loop Indicator Box */
.node-loop-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(244, 63, 94, 0.15);
	border: 1px solid rgba(244, 63, 94, 0.3);
	border-radius: 0.35em;
	padding: 0.2em 0.5em;
	font-size: 0.74em;
	color: #fda4af;
}

.loop-icon {
	font-size: 0.9em;
}

/* Inbound Node Styles */
.flow-node.__inbound-node {
	background: rgba(30, 20, 50, 0.94);
	border: 2px dashed #a855f7;
	box-shadow: 0 0.4em 1.4em rgba(168, 85, 247, 0.25);
	cursor: default;
}

.flow-node.__inbound-node:hover {
	transform: none;
	border-color: #c084fc;
	box-shadow: 0 0.4em 1.6em rgba(168, 85, 247, 0.4);
}

.inbound-badge {
	font-size: 0.72em;
	font-weight: 700;
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	background: rgba(168, 85, 247, 0.3);
	color: #d8b4fe;
	letter-spacing: 0.04em;
}

.readonly-pill {
	font-size: 0.68em;
	color: #94a3b8;
	background: rgba(255, 255, 255, 0.06);
	padding: 0.1em 0.35em;
	border-radius: 0.25em;
}

.inbound-source-info {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.inbound-file-label {
	font-weight: 700;
	font-size: 0.88em;
	color: #f8fafc;
	font-family: Consolas, monospace;
}

.inbound-trigger-desc {
	font-size: 0.76em;
	color: #cbd5e1;
	line-height: 1.3;
}

.inbound-cond-tag {
	font-size: 0.68em;
	color: #a5b4fc;
	background: rgba(99, 102, 241, 0.2);
	border-radius: 0.2em;
	padding: 0.05em 0.3em;
	width: fit-content;
	font-family: Consolas, monospace;
}

.inbound-jump-btn {
	background: #a855f7;
	border: none;
	color: #fff;
	font-weight: 700;
	font-size: 0.75em;
	padding: 0.35em 0.6em;
	border-radius: 0.3em;
	cursor: pointer;
	margin-top: 0.3em;
	transition: all 0.15s;
	font-family: inherit;
	text-align: center;
}

.inbound-jump-btn:hover {
	background: #c084fc;
	box-shadow: 0 0 0.8em rgba(168, 85, 247, 0.6);
}

.portal-details {
	display: flex;
	flex-direction: column;
	flex: 1;
	overflow: hidden;
}

.portal-return-badge {
	font-size: 0.7em;
	color: #2dd4bf;
	font-weight: 700;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.branch-return-tag {
	font-size: 0.68em;
	color: #2dd4bf;
	font-weight: 700;
	background: rgba(45, 212, 191, 0.15);
	padding: 0.05em 0.3em;
	border-radius: 0.2em;
	white-space: nowrap;
}

/* Outbound Node Styles */
.flow-node.__outbound-node {
	background: rgba(30, 20, 50, 0.94);
	border: 2px dashed #a855f7;
	box-shadow: 0 0.4em 1.4em rgba(168, 85, 247, 0.25);
	cursor: default;
}

.flow-node.__outbound-node:hover {
	transform: none;
	border-color: #c084fc;
	box-shadow: 0 0.4em 1.6em rgba(168, 85, 247, 0.4);
}

.outbound-badge {
	font-size: 0.72em;
	font-weight: 700;
	padding: 0.15em 0.45em;
	border-radius: 0.3em;
	background: rgba(168, 85, 247, 0.3);
	color: #d8b4fe;
	letter-spacing: 0.04em;
}

.outbound-source-info {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.outbound-file-label {
	font-weight: 700;
	font-size: 0.88em;
	color: #f8fafc;
	font-family: Consolas, monospace;
}

.outbound-trigger-desc {
	font-size: 0.76em;
	color: #cbd5e1;
	line-height: 1.3;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
	word-break: break-word;
}

.outbound-cond-tag {
	font-size: 0.68em;
	color: #a5b4fc;
	background: rgba(99, 102, 241, 0.2);
	border-radius: 0.2em;
	padding: 0.05em 0.3em;
	width: fit-content;
	font-family: Consolas, monospace;
}

.outbound-jump-btn {
	background: #a855f7;
	border: none;
	color: #fff;
	font-weight: 700;
	font-size: 0.75em;
	padding: 0.35em 0.6em;
	border-radius: 0.3em;
	cursor: pointer;
	margin-top: 0.3em;
	transition: all 0.15s;
	font-family: inherit;
	text-align: center;
}

.outbound-jump-btn:hover {
	background: #c084fc;
	box-shadow: 0 0 0.8em rgba(168, 85, 247, 0.6);
}
</style>
