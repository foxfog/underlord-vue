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
				path: 'sound',
				name: 'playground-sound',
				component: () => import('@/views/PlaygroundSound.vue')
			},
			{
				path: 'map',
				name: 'playground-map',
				component: () => import('@/views/PlaygroundMap.vue')
			}
		]
	},
	]
})

export default router