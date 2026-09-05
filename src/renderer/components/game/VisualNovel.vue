<template>
	<StoryAudio :audio-streams="audioStreams" @stream-ended="onStreamEnded" />

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

	<!-- Fade Overlay for cinematic transitions -->
	<div
		v-if="fadeOverlay.visible"
		class="vn-fade-overlay"
		:style="{
			backgroundColor: fadeOverlay.color,
			opacity: fadeOverlay.opacity,
			transition: fadeOverlay.duration > 0 ? `opacity ${fadeOverlay.duration}s ease-in-out` : 'none'
		}"
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
import { useRegisterModal } from '../../composables/useModalStack'

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits([
	'end',
	'character-loaded',
	'global-data-changed',
	'ui-visibility-changed'
])

const notificationComponent = ref(null)

const vn = useVisualNovel({ src: props.src, emit, notificationComponent })

const {
	currentScene,
	visibleCharacters,
	currentDialogue,
	currentNarration,
	currentTitle,
	currentTitleEffects,
	currentSpeaker,
	currentChoices,
	multiStepPrintedLength,
	showTextInputModal,
	currentInputStep,
	uiVisibility,
	audioStreams,
	loadStory,
	processStep,
	advanceStory,
	selectChoice,
	getInitialValue,
	onTextInputConfirm,
	getGameState,
	restoreGameState,
	resetGameState,
	getHistory,
	clearHistory,
	pauseAllStreams,
	resumeAllStreams,
	onStreamEnded,
	goto, // ← Добавляем goto method для Rules Engine
	showNotification, // ← Добавляем showNotification для Rules Engine
	setDialogueHideUI, // ← Система скрытия UI при диалоге
	globalData,
	advanceTime,
	rebuildEquipmentBySlot,
	syncCharacterEquipment,
	fadeOverlay
} = vn

useRegisterModal('vn-text-input', showTextInputModal, () => {
	if (
		currentInputStep.value?.showCancelButton !== false ||
		currentInputStep.value?.showCloseButton !== false
	) {
		showTextInputModal.value = false
	}
})

onMounted(async () => {
	await loadStory()
	const savesStore = useSavesStore()
	if (!savesStore.getPendingLoad()) {
		processStep()
	}
})

defineExpose({
	getGameState,
	restoreGameState,
	resetGameState,
	startStory: () => processStep(),
	getHistory: () => getHistory(),
	clearHistory: () => clearHistory(),
	pauseAllStreams,
	resumeAllStreams,
	uiVisibility,
	globalData,
	visibleCharacters,
	rebuildEquipmentBySlot,
	syncCharacterEquipment,
	advanceTime,
	goto,
	showNotification,
	setDialogueHideUI,
	fadeOverlay
})
</script>

<style scoped>
.vn-fade-overlay {
	position: absolute;
	inset: 0;
	z-index: 500;
	pointer-events: none;
}
</style>

