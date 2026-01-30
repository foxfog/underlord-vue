<template>
  <div
	:key="character.id"
	class="char"
	:class="`char-${character.id}`"
	:style="{ scale: character.scale || character.size || 1 }"
  >
	<div class="char-body">
		<template v-for="(sprite, spriteName) in spritesByParent[null]" :key="spriteName">
			<SpritePart 
				:sprite="sprite" 
				:sprite-name="spriteName"
				:character-id="character.id"
				:sprites="character.sprites"
				:sprites-by-parent="spritesByParent"
			/>
		</template>
	</div>
  </div>
</template>


<script setup>
import { defineProps, computed } from 'vue'
import SpritePart from './SpritePart.vue'

const props = defineProps({
  character: {
    type: Object,
    required: true
  }
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

<style>
	.char {
		position: absolute;
		height: 100dvh;
		width: fit-content;
		left: 0;
		right: 0;
		margin: auto;
		transform-origin: center 85%;
		.char-body {
			position: relative;
			height: 100dvh;
			width: fit-content;
			.char-part {
				width: fit-content;
				transform-origin: center center;
				margin: auto;
				&:not(._body) {
					position: absolute;
					height: calc(var(--charspriteH) / var(--charbodyspriteH) * 100dvh);
					right: 0;
                	bottom: 0;
				}
				&._body {
					height: 100%;
					position: relative;
				}
				.char-part-sprite {
					position: relative;
					width: auto;
					height: 100%;
					.sprite-image {
						height: 100%;
						width: auto;
						position: relative;
					}
				}
			}
		}
	}
</style>
