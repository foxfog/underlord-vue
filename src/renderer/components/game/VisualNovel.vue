<template>
  <div class="visual-novel">
    <!-- Background Display -->
    <img v-if="currentScene" :src="currentScene.bg" alt="Background" class="background-img" />
    
    <!-- Character Sprites -->
    <div class="characters">
      <div 
        v-for="character in visibleCharacters" 
        :key="character.id"
        class="character"
        :class="`char-${character.id}`"
      >
        <img :src="character.sprites.body.image" alt="" class="sprite body" />
        <img v-if="character.sprites.head" :src="character.sprites.head.image" alt="" class="sprite head" />
      </div>
    </div>
    
    <!-- Dialogue Box -->
    <div class="dialogue-box" v-if="currentDialogue || currentNarration">
      <div class="speaker" v-if="currentSpeaker">{{ currentSpeaker }}</div>
      <div class="text" v-if="currentDialogue">{{ currentDialogue }}</div>
      <div class="narration" v-if="currentNarration">{{ currentNarration }}</div>
      
      <!-- Choices -->
      <div class="choices" v-if="currentChoices.length > 0">
        <button 
          v-for="(choice, index) in currentChoices" 
          :key="index"
          @click="selectChoice(index)"
          class="choice-btn"
        >
          {{ choice.text }}
        </button>
      </div>
      
      <!-- Continue Button -->
      <button 
        v-if="!currentChoices.length && (currentDialogue || currentNarration)" 
        @click="advanceStory" 
        class="continue-btn"
      >
        Продолжить
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Props
const props = defineProps({
  src: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['end'])

// State
const currentScene = ref(null)
const visibleCharacters = ref([])
const currentDialogue = ref('')
const currentNarration = ref('')
const currentSpeaker = ref('')
const currentChoices = ref([])
const storyData = ref(null)
const stepIndex = ref(0)
const characterData = ref({})
const sceneData = ref({})
let advanceStoryOverride = null

// Helper function to load data files from public directory
async function loadDataFromPublic(path) {
  console.log('Attempting to load data from path:', path); // Debug log
  // Convert .js path to .json path
  const jsonPath = path.replace(/\.js$/, '.json');
  console.log('Converted path to:', jsonPath); // Debug log
  
  try {
    // Try to load as JSON first
    const response = await fetch(jsonPath);
    console.log('Fetch response status:', response.status); // Debug log
    if (response.ok) {
      const data = await response.json();
      console.log('Successfully loaded data:', data); // Debug log
      return data;
    } else {
      throw new Error('JSON file not found');
    }
  } catch (jsonError) {
    console.error('Error in loadDataFromPublic:', jsonError); // Debug log
    // If JSON fails, try the original JS file but with a different approach
    // For now, we'll throw an error suggesting to convert the file to JSON
    console.error(`Could not load data from ${jsonPath}. Please ensure data files are in JSON format.`);
    throw new Error(`Data file not found as JSON: ${jsonPath}`);
  }
}

// Load story data
async function loadStory() {
  try {
    // Load story data
    const storyModule = await loadDataFromPublic(props.src);
    storyData.value = storyModule;
    
    // Load character data
    const mcModule = await loadDataFromPublic('/data/characters/mc.json');
    const albedoModule = await loadDataFromPublic('/data/characters/albedo.json');
    const momongaModule = await loadDataFromPublic('/data/characters/momonga.json');
    
    characterData.value[mcModule.id] = mcModule;
    characterData.value[albedoModule.id] = albedoModule;
    characterData.value[momongaModule.id] = momongaModule;
    
    // Load scene data
    const scenesModule = await loadDataFromPublic('/data/scenes/scenes.json');
    scenesModule.scenes.forEach(scene => {
      sceneData.value[scene.id] = scene;
    });
    
    // Start the story
    processStep();
  } catch (error) {
    console.error('Error loading story:', error);
  }
}

// Process current step
function processStep() {
  if (!storyData.value || stepIndex.value >= storyData.value.steps.length) {
    emit('end')
    return
  }
  
  const step = storyData.value.steps[stepIndex.value]
  console.log(`Processing step ${stepIndex.value} of type: ${step.type}`); // Debug log
  
  try {
    switch (step.type) {
      case 'scene':
        changeScene(step.id)
        stepIndex.value++
        processStep()
        break
      case 'show':
        showCharacter(step.character)
        stepIndex.value++
        processStep()
        break
      case 'hide':
        hideCharacter(step.character)
        stepIndex.value++
        processStep()
        break
      case 'dialogue':
        showDialogue(step.character, step.text)
        break
      case 'narration':
        showNarration(step.text)
        break
      case 'choice':
        showChoices(step)
        break
      case 'goto':
        goToLabel(step.target)
        break
      case 'end':
        emit('end')
        break
      default:
        stepIndex.value++
        processStep()
        break
    }
  } catch (error) {
    console.error('Error processing step:', error);
    console.error('Current step:', step);
    console.error('Step index:', stepIndex.value);
  }
}

// Change scene
function changeScene(sceneId) {
  currentScene.value = sceneData.value[sceneId]
}

// Show character
function showCharacter(characterId) {
  const character = characterData.value[characterId]
  if (character && !visibleCharacters.value.some(c => c.id === characterId)) {
    visibleCharacters.value.push(character)
  }
}

// Hide character
function hideCharacter(characterId) {
  visibleCharacters.value = visibleCharacters.value.filter(c => c.id !== characterId)
}

// Show dialogue
function showDialogue(characterId, text) {
  const character = characterData.value[characterId]
  currentSpeaker.value = character ? character.name : ''
  currentDialogue.value = text
}

// Show narration
function showNarration(text) {
  currentNarration.value = text
  currentSpeaker.value = ''
  currentDialogue.value = ''
}

// Show choices
function showChoices(choiceStep) {
  console.log('Showing choices:', choiceStep); // Debug log
  currentChoices.value = choiceStep.options
  currentSpeaker.value = choiceStep.speaker ? characterData.value[choiceStep.speaker]?.name : ''
  // Set the choice text as dialogue to ensure the dialogue box appears
  if (choiceStep.text) {
    currentDialogue.value = choiceStep.text
  }
  console.log('Current choices set to:', currentChoices.value); // Debug log
}

// Select a choice
function selectChoice(index) {
  console.log('Selected choice index:', index); // Debug log
  const choice = currentChoices.value[index]
  console.log('Selected choice:', choice); // Debug log
  if (choice.actions) {
    // Process the actions for this choice
    console.log('Processing choice actions:', choice.actions); // Debug log
    processChoiceActions(choice.actions)
  }
  
  // Clear choices
  currentChoices.value = []
}

// Process actions from a choice
function processChoiceActions(actions) {
  console.log('Starting to process choice actions:', actions); // Debug log
  let tempIndex = 0
  
  function processAction() {
    console.log('Processing action at index:', tempIndex, 'of', actions.length); // Debug log
    if (tempIndex >= actions.length) {
      console.log('Finished processing all actions, advancing story'); // Debug log
      // Continue with the main story after processing all choice actions
      // This path is used when choice actions don't involve user interaction
      stepIndex.value++
      processStep()
      return
    }
    
    const action = actions[tempIndex]
    console.log('Processing action:', action); // Debug log
    tempIndex++
    
    switch (action.type) {
      case 'dialogue':
        console.log('Processing dialogue action'); // Debug log
        // Store the remaining actions to process after user interaction
        const remainingActionsForOverride = actions.slice(tempIndex)
        showDialogue(action.character, action.text)
        // We'll advance after user interaction, but need to continue processing remaining actions
        // Temporarily override advanceStory to continue processing choice actions
        advanceStoryOverride = function() {
          currentDialogue.value = ''
          currentNarration.value = ''
          // Process remaining choice actions
          if (remainingActionsForOverride.length > 0) {
            processChoiceActions(remainingActionsForOverride)
          } else {
            // No more choice actions, continue with main story
            stepIndex.value++
            processStep()
          }
          // Clear the override
          advanceStoryOverride = null
        }
        break
      case 'narration':
        console.log('Processing narration action'); // Debug log
        // Store the remaining actions to process after user interaction
        const remainingActions = actions.slice(tempIndex)
        showNarration(action.text)
        // We'll advance after user interaction, but need to continue processing remaining actions
        // Temporarily override advanceStory to continue processing choice actions
        advanceStoryOverride = function() {
          currentDialogue.value = ''
          currentNarration.value = ''
          // Process remaining choice actions
          if (remainingActions.length > 0) {
            processChoiceActions(remainingActions)
          } else {
            // No more choice actions, continue with main story
            stepIndex.value++
            processStep()
          }
          // Clear the override
          advanceStoryOverride = null
        }
        break
      case 'goto':
        console.log('Processing goto action to:', action.target); // Debug log
        goToLabel(action.target)
        return  // Stop processing further actions after goto
      case 'show':
        console.log('Processing show action'); // Debug log
        showCharacter(action.character)
        processAction() // Process next action immediately
        break
      case 'hide':
        console.log('Processing hide action'); // Debug log
        hideCharacter(action.character)
        processAction() // Process next action immediately
        break
      default:
        console.log('Processing default action'); // Debug log
        processAction() // Process next action immediately
        break
    }
  }
  
  // Start processing actions
  processAction()
}

// Go to a specific label/step
function goToLabel(targetLabel) {
  console.log('Attempting to go to label:', targetLabel); // Debug log
  // Find the step with the matching id in the story
  const targetStepIndex = storyData.value.steps.findIndex(step => step.id === targetLabel)
  console.log('Target step index found:', targetStepIndex); // Debug log
  if (targetStepIndex !== -1) {
    console.log('Jumping to step index within current story:', targetStepIndex); // Debug log
    stepIndex.value = targetStepIndex
    processStep()
  } else {
    console.log('Target not found in current story, loading target story:', targetLabel); // Debug log
    // If we can't find the exact step with id, look for a story with that name
    // Load the target story file
    loadTargetStory(targetLabel)
  }
}

// Load a target story by name
async function loadTargetStory(storyName) {
  console.log('Loading target story:', storyName); // Debug log
  try {
    const module = await loadDataFromPublic(`/data/story/ru/${storyName}.json`)
    console.log('Loaded story data:', module); // Debug log
    storyData.value = module
    stepIndex.value = 0
    processStep()
  } catch (error) {
    console.error('Error loading target story:', error)
    emit('end')
  }
}

// Advance the story
function advanceStory() {
  console.log(`Advancing story: current stepIndex = ${stepIndex.value}, next stepIndex = ${stepIndex.value + 1}`); // Debug log
  
  // Check if there's a temporary override for choice action processing
  if (advanceStoryOverride) {
    console.log('Using temporary advance story override for choice actions');
    advanceStoryOverride();
    return;
  }
  
  currentDialogue.value = ''
  currentNarration.value = ''
  stepIndex.value++
  processStep()
}

// Lifecycle
onMounted(() => {
  loadStory()
})
</script>

<style scoped>
.visual-novel {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

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

.character {
  position: relative;
  margin: 0 10px;
}

.sprite {
  display: block;
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

.narration {
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
