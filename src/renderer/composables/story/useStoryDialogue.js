import { ref } from 'vue'

export function useStoryDialogue() {
	const currentDialogue = ref('')
	const currentNarration = ref('')
	const currentTitle = ref('')
	const currentTitleEffects = ref(null) // { effectStart, effect, effectEnd }
	const currentSpeaker = ref('')
	const currentChoices = ref([])
	const currentChoicesLayout = ref('center') // 'center' (default) | 'dialogue'
	const multiStepDialogueBuffer = ref('') // Buffer for accumulating multi-step dialogue text
	const multiStepPrintedLength = ref(0) // Track how many characters have been printed via typewriter

	function clearDialogue() {
		currentDialogue.value = ''
		currentNarration.value = ''
		currentSpeaker.value = ''
		currentChoices.value = []
	}

	function resetDialogueState() {
		clearDialogue()
		currentTitle.value = ''
		currentTitleEffects.value = null
		currentChoicesLayout.value = 'center'
		multiStepDialogueBuffer.value = ''
		multiStepPrintedLength.value = 0
	}

	return {
		currentDialogue,
		currentNarration,
		currentTitle,
		currentTitleEffects,
		currentSpeaker,
		currentChoices,
		currentChoicesLayout,
		multiStepDialogueBuffer,
		multiStepPrintedLength,
		clearDialogue,
		resetDialogueState
	}
}
