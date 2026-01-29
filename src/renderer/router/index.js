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
			name: 'game',
			path: '/game',
			component: () => import('@/views/Game.vue')
		},
		{
			id: 3,
			name: 'new-game',
			path: '/game/new',
			component: () => import('@/views/Game.vue'),
			meta: { newGame: true }
		},
	]
})

export default router