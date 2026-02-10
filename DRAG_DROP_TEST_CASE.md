# Drag-and-Drop Inventory System - Final Test Case

## Test Environment
- Framework: Vue 3 with Composition API
- Drag Library: interact.js v1.10.19
- Target Item: "Gas Mask" (gasmask)
- Target Slot: "mask" equipment slot

## Pre-Test Checklist
- [ ] Application is running: `npm run dev`
- [ ] Dev Tools are open: F12
- [ ] Console tab is visible
- [ ] Game is loaded and playable
- [ ] Inventory modal can be opened

## Test Scenario: Equip Gas Mask

### Step 1: Open Inventory Modal
**Action:** Click the inventory button in the game
**Expected Result:** 
- Inventory modal appears
- Console shows "InventoryModal: itemsData updated" with item list
- Gas Mask should be visible in right panel (inventory list)

**Verification Points:**
```
Look for console output:
✓ "InventoryModal: itemsData updated"
✓ Keys should include 'gasmask'
```

### Step 2: Prepare Drag
**Action:** Hover over "Gas Mask" in inventory (right panel)
**Expected Result:**
- Item highlights
- Equipment slots on left appear
- "mask" slot is visible and empty

**Verification Points:**
```
Look for slot labels:
✓ "mask" slot visible on left side
✓ All equipment slots shown
```

### Step 3: Start Drag
**Action:** Press mouse down on "Gas Mask" and hold
**Expected Result:**
- Item starts being dragged
- Compatible slots highlight in green
- Incompatible slots highlight in gray
- Console shows drag start logs

**Verification Points:**
```
Console should show:
✓ "Drag start - before getItemSlots:" with itemsData details
✓ "getItemSlots:" with found: true and slot: 'mask'
✓ "Drag start:" with slots: ['mask']
✓ All slots updated with compatible/incompatible classes
```

### Step 4: Drag to Target Slot
**Action:** While holding mouse down, move Gas Mask to the "mask" slot
**Expected Result:**
- Item follows cursor
- "mask" slot highlights with drag-over effect
- Other slots remain highlighted (green=compatible, gray=incompatible)

**Verification Points:**
```
Visual feedback:
✓ Item moves with cursor
✓ "mask" slot has special drag-over styling
✓ No errors in console
```

### Step 5: Release (Drop)
**Action:** Release mouse button over the "mask" slot
**Expected Result:**
- Gas Mask appears in the equipment slot
- Gas Mask disappears from inventory list
- Character model updates if equipment rendering is enabled
- Console shows drop and equip logs

**Verification Points:**
```
Console should show (in order):
✓ "Drop event:" with compatibleSlots: ['mask'] and match: true
✓ "Equipping:" { slot: 'mask', itemId: 'gasmask' }
✓ "Before equip - inventory items:" [list of items including gasmask]
✓ "Item index:" 0 or higher (item found)
✓ "Reducing quantity from" 1
✓ "After reduction:" 0
✓ "Removing item completely"
✓ "After equip - inventory items:" [list without gasmask]

Visual feedback:
✓ Gas Mask now shows in equipment slot area
✓ Gas Mask gone from inventory list
✓ Character preview shows Gas Mask if applicable
```

### Step 6: Unequip (Optional - Test Reverse Flow)
**Action:** Drag Gas Mask from equipment slot back to inventory
**Expected Result:**
- Gas Mask reappears in inventory
- Equipment slot becomes empty
- Character preview updates

**Verification Points:**
```
Console should show:
✓ "Drag start - before getItemSlots:" for equipment drag
✓ "Drop event:" (into inventory zone)
✓ "Unequipping:" { slot: 'mask', itemId: 'gasmask' }
✓ Inventory shows Gas Mask with quantity 1
```

## Success Criteria

All of the following must be true:
1. ✅ Gas Mask successfully equips (appears in equipment slot)
2. ✅ Gas Mask is removed from inventory after equipping
3. ✅ Compatible slot highlighting works (mask slot is green)
4. ✅ Incompatible slots are visible (gray)
5. ✅ Drag operation is smooth and responsive
6. ✅ No JavaScript errors in console
7. ✅ Character preview updates with equipment (if applicable)
8. ✅ Unequip works (optional, but nice to have)

## Fallback Activation

The system includes fallback data that activates when `props.itemsData` is not available:

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

If you see `found: false` in logs but the drag still works, the fallback is being used.

## Debug Information

### If Drag Starts But Drop Doesn't Work
1. Check console for "Drop event:" log
2. If missing, drop zone may not be properly configured
3. Verify `!compatibleSlots.includes(slot)` returns false (should allow drop)

### If Item Doesn't Appear in Equipment Slot
1. Check if equip event is fired ("Equipping:" in console)
2. Verify equipment rendering component (EquipPart.vue) is working
3. Check that equipmentBySlot is updated in character object

### If Item Doesn't Disappear from Inventory
1. Check "Item index:" log - should be >= 0
2. Check "Removing item completely" message
3. Verify inventory.items is being modified (check "After equip - inventory items:")
4. Ensure splicing is not being blocked by immutability issues

## Additional Tests

### Test with Different Items
- Repeat with T-Shirt (tshirt) → torso-1 slot
- Repeat with Sword (sword-diamond) → hand-left or hand-right slot
- Try dropping item to incompatible slot (should be rejected with gray highlighting)

### Test with Consumables
- Try dragging ygdrasil-coin-old (no equipment slot)
- Should not allow drag to equipment area (no compatible slots)

### Test Data Loading Timing
- Open inventory immediately after game loads
- Game should still work even if itemsData hasn't fully loaded yet (fallback will handle it)
