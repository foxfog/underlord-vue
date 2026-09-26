import { describe, it, expect, beforeEach } from 'vitest'
import {
	HEX_CONFIG,
	DEFAULT_PIXEL_SCALE,
	setDefaultPixelScale,
	DEFAULT_HEX_MIN_ZOOM,
	DEFAULT_HEX_MAX_ZOOM,
	DEFAULT_HEX_MIN_PITCH,
	DEFAULT_HEX_MAX_PITCH,
	DEFAULT_HEX_INITIAL_PITCH,
	DEFAULT_HEX_FOCAL_DISTANCE,
	DEFAULT_HEX_RADIUS,
	DEFAULT_HEX_TILT,
	ENABLE_ORGANIC_EDGES,
	setEnableOrganicEdges,
	HEX_LOD_SCREEN_RADIUS_ORGANIC,
	HEX_LOD_SCREEN_RADIUS_STRATEGIC,
	calculateLodLevel,
	ENABLE_HEX_ANIMATIONS,
	setEnableHexAnimations,
	ANIM_DISABLE_ZOOM_FRACTION,
	setAnimDisableZoomFraction,
	calculateAnimZoomThreshold,
	ENABLE_BIOME_TEXTURES,
	setEnableBiomeTextures,
	HEX_TEXTURE_CROP_PX,
	HEX_TEXTURE_BLEED,
	BADGE_AUTO_FADE_MIN_SCALE,
	BADGE_AUTO_FADE_MAX_SCALE,
	BADGE_COLLISION_DISTANCE_X,
	BADGE_COLLISION_DISTANCE_Y,
	ANIM_FRAME_INTERVAL_MS,
	FRAME_BUDGET_MS,
	shouldTriggerHexAnimTick,
	HEX_ZOOM_WHEEL_STEP,
	HEX_ZOOM_BTN_STEP_IN,
	HEX_ZOOM_BTN_STEP_OUT
} from '../hexmap/hexConfig.js'

describe('Hexagonal Map Centralized Configuration (hexConfig.js)', () => {
	beforeEach(() => {
		// Reset mutable defaults
		setEnableOrganicEdges(true)
		setEnableHexAnimations(true)
		setEnableBiomeTextures(true)
		setAnimDisableZoomFraction(0.75)
		setDefaultPixelScale(1)
	})

	it('defines resolution and pixel-scale settings', () => {
		expect(DEFAULT_PIXEL_SCALE).toBe(1)
		expect(HEX_CONFIG.resolution.pixelScale).toBe(1)

		setDefaultPixelScale(2)
		expect(DEFAULT_PIXEL_SCALE).toBe(2)
		expect(HEX_CONFIG.resolution.pixelScale).toBe(2)

		HEX_CONFIG.resolution.pixelScale = 3
		expect(DEFAULT_PIXEL_SCALE).toBe(3)
	})

	it('defines zoom and camera boundaries', () => {
		expect(DEFAULT_HEX_MIN_ZOOM).toBe(1)
		expect(DEFAULT_HEX_MAX_ZOOM).toBe(6)
		expect(DEFAULT_HEX_MIN_PITCH).toBe(0)
		expect(DEFAULT_HEX_MAX_PITCH).toBe(60)
		expect(DEFAULT_HEX_INITIAL_PITCH).toBe(45)
		expect(DEFAULT_HEX_FOCAL_DISTANCE).toBe(900)

		expect(HEX_ZOOM_WHEEL_STEP).toBeGreaterThan(0)
		expect(HEX_ZOOM_BTN_STEP_IN).toBeGreaterThan(0)
		expect(HEX_ZOOM_BTN_STEP_OUT).toBeGreaterThan(0)
	})

	it('correctly calculates LOD levels based on screen radius thresholds', () => {
		expect(HEX_LOD_SCREEN_RADIUS_ORGANIC).toBe(20)
		expect(HEX_LOD_SCREEN_RADIUS_STRATEGIC).toBe(12)

		// LOD 0 (Close-up: organic Bezier curves, UV random textures)
		expect(calculateLodLevel(25)).toBe(0)
		expect(calculateLodLevel(20)).toBe(0)

		// LOD 1 (Medium Distance: straight hex geometry, batched patterns)
		expect(calculateLodLevel(19.9)).toBe(1)
		expect(calculateLodLevel(15)).toBe(1)
		expect(calculateLodLevel(12)).toBe(1)

		// LOD 2 (Strategic Overview: solid biome colors, hidden grid)
		expect(calculateLodLevel(11.9)).toBe(2)
		expect(calculateLodLevel(5)).toBe(2)
	})

	it('handles organic edges toggle', () => {
		expect(ENABLE_ORGANIC_EDGES).toBe(true)
		expect(HEX_CONFIG.lod.enableOrganicEdges).toBe(true)

		setEnableOrganicEdges(false)
		expect(ENABLE_ORGANIC_EDGES).toBe(false)
		expect(HEX_CONFIG.lod.enableOrganicEdges).toBe(false)

		HEX_CONFIG.lod.enableOrganicEdges = true
		expect(ENABLE_ORGANIC_EDGES).toBe(true)
	})

	it('handles animations toggle and threshold calculations', () => {
		expect(ENABLE_HEX_ANIMATIONS).toBe(true)
		expect(HEX_CONFIG.animation.enableAnimations).toBe(true)

		setEnableHexAnimations(false)
		expect(ENABLE_HEX_ANIMATIONS).toBe(false)

		expect(ANIM_DISABLE_ZOOM_FRACTION).toBe(0.75)
		// Threshold with min=0.75, max=5.0, fraction=0.75: 0.75 + 0.25 * 4.25 = 1.8125
		const threshold = calculateAnimZoomThreshold(0.75, 5.0, 0.75)
		expect(threshold).toBeCloseTo(1.8125, 3)

		// Fraction 0 means always active (threshold = 0)
		expect(calculateAnimZoomThreshold(0.75, 5.0, 0)).toBe(0)
	})

	it('defines biome texture parameters', () => {
		expect(ENABLE_BIOME_TEXTURES).toBe(true)
		expect(HEX_TEXTURE_CROP_PX).toBe(128)
		expect(HEX_TEXTURE_BLEED).toBe(1.25)

		setEnableBiomeTextures(false)
		expect(ENABLE_BIOME_TEXTURES).toBe(false)
	})

	it('defines settlement badges fading and collision parameters', () => {
		expect(BADGE_AUTO_FADE_MIN_SCALE).toBe(0.52)
		expect(BADGE_AUTO_FADE_MAX_SCALE).toBe(0.72)
		expect(BADGE_COLLISION_DISTANCE_X).toBe(72)
		expect(BADGE_COLLISION_DISTANCE_Y).toBe(26)
	})

	it('defines performance frame intervals and budgets', () => {
		expect(ANIM_FRAME_INTERVAL_MS).toBe(33) // ~30fps
		expect(FRAME_BUDGET_MS).toBe(14)
	})

	it('keeps animation ticks paused while camera is moving and resumes on idle', () => {
		expect(
			shouldTriggerHexAnimTick({
				currentTime: 100,
				lastAnimRenderTime: 0,
				lastRenderDurationMs: 0,
				isCameraMoving: false
			})
		).toBe(true)

		expect(
			shouldTriggerHexAnimTick({
				currentTime: 120,
				lastAnimRenderTime: 0,
				lastRenderDurationMs: 0,
				isCameraMoving: true
			})
		).toBe(false)

		expect(
			shouldTriggerHexAnimTick({
				currentTime: 2000,
				lastAnimRenderTime: 0,
				lastRenderDurationMs: 40,
				isCameraMoving: false
			})
		).toBe(false)
	})

	it('defines base hex geometry defaults', () => {
		expect(DEFAULT_HEX_RADIUS).toBe(36)
		expect(DEFAULT_HEX_TILT).toBe(0.70)
	})
})
