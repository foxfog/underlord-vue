<template>
	<teleport to="body">
		<div v-if="visible" class="confirm-overlay">
			<div class="confirm-box">
				<div class="confirm-title" v-if="title">{{ title }}</div>
				<div class="confirm-message">{{ message }}</div>
				<div class="confirm-actions">
					<button class="btn confirm" @click="$emit('yes')">
						{{ yesText }}
					</button>
					<button class="btn secondary" @click="$emit('no')">
						{{ noText }}
					</button>
					<button class="btn cancel" @click="$emit('cancel')">
						{{ cancelText }}
					</button>
				</div>
			</div>
		</div>
	</teleport>
</template>

<script setup>
defineProps({
	visible: {
		type: Boolean,
		default: false
	},
	title: {
		type: String,
		default: ''
	},
	message: {
		type: String,
		required: true
	},
	yesText: {
		type: String,
		default: 'Да'
	},
	noText: {
		type: String,
		default: 'Нет'
	},
	cancelText: {
		type: String,
		default: 'Отмена'
	}
})

defineEmits(['yes', 'no', 'cancel'])
</script>

