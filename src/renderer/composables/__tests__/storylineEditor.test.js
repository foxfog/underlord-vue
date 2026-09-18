import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStorylineEditor } from '../useStorylineEditor'

describe('useStorylineEditor Composable', () => {
	let editor

	beforeEach(() => {
		// Mock window and electronAPI
		global.window = {
			electronAPI: {
				dataEditor: {
					listTree: vi.fn(),
					readFile: vi.fn(),
					writeFile: vi.fn(),
					createDir: vi.fn(),
					deleteFile: vi.fn(),
					deleteDir: vi.fn()
				}
			}
		}
		editor = useStorylineEditor()
	})

	it('initializes with default locale, empty tree, and registries', () => {
		expect(editor.activeLocale.value).toBe('ru')
		expect(editor.availableLocales.value.length).toBeGreaterThan(0)
		expect(editor.availableCharacters.value.some((c) => c.id === 'mc')).toBe(true)
		expect(editor.availableScenes.value.includes('city_street')).toBe(true)
		expect(editor.currentStory.value.steps).toEqual([])
		expect(editor.isDirty.value).toBe(false)
	})

	it('loads fallback file tree when listTree is unavailable or returns error', async () => {
		window.electronAPI.dataEditor.listTree.mockResolvedValueOnce({ success: false })
		await editor.loadFileTree()

		expect(editor.fileTree.value.length).toBeGreaterThan(0)
		const introNode = editor.fileTree.value.find((n) => n.name === 'intro.json')
		expect(introNode).toBeDefined()
		expect(introNode.isDirectory).toBe(false)
	})

	it('loads file tree from electronAPI when available', async () => {
		const mockTree = [
			{
				name: 'intro.json',
				isDirectory: false,
				path: 'story/ru/intro.json'
			},
			{
				name: 'cyber',
				isDirectory: true,
				path: 'story/ru/cyber',
				children: [
					{
						name: 'mchome.json',
						isDirectory: false,
						path: 'story/ru/cyber/mchome.json'
					}
				]
			}
		]
		window.electronAPI.dataEditor.listTree.mockResolvedValueOnce({ success: true, tree: mockTree })
		await editor.loadFileTree()

		expect(editor.fileTree.value).toEqual(mockTree)
		expect(editor.isFolderExpanded('story/ru/cyber')).toBe(true)
	})

	it('toggles folder expanded state', () => {
		expect(editor.isFolderExpanded('story/ru/test')).toBe(false)
		editor.toggleFolder('story/ru/test')
		expect(editor.isFolderExpanded('story/ru/test')).toBe(true)
		editor.toggleFolder('story/ru/test')
		expect(editor.isFolderExpanded('story/ru/test')).toBe(false)
	})

	it('loads story file and populates steps', async () => {
		const mockStoryData = {
			id: 'test_story',
			steps: [
				{ type: 'scene', id: 'city_street' },
				{ type: 'dialogue', character: 'mc', text: 'Привет, мир!' }
			]
		}
		window.electronAPI.dataEditor.readFile.mockResolvedValueOnce({
			success: true,
			data: mockStoryData
		})

		await editor.loadStoryFile('story/ru/test_story.json')

		expect(editor.selectedFilePath.value).toBe('story/ru/test_story.json')
		expect(editor.currentStory.value.id).toBe('test_story')
		expect(editor.currentStory.value.steps.length).toBe(2)
		expect(editor.activeStepIndex.value).toBe(0)
		expect(editor.activeStep.value.type).toBe('scene')
		expect(editor.isDirty.value).toBe(false)
	})

	it('adds steps with default templates', () => {
		editor.currentStory.value = {
			id: 'new_scenario',
			steps: [{ type: 'scene', id: 'city_street' }]
		}

		editor.addStep('dialogue')
		expect(editor.currentStory.value.steps.length).toBe(2)
		expect(editor.currentStory.value.steps[1].type).toBe('dialogue')
		expect(editor.currentStory.value.steps[1].character).toBe('mc')
		expect(editor.isDirty.value).toBe(true)

		editor.addStep('choice')
		expect(editor.currentStory.value.steps.length).toBe(3)
		expect(editor.currentStory.value.steps[2].type).toBe('choice')
		expect(editor.currentStory.value.steps[2].options.length).toBe(2)

		editor.addStep('variable')
		expect(editor.currentStory.value.steps.length).toBe(4)
		expect(editor.currentStory.value.steps[3].variable).toBeDefined()
	})

	it('duplicates, moves and removes steps accurately', () => {
		editor.currentStory.value = {
			id: 'test',
			steps: [
				{ type: 'scene', id: 'step_1' },
				{ type: 'dialogue', character: 'mc', text: 'step_2' },
				{ type: 'sound', file: 'step_3.mp3' }
			]
		}

		// Duplicate step at index 1
		editor.duplicateStep(1)
		expect(editor.currentStory.value.steps.length).toBe(4)
		expect(editor.currentStory.value.steps[2].text).toBe('step_2')
		expect(editor.activeStepIndex.value).toBe(2)

		// Move step 0 to index 2
		editor.moveStep(0, 2)
		expect(editor.currentStory.value.steps[2].id).toBe('step_1')
		expect(editor.activeStepIndex.value).toBe(2)

		// Remove step
		editor.removeStep(0)
		expect(editor.currentStory.value.steps.length).toBe(3)
		expect(editor.isDirty.value).toBe(true)
	})

	it('updates active step data and preserves condition', () => {
		editor.currentStory.value = {
			id: 'test',
			steps: [{ type: 'dialogue', character: 'mc', text: 'старый текст', if: 'global.flag' }]
		}
		editor.activeStepIndex.value = 0

		editor.updateActiveStep({
			type: 'dialogue',
			character: 'albedo',
			text: 'новый текст',
			if: 'global.flag'
		})

		expect(editor.activeStep.value.character).toBe('albedo')
		expect(editor.activeStep.value.text).toBe('новый текст')
		expect(editor.activeStep.value.if).toBe('global.flag')
		expect(editor.isDirty.value).toBe(true)
	})

	it('changes step type on the fly', () => {
		editor.currentStory.value = {
			id: 'test',
			steps: [{ type: 'scene', id: 'city_street', if: 'global.flag' }]
		}
		editor.activeStepIndex.value = 0

		editor.updateStepType('dialogue')
		expect(editor.activeStep.value.type).toBe('dialogue')
		expect(editor.activeStep.value.character).toBe('mc')
		expect(editor.activeStep.value.if).toBe('global.flag')
	})

	it('saves story file via electronAPI writeFile', async () => {
		window.electronAPI.dataEditor.writeFile.mockResolvedValueOnce({ success: true })

		editor.selectedFilePath.value = 'story/ru/my_story.json'
		editor.currentStory.value = {
			id: 'my_story',
			steps: [{ type: 'scene', id: 'city_street' }]
		}
		editor.isDirty.value = true

		await editor.saveStoryFile()

		expect(window.electronAPI.dataEditor.writeFile).toHaveBeenCalledWith(
			'story/ru/my_story.json',
			expect.objectContaining({ id: 'my_story' })
		)
		expect(editor.isDirty.value).toBe(false)
	})

	it('creates new story file and folder', async () => {
		window.electronAPI.dataEditor.writeFile.mockResolvedValueOnce({ success: true })
		window.electronAPI.dataEditor.listTree.mockResolvedValueOnce({ success: true, tree: [] })
		window.electronAPI.dataEditor.readFile.mockResolvedValueOnce({
			success: true,
			data: { id: 'test_file', steps: [] }
		})

		const createdPath = await editor.createStoryFile('story/ru', 'test_file')
		expect(createdPath).toBe('story/ru/test_file.json')
		expect(window.electronAPI.dataEditor.writeFile).toHaveBeenCalled()

		window.electronAPI.dataEditor.createDir.mockResolvedValueOnce({ success: true })
		const createdFolder = await editor.createStoryFolder('story/ru', 'new_chapter')
		expect(createdFolder).toBe('story/ru/new_chapter')
		expect(window.electronAPI.dataEditor.createDir).toHaveBeenCalledWith('story/ru/new_chapter')
	})

	it('deletes story file and clears selection if deleted active file', async () => {
		window.electronAPI.dataEditor.deleteFile.mockResolvedValueOnce({ success: true })
		window.electronAPI.dataEditor.listTree.mockResolvedValueOnce({ success: true, tree: [] })

		editor.selectedFilePath.value = 'story/ru/test.json'
		await editor.deleteStoryItem('story/ru/test.json', false)

		expect(window.electronAPI.dataEditor.deleteFile).toHaveBeenCalledWith('story/ru/test.json')
		expect(editor.selectedFilePath.value).toBe('')
		expect(editor.currentStory.value.steps).toEqual([])
	})

	it('generates accurate step summary and icons for various action types', () => {
		expect(editor.getStepTypeIcon({ type: 'dialogue' })).toBe('💬')
		expect(editor.getStepTypeIcon({ type: 'scene' })).toBe('🌄')
		expect(editor.getStepTypeIcon({ type: 'choice' })).toBe('🔀')
		expect(editor.getStepTypeIcon({ variable: 'x = 1' })).toBe('⚙️')

		const dialogueStep = { type: 'dialogue', character: 'mc', text: '<b>Привет</b>, игрок!' }
		const summary = editor.getStepSummary(dialogueStep)
		expect(summary).toContain('💬 [mc]')
		expect(summary).toContain('Привет, игрок!')

		const multiStepDialogue = {
			type: 'dialogue',
			id: 'location_time_info',
			steps: [
				{ text: '<p><b>Местоположение:</b> какой то город</p>' },
				{ text: '<p><b>Время:</b> 20:52</p>' }
			]
		}
		const multiSummary = editor.getStepSummary(multiStepDialogue)
		expect(multiSummary).toContain('[location_time_info]')
		expect(multiSummary).toContain('(2 шагов)')
		expect(multiSummary).toContain('Местоположение:')

		const varStep = { variable: 'global.year = 2138' }
		expect(editor.getStepSummary(varStep)).toBe('⚙️ global.year = 2138')
	})

	it('builds story topology graph with sequence links, choices, and loops', () => {
		const steps = [
			{ id: 'start_label', type: 'scene' }, // index 0
			{ type: 'dialogue', character: 'mc', text: 'Первая фраза' }, // index 1
			{
				type: 'choice',
				options: [
					{ text: 'Идти вперед', goto: 'step_end' },
					{ text: 'Повторить', actions: [{ type: 'goto', target: 'start_label' }] },
					{ text: 'Кашлять', actions: [{ type: 'goto', target: 'macros/cough' }] }
				]
			}, // index 2
			{ id: 'loop_point', type: 'goto', target: 'start_label' }, // index 3 (internal loop)
			{ id: 'step_end', type: 'end' } // index 4
		]

		const graph = editor.buildStoryGraph(steps)
		expect(graph.nodes.length).toBe(5)

		// Check coordinates and dimensions
		expect(graph.nodes[0].x).toBe(0)
		expect(graph.nodes[1].x).toBeGreaterThan(0)
		expect(graph.nodes[0].width).toBe(16.5)

		// Check loop detection on index 3 goto index 0
		const loopNode = graph.nodes[3]
		expect(loopNode.isGoto).toBe(true)
		expect(loopNode.isLoop).toBe(true)
		expect(loopNode.targetInternalIndex).toBe(0)

		// Check sequence links exist
		const seqLink = graph.links.find((l) => l.key === 'seq_0_1')
		expect(seqLink).toBeDefined()
		expect(seqLink.type).toBe('sequence')

		// Check choice branches on node 2
		const choiceNode = graph.nodes[2]
		expect(choiceNode.choiceBranches.length).toBe(3)
		expect(choiceNode.choiceBranches[0].target).toBe('step_end')
		expect(choiceNode.choiceBranches[0].targetIndex).toBe(4) // internal jump
		expect(choiceNode.choiceBranches[1].isLoop).toBe(true) // backward internal jump
		expect(choiceNode.choiceBranches[2].isExternal).toBe(true) // external scenario

		// Check choice link generated in links array
		const choiceLink = graph.links.find((l) => l.key.startsWith('choice_2_opt_0'))
		expect(choiceLink).toBeDefined()
		expect(choiceLink.toIndex).toBe(4)

		// Check loop link generated for goto node 3
		const loopLink = graph.links.find((l) => l.key === 'goto_3_0')
		expect(loopLink).toBeDefined()
		expect(loopLink.isLoop).toBe(true)
	})

	it('resolves scenario target path and navigates between scenarios with history', async () => {
		expect(editor.resolveScenarioPath('macros/cough')).toBe('story/ru/macros/cough.json')
		expect(editor.resolveScenarioPath('/cyber/factory/factory_main.json')).toBe(
			'story/ru/cyber/factory/factory_main.json'
		)

		window.electronAPI.dataEditor.readFile.mockImplementation((path) => {
			return Promise.resolve({
				success: true,
				data: { id: path, steps: [{ type: 'dialogue', text: `Loaded ${path}` }] }
			})
		})

		// Start with intro
		await editor.loadStoryFile('story/ru/intro.json')
		expect(editor.selectedFilePath.value).toBe('story/ru/intro.json')
		expect(editor.canNavigateBack.value).toBe(false)

		// Jump to macros/cough
		await editor.jumpToScenario('macros/cough')
		expect(editor.selectedFilePath.value).toBe('story/ru/macros/cough.json')
		expect(editor.canNavigateBack.value).toBe(true)
		expect(editor.previousScenarioPath.value).toBe('story/ru/intro.json')

		// Navigate back
		await editor.navigateBack()
		expect(editor.selectedFilePath.value).toBe('story/ru/intro.json')
		expect(editor.canNavigateBack.value).toBe(false)
	})

	it('detects scenario returns via continue, explicit goto, or implicit non-terminal end', () => {
		// Scenario with continue
		const storyWithContinue = {
			id: 'cough',
			steps: [
				{ type: 'sound', file: 'cough.mp3' },
				{ type: 'continue' }
			]
		}
		const ret1 = editor.checkScenarioReturn(storyWithContinue, 'intro')
		expect(ret1.returns).toBe(true)
		expect(ret1.type).toBe('continue')
		expect(ret1.label).toBe('↩ continue')

		// Scenario with explicit goto back to caller
		const storyWithExplicitGoto = {
			id: 'subquest',
			steps: [
				{ type: 'dialogue', text: 'Задание выполнено' },
				{ type: 'goto', target: 'intro' }
			]
		}
		const ret2 = editor.checkScenarioReturn(storyWithExplicitGoto, 'intro')
		expect(ret2.returns).toBe(true)
		expect(ret2.type).toBe('explicit')
		expect(ret2.label).toBe('↩ intro')

		// Scenario ending with terminal end
		const storyWithEnd = {
			id: 'game_over',
			steps: [
				{ type: 'dialogue', text: 'Конец' },
				{ type: 'end' }
			]
		}
		const ret3 = editor.checkScenarioReturn(storyWithEnd, 'intro')
		expect(ret3.returns).toBe(false)

		// Scenario ending with terminal hold
		const storyWithHold = {
			id: 'pause',
			steps: [{ type: 'hold' }]
		}
		const ret4 = editor.checkScenarioReturn(storyWithHold, 'intro')
		expect(ret4.returns).toBe(false)

		// Scenario ending with non-terminal step (implicit return)
		const storyImplicit = {
			id: 'quick_macro',
			steps: [{ type: 'dialogue', text: 'Просто реплика' }]
		}
		const ret5 = editor.checkScenarioReturn(storyImplicit, 'intro')
		expect(ret5.returns).toBe(true)
		expect(ret5.type).toBe('implicit')
	})

	it('builds graph with return links for external scenarios that continue', async () => {
		// Mock readStoryFile to return a scenario that continues
		window.electronAPI.dataEditor.readFile.mockImplementation((path) => {
			if (path.includes('cough')) {
				return Promise.resolve({
					success: true,
					data: {
						id: 'cough',
						steps: [
							{ type: 'sound', file: 'cough.mp3' },
							{ type: 'continue' }
						]
					}
				})
			}
			return Promise.resolve({
				success: true,
				data: { id: path, steps: [] }
			})
		})

		// Load target into cache first
		await editor.readStoryFile('macros/cough')

		editor.currentStory.value = {
			id: 'intro',
			steps: [
				{ id: 'step_before', type: 'dialogue', text: 'Перед кашлем' }, // 0
				{ type: 'goto', target: 'macros/cough' }, // 1 (external goto that returns)
				{ id: 'step_after', type: 'dialogue', text: 'После кашля' }, // 2
				{ type: 'end' } // 3
			]
		}

		const graph = editor.buildStoryGraph(editor.currentStory.value.steps)
		expect(graph.nodes.length).toBe(4)

		const gotoNode = graph.nodes[1]
		expect(gotoNode.isExternalJump).toBe(true)
		expect(gotoNode.externalReturnInfo).toBeDefined()
		expect(gotoNode.externalReturnInfo.returns).toBe(true)

		// A return link should be created from step 1 to step 2 (idx + 1)
		const returnLink = graph.links.find((l) => l.key === 'return_1_2')
		expect(returnLink).toBeDefined()
		expect(returnLink.type).toBe('return')
		expect(returnLink.fromIndex).toBe(1)
		expect(returnLink.toIndex).toBe(2)
		expect(returnLink.label).toBe('↩ continue')
	})

	it('scans inbound references pointing to target scenario from other files', async () => {
		window.electronAPI.dataEditor.readFile.mockImplementation((path) => {
			if (path.includes('start.json')) {
				return Promise.resolve({
					success: true,
					data: {
						id: 'start',
						steps: [
							{ type: 'ui', target: ['all'], action: 'hide' },
							{ type: 'goto', target: 'intro' }
						]
					}
				})
			}
			return Promise.resolve({
				success: true,
				data: { id: path, steps: [] }
			})
		})

		const inbounds = await editor.scanInboundReferences('story/ru/intro.json')
		expect(inbounds.length).toBeGreaterThan(0)
		const startRef = inbounds.find((r) => r.sourceFileName === 'start.json')
		expect(startRef).toBeDefined()
		expect(startRef.stepIndex).toBe(1)
		expect(startRef.stepType).toBe('goto')
		expect(startRef.target).toBe('intro')
	})

	it('jumps to scenario and sets activeStepIndex when targetStepIndex is provided', async () => {
		window.electronAPI.dataEditor.readFile.mockImplementation((path) => {
			return Promise.resolve({
				success: true,
				data: {
					id: 'intro',
					steps: [
						{ type: 'dialogue', text: '0' },
						{ type: 'dialogue', text: '1' },
						{ type: 'dialogue', text: '2' },
						{ type: 'goto', target: 'nameinput' }
					]
				}
			})
		})

		await editor.jumpToScenario('intro', 3)
		expect(editor.selectedFilePath.value).toBe('story/ru/intro.json')
		expect(editor.activeStepIndex.value).toBe(3)
	})

	it('routes each choice option to its individual destination and creates outbound node for external jump', () => {
		const steps = [
			{
				type: 'choice',
				options: [
					{
						text: 'Да',
						actions: [
							{ type: 'dialogue', character: 'mc', text: 'Хорошо' },
							{ type: 'goto', target: 'start' }
						]
					},
					{
						text: 'Нет',
						actions: [{ type: 'dialogue', character: 'mc', text: 'Нехорошо' }]
					}
				]
			},
			{
				type: 'dialogue',
				character: 'albedo',
				text: 'Сейчас открою'
			},
			{ type: 'end' }
		]

		const graph = editor.buildStoryGraph(steps)
		expect(graph.nodes.length).toBe(3)

		// Check outbound nodes: 1 outbound node created for 'start'
		expect(graph.outboundNodes.length).toBe(1)
		const outNode = graph.outboundNodes[0]
		expect(outNode.target).toBe('start')
		expect(outNode.targetClean).toBe('start')
		expect(outNode.sourceStepIndex).toBe(0)
		expect(outNode.sourceOptionIndex).toBe(0)
		expect(outNode.optionText).toBe('Да')
		// Option 0 is before continuation option 1 -> target placed above baseline
		expect(outNode.y).toBe(-11.5)

		// Check links:
		// 1. Option 'Да' links to outbound node
		const opt0Link = graph.links.find((l) => l.key === `choice_outbound_0_opt_0`)
		expect(opt0Link).toBeDefined()
		expect(opt0Link.type).toBe('choice-outbound')
		expect(opt0Link.outboundId).toBe(outNode.id)
		expect(opt0Link.label).toBe('Да')

		// 2. Option 'Нет' links to step 1 (fallthrough)
		const opt1Link = graph.links.find((l) => l.key === `choice_fallthrough_0_opt_1_to_1`)
		expect(opt1Link).toBeDefined()
		expect(opt1Link.type).toBe('choice-fallthrough')
		expect(opt1Link.toIndex).toBe(1)
		expect(opt1Link.label).toBe('Нет')

		// 3. Generic sequential link from step 0 center to step 1 is NOT emitted
		const genericSeq = graph.links.find((l) => l.key === 'seq_0_1')
		expect(genericSeq).toBeUndefined()

		// 4. Sequential link from step 1 to step 2 IS emitted
		const seq1to2 = graph.links.find((l) => l.key === 'seq_1_2')
		expect(seq1to2).toBeDefined()
	})

	it('places outbound node below baseline when external option is situated after continuation option', () => {
		const steps = [
			{
				type: 'choice',
				speaker: 'albedo',
				text: 'Тест порядка',
				options: [
					{ text: 'Остаться' }, // Option 0: continuation (fallthrough)
					{ text: 'Уйти', actions: [{ type: 'goto', target: 'exit_story' }] } // Option 1: external jump
				]
			},
			{
				type: 'dialogue',
				text: 'Продолжение сюжета'
			}
		]

		const graph = editor.buildStoryGraph(steps)
		expect(graph.outboundNodes.length).toBe(1)
		const outNode = graph.outboundNodes[0]
		expect(outNode.target).toBe('exit_story')
		expect(outNode.sourceOptionIndex).toBe(1)
		// Option 1 is after continuation option 0 -> target placed below baseline
		expect(outNode.y).toBe(11.5)
	})

	it('adapts choice node width dynamically for longer option answers', () => {
		const stepsWithLongText = [
			{
				type: 'choice',
				speaker: 'albedo',
				text: 'Куда пойдём?',
				options: [
					{ text: 'Пойти в древние катакомбы под старым замком' } // > 25 characters
				]
			},
			{
				type: 'choice',
				speaker: 'albedo',
				text: 'Короткий выбор',
				options: [
					{ text: 'Да' },
					{ text: 'Нет' }
				]
			}
		]

		const graph = editor.buildStoryGraph(stepsWithLongText)
		expect(graph.nodes[0].width).toBe(19.5)
		expect(graph.nodes[1].width).toBe(16.5)
		// Check that the second node's x-coordinate is shifted by the first node's wider width
		expect(graph.nodes[1].x).toBe(19.5 + 7.0)
	})

	it('creates outbound node for standalone external goto without return', () => {
		const steps = [
			{ type: 'scene', id: 'city' },
			{ type: 'goto', target: 'start' }
		]

		const graph = editor.buildStoryGraph(steps)
		expect(graph.outboundNodes.length).toBe(1)
		const outNode = graph.outboundNodes[0]
		expect(outNode.target).toBe('start')
		expect(outNode.sourceStepIndex).toBe(1)

		const gotoLink = graph.links.find((l) => l.key === 'goto_outbound_1')
		expect(gotoLink).toBeDefined()
		expect(gotoLink.type).toBe('goto-outbound')
		expect(gotoLink.outboundId).toBe(outNode.id)
	})
})
