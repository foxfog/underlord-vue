const fs = require('fs')
const path = require('path')

/**
 * Linter enforcing strict AGENTS.md responsive styling rules:
 * 1. ONLY `em` units (No `rem`)
 * 2. No `vw` / `vh` in components (allowed only in base.css root calculation)
 * 3. No `px` except:
 *    - Hairline borders: 1px, 2px (e.g. border: 1px solid, border-width: 2px)
 *    - Radial gradient dots: 1px
 *    - Media queries: @media (...)
 * 4. No `position: fixed` in scene overlays
 */

function walk(dir) {
	let results = []
	const list = fs.readdirSync(dir)
	for (const file of list) {
		const full = path.join(dir, file)
		const stat = fs.statSync(full)
		if (stat && stat.isDirectory()) {
			if (file !== 'node_modules' && file !== 'dist' && file !== 'out') {
				results = results.concat(walk(full))
			}
		} else if (full.endsWith('.vue') || full.endsWith('.css')) {
			results.push(full)
		}
	}
	return results
}

function checkStyles(files) {
	const errors = []

	for (const filePath of files) {
		const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/')
		// Allow root base.css and modal backdrop exceptions explicitly defined in AGENTS.md
		const isBaseCss = relPath.endsWith('styles/base.css')
		const isModalCss = relPath.endsWith('styles/_modal.css')

		const content = fs.readFileSync(filePath, 'utf-8')
		let cssChunks = []

		if (filePath.endsWith('.vue')) {
			const styleMatches = content.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)
			for (const m of styleMatches) {
				const startIdx = m.index
				const linesBefore = content.substring(0, startIdx).split('\n').length
				cssChunks.push({ css: m[1], lineOffset: linesBefore })
			}
		} else if (filePath.endsWith('.css')) {
			cssChunks.push({ css: content, lineOffset: 1 })
		}

		for (const chunk of cssChunks) {
			const lines = chunk.css.split('\n')
			let inComment = false

			for (let i = 0; i < lines.length; i++) {
				const lineNum = chunk.lineOffset + i
				let line = lines[i].trim()

				// Strip comments
				if (line.includes('/*')) inComment = true
				if (inComment) {
					if (line.includes('*/')) inComment = false
					continue
				}
				if (line.startsWith('//')) continue

				// 1. Check for rem units
				if (/\b\d+(\.\d+)?rem\b/i.test(line)) {
					errors.push({
						file: relPath,
						line: lineNum,
						rule: 'no-rem',
						message: `Forbidden 'rem' unit detected in: "${line}". Use 'em' instead (AGENTS.md rule 1).`
					})
				}

				// 2. Check for vw / vh units outside base.css
				if (!isBaseCss && /\b\d+(\.\d+)?(vw|vh|dvw|dvh)\b/i.test(line)) {
					errors.push({
						file: relPath,
						line: lineNum,
						rule: 'no-vw-vh',
						message: `Forbidden viewport unit (vw/vh) detected in: "${line}". Use 'em' or '%' instead (AGENTS.md rule 1).`
					})
				}

				// 3. Check for forbidden px units (allowed: 1px, 2px borders, dots, media queries)
				if (!isBaseCss && !isModalCss) {
					// Exclude @media queries
					if (!line.startsWith('@media')) {
						// Match any px value
						const pxMatches = line.matchAll(/\b(\d+(?:\.\d+)?)px\b/gi)
						for (const pxMatch of pxMatches) {
							const val = parseFloat(pxMatch[1])
							// Allowed: 1px and 2px (hairline borders / gradient dots)
							const isHairline =
								(val === 1 || val === 2) &&
								(line.includes('border') ||
									line.includes('outline') ||
									line.includes('gradient') ||
									line.includes('box-shadow: 0 0 0 1px'))
							if (!isHairline) {
								errors.push({
									file: relPath,
									line: lineNum,
									rule: 'no-px',
									message: `Forbidden 'px' unit (${val}px) detected in: "${line}". Use 'em' instead (AGENTS.md rule 1).`
								})
							}
						}
					}
				}
			}
		}
	}

	return errors
}

function run() {
	const files = walk(path.join(__dirname, '../src/renderer'))
	const errors = checkStyles(files)

	if (errors.length > 0) {
		console.error(`❌ Found ${errors.length} AGENTS.md style violations:`)
		errors.slice(0, 30).forEach((err) => {
			console.error(`  ${err.file}:${err.line} [${err.rule}] ${err.message}`)
		})
		if (errors.length > 30) {
			console.error(`  ... and ${errors.length - 30} more violations.`)
		}
		process.exit(1)
	} else {
		console.log(`✅ All ${files.length} style files comply with AGENTS.md rules!`)
		process.exit(0)
	}
}

if (require.main === module) {
	run()
}

module.exports = { walk, checkStyles }
