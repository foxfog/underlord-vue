<template>
    <div class="mainmenu">
        <nav class="nav">
            <!-- Show Continue button only when in game context (moved to first position) -->
            <a v-if="inGameContext" class="nav-link continue-button" @click="handleContinueClick">
                {{ t('mainmenu.continue') }}
            </a>
            
            <!-- Exit to Main Screen option when in game -->
            <a v-if="inGameContext" class="nav-link" @click="navigateToHomeScreen">
                {{ t('mainmenu.exit-to-home') || 'В главное меню' }}
            </a>
            
            
			<!-- Navigation links for non-game context -->
			<template v-if="!inGameContext">
				<a class="nav-link" @click="navigateToNewGame">
					{{ t('mainmenu.game-new') }}
				</a>
                
				<a class="nav-link" @click="navigateToSaves">
					{{ t('mainmenu.game-saves') }}
				</a>
			</template>

			<!-- Save/Load modal (Ren'Py-like) -->
			<a v-if="inGameContext" class="nav-link" @click="openSaveLoad">
				{{ t('mainmenu.save_load') || 'Save/Load' }}
			</a>
            
            
            <!-- Navigation links that emit events for component switching -->
            <a class="nav-link" @click="navigateToSettings">
                {{ t('mainmenu.settings') }}
            </a>
            
            <!-- Show Close button -->
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
		// If a custom continue handler is provided, use it
		if (props.onContinue) {
			props.onContinue()
		} else {
			// Default behavior
			if (window.electronAPI?.closeWindow) {
				window.electronAPI.closeWindow()
			} else {
				window.close()
			}
		}
	}
	
	// Navigation functions that emit events for component switching
	const navigateToSettings = () => {
		emit('navigate', 'settings')
	}
	
	const navigateToSaves = () => {
		emit('navigate', 'saves')
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
	
	// Navigation functions that use router for page navigation
	const navigateToNewGame = () => {
		router.push('/game/new')
	}
</script>