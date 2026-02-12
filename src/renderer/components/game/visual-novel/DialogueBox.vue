<template>
	<div class="dialogue-box" v-if="dialogue || narration || choices.length > 0">
		<div class="dialogue-in">
			<div class="speaker" v-if="speaker">{{ speaker }}</div>
			<div 
				v-if="dialogue" 
				class="dialogue-text" 
				ref="dialogueTextRef"
				@click="skipTypewriter"
			></div>
			<div 
				v-if="narration" 
				class="dialogue-text _narration" 
				ref="narrationTextRef"
				@click="skipTypewriter"
			></div>

			<div class="choices" v-if="choices.length > 0">
				<button v-for="(choice, index) in choices" :key="index" @click="$emit('selectChoice', index)" class="choice-btn">
					{{ choice.text }}
				</button>
			</div>
		</div>
		<button v-if="!choices.length && (dialogue || narration)" @click="$emit('advance')" class="hidden-continue"></button>
		<button v-if="!choices.length && (dialogue || narration)" @click="$emit('advance')" class="continue-btn btn btn-primary"><i class="icon-arrow-right"></i></button>
	</div>
</template>

<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps({
	dialogue: { type: String, default: '' },
	narration: { type: String, default: '' },
	speaker: { type: String, default: '' },
	choices: { type: Array, default: () => [] },
	multiStepPrintedLength: { type: Number, default: 0 }
})

const emit = defineEmits(['advance', 'selectChoice'])

const store = useSettingsStore()
const dialogueTextRef = ref(null)
const narrationTextRef = ref(null)
let typewriterTimeout = null
let isTypewriting = false
let lastPrintedLength = 0 // Track the last printed length to continue from there
let lastDialogueValue = '' // Track the last dialogue value to detect new dialogues

// Calculate duration per character based on text speed
// Ren'Py-like speed scale:
// 100 = ~20ms per char (fast, ~50 chars/sec)
// 50 = ~100ms per char (normal, ~10 chars/sec)
// 1 = ~180ms per char (slow, ~5 chars/sec)
const charDuration = computed(() => {
	const speed = store.general.textSpeed || 100
	return Math.round((101 - speed) * 1.6 + 20)
})

function skipTypewriter() {
	if (isTypewriting) {
		clearTimeout(typewriterTimeout)
		isTypewriting = false
		
		// Show full text immediately
		if (props.dialogue && dialogueTextRef.value) {
			dialogueTextRef.value.innerHTML = props.dialogue
		}
		if (props.narration && narrationTextRef.value) {
			narrationTextRef.value.innerHTML = props.narration
		}
	}
}

function startTypewriter(element, htmlText) {
	if (!element || !htmlText) return
	
	isTypewriting = true
	clearTimeout(typewriterTimeout)
	
	// If speed is 100, show all text immediately
	if (store.general.textSpeed === 100) {
		element.innerHTML = htmlText
		isTypewriting = false
		lastPrintedLength = htmlText.length
		return
	}
	
	// Get plain text to count characters
	const tempDiv = document.createElement('div')
	tempDiv.innerHTML = htmlText
	const plainText = tempDiv.textContent || tempDiv.innerText || ''
	
	// Determine starting position
	// If multiStepPrintedLength > 0, we're in a multi-step dialogue
	// Show the already-printed part, then continue from there
	const startCharIndex = props.multiStepPrintedLength > 0 ? props.multiStepPrintedLength : 0
	
	console.log('🖤 Starting typewriter for text:', plainText.substring(0, 50))
	console.log('   Total chars:', plainText.length, 'Starting from:', startCharIndex, 'Speed:', store.general.textSpeed, 'Duration per char:', charDuration.value)
	
	// If continuing from a previous step, show the already-printed part first
	if (startCharIndex > 0) {
		const displayHTML = buildVisibleHTML(htmlText, startCharIndex)
		element.innerHTML = displayHTML
		lastPrintedLength = startCharIndex
		console.log('🖤 Showing already-printed part, startCharIndex:', startCharIndex)
	}
	
	typeCharByChar(element, htmlText, plainText, startCharIndex)
}

function typeCharByChar(element, htmlText, plainText, charIndex) {
	if (charIndex <= plainText.length) {
		// Get visible portion by counting plain text chars
		const visibleChars = plainText.substring(0, charIndex)
		lastPrintedLength = charIndex
		
		// Build HTML with visible characters
		const displayHTML = buildVisibleHTML(htmlText, charIndex)
		element.innerHTML = displayHTML
		
		typewriterTimeout = setTimeout(() => {
			typeCharByChar(element, htmlText, plainText, charIndex + 1)
		}, charDuration.value)
	} else {
		isTypewriting = false
		console.log('🖤 Typewriter finished')
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

// Watch for dialogue changes
watch(() => props.dialogue, (newVal) => {
	if (newVal) {
		nextTick(() => {
			if (dialogueTextRef.value) {
				// Check if this is a completely new dialogue (not a continuation)
				const isNewDialogue = newVal !== lastDialogueValue && props.multiStepPrintedLength === 0
				
				if (isNewDialogue) {
					// New dialogue - clear the element and reset tracking
					dialogueTextRef.value.innerHTML = ''
					lastPrintedLength = 0
					console.log('🖤 [Watch] New dialogue starting, clearing element')
				} else if (props.multiStepPrintedLength > 0) {
					// Continuation of multi-step dialogue - don't clear
					console.log('🖤 [Watch] Multi-step continuation, keeping existing text. multiStepPrintedLength:', props.multiStepPrintedLength)
				} else {
					console.log('🖤 [Watch] Dialogue changed but conditions unclear. isNew:', isNewDialogue, 'printed:', props.multiStepPrintedLength)
				}
				
				lastDialogueValue = newVal
				startTypewriter(dialogueTextRef.value, newVal)
			}
		})
	}
}, { immediate: true })

// Watch for narration changes
watch(() => props.narration, (newVal) => {
	if (newVal) {
		nextTick(() => {
			if (narrationTextRef.value) {
				// Check if this is a completely new narration (not a continuation)
				const isNewNarration = newVal !== lastDialogueValue && props.multiStepPrintedLength === 0
				
				if (isNewNarration) {
					// New narration - clear the element and reset tracking
					narrationTextRef.value.innerHTML = ''
					lastPrintedLength = 0
					console.log('🖤 New narration starting, clearing element')
				} else if (props.multiStepPrintedLength > 0) {
					// Continuation of multi-step narration - don't clear
					console.log('🖤 Multi-step narration continuation, keeping existing text')
				}
				
				lastDialogueValue = newVal
				startTypewriter(narrationTextRef.value, newVal)
			}
		})
	}
}, { immediate: true })
</script>
