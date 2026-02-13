<template>
	<div v-if="isVisible" class="modal" @click="closeModal">
		<div class="modal-content" @click.stop>
			<div class="modal-header">
				<h2 class="modal-title">{{ character?.name }} - Статистика</h2>
				<button class="btn-close" @click="closeModal">×</button>
			</div>
			<div class="modal-body">
				<div class="stats-grid">
					<div class="stat-item">
						<span class="stat-label">HP:</span>
						<span class="stat-value">{{ (character?.stats?.hp ?? character?.hp) }} / {{ (character?.stats?.hpmax ?? character?.hpmax) }}</span>
						<div class="stat-bar">
							<div 
								class="stat-fill" 
								:style="{ width: hpPercentage + '%' }"
							></div>
						</div>
					</div>
					
					<div class="stat-item">
						<span class="stat-label">MP:</span>
						<span class="stat-value">{{ (character?.stats?.mp ?? character?.mp) }} / {{ (character?.stats?.mpmax ?? character?.mpmax) }}</span>
						<div class="stat-bar">
							<div 
								class="stat-fill mp" 
								:style="{ width: mpPercentage + '%' }"
							></div>
						</div>
					</div>
					
					<div class="stat-item">
						<span class="stat-label">Атака:</span>
						<span class="stat-value">{{ character?.stats?.attack ?? character?.attack }}</span>
					</div>
				</div>
			</div>
			<div class="modal-footer">
				<button class="btn btn-primary" @click="closeModal">Закрыть</button>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed } from 'vue'

	const props = defineProps({
		isVisible: {
			type: Boolean,
			default: false
		},
		character: {
			type: Object,
			default: null
		}
	})

	const emit = defineEmits(['close'])

	const hpPercentage = computed(() => {
		if (!props.character) return 0
		// Support both old format (character.stats.hp) and new format (character.hp)
		const hp = props.character.stats?.hp ?? props.character.hp ?? 0
		const hpmax = props.character.stats?.hpmax ?? props.character.hpmax ?? 0
		return hpmax > 0 ? (hp / hpmax) * 100 : 0
	})

	const mpPercentage = computed(() => {
		if (!props.character) return 0
		// Support both old format (character.stats.mp) and new format (character.mp)
		const mp = props.character.stats?.mp ?? props.character.mp ?? 0
		const mpmax = props.character.stats?.mpmax ?? props.character.mpmax ?? 0
		return mpmax > 0 ? (mp / mpmax) * 100 : 0
	})

	function closeModal() {
		emit('close')
	}
</script>

