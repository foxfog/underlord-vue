# Character Placement System Documentation

## Overview

This document explains how to place characters on game locations using JSON data. The system is flexible and allows placing any character at any position in any location.

## System Components

### 1. Location Files (`/src/renderer/public/data/locations/`)

Locations can now include a `characters` array that defines which characters should appear at specific coordinates:

```json
{
  "id": "location-id",
  "name": "Location Name",
  "characters": [
    {
      "id": "character-id",
      "position": {
        "cord": [x, y]
      }
    }
  ]
}
```

### 2. Character Files (`/src/renderer/public/data/characters/`)

Character data files define character properties including image paths:

```json
{
  "character-id": {
    "name": "Character Name",
    "tile": {
      "front": {
        "body": {
          "torso": "/images/char/character-id/tile/char.png"
        }
      }
    }
  }
}
```

### 3. Character Loader (`/src/renderer/utils/characterLoader.js`)

Utility functions for loading and managing character data:
- `initCharacterData()` - Initializes character data (no preloading)
- `preloadCharacterData(characterIds)` - Preloads specific character data
- `loadCharacterById(id)` - Loads a specific character by ID
- `getCharacterById(id)` - Gets character data by ID (synchronous)
- `getCharacterByIdAsync(id)` - Gets character data by ID, loading it if necessary
- `getAllCharacters()` - Gets all characters
- `getCharacterImagePath(id)` - Gets character image path

### 4. Location Loader (`/src/renderer/utils/locationLoader.js`)

Extended with new functions for character management:
- `getLocationCharacters(locationId)` - Gets all characters in a location
- `getLocationCharacterById(locationId, characterId)` - Gets a specific character in a location

### 5. Location Character Utilities (`/src/renderer/utils/locationCharacterUtils.js`)

Additional utility functions:
- `getCharactersOnTile(locationId, x, y)` - Gets characters on a specific tile
- `getUniqueCharacterIds(locationId)` - Gets all unique character IDs in a location

## Implementation Details

### LocationIso.vue Component

The [LocationIso.vue](file:///d:/projects/underlord/src/renderer/components/game/LocationIso.vue) component has been updated to:
1. Use `getCharactersOnTile(x, y)` to determine which characters are on each tile
2. Render characters using the [TileChar.vue](file:///d:/projects/underlord/src/renderer/components/game/TileChar.vue) component

### TileChar.vue Component

The [TileChar.vue](file:///d:/projects/underlord/src/renderer/components/game/TileChar.vue) component:
1. Uses `getCharacterImagePath()` to load character-specific images
2. Falls back to a default image if no character-specific image is found

## Usage Examples

### Adding Characters to a Location

To add characters to a location, edit the location JSON file:

```json
{
  "id": "example-location",
  "name": "Example Location",
  "characters": [
    {
      "id": "mc",
      "cord": [0, 0]
    },
    {
      "id": "ainz",
      "cord": [-1, 1]
    }
  ]
}
```

### Creating a New Character

To create a new character, create a new JSON file in `/src/renderer/public/data/characters/`:

```json
{
  "character-id": {
    "name": "Character Name",
    "tile": {
      "front": {
        "body": {
          "torso": "/images/char/character-id/tile/char.png"
        }
      }
    }
  }
}
```

### Getting Characters in Code

```javascript
import { getLocationCharacters, getLocationCharacterById } from '@/utils/locationLoader.js'
import { getCharactersOnTile } from '@/utils/locationCharacterUtils.js'

// Get all characters in a location
const characters = getLocationCharacters('example-location')

// Get a specific character in a location
const character = getLocationCharacterById('example-location', 'mc')

// Get characters on a specific tile
const tileCharacters = getCharactersOnTile('example-location', 0, 0)
```

## Data Flow

1. Location data is loaded by `locationLoader.js`
2. Character data is loaded by `characterLoader.js`
3. `LocationIso.vue` calls `getCharactersOnTile(x, y)` to get characters for each tile
4. Characters are rendered using `TileChar.vue` components
5. `TileChar.vue` loads character images using `getCharacterImagePath()`

## Extensibility

The system is designed to be extensible:
- Add new properties to character JSON files
- Extend the `TileChar.vue` component to display additional character information
- Create new utility functions in `locationCharacterUtils.js` for specific use cases