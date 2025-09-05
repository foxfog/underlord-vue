<template>
    <div class="mainmenu">
        <nav class="nav">
            <router-link
                v-for="route in filteredRouters"
                :to="route.path"
                :key="route.name"
                class="nav-link"
            >
                {{ translateRouteName(`mainmenu.${route.name}`) }}
            </router-link>
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

	defineProps({
		enableMusic: {
			type: Boolean,
			default: false
		}
	})

	const route = useRoute()
	const { t } = useI18n()

	const routeNames = ['home', 'splash', 'settings', 'playground', 'test']
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

	const filteredRouters = computed(() =>
		routers.filter(r => !(r.name === 'home' && route.path === '/'))
	)
</script>
  