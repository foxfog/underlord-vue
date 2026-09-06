/**
 * Safe expression evaluator for Visual Novel conditions and variable assignments.
 * Does NOT use eval() or new Function() to comply with strict Electron Content Security Policy.
 */

export function resolveVariablePath(path, context = {}) {
	if (!path || typeof path !== 'string') return undefined
	const { global = {}, character = {} } = context

	const normalized = path.trim()
	if (normalized === 'global') return global
	if (normalized === 'character') return character

	let root
	let rest
	if (
		normalized.startsWith('global.') ||
		normalized.startsWith('global?.') ||
		normalized.startsWith('global.?')
	) {
		root = global
		rest = normalized.replace(/^global(?:\?\.|(?:\.\?)|\.)/, '')
	} else if (
		normalized.startsWith('character.') ||
		normalized.startsWith('character?.') ||
		normalized.startsWith('character.?')
	) {
		root = character
		rest = normalized.replace(/^character(?:\?\.|(?:\.\?)|\.)/, '')
	} else {
		return undefined
	}

	const segments = rest.split(/(?:\?\.|(?:\.\?)|\.)/)
	let current = root

	for (const segment of segments) {
		if (current === null || current === undefined) return undefined

		const bracketMatch = segment.match(/^(\w+)\[([^\]]+)\]$/)
		if (bracketMatch) {
			const prop = bracketMatch[1]
			const key = bracketMatch[2].replace(/^['"]|['"]$/g, '')
			current = current[prop]
			if (current === null || current === undefined) return undefined

			if (Array.isArray(current)) {
				const numIdx = Number(key)
				if (!isNaN(numIdx)) {
					current = current[numIdx]
				} else {
					current = current.find(
						(item) => item && (item.id === key || item.itemId === key)
					)
				}
			} else if (typeof current === 'object') {
				current = current[key]
			}
		} else {
			current = current[segment]
		}
	}

	return current
}

export function evaluateExpression(expr, context = {}) {
	if (expr === null || expr === undefined) return undefined
	if (typeof expr !== 'string') return expr

	const raw = expr
		.trim()
		.replace(/^\{|\}$/g, '')
		.trim()
	if (!raw) return false

	const tokens = tokenize(raw)
	if (tokens.length === 0) return false

	let cursor = 0
	function peek() {
		return tokens[cursor]
	}
	function consume(expected) {
		const token = tokens[cursor]
		if (expected && token !== expected) {
			// expected token check
		}
		cursor++
		return token
	}

	function parsePrimary() {
		const token = peek()
		if (!token) return undefined

		if (token === '(') {
			consume('(')
			const val = parseLogicalOr()
			if (peek() === ')') consume(')')
			return val
		}

		if (token === '!') {
			consume('!')
			const val = parsePrimary()
			return !val
		}

		consume()
		if (token === 'true') return true
		if (token === 'false') return false
		if (token === 'null') return null
		if (token === 'undefined') return undefined
		if (token === '{}') return {}
		if (token === '[]') return []

		// String literals
		if (
			(token.startsWith("'") && token.endsWith("'")) ||
			(token.startsWith('"') && token.endsWith('"'))
		) {
			return token.slice(1, -1)
		}

		// Number literals
		const num = Number(token)
		if (!isNaN(num) && token !== '') return num

		// Path reference (global.xxx, character.xxx)
		if (token.startsWith('global') || token.startsWith('character')) {
			const val = resolveVariablePath(token, context)
			if (typeof val === 'function' && peek() === '(') {
				consume('(')
				const arg = peek() !== ')' ? parseLogicalOr() : undefined
				if (peek() === ')') consume(')')
				const cleanedToken = token.replace(/(?:\?\.|(?:\.\?)|\.)[a-zA-Z0-9_]+$/, '')
				const parentObj = cleanedToken ? resolveVariablePath(cleanedToken, context) : null
				return parentObj ? val.call(parentObj, arg) : false
			}
			return val
		}

		return token
	}

	function parseMultiplicative() {
		let left = parsePrimary()
		while (peek() === '*' || peek() === '/') {
			const op = consume()
			const right = parsePrimary()
			left = op === '*' ? left * right : left / right
		}
		return left
	}

	function parseAdditive() {
		let left = parseMultiplicative()
		while (peek() === '+' || peek() === '-') {
			const op = consume()
			const right = parseMultiplicative()
			left = op === '+' ? left + right : left - right
		}
		return left
	}

	function parseComparison() {
		let left = parseAdditive()
		while (['===', '!==', '==', '!=', '<=', '>=', '<', '>'].includes(peek())) {
			const op = consume()
			const right = parseAdditive()
			switch (op) {
				case '===':
					left = left === right
					break
				case '!==':
					left = left !== right
					break
				case '==':
					left = left == right
					break
				case '!=':
					left = left != right
					break
				case '<=':
					left = left <= right
					break
				case '>=':
					left = left >= right
					break
				case '<':
					left = left < right
					break
				case '>':
					left = left > right
					break
			}
		}
		return left
	}

	function parseLogicalAnd() {
		let left = parseComparison()
		while (peek() === '&&') {
			consume('&&')
			const right = parseComparison()
			left = left && right
		}
		return left
	}

	function parseLogicalOr() {
		let left = parseLogicalAnd()
		while (peek() === '||') {
			consume('||')
			const right = parseLogicalAnd()
			left = left || right
		}
		return left
	}

	try {
		return parseLogicalOr()
	} catch (err) {
		console.warn('Error evaluating expression:', expr, err)
		return false
	}
}

function tokenize(input) {
	const tokens = []
	let i = 0
	const len = input.length

	while (i < len) {
		const ch = input[i]

		if (/\s/.test(ch)) {
			i++
			continue
		}

		if (ch === "'" || ch === '"') {
			const quote = ch
			let str = quote
			i++
			while (i < len && input[i] !== quote) {
				if (input[i] === '\\' && i + 1 < len) {
					str += input[i] + input[i + 1]
					i += 2
				} else {
					str += input[i]
					i++
				}
			}
			if (i < len) {
				str += input[i]
				i++
			}
			tokens.push(str)
			continue
		}

		if (input.startsWith('===', i) || input.startsWith('!==', i)) {
			tokens.push(input.slice(i, i + 3))
			i += 3
			continue
		}
		if (
			input.startsWith('==', i) ||
			input.startsWith('!=', i) ||
			input.startsWith('<=', i) ||
			input.startsWith('>=', i) ||
			input.startsWith('&&', i) ||
			input.startsWith('||', i)
		) {
			tokens.push(input.slice(i, i + 2))
			i += 2
			continue
		}

		if (['(', ')', '<', '>', '!', '+', '-', '*', '/'].includes(ch)) {
			if (input.startsWith('{}', i)) {
				tokens.push('{}')
				i += 2
				continue
			}
			if (input.startsWith('[]', i)) {
				tokens.push('[]')
				i += 2
				continue
			}
			tokens.push(ch)
			i++
			continue
		}

		if (ch === '{') {
			if (input.startsWith('{}', i)) {
				tokens.push('{}')
				i += 2
				continue
			}
			i++
			continue
		}
		if (ch === '}') {
			i++
			continue
		}

		let token = ''
		while (
			i < len &&
			!/\s/.test(input[i]) &&
			!['(', ')', '=', '!', '<', '>', '&', '|', '+', '-', '*', '/', ',', ';'].includes(
				input[i]
			)
		) {
			if (input[i] === '[') {
				while (i < len && input[i] !== ']') {
					token += input[i]
					i++
				}
				if (i < len) {
					token += input[i]
					i++
				}
			} else {
				token += input[i]
				i++
			}
		}
		if (token) {
			tokens.push(token)
		}
	}

	return tokens
}
