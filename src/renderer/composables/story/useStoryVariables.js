import { unref } from 'vue'
import { evaluateExpression } from '../../utils/expressionEvaluator'
import { useEncyclopedia } from '../useEncyclopedia'

export function useStoryVariables({
	globalData,
	characterData,
	baseUiVisibility,
	isRestoringGameState,
	notificationComponent,
	rebuildEquipmentBySlot,
	emit
} = {}) {
	function substituteVariables(text) {
		if (!text) return ''
		const cData = unref(characterData)
		const gData = unref(globalData)

		return text.replace(/\{([^}]+)\}/g, (match, variablePath) => {
			const parts = variablePath.split('.')
			if (parts[0] === 'character' && parts.length >= 3) {
				const characterId = parts[1]
				const propertyPath = parts.slice(2)
				if (cData && cData[characterId]) {
					let target = cData[characterId]
					for (let i = 0; i < propertyPath.length; i++) {
						const part = propertyPath[i]
						// Handle array indexing: items[0], items[indexOf(gasmask)]
						const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
						if (arrayMatch) {
							const arrayName = arrayMatch[1]
							const indexExpr = arrayMatch[2]
							if (target[arrayName] === undefined) return match
							let index = parseInt(indexExpr)
							// If index is NaN, try to find by property value
							if (isNaN(index)) {
								// Look for an item by itemId: items[gasmask] or items['gasmask']
								const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
								if (Array.isArray(target[arrayName])) {
									index = target[arrayName].findIndex(
										(item) => item.itemId === searchValue
									)
									if (index === -1) return match
								}
							}
							target = Array.isArray(target[arrayName])
								? target[arrayName][index]
								: undefined
							if (target === undefined) return match
						} else {
							if (target[part] === undefined) return match
							target = target[part]
						}
					}
					return target || ''
				}
			}
			if (parts[0] === 'global' && parts.length >= 2) {
				const propertyPath = parts.slice(1)
				let target = gData
				for (let i = 0; i < propertyPath.length; i++) {
					if (!target || target[propertyPath[i]] === undefined) return match
					target = target[propertyPath[i]]
				}
				return target || ''
			}
			return match
		})
	}

	function resolveSpeakerTitle(characterId, explicitTitle = null) {
		if (
			explicitTitle !== null &&
			explicitTitle !== undefined &&
			String(explicitTitle).trim() !== ''
		) {
			return substituteVariables(String(explicitTitle))
		}
		if (!characterId) return ''
		const cData = unref(characterData)
		const character = cData?.[characterId]
		if (character) {
			if (
				character.title !== null &&
				character.title !== undefined &&
				String(character.title).trim() !== ''
			) {
				return substituteVariables(String(character.title))
			}
			if (
				character.name !== null &&
				character.name !== undefined &&
				String(character.name).trim() !== ''
			) {
				return substituteVariables(String(character.name))
			}
		}
		return characterId
	}

	function updateCharacterData(variablePath, value) {
		const parts = variablePath.split('.')
		if (parts[0] === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			const cData = unref(characterData)
			if (cData && cData[characterId]) {
				let target = cData[characterId]
				for (let i = 0; i < propertyPath.length - 1; i++) {
					if (!target[propertyPath[i]]) target[propertyPath[i]] = {}
					target = target[propertyPath[i]]
				}
				const finalProperty = propertyPath[propertyPath.length - 1]
				target[finalProperty] = value
				if (
					rebuildEquipmentBySlot &&
					(propertyPath[0] === 'equipment_slots' ||
						finalProperty === 'equipment_slots' ||
						propertyPath.includes('equipment_slots'))
				) {
					rebuildEquipmentBySlot(characterId)
				}
			}
		}
	}

	function resolvePath(variablePath) {
		const parts = variablePath.split('.')
		const root = parts[0]
		const cData = unref(characterData)
		const gData = unref(globalData)

		if (root === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			if (!cData || !cData[characterId]) return null
			let target = cData[characterId]
			for (let i = 0; i < propertyPath.length - 1; i++) {
				const part = propertyPath[i]
				const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
				if (arrayMatch) {
					const arrayName = arrayMatch[1]
					const indexExpr = arrayMatch[2]
					if (target[arrayName] === undefined) {
						target[arrayName] = []
					}
					let index = parseInt(indexExpr)
					if (isNaN(index)) {
						const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
						if (Array.isArray(target[arrayName])) {
							index = target[arrayName].findIndex(
								(item) => item && (item.itemId === searchValue || item.id === searchValue)
							)
						}
					}
					if (index === -1 || !target[arrayName][index]) {
						return null
					}
					target = target[arrayName][index]
				} else {
					if (
						target[part] === undefined ||
						typeof target[part] !== 'object' ||
						target[part] === null
					) {
						target[part] = {}
					}
					target = target[part]
				}
			}
			const finalPart = propertyPath[propertyPath.length - 1]
			const arrayMatch = finalPart.match(/^(\w+)\[([^\]]+)\]$/)
			if (arrayMatch) {
				const arrayName = arrayMatch[1]
				const indexExpr = arrayMatch[2]
				let index = parseInt(indexExpr)
				if (isNaN(index)) {
					const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
					if (Array.isArray(target[arrayName])) {
						index = target[arrayName].findIndex(
							(item) => item && (item.itemId === searchValue || item.id === searchValue)
						)
					}
				}
				return {
					container: target[arrayName],
					key: index,
					root: 'character',
					id: characterId
				}
			}
			return {
				container: target,
				key: finalPart,
				root: 'character',
				id: characterId
			}
		}
		if (root === 'global' && parts.length >= 2) {
			const propertyPath = parts.slice(1)
			let target = gData
			for (let i = 0; i < propertyPath.length - 1; i++) {
				const part = propertyPath[i]
				const arrayMatch = part.match(/^(\w+)\[([^\]]+)\]$/)
				if (arrayMatch) {
					const arrayName = arrayMatch[1]
					const indexExpr = arrayMatch[2]
					if (target[arrayName] === undefined) target[arrayName] = []
					let index = parseInt(indexExpr)
					if (isNaN(index)) {
						const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
						if (Array.isArray(target[arrayName])) {
							index = target[arrayName].findIndex(
								(item) => item && (item.id === searchValue || item.itemId === searchValue)
							)
						}
					}
					if (index === -1 || !target[arrayName][index]) return null
					target = target[arrayName][index]
				} else {
					if (
						target[part] === undefined ||
						typeof target[part] !== 'object' ||
						target[part] === null
					) {
						target[part] = {}
					}
					target = target[part]
				}
			}
			const finalPart = propertyPath[propertyPath.length - 1]
			const arrayMatch = finalPart.match(/^(\w+)\[([^\]]+)\]$/)
			if (arrayMatch) {
				const arrayName = arrayMatch[1]
				const indexExpr = arrayMatch[2]
				let index = parseInt(indexExpr)
				if (isNaN(index)) {
					const searchValue = indexExpr.replace(/^['"]|['"]$/g, '')
					if (Array.isArray(target[arrayName])) {
						index = target[arrayName].findIndex(
							(item) => item && (item.id === searchValue || item.itemId === searchValue)
						)
					}
				}
				return {
					container: target[arrayName],
					key: index,
					root: 'global'
				}
			}
			return { container: target, key: finalPart, root: 'global' }
		}
		return null
	}

	function splitVariableExpressions(str) {
		const result = []
		let current = ''
		let inSingleQuote = false
		let inDoubleQuote = false

		for (let i = 0; i < str.length; i++) {
			const char = str[i]
			const prevChar = i > 0 ? str[i - 1] : ''

			if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
				inSingleQuote = !inSingleQuote
				current += char
			} else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
				inDoubleQuote = !inDoubleQuote
				current += char
			} else if ((char === ';' || char === '\n') && !inSingleQuote && !inDoubleQuote) {
				const trimmed = current.trim()
				if (trimmed) result.push(trimmed)
				current = ''
			} else {
				current += char
			}
		}

		const finalTrimmed = current.trim()
		if (finalTrimmed) result.push(finalTrimmed)
		return result
	}

	function applyVariable(expr) {
		if (!expr) return

		// Support array of variable expressions
		if (Array.isArray(expr)) {
			expr.forEach((item) => applyVariable(item))
			return
		}

		// Support key-value object map
		if (typeof expr === 'object') {
			for (const [key, val] of Object.entries(expr)) {
				if (typeof val === 'string') {
					applyVariable(`${key} = '${val}'`)
				} else if (typeof val === 'number' || typeof val === 'boolean') {
					applyVariable(`${key} = ${val}`)
				} else {
					const resolved = resolvePath(key)
					if (resolved && resolved.container && resolved.key !== undefined) {
						resolved.container[resolved.key] = val
						if (resolved.root === 'character' && emit) {
							emit('character-loaded', unref(characterData))
						} else if (resolved.root === 'global' && emit) {
							emit('global-data-changed', unref(globalData))
						}
					}
				}
			}
			return
		}

		if (typeof expr !== 'string') return

		// Support multiple statements separated by ';' or newlines
		if ((expr.includes(';') || expr.includes('\n')) && !expr.trim().startsWith('delete ')) {
			const subExprs = splitVariableExpressions(expr)
			if (subExprs.length > 1) {
				subExprs.forEach((sub) => applyVariable(sub))
				return
			}
		}

		const trimmedExpr = expr.trim()
		const cData = unref(characterData)
		const gData = unref(globalData)

		if (trimmedExpr.startsWith('delete ')) {
			const targetPath = trimmedExpr.substring(7).trim()
			const resolved = resolvePath(targetPath)
			if (resolved && resolved.container && resolved.key !== undefined) {
				delete resolved.container[resolved.key]
				console.log(`Applied variable (delete): ${targetPath}`)
				if (resolved.root === 'character') {
					emit && emit('character-loaded', cData)
				}
			}
			return
		}

		const m = trimmedExpr.match(/^\s*([a-zA-Z0-9_\.\[\]'"]+)\s*(\+=|-=|=|\*=|\/=)\s*(.+)\s*$/)
		if (!m) {
			console.warn('Unsupported variable expression:', expr)
			return
		}
		const targetPath = m[1]
		const op = m[2]
		const rhsRaw = m[3]

		const resolved = resolvePath(targetPath)
		if (!resolved) {
			console.warn('Could not resolve target path for variable:', targetPath)
			return
		}

		const rhsValue = evaluateExpression(rhsRaw, {
			global: gData,
			character: cData
		})
		const container = resolved.container
		const key = resolved.key
		const current = container[key]
		let newValue
		switch (op) {
			case '=':
				newValue = rhsValue
				break
			case '+=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) +
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '-=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) -
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '*=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) *
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
				break
			case '/=':
				newValue =
					(typeof current === 'number' ? current : Number(current) || 0) /
					(typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 1)
				break
			default:
				newValue = rhsValue
		}

		container[key] = newValue

		// Скрытие кнопки календаря при переключении на Новый Мир
		if (container === gData && key === 'calendarType' && newValue === 'new_world') {
			const bUi = unref(baseUiVisibility)
			if (bUi) {
				bUi['date-badge'] = false
				bUi['calendar-button'] = false
			}
		}

		const restoring =
			typeof isRestoringGameState === 'function'
				? isRestoringGameState()
				: (isRestoringGameState?.value ?? false)

		// Check sympathy notification
		if (
			!restoring &&
			(key.toString().includes('symp') || targetPath.includes('symp'))
		) {
			const prevNum = typeof current === 'number' ? current : Number(current) || 0
			const newNum = typeof newValue === 'number' ? newValue : Number(newValue) || 0
			const diff = newNum - prevNum
			const notifComp = unref(notificationComponent)
			if (diff !== 0 && notifComp) {
				let charId = null
				if (key.toString().endsWith('_mc_symp')) {
					charId = key.toString().replace(/_mc_symp$/, '')
				} else if (key.toString().endsWith('_symp')) {
					charId = key.toString().replace(/_symp$/, '')
				} else if (resolved.root === 'character') {
					charId = resolved.id
				}

				let charName = 'Персонаж'
				if (charId) {
					const resolvedTitle = resolveSpeakerTitle(charId)
					if (resolvedTitle && resolvedTitle !== charId) {
						charName = resolvedTitle
					} else {
						const encChar = useEncyclopedia().getCharacter(charId)
						if (encChar?.name) {
							charName = encChar.name
						} else {
							charName = charId.charAt(0).toUpperCase() + charId.slice(1)
						}
					}
				}

				const isPositive = diff > 0
				const sign = isPositive ? `+${diff}` : `${diff}`
				const icon = isPositive ? '❤️' : '💔'
				const titleText = isPositive ? 'Отношение улучшилось' : 'Отношение ухудшилось'
				const notifType = isPositive ? 'success' : 'warning'

				notifComp.showNotification(
					`<p><b>${icon} ${titleText}: ${charName}</b></p><p>${sign} (Симпатия: ${newNum})</p>`,
					notifType,
					3000
				)
			}
		}
		if (resolved.root === 'character') {
			console.log(`Applied variable: ${expr} -> ${resolved.id}.${key} =`, newValue)
			updateCharacterData(targetPath, newValue)
			// Эмитим событие если изменились данные персонажа (equipment_slots или свойства инвентаря)
			if (emit) {
				emit('character-loaded', cData)
			}
		} else {
			console.log(`Applied global variable: ${expr} -> ${targetPath} =`, newValue)
			// Также синхронизируем глобальные переменные
			if (emit) {
				console.log(
					`📤 Emitting global-data-changed after global variable change`,
					gData
				)
				emit('global-data-changed', gData)
			}
		}
	}

	function evaluateCondition(conditionStr) {
		if (!conditionStr || typeof conditionStr !== 'string') return false
		try {
			return Boolean(
				evaluateExpression(conditionStr, {
					global: unref(globalData),
					character: unref(characterData)
				})
			)
		} catch (error) {
			console.warn('Error evaluating condition:', conditionStr, error)
			return false
		}
	}

	function getInitialValue(variablePath) {
		if (!variablePath) return ''
		const parts = variablePath.split('.')
		const cData = unref(characterData)
		if (parts[0] === 'character' && parts.length >= 3) {
			const characterId = parts[1]
			const propertyPath = parts.slice(2)
			if (cData && cData[characterId]) {
				let target = cData[characterId]
				for (let i = 0; i < propertyPath.length; i++) {
					if (target[propertyPath[i]] === undefined) return ''
					target = target[propertyPath[i]]
				}
				return target || ''
			}
		}
		return ''
	}

	return {
		substituteVariables,
		resolveSpeakerTitle,
		updateCharacterData,
		resolvePath,
		applyVariable,
		applyVariables: applyVariable,
		evaluateCondition,
		getInitialValue
	}
}
