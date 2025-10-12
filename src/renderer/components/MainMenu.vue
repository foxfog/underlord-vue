<template>
    <div class="mainmenu">
        <nav class="nav">
            <!-- Show Continue button only when in game context -->
            <a v-if="inGameContext" class="nav-link continue-button" @click="handleContinueClick">
                {{ t('mainmenu.continue') }}
            </a>
            <router-link
                v-for="route in filteredRouters"
                :to="route.path"
                :key="route.name"
                class="nav-link"
            >
                {{ translateRouteName(`mainmenu.${route.name}`) }}
            </router-link>
            <!-- Show Close button only when not in game context -->
            <a class="nav-link" @click="handleButtonClick">
                {{ t('mainmenu.close') }}
            </a>
        </nav>
    </div>
</template>

<script setup>
	import { computed } from 'vue'
	import { RouterLink, useRoute } from 'vue-router'
	import { useI18n } from 'vue-i18n'
	import router from '@/router'

	const props = defineProps({
		enableMusic: {
			type: Boolean,
			default: false
		},
		inGameContext: {
			type: Boolean,
			default: false
		},
		onContinue: {
			type: Function,
			default: null
		}
	})

	const route = useRoute()
	const { t } = useI18n()

	const routeNames = ['home', 'game-new', 'game-saves', 'splash', 'settings', 'playground', 'test']
	const routers = routeNames
		.map(name => router.options.routes.find(r => r.name === name))
		.filter(Boolean)

	const translateRouteName = (name, data = {}) => t(name, data)

	const handleButtonClick = () => {
		if (window.electronAPI?.closeWindow) {
			window.electronAPI.closeWindow()
		} else {
			window.close()
		}
	}

	const handleContinueClick = () => {
		// If a custom continue handler is provided, use it
		if (props.onContinue) {
			props.onContinue()
		} else {
			// Default behavior
			if (window.electronAPI?.closeWindow) {
				window.electronAPI.closeWindow()
			} else {
				window.close()
			}
		}
	}

	const filteredRouters = computed(() =>
		routers.filter(r => !(r.name === 'home' && route.name === 'home'))
	)
</script>

<style scoped>
.continue-button {
	position: absolute;
	top: 20px;
	right: 20px;
}
</style>