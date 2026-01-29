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
      <div class="dialogue-text" v-if="currentDialogue">{{ currentDialogue }}</div>
      <div class="narration-text" v-if="currentNarration">{{ currentNarration }}</div>
      
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
    
    <!-- Text Input Modal -->
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TextInputModal from './TextInputModal.vue'

// Props
const props = defineProps({
  src: {
    type: String,
    required: true
  }
})

// Emits
const emit = defineEmits(['end', 'character-loaded'])

// State
const currentScene = ref(null)
const visibleCharacters = ref([])
const currentDialogue = ref('')
const currentNarration = ref('') // Text without speaker (used for narration-style display)
const currentSpeaker = ref('')
const currentChoices = ref([])
const storyData = ref(null)
const stepIndex = ref(0)
const characterData = ref({})
const sceneData = ref({})
let advanceStoryOverride = null

// Call stack for tracking story navigation (for 'continue' functionality)
const callStack = ref([])

// Text input modal state
const showTextInputModal = ref(false)
const currentInputStep = ref(null)

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
    
    // Emit character data for parent components
    emit('character-loaded', characterData.value);
    
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
  console.log(`Processing step ${stepIndex.value} of type: ${step.type} in story: ${storyData.value.id}`); // Debug log
  console.log('Current step details:', step); // Debug log
  
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
        if (step.character) {
          showDialogue(step.character, step.text)
        } else {
          showNarration(step.text)
        }
        break
      case 'inputtext':
        showTextInput(step)
        break
      case 'choice':
        showChoices(step)
        break
      case 'goto':
        goToLabel(step.target)
        break
      case 'continue':
        handleContinue()
        break
      case 'end':
        // If there's a story in the call stack, return to it instead of ending
        if (callStack.value.length > 0) {
          handleContinue()
        } else {
          emit('end')
        }
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
  currentDialogue.value = substituteVariables(text)
}

// Show text without speaker (narration-style display)
function showNarration(text) {
  currentNarration.value = substituteVariables(text)
  currentSpeaker.value = ''
  currentDialogue.value = ''
}

// Show text input modal
function showTextInput(step) {
  // Clear any existing dialogue when showing text input
  currentDialogue.value = ''
  currentNarration.value = ''
  currentSpeaker.value = ''
  currentChoices.value = []
  
  currentInputStep.value = step
  showTextInputModal.value = true
}

// Update character data based on variable path
function updateCharacterData(variablePath, value) {
  // Parse the variable path (e.g., "character.mc.name")
  const parts = variablePath.split('.')
  
  if (parts[0] === 'character' && parts.length >= 3) {
    const characterId = parts[1]
    const propertyPath = parts.slice(2)
    
    if (characterData.value[characterId]) {
      let target = characterData.value[characterId]
      
      // Navigate to the target property (support nested properties)
      for (let i = 0; i < propertyPath.length - 1; i++) {
        if (!target[propertyPath[i]]) {
          target[propertyPath[i]] = {}
        }
        target = target[propertyPath[i]]
      }
      
      // Set the final property value
      const finalProperty = propertyPath[propertyPath.length - 1]
      target[finalProperty] = value
      
      console.log(`Updated ${variablePath} to:`, value)
      console.log('Character data now:', characterData.value[characterId])
    }
  }
}

// Substitute variables in text
function substituteVariables(text) {
  if (!text) return ''
  
  // Match patterns like {character.mc.name}
  return text.replace(/\{([^}]+)\}/g, (match, variablePath) => {
    const parts = variablePath.split('.')
    
    if (parts[0] === 'character' && parts.length >= 3) {
      const characterId = parts[1]
      const propertyPath = parts.slice(2)
      
      if (characterData.value[characterId]) {
        let target = characterData.value[characterId]
        
        // Navigate to the target property
        for (let i = 0; i < propertyPath.length; i++) {
          if (target[propertyPath[i]] === undefined) {
            return match // Return original placeholder if not found
          }
          target = target[propertyPath[i]]
        }
        
        return target || ''
      }
    }
    
    return match // Return original placeholder if not matched
  })
}

// Get initial value for input based on variable path
function getInitialValue(variablePath) {
  if (!variablePath) return ''
  
  const parts = variablePath.split('.')
  
  if (parts[0] === 'character' && parts.length >= 3) {
    const characterId = parts[1]
    const propertyPath = parts.slice(2)
    
    if (characterData.value[characterId]) {
      let target = characterData.value[characterId]
      
      // Navigate to the target property
      for (let i = 0; i < propertyPath.length; i++) {
        if (target[propertyPath[i]] === undefined) {
          return ''
        }
        target = target[propertyPath[i]]
      }
      
      return target || ''
    }
  }
  
  return ''
}

// Handle text input confirmation
function onTextInputConfirm(value) {
  if (currentInputStep.value?.variable) {
    updateCharacterData(currentInputStep.value.variable, value)
  }
  
  showTextInputModal.value = false
  currentInputStep.value = null
  
  // Continue with the story
  stepIndex.value++
  processStep()
}

// Show choices
function showChoices(choiceStep) {
  console.log('Showing choices:', choiceStep); // Debug log
  // Apply variable substitution to choice options text
  currentChoices.value = choiceStep.options.map(option => ({
    ...option,
    text: substituteVariables(option.text)
  }))
  currentSpeaker.value = choiceStep.speaker ? characterData.value[choiceStep.speaker]?.name : ''
  // Set the choice text as dialogue to ensure the dialogue box appears
  if (choiceStep.text) {
    currentDialogue.value = substituteVariables(choiceStep.text)
  }
  console.log('Current choices set to:', currentChoices.value); // Debug log
}

// Select a choice
function selectChoice(index) {
  console.log('Selected choice index:', index); // Debug log
  const choice = currentChoices.value[index]
  console.log('Selected choice:', choice); // Debug log
  console.log('Choice text:', choice.text); // Debug log
  if (choice.actions) {
    // Process the actions for this choice
    console.log('Processing choice actions:', choice.actions); // Debug log
    processChoiceActions(choice.actions)
  } else {
    // No actions, advance to next step
    console.log('No actions for this choice, advancing to next step'); // Debug log
    // Clear choices and dialogue text
    currentChoices.value = []
    currentDialogue.value = ''
    currentNarration.value = ''
    // Advance to next step
    stepIndex.value++
    processStep()
  }
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
        if (action.character) {
          showDialogue(action.character, action.text)
        } else {
          showNarration(action.text)
        }
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
  
  // Clear dialogue and narration when jumping to a new label
  currentDialogue.value = ''
  currentNarration.value = ''
  currentSpeaker.value = ''
  currentChoices.value = []
  
  // Find the step with the matching id in the story
  const targetStepIndex = storyData.value.steps.findIndex(step => step.id === targetLabel)
  console.log('Target step index found:', targetStepIndex); // Debug log
  if (targetStepIndex !== -1) {
    console.log('Jumping to step index within current story:', targetStepIndex); // Debug log
    stepIndex.value = targetStepIndex
    processStep()
  } else {
    console.log('Target not found in current story, loading target story:', targetLabel); // Debug log
    // Push current story position to call stack before navigating to new story
    callStack.value.push({
      storyId: storyData.value.id,
      stepIndex: stepIndex.value + 1  // Next step after the goto
    })
    console.log('Call stack after push:', callStack.value); // Debug log
    
    // If we can't find the exact step with id, look for a story with that name
    // Load the target story file
    loadTargetStory(targetLabel)
  }
}

// Handle continue action - return to the calling story
function handleContinue() {
  console.log('Handling continue action'); // Debug log
  console.log('Current call stack:', callStack.value); // Debug log
  
  if (callStack.value.length > 0) {
    // Pop the last entry from call stack
    const returnPosition = callStack.value.pop()
    console.log('Returning to:', returnPosition); // Debug log
    
    // Load the calling story
    loadReturnStory(returnPosition.storyId, returnPosition.stepIndex)
  } else {
    console.log('No calling story in stack, ending story'); // Debug log
    emit('end')
  }
}

// Load a target story by name
async function loadTargetStory(storyName) {
  console.log('Loading target story:', storyName); // Debug log
  try {
    const module = await loadDataFromPublic(`/data/story/ru/${storyName}.json`)
    console.log('Loaded story data:', module); // Debug log
    storyData.value = module
    
    // Clear dialogue and narration when loading new story
    currentDialogue.value = ''
    currentNarration.value = ''
    currentSpeaker.value = ''
    currentChoices.value = []
    
    stepIndex.value = 0
    processStep()
  } catch (error) {
    console.error('Error loading target story:', error)
    emit('end')
  }
}

// Load a story to return to (from call stack)
async function loadReturnStory(storyName, returnStepIndex) {
  console.log('Loading return story:', storyName, 'at step:', returnStepIndex); // Debug log
  try {
    const module = await loadDataFromPublic(`/data/story/ru/${storyName}.json`)
    console.log('Loaded return story data:', module); // Debug log
    storyData.value = module
    
    // Clear dialogue and narration when loading return story
    currentDialogue.value = ''
    currentNarration.value = ''
    currentSpeaker.value = ''
    currentChoices.value = []
    
    // Set to the return step index
    stepIndex.value = returnStepIndex
    processStep()
  } catch (error) {
    console.error('Error loading return story:', error)
    emit('end')
  }
}

// Advance the story
function advanceStory() {
  console.log(`Advancing story: current stepIndex = ${stepIndex.value}, next stepIndex = ${stepIndex.value + 1}`); // Debug log
  
  // Check if there's a temporary override for choice action processing
  if (advanceStoryOverride) {
    console.log('Using temporary advance story override for choice actions');
    try {
      advanceStoryOverride();
    } catch (error) {
      console.error('Error in advanceStoryOverride:', error);
      // Clear the override to prevent infinite loops
      advanceStoryOverride = null;
      // Reset dialogue and narration
      currentDialogue.value = '';
      currentNarration.value = '';
      // Continue with normal story advancement
      stepIndex.value++;
      processStep();
    }
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
