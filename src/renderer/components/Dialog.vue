<template>
  <div v-if="dialogStore.isDialogActive" class="dialog-overlay">
    <div class="dialog-box">
      <div class="dialog-header">
        <div class="speaker-name">{{ getCurrentSpeakerName }}</div>
      </div>
      <div class="dialog-content">
        <p class="dialog-text">{{ getCurrentDialogText }}</p>
      </div>
      <div v-if="dialogStore.getCurrentNode?.choices?.length > 0" class="dialog-choices">
        <button 
          v-for="choice in dialogStore.getCurrentNode.choices" 
          :key="choice.id"
          class="dialog-choice-button"
          @click="selectChoice(choice.id)"
        >
          {{ choice.text[$i18n.locale] || choice.text['en'] }}
        </button>
      </div>
      <div class="dialog-controls">
        <button 
          v-if="dialogStore.history.length > 0" 
          class="dialog-back-button"
          @click="goBack"
        >
          {{ $t('back') }}
        </button>
        <button 
          class="dialog-close-button"
          @click="closeDialog"
        >
          {{ $t('close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialogStore } from '@/stores/dialog'

const { t, locale } = useI18n()
const dialogStore = useDialogStore()

// Get current speaker name based on speaker ID
const getCurrentSpeakerName = computed(() => {
  const speaker = dialogStore.getCurrentNode?.speaker
  if (!speaker) return ''
  
  // Map speaker IDs to display names
  const speakerNames = {
    momonga: t('characters.momonga'),
    albedo: t('characters.albedo'),
    mc: t('characters.mc')
  }
  
  return speakerNames[speaker] || speaker
})

// Get current dialog text based on current locale
const getCurrentDialogText = computed(() => {
  const node = dialogStore.getCurrentNode
  if (!node) return ''
  
  return node.text[locale.value] || node.text['en'] || ''
})

// Handle choice selection
const selectChoice = (choiceId) => {
  dialogStore.makeChoice(choiceId)
}

// Go back in dialog history
const goBack = () => {
  dialogStore.goBack()
}

// Close the dialog
const closeDialog = () => {
  dialogStore.endDialog()
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 2000;
}

.dialog-box {
  width: 100%;
  max-width: 600px;
  background: linear-gradient(145deg, #2a2a3a, #1a1a2a);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  padding: 20px;
  margin: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
}

.dialog-header {
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.speaker-name {
  font-size: 1.4em;
  font-weight: bold;
  color: #ffcc00;
  text-shadow: 0 0 5px rgba(255, 204, 0, 0.5);
}

.dialog-content {
  margin-bottom: 20px;
  min-height: 80px;
}

.dialog-text {
  font-size: 1.1em;
  line-height: 1.5;
  color: #ffffff;
}

.dialog-choices {
  margin-bottom: 20px;
}

.dialog-choice-button {
  display: block;
  width: 100%;
  padding: 12px 15px;
  margin-bottom: 10px;
  background: rgba(50, 50, 70, 0.7);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-choice-button:hover {
  background: rgba(70, 70, 100, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
  transform: translateY(-2px);
}

.dialog-controls {
  display: flex;
  justify-content: space-between;
}

.dialog-back-button,
.dialog-close-button {
  padding: 8px 15px;
  background: rgba(40, 40, 60, 0.8);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.dialog-back-button:hover,
.dialog-close-button:hover {
  background: rgba(60, 60, 90, 0.9);
  border-color: rgba(255, 255, 255, 0.4);
}
</style>