/**
 * Character Animation Engine & Registry
 *
 * Provides a unified system for defining, evaluating, and playing character rig animations.
 * Supports:
 * - Timeline Track format (as in CharacterRigStudio / animations.json)
 * - CSS-Keyframes style syntax ({ '0%': { ... }, '50%': { ... }, '100%': { ... } })
 * - Direct CSS transform string parsing (e.g. "translate(-2.5%, 3%) rotate(-8deg) scale(1.05)")
 * - Repeat modes: 'once', 'loop', 'pingpong', 'count' (with repeatCount)
 * - Transforms: rotate, translateX/Y (shifts), scale/scaleX/scaleY (zooming), opacity, 3D rotations
 * - Full easing library: linear, ease, ease-in, ease-out, ease-in-out, step, cubic-bezier
 */

import { reactive } from 'vue'

/**
 * Parses CSS transform string into numeric transform object
 * e.g. "translate(-2.5%, 3%) rotate(-8deg) scale(1.05)"
 */
export function parseTransformString(transformStr) {
	if (!transformStr || typeof transformStr !== 'string') return null
	const result = { x: 0, y: 0, rot: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1 }

	// translateY(10%) or translateY(10px) or translateY(10)
	const tyMatch = transformStr.match(/translateY\(\s*(-?[\d.]+)(%|px|em)?\s*\)/i)
	if (tyMatch) {
		result.y = parseFloat(tyMatch[1]) || 0
	}

	// translateX(10%) or translateX(10px)
	const txMatch = transformStr.match(/translateX\(\s*(-?[\d.]+)(%|px|em)?\s*\)/i)
	if (txMatch) {
		result.x = parseFloat(txMatch[1]) || 0
	}

	// translate(x, y)
	const tMatch = transformStr.match(/translate\(\s*(-?[\d.]+)(%|px|em)?(?:\s*,\s*(-?[\d.]+)(%|px|em)?)?\s*\)/i)
	if (tMatch) {
		result.x = parseFloat(tMatch[1]) || 0
		if (tMatch[3]) {
			result.y = parseFloat(tMatch[3]) || 0
		}
	}

	// rotate(5deg) or rotate(5rad) or rotate(5turn)
	const rMatch = transformStr.match(/rotate\(\s*(-?[\d.]+)(deg|rad|turn)?\s*\)/i)
	if (rMatch) {
		let val = parseFloat(rMatch[1]) || 0
		if (rMatch[2] === 'rad') val = (val * 180) / Math.PI
		else if (rMatch[2] === 'turn') val = val * 360
		result.rot = val
		result.rotate = val
	}

	// scale(1.05) or scale(1.05, 1.05)
	const sMatch = transformStr.match(/scale\(\s*(-?[\d.]+)(?:\s*,\s*(-?[\d.]+))?\s*\)/i)
	if (sMatch) {
		result.scale = parseFloat(sMatch[1]) || 1
		result.scaleX = parseFloat(sMatch[1]) || 1
		result.scaleY = sMatch[2] ? parseFloat(sMatch[2]) || 1 : result.scaleX
	}

	const sxMatch = transformStr.match(/scaleX\(\s*(-?[\d.]+)\s*\)/i)
	if (sxMatch) result.scaleX = parseFloat(sxMatch[1]) || 1

	const syMatch = transformStr.match(/scaleY\(\s*(-?[\d.]+)\s*\)/i)
	if (syMatch) result.scaleY = parseFloat(syMatch[1]) || 1

	return result
}

/**
 * Parse CSS inline style string (e.g. "color: red; opacity: 0.8")
 */
export function parseCustomCss(cssString) {
	if (!cssString || typeof cssString !== 'string') return null
	const styles = {}
	cssString.split(';').forEach((rule) => {
		const parts = rule.split(':').map((s) => s?.trim())
		if (parts[0] && parts[1]) {
			const camelProp = parts[0].replace(/-([a-z])/g, (_, c) => c.toUpperCase())
			styles[camelProp] = parts[1]
		}
	})
	return Object.keys(styles).length > 0 ? styles : null
}

/**
 * Standard Easing functions
 */
export function applyEasing(t, easing = 'ease-in-out') {
	const clamped = Math.max(0, Math.min(1, t))
	if (!easing || easing === 'linear') return clamped

	if (typeof easing === 'string') {
		const lower = easing.toLowerCase()
		if (lower === 'ease-in') {
			return clamped * clamped
		}
		if (lower === 'ease-out') {
			return clamped * (2 - clamped)
		}
		if (lower === 'ease-in-out') {
			return clamped < 0.5 ? 2 * clamped * clamped : -1 + (4 - 2 * clamped) * clamped
		}
		if (lower === 'ease') {
			// CSS ease approximation
			return clamped < 0.5 ? Math.pow(clamped * 2, 2.5) / 2 : 1 - Math.pow((1 - clamped) * 2, 2.5) / 2
		}
		if (lower === 'step' || lower === 'steps' || lower === 'step-start') {
			return clamped < 1 ? 0 : 1
		}
		if (lower === 'step-end') {
			return clamped <= 0 ? 0 : 1
		}
		// Cubic bezier: cubic-bezier(x1, y1, x2, y2)
		if (lower.startsWith('cubic-bezier')) {
			const match = lower.match(/cubic-bezier\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/)
			if (match) {
				const [, x1, y1, x2, y2] = match.map(Number)
				return evaluateCubicBezier(clamped, x1, y1, x2, y2)
			}
		}
	}

	return clamped
}

/**
 * Simple 1D Cubic Bezier evaluator
 */
function evaluateCubicBezier(t, x1, y1, x2, y2) {
	// Approximate curve by Bernstein polynomials with Newton-Raphson
	let u = t
	for (let i = 0; i < 5; i++) {
		const currentX = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u
		const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2)
		if (Math.abs(currentX - t) < 0.001 || Math.abs(dx) < 1e-6) break
		u -= (currentX - t) / dx
		u = Math.max(0, Math.min(1, u))
	}
	return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u
}

/**
 * Linearly interpolate between two numbers
 */
export function lerp(a, b, t) {
	return a + (b - a) * t
}

/**
 * Interpolate two keyframes in a track
 */
export function interpolateTrackKeyframes(keyframes, localTime) {
	if (!Array.isArray(keyframes) || keyframes.length === 0) {
		return { rotate: 0, translateX: 0, translateY: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1 }
	}

	const sorted = [...keyframes].sort((a, b) => a.time - b.time)
	if (sorted.length === 1 || localTime <= sorted[0].time) {
		const kf = sorted[0]
		const tr = kf.transform || kf
		return {
			rotate: tr.rotate ?? tr.rot ?? 0,
			translateX: tr.translateX ?? tr.x ?? 0,
			translateY: tr.translateY ?? tr.y ?? 0,
			scale: tr.scale ?? 1,
			scaleX: tr.scaleX ?? tr.scale ?? 1,
			scaleY: tr.scaleY ?? tr.scale ?? 1,
			rotateX: tr.rotateX ?? 0,
			rotateY: tr.rotateY ?? 0,
			opacity: tr.opacity !== undefined ? Number(tr.opacity) : 1,
			sprite: kf.sprite || null,
			customStyles: parseCustomCss(kf.customCss)
		}
	}

	const last = sorted[sorted.length - 1]
	if (localTime >= last.time) {
		const tr = last.transform || last
		return {
			rotate: tr.rotate ?? tr.rot ?? 0,
			translateX: tr.translateX ?? tr.x ?? 0,
			translateY: tr.translateY ?? tr.y ?? 0,
			scale: tr.scale ?? 1,
			scaleX: tr.scaleX ?? tr.scale ?? 1,
			scaleY: tr.scaleY ?? tr.scale ?? 1,
			rotateX: tr.rotateX ?? 0,
			rotateY: tr.rotateY ?? 0,
			opacity: tr.opacity !== undefined ? Number(tr.opacity) : 1,
			sprite: last.sprite || null,
			customStyles: parseCustomCss(last.customCss)
		}
	}

	let kfA = sorted[0]
	let kfB = sorted[1]
	for (let i = 0; i < sorted.length - 1; i++) {
		if (sorted[i].time <= localTime && localTime <= sorted[i + 1].time) {
			kfA = sorted[i]
			kfB = sorted[i + 1]
			break
		}
	}

	const span = kfB.time - kfA.time
	const tNorm = span > 0 ? (localTime - kfA.time) / span : 0
	const easedT = applyEasing(tNorm, kfA.easing || 'ease-in-out')

	const trA = kfA.transform || kfA
	const trB = kfB.transform || kfB

	const rotA = trA.rotate ?? trA.rot ?? 0
	const rotB = trB.rotate ?? trB.rot ?? 0
	const xA = trA.translateX ?? trA.x ?? 0
	const xB = trB.translateX ?? trB.x ?? 0
	const yA = trA.translateY ?? trA.y ?? 0
	const yB = trB.translateY ?? trB.y ?? 0
	const sA = trA.scale ?? 1
	const sB = trB.scale ?? 1
	const sXA = trA.scaleX ?? sA
	const sXB = trB.scaleX ?? sB
	const sYA = trA.scaleY ?? sA
	const sYB = trB.scaleY ?? sB
	const rotXA = trA.rotateX ?? 0
	const rotXB = trB.rotateX ?? 0
	const rotYA = trA.rotateY ?? 0
	const rotYB = trB.rotateY ?? 0
	const opA = trA.opacity !== undefined ? Number(trA.opacity) : 1
	const opB = trB.opacity !== undefined ? Number(trB.opacity) : 1

	let activeSprite = null
	for (const kf of sorted) {
		if (kf.time <= localTime) {
			if (kf.sprite !== undefined) activeSprite = kf.sprite
		} else {
			break
		}
	}

	return {
		rotate: Number(lerp(rotA, rotB, easedT).toFixed(2)),
		translateX: Number(lerp(xA, xB, easedT).toFixed(2)),
		translateY: Number(lerp(yA, yB, easedT).toFixed(2)),
		scale: Number(lerp(sA, sB, easedT).toFixed(3)),
		scaleX: Number(lerp(sXA, sXB, easedT).toFixed(3)),
		scaleY: Number(lerp(sYA, sYB, easedT).toFixed(3)),
		rotateX: Number(lerp(rotXA, rotXB, easedT).toFixed(2)),
		rotateY: Number(lerp(rotYA, rotYB, easedT).toFixed(2)),
		opacity: Number(lerp(opA, opB, easedT).toFixed(2)),
		sprite: activeSprite,
		customStyles: parseCustomCss(kfA.customCss)
	}
}

/**
 * Normalizes an arbitrary animation definition (CSS keyframes, Tracks, or Shorthand)
 * into a canonical timeline object.
 */
export function normalizeAnimationDefinition(def) {
	if (!def || typeof def !== 'object') return null

	const duration = Number(def.duration) > 0 ? Number(def.duration) : 1.0
	const repeat = def.repeat || 'once' // 'once' | 'loop' | 'pingpong' | 'count'
	const repeatCount = Math.max(1, Number(def.repeatCount) || 1)
	const id = def.id || def.name || `anim_${Math.random().toString(36).substring(2, 9)}`

	const result = {
		id,
		name: def.name || id,
		icon: def.icon || '🎬',
		group: def.group || 'Кастомные',
		desc: def.desc || '',
		duration,
		repeat,
		repeatCount,
		timingMode: 'timeline',
		tracks: []
	}

	// Case 1: Standard tracks array already supplied
	if (Array.isArray(def.tracks) && def.tracks.length > 0) {
		result.tracks = def.tracks.map((track) => ({
			target: track.target,
			targetMode: track.targetMode || 'single',
			keyframes: (track.keyframes || []).map((kf) => {
				const time = parseTimeOffset(kf.time ?? kf.step ?? 0, duration)
				let tr = kf.transform ? { ...kf.transform } : { ...kf }
				// If string style passed in transform
				if (typeof tr === 'string') {
					tr = parseTransformString(tr) || {}
				}
				return {
					time,
					transform: normalizeTransformValues(tr),
					easing: kf.easing || 'ease-in-out',
					sprite: kf.sprite || null,
					customCss: kf.customCss || null
				}
			}).sort((a, b) => a.time - b.time)
		}))
		return result
	}

	// Case 2: CSS-like keyframes dictionary:
	// keyframes: {
	//   '0%': { head: { x: 0, y: 0, rotate: 0 }, neck: { rotate: 0 } },
	//   '50%': { head: { x: -2.5, y: 3, rotate: -3 }, neck: { rotate: -8 } },
	//   '100%': { head: { x: 0, y: 0, rotate: 0 }, neck: { rotate: 0 } }
	// }
	if (def.keyframes && typeof def.keyframes === 'object') {
		const tracksByTarget = new Map()

		if (Array.isArray(def.keyframes)) {
			// Single-part array of steps: keyframes: [ { step: 0, rotate: 0 }, { step: 0.5, rotate: 10 } ]
			const target = def.target || def.part || 'head'
			const kfList = def.keyframes.map((kf, idx) => {
				const stepVal = kf.time ?? kf.step ?? (def.keyframes.length > 1 ? idx / (def.keyframes.length - 1) : 0)
				const time = parseTimeOffset(stepVal, duration)
				return {
					time,
					transform: normalizeTransformValues(kf.transform || kf),
					easing: kf.easing || 'ease-in-out'
				}
			}).sort((a, b) => a.time - b.time)

			result.tracks.push({
				target,
				targetMode: 'single',
				keyframes: kfList
			})
			return result
		}

		// Dictionary with percentage or time keys
		for (const [key, frameData] of Object.entries(def.keyframes)) {
			const time = parseTimeOffset(key, duration)
			if (!frameData) continue

			if (typeof frameData === 'string') {
				// Shorthand for a single part: { '0%': 'translate(0, 0)', '100%': 'translate(10px, 0)' }
				const target = def.target || def.part || 'head'
				if (!tracksByTarget.has(target)) tracksByTarget.set(target, [])
				tracksByTarget.get(target).push({
					time,
					transform: normalizeTransformValues(parseTransformString(frameData) || {}),
					easing: def.easing || 'ease-in-out'
				})
			} else if (typeof frameData === 'object') {
				// Could be multi-target: { head: { rotate: 0 }, neck: { rotate: 0 } }
				// OR single-target properties directly: { rotate: 0, x: 0, y: 0 }
				const isDirectTransform =
					'rotate' in frameData ||
					'rot' in frameData ||
					'x' in frameData ||
					'y' in frameData ||
					'translateX' in frameData ||
					'translateY' in frameData ||
					'scale' in frameData ||
					'opacity' in frameData

				if (isDirectTransform) {
					const target = def.target || def.part || 'head'
					if (!tracksByTarget.has(target)) tracksByTarget.set(target, [])
					tracksByTarget.get(target).push({
						time,
						transform: normalizeTransformValues(frameData),
						easing: frameData.easing || def.easing || 'ease-in-out'
					})
				} else {
					// Multi-target by part name
					for (const [partName, partTransform] of Object.entries(frameData)) {
						if (!tracksByTarget.has(partName)) tracksByTarget.set(partName, [])
						let parsedTr = partTransform
						if (typeof partTransform === 'string') {
							parsedTr = parseTransformString(partTransform) || {}
						}
						tracksByTarget.get(partName).push({
							time,
							transform: normalizeTransformValues(parsedTr),
							easing: parsedTr?.easing || def.easing || 'ease-in-out'
						})
					}
				}
			}
		}

		for (const [target, keyframes] of tracksByTarget.entries()) {
			result.tracks.push({
				target,
				targetMode: 'single',
				keyframes: keyframes.sort((a, b) => a.time - b.time)
			})
		}
	}

	return result
}

function parseTimeOffset(timeVal, duration) {
	if (typeof timeVal === 'number') {
		// If 0 <= val <= 1 and duration > 1, check if user meant normalized progress
		if (timeVal >= 0 && timeVal <= 1.0 && duration > 1) {
			return timeVal * duration
		}
		return timeVal
	}
	if (typeof timeVal === 'string') {
		const s = timeVal.trim()
		if (s.endsWith('%')) {
			const pct = parseFloat(s) || 0
			return (pct / 100) * duration
		}
		if (s.endsWith('s')) {
			return parseFloat(s) || 0
		}
		const num = parseFloat(s)
		if (!isNaN(num)) {
			if (num >= 0 && num <= 1.0 && duration > 1) {
				return num * duration
			}
			return num
		}
	}
	return 0
}

function normalizeTransformValues(tr) {
	if (!tr || typeof tr !== 'object') return { rotate: 0, translateX: 0, translateY: 0, scale: 1, scaleX: 1, scaleY: 1, opacity: 1 }

	const x = tr.translateX ?? tr.x ?? 0
	const y = tr.translateY ?? tr.y ?? 0
	const rot = tr.rotate ?? tr.rot ?? 0
	const scale = tr.scale ?? 1
	const scaleX = tr.scaleX ?? scale
	const scaleY = tr.scaleY ?? scale
	const rotateX = tr.rotateX ?? 0
	const rotateY = tr.rotateY ?? 0
	const opacity = tr.opacity !== undefined ? Number(tr.opacity) : 1

	return {
		rotate: typeof rot === 'string' ? parseFloat(rot) || 0 : Number(rot),
		translateX: typeof x === 'string' ? parseFloat(x) || 0 : Number(x),
		translateY: typeof y === 'string' ? parseFloat(y) || 0 : Number(y),
		scale: typeof scale === 'string' ? parseFloat(scale) || 1 : Number(scale),
		scaleX: typeof scaleX === 'string' ? parseFloat(scaleX) || 1 : Number(scaleX),
		scaleY: typeof scaleY === 'string' ? parseFloat(scaleY) || 1 : Number(scaleY),
		rotateX: typeof rotateX === 'string' ? parseFloat(rotateX) || 0 : Number(rotateX),
		rotateY: typeof rotateY === 'string' ? parseFloat(rotateY) || 0 : Number(rotateY),
		opacity: typeof opacity === 'string' ? parseFloat(opacity) || 1 : Number(opacity)
	}
}

/**
 * Evaluates an animation at a given elapsed time (in seconds)
 * Returns { isFinished, transformsByPart }
 */
export function evaluateAnimationAtTime(animDef, timeInSeconds) {
	const canonical = animDef.tracks ? animDef : normalizeAnimationDefinition(animDef)
	if (!canonical || !canonical.tracks || canonical.tracks.length === 0) {
		return { isFinished: true, transformsByPart: {} }
	}

	const duration = canonical.duration > 0 ? canonical.duration : 1.0
	const repeat = canonical.repeat || 'once'
	const repeatCount = Math.max(1, canonical.repeatCount || 1)

	let localTime = 0
	let isFinished = false

	if (repeat === 'loop') {
		localTime = timeInSeconds % duration
		isFinished = false
	} else if (repeat === 'once') {
		if (timeInSeconds >= duration) {
			localTime = duration
			isFinished = true
		} else {
			localTime = timeInSeconds
			isFinished = false
		}
	} else if (repeat === 'count') {
		const totalDuration = duration * repeatCount
		if (timeInSeconds >= totalDuration) {
			localTime = duration
			isFinished = true
		} else {
			localTime = timeInSeconds % duration
			isFinished = false
		}
	} else if (repeat === 'pingpong') {
		const cycleDuration = duration * 2
		const cycle = timeInSeconds % cycleDuration
		localTime = cycle < duration ? cycle : cycleDuration - cycle
		// If repeatCount is also set on pingpong
		if (canonical.repeatCount && timeInSeconds >= duration * 2 * canonical.repeatCount) {
			localTime = duration
			isFinished = true
		}
	} else {
		localTime = timeInSeconds % duration
	}

	const transformsByPart = {}

	for (const track of canonical.tracks) {
		const state = interpolateTrackKeyframes(track.keyframes, localTime)
		const target = track.target
		transformsByPart[target] = state
	}

	return {
		isFinished,
		localTime,
		transformsByPart
	}
}

// -------------------------------------------------------------
// BUILT-IN ANIMATIONS REGISTRY
// -------------------------------------------------------------

export const BUILTIN_ANIMATIONS = [
	{
		id: 'cough',
		name: 'Кашель / Чих (Cough)',
		icon: '🤧',
		group: 'Базовые',
		desc: 'Двойной толчок головы с наклоном шеи при кашле (как в интро)',
		duration: 0.5,
		repeat: 'once',
		repeatCount: 1,
		timingMode: 'timeline',
		tracks: [
			{
				target: 'head',
				targetMode: 'single',
				keyframes: [
					{ time: 0,    transform: { rotate: 0,  translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.12, transform: { rotate: -3, translateX: -2.5, translateY: 3,   scale: 1 }, easing: 'ease-out' },
					{ time: 0.25, transform: { rotate: 0,  translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.37, transform: { rotate: -3, translateX: -2.5, translateY: 3,   scale: 1 }, easing: 'ease-out' },
					{ time: 0.5,  transform: { rotate: 0,  translateX: 0,    translateY: 0,   scale: 1 }, easing: 'ease-in-out' }
				]
			},
			{
				target: 'neck',
				targetMode: 'single',
				keyframes: [
					{ time: 0,    transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.25, transform: { rotate: -8, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
					{ time: 0.5,  transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			}
		]
	},
	{
		id: 'wave_hand',
		name: 'Махание рукой',
		icon: '👋',
		group: 'Базовые',
		desc: 'Поднятие руки от плеча, колебание предплечья и ладони',
		duration: 1.0,
		repeat: 'count',
		repeatCount: 2,
		timingMode: 'timeline',
		tracks: [
			{
				target: 'arm_left',
				targetMode: 'single',
				keyframes: [
					{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.2, transform: { rotate: -55, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
					{ time: 1.0, transform: { rotate: -55, translateX: 0, translateY: 0, scale: 1 }, easing: 'linear' }
				]
			},
			{
				target: 'arm2_left',
				targetMode: 'single',
				keyframes: [
					{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.3, transform: { rotate: -28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.55, transform: { rotate: 28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.8, transform: { rotate: -28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 1.0, transform: { rotate: 28, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			},
			{
				target: 'arm3_left',
				targetMode: 'single',
				keyframes: [
					{ time: 0, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.35, transform: { rotate: -15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.65, transform: { rotate: 15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 1.0, transform: { rotate: -15, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			}
		]
	},
	{
		id: 'breathing',
		name: 'Дыхание (Idle)',
		icon: '🫁',
		group: 'Базовые',
		desc: 'Плавное ритмичное дыхание с покачиванием корпуса и головы',
		duration: 3.14,
		repeat: 'loop',
		timingMode: 'timeline',
		tracks: [
			{
				target: 'body',
				targetMode: 'single',
				keyframes: [
					{ time: 0,    transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.78, transform: { rotate: 1.5, translateX: 0, translateY: -1, scale: 1 }, easing: 'ease-in-out' },
					{ time: 1.57, transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' },
					{ time: 2.35, transform: { rotate: 1.5, translateX: 0, translateY: -1, scale: 1 }, easing: 'ease-in-out' },
					{ time: 3.14, transform: { rotate: 0,   translateX: 0, translateY: 0,  scale: 1 }, easing: 'ease-in-out' }
				]
			},
			{
				target: 'head',
				targetMode: 'single',
				keyframes: [
					{ time: 0,    transform: { rotate: 0,    translateX: 0, translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.78, transform: { rotate: -0.9, translateX: 0, translateY: 0.3, scale: 1 }, easing: 'ease-in-out' },
					{ time: 1.57, transform: { rotate: 0,    translateX: 0, translateY: 0,   scale: 1 }, easing: 'ease-in-out' },
					{ time: 2.35, transform: { rotate: -0.9, translateX: 0, translateY: 0.3, scale: 1 }, easing: 'ease-in-out' },
					{ time: 3.14, transform: { rotate: 0,    translateX: 0, translateY: 0,   scale: 1 }, easing: 'ease-in-out' }
				]
			}
		]
	},
	{
		id: 'nod',
		name: 'Кивок (Nod)',
		icon: '👍',
		group: 'Базовые',
		desc: 'Наклон головы и шеи в знак согласия',
		duration: 0.5,
		repeat: 'count',
		repeatCount: 2,
		timingMode: 'timeline',
		tracks: [
			{
				target: 'head',
				targetMode: 'single',
				keyframes: [
					{ time: 0,   transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.2, transform: { rotate: 16, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
					{ time: 0.5, transform: { rotate: 0,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			},
			{
				target: 'neck',
				targetMode: 'single',
				keyframes: [
					{ time: 0,   transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.2, transform: { rotate: 8, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-out' },
					{ time: 0.5, transform: { rotate: 0, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			}
		]
	},
	{
		id: 'head_shake',
		name: 'Отрицание (Shake Head)',
		icon: '👎',
		group: 'Базовые',
		desc: 'Поворот головы из стороны в сторону',
		duration: 0.4,
		repeat: 'count',
		repeatCount: 2,
		timingMode: 'timeline',
		tracks: [
			{
				target: 'head',
				targetMode: 'single',
				keyframes: [
					{ time: 0,   transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.1, transform: { rotate: -14, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.2, transform: { rotate: 14,  translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.3, transform: { rotate: -14, translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' },
					{ time: 0.4, transform: { rotate: 0,   translateX: 0, translateY: 0, scale: 1 }, easing: 'ease-in-out' }
				]
			}
		]
	},
	{
		id: 'tremble',
		name: 'Дрожь (Tremble)',
		icon: '🥶',
		group: 'Базовые',
		desc: 'Мелкое дрожание корпуса и тела от холода или страха',
		duration: 0.1,
		repeat: 'loop',
		timingMode: 'timeline',
		tracks: [
			{
				target: 'body',
				targetMode: 'single',
				keyframes: [
					{ time: 0,    transform: { rotate: -2, translateX: -1, translateY: 0, scale: 1 }, easing: 'step' },
					{ time: 0.05, transform: { rotate: 2,  translateX: 1,  translateY: 0, scale: 1 }, easing: 'step' },
					{ time: 0.1,  transform: { rotate: -2, translateX: -1, translateY: 0, scale: 1 }, easing: 'step' }
				]
			}
		]
	},
	{
		id: 'pulse',
		name: 'Пульсация (Pulse)',
		icon: '💓',
		group: 'Базовые',
		desc: 'Ритмичное увеличение и уменьшение масштаба',
		duration: 0.6,
		repeat: 'loop',
		timingMode: 'timeline',
		tracks: [
			{
				target: 'body',
				targetMode: 'single',
				keyframes: [
					{ time: 0,   transform: { scale: 1.0 }, easing: 'ease-in-out' },
					{ time: 0.3, transform: { scale: 1.06 }, easing: 'ease-in-out' },
					{ time: 0.6, transform: { scale: 1.0 }, easing: 'ease-in-out' }
				]
			}
		]
	}
]

// Global reactive animations registry
export const CHARACTER_ANIMATION_REGISTRY = reactive(new Map())

// Initialize builtins into registry
for (const b of BUILTIN_ANIMATIONS) {
	CHARACTER_ANIMATION_REGISTRY.set(b.id, normalizeAnimationDefinition(b))
}
// Aliases for CSS classes
CHARACTER_ANIMATION_REGISTRY.set('cough-head', CHARACTER_ANIMATION_REGISTRY.get('cough'))
CHARACTER_ANIMATION_REGISTRY.set('shake-head', CHARACTER_ANIMATION_REGISTRY.get('head_shake'))

/**
 * Register a new animation in the registry.
 * Accepts either:
 * - Timeline object with tracks
 * - CSS-Keyframes style object
 * - Shorthand object
 */
export function registerCharacterAnimation(animationDef) {
	const canonical = normalizeAnimationDefinition(animationDef)
	if (!canonical) return null
	CHARACTER_ANIMATION_REGISTRY.set(canonical.id, canonical)
	return canonical
}

/**
 * Unregister an animation by ID
 */
export function unregisterCharacterAnimation(animId) {
	return CHARACTER_ANIMATION_REGISTRY.delete(animId)
}

/**
 * Retrieve animation by ID (or null)
 */
export function getCharacterAnimation(animId) {
	if (!animId) return null
	return CHARACTER_ANIMATION_REGISTRY.get(animId) || null
}

/**
 * Get all registered animations as an array
 */
export function getAllCharacterAnimations() {
	return Array.from(CHARACTER_ANIMATION_REGISTRY.values())
}

/**
 * Batch load animations from an array of JSON definitions
 */
export function loadCharacterAnimations(animList) {
	if (!Array.isArray(animList)) return
	for (const item of animList) {
		registerCharacterAnimation(item)
	}
}
