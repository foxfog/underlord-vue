import { ref } from 'vue'
import { useSavesStore } from '../stores/saves'

export function useVisualNovel({ src, emit } = {}) {
  // State
  const currentScene = ref(null)
  const visibleCharacters = ref([])
  const currentDialogue = ref('')
  const currentNarration = ref('')
  const currentTitle = ref('')
  const currentTitleEffects = ref(null) // { effectStart, effect, effectEnd }
  const currentSpeaker = ref('')
  const currentChoices = ref([])

  // Audio state - indexed by stream ID
  const audioStreams = ref({}) // { streamId: { type, file, loop, stream } }
  const pausedStreams = ref({}) // Store paused streams for resume
  const currentSound = ref(null)
  const currentVoice = ref(null)
  const currentMusic = ref(null)

  // History
  const HISTORY_MAX = 100
  const historyEntries = ref([])
  function addToHistory(entry) {
    try {
      historyEntries.value.push(entry)
      if (historyEntries.value.length > HISTORY_MAX) {
        historyEntries.value.splice(0, historyEntries.value.length - HISTORY_MAX)
      }
    } catch (e) {
      console.error('Failed to add to history:', e)
    }
  }

  // Other state
  let titleTimeout = null
  const storyData = ref(null)
  const stepIndex = ref(0)
  const characterData = ref({})
  const sceneData = ref({})
  const globalData = ref({})
  let advanceStoryOverride = null
  const callStack = ref([])

  const showTextInputModal = ref(false)
  const currentInputStep = ref(null)

  const isRestoringGameState = ref(false)
  let loadingPromise = null
  const isLoaded = ref(false)

  // Helpers
  async function loadDataFromPublic(path) {
    // Convert .js to .json path
    const jsonPath = path.replace(/\.js$/, '.json')
    try {
      const response = await fetch(jsonPath)
      if (response.ok) return await response.json()
      throw new Error('JSON file not found')
    } catch (jsonError) {
      console.error('Error in loadDataFromPublic:', jsonError)
      throw new Error(`Data file not found as JSON: ${jsonPath}`)
    }
  }

  async function loadStory() {
    if (loadingPromise) return loadingPromise
    loadingPromise = (async () => {
      try {
        const storyModule = await loadDataFromPublic(src)
        storyData.value = storyModule

        // Load characters (try split format, fallback to legacy file)
        const characterIds = ['mc', 'albedo', 'momonga']
        for (const charId of characterIds) {
          try {
            const valuesData = await loadDataFromPublic(`/data/characters/${charId}/values.json`)
            const bodyData = await loadDataFromPublic(`/data/characters/${charId}/body.json`)
            const equipmentData = await loadDataFromPublic(`/data/characters/${charId}/equipment.json`)

            const equipmentMap = {}
            equipmentData.forEach(item => { equipmentMap[item.id] = item })

            const equipmentBySlot = {}
            if (valuesData.equipment_slots) {
              for (const [slotName, itemId] of Object.entries(valuesData.equipment_slots)) {
                if (itemId && equipmentMap[itemId]) {
                  equipmentBySlot[slotName] = { id: itemId, item: equipmentMap[itemId], parts: equipmentMap[itemId].parts || [] }
                }
              }
            }

            const mergedCharacter = { ...valuesData, sprites: bodyData, equipment: equipmentData, equipmentBySlot }
            characterData.value[charId] = mergedCharacter
            console.log(`✔ Loaded character ${charId} from split files`)
          } catch (splitFormatError) {
            try {
              const charModule = await loadDataFromPublic(`/data/characters/${charId}.json`)
              characterData.value[charId] = charModule
              console.log(`✔ Loaded character ${charId} from legacy format`)
            } catch (legacyFormatError) {
              console.warn(`✘ Could not load character ${charId} in either format:`, splitFormatError, legacyFormatError)
            }
          }
        }

        emit && emit('character-loaded', characterData.value)

        // Set character defaults for save system
        const savesStore = useSavesStore()
        savesStore.setCharacterDefaults(characterData.value)

        const scenesModule = await loadDataFromPublic('/data/scenes/scenes.json')
        scenesModule.scenes.forEach(scene => { sceneData.value[scene.id] = scene })

        isLoaded.value = true
        console.log('✔ All story data loaded, ready to start')
      } catch (error) {
        console.error('Error loading story:', error)
        throw error
      } finally {
        loadingPromise = null
      }
    })()

    return loadingPromise
  }

  function processStep() {
    if (!storyData.value || stepIndex.value >= storyData.value.steps.length) {
      emit && emit('end')
      return
    }

    const step = storyData.value.steps[stepIndex.value]

    if (!step.type && step.variable) {
      applyVariable(step.variable)
      stepIndex.value++
      processStep()
      return
    }

    try {
      switch (step.type) {
        case 'scene':
          if (!isRestoringGameState.value) changeScene(step.id)
          stepIndex.value++
          processStep()
          break
        case 'show':
          if (!isRestoringGameState.value) showCharacter(step.character)
          stepIndex.value++
          processStep()
          break
        case 'hide':
          if (!isRestoringGameState.value) hideCharacter(step.character)
          stepIndex.value++
          processStep()
          break
        case 'sound':
          if (!isRestoringGameState.value) playSound(step)
          stepIndex.value++
          processStep()
          break
        case 'voice':
          if (!isRestoringGameState.value) playVoice(step)
          stepIndex.value++
          processStep()
          break
        case 'music':
          if (!isRestoringGameState.value) playMusic(step)
          stepIndex.value++
          processStep()
          break
        case 'stop-stream':
          if (!isRestoringGameState.value) stopStream(step.stream)
          stepIndex.value++
          processStep()
          break
        case 'stop-all-streams':
          if (!isRestoringGameState.value) stopAllStreams()
          stepIndex.value++
          processStep()
          break
        case 'dialogue':
          if (step.variable) applyVariable(step.variable)
          if (step.character) showDialogue(step.character, step.text)
          else showNarration(step.text)
          isRestoringGameState.value = false
          break
        case 'titles':
          if (isRestoringGameState.value) { stepIndex.value++; processStep(); break }
          if (step.variable) applyVariable(step.variable)
          showTitle(step)
          isRestoringGameState.value = false
          break
        case 'inputtext':
          showTextInput(step)
          isRestoringGameState.value = false
          break
        case 'choice':
          showChoices(step)
          isRestoringGameState.value = false
          break
        case 'goto':
          goToLabel(step.target)
          break
        case 'continue':
          handleContinue()
          break
        case 'end':
          if (callStack.value.length > 0) handleContinue()
          else emit && emit('end')
          isRestoringGameState.value = false
          break
        default:
          stepIndex.value++
          processStep()
          break
      }
    } catch (error) {
      console.error('Error processing step:', error)
    }
  }

  function changeScene(sceneId) { currentScene.value = sceneData.value[sceneId] }
  function showCharacter(characterId) {
    const character = characterData.value[characterId]
    if (character && !visibleCharacters.value.some(c => c.id === characterId)) visibleCharacters.value.push(character)
  }
  function hideCharacter(characterId) { visibleCharacters.value = visibleCharacters.value.filter(c => c.id !== characterId) }

  // Audio handlers
  function playSound(soundData) {
    // soundData: { file: "path/to/sound.mp3", loop: false, stream: "id" }
    const streamId = soundData.stream || `sound_${Date.now()}`
    const audioData = {
      type: 'sound',
      file: soundData.file,
      loop: soundData.loop ?? false,
      stream: streamId
    }
    audioStreams.value[streamId] = audioData
    currentSound.value = audioData
  }

  function playVoice(voiceData) {
    // voiceData: { file: "path/to/voice.mp3", loop: false, stream: "id" }
    const streamId = voiceData.stream || `voice_${Date.now()}`
    const audioData = {
      type: 'voice',
      file: voiceData.file,
      loop: voiceData.loop ?? false,
      stream: streamId
    }
    audioStreams.value[streamId] = audioData
    currentVoice.value = audioData
  }

  function playMusic(musicData) {
    // musicData: { file: "path/to/music.ogg", loop: true, stream: "id" }
    const streamId = musicData.stream || `music_${Date.now()}`
    const audioData = {
      type: 'music',
      file: musicData.file,
      loop: musicData.loop ?? true,
      stream: streamId
    }
    audioStreams.value[streamId] = audioData
    currentMusic.value = audioData
  }

  function stopSound() { currentSound.value = null }
  function stopVoice() { currentVoice.value = null }
  function stopMusic() { currentMusic.value = null }

  // Stream management by ID
  function stopStream(streamId) {
    const stream = audioStreams.value[streamId]
    if (!stream) return
    
    switch (stream.type) {
      case 'sound':
        if (currentSound.value?.stream === streamId) stopSound()
        break
      case 'voice':
        if (currentVoice.value?.stream === streamId) stopVoice()
        break
      case 'music':
        if (currentMusic.value?.stream === streamId) stopMusic()
        break
    }
    delete audioStreams.value[streamId]
    delete pausedStreams.value[streamId]
    console.log(`🛑 Stopped stream: ${streamId}`)
  }

  function stopAllStreams() {
    console.log('🛑 Stopping all streams')
    audioStreams.value = {}
    pausedStreams.value = {}
    stopSound()
    stopVoice()
    stopMusic()
  }

  function getStream(streamId) {
    return audioStreams.value[streamId] || null
  }

  function pauseAllStreams() {
    console.log('🔇 pauseAllStreams called, active streams:', Object.keys(audioStreams.value))
    pausedStreams.value = {}
    Object.entries(audioStreams.value).forEach(([streamId, stream]) => {
      pausedStreams.value[streamId] = { ...stream }
    })
    window.dispatchEvent(new CustomEvent('pauseAllAudio'))
    console.log('📢 pauseAllAudio event dispatched')
  }

  function resumeAllStreams() {
    console.log('🔊 resumeAllStreams called')
    window.dispatchEvent(new CustomEvent('resumeAllAudio'))
    console.log('📢 resumeAllAudio event dispatched')
    pausedStreams.value = {}
  }

  function showDialogue(characterId, text) {
    const character = characterData.value[characterId]
    currentSpeaker.value = character ? character.name : ''
    currentNarration.value = ''
    currentDialogue.value = substituteVariables(text)
    addToHistory({ type: 'dialogue', speaker: currentSpeaker.value, text: currentDialogue.value, stepIndex: stepIndex.value })
  }

  function showNarration(text) {
    currentNarration.value = substituteVariables(text)
    currentSpeaker.value = ''
    currentDialogue.value = ''
    addToHistory({ type: 'narration', speaker: '', text: currentNarration.value, stepIndex: stepIndex.value })
  }

  function showTitle(step) {
    if (titleTimeout) { clearTimeout(titleTimeout); titleTimeout = null }
    currentTitle.value = substituteVariables(step.text)
    currentTitleEffects.value = {
      effectStart: step['effect-start'] || null,
      effect: step.effect || null,
      effectEnd: step['effect-end'] || null,
      typewriter: step.typewriter || false,
      duration: step.duration || 0
    }
    currentDialogue.value = ''
    currentNarration.value = ''
    currentSpeaker.value = ''
    currentChoices.value = []
    addToHistory({ type: 'titles', speaker: '', text: currentTitle.value, stepIndex: stepIndex.value })
    if (step.duration && typeof step.duration === 'number' && step.duration > 0) {
      titleTimeout = setTimeout(() => { titleTimeout = null; advanceStory() }, step.duration)
    }
  }

  function showTextInput(step) {
    currentDialogue.value = ''
    currentNarration.value = ''
    currentSpeaker.value = ''
    currentChoices.value = []
    currentInputStep.value = step
    showTextInputModal.value = true
  }

  function rebuildEquipmentBySlot(characterId) {
    const char = characterData.value[characterId]
    if (!char) return

    const equipmentMap = {}
    if (Array.isArray(char.equipment)) char.equipment.forEach(item => { if (item && item.id) equipmentMap[item.id] = item })

    const equipmentBySlot = {}
    const slots = char.equipment_slots || {}
    for (const [slotName, itemRef] of Object.entries(slots)) {
      let itemId = null
      if (itemRef === null || typeof itemRef === 'undefined') itemId = null
      else if (typeof itemRef === 'string' || typeof itemRef === 'number') itemId = itemRef
      else if (typeof itemRef === 'object' && itemRef.id) itemId = itemRef.id
      else if (typeof itemRef === 'object' && itemRef.item && itemRef.item.id) itemId = itemRef.item.id
      if (itemId && equipmentMap[itemId]) {
        equipmentBySlot[slotName] = { id: itemId, item: equipmentMap[itemId], parts: equipmentMap[itemId].parts || [] }
      }
    }

    char.equipmentBySlot = equipmentBySlot
  }

  function updateCharacterData(variablePath, value) {
    const parts = variablePath.split('.')
    if (parts[0] === 'character' && parts.length >= 3) {
      const characterId = parts[1]
      const propertyPath = parts.slice(2)
      if (characterData.value[characterId]) {
        let target = characterData.value[characterId]
        for (let i = 0; i < propertyPath.length - 1; i++) {
          if (!target[propertyPath[i]]) target[propertyPath[i]] = {}
          target = target[propertyPath[i]]
        }
        const finalProperty = propertyPath[propertyPath.length - 1]
        target[finalProperty] = value
        if (propertyPath[0] === 'equipment_slots' || finalProperty === 'equipment_slots' || propertyPath.includes('equipment_slots')) rebuildEquipmentBySlot(characterId)
      }
    }
  }

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
      return { container: target, key: propertyPath[propertyPath.length - 1], root: 'character', id: characterId }
    }
    if (root === 'global' && parts.length >= 2) {
      const propertyPath = parts.slice(1)
      let target = globalData.value
      for (let i = 0; i < propertyPath.length - 1; i++) {
        if (target[propertyPath[i]] === undefined) target[propertyPath[i]] = {}
        target = target[propertyPath[i]]
      }
      return { container: target, key: propertyPath[propertyPath.length - 1], root: 'global' }
    }
    return null
  }

  function applyVariable(expr) {
    if (!expr || typeof expr !== 'string') return
    const m = expr.match(/^\s*([a-zA-Z0-9_\.]+)\s*(\+=|-=|=|\*=|\/=)\s*(.+)\s*$/)
    if (!m) { console.warn('Unsupported variable expression:', expr); return }
    const targetPath = m[1]
    const op = m[2]
    const rhsRaw = m[3]

    const resolved = resolvePath(targetPath)
    if (!resolved) { console.warn('Could not resolve target path for variable:', targetPath); return }

    let rhsValue = null
    const num = Number(rhsRaw)
    if (!isNaN(num) && rhsRaw.trim() !== '') rhsValue = num
    else {
      const strMatch = rhsRaw.match(/^['"]([\s\S]*)['"]$/)
      if (strMatch) rhsValue = strMatch[1]
      else {
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
      case '=': newValue = rhsValue; break
      case '+=': newValue = (typeof current === 'number' ? current : Number(current) || 0) + (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0); break
      case '-=': newValue = (typeof current === 'number' ? current : Number(current) || 0) - (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0); break
      case '*=': newValue = (typeof current === 'number' ? current : Number(current) || 0) * (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 0); break
      case '/=': newValue = (typeof current === 'number' ? current : Number(current) || 0) / (typeof rhsValue === 'number' ? rhsValue : Number(rhsValue) || 1); break
      default: newValue = rhsValue
    }

    container[key] = newValue
    if (resolved.root === 'character') {
      console.log(`Applied variable: ${expr} -> ${resolved.id}.${key} =`, newValue)
      updateCharacterData(targetPath, newValue)
    } else {
      console.log(`Applied global variable: ${expr} -> ${targetPath} =`, newValue)
    }
  }

  function substituteVariables(text) {
    if (!text) return ''
    return text.replace(/\{([^}]+)\}/g, (match, variablePath) => {
      const parts = variablePath.split('.')
      if (parts[0] === 'character' && parts.length >= 3) {
        const characterId = parts[1]
        const propertyPath = parts.slice(2)
        if (characterData.value[characterId]) {
          let target = characterData.value[characterId]
          for (let i = 0; i < propertyPath.length; i++) {
            if (target[propertyPath[i]] === undefined) return match
            target = target[propertyPath[i]]
          }
          return target || ''
        }
      }
      if (parts[0] === 'global' && parts.length >= 2) {
        const propertyPath = parts.slice(1)
        let target = globalData.value
        for (let i = 0; i < propertyPath.length; i++) {
          if (target[propertyPath[i]] === undefined) return match
          target = target[propertyPath[i]]
        }
        return target || ''
      }
      return match
    })
  }

  function getInitialValue(variablePath) {
    if (!variablePath) return ''
    const parts = variablePath.split('.')
    if (parts[0] === 'character' && parts.length >= 3) {
      const characterId = parts[1]
      const propertyPath = parts.slice(2)
      if (characterData.value[characterId]) {
        let target = characterData.value[characterId]
        for (let i = 0; i < propertyPath.length; i++) {
          if (target[propertyPath[i]] === undefined) return ''
          target = target[propertyPath[i]]
        }
        return target || ''
      }
    }
    return ''
  }

  function onTextInputConfirm(value) {
    if (currentInputStep.value?.variable) updateCharacterData(currentInputStep.value.variable, value)
    showTextInputModal.value = false
    currentInputStep.value = null
    stepIndex.value++
    processStep()
  }

  function showChoices(choiceStep) {
    currentChoices.value = choiceStep.options.map(option => ({ ...option, text: substituteVariables(option.text) }))
    currentSpeaker.value = choiceStep.speaker ? characterData.value[choiceStep.speaker]?.name : ''
    if (choiceStep.text) currentDialogue.value = substituteVariables(choiceStep.text)
  }

  function selectChoice(index) {
    const choice = currentChoices.value[index]
    if (choice.actions) processChoiceActions(choice.actions)
    else {
      currentChoices.value = []
      currentDialogue.value = ''
      currentNarration.value = ''
      stepIndex.value++
      processStep()
    }
  }

  function processChoiceActions(actions) {
    let tempIndex = 0
    function processAction() {
      if (tempIndex >= actions.length) { stepIndex.value++; processStep(); return }
      const action = actions[tempIndex]; tempIndex++
      switch (action.type) {
        case 'dialogue':
          const remaining = actions.slice(tempIndex)
          currentChoices.value = []
          if (action.character) showDialogue(action.character, action.text)
          else showNarration(action.text)
          advanceStoryOverride = function() {
            currentDialogue.value = ''
            currentNarration.value = ''
            if (remaining.length > 0) processChoiceActions(remaining)
            else { stepIndex.value++; processStep() }
            advanceStoryOverride = null
          }
          break
        case 'goto':
          currentDialogue.value = ''
          currentNarration.value = ''
          currentSpeaker.value = ''
          currentChoices.value = []
          goToLabel(action.target)
          break
        case 'show': showCharacter(action.character); processAction(); break
        case 'hide': hideCharacter(action.character); processAction(); break
        default: processAction(); break
      }
    }
    processAction()
  }

  function goToLabel(targetLabel) {
    currentDialogue.value = ''
    currentNarration.value = ''
    currentSpeaker.value = ''
    currentChoices.value = []
    const targetStepIndex = storyData.value.steps.findIndex(step => step.id === targetLabel)
    if (targetStepIndex !== -1) { stepIndex.value = targetStepIndex; processStep(); return }
    callStack.value.push({ storyId: storyData.value.id, stepIndex: stepIndex.value + 1 })
    loadTargetStory(targetLabel)
  }

  function handleContinue() {
    if (callStack.value.length > 0) {
      const returnPosition = callStack.value.pop()
      loadReturnStory(returnPosition.storyId, returnPosition.stepIndex)
    } else emit && emit('end')
  }

  async function loadTargetStory(storyName) {
    try {
      const module = await loadDataFromPublic(`/data/story/ru/${storyName}.json`)
      storyData.value = module
      currentDialogue.value = ''
      currentNarration.value = ''
      currentSpeaker.value = ''
      currentChoices.value = []
      stepIndex.value = 0
      processStep()
    } catch (error) { console.error('Error loading target story:', error); emit && emit('end') }
  }

  async function loadReturnStory(storyName, returnStepIndex) {
    try {
      const module = await loadDataFromPublic(`/data/story/ru/${storyName}.json`)
      storyData.value = module
      currentDialogue.value = ''
      currentNarration.value = ''
      currentSpeaker.value = ''
      currentChoices.value = []
      stepIndex.value = returnStepIndex
      processStep()
    } catch (error) { console.error('Error loading return story:', error); emit && emit('end') }
  }

  function advanceStory() {
    if (advanceStoryOverride) { const f = advanceStoryOverride; advanceStoryOverride = null; try { f() } catch (e) { console.error('Error in override:', e); currentDialogue.value=''; currentNarration.value=''; stepIndex.value++; processStep() } return }
    currentTitle.value = ''
    currentTitleEffects.value = null
    if (titleTimeout) { clearTimeout(titleTimeout); titleTimeout = null }
    currentDialogue.value = ''
    currentNarration.value = ''
    isRestoringGameState.value = false
    stepIndex.value++
    processStep()
  }

  function getGameState() {
    // Save only active looping streams (that should resume on load)
    const activeLoopingStreams = {}
    Object.entries(audioStreams.value).forEach(([streamId, stream]) => {
      if (stream.loop) {
        activeLoopingStreams[streamId] = { ...stream }
      }
    })
    console.log('💾 getGameState called, saving audio streams:', Object.keys(activeLoopingStreams))
    
    return {
      storyData: storyData.value,
      stepIndex: stepIndex.value,
      callStack: callStack.value,
      globalData: globalData.value,
      characterData: characterData.value,
      visibleCharacters: visibleCharacters.value.map(c => c.id),
      currentScene: currentScene.value?.id,
      history: historyEntries.value.slice(),
      audioStreams: activeLoopingStreams
    }
  }

  async function restoreGameState(saveData) {
    try {
      if (!isLoaded.value) { if (loadingPromise) await loadingPromise; else await loadStory() }
      isRestoringGameState.value = true
      globalData.value = saveData.globalData
      if (saveData.characterDataDelta) {
        Object.keys(saveData.characterDataDelta).forEach(characterId => {
          if (characterData.value[characterId]) Object.assign(characterData.value[characterId], saveData.characterDataDelta[characterId])
        })
      }
      if (saveData.characterData && !saveData.characterDataDelta) {
        Object.keys(saveData.characterData).forEach(characterId => { if (characterData.value[characterId]) Object.assign(characterData.value[characterId], saveData.characterData[characterId]) })
      }
      visibleCharacters.value = []
      if (saveData.visibleCharacters && Array.isArray(saveData.visibleCharacters)) {
        saveData.visibleCharacters.forEach(characterId => { const character = characterData.value[characterId]; if (character) visibleCharacters.value.push(character) })
      }
      if (saveData.currentScene && sceneData.value[saveData.currentScene]) currentScene.value = sceneData.value[saveData.currentScene]
      Object.keys(characterData.value).forEach(charId => { rebuildEquipmentBySlot(charId) })
      currentDialogue.value = ''
      currentNarration.value = ''
      currentTitle.value = ''
      if (titleTimeout) { clearTimeout(titleTimeout); titleTimeout = null }
      currentSpeaker.value = ''
      currentChoices.value = []
      callStack.value = saveData.callStack || []

      const storyId = saveData.storyId || 'start'
      const loadedStory = await loadDataFromPublic(`/data/story/ru/${storyId}.json`)
      storyData.value = loadedStory
      stepIndex.value = saveData.stepIndex || 0

      if (saveData.history && Array.isArray(saveData.history)) historyEntries.value = saveData.history.slice(-HISTORY_MAX)
      else {
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
            case 'titles': historyEntries.value.push({ type: 'titles', speaker: '', text: substituteVariables(s.text || ''), stepIndex: i }); break
            default: break
          }
        }
        if (historyEntries.value.length > HISTORY_MAX) historyEntries.value = historyEntries.value.slice(-HISTORY_MAX)
      }

      // Restore audio streams (only looping ones)
      audioStreams.value = {}
      if (saveData.audioStreams && typeof saveData.audioStreams === 'object') {
        Object.entries(saveData.audioStreams).forEach(([streamId, stream]) => {
          if (stream && stream.loop) {
            console.log(`🔄 Restoring audio stream: ${streamId}`)
            audioStreams.value[streamId] = stream
          }
        })
      }

      processStep()
    } catch (error) { console.error('Error restoring game state:', error); isRestoringGameState.value = false; throw error }
  }

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
    audioStreams.value = {}
    pausedStreams.value = {}
  }

  return {
    // state
    currentScene, visibleCharacters, currentDialogue, currentNarration, currentTitle, currentTitleEffects, currentSpeaker, currentChoices,
    showTextInputModal, currentInputStep,
    // audio state
    currentSound, currentVoice, currentMusic, audioStreams,
    // methods
    loadStory, processStep, advanceStory, selectChoice, getGameState, restoreGameState, resetGameState,
    getInitialValue, onTextInputConfirm,
    // audio methods
    playSound, playVoice, playMusic, stopSound, stopVoice, stopMusic,
    stopStream, stopAllStreams, getStream, pauseAllStreams, resumeAllStreams,
    // history helpers
    getHistory: () => historyEntries.value.slice(),
    clearHistory: () => { historyEntries.value = [] }
  }
}
