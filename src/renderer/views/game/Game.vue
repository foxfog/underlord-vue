<template>
	<div class="game-area">
		<div class="game">
			<div class="game-background"></div>
			<LocationIso />
		</div>
		<div class="game-ui">
			<!-- Character cards button -->
			<button @click="toggleCharacterCards" class="character-cards-btn">
				Show Character Cards
			</button>
			
			<!-- Character cards modal -->
			<div v-if="showCharacterCards" class="character-cards-modal" @click="toggleCharacterCards">
				<div class="modal-content" @click.stop>
					<h2>Characters on Location</h2>
					<div class="character-cards-container">
						<div 
							v-for="character in charactersOnLocation" 
							:key="character.id" 
							class="character-card"
						>
							<div class="character-card-header">
								<h3>{{ getCharacterName(character.id) }}</h3>
								<span v-if="getCharacterNickname(character.id)" class="character-nickname">
									{{ getCharacterNickname(character.id) }}
								</span>
							</div>
							<div class="character-card-body">
								<div class="character-image">
									<img 
										:src="getCharacterImage(character.id)" 
										:alt="getCharacterName(character.id)"
										class="char-img"
									/>
								</div>
								<div class="character-attributes">
									<h4>Attributes:</h4>
									<ul>
										<li v-for="(value, key) in getCharacterAttributes(character.id)" :key="key">
											<strong>{{ key }}:</strong> {{ value }}
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
					<button @click="toggleCharacterCards" class="close-btn">Close</button>
				</div>
			</div>
			
			<!-- Dialog triggers in game-ui -->
			 <div v-if="g.mc.name">
				Игра началась, {{ g.mc.name }}!
			</div>
			<div v-else>
				Игра началась
			</div>
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
		</div>
		<div class="game-modals">
			<!-- Main menu modal with dynamic content -->
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
						<MainMenu :in-game-context="true" :on-continue="toggleMainMenu" show-back-to-main @navigate="handleNavigation" />
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { useGameStore } from '@/stores/game'
	import { useDialogStore } from '@/stores/dialog'
	import { useRouter } from 'vue-router'
	import { getLocationById, getLocationCharacters } from '@/utils/locationLoader.js'
	import { getCharacterByIdAsync, getCharacterImagePath } from '@/utils/characterLoader.js'
	import { resolveImagePath } from '@/utils/imageLoader.js'
	import MainMenu from '@/components/MainMenu.vue'
	import DynamicContentArea from '@/components/DynamicContentArea.vue'
	import LocationIso from '@/components/game/LocationIso.vue'
	
	const { locale, t } = useI18n()
	const g = useGameStore()
	const dialogStore = useDialogStore()
	const router = useRouter()
	const showMainMenu = ref(false)
	const showDialogChoices = ref(false)
	const showCharacterCards = ref(false)
	const currentView = ref('main-menu')
	const characterDataCache = ref({})
	
	// Toggle character cards visibility
	const toggleCharacterCards = () => {
		showCharacterCards.value = !showCharacterCards.value
	}
	
	// Get characters on current location
	const charactersOnLocation = computed(() => {
		const locationId = g.location || 'mc-apartment'
		return getLocationCharacters(locationId) || []
	})
	
	// Get character name with translation support
	const getCharacterName = (characterId) => {
		// First check if we have cached data
		if (characterDataCache.value[characterId]) {
			const data = characterDataCache.value[characterId]
			if (data.name && data.name.startsWith('{') && data.name.endsWith('}')) {
				const key = data.name.slice(1, -1)
				const translated = t(key)
				return translated.includes('characters.') ? characterId : translated
			}
			return data.name || characterId
		}
		
		// Check game store for character data
		if (g.characters && g.characters[characterId]) {
			const charData = g.characters[characterId]
			if (charData.name && charData.name.startsWith('{') && charData.name.endsWith('}')) {
				const key = charData.name.slice(1, -1)
				const translated = t(key)
				return translated.includes('characters.') ? characterId : translated
			}
			return charData.name || characterId
		}
		
		// Default to character ID
		return characterId
	}
	
	// Get character nickname with translation support
	const getCharacterNickname = (characterId) => {
		// First check if we have cached data
		if (characterDataCache.value[characterId]) {
			const data = characterDataCache.value[characterId]
			if (data.nickname && data.nickname.startsWith('{') && data.nickname.endsWith('}')) {
				const key = data.nickname.slice(1, -1)
				const translated = t(key)
				return translated.includes('characters.') ? '' : translated
			}
			return data.nickname || ''
		}
		
		// Check game store for character data
		if (g.characters && g.characters[characterId]) {
			const charData = g.characters[characterId]
			if (charData.nickname && charData.nickname.startsWith('{') && charData.nickname.endsWith('}')) {
				const key = charData.nickname.slice(1, -1)
				const translated = t(key)
				return translated.includes('characters.') ? '' : translated
			}
			return charData.nickname || ''
		}
		
		return ''
	}
	
	// Get character image
	const getCharacterImage = (characterId) => {
		// Try to get from cached data
		if (characterDataCache.value[characterId]) {
			const data = characterDataCache.value[characterId]
			if (data.tile && data.tile.front && data.tile.front.body && data.tile.front.body.torso) {
				return resolveImagePath(data.tile.front.body.torso)
			}
		}
		
		// Try to get from character loader
		const imagePath = getCharacterImagePath(characterId)
		if (imagePath) {
			return resolveImagePath(imagePath)
		}
		
		// Fallback to default
		return resolveImagePath('/images/char/default/tile/char.png')
	}
	
	// Get character attributes
	const getCharacterAttributes = (characterId) => {
		// First check if we have cached data
		if (characterDataCache.value[characterId]) {
			return characterDataCache.value[characterId].attributes || {}
		}
		
		// Check game store for character data
		if (g.characters && g.characters[characterId]) {
			return g.characters[characterId].stats || g.characters[characterId].attributes || {}
		}
		
		return {}
	}
	
	// Load character data and cache it
	const loadCharacterData = async (characterId) => {
		if (!characterDataCache.value[characterId]) {
			try {
				const data = await getCharacterByIdAsync(characterId)
				if (data) {
					characterDataCache.value[characterId] = data
				}
			} catch (error) {
				console.error(`Error loading character data for ${characterId}:`, error)
			}
		}
	}
	
	// Load all character data when showing character cards
	const loadAllCharacterData = async () => {
		const characters = charactersOnLocation.value
		const loadPromises = characters.map(char => loadCharacterData(char.id))
		await Promise.all(loadPromises)
	}
	
	// Watch for character cards being shown
	const unwatch = computed(() => showCharacterCards.value)
	
	// When character cards are shown, load all character data
	watch(unwatch, async (newVal) => {
		if (newVal) {
			await loadAllCharacterData()
		}
	})
	
	// Toggle main menu visibility
	const toggleMainMenu = () => {
		showMainMenu.value = !showMainMenu.value
		// Reset to main menu view when opening/closing
		if (showMainMenu.value) {
			currentView.value = 'main-menu'
		}
	}
	
	// Navigation handlers
	const showHomeContent = () => {
		currentView.value = 'main-menu'
		showMainMenu.value = false
	}
	
	const showSettings = () => {
		currentView.value = 'settings'
	}
	
	const showSaves = () => {
		currentView.value = 'saves'
	}
	
	// Navigate to home/main menu page
	const navigateToHome = () => {
		router.push('/home')
	}
	
	const handleNavigation = (view) => {
		if (view === 'settings') {
			showSettings()
		} else if (view === 'saves') {
			showSaves()
		} else if (view === 'main-menu') {
			// Navigate to home page when "На главную" is clicked
			navigateToHome()
		} else {
			showHomeContent()
		}
	}
	
	function onSettingsSaved() {
		console.log('Settings saved')
	}
	
	function onSettingsReset() {
		console.log('Settings reset to default')
	}
	
	// Handle ESC key press
	const handleKeyDown = (event) => {
		if (event.key === 'Escape') {
			// Always open the main menu when ESC is pressed, regardless of dialog state
			toggleMainMenu()
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

<style>
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

.dialog-display {
	position: absolute;
	bottom: 0;
}

.dialog-choices-content {
	pointer-events: auto;
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

.character-cards-btn {
	position: absolute;
	top: 20px;
	right: 20px;
	z-index: 100;
	padding: 8px 16px;
	background-color: #4a4a4a;
	color: white;
	border: 1px solid #ccc;
	border-radius: 4px;
	cursor: pointer;
}

.character-cards-btn:hover {
	background-color: #5a5a5a;
}

.character-cards-modal {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.7);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 2000;
}

.character-cards-modal .modal-content {
	background-color: white;
	padding: 20px;
	border-radius: 8px;
	max-width: 800px;
	width: 90%;
	max-height: 80vh;
	overflow-y: auto;
	color: black;
}

.character-cards-container {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	gap: 20px;
	margin: 20px 0;
}

.character-card {
	border: 1px solid #ddd;
	border-radius: 8px;
	padding: 15px;
	background-color: #f9f9f9;
}

.character-card-header {
	border-bottom: 1px solid #eee;
	padding-bottom: 10px;
	margin-bottom: 10px;
}

.character-card-header h3 {
	margin: 0 0 5px 0;
}

.character-nickname {
	background-color: #e0e0e0;
	padding: 2px 6px;
	border-radius: 4px;
	font-size: 0.9em;
}

.character-card-body {
	display: flex;
	flex-direction: column;
	align-items: center;
}

.character-image {
	margin-bottom: 15px;
}

.character-image .char-img {
	max-width: 100px;
	height: auto;
}

.character-attributes h4 {
	margin: 10px 0 5px 0;
}

.character-attributes ul {
	list-style-type: none;
	padding: 0;
	margin: 0;
}

.character-attributes li {
	margin: 3px 0;
}

.close-btn {
	margin-top: 20px;
	padding: 8px 16px;
	background-color: #4a4a4a;
	color: white;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.close-btn:hover {
	background-color: #5a5a5a;
}
</style>