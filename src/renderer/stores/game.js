// src/renderer/stores/game.js
import { defineStore } from 'pinia'
import { loadSceneFile, getCommandsFromLabel } from '@/utils/sceneParser.js'

let _GameStore = null

export function initGameStore() {
	if (_GameStore) return // уже инициализирован

	_GameStore = defineStore('game', {
		state: () => ({
			// Player character
			mc: {
				name: 'MC',
				nicname: 'player',
				title: 'player',
			},
			// NPCs
			characters: {
				momonga: {
					name: 'Сатору',
					surname: 'Судзуки',
					nicname: 'Momonga',
					title: 'Ainz',
					stats: {
						intelect: 100,
						strength: 10,
						agility: 10,
						luck: 10
					}
				}
			},
			// World state
			world: {
				cur_time: 'day',
			},
			// Current location state
			location: 'test-location',
			
			// === Scene Execution State ===
			// Current scene file being executed
			currentScene: null,
			// Currently loaded and parsed scene data
			parsedScene: null,
			// Current label/checkpoint in scene
			currentLabel: 'start',
			// Current command index in execution
			currentCommandIndex: 0,
			// Current backgrounds and sprites on screen
			currentBackground: null,
			sprites: {}, // { spriteId: { image, position } }
			// Call stack for nested scene calls
			callStack: [],
			// Scene variables (local to current scene)
			sceneVariables: {}
		}),

		getters: {
			// Removed McName getter - accessing mc.name directly instead
		},

		actions: {
			// === Scene Loading and Execution ===
			
			/**
			 * Load and initialize a scene file
			 * @param {string} sceneName - Name of scene file (without .scene extension)
			 * @param {string} language - Language code (en, ru)
			 */
			async loadScene(sceneName, language) {
				try {
					const parsedScene = await loadSceneFile(sceneName, language)
					this.currentScene = sceneName
					this.parsedScene = parsedScene
					this.currentLabel = 'start'
					this.callStack = []
					this.sprites = {}
					this.sceneVariables = {}
					
					// Jump to start label to set correct command index
					this.jumpToLabel('start')
					
					return parsedScene
				} catch (error) {
					console.error(`Failed to load scene ${sceneName}:`, error)
					throw error
				}
			},

			/**
			 * Jump to a label within current scene
			 * @param {string} label - Label name
			 */
			jumpToLabel(label) {
				if (!this.parsedScene || !this.parsedScene.labels[label]) {
					console.warn(`Label not found: ${label}`)
					return
				}
				this.currentLabel = label
				// Reset command index to start after this label
				const labelLineNum = this.parsedScene.labels[label]
				this.currentCommandIndex = this.parsedScene.commands.findIndex(cmd => cmd.lineNum > labelLineNum)
				if (this.currentCommandIndex === -1) {
					this.currentCommandIndex = this.parsedScene.commands.length
				}
			},

			/**
			 * Execute a single command
			 * @param {object} command - Command object from parsed scene
			 * @returns {object} Result object with action taken
			 */
			executeCommand(command) {
				if (!command) return { type: 'noop' }

				switch (command.type) {
					case 'say':
						return {
							type: 'say',
							speaker: command.speaker,
							text: this.processText(command.text),
							waitForNext: true
						}

					case 'menu':
						return {
							type: 'menu',
							choices: command.choices.map(choice => ({
								...choice,
								text: this.processText(choice.text)
							})),
							waitForNext: true
						}

					case 'show':
						this.sprites[command.sprite] = {
							image: command.sprite,
							position: command.position
						}
						return {
							type: 'show',
							sprite: command.sprite,
							position: command.position,
							waitForNext: false
						}

					case 'hide':
						delete this.sprites[command.sprite]
						return {
							type: 'hide',
							sprite: command.sprite,
							waitForNext: false
						}

					case 'scene':
						this.currentBackground = command.background
						return {
							type: 'scene',
							background: command.background,
							waitForNext: false
						}

					case 'set':
						return this.setVariable(command.variable, command.value)

					case 'jump':
						this.jumpToLabel(command.label)
						return {
							type: 'jump',
							label: command.label,
							waitForNext: false
						}

					case 'call':
						this.callStack.push({
							label: this.currentLabel,
							commandIndex: this.currentCommandIndex
						})
						this.jumpToLabel(command.label)
						return {
							type: 'call',
							label: command.label,
							waitForNext: false
						}

					case 'return':
						if (this.callStack.length > 0) {
							const context = this.callStack.pop()
							this.jumpToLabel(context.label)
							this.currentCommandIndex = context.commandIndex + 1
						}
						return {
							type: 'return',
							waitForNext: false
						}

					case 'pause':
						return {
							type: 'pause',
							duration: command.duration,
							waitForNext: true
						}

					default:
						return { type: 'noop', waitForNext: false }
				}
			},

			/**
			 * Get next command to execute
			 * @returns {object|null} Next command or null if at end
			 */
			getNextCommand() {
				if (!this.parsedScene) return null
				if (this.currentCommandIndex >= this.parsedScene.commands.length) {
					return null
				}
				return this.parsedScene.commands[this.currentCommandIndex]
			},

			/**
			 * Advance to next command
			 */
			nextCommand() {
				if (this.parsedScene && this.currentCommandIndex < this.parsedScene.commands.length) {
					this.currentCommandIndex++
				}
			},

			/**
			 * Process text with variable substitution
			 * @param {string} text - Text with {variable} placeholders
			 * @returns {string} Processed text
			 */
			processText(text) {
				if (!text) return ''

				return text.replace(/{([^}]+)}/g, (match, path) => {
					// Try scene variables first
					if (this.sceneVariables[path] !== undefined) {
						return String(this.sceneVariables[path])
					}

					// Try game state (mc.name, world.cur_time, etc)
					const parts = path.split('.')
					let value = this
					for (const part of parts) {
						if (value && typeof value === 'object' && part in value) {
							value = value[part]
						} else {
							return match // Return original if not found
						}
					}

					return String(value)
				})
			},

			/**
			 * Set a variable (game state or scene variable)
			 * @param {string} path - Variable path (e.g., "mc.name" or "game.visited")
			 * @param {*} value - Value to set
			 */
			setVariable(path, value) {
				const parts = path.split('.')

				if (parts[0] === 'game' && parts.length > 1) {
					// Game state variables - create if doesn't exist
					let current = this.world
					for (let i = 1; i < parts.length - 1; i++) {
						if (!current[parts[i]]) {
							current[parts[i]] = {}
						}
						current = current[parts[i]]
					}
					current[parts[parts.length - 1]] = value
				} else {
					// Scene variables
					this.sceneVariables[path] = value
				}

				return {
					type: 'set',
					variable: path,
					value,
					waitForNext: false
				}
			},

			/**
			 * Get current state for saving
			 */
			getCheckpoint() {
				return {
					currentScene: this.currentScene,
					currentLabel: this.currentLabel,
					currentCommandIndex: this.currentCommandIndex,
					mc: { ...this.mc },
					characters: JSON.parse(JSON.stringify(this.characters)),
					world: JSON.parse(JSON.stringify(this.world)),
					location: this.location,
					sprites: JSON.parse(JSON.stringify(this.sprites)),
					currentBackground: this.currentBackground,
					sceneVariables: JSON.parse(JSON.stringify(this.sceneVariables)),
					timestamp: new Date().toISOString()
				}
			},

			/**
			 * Restore from a checkpoint
			 */
			restoreCheckpoint(checkpoint) {
				this.currentScene = checkpoint.currentScene
				this.currentLabel = checkpoint.currentLabel
				this.currentCommandIndex = checkpoint.currentCommandIndex
				this.mc = { ...checkpoint.mc }
				this.characters = JSON.parse(JSON.stringify(checkpoint.characters))
				this.world = JSON.parse(JSON.stringify(checkpoint.world))
				this.location = checkpoint.location
				this.sprites = JSON.parse(JSON.stringify(checkpoint.sprites || {}))
				this.currentBackground = checkpoint.currentBackground
				this.sceneVariables = JSON.parse(JSON.stringify(checkpoint.sceneVariables || {}))
			},

			// === Legacy Actions ===
			
			updateMcName(name) {
				this.mc.name = name
			},
			
			// Action to update current location
			updateLocation(locationId) {
				this.location = locationId
			},
			
			// Action to load save data into the store
			loadSaveData(saveData) {
				// Merge save data with current state
				// For each property in the current state, use the saved value if it exists, otherwise keep current
				const currentState = this.$state
				const mergedState = {}
				
				for (const key in currentState) {
					if (saveData[key] !== undefined) {
						mergedState[key] = saveData[key]
					} else {
						mergedState[key] = currentState[key]
					}
				}
				
				// Update the store with merged data
				this.$patch(mergedState)
			},
			
			// Other game actions can be added here
		}
	})
}

export function useGameStore() {
	if (!_GameStore) {
		initGameStore()
	}
	return _GameStore()
}