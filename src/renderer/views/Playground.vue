<template>
	<div class="page-area __dark">
		<div class="content-area">
			<div class="page-header">
				<div class="page-title">{{ $t('mainmenu.playground') }}</div>
			</div>
			<div class="page-content">
				<div class="ui-tabs">
					<div class="ui-tabs-header">
						<router-link 
							to="/playground/sound" 
							class="ui-tabs-label" 
							:class="{ '__active': $route.path === '/playground/sound' || $route.path === '/playground' }"
						>
							{{ $t('playground.sound') }}
						</router-link>
						<router-link 
							to="/playground/map" 
							class="ui-tabs-label" 
							:class="{ '__active': $route.path === '/playground/map' }"
						>
							{{ $t('playground.map') }}
						</router-link>
					</div>
					<div class="ui-tabs-content">
						<router-view />
					</div>
				</div>
			</div>
		</div>
		<div class="menu-area __static">
			<MainMenu />
		</div>
	</div>
</template>

<script setup>
	import { onMounted } from 'vue'
	import { useRouter, useRoute } from 'vue-router'
	import MainMenu from '@/components/MainMenu.vue'
	
	const router = useRouter()
	const route = useRoute()
	
	// Redirect to sound page if on base playground route
	onMounted(() => {
		if (route.path === '/playground') {
			router.replace('/playground/sound')
		}
	})
</script>

<style scoped>
	/* Custom styles for playground navigation */
	.ui-tabs-label {
		text-decoration: none;
		display: inline-block;
	}
	
	.ui-tabs-content {
		min-height: 400px;
	}
</style>