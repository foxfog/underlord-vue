# Thumbless Range Slider Implementation

## Feature Overview

Added the ability to control the visibility and appearance of the thumb (slider handle) on range sliders. When thumbs are disabled, they become transparent and do not extend above the scrollbar height.

## Implementation Details

### 1. UiRange Component Updates

**Props:**
- `showThumb` (Boolean, default: true) - Controls thumb visibility and behavior

**Template Changes:**
- Added `ui-range--no-thumb` CSS class when `showThumb` is false
- Thumb element is always rendered but styled differently when hidden

### 2. CSS Styling (_range.css)

**New CSS class:**
```css
.ui-range--no-thumb .ui-range-thumb {
    opacity: 0;
    width: calc(0.3 * var(--size));
    height: calc(0.3 * var(--size));
    pointer-events: none;
    transform: translate(-50%, -50%);
}
```

**Key features:**
- Transparent thumb (opacity: 0)
- Same height as track to not extend above scrollbar
- No pointer events to prevent interaction
- No hover effects

### 3. UiPlayerAudio Component Updates

**Props:**
- Added `showThumb` (Boolean, default: true) prop
- Passed down to both timeline and volume UiRange components

**Template Changes:**
- Both timeline and volume range sliders now accept `:showThumb="showThumb"`

### 4. Playground Implementation

**Track Selector Player:**
- Set `:showThumb="false"` on the bottom audio player
- This makes both timeline and volume sliders thumbless

## Usage Examples

### Normal Range (with thumb):
```vue
<UiRange v-model="value" :showThumb="true" />
<!-- or simply -->
<UiRange v-model="value" />
```

### Thumbless Range:
```vue
<UiRange v-model="value" :showThumb="false" />
```

### Audio Player with thumbless sliders:
```vue
<uiPlayerAudio 
    :src="audioSrc" 
    :showThumb="false"
    volumeType="music" 
/>
```

## Visual Differences

**With Thumb (default):**
- Visible circular thumb handle
- Extends above track height
- Interactive hover effects
- User can grab and drag

**Without Thumb (showThumb=false):**
- Invisible/transparent thumb
- Same height as track
- No hover effects
- Still clickable on track for seeking
- Maintains all functionality

## Benefits

1. **Cleaner Design**: Thumbless sliders provide a minimalist appearance
2. **Consistent Height**: No protruding elements above the track
3. **Full Functionality**: All interaction capabilities preserved
4. **Flexible Usage**: Can be applied per component instance
5. **Backwards Compatible**: Default behavior unchanged

## Testing

The bottom audio player on the Playground page now demonstrates thumbless range sliders for both timeline and volume controls. All other players maintain normal thumbed appearance.