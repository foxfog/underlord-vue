<template>
	<div class="char-stats-tab">
		<!-- 1. Active Race Banner Card -->
		<div class="active-race-banner-card">
			<div class="arbc-left">
				<span class="arbc-race-icon">{{ activeRaceConfig.icon || '🧬' }}</span>
				<div class="arbc-titles">
					<div class="arbc-title-row">
						<span class="arbc-label">Активная раса тела:</span>
						<strong class="arbc-race-name">{{ activeRaceConfig.name }}</strong>
						<span class="arbc-badge __active-badge">⭐ Активна</span>
						<span class="arbc-tier-pill" :class="`__tier-${activeRaceConfig.tier || 'basic'}`">
							{{ formatTier(activeRaceConfig.tier) }}
						</span>
					</div>
					<p class="arbc-desc">
						Активная раса задаёт <strong>начальные параметры</strong> и <strong>коэффициенты скейлинга</strong> атрибутов.
						Все изученные навыки и пассивки других рас сохраняются в книге умений!
					</p>
				</div>
			</div>

			<div class="arbc-right">
				<!-- Active Race Switcher Dropdown -->
				<div class="race-switcher-box">
					<label class="rsb-label">Сменить активную расу:</label>
					<select
						class="editor-select rsb-select"
						:value="currentActiveRaceId"
						@change="handleSelectActiveRace($event.target.value)"
					>
						<optgroup v-if="characterAssignedRaces.length > 0" label="Расы персонажа">
							<option
								v-for="r in characterAssignedRaces"
								:key="'car-' + r.id"
								:value="r.id"
							>
								{{ r.icon || '🧬' }} {{ r.name }} (Назначена)
							</option>
						</optgroup>
						<optgroup label="Все доступные расы">
							<option
								v-for="r in allRacesPool"
								:key="'ar-' + r.id"
								:value="r.id"
							>
								{{ r.icon || '🧬' }} {{ r.name }}
							</option>
						</optgroup>
					</select>
				</div>
			</div>
		</div>

		<!-- 2. Progression & Free Points Toolbar -->
		<div class="stats-top-toolbar">
			<!-- Character Level Box -->
			<div class="stat-ctrl-box">
				<span class="scb-icon">🎖️</span>
				<div class="scb-info">
					<span class="scb-label">Уровень персонажа:</span>
					<div class="scb-controls">
						<button
							type="button"
							class="scb-btn"
							:disabled="(character.lvl || 1) <= 1"
							@click="adjustCharLevel(-1)"
						>
							-1
						</button>
						<strong class="scb-val">{{ character.lvl || 1 }}</strong>
						<button
							type="button"
							class="scb-btn"
							@click="adjustCharLevel(1)"
						>
							+1
						</button>
					</div>
				</div>
			</div>

			<!-- Free Attribute Points Box -->
			<div class="stat-ctrl-box __free-points">
				<span class="scb-icon">⭐</span>
				<div class="scb-info">
					<span class="scb-label">Свободные очки характеристик:</span>
					<div class="scb-controls">
						<strong class="scb-val __highlight">{{ freePoints }}</strong>
						<button
							type="button"
							class="editor-btn editor-btn-sm"
							title="Добавить 5 свободных очков (эквивалент 1 уровня)"
							@click="addPoints(5)"
						>
							+5 очков
						</button>
						<button
							type="button"
							class="editor-btn editor-btn-sm __reset-btn"
							title="Сбросить распределённые характеристики"
							@click="handleResetAttributes"
						>
							🔄 Сброс
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- 3. Core Attributes Allocation Grid (Strength, Endurance, Agility, Intelligence) -->
		<section class="attributes-section">
			<div class="sec-header">
				<span class="sec-icon">💪</span>
				<h4 class="sec-title">Основные характеристики (Core Attributes)</h4>
				<span class="sec-subtitle">
					Изначально равны 0. Очки экипировки и пассивок прибавляются к телу и масштабируются переработчиками расы.
				</span>
			</div>

			<div class="attributes-grid">
				<div
					v-for="attr in attributeConfigs"
					:key="attr.id"
					class="attribute-card"
					:class="`__${attr.id}`"
				>
					<div class="attr-header">
						<span class="attr-icon">{{ attr.icon }}</span>
						<div class="attr-names">
							<strong class="attr-title">{{ attr.name }}</strong>
							<span class="attr-key">{{ attr.keyLabel }}</span>
						</div>
						<div class="attr-total-badge" title="Итоговое значение со всеми бонусами">
							Итог: <strong>{{ calculatedStats.attributes.total[attr.id] }}</strong>
						</div>
					</div>

					<!-- Allocation Row -->
					<div class="attr-allocation-row">
						<div class="aar-left">
							<span class="aar-label">Родные очки:</span>
							<div class="aar-stepper">
								<button
									type="button"
									class="aar-btn"
									:disabled="currentAttributes[attr.id] <= 0"
									@click="handleInvest(attr.id, -1)"
								>
									-
								</button>
								<strong class="aar-val">{{ currentAttributes[attr.id] || 0 }}</strong>
								<button
									type="button"
									class="aar-btn"
									:disabled="freePoints <= 0"
									@click="handleInvest(attr.id, 1)"
								>
									+
								</button>
							</div>
						</div>

						<div class="aar-bonuses">
							<span
								v-if="calculatedStats.attributes.passives[attr.id] > 0"
								class="bonus-tag __passive"
								:title="`+${calculatedStats.attributes.passives[attr.id]} от пассивных навыков`"
							>
								+{{ calculatedStats.attributes.passives[attr.id] }} пасс.
							</span>
							<span
								v-if="calculatedStats.attributes.equipment[attr.id] > 0"
								class="bonus-tag __equip"
								:title="`+${calculatedStats.attributes.equipment[attr.id]} от экипировки`"
							>
								+{{ calculatedStats.attributes.equipment[attr.id] }} экип.
							</span>
						</div>
					</div>

					<!-- Active Race Converter Preview -->
					<div class="attr-converter-preview">
						<span class="acp-label">Скейл активной расы (1 {{ attr.shortName }}):</span>
						<div class="acp-tags">
							<span
								v-for="(val, statKey) in getConverterDisplay(attr.id)"
								:key="statKey"
								class="acp-tag"
							>
								+{{ val }}{{ isPercentKey(statKey) ? '%' : '' }} {{ formatStatName(statKey) }}
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- 4. Calculated Combat Stats with 5-Step Pipeline Breakdown -->
		<section class="combat-stats-section">
			<div class="sec-header">
				<span class="sec-icon">⚔️</span>
				<h4 class="sec-title">Итоговые боевые параметры и конвейер вычислений</h4>
				<span class="sec-subtitle">
					Полная прозрачная формула: [База расы] + [Скейл атрибутов] + [Пассивки] + [Экипировка] × (1 + Σ %) = Итог
				</span>
			</div>

			<div class="combat-stats-grid">
				<div
					v-for="st in combatStatConfigs"
					:key="st.id"
					class="stat-card"
				>
					<div class="st-header">
						<span class="st-icon">{{ st.icon }}</span>
						<span class="st-name">{{ st.name }}</span>
						<strong class="st-final-value">{{ calculatedStats.stats[st.id] }}{{ st.isPercent ? '%' : '' }}</strong>
					</div>

					<!-- Pipeline Breakdown Steps -->
					<div class="st-breakdown-box">
						<div class="sbb-step">
							<span class="sbb-label">База расы:</span>
							<span class="sbb-val">{{ calculatedStats.breakdown[st.id]?.raceBase || 0 }}{{ st.isPercent ? '%' : '' }}</span>
						</div>
						<div class="sbb-step">
							<span class="sbb-label">+ От характеристик:</span>
							<span class="sbb-val __plus">+{{ calculatedStats.breakdown[st.id]?.converted || 0 }}{{ st.isPercent ? '%' : '' }}</span>
						</div>
						<div
							v-if="(calculatedStats.breakdown[st.id]?.flatPassives || 0) > 0"
							class="sbb-step"
						>
							<span class="sbb-label">+ Пассивки (flat):</span>
							<span class="sbb-val __plus">+{{ calculatedStats.breakdown[st.id]?.flatPassives }}{{ st.isPercent ? '%' : '' }}</span>
						</div>
						<div
							v-if="(calculatedStats.breakdown[st.id]?.flatEquip || 0) > 0"
							class="sbb-step"
						>
							<span class="sbb-label">+ Экипировка (flat):</span>
							<span class="sbb-val __plus">+{{ calculatedStats.breakdown[st.id]?.flatEquip }}{{ st.isPercent ? '%' : '' }}</span>
						</div>
						<div class="sbb-step __pre-percent">
							<span class="sbb-label">= До процентов:</span>
							<strong class="sbb-val">{{ calculatedStats.breakdown[st.id]?.prePercent || 0 }}{{ st.isPercent ? '%' : '' }}</strong>
						</div>
						<div
							v-if="(calculatedStats.breakdown[st.id]?.totalPercent || 0) !== 0"
							class="sbb-step __percent"
						>
							<span class="sbb-label">× Проценты (аддитивно):</span>
							<span class="sbb-val __percent-val">
								+{{ calculatedStats.breakdown[st.id]?.totalPercent }}%
								<span
									v-if="calculatedStats.breakdown[st.id]?.percentPassives > 0 && calculatedStats.breakdown[st.id]?.percentEquip > 0"
									class="sbb-pct-detail"
								>
									({{ calculatedStats.breakdown[st.id]?.percentPassives }}% пасс. + {{ calculatedStats.breakdown[st.id]?.percentEquip }}% экип.)
								</span>
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>

		<!-- 5. Resistances Breakdown -->
		<section v-if="hasResistances" class="resistances-section">
			<div class="sec-header">
				<span class="sec-icon">🛡️</span>
				<h4 class="sec-title">Сопротивляемости и защиты (Resistances)</h4>
			</div>
			<div class="resistances-grid">
				<div
					v-for="(val, resKey) in (calculatedStats.stats.res || calculatedStats.stats.resistances)"
					:key="resKey"
					class="res-badge"
					:class="{ __positive: val > 0, __negative: val < 0 }"
				>
					<span class="res-name">{{ formatResName(resKey) }}:</span>
					<strong class="res-val">{{ val > 0 ? '+' + val : val }}%</strong>
				</div>
			</div>
		</section>
	</div>
</template>

<script setup>
import { computed, reactive } from 'vue'
import { useCharacterStats } from '@/composables/useCharacterStats.js'

const props = defineProps({
	character: {
		type: Object,
		required: true
	},
	racesList: {
		type: Array,
		default: () => []
	},
	itemsList: {
		type: Array,
		default: () => []
	},
	skillsCatalog: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['change'])

const {
	initCharacterStats,
	getCharacterStatsState,
	investAttribute,
	refundAttribute,
	resetAttributes,
	addFreeAttributePoints,
	setActiveRace,
	getRaceStatsConfig,
	getCalculatedStats
} = useCharacterStats()

const charStatsState = computed(() => {
	return initCharacterStats(props.character.id || 'mc', props.character)
})

const currentActiveRaceId = computed(() => {
	return props.character.active_race || charStatsState.value.active_race || 'human'
})

const allRacesPool = computed(() => {
	return props.racesList || []
})

const characterAssignedRaces = computed(() => {
	const ids = Array.isArray(props.character.races) ? props.character.races : []
	return allRacesPool.value.filter((r) => ids.includes(r.id))
})

const activeRaceConfig = computed(() => {
	return getRaceStatsConfig(currentActiveRaceId.value, allRacesPool.value)
})

const freePoints = computed(() => {
	return charStatsState.value.free_attribute_points ?? 5
})

const currentAttributes = computed(() => {
	return {
		str: charStatsState.value.str ?? charStatsState.value.strength ?? 0,
		end: charStatsState.value.end ?? charStatsState.value.endurance ?? 0,
		agi: charStatsState.value.agi ?? charStatsState.value.agility ?? 0,
		int: charStatsState.value.int ?? charStatsState.value.intelligence ?? 0,
		strength: charStatsState.value.str ?? charStatsState.value.strength ?? 0,
		endurance: charStatsState.value.end ?? charStatsState.value.endurance ?? 0,
		agility: charStatsState.value.agi ?? charStatsState.value.agility ?? 0,
		intelligence: charStatsState.value.int ?? charStatsState.value.intelligence ?? 0
	}
})

// Resolve equipped items
const equippedItemsObjects = computed(() => {
	const slots = props.character.equipment_slots || {}
	const equippedIds = Object.values(slots).filter(Boolean)
	return (props.itemsList || []).filter((item) => equippedIds.includes(item.id))
})

// Resolve learned passive skills
const learnedPassivesObjects = computed(() => {
	const skillsMap = props.character.skills || {}
	const learnedIds = Object.keys(skillsMap).filter((k) => skillsMap[k] > 0)
	return (props.skillsCatalog || []).filter((s) => learnedIds.includes(s.id) && s.category === 'passive')
})

// Calculated stats
const calculatedStats = computed(() => {
	return getCalculatedStats(props.character.id || 'mc', {
		character: props.character,
		racesData: allRacesPool.value,
		equipmentItems: equippedItemsObjects.value,
		learnedSkills: learnedPassivesObjects.value,
		level: props.character.lvl || 1
	})
})

const hasResistances = computed(() => {
	const res = calculatedStats.value.stats.res || calculatedStats.value.stats.resistances
	return res && Object.keys(res).length > 0
})

const attributeConfigs = [
	{ id: 'str', name: 'Сила', shortName: 'Силы', keyLabel: 'Strength / STR', icon: '💪' },
	{ id: 'end', name: 'Выносливость', shortName: 'Выносливости', keyLabel: 'Endurance / END', icon: '🛡️' },
	{ id: 'agi', name: 'Ловкость', shortName: 'Ловкости', keyLabel: 'Agility / AGI', icon: '⚡' },
	{ id: 'int', name: 'Интеллект', shortName: 'Интеллекта', keyLabel: 'Intelligence / INT', icon: '🔮' }
]

const combatStatConfigs = [
	{ id: 'hp', name: 'Здоровье (HP)', icon: '❤️' },
	{ id: 'mp', name: 'Мана (MP)', icon: '🔷' },
	{ id: 'atk_phys', name: 'Физ. атака (Atk)', icon: '⚔️' },
	{ id: 'def_phys', name: 'Физ. защита (Def)', icon: '🛡️' },
	{ id: 'atk_mag', name: 'Маг. атака (M.Atk)', icon: '✨' },
	{ id: 'def_mag', name: 'Маг. защита (M.Def)', icon: '🔮' },
	{ id: 'spd', name: 'Скорость / Перемещение', icon: '👟' },
	{ id: 'init', name: 'Инициатива (Init)', icon: '⚡' },
	{ id: 'crit_chance', name: 'Шанс крит. урона', icon: '🎯', isPercent: true },
	{ id: 'crit_dmg', name: 'Крит. урон', icon: '💥', isPercent: true }
]

function isPercentKey(key) {
	if (!key) return false
	return key === 'crit_chance' || key === 'crit_rate' || key === 'crit_dmg' || key === 'crit_damage' || key.startsWith('res.') || key.startsWith('resistances.')
}

function getConverterDisplay(attrId) {
	const convs = activeRaceConfig.value.attribute_converters || activeRaceConfig.value.converters || {}
	const conv = convs[attrId] || convs[attrId === 'str' ? 'strength' : attrId === 'end' ? 'endurance' : attrId === 'agi' ? 'agility' : attrId === 'int' ? 'intelligence' : attrId] || {}
	const res = {}
	for (const [k, v] of Object.entries(conv)) {
		if (k === 'resistances' || k === 'res') {
			if (typeof v === 'object' && v !== null) {
				for (const [resK, resV] of Object.entries(v)) {
					if (resV > 0) res[`res.${resK}`] = resV
				}
			}
			continue
		}
		if (v > 0) res[k] = v
	}
	return res
}

function formatStatName(statKey) {
	const map = {
		hp: 'HP',
		mp: 'MP',
		atk_phys: 'Физ.Атака',
		def_phys: 'Физ.Защита',
		atk_mag: 'Маг.Атака',
		def_mag: 'Маг.Защита',
		spd: 'Скорость',
		speed: 'Скорость',
		init: 'Инициатива',
		initiative: 'Инициатива',
		crit_chance: 'Крит.Шанс',
		crit_rate: 'Крит.Шанс',
		crit_dmg: 'Крит.Урон',
		crit_damage: 'Крит.Урон',
		'res.physical': 'Физ.Сопр',
		'res.water': 'Сопр.Вода',
		'res.fire': 'Сопр.Огонь',
		'res.cold': 'Сопр.Холод',
		'res.lightning': 'Сопр.Молния',
		'res.poison': 'Сопр.Яд',
		'res.holy': 'Сопр.Свет',
		'res.dark': 'Сопр.Тьма'
	}
	return map[statKey] || statKey
}

function formatResName(resKey) {
	const map = {
		physical: 'Физический',
		water: 'Вода',
		fire: 'Огонь',
		cold: 'Холод',
		lightning: 'Молния',
		poison: 'Яд',
		holy: 'Свет',
		dark: 'Тьма',
		nature: 'Природа'
	}
	return map[resKey] || resKey
}

function formatTier(tier) {
	const map = { basic: 'Базовая', advanced: 'Продвинутая', rare: 'Редкая' }
	return map[tier] || tier || 'Базовая'
}

function handleSelectActiveRace(raceId) {
	setActiveRace(props.character.id || 'mc', raceId, props.character)
	emit('change')
}

function adjustCharLevel(delta) {
	const current = props.character.lvl || 1
	const next = Math.max(1, current + delta)
	props.character.lvl = next
	if (delta > 0) {
		addFreeAttributePoints(props.character.id || 'mc', 5, props.character)
	}
	emit('change')
}

function addPoints(amount) {
	addFreeAttributePoints(props.character.id || 'mc', amount, props.character)
	emit('change')
}

function handleInvest(attrId, delta) {
	if (delta > 0) {
		investAttribute(props.character.id || 'mc', attrId, 1, props.character)
	} else {
		refundAttribute(props.character.id || 'mc', attrId, 1, props.character)
	}
	emit('change')
}

function handleResetAttributes() {
	resetAttributes(props.character.id || 'mc', props.character)
	emit('change')
}
</script>

<style scoped>
.char-stats-tab {
	display: flex;
	flex-direction: column;
	gap: 1.25em;
	padding: 0.25em 0;
	font-size: 1em;
}

/* 1. Active Race Banner Card */
.active-race-banner-card {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 1.5em;
	padding: 1.2em 1.5em;
	background: linear-gradient(135deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%);
	border: 1px solid rgba(234, 179, 8, 0.4);
	border-radius: 0.6em;
	box-shadow: 0 0.25em 1em rgba(0, 0, 0, 0.3);
}

.arbc-left {
	display: flex;
	align-items: center;
	gap: 1.2em;
}

.arbc-race-icon {
	font-size: 2.4em;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 1.4em;
	height: 1.4em;
	background: rgba(234, 179, 8, 0.15);
	border: 1px solid rgba(234, 179, 8, 0.5);
	border-radius: 0.4em;
}

.arbc-titles {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.arbc-title-row {
	display: flex;
	align-items: center;
	gap: 0.6em;
	flex-wrap: wrap;
}

.arbc-label {
	font-size: 0.9em;
	color: #94a3b8;
}

.arbc-race-name {
	font-size: 1.3em;
	color: #facc15;
}

.arbc-badge {
	font-size: 0.75em;
	padding: 0.2em 0.6em;
	border-radius: 0.3em;
	font-weight: bold;
}

.__active-badge {
	background: rgba(234, 179, 8, 0.2);
	color: #facc15;
	border: 1px solid #eab308;
}

.arbc-tier-pill {
	font-size: 0.75em;
	padding: 0.15em 0.5em;
	border-radius: 0.3em;
	background: rgba(148, 163, 184, 0.2);
	color: #cbd5e1;
	border: 1px solid rgba(148, 163, 184, 0.3);
}

.arbc-desc {
	font-size: 0.85em;
	color: #cbd5e1;
	margin: 0;
	line-height: 1.4;
}

.arbc-right {
	display: flex;
	align-items: center;
}

.race-switcher-box {
	display: flex;
	flex-direction: column;
	gap: 0.35em;
}

.rsb-label {
	font-size: 0.8em;
	color: #94a3b8;
}

.rsb-select {
	min-width: 14em;
	font-size: 0.9em;
	padding: 0.4em 0.8em;
	background: rgba(15, 23, 42, 0.9);
	color: #f8fafc;
	border: 1px solid rgba(234, 179, 8, 0.4);
	border-radius: 0.4em;
}

/* 2. Top Toolbar */
.stats-top-toolbar {
	display: flex;
	gap: 1em;
	flex-wrap: wrap;
}

.stat-ctrl-box {
	flex: 1;
	min-width: 16em;
	display: flex;
	align-items: center;
	gap: 1em;
	padding: 0.8em 1.2em;
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.5em;
}

.stat-ctrl-box.__free-points {
	border-color: rgba(96, 165, 250, 0.4);
	background: rgba(30, 58, 138, 0.2);
}

.scb-icon {
	font-size: 1.8em;
}

.scb-info {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.scb-label {
	font-size: 0.8em;
	color: #94a3b8;
}

.scb-controls {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.scb-val {
	font-size: 1.25em;
	color: #f8fafc;
}

.scb-val.__highlight {
	color: #60a5fa;
	font-size: 1.4em;
}

.scb-btn {
	width: 1.8em;
	height: 1.8em;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(51, 65, 85, 0.8);
	color: #f8fafc;
	border: 1px solid rgba(148, 163, 184, 0.3);
	border-radius: 0.3em;
	cursor: pointer;
	font-weight: bold;
}

.scb-btn:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}

.__reset-btn {
	background: rgba(239, 68, 68, 0.2) !important;
	border-color: rgba(239, 68, 68, 0.4) !important;
	color: #fca5a5 !important;
}

/* Section Header */
.sec-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
	margin-bottom: 0.75em;
	flex-wrap: wrap;
}

.sec-icon {
	font-size: 1.3em;
}

.sec-title {
	font-size: 1.1em;
	color: #f8fafc;
	margin: 0;
}

.sec-subtitle {
	font-size: 0.8em;
	color: #94a3b8;
	margin-left: 0.5em;
}

/* 3. Core Attributes Grid */
.attributes-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(18em, 1fr));
	gap: 1em;
}

.attribute-card {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
	padding: 1em 1.2em;
	background: rgba(15, 23, 42, 0.75);
	border: 1px solid rgba(148, 163, 184, 0.25);
	border-radius: 0.5em;
	box-shadow: 0 0.2em 0.6em rgba(0, 0, 0, 0.2);
}

.attribute-card.__strength { border-left: 0.25em solid #ef4444; }
.attribute-card.__endurance { border-left: 0.25em solid #10b981; }
.attribute-card.__agility { border-left: 0.25em solid #f59e0b; }
.attribute-card.__intelligence { border-left: 0.25em solid #8b5cf6; }

.attr-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.attr-icon {
	font-size: 1.5em;
}

.attr-names {
	display: flex;
	flex-direction: column;
}

.attr-title {
	font-size: 1.05em;
	color: #f8fafc;
}

.attr-key {
	font-size: 0.75em;
	color: #94a3b8;
}

.attr-total-badge {
	margin-left: auto;
	font-size: 0.85em;
	padding: 0.2em 0.6em;
	background: rgba(51, 65, 85, 0.7);
	border: 1px solid rgba(148, 163, 184, 0.3);
	border-radius: 0.3em;
	color: #cbd5e1;
}

.attr-total-badge strong {
	color: #f8fafc;
	font-size: 1.15em;
}

.attr-allocation-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 0.8em;
	padding: 0.5em 0.7em;
	background: rgba(30, 41, 59, 0.5);
	border-radius: 0.4em;
}

.aar-left {
	display: flex;
	align-items: center;
	gap: 0.6em;
}

.aar-label {
	font-size: 0.8em;
	color: #cbd5e1;
}

.aar-stepper {
	display: flex;
	align-items: center;
	gap: 0.4em;
}

.aar-btn {
	width: 1.6em;
	height: 1.6em;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #334155;
	color: #f8fafc;
	border: 1px solid rgba(148, 163, 184, 0.3);
	border-radius: 0.25em;
	cursor: pointer;
	font-weight: bold;
}

.aar-btn:disabled {
	opacity: 0.35;
	cursor: not-allowed;
}

.aar-val {
	font-size: 1.1em;
	min-width: 1.5em;
	text-align: center;
	color: #f8fafc;
}

.aar-bonuses {
	display: flex;
	gap: 0.4em;
	flex-wrap: wrap;
}

.bonus-tag {
	font-size: 0.75em;
	padding: 0.15em 0.4em;
	border-radius: 0.25em;
}

.__passive {
	background: rgba(168, 85, 247, 0.2);
	color: #d8b4fe;
	border: 1px solid rgba(168, 85, 247, 0.4);
}

.__equip {
	background: rgba(59, 130, 246, 0.2);
	color: #93c5fd;
	border: 1px solid rgba(59, 130, 246, 0.4);
}

.attr-converter-preview {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	font-size: 0.8em;
}

.acp-label {
	color: #94a3b8;
}

.acp-tags {
	display: flex;
	flex-wrap: wrap;
	gap: 0.4em;
}

.acp-tag {
	padding: 0.15em 0.5em;
	background: rgba(51, 65, 85, 0.4);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.3em;
	color: #e2e8f0;
}

/* 4. Combat Stats Grid */
.combat-stats-grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(18em, 1fr));
	gap: 1em;
}

.stat-card {
	display: flex;
	flex-direction: column;
	gap: 0.6em;
	padding: 1em 1.2em;
	background: rgba(15, 23, 42, 0.75);
	border: 1px solid rgba(148, 163, 184, 0.2);
	border-radius: 0.5em;
}

.st-header {
	display: flex;
	align-items: center;
	gap: 0.6em;
	padding-bottom: 0.4em;
	border-bottom: 1px solid rgba(148, 163, 184, 0.15);
}

.st-icon {
	font-size: 1.4em;
}

.st-name {
	font-size: 0.95em;
	color: #cbd5e1;
}

.st-final-value {
	margin-left: auto;
	font-size: 1.4em;
	color: #f8fafc;
}

.st-breakdown-box {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	font-size: 0.8em;
}

.sbb-step {
	display: flex;
	justify-content: space-between;
	align-items: center;
	color: #94a3b8;
}

.sbb-val.__plus {
	color: #34d399;
}

.sbb-step.__pre-percent {
	padding-top: 0.3em;
	border-top: 1px solid rgba(148, 163, 184, 0.2);
	color: #e2e8f0;
}

.sbb-step.__percent {
	color: #fbbf24;
}

.sbb-pct-detail {
	font-size: 0.85em;
	color: #94a3b8;
	margin-left: 0.3em;
}

/* 5. Resistances Grid */
.resistances-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 0.6em;
}

.res-badge {
	display: flex;
	align-items: center;
	gap: 0.4em;
	padding: 0.3em 0.7em;
	border-radius: 0.3em;
	font-size: 0.85em;
	background: rgba(30, 41, 59, 0.6);
	border: 1px solid rgba(148, 163, 184, 0.3);
	color: #cbd5e1;
}

.res-badge.__positive {
	border-color: rgba(52, 211, 153, 0.5);
	color: #a7f3d0;
}

.res-badge.__negative {
	border-color: rgba(248, 113, 113, 0.5);
	color: #fca5a5;
}
</style>
