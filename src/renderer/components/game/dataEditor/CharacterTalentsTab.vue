<template>
	<div class="char-talents-tab">
		<!-- Header Card with Lore and Counter -->
		<div class="talents-header-card">
			<div class="thc-left">
				<span class="thc-icon">🌟</span>
				<div class="thc-titles">
					<h3 class="thc-title">Врождённые таланты (Character Talents)</h3>
					<p class="thc-subtitle">
						Врождённый талант в Новом Мире — редчайший индивидуальный дар (встречается лишь у 1 из 200 людей), не зависящий от прокачки уровней, рас или классов. У игроков и Высших Существ также могут быть уникальные дары.
					</p>
				</div>
			</div>

			<div class="thc-right">
				<div class="talents-counter-box">
					<span class="tcb-label">Выбрано талантов:</span>
					<span class="tcb-value">{{ selectedTalentsCount }}</span>
				</div>
			</div>
		</div>

		<!-- Toolbar: Search & Category Filter -->
		<div class="talents-toolbar">
			<div class="talents-search-box">
				<span class="search-icon">🔍</span>
				<input
					v-model="searchQuery"
					type="text"
					class="talents-search-input"
					placeholder="Поиск талантов по названию, ID или описанию..."
				/>
				<button v-if="searchQuery" type="button" class="search-clear-btn" @click="searchQuery = ''">✕</button>
			</div>

			<div class="talents-filters-row">
				<button
					v-for="flt in filterTabs"
					:key="flt.id"
					type="button"
					class="talent-filter-btn"
					:class="{ __active: activeFilter === flt.id }"
					@click="activeFilter = flt.id"
				>
					{{ flt.label }} ({{ getFilterCount(flt.id) }})
				</button>
			</div>
		</div>

		<!-- Currently Selected Talents Bar -->
		<div v-if="selectedTalentsList.length > 0" class="selected-talents-bar">
			<span class="stb-title">Назначено персонажу:</span>
			<div class="stb-chips">
				<div
					v-for="t in selectedTalentsList"
					:key="'sel-' + t.id"
					class="selected-talent-chip"
				>
					<span class="stc-icon">{{ t.icon || '🌟' }}</span>
					<span class="stc-name">{{ t.name || t.id }}</span>
					<button
						type="button"
						class="stc-remove-btn"
						title="Удалить талант у персонажа"
						@click="removeTalent(t.id)"
					>
						✕
					</button>
				</div>
			</div>
		</div>

		<!-- Talents Cards Grid -->
		<div class="talents-grid-container">
			<div v-if="filteredTalents.length > 0" class="talents-cards-grid">
				<div
					v-for="talent in filteredTalents"
					:key="talent.id"
					class="talent-card"
					:class="{
						__assigned: isTalentAssigned(talent.id),
						[`__cat-${talent.category || 'passive'}`]: true
					}"
				>
					<div class="tc-header">
						<div class="tc-icon-box">{{ talent.icon || '🌟' }}</div>
						<div class="tc-title-box">
							<div class="tc-name">{{ talent.name || talent.id }}</div>
							<div class="tc-meta">
								<span class="tc-id">#{{ talent.id }}</span>
								<span class="tc-cat-badge">{{ formatCategory(talent.category) }}</span>
							</div>
						</div>
					</div>

					<div class="tc-body">
						<p class="tc-desc">
							{{ talent.description || 'Нет описания таланта' }}
						</p>

						<!-- Mechanics Data Badges -->
						<div v-if="talent.data && Object.keys(talent.data).length > 0" class="tc-mechanics">
							<span class="tcm-title">Механика:</span>
							<div class="tcm-badges">
								<span
									v-for="(val, key) in talent.data"
									:key="key"
									class="tcm-badge"
								>
									<strong>{{ formatParamKey(key) }}:</strong> {{ formatParamVal(val) }}
								</span>
							</div>
						</div>
					</div>

					<div class="tc-footer">
						<button
							v-if="isTalentAssigned(talent.id)"
							type="button"
							class="talent-toggle-btn __remove"
							@click="removeTalent(talent.id)"
						>
							<span class="btn-check">✔</span>
							<span>Выбран (Нажмите, чтобы снять)</span>
						</button>
						<button
							v-else
							type="button"
							class="talent-toggle-btn __add"
							@click="addTalent(talent.id)"
						>
							<span>➕ Выбрать этот талант</span>
						</button>
					</div>
				</div>
			</div>

			<!-- Empty State -->
			<div v-else class="talents-empty-state">
				<span class="tes-icon">🔍</span>
				<span class="tes-text">Таланты по заданному фильтру не найдены</span>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
	character: {
		type: Object,
		required: true
	},
	talentsRegistry: {
		type: Array,
		default: () => []
	}
})

const emit = defineEmits(['change'])

const searchQuery = ref('')
const activeFilter = ref('all') // 'all' | 'assigned' | 'available'

const filterTabs = [
	{ id: 'all', label: 'Все таланты' },
	{ id: 'assigned', label: 'Выбранные' },
	{ id: 'available', label: 'Доступные' }
]

const talentsList = computed(() => {
	return Array.isArray(props.talentsRegistry) ? props.talentsRegistry : []
})

const characterTalents = computed(() => {
	return Array.isArray(props.character.talents) ? props.character.talents : []
})

const selectedTalentsCount = computed(() => characterTalents.value.length)

const selectedTalentsList = computed(() => {
	return characterTalents.value.map((id) => {
		const found = talentsList.value.find((t) => t.id === id)
		return found || { id, name: id, icon: '🌟' }
	})
})

function isTalentAssigned(talentId) {
	return characterTalents.value.includes(talentId)
}

function getFilterCount(filterId) {
	if (filterId === 'assigned') {
		return characterTalents.value.length
	}
	if (filterId === 'available') {
		return talentsList.value.filter((t) => !isTalentAssigned(t.id)).length
	}
	return talentsList.value.length
}

const filteredTalents = computed(() => {
	const q = searchQuery.value.trim().toLowerCase()

	return talentsList.value.filter((talent) => {
		if (!talent || !talent.id) return false

		// Filter tab
		if (activeFilter.value === 'assigned' && !isTalentAssigned(talent.id)) {
			return false
		}
		if (activeFilter.value === 'available' && isTalentAssigned(talent.id)) {
			return false
		}

		// Search
		if (!q) return true
		const name = (talent.name || '').toLowerCase()
		const id = talent.id.toLowerCase()
		const desc = (talent.description || '').toLowerCase()
		return name.includes(q) || id.includes(q) || desc.includes(q)
	})
})

function addTalent(talentId) {
	if (!Array.isArray(props.character.talents)) {
		props.character.talents = []
	}
	if (!props.character.talents.includes(talentId)) {
		props.character.talents.push(talentId)
		emit('change')
	}
}

function removeTalent(talentId) {
	if (!Array.isArray(props.character.talents)) return
	const idx = props.character.talents.indexOf(talentId)
	if (idx !== -1) {
		props.character.talents.splice(idx, 1)
		emit('change')
	}
}

function formatCategory(cat) {
	const c = String(cat || 'passive').toLowerCase()
	if (c === 'buff') return 'Усиление (Buff)'
	if (c === 'active') return 'Активный'
	if (c === 'special') return 'Особый'
	return 'Пассивный'
}

function formatParamKey(key) {
	const map = {
		ignore_equip_requirements: 'Игнорирование ограничений экипировки',
		range_bonus: 'Бонус к радиусу',
		initiative_bonus: 'Бонус к инициативе',
		reveal_magic_tier: 'Видение кругов магии'
	}
	return map[key] || key
}

function formatParamVal(val) {
	if (val === true) return 'Да'
	if (val === false) return 'Нет'
	return String(val)
}
</script>

<style scoped>
.char-talents-tab {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 1.2em;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
	color: #e2e8f0;
}

/* Header Card */
.talents-header-card {
	background: rgba(18, 26, 43, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.6em;
	padding: 1.2em 1.4em;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1.5em;
	box-shadow: 0 0.5em 1.5em rgba(0, 0, 0, 0.35);
}

.thc-left {
	display: flex;
	align-items: flex-start;
	gap: 1em;
	flex: 1;
}

.thc-icon {
	font-size: 2.2em;
	line-height: 1;
	filter: drop-shadow(0 0 0.4em rgba(251, 191, 36, 0.5));
}

.thc-titles {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.thc-title {
	font-size: 1.2em;
	font-weight: 700;
	color: #f8fafc;
	margin: 0;
}

.thc-subtitle {
	font-size: 0.86em;
	color: #94a3b8;
	line-height: 1.4;
	margin: 0;
	max-width: 50em;
}

.talents-counter-box {
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(251, 191, 36, 0.3);
	border-radius: 0.5em;
	padding: 0.6em 1.2em;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2em;
}

.tcb-label {
	font-size: 0.78em;
	color: #94a3b8;
	text-transform: uppercase;
	letter-spacing: 0.05em;
}

.tcb-value {
	font-size: 1.6em;
	font-weight: bold;
	color: #fbbf24;
}

/* Toolbar */
.talents-toolbar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 1em;
	flex-wrap: wrap;
}

.talents-search-box {
	flex: 1;
	min-width: 16em;
	display: flex;
	align-items: center;
	gap: 0.6em;
	background: rgba(15, 23, 42, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	padding: 0.45em 0.9em;
}

.talents-search-input {
	flex: 1;
	background: transparent;
	border: none;
	outline: none;
	color: #f8fafc;
	font-size: 0.92em;
	font-family: Kurale, sans-serif;
}

.search-clear-btn {
	background: none;
	border: none;
	color: #94a3b8;
	cursor: pointer;
	font-size: 0.9em;
	padding: 0.1em 0.3em;
}

.search-clear-btn:hover {
	color: #fff;
}

.talents-filters-row {
	display: flex;
	gap: 0.4em;
}

.talent-filter-btn {
	background: rgba(15, 23, 42, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.35em;
	color: #cbd5e1;
	font-size: 0.88em;
	padding: 0.4em 0.85em;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: all 0.15s;
}

.talent-filter-btn:hover {
	background: rgba(30, 41, 59, 0.8);
	border-color: rgba(255, 255, 255, 0.25);
	color: #fff;
}

.talent-filter-btn.__active {
	background: rgba(212, 175, 55, 0.2);
	border-color: var(--color-primary, #d4af37);
	color: #fbbf24;
	font-weight: bold;
	box-shadow: 0 0 0.6em rgba(212, 175, 55, 0.3);
}

/* Selected Talents Bar */
.selected-talents-bar {
	background: rgba(15, 23, 42, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.5em;
	padding: 0.6em 1em;
	display: flex;
	align-items: center;
	gap: 0.8em;
	flex-wrap: wrap;
}

.stb-title {
	font-size: 0.85em;
	color: #94a3b8;
	font-weight: bold;
}

.stb-chips {
	display: flex;
	gap: 0.5em;
	flex-wrap: wrap;
}

.selected-talent-chip {
	background: rgba(212, 175, 55, 0.15);
	border: 1px solid rgba(212, 175, 55, 0.4);
	color: #fbbf24;
	border-radius: 0.35em;
	padding: 0.2em 0.6em;
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.85em;
}

.stc-remove-btn {
	background: none;
	border: none;
	color: #fca5a5;
	cursor: pointer;
	font-size: 0.85em;
	padding: 0.1em;
	line-height: 1;
}

.stc-remove-btn:hover {
	color: #ef4444;
}

/* Cards Grid */
.talents-grid-container {
	width: 100%;
}

.talents-cards-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(22em, 1fr));
	gap: 1em;
}

.talent-card {
	background: rgba(18, 26, 43, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.6em;
	padding: 1.1em;
	display: flex;
	flex-direction: column;
	gap: 0.9em;
	box-shadow: 0 0.4em 1em rgba(0, 0, 0, 0.3);
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.talent-card:hover {
	border-color: rgba(212, 175, 55, 0.4);
	transform: translateY(-0.15em);
	box-shadow: 0 0.6em 1.5em rgba(0, 0, 0, 0.45);
}

.talent-card.__assigned {
	border-color: rgba(16, 185, 129, 0.6);
	background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(18, 26, 43, 0.9) 100%);
	box-shadow: 0 0 1em rgba(16, 185, 129, 0.25);
}

.tc-header {
	display: flex;
	align-items: center;
	gap: 0.8em;
}

.tc-icon-box {
	width: 2.8em;
	height: 2.8em;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(251, 191, 36, 0.3);
	border-radius: 0.45em;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 1.6em;
	flex-shrink: 0;
	box-shadow: inset 0 0 0.6em rgba(0, 0, 0, 0.6);
}

.tc-title-box {
	flex: 1;
	min-width: 0;
}

.tc-name {
	font-size: 1.05em;
	font-weight: 700;
	color: #f8fafc;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.tc-meta {
	display: flex;
	align-items: center;
	gap: 0.5em;
	font-size: 0.78em;
	color: #94a3b8;
}

.tc-id {
	font-family: monospace;
	opacity: 0.8;
}

.tc-cat-badge {
	background: rgba(255, 255, 255, 0.08);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
	color: #38bdf8;
}

.tc-body {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.7em;
}

.tc-desc {
	font-size: 0.88em;
	color: #cbd5e1;
	line-height: 1.45;
	margin: 0;
}

.tc-mechanics {
	display: flex;
	flex-direction: column;
	gap: 0.3em;
	background: rgba(0, 0, 0, 0.25);
	border-radius: 0.4em;
	padding: 0.5em 0.7em;
	border: 1px solid rgba(255, 255, 255, 0.06);
}

.tcm-title {
	font-size: 0.75em;
	color: #94a3b8;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.tcm-badges {
	display: flex;
	gap: 0.4em;
	flex-wrap: wrap;
}

.tcm-badge {
	font-size: 0.78em;
	background: rgba(251, 191, 36, 0.1);
	border: 1px solid rgba(251, 191, 36, 0.3);
	color: #fbbf24;
	padding: 0.15em 0.45em;
	border-radius: 0.25em;
}

.tc-footer {
	display: flex;
	align-items: center;
	margin-top: 0.2em;
}

.talent-toggle-btn {
	width: 100%;
	padding: 0.5em 1em;
	border-radius: 0.4em;
	font-family: Kurale, sans-serif;
	font-size: 0.88em;
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5em;
	transition: all 0.15s;
}

.talent-toggle-btn.__add {
	background: linear-gradient(135deg, rgba(212, 175, 55, 0.25) 0%, rgba(180, 83, 9, 0.25) 100%);
	border: 1px solid rgba(212, 175, 55, 0.5);
	color: #fbbf24;
}

.talent-toggle-btn.__add:hover {
	background: rgba(212, 175, 55, 0.4);
	color: #fff;
	border-color: #fbbf24;
}

.talent-toggle-btn.__remove {
	background: rgba(16, 185, 129, 0.2);
	border: 1px solid rgba(16, 185, 129, 0.5);
	color: #6ee7b7;
}

.talent-toggle-btn.__remove:hover {
	background: rgba(239, 68, 68, 0.25);
	border-color: rgba(239, 68, 68, 0.6);
	color: #fca5a5;
}

.btn-check {
	font-weight: bold;
}

/* Empty State */
.talents-empty-state {
	text-align: center;
	padding: 3em 1em;
	color: #94a3b8;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.6em;
}

.tes-icon {
	font-size: 2.4em;
}

.tes-text {
	font-size: 1.05em;
	font-style: italic;
}
</style>
