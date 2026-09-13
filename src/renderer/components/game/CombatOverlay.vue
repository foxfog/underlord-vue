<template>
	<div class="combat-overlay">
		<!-- Isometric 2.5D Arena -->
		<IsoCombatArena
			ref="arenaRef"
			:map-id="store.mapId"
			:units="store.units"
			:active-unit-id="store.currentUnit?.id"
			:selected-action="store.selectedAction"
			:move-mode="moveMode"
			:floating-texts="store.floatingTexts"
			:combat-animations="settingsStore.general.combatAnimations"
			:combat-speed="settingsStore.general.combatSpeed"
			@tile-click="onArenaTileClick"
			@unit-click="onArenaUnitClick"
			@move-unit="onArenaMoveUnit"
			@map-loaded="onArenaMapLoaded"
		/>

		<!-- Top Header: Title & Timeline -->
		<div class="combat-top-bar">
			<div class="combat-encounter-badge">
				<span class="encounter-title">{{ encounterData?.name ?? 'Тактический бой' }}</span>
				<span class="encounter-round">Раунд {{ store.round }}</span>
			</div>

			<!-- Initiative Timeline (Sword of Convallaria style) -->
			<div class="timeline-container">
				<div class="timeline-track">
					<div
						v-for="(unitId, idx) in store.turnQueue"
						:key="unitId"
						class="timeline-card"
						:class="{
							'__is-active': idx === store.currentUnitIndex,
							'__is-ally': getUnit(unitId)?.team === 'ally',
							'__is-enemy': getUnit(unitId)?.team === 'enemy',
							'__is-dead': (getUnit(unitId)?.hp || 0) <= 0
						}"
						:title="getUnit(unitId)?.name"
						@click="onTimelineUnitClick(getUnit(unitId))"
					>
						<span v-if="idx === store.currentUnitIndex" class="active-chevron">▼</span>
						<span class="card-icon">{{ getUnit(unitId)?.icon ?? '👤' }}</span>
						<span class="card-name">{{ getUnit(unitId)?.name }}</span>
						<div class="card-mini-hp">
							<div
								class="card-hp-fill"
								:class="getUnit(unitId)?.team"
								:style="{ width: hpPct(getUnit(unitId)) + '%' }"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Enemy Turn Notice Banner -->
		<Transition name="fade-banner">
			<div v-if="store.phase === 'enemy_action'" class="enemy-turn-banner">
				<span class="enemy-banner-icon">{{ store.currentUnit?.icon || '⚔️' }}</span>
				<span class="enemy-banner-text">Ход противника: {{ store.currentUnit?.name }}...</span>
			</div>
		</Transition>

		<!-- Bottom Tactical Dock (Command Center) -->
		<div v-if="store.isPlayerTurn && store.currentUnit" class="tactical-dock">
			<!-- Active Unit Portrait / Stats -->
			<div class="unit-status-dock">
				<div class="dock-avatar">
					<span class="dock-avatar-icon">{{ store.currentUnit.icon }}</span>
					<span class="dock-class-badge">{{ getClassTitle(store.currentUnit.class) }}</span>
				</div>
				<div class="dock-details">
					<div class="dock-unit-name">{{ store.currentUnit.name }}</div>

					<!-- HP Bar -->
					<div class="dock-bar-row">
						<span class="bar-tag">HP</span>
						<div class="dock-bar">
							<div class="dock-bar-fill __hp" :style="{ width: hpPct(store.currentUnit) + '%' }" />
						</div>
						<span class="dock-bar-val">{{ store.currentUnit.hp }}/{{ store.currentUnit.maxHp }}</span>
					</div>

					<!-- MP Bar (if has MP) -->
					<div v-if="store.currentUnit.maxMp > 0" class="dock-bar-row">
						<span class="bar-tag">MP</span>
						<div class="dock-bar">
							<div class="dock-bar-fill __mp" :style="{ width: mpPct(store.currentUnit) + '%' }" />
						</div>
						<span class="dock-bar-val">{{ store.currentUnit.mp }}/{{ store.currentUnit.maxMp }}</span>
					</div>

					<!-- AP & Statuses -->
					<div class="dock-sub-row">
						<div class="dock-ap">
							<span class="ap-tag">AP:</span>
							<span
								v-for="n in store.currentUnit.maxAp"
								:key="n"
								class="ap-pip"
								:class="{ '__used': n > store.currentUnit.ap }"
							>●</span>
						</div>
						<div v-if="store.currentUnit.statuses.length" class="dock-statuses">
							<span
								v-for="s in store.currentUnit.statuses"
								:key="s"
								class="status-chip"
							>{{ getStatusLabel(s) }}</span>
						</div>
					</div>
				</div>
			</div>

			<!-- Tactical Action Commands -->
			<div class="dock-actions-center">
				<!-- Prompt when ability is selected -->
				<div v-if="store.selectedAction" class="ability-prompt-bar">
					<span class="prompt-text">
						{{ store.selectedAction.icon }} {{ store.selectedAction.name }}:
						{{ store.selectedAction.targetType === 'ally' ? 'Выберите союзника в зоне действия' : 'Выберите цель на арене' }}
					</span>
					<button class="prompt-cancel-btn" @click="cancelAction">
						✕ Отмена
					</button>
				</div>

				<!-- Command Buttons -->
				<div class="dock-buttons-row">
					<!-- Move Button -->
					<button
						class="dock-btn __move-btn"
						:class="{
							'__is-active': moveMode,
							'__disabled': store.currentUnit.ap < 1
						}"
						:disabled="store.currentUnit.ap < 1"
						@click="toggleMoveMode"
					>
						<span class="btn-icon">🚶</span>
						<span class="btn-title">Движение</span>
						<span class="btn-badge">1 AP • {{ store.currentUnit.moveRange || 3 }} кл</span>
					</button>

					<!-- Ability Buttons -->
					<button
						v-for="ability in store.currentUnit.abilities"
						:key="ability.id"
						class="dock-btn __ability-btn"
						:class="{
							'__is-active': store.selectedAction?.id === ability.id,
							'__disabled': !canUseAbility(ability)
						}"
						:disabled="!canUseAbility(ability)"
						@click="selectAction(ability)"
					>
						<span class="btn-icon">{{ ability.icon }}</span>
						<span class="btn-title">{{ ability.name }}</span>
						<span class="btn-badge">
							{{ formatRangeBadge(ability) }} | {{ ability.apCost }}AP<template v-if="ability.mpCost"> {{ ability.mpCost }}MP</template>
						</span>
					</button>

					<!-- End Turn Button -->
					<button class="dock-btn __skip-btn" title="Завершить ход этого бойца" @click="endActiveTurn">
						<span class="btn-icon">⏭️</span>
						<span class="btn-title">Завершить ход</span>
						<span class="btn-badge">Конец</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Bottom Left Combat Log (Collapsible) -->
		<div class="combat-log-wrapper" :class="{ '__is-collapsed': isLogCollapsed }">
			<div class="combat-log-header" @click="isLogCollapsed = !isLogCollapsed">
				<span class="log-header-title">📜 Журнал боя</span>
				<button class="log-toggle-btn">{{ isLogCollapsed ? '▲' : '▼' }}</button>
			</div>
			<div v-show="!isLogCollapsed" ref="logRef" class="combat-log-body">
				<div
					v-for="entry in store.combatLog"
					:key="entry.id"
					class="log-line"
					:class="[`log-${entry.type}`]"
				>
					{{ entry.text }}
				</div>
			</div>
		</div>

		<!-- Victory / Defeat Screen -->
		<Transition name="result-fade">
			<div v-if="store.isOver" class="combat-result-overlay">
				<div class="result-card" :class="store.phase === 'win' ? '__win' : '__lose'">
					<div class="result-icon-big">{{ store.phase === 'win' ? '🏆' : '💀' }}</div>
					<div class="result-heading">{{ store.phase === 'win' ? 'Победа!' : 'Поражение' }}</div>
					<div class="result-desc">
						{{ store.phase === 'win' ? 'Все противники повержены на тактической арене.' : 'Все ваши союзники пали в бою.' }}
					</div>
					<button class="result-continue-btn" @click="onContinue">
						Продолжить
					</button>
				</div>
			</div>
		</Transition>
	</div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useCombatStore } from '@/stores/combatStore'
import { useSettingsStore } from '@/stores/settings'
import { processEnemyTurn } from '@/composables/useCombatAI'
import IsoCombatArena from '@/components/game/combat/IsoCombatArena.vue'

const props = defineProps({
	encounterId: { type: String, required: true }
})

const emit = defineEmits(['combat-end'])

const store = useCombatStore()
const settingsStore = useSettingsStore()
const arenaRef = ref(null)
const logRef = ref(null)
const encounterData = ref(null)
const moveMode = ref(false)
const isLogCollapsed = ref(true)
let enemyTurnTimer = null

async function loadEncounter() {
	try {
		const url = `/data/combat/encounters/${props.encounterId}.json`
		const resp = await fetch(url)
		if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
		const data = await resp.json()
		encounterData.value = data
		store.initCombat(data)
		moveMode.value = store.isPlayerTurn && store.currentUnit?.ap >= 1
	} catch (e) {
		console.error('[CombatOverlay] Failed to load encounter:', e)
	}
}

onMounted(() => {
	store.resetCombat()
	loadEncounter()
	window.addEventListener('keydown', onKeyDown)
})

onUnmounted(() => {
	if (enemyTurnTimer) clearTimeout(enemyTurnTimer)
	window.removeEventListener('keydown', onKeyDown)
})

// Auto-run Enemy Turn
function triggerEnemyTurn() {
	if (store.phase !== 'enemy_action' || store.isOver) return
	if (enemyTurnTimer) clearTimeout(enemyTurnTimer)
	const speed = settingsStore.general.combatSpeed || 1.0
	const delay = settingsStore.general.combatAnimations ? Math.max(300, 800 / speed) : 50
	enemyTurnTimer = setTimeout(() => {
		processEnemyTurn(store, arenaRef.value, {
			speed,
			animations: settingsStore.general.combatAnimations
		})
	}, delay)
}

watch(
	() => [store.phase, store.currentUnitIndex],
	([ph]) => {
		if (ph === 'enemy_action') {
			triggerEnemyTurn()
		} else if (ph === 'player_action') {
			moveMode.value = store.currentUnit?.ap >= 1
			store.selectedAction = null
		}
	},
	{ immediate: false }
)

watch(
	() => store.combatLog.length,
	() => {
		nextTick(() => {
			if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight
		})
	}
)

function getUnit(id) {
	return store.units.find((u) => u.id === id)
}

function hpPct(unit) {
	if (!unit || unit.maxHp <= 0) return 0
	return Math.max(0, Math.min(100, Math.round((unit.hp / unit.maxHp) * 100)))
}

function mpPct(unit) {
	if (!unit || unit.maxMp <= 0) return 0
	return Math.max(0, Math.min(100, Math.round((unit.mp / unit.maxMp) * 100)))
}

function getClassTitle(cls) {
	switch (cls) {
		case 'fighter': return 'Боец'
		case 'warrior': return 'Танк'
		case 'mage': return 'Маг'
		case 'archer': return 'Лучник'
		default: return 'Боец'
	}
}

function getStatusLabel(s) {
	const id = typeof s === 'string' ? s : s.id
	switch (id) {
		case 'defended': return '🛡️ Защита'
		case 'evading': return '💨 Уворот'
		case 'stunned': return '🪃 Оглушён'
		case 'burning': return '🔥 Горение'
		default: return `✨ ${id}`
	}
}

function onArenaMapLoaded({ tiles, objects }) {
	store.setMapData({ tiles, objects })
}

function formatRangeBadge(ability) {
	if (ability.targetType === 'self') return 'На себя'
	const minR = ability.minRange ?? 1
	const maxR = ability.maxRange ?? 1
	if (minR === maxR) return `${maxR} кл`
	return `${minR}–${maxR} кл`
}

function canUseAbility(ability) {
	const u = store.currentUnit
	if (!u) return false
	return u.ap >= ability.apCost && u.mp >= ability.mpCost
}

function toggleMoveMode() {
	if (store.currentUnit?.ap < 1) return
	moveMode.value = !moveMode.value
	if (moveMode.value) store.selectedAction = null
}

function selectAction(ability) {
	if (ability.targetType === 'self') {
		const actor = store.currentUnit
		if (actor) executePlayerAction(ability, actor.id)
		return
	}

	if (store.selectedAction?.id === ability.id) {
		store.selectedAction = null
		moveMode.value = store.currentUnit?.ap >= 1
	} else {
		store.selectedAction = ability
		moveMode.value = false
	}
}

async function executePlayerAction(action, targetId, targetCoords = null) {
	const actor = store.currentUnit
	const target = targetId ? store.getUnit(targetId) : null
	const targetPoint = target ? { x: target.x, y: target.y } : targetCoords
	if (!actor || !targetPoint) return

	// 1. Validate AP & MP
	if (actor.ap < action.apCost) {
		store.addLog(`${actor.name}: недостаточно AP!`, 'info')
		return
	}
	if (action.mpCost && actor.mp < action.mpCost) {
		store.addLog(`${actor.name}: недостаточно MP!`, 'info')
		return
	}

	// 2. Validate Range
	if (!store.isTargetInRange(actor, action, target || targetPoint)) {
		const targetLabel = target ? target.name : `(${targetPoint.x}, ${targetPoint.y})`
		store.addLog(`${actor.name}: ${targetLabel} вне зоны досягаемости!`, 'info')
		if (targetId) {
			store.addFloatingText(targetId, 'Вне зоны!', 'status')
		}
		return
	}

	// 3. Clear selectedAction only after passing validation
	store.selectedAction = null
	moveMode.value = false

	// 4. Orient actor towards target
	if (targetPoint.x !== undefined && actor.x !== undefined) {
		if (targetPoint.x > actor.x) actor.facing = 'SE'
		else if (targetPoint.x < actor.x) actor.facing = 'NW'
		else if (targetPoint.y > actor.y) actor.facing = 'SW'
		else if (targetPoint.y < actor.y) actor.facing = 'NE'
	}

	// 5. Play VFX only for valid action
	if (arenaRef.value && settingsStore.general.combatAnimations) {
		try {
			await arenaRef.value.playActionVfx({
				casterId: actor.id,
				targetId,
				targetCoords: target ? null : targetPoint,
				ability: action
			})
		} catch (vfxErr) {
			console.warn('[CombatOverlay] playActionVfx failed:', vfxErr)
		}
	}

	store.executeAction(action, targetId, targetPoint)
}

function cancelAction() {
	store.selectedAction = null
	if (store.currentUnit?.ap >= 1) {
		moveMode.value = true
	}
}

function endActiveTurn() {
	moveMode.value = false
	store.selectedAction = null
	store.skipTurn()
}

function onArenaMoveUnit({ unitId, destination }) {
	store.moveUnit(unitId, destination)
	moveMode.value = false
}

function onArenaUnitClick(unit) {
	if (!store.isPlayerTurn || !unit || unit.hp <= 0) return

	if (store.selectedAction) {
		const action = store.selectedAction
		const actor = store.currentUnit
		if (!actor) return

		// Check valid team
		const isValidTeam =
			(action.targetType === 'enemy' && unit.team === 'enemy') ||
			(action.targetType === 'ally' && unit.team === 'ally') ||
			(action.targetType === 'self' && unit.id === actor.id)

		if (!isValidTeam) return

		// Check range before executing
		if (!store.isTargetInRange(actor, action, unit)) {
			store.addLog(`${actor.name}: ${unit.name} вне зоны досягаемости!`, 'info')
			store.addFloatingText(unit.id, 'Вне радиуса!', 'status')
			return
		}

		executePlayerAction(action, unit.id)
		return
	}

	if (unit.id === store.currentUnit?.id && store.currentUnit?.ap >= 1) {
		toggleMoveMode()
	}
}

function onArenaTileClick(tile) {
	if (!store.isPlayerTurn || !tile) return

	if (store.selectedAction) {
		const action = store.selectedAction
		const actor = store.currentUnit
		if (!actor) return

		// If a unit is standing on this tile, handle as unit click
		const unitOnTile = store.units.find((u) => u.hp > 0 && u.x === tile.x && u.y === tile.y)
		if (unitOnTile) {
			onArenaUnitClick(unitOnTile)
			return
		}

		// If ground AoE ability, allow clicking on empty tile
		if (action.aoeRadius > 0 || action.pattern === 'aoe_point') {
			if (!store.isTargetInRange(actor, action, tile)) {
				store.addLog(`${actor.name}: (${tile.x}, ${tile.y}) вне зоны досягаемости!`, 'info')
				return
			}
			executePlayerAction(action, null, tile)
		}
	}
}

function onTimelineUnitClick(unit) {
	if (!unit || unit.hp <= 0) return
	if (store.selectedAction) {
		onArenaUnitClick(unit)
	}
}

function onContinue() {
	const result = store.phase
	store.resetCombat()
	emit('combat-end', { result })
}

function onKeyDown(e) {
	if (e.key === 'Escape') {
		if (store.selectedAction) {
			store.selectedAction = null
			if (!store.currentUnit?.hasMoved) {
				moveMode.value = true
			}
		} else if (moveMode.value) {
			moveMode.value = false
		}
	}
}
</script>

<style scoped>
.combat-overlay {
	position: absolute;
	inset: 0;
	z-index: 300;
	display: flex;
	flex-direction: column;
	font-size: calc(1 * var(--size));
	overflow: hidden;
	font-family: Kurale, sans-serif;
	color: #e2e8f0;
}

/* ── Top Header & Initiative Timeline ── */
.combat-top-bar {
	position: absolute;
	top: 0.5em;
	left: 5em;
	right: 5em;
	z-index: 20;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.35em;
	pointer-events: none;
}

.combat-top-bar > * {
	pointer-events: auto;
}

.combat-encounter-badge {
	display: flex;
	align-items: center;
	gap: 0.8em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(246, 196, 69, 0.4);
	padding: 0.25em 1em;
	border-radius: 0.4em;
	backdrop-filter: blur(0.3em);
}

.encounter-title {
	font-size: 0.95em;
	font-weight: bold;
	color: #f6c445;
	letter-spacing: 0.05em;
}

.encounter-round {
	font-size: 0.85em;
	color: #94a3b8;
}

/* Timeline Track */
.timeline-container {
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.5em;
	padding: 0.25em 0.5em;
	backdrop-filter: blur(0.4em);
	max-width: 90%;
	overflow-x: auto;
}

.timeline-track {
	display: flex;
	align-items: center;
	gap: 0.35em;
}

.timeline-card {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.1em;
	padding: 0.2em 0.45em;
	border-radius: 0.35em;
	border: 1px solid transparent;
	font-size: 0.68em;
	min-width: 3.4em;
	cursor: pointer;
	transition: transform 0.2s, border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.timeline-card.__is-ally {
	background: rgba(14, 116, 144, 0.3);
	border-color: rgba(56, 189, 248, 0.4);
}

.timeline-card.__is-enemy {
	background: rgba(153, 27, 27, 0.3);
	border-color: rgba(239, 68, 68, 0.4);
}

.timeline-card.__is-active {
	border-color: #f6c445 !important;
	background: rgba(246, 196, 69, 0.25) !important;
	box-shadow: 0 0 0.6em rgba(246, 196, 69, 0.5);
	transform: translateY(-0.15em) scale(1.06);
}

.timeline-card.__is-dead {
	opacity: 0.4;
	filter: grayscale(0.8);
}

.active-chevron {
	position: absolute;
	top: -0.85em;
	color: #f6c445;
	font-size: 0.85em;
	animation: bounceChevron 1s infinite alternate ease-in-out;
}

@keyframes bounceChevron {
	0% { transform: translateY(0); }
	100% { transform: translateY(-0.15em); }
}

.card-icon {
	font-size: 1.25em;
}

.card-name {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 4.2em;
	color: #e2e8f0;
}

.card-mini-hp {
	width: 100%;
	height: 0.22em;
	background: rgba(0, 0, 0, 0.6);
	border-radius: 0.1em;
	overflow: hidden;
}

.card-hp-fill {
	height: 100%;
	transition: width 0.3s;
}

.card-hp-fill.ally {
	background: #10b981;
}

.card-hp-fill.enemy {
	background: #ef4444;
}

/* ── Enemy Turn Notice Banner ── */
.enemy-turn-banner {
	position: absolute;
	top: 4.6em;
	left: 50%;
	transform: translateX(-50%);
	z-index: 25;
	display: flex;
	align-items: center;
	gap: 0.6em;
	background: rgba(153, 27, 27, 0.88);
	border: 1px solid #ef4444;
	padding: 0.35em 1.2em;
	border-radius: 0.4em;
	font-size: 0.9em;
	font-weight: bold;
	color: #ffffff;
	box-shadow: 0 0.2em 0.8em rgba(239, 68, 68, 0.4);
}

.enemy-banner-icon {
	font-size: 1.2em;
}

/* ── Bottom Tactical Dock (Command Center) ── */
.tactical-dock {
	position: absolute;
	bottom: 0.6em;
	left: 1em;
	right: 1em;
	z-index: 20;
	display: flex;
	align-items: flex-end;
	justify-content: space-between;
	gap: 1em;
	pointer-events: none;
}

.tactical-dock > * {
	pointer-events: auto;
}

/* Unit Status Dock (Left Card) */
.unit-status-dock {
	display: flex;
	align-items: center;
	gap: 0.8em;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid rgba(246, 196, 69, 0.4);
	border-radius: 0.5em;
	padding: 0.5em 0.8em;
	backdrop-filter: blur(0.4em);
	min-width: 17em;
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.5);
}

.dock-avatar {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.2em;
}

.dock-avatar-icon {
	font-size: 2.2em;
	line-height: 1;
}

.dock-class-badge {
	font-size: 0.65em;
	background: rgba(246, 196, 69, 0.2);
	color: #f6c445;
	border: 1px solid rgba(246, 196, 69, 0.4);
	padding: 0.1em 0.4em;
	border-radius: 0.25em;
}

.dock-details {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.25em;
}

.dock-unit-name {
	font-weight: bold;
	font-size: 1em;
	color: #ffffff;
}

.dock-bar-row {
	display: flex;
	align-items: center;
	gap: 0.4em;
	font-size: 0.72em;
}

.bar-tag {
	width: 1.4em;
	font-weight: bold;
	color: #94a3b8;
}

.dock-bar {
	flex: 1;
	height: 0.45em;
	background: rgba(0, 0, 0, 0.7);
	border-radius: 0.2em;
	overflow: hidden;
	border: 1px solid rgba(255, 255, 255, 0.1);
}

.dock-bar-fill {
	height: 100%;
	transition: width 0.3s;
}

.dock-bar-fill.__hp {
	background: #10b981;
}

.dock-bar-fill.__mp {
	background: #3b82f6;
}

.dock-bar-val {
	width: 3.8em;
	text-align: right;
	font-weight: bold;
	color: #cbd5e1;
}

.dock-sub-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	font-size: 0.75em;
}

.dock-ap {
	display: flex;
	align-items: center;
	gap: 0.2em;
}

.ap-tag {
	color: #94a3b8;
	font-weight: bold;
}

.ap-pip {
	color: #f6c445;
	font-size: 1.1em;
	line-height: 1;
}

.ap-pip.__used {
	color: rgba(255, 255, 255, 0.2);
}

.dock-statuses {
	display: flex;
	gap: 0.25em;
}

.status-chip {
	font-size: 0.85em;
	background: rgba(255, 255, 255, 0.1);
	padding: 0.05em 0.3em;
	border-radius: 0.2em;
}

/* Actions Center (Action Dock) */
.dock-actions-center {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.4em;
}

.ability-prompt-bar {
	display: flex;
	align-items: center;
	gap: 0.8em;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid #f6c445;
	padding: 0.3em 0.8em;
	border-radius: 0.35em;
	font-size: 0.8em;
	backdrop-filter: blur(0.3em);
}

.prompt-text {
	color: #f6c445;
	font-weight: bold;
}

.prompt-cancel-btn {
	background: rgba(239, 68, 68, 0.25);
	border: 1px solid #ef4444;
	color: #fca5a5;
	padding: 0.15em 0.5em;
	border-radius: 0.25em;
	font-size: 0.85em;
	cursor: pointer;
}

.prompt-cancel-btn:hover {
	background: rgba(239, 68, 68, 0.4);
	color: #ffffff;
}

.dock-buttons-row {
	display: flex;
	align-items: center;
	gap: 0.5em;
	background: rgba(15, 23, 42, 0.92);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: 0.5em;
	padding: 0.4em 0.6em;
	backdrop-filter: blur(0.4em);
	box-shadow: 0 0.3em 1em rgba(0, 0, 0, 0.5);
}

.dock-btn {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.1em;
	background: rgba(30, 41, 59, 0.8);
	border: 1px solid rgba(255, 255, 255, 0.2);
	color: #ffffff;
	padding: 0.35em 0.7em;
	border-radius: 0.35em;
	cursor: pointer;
	min-width: 5.5em;
	transition: background-color 0.2s, border-color 0.2s, transform 0.15s, box-shadow 0.2s;
	font-family: Kurale, sans-serif;
}

.dock-btn:hover:not(:disabled) {
	background: rgba(51, 65, 85, 0.9);
	border-color: #f6c445;
	transform: translateY(-0.1em);
}

.dock-btn.__is-active {
	background: rgba(246, 196, 69, 0.25) !important;
	border-color: #f6c445 !important;
	box-shadow: 0 0 0.6em rgba(246, 196, 69, 0.4);
}

.dock-btn.__disabled,
.dock-btn:disabled {
	opacity: 0.45;
	cursor: not-allowed;
	filter: grayscale(0.5);
}

.btn-icon {
	font-size: 1.25em;
}

.btn-title {
	font-size: 0.8em;
	font-weight: bold;
}

.btn-badge {
	font-size: 0.65em;
	color: #94a3b8;
}

.dock-btn.__move-btn {
	border-color: rgba(56, 189, 248, 0.4);
}

.dock-btn.__move-btn:hover:not(:disabled) {
	border-color: #38bdf8;
}

.dock-btn.__skip-btn {
	border-color: rgba(148, 163, 184, 0.4);
}

/* ── Combat Log (Bottom Left Collapsible) ── */
.combat-log-wrapper {
	position: absolute;
	left: 1em;
	bottom: 5.5em;
	z-index: 15;
	width: 17em;
	background: rgba(15, 23, 42, 0.85);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	backdrop-filter: blur(0.3em);
	overflow: hidden;
}

.combat-log-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.25em 0.6em;
	background: rgba(0, 0, 0, 0.4);
	cursor: pointer;
	font-size: 0.75em;
	color: #cbd5e1;
}

.log-toggle-btn {
	background: none;
	border: none;
	color: #f6c445;
	cursor: pointer;
	font-size: 0.8em;
}

.combat-log-body {
	max-height: 7em;
	overflow-y: auto;
	padding: 0.35em 0.5em;
	display: flex;
	flex-direction: column;
	gap: 0.2em;
	font-size: 0.72em;
}

.log-line {
	line-height: 1.25;
}

.log-damage { color: #f87171; }
.log-heal { color: #4ade80; }
.log-status { color: #facc15; }
.log-round { color: #f6c445; font-weight: bold; }
.log-info { color: #cbd5e1; }

/* ── Victory / Defeat Overlay ── */
.combat-result-overlay {
	position: absolute;
	inset: 0;
	z-index: 500;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(5, 8, 15, 0.75);
	backdrop-filter: blur(0.4em);
}

.result-card {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.8em;
	padding: 1.8em 2.4em;
	border-radius: 0.8em;
	background: rgba(15, 23, 42, 0.95);
	border: 2px solid #f6c445;
	box-shadow: 0 0.5em 2em rgba(0, 0, 0, 0.8);
	text-align: center;
	min-width: 18em;
}

.result-card.__win {
	border-color: #f6c445;
	box-shadow: 0 0 1.5em rgba(246, 196, 69, 0.35);
}

.result-card.__lose {
	border-color: #ef4444;
	box-shadow: 0 0 1.5em rgba(239, 68, 68, 0.35);
}

.result-icon-big {
	font-size: 3.2em;
	line-height: 1;
}

.result-heading {
	font-size: 1.6em;
	font-weight: bold;
	color: #ffffff;
}

.result-card.__win .result-heading {
	color: #f6c445;
}

.result-card.__lose .result-heading {
	color: #f87171;
}

.result-desc {
	font-size: 0.9em;
	color: #cbd5e1;
	max-width: 16em;
}

.result-continue-btn {
	margin-top: 0.4em;
	background: rgba(246, 196, 69, 0.2);
	border: 1px solid #f6c445;
	color: #f6c445;
	padding: 0.45em 1.6em;
	border-radius: 0.4em;
	font-size: 0.95em;
	font-weight: bold;
	cursor: pointer;
	font-family: Kurale, sans-serif;
	transition: background-color 0.2s, color 0.2s, transform 0.15s;
}

.result-continue-btn:hover {
	background: #f6c445;
	color: #0f172a;
	transform: scale(1.05);
}

/* Transitions */
.result-fade-enter-active,
.result-fade-leave-active {
	transition: opacity 0.35s ease;
}

.result-fade-enter-from,
.result-fade-leave-to {
	opacity: 0;
}

.fade-banner-enter-active,
.fade-banner-leave-active {
	transition: opacity 0.25s ease, transform 0.25s ease;
}

.fade-banner-enter-from,
.fade-banner-leave-to {
	opacity: 0;
	transform: translate(-50%, -0.5em);
}
</style>
