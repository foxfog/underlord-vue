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
						<span class="stat-value">{{ character?.stats?.hp }} / {{ character?.stats?.hpmax }}</span>
						<div class="stat-bar">
							<div 
								class="stat-fill" 
								:style="{ width: hpPercentage + '%' }"
							></div>
						</div>
					</div>
					
					<div class="stat-item">
						<span class="stat-label">MP:</span>
						<span class="stat-value">{{ character?.stats?.mp }} / {{ character?.stats?.mpmax }}</span>
						<div class="stat-bar">
							<div 
								class="stat-fill mp" 
								:style="{ width: mpPercentage + '%' }"
							></div>
						</div>
					</div>
					
					<div class="stat-item">
						<span class="stat-label">Атака:</span>
						<span class="stat-value">{{ character?.stats?.attack }}</span>
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
	if (!props.character?.stats) return 0
	return (props.character.stats.hp / props.character.stats.hpmax) * 100
})

const mpPercentage = computed(() => {
	if (!props.character?.stats) return 0
	return (props.character.stats.mp / props.character.stats.mpmax) * 100
})

function closeModal() {
	emit('close')
}
</script>

<style scoped>
.modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5);
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000;
}

.modal-content {
	background-color: #2c2c2c;
	border-radius: 8px;
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	min-width: 300px;
	max-width: 400px;
	width: 90%;
}

.modal-header {
	padding: 15px 20px;
	border-bottom: 1px solid #444;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.modal-title {
	margin: 0;
	font-size: 1.25rem;
	font-weight: 500;
	color: #fff;
}

.btn-close {
	background: none;
	border: none;
	font-size: 1.5rem;
	color: #aaa;
	cursor: pointer;
	padding: 0;
	width: 30px;
	height: 30px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn-close:hover {
	color: #fff;
}

.modal-body {
	padding: 20px;
}

.stats-grid {
	display: flex;
	flex-direction: column;
	gap: 15px;
}

.stat-item {
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.stat-label {
	font-weight: bold;
	color: #ddd;
}

.stat-value {
	color: #fff;
	font-size: 1.1rem;
}

.stat-bar {
	width: 100%;
	height: 12px;
	background-color: #444;
	border-radius: 6px;
	overflow: hidden;
}

.stat-fill {
	height: 100%;
	background-color: #4caf50;
	transition: width 0.3s ease;
}

.stat-fill.mp {
	background-color: #2196f3;
}

.modal-footer {
	padding: 15px 20px;
	border-top: 1px solid #444;
	display: flex;
	justify-content: flex-end;
}

.btn {
	padding: 8px 16px;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-size: 1rem;
}

.btn-primary {
	background-color: #007bff;
	color: white;
}

.btn-primary:hover {
	background-color: #0056b3;
}
</style>