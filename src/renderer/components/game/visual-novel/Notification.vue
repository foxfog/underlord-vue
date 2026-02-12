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
