# Final Inventory Item Removal Fix

## Issue
Items in inventory had structure `{ itemId: 'gasmask' }` WITHOUT the `quantity` field.

When equipping, the code tried to access `item.quantity`, which was `undefined`.

## Root Cause Analysis

From inventory.json documentation and actual character data:
- Equipment items that don't stack: `{ itemId: "gasmask" }` (quantity omitted if = 1)
- Stackable items: `{ itemId: "coins", quantity: 23 }`

The inventory wasn't automatically populating the `quantity` field, so when the item came from character data, it only had `itemId`.

## Solution

Added automatic quantity initialization in `handleEquip()`:

```javascript
// Ensure quantity exists
if (item.quantity === undefined) {
    item.quantity = 1
    console.log('Initialized quantity to 1')
}

console.log('Reducing quantity from', item.quantity)
item.quantity -= 1
```

This ensures:
1. If quantity exists (stackable items) → use it directly
2. If quantity missing (non-stackable) → initialize to 1 first
3. Then decrement and remove if <= 0

## Expected Console Output After Fix

```
Equipping: {slot: 'mask', itemId: 'gasmask'}
Before equip - inventory items: Proxy(Array) {0: {…}, 1: {…}}
Item index: 0
Item object: Proxy(Object) {itemId: 'gasmask'}
Item keys: ['itemId']
Initialized quantity to 1
Reducing quantity from 1
After reduction: 0
Removing item completely
After equip - inventory items: Proxy(Array) {0: {…}}
```

## How It Works Now

### For Non-stackable Items (equipment)
```json
// Before equip
{ itemId: "gasmask" }

// During equip
// quantity initialized to 1
item.quantity = 1
item.quantity -= 1  // becomes 0
// Item removed from inventory
```

### For Stackable Items (coins, potions)
```json
// Before equip
{ itemId: "ygdrasil-coin-old", quantity: 5 }

// During equip
item.quantity -= 1  // becomes 4
// Item stays in inventory with quantity: 4
```

## Testing

When you equip an item:
1. ✅ System finds the item in inventory
2. ✅ Initializes quantity to 1 if missing
3. ✅ Decrements the quantity
4. ✅ Removes from inventory if quantity reaches 0
5. ✅ Item disappears from UI

## Summary

The system now properly handles:
- **Non-stackable items** (equipment) → Removed completely after equip
- **Stackable items** (coins, potions) → Quantity decremented, item stays unless quantity = 0
- **Mixed inventories** → Both types work correctly

The fix ensures backward compatibility with the existing inventory data structure where `quantity` is optional and defaults to 1.
