/**
 * Scene Parser - Parses .scene files in Ren'Py-like format
 * 
 * Syntax:
 * - Comments: # this is a comment
 * - Labels: label name_of_label
 * - Say: name "dialog text with {variables}"
 * - Menu: menu: / "choice text" -> goto_label
 * - Show sprite: show image_id as position
 * - Hide sprite: hide image_id
 * - Set background: scene background_id
 * - Set variable: $ variable = value
 * - Jump: jump label_name
 * - Return from call: return
 * - Call subroutine: call label_name
 * - Pause: pause [duration]
 * - End: return (at end of scene)
 */

export class SceneParser {
	constructor() {
		this.labels = {}
		this.commands = []
		this.currentLineNum = 0
	}

	/**
	 * Parse a scene file content
	 * @param {string} content - Raw scene file content
	 * @returns {object} Parsed scene object with labels and commands
	 */
	parse(content) {
		const lines = content.split('\n').map(line => line.trimEnd())
		this.labels = {}
		this.commands = []
		this.currentLineNum = 0

		// First pass: collect labels
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim()
			if (this.isLabel(line)) {
				const labelName = this.parseLabel(line)
				this.labels[labelName] = i
			}
		}

		// Second pass: parse commands
		let i = 0
		while (i < lines.length) {
			this.currentLineNum = i
			const line = lines[i]
			const trimmed = line.trim()

			// Skip empty lines and comments
			if (!trimmed || trimmed.startsWith('#')) {
				i++
				continue
			}

			// Skip labels - they're already registered
			if (this.isLabel(trimmed)) {
				i++
				continue
			}

			// Get the indentation level of this line
			const baseIndent = line.search(/\S/)

			// Parse command based on indentation and keyword
			const result = this.parseLine(trimmed, i, lines, i, baseIndent)
			if (result) {
				this.commands.push(result.command)
				// Skip lines consumed by this command
				i += result.linesConsumed || 1
			} else {
				i++
			}
		}

		return {
			labels: this.labels,
			commands: this.commands,
			startLabel: 'start',
			version: '1.0'
		}
	}

	/**
	 * Check if line is a label definition
	 */
	isLabel(line) {
		return /^label\s+\w+/.test(line)
	}

	/**
	 * Parse label definition
	 */
	parseLabel(line) {
		const match = line.match(/^label\s+(\w+)/)
		return match ? match[1] : null
	}

	/**
	 * Check if line is a say statement
	 */
	isSay(line) {
		// Check for: speaker "text" or just "text"
		return /^(\w+\s+)?"[^"]*"/.test(line)
	}

	/**
	 * Parse a single line into a command
	 * Returns: { command, linesConsumed } or null
	 */
	parseLine(line, lineNum, lines = [], currentIndex = 0, baseIndent = 0) {
		// Set variable: $ variable = value
		if (line.startsWith('$')) {
			return { command: this.parseVariableAssignment(line), linesConsumed: 1 }
		}

		// Scene (background): scene background_id
		if (line.startsWith('scene ')) {
			return {
				command: {
					type: 'scene',
					background: line.slice(6).trim(),
					lineNum
				},
				linesConsumed: 1
			}
		}

		// Show sprite: show sprite_id at position
		if (line.startsWith('show ')) {
			return { command: this.parseShow(line, lineNum), linesConsumed: 1 }
		}

		// Hide sprite: hide sprite_id
		if (line.startsWith('hide ')) {
			return {
				command: {
					type: 'hide',
					sprite: line.slice(5).trim(),
					lineNum
				},
				linesConsumed: 1
			}
		}

		// Jump: jump label_name
		if (line.startsWith('jump ')) {
			return {
				command: {
					type: 'jump',
					label: line.slice(5).trim(),
					lineNum
				},
				linesConsumed: 1
			}
		}

		// Call: call label_name
		if (line.startsWith('call ')) {
			return {
				command: {
					type: 'call',
					label: line.slice(5).trim(),
					lineNum
				},
				linesConsumed: 1
			}
		}

		// Menu: menu: / "choice 1" -> label1 / "choice 2" -> label2
		if (line.startsWith('menu:')) {
			return this.parseMenuWithLineCount(line, lineNum, lines, currentIndex, baseIndent)
		}

		// Say: speaker "text" or just "text"
		if (this.isSay(line)) {
			return { command: this.parseSay(line, lineNum), linesConsumed: 1 }
		}

		// Pause: pause [duration]
		if (line.startsWith('pause')) {
			const match = line.match(/pause\s*(\d+)?/)
			return {
				command: {
					type: 'pause',
					duration: match && match[1] ? parseInt(match[1]) : 1,
					lineNum
				},
				linesConsumed: 1
			}
		}

		// Return/end scene
		if (line === 'return') {
			return {
				command: {
					type: 'return',
					lineNum
				},
				linesConsumed: 1
			}
		}

		return null
	}

	/**
	 * Parse variable assignment: $ var = value
	 */
	parseVariableAssignment(line) {
		const match = line.match(/^\$\s*([\w.]+)\s*=\s*(.+)$/)
		if (!match) return null

		const [, variable, valueStr] = match
		let value = valueStr.trim()

		// Parse value type
		if (value === 'true') value = true
		else if (value === 'false') value = false
		else if (value === 'null') value = null
		else if (!isNaN(value)) value = Number(value)
		else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1)
		}

		return {
			type: 'set',
			variable,
			value,
			lineNum: this.currentLineNum
		}
	}

	/**
	 * Parse show command: show sprite_id at position
	 */
	parseShow(line, lineNum) {
		const match = line.match(/^show\s+([\w-]+)(?:\s+at\s+(\w+))?/)
		if (!match) return null

		return {
			type: 'show',
			sprite: match[1],
			position: match[2] || 'center',
			lineNum
		}
	}

	/**
	 * Parse say command: speaker "text" or "text"
	 */
	parseSay(line, lineNum) {
		// Try: speaker "text"
		const match1 = line.match(/^(\w+)\s+"([^"]*)"/)
		if (match1) {
			return {
				type: 'say',
				speaker: match1[1],
				text: match1[2],
				lineNum
			}
		}

		// Try: "text" (no speaker)
		const match2 = line.match(/^"([^"]*)"/)
		if (match2) {
			return {
				type: 'say',
				speaker: null,
				text: match2[1],
				lineNum
			}
		}

		return null
	}

	/**
	 * Parse menu with line count: menu: / "choice 1" -> label1 / "choice 2" -> label2
	 * OR multiline format:
	 * menu:
	 *     / "choice 1" -> label1
	 *     / "choice 2" -> label2
	 * Returns: { command, linesConsumed } or null
	 */
	parseMenuWithLineCount(line, lineNum, lines = [], currentIndex = 0, baseIndent = 0) {
		const choices = []
		let linesConsumed = 1
		
		// First try single-line format: menu: / "choice 1" -> label1 / "choice 2" -> label2
		if (line.includes('->')) {
			const choiceRegex = /"([^"]+)"\s*->\s*(\w+)/g
			let match
			while ((match = choiceRegex.exec(line)) !== null) {
				choices.push({
					text: match[1],
					nextLabel: match[2]
				})
			}
			if (choices.length > 0) {
				return {
					command: {
						type: 'menu',
						choices,
						lineNum
					},
					linesConsumed: 1
				}
			}
		}

		// Try multiline format: look ahead for "/ " lines
		if (line === 'menu:' && lines && lines.length > currentIndex) {
			// Look at following lines
			let lineIdx = currentIndex + 1
			let menuIndent = null

			while (lineIdx < lines.length) {
				const nextLine = lines[lineIdx]
				const trimmedNext = nextLine.trim()

				// Skip empty lines and comments
				if (!trimmedNext || trimmedNext.startsWith('#')) {
					lineIdx++
					continue
				}

				// Determine menu item indent from first choice
				if (menuIndent === null) {
					menuIndent = nextLine.search(/\S/)
					// Menu items must be more indented than base command
					if (menuIndent <= baseIndent) {
						break
					}
				}

				const currentIndent = nextLine.search(/\S/)

				// Stop if indent goes back to base level or less
				if (currentIndent <= baseIndent) {
					break
				}

				// Parse choice line
				if (trimmedNext.startsWith('/')) {
					const choiceMatch = trimmedNext.match(/\/\s*"([^"]+)"\s*->\s*(\w+)/)
					if (choiceMatch) {
						choices.push({
							text: choiceMatch[1],
							nextLabel: choiceMatch[2]
						})
						linesConsumed++
					} else {
						// Invalid choice format, stop parsing menu
						break
					}
				} else if (currentIndent === menuIndent) {
					// Non-choice line at menu level, stop parsing menu
					break
				}

				lineIdx++
			}

			if (choices.length > 0) {
				return {
					command: {
						type: 'menu',
						choices,
						lineNum
					},
					linesConsumed
				}
			}
		}

		return null
	}
}

/**
 * Load and parse a .scene file
 * @param {string} scenePath - Path to the scene file (relative to public/data/scenes)
 * @param {string} language - Language code (en, ru)
 * @returns {Promise<object>} Parsed scene object
 */
export async function loadSceneFile(scenePath, language = 'en') {
	try {
		// Try to fetch the scene file
		const filename = scenePath.endsWith('.scene') ? scenePath : `${scenePath}.scene`
		const path = `/data/scenes/${language}/${filename}`

		const response = await fetch(path)
		if (!response.ok) {
			throw new Error(`Failed to load scene: ${path}`)
		}

		const content = await response.text()
		const parser = new SceneParser()
		return parser.parse(content)
	} catch (error) {
		console.error('Scene loading error:', error)
		throw error
	}
}

/**
 * Get label line number by name
 */
export function getLabelLineNumber(parsedScene, labelName) {
	return parsedScene.labels[labelName] || -1
}

/**
 * Get commands starting from a label
 */
export function getCommandsFromLabel(parsedScene, labelName) {
	const lineNum = parsedScene.labels[labelName]
	if (lineNum === undefined) {
		console.warn(`Label not found: ${labelName}`)
		return []
	}

	// Filter commands that are after this label
	return parsedScene.commands.filter(cmd => cmd.lineNum > lineNum)
}
