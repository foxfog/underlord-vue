// src/renderer/composables/useNpcSchedule.js

import { ref, computed } from 'vue'
import { evaluateExpression } from '../utils/expressionEvaluator'
import { normalizeTimeOfDay, getCalendarInfo } from '../utils/timeCalendar'
import { DAYS_OF_WEEK, NEW_WORLD_MONTHS, REAL_MONTHS } from '../constants/calendar'
import { useQuests } from './useQuests'

// Singleton reactive state shared across components
const schedules = ref({})
const npcStates = ref({})
const scenesCache = ref({})

export function useNpcSchedule() {
	function loadSchedules(data) {
		if (!data) return
		if (data.characters) {
			schedules.value = { ...data.characters }
		} else if (typeof data === 'object') {
			schedules.value = { ...data }
		}
		console.log(`📅 [useNpcSchedule] Loaded schedules for ${Object.keys(schedules.value).length} characters`)
	}

	function loadScenes(scenes) {
		if (!scenes) return
		if (Array.isArray(scenes)) {
			scenes.forEach((s) => {
				if (s?.id) scenesCache.value[s.id] = s
			})
		} else if (typeof scenes === 'object') {
			Object.assign(scenesCache.value, scenes)
		}
	}

	function getNpcState(characterId) {
		if (!characterId) return null
		if (!npcStates.value[characterId]) {
			const defaultKnown = schedules.value[characterId]?.locationKnown ?? false
			npcStates.value[characterId] = {
				state: 'default',
				overrideScene: null,
				overridePosition: null,
				overrideOrientation: null,
				overrideScale: null,
				overrideCustomClass: null,
				locationKnown: defaultKnown
			}
		}
		return npcStates.value[characterId]
	}

	function setNpcState(characterId, state) {
		if (!characterId) return
		const current = getNpcState(characterId)
		current.state = state || 'default'
		console.log(`👤 [NPC State] ${characterId} state set to "${current.state}"`)
	}

	function overrideNpcLocation(characterId, { scene, position, orientation, scale, customClass } = {}) {
		if (!characterId) return
		const current = getNpcState(characterId)
		current.overrideScene = scene !== undefined ? scene : null
		if (position !== undefined) current.overridePosition = position
		if (orientation !== undefined) current.overrideOrientation = orientation
		if (scale !== undefined) current.overrideScale = scale
		if (customClass !== undefined) current.overrideCustomClass = customClass
		console.log(`📍 [NPC Override] ${characterId} override set to scene "${scene}"`)
	}

	function clearNpcOverride(characterId) {
		if (!characterId) return
		const current = getNpcState(characterId)
		current.overrideScene = null
		current.overridePosition = null
		current.overrideOrientation = null
		current.overrideScale = null
		current.overrideCustomClass = null
		console.log(`🧹 [NPC Override] ${characterId} override cleared, returning to schedule`)
	}

	function setNpcLocationKnown(characterId, isKnown = true) {
		if (!characterId) return
		const current = getNpcState(characterId)
		current.locationKnown = Boolean(isKnown)
	}

	function isNpcLocationKnown(characterId) {
		if (!characterId) return false
		const state = npcStates.value[characterId]
		if (state && state.locationKnown !== undefined && state.locationKnown !== null) {
			return Boolean(state.locationKnown)
		}
		return Boolean(schedules.value[characterId]?.locationKnown)
	}

	function checkConditions(conditions, context = {}) {
		if (!conditions || typeof conditions !== 'object' || Object.keys(conditions).length === 0) {
			return true
		}

		const globalData = context.globalData || {}
		const characterData = context.characterData || {}

		// 1. Time of Day (timePhase)
		if (conditions.timePhase !== undefined) {
			const currentTimePhase = normalizeTimeOfDay(globalData.timeOfDay) || globalData.timeOfDay || 'day'
			const allowedPhases = Array.isArray(conditions.timePhase)
				? conditions.timePhase.map((p) => normalizeTimeOfDay(p) || p)
				: [normalizeTimeOfDay(conditions.timePhase) || conditions.timePhase]
			if (!allowedPhases.includes(currentTimePhase)) {
				return false
			}
		}

		// 2. Season
		if (conditions.season !== undefined) {
			const currentSeason = globalData.season || 'spring'
			const allowedSeasons = Array.isArray(conditions.season) ? conditions.season : [conditions.season]
			if (!allowedSeasons.includes(currentSeason)) {
				return false
			}
		}

		// 3. Hour / Hours
		if (conditions.hour !== undefined || conditions.hours !== undefined) {
			const hourCond = conditions.hour !== undefined ? conditions.hour : conditions.hours
			let currentHour = 12
			if (globalData.time && typeof globalData.time === 'string') {
				const [h] = globalData.time.split(':')
				currentHour = parseInt(h, 10) || 0
			}
			if (typeof hourCond === 'number' && currentHour !== hourCond) {
				return false
			}
			if (typeof hourCond === 'object') {
				if (hourCond.min !== undefined && currentHour < hourCond.min) return false
				if (hourCond.max !== undefined && currentHour > hourCond.max) return false
			}
		}

		// 4. NPC Custom State
		if (conditions.state !== undefined && context.characterId) {
			const currentState = getNpcState(context.characterId).state || 'default'
			const allowedStates = Array.isArray(conditions.state) ? conditions.state : [conditions.state]
			if (!allowedStates.includes(currentState)) {
				return false
			}
		}

		// 5. Quest condition
		if (conditions.quest !== undefined) {
			const questCond = conditions.quest
			const questsManager = context.questsManager || useQuests()
			if (typeof questCond === 'string') {
				// Shorthand: quest must be active
				const q = questsManager.getQuest ? questsManager.getQuest(questCond) : null
				if (!q || q.status !== 'active') return false
			} else if (typeof questCond === 'object' && questCond.id) {
				const q = questsManager.getQuest ? questsManager.getQuest(questCond.id) : null
				if (questCond.status) {
					if (questCond.status === 'not_started') {
						if (q) return false
					} else {
						if (!q || q.status !== questCond.status) return false
					}
				}
				if (questCond.task) {
					const task = q?.tasks?.find((t) => t.id === questCond.task)
					if (!task || !task.completed) return false
				}
			}
		}

		// 6. Variable expression
		if (conditions.variable !== undefined) {
			try {
				const expr = String(conditions.variable)
				const result = evaluateExpression(expr, {
					global: globalData,
					character: characterData
				})
				if (!result) return false
			} catch (e) {
				console.warn('Error evaluating NPC schedule variable condition:', conditions.variable, e)
				return false
			}
		}

		// 7. Day of week (dayOfWeek)
		// Accepts: number 1–7, array of numbers, or string names (en/ru, full/short)
		// 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
		if (conditions.dayOfWeek !== undefined) {
			const calInfo = getCalendarInfo(globalData)
			const currentDow = calInfo.dayOfWeek // 1–7

			const normalizeDow = (val) => {
				if (typeof val === 'number') return val
				if (typeof val === 'string') {
					const lower = val.toLowerCase().trim()
					const found = DAYS_OF_WEEK.find(
						(d) =>
							d.nameEn.toLowerCase() === lower ||
							d.shortEn.toLowerCase() === lower ||
							d.nameRu.toLowerCase() === lower ||
							d.shortRu.toLowerCase() === lower
					)
					return found ? found.id : null
				}
				return null
			}

			const allowedDows = (Array.isArray(conditions.dayOfWeek) ? conditions.dayOfWeek : [conditions.dayOfWeek])
				.map(normalizeDow)
				.filter((v) => v !== null)

			if (allowedDows.length > 0 && !allowedDows.includes(currentDow)) {
				return false
			}
		}

		// 8. Day of month (dayOfMonth)
		// Accepts: number, array of numbers, or range object { min, max }
		if (conditions.dayOfMonth !== undefined) {
			const calInfo = getCalendarInfo(globalData)
			const currentDom = calInfo.dayOfMonth // 1–30 (NW) or 1–31 (real)
			const domCond = conditions.dayOfMonth

			if (Array.isArray(domCond)) {
				if (!domCond.includes(currentDom)) return false
			} else if (typeof domCond === 'number') {
				if (currentDom !== domCond) return false
			} else if (typeof domCond === 'object') {
				if (domCond.min !== undefined && currentDom < domCond.min) return false
				if (domCond.max !== undefined && currentDom > domCond.max) return false
			}
		}

		// 9. Month (month)
		// Accepts: number 1–12, array of numbers, or string month names (ru/en, full)
		if (conditions.month !== undefined) {
			const calInfo = getCalendarInfo(globalData)
			const currentMonth = calInfo.month // 1–12

			const allMonths = calInfo.calendarType === 'new_world' ? NEW_WORLD_MONTHS : REAL_MONTHS

			const normalizeMonth = (val) => {
				if (typeof val === 'number') return val
				if (typeof val === 'string') {
					const lower = val.toLowerCase().trim()
					const found = allMonths.find(
						(m) =>
							m.nameRu?.toLowerCase() === lower ||
							m.nameEn?.toLowerCase() === lower
					)
					if (found) return found.id
					const n = parseInt(val, 10)
					return isNaN(n) ? null : n
				}
				return null
			}

			const allowedMonths = (Array.isArray(conditions.month) ? conditions.month : [conditions.month])
				.map(normalizeMonth)
				.filter((v) => v !== null)

			if (allowedMonths.length > 0 && !allowedMonths.includes(currentMonth)) {
				return false
			}
		}



		return true
	}

	function resolveNpcLocation(characterId, context = {}) {
		if (!characterId) return null

		const state = getNpcState(characterId)

		// 1. Manual override has highest priority
		if (state.overrideScene !== null) {
			if (
				state.overrideScene === 'none' ||
				state.overrideScene === false ||
				state.overrideScene === ''
			) {
				return null // Explicitly off-screen
			}
			return {
				characterId,
				sceneId: state.overrideScene,
				position: state.overridePosition || { r: 15, l: 'auto', b: 0 },
				orientation: state.overrideOrientation || 'right',
				scale: state.overrideScale ?? 1,
				customClass: state.overrideCustomClass || null,
				isOverride: true
			}
		}

		// 2. Evaluate schedule rules
		const charConfig = schedules.value[characterId]
		if (!charConfig) return null

		const rules = charConfig.schedules || []
		const evalContext = { ...context, characterId }

		for (const rule of rules) {
			if (checkConditions(rule.conditions, evalContext)) {
				return {
					characterId,
					sceneId: rule.targetScene || rule.sceneId,
					position: rule.position || { r: 15, l: 'auto', b: 0 },
					orientation: rule.orientation || 'right',
					scale: rule.scale ?? 1,
					customClass: rule.customClass || null,
					interaction: rule.interaction || null,
					locationName: rule.locationName || charConfig.locationName || null,
					ruleId: rule.id
				}
			}
		}

		// 3. Fallback default location if defined and no conditions blocked it
		if (charConfig.defaultLocation) {
			return {
				characterId,
				sceneId: charConfig.defaultLocation,
				position: charConfig.defaultPosition || { r: 15, l: 'auto', b: 0 },
				orientation: charConfig.defaultOrientation || 'right',
				scale: charConfig.defaultScale ?? 1,
				interaction: charConfig.defaultInteraction || null,
				locationName: charConfig.locationName || null,
				isDefault: true
			}
		}

		// 4. By default character is nowhere
		return null
	}

	function getNpcsForScene(sceneId, context = {}) {
		if (!sceneId) return []

		const result = []
		const allCharIds = new Set([
			...Object.keys(schedules.value),
			...Object.keys(npcStates.value)
		])

		for (const charId of allCharIds) {
			const loc = resolveNpcLocation(charId, context)
			if (loc && loc.sceneId === sceneId) {
				result.push(loc)
			}
		}

		return result
	}

	function populateSceneCharacters(sceneId, context = {}, visibleCharactersRef, characterDataRef) {
		if (!sceneId || !visibleCharactersRef || !characterDataRef) return []

		const npcs = getNpcsForScene(sceneId, context)
		const addedCharacters = []

		for (const npc of npcs) {
			const charData = characterDataRef.value[npc.characterId]
			if (charData) {
				const charInstance = { ...charData }
				charInstance.position = npc.position
				charInstance.orientation = npc.orientation
				charInstance.scale = npc.scale
				if (npc.customClass) charInstance.customClass = npc.customClass
				if (npc.interaction) charInstance.interaction = npc.interaction
				charInstance._isScheduledNpc = true

				const existingIdx = visibleCharactersRef.value.findIndex(
					(c) => c.id === npc.characterId
				)
				if (existingIdx !== -1) {
					visibleCharactersRef.value[existingIdx] = charInstance
				} else {
					visibleCharactersRef.value.push(charInstance)
				}

				// Player visited scene -> automatically discover location in journal
				setNpcLocationKnown(npc.characterId, true)
				addedCharacters.push(charInstance)
			}
		}

		return addedCharacters
	}

	function refreshSceneNpcs(sceneId, context = {}, visibleCharactersRef, characterDataRef) {
		if (!sceneId || !visibleCharactersRef || !characterDataRef) return

		const scheduledNpcs = getNpcsForScene(sceneId, context)
		const scheduledCharIds = new Set(scheduledNpcs.map((n) => n.characterId))

		// 1. Remove scheduled NPCs that should no longer be here
		visibleCharactersRef.value = visibleCharactersRef.value.filter((c) => {
			if (c._isScheduledNpc) {
				return scheduledCharIds.has(c.id)
			}
			return true // Keep non-scheduled/scripted characters intact
		})

		// 2. Add or update scheduled NPCs for the scene
		for (const npc of scheduledNpcs) {
			const charData = characterDataRef.value[npc.characterId]
			if (charData) {
				const charInstance = { ...charData }
				charInstance.position = npc.position
				charInstance.orientation = npc.orientation
				charInstance.scale = npc.scale
				if (npc.customClass) charInstance.customClass = npc.customClass
				if (npc.interaction) charInstance.interaction = npc.interaction
				charInstance._isScheduledNpc = true

				const existingIdx = visibleCharactersRef.value.findIndex(
					(c) => c.id === npc.characterId
				)
				if (existingIdx !== -1) {
					visibleCharactersRef.value[existingIdx] = charInstance
				} else {
					visibleCharactersRef.value.push(charInstance)
				}

				setNpcLocationKnown(npc.characterId, true)
			}
		}
	}

	function getNpcLocationDisplay(characterId, context = {}, sceneData = {}) {
		if (!characterId) return 'Неизвестно'

		if (!isNpcLocationKnown(characterId)) {
			return 'Неизвестно'
		}

		const loc = resolveNpcLocation(characterId, context)
		if (!loc || !loc.sceneId) {
			return 'Неизвестно'
		}

		const scene = sceneData[loc.sceneId] || scenesCache.value[loc.sceneId]
		if (scene) {
			const sceneName = loc.locationName || scene.name || loc.sceneId
			const mapKey = scene.localMap || scene.worldMap
			const mapNames = {
				carne: 'Деревня Карн',
				newworld: 'Новый Мир',
				cybercity: 'Кибергород'
			}
			const mapTitle = mapNames[mapKey] || mapKey
			return mapTitle && mapTitle !== sceneName ? `${sceneName} (${mapTitle})` : sceneName
		}

		return loc.locationName || loc.sceneId
	}

	function getState() {
		const stateCopy = {}
		for (const [key, val] of Object.entries(npcStates.value)) {
			stateCopy[key] = { ...val }
		}
		return stateCopy
	}

	function loadState(savedState) {
		if (savedState && typeof savedState === 'object') {
			npcStates.value = {}
			for (const [key, val] of Object.entries(savedState)) {
				npcStates.value[key] = { ...val }
			}
		}
	}

	function resetState() {
		npcStates.value = {}
	}

	return {
		schedules: computed(() => schedules.value),
		npcStates: computed(() => npcStates.value),
		loadSchedules,
		loadScenes,
		getNpcState,
		setNpcState,
		overrideNpcLocation,
		clearNpcOverride,
		setNpcLocationKnown,
		isNpcLocationKnown,
		checkConditions,
		resolveNpcLocation,
		getNpcsForScene,
		populateSceneCharacters,
		refreshSceneNpcs,
		getNpcLocationDisplay,
		getState,
		loadState,
		resetState
	}
}
