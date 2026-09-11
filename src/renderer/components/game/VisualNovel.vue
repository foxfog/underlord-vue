<template>
	<StoryAudio :audio-streams="audioStreams" @stream-ended="onStreamEnded" />

	<Background
		:scene="currentScene"
		:global-data="globalData"
		:is-in-dialogue-mode="isDialogueActive || isUiHidden"
		@goto="goto"
		@hotspot-click="onHotspotClick"
	/>
	<CharacterList :characters="visibleCharacters" @character-click="$emit('character-click', $event)" />

	<TitleBlock
		v-if="!isUiHidden"
		:title="currentTitle"
		:effects="currentTitleEffects"
		:is-skipping="isSkipping"
		@advance="advanceStory"
	/>

	<DialogueBox
		:dialogue="currentDialogue"
		:narration="currentNarration"
		:speaker="currentSpeaker"
		:choices="currentChoices"
		:choices-layout="currentChoicesLayout"
		:multi-step-printed-length="multiStepPrintedLength"
		:is-ui-hidden="isUiHidden"
		:is-skipping="isSkipping"
		@advance="advanceStory"
		@selectChoice="selectChoice"
	/>

	<Notification v-show="!isUiHidden" ref="notificationComponent" />

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
import { onMounted, onUnmounted, ref } from 'vue'
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
	'ui-visibility-changed',
	'ready',
	'character-click'
])

const notificationComponent = ref(null)

const vn = useVisualNovel({ src: props.src, emit, notificationComponent })

const {
	currentScene,
	sceneData,
	visibleCharacters,
	currentDialogue,
	currentNarration,
	currentTitle,
	currentTitleEffects,
	currentSpeaker,
	currentChoices,
	currentChoicesLayout,
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
	fadeOverlay,
	isDialogueActive,
	handleHotspotClick,
	isUiHidden,
	toggleHideUi,
	hideUi,
	unhideUi,
	isSkipping,
	startFastForward,
	stopFastForward
} = vn

function onHotspotClick(payload) {
	if (!payload) return
	const sceneId = payload.sceneId || currentScene.value?.id
	handleHotspotClick(sceneId, payload.hotspot)
}

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
	emit('ready')
})

onUnmounted(() => {
	stopFastForward()
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
	currentScene,
	sceneData,
	visibleCharacters,
	rebuildEquipmentBySlot,
	syncCharacterEquipment,
	advanceTime,
	goto,
	showNotification,
	setDialogueHideUI,
	fadeOverlay,
	isUiHidden,
	toggleHideUi,
	hideUi,
	unhideUi,
	isSkipping,
	startFastForward,
	stopFastForward
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

