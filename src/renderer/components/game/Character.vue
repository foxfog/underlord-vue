<template>
  <div
	:key="character.id"
	class="char"
	:class="`char-${character.id}`"
	:style="characterStyle"
  >
  <div class="char-body" ref="charBodyRef">
		<!-- Base body sprites -->
		<template v-for="(sprite, spriteName) in spritesByParent[null]" :key="spriteName">
			<SpritePart 
				:sprite="sprite" 
				:sprite-name="spriteName"
				:character-id="character.id"
				:sprites="character.sprites"
				:sprites-by-parent="spritesByParent"
				:equipment-by-slot="character.equipmentBySlot"
			/>
		</template>
	</div>
  </div>
</template>


<script setup>
import { defineProps, computed, ref, onMounted, onUnmounted } from 'vue'
import SpritePart from './SpritePart.vue'

const props = defineProps({
  character: {
    type: Object,
    required: true
  }
})

const charBodyRef = ref(null)

// Compute positioning style from character.position object
const characterStyle = computed(() => {
  const style = {
    scale: props.character.scale || props.character.size || 1
  }
  
  // Map position aliases to CSS properties
  if (props.character.position) {
    const posMap = {
      l: 'left',
      r: 'right',
      t: 'top',
      b: 'bottom'
    }
    
    for (const [alias, cssProp] of Object.entries(posMap)) {
      if (props.character.position[alias] !== undefined) {
        const value = props.character.position[alias]
        // Add % if value is a number
        style[cssProp] = typeof value === 'number' ? `${value}%` : value
      }
    }
  }
  
  return style
})

onMounted(() => {
  if (!charBodyRef.value) return

  const updateCharHeight = () => {
    const height = charBodyRef.value.offsetHeight
    charBodyRef.value.parentElement.style.setProperty('--char-height', `${height}px`)
  }

  // Первый вызов
  updateCharHeight()

  // ResizeObserver для отслеживания изменений размера
  const resizeObserver = new ResizeObserver(() => {
    updateCharHeight()
  })

  resizeObserver.observe(charBodyRef.value)

  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})


// Группируем части тела по их родителю для быстрого доступа
const spritesByParent = computed(() => {
  const grouped = { null: {} }
  
  if (!props.character.sprites) {
    return grouped
  }
  
  // Инициализируем группы для каждого parent
  for (const spriteName in props.character.sprites) {
    const sprite = props.character.sprites[spriteName]
    const parent = sprite.parent || null
    
    if (!grouped[parent]) {
      grouped[parent] = {}
    }
  }
  
  // Распределяем спрайты по группам parent
  for (const spriteName in props.character.sprites) {
    const sprite = props.character.sprites[spriteName]
    const parent = sprite.parent || null
    grouped[parent][spriteName] = sprite
  }
  
  return grouped
})
</script>

