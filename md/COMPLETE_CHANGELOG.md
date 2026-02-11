# Complete Changelog - Drag and Drop Inventory Fix

## Issue Summary
**Problem:** When dragging items from inventory to equipment slots, items were not being removed from inventory after equipping.

**Root Cause:** `getItemSlots()` returned empty array when `props.itemsData` wasn't loaded, causing drop compatibility check to fail and preventing equip event from firing.

**Solution:** Implement fallback item data and improve reactive data flow in Vue components.

---

## Detailed Changes

### 1. InventoryItems.vue

#### Change 1.1: Add Fallback Item Data
**Location:** Lines 75-82 (after imports)

**Before:** No fallback mechanism
```javascript
// No fallback data, relies entirely on props.itemsData
```

**After:** Built-in fallback data dictionary
```javascript
// Fallback data for items if they're not loaded yet
const fallbackItemData = {
	'gasmask': { id: 'gasmask', slot: 'mask', name: 'Gas Mask' },
	'tshirt': { id: 'tshirt', slot: 'torso-1', name: 'T-Shirt' },
	'tshirt-red': { id: 'tshirt-red', slot: 'torso-1', name: 'Red T-Shirt' },
	'sword-diamond': { id: 'sword-diamond', slot: ['hand-left', 'hand-right'], name: 'Diamond Sword' },
	'pendant-zen': { id: 'pendant-zen', slot: 'neck', name: 'Zen Pendant' },
	'ygdrasil-coin-old': { id: 'ygdrasil-coin-old', slot: [], name: 'Old Ygdrasil Coin' },
	'ygdrasil-coin-new': { id: 'ygdrasil-coin-new', slot: [], name: 'New Ygdrasil Coin' }
}
```

**Impact:** Ensures slot information always available, even if async data loading hasn't completed

#### Change 1.2: Update getItemName()
**Location:** Function definition

**Before:**
```javascript
function getItemName(id) {
	const def = props.itemsData[id] || { name: id }
	return def.name || def.id || id
}
```

**After:**
```javascript
function getItemName(id) {
	const def = props.itemsData[id] || fallbackItemData[id] || { name: id }
	return def.name || def.id || id
}
```

**Change:** Added fallback lookup after props.itemsData

#### Change 1.3: Update getItemSlots()
**Location:** Function definition

**Before:**
```javascript
function getItemSlots(itemId) {
	const def = props.itemsData[itemId]
	console.log('getItemSlots:', { itemId, found: !!def, def, allKeys: Object.keys(props.itemsData) })
	if (!def) return []
	const slot = def.slot
	if (Array.isArray(slot)) return slot
	if (slot) return [slot]
	return []
}
```

**After:**
```javascript
function getItemSlots(itemId) {
	// Try to get from props.itemsData first, then fallback to fallbackItemData
	const def = props.itemsData[itemId] || fallbackItemData[itemId]
	console.log('getItemSlots:', { 
		itemId, 
		found: !!def, 
		def, 
		propsItemsDataKeys: Object.keys(props.itemsData),
		fallbackKeys: Object.keys(fallbackItemData)
	})
	if (!def) {
		console.warn(`Item ${itemId} not found in itemsData or fallback!`)
		return []
	}
	const slot = def.slot
	if (Array.isArray(slot)) return slot
	if (slot) return [slot]
	return []
}
```

**Changes:**
- Added fallback lookup: `props.itemsData[itemId] || fallbackItemData[itemId]`
- Enhanced logging to show both itemsData and fallback keys
- Better warning message

#### Change 1.4: Improve Drag Start Logging
**Location:** setupDragAndDrop() → start event handler

**Before:**
```javascript
start: (event) => {
	draggedElement.value = event.target
	const itemId = event.target.getAttribute('data-item-id')
	const fromType = event.target.getAttribute('data-type')
	const fromSlot = event.target.getAttribute('data-from')
	
	draggedItemId.value = itemId
	draggedFromType.value = fromType
	draggedFromSlot.value = fromSlot
	
	// Сохраняем совместимые слоты для последующей проверки
	const slots = [...getItemSlots(itemId)]
	draggedItemSlots.value = slots
	currentCompatibleSlots.value = slots
	isDragging.value = true
	
	console.log('Drag start:', { itemId, fromType, fromSlot, slots })
	// ... rest
}
```

**After:**
```javascript
start: (event) => {
	draggedElement.value = event.target
	const itemId = event.target.getAttribute('data-item-id')
	const fromType = event.target.getAttribute('data-type')
	const fromSlot = event.target.getAttribute('data-from')
	
	draggedItemId.value = itemId
	draggedFromType.value = fromType
	draggedFromSlot.value = fromSlot
	
	console.log('Drag start - before getItemSlots:', { 
		itemId, 
		fromType, 
		fromSlot,
		itemsDataKeys: Object.keys(props.itemsData),
		itemsDataLength: Object.keys(props.itemsData).length,
		itemsData: props.itemsData
	})
	
	// Сохраняем совместимые слоты для последующей проверки
	const slots = [...getItemSlots(itemId)]
	draggedItemSlots.value = slots
	currentCompatibleSlots.value = slots
	isDragging.value = true
	
	console.log('Drag start:', { itemId, fromType, fromSlot, slots })
	// ... rest
}
```

**Changes:** Added detailed logging before getItemSlots() call to show data availability

#### Change 1.5: Improve Drop Logging
**Location:** setupDragAndDrop() → drop event handler (slots dropzone)

**Before:**
```javascript
drop: (event) => {
	event.preventDefault()
	event.target.classList.remove('drag-over')
	const slot = event.target.getAttribute('data-slot')
	
	const compatibleSlots = currentCompatibleSlots.value
	
	console.log('Drop event:', { slot, draggedItemId: draggedItemId.value, draggedFromType: draggedFromType.value, compatibleSlots })
	// ... rest
}
```

**After:**
```javascript
drop: (event) => {
	event.preventDefault()
	event.target.classList.remove('drag-over')
	const slot = event.target.getAttribute('data-slot')
	
	const compatibleSlots = currentCompatibleSlots.value
	
	console.log('Drop event:', { 
		slot, 
		draggedItemId: draggedItemId.value, 
		draggedFromType: draggedFromType.value, 
		compatibleSlots,
		match: compatibleSlots.includes(slot)
	})
	// ... rest
}
```

**Changes:** Added match flag to show if compatibility check will pass

#### Change 1.6: Add itemsData Watch
**Location:** After resetItemPosition function, before setupDragAndDrop

**Before:** No watch for itemsData changes

**After:**
```javascript
// Watch for itemsData changes
watch(() => props.itemsData, (newData) => {
	console.log('InventoryItems: itemsData updated', Object.keys(newData), newData)
}, { deep: true })
```

**Impact:** Monitors when parent component updates itemsData

---

### 2. InventoryModal.vue

#### Change 2.1: Add Local itemsData Ref
**Location:** Near activeTab definition

**Before:**
```javascript
const activeTab = ref('inventory')

const tabs = [
	// ... tabs definition
]
```

**After:**
```javascript
const activeTab = ref('inventory')

// Create a reactive copy of itemsData to ensure it updates properly
const localItemsData = ref({})

// Watch for changes and update local copy
watch(() => props.itemsData, (newData) => {
	console.log('InventoryModal: itemsData updated', newData, Object.keys(newData))
	if (newData && typeof newData === 'object') {
		localItemsData.value = { ...newData }
	}
}, { deep: true, immediate: true })

// Expose itemsData under a local name for template prop binding
const propsItemsData = computed(() => localItemsData.value)

const tabs = [
	// ... tabs definition
]
```

**Changes:**
- Created localItemsData ref to hold a copy
- Added watch with deep: true (watch nested changes) and immediate: true (trigger on first mount)
- Created computed propsItemsData to expose the local copy

#### Change 2.2: Remove Old itemsData Watch and Binding
**Location:** Old watch and propsItemsData assignment

**Before:**
```javascript
// expose itemsData under a local name for template prop binding
const propsItemsData = props.itemsData

// Логирование при изменении itemsData
watch(() => props.itemsData, (newData) => {
	console.log('InventoryModal: itemsData updated', newData, Object.keys(newData))
}, { deep: true })
```

**After:** Removed (replaced by new watch and computed above)

#### Change 2.3: Update inventoryItems Computed
**Location:** inventoryItems computed definition

**Before:**
```javascript
const inventoryItems = computed(() => {
	if (!props.character?.inventory?.items) return []

	return props.character.inventory.items.map(invItem => {
		// Получаем описание предмета из itemsData (equipment или other)
		const itemDef = props.itemsData[invItem.itemId] || {
			id: invItem.itemId,
			name: invItem.itemId
		}
		// ... rest
	})
})
```

**After:**
```javascript
const inventoryItems = computed(() => {
	if (!props.character?.inventory?.items) return []

	return props.character.inventory.items.map(invItem => {
		// Получаем описание предмета из itemsData (equipment или other)
		const itemDef = localItemsData.value[invItem.itemId] || {
			id: invItem.itemId,
			name: invItem.itemId
		}
		// ... rest
	})
})
```

**Changes:** Changed from `props.itemsData` to `localItemsData.value` for consistency

**Impact:** Uses local copy to ensure consistency with what's passed to child components

---

### 3. Game.vue

#### Change 3.1: Enhanced handleEquip Logging
**Location:** handleEquip function

**Before:**
```javascript
function handleEquip({ slot, itemId }) {
	console.log('Equipping:', { slot, itemId })
	if (mcCharacter.value?.equipment_slots) {
		mcCharacter.value.equipment_slots[slot] = itemId
		// Удалить предмет из инвентаря
		if (mcCharacter.value?.inventory?.items) {
			const itemIndex = mcCharacter.value.inventory.items.findIndex(item => item.itemId === itemId)
			if (itemIndex !== -1) {
				mcCharacter.value.inventory.items[itemIndex].quantity -= 1
				if (mcCharacter.value.inventory.items[itemIndex].quantity <= 0) {
					mcCharacter.value.inventory.items.splice(itemIndex, 1)
				}
			}
		}
		// Перестроить equipmentBySlot
		rebuildEquipmentBySlot()
	}
}
```

**After:**
```javascript
function handleEquip({ slot, itemId }) {
	console.log('Equipping:', { slot, itemId })
	console.log('Before equip - inventory items:', mcCharacter.value?.inventory?.items)
	if (mcCharacter.value?.equipment_slots) {
		mcCharacter.value.equipment_slots[slot] = itemId
		// Удалить предмет из инвентаря
		if (mcCharacter.value?.inventory?.items) {
			const itemIndex = mcCharacter.value.inventory.items.findIndex(item => item.itemId === itemId)
			console.log('Item index:', itemIndex)
			if (itemIndex !== -1) {
				console.log('Reducing quantity from', mcCharacter.value.inventory.items[itemIndex].quantity)
				mcCharacter.value.inventory.items[itemIndex].quantity -= 1
				console.log('After reduction:', mcCharacter.value.inventory.items[itemIndex].quantity)
				if (mcCharacter.value.inventory.items[itemIndex].quantity <= 0) {
					console.log('Removing item completely')
					mcCharacter.value.inventory.items.splice(itemIndex, 1)
				}
			}
		}
		console.log('After equip - inventory items:', mcCharacter.value?.inventory?.items)
		// Перестроить equipmentBySlot
		rebuildEquipmentBySlot()
	}
}
```

**Changes:** 
- Added "Before equip" logging to show initial state
- Added logging for item index
- Added logging for quantity changes
- Added logging for item removal
- Added "After equip" logging to confirm removal

**Impact:** Detailed tracking of inventory update process for debugging

---

## Summary of Changes

| File | Type | Impact |
|------|------|--------|
| InventoryItems.vue | Enhancement | Added fallback data + improved logging |
| InventoryModal.vue | Enhancement | Improved reactive data flow |
| Game.vue | Enhancement | Added diagnostic logging |

**Total Lines Added:** ~150  
**Total Lines Removed:** ~20  
**Net Change:** +130 lines (mostly logging and fallback data)  

**Breaking Changes:** None - all changes are backwards compatible

**Backwards Compatibility:** ✅ All changes are additions/improvements, no existing functionality removed

---

## Testing Impact

These changes improve:
1. ✅ Reliability - Works even if async data loading is slow
2. ✅ Debuggability - Detailed console logging for troubleshooting
3. ✅ Robustness - Fallback mechanism ensures basic functionality
4. ✅ Maintainability - Better data flow visibility

Potential Issues to Watch:
- Performance: Fallback data is hardcoded, not ideal for 100s of items
- Sync: If JSON data differs from fallback, discrepancies may occur
- Future: New items must be added to both JSON files AND fallback

Recommendations for Future:
1. Consider lazy-loading fallback data from a separate file
2. Add validation that fallback matches actual JSON data
3. Add unit tests for drag-drop flow
4. Remove or hide detailed logging in production build

---

## Rollback Information

If needed to revert these changes:

1. Remove fallbackItemData object from InventoryItems.vue
2. Change `getItemSlots` and `getItemName` to use only `props.itemsData`
3. Remove all `console.log` and `console.warn` calls
4. Revert InventoryModal.vue to use only `props.itemsData` directly
5. Remove watch and computed for local itemsData in InventoryModal.vue

This would restore original behavior, including the original bug.
