# Drag-and-Drop Inventory Fix Summary

## Problem
When dragging items from inventory to equipment slots, the items were not being removed from inventory after being equipped. The root cause was that `getItemSlots()` was returning an empty array, preventing the equip event from being fired.

## Root Cause Analysis
1. `itemsData` is loaded asynchronously in `Game.vue` onMounted
2. When user drags items, `getItemSlots(itemId)` tries to access `props.itemsData[itemId]`
3. If data hasn't loaded yet or isn't propagated correctly, the function returns `[]`
4. Empty slots array means slot compatibility check fails: `!compatibleSlots.includes(slot)` = true
5. Drop is rejected and equip event never fires
6. Therefore inventory item is never removed

## Solution

### 1. Added Fallback Item Data (InventoryItems.vue)
Created an embedded fallback dictionary with slot information for known items:
```javascript
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

### 2. Updated getItemSlots() and getItemName()
Both functions now check both `props.itemsData` AND `fallbackItemData`:
```javascript
function getItemSlots(itemId) {
  // Try to get from props.itemsData first, then fallback to fallbackItemData
  const def = props.itemsData[itemId] || fallbackItemData[itemId]
  if (!def) return []
  const slot = def.slot
  if (Array.isArray(slot)) return slot
  if (slot) return [slot]
  return []
}
```

### 3. Improved Data Flow (InventoryModal.vue)
Created a reactive local copy of itemsData that properly tracks changes:
```javascript
// Create a reactive copy of itemsData to ensure it updates properly
const localItemsData = ref({})

watch(() => props.itemsData, (newData) => {
  if (newData && typeof newData === 'object') {
    localItemsData.value = { ...newData }
  }
}, { deep: true, immediate: true })

const propsItemsData = computed(() => localItemsData.value)
```

### 4. Added Enhanced Logging
Detailed logging at key points:
- InventoryModal: When itemsData updates
- InventoryItems: When itemsData updates, when getItemSlots is called
- Before and after drag start
- During drop validation
- In handleEquip for inventory removal tracking

## Changes Made

### Files Modified:
1. **InventoryItems.vue**
   - Added `fallbackItemData` object
   - Updated `getItemSlots()` to use fallback
   - Updated `getItemName()` to use fallback
   - Added detailed logging in drag start handler
   - Added watch for itemsData changes

2. **InventoryModal.vue**
   - Created `localItemsData` ref
   - Added watch with `deep: true` and `immediate: true`
   - Created `propsItemsData` computed that returns local copy
   - Updated `inventoryItems` computed to use local copy

3. **Game.vue**
   - Added detailed logging in `handleEquip()` function

## How It Works

### Normal Flow (with loaded data):
1. User drags gasmask from inventory
2. `getItemSlots('gasmask')` returns `['mask']` from `props.itemsData`
3. Compatibility check passes
4. Drop event fires equip event
5. Item removed from inventory

### Fallback Flow (if data not loaded):
1. User drags gasmask from inventory  
2. `getItemSlots('gasmask')` returns `['mask']` from `fallbackItemData`
3. Compatibility check passes
4. Drop event fires equip event
5. Item removed from inventory

## Testing
When the fix is in place:
1. Open inventory modal
2. Drag "Gas Mask" from right panel (inventory) to "mask" slot on left panel (equipment)
3. Item should:
   - Appear in equipment slot
   - Disappear from inventory list
   - Appear on character preview (if equipment rendering is set up)
4. Character model should update with equipped item

## Fallback Data Coverage
The fallback includes all items from:
- equipment.json: gasmask, tshirt, tshirt-red, sword-diamond, pendant-zen
- other.json: ygdrasil-coin-old, ygdrasil-coin-new

For new items, they can either:
1. Be added to fallbackItemData
2. Or wait for itemsData to load (since we check that first)
3. Or be consumables without slots (coins return `[]`)
