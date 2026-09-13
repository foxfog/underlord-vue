import { describe, it, expect, beforeEach } from 'vitest'
import { ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { initSettingsStore } from '../../stores/settings'
import { useNpcSchedule } from '../useNpcSchedule'
import { useQuests } from '../useQuests'
import { useVisualNovel } from '../useVisualNovel'
import schedulesData from '../../public/data/characters/schedules.json'
import scenesData from '../../public/data/scenes/scenes.json'
import menuStory from '../../public/data/story/ru/carne-chief/menu.json'
import talkStory from '../../public/data/story/ru/carne-chief/talk.json'
import chiefGardenJson from '../../data/isometric/tests/carne_chief_garden.json'
import { normalizeLocationData } from '../../utils/isometric/isoLoader'

describe('Carne Chief Weed Quest & Interaction', () => {
	let scheduleManager

	beforeEach(() => {
		setActivePinia(createPinia())
		initSettingsStore({ general: { language: 'ru' } })
		scheduleManager = useNpcSchedule()
		scheduleManager.resetState()
		scheduleManager.loadSchedules(schedulesData)
		useQuests().resetQuests()
	})

	it('loads chief schedule with interaction configured', () => {
		const chiefConfig = schedulesData.characters['carne-chief']
		expect(chiefConfig).toBeDefined()
		expect(chiefConfig.defaultInteraction).toEqual({
			type: 'npc-menu',
			story: 'carne-chief/menu'
		})
	})

	it('resolves chief location with interaction attached', () => {
		const loc = scheduleManager.resolveNpcLocation('carne-chief', {
			globalData: { timeOfDay: 'day' }
		})
		expect(loc).toBeDefined()
		expect(loc.sceneId).toBe('carne_chief_house')
		expect(loc.interaction).toEqual({
			type: 'npc-menu',
			story: 'carne-chief/menu'
		})
	})

	it('scenes.json includes carne_chief_garden_iso and house/square hotspots', () => {
		const gardenScene = scenesData.scenes.find((s) => s.id === 'carne_chief_garden_iso')
		expect(gardenScene).toBeDefined()
		expect(gardenScene.isometric).toBe('carne_chief_garden')
		expect(gardenScene.localMap).toBe('carne')

		const squareScene = scenesData.scenes.find((s) => s.id === 'carne_village_square')
		expect(squareScene).toBeDefined()
		const squareGardenHotspot = squareScene.hotspots.find((h) => h.id === 'to_chief_garden')
		expect(squareGardenHotspot).toBeDefined()
		expect(squareGardenHotspot.target).toBe('carne_chief_garden_iso')

		const houseScene = scenesData.scenes.find((s) => s.id === 'carne_chief_house')
		expect(houseScene).toBeDefined()
		const houseExitHotspot = houseScene.hotspots.find((h) => h.id === 'to_square')
		expect(houseExitHotspot).toBeDefined()
		expect(houseExitHotspot.target).toBe('carne_village_square')
		const houseGardenHotspot = houseScene.hotspots.find((h) => h.id === 'to_chief_garden')
		expect(houseGardenHotspot).toBeDefined()
		expect(houseGardenHotspot.target).toBe('carne_chief_garden_iso')
	})

	it('menu story has talk and back options', () => {
		expect(menuStory.id).toBe('carne-chief-menu')
		const choiceStep = menuStory.steps.find((s) => s.type === 'choice')
		expect(choiceStep).toBeDefined()
		expect(choiceStep.options.length).toBe(2)
		expect(choiceStep.options[0].text).toBe('Поговорить')
		expect(choiceStep.options[0].actions[0].target).toBe('carne-chief/talk')
		expect(choiceStep.options[1].text).toBe('Назад')
		expect(choiceStep.options[1].actions[0].target).toBe('carne_chief_house')
	})

	it('talk story contains introduction choice, quest start and turn in steps', () => {
		expect(talkStory.id).toBe('carne-chief-talk')

		// First meeting choice
		const firstMeetingChoice = talkStory.steps.find((s) => s.id === 'talk_first_meeting_choice')
		expect(firstMeetingChoice).toBeDefined()
		expect(firstMeetingChoice.options[0].text).toBe('Представиться')

		// Help choice and accepted step
		const helpChoice = talkStory.steps.find((s) => s.id === 'talk_help_choice')
		expect(helpChoice).toBeDefined()
		const acceptOpt = helpChoice.options.find((o) => o.text.includes('помочь') || o.text.includes('Помочь'))
		expect(acceptOpt).toBeDefined()
		expect(acceptOpt.actions[0].target).toBe('talk_help_accepted')

		const acceptedStep = talkStory.steps.find((s) => s.id === 'talk_help_accepted')
		expect(acceptedStep).toBeDefined()

		const questStep = talkStory.steps.find((s) => s.type === 'quest' && s.id === 'chief_garden_quest')
		expect(questStep).toBeDefined()

		const discoverStep = talkStory.steps.find((s) => s.type === 'discover-location' && s.location === 'carne_chief_garden')
		expect(discoverStep).toBeDefined()

		// Turn in step
		const turnIn = talkStory.steps.find((s) => s.id === 'talk_turn_in')
		expect(turnIn).toBeDefined()

		const invAdd = talkStory.steps.find((s) => s.type === 'inventory-add')
		expect(invAdd).toBeDefined()
		expect(invAdd.itemId).toBe('reestize-coin-gold')
		expect(invAdd.quantity).toBe(3)
	})

	it('clears dialogue mode on changeScene so that hotspots and map buttons become visible', () => {
		const vn = useVisualNovel({ src: '/data/story/ru/start.json' })
		vn.sceneData.value = {
			carne_chief_house: scenesData.scenes.find((s) => s.id === 'carne_chief_house')
		}

		// Simulate being in a dialogue
		vn.isInDialogueMode.value = true
		expect(vn.isDialogueActive.value).toBe(true)

		// Transition to scene
		vn.changeScene('carne_chief_house')
		expect(vn.isInDialogueMode.value).toBe(false)
		expect(vn.isDialogueActive.value).toBe(false)
	})

	it('has exit tile configured at (0, -5, 0) targeting carne_chief_house', () => {
		expect(chiefGardenJson.exits).toBeDefined()
		const houseExit = chiefGardenJson.exits.find((e) => e.id === 'exit_to_house')
		expect(houseExit).toBeDefined()
		expect(houseExit.trigger).toEqual({ x: 0, y: -5, z: 0 })
		expect(houseExit.target).toBe('carne_chief_house')

		// Verify normalizeLocationData preserves the exit
		const normalized = normalizeLocationData(chiefGardenJson)
		expect(normalized.exits).toBeDefined()
		const normExit = normalized.exits.find((e) => e.id === 'exit_to_house')
		expect(normExit).toBeDefined()
		expect(normExit.trigger).toEqual({ x: 0, y: -5, z: 0 })
	})

	it('talk_turn_in undiscovers carne_chief_garden and hides garden hotspots', () => {
		const undiscoverStep = talkStory.steps.find(
			(s) => (s.type === 'undiscover-location' || s.action === 'remove') && s.location === 'carne_chief_garden'
		)
		expect(undiscoverStep).toBeDefined()
		expect(undiscoverStep.map).toBe('carne')

		const hideHouseHotspot = talkStory.steps.find(
			(s) => s.type === 'hide-hotspot' && s.scene === 'carne_chief_house' && s.id === 'to_chief_garden'
		)
		expect(hideHouseHotspot).toBeDefined()

		const hideSquareHotspot = talkStory.steps.find(
			(s) => s.type === 'hide-hotspot' && s.scene === 'carne_village_square' && s.id === 'to_chief_garden'
		)
		expect(hideSquareHotspot).toBeDefined()

		// Verify scenes.json conditions
		const houseScene = scenesData.scenes.find((s) => s.id === 'carne_chief_house')
		const houseGardenHotspot = houseScene.hotspots.find((h) => h.id === 'to_chief_garden')
		expect(houseGardenHotspot.condition).toContain('!global.chief_quest_rewarded')

		const squareScene = scenesData.scenes.find((s) => s.id === 'carne_village_square')
		const squareGardenHotspot = squareScene.hotspots.find((h) => h.id === 'to_chief_garden')
		expect(squareGardenHotspot.condition).toContain('!global.chief_quest_rewarded')
	})

	it('undiscoverLocation removes location from globalData.discoveredLocations', () => {
		const vn = useVisualNovel({ src: '/data/story/ru/start.json' })
		vn.discoverLocation('carne', 'carne_chief_garden')
		expect(vn.globalData.value.discoveredLocations.carne).toContain('carne_chief_garden')

		vn.undiscoverLocation('carne', 'carne_chief_garden')
		expect(vn.globalData.value.discoveredLocations.carne).not.toContain('carne_chief_garden')
	})

	it('IsometricGameOverlay contains exit confirmation dialog logic', async () => {
		const fs = await import('fs')
		const path = await import('path')
		const overlayPath = path.resolve(__dirname, '../../components/game/IsometricGameOverlay.vue')
		const overlayContent = fs.readFileSync(overlayPath, 'utf-8')

		expect(overlayContent).toContain('showExitConfirm')
		expect(overlayContent).toContain('requestExit')
		expect(overlayContent).toContain('confirmExit')
		expect(overlayContent).toContain('cancelExit')
		expect(overlayContent).toContain('Покинуть локацию?')
	})

	it('IsoCanvas positions context menu at click location without jump animation', async () => {
		const fs = await import('fs')
		const path = await import('path')
		const canvasPath = path.resolve(__dirname, '../../components/game/isometric/IsoCanvas.vue')
		const canvasContent = fs.readFileSync(canvasPath, 'utf-8')

		expect(canvasContent).toContain('activeContextMenu.value = {')
		expect(canvasContent).toContain('clickX = e.clientX - (r?.left || 0)')
		expect(canvasContent).toContain('clickY = e.clientY - (r?.top || 0)')
		expect(canvasContent).toContain('context-menu-fade-in')
		expect(canvasContent).toContain('transform-origin: top left')
	})

	it('IsoCanvas displays object name in actionTooltip on hover', async () => {
		const fs = await import('fs')
		const path = await import('path')
		const canvasPath = path.resolve(__dirname, '../../components/game/isometric/IsoCanvas.vue')
		const canvasContent = fs.readFileSync(canvasPath, 'utf-8')

		expect(canvasContent).toContain('hoveredInteractiveObject.value')
		expect(canvasContent).toContain("const name = obj.name || (isWeed ? 'Сорняк' : 'Объект')")
		expect(canvasContent).toContain('text: name')
	})
})

