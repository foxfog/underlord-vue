<template>
	<div class="tab-content-item stats-grid">
		<div class="stat-item">
			<span class="stat-label">HP:</span>
			<span class="stat-value">{{ hpDisplay }}</span>
			<div class="stat-bar"><div class="stat-fill" :style="{ width: hpPercentage + '%' }"></div></div>
		</div>

		<div class="stat-item">
			<span class="stat-label">MP:</span>
			<span class="stat-value">{{ mpDisplay }}</span>
			<div class="stat-bar"><div class="stat-fill mp" :style="{ width: mpPercentage + '%' }"></div></div>
		</div>

		<div class="stat-item">
			<span class="stat-label">Атака:</span>
			<span class="stat-value">{{ attack }}</span>
		</div>

		<div class="stat-item">
			<span class="stat-label">Защита:</span>
			<span class="stat-value">{{ defense }}</span>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'

	const props = defineProps({ character: { type: Object, default: null } })

	const hpPercentage = computed(() => {
		if (!props.character) return 0
		const hp = props.character.stats?.hp ?? props.character.hp ?? 0
		const hpmax = props.character.stats?.hpmax ?? props.character.hpmax ?? 0
		return hpmax > 0 ? (hp / hpmax) * 100 : 0
	})

	const mpPercentage = computed(() => {
		if (!props.character) return 0
		const mp = props.character.stats?.mp ?? props.character.mp ?? 0
		const mpmax = props.character.stats?.mpmax ?? props.character.mpmax ?? 0
		return mpmax > 0 ? (mp / mpmax) * 100 : 0
	})

	const hpDisplay = computed(() => {
		if (!props.character) return '0 / 0'
		const hp = props.character.stats?.hp ?? props.character.hp ?? 0
		const hpmax = props.character.stats?.hpmax ?? props.character.hpmax ?? 0
		return `${hp} / ${hpmax}`
	})

	const mpDisplay = computed(() => {
		if (!props.character) return '0 / 0'
		const mp = props.character.stats?.mp ?? props.character.mp ?? 0
		const mpmax = props.character.stats?.mpmax ?? props.character.mpmax ?? 0
		return `${mp} / ${mpmax}`
	})

	const attack = computed(() => props.character?.stats?.attack ?? props.character?.attack ?? 0)
	const defense = computed(() => props.character?.stats?.defense ?? props.character?.defense ?? 0)
</script>
