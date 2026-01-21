<template>
	<div class="game-area">
		<!-- Background -->
		<div class="game">
			<div 
				class="game-background" 
				:style="{ backgroundImage: backgroundStyle }"
			></div>
			
			<!-- Visual Novel Display with Sprites -->
			<div class="visual-novel-display">
				<!-- Character sprites -->
				<div class="sprites-container">
					<div 
						v-for="(sprite, spriteId) in g.sprites" 
						:key="spriteId"
						class="sprite"
						:class="[`position-${sprite.position}`]"
					>
						<img 
							:src="resolveImagePath(`/images/char/${spriteId}/tile/char.png`)" 
							:alt="spriteId"
							class="sprite-image"
						/>
					</div>
				</div>
			</div>
		</div>

		<!-- Game UI - Dialog and Controls -->
		<div class="game-ui">
			<!-- Current dialog text -->
			<div v-if="currentCommand && currentCommand.type === 'say'" class="dialog-display">
				<div v-if="currentCommand.speaker" class="dialog-speaker">
					{{ getSpeakerName(currentCommand.speaker) }}
				</div>
				<div class="dialog-text">
					{{ currentCommand.text }}
				</div>
				<div class="dialog-controls">
					<button @click="handleSayNext" class="dialog-next-button">
						{{ t('next') }}
					</button>
				</div>
			</div>

			<!-- Menu choices with previous dialog context -->
			<div v-if="currentCommand && currentCommand.type === 'menu'" class="menu-display">
				<!-- Show previous dialog as context -->
				<div v-if="lastDialog" class="dialog-context">
					<div v-if="lastDialog.speaker" class="dialog-speaker">
						{{ getSpeakerName(lastDialog.speaker) }}
					</div>
					<div class="dialog-text">
						{{ lastDialog.text }}
					</div>
				</div>
				<div class="menu-title">{{ t('game.choose') }}</div>
				<div class="menu-choices">
					<button 
						v-for="(choice, index) in currentCommand.choices"
						:key="index"
						class="menu-choice-button"
						@click="selectMenuChoice(choice.nextLabel)"
					>
						{{ choice.text }}
					</button>
				</div>
			</div>

			<!-- Game info bar -->
			<div class="game-info">
				<div class="info-item">Scene: {{ g.currentScene }}</div>
				<div class="info-item">Label: {{ g.currentLabel }}</div>
			</div>
		</div>

		<!-- Main Menu Modal (Escape key) -->
		<div v-if="showMainMenu" class="main-menu-modal" @keydown.esc="toggleMainMenu">
			<div class="page-area __dark">
				<div class="content-area">
					<DynamicContentArea 
						:current-view="currentView" 
						@back-to-menu="showHomeContent"
						@settings-saved="onSettingsSaved"
						@settings-reset="onSettingsReset"
					/>
				</div>
				<div class="menu-area __static">
					<MainMenu 
						:in-game-context="true" 
						:on-continue="toggleMainMenu" 
						show-back-to-main 
						@navigate="handleNavigation" 
					/>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useGameStore } from '@/stores/game'
	import { useRouter } from 'vue-router'
	import { resolveImagePath } from '@/utils/imageLoader.js'
	import MainMenu from '@/components/MainMenu.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'

	const { t, locale } = useI18n()
	const g = useGameStore()
	const router = useRouter()

	const showMainMenu = ref(false)
	const currentView = ref('main-menu')
	const lastDialog = ref(null) // Track last dialog before menu

	// Current command being displayed
	const currentCommand = computed(() => {
		if (!g.parsedScene) return null
		const cmd = g.getNextCommand()
		return cmd
	})

	// Background style
	const backgroundStyle = computed(() => {
		if (!g.currentBackground) {
			return "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
		}
		return `url('${resolveImagePath(`/images/scenes/${g.currentBackground}.jpg`)}') center/cover`
	})

	// Get speaker name (character or NPC)
	const getSpeakerName = (speakerId) => {
		if (speakerId === 'mc') {
			return g.mc.name || 'MC'
		}
		if (g.characters && g.characters[speakerId]) {
			return g.characters[speakerId].title || g.characters[speakerId].name || speakerId
		}
		return speakerId
	}

	// Execute next command and continue automatically if no user input needed
	const nextCommand = async () => {
		if (!g.parsedScene) {
			console.error('No parsed scene available')
			return
		}

		console.log('=== nextCommand() called ===')
		console.log('Current command index:', g.currentCommandIndex)

		let continueLoop = true
		let loopCount = 0
		
		while (continueLoop && loopCount < 100) { // Safety limit
			loopCount++
			console.log(`\n--- Loop iteration ${loopCount} ---`)
			
			const command = g.getNextCommand()
			console.log('Got command:', command)
			
			if (!command) {
				console.log('No more commands, returning to home')
				// End of scene - return to menu
				await router.push('/home')
				return
			}

			console.log('Executing command type:', command.type)
			const result = g.executeCommand(command)
			console.log('Command result:', result)

			// Check if we should continue looping BEFORE advancing
			if (result.waitForNext === true) {
				console.log('Command requires user input, stopping loop WITHOUT advancing')
				continueLoop = false
				// DO NOT call g.nextCommand() yet - we'll do it on next click
			} else {
				console.log('Command does not require user input, advancing and continuing loop')
				g.nextCommand()
				console.log('Advanced to command index:', g.currentCommandIndex)
				continue
			}
		}
		
		console.log('=== nextCommand() finished ===')
	}

	// Handle "next" button for say/dialog
	const handleSayNext = async () => {
		// Advance to next command
		g.nextCommand()
		// Execute next commands (may skip multiple non-blocking commands)
		await nextCommand()
	}

	// Handle menu choice
	const selectMenuChoice = async (nextLabel) => {
		g.jumpToLabel(nextLabel)
		await nextCommand()
	}

	// Toggle main menu (ESC key)
	const toggleMainMenu = () => {
		showMainMenu.value = !showMainMenu.value
	}

	const showHomeContent = () => {
		currentView.value = 'main-menu'
		showMainMenu.value = false
	}

	const handleNavigation = (view) => {
		if (view === 'settings') {
			currentView.value = 'settings'
		} else if (view === 'saves') {
			currentView.value = 'saves'
		} else if (view === 'main-menu') {
			router.push('/home')
		} else {
			showHomeContent()
		}
	}

	const onSettingsSaved = () => {
		console.log('Settings saved')
	}

	const onSettingsReset = () => {
		console.log('Settings reset to default')
	}

	// Handle ESC key
	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			toggleMainMenu()
		}
	}

	// Initialize scene on mount
	onMounted(async () => {
		document.addEventListener('keydown', handleKeyDown)

		// Scene should already be loaded from GameNew.vue
		// Just execute the first command
		try {
			console.log('Game.vue mounted')
			console.log('Scene already loaded:', g.currentScene)
			console.log('Total commands:', g.parsedScene?.commands?.length)
			
			// If scene is not loaded, load it (fallback)
			if (!g.parsedScene) {
				console.log('Scene not loaded, loading start scene with locale:', locale.value)
				await g.loadScene('start', locale.value)
			}
			
			// Execute first command
			console.log('Starting command execution...')
			await nextCommand()
			
			console.log('After nextCommand, current state:', {
				currentScene: g.currentScene,
				currentLabel: g.currentLabel,
				commandIndex: g.currentCommandIndex,
				currentCommand: g.getNextCommand()
			})
		} catch (error) {
			console.error('Failed to initialize game:', error)
		}
	})

	onUnmounted(() => {
		document.removeEventListener('keydown', handleKeyDown)
	})

	// Expose for debugging
	defineExpose({
		toggleMainMenu,
		nextCommand,
		selectMenuChoice
	})
</script>

<style scoped>
.game-area {
	display: flex;
	flex-direction: column;
	width: 100%;
	height: 100%;
	background: #1a1a1a;
	color: #fff;
}

.game {
	flex: 1;
	position: relative;
	overflow: hidden;
}

.game-background {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-size: cover;
	background-position: center;
	transition: background 0.5s ease;
}

.visual-novel-display {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: flex-end;
	justify-content: center;
	padding: 20px;
	z-index: 10;
}

.sprites-container {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	align-items: flex-end;
	justify-content: space-around;
}

.sprite {
	position: relative;
	max-height: 100%;
	display: flex;
	align-items: flex-end;
	animation: spriteEnter 0.5s ease-out;
}

.sprite-image {
	max-height: 80%;
	width: auto;
	object-fit: contain;
	filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5));
}

.position-left {
	align-self: flex-end;
	margin-right: auto;
}

.position-center {
	align-self: flex-end;
}

.position-right {
	align-self: flex-end;
	margin-left: auto;
}

@keyframes spriteEnter {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

/* Game UI */
.game-ui {
	flex: 0 0 auto;
	padding: 20px;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 0.6));
	border-top: 1px solid #444;
	min-height: 150px;
	display: flex;
	flex-direction: column;
	gap: 15px;
}

.dialog-display {
	animation: slideUp 0.3s ease-out;
}

.dialog-speaker {
	font-size: 1.1rem;
	font-weight: bold;
	color: #ffd700;
	margin-bottom: 8px;
}

.dialog-text {
	font-size: 1rem;
	line-height: 1.6;
	margin-bottom: 12px;
	color: #e0e0e0;
}

.dialog-controls {
	display: flex;
	gap: 10px;
}

.dialog-next-button {
	padding: 8px 16px;
	background: linear-gradient(135deg, #667eea, #764ba2);
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
	font-weight: bold;
	transition: all 0.3s ease;
}

.dialog-next-button:hover {
	transform: scale(1.05);
	box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Menu Display */
.menu-display {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.menu-title {
	font-weight: bold;
	color: #ffd700;
	margin-bottom: 8px;
}

.menu-choices {
	display: flex;
	flex-direction: column;
	gap: 8px;
}

.menu-choice-button {
	padding: 12px 16px;
	background: rgba(102, 126, 234, 0.8);
	color: white;
	border: 1px solid #667eea;
	border-radius: 4px;
	cursor: pointer;
	font-weight: bold;
	transition: all 0.3s ease;
	text-align: left;
}

.menu-choice-button:hover {
	background: #667eea;
	transform: translateX(4px);
	box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

/* Game Info */
.game-info {
	display: flex;
	gap: 20px;
	font-size: 0.8rem;
	color: #888;
}

.info-item {
	font-family: monospace;
}

/* Main Menu Modal */
.main-menu-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1000;
	display: flex;
	justify-content: center;
	align-items: center;
}

@keyframes slideUp {
	from {
		opacity: 0;
		transform: translateY(20px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}
</style>
