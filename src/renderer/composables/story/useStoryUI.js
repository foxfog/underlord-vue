import { ref, computed, watch } from 'vue'
import { DIALOGUE_HIDE_UI_CONFIG } from '../../constants/dialogue'

export function useStoryUI({ emit, isDialogueActive, globalData } = {}) {
	const baseUiVisibility = ref({
		all: false,
		'stats-button': false,
		'inventory-button': false,
		'map-button': false,
		'journal-button': false,
		'next-time-button': false,
		'date-badge': true,
		'calendar-button': true,
		topbar: false,
		hotbar: false,
		dialogue: false,
		dialogueHideUI: DIALOGUE_HIDE_UI_CONFIG
	})

	const isUiHidden = ref(false)

	function toggleHideUi() {
		isUiHidden.value = !isUiHidden.value
		console.log(`👁️ [UI Toggle] isUiHidden: ${isUiHidden.value}`)
		if (emit) {
			emit('ui-visibility-changed', uiVisibility.value)
		}
		return isUiHidden.value
	}

	function hideUi() {
		if (!isUiHidden.value) {
			isUiHidden.value = true
			console.log(`👁️ [UI Toggle] UI hidden`)
			if (emit) {
				emit('ui-visibility-changed', uiVisibility.value)
			}
		}
	}

	function unhideUi() {
		if (isUiHidden.value) {
			isUiHidden.value = false
			console.log(`👁️ [UI Toggle] UI unhidden`)
			if (emit) {
				emit('ui-visibility-changed', uiVisibility.value)
			}
		}
	}

	const uiVisibility = computed(() => {
		const base = baseUiVisibility.value
		const hideList = base.dialogueHideUI || DIALOGUE_HIDE_UI_CONFIG || []
		const inDialogue =
			typeof isDialogueActive === 'function'
				? isDialogueActive()
				: isDialogueActive?.value ?? false

		if (isUiHidden.value) {
			return {
				all: false,
				'stats-button': false,
				'inventory-button': false,
				'map-button': false,
				'journal-button': false,
				'next-time-button': false,
				'date-badge': false,
				'calendar-button': false,
				topbar: false,
				hotbar: false,
				dialogue: false,
				dialogueHideUI: hideList,
				hasDialogue: inDialogue,
				isUiHidden: true
			}
		}

		function isTargetHiddenByDialogue(target) {
			if (!inDialogue) return false
			return hideList.includes('all') || hideList.includes(target)
		}

		const statsButton = isTargetHiddenByDialogue('stats-button')
			? false
			: !!(base.all || base['stats-button'])
		const inventoryButton = isTargetHiddenByDialogue('inventory-button')
			? false
			: !!(base.all || base['inventory-button'])
		const mapButton = isTargetHiddenByDialogue('map-button')
			? false
			: !!(base.all || base['map-button'])
		const journalButton = isTargetHiddenByDialogue('journal-button')
			? false
			: !!(base.all || base['journal-button'])
		const nextTimeButton = isTargetHiddenByDialogue('next-time-button')
			? false
			: !!(base.all || base['next-time-button'])
		const dateBadge =
			isTargetHiddenByDialogue('date-badge') || isTargetHiddenByDialogue('calendar-button')
				? false
				: base['date-badge'] !== undefined
					? !!base['date-badge']
					: base['calendar-button'] !== undefined
						? !!base['calendar-button']
						: true
		const hotbar = isTargetHiddenByDialogue('hotbar') ? false : !!(base.all || base.hotbar)
		const topbar = isTargetHiddenByDialogue('topbar')
			? false
			: inventoryButton || mapButton || journalButton || nextTimeButton || !!base.topbar
		const dialogue = isTargetHiddenByDialogue('dialogue') ? false : base.dialogue !== false

		return {
			all: !!base.all,
			'stats-button': statsButton,
			'inventory-button': inventoryButton,
			'map-button': mapButton,
			'journal-button': journalButton,
			'next-time-button': nextTimeButton,
			'date-badge': dateBadge,
			'calendar-button': dateBadge,
			topbar,
			hotbar,
			dialogue,
			dialogueHideUI: hideList,
			hasDialogue: inDialogue,
			isUiHidden: false
		}
	})

	watch(
		uiVisibility,
		(newVal) => {
			if (newVal && emit) {
				emit('ui-visibility-changed', { ...newVal })
			}
		},
		{ immediate: true, deep: true }
	)

	function handleUIStep(step) {
		const action = step.action // 'show' or 'hide'
		const targets = step.target || [] // Array of target IDs
		const show = action === 'show'
		const knownTargets = [
			'topbar',
			'hotbar',
			'dialogue',
			'stats-button',
			'inventory-button',
			'map-button',
			'journal-button',
			'next-time-button',
			'date-badge',
			'calendar-button'
		]

		function setAllUi(value) {
			baseUiVisibility.value.all = value
			knownTargets.forEach((target) => {
				baseUiVisibility.value[target] = value
			})
		}

		// If target is not specified or empty, apply to all UI
		if (!targets || targets.length === 0) {
			console.log(`UI ${action}: all elements`)
			setAllUi(show)
			return
		}

		// Apply action to specified targets
		targets.forEach((target) => {
			console.log(`UI ${action}: ${target}`)
			if (target === 'all') {
				setAllUi(show)
			} else {
				if (!knownTargets.includes(target)) {
					console.warn(`UI target not recognized: ${target}`)
					return
				}
				if (!show && baseUiVisibility.value.all) {
					baseUiVisibility.value.all = false
					knownTargets.forEach((k) => {
						baseUiVisibility.value[k] = true
					})
				}
				if (target === 'calendar-button' || target === 'date-badge') {
					baseUiVisibility.value['date-badge'] = show
					baseUiVisibility.value['calendar-button'] = show
					return
				}
				if (target === 'topbar' && !show) {
					baseUiVisibility.value.topbar = false
					baseUiVisibility.value['stats-button'] = false
					baseUiVisibility.value['inventory-button'] = false
					baseUiVisibility.value['map-button'] = false
					baseUiVisibility.value['journal-button'] = false
					baseUiVisibility.value['next-time-button'] = false
					baseUiVisibility.value['date-badge'] = false
					baseUiVisibility.value['calendar-button'] = false
					return
				}
				if (target === 'topbar' && show) {
					baseUiVisibility.value.topbar = true
					const calendarType = globalData?.value?.calendarType ?? globalData?.calendarType
					if (calendarType !== 'new_world') {
						baseUiVisibility.value['date-badge'] = true
						baseUiVisibility.value['calendar-button'] = true
					}
					return
				}
				baseUiVisibility.value[target] = show
				if (
					show &&
					[
						'stats-button',
						'inventory-button',
						'map-button',
						'journal-button',
						'date-badge',
						'calendar-button'
					].includes(target)
				) {
					baseUiVisibility.value.topbar = true
				}
			}
		})
	}

	function setDialogueHideUI(targets) {
		baseUiVisibility.value.dialogueHideUI = Array.isArray(targets) ? targets : []
		console.log(`📌 Dialogue hide UI configured:`, baseUiVisibility.value.dialogueHideUI)
	}

	return {
		baseUiVisibility,
		isUiHidden,
		toggleHideUi,
		hideUi,
		unhideUi,
		uiVisibility,
		handleUIStep,
		setDialogueHideUI
	}
}
