<template>
	<StoryAudio :audio-streams="audioStreams" />
	
	<Background :scene="currentScene" />
	<CharacterList :characters="visibleCharacters" />

	<TitleBlock :title="currentTitle" :effects="currentTitleEffects" @advance="advanceStory" />

	<DialogueBox
		:dialogue="currentDialogue"
		:narration="currentNarration"
		:speaker="currentSpeaker"
		:choices="currentChoices"
		:multi-step-printed-length="multiStepPrintedLength"
		@advance="advanceStory"
		@selectChoice="selectChoice"
	/>

	<Notification ref="notificationComponent" />

	<TextInputModal
		:is-visible="showTextInputModal"
		:title="currentInputStep?.text || 'Введите значение'"
		:description="currentInputStep?.text || 'Пожалуйста, введите требуемое значение:'"
		:initial-value="getInitialValue(currentInputStep?.variable)"
		:show-close-button="currentInputStep?.showCloseButton !== false"
		:show-cancel-button="currentInputStep?.showCancelButton !== false"
		:confirm-button-text="currentInputStep?.confirmButtonText || 'Подтвердить'"
		@close="showTextInputModal = false"
		@confirm="onTextInputConfirm"
	/>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import TextInputModal from './modals/TextInputModal.vue'
import StoryAudio from './StoryAudio.vue'
import Background from './visual-novel/Background.vue'
import CharacterList from './visual-novel/CharacterList.vue'
import TitleBlock from './visual-novel/TitleBlock.vue'
import DialogueBox from './visual-novel/DialogueBox.vue'
import Notification from './visual-novel/Notification.vue'
import { useVisualNovel } from '../../composables/useVisualNovel'
import { useSavesStore } from '../../stores/saves'

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['end', 'character-loaded'])

const notificationComponent = ref(null)

const vn = useVisualNovel({ src: props.src, emit, notificationComponent })

const {
	currentScene, visibleCharacters, currentDialogue, currentNarration, currentTitle, currentTitleEffects,
	currentSpeaker, currentChoices, multiStepPrintedLength, showTextInputModal, currentInputStep, uiVisibility,
	audioStreams,
	loadStory, processStep, advanceStory, selectChoice, getInitialValue, onTextInputConfirm,
	getGameState, restoreGameState, resetGameState, getHistory, clearHistory,
	pauseAllStreams, resumeAllStreams
} = vn

onMounted(async () => {
	await loadStory()
	const savesStore = useSavesStore()
	if (!savesStore.getPendingLoad()) {
		processStep()
	}
})

defineExpose({ getGameState, restoreGameState, resetGameState, startStory: () => processStep(), getHistory: () => getHistory(), clearHistory: () => clearHistory(), pauseAllStreams, resumeAllStreams, uiVisibility })

</script>