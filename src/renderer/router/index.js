// src/renderer/router/index.js

import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from '@/views/Home.vue'

const router = createRouter({
	history: createWebHashHistory(),
	routes: [
		{
		id: 0,
		path: '/',
		name: 'splash',
		component: () => import('@/views/SplashScreen.vue')
		},
		{
			id: 1,
			name: 'home',
			path: '/home',
			component: HomeView
		},
		// Removed settings and game-saves routes since they're now embedded
		{
			id: 3,
			name: 'playground',
			path: '/playground',
			component: () => import('@/views/Playground.vue'),
			children: [
				{
					path: 'ui',
					name: 'playground-ui',
					component: () => import('@/views/PlaygroundUI.vue')
				},
			]
		},
		{
			id: 4,
			name: 'game-new',
			path: '/game/new',
			component: () => import('@/views/game/GameNew.vue')
		},
		{
			id: 6,
			name: 'game',
			path: '/game',
			component: () => import('@/views/game/Game.vue')
		},
	]
})

export default router