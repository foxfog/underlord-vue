<template>
	<div class="skill-tree-canvas-wrapper">
		<!-- Branch Filter Tabs & Zoom Controls Bar -->
		<div class="branches-bar">
			<div class="branches-tabs-list">
				<button
					type="button"
					class="branch-tab"
					:class="{ __active: selectedBranchId === 'all' }"
					@click="selectBranch('all')"
				>
					<span>Все ветки ({{ currentSkills.length }})</span>
				</button>
				<button
					v-for="b in currentBranches"
					:key="b.id"
					type="button"
					class="branch-tab"
					:class="{ __active: selectedBranchId === b.id }"
					@click="selectBranch(b.id)"
				>
					<span class="branch-icon">{{ b.icon || '🌿' }}</span>
					<span>{{ b.name }}</span>
					<span class="branch-count">{{ getSkillsInBranchCount(b.id) }}</span>
				</button>
			</div>

			<!-- Center/Right Toolbar Actions Slot (e.g. Search, strict toggle, reset) -->
			<div class="branches-actions-slot">
				<slot name="toolbar-actions"></slot>
			</div>

			<!-- Zoom Controls Group -->
			<div class="zoom-controls-group">
				<button
					type="button"
					class="zoom-btn"
					title="Уменьшить масштаб (Ctrl + Колёсико вниз)"
					@click="zoomOut()"
				>
					−
				</button>
				<button
					type="button"
					class="zoom-btn __label"
					title="Сбросить масштаб к 100%"
					@click="resetZoom()"
				>
					{{ Math.round(zoomScale * 100) }}%
				</button>
				<button
					type="button"
					class="zoom-btn"
					title="Увеличить масштаб (Ctrl + Колёсико вверх)"
					@click="zoomIn()"
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

		<!-- Main Workspace: Tier Grid and Inspector -->
		<div class="canvas-workspace">
			<!-- Visual Grid Canvas with SVG Bézier Connectors -->
			<div
				ref="scrollContainerRef"
				class="grid-canvas-container"
				:class="{ '__is-panning': isPanning }"
				@mousedown="onPanStart"
				@wheel.passive="onWheel"
			>
				<div
					v-if="gridData.tiers.length > 0"
					ref="canvasInnerRef"
					class="tree-canvas-inner"
					:style="zoomContentStyle"
				>
					<!-- SVG Connectors Layer -->
					<svg class="tree-connectors-svg">
						<defs>
							<marker
								id="arrow-learned"
								:viewBox="TREE_MARKER_CONFIG.viewBox"
								:markerWidth="TREE_MARKER_CONFIG.markerWidth"
								:markerHeight="TREE_MARKER_CONFIG.markerHeight"
								:refX="TREE_MARKER_CONFIG.refX"
								:refY="TREE_MARKER_CONFIG.refY"
								:markerUnits="TREE_MARKER_CONFIG.markerUnits"
								:orient="TREE_MARKER_CONFIG.orient"
							>
								<polygon :points="TREE_MARKER_CONFIG.points" fill="#f6c445" />
							</marker>
							<marker
								id="arrow-available"
								:viewBox="TREE_MARKER_CONFIG.viewBox"
								:markerWidth="TREE_MARKER_CONFIG.markerWidth"
								:markerHeight="TREE_MARKER_CONFIG.markerHeight"
								:refX="TREE_MARKER_CONFIG.refX"
								:refY="TREE_MARKER_CONFIG.refY"
								:markerUnits="TREE_MARKER_CONFIG.markerUnits"
								:orient="TREE_MARKER_CONFIG.orient"
							>
								<polygon :points="TREE_MARKER_CONFIG.points" fill="#10b981" />
							</marker>
							<marker
								id="arrow-locked"
								:viewBox="TREE_MARKER_CONFIG.viewBox"
								:markerWidth="TREE_MARKER_CONFIG.markerWidth"
								:markerHeight="TREE_MARKER_CONFIG.markerHeight"
								:refX="TREE_MARKER_CONFIG.refX"
								:refY="TREE_MARKER_CONFIG.refY"
								:markerUnits="TREE_MARKER_CONFIG.markerUnits"
								:orient="TREE_MARKER_CONFIG.orient"
							>
								<polygon :points="TREE_MARKER_CONFIG.points" fill="#64748b" />
							</marker>
						</defs>

						<!-- Bézier Curves between Parent and Child skills -->
						<path
							v-for="line in computedConnectorLines"
							:key="line.key"
							:d="line.d"
							class="connector-curve"
							:class="line.classNames"
							:marker-end="line.markerEnd"
						/>
					</svg>

					<!-- Bottom-Up Tiers Container: Level 1 at bottom, higher levels ascending upwards -->
					<div class="bottom-up-tiers-wrapper">
						<div
							v-for="tier in displayTiers"
							:key="'tier-' + tier.level"
							class="tree-tier-section"
						>
							<!-- Subtle Dashed Divider Line Between Levels with Level Unlock Button -->
							<div class="level-dashed-divider">
								<span class="ldd-line"></span>

								<!-- Level Already Unlocked -->
								<div
									v-if="entityLevel >= tier.level"
									class="ldd-badge __unlocked"
									:title="`Уровень ${tier.level} открыт`"
								>
									<span class="ldd-icon">🔓</span>
									<span class="ldd-text">Уровень {{ tier.level }}</span>
									<span class="ldd-tag-status">✔ Открыт</span>
								</div>

								<!-- Next Level: Interactive Unlock Button -->
								<button
									v-else-if="tier.level === entityLevel + 1 && showUnlockButton"
									type="button"
									class="ldd-unlock-btn"
									:class="{ __disabled: !computedCanUnlockLevel.canLevelUp }"
									:disabled="!computedCanUnlockLevel.canLevelUp"
									:title="computedCanUnlockLevel.reasons.join('; ')"
									@click="$emit('unlock-level', tier.level)"
								>
									<span class="lub-icon">🔓</span>
									<span class="lub-text">Открыть уровень {{ tier.level }}</span>
									<span class="lub-cost-pill">{{ unlockCostLabel }}</span>
								</button>

								<!-- Further Locked Level -->
								<div
									v-else
									class="ldd-badge __locked"
									:title="`Сначала откройте уровень ${tier.level - 1}`"
								>
									<span class="ldd-icon">🔒</span>
									<span class="ldd-text">Уровень {{ tier.level }}</span>
									<span class="ldd-sub">(треб. ур. {{ tier.level }})</span>
								</div>

								<span class="ldd-line"></span>
							</div>

							<!-- Grid of Skill Nodes -->
							<div
								class="tier-cells-grid"
								:style="{ gridTemplateColumns: `repeat(${gridData.maxCols}, minmax(6.5em, 8em))` }"
							>
								<div
									v-for="(slot, colIdx) in tier.cells"
									:key="'slot-' + tier.level + '-' + colIdx"
									class="tier-grid-slot"
								>
									<!-- Square Skill Node Item -->
									<div
										v-if="slot"
										class="skill-node-wrapper"
										:class="[getNodeClass(slot), `__cat-${slot.category || 'active'}`]"
										:data-skill-id="slot.id"
										@click="selectSkill(slot.id)"
										@dblclick="handleDoubleClick(slot)"
									>
										<!-- Main Square Box: ONLY icon inside, category icon in corner, border with category color -->
										<div
											class="skill-square-box"
											:data-skill-id="slot.id"
											:style="{
												borderColor: getCategoryBadge(slot.category).color,
												'--cat-color': getCategoryBadge(slot.category).color,
												'--cat-glow-color': getCategoryBadge(slot.category).color
											}"
										>
											<!-- Category Icon in top corner -->
											<span
												class="skill-cat-icon"
												:title="getCategoryBadge(slot.category).label"
											>
												{{ getCategoryBadge(slot.category).icon }}
											</span>

											<!-- Main Skill Icon -->
											<span class="skill-main-icon">{{ slot.icon || '⚔️' }}</span>

											<!-- Learned Checkmark Overlay -->
											<span v-if="getSkillRank(slot.id) > 0" class="skill-learned-check">
												{{ slot.max_level && slot.max_level > 1 ? getSkillRank(slot.id) : '✔' }}
											</span>
										</div>

										<!-- Skill Name Under the Square (same category color) -->
										<div
											class="skill-name-under"
											:style="{ color: getCategoryBadge(slot.category).color }"
											:title="slot.name"
										>
											{{ slot.name }}
										</div>

										<!-- Compact Cost Badge Under Name -->
										<div v-if="slot.auto_unlock" class="skill-cost-badge __auto" title="Врождённая способность, открывается автоматически">
											⚡ Врождённый
										</div>
										<div v-else class="skill-cost-badge">
											{{ slot.cost }} {{ slot.cost_type === 'spell_point' ? '🔮 MP' : '⚔️ SP' }}
										</div>
									</div>

									<!-- Empty Grid Slot Placeholder -->
									<div v-else class="empty-square-placeholder"></div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div v-else class="empty-tree-message">
					<span class="etm-icon">🌱</span>
					<h3>Для этой сущности еще не настроены навыки</h3>
					<p>Откройте «Редактор данных» → вкладка «Классы» или «Расы», чтобы добавить первые ветки и навыки.</p>
				</div>
			</div>

			<!-- Right Inspector Drawer / Detail Panel -->
			<aside v-if="selectedSkill" class="skill-inspector-panel">
				<div class="inspector-header">
					<div class="ih-left">
						<div
							class="ih-square-preview"
							:style="{
								borderColor: getCategoryBadge(selectedSkill.category).color,
								boxShadow: getSkillRank(selectedSkill.id) > 0 ? `0 0 0.8em ${getCategoryBadge(selectedSkill.category).color}` : 'none'
							}"
						>
							<span class="ih-cat-icon">{{ getCategoryBadge(selectedSkill.category).icon }}</span>
							<span class="ih-icon">{{ selectedSkill.icon || '⚔️' }}</span>
							<span v-if="getSkillRank(selectedSkill.id) > 0" class="skill-learned-check">✔</span>
						</div>
						<div class="ih-info">
							<h3 class="ih-name" :style="{ color: getCategoryBadge(selectedSkill.category).color }">
								{{ selectedSkill.name }}
							</h3>
							<span class="ih-id">ID: {{ selectedSkill.id }}</span>
						</div>
					</div>
					<button type="button" class="ih-close-btn" @click="selectSkill(null)">✕</button>
				</div>

				<div class="inspector-body">
					<!-- Status Banner -->
					<div
						class="inspector-status-banner"
						:class="{
							__learned: getSkillRank(selectedSkill.id) > 0,
							__auto: selectedSkill.auto_unlock,
							__available: getSkillRank(selectedSkill.id) === 0 && checkCanLearn(selectedSkill).canLearn,
							__locked: getSkillRank(selectedSkill.id) === 0 && !checkCanLearn(selectedSkill).canLearn
						}"
					>
						<span v-if="getSkillRank(selectedSkill.id) > 0">
							{{ selectedSkill.auto_unlock ? '🧬 Врождённый навык (активен)' : '🏆 Навык изучен' }}
						</span>
						<span v-else-if="selectedSkill.auto_unlock">⚡ Врождённый (откроется на ур. {{ selectedSkill.req_level }})</span>
						<span v-else-if="checkCanLearn(selectedSkill).canLearn">✨ Доступен для изучения</span>
						<span v-else>🔒 Требования не выполнены</span>
					</div>

					<!-- Skill Category Badge -->
					<div class="inspector-cat-box">
						<span class="icb-label">Категория:</span>
						<span class="node-cat-badge __lg" :class="`__cat-${selectedSkill.category || 'active'}`">
							{{ getCategoryBadge(selectedSkill.category).icon }} {{ getCategoryBadge(selectedSkill.category).label }}
						</span>
					</div>

					<!-- Requirements Status List -->
					<div class="inspector-reqs-card">
						<div class="req-title">Условия и требования:</div>

						<!-- Level requirement -->
						<div class="req-item" :class="{ __met: entityLevel >= selectedSkill.req_level || !isStrictMode }">
							<span class="req-icon">{{ (entityLevel >= selectedSkill.req_level || !isStrictMode) ? '✔' : '❌' }}</span>
							<span class="req-text">
								Уровень {{ entityTypeLabel }}: <strong>{{ selectedSkill.req_level }}</strong> (текущий: {{ entityLevel }})
							</span>
						</div>

						<!-- Parents requirement -->
						<div v-if="selectedSkill.parent_ids && selectedSkill.parent_ids.length > 0" class="req-parents-block">
							<div class="req-parents-header">
								<span class="rph-label">Предшествующие навыки:</span>
								<span class="rph-condition">
									({{ selectedSkill.parent_requirement === 'any' ? 'Хотя бы один - OR' : 'Все обязательны - AND' }})
								</span>
							</div>
							<div class="req-parents-list">
								<div
									v-for="pid in selectedSkill.parent_ids"
									:key="pid"
									class="req-parent-item"
									:class="{ __met: getSkillRank(pid) > 0 || !isStrictMode }"
								>
									<span class="rp-icon">{{ (getSkillRank(pid) > 0 || !isStrictMode) ? '✔' : '○' }}</span>
									<span class="rp-name">{{ getSkillName(pid) }}</span>
									<span class="rp-rank">({{ getSkillRank(pid) > 0 ? 'Изучен' : 'Не изучен' }})</span>
								</div>
							</div>
						</div>

						<!-- Cost and Currency breakdown -->
						<div v-if="selectedSkill.auto_unlock" class="req-item __met">
							<span class="req-icon">✔</span>
							<span class="req-text">
								Стоимость: <strong>0 SP (Врождённый навык)</strong>
							</span>
						</div>
						<div v-else class="req-item" :class="{ __met: totalAvailablePoints >= selectedSkill.cost || !isStrictMode }">
							<span class="req-icon">{{ (totalAvailablePoints >= selectedSkill.cost || !isStrictMode) ? '✔' : '❌' }}</span>
							<span class="req-text">
								Стоимость: <strong>{{ selectedSkill.cost }} {{ selectedSkill.cost_type === 'spell_point' ? '🔮 MP' : '⚔️ SP' }}</strong>
								(доступно: {{ totalAvailablePoints }})
							</span>
						</div>
					</div>

					<!-- Description -->
					<div v-if="selectedSkill.description" class="inspector-desc-box">
						<div class="idb-title">Описание:</div>
						<p class="idb-text">{{ selectedSkill.description }}</p>
					</div>

					<!-- Arbitrary JSON data preview -->
					<div v-if="selectedSkill.data && Object.keys(selectedSkill.data).length > 0" class="inspector-json-box">
						<div class="ijb-title">📦 Пользовательские данные (JSON Data):</div>
						<pre class="ijb-code">{{ JSON.stringify(selectedSkill.data, null, 2) }}</pre>
					</div>

					<!-- Upgrade / Learn block -->
					<div class="inspector-actions">
						<!-- Not learned yet -->
						<button
							v-if="getSkillRank(selectedSkill.id) === 0"
							type="button"
							class="action-btn __primary full-btn"
							:disabled="!canStudySkill(selectedSkill)"
							@click="triggerLearn(selectedSkill)"
						>
							➕ Изучить навык ({{ selectedSkill.cost }} {{ selectedSkill.cost_type === 'spell_point' ? 'MP' : 'SP' }})
						</button>

						<!-- Already learned: rank stepper & unlearn -->
						<template v-else>
							<div class="rank-stepper-panel">
								<div class="rank-stepper-left">
									<span class="rsp-label">Ранг навыка:</span>
									<span class="rsp-value">
										<strong>{{ getSkillRank(selectedSkill.id) }}</strong> / {{ selectedSkill.max_level || 1 }}
									</span>
								</div>
								<div class="rank-stepper-buttons">
									<button
										type="button"
										class="rsp-btn"
										title="Понизить ранг"
										:disabled="getSkillRank(selectedSkill.id) <= 1"
										@click="triggerUpgrade(selectedSkill, -1)"
									>
										-
									</button>
									<button
										type="button"
										class="rsp-btn"
										title="Повысить ранг"
										:disabled="getSkillRank(selectedSkill.id) >= (selectedSkill.max_level || 1)"
										@click="triggerUpgrade(selectedSkill, 1)"
									>
										+
									</button>
								</div>
							</div>

							<template v-if="!selectedSkill.auto_unlock">
								<button
									type="button"
									class="action-btn __secondary full-btn"
									@click="triggerDowngradeOrUnlearn(selectedSkill)"
								>
									➖ {{ getSkillRank(selectedSkill.id) > 1 ? 'Понизить ранг' : 'Забыть навык' }}
								</button>

								<button
									v-if="getSkillRank(selectedSkill.id) > 1"
									type="button"
									class="action-btn __danger full-btn"
									@click="triggerUnlearn(selectedSkill)"
								>
									🗑️ Забыть полностью
								</button>
							</template>
							<div v-else class="innate-locked-hint">
								🔒 Врождённый навык привязан к сущности и не может быть сброшен
							</div>
						</template>

						<!-- Error explanation if cannot upgrade -->
						<div
							v-if="getUpgradeReasons(selectedSkill).length > 0 && getSkillRank(selectedSkill.id) === 0 && isStrictMode"
							class="upgrade-reasons-list"
						>
							<div
								v-for="(r, idx) in getUpgradeReasons(selectedSkill)"
								:key="idx"
								class="reason-item"
							>
								⚠️ {{ r }}
							</div>
						</div>
					</div>
				</div>
			</aside>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useTreePanZoom } from '@/composables/useTreePanZoom'
import { buildBottomUpConnectorPath, TREE_MARKER_CONFIG } from '@/utils/treeConnectors'
import {
	normalizeSkill,
	normalizeSkillBranch,
	organizeSkillsByGrid,
	canLearnSkill,
	getCategoryMeta,
	getAvailableSkillPoints,
	resolveEntitySkills
} from '@/utils/skillTree'
import { useDataEditor } from '@/composables/useDataEditor'

const props = defineProps({
	entity: {
		type: Object,
		default: null
	},
	entityType: {
		type: String,
		default: 'classes' // 'classes' | 'races'
	},
	entityLevel: {
		type: Number,
		default: 1
	},
	entityMaxLevel: {
		type: Number,
		default: 15
	},
	character: {
		type: Object,
		default: () => ({})
	},
	isStrictMode: {
		type: Boolean,
		default: true
	},
	canLevelUpStatus: {
		type: Object,
		default: null
	},
	unlockCostLabel: {
		type: String,
		default: '-1 ур.'
	},
	showUnlockButton: {
		type: Boolean,
		default: true
	},
	allKnownSkills: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits([
	'select-skill',
	'learn-skill',
	'upgrade-skill',
	'downgrade-skill',
	'unlearn-skill',
	'unlock-level',
	'reset-skills'
])

const scrollContainerRef = ref(null)
const canvasInnerRef = ref(null)
const selectedBranchId = ref('all')
const selectedSkillId = ref(null)
const computedConnectorLines = ref([])
let resizeObserver = null

const {
	zoomScale,
	isPanning,
	zoomContentStyle,
	zoomIn,
	zoomOut,
	resetZoom,
	centerView: panZoomCenterView,
	onPanStart: handlePanStart,
	onWheel: handleWheel
} = useTreePanZoom({
	onZoomChange: () => updateConnectors()
})

function centerView() {
	panZoomCenterView(scrollContainerRef.value, canvasInnerRef.value, { alignY: 'bottom' })
}

function onPanStart(e) {
	handlePanStart(e, scrollContainerRef.value)
}

function onWheel(e) {
	handleWheel(e, scrollContainerRef.value)
}

const currentBranches = computed(() => {
	if (!props.entity) return []
	const raw = props.entity.skill_branches || []
	return raw.map(normalizeSkillBranch)
})

const { skillsCatalog } = useDataEditor()

const currentSkills = computed(() => {
	if (!props.entity) return []
	const raw = props.entity.skills || []
	const catalog = props.allKnownSkills?.length ? props.allKnownSkills : (skillsCatalog?.value || [])
	return resolveEntitySkills(raw, catalog)
})

const filteredSkills = computed(() => {
	if (selectedBranchId.value === 'all') {
		return currentSkills.value
	}
	return currentSkills.value.filter((s) => s.branch === selectedBranchId.value)
})

const gridData = computed(() => {
	const catalog = props.allKnownSkills?.length ? props.allKnownSkills : (skillsCatalog?.value || [])
	return organizeSkillsByGrid(filteredSkills.value, currentBranches.value, catalog)
})

const displayTiers = computed(() => {
	if (!gridData.value?.tiers) return []

	const tiers = [...gridData.value.tiers]
	const maxCols = gridData.value.maxCols || 3

	// If entityLevel has reached or exceeded highest skill tier,
	// and we have not reached entityMaxLevel, include next level tier!
	const highestTierLevel = tiers.reduce((max, t) => Math.max(max, t.level), 0)
	const nextLevelToUnlock = props.entityLevel + 1

	if (nextLevelToUnlock <= props.entityMaxLevel && nextLevelToUnlock > highestTierLevel) {
		tiers.push({
			level: nextLevelToUnlock,
			skills: [],
			cells: new Array(maxCols).fill(null)
		})
	}

	// Sort descending so level 1 is rendered at the bottom:
	return tiers.sort((a, b) => b.level - a.level)
})

const selectedSkill = computed(() => {
	if (!selectedSkillId.value) return null
	return currentSkills.value.find((s) => s.id === selectedSkillId.value) || null
})

const entityTypeLabel = computed(() => {
	return props.entityType === 'classes' ? 'класса' : 'расы'
})

const charProgressionState = computed(() => {
	const c = props.character || {}
	return {
		id: c.id || '',
		char_level: c.char_level || c.lvl || 1,
		skill_points: c.skill_points ?? 0,
		global_skill_points: c.global_skill_points ?? 0,
		global_spell_points: c.global_spell_points ?? 0,
		class_levels: c.class_levels || {},
		race_levels: c.race_levels || {},
		entity_points: c.entity_points || {},
		skills: c.skills || {}
	}
})

const computedCanUnlockLevel = computed(() => {
	if (props.canLevelUpStatus) {
		return props.canLevelUpStatus
	}
	if (props.entityLevel >= props.entityMaxLevel) {
		return { canLevelUp: false, reasons: ['Достигнут максимальный уровень'] }
	}
	return { canLevelUp: true, reasons: [] }
})

const totalAvailablePoints = computed(() => {
	if (!selectedSkill.value || !props.entity) return 0
	return getAvailableSkillPoints(
		charProgressionState.value,
		props.entity.id,
		selectedSkill.value.cost_type || 'skill_point'
	).total
})

function getCategoryBadge(catId) {
	return getCategoryMeta(catId)
}

function getSkillsInBranchCount(branchId) {
	return currentSkills.value.filter((s) => s.branch === branchId).length
}

function selectBranch(branchId) {
	selectedBranchId.value = branchId
	nextTick(() => updateConnectors())
}

function selectSkill(skillId) {
	selectedSkillId.value = skillId
	emit('select-skill', skillId)
}

function getSkillRank(skillId) {
	return props.character?.skills?.[skillId] || 0
}

function getSkillName(skillId) {
	const inEntity = currentSkills.value.find((s) => s.id === skillId)
	if (inEntity?.name) return inEntity.name
	const inAll = props.allKnownSkills.find((s) => s.id === skillId)
	return inAll?.name || skillId
}

function checkCanLearn(skill) {
	if (!props.isStrictMode) {
		return { canLearn: true, reasons: [], isMaxed: false }
	}
	return canLearnSkill(skill, charProgressionState.value, currentSkills.value, props.entity)
}

function canStudySkill(skill) {
	if (!props.isStrictMode) return true
	return checkCanLearn(skill).canLearn
}

function getUpgradeReasons(skill) {
	if (!props.isStrictMode) return []
	return checkCanLearn(skill).reasons || []
}

function getNodeClass(slot) {
	if (!slot) return ''
	const isLearned = getSkillRank(slot.id) > 0
	const isSelected = selectedSkillId.value === slot.id
	const check = checkCanLearn(slot)

	const classes = []
	if (isSelected) classes.push('__selected')
	if (isLearned) classes.push('__learned')
	else if (check.canLearn) classes.push('__available')
	else classes.push('__locked')

	return classes.join(' ')
}

function handleDoubleClick(slot) {
	if (!slot) return
	selectSkill(slot.id)
	if (getSkillRank(slot.id) === 0) {
		triggerLearn(slot)
	} else if (getSkillRank(slot.id) < (slot.max_level || 1)) {
		triggerUpgrade(slot, 1)
	}
}

function triggerLearn(skill) {
	if (!canStudySkill(skill)) return
	emit('learn-skill', skill.id, skill)
	nextTick(() => updateConnectors())
}

function triggerUpgrade(skill, delta) {
	emit('upgrade-skill', skill.id, delta, skill)
	nextTick(() => updateConnectors())
}

function triggerDowngradeOrUnlearn(skill) {
	const cur = getSkillRank(skill.id)
	if (cur > 1) {
		emit('downgrade-skill', skill.id, skill)
	} else {
		emit('unlearn-skill', skill.id, skill)
	}
	nextTick(() => updateConnectors())
}

function triggerUnlearn(skill) {
	emit('unlearn-skill', skill.id, skill)
	nextTick(() => updateConnectors())
}

function updateConnectors() {
	if (!canvasInnerRef.value || !gridData.value?.connectors) {
		computedConnectorLines.value = []
		return
	}

	const innerRect = canvasInnerRef.value.getBoundingClientRect()
	const scale = zoomScale.value || 1
	const lines = []

	for (const conn of gridData.value.connectors) {
		const pEl = canvasInnerRef.value.querySelector(`.skill-square-box[data-skill-id="${conn.fromId}"]`)
		const cEl = canvasInnerRef.value.querySelector(`.skill-node-wrapper[data-skill-id="${conn.toId}"]`)
		if (!pEl || !cEl) continue

		const pRect = pEl.getBoundingClientRect()
		const cRect = cEl.getBoundingClientRect()

		const x1 = (pRect.left + pRect.width / 2 - innerRect.left) / scale
		const y1 = (pRect.top - innerRect.top) / scale

		const x2 = (cRect.left + cRect.width / 2 - innerRect.left) / scale
		const y2 = (cRect.bottom - innerRect.top) / scale

		const d = buildBottomUpConnectorPath({
			pX: x1,
			pY: y1,
			cX: x2,
			cY: y2,
			arrowLength: TREE_MARKER_CONFIG.arrowLength
		})

		const isParentLearned = getSkillRank(conn.fromId) > 0
		const isChildLearned = getSkillRank(conn.toId) > 0
		const childSkill = currentSkills.value.find((s) => s.id === conn.toId)
		const isChildCanLearn = childSkill && checkCanLearn(childSkill).canLearn

		let stateClass = '__locked'
		let markerEnd = 'url(#arrow-locked)'

		if (isChildLearned) {
			stateClass = '__learned'
			markerEnd = 'url(#arrow-learned)'
		} else if (isParentLearned && isChildCanLearn) {
			stateClass = '__available'
			markerEnd = 'url(#arrow-available)'
		} else if (isParentLearned) {
			stateClass = '__parent-learned'
			markerEnd = 'url(#arrow-available)'
		}

		const reqClass = conn.requirement === 'any' ? '__any' : '__all'

		lines.push({
			key: `${conn.fromId}->${conn.toId}`,
			d,
			classNames: [stateClass, reqClass],
			markerEnd
		})
	}

	computedConnectorLines.value = lines
}

watch(
	[
		() => props.entity?.id,
		selectedBranchId,
		currentSkills,
		() => props.character?.skills,
		() => props.entityLevel
	],
	() => {
		nextTick(() => updateConnectors())
	},
	{ deep: true }
)

onMounted(() => {
	nextTick(() => {
		centerView()
		updateConnectors()
		if (canvasInnerRef.value && typeof ResizeObserver !== 'undefined') {
			resizeObserver = new ResizeObserver(() => {
				updateConnectors()
			})
			resizeObserver.observe(canvasInnerRef.value)
		}
	})
})

onUnmounted(() => {
	if (resizeObserver) {
		resizeObserver.disconnect()
		resizeObserver = null
	}
})

defineExpose({
	centerView,
	resetZoom,
	updateConnectors
})
</script>

<style scoped>
.skill-tree-canvas-wrapper {
	position: relative;
	flex: 1;
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	min-height: 25em;
	background: #090d16;
	color: #e2e8f0;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	overflow: hidden;
}

/* Branches Bar */
.branches-bar {
	height: 2.8em;
	padding: 0 1.2em;
	background: rgba(12, 18, 30, 0.9);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1em;
	flex-shrink: 0;
	z-index: 5;
}

.branches-tabs-list {
	display: flex;
	align-items: center;
	gap: 0.4em;
	overflow-x: auto;
}

.branch-tab {
	background: transparent;
	border: 1px solid transparent;
	color: #94a3b8;
	padding: 0.25em 0.7em;
	border-radius: 0.35em;
	font-size: 0.82em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.35em;
	transition: color 0.15s, background 0.15s, border-color 0.15s;
	white-space: nowrap;
}

.branch-tab:hover {
	color: #f1f5f9;
	background: rgba(255, 255, 255, 0.05);
}

.branch-tab.__active {
	background: rgba(59, 130, 246, 0.2);
	border-color: #3b82f6;
	color: #93c5fd;
	font-weight: bold;
}

.branch-count {
	background: rgba(0, 0, 0, 0.35);
	padding: 0.1em 0.35em;
	border-radius: 0.3em;
	font-size: 0.75em;
}

.branches-actions-slot {
	display: flex;
	align-items: center;
	gap: 0.6em;
	margin-left: auto;
}

/* Zoom Controls */
.zoom-controls-group {
	display: flex;
	align-items: center;
	background: rgba(15, 20, 30, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.15em;
	gap: 0.15em;
	flex-shrink: 0;
}

.zoom-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.8em;
	font-weight: bold;
	padding: 0.25em 0.55em;
	border-radius: 0.3em;
	cursor: pointer;
	transition: background 0.15s, color 0.15s;
	line-height: 1;
}

.zoom-btn:hover {
	background: rgba(255, 255, 255, 0.1);
	color: #f1f5f9;
}

.zoom-btn.__label {
	min-width: 3.2em;
	text-align: center;
	color: #cbd5e1;
	cursor: pointer;
	font-variant-numeric: tabular-nums;
}

.zoom-btn.__action {
	border-left: 1px solid rgba(255, 255, 255, 0.1);
	padding-left: 0.6em;
	color: #38bdf8;
}

/* Main Workspace */
.canvas-workspace {
	flex: 1;
	display: flex;
	overflow: hidden;
	position: relative;
}

/* Grid Canvas */
.grid-canvas-container {
	flex: 1;
	overflow: auto;
	padding: 2.5em;
	position: relative;
	display: flex;
	justify-content: center;
	align-items: flex-start;
	cursor: grab;
	background: radial-gradient(circle at 50% 30%, rgba(26, 36, 56, 0.4) 0%, rgba(9, 13, 22, 0.95) 75%),
		radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
	background-size: 100% 100%, 2em 2em;
}

.grid-canvas-container.__is-panning {
	cursor: grabbing;
	user-select: none;
}

.tree-canvas-inner {
	position: relative;
	min-width: max-content;
	padding: 1.5em;
	display: flex;
	flex-direction: column;
}

/* SVG Connectors Overlay */
.tree-connectors-svg {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	pointer-events: none;
	z-index: 3;
}

.connector-curve {
	fill: none;
	stroke-width: 0.18em;
	transition: stroke 0.2s, stroke-width 0.2s, filter 0.2s;
}

.connector-curve.__locked {
	stroke: rgba(100, 116, 139, 0.35);
}

.connector-curve.__parent-learned {
	stroke: #3b82f6;
	stroke-width: 0.2em;
	filter: drop-shadow(0 0 0.25em rgba(59, 130, 246, 0.5));
}

.connector-curve.__available {
	stroke: #10b981;
	stroke-width: 0.22em;
	filter: drop-shadow(0 0 0.35em rgba(16, 185, 129, 0.6));
}

.connector-curve.__learned {
	stroke: #f6c445;
	stroke-width: 0.24em;
	filter: drop-shadow(0 0 0.45em rgba(246, 196, 69, 0.8));
}

.connector-curve.__any {
	stroke-dasharray: 0.4em 0.25em;
}

/* Bottom-Up Tiers Container */
.bottom-up-tiers-wrapper {
	position: relative;
	z-index: 4;
	display: flex;
	flex-direction: column;
	gap: 2.8em;
}

.tree-tier-section {
	display: flex;
	flex-direction: column;
	align-items: center;
	width: 100%;
}

/* Subtle Dashed Divider Line Between Levels */
.level-dashed-divider {
	display: flex;
	align-items: center;
	gap: 0.8em;
	width: 100%;
	margin-bottom: 1.4em;
	position: relative;
	z-index: 3;
}

.ldd-line {
	flex: 1;
	height: 0;
	border-top: 1px dashed rgba(255, 255, 255, 0.15);
	pointer-events: none;
}

.ldd-badge {
	display: flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.2em 0.75em;
	border-radius: 0.4em;
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	font-size: 0.76em;
	color: #94a3b8;
	letter-spacing: 0.05em;
	text-transform: uppercase;
	white-space: nowrap;
}

.ldd-badge.__unlocked {
	border-color: rgba(16, 185, 129, 0.35);
	color: #6ee7b7;
	background: rgba(16, 185, 129, 0.1);
}

.ldd-tag-status {
	font-size: 0.85em;
	color: #10b981;
	font-weight: bold;
	margin-left: 0.2em;
	text-transform: none;
}

.ldd-sub {
	font-size: 0.85em;
	color: #f87171;
	opacity: 0.85;
	text-transform: none;
}

.ldd-unlock-btn {
	display: flex;
	align-items: center;
	gap: 0.5em;
	padding: 0.3em 0.9em;
	border-radius: 0.4em;
	background: rgba(16, 185, 129, 0.22);
	border: 1px solid #10b981;
	color: #6ee7b7;
	font-size: 0.82em;
	font-weight: bold;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	letter-spacing: 0.03em;
	box-shadow: 0 0 0.8em rgba(16, 185, 129, 0.25);
	transition: background 0.15s, border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}

.ldd-unlock-btn:hover:not(:disabled) {
	background: #10b981;
	color: #064e3b;
	box-shadow: 0 0 1.2em rgba(16, 185, 129, 0.5);
	transform: translateY(-0.05em);
}

.ldd-unlock-btn:disabled,
.ldd-unlock-btn.__disabled {
	opacity: 0.45;
	cursor: not-allowed;
	border-color: rgba(255, 255, 255, 0.15);
	color: #94a3b8;
	background: rgba(30, 41, 59, 0.6);
	box-shadow: none;
}

.lub-icon {
	font-size: 1.05em;
}

.lub-text {
	line-height: 1;
}

.lub-cost-pill {
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #fde68a;
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
	font-size: 0.85em;
	line-height: 1;
}

.tier-cells-grid {
	display: grid;
	gap: 1.8em;
	justify-content: center;
	width: 100%;
}

.tier-grid-slot {
	display: flex;
	justify-content: center;
	align-items: flex-start;
}

/* Square Skill Node */
.skill-node-wrapper {
	width: 7.2em;
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;
	position: relative;
	user-select: none;
	transition: transform 0.15s;
}

.skill-node-wrapper:hover {
	transform: translateY(-0.15em);
}

.skill-square-box {
	width: 4.8em;
	height: 4.8em;
	background: rgba(20, 26, 38, 0.95);
	border-radius: 0.65em;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 0.35em 1.2em rgba(0, 0, 0, 0.4);
	transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s, opacity 0.15s;
}

/* State: Locked (semi-transparent) */
.skill-node-wrapper.__locked .skill-square-box {
	opacity: 0.35;
	border: 2px dashed var(--cat-color, #64748b);
	filter: grayscale(0.5);
}

/* State: Available (dashed border) */
.skill-node-wrapper.__available .skill-square-box {
	opacity: 1;
	border: 2px dashed var(--cat-color, #10b981);
}

.skill-node-wrapper.__available:hover .skill-square-box {
	transform: translateY(-0.15em);
	box-shadow: 0 0 0.8em var(--cat-glow-color, rgba(16, 185, 129, 0.5));
}

/* State: Learned (solid border + outer glow) */
.skill-node-wrapper.__learned .skill-square-box {
	opacity: 1;
	border: 2px solid var(--cat-color, #f6c445);
	box-shadow: 0 0 1em var(--cat-glow-color, rgba(246, 196, 69, 0.6));
}

.skill-node-wrapper.__learned:hover .skill-square-box {
	transform: translateY(-0.15em);
	box-shadow: 0 0 1.5em var(--cat-glow-color, rgba(246, 196, 69, 0.8));
}

/* State: Selected */
.skill-node-wrapper.__selected .skill-square-box {
	outline: 2px solid #f8fafc;
	outline-offset: 0.2em;
}

.skill-cat-icon {
	position: absolute;
	top: 0.25em;
	left: 0.25em;
	font-size: 0.85em;
	line-height: 1;
	pointer-events: none;
	filter: drop-shadow(0 0 0.15em rgba(0, 0, 0, 0.9));
}

.skill-main-icon {
	font-size: 1.85em;
	line-height: 1;
	user-select: none;
}

.skill-learned-check {
	position: absolute;
	bottom: 0.2em;
	right: 0.2em;
	min-width: 1.25em;
	height: 1.25em;
	padding: 0 0.2em;
	background: #10b981;
	color: #064e3b;
	border-radius: 0.65em;
	font-size: 0.7em;
	font-weight: bold;
	display: flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	border: 1px solid rgba(255, 255, 255, 0.4);
}

.skill-name-under {
	margin-top: 0.45em;
	font-size: 0.82em;
	font-weight: bold;
	line-height: 1.2;
	max-width: 7.2em;
	text-align: center;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	transition: opacity 0.15s;
}

.skill-node-wrapper.__locked .skill-name-under {
	opacity: 0.45;
}

.skill-cost-badge {
	margin-top: 0.25em;
	font-size: 0.7em;
	color: #cbd5e1;
	background: rgba(0, 0, 0, 0.5);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.3em;
	padding: 0.1em 0.45em;
	white-space: nowrap;
}

.skill-cost-badge.__auto {
	background: rgba(16, 185, 129, 0.25);
	border-color: rgba(16, 185, 129, 0.5);
	color: #6ee7b7;
	font-weight: bold;
}

.innate-locked-hint {
	font-size: 0.8em;
	color: #94a3b8;
	text-align: center;
	padding: 0.5em;
	background: rgba(0, 0, 0, 0.25);
	border: 1px dashed rgba(255, 255, 255, 0.15);
	border-radius: 0.4em;
	width: 100%;
}

.skill-node-wrapper.__locked .skill-cost-badge {
	opacity: 0.4;
}

.empty-square-placeholder {
	width: 4.6em;
	height: 4.6em;
	border: 1px dashed rgba(255, 255, 255, 0.06);
	border-radius: 0.6em;
	opacity: 0.3;
}

/* Category Badges */
.node-cat-badge {
	font-size: 0.68em;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	font-weight: 500;
	white-space: nowrap;
}

.node-cat-badge.__lg {
	font-size: 0.85em;
	padding: 0.2em 0.6em;
}

.node-cat-badge.__cat-active {
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #fca5a5;
}

.node-cat-badge.__cat-passive {
	background: rgba(59, 130, 246, 0.2);
	border: 1px solid #3b82f6;
	color: #93c5fd;
}

.node-cat-badge.__cat-aura {
	background: rgba(245, 158, 11, 0.2);
	border: 1px solid #f59e0b;
	color: #fde68a;
}

.node-cat-badge.__cat-buff {
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid #10b981;
	color: #6ee7b7;
}

.node-cat-badge.__cat-debuff {
	background: rgba(168, 85, 247, 0.2);
	border: 1px solid #a855f7;
	color: #d8b4fe;
}

.node-cat-badge.__cat-spell {
	background: rgba(192, 132, 252, 0.2);
	border: 1px solid #c084fc;
	color: #e9d5ff;
}

.inspector-cat-box {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.6em 0.8em;
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
}

.icb-label {
	font-size: 0.8em;
	color: #94a3b8;
}

/* Empty Tree */
.empty-tree-message {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3em;
	text-align: center;
	color: #94a3b8;
}

.etm-icon {
	font-size: 3em;
	margin-bottom: 0.4em;
}

/* Inspector Drawer */
.skill-inspector-panel {
	width: 24em;
	background: rgba(15, 23, 42, 0.95);
	border-left: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	flex-direction: column;
	overflow-y: auto;
	flex-shrink: 0;
	backdrop-filter: blur(0.5em);
	z-index: 6;
}

.inspector-header {
	padding: 1em;
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.ih-left {
	display: flex;
	align-items: center;
	gap: 0.7em;
}

.ih-square-preview {
	width: 2.8em;
	height: 2.8em;
	background: rgba(0, 0, 0, 0.4);
	border: 2px solid #38bdf8;
	border-radius: 0.5em;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	flex-shrink: 0;
}

.ih-cat-icon {
	position: absolute;
	top: 0.15em;
	left: 0.15em;
	font-size: 0.75em;
	line-height: 1;
}

.ih-icon {
	font-size: 1.35em;
	line-height: 1;
}

.ih-info {
	display: flex;
	flex-direction: column;
}

.ih-name {
	margin: 0;
	font-size: 1.05em;
	color: #f1f5f9;
}

.ih-id {
	font-size: 0.75em;
	color: #64748b;
}

.ih-close-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 1.1em;
	cursor: pointer;
	padding: 0.2em;
}

.ih-close-btn:hover {
	color: #fff;
}

.inspector-body {
	padding: 1em;
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.inspector-status-banner {
	padding: 0.5em 0.8em;
	border-radius: 0.4em;
	font-size: 0.85em;
	font-weight: bold;
	text-align: center;
}

.inspector-status-banner.__learned {
	background: rgba(16, 185, 129, 0.18);
	border: 1px solid #10b981;
	color: #6ee7b7;
}

.inspector-status-banner.__available {
	background: rgba(245, 158, 11, 0.18);
	border: 1px solid #f59e0b;
	color: #fde68a;
}

.inspector-status-banner.__locked {
	background: rgba(100, 116, 139, 0.2);
	border: 1px solid rgba(100, 116, 139, 0.4);
	color: #94a3b8;
}

.inspector-reqs-card {
	background: rgba(0, 0, 0, 0.25);
	border: 1px solid rgba(255, 255, 255, 0.06);
	border-radius: 0.4em;
	padding: 0.7em;
	display: flex;
	flex-direction: column;
	gap: 0.45em;
	font-size: 0.82em;
}

.req-title {
	font-weight: bold;
	color: #cbd5e1;
	margin-bottom: 0.2em;
}

.req-item {
	display: flex;
	align-items: center;
	gap: 0.4em;
	color: #f87171;
}

.req-item.__met {
	color: #10b981;
}

.req-parents-block {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	padding: 0.3em 0 0.3em 0.5em;
	border-left: 2px solid rgba(255, 255, 255, 0.1);
}

.rph-label {
	color: #94a3b8;
	font-size: 0.78em;
}

.rph-condition {
	color: #f59e0b;
	font-size: 0.72em;
	margin-left: 0.2em;
}

.req-parent-item {
	display: flex;
	align-items: center;
	gap: 0.3em;
	color: #94a3b8;
	font-size: 0.8em;
}

.req-parent-item.__met {
	color: #10b981;
}

.inspector-desc-box {
	font-size: 0.82em;
}

.idb-title {
	color: #94a3b8;
	margin-bottom: 0.2em;
	font-weight: bold;
}

.idb-text {
	margin: 0;
	color: #cbd5e1;
	line-height: 1.4;
}

.inspector-json-box {
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.4em;
	padding: 0.6em;
	font-size: 0.78em;
}

.ijb-title {
	color: #38bdf8;
	margin-bottom: 0.3em;
	font-weight: bold;
}

.ijb-code {
	margin: 0;
	color: #cbd5e1;
	font-family: monospace;
	white-space: pre-wrap;
	word-break: break-all;
	max-height: 8em;
	overflow-y: auto;
}

.inspector-actions {
	display: flex;
	flex-direction: column;
	gap: 0.5em;
}

.action-btn {
	padding: 0.6em;
	font-size: 0.9em;
	border-radius: 0.4em;
	font-weight: bold;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s, transform 0.1s;
	border: 1px solid transparent;
}

.action-btn:hover:not(:disabled) {
	transform: translateY(-0.05em);
}

.action-btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
	transform: none;
}

.action-btn.__primary {
	background: #3b82f6;
	border-color: #60a5fa;
	color: #fff;
}

.action-btn.__primary:hover:not(:disabled) {
	background: #2563eb;
}

.action-btn.__secondary {
	background: rgba(255, 255, 255, 0.08);
	border-color: rgba(255, 255, 255, 0.2);
	color: #cbd5e1;
}

.action-btn.__secondary:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.action-btn.__danger {
	background: rgba(239, 68, 68, 0.2);
	border-color: #ef4444;
	color: #fca5a5;
}

.action-btn.__danger:hover:not(:disabled) {
	background: rgba(239, 68, 68, 0.35);
}

.full-btn {
	width: 100%;
}

.rank-stepper-panel {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.5em 0.8em;
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
}

.rsp-label {
	font-size: 0.82em;
	color: #94a3b8;
	margin-right: 0.4em;
}

.rsp-value {
	font-size: 0.9em;
	color: #f8fafc;
}

.rank-stepper-buttons {
	display: flex;
	gap: 0.3em;
}

.rsp-btn {
	width: 1.8em;
	height: 1.8em;
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #fff;
	border-radius: 0.3em;
	font-weight: bold;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background 0.15s;
}

.rsp-btn:hover:not(:disabled) {
	background: rgba(255, 255, 255, 0.25);
}

.rsp-btn:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.upgrade-reasons-list {
	display: flex;
	flex-direction: column;
	gap: 0.25em;
	font-size: 0.75em;
	color: #f87171;
	background: rgba(239, 68, 68, 0.1);
	border: 1px solid rgba(239, 68, 68, 0.2);
	border-radius: 0.3em;
	padding: 0.4em 0.6em;
}
</style>
