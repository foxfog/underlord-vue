<template>
	<teleport to="body">
		<div v-if="visible" class="confirm-overlay" @click="onCancel">
			<div class="confirm-box" @click.stop>
				<div class="confirm-title" v-if="title">{{ title }}</div>
				<div class="confirm-message">{{ message }}</div>
				<div class="confirm-actions">
					<button class="btn btn-secondary" @click="onCancel">{{ cancelText }}</button>
					<button class="btn btn-primary" @click="onConfirm">{{ confirmText }}</button>
				</div>
			</div>
		</div>
	</teleport>
</template>

<script setup>
defineProps({
	visible: { type: Boolean, default: false },
	title: { type: String, default: '' },
	message: { type: String, required: true },
	confirmText: { type: String, default: 'OK' },
	cancelText: { type: String, default: 'Cancel' }
})

const emit = defineEmits(['confirm', 'cancel'])

function onConfirm() {
	emit('confirm')
}

function onCancel() {
	emit('cancel')
}
</script>
