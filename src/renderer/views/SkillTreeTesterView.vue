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

		<!-- Main Workspace: Unified Skill Tree Canvas & Inspector -->
		<main class="tester-content">
			<SkillTreeCanvas
				ref="treeCanvasRef"
				:entity="currentEntity"
				:entity-type="selectedEntityType"
				:entity-level="currentEntityLevel"
				:entity-max-level="currentEntityMaxLevel"
				:character="currentCharacterProgression"
				:can-level-up-status="canLevelUpCurrentEntityStatus"
				unlock-cost-label="-1 LVL pt"
				:all-known-skills="allKnownSkills"
				@learn-skill="handleUpgrade"
				@upgrade-skill="handleUpgrade"
				@downgrade-skill="handleDowngrade"
				@unlearn-skill="handleDowngrade"
				@unlock-level="handleUnlockLevel"
				@reset-skills="handleReset"
			/>
		</main>
	</div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSkillTree } from '@/composables/useSkillTree'
import { useDataEditor } from '@/composables/useDataEditor'
import { ENTITY_TIERS } from '@/utils/skillTree'
import SkillTreeCanvas from '@/components/game/dataEditor/SkillTreeCanvas.vue'

const route = useRoute()
const router = useRouter()
const treeCanvasRef = ref(null)

const {
	charactersList,
	classesList,
	racesList,
	selectedCharacterId,
	selectedEntityType,
	selectedEntityId,
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
	currentCharacterProgression,
	currentEntity,
	setEntitiesData,
	selectCharacter,
	selectEntityType,
	selectEntity,
	addCharacterLevel,
	addLevelPoints,
	addGlobalSkillPoints,
	addGlobalSpellPoints,
	addLocalSkillPoints,
	addLocalSpellPoints,
	levelUpCurrentEntity,
	upgradeSkill,
	downgradeSkill,
	resetCurrentEntitySkills
} = useSkillTree()

const dataEditor = useDataEditor()

const allKnownSkills = computed(() => {
	return [...classesList.value, ...racesList.value].flatMap((e) => e.skills || [])
})

const entityTierLabel = computed(() => {
	const tierId = currentEntityTier.value || 'basic'
	return ENTITY_TIERS[tierId]?.name || 'Базовый'
})

const levelExplanation = computed(() => {
	return `Текущий уровень сущности: ${currentEntityLevel.value} из ${currentEntityMaxLevel.value}. Для прокачки требуется 1 очко уровня персонажа.`
})

const classesWithSkillsCount = computed(() => {
	return classesList.value.filter((c) => (c.skills || []).length > 0).length
})

const racesWithSkillsCount = computed(() => {
	return racesList.value.filter((r) => (r.skills || []).length > 0).length
})

const activeEntityList = computed(() => {
	return selectedEntityType.value === 'classes' ? classesList.value : racesList.value
})

function formatTier(tier) {
	if (tier === 'advanced' || tier === 'high') return 'Продвинутый'
	if (tier === 'rare' || tier === 'secret') return 'Редкий'
	return 'Базовый'
}

function handleUpgrade(skillId) {
	const res = upgradeSkill(skillId)
	if (!res.success && res.reasons) {
		console.warn('Cannot learn skill:', res.reasons)
	}
	treeCanvasRef.value?.updateConnectors()
}

function handleDowngrade(skillId) {
	const res = downgradeSkill(skillId)
	if (!res.success && res.reasons) {
		console.warn('Cannot refund skill:', res.reasons)
	}
	treeCanvasRef.value?.updateConnectors()
}

function handleUnlockLevel(level) {
	if (level !== currentEntityLevel.value + 1) return
	const res = levelUpCurrentEntity()
	if (!res.success && res.reasons) {
		console.warn('Level up entity failed:', res.reasons)
	}
	treeCanvasRef.value?.updateConnectors()
}

function handleReset() {
	if (confirm('Сбросить все навыки этого класса/расы? Потраченные очки будут возвращены.')) {
		resetCurrentEntitySkills()
		treeCanvasRef.value?.updateConnectors()
	}
}

function returnToMenu() {
	router.push('/home')
}

onMounted(async () => {
	await dataEditor.init()
	setEntitiesData({
		characters: dataEditor.entities.value.characters || [],
		classes: dataEditor.entities.value.classes || [],
		races: dataEditor.entities.value.races || []
	})

	if (route.query.type && (route.query.type === 'classes' || route.query.type === 'races')) {
		selectEntityType(route.query.type)
		if (route.query.id) {
			selectEntity(route.query.id)
		}
	}
})
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
	font-family: Kurale, sans-serif;
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
	font-family: Kurale, sans-serif;
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

.elp-tier.__tier-advanced,
.elp-tier.__tier-high {
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
	background: rgba(239, 68, 68, 0.2);
	border: 1px solid #ef4444;
	color: #fca5a5;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s;
}

.reset-btn:hover {
	background: rgba(239, 68, 68, 0.35);
}

/* Main Workspace */
.tester-content {
	flex: 1;
	display: flex;
	overflow: hidden;
	position: relative;
}
</style>
