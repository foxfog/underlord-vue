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
	{
		id: 2,
		name: 'settings',
		path: '/settings',
		component: () => import('@/views/Settings.vue')
	},
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
			{
				path: 'map',
				name: 'playground-map',
				component: () => import('@/views/PlaygroundMap.vue')
			}
		]
	},
	{
		id: 4,
		name: 'game-new',
		path: '/game/new',
		component: () => import('@/views/game/GameNew.vue')
	},
	{
		id: 5,
		name: 'game-saves',
		path: '/game/saves',
		component: () => import('@/views/game/GameSaves.vue')
	},
	]
})

export default router