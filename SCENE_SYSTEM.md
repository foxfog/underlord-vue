# Ren'Py-like Scene System Documentation

## Overview

The Underlord game has been refactored to use a Ren'Py-like scene system instead of JSON-based dialogs. This allows for:

- **Flexible scene scripting** using `.scene` files with Ren'Py-inspired syntax
- **Full state preservation** - saves store complete game state including scene position
- **Character sprites and backgrounds** - visual novel style presentation
- **Variable system** - global game variables and local scene variables
- **Label-based navigation** - jump/call between labels within scenes

## Scene File Format

Scene files are plain text files with `.scene` extension located in `/src/renderer/public/data/scenes/{language}/`

### Basic Syntax

```scene
# Comments start with hash
# Labels define jump points
label start
	# Set variables with $ prefix
	$ game.visited_locations = 1
	$ game.first_time = true
	
	# Set background
	scene bg_apartment
	
	# Show character sprite (position: left, center, right)
	show momonga at center
	
	# Character dialog (speaker must be first word, text in quotes)
	momonga "Hello! How are you?"
	
	# Dialog without speaker (narrator)
	"The day begins..."
	
	# Menu with choices (/ separates choices, -> points to label)
	menu:
		/ "I'm great!" -> great_response
		/ "Not so good..." -> bad_response
	
	# Jump to another label
	jump ending

label great_response
	momonga "That's wonderful!"
	return

label bad_response
	momonga "Sorry to hear that..."
	return

label ending
	hide momonga
	scene bg_black
	"The end."
	return
```

### Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| Label | `label name` | Define a jump point |
| Say | `speaker "text"` | Show dialog with speaker |
| Narration | `"text"` | Show dialog without speaker |
| Set Variable | `$ var = value` | Set a game or scene variable |
| Scene (Background) | `scene bg_name` | Change background image |
| Show Sprite | `show sprite_id at position` | Show character (position: left/center/right) |
| Hide Sprite | `hide sprite_id` | Remove character from screen |
| Menu | `menu: / "choice" -> label` | Show multiple choice options |
| Jump | `jump label_name` | Jump to another label |
| Call | `call label_name` | Call a sub-routine (returns when done) |
| Return | `return` | End current scene or return from call |
| Pause | `pause [duration]` | Pause for duration (seconds) |

### Variable System

**Global Game Variables** - persist across scenes:
```scene
$ game.visited_locations = 0
$ game.choices_made = 5
$ game.player_level = 1
```

These are stored in `g.world` in the game store.

**Scene Variables** - local to current scene execution:
```scene
$ local_flag = true
$ counter = 0
```

Variables can be used in text with `{variable_name}` syntax:
```scene
momonga "You have visited {game.visited_locations} locations."
"Your level is {game.player_level}."
```

## Game Store Actions

The game store (`stores/game.js`) now provides scene execution methods:

```javascript
// Load a scene
await gameStore.loadScene('start', 'en')

// Get next command to execute
const command = gameStore.getNextCommand()

// Execute a command
const result = gameStore.executeCommand(command)

// Advance to next command
gameStore.nextCommand()

// Jump to a label
gameStore.jumpToLabel('label_name')

// Get checkpoint for saving
const checkpoint = gameStore.getCheckpoint()

// Restore from checkpoint
gameStore.restoreCheckpoint(checkpoint)
```

## Save/Load System

### Checkpoint Structure

When saving, the entire game state is preserved:

```json
{
	"currentScene": "start",
	"currentLabel": "after_choice_1",
	"currentCommandIndex": 5,
	"mc": {
		"name": "Player Name",
		"nicname": "player",
		"title": "player"
	},
	"characters": {
		"momonga": {
			"name": "Momonga",
			"title": "Ainz",
			"stats": {
				"level": 50
			}
		}
	},
	"world": {
		"cur_time": "day",
		"visited_locations": 3,
		"choices_made": 5
	},
	"sprites": {
		"momonga": {
			"image": "momonga",
			"position": "center"
		}
	},
	"currentBackground": "bg_apartment",
	"sceneVariables": {
		"local_flag": true
	},
	"timestamp": "2026-01-21T12:30:45.000Z"
}
```

### Quick Save (Keyboard Shortcut)

Future implementation will add Ctrl+S to save at current position.

### Loading from Checkpoint

When loading a save:
1. Game state is restored (`mc`, `characters`, `world` variables)
2. Scene is reloaded
3. Execution continues from saved label and command index
4. Sprites and backgrounds are restored

## File Structure

```
src/renderer/
├── public/data/scenes/
│   ├── en/
│   │   ├── start.scene      # Main starting scene
│   │   └── [other_scenes].scene
│   └── ru/
│       ├── start.scene
│       └── [other_scenes].scene
├── utils/
│   └── sceneParser.js       # Scene file parser and loader
├── stores/
│   └── game.js              # Game store with scene execution
├── views/game/
│   ├── Game.vue             # Main game view (scene executor)
│   ├── GameNew.vue          # New game initialization
│   └── [other game views]
└── components/
    └── SavesList.vue        # Save/load checkpoint UI
```

## Creating Your First Scene

1. Create `start.scene` in `/src/renderer/public/data/scenes/en/`
2. Define labels and commands
3. Use `show`/`hide` for sprites, `scene` for backgrounds
4. Use `menu:` for choices that branch story
5. Use variables to track story state

Example:

```scene
label start
	$ game.game_started = true
	
	scene bg_beginning
	show hero at center
	
	hero "Let's begin this adventure!"
	
	menu:
		/ "Go left" -> go_left
		/ "Go right" -> go_right

label go_left
	hero "I chose left..."
	jump ending

label go_right
	hero "I chose right..."
	jump ending

label ending
	hide hero
	"The journey continues..."
	return
```

## Debugging

Game view shows current scene and label:
- Scene debug info at bottom of game UI
- Browser console shows parser and execution logs
- Scene state is visible in browser DevTools

## Performance Notes

- Scenes are parsed once on load and cached
- Commands are executed sequentially
- Only visible sprites are rendered
- Save files are plain JSON (can be edited manually for debugging)

## Future Enhancements

- [ ] Quick-save with Ctrl+S
- [ ] Scene branching visualization
- [ ] Music and sound effects commands
- [ ] Animation/transition commands
- [ ] Conditional logic (if/else)
- [ ] For loops
- [ ] Save encryption/obfuscation
- [ ] Scene compilation for distribution
