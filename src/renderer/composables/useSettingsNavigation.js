import { ref } from 'vue'

export function useSettingsNavigation(navigateImmediateFn, dynamicContentAreaRef) {
	const showLeaveConfirm = ref(false)
	const pendingView = ref(null)
	const isSettingsDirty = ref(false)

	const handleNavigation = (view, currentView) => {
		// If we are leaving settings with unsaved changes, ask user first
		if (currentView === 'settings' && view !== 'settings' && isSettingsDirty.value) {
			pendingView.value = view
			showLeaveConfirm.value = true
			return
		}
		navigateImmediateFn(view)
	}

	function onSettingsSaved() {
		console.log('Settings saved')
		isSettingsDirty.value = false
	}

	function onSettingsReset() {
		console.log('Settings reset to default')
		isSettingsDirty.value = false
	}

	function onSettingsDirtyChange(val) {
		isSettingsDirty.value = val
	}

	async function handleLeaveYes() {
		showLeaveConfirm.value = false
		if (dynamicContentAreaRef.value?.saveSettingsFromOutside) {
			await dynamicContentAreaRef.value.saveSettingsFromOutside()
			isSettingsDirty.value = false
		}
		if (pendingView.value) {
			navigateImmediateFn(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveNo() {
		showLeaveConfirm.value = false
		// Revert settings in UI to last saved snapshot
		if (dynamicContentAreaRef.value?.revertSettingsFromOutside) {
			dynamicContentAreaRef.value.revertSettingsFromOutside()
		}
		isSettingsDirty.value = false
		if (pendingView.value) {
			navigateImmediateFn(pendingView.value)
			pendingView.value = null
		}
	}

	function handleLeaveCancel() {
		showLeaveConfirm.value = false
		pendingView.value = null
	}

	return {
		showLeaveConfirm,
		pendingView,
		isSettingsDirty,
		handleNavigation,
		onSettingsSaved,
		onSettingsReset,
		onSettingsDirtyChange,
		handleLeaveYes,
		handleLeaveNo,
		handleLeaveCancel
	}
}
