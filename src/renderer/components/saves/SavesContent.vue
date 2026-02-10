<template>
	<div class="saves-content">
		<!-- UI tabs style for both main menu and in-game use -->
		<div class="ui-tabs">
			<div class="ui-tabs-header">
				<button 
					class="ui-tabs-label" 
					:class="{ '__active': activeTab === 'load' }" 
					@click="activeTab = 'load'"
				>
					{{ $t('load') || 'Load' }}
				</button>
				<!-- Save tab only visible during game -->
				<button 
					v-if="inGame"
					class="ui-tabs-label" 
					:class="{ '__active': activeTab === 'save' }" 
					@click="activeTab = 'save'"
				>
					{{ $t('save') || 'Save' }}
				</button>
			</div>
			
			<div class="ui-tabs-content">
				<SavesGrid 
					:mode="activeTab"
					:in-game="inGame"
					:show-pagination="true"
					@load="onLoadGame"
					@save="onSaveGame"
				/>
			</div>
		</div>
	</div>
</template>

<script setup>
import { ref, onBeforeUnmount, onUnmounted, watch } from 'vue'
import { useSavesStore } from '@/stores/saves'
import SavesGrid from './SavesGrid.vue'

const props = defineProps({ 
	inGame: { type: Boolean, default: false },
	initialTab: { type: String, default: 'load', validator: (val) => ['load', 'save'].includes(val) }
})
const emit = defineEmits(['load-request', 'save-request'])
const savesStore = useSavesStore()

const activeTab = ref(props.initialTab)

// Reset to initial tab or 'load' tab when inGame changes or when component is not in-game
watch(() => [props.inGame, props.initialTab], ([newInGame, newInitialTab]) => {
	if (!newInGame) {
		// On main menu, always show load tab
		activeTab.value = 'load'
	} else {
		// In-game: use initialTab if provided
		activeTab.value = newInitialTab || 'load'
	}
})

async function onLoadGame(slot) {
	console.log('Load game from slot:', slot)
	
	try {
		// Load the full save data from store
		const result = await savesStore.loadGame(slot)
		
		if (result.success) {
			console.log('✔ Game loaded from slot', slot)
			// Emit the full save data with gameState
			emit('load-request', { slot, gameState: result.data.gameState })
		} else {
			console.error('Failed to load:', result.error)
			alert(`Failed to load: ${result.error}`)
		}
	} catch (error) {
		console.error('Error loading:', error)
		alert(`Error: ${error.message}`)
	}
}

function onSaveGame(slot) {
	console.log('Save game to slot:', slot)
	if (!props.inGame) {
		alert('Cannot save from main menu')
		return
	}
	// Emit save request for parent to handle (will provide gameState)
	emit('save-request', { slot })
}

onBeforeUnmount(() => {
	console.log('SavesContent before unmount')
})

onUnmounted(() => {
	console.log('SavesContent unmounted - cleaning up')
	activeTab.value = 'load'
})
</script>

