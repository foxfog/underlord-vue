# Ren'Py-like Save/Load System Implementation

## Overview

A complete Ren'Py-style save/load system has been implemented for the Underlord-Vue Electron application. This system allows players to save and load their game progress at any time, including all game state variables, story position, character data, and scene information.

## Architecture

### 1. **Data Storage (File System)**
- **Location**: `%APPDATA%/underlord-vue/saves/` (Windows) or equivalent per OS
- **File Format**: JSON
- **File Naming**: `{slotNumber}_{mcName}_{timestamp}.json`
  - Example: `0_John_2026-01-30_143022.json`
- **Total Save Slots**: 20 (numbered 0-19)

### 2. **Core Components**

#### **Main Process (Electron)**
File: `src/main/index.js`

IPC Handlers:
- `save-game` - Saves game state to disk
- `load-game` - Loads game state from disk
- `list-saves` - Lists all available saves
- `delete-save` - Deletes a save file

#### **Preload Bridge**
File: `src/preload/index.js`

Exposed API:
```javascript
window.api.saveGame(slotNumber, saveFile)
window.api.loadGame(slotNumber)
window.api.listSaves()
window.api.deleteSave(slotNumber)
```

#### **Pinia Store**
File: `src/renderer/stores/saves.js`

The `useSavesStore` manages:
- Save file metadata and game state
- IPC communication with main process
- Save serialization/deserialization
- Timestamp formatting

Key Methods:
- `saveGame(slotNumber, gameState, mcName)` - Save a game
- `loadGame(slotNumber)` - Load a game
- `deleteSave(slotNumber)` - Delete a save
- `listSaves()` - Get all saves
- `serializeGameState(gameState)` - Convert game state to JSON

#### **VisualNovel Component**
File: `src/renderer/components/game/VisualNovel.vue`

New Methods (exposed via `defineExpose`):
- `getGameState()` - Serializes current game state
- `restoreGameState(saveData)` - Restores game state from save file

Serialized Data:
```javascript
{
  storyData: {},           // Current story JSON
  stepIndex: 0,            // Current step position
  callStack: [],           // Nested story positions
  globalData: {},          // Global game variables
  characterData: {},       // Character stats and properties
  visibleCharacters: [],   // Array of currently visible character IDs
  currentScene: null       // Current scene ID
}
```

#### **SaveLoadModal Component**
File: `src/renderer/components/SaveLoadModal.vue`

Features:
- Tab switching between Save/Load modes
- 20 save slots displayed in paginated 3-column grid
- Shows metadata: timestamp, MC name, slot status
- Save slot detection and highlighting
- Calls `visualNovel.getGameState()` to save
- Calls `visualNovel.restoreGameState()` to load

#### **SavesContent Component**
File: `src/renderer/components/SavesContent.vue`

Features:
- Displays all 20 save slots with pagination
- Shows save metadata (timestamp, MC name)
- Delete button for each save with confirmation
- Automatically loads save list on component mount

#### **Game View**
File: `src/renderer/views/Game.vue`

- Passes `visualNovel` ref to SaveLoadModal
- Handles save completion events (closes modal, returns to menu)
- Handles load completion events (closes modal, resumes game)

## Data Flow

### Saving a Game

```
User clicks Save Slot
  ↓
SaveLoadModal gets game state: visualNovel.getGameState()
  ↓
savesStore.saveGame(slot, gameState, mcName)
  ↓
IPC: window.api.saveGame(slot, saveFile)
  ↓
Main process: fs.writeFile() to saves directory
  ↓
File: {slotNumber}_{mcName}_{timestamp}.json
  ↓
UI updates to show filled slot with metadata
  ↓
emit('save-complete') → Modal closes
```

### Loading a Game

```
User clicks Load Slot
  ↓
savesStore.loadGame(slot)
  ↓
IPC: window.api.loadGame(slot)
  ↓
Main process: fs.readFile() from saves directory
  ↓
Parse JSON save data
  ↓
visualNovel.restoreGameState(saveData)
  ↓
Restore all game state (story, variables, characters)
  ↓
processStep() - Display current game position
  ↓
emit('load-complete') → Modal closes, menu hides
  ↓
Game resumes from saved position
```

### Listing Saves

```
SavesContent mounts
  ↓
savesStore.listSaves()
  ↓
IPC: window.api.listSaves()
  ↓
Main process: fs.readdir() in saves directory
  ↓
Parse all .json files as save metadata
  ↓
Return array of save objects with slot, timestamp, mcName
  ↓
UI displays saves in grid with pagination
```

## Save File Structure

```json
{
  "slot": 0,
  "timestamp": 1706529840000,
  "timestampFormatted": "2026-01-30_153320",
  "mcName": "John",
  "gameState": {
    "storyData": {
      "id": "start",
      "steps": [...]
    },
    "stepIndex": 5,
    "callStack": [
      {
        "storyId": "nameinput",
        "stepIndex": 1
      }
    ],
    "globalData": {
      "visitedLocation": true,
      "gold": 100
    },
    "characterData": {
      "mc": {
        "id": "mc",
        "name": "John",
        "stats": {
          "hp": 8,
          "attack": 3,
          ...
        }
      },
      ...
    },
    "visibleCharacters": ["mc", "albedo"],
    "currentScene": "mc_apartment"
  }
}
```

## Key Features

✅ **Persistent Storage** - Saves to disk via Electron's userData directory
✅ **Automatic Metadata** - Timestamp and MC name captured with each save
✅ **Full State Serialization** - All game variables, character stats, story position
✅ **Multiple Save Slots** - 20 independent save slots (0-19)
✅ **Save/Load UI** - Tab-based modal with pagination
✅ **Save Browser** - Separate SavesContent tab with delete functionality
✅ **Nested Story Support** - Call stack preserves story navigation history
✅ **Character Data Persistence** - All character stats and properties saved
✅ **Global Variables** - Custom game variables in `globalData` are preserved

## Translations

The following keys have been added to translation files:

**Russian** (`src/renderer/locales/translations/ru/ui/common.json`):
- `ui.common.save` - "Сохранить"
- `ui.common.load` - "Загрузить"
- `ui.common.empty` - "Пусто"

**English** (`src/renderer/locales/translations/en/ui/common.json`):
- `ui.common.save` - "Save"
- `ui.common.load` - "Load"
- `ui.common.empty` - "Empty"

## Usage

### For Players

1. **Save Game**:
   - Press ESC to open menu
   - Click "Сохранения" / "Save-Load"
   - Switch to "Save" tab
   - Click on desired slot (0-19)
   - Game state is automatically saved

2. **Load Game**:
   - Press ESC to open menu
   - Click "Сохранения" / "Save-Load"
   - Switch to "Load" tab
   - Click on saved slot
   - Game resumes from saved position

3. **Delete Save**:
   - Go to "Saves" tab in main menu
   - Click trash icon on desired save
   - Confirm deletion

### For Developers

#### Getting Current Game State
```javascript
// In VisualNovel component (already exposed)
const gameState = visualNovel.value.getGameState()
```

#### Saving a Game
```javascript
const savesStore = useSavesStore()
const result = await savesStore.saveGame(slotNumber, gameState, "PlayerName")
if (result.success) {
  console.log('Game saved!')
}
```

#### Loading a Game
```javascript
const savesStore = useSavesStore()
const result = await savesStore.loadGame(slotNumber)
if (result.success) {
  await visualNovel.value.restoreGameState(result.data.gameState)
}
```

#### Listing All Saves
```javascript
const savesStore = useSavesStore()
const result = await savesStore.listSaves()
console.log(result.data) // Array of save metadata
```

## File Structure Summary

```
src/
├── main/
│   └── index.js                    (IPC handlers)
├── preload/
│   └── index.js                    (IPC bridge)
├── renderer/
│   ├── stores/
│   │   └── saves.js               (Pinia store)
│   ├── components/
│   │   ├── SaveLoadModal.vue       (Save/Load modal)
│   │   ├── SavesContent.vue        (Saves browser)
│   │   └── game/
│   │       └── VisualNovel.vue     (Serialization/restoration)
│   ├── views/
│   │   └── Game.vue               (Integration)
│   ├── locales/
│   │   └── translations/
│   │       ├── ru/ui/common.json   (Russian translations)
│   │       └── en/ui/common.json   (English translations)
```

## Troubleshooting

### Saves Not Persisting
- Check `%APPDATA%/underlord-vue/saves/` directory exists
- Verify file permissions allow writing to userData directory
- Check browser console for IPC errors

### Save File Corrupted
- Delete the corrupted `.json` file from `saves/` directory
- Slot will show as empty on next launch

### MC Name Not Displaying
- Ensure `character.mc.name` is set in game state
- Check translation for `ui.common.empty` fallback

### State Not Restoring Correctly
- Verify all required properties in `gameState` object
- Check character IDs match loaded character data
- Ensure story files still exist at load time

## Future Enhancements

- [ ] Save thumbnails/screenshots
- [ ] Save slots with custom names
- [ ] Cloud save synchronization
- [ ] Save slots from different game versions
- [ ] Automatic backup saves
- [ ] Save slot organization/sorting
- [ ] Manual slot naming UI
- [ ] Play time tracking
- [ ] Statistics per save
