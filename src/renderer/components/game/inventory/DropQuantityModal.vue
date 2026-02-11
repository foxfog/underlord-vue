<template>
	<div v-if="isVisible" class="modal-overlay" @click="handleCancel">
		<div class="modal-drop-quantity" @click.stop>
			<div class="modal-header">
				<h3>Выбросить {{ itemName }}</h3>
				<button class="btn-close" @click="handleCancel">×</button>
			</div>

			<div class="modal-body">
				<div class="quantity-controls">
					<div class="quantity-display">
						<span class="label">Количество:</span>
						<span class="value">{{ selectedQuantity }} / {{ maxQuantity }}</span>
					</div>

					<UiRange
						v-model="selectedQuantity"
						:min="1"
						:max="maxQuantity"
					/>
				</div>
			</div>

			<div class="modal-footer">
				<button class="btn btn-cancel" @click="handleCancel">Отмена</button>
				<button class="btn btn-drop" @click="handleConfirm">Выбросить</button>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref } from 'vue'
import UiRange from '../../UI/UiRange.vue'

const props = defineProps({
	isVisible: { type: Boolean, default: false },
	itemName: { type: String, default: 'предмет' },
	maxQuantity: { type: Number, default: 1 }
})

const emit = defineEmits(['confirm', 'cancel'])

const selectedQuantity = ref(1)

function handleConfirm() {
	emit('confirm', selectedQuantity.value)
	selectedQuantity.value = 1
}

function handleCancel() {
	emit('cancel')
	selectedQuantity.value = 1
}
</script>

<style scoped>
.modal-overlay {
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background-color: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 9999;
}

.modal-drop-quantity {
	background-color: #2a2a2a;
	border: 2px solid #444;
	border-radius: 0.5em;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
	min-width: 300px;
	max-width: 400px;
}

.modal-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 1em;
	border-bottom: 1px solid #444;

	h3 {
		margin: 0;
		color: #fff;
		font-size: 1.1em;
	}

	.btn-close {
		background: none;
		border: none;
		color: #999;
		font-size: 1.5em;
		cursor: pointer;
		padding: 0;
		width: 2em;
		height: 2em;
		display: flex;
		align-items: center;
		justify-content: center;

		&:hover {
			color: #fff;
		}
	}
}

.modal-body {
	padding: 1.5em;
}

.quantity-controls {
	display: flex;
	flex-direction: column;
	gap: 1em;
}

.quantity-display {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 0.75em;
	background-color: rgba(255, 255, 255, 0.05);
	border-radius: 0.25em;
	border: 1px solid rgba(255, 255, 255, 0.1);

	.label {
		color: #999;
		font-size: 0.9em;
		font-weight: 600;
	}

	.value {
		color: #4CAF50;
		font-size: 1.1em;
		font-weight: bold;
	}
}

.modal-footer {
	display: flex;
	gap: 0.75em;
	padding: 1em;
	border-top: 1px solid #444;
	justify-content: flex-end;
}

.btn {
	padding: 0.5em 1em;
	border: 1px solid #444;
	border-radius: 0.25em;
	cursor: pointer;
	font-size: 0.9em;
	font-weight: 600;
	transition: all 0.2s;

	&:hover {
		border-color: #666;
	}

	&:active {
		transform: scale(0.98);
	}
}

.btn-cancel {
	background-color: #3a3a3a;
	color: #ddd;

	&:hover {
		background-color: #4a4a4a;
		color: #fff;
	}
}

.btn-drop {
	background-color: rgba(220, 53, 69, 0.2);
	color: #dc3545;
	border-color: #dc3545;

	&:hover {
		background-color: rgba(220, 53, 69, 0.3);
		color: #ff6b6b;
		border-color: #ff6b6b;
	}
}
</style>
