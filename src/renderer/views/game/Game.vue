<template>
	<div class="game-area">
		<div class="game">
			<div class="game-background"></div>
			<div class="location _isometric">
				<div v-if="g.mc.name">
					Игра началась, {{ g.mc.name }}!
				</div>
				<div v-else>
					Игра началась
				</div>
			</div>
		</div>
		<div class="game-ui">
			<!-- Dialog triggers in game-ui -->
			<div class="dialog-triggers">
				<button @click="startFirstDialog" class="dialog-trigger-button">
					Начать первый диалог
				</button>
				<button @click="startSecondDialog" class="dialog-trigger-button">
					Начать второй диалог
				</button>
				<button @click="startThirdDialog" class="dialog-trigger-button">
					Начать третий диалог
				</button>
				<button @click="startTestDialog" class="dialog-trigger-button">
					Тест переменных
				</button>
			</div>
			
			<!-- Main dialog display in game-ui -->
			<div v-if="dialogStore.isDialogActive" class="dialog-display">
				<div class="dialog-speaker">
					{{ getCurrentSpeakerName }}
				</div>
				<div class="dialog-text">
					{{ getCurrentDialogText }}
				</div>
				<!-- Next button for sequential phrases -->
				<div class="dialog-controls">
					<button 
						v-if="!hasChoices && dialogStore.isDialogActive" 
						@click="nextDialogPhrase" 
						class="dialog-next-button"
					>
						{{ t('next') }}
					</button>
				</div>
			</div>
		</div>
		<div class="game-modals">
			<!-- Dialog choices modal in center of screen without backdrop -->
			<div v-if="showDialogChoices && dialogStore.getCurrentNode?.choices?.length > 0" 
				 class="dialog-choices-modal">
				<div class="modal-container">
					<div class="dialog-choices-content">
						<button 
							v-for="choice in getCurrentChoices" 
							:key="choice.id"
							class="dialog-choice-button"
							@click="selectChoice(choice.id)"
						>
							{{ choice.displayText }}
						</button>
					</div>
				</div>
			</div>
			
			<div v-if="showMainMenu" class="main-menu-modal" @keydown.esc="toggleMainMenu">
				<div class="modal-backdrop" @click="toggleMainMenu"></div>
				<div class="modal-container">
					<div class="menu-area __static">
						<MainMenu :in-game-context="true" :on-continue="toggleMainMenu" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { computed, ref, onMounted, onUnmounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useGameStore } from '@/stores/game'
	import { useDialogStore } from '@/stores/dialog'
	import MainMenu from '@/components/MainMenu.vue'
	
	const { locale, t } = useI18n()
	const g = useGameStore()
	const dialogStore = useDialogStore()
	const showMainMenu = ref(false)
	const showDialogChoices = ref(false)
	
	// Toggle main menu visibility
	const toggleMainMenu = () => {
		showMainMenu.value = !showMainMenu.value
	}
	
	// Handle ESC key press
	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			if (dialogStore.isDialogActive && showDialogChoices.value) {
				showDialogChoices.value = false
			} else {
				toggleMainMenu()
			}
		}
	}
	
	// Start the first intro dialog
	const startFirstDialog = () => {
		dialogStore.startDialog('intro_scene')
		showDialogChoices.value = true
	}
	
	// Start the second dialog
	const startSecondDialog = () => {
		dialogStore.startDialog('second_scene')
		showDialogChoices.value = true
	}
	
	// Start the third dialog (sequential phrases without choices)
	const startThirdDialog = () => {
		dialogStore.startDialog('third_scene')
		showDialogChoices.value = false // No choices for this dialog
	}
	
	// Start the test variables dialog
	const startTestDialog = () => {
		dialogStore.startDialog('test_variables')
		showDialogChoices.value = true
	}
	
	// Handle choice selection
	const selectChoice = (choiceId) => {
		dialogStore.makeChoice(choiceId)
		// After making a choice, show choices again if there are any
		// If dialog ended, hide the choices modal
		if (!dialogStore.isDialogActive) {
			showDialogChoices.value = false
		} else if (dialogStore.getCurrentNode?.choices?.length > 0) {
			showDialogChoices.value = true
		} else {
			// No choices available, hide the modal
			showDialogChoices.value = false
		}
	}
	
	// Next dialog phrase for sequential dialogs
	const nextDialogPhrase = () => {
		dialogStore.nextSequentialNode()
		// If dialog ended, hide the dialog
		if (!dialogStore.isDialogActive) {
			showDialogChoices.value = false
		}
	}
	
	// Check if current node has choices
	const hasChoices = computed(() => {
		return dialogStore.getCurrentNode?.choices?.length > 0
	})
	
	// Get current speaker name based on speaker ID
	const getCurrentSpeakerName = computed(() => {
		const speaker = dialogStore.getCurrentNode?.speaker
		if (!speaker) return ''
		
		// Use player name from store for MC
		if (speaker === 'mc') {
			// Try to get translated name first, fallback to store value
			const translatedName = t(`characters.${speaker}.name`)
			if (translatedName && !translatedName.includes('characters.')) {
				return translatedName
			}
			return g.mc.name || 'MC'
		}
		
		// Use character name from translations for NPCs
		if (g.characters && g.characters[speaker]) {
			// Try to get translated name first, fallback to store value
			const translatedTitle = t(`characters.${speaker}.title`)
			if (translatedTitle && !translatedTitle.includes('characters.')) {
				return translatedTitle
			}
			return g.characters[speaker].title || g.characters[speaker].name || speaker
		}
		
		// Fallback
		return speaker
	})
	
	// Get current dialog text based on current locale
	const getCurrentDialogText = computed(() => {
		const node = dialogStore.getCurrentNode
		if (!node) return ''
		
		// Get the text directly (no need to handle multiple languages here anymore)
		let text = node.text || ''
		
		// Process text with flexible variable replacement
		text = processDialogText(text)
		
		return text
	})
	
	// Get current choices with processed text
	const getCurrentChoices = computed(() => {
		const node = dialogStore.getCurrentNode
		if (!node || !node.choices) return []
		
		return node.choices.map(choice => {
			// Get the text directly (no need to handle multiple languages here anymore)
			let text = choice.text || ''
			
			// Process text with flexible variable replacement
			text = processDialogText(text)
			
			return {
				...choice,
				displayText: text
			}
		})
	})
	
	// Flexible text processing function that can replace any variable from game store
	const processDialogText = (text) => {
		if (!text) return ''
		
		// Create a regex to match placeholders like {mc.name} or {world.cur_time} (without 'g.')
		// Also support the old format with 'g.' for backward compatibility
		const placeholderRegex = /{(?:g\.)?[\w.]+}/g
		
		return text.replace(placeholderRegex, (match) => {
			// Remove the curly braces
			const content = match.slice(1, -1) // Remove '{' and '}'
			
			// Remove 'g.' prefix if present (for backward compatibility)
			const path = content.startsWith('g.') ? content.slice(2) : content
			
			// Special handling for character names - try to get translated values first
			if (path.startsWith('characters.')) {
				// Try to get translated value first
				const pathParts = path.split('.')
				if (pathParts.length >= 3) {
					const characterId = pathParts[1]
					const property = pathParts[2]
					const translatedValue = t(`characters.${characterId}.${property}`)
					if (translatedValue && !translatedValue.includes('characters.')) {
						return translatedValue
					}
				}
			}
			
			// Navigate through the game store object using the path
			try {
				const keys = path.split('.')
				let value = g
				
				// Traverse the object using the keys
				for (const key of keys) {
					if (value && typeof value === 'object' && key in value) {
						value = value[key]
					} else {
						// If path doesn't exist, return the original placeholder
						return match
					}
				}
				
				// Return the found value or the original placeholder if value is undefined
				return value !== undefined ? String(value) : match
			} catch (error) {
				console.warn(`Error processing placeholder ${match}:`, error)
				return match // Return original placeholder if there's an error
			}
		})
	}
	
	// Add event listener when component mounts
	onMounted(() => {
		document.addEventListener('keydown', handleKeyDown)
	})
	
	// Remove event listener when component unmounts
	onUnmounted(() => {
		document.removeEventListener('keydown', handleKeyDown)
	})
	
	// Expose toggle function to be called from other components if needed
	defineExpose({
		toggleMainMenu
	})
</script>

<style scoped>
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

.dialog-choices-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: 1500;
	display: flex;
	justify-content: center;
	align-items: center;
	pointer-events: none; /* Allow clicking through the overlay */
}

.modal-container {
	position: relative;
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.mainmenu {
	width: 100%;
	max-width: 500px;
	background-color: transparent;
	position: relative;
}

.nav {
	position: relative;
}

.dialog-triggers {
	position: absolute;
	top: 20px;
	left: 50%;
	transform: translateX(-50%);
	display: flex;
	gap: 10px;
	z-index: 100;
}

.dialog-trigger-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a4a6a, #2a2a4a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dialog-trigger-button:hover {
	background: linear-gradient(145deg, #5a5a8a, #3a3a6a);
	transform: translateY(-1px);
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.4);
}

.dialog-trigger-button:active {
	transform: translateY(0);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.dialog-display {
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translateX(-50%);
	background: rgba(0, 0, 0, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 8px;
	padding: 15px 20px;
	min-width: 300px;
	max-width: 600px;
	text-align: center;
	backdrop-filter: blur(5px);
}

.dialog-speaker {
	font-size: 1.2em;
	font-weight: bold;
	color: #ffcc00;
	margin-bottom: 8px;
}

.dialog-text {
	font-size: 1em;
	line-height: 1.4;
	color: #ffffff;
	margin-bottom: 15px;
}

.dialog-controls {
	display: flex;
	justify-content: center;
	gap: 10px;
}

.dialog-next-button {
	padding: 8px 16px;
	background: linear-gradient(145deg, #4a4a6a, #2a2a4a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 6px;
	font-size: 0.9em;
	cursor: pointer;
	transition: all 0.3s ease;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.dialog-next-button:hover {
	background: linear-gradient(145deg, #5a5a8a, #3a3a6a);
	transform: translateY(-1px);
	box-shadow: 0 4px 6px rgba(0, 0, 0, 0.4);
}

.dialog-next-button:active {
	transform: translateY(0);
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.dialog-choices-content {
	width: 100%;
	max-width: 500px;
	background: linear-gradient(145deg, #2a2a3a, #1a1a2a);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 10px;
	padding: 20px;
	box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
	pointer-events: auto; /* Enable pointer events for the content */
}

.dialog-choice-button {
	display: block;
	width: 100%;
	padding: 12px 15px;
	margin-bottom: 10px;
	background: rgba(50, 50, 70, 0.7);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 5px;
	text-align: left;
	cursor: pointer;
	transition: all 0.2s ease;
}

.dialog-choice-button:last-child {
	margin-bottom: 0;
}

.dialog-choice-button:hover {
	background: rgba(70, 70, 100, 0.9);
	border-color: rgba(255, 255, 255, 0.4);
	transform: translateY(-2px);
}
</style>