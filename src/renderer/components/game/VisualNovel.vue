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

<style scoped>

.background-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: opacity 0.5s ease;
}

/* Centered title box shown during 'titles' steps (full-screen transparent overlay) */
.title-box {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  padding: 0;
  border-radius: 0;
  color: white;
  text-align: center;
  border: none;
  cursor: pointer;
  pointer-events: auto;
}

.title-content {
  font-size: 1.8em;
  line-height: 1.2;
  margin: 0;
  user-select: none;
}

.characters {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: auto;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  padding: 20px;
}

.dialogue-box {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 80%;
  max-width: 800px;
  background: rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 20px;
  color: white;
  border: 2px solid #444;
}

.speaker {
  font-weight: bold;
  color: #ffcc00;
  margin-bottom: 10px;
  font-size: 1.2em;
}

.text {
  margin-bottom: 10px;
  line-height: 1.4;
}

.narration-text {
  font-style: italic;
  color: #ccc;
  margin-bottom: 10px;
  line-height: 1.4;
}

.choices {
  margin-top: 15px;
}

.choice-btn {
  display: block;
  width: 100%;
  padding: 10px;
  margin: 5px 0;
  background: #444;
  color: white;
  border: 1px solid #666;
  border-radius: 5px;
  cursor: pointer;
}

.choice-btn:hover {
  background: #555;
}

.continue-btn {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  float: right;
}

.continue-btn:hover {
  background: #0056b3;
}
</style>
