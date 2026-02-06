<!-- src/renderer/components/game/visual-novel/TitleBlock.vue -->

<template>
  <div class="title-box" v-if="title" @click="handleClick">
    <div 
      class="title-content" 
      :class="appliedClasses"
      :style="cssVariables"
      ref="titleContentRef"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
  title: { type: String, default: '' },
  effects: { type: Object, default: null }
})

const emit = defineEmits(['advance'])

const store = useSettingsStore()
const titleContentRef = ref(null)
const appliedClasses = ref('')
const isPlayingEffectEnd = ref(false)
let effectEndTimeout = null
let effectStartTimeout = null
let typewriterTimeout = null
let isTypewriting = false

// Calculate duration per character based on text speed
const charDuration = computed(() => {
  const speed = store.general.textSpeed || 100
  return Math.round((101 - speed) * 1.6 + 20)
})

// Watch for title changes
watch(() => props.title, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (titleContentRef.value) {
        titleContentRef.value.innerHTML = ''
        if (props.effects?.typewriter) {
          startTypewriter(titleContentRef.value, newVal)
        } else {
          titleContentRef.value.innerHTML = newVal
        }
        startEffectSequence()
      }
    })
  }
})

const cssVariables = computed(() => {
  if (!props.effects) return {}
  
  const vars = {}
  
  // effect-start variables
  if (props.effects.effectStart) {
    if (props.effects.effectStart.duration) {
      vars['--duration-start'] = `${props.effects.effectStart.duration}ms`
    }
    if (props.effects.effectStart.delay) {
      vars['--delay-start'] = `${props.effects.effectStart.delay}ms`
    }
  }
  
  // effect variables
  if (props.effects.effect) {
    if (props.effects.effect.duration) {
      vars['--duration'] = `${props.effects.effect.duration}ms`
    }
    if (props.effects.effect.delay) {
      vars['--delay'] = `${props.effects.effect.delay}ms`
    }
    // Default to infinite repeat if not specified
    vars['--repeat'] = props.effects.effect.repeat ?? 'infinite'
  }
  
  // effect-end variables
  if (props.effects.effectEnd) {
    if (props.effects.effectEnd.duration) {
      vars['--duration-end'] = `${props.effects.effectEnd.duration}ms`
    }
    if (props.effects.effectEnd.delay) {
      vars['--delay-end'] = `${props.effects.effectEnd.delay}ms`
    }
  }
  
  return vars
})

function startTypewriter(element, htmlText) {
  if (!element || !htmlText) return
  
  isTypewriting = true
  clearTimeout(typewriterTimeout)
  
  // If speed is 100, show all text immediately
  if (store.general.textSpeed === 100) {
    element.innerHTML = htmlText
    isTypewriting = false
    return
  }
  
  // Get plain text to count characters
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = htmlText
  const plainText = tempDiv.textContent || tempDiv.innerText || ''
  
  typeCharByChar(element, htmlText, plainText, 0)
}

function typeCharByChar(element, htmlText, plainText, charIndex) {
  if (charIndex <= plainText.length) {
    // Build HTML with visible characters
    const displayHTML = buildVisibleHTML(htmlText, charIndex)
    element.innerHTML = displayHTML
    
    typewriterTimeout = setTimeout(() => {
      typeCharByChar(element, htmlText, plainText, charIndex + 1)
    }, charDuration.value)
  } else {
    isTypewriting = false
  }
}

function buildVisibleHTML(html, visibleCharCount) {
  const wrapper = document.createElement('div')
  wrapper.innerHTML = html
  
  let charCount = 0
  let shouldStop = false
  
  // Traverse and count/truncate
  const traverse = (node) => {
    if (shouldStop) return
    
    const children = Array.from(node.childNodes)
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      
      if (child.nodeType === 3) { // TEXT_NODE
        const text = child.textContent
        const charsNeeded = visibleCharCount - charCount
        
        if (charsNeeded <= 0) {
          // Remove this node - we're past the visible limit
          child.remove()
        } else if (charsNeeded >= text.length) {
          // Keep entire node
          charCount += text.length
        } else {
          // Truncate this text node
          child.textContent = text.substring(0, charsNeeded)
          charCount += charsNeeded
          shouldStop = true
          
          // Remove all siblings after this
          for (let j = i + 1; j < children.length; j++) {
            children[j].remove()
          }
          return
        }
      } else if (child.nodeType === 1) { // ELEMENT_NODE
        traverse(child)
        if (shouldStop) {
          // Remove all siblings after current element if we're done
          for (let j = i + 1; j < children.length; j++) {
            children[j].remove()
          }
          return
        }
      }
    }
  }
  
  traverse(wrapper)
  return wrapper.innerHTML
}

// Watch effects changes and restart animation sequence
watch(() => props.effects, () => {
  startEffectSequence()
}, { deep: true })

function startEffectSequence() {
  // Clear any pending timeouts
  if (effectEndTimeout) clearTimeout(effectEndTimeout)
  if (effectStartTimeout) clearTimeout(effectStartTimeout)
  isPlayingEffectEnd.value = false
  
  if (!props.effects) return
  
  // Apply effect-start first
  if (props.effects.effectStart) {
    appliedClasses.value = props.effects.effectStart.class || ''
    
    const startDuration = props.effects.effectStart.duration || 0
    
    // After effect-start completes, switch to main effect
    effectStartTimeout = setTimeout(() => {
      if (props.effects.effect) {
        appliedClasses.value = props.effects.effect.class || ''
      } else {
        appliedClasses.value = ''
      }
    }, startDuration)
  } else if (props.effects.effect) {
    // No effect-start, apply main effect directly
    appliedClasses.value = props.effects.effect.class || ''
  }
}

onMounted(() => {
  if (titleContentRef.value) {
    if (props.effects?.typewriter) {
      startTypewriter(titleContentRef.value, props.title)
    } else {
      titleContentRef.value.innerHTML = props.title
    }
    startEffectSequence()
  }
})

function handleClick() {
  // If typewriting is active, skip to end
  if (isTypewriting) {
    clearTimeout(typewriterTimeout)
    isTypewriting = false
    
    // Show full text immediately
    if (titleContentRef.value) {
      titleContentRef.value.innerHTML = props.title
    }
    return
  }
  
  // If already playing effect-end, skip to the end immediately
  if (isPlayingEffectEnd.value) {
    if (effectEndTimeout) clearTimeout(effectEndTimeout)
    isPlayingEffectEnd.value = false
    appliedClasses.value = ''
    emit('advance')
    return
  }
  
  // Cancel any pending transitions
  if (effectStartTimeout) clearTimeout(effectStartTimeout)
  
  // If there's an effect-end, play it before advancing
  if (props.effects?.effectEnd) {
    isPlayingEffectEnd.value = true
    appliedClasses.value = props.effects.effectEnd.class || ''
    
    const endDuration = props.effects.effectEnd.duration || 0
    effectEndTimeout = setTimeout(() => {
      isPlayingEffectEnd.value = false
      appliedClasses.value = ''
      emit('advance')
    }, endDuration)
  } else {
    emit('advance')
  }
}

// Cleanup on unmount
onBeforeUnmount(() => {
  if (effectEndTimeout) clearTimeout(effectEndTimeout)
  if (effectStartTimeout) clearTimeout(effectStartTimeout)
  if (typewriterTimeout) clearTimeout(typewriterTimeout)
})
</script>

<style scoped>
.title-box {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  cursor: pointer;
  padding: 20px;
}

.title-content {
  font-size: 2em;
  text-align: center;
  color: #fff;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
}
</style>
