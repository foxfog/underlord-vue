import { ref, computed } from 'vue'
import { eventBus } from '../utils/eventBus'

// Singleton reactive state shared across components
const quests = ref([])

export function useQuests(gameState = null) {
	const activeQuests = computed(() => quests.value.filter((q) => q.status === 'active'))
	const completedQuests = computed(() => quests.value.filter((q) => q.status === 'completed'))
	const failedQuests = computed(() => quests.value.filter((q) => q.status === 'failed'))
	const allQuests = computed(() => quests.value)

	// Direct root quests (no parent)
	const rootQuests = computed(() => quests.value.filter((q) => !q.parentId))

	// Recursive quest tree with arbitrary depth
	const questTree = computed(() => {
		const idMap = new Map()
		const roots = []

		// 1. Create nodes with cloned properties and empty children array
		quests.value.forEach((q) => {
			idMap.set(q.id, { ...q, children: [] })
		})

		// 2. Link child nodes to parents or root list
		idMap.forEach((node) => {
			if (node.parentId && idMap.has(node.parentId)) {
				idMap.get(node.parentId).children.push(node)
			} else {
				roots.push(node)
			}
		})

		return roots
	})

	function syncToGameState() {
		if (gameState && gameState.global) {
			gameState.global.quests = getQuestsState()
		}
	}

	function startQuest({
		id,
		parentId = null,
		title,
		description = '',
		category = 'main',
		target = null,
		tasks = [],
		storyEntries = []
	}) {
		if (!id) return null

		const existing = quests.value.find((q) => q.id === id)
		if (existing) {
			// Update parentId or description if newly provided
			if (parentId && !existing.parentId) existing.parentId = parentId
			if (description && !existing.description) existing.description = description
			if (tasks && tasks.length > 0 && (!existing.tasks || existing.tasks.length === 0)) {
				existing.tasks = tasks.map((t, idx) => ({
					id: t.id || `task_${idx}`,
					text: t.text || '',
					required: t.required !== false,
					completed: !!t.completed
				}))
			}
			if (storyEntries && storyEntries.length > 0) {
				existing.storyEntries = existing.storyEntries || []
				storyEntries.forEach((entry) => {
					if (!existing.storyEntries.includes(entry)) existing.storyEntries.push(entry)
				})
			}
			return existing
		}

		const formattedTasks = Array.isArray(tasks)
			? tasks.map((t, idx) => ({
					id: t.id || `task_${idx}`,
					text: t.text || '',
					required: t.required !== false,
					completed: !!t.completed
				}))
			: []

		const formattedStoryEntries = Array.isArray(storyEntries)
			? [...storyEntries]
			: storyEntries
				? [storyEntries]
				: []

		const newQuest = {
			id,
			parentId: parentId || null,
			title: title || id,
			description,
			category,
			target,
			status: 'active',
			tasks: formattedTasks,
			storyEntries: formattedStoryEntries,
			createdAt: Date.now(),
			completedAt: null,
			failedAt: null
		}

		quests.value.push(newQuest)
		syncToGameState()

		eventBus.emit('quest-started', newQuest)

		console.log(
			`📜 [Quest Started] ${newQuest.title} (${newQuest.id}${newQuest.parentId ? ` child of ${newQuest.parentId}` : ''})`
		)
		return newQuest
	}

	function completeQuest(id) {
		if (!id) return null

		const quest = quests.value.find((q) => q.id === id)
		if (quest && quest.status === 'active') {
			quest.status = 'completed'
			quest.completedAt = Date.now()
			syncToGameState()

			eventBus.emit('quest-completed', quest)

			console.log(`🏆 [Quest Completed] ${quest.title} (${quest.id})`)
			return quest
		}
		return null
	}

	function failQuest(id) {
		if (!id) return null

		const quest = quests.value.find((q) => q.id === id)
		if (quest && quest.status === 'active') {
			quest.status = 'failed'
			quest.failedAt = Date.now()
			syncToGameState()

			eventBus.emit('quest-failed', quest)

			console.log(`❌ [Quest Failed] ${quest.title} (${quest.id})`)
			return quest
		}
		return null
	}

	function getQuest(id) {
		return quests.value.find((q) => q.id === id) || null
	}

	function getChildren(parentId) {
		if (!parentId) return []
		return quests.value.filter((q) => q.parentId === parentId)
	}

	function getParent(questId) {
		const quest = getQuest(questId)
		if (!quest || !quest.parentId) return null
		return getQuest(quest.parentId)
	}

	function isQuestActive(id) {
		const quest = getQuest(id)
		return quest ? quest.status === 'active' : false
	}

	function isQuestCompleted(id) {
		const quest = getQuest(id)
		return quest ? quest.status === 'completed' : false
	}

	function isQuestFailed(id) {
		const quest = getQuest(id)
		return quest ? quest.status === 'failed' : false
	}

	function completeTask(questId, taskId) {
		return setTaskStatus(questId, taskId, true)
	}

	function setTaskStatus(questId, taskId, completed = true) {
		const quest = getQuest(questId)
		if (!quest || !Array.isArray(quest.tasks)) return null

		const task = quest.tasks.find((t) => t.id === taskId)
		if (task) {
			task.completed = !!completed
			syncToGameState()

			eventBus.emit('quest-task-updated', { questId, task })
			console.log(
				`🎯 [Quest Task Updated] ${quest.title}: ${task.text} -> ${task.completed ? 'COMPLETED' : 'INCOMPLETE'}`
			)
			return task
		}
		return null
	}

	function addQuestStoryEntry(questId, entryText) {
		if (!questId || !entryText) return null
		const quest = getQuest(questId)
		if (!quest) return null

		if (!Array.isArray(quest.storyEntries)) {
			quest.storyEntries = []
		}

		quest.storyEntries.push(entryText)
		syncToGameState()

		eventBus.emit('quest-story-updated', { questId, entry: entryText })
		console.log(`📖 [Quest Story Added] ${quest.title}: ${entryText}`)
		return quest
	}

	function getQuestsState() {
		return JSON.parse(JSON.stringify(quests.value))
	}

	function loadQuestsState(savedQuests) {
		if (Array.isArray(savedQuests)) {
			quests.value = savedQuests.map((q) => ({
				...q,
				tasks: q.tasks || [],
				storyEntries: q.storyEntries || []
			}))
			console.log(`📜 [Quests Restored] ${quests.value.length} quests loaded`)
		}
	}

	function resetQuests() {
		quests.value = []
		syncToGameState()
	}

	return {
		quests,
		activeQuests,
		completedQuests,
		failedQuests,
		allQuests,
		rootQuests,
		questTree,
		startQuest,
		completeQuest,
		failQuest,
		completeTask,
		setTaskStatus,
		addQuestStoryEntry,
		getQuest,
		getChildren,
		getParent,
		isQuestActive,
		isQuestCompleted,
		isQuestFailed,
		getQuestsState,
		loadQuestsState,
		resetQuests
	}
}
