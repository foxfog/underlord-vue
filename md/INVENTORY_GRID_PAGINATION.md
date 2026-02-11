# Inventory Grid System with Pagination

## Overview
Added a grid-based inventory system with empty slots and pagination support.

## Features

### Grid Layout
- **6 columns × 5 rows** = 30 slots per page
- Each slot can contain an item or be empty
- **Total 300 slots** = 10 pages
- Scrollable within the grid area

### Pagination
- **Page Navigation Controls** at the bottom of inventory section
- "← Назад" (Back) button - go to previous page
- "Вперед →" (Forward) button - go to next page
- **Page Info Display** - shows current page and total pages
- Disabled buttons when at first/last page

### Visual Feedback
- Empty slots have light border and darker background
- Hovered slots show highlight
- Occupied slots display item icon, name, and quantity
- Quantity badge in bottom-right corner of slot

## Code Changes

### InventoryItems.vue

#### New Refs
```javascript
const SLOTS_PER_PAGE = 30
const currentPage = ref(1)
```

#### New Computed Properties
```javascript
// Create full inventory with 300 slots (30/page × 10 pages)
const inventorySlots = computed(() => {
  const totalSlots = SLOTS_PER_PAGE * 10
  const slots = []
  for (let i = 0; i < totalSlots; i++) {
    if (i < props.items.length) {
      slots.push(props.items[i])
    } else {
      slots.push(null)  // Empty slot
    }
  }
  return slots
})

// Get slots for current page
const currentPageSlots = computed(() => {
  const startIdx = (currentPage.value - 1) * SLOTS_PER_PAGE
  const endIdx = startIdx + SLOTS_PER_PAGE
  return inventorySlots.value.slice(startIdx, endIdx)
})

// Calculate total pages
const totalPages = computed(() => {
  return Math.ceil(inventorySlots.value.length / SLOTS_PER_PAGE)
})
```

#### New Function
```javascript
function goToPage(page) {
  const validPage = Math.max(1, Math.min(page, totalPages.value))
  currentPage.value = validPage
}
```

### Template Changes
- Changed from `.inventory-list` to `.inventory-grid`
- Grid displays 30 slots (6 columns × 5 rows)
- Each slot can be empty or contain an item
- Added pagination controls below grid

### Styling
Added comprehensive CSS for:
- `.inventory-grid` - 6-column grid layout
- `.inventory-grid-slot` - Individual slot styling
- `.empty-slot` - Empty slot appearance
- `.pagination-controls` - Navigation buttons
- `.btn-pagination` - Button styling with hover/disabled states
- `.page-info` - Page counter display

## Usage

### Navigation
Users can navigate inventory pages by:
1. Clicking "← Назад" to go to previous page
2. Clicking "Вперед →" to go to next page
3. Buttons are disabled when at boundaries (first/last page)

### Item Placement
- Items appear in grid from top-left to bottom-right
- Empty slots fill remaining space
- Users can drag items from one slot to another
- Users can drag items to equipment slots
- Users can drag equipment items back to inventory

### Keyboard Navigation (Optional Enhancement)
Could add arrow keys or Page Up/Down for navigation:
```javascript
const onKeyDown = (e) => {
  if (e.key === 'ArrowRight' || e.key === 'PageDown') goToPage(currentPage.value + 1)
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') goToPage(currentPage.value - 1)
}
```

## Storage Consideration
Currently supports 300 slots (10 pages). To expand:
1. Change multiplier in `inventorySlots` computed
2. Adjust grid columns in `.inventory-grid` CSS
3. Update total slots calculation

Example for 600 slots (20 pages × 6 columns):
```javascript
const inventorySlots = computed(() => {
  const totalSlots = SLOTS_PER_PAGE * 20  // 20 pages instead of 10
  // ... rest same
})
```

## Drag-and-Drop Integration
- Drag handlers still work for `.draggable-item`
- Drop zones work on `.inventory-grid` (previously `.inventory-list`)
- Unequip works by dragging from equipment to inventory grid

## CSS Grid Responsive Design
Current grid is 6 columns fixed. For future responsiveness:
```css
@media (max-width: 1200px) {
  .inventory-grid {
    grid-template-columns: repeat(5, 1fr);  /* 5 columns */
    /* Adjust SLOTS_PER_PAGE and layout accordingly */
  }
}
```

## Performance Notes
- Grid uses virtual scrolling via native CSS overflow-y: auto
- 300 slots = minimal memory footprint
- Page switching is instant (just state change)
- No complex calculations per frame

## Future Enhancements
1. **Keyboard navigation** with arrow keys
2. **Drag-to-sort** items between slots
3. **Filters** (show only equipment, consumables, etc.)
4. **Search** items by name
5. **Sort** (by name, quantity, weight)
6. **Item tooltips** on hover
7. **Favorites/pinning** items to top
8. **Auto-organize** inventory
