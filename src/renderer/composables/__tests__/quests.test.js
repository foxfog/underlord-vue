import { describe, it, expect, beforeEach } from 'vitest'
import { useQuests } from '../useQuests'

describe('useQuests composable', () => {
	const {
		quests,
		activeQuests,
		completedQuests,
		failedQuests,
		rootQuests,
		questTree,
		startQuest,
		completeQuest,
		failQuest,
		completeTask,
		setTaskStatus,
		addQuestStoryEntry,
		getChildren,
		getParent,
		isQuestActive,
		isQuestCompleted,
		resetQuests,
		getQuestsState,
		loadQuestsState
	} = useQuests()

	beforeEach(() => {
		resetQuests()
	})

	it('starts a new quest properly', () => {
		const quest = startQuest({
			id: 'try_neuro_helmet',
			title: 'Опробовать нейрошлем',
			description: 'Экипируйте нейрошлем в инвентаре.'
		})

		expect(quest).toBeDefined()
		expect(quest.id).toBe('try_neuro_helmet')
		expect(quest.status).toBe('active')
		expect(isQuestActive('try_neuro_helmet')).toBe(true)
		expect(activeQuests.value.length).toBe(1)
		expect(completedQuests.value.length).toBe(0)
	})

	it('does not duplicate active quest when started again', () => {
		startQuest({ id: 'test_q', title: 'Test 1' })
		startQuest({ id: 'test_q', title: 'Test 2' })

		expect(quests.value.length).toBe(1)
		expect(quests.value[0].title).toBe('Test 1')
	})

	it('completes an active quest', () => {
		startQuest({ id: 'try_neuro_helmet', title: 'Опробовать нейрошлем' })
		const completed = completeQuest('try_neuro_helmet')

		expect(completed).toBeDefined()
		expect(completed.status).toBe('completed')
		expect(isQuestActive('try_neuro_helmet')).toBe(false)
		expect(isQuestCompleted('try_neuro_helmet')).toBe(true)
		expect(activeQuests.value.length).toBe(0)
		expect(completedQuests.value.length).toBe(1)
	})

	it('fails an active quest', () => {
		startQuest({ id: 'timed_quest', title: 'Временный квест' })
		const failed = failQuest('timed_quest')

		expect(failed).toBeDefined()
		expect(failed.status).toBe('failed')
		expect(isQuestActive('timed_quest')).toBe(false)
		expect(failedQuests.value.length).toBe(1)
	})

	it('supports arbitrary nesting and builds quest tree', () => {
		// Root quest (level 0)
		startQuest({
			id: 'end_and_beginning',
			title: 'Конец и начало',
			description: 'Основное задание главы I'
		})

		// Child quest (level 1)
		startQuest({
			id: 'try_neuro_helmet',
			parentId: 'end_and_beginning',
			title: 'Опробовать нейрошлем',
			description: 'Экипируйте шлем'
		})

		// Sub-child quest (level 2 - deep nesting)
		startQuest({
			id: 'calibrate_sensors',
			parentId: 'try_neuro_helmet',
			title: 'Калибровка сенсоров',
			description: 'Глубокий подквест'
		})

		// Check parent-child relationships
		expect(getChildren('end_and_beginning').length).toBe(1)
		expect(getChildren('end_and_beginning')[0].id).toBe('try_neuro_helmet')
		expect(getChildren('try_neuro_helmet').length).toBe(1)
		expect(getChildren('try_neuro_helmet')[0].id).toBe('calibrate_sensors')
		expect(getParent('calibrate_sensors')?.id).toBe('try_neuro_helmet')

		// Check root quests
		expect(rootQuests.value.length).toBe(1)
		expect(rootQuests.value[0].id).toBe('end_and_beginning')

		// Check recursive tree
		const tree = questTree.value
		expect(tree.length).toBe(1)
		expect(tree[0].id).toBe('end_and_beginning')
		expect(tree[0].children.length).toBe(1)
		expect(tree[0].children[0].id).toBe('try_neuro_helmet')
		expect(tree[0].children[0].children.length).toBe(1)
		expect(tree[0].children[0].children[0].id).toBe('calibrate_sensors')
	})

	it('exports and restores quest state with parentId', () => {
		startQuest({ id: 'parent', title: 'Parent' })
		startQuest({ id: 'child', parentId: 'parent', title: 'Child' })
		completeQuest('child')

		const state = getQuestsState()
		resetQuests()
		expect(quests.value.length).toBe(0)

		loadQuestsState(state)
		expect(quests.value.length).toBe(2)
		expect(isQuestCompleted('child')).toBe(true)
		expect(isQuestActive('parent')).toBe(true)
		expect(getChildren('parent').length).toBe(1)
		expect(getChildren('parent')[0].id).toBe('child')
	})

	it('manages quest tasks and story entries properly', () => {
		const quest = startQuest({
			id: 'helmet_quest',
			title: 'Шлем',
			tasks: [
				{ id: 't1', text: 'Экипировать шлем', required: true, completed: false },
				{ id: 't2', text: 'Осмотреть корпус', required: false, completed: false }
			],
			storyEntries: ['Коллега отдал старый шлем.']
		})

		expect(quest.tasks.length).toBe(2)
		expect(quest.tasks[0].completed).toBe(false)
		expect(quest.storyEntries.length).toBe(1)

		// Complete task t1
		completeTask('helmet_quest', 't1')
		expect(quest.tasks[0].completed).toBe(true)
		expect(quest.tasks[1].completed).toBe(false)

		// Add story entry
		addQuestStoryEntry('helmet_quest', 'Подключение прошло успешно.')
		expect(quest.storyEntries.length).toBe(2)
		expect(quest.storyEntries[1]).toBe('Подключение прошло успешно.')

		// Save and restore
		const state = getQuestsState()
		resetQuests()
		loadQuestsState(state)

		const restored = quests.value.find((q) => q.id === 'helmet_quest')
		expect(restored).toBeDefined()
		expect(restored.tasks[0].completed).toBe(true)
		expect(restored.storyEntries.length).toBe(2)
	})
})
