// src/renderer/utils/treeIcons.js

/**
 * Splits an icon string (emojis or image path) into a primary main icon
 * and an array of secondary icons (for multiple emojis like 🦄🪽, 😈♀️, etc.).
 * Uses Intl.Segmenter with 'grapheme' granularity to correctly handle
 * multi-codepoint emojis (with variation selectors, skin tones, zero-width joiners).
 *
 * @param {string|any} iconStr
 * @returns {{ primary: string, secondary: string[] }}
 */
export function splitIconEmojis(iconStr) {
	if (!iconStr) return { primary: '', secondary: [] }
	if (typeof iconStr !== 'string') return { primary: String(iconStr), secondary: [] }
	if (iconStr.includes('/') || iconStr.includes('.')) {
		return { primary: iconStr, secondary: [] }
	}
	let graphemes = []
	if (typeof Intl !== 'undefined' && Intl.Segmenter) {
		const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })
		graphemes = Array.from(segmenter.segment(iconStr)).map((s) => s.segment.trim()).filter(Boolean)
	} else {
		graphemes = Array.from(iconStr).map((c) => c.trim()).filter(Boolean)
	}
	if (graphemes.length === 0) return { primary: '', secondary: [] }
	return {
		primary: graphemes[0],
		secondary: graphemes.slice(1)
	}
}
