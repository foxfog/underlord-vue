/**
 * PixiJS Hex Map Texture and Procedural Billboard Asset Manager
 *
 * Pre-renders and caches GPU-batched textures for:
 * - 2.5D Mountain billboards with snow caps, lit and shaded rock faces, and soft shadows.
 * - Rolling hills billboards.
 * - Forest and tree clump billboards.
 * - Settlement billboards (villages, towns, cities, fortresses, camps).
 *
 * All billboard sprites sharing these textures are batched into 1 GPU draw call by PixiJS v8.
 */
import { Texture } from 'pixi.js'

export class PixiHexTextureManager {
	constructor() {
		this.textureCache = new Map()
	}

	/**
	 * Pre-generates an offscreen canvas and converts it to a PixiJS Texture.
	 * @param {string} key
	 * @param {number} width
	 * @param {number} height
	 * @param {Function} drawFn - (ctx, width, height) => void
	 * @returns {Texture}
	 */
	getOrCreateTexture(key, width, height, drawFn) {
		if (this.textureCache.has(key)) {
			return this.textureCache.get(key)
		}

		if (typeof document === 'undefined') {
			return null
		}

		const canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		const ctx = canvas.getContext('2d')
		if (ctx) {
			drawFn(ctx, width, height)
		}

		try {
			const texture = Texture.from(canvas)
			this.textureCache.set(key, texture)
			return texture
		} catch (e) {
			console.warn('[PixiHexTextureManager] Failed to create texture for', key, e)
			return null
		}
	}

	/**
	 * Returns pre-rendered billboard texture for mountain peaks of radius 1, 2, or 3.
	 * @param {number} radius - 1, 2, or 3
	 * @returns {Texture}
	 */
	getMountainTexture(radius = 1) {
		const rad = Math.max(1, Math.min(3, Math.round(radius)))
		const key = `mountain_${rad}`

		return this.getOrCreateTexture(key, 160, 160, (ctx, w, h) => {
			const cx = w / 2
			const baseY = h - 20
			const peakHeight = 80 + (rad - 1) * 32
			const peakY = baseY - peakHeight
			const halfBase = 38 + (rad - 1) * 20

			// 1. Footprint ground shadow
			ctx.beginPath()
			ctx.ellipse(cx, baseY, halfBase * 1.15, halfBase * 0.28, 0, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(15, 23, 42, 0.40)'
			ctx.fill()

			// 2. Secondary side peak for rad >= 2
			if (rad >= 2) {
				const sidePeakX = cx - halfBase * 0.55
				const sidePeakY = peakY + peakHeight * 0.32
				const sideBaseW = halfBase * 0.65

				// Shaded left face of secondary peak
				ctx.beginPath()
				ctx.moveTo(sidePeakX, sidePeakY)
				ctx.lineTo(sidePeakX - sideBaseW, baseY)
				ctx.lineTo(sidePeakX, baseY)
				ctx.closePath()
				ctx.fillStyle = '#64748b'
				ctx.fill()

				// Shaded right face of secondary peak
				ctx.beginPath()
				ctx.moveTo(sidePeakX, sidePeakY)
				ctx.lineTo(sidePeakX, baseY)
				ctx.lineTo(sidePeakX + sideBaseW * 0.8, baseY)
				ctx.closePath()
				ctx.fillStyle = '#334155'
				ctx.fill()
			}

			// 3. Main Peak: Left lit face
			ctx.beginPath()
			ctx.moveTo(cx, peakY)
			ctx.lineTo(cx - halfBase, baseY)
			ctx.lineTo(cx, baseY)
			ctx.closePath()
			ctx.fillStyle = '#94a3b8'
			ctx.fill()

			// 4. Main Peak: Right shaded face
			ctx.beginPath()
			ctx.moveTo(cx, peakY)
			ctx.lineTo(cx, baseY)
			ctx.lineTo(cx + halfBase, baseY)
			ctx.closePath()
			ctx.fillStyle = '#475569'
			ctx.fill()

			// 5. Snow Cap (top 38%)
			const snowH = peakHeight * 0.36
			const snowW = halfBase * 0.36

			ctx.beginPath()
			ctx.moveTo(cx, peakY)
			ctx.lineTo(cx - snowW, peakY + snowH)
			ctx.lineTo(cx, peakY + snowH * 1.1)
			ctx.closePath()
			ctx.fillStyle = '#ffffff'
			ctx.fill()

			ctx.beginPath()
			ctx.moveTo(cx, peakY)
			ctx.lineTo(cx, peakY + snowH * 1.1)
			ctx.lineTo(cx + snowW, peakY + snowH)
			ctx.closePath()
			ctx.fillStyle = '#e2e8f0'
			ctx.fill()

			// Sharp mountain crest ridge line
			ctx.beginPath()
			ctx.moveTo(cx, peakY)
			ctx.lineTo(cx, baseY)
			ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)'
			ctx.lineWidth = 1.5
			ctx.stroke()
		})
	}

	/**
	 * Returns pre-rendered billboard texture for rolling hills.
	 * @returns {Texture}
	 */
	getHillsTexture() {
		return this.getOrCreateTexture('hills', 128, 96, (ctx, w, h) => {
			const cx = w / 2
			const baseY = h - 16

			// Soft ground shadow
			ctx.beginPath()
			ctx.ellipse(cx, baseY, 42, 12, 0, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(15, 23, 42, 0.32)'
			ctx.fill()

			// Background hill
			ctx.beginPath()
			ctx.arc(cx + 14, baseY, 28, Math.PI, 0)
			ctx.fillStyle = '#4d7c0f'
			ctx.fill()
			ctx.strokeStyle = '#365314'
			ctx.lineWidth = 1.5
			ctx.stroke()

			// Foreground main hill
			ctx.beginPath()
			ctx.arc(cx - 10, baseY, 32, Math.PI, 0)
			ctx.fillStyle = '#65a30d'
			ctx.fill()
			ctx.strokeStyle = '#3f6212'
			ctx.lineWidth = 1.5
			ctx.stroke()

			// Highlight crest arc
			ctx.beginPath()
			ctx.arc(cx - 10, baseY, 29, Math.PI * 1.12, Math.PI * 1.55)
			ctx.strokeStyle = 'rgba(217, 249, 157, 0.65)'
			ctx.lineWidth = 2
			ctx.stroke()
		})
	}

	/**
	 * Returns pre-rendered billboard texture for trees and forest clumps.
	 * @returns {Texture}
	 */
	getForestTexture() {
		return this.getOrCreateTexture('forest', 96, 96, (ctx, w, h) => {
			const cx = w / 2
			const baseY = h - 14

			// Shadow
			ctx.beginPath()
			ctx.ellipse(cx, baseY, 30, 8, 0, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(15, 23, 42, 0.30)'
			ctx.fill()

			function drawPine(px, py, scale) {
				// Trunk
				ctx.fillStyle = '#78350f'
				ctx.fillRect(px - 2 * scale, py - 12 * scale, 4 * scale, 12 * scale)

				// Bottom tier
				ctx.beginPath()
				ctx.moveTo(px, py - 32 * scale)
				ctx.lineTo(px - 14 * scale, py - 12 * scale)
				ctx.lineTo(px + 14 * scale, py - 12 * scale)
				ctx.closePath()
				ctx.fillStyle = '#166534'
				ctx.fill()

				// Middle tier
				ctx.beginPath()
				ctx.moveTo(px, py - 38 * scale)
				ctx.lineTo(px - 11 * scale, py - 20 * scale)
				ctx.lineTo(px + 11 * scale, py - 20 * scale)
				ctx.closePath()
				ctx.fillStyle = '#15803d'
				ctx.fill()

				// Top tier
				ctx.beginPath()
				ctx.moveTo(px, py - 44 * scale)
				ctx.lineTo(px - 8 * scale, py - 28 * scale)
				ctx.lineTo(px + 8 * scale, py - 28 * scale)
				ctx.closePath()
				ctx.fillStyle = '#22c55e'
				ctx.fill()
			}

			drawPine(cx - 14, baseY, 0.85)
			drawPine(cx + 12, baseY, 0.90)
			drawPine(cx - 2, baseY + 2, 1.05)
		})
	}

	/**
	 * Returns billboard texture for settlements.
	 * @param {string} type - 'village'|'town'|'walled_city'|'fortress'|'camp'
	 * @returns {Texture}
	 */
	getSettlementTexture(type = 'village') {
		const key = `settlement_${type}`
		return this.getOrCreateTexture(key, 96, 96, (ctx, w, h) => {
			const cx = w / 2
			const baseY = h - 14

			// Base shadow
			ctx.beginPath()
			ctx.ellipse(cx, baseY, 28, 9, 0, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(15, 23, 42, 0.38)'
			ctx.fill()

			if (type === 'walled_city' || type === 'fortress') {
				// Stone fortress / City wall with battlements
				ctx.fillStyle = '#475569'
				ctx.fillRect(cx - 24, baseY - 32, 48, 30)
				ctx.fillStyle = '#64748b'
				ctx.fillRect(cx - 22, baseY - 30, 44, 26)

				// Towers left and right
				ctx.fillStyle = '#334155'
				ctx.fillRect(cx - 26, baseY - 42, 12, 40)
				ctx.fillRect(cx + 14, baseY - 42, 12, 40)

				// Tower conical roofs
				ctx.beginPath()
				ctx.moveTo(cx - 20, baseY - 54)
				ctx.lineTo(cx - 28, baseY - 42)
				ctx.lineTo(cx - 12, baseY - 42)
				ctx.closePath()
				ctx.fillStyle = '#dc2626'
				ctx.fill()

				ctx.beginPath()
				ctx.moveTo(cx + 20, baseY - 54)
				ctx.lineTo(cx + 12, baseY - 42)
				ctx.lineTo(cx + 28, baseY - 42)
				ctx.closePath()
				ctx.fillStyle = '#dc2626'
				ctx.fill()

				// Central Gate
				ctx.beginPath()
				ctx.arc(cx, baseY - 6, 8, Math.PI, 0)
				ctx.lineTo(cx + 8, baseY)
				ctx.lineTo(cx - 8, baseY)
				ctx.closePath()
				ctx.fillStyle = '#0f172a'
				ctx.fill()
			} else if (type === 'town') {
				// Town stone houses with tiled roofs
				ctx.fillStyle = '#cbd5e1'
				ctx.fillRect(cx - 18, baseY - 24, 16, 22)
				ctx.fillStyle = '#94a3b8'
				ctx.fillRect(cx - 2, baseY - 28, 20, 26)

				// Gabled Roofs
				ctx.beginPath()
				ctx.moveTo(cx - 10, baseY - 38)
				ctx.lineTo(cx - 22, baseY - 24)
				ctx.lineTo(cx + 2, baseY - 24)
				ctx.closePath()
				ctx.fillStyle = '#b91c1c'
				ctx.fill()

				ctx.beginPath()
				ctx.moveTo(cx + 8, baseY - 44)
				ctx.lineTo(cx - 4, baseY - 28)
				ctx.lineTo(cx + 20, baseY - 28)
				ctx.closePath()
				ctx.fillStyle = '#c2410c'
				ctx.fill()
			} else if (type === 'camp') {
				// Tents
				ctx.beginPath()
				ctx.moveTo(cx - 10, baseY - 26)
				ctx.lineTo(cx - 24, baseY)
				ctx.lineTo(cx + 4, baseY)
				ctx.closePath()
				ctx.fillStyle = '#fef08a'
				ctx.fill()
				ctx.strokeStyle = '#ca8a04'
				ctx.lineWidth = 1.5
				ctx.stroke()

				ctx.beginPath()
				ctx.moveTo(cx + 10, baseY - 22)
				ctx.lineTo(cx - 2, baseY)
				ctx.lineTo(cx + 22, baseY)
				ctx.closePath()
				ctx.fillStyle = '#fed7aa'
				ctx.fill()
				ctx.strokeStyle = '#ea580c'
				ctx.lineWidth = 1.5
				ctx.stroke()
			} else {
				// Village thatched cottages
				ctx.fillStyle = '#d97706'
				ctx.fillRect(cx - 14, baseY - 18, 14, 16)
				ctx.fillStyle = '#b45309'
				ctx.fillRect(cx, baseY - 16, 14, 14)

				// Thatched roofs
				ctx.beginPath()
				ctx.moveTo(cx - 7, baseY - 28)
				ctx.lineTo(cx - 18, baseY - 18)
				ctx.lineTo(cx + 4, baseY - 18)
				ctx.closePath()
				ctx.fillStyle = '#fef3c7'
				ctx.fill()

				ctx.beginPath()
				ctx.moveTo(cx + 7, baseY - 26)
				ctx.lineTo(cx - 4, baseY - 16)
				ctx.lineTo(cx + 18, baseY - 16)
				ctx.closePath()
				ctx.fillStyle = '#fde68a'
				ctx.fill()
			}
		})
	}

	clear() {
		for (const texture of this.textureCache.values()) {
			try {
				texture.destroy(true)
			} catch (_) {}
		}
		this.textureCache.clear()
	}
}
