import { describe, it, expect } from 'vitest'
import path from 'path'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { walk, checkStyles } = require('../../../scripts/lint-styles.js')

describe('AGENTS.md Style Rules Compliance', () => {
	it('should have zero CSS/Vue style violations across all components and styles', () => {
		const rendererDir = path.resolve(__dirname, '..')
		const files = walk(rendererDir)
		const errors = checkStyles(files)

		if (errors.length > 0) {
			const formatted = errors
				.map((e) => `  ${e.file}:${e.line} [${e.rule}] ${e.message}`)
				.join('\n')
			expect.fail(`Found ${errors.length} AGENTS.md style violations:\n${formatted}`)
		}

		expect(errors).toEqual([])
	})
})
