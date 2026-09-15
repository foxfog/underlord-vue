<template>
	<div class="skill-tester-view">
		<!-- Top Navigation Header -->
		<header class="tester-header">
			<div class="header-left">
				<button class="editor-btn editor-btn-back" @click="returnToMenu">
					<span class="btn-icon">‹</span>
					<span>Меню тестов</span>
				</button>

				<div class="header-title-box">
					<span class="header-icon">🌳</span>
					<div class="header-titles">
						<span class="header-title">Тестер древа навыков и прокачки (Skill Trees)</span>
						<span class="header-sub">Уровневая сетка, начисление очков уровня, условия ALL/ANY и валюты SP/MP</span>
					</div>
				</div>
			</div>

			<div class="header-right">
				<!-- Character Selector -->
				<div class="header-select-group">
					<span class="select-label">Персонаж:</span>
					<select
						v-model="selectedCharacterId"
						class="tester-select"
						@change="selectCharacter(selectedCharacterId)"
					>
						<option v-for="c in charactersList" :key="c.id" :value="c.id">
							{{ c.name || c.id }} ({{ c.id }})
						</option>
					</select>
				</div>

				<!-- Character Level Badge & Actions -->
				<div class="char-level-badge" title="Уровень персонажа (макс 100). При каждом уровне дается 1 очко уровня">
					<span class="clb-icon">🎖️</span>
					<span class="clb-text">Персонаж: <strong>Ур. {{ charLevel }}</strong> / 100</span>
					<div class="mini-actions">
						<button class="mini-btn" title="Повысить уровень персонажа на 1" @click="addCharacterLevel(1)">+1</button>
						<button class="mini-btn" title="Повысить уровень персонажа на 5" @click="addCharacterLevel(5)">+5</button>
					</div>
				</div>

				<!-- Level Points Badge (Очки уровня) -->
				<div class="level-pts-badge" title="Очки уровня персонажа. Тратятся на открытие уровней классов и рас (-1 за уровень)">
					<span class="lpb-icon">⭐</span>
					<span class="lpb-text"><strong>{{ levelPoints }}</strong> LVL pt</span>
					<div class="mini-actions">
						<button class="mini-btn" title="Добавить 1 очко уровня" @click="addLevelPoints(1)">+1</button>
						<button class="mini-btn" title="Добавить 5 очков уровня" @click="addLevelPoints(5)">+5</button>
					</div>
				</div>

				<!-- Global Points Badges -->
				<div class="global-pts-badge" title="Общие бонусные очки навыков (SP) и заклинаний (MP)">
					<span class="gpb-item" title="Общие очки навыков (SP)">
						🌐 ⚔️ <strong>{{ globalSP }}</strong> SP
						<button class="mini-btn" title="Добавить 1 общее SP" @click="addGlobalSkillPoints(1)">+1</button>
					</span>
					<span class="gpb-sep">|</span>
					<span class="gpb-item" title="Общие очки заклинаний (MP)">
						🌐 🔮 <strong>{{ globalMP }}</strong> MP
						<button class="mini-btn" title="Добавить 1 общее MP" @click="addGlobalSpellPoints(1)">+1</button>
					</span>
				</div>
			</div>
		</header>

		<!-- Sub-header Entity & Branch Selector Bar -->
		<div class="tester-sub-bar">
			<div class="entity-type-tabs">
				<button
					class="type-tab-btn"
					:class="{ __active: selectedEntityType === 'classes' }"
					@click="selectEntityType('classes')"
				>
					<span class="tab-icon">⚔️</span>
					<span>Классы</span>
					<span class="tab-badge">{{ classesWithSkillsCount }}</span>
				</button>
				<button
					class="type-tab-btn"
					:class="{ __active: selectedEntityType === 'races' }"
					@click="selectEntityType('races')"
				>
					<span class="tab-icon">🧬</span>
					<span>Расы</span>
					<span class="tab-badge">{{ racesWithSkillsCount }}</span>
				</button>
			</div>

			<!-- Entity Select Dropdown -->
			<div class="entity-picker-wrap">
				<span class="picker-label">{{ selectedEntityType === 'classes' ? 'Класс:' : 'Раса:' }}</span>
				<select
					:value="selectedEntityId"
					class="tester-select __entity"
					@change="selectEntity($event.target.value)"
				>
					<option
						v-for="ent in activeEntityList"
						:key="ent.id"
						:value="ent.id"
					>
						{{ ent.icon || '📄' }} {{ ent.name }} ({{ ent.id }}) [{{ formatTier(ent.tier) }}] — {{ (ent.skills || []).length }} скилов
					</option>
				</select>
			</div>

			<!-- Entity Tier & Level Pill -->
			<div class="entity-level-pill" :title="levelExplanation">
				<span class="elp-tier" :class="`__tier-${currentEntityTier}`">
					{{ entityTierLabel }}
				</span>
				<span class="elp-text">
					Уровень: <strong>{{ currentEntityLevel }} / {{ currentEntityMaxLevel }}</strong>
				</span>
			</div>

			<!-- Local Entity Points Badges -->
			<div class="local-pts-badge" title="Собственные очки текущего класса/расы (начисляются при повышении уровня)">
				<span class="lpt-item" title="Собственные SP этого класса/расы">
					⚔️ <strong>{{ currentEntityLocalSP }}</strong> SP
					<button class="mini-btn" title="Добавить 1 локальное SP" @click="addLocalSkillPoints(1)">+1</button>
				</span>
				<span class="lpt-sep">|</span>
				<span class="lpt-item" title="Собственные MP этого класса/расы">
					🔮 <strong>{{ currentEntityLocalMP }}</strong> MP
					<button class="mini-btn" title="Добавить 1 локальное MP" @click="addLocalSpellPoints(1)">+1</button>
				</span>
			</div>

			<!-- Reset Skills Button -->
			<button
				class="editor-btn editor-btn-danger reset-btn"
				title="Сбросить все навыки этой сущности и вернуть очки SP/MP"
				@click="handleReset"
			>
				<span>🔄 Сбросить навыки</span>
			</button>
		</div>

		<!-- Branch Filter Tabs -->
		<div class="branches-bar">
			<button
				class="branch-tab"
				:class="{ __active: selectedBranchId === 'all' }"
				@click="selectBranch('all')"
			>
				<span>Все ветки ({{ currentSkills.length }})</span>
			</button>
			<button
				v-for="b in currentBranches"
				:key="b.id"
				class="branch-tab"
				:class="{ __active: selectedBranchId === b.id }"
				@click="selectBranch(b.id)"
			>
				<span class="branch-icon">{{ b.icon || '🌿' }}</span>
				<span>{{ b.name }}</span>
				<span class="branch-count">{{ getSkillsInBranchCount(b.id) }}</span>
			</button>
		</div>

		<!-- Main Workspace: Tier Grid and Inspector -->
		<main class="tester-content">
			<!-- Visual Grid Canvas with SVG Bézier Connectors -->
			<div class="grid-canvas-container" ref="gridContainerRef">
				<div v-if="gridData.tiers.length > 0" class="tree-canvas-inner" ref="canvasInnerRef">
					<!-- SVG Connectors Layer -->
					<svg class="tree-connectors-svg">
						<defs>
							<marker
								id="arrow-learned"
								markerWidth="7"
								markerHeight="7"
								refX="5"
								refY="3.5"
								orient="auto"
							>
								<polygon points="0 0.5, 5 3.5, 0 6.5" fill="#f6c445" />
							</marker>
							<marker
								id="arrow-available"
								markerWidth="7"
								markerHeight="7"
								refX="5"
								refY="3.5"
								orient="auto"
							>
								<polygon points="0 0.5, 5 3.5, 0 6.5" fill="#10b981" />
							</marker>
							<marker
								id="arrow-locked"
								markerWidth="7"
								markerHeight="7"
								refX="5"
								refY="3.5"
								orient="auto"
							>
								<polygon points="0 0.5, 5 3.5, 0 6.5" fill="#64748b" />
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
									v-if="currentEntityLevel >= tier.level"
									class="ldd-badge __unlocked"
									:title="`Уровень ${tier.level} открыт`"
								>
									<span class="ldd-icon">🔓</span>
									<span class="ldd-text">Уровень {{ tier.level }}</span>
									<span class="ldd-tag-status">✔ Открыт</span>
								</div>

								<!-- Next Level: Interactive Unlock Button -->
								<button
									v-else-if="tier.level === currentEntityLevel + 1"
									type="button"
									class="ldd-unlock-btn"
									:class="{ __disabled: !canLevelUpCurrentEntityStatus.canLevelUp }"
									:disabled="!canLevelUpCurrentEntityStatus.canLevelUp"
									:title="canLevelUpCurrentEntityStatus.reasons.join('; ')"
									@click="handleUnlockLevel(tier.level)"
								>
									<span class="lub-icon">🔓</span>
									<span class="lub-text">Открыть уровень {{ tier.level }}</span>
									<span class="lub-cost-pill">-1 LVL pt</span>
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
										@dblclick="handleUpgrade(slot.id)"
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
											<span v-if="getSkillRank(slot.id) > 0" class="skill-learned-check">✔</span>
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
										<div class="skill-cost-badge">
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
					<button class="editor-btn editor-btn-primary" @click="goToDataEditor">
						Открыть Редактор данных →
					</button>
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
					<button class="ih-close-btn" @click="selectSkill(null)">✕</button>
				</div>

				<div class="inspector-body">
					<!-- Status Banner -->
					<div
						class="inspector-status-banner"
						:class="{
							__learned: getSkillRank(selectedSkill.id) > 0,
							__available: getSkillRank(selectedSkill.id) === 0 && checkCanLearn(selectedSkill).canLearn,
							__locked: getSkillRank(selectedSkill.id) === 0 && !checkCanLearn(selectedSkill).canLearn
						}"
					>
						<span v-if="getSkillRank(selectedSkill.id) > 0">🏆 Навык изучен</span>
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
						<div class="req-item" :class="{ __met: currentEntityLevel >= selectedSkill.req_level }">
							<span class="req-icon">{{ currentEntityLevel >= selectedSkill.req_level ? '✔' : '❌' }}</span>
							<span class="req-text">
								Уровень {{ entityTypeLabel }}: <strong>{{ selectedSkill.req_level }}</strong> (текущий: {{ currentEntityLevel }})
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
									:class="{ __met: getSkillRank(pid) > 0 }"
								>
									<span class="rp-icon">{{ getSkillRank(pid) > 0 ? '✔' : '○' }}</span>
									<span class="rp-name">{{ getSkillName(pid) }}</span>
									<span class="rp-rank">({{ getSkillRank(pid) > 0 ? 'Изучен' : 'Не изучен' }})</span>
								</div>
							</div>
						</div>

						<!-- Cost and Currency breakdown -->
						<div class="req-item" :class="{ __met: totalAvailablePointsForSkill >= selectedSkill.cost }">
							<span class="req-icon">{{ totalAvailablePointsForSkill >= selectedSkill.cost ? '✔' : '❌' }}</span>
							<span class="req-text">
								Стоимость: <strong>{{ selectedSkill.cost }} {{ selectedSkill.cost_type === 'spell_point' ? '🔮 MP' : '⚔️ SP' }}</strong>
								(доступно: {{ totalAvailablePointsForSkill }})
							</span>
						</div>
						<div class="req-points-breakdown">
							<span>Локальные: {{ selectedSkill.cost_type === 'spell_point' ? currentEntityLocalMP : currentEntityLocalSP }}</span>
							<span class="rpb-sep">+</span>
							<span>Общие (Global): {{ selectedSkill.cost_type === 'spell_point' ? globalMP : globalSP }}</span>
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
						<button
							v-if="getSkillRank(selectedSkill.id) === 0"
							class="editor-btn editor-btn-primary full-btn"
							:disabled="!canUpgradeSkill(selectedSkill)"
							@click="handleUpgrade(selectedSkill.id)"
						>
							➕ Изучить навык ({{ selectedSkill.cost }} {{ selectedSkill.cost_type === 'spell_point' ? 'MP' : 'SP' }})
						</button>

						<button
							v-else
							class="editor-btn editor-btn-secondary full-btn"
							:disabled="!canRefundSkillRank(selectedSkill)"
							@click="handleDowngrade(selectedSkill.id)"
						>
							➖ Сбросить навык (+{{ selectedSkill.cost }} {{ selectedSkill.cost_type === 'spell_point' ? 'MP' : 'SP' }})
						</button>

						<!-- Error explanation if cannot upgrade -->
						<div v-if="getUpgradeReasons(selectedSkill).length > 0 && getSkillRank(selectedSkill.id) === 0" class="upgrade-reasons-list">
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
		</main>
	</div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useSkillTree } from '@/composables/useSkillTree'
import { useDataEditor } from '@/composables/useDataEditor'
import { getCategoryMeta, ENTITY_TIERS, getAvailableSkillPoints } from '@/utils/skillTree'

const router = useRouter()

const {
	charactersList,
	classesList,
	racesList,
	selectedCharacterId,
	selectedEntityType,
	selectedEntityId,
	selectedBranchId,
	selectedSkillId,
	charLevel,
	levelPoints,
	globalSP,
	globalMP,
	currentEntityLevel,
	currentEntityTier,
	currentEntityMaxLevel,
	currentEntityLocalSP,
	currentEntityLocalMP,
	canLevelUpCurrentEntityStatus,
	currentCharacter,
	currentCharacterProgression,
	currentSP,
	currentEntity,
	currentBranches,
	currentSkills,
	currentClassLevel,
	gridData,
	selectedSkill,
	setEntitiesData,
	selectCharacter,
	selectEntityType,
	selectEntity,
	selectBranch,
	selectSkill,
	addCharacterLevel,
	addLevelPoints,
	addGlobalSkillPoints,
	addGlobalSpellPoints,
	addLocalSkillPoints,
	addLocalSpellPoints,
	addSkillPoints,
	levelUpCurrentEntity,
	checkCanLearn,
	checkCanRefund,
	upgradeSkill,
	downgradeSkill,
	resetCurrentEntitySkills,
	getSkillRank
} = useSkillTree()

const dataEditor = useDataEditor()
const canvasInnerRef = ref(null)
const computedConnectorLines = ref([])
let resizeObserver = null

const displayTiers = computed(() => {
	if (!gridData.value?.tiers) return []

	const tiers = [...gridData.value.tiers]
	const maxCols = gridData.value.maxCols || 3

	// If currentEntityLevel has reached or exceeded highest skill tier,
	// and we have not reached currentEntityMaxLevel, include next level tier!
	const highestTierLevel = tiers.reduce((max, t) => Math.max(max, t.level), 0)
	const nextLevelToUnlock = currentEntityLevel.value + 1

	if (nextLevelToUnlock <= currentEntityMaxLevel.value && nextLevelToUnlock > highestTierLevel) {
		tiers.push({
			level: nextLevelToUnlock,
			skills: [],
			cells: new Array(maxCols).fill(null)
		})
	}

	// Sort descending so level 1 is rendered at the bottom:
	return tiers.sort((a, b) => b.level - a.level)
})

function getCategoryBadge(catId) {
	return getCategoryMeta(catId)
}

const entityTierLabel = computed(() => {
	const tierId = currentEntityTier.value || 'basic'
	return ENTITY_TIERS[tierId]?.name || 'Базовый'
})

const entityTypeLabel = computed(() => {
	return selectedEntityType.value === 'classes' ? 'класса' : 'расы'
})

const totalAvailablePointsForSkill = computed(() => {
	if (!selectedSkill.value || !currentEntity.value) return 0
	return getAvailableSkillPoints(
		currentCharacterProgression.value,
		currentEntity.value.id,
		selectedSkill.value.cost_type || 'skill_point'
	)
})

function formatTier(tier) {
	if (tier === 'advanced') return 'Продвинутый'
	if (tier === 'rare') return 'Редкий'
	return 'Базовый'
}

function updateConnectors() {
	if (!canvasInnerRef.value || !gridData.value?.connectors) {
		computedConnectorLines.value = []
		return
	}

	const innerRect = canvasInnerRef.value.getBoundingClientRect()
	const lines = []

	for (const conn of gridData.value.connectors) {
		const pEl = canvasInnerRef.value.querySelector(`.skill-square-box[data-skill-id="${conn.fromId}"]`)
		const cEl = canvasInnerRef.value.querySelector(`.skill-node-wrapper[data-skill-id="${conn.toId}"]`)
		if (!pEl || !cEl) continue

		const pRect = pEl.getBoundingClientRect()
		const cRect = cEl.getBoundingClientRect()

		// Coordinates relative to canvasInner
		// Parent is at the bottom, Child is above it:
		// Connect top-center of Parent square to bottom-center of Child wrapper
		const x1 = pRect.left + pRect.width / 2 - innerRect.left
		const y1 = pRect.top - innerRect.top

		const x2 = cRect.left + cRect.width / 2 - innerRect.left
		const y2 = cRect.bottom - innerRect.top

		const dy = y2 - y1
		let d = ''
		if (Math.abs(dy) < 15) {
			const arcY = y1 - 30
			d = `M ${x1} ${y1} C ${x1} ${arcY}, ${x2} ${arcY}, ${x2} ${y2}`
		} else {
			const cp1Y = y1 + dy * 0.5
			const cp2Y = y2 - dy * 0.5
			d = `M ${x1} ${y1} C ${x1} ${cp1Y}, ${x2} ${cp2Y}, ${x2} ${y2}`
		}

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
	[selectedEntityId, selectedBranchId, currentSkills, () => currentCharacterProgression.value?.skills, currentEntityLevel],
	() => {
		nextTick(() => updateConnectors())
	},
	{ deep: true }
)

onMounted(async () => {
	await dataEditor.init()
	setEntitiesData({
		characters: dataEditor.entities.value.characters || [],
		classes: dataEditor.entities.value.classes || [],
		races: dataEditor.entities.value.races || []
	})

	nextTick(() => {
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

const activeEntityList = computed(() => {
	return selectedEntityType.value === 'classes' ? classesList.value : racesList.value
})

const classesWithSkillsCount = computed(() => {
	return classesList.value.filter((c) => (c.skills || []).length > 0).length
})

const racesWithSkillsCount = computed(() => {
	return racesList.value.filter((r) => (r.skills || []).length > 0).length
})

const levelExplanation = computed(() => {
	return `Текущий уровень ${selectedEntityType.value === 'classes' ? 'класса' : 'расы'}: ${currentEntityLevel.value} / ${currentEntityMaxLevel.value} [${entityTierLabel.value}]. Открывайте уровни кнопками на линиях уровней древа за 1 LVL pt!`
})

function getSkillsInBranchCount(branchId) {
	return currentSkills.value.filter((s) => s.branch === branchId).length
}

function getSkillName(skillId) {
	const s = currentSkills.value.find((sk) => sk.id === skillId)
	return s ? s.name : skillId
}

function getNodeClass(skill) {
	const rank = getSkillRank(skill.id)
	const isSelected = selectedSkillId.value === skill.id
	const check = checkCanLearn(skill)

	return {
		__selected: isSelected,
		__learned: rank > 0,
		__available: rank === 0 && check.canLearn,
		__locked: rank === 0 && !check.canLearn
	}
}

function canUpgradeSkill(skill) {
	if (!skill) return false
	return checkCanLearn(skill).canLearn
}

function canRefundSkillRank(skill) {
	if (!skill) return false
	return checkCanRefund(skill).canRefund
}

function getUpgradeReasons(skill) {
	if (!skill) return []
	return checkCanLearn(skill).reasons
}

function handleUpgrade(skillId) {
	const res = upgradeSkill(skillId)
	if (!res.success && res.reasons) {
		console.warn('Cannot learn skill:', res.reasons)
	}
	nextTick(() => updateConnectors())
}

function handleDowngrade(skillId) {
	const res = downgradeSkill(skillId)
	if (!res.success && res.reasons) {
		console.warn('Cannot refund skill:', res.reasons)
	}
	nextTick(() => updateConnectors())
}

function handleUnlockLevel(level) {
	if (level !== currentEntityLevel.value + 1) return
	const res = levelUpCurrentEntity()
	if (!res.success && res.reasons) {
		console.warn('Level up entity failed:', res.reasons)
	}
	nextTick(() => updateConnectors())
}

function handleLevelUpEntity() {
	handleUnlockLevel(currentEntityLevel.value + 1)
}

function handleReset() {
	if (confirm('Сбросить все навыки этого класса/расы? Потраченные очки будут возвращены.')) {
		resetCurrentEntitySkills()
		nextTick(() => updateConnectors())
	}
}

function returnToMenu() {
	router.push('/home')
}

function goToDataEditor() {
	router.push('/test/data-editor')
}
</script>

<style scoped>
.skill-tester-view {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	background: #090d16;
	color: #e2e8f0;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	overflow: hidden;
}

/* Header */
.tester-header {
	height: 3.5em;
	padding: 0 1.2em;
	background: rgba(15, 23, 42, 0.85);
	border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	display: flex;
	align-items: center;
	justify-content: space-between;
	backdrop-filter: blur(0.5em);
	flex-shrink: 0;
}

.header-left {
	display: flex;
	align-items: center;
	gap: 1em;
}

.editor-btn-back {
	background: rgba(255, 255, 255, 0.08);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #cbd5e1;
	padding: 0.35em 0.8em;
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	gap: 0.3em;
	cursor: pointer;
	font-size: 0.85em;
}

.editor-btn-back:hover {
	background: rgba(255, 255, 255, 0.15);
	color: #fff;
}

.header-title-box {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.header-icon {
	font-size: 1.6em;
}

.header-titles {
	display: flex;
	flex-direction: column;
}

.header-title {
	font-size: 1.1em;
	font-weight: bold;
	color: #f8fafc;
	font-family: Overlord, Kurale, serif;
}

.header-sub {
	font-size: 0.75em;
	color: #94a3b8;
}

.header-right {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.header-select-group {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
}

.select-label {
	color: #94a3b8;
}

.tester-select {
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.15);
	color: #f1f5f9;
	border-radius: 0.35em;
	padding: 0.3em 0.6em;
	font-size: 0.85em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
}

.tester-select.__entity {
	min-width: 15em;
}

.char-level-badge {
	background: rgba(59, 130, 246, 0.18);
	border: 1px solid rgba(59, 130, 246, 0.4);
	color: #bfdbfe;
	padding: 0.25em 0.6em;
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.84em;
}

.level-pts-badge {
	background: rgba(245, 158, 11, 0.2);
	border: 1px solid #f59e0b;
	color: #fde68a;
	padding: 0.25em 0.6em;
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.84em;
}

.global-pts-badge {
	background: rgba(139, 92, 246, 0.15);
	border: 1px solid rgba(139, 92, 246, 0.35);
	color: #ddd6fe;
	padding: 0.25em 0.6em;
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.82em;
}

.gpb-item {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.gpb-sep {
	color: rgba(255, 255, 255, 0.2);
}

.mini-actions {
	display: flex;
	gap: 0.2em;
	margin-left: 0.2em;
}

.mini-btn {
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.18);
	color: #f1f5f9;
	border-radius: 0.25em;
	padding: 0.1em 0.35em;
	font-size: 0.75em;
	font-family: Kurale, sans-serif;
	cursor: pointer;
	line-height: 1;
	transition: background 0.15s;
}

.mini-btn:hover {
	background: rgba(255, 255, 255, 0.25);
	color: #fff;
}

/* Sub bar */
.tester-sub-bar {
	height: 3.2em;
	padding: 0 1.2em;
	background: rgba(18, 26, 43, 0.9);
	border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	display: flex;
	align-items: center;
	gap: 1em;
	flex-shrink: 0;
}

.entity-type-tabs {
	display: flex;
	gap: 0.3em;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.2em;
	border-radius: 0.4em;
	border: 1px solid rgba(255, 255, 255, 0.08);
}

.type-tab-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	padding: 0.3em 0.7em;
	border-radius: 0.3em;
	font-size: 0.85em;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.35em;
	transition: color 0.15s, background 0.15s;
}

.type-tab-btn.__active {
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
	font-weight: bold;
}

.tab-badge {
	background: rgba(0, 0, 0, 0.4);
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
	font-size: 0.75em;
}

.entity-picker-wrap {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
}

.picker-label {
	color: #94a3b8;
}

.entity-level-pill {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(30, 41, 59, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #e2e8f0;
	padding: 0.3em 0.7em;
	border-radius: 0.4em;
	font-size: 0.85em;
}

.elp-tier {
	font-size: 0.75em;
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	font-weight: bold;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.elp-tier.__tier-basic {
	background: rgba(56, 189, 248, 0.2);
	border: 1px solid #38bdf8;
	color: #7dd3fc;
}

.elp-tier.__tier-advanced {
	background: rgba(168, 85, 247, 0.2);
	border: 1px solid #a855f7;
	color: #d8b4fe;
}

.elp-tier.__tier-rare {
	background: rgba(245, 158, 11, 0.2);
	border: 1px solid #f59e0b;
	color: #fde68a;
}


.local-pts-badge {
	background: rgba(15, 23, 42, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.1);
	color: #cbd5e1;
	padding: 0.25em 0.65em;
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.82em;
}

.lpt-item {
	display: flex;
	align-items: center;
	gap: 0.3em;
}

.lpt-sep {
	color: rgba(255, 255, 255, 0.2);
}

.reset-btn {
	margin-left: auto;
	font-size: 0.8em;
	padding: 0.35em 0.8em;
	border-radius: 0.35em;
}

/* Branches Bar */
.branches-bar {
	height: 2.6em;
	padding: 0 1.2em;
	background: rgba(12, 18, 30, 0.85);
	border-bottom: 1px solid rgba(255, 255, 255, 0.06);
	display: flex;
	align-items: center;
	gap: 0.4em;
	overflow-x: auto;
	flex-shrink: 0;
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

/* Main Content Area */
.tester-content {
	flex: 1;
	display: flex;
	overflow: hidden;
	position: relative;
}

/* Grid Canvas */
.grid-canvas-container {
	flex: 1;
	overflow: auto;
	padding: 2em;
	position: relative;
	display: flex;
	justify-content: center;
	align-items: flex-start;
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
	z-index: 1;
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
	z-index: 2;
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
	width: 6.8em;
	display: flex;
	flex-direction: column;
	align-items: center;
	cursor: pointer;
	position: relative;
	user-select: none;
}

.skill-square-box {
	width: 4.6em;
	height: 4.6em;
	background: rgba(22, 32, 54, 0.95);
	border-radius: 0.6em;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
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
	width: 1.25em;
	height: 1.25em;
	background: #10b981;
	color: #064e3b;
	border-radius: 50%;
	font-size: 0.7em;
	font-weight: bold;
	display: flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	border: 1px solid rgba(255, 255, 255, 0.4);
}

.skill-name-under {
	margin-top: 0.4em;
	font-size: 0.82em;
	font-weight: bold;
	line-height: 1.2;
	width: 100%;
	text-align: center;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
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

.req-points-breakdown {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.75em;
	color: #94a3b8;
	padding-left: 1.5em;
}

.rpb-sep {
	color: rgba(255, 255, 255, 0.2);
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

.full-btn {
	width: 100%;
	padding: 0.6em;
	font-size: 0.9em;
	border-radius: 0.4em;
	font-weight: bold;
	cursor: pointer;
	font-family: Kurale, sans-serif;
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
