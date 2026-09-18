import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCharacterRigStudio } from '../useCharacterRigStudio'

describe('useCharacterRigStudio Composable', () => {
	let studio

	beforeEach(() => {
		vi.restoreAllMocks()
		studio = useCharacterRigStudio()
	})

	it('initializes with default values', () => {
		expect(studio.selectedCharacterId.value).toBe('default')
		expect(studio.viewMode.value).toBe('default')
		expect(studio.orientation.value).toBe('default')
		expect(studio.isBackView.value).toBe(false)
		expect(studio.characterScale.value).toBe(1.0)
		expect(studio.effectiveHeightCm.value).toBe(175)
		expect(studio.currentEmotion.value).toBe('default')
	})

	it('calculates effective height based on scale and base height', () => {
		studio.baseHeightCm.value = 180
		studio.characterScale.value = 1.2
		expect(studio.effectiveHeightCm.value).toBe(216)

		studio.characterScale.value = 0.5
		expect(studio.effectiveHeightCm.value).toBe(90)
	})

	it('supports decomposing a single body into head and arms', () => {
		// Start with single body
		studio.bodyParts['body'] = {
			image: 'images/sprites/characters/default/body.png',
			parent: null,
			zindex: 0,
			offset: { x: 0, y: 0 }
		}

		studio.decomposeSingleBody()

		expect(studio.bodyParts['head']).toBeDefined()
		expect(studio.bodyParts['head'].parent).toBe('body')
		expect(studio.bodyParts['arm_left']).toBeDefined()
		expect(studio.bodyParts['arm_left'].parent).toBe('body')
		expect(studio.bodyParts['arm_right']).toBeDefined()
		expect(studio.bodyParts['arm_right'].parent).toBe('body')
	})

	it('supports decomposing arm into forearm (arm2) and palm (arm3)', () => {
		studio.bodyParts['arm_left'] = {
			image: 'images/sprites/characters/default/arm left.png',
			parent: 'body',
			zindex: 1,
			offset: { x: 35, y: -17 }
		}

		studio.decomposeArm('left')

		expect(studio.bodyParts['arm2_left']).toBeDefined()
		expect(studio.bodyParts['arm2_left'].parent).toBe('arm_left')
		expect(studio.bodyParts['arm3_left']).toBeDefined()
		expect(studio.bodyParts['arm3_left'].parent).toBe('arm2_left')
	})

	it('supports adding and removing custom body parts without removing root body', () => {
		studio.bodyParts['body'] = { image: 'test.png', parent: null, offset: { x: 0, y: 0 } }

		studio.addBodyPart('hair', 'head', 'images/sprites/characters/default/hair.png')
		expect(studio.bodyParts['hair']).toBeDefined()
		expect(studio.bodyParts['hair'].parent).toBe('head')

		studio.removeBodyPart('hair')
		expect(studio.bodyParts['hair']).toBeUndefined()

		// Attempting to remove root body should be ignored
		studio.removeBodyPart('body')
		expect(studio.bodyParts['body']).toBeDefined()
	})

	it('applies eye presets correctly', () => {
		const rollEyes = studio.EYE_PRESETS.find((p) => p.id === 'roll_eyes')
		expect(rollEyes).toBeDefined()

		studio.applyEyePreset(rollEyes)
		expect(studio.eyeLeftOffset.y).toBeCloseTo(-0.95)
		expect(studio.eyeRightOffset.y).toBeCloseTo(-0.95)

		const ahegao = studio.EYE_PRESETS.find((p) => p.id === 'ahegao')
		expect(ahegao).toBeDefined()
		studio.applyEyePreset(ahegao)
		expect(studio.eyeLeftOffset.x).toBeLessThan(0)
		expect(studio.eyeRightOffset.x).toBeGreaterThan(0)
	})

	it('supports emotion switching and per-emotion sprite overrides', () => {
		studio.bodyParts['mouth'] = {
			image: 'images/sprites/characters/default/mouth_normal.png',
			parent: 'head',
			offset: { x: 0, y: 0 }
		}

		expect(studio.getEffectivePartImage('mouth')).toBe('images/sprites/characters/default/mouth_normal.png')

		studio.setEmotion('happy')
		studio.setEmotionOverride('happy', 'mouth', 'images/sprites/characters/default/mouth_smile.png')

		expect(studio.getEffectivePartImage('mouth')).toBe('images/sprites/characters/default/mouth_smile.png')

		studio.setEmotion('default')
		expect(studio.getEffectivePartImage('mouth')).toBe('images/sprites/characters/default/mouth_normal.png')
	})

	it('supports view overrides for inverted orientation and back view', () => {
		studio.bodyParts['arm_left'] = {
			image: 'images/sprites/characters/default/arm_front.png',
			parent: 'body',
			offset: { x: 0, y: 0 }
		}

		studio.backSpriteOverrides['arm_left'] = 'images/sprites/characters/default/arm_back.png'
		studio.isBackView.value = true

		expect(studio.getEffectivePartImage('arm_left')).toBe('images/sprites/characters/default/arm_back.png')

		studio.isBackView.value = false
		expect(studio.getEffectivePartImage('arm_left')).toBe('images/sprites/characters/default/arm_front.png')
	})

	it('generates valid visual novel animation step JSON', () => {
		studio.selectedCharacterId.value = 'default'
		studio.selectedPartName.value = 'head'
		studio.partRotations['head'] = 15

		const json = studio.exportAnimationToJson('head')
		const parsed = JSON.parse(json)

		expect(parsed.type).toBe('part-animate')
		expect(parsed.character).toBe('default')
		expect(parsed.part).toBe('head')
		expect(parsed.styles.transform).toBe('rotate(15deg)')
		expect(parsed.duration).toBe(0.4)
	})

	it('generates valid visual novel animation step JSON with translation and rotation', () => {
		studio.selectedCharacterId.value = 'default'
		studio.selectedPartName.value = 'head'
		studio.partRotations['head'] = -8
		studio.partTranslations['head'] = { x: -2.5, y: 3.0 }

		const json = studio.exportAnimationToJson('head')
		const parsed = JSON.parse(json)

		expect(parsed.type).toBe('part-animate')
		expect(parsed.character).toBe('default')
		expect(parsed.part).toBe('head')
		expect(parsed.styles.transform).toBe('rotate(-8deg) translate(-2.5%, 3%)')
		expect(parsed.duration).toBe(0.4)
	})

	it('resets all posing angles, translations, and eye offsets on resetPose and stopAnimation', () => {
		studio.partRotations['head'] = 25
		studio.partRotations['arm_left'] = -40
		studio.partTranslations['head'] = { x: -2.5, y: 3.0 }
		studio.eyeLeftOffset.x = 0.8
		studio.eyeRightOffset.y = -0.5

		studio.resetPose()

		expect(studio.partRotations['head']).toBe(0)
		expect(studio.partRotations['arm_left']).toBe(0)
		expect(studio.partTranslations['head']).toEqual({ x: 0, y: 0 })
		expect(studio.eyeLeftOffset.x).toBe(0)
		expect(studio.eyeRightOffset.y).toBe(0)

		// Also check stopAnimation
		studio.partRotations['head'] = 10
		studio.partTranslations['head'] = { x: 1, y: 2 }
		studio.stopAnimation()
		expect(studio.partRotations['head']).toBe(0)
		expect(studio.partTranslations['head']).toEqual({ x: 0, y: 0 })
	})

	it('animates cough with head translation and neck tilt without shaking body', () => {
		studio.bodyParts['body'] = { image: 'body.png', parent: null, offset: { x: 0, y: 0 } }
		studio.bodyParts['neck'] = { image: 'neck.png', parent: 'body', offset: { x: 0, y: -50 } }
		studio.bodyParts['head'] = { image: 'head.png', parent: 'neck', offset: { x: -40, y: -40 } }

		// Step at first cough impulse peak (0.125s into 1.3s cycle)
		studio.stepAnimation('cough', 0.125)

		// Body MUST NOT rotate or shake (keyframe cough doesn't touch body; value stays 0 or undefined)
		expect(studio.partRotations['body'] ?? 0).toBe(0)
		expect(studio.partTranslations['body'] ?? { x: 0, y: 0 }).toEqual({ x: 0, y: 0 })

		// Head must displace forward/down toward (-2.5%, 3.0%) — keyframe peak is at t=0.12,
		// so at t=0.125 we are very close but slightly interpolating back; check sign and order of magnitude
		expect(studio.partTranslations['head'].x).toBeCloseTo(-2.5, 0)
		expect(studio.partTranslations['head'].y).toBeCloseTo(3.0, 0)

		// Neck tilts forward/down
		expect(studio.partRotations['neck']).toBeLessThan(0)

		// Step at pause between coughs (0.8s into 1.3s cycle)
		studio.stepAnimation('cough', 0.8)
		expect(studio.partTranslations['head']).toEqual({ x: 0, y: 0 })
		expect(studio.partRotations['neck']).toBe(0)
		expect(studio.partRotations['body'] ?? 0).toBe(0)
	})


	it('supports 4-level deep nesting hierarchy matching MC structure', () => {
		studio.bodyParts['body'] = { image: 'body.png', parent: null, offset: { x: 0, y: 0 } }
		studio.bodyParts['arm_left'] = { image: 'arm_left.png', parent: 'body', offset: { x: 19.5, y: -42.5 } }
		studio.bodyParts['arm_left2'] = { image: 'arm_left2.png', parent: 'arm_left', offset: { x: 44.5, y: 80.5 } }
		studio.bodyParts['arm_left3'] = { image: 'arm_left3.png', parent: 'arm_left2', offset: { x: -69.85, y: 77.5 } }

		// All 4 parts exist and link properly in hierarchy
		expect(studio.bodyParts['arm_left3'].parent).toBe('arm_left2')
		expect(studio.bodyParts['arm_left2'].parent).toBe('arm_left')
		expect(studio.bodyParts['arm_left'].parent).toBe('body')
	})

	it('preserves canonical biological height and saves visual scale to 3 decimals without overwriting height', async () => {
		const mockWriteDataFile = vi.fn().mockResolvedValue({ success: true })
		vi.stubGlobal('window', {
			electronAPI: {
				dataEditor: {
					writeFile: mockWriteDataFile
				}
			}
		})

		// Simulate character values loaded from values.json
		studio.characterValues.value = {
			name: 'Момонга',
			height: 177,
			size: 1.0
		}
		studio.baseHeightCm.value = 177
		studio.characterScale.value = 1.0456 // Fine-tuned scale with 4 decimals

		await studio.saveValuesJson()

		expect(mockWriteDataFile).toHaveBeenCalledTimes(1)
		const [filePath, payload] = mockWriteDataFile.mock.calls[0]
		expect(filePath).toContain('values.json')

		// Biological height MUST remain unchanged (177 cm)
		expect(payload.height).toBe(177)
		// Visual scale must be rounded to 3 decimal places
		expect(payload.size).toBe(1.046)
		expect(payload.scale).toBe(1.046)
	})

	it('manages root avatar offset (X and Y) and resets properly', () => {
		expect(studio.rootOffset.x).toBe(0)
		expect(studio.rootOffset.y).toBe(0)

		studio.adjustRootOffset('x', 1.5)
		studio.adjustRootOffset('y', -2.25)
		expect(studio.rootOffset.x).toBe(1.5)
		expect(studio.rootOffset.y).toBe(-2.25)

		studio.resetRootOffset()
		expect(studio.rootOffset.x).toBe(0)
		expect(studio.rootOffset.y).toBe(0)
	})

	it('persists root_offset in both values.json and body.json', async () => {
		const mockWriteDataFile = vi.fn().mockResolvedValue({ success: true })
		vi.stubGlobal('window', {
			electronAPI: {
				dataEditor: {
					writeFile: mockWriteDataFile
				}
			}
		})

		studio.selectedCharacterId.value = 'default'
		studio.rootOffset.x = 2.5
		studio.rootOffset.y = -3.2
		studio.characterValues.value = { id: 'default', size: 1.0 }
		studio.bodyParts['body'] = { image: 'body.png', parent: null, offset: { x: 0, y: 0 } }

		// Save values.json
		await studio.saveValuesJson()
		expect(mockWriteDataFile).toHaveBeenCalledWith(
			'characters/default/values.json',
			expect.objectContaining({
				root_offset: { x: 2.5, y: -3.2 }
			})
		)

		// Save body.json
		await studio.saveBodyJson()
		expect(mockWriteDataFile).toHaveBeenCalledWith(
			'characters/default/body.json',
			expect.objectContaining({
				body: expect.objectContaining({
					offset: { x: 2.5, y: -3.2 }
				})
			})
		)
	})

	it('safely strips Vue reactive proxies before sending data to Electron IPC to prevent clone error', async () => {
		let receivedPayload = null
		const mockWriteDataFile = vi.fn(async (path, data) => {
			// structuredClone simulates Electron IPC postMessage boundary
			structuredClone(data)
			receivedPayload = data
			return { success: true }
		})

		vi.stubGlobal('window', {
			electronAPI: {
				dataEditor: {
					writeFile: mockWriteDataFile
				}
			}
		})

		studio.selectedCharacterId.value = 'mc'
		// Deep reactive object mimicking MC character data
		studio.characterValues.value = {
			id: 'mc',
			name: 'Анон',
			equipment_slots: {
				head: null,
				torso: 'tshirt'
			},
			inventory: {
				items: [{ itemId: 'ygdrasil-coin-old', quantity: 23 }]
			},
			abilities: [{ id: 'power_attack', name: 'Мощная атака' }]
		}
		studio.characterScale.value = 1.277
		studio.rootOffset.x = 0
		studio.rootOffset.y = -11.10

		await studio.saveValuesJson()

		expect(mockWriteDataFile).toHaveBeenCalledTimes(1)
		expect(receivedPayload).toBeDefined()
		expect(receivedPayload.size).toBe(1.277)
		expect(receivedPayload.root_offset).toEqual({ x: 0, y: -11.1 })
		expect(studio.statusMessage.value?.type).toBe('success')
	})

	it('supports animation CRUD operations: create, update, duplicate, delete', () => {
		const anim = {
			id: 'custom_nod',
			name: 'Кивок',
			icon: '🙇',
			group: 'Эмоции',
			duration: 0.8,
			repeat: 'once',
			mode: 'timeline',
			tracks: [
				{
					target: 'head',
					targetMode: 'single',
					keyframes: [
						{ time: 0, transform: { rot: 0, x: 0, y: 0, scale: 1 }, easing: 'linear' },
						{ time: 0.4, transform: { rot: 15, x: 0, y: 2, scale: 1 }, easing: 'ease-out' },
						{ time: 0.8, transform: { rot: 0, x: 0, y: 0, scale: 1 }, easing: 'ease-in' }
					]
				}
			]
		}

		// Create
		studio.createAnimation(anim)
		expect(studio.customAnimations.value.find((a) => a.id === 'custom_nod')).toBeDefined()
		expect(studio.animationGroups.value).toContain('Эмоции')

		// Update
		studio.updateAnimation('custom_nod', { name: 'Глубокий кивок', duration: 1.2 })
		const updated = studio.customAnimations.value.find((a) => a.id === 'custom_nod')
		expect(updated.name).toBe('Глубокий кивок')
		expect(updated.duration).toBe(1.2)

		// Duplicate
		const duplicated = studio.duplicateAnimation('custom_nod')
		expect(duplicated).toBeDefined()
		expect(duplicated.name).toBe('Глубокий кивок (Копия)')
		expect(studio.customAnimations.value).toContainEqual(duplicated)

		// Delete
		studio.deleteAnimation(duplicated.id)
		expect(studio.customAnimations.value.find((a) => a.id === duplicated.id)).toBeUndefined()
	})

	it('filters animations by group correctly', () => {
		studio.customAnimations.value = [
			{ id: 'a1', name: 'Anim 1', group: 'Бой' },
			{ id: 'a2', name: 'Anim 2', group: 'Диалоги' }
		]

		studio.selectedAnimationGroup.value = 'all'
		expect(studio.filteredAnimations.value.some((a) => a.id === 'a1')).toBe(true)
		expect(studio.filteredAnimations.value.some((a) => a.id === 'cough')).toBe(true)

		studio.selectedAnimationGroup.value = 'Бой'
		expect(studio.filteredAnimations.value.every((a) => a.group === 'Бой')).toBe(true)
		expect(studio.filteredAnimations.value.length).toBe(1)
	})

	it('correctly discovers hierarchical descendants with getDescendants', () => {
		studio.bodyParts['body'] = { image: 'body.png', parent: null }
		studio.bodyParts['arm_left'] = { image: 'arm1.png', parent: 'body' }
		studio.bodyParts['arm_left2'] = { image: 'arm2.png', parent: 'arm_left' }
		studio.bodyParts['arm_left3'] = { image: 'arm3.png', parent: 'arm_left2' }
		studio.bodyParts['head'] = { image: 'head.png', parent: 'body' }

		const armDescendants = studio.getDescendants('arm_left')
		expect(armDescendants).toEqual(['arm_left2', 'arm_left3'])

		const bodyDescendants = studio.getDescendants('body')
		expect(bodyDescendants).toContain('arm_left')
		expect(bodyDescendants).toContain('arm_left2')
		expect(bodyDescendants).toContain('arm_left3')
		expect(bodyDescendants).toContain('head')

		const leafDescendants = studio.getDescendants('arm_left3')
		expect(leafDescendants).toEqual([])
	})

	it('interpolates keyframes with translation, rotation, scale, sprite override, and hierarchy cascade', () => {
		studio.bodyParts['body'] = { image: 'body.png', parent: null }
		studio.bodyParts['arm_left'] = { image: 'arm.png', parent: 'body' }
		studio.bodyParts['arm_left2'] = { image: 'arm2.png', parent: 'arm_left' }

		const anim = {
			id: 'test_timeline',
			name: 'Test Timeline',
			duration: 1.0,
			repeat: 'once',
			mode: 'timeline',
			tracks: [
				{
					target: 'arm_left',
					targetMode: 'hierarchy',
					keyframes: [
						{ time: 0, transform: { rot: 0, x: 0, y: 0, scale: 1 }, easing: 'linear' },
						{ time: 0.5, transform: { rot: 40, x: 10, y: -5, scale: 1.5 }, sprite: 'arm_custom.png', easing: 'linear' },
						{ time: 1.0, transform: { rot: 80, x: 20, y: -10, scale: 2.0 }, easing: 'linear' }
					]
				}
			]
		}

		// Evaluate at t = 0.25 (midpoint between 0 and 0.5)
		studio.evaluateCustomAnimation(anim, 0.25)
		expect(studio.partRotations['arm_left']).toBeCloseTo(20, 1)
		expect(studio.partTranslations['arm_left'].x).toBeCloseTo(5, 1)
		expect(studio.partTranslations['arm_left'].y).toBeCloseTo(-2.5, 1)
		expect(studio.partScales['arm_left']).toBeCloseTo(1.25, 2)
		// Target mode is hierarchy, so arm_left2 also gets transform
		expect(studio.partRotations['arm_left2']).toBeCloseTo(20, 1)

		// Evaluate at t = 0.5 (sprite swap frame)
		studio.evaluateCustomAnimation(anim, 0.5)
		expect(studio.animatedSprites['arm_left']).toBe('arm_custom.png')
	})

	it('evaluates procedural math script animations safely in sandbox', () => {
		const anim = {
			id: 'test_script',
			name: 'Test Script',
			duration: 2.0,
			repeat: 'loop',
			mode: 'script',
			script: {
				code: `
					return {
						head: {
							rot: sin(progress * PI) * 30,
							x: cos(progress * PI) * 10,
							y: 5,
							scale: 1.1
						}
					};
				`
			}
		}

		// At t = 1.0s (progress = 0.5), sin(0.5 * PI) = 1, cos(0.5 * PI) = 0
		studio.evaluateCustomAnimation(anim, 1.0)
		expect(studio.partRotations['head']).toBeCloseTo(30, 1)
		expect(studio.partTranslations['head'].x).toBeCloseTo(0, 1)
		expect(studio.partTranslations['head'].y).toBeCloseTo(5, 1)
		expect(studio.partScales['head']).toBeCloseTo(1.1, 2)
	})

	it('exports custom animation to VN JSON step format', () => {
		studio.selectedCharacterId.value = 'mc'
		studio.customAnimations.value = [
			{
				id: 'epic_cough',
				name: 'Эпичный кашель',
				duration: 1.5
			}
		]

		const json = studio.exportAnimationToJson('epic_cough')
		const parsed = JSON.parse(json)

		expect(parsed.type).toBe('animate')
		expect(parsed.character).toBe('mc')
		expect(parsed.animation).toBe('epic_cough')
		expect(parsed.duration).toBe(1.5)
	})

	it('integrates with playCharacterAnimation in story characters', async () => {
		const { useStoryCharacters } = await import('../story/useStoryCharacters')
		const { ref } = await import('vue')

		const characterData = ref({
			mc: { id: 'mc', name: 'Момонга', partAnimations: {} }
		})

		const storyChars = useStoryCharacters({ characterData })

		// Builtin cough animation
		storyChars.playCharacterAnimation({ character: 'mc', animation: 'cough', duration: 0.8 })
		expect(characterData.value.mc.partAnimations['neck']).toBeDefined()
		expect(characterData.value.mc.partAnimations['neck'].class).toBe('cough-head')

		// Custom tracks animation
		storyChars.playCharacterAnimation({
			character: 'mc',
			animation: 'custom_dance',
			duration: 1.0,
			tracks: [
				{ target: 'arm_left', styles: { transform: 'rotate(45deg)' } },
				{ target: 'head', styles: { transform: 'translate(0, 5px)' } }
			]
		})
		expect(characterData.value.mc.partAnimations['arm_left']).toBeDefined()
		expect(characterData.value.mc.partAnimations['arm_left'].styles.transform).toBe('rotate(45deg)')
		expect(characterData.value.mc.partAnimations['head']).toBeDefined()
	})
})
