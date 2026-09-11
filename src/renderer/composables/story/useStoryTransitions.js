import { ref } from 'vue'

export function useStoryTransitions({
	settingsStore,
	isRestoringGameState,
	playSound,
	flushPendingAudio,
	advanceStep,
	setAdvanceOverride,
	clearAdvanceOverride
} = {}) {
	const fadeOverlay = ref({
		visible: false,
		opacity: 0,
		duration: 1.5,
		color: '#000000'
	})
	let fadeTimeout = null
	let fadeAnimationTimeout = null

	function clearFadeTimeouts() {
		if (fadeTimeout) {
			clearTimeout(fadeTimeout)
			fadeTimeout = null
		}
		if (fadeAnimationTimeout) {
			clearTimeout(fadeAnimationTimeout)
			fadeAnimationTimeout = null
		}
	}

	function isSceneTransitionsEnabled() {
		try {
			return settingsStore?.general?.sceneTransitions !== false
		} catch (_) {
			return true
		}
	}

	function handleFadeStep(step) {
		const restoring =
			typeof isRestoringGameState === 'function'
				? isRestoringGameState()
				: (isRestoringGameState?.value ?? false)
		if (restoring) {
			clearFadeTimeouts()
			fadeOverlay.value.visible = false
			fadeOverlay.value.opacity = 0
			if (advanceStep) advanceStep()
			return
		}

		clearFadeTimeouts()

		const action = step.action || (step.type === 'fade-out' ? 'out' : 'in')
		const parsedDuration =
			typeof step.duration === 'number' ? step.duration : parseFloat(step.duration)
		const duration =
			!isNaN(parsedDuration) && parsedDuration >= 0 ? parsedDuration : 1.5
		const color = step.color || '#000000'
		const wait = step.wait !== false
		const parsedHold =
			typeof step.hold === 'number'
				? step.hold
				: parseFloat(step.hold || step.delay)
		const hold = !isNaN(parsedHold) && parsedHold > 0 ? parsedHold : 0

		// Optional sound trigger on fade start
		if (step.sound && !restoring && playSound) {
			playSound(
				typeof step.sound === 'string' ? { file: step.sound, loop: false } : step.sound
			)
		}

		if (action === 'in') {
			// Fade in: start solid, hold if specified, then animate to 0
			fadeOverlay.value = {
				visible: true,
				opacity: 1,
				duration: 0,
				color
			}

			const startFadeAnimation = () => {
				fadeOverlay.value = {
					visible: true,
					opacity: 0,
					duration,
					color
				}
				if (step.fadeSound && !restoring && playSound) {
					playSound(
						typeof step.fadeSound === 'string'
							? { file: step.fadeSound, loop: false }
							: step.fadeSound
					)
				}
			}

			if (hold > 0) {
				fadeAnimationTimeout = setTimeout(startFadeAnimation, hold * 1000)
			} else {
				fadeAnimationTimeout = setTimeout(startFadeAnimation, 30)
			}

			const totalTime = (hold + duration) * 1000 + 40

			if (wait) {
				fadeTimeout = setTimeout(() => {
					fadeOverlay.value.visible = false
					fadeTimeout = null
					fadeAnimationTimeout = null
					if (clearAdvanceOverride) clearAdvanceOverride()
					if (advanceStep) advanceStep()
				}, totalTime)

				if (setAdvanceOverride) {
					setAdvanceOverride(() => {
						clearFadeTimeouts()
						if (flushPendingAudio) flushPendingAudio()
						fadeOverlay.value.visible = false
						fadeOverlay.value.opacity = 0
						if (clearAdvanceOverride) clearAdvanceOverride()
						if (advanceStep) advanceStep()
					})
				}
			} else {
				fadeTimeout = setTimeout(() => {
					fadeOverlay.value.visible = false
					fadeTimeout = null
					fadeAnimationTimeout = null
				}, totalTime)
				if (advanceStep) advanceStep()
			}
		} else {
			// Fade out: start transparent, animate to solid, then hold if specified
			fadeOverlay.value = {
				visible: true,
				opacity: 0,
				duration: 0,
				color
			}

			fadeAnimationTimeout = setTimeout(() => {
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration,
					color
				}
			}, 30)

			const totalTime = (duration + hold) * 1000 + 40

			if (wait) {
				fadeTimeout = setTimeout(() => {
					fadeTimeout = null
					fadeAnimationTimeout = null
					if (clearAdvanceOverride) clearAdvanceOverride()
					if (advanceStep) advanceStep()
				}, totalTime)

				if (setAdvanceOverride) {
					setAdvanceOverride(() => {
						clearFadeTimeouts()
						if (flushPendingAudio) flushPendingAudio()
						fadeOverlay.value.opacity = 1
						if (clearAdvanceOverride) clearAdvanceOverride()
						if (advanceStep) advanceStep()
					})
				}
			} else {
				if (advanceStep) advanceStep()
			}
		}
	}

	function performSceneTransition(
		onSceneChange,
		onComplete = null,
		duration = 0.35,
		color = '#000000'
	) {
		clearFadeTimeouts()

		return new Promise((resolve) => {
			let isFinished = false

			const finish = () => {
				if (isFinished) return
				isFinished = true
				clearFadeTimeouts()
				if (clearAdvanceOverride) clearAdvanceOverride()
				fadeOverlay.value.visible = false
				fadeOverlay.value.opacity = 0
				if (onComplete) onComplete()
				resolve()
			}

			// 1. Fade Out: animate to solid color
			fadeOverlay.value = {
				visible: true,
				opacity: 0,
				duration: 0,
				color
			}

			setTimeout(() => {
				if (isFinished) return
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration,
					color
				}
			}, 20)

			if (setAdvanceOverride) setAdvanceOverride(finish)

			fadeTimeout = setTimeout(() => {
				if (isFinished) return

				// 2. Change scene while screen is fully covered
				try {
					if (onSceneChange) onSceneChange()
				} catch (err) {
					console.error('Error during scene transition callback:', err)
				}

				// 3. Fade In: start solid, animate to transparent
				fadeOverlay.value = {
					visible: true,
					opacity: 1,
					duration: 0,
					color
				}

				setTimeout(() => {
					if (isFinished) return
					fadeOverlay.value = {
						visible: true,
						opacity: 0,
						duration,
						color
					}
				}, 20)

				fadeTimeout = setTimeout(() => {
					finish()
				}, duration * 1000 + 40)
			}, duration * 1000 + 30)
		})
	}

	return {
		fadeOverlay,
		clearFadeTimeouts,
		isSceneTransitionsEnabled,
		handleFadeStep,
		performSceneTransition
	}
}
