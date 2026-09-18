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
		{
			id: 4,
			name: 'iso-tester',
			path: '/test/isometric',
			component: () => import('@/views/IsoTesterView.vue')
		},
		{
			id: 5,
			name: 'iso-editor',
			path: '/test/isometric-editor',
			component: () => import('@/views/IsoEditorView.vue')
		},
		{
			id: 6,
			name: 'combat-tester',
			path: '/test/combat',
			component: () => import('@/views/CombatTesterView.vue')
		},
		{
			id: 7,
			name: 'data-editor',
			path: '/test/data-editor',
			component: () => import('@/views/DataEditorView.vue')
		},
		{
			id: 8,
			name: 'localization-manager',
			path: '/test/localization',
			component: () => import('@/views/LocalizationManagerView.vue')
		},
		{
			id: 9,
			name: 'skill-tree-tester',
			path: '/test/skill-tree',
			component: () => import('@/views/SkillTreeTesterView.vue')
		},
		{
			id: 10,
			name: 'character-sprites-tester',
			path: '/test/character-sprites',
			component: () => import('@/views/CharacterSpriteTesterView.vue')
		},
		{
			id: 11,
			name: 'storyline-editor',
			path: '/test/storyline-editor',
			component: () => import('@/views/StorylineEditorView.vue')
		}
	]
})

export default router
