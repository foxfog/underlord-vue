<template>
	<div class="tab-content-item abilities-tab-wrapper">
		<div v-if="abilities && abilities.length > 0" class="abilities-list">
			<div
				v-for="ability in abilities"
				:key="ability.id"
				class="ability-item-card"
			>
				<div class="ability-icon-box">
					<span class="ability-icon">{{ ability.icon || '⚔️' }}</span>
					<span v-if="ability.rank || ability.level" class="ability-rank-badge">
						{{ ability.rank || ability.level }} ур.
					</span>
				</div>

				<div class="ability-details">
					<div class="ability-header-row">
						<span class="ability-name">{{ ability.name }}</span>
						<span v-if="ability.branch" class="ability-branch-pill">{{ ability.branch }}</span>
						<span v-if="ability.isTalent" class="ability-talent-pill">🌟 Талант</span>
						<span v-if="ability.sourceItem" class="ability-source-pill" :title="ability.sourceUid ? `Экземпляр: ${ability.sourceUid}` : 'Снаряжение'">
							🗡️ {{ ability.sourceItem }}
						</span>
					</div>

					<div class="ability-description">{{ ability.description || 'Нет описания' }}</div>

					<!-- Custom JSON attributes (if any) -->
					<div v-if="ability.data && Object.keys(ability.data).length > 0" class="ability-params-row">
						<span
							v-for="(val, key) in ability.data"
							:key="key"
							class="ability-param-chip"
						>
							<span class="param-key">{{ formatParamKey(key) }}:</span>
							<strong class="param-val">{{ val }}</strong>
						</span>
					</div>
				</div>
			</div>
		</div>

		<div v-else class="empty-message">
			<span class="empty-icon">🍃</span>
			<span>Способности и навыки не изучены</span>
		</div>
	</div>
</template>

<script setup>
const props = defineProps({
	abilities: {
		type: Array,
		default: () => []
	}
})

function formatParamKey(key) {
	const map = {
		damage: 'Урон',
		damage_multiplier: 'Множитель',
		armor: 'Броня',
		armor_bonus: 'Бонус брони',
		ap_cost: 'Очки AP',
		mp_cost: 'Мана MP',
		cooldown: 'Кулдаун',
		type: 'Тип',
		element: 'Стихия'
	}
	return map[key] || key
}
</script>

<style scoped>
.abilities-tab-wrapper {
	width: 100%;
	height: 100%;
	overflow-y: auto;
	padding: 0.8em;
	display: flex;
	flex-direction: column;
	font-family: Kurale, sans-serif;
	font-size: calc(1 * var(--size));
}

.abilities-list {
	display: flex;
	flex-direction: column;
	gap: 0.8em;
}

.ability-item-card {
	background: rgba(18, 26, 43, 0.75);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 0.5em;
	padding: 0.8em 1em;
	display: flex;
	align-items: flex-start;
	gap: 0.8em;
	transition: background 0.15s, border-color 0.15s;
}

.ability-item-card:hover {
	background: rgba(26, 36, 60, 0.85);
	border-color: rgba(246, 196, 69, 0.35);
}

.ability-icon-box {
	width: 2.6em;
	height: 2.6em;
	background: rgba(0, 0, 0, 0.4);
	border: 1px solid rgba(255, 255, 255, 0.12);
	border-radius: 0.4em;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	flex-shrink: 0;
}

.ability-icon {
	font-size: 1.4em;
}

.ability-rank-badge {
	position: absolute;
	bottom: -0.3em;
	right: -0.3em;
	background: #10b981;
	color: #0f172a;
	font-size: 0.65em;
	font-weight: bold;
	padding: 0.05em 0.3em;
	border-radius: 0.25em;
}

.ability-details {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.3em;
}

.ability-header-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.ability-name {
	font-size: 1em;
	font-weight: bold;
	color: #f1f5f9;
}

.ability-branch-pill {
	font-size: 0.75em;
	background: rgba(59, 130, 246, 0.2);
	border: 1px solid #3b82f6;
	color: #93c5fd;
	padding: 0.1em 0.45em;
	border-radius: 0.25em;
}

.ability-talent-pill {
	font-size: 0.75em;
	background: rgba(234, 179, 8, 0.25);
	border: 1px solid #eab308;
	color: #fef08a;
	padding: 0.1em 0.45em;
	border-radius: 0.25em;
	font-weight: bold;
	box-shadow: 0 0 0.4em rgba(234, 179, 8, 0.3);
}

.ability-source-pill {
	font-size: 0.75em;
	background: rgba(245, 158, 11, 0.2);
	border: 1px solid #f59e0b;
	color: #fcd34d;
	padding: 0.1em 0.45em;
	border-radius: 0.25em;
}

.ability-description {
	font-size: 0.85em;
	color: #94a3b8;
	line-height: 1.35;
}

.ability-params-row {
	display: flex;
	flex-wrap: wrap;
	gap: 0.35em;
	margin-top: 0.2em;
}

.ability-param-chip {
	background: rgba(0, 0, 0, 0.35);
	border: 1px solid rgba(255, 255, 255, 0.08);
	border-radius: 0.25em;
	padding: 0.1em 0.4em;
	font-size: 0.75em;
	display: flex;
	gap: 0.25em;
}

.param-key {
	color: #64748b;
}

.param-val {
	color: #f6c445;
}

.empty-message {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 3em 1em;
	color: #64748b;
	font-size: 0.9em;
	gap: 0.5em;
}

.empty-icon {
	font-size: 2em;
}
</style>
