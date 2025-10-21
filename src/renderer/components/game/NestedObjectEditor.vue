<template>
	<div class="nested-object nested-level" :style="{ marginLeft: level * 15 + 'px' }">
		<div class="nested-object-header">
			<span>{{ getObjectDisplayName(object.id) }}</span>
			<div class="nested-object-actions">
				<button 
					:disabled="!selectedObjectType" 
					@click="emit('addNestedObject', object)" 
					class="add-nested-object-button nested-add-button"
				>
					Добавить вложенный
				</button>
				<button @click="emit('removeNestedObject')" class="remove-nested-object-button">
					Удалить
				</button>
			</div>
		</div>
		
		<!-- Position offset fields for nested objects -->
		<div class="position-offset-fields nested">
			<label>X Offset (%):</label>
			<input 
				type="number" 
				:value="object.pos ? object.pos[0] : 0" 
				@change="updateNestedObjectPositionOffset(0, $event.target.value)"
				class="form-control small-input"
			/>
			<label>Y Offset (%):</label>
			<input 
				type="number" 
				:value="object.pos ? object.pos[1] : 0" 
				@change="updateNestedObjectPositionOffset(1, $event.target.value)"
				class="form-control small-input"
			/>
		</div>
		
		<!-- Display deeper nested objects recursively -->
		<div v-if="object.containedObjects && object.containedObjects.length > 0" class="nested-objects-list nested-level">
			<NestedObjectEditor 
				v-for="(nestedObj, nestedIndex) in object.containedObjects" 
				:key="nestedIndex"
				:object="nestedObj"
				:level="level + 1"
				:selected-object-type="selectedObjectType"
				:get-object-display-name="getObjectDisplayName"
				@add-nested-object="emit('addNestedObject', $event)"
				@remove-nested-object="removeNestedObjectAt(nestedIndex)"
			/>
		</div>
	</div>
</template>

<script setup>
	import { inject } from 'vue'
	
	const props = defineProps({
		object: {
			type: Object,
			required: true
		},
		level: {
			type: Number,
			default: 1
		},
		selectedObjectType: {
			type: [String, null],
			default: null
		},
		getObjectDisplayName: {
			type: Function,
			required: true
		}
	})
	
	const emit = defineEmits(['addNestedObject', 'removeNestedObject'])
	
	// Function to update nested object position offset
	const updateNestedObjectPositionOffset = (index, value) => {
		// Initialize pos array if it doesn't exist
		if (!props.object.pos) {
			props.object.pos = [0, 0]
		}
		
		// Update the specific index
		props.object.pos[index] = parseInt(value) || 0
		
		// Clean up if both values are zero
		if (props.object.pos[0] === 0 && props.object.pos[1] === 0) {
			delete props.object.pos
		}
	}
	
	// Function to remove nested object at specific index
	const removeNestedObjectAt = (index) => {
		if (props.object.containedObjects && props.object.containedObjects.length > index) {
			props.object.containedObjects.splice(index, 1)
		}
	}
</script>

<style scoped>
.nested-object {
	display: flex;
	flex-direction: column;
	padding: 5px;
	background: rgba(50, 50, 70, 0.7);
	border: 1px solid rgba(255, 255, 255, 0.1);
	border-radius: 3px;
	margin-bottom: 5px;
}

.nested-object.nested-level {
	background: rgba(60, 60, 80, 0.7);
}

.nested-object-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.nested-object-actions {
	display: flex;
	gap: 5px;
}

.position-offset-fields.nested {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 5px;
	margin: 5px 0;
}

.position-offset-fields.nested label {
	color: #ccc;
	font-size: 0.8em;
}

.form-control.small-input {
	width: 60px;
	display: inline-block;
	margin-right: 10px;
	padding: 3px;
	font-size: 0.8em;
}

.remove-nested-object-button, .add-nested-object-button {
	padding: 3px 6px;
	background: linear-gradient(145deg, #6a4a4a, #4a2a2a);
	color: #ffffff;
	border: 1px solid rgba(255, 255, 255, 0.2);
	border-radius: 3px;
	font-size: 0.7em;
	cursor: pointer;
}

.remove-nested-object-button:hover, .add-nested-object-button:hover {
	background: linear-gradient(145deg, #8a5a5a, #6a3a3a);
}

.remove-nested-object-button:disabled, .add-nested-object-button:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.add-nested-object-button {
	align-self: flex-start;
	width: auto;
}

.nested-add-button {
	margin-left: 10px;
}

.nested-objects-list {
	margin: 5px 0;
}
</style>