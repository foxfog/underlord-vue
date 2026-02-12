<template>
	<div v-if="isVisible" class="modal-overlay" @click="handleCancel">
		<div class="modal-drop-quantity" @click.stop>
			<div class="modal-header">
				<h4>Выбросить {{ itemName }}</h4>
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
				<button class="btn btn-cancel btn-secondary" @click="handleCancel">Отмена</button>
				<button class="btn btn-drop btn-primary" @click="handleConfirm">Выбросить</button>
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
