<template>
    <!-- Background Display -->
    <img v-if="currentScene" :src="currentScene.bg" alt="Background" class="background-img" />
    
    <!-- Character Sprites -->
    <Character
      v-for="character in visibleCharacters"
      :key="character.id"
      :character="character"
    />
    
    <!-- Title Block (centered, full-screen clickable) -->
    <div class="title-box" v-if="currentTitle" @click="advanceStory">
      <div class="title-content" v-html="currentTitle"></div>
    </div>

    <!-- Dialogue Box -->
    <div class="dialogue-box" v-if="currentDialogue || currentNarration">
      <div class="speaker" v-if="currentSpeaker">{{ currentSpeaker }}</div>
      <div class="dialogue-text" v-if="currentDialogue" v-html="currentDialogue"></div>
      <div class="narration-text" v-if="currentNarration" v-html="currentNarration"></div>
      
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
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TextInputModal from './TextInputModal.vue'
import Character from './Character.vue'
import { useSavesStore } from '../../stores/saves'

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
const currentTitle = ref('') // Centered title block text (HTML allowed)
const currentSpeaker = ref('')
const currentChoices = ref([])

// History of previous dialogue/title entries (most recent last)
const HISTORY_MAX = 100
const historyEntries = ref([])

function addToHistory(entry) {
  try {
    historyEntries.value.push(entry)
    // Trim to max
    if (historyEntries.value.length > HISTORY_MAX) {
      historyEntries.value.splice(0, historyEntries.value.length - HISTORY_MAX)
    }
  } catch (e) {
    console.error('Failed to add to history:', e)
  }
}

// Timeout handle for auto-advancing titles
let titleTimeout = null
const storyData = ref(null)
const stepIndex = ref(0)
const characterData = ref({})
const sceneData = ref({})
const globalData = ref({})
let advanceStoryOverride = null

// Call stack for tracking story navigation (for 'continue' functionality)
const callStack = ref([])

// Text input modal state
const showTextInputModal = ref(false)
const currentInputStep = ref(null)

// Flag to skip scene/show restoration when loading from save
const isRestoringGameState = ref(false)
// Loading state for story/scene/character data
let loadingPromise = null
const isLoaded = ref(false)

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

// Load story data (singleton promise to avoid duplicate loads)
async function loadStory() {
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      // Load story data
      const storyModule = await loadDataFromPublic(props.src);
      storyData.value = storyModule;

      // Load character data - try new format (split into 3 files) first, fall back to old format
      const characterIds = ['mc', 'albedo', 'momonga'];
      
      for (const charId of characterIds) {
        try {
          // Try loading new format: separate values.json, body.json, equipment.json
          const valuesData = await loadDataFromPublic(`/data/characters/${charId}/values.json`);
          const bodyData = await loadDataFromPublic(`/data/characters/${charId}/body.json`);
          const equipmentData = await loadDataFromPublic(`/data/characters/${charId}/equipment.json`);
          
          // Build equipment map by ID for quick lookup
          const equipmentMap = {};
          equipmentData.forEach(item => {
            equipmentMap[item.id] = item;
          });
          
          // Build equipment structure grouped by parent sprite
          const equipmentBySlot = {};
          if (valuesData.equipment_slots) {
            for (const [slotName, itemId] of Object.entries(valuesData.equipment_slots)) {
              if (itemId && equipmentMap[itemId]) {
                equipmentBySlot[slotName] = {
                  id: itemId,
                  item: equipmentMap[itemId],
                  parts: equipmentMap[itemId].parts || []
                };
              }
            }
          }
          
          // Merge the three parts into one character object
          const mergedCharacter = {
            ...valuesData,
            sprites: bodyData,
            equipment: equipmentData,
            equipmentBySlot: equipmentBySlot
          };
          
          characterData.value[charId] = mergedCharacter;
          console.log(`✔ Loaded character ${charId} from split files`);
        } catch (splitFormatError) {
          // Fall back to old format (single .json file)
          try {
            const charModule = await loadDataFromPublic(`/data/characters/${charId}.json`);
            characterData.value[charId] = charModule;
            console.log(`✔ Loaded character ${charId} from legacy format`);
          } catch (legacyFormatError) {
            console.warn(`✘ Could not load character ${charId} in either format:`, splitFormatError, legacyFormatError);
          }
        }
      }

      // Emit character data for parent components
      emit('character-loaded', characterData.value);
      
      // Set character defaults for save system (optimize save file size)
      const savesStore = useSavesStore()
      savesStore.setCharacterDefaults(characterData.value)
      console.log('✔ Character defaults set for save system')

      // Load scene data
      const scenesModule = await loadDataFromPublic('/data/scenes/scenes.json');
      scenesModule.scenes.forEach(scene => {
        sceneData.value[scene.id] = scene;
      });

      isLoaded.value = true
      console.log('✔ All story data loaded, ready to start')
      // Don't start the story here - will be started by Game.vue or restoreGameState
    } catch (error) {
      console.error('Error loading story:', error);
      throw error
    } finally {
      // keep loadingPromise null so future calls can reload if necessary
      loadingPromise = null
    }
  })()

  return loadingPromise
}

// Process current step
function processStep() {
  if (!storyData.value || stepIndex.value >= storyData.value.steps.length) {
    emit('end')
    return
  }
  
  const step = storyData.value.steps[stepIndex.value]
  console.log(`[processStep] Story: "${storyData.value.id}" | Step ${stepIndex.value}/${storyData.value.steps.length} | Type: ${step.type}`, { callStackDepth: callStack.value.length, isRestoring: isRestoringGameState.value }); // Debug log
  console.log('Current step details:', step); // Debug log
  
  // Handle steps that only contain a variable assignment and no type
  if (!step.type && step.variable) {
    console.log('Processing standalone variable step:', step.variable)
    applyVariable(step.variable)
    stepIndex.value++
    processStep()
    return
  }

  try {
    switch (step.type) {
      case 'scene':
        // Skip scene changes when restoring game state - use restored scene instead
        if (!isRestoringGameState.value) {
          changeScene(step.id)
        }
        stepIndex.value++
        processStep()
        break
      case 'show':
        // Skip character shows when restoring game state - use restored visible characters instead
        if (!isRestoringGameState.value) {
          showCharacter(step.character)
        }
        stepIndex.value++
        processStep()
        break
      case 'hide':
        // Skip character hides when restoring game state - use restored visible characters instead
        if (!isRestoringGameState.value) {
          hideCharacter(step.character)
        }
        stepIndex.value++
        processStep()
        break
      case 'dialogue':
            // Apply variable modification if present on the step
            if (step.variable) applyVariable(step.variable)
            if (step.character) {
              showDialogue(step.character, step.text)
            } else {
              showNarration(step.text)
            }
            // Reset restoration flag after first interactive element is shown
            isRestoringGameState.value = false
        break
      case 'titles':
        // Centered title blocks (like dialogues but centered on screen)
        // Skip showing titles when restoring game state to avoid transient opening titles
        if (isRestoringGameState.value) {
          stepIndex.value++
          processStep()
          break
        }
        if (step.variable) applyVariable(step.variable)
        showTitle(step.text, step.duration)
        // Reset restoration flag after first interactive element is shown
        isRestoringGameState.value = false
        break
      case 'inputtext':
        showTextInput(step)
        // Reset restoration flag after first interactive element is shown
        isRestoringGameState.value = false
        break
      case 'choice':
        showChoices(step)
        // Reset restoration flag after first interactive element is shown
        isRestoringGameState.value = false
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
        // Reset restoration flag
        isRestoringGameState.value = false
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
  // Clear narration when showing dialogue to avoid overlapping texts
  currentNarration.value = ''
  currentDialogue.value = substituteVariables(text)

  // Add to history
  addToHistory({ type: 'dialogue', speaker: currentSpeaker.value, text: currentDialogue.value, stepIndex: stepIndex.value })
}

// Show text without speaker (narration-style display)
function showNarration(text) {
  currentNarration.value = substituteVariables(text)
  currentSpeaker.value = ''
  currentDialogue.value = ''

  // Add to history
  addToHistory({ type: 'narration', speaker: '', text: currentNarration.value, stepIndex: stepIndex.value })
}

// Show centered title block (HTML allowed). If duration (ms) provided, auto-advance after duration.
function showTitle(text, duration) {
  console.log('showTitle() called — stepIndex:', stepIndex.value, 'isRestoringGameState:', isRestoringGameState.value, 'text:', text)
  if (titleTimeout) {
    clearTimeout(titleTimeout)
    titleTimeout = null
  }
  currentTitle.value = substituteVariables(text)
  currentDialogue.value = ''
  currentNarration.value = ''
  currentSpeaker.value = ''
  currentChoices.value = []

  // Add to history
  addToHistory({ type: 'titles', speaker: '', text: currentTitle.value, stepIndex: stepIndex.value })

  if (duration && typeof duration === 'number' && duration > 0) {
    titleTimeout = setTimeout(() => {
      titleTimeout = null
      advanceStory()
    }, duration)
  }
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

// Rebuild equipmentBySlot for a character from its equipment list and equipment_slots mapping
function rebuildEquipmentBySlot(characterId) {
  const char = characterData.value[characterId]
  if (!char) return

  const equipmentMap = {}
  if (Array.isArray(char.equipment)) {
    char.equipment.forEach(item => {
      if (item && item.id) equipmentMap[item.id] = item
    })
  }

  const equipmentBySlot = {}
  const slots = char.equipment_slots || {}
  for (const [slotName, itemRef] of Object.entries(slots)) {
    let itemId = null
    if (itemRef === null || typeof itemRef === 'undefined') {
      itemId = null
    } else if (typeof itemRef === 'string' || typeof itemRef === 'number') {
      itemId = itemRef
    } else if (typeof itemRef === 'object' && itemRef.id) {
      itemId = itemRef.id
    } else if (typeof itemRef === 'object' && itemRef.item && itemRef.item.id) {
      itemId = itemRef.item.id
    }

    if (itemId && equipmentMap[itemId]) {
      equipmentBySlot[slotName] = {
        id: itemId,
        item: equipmentMap[itemId],
        parts: equipmentMap[itemId].parts || []
      }
    }
  }

  // Assign a new object to trigger reactivity
  char.equipmentBySlot = equipmentBySlot
  console.log(`✔ Rebuilt equipmentBySlot for ${characterId}:`, equipmentBySlot)
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

      // If equipment_slots (or its child) changed, rebuild equipmentBySlot so visuals update
      if (propertyPath[0] === 'equipment_slots' || finalProperty === 'equipment_slots' || propertyPath.includes('equipment_slots')) {
        rebuildEquipmentBySlot(characterId)
      }
    }
  }
}

// Generic resolver for root paths like 'character.id.prop...', 'global.foo.bar'
function resolvePath(variablePath) {
  const parts = variablePath.split('.')
  const root = parts[0]
  if (root === 'character' && parts.length >= 3) {
    const characterId = parts[1]
    const propertyPath = parts.slice(2)
    if (!characterData.value[characterId]) return null
    let target = characterData.value[characterId]
    for (let i = 0; i < propertyPath.length - 1; i++) {
      if (target[propertyPath[i]] === undefined) target[propertyPath[i]] = {}
      target = target[propertyPath[i]]
    }
    return {container: target, key: propertyPath[propertyPath.length - 1], root: 'character', id: characterId}
  }
  if (root === 'global' && parts.length >= 2) {
    const propertyPath = parts.slice(1)
    let target = globalData.value
    for (let i = 0; i < propertyPath.length - 1; i++) {
      if (target[propertyPath[i]] === undefined) target[propertyPath[i]] = {}
      target = target[propertyPath[i]]
    }
    return {container: target, key: propertyPath[propertyPath.length - 1], root: 'global'}
  }
  return null
}

// Apply a simple variable expression like:
// "character.mc.stats.attack += 1" or "character.mc.stats.attack = 5" or "global.gold -= 10"
function applyVariable(expr) {
  if (!expr || typeof expr !== 'string') return
  const m = expr.match(/^\s*([a-zA-Z0-9_\.]+)\s*(\+=|-=|=|\*=|\/=)\s*(.+)\s*$/)
  if (!m) {
    console.warn('Unsupported variable expression:', expr)
    return
  }
  const targetPath = m[1]
  const op = m[2]
  const rhsRaw = m[3]

  const resolved = resolvePath(targetPath)
  if (!resolved) {
    console.warn('Could not resolve target path for variable:', targetPath)
    return
  }

  // Evaluate RHS: number, quoted string, or another variable path
  let rhsValue = null
  const num = Number(rhsRaw)
  if (!isNaN(num) && rhsRaw.trim() !== '') {
    rhsValue = num
  } else {
    const strMatch = rhsRaw.match(/^['"]([\s\S]*)['"]$/)
    if (strMatch) rhsValue = strMatch[1]
    else {
      // try to resolve as variable path
      const ref = resolvePath(rhsRaw)
      if (ref && ref.container && ref.container[ref.key] !== undefined) rhsValue = ref.container[ref.key]
      else rhsValue = rhsRaw
    }
  }

  const container = resolved.container
  const key = resolved.key

  const current = container[key]
  let newValue
  switch (op) {
    case '=':
      newValue = rhsValue
      break
    case '+=':
      newValue = (typeof current === 'number' ? current : Number(current) || 0) + (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
      break
    case '-=':
      newValue = (typeof current === 'number' ? current : Number(current) || 0) - (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
      break
    case '*=':
      newValue = (typeof current === 'number' ? current : Number(current) || 0) * (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0)
      break
    case '/=':
      newValue = (typeof current === 'number' ? current : Number(current) || 0) / (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 1)
      break
    default:
      newValue = rhsValue
  }

  // Apply new value
  container[key] = newValue

  // If we modified a character property, log via updateCharacterData for parity
  if (resolved.root === 'character') {
    console.log(`Applied variable: ${expr} -> ${resolved.id}.${key} =`, newValue)
    // notify using updateCharacterData to keep consistent logs/state
    // Use the original targetPath (full path like 'character.mc.equipment_slots.mask') so
    // nested paths (e.g., equipment_slots) are detected and handled correctly
    updateCharacterData(targetPath, newValue)
  } else {
    console.log(`Applied global variable: ${expr} -> ${targetPath} =`, newValue)
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
    // support {global.foo}
    if (parts[0] === 'global' && parts.length >= 2) {
      const propertyPath = parts.slice(1)
      let target = globalData.value
      for (let i = 0; i < propertyPath.length; i++) {
        if (target[propertyPath[i]] === undefined) return match
        target = target[propertyPath[i]]
      }
      return target || ''
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
        // Clear choices so the Continue button is shown for the user
        currentChoices.value = []
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
        // For goto actions in choice processing, we need to handle the transition properly
        // Clear any dialogue/narration first
        currentDialogue.value = ''
        currentNarration.value = ''
        currentSpeaker.value = ''
        currentChoices.value = []
        // Execute the goto
        goToLabel(action.target)
        // Don't return here - let the goToLabel function handle the continuation
        // The goToLabel function will either jump to a step in the current story
        // or load a new story file, and in both cases it will call processStep()
        break
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
  console.log('Looking for step with id:', targetLabel); // Debug log
  console.log('Current story steps:', storyData.value.steps.map((step, index) => ({index, id: step.id, type: step.type}))); // Debug log
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
    const overrideFunction = advanceStoryOverride;
    // Clear the override immediately to prevent re-entry
    advanceStoryOverride = null;
    try {
      overrideFunction();
    } catch (error) {
      console.error('Error in advanceStoryOverride:', error);
      // Reset dialogue and narration
      currentDialogue.value = '';
      currentNarration.value = '';
      // Continue with normal story advancement
      stepIndex.value++;
      processStep();
    }
    return;
  }
  
  // Clear title block and any pending auto-advance
  currentTitle.value = ''
  if (titleTimeout) {
    clearTimeout(titleTimeout)
    titleTimeout = null
  }

  currentDialogue.value = ''
  currentNarration.value = ''
  // Reset restoration flag when user advances the story
  isRestoringGameState.value = false
  stepIndex.value++
  processStep()
}

// Serialize current game state for saving
function getGameState() {
  return {
    storyData: storyData.value,
    stepIndex: stepIndex.value,
    callStack: callStack.value,
    globalData: globalData.value,
    characterData: characterData.value,
    visibleCharacters: visibleCharacters.value.map(c => c.id),
    currentScene: currentScene.value?.id,
    // Include dialogue history so saves can restore it
    history: historyEntries.value.slice()
  }
}

// Restore game state from save file
async function restoreGameState(saveData) {
  try {
    // Ensure data (characters/scenes) is loaded before restoring
    if (!isLoaded.value) {
      if (loadingPromise) {
        await loadingPromise
      } else {
        await loadStory()
      }
    }
    // Set flag to skip scene/show restoration during processStep
    isRestoringGameState.value = true
    
    globalData.value = saveData.globalData
    
    // Restore character data from delta (changes only, not full data)
    // Apply delta on top of defaults that were already loaded
    if (saveData.characterDataDelta) {
      Object.keys(saveData.characterDataDelta).forEach(characterId => {
        if (characterData.value[characterId]) {
          // Merge delta with current character data (which has defaults + sprites)
          Object.assign(characterData.value[characterId], saveData.characterDataDelta[characterId])
        }
      })
      console.log('✔ Restored character data from delta')
    }
    
    // Handle legacy save files that use full characterData instead of delta
    if (saveData.characterData && !saveData.characterDataDelta) {
      console.warn('⚠ Loading legacy save file with full character data (not optimized)')
      Object.keys(saveData.characterData).forEach(characterId => {
        if (characterData.value[characterId]) {
          // Deep merge character data to preserve sprite references
          Object.assign(characterData.value[characterId], saveData.characterData[characterId])
        }
      })
    }
    
    // Restore visible characters
    visibleCharacters.value = []
    if (saveData.visibleCharacters && Array.isArray(saveData.visibleCharacters)) {
      saveData.visibleCharacters.forEach(characterId => {
        const character = characterData.value[characterId]
        if (character) {
          visibleCharacters.value.push(character)
        }
      })
    }
    console.log('✔ Restored visible characters:', visibleCharacters.value.map(c => c.id))
    
    // Restore current scene
    if (saveData.currentScene && sceneData.value[saveData.currentScene]) {
      currentScene.value = sceneData.value[saveData.currentScene]
      console.log('✔ Restored current scene:', currentScene.value.id)
    } else {
      console.log('⚠ Warning: Could not restore scene. saveData.currentScene:', saveData.currentScene, 'sceneData keys:', Object.keys(sceneData.value))
    }

    // Rebuild equipmentBySlot for all characters after applying deltas so visuals reflect saved equipment
    Object.keys(characterData.value).forEach(charId => {
      rebuildEquipmentBySlot(charId)
    })
    console.log('✔ Rebuilt equipmentBySlot for all characters after restore')
        // Clear any previous dialogue/narration/title to avoid leftover text from prior story
        currentDialogue.value = ''
        currentNarration.value = ''
        currentTitle.value = ''
        // Clear any pending title auto-advance
        if (titleTimeout) {
          clearTimeout(titleTimeout)
          titleTimeout = null
        }
        currentSpeaker.value = ''
        currentChoices.value = []
    
    // Restore call stack
    callStack.value = saveData.callStack || []

    // Load story from disk by ID (instead of restoring full storyData from save)
    const storyId = saveData.storyId || 'start'
    console.log('Loading story from disk:', storyId)
    try {
      const loadedStory = await loadDataFromPublic(`/data/story/ru/${storyId}.json`)
      storyData.value = loadedStory
      stepIndex.value = saveData.stepIndex || 0
    } catch (err) {
      console.error('Failed to load story file:', err)
      throw new Error(`Could not load story file: ${storyId}`)
    }
    
    console.log('✔ Game state restored successfully')
    console.log('Restored story:', storyData.value.id, 'at step:', stepIndex.value, 'callStack length:', callStack.value.length)

    // Restore history if present, else rebuild from story steps up to stepIndex
    if (saveData.history && Array.isArray(saveData.history)) {
      historyEntries.value = saveData.history.slice(-HISTORY_MAX)
    } else {
      // Rebuild history from story steps processed so far
      historyEntries.value = []
      for (let i = 0; i < stepIndex.value && i < (storyData.value.steps || []).length; i++) {
        const s = storyData.value.steps[i]
        if (!s) continue
        switch (s.type) {
          case 'dialogue':
            if (s.character) {
              const speaker = characterData.value[s.character]?.name || s.character
              const text = substituteVariables(s.text || '')
              historyEntries.value.push({ type: 'dialogue', speaker, text, stepIndex: i })
            } else {
              const text = substituteVariables(s.text || '')
              historyEntries.value.push({ type: 'narration', speaker: '', text, stepIndex: i })
            }
            break
          case 'titles':
            historyEntries.value.push({ type: 'titles', speaker: '', text: substituteVariables(s.text || ''), stepIndex: i })
            break
          default:
            break
        }
      }
      // Ensure length limit
      if (historyEntries.value.length > HISTORY_MAX) historyEntries.value = historyEntries.value.slice(-HISTORY_MAX)
    }

    // Process the current step to display the saved state
    // Flag isRestoringGameState will be reset when the first interactive element is shown
    processStep()
  } catch (error) {
    console.error('Error restoring game state:', error)
    isRestoringGameState.value = false
    throw error
  }
}

// Reset game state (for starting a new game)
function resetGameState() {
  stepIndex.value = 0
  callStack.value = []
  currentDialogue.value = ''
  currentNarration.value = ''
  currentSpeaker.value = ''
  currentChoices.value = []
  visibleCharacters.value = []
  currentScene.value = null
  globalData.value = {}
  historyEntries.value = []
  console.log('✔ Game state reset')
}

// Lifecycle
onMounted(async () => {
  await loadStory()
  
  // Check if there's a pending save to restore - if not, start new game
  const savesStore = useSavesStore()
  if (!savesStore.getPendingLoad()) {
    // No pending save, start new game
    console.log('✔ Starting new game')
    processStep()
  }
})

// Expose methods for parent components
defineExpose({
  getGameState,
  restoreGameState,
  resetGameState,
  startStory: () => processStep(), // Expose method to start/continue story
  // Expose history access
  getHistory: () => historyEntries.value.slice(),
  clearHistory: () => { historyEntries.value = [] }
})
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
