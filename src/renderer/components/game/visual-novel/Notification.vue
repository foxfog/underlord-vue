<template>
	<div class="notifications-container">
		<transition-group name="notification" tag="div">
			<div 
				v-for="notification in notifications" 
				:key="notification.id"
				class="notification"
				:class="notification.type"
			>
				<div class="notification-content" v-html="notification.html"></div>
			</div>
		</transition-group>
	</div>
</template>

<script setup>
import { ref, computed } from 'vue'

const notifications = ref([])
let notificationCounter = 0

const showNotification = (html, type = 'info', duration = 3000) => {
	const id = notificationCounter++
	const notification = {
		id,
		html,
		type
	}
	
	notifications.value.push(notification)
	
	setTimeout(() => {
		notifications.value = notifications.value.filter(n => n.id !== id)
	}, duration)
}

defineExpose({
	showNotification
})
</script>

<style scoped>
.notifications-container {
	position: fixed;
	top: 2rem;
	left: 2rem;
	z-index: 10000;
	display: flex;
	flex-direction: column;
	gap: 1rem;
	pointer-events: none;
}

.notification {
	background-color: #2a2a2a;
	border: 2px solid #444;
	border-radius: 0.5rem;
	padding: 1rem 1.5rem;
	min-width: 250px;
	max-width: 400px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	pointer-events: auto;
	animation: slideIn 0.3s ease-out;
	
	&.info {
		border-color: #4a9eff;
		background: linear-gradient(135deg, #1a3a52 0%, #2a2a2a 100%);
	}
	
	&.success {
		border-color: #4CAF50;
		background: linear-gradient(135deg, #1a4a1a 0%, #2a2a2a 100%);
	}
	
	&.warning {
		border-color: #f39c12;
		background: linear-gradient(135deg, #4a3a1a 0%, #2a2a2a 100%);
	}
	
	&.error {
		border-color: #e74c3c;
		background: linear-gradient(135deg, #4a1a1a 0%, #2a2a2a 100%);
	}
}

.notification-content {
	color: #ddd;
	font-size: 0.95rem;
	line-height: 1.4;
	
	p {
		margin: 0.25rem 0;
		
		&:first-child {
			margin-top: 0;
		}
		
		&:last-child {
			margin-bottom: 0;
		}
	}
}

/* Transition animations */
.notification-enter-active {
	animation: slideIn 0.3s ease-out;
}

.notification-leave-active {
	animation: slideOut 0.3s ease-in;
}

@keyframes slideIn {
	from {
		opacity: 0;
		transform: translateX(-20px);
	}
	to {
		opacity: 1;
		transform: translateX(0);
	}
}

@keyframes slideOut {
	from {
		opacity: 1;
		transform: translateX(0);
	}
	to {
		opacity: 0;
		transform: translateX(-20px);
	}
}
</style>
