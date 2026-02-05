<template>
  <Background :scene="currentScene" />
  <CharacterList :characters="visibleCharacters" />

  <TitleBlock :title="currentTitle" @advance="advanceStory" />

  <DialogueBox
    :dialogue="currentDialogue"
    :narration="currentNarration"
    :speaker="currentSpeaker"
    :choices="currentChoices"
    @advance="advanceStory"
    @selectChoice="selectChoice"
  />

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
import { onMounted } from 'vue'
import TextInputModal from './TextInputModal.vue'
import Background from './visual-novel/Background.vue'
import CharacterList from './visual-novel/CharacterList.vue'
import TitleBlock from './visual-novel/TitleBlock.vue'
import DialogueBox from './visual-novel/DialogueBox.vue'
import { useVisualNovel } from '../../composables/useVisualNovel'
import { useSavesStore } from '../../stores/saves'

const props = defineProps({ src: { type: String, required: true } })
const emit = defineEmits(['end', 'character-loaded'])

const vn = useVisualNovel({ src: props.src, emit })

const {
  currentScene, visibleCharacters, currentDialogue, currentNarration, currentTitle,
  currentSpeaker, currentChoices, showTextInputModal, currentInputStep,
  loadStory, processStep, advanceStory, selectChoice, getInitialValue, onTextInputConfirm,
  getGameState, restoreGameState, resetGameState, getHistory, clearHistory
} = vn

onMounted(async () => {
  await loadStory()
  const savesStore = useSavesStore()
  if (!savesStore.getPendingLoad()) {
    processStep()
  }
})

defineExpose({ getGameState, restoreGameState, resetGameState, startStory: () => processStep(), getHistory: () => getHistory(), clearHistory: () => clearHistory() })

</script>

