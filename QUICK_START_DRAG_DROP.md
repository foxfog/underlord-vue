# Quick Start - Drag and Drop Inventory Testing

## What Was Fixed

The drag-and-drop inventory system was not removing items from inventory when equipped because the item data wasn't being found during the drag operation. This has been fixed with:

1. **Fallback Item Data** - Built-in data for all known items so the system works even if data hasn't fully loaded
2. **Improved Data Flow** - Better tracking of itemsData through Vue's reactive system
3. **Enhanced Logging** - Detailed console output for debugging

## How to Test

### 1. Start the Application
```bash
cd d:\projects\underlord-vue
npm run dev
```

The app will open automatically. Wait for it to fully load.

### 2. Open Browser Developer Tools
- Press `F12` or `Ctrl+Shift+I`
- Go to **Console** tab
- Keep this open while testing

### 3. Open Inventory
- In the game, click the **Inventory** button (top-left UI typically)
- The inventory modal should appear

### 4. Test Equipping Gas Mask
1. Locate **"Gas Mask"** in the inventory list (right side of modal)
2. Click and hold on it
3. Note that the equipment slots light up (green for compatible, gray for incompatible)
4. Drag the Gas Mask to the **"mask"** equipment slot (left side, top row usually)
5. Release the mouse

### Expected Results
✅ Gas Mask moves to the equipment slot  
✅ Gas Mask disappears from inventory list  
✅ Character preview updates with the mask (if rendering is enabled)  
✅ Console shows completion messages  

### Console Output to Expect
When you drag the mask, you should see:
```
Drag start - before getItemSlots: {...}
getItemSlots: {itemId: 'gasmask', found: true, def: {...}, ...}
Drag start: {itemId: 'gasmask', fromType: 'item', slots: ['mask']}
...
Drop event: {slot: 'mask', compatibleSlots: ['mask'], match: true}
Equipping: {slot: 'mask', itemId: 'gasmask'}
Before equip - inventory items: [...]
Item index: 0
Reducing quantity from 1
After reduction: 0
Removing item completely
After equip - inventory items: [...]
```

## Files Changed

### 1. `src/renderer/components/game/inventory/InventoryItems.vue`
- Added `fallbackItemData` object with slot definitions
- Updated `getItemSlots()` to use fallback when data not available
- Updated `getItemName()` to use fallback
- Added detailed logging for drag operations
- Added watch() for itemsData updates

### 2. `src/renderer/components/game/inventory/InventoryModal.vue`
- Created `localItemsData` reactive ref
- Added watch() with `deep: true` and `immediate: true`
- Updated computed `propsItemsData` to return local copy
- Ensures itemsData updates are properly tracked

### 3. `src/renderer/views/Game.vue`
- Added detailed logging in `handleEquip()` 
- Shows inventory state before and after equipping
- Helps debug any remaining issues

## Troubleshooting

### Issue: Gas Mask doesn't disappear from inventory
**Check console for:** "Drop event:" with `match: true`  
**If missing:** Drop event not firing - may need to drag more slowly or precisely to the slot

**If present:** Check "Removing item completely" message  
**If missing:** Inventory update not working - check character.inventory.items structure

### Issue: Gas Mask appears in slot but still in inventory
**Likely cause:** Drag/drop handler not firing equip event  
**Check:** Is console showing "Equipping: {slot: 'mask', itemId: 'gasmask'}"?  
**If no:** Event not emitting - check InventoryItems emit() calls  
**If yes:** Game.vue not handling event - check Game.vue template for @equip handler

### Issue: Drag doesn't highlight compatible slots
**Check console:** Look for "Drag start:" message  
**If missing:** Drag not initializing properly  
**If present:** Check that draggedItemSlots includes 'mask' slot  
**If not:** getItemSlots() returning empty - check fallback is working

### Issue: No console messages at all
**Possible cause:** React component not rendering  
**Check:** Is InventoryItems component visible in the modal?  
**Check:** No JavaScript errors in console before interacting?  
**Try:** Refresh the page and try again

## Additional Test Cases

### Test 1: Equip T-Shirt (torso-1 slot)
- Drag T-Shirt from inventory
- Drop on first torso slot
- Should work same as mask

### Test 2: Unequip (Reverse)
- Drag equipped item back from slot to inventory area
- Item should return to inventory with quantity 1
- Console should show "Unequipping:" message

### Test 3: Incompatible Drop (Optional)
- Try dragging a non-equipment item (if available)
- Try dropping equipment to wrong slot
- Should be rejected (gray highlighting indicates incompatible)

## Performance Note
The application uses Electron with Vue Vite dev server. HMR (Hot Module Replacement) is enabled, so changes to component code will reload automatically.

## Next Steps

If testing is successful:
1. All drag-and-drop functionality working ✓
2. Inventory correctly updates ✓
3. Character preview updates ✓

Consider:
- [ ] Remove logging in production build
- [ ] Add unit tests for drag-drop flow
- [ ] Add visual feedback animations
- [ ] Add item description tooltips
- [ ] Add drag and drop undo/redo

## Need Help?

1. Check **DRAG_DROP_FIX_SUMMARY.md** for technical details
2. Check **DRAG_DROP_TEST_CASE.md** for comprehensive testing guide
3. Review console logs carefully - they show exactly what's happening
4. Verify itemsData is loading: Look for "Items data loaded:" in console at game startup
