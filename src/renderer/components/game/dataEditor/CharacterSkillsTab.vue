<template>
	<div class="char-skills-tab">
		<!-- Top Bar: Assigned Entities Chips & Tree Picker Button -->
		<div class="entity-selector-bar">
			<div class="esb-left">
				<span class="esb-icon">{{ type === 'classes' ? '⚔️' : '🧬' }}</span>
				<span class="esb-title">{{ type === 'classes' ? 'Классы персонажа:' : 'Расы персонажа:' }}</span>
			</div>

			<div class="esb-chips-row">
				<!-- Assigned Chips with Level & Skills Count -->
				<div
					v-for="ent in assignedEntities"
					:key="ent.id"
					class="entity-chip-item"
					:class="{ __active: activeEntityId === ent.id }"
					@click="activeEntityId = ent.id"
				>
					<span class="ecb-icon">{{ ent.icon || (type === 'classes' ? '⚔️' : '🧬') }}</span>
					<span class="ecb-name">{{ ent.name || ent.id }}</span>
					<span class="ecb-lvl-tag">ур. {{ getEntityLevel(ent.id) }}</span>
					<span
						class="ecb-badge"
						:title="`Изучено ${getLearnedCountForEntity(ent)} из ${(ent.skills || []).length} навыков`"
					>
						{{ getLearnedCountForEntity(ent) }} / {{ (ent.skills || []).length }}
					</span>
					<button
						type="button"
						class="ecb-remove-btn"
						title="Убрать класс/расу у персонажа"
						@click.stop="removeEntityFromCharacter(ent.id)"
					>
						✕
					</button>
				</div>

				<!-- Button to open Tree / Hierarchy Picker -->
				<button
					type="button"
					class="open-tree-picker-btn"
					@click="isTreePickerOpen = !isTreePickerOpen"
				>
					<span class="otp-icon">🌳</span>
					<span>{{ isTreePickerOpen ? 'Скрыть древо' : (type === 'classes' ? '➕ Древо классов' : '➕ Древо рас') }}</span>
				</button>
			</div>
		</div>

		<!-- REUSABLE UNIFIED CLASS/RACE TREE DRAWER -->
		<Transition name="fade">
			<ClassRaceTreeDrawer
				v-if="isTreePickerOpen"
				:type="type"
				:items="entitiesPool"
				:assigned-ids="assignedIds"
				:active-entity-id="activeEntityId"
				:active-locale="activeLocale"
				:locales-data="localesData"
				@select="handleNodeSelect"
				@toggle-assign="handleToggleAssignNode"
				@close="isTreePickerOpen = false"
			/>
		</Transition>

		<!-- Main Active Entity Skills Workspace -->
		<div v-if="activeEntity" class="skills-workspace">
			<!-- Entity Header Card: Class/Race Level Controls & SP -->
			<div class="entity-header-card">
				<div class="ehc-left">
					<span class="ehc-icon">{{ activeEntity.icon || (type === 'classes' ? '⚔️' : '🧬') }}</span>
					<div class="ehc-titles">
						<div class="ehc-title-row">
							<span class="ehc-name">{{ activeEntity.name || activeEntity.id }}</span>
							<span class="ehc-id">id: {{ activeEntity.id }}</span>
							<span class="ehc-tier-pill" :class="`__tier-${activeEntity.tier || 'basic'}`">
								{{ formatTier(activeEntity.tier) }}
							</span>
							<span v-if="activeEntity.parent_id" class="ehc-parent-pill">
								← {{ getEntityNameById(activeEntity.parent_id) }}
							</span>
						</div>
						<div class="ehc-desc">
							{{ activeEntity.description || 'Нет описания сущности' }}
						</div>
					</div>
				</div>

				<div class="ehc-right">
					<!-- Active Entity Level Stepper -->
					<div class="char-lvl-box">
						<span class="clb-label">
							{{ type === 'classes' ? 'Уровень класса:' : 'Уровень расы:' }}
						</span>
						<div class="clb-controls">
							<button
								type="button"
								class="clb-btn"
								title="Понизить уровень"
								@click="adjustEntityLevel(activeEntity.id, -1)"
							>
								-1
							</button>
							<span class="clb-val">{{ getEntityLevel(activeEntity.id) }} / {{ getEntityMaxLvl(activeEntity) }}</span>
							<button
								type="button"
								class="clb-btn"
								title="Повысить уровень"
								@click="adjustEntityLevel(activeEntity.id, 1)"
							>
								+1
							</button>
						</div>
					</div>

					<!-- Skill Points (SP) -->
					<div class="char-sp-box">
						<span class="sp-icon">⭐</span>
						<span class="sp-label">Очки навыков (SP):</span>
						<div class="sp-controls">
							<button type="button" class="sp-btn" @click="adjustCharSP(-1)">-</button>
							<span class="sp-val">{{ character.skill_points ?? 0 }}</span>
							<button type="button" class="sp-btn" @click="adjustCharSP(1)">+</button>
						</div>
					</div>

					<!-- Total Character Level -->
					<div class="char-total-lvl-box">
						<span class="ctb-label">Ур. персонажа:</span>
						<div class="ctb-controls">
							<button type="button" class="ctb-btn" @click="adjustCharLevel(-1)">-1</button>
							<span class="ctb-val">{{ character.lvl || 1 }}</span>
							<button type="button" class="ctb-btn" @click="adjustCharLevel(1)">+1</button>
						</div>
					</div>
				</div>
			</div>

			<!-- UNIFIED SKILL TREE CANVAS (Identical to Test Menu "Древо навыков и прокачки") -->
			<div class="tree-canvas-container-outer">
				<SkillTreeCanvas
					:entity="activeEntity"
					:entity-type="type"
					:entity-level="getEntityLevel(activeEntity.id)"
					:entity-max-level="getEntityMaxLvl(activeEntity)"
					:character="character"
					:is-strict-mode="isStrictMode"
					:can-level-up-status="canLevelUpCurrentEntityStatus"
					:all-known-skills="allKnownSkills"
					@learn-skill="handleLearnSkill"
					@upgrade-skill="handleAdjustRank"
					@downgrade-skill="handleDowngradeSkill"
					@unlearn-skill="handleUnlearnSkill"
					@unlock-level="handleUnlockLevel"
					@reset-skills="handleResetSkills"
				>
					<template #toolbar-actions>
						<!-- Strict Mode Toggle -->
						<label
							class="strict-mode-toggle"
							title="В строгом режиме учитываются требования уровня и предков. В свободном режиме GM можно изучать любые навыки."
						>
							<input
								v-model="isStrictMode"
								type="checkbox"
								class="strict-checkbox"
							/>
							<span class="strict-text">
								{{ isStrictMode ? '🔒 Строгая проверка' : '🔓 Свободный выбор (GM)' }}
							</span>
						</label>

						<!-- Reset Skills Button -->
						<button
							type="button"
							class="reset-entity-skills-btn"
							title="Сбросить все изученные навыки этой сущности"
							@click="handleResetSkills"
						>
							🔄 Сбросить навыки
						</button>
					</template>
				</SkillTreeCanvas>
			</div>
		</div>

		<!-- Fallback when no classes/races are assigned at all -->
		<div v-else class="no-entity-selected-alert">
			<div class="nesa-content">
				<span class="nesa-icon">🌳</span>
				<h3 class="nesa-title">
					{{ type === 'classes' ? 'Классы персонажа не выбраны' : 'Расы персонажа не выбраны' }}
				</h3>
				<p class="nesa-desc">
					{{
						type === 'classes'
							? 'Нажмите кнопку «➕ Древо классов» выше, чтобы открыть иерархию специализаций и назначить персонажу классы.'
							: 'Нажмите кнопку «➕ Древо рас» выше, чтобы открыть иерархию семейств и назначить персонажу расы.'
					}}
				</p>
				<button
					type="button"
					class="nesa-open-btn"
					@click="isTreePickerOpen = true"
				>
					<span>➕ Открыть древо выбора</span>
				</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import SkillTreeCanvas from './SkillTreeCanvas.vue'
import ClassRaceTreeDrawer from './ClassRaceTreeDrawer.vue'
import {
	canLevelUpEntity,
	getEntityMaxLevel
} from '@/utils/skillTree.js'

const props = defineProps({
	character: {
		type: Object,
		required: true
	},
	type: {
		type: String,
		default: 'classes' // 'classes' | 'races'
	},
	classesList: {
		type: Array,
		default: () => []
	},
	racesList: {
		type: Array,
		default: () => []
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

const emit = defineEmits(['change'])

const activeEntityId = ref(null)
const isStrictMode = ref(true)
const isTreePickerOpen = ref(false)

const entitiesPool = computed(() => {
	return props.type === 'classes' ? props.classesList : props.racesList
})

const assignedIds = computed(() => {
	if (props.type === 'classes') {
		return Array.isArray(props.character.classs) ? props.character.classs : []
	}
	return Array.isArray(props.character.races) ? props.character.races : []
})

const assignedEntities = computed(() => {
	return entitiesPool.value.filter((e) => assignedIds.value.includes(e.id))
})

const activeEntity = computed(() => {
	if (!assignedEntities.value.length) return null
	if (activeEntityId.value) {
		const found = assignedEntities.value.find((e) => e.id === activeEntityId.value)
		if (found) return found
	}
	return assignedEntities.value[0] || null
})

// Auto-select first entity if activeEntityId is invalid
watch(
	() => assignedEntities.value,
	(newList) => {
		if (newList.length > 0) {
			if (!activeEntityId.value || !newList.some((e) => e.id === activeEntityId.value)) {
				activeEntityId.value = newList[0].id
			}
		} else {
			activeEntityId.value = null
			isTreePickerOpen.value = true
		}
	},
	{ immediate: true }
)

const activeEntitySkills = computed(() => {
	return activeEntity.value?.skills || []
})

const allKnownSkills = computed(() => {
	return [...props.classesList, ...props.racesList].flatMap((e) => e.skills || [])
})

function handleNodeSelect(node) {
	if (!node || !node.id) return
	if (isEntityAssigned(node.id)) {
		activeEntityId.value = node.id
	}
}

function handleToggleAssignNode(node) {
	if (!node || !node.id) return
	toggleEntityAssignment(node.id)
}

function isEntityAssigned(id) {
	return assignedIds.value.includes(id)
}

function toggleEntityAssignment(id) {
	if (isEntityAssigned(id)) {
		removeEntityFromCharacter(id)
	} else {
		addEntityToCharacter(id)
	}
}

function addEntityToCharacter(entityId) {
	if (props.type === 'classes') {
		if (!Array.isArray(props.character.classs)) props.character.classs = []
		if (!props.character.classs.includes(entityId)) {
			props.character.classs.push(entityId)
			if (!props.character.class_levels) props.character.class_levels = {}
			if (!props.character.class_levels[entityId]) props.character.class_levels[entityId] = 1
		}
	} else {
		if (!Array.isArray(props.character.races)) props.character.races = []
		if (!props.character.races.includes(entityId)) {
			props.character.races.push(entityId)
			if (!props.character.race_levels) props.character.race_levels = {}
			if (!props.character.race_levels[entityId]) props.character.race_levels[entityId] = 1
		}
	}
	activeEntityId.value = entityId
	emit('change')
}

function removeEntityFromCharacter(entityId) {
	if (props.type === 'classes') {
		if (!Array.isArray(props.character.classs)) return
		const idx = props.character.classs.indexOf(entityId)
		if (idx !== -1) props.character.classs.splice(idx, 1)
	} else {
		if (!Array.isArray(props.character.races)) return
		const idx = props.character.races.indexOf(entityId)
		if (idx !== -1) props.character.races.splice(idx, 1)
	}
	if (activeEntityId.value === entityId) {
		activeEntityId.value = assignedIds.value[0] || null
	}
	emit('change')
}

function getEntityLevel(entityId) {
	if (props.type === 'classes') {
		return props.character.class_levels?.[entityId] || 1
	}
	return props.character.race_levels?.[entityId] || 1
}

function getEntityMaxLvl(entity) {
	return getEntityMaxLevel(entity)
}

function adjustEntityLevel(entityId, delta) {
	const max = getEntityMaxLvl(activeEntity.value)
	if (props.type === 'classes') {
		if (!props.character.class_levels) props.character.class_levels = {}
		const cur = props.character.class_levels[entityId] || 1
		props.character.class_levels[entityId] = Math.max(1, Math.min(max, cur + delta))
	} else {
		if (!props.character.race_levels) props.character.race_levels = {}
		const cur = props.character.race_levels[entityId] || 1
		props.character.race_levels[entityId] = Math.max(1, Math.min(max, cur + delta))
	}
	emit('change')
}

function getEntityNameById(id) {
	const found = entitiesPool.value.find((e) => e.id === id)
	return found?.name || id
}

function getLearnedCountForEntity(ent) {
	const skills = ent.skills || []
	const charSkills = props.character.skills || {}
	return skills.filter((s) => (charSkills[s.id] || 0) > 0).length
}

const canLevelUpCurrentEntityStatus = computed(() => {
	if (!activeEntity.value) return { canLevelUp: false, reasons: ['Сущность не выбрана'] }
	if (!isStrictMode.value) return { canLevelUp: true, reasons: [] }
	const allList = entitiesPool.value
	const charProgression = {
		id: props.character.id,
		char_level: props.character.lvl || 1,
		skill_points: props.character.skill_points ?? 0,
		level_points: props.character.level_points ?? 5,
		class_levels: props.character.class_levels || {},
		race_levels: props.character.race_levels || {},
		skills: props.character.skills || {}
	}
	return canLevelUpEntity(activeEntity.value, props.type, charProgression, allList)
})

function handleUnlockLevel() {
	adjustEntityLevel(activeEntity.value.id, 1)
}

function handleLearnSkill(skillId, skillDef) {
	ensureSkillsStructure()
	const cost = skillDef.cost || 1
	if (isStrictMode.value && (props.character.skill_points ?? 0) >= cost) {
		props.character.skill_points -= cost
	}
	props.character.skills[skillId] = 1
	syncAbilitiesWithSkills()
	emit('change')
}

function handleAdjustRank(skillId, delta, skillDef) {
	ensureSkillsStructure()
	const cur = props.character.skills[skillId] || 1
	const max = skillDef.max_level || 1
	const next = Math.max(1, Math.min(max, cur + delta))

	if (next > cur && isStrictMode.value) {
		const cost = skillDef.cost || 1
		if ((props.character.skill_points ?? 0) >= cost) {
			props.character.skill_points -= cost
		}
	} else if (next < cur && isStrictMode.value) {
		const cost = skillDef.cost || 1
		props.character.skill_points = (props.character.skill_points ?? 0) + cost
	}

	props.character.skills[skillId] = next
	syncAbilitiesWithSkills()
	emit('change')
}

function handleDowngradeSkill(skillId, skillDef) {
	handleAdjustRank(skillId, -1, skillDef)
}

function handleUnlearnSkill(skillId, skillDef) {
	ensureSkillsStructure()
	const rank = props.character.skills[skillId] || 1
	const cost = (skillDef?.cost || 1) * rank

	delete props.character.skills[skillId]
	if (isStrictMode.value) {
		props.character.skill_points = (props.character.skill_points ?? 0) + cost
	}
	syncAbilitiesWithSkills()
	emit('change')
}

function handleResetSkills() {
	if (!props.character.skills) return
	let refunded = 0
	for (const sk of activeEntitySkills.value) {
		const rank = props.character.skills[sk.id]
		if (rank) {
			refunded += (sk.cost || 1) * rank
			delete props.character.skills[sk.id]
		}
	}
	if (isStrictMode.value) {
		props.character.skill_points = (props.character.skill_points ?? 0) + refunded
	}
	syncAbilitiesWithSkills()
	emit('change')
}

function ensureSkillsStructure() {
	if (!props.character.skills || typeof props.character.skills !== 'object') {
		props.character.skills = {}
	}
}

function syncAbilitiesWithSkills() {
	if (!Array.isArray(props.character.abilities)) {
		props.character.abilities = []
	}
	const charSkills = props.character.skills || {}
	const all = allKnownSkills.value

	for (const [skillId, rank] of Object.entries(charSkills)) {
		const skillDef = all.find((s) => s.id === skillId)
		if (skillDef) {
			const existing = props.character.abilities.find((a) => a.id === skillId)
			if (existing) {
				existing.rank = rank
			} else {
				props.character.abilities.push({
					id: skillDef.id,
					name: skillDef.name || skillDef.id,
					icon: skillDef.icon || '⚔️',
					description: skillDef.description || '',
					rank,
					branch: skillDef.branch || '',
					data: skillDef.data || {}
				})
			}
		}
	}

	props.character.abilities = props.character.abilities.filter((a) => {
		const isFromTree = all.some((s) => s.id === a.id)
		if (isFromTree) {
			return (charSkills[a.id] || 0) > 0
		}
		return true
	})
}

function adjustCharLevel(delta) {
	const cur = props.character.lvl || 1
	props.character.lvl = Math.max(1, Math.min(100, cur + delta))
	emit('change')
}

function adjustCharSP(delta) {
	const cur = props.character.skill_points ?? 0
	props.character.skill_points = Math.max(0, cur + delta)
	emit('change')
}

function formatTier(tier) {
	const t = String(tier || 'basic').toLowerCase()
	if (t === 'advanced' || t === 'high') return 'Высший'
	if (t === 'rare' || t === 'secret') return 'Редкий'
	return 'Базовый'
}
</script>

<style scoped>
.char-skills-tab {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	color: #e2e8f0;
}

/* Top Entity Selector Bar */
.entity-selector-bar {
	background: rgba(18, 26, 43, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 0.8em 1.2em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1em;
	flex-wrap: wrap;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.35);
}

.esb-left {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-weight: 700;
	font-size: 1.05em;
	color: #f8fafc;
}

.esb-icon {
	font-size: 1.3em;
}

.esb-chips-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	flex-wrap: wrap;
}

.entity-chip-item {
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.12);
	color: #cbd5e1;
	border-radius: 0.45em;
	padding: 0.35em 0.8em;
	display: flex;
	align-items: center;
	gap: 0.5em;
	cursor: pointer;
	font-size: 0.9em;
	transition: all 0.15s;
}

.entity-chip-item:hover {
	background: rgba(255, 255, 255, 0.1);
	border-color: rgba(255, 255, 255, 0.25);
}

.entity-chip-item.__active {
	background: rgba(59, 130, 246, 0.25);
	border-color: #3b82f6;
	color: #93c5fd;
	font-weight: bold;
	box-shadow: 0 0 0.6em rgba(59, 130, 246, 0.3);
}

.ecb-icon {
	font-size: 1.1em;
}

.ecb-name {
	font-weight: 600;
}

.ecb-lvl-tag {
	background: rgba(0, 0, 0, 0.35);
	color: #fde68a;
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
	font-size: 0.8em;
}

.ecb-badge {
	background: rgba(16, 185, 129, 0.15);
	border: 1px solid rgba(16, 185, 129, 0.3);
	color: #6ee7b7;
	padding: 0.1em 0.4em;
	border-radius: 0.3em;
	font-size: 0.78em;
}

.ecb-remove-btn {
	background: transparent;
	border: none;
	color: #94a3b8;
	font-size: 0.85em;
	cursor: pointer;
	padding: 0.1em 0.3em;
	border-radius: 0.2em;
	transition: color 0.15s;
}

.ecb-remove-btn:hover {
	color: #f87171;
	background: rgba(239, 68, 68, 0.15);
}

.open-tree-picker-btn {
	background: rgba(16, 185, 129, 0.15);
	border: 1px solid rgba(16, 185, 129, 0.35);
	color: #6ee7b7;
	border-radius: 0.45em;
	padding: 0.4em 0.9em;
	font-size: 0.88em;
	font-weight: 600;
	cursor: pointer;
	display: flex;
	align-items: center;
	gap: 0.4em;
	transition: all 0.15s;
	font-family: Kurale, sans-serif;
}

.open-tree-picker-btn:hover {
	background: rgba(16, 185, 129, 0.3);
	border-color: #10b981;
	color: #a7f3d0;
}

/* Skills Workspace */
.skills-workspace {
	display: flex;
	flex-direction: column;
	gap: 1em;
	width: 100%;
}

/* Entity Header Card */
.entity-header-card {
	background: rgba(18, 26, 43, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 1em 1.4em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1.5em;
	flex-wrap: wrap;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.35);
}

.ehc-left {
	display: flex;
	align-items: center;
	gap: 1em;
	flex: 1;
	min-width: 18em;
}

.ehc-icon {
	font-size: 2.2em;
	background: rgba(255, 255, 255, 0.05);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	width: 1.6em;
	height: 1.6em;
	display: flex;
	align-items: center;
	justify-content: center;
}

.ehc-titles {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.ehc-title-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	flex-wrap: wrap;
}

.ehc-name {
	font-size: 1.25em;
	font-weight: 700;
	color: #f8fafc;
	font-family: Overlord, Kurale, serif;
}

.ehc-id {
	font-size: 0.8em;
	color: #64748b;
}

.ehc-tier-pill {
	font-size: 0.72em;
	font-weight: 700;
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.ehc-tier-pill.__tier-basic {
	background: rgba(59, 130, 246, 0.2);
	border: 1px solid #3b82f6;
	color: #bfdbfe;
}

.ehc-tier-pill.__tier-high,
.ehc-tier-pill.__tier-advanced {
	background: rgba(168, 85, 247, 0.2);
	border: 1px solid #a855f7;
	color: #e9d5ff;
}

.ehc-tier-pill.__tier-rare,
.ehc-tier-pill.__tier-secret {
	background: rgba(245, 158, 11, 0.2);
	border: 1px solid #f59e0b;
	color: #fde68a;
}

.ehc-parent-pill {
	font-size: 0.75em;
	background: rgba(255, 255, 255, 0.08);
	color: #cbd5e1;
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
}

.ehc-desc {
	font-size: 0.82em;
	color: #94a3b8;
	line-height: 1.35;
	max-width: 40em;
}

.ehc-right {
	display: flex;
	align-items: center;
	gap: 1em;
	flex-wrap: wrap;
}

.char-lvl-box,
.char-sp-box,
.char-total-lvl-box {
	display: flex;
	align-items: center;
	gap: 0.4em;
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.4em;
	padding: 0.35em 0.7em;
	font-size: 0.85em;
}

.clb-label,
.sp-label,
.ctb-label {
	color: #94a3b8;
}

.clb-controls,
.sp-controls,
.ctb-controls {
	display: flex;
	align-items: center;
	gap: 0.35em;
}

.clb-btn,
.sp-btn,
.ctb-btn {
	background: rgba(255, 255, 255, 0.1);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #f8fafc;
	border-radius: 0.25em;
	padding: 0.1em 0.4em;
	font-size: 0.8em;
	font-weight: bold;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s;
}

.clb-btn:hover,
.sp-btn:hover,
.ctb-btn:hover {
	background: rgba(255, 255, 255, 0.25);
}

.clb-val,
.sp-val,
.ctb-val {
	font-weight: 700;
	color: #f8fafc;
	min-width: 1.8em;
	text-align: center;
}

.sp-val {
	color: #fde68a;
}

/* Tree Canvas Outer Container */
.tree-canvas-container-outer {
	width: 100%;
	height: 38em;
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	overflow: hidden;
	display: flex;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.4);
}

/* Strict Mode & Reset in Toolbar Actions */
.strict-mode-toggle {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.82em;
	color: #cbd5e1;
	cursor: pointer;
	user-select: none;
	background: rgba(0, 0, 0, 0.3);
	padding: 0.25em 0.6em;
	border-radius: 0.35em;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.strict-checkbox {
	accent-color: #3b82f6;
	cursor: pointer;
}

.reset-entity-skills-btn {
	background: rgba(239, 68, 68, 0.15);
	border: 1px solid rgba(239, 68, 68, 0.35);
	color: #fca5a5;
	border-radius: 0.35em;
	padding: 0.25em 0.65em;
	font-size: 0.8em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s;
}

.reset-entity-skills-btn:hover {
	background: rgba(239, 68, 68, 0.3);
}

/* No Entity Alert */
.no-entity-selected-alert {
	background: rgba(18, 26, 43, 0.7);
	border: 1px dashed rgba(255, 255, 255, 0.15);
	border-radius: 0.6em;
	padding: 3em;
	display: flex;
	justify-content: center;
	align-items: center;
	text-align: center;
}

.nesa-content {
	max-width: 32em;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.8em;
}

.nesa-icon {
	font-size: 3em;
}

.nesa-title {
	margin: 0;
	font-size: 1.3em;
	color: #f8fafc;
}

.nesa-desc {
	margin: 0;
	font-size: 0.88em;
	color: #94a3b8;
	line-height: 1.4;
}

.nesa-open-btn {
	background: #3b82f6;
	border: 1px solid #60a5fa;
	color: #fff;
	border-radius: 0.4em;
	padding: 0.5em 1.2em;
	font-size: 0.9em;
	font-weight: 700;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background 0.15s;
	margin-top: 0.5em;
}

.nesa-open-btn:hover {
	background: #2563eb;
}
</style>
