<template>
	<div class="tile-char" :data-char-id="characterId">
		<div class="char-nickname" v-if="translatedData.nickname">
			{{ translatedData.nickname }}
		</div>
		<div class="char-obj">
			<div>
				<img :src="characterImage" :alt="translatedData.name || characterName" class="char-img" />
			</div>
		</div>
		<div class="char-buttons">
			<button class="char-info-btn" @click="logCharacterData">Info</button>
			<button class="char-edit-btn" @click="openEditModal">Edit</button>
		</div>
		
		<!-- Character Edit Modal -->
		<div v-if="showEditModal" class="char-edit-modal" @click="closeEditModal">
			<div class="modal-content" @click.stop>
				<h3>Edit Character: {{ translatedData.name }}</h3>
				<div class="attribute-list">
					<div v-for="(value, key) in characterAttributes" :key="key" class="attribute-item">
						<label>{{ key }}:</label>
						<input v-model="characterAttributes[key]" type="number" />
					</div>
				</div>
				<div class="modal-buttons">
					<button @click="saveAttributes">Save</button>
					<button @click="closeEditModal">Close</button>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref, reactive, onMounted } from 'vue'
	import { useI18n } from 'vue-i18n'
	import { resolveImagePath } from '@/utils/imageLoader.js'
	import { loadCharacterById } from '@/utils/characterLoader.js'
	
	const { t } = useI18n()
	
	const props = defineProps({
		characterId: {
			type: String,
			required: true
		},
		characterName: {
			type: String,
			default: 'Character'
		}
	})
	
	const emit = defineEmits(['character-updated'])
	
	// Reactive references
	const characterData = ref(null)
	const characterImage = ref(resolveImagePath('/images/char/default/tile/char.png'))
	const showEditModal = ref(false)
	const characterAttributes = reactive({})
	
	// Translated data
	const translatedData = ref({
		name: '',
		surname: '',
		title: '',
		nickname: ''
	})
	
	// Load character data when component is mounted
	onMounted(async () => {
		await loadCharacterData()
	})
	
	// Load character data
	const loadCharacterData = async () => {
		try {
			// Force reload character data bypassing cache
			const data = await loadCharacterById(props.characterId)
			characterData.value = data
			
			// Process translations
			if (data) {
				translatedData.value = {
					name: data.name ? processTranslation(data.name) : '',
					surname: data.surname ? processTranslation(data.surname) : '',
					title: data.title ? processTranslation(data.title) : '',
					nickname: data.nickname ? processTranslation(data.nickname) : ''
				}
				
				// Set the image path based on loaded data
				if (data.tile && data.tile.front && data.tile.front.body && data.tile.front.body.torso) {
					characterImage.value = resolveImagePath(data.tile.front.body.torso)
				} else {
					characterImage.value = resolveImagePath('/images/char/default/tile/char.png')
				}
				
				// Initialize attributes for editing
				if (data.attributes) {
					Object.keys(data.attributes).forEach(key => {
						characterAttributes[key] = data.attributes[key]
					})
				}
			}
		} catch (error) {
			console.error('Error loading character data:', error)
		}
	}
	
	// Process translation keys
	const processTranslation = (text) => {
		if (text && text.startsWith('{') && text.endsWith('}')) {
			const key = text.slice(1, -1)
			return t(key)
		}
		return text
	}
	
	// Log character data to console
	const logCharacterData = async () => {
		try {
			const data = await loadCharacterById(props.characterId)
			// Process translations for console output
			const processedData = { ...data }
			if (processedData.name) processedData.name = processTranslation(processedData.name)
			if (processedData.surname) processedData.surname = processTranslation(processedData.surname)
			if (processedData.title) processedData.title = processTranslation(processedData.title)
			if (processedData.nickname) processedData.nickname = processTranslation(processedData.nickname)
			
			console.log('Character Data:', processedData)
		} catch (error) {
			console.error('Error loading character data:', error)
		}
	}
	
	// Open edit modal
	const openEditModal = () => {
		showEditModal.value = true
	}
	
	// Close edit modal
	const closeEditModal = () => {
		showEditModal.value = false
	}
	
	// Save attributes (for testing purposes)
	const saveAttributes = () => {
		console.log('Saving attributes:', characterAttributes)
		// In a real implementation, this would update a character store
		emit('character-updated', {
			characterId: props.characterId,
			attributes: { ...characterAttributes }
		})
		closeEditModal()
	}
</script>

<style scoped>
	.tile-char {
		position: absolute;
		width: 100%;
		height: 100%;
		z-index: 5; /* Characters should be above objects but below UI */
		pointer-events: none;
	}
	
	.char-nickname {
		position: absolute;
		top: -20px;
		left: 50%;
		transform: translateX(-50%);
		background-color: rgba(0, 0, 0, 0.7);
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		white-space: nowrap;
		pointer-events: none;
		z-index: 10;
	}
	
	.char-obj {
		position: absolute;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.char-img {
		width: 80%; /* Adjust size as needed */
		height: auto;
		object-fit: contain;
		display: block;
		position: absolute;
		bottom: 0; /* Align character to bottom of tile */
	}
	
	.char-buttons {
		position: absolute;
		top: 5px;
		right: 5px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		pointer-events: none;
	}
	
	.char-info-btn,
	.char-edit-btn {
		background-color: rgba(0, 0, 0, 0.7);
		color: white;
		border: 1px solid white;
		border-radius: 3px;
		padding: 2px 5px;
		font-size: 10px;
		cursor: pointer;
		pointer-events: auto;
		z-index: 10;
	}
	
	.char-info-btn:hover,
	.char-edit-btn:hover {
		background-color: rgba(50, 50, 50, 0.9);
	}
	
	/* Modal styles */
	.char-edit-modal {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}
	
	.modal-content {
		background-color: white;
		padding: 20px;
		border-radius: 5px;
		max-width: 400px;
		width: 90%;
		color: black;
	}
	
	.attribute-list {
		margin: 15px 0;
	}
	
	.attribute-item {
		display: flex;
		justify-content: space-between;
		margin: 5px 0;
	}
	
	.attribute-item label {
		font-weight: bold;
	}
	
	.attribute-item input {
		width: 60px;
		padding: 3px;
	}
	
	.modal-buttons {
		display: flex;
		justify-content: space-between;
		margin-top: 15px;
	}
	
	.modal-buttons button {
		padding: 5px 15px;
	}
</style>