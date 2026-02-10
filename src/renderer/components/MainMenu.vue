<template>
	<div class="mainmenu">
		<nav class="nav">
			<a v-if="inGameContext" class="nav-link continue-button" @click="handleContinueClick">
				{{ t('mainmenu.continue') }}
			</a>
			
			<a v-if="inGameContext" class="nav-link" @click="navigateToHomeScreen">
				{{ t('mainmenu.exit-to-home') || 'В главное меню' }}
			</a>
			
			<template v-if="!inGameContext">
				<a class="nav-link" @click="navigateToNewGame">
					{{ t('mainmenu.game-new') }}
				</a>
				
				<a class="nav-link" @click="navigateToSaves">
					{{ t('mainmenu.game-saves') }}
				</a>
			</template>

			<a v-if="inGameContext" class="nav-link" @click="openSave">
				{{ t('save') || 'Сохранить' }}
			</a>
			
			<a class="nav-link" @click="openLoad">
				{{ t('load') || 'Загрузить' }}
			</a>
			
			<a class="nav-link" @click="navigateToSettings">
				{{ t('mainmenu.settings') }}
			</a>
			
			<a class="nav-link" @click="handleButtonClick">
				{{ t('mainmenu.close') }}
			</a>
		</nav>
	</div>
</template>

<script setup>
	import { useI18n } from 'vue-i18n'
	import { useRouter } from 'vue-router'

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
		},
	})
	
	const emit = defineEmits(['navigate'])
	const router = useRouter()
	const { t } = useI18n()

	const handleButtonClick = () => {
		if (window.electronAPI?.closeWindow) {
			window.electronAPI.closeWindow()
		} else {
			window.close()
		}
	}

	const handleContinueClick = () => {
		if (props.onContinue) {
			props.onContinue()
		} else {
			if (window.electronAPI?.closeWindow) {
				window.electronAPI.closeWindow()
			} else {
				window.close()
			}
		}
	}
	
	const navigateToSettings = () => {
		emit('navigate', 'settings')
	}
	
	const navigateToSaves = () => {
		emit('navigate', 'saves')
	}

	const openSave = () => {
		emit('navigate', 'save')
	}
	
	const openLoad = () => {
		emit('navigate', 'load')
	}
	
	const openSaveLoad = () => {
		emit('navigate', 'saves')
	}
	
	const navigateToMainMenu = () => {
		emit('navigate', 'main-menu')
	}
	
	const navigateToHomeScreen = () => {
		emit('navigate', 'home-screen')
	}
	
	const navigateToNewGame = () => {
		router.push('/game/new')
	}
</script>