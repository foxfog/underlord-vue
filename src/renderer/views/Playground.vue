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
							to="/playground/ui" 
							class="ui-tabs-label" 
							:class="{ '__active': $route.path === '/playground/ui' || $route.path === '/playground' }"
						>
							{{ $t('playground.ui') }}
						</router-link>
						<router-link 
							to="/playground/door-status" 
							class="ui-tabs-label" 
							:class="{ '__active': $route.path === '/playground/door-status' }"
						>
							Door Status Test
						</router-link>
						<router-link 
							to="/playground/object-loading" 
							class="ui-tabs-label" 
							:class="{ '__active': $route.path === '/playground/object-loading' }"
						>
							Object Loading Test
						</router-link>
					</div>
					<div class="ui-tabs-content ui-scrollable">
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
			router.replace('/playground/ui')
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