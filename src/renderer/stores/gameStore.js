import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
	createInitialCharacterData,
	createInitialGlobalData
} from '../constants/gameInitialState'

export const useGameStore = defineStore('game', () => {
	const globalData = ref(createInitialGlobalData())
	const characterData = ref(createInitialCharacterData())
	const sceneData = ref({})
	const currentScene = ref(null)

	// A helper to safely update globalData fully (e.g. from save)
	function setGlobalData(data) {
		globalData.value = data
	}
	
	function setCharacterData(data) {
		characterData.value = data
	}

	function setSceneData(data) {
		sceneData.value = data
	}

	function setCurrentScene(sceneId) {
		currentScene.value = sceneId
	}

	function resetState() {
		globalData.value = createInitialGlobalData()
		characterData.value = createInitialCharacterData()
		sceneData.value = {}
		currentScene.value = null
	}

	return {
		globalData,
		characterData,
		sceneData,
		currentScene,
		setGlobalData,
		setCharacterData,
		setSceneData,
		setCurrentScene,
		resetState
	}
})
