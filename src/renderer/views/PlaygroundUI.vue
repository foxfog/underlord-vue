<template>
	<div class="playground-content">
		<h2>UI</h2>
		<div class="audio-section">
			<div class="player-container">
				<div class="player-info">
					<h3>X2Download</h3>
					<p>Основная музыкальная тема (не останавливает фоновую музыку)</p>
				</div>
				<uiPlayerAudio 
					:src="musicFile" 
					volumeType="music" 
					:audioLook="1"
					:resetOnStop="false"
				/>
			</div>
			
			<div class="player-container">
				<div class="player-info">
					<h3>Random Music</h3>
					<p>Случайная музыка из папки (останавливает фоновую музыку)</p>
				</div>
				<uiPlayerAudio
					:src="''" 
					volumeType="music" 
					:audioLook="1"
					:resetOnStop="true"
					:randomMode="true"
					:audioFolder="'audio/test/music/'"
					:stopBgMusic="true"
				/>
			</div>

			<div class="player-container">
				<div class="player-info">
					<h3>Селектор треков</h3>
					<p>Кликните на кнопку для смены трека в плеере</p>
				</div>
				
				<div class="track-selector">
					<div class="track-buttons">
						<button 
							v-for="(track, index) in predefinedTracks" 
							:key="track.id"
							:class="['track-btn', { 'active': currentTrackId === track.id }]"
							@click="selectTrack(track)"
						>
							<div class="track-number">{{ index + 1 }}</div>
							<div class="track-info">
								<div class="track-title">{{ track.title }}</div>
								<div class="track-artist">{{ track.artist }}</div>
							</div>
						</button>
					</div>
					
					<uiPlayerAudio
						ref="trackSelectorPlayer"
						:src="selectedTrack" 
						volumeType="music" 
						:audioLook="1"
						:resetOnStop="false"
						:stopBgMusic="true"
						:showThumb="false"
					/>
				</div>
			</div>
		</div>
		
		<!-- UiSelect Examples Section -->
		<div class="select-section">
			<h2>UI Select Components</h2>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Single Select</h3>
					<p>Выберите один элемент из списка</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="selectedSingleValue"
						:options="singleSelectOptions"
						placeholder="Choose one option..."
						@change="onSingleSelectChange"
					/>
					<div class="select-result">
						<strong>Selected:</strong> {{ selectedSingleValue || 'Nothing selected' }}
					</div>
				</div>
			</div>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Multi Select</h3>
					<p>Выберите несколько элементов (максимум 3)</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="selectedMultipleValues"
						:options="multiSelectOptions"
						multiple
						:maxSelected="3"
						placeholder="Choose multiple options..."
						@change="onMultiSelectChange"
					/>
					<div class="select-result">
						<strong>Selected:</strong> 
						<span v-if="selectedMultipleValues.length === 0">Nothing selected</span>
						<span v-else>{{ selectedMultipleValues.join(', ') }}</span>
					</div>
				</div>
			</div>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Object Options Select</h3>
					<p>Выбор из объектов с кастомными полями</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="selectedObjectValue"
						:options="objectSelectOptions"
						valueKey="id"
						labelKey="name"
						disabledKey="disabled"
						placeholder="Choose a character..."
						@change="onObjectSelectChange"
					/>
					<div class="select-result">
						<strong>Selected ID:</strong> {{ selectedObjectValue || 'Nothing selected' }}
						<br>
						<strong>Selected Name:</strong> {{ getSelectedObjectName() }}
					</div>
				</div>
			</div>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Disabled Select</h3>
					<p>Пример заблокированного селекта</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="disabledSelectValue"
						:options="['Option 1', 'Option 2', 'Option 3']"
						disabled
						placeholder="This select is disabled"
					/>
				</div>
			</div>
			
			<!-- Slot-based Custom Examples -->
			<div class="select-container">
				<div class="select-info">
					<h3>Custom Slot - Single Select with Emojis</h3>
					<p>Селектор с эмодзи и кастомным контентом</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="emojiSelectValue"
						placeholder="Choose your mood..."
						:customDisplayText="getEmojiDisplayText"
						@change="onEmojiSelectChange"
						class="settings-select"
					>
						<template #options="{ close, selectOption }">
							<div 
								v-for="mood in moodOptions" 
								:key="mood.value"
								class="ui-select-option ui-dropdown-item custom-emoji-option"
								:class="{ '_selected': emojiSelectValue === mood.value }"
								@click="selectOption(mood.value); close()"
							>
								<span class="emoji">{{ mood.emoji }}</span>
								<div class="mood-info">
									<div class="mood-name">{{ mood.label }}</div>
									<div class="mood-description">{{ mood.description }}</div>
								</div>
							</div>
						</template>
					</UiSelect>
					<div class="select-result">
						<strong>Selected:</strong> {{ getSelectedMood() }}
					</div>
				</div>
			</div>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Custom Slot - Multi-Select with Images</h3>
					<p>Мультиселект с изображениями персонажей</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="characterSelectValues"
						multiple
						:maxSelected="3"
						placeholder="Select your team (max 3)..."
						:customDisplayText="getCharacterDisplayText"
						@change="onCharacterSelectChange"
						class="settings-select"
					>
						<template #options="{ close, selectOption, selectedValues, multiple }">
							<div 
								v-for="character in characterOptions" 
								:key="character.value"
								class="ui-select-option ui-dropdown-item custom-character-option"
								:class="{ 
									'_selected': selectedValues.includes(character.value),
									'_disabled': !selectedValues.includes(character.value) && selectedValues.length >= 3
								}"
								@click="selectOption(character.value)"
							>
								<input 
									type="checkbox" 
									:checked="selectedValues.includes(character.value)"
									:disabled="!selectedValues.includes(character.value) && selectedValues.length >= 3"
									class="ui-select-checkbox"
									@click.stop
								/>
								<div class="character-avatar">{{ character.avatar }}</div>
								<div class="character-info">
									<div class="character-name">{{ character.label }}</div>
									<div class="character-class">{{ character.class }}</div>
									<div class="character-power">⚡ {{ character.power }}</div>
								</div>
							</div>
						</template>
					</UiSelect>
					<div class="select-result">
						<strong>Selected Team:</strong> {{ getSelectedCharacters() }}
					</div>
				</div>
			</div>
			
			<div class="select-container">
				<div class="select-info">
					<h3>Custom Slot - Interactive Elements</h3>
					<p>Селект с интерактивными элементами и кнопками</p>
				</div>
				<div class="select-demo">
					<UiSelect
						v-model="actionSelectValue"
						placeholder="Choose an action..."
						:customDisplayText="getActionDisplayText"
						@change="onActionSelectChange"
						class="settings-select"
					>
						<template #options="{ close, selectOption }">
							<div class="ui-dropdown-item custom-header">
								<h4>🎮 Game Actions</h4>
								<button 
									class="close-btn" 
									@click.stop="close()"
									title="Close dropdown"
								>
									❌
								</button>
							</div>
							
							<div 
								v-for="action in actionOptions" 
								:key="action.value"
								class="ui-select-option ui-dropdown-item custom-action-option"
								:class="{ '_selected': actionSelectValue === action.value }"
							>
								<div class="action-content" @click="selectOption(action.value); close()">
									<span class="action-icon">{{ action.icon }}</span>
									<div class="action-details">
										<div class="action-name">{{ action.label }}</div>
										<div class="action-description">{{ action.description }}</div>
									</div>
								</div>
								<button 
									class="action-btn" 
									@click.stop="executeAction(action)"
									:disabled="action.disabled"
								>
									{{ action.buttonText }}
								</button>
							</div>
							
							<div class="ui-dropdown-item custom-footer">
								<small>💡 Tip: Click buttons to execute actions without selecting</small>
							</div>
						</template>
					</UiSelect>
					<div class="select-result">
						<strong>Selected Action:</strong> {{ getSelectedAction() }}
						<br>
						<strong>Last Execution:</strong> {{ lastActionExecution || 'None' }}
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
	import { ref } from 'vue'
	
	// Используем одну из существующих песен
	const musicFile = ref('audio/test/music/X2Download.mp3')
	
	// Предопределённые треки для селектора
	const predefinedTracks = ref([
		{
			id: 1,
			title: 'Breaking Bad Intro',
			artist: 'TV Theme',
			src: 'audio/test/music/breaking-bad-intro.mp3'
		},
		{
			id: 2,
			title: 'Gigachad Theme',
			artist: 'Meme Music',
			src: 'audio/test/music/gigachad-theme-music.mp3'
		},
		{
			id: 3,
			title: 'GTA San Andreas',
			artist: 'Game SFX',
			src: 'audio/test/music/gta-san-andreas-mission-complete-sound-hq.mp3'
		},
		{
			id: 4,
			title: 'Wild Wild Web',
			artist: 'John The Whistler',
			src: 'audio/test/music/John The Whistler - Wild Wild Web.mp3'
		}
	])
	
	// Состояние селектора треков
	const selectedTrack = ref('')
	const currentTrackId = ref(null)
	const trackSelectorPlayer = ref(null)
	
	// Функция выбора трека
	function selectTrack(track) {
		currentTrackId.value = track.id
		selectedTrack.value = track.src
		
		console.log(`Selected track: ${track.title} by ${track.artist}`)
		
		// Если плеер уже смонтирован, сменяем трек напрямую
		if (trackSelectorPlayer.value) {
			trackSelectorPlayer.value.changeTrack(track.src)
		}
	}
	
	// UiSelect Examples Data
	const selectedSingleValue = ref(null)
	const selectedMultipleValues = ref([])
	const selectedObjectValue = ref(null)
	const disabledSelectValue = ref(null)
	
	// Select Options
	const singleSelectOptions = ref([
		'Option 1',
		'Option 2', 
		'Option 3',
		'Option 4',
		'Option 5'
	])
	
	const multiSelectOptions = ref([
		'Feature A',
		'Feature B',
		'Feature C',
		'Feature D',
		'Feature E',
		'Feature F'
	])
	
	const objectSelectOptions = ref([
		{ id: 1, name: 'Wizard', class: 'Mage', disabled: false },
		{ id: 2, name: 'Knight', class: 'Warrior', disabled: false },
		{ id: 3, name: 'Archer', class: 'Ranger', disabled: false },
		{ id: 4, name: 'Assassin', class: 'Rogue', disabled: true },
		{ id: 5, name: 'Paladin', class: 'Holy Warrior', disabled: false },
		{ id: 6, name: 'Necromancer', class: 'Dark Mage', disabled: false }
	])
	
	// Select Event Handlers
	function onSingleSelectChange(value) {
		console.log('Single select changed:', value)
	}
	
	function onMultiSelectChange(values) {
		console.log('Multi select changed:', values)
	}
	
	function onObjectSelectChange(value) {
		console.log('Object select changed:', value)
	}
	
	function getSelectedObjectName() {
		if (!selectedObjectValue.value) return 'Nothing selected'
		const option = objectSelectOptions.value.find(opt => opt.id === selectedObjectValue.value)
		return option ? `${option.name} (${option.class})` : 'Unknown'
	}
	
	// Slot-based Select Examples Data
	const emojiSelectValue = ref(null)
	const characterSelectValues = ref([])
	const actionSelectValue = ref(null)
	const lastActionExecution = ref('')
	
	// Emoji/Mood options
	const moodOptions = ref([
		{ value: 'happy', emoji: '😊', label: 'Happy', description: 'Feeling great and positive!' },
		{ value: 'excited', emoji: '🤩', label: 'Excited', description: 'Super enthusiastic and energetic!' },
		{ value: 'calm', emoji: '😌', label: 'Calm', description: 'Peaceful and relaxed state' },
		{ value: 'focused', emoji: '🤔', label: 'Focused', description: 'Deep in thought and concentrated' },
		{ value: 'sleepy', emoji: '😴', label: 'Sleepy', description: 'Tired and ready for rest' },
		{ value: 'angry', emoji: '😠', label: 'Angry', description: 'Frustrated and irritated' }
	])
	
	// Character options with avatars
	const characterOptions = ref([
		{ value: 'wizard', avatar: '🧙‍♂️', label: 'Gandalf', class: 'Wizard', power: 95 },
		{ value: 'warrior', avatar: '⚔️', label: 'Aragorn', class: 'Ranger', power: 88 },
		{ value: 'elf', avatar: '🏹', label: 'Legolas', class: 'Archer', power: 92 },
		{ value: 'dwarf', avatar: '🪓', label: 'Gimli', class: 'Fighter', power: 85 },
		{ value: 'hobbit', avatar: '🍄', label: 'Frodo', class: 'Rogue', power: 70 },
		{ value: 'dragon', avatar: '🐉', label: 'Smaug', class: 'Dragon', power: 99 }
	])
	
	// Action options with interactive elements
	const actionOptions = ref([
		{ 
			value: 'attack', 
			icon: '⚔️', 
			label: 'Attack', 
			description: 'Launch a powerful attack on enemies',
			buttonText: 'Execute',
			disabled: false
		},
		{ 
			value: 'defend', 
			icon: '🛡️', 
			label: 'Defend', 
			description: 'Raise shields and increase defense',
			buttonText: 'Activate',
			disabled: false
		},
		{ 
			value: 'heal', 
			icon: '💚', 
			label: 'Heal', 
			description: 'Restore health and cure ailments',
			buttonText: 'Cast',
			disabled: false
		},
		{ 
			value: 'magic', 
			icon: '✨', 
			label: 'Magic Spell', 
			description: 'Cast a powerful magical spell',
			buttonText: 'Channel',
			disabled: true
		},
		{ 
			value: 'escape', 
			icon: '💨', 
			label: 'Escape', 
			description: 'Quickly flee from battle',
			buttonText: 'Run',
			disabled: false
		}
	])
	
	// Custom display text functions
	function getEmojiDisplayText(selectedValues, isMultiple) {
		if (!selectedValues || selectedValues.length === 0) {
			return 'Choose your mood...'
		}
		const mood = moodOptions.value.find(m => m.value === selectedValues[0])
		return mood ? `${mood.emoji} ${mood.label}` : selectedValues[0]
	}
	
	function getCharacterDisplayText(selectedValues, isMultiple) {
		if (!selectedValues || selectedValues.length === 0) {
			return 'Select your team (max 3)...'
		}
		if (selectedValues.length === 1) {
			const char = characterOptions.value.find(c => c.value === selectedValues[0])
			return char ? `${char.avatar} ${char.label}` : selectedValues[0]
		}
		return `${selectedValues.length} heroes selected`
	}
	
	function getActionDisplayText(selectedValues, isMultiple) {
		if (!selectedValues || selectedValues.length === 0) {
			return 'Choose an action...'
		}
		const action = actionOptions.value.find(a => a.value === selectedValues[0])
		return action ? `${action.icon} ${action.label}` : selectedValues[0]
	}
	
	// Event handlers for slot examples
	function onEmojiSelectChange(value) {
		console.log('Emoji/Mood select changed:', value)
	}
	
	function onCharacterSelectChange(values) {
		console.log('Character multi-select changed:', values)
	}
	
	function onActionSelectChange(value) {
		console.log('Action select changed:', value)
	}
	
	// Helper functions for display
	function getSelectedMood() {
		if (!emojiSelectValue.value) return 'None'
		const mood = moodOptions.value.find(m => m.value === emojiSelectValue.value)
		return mood ? `${mood.emoji} ${mood.label} - ${mood.description}` : emojiSelectValue.value
	}
	
	function getSelectedCharacters() {
		if (characterSelectValues.value.length === 0) return 'None'
		return characterSelectValues.value.map(val => {
			const char = characterOptions.value.find(c => c.value === val)
			return char ? `${char.avatar} ${char.label}` : val
		}).join(', ')
	}
	
	function getSelectedAction() {
		if (!actionSelectValue.value) return 'None'
		const action = actionOptions.value.find(a => a.value === actionSelectValue.value)
		return action ? `${action.icon} ${action.label}` : actionSelectValue.value
	}
	
	// Interactive action execution
	function executeAction(action) {
		if (action.disabled) return
		
		lastActionExecution.value = `${action.icon} ${action.label} executed at ${new Date().toLocaleTimeString()}`
		console.log('Action executed:', action)
		
		// You could add actual game logic here
		alert(`✨ Executed: ${action.label}\n${action.description}`)
	}
</script>

<style scoped>
	.playground-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}
	
	.audio-section {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.select-section {
		background: rgba(255, 255, 255, 0.05);
		border-radius: 12px;
		padding: 2rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.audio-section h2,
	.select-section h2 {
		color: var(--color-primary, #fff);
		margin-bottom: 1.5rem;
		font-size: 1.8rem;
	}
	
	.player-container {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.player-info {
		margin-bottom: 1rem;
	}
	
	.player-info h3 {
		color: var(--color-primary, #fff);
		margin-bottom: 0.25rem;
		font-size: 1.2rem;
	}
	
	.player-info p {
		color: var(--color-text-secondary, #aaa);
		font-size: 0.9rem;
		margin: 0;
	}
	
	/* Track Selector Styles */
	.track-selector {
		margin-top: 1rem;
	}
	
	.track-buttons {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	
	.track-btn {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-radius: 8px;
		color: var(--color-white);
		cursor: pointer;
		transition: all 0.3s ease;
		text-align: left;
		min-height: 4rem;
	}
	
	.track-btn:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: var(--color-primary);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}
	
	.track-btn.active {
		background: var(--color-primary);
		border-color: var(--color-primary);
		color: var(--color-black);
		box-shadow: 0 0 20px rgba(76, 175, 80, 0.5);
	}
	
	.track-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		font-weight: bold;
		font-size: 1.2rem;
		flex-shrink: 0;
	}
	
	.track-btn.active .track-number {
		background: rgba(0, 0, 0, 0.2);
		color: var(--color-black);
	}
	
	.track-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.track-title {
		font-weight: bold;
		font-size: 1rem;
		line-height: 1.2;
	}
	
	.track-artist {
		font-size: 0.85rem;
		opacity: 0.8;
		line-height: 1.2;
	}
	
	.track-btn.active .track-artist {
		opacity: 0.7;
	}
	
	/* Responsive adjustments */
	@media (max-width: 768px) {
		.track-buttons {
			grid-template-columns: 1fr;
		}
		
		.track-btn {
			min-height: 3.5rem;
			padding: 0.75rem;
		}
		
		.track-number {
			width: 2rem;
			height: 2rem;
			font-size: 1rem;
		}
	}
	
	/* Select Components Styles */
	.select-container {
		background: rgba(0, 0, 0, 0.3);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.select-info {
		margin-bottom: 1rem;
	}
	
	.select-info h3 {
		color: var(--color-primary, #fff);
		margin-bottom: 0.25rem;
		font-size: 1.2rem;
	}
	
	.select-info p {
		color: var(--color-text-secondary, #aaa);
		font-size: 0.9rem;
		margin: 0;
	}
	
	.select-demo {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	
	.select-result {
		padding: 0.75rem;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 6px;
		color: var(--color-white);
		border: 1px solid rgba(255, 255, 255, 0.1);
		font-size: 0.9rem;
		line-height: 1.5;
	}
	
	.select-result strong {
		color: var(--color-primary, #fff);
	}
	
	/* Responsive adjustments for selects */
	@media (max-width: 768px) {
		.select-container {
			padding: 1rem;
			margin-bottom: 1rem;
		}
		
		.select-demo {
			gap: 0.75rem;
		}
		
		.select-result {
			padding: 0.6rem;
			font-size: 0.85rem;
		}
	}
	
	/* Custom Slot Styles */
	/* Emoji/Mood Options */
	.custom-emoji-option {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.custom-emoji-option .emoji {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
	}
	
	.mood-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.mood-name {
		font-weight: bold;
		font-size: 1rem;
		color: var(--color-white);
	}
	
	.mood-description {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
		line-height: 1.3;
	}
	
	.custom-emoji-option:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: translateX(5px);
		transition: all 0.2s ease;
	}
	
	.custom-emoji-option._selected {
		background: rgba(76, 175, 80, 0.2);
		border-left: 4px solid var(--color-primary);
	}
	
	/* Character Options */
	.custom-character-option {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		transition: all 0.3s ease;
	}
	
	.character-avatar {
		font-size: 2.5rem;
		line-height: 1;
		flex-shrink: 0;
		width: 3rem;
		height: 3rem;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.1);
	}
	
	.character-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	
	.character-name {
		font-weight: bold;
		font-size: 1.1rem;
		color: var(--color-white);
	}
	
	.character-class {
		font-size: 0.9rem;
		color: var(--color-primary);
		font-style: italic;
	}
	
	.character-power {
		font-size: 0.8rem;
		color: #ffd700;
		font-weight: bold;
	}
	
	.custom-character-option:hover {
		background: rgba(255, 255, 255, 0.1);
		transform: scale(1.02);
	}
	
	.custom-character-option._selected {
		background: rgba(76, 175, 80, 0.2);
		border-left: 4px solid var(--color-primary);
	}
	
	.custom-character-option._selected .character-avatar {
		background: var(--color-primary);
		color: var(--color-black);
	}
	
	.custom-character-option._disabled {
		opacity: 0.5;
		pointer-events: none;
	}
	
	/* Action Options */
	.custom-header {
		padding: 1rem;
		border-bottom: 2px solid var(--color-primary);
		background: rgba(76, 175, 80, 0.1);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.custom-header h4 {
		margin: 0;
		color: var(--color-primary);
		font-size: 1.1rem;
	}
	
	.close-btn {
		background: rgba(255, 0, 0, 0.2);
		border: 1px solid rgba(255, 0, 0, 0.4);
		color: #ff6b6b;
		border-radius: 50%;
		width: 2rem;
		height: 2rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9rem;
	}
	
	.close-btn:hover {
		background: rgba(255, 0, 0, 0.3);
		transform: scale(1.1);
	}
	
	.custom-action-option {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}
	
	.action-content {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 1rem;
		cursor: pointer;
	}
	
	.action-icon {
		font-size: 1.8rem;
		line-height: 1;
		flex-shrink: 0;
	}
	
	.action-details {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	
	.action-name {
		font-weight: bold;
		font-size: 1rem;
		color: var(--color-white);
	}
	
	.action-description {
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.7);
	}
	
	.action-btn {
		padding: 0.5rem 1rem;
		border-radius: 4px;
		border: 1px solid var(--color-primary);
		background: rgba(76, 175, 80, 0.2);
		color: var(--color-primary);
		font-size: 0.85rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}
	
	.action-btn:hover:not(:disabled) {
		background: var(--color-primary);
		color: var(--color-black);
		transform: translateY(-2px);
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
	}
	
	.action-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
	}
	
	.custom-action-option:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	
	.custom-action-option._selected {
		background: rgba(76, 175, 80, 0.15);
		border-left: 4px solid var(--color-primary);
	}
	
	.custom-footer {
		padding: 0.75rem 1rem;
		background: rgba(255, 255, 255, 0.05);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		text-align: center;
		color: rgba(255, 255, 255, 0.6);
		font-style: italic;
	}
</style>