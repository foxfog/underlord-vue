# Dialog System Documentation

## Flexible Variable Replacement

The dialog system now supports flexible variable replacement using either:
1. `{path.to.variable}` syntax (simplified, recommended)
2. `{g.path.to.variable}` syntax (with 'g.' prefix, for backward compatibility)

This allows you to reference any property from the game store directly in your dialog texts without manually specifying each replacement.

## Language Organization

Dialogs are now organized by language in the `public/game/scenes` directory:
- Each language has its own subdirectory (`en`, `ru`, etc.)
- Files contain only the content for that specific language
- The dialog loader automatically selects the appropriate language based on the user's locale
- This makes it easier for different translators to work on different languages independently

### Directory Structure

```
public/
└── game/
    └── scenes/
        ├── en/
        │   ├── intro_scene.json
        │   ├── second_scene.json
        │   ├── third_scene.json
        │   └── test_variables.json
        ├── ru/
        │   ├── intro_scene.json
        │   ├── second_scene.json
        │   ├── third_scene.json
        │   └── test_variables.json
        └── README.md
```

## Usage Examples

In your dialog JSON files, you can now use placeholders like:

```json
{
  "text": "Hello, {mc.name}! The current time is {world.cur_time}."
}
```

This will automatically replace:
- `{mc.name}` with the player's name from the game store
- `{world.cur_time}` with the current time value from the game store

### Supported Paths

You can reference any nested property in the game store:

- `{mc.name}` - Player's name
- `{mc.nicname}` - Player's nickname
- `{world.cur_time}` - Current time
- `{characters.momonga.title}` - Character's title
- `{characters.momonga.name}` - Character's name
- `{characters.momonga.surname}` - Character's surname

### Backward Compatibility

The system still supports the old syntax with the 'g.' prefix for backward compatibility:

- `{g.mc.name}` - Player's name
- `{g.world.cur_time}` - Current time

Both syntaxes work interchangeably.

### Benefits

1. **No manual replacement code needed** - Just use the placeholder syntax in your JSON files
2. **Flexible** - Works with any property in the game store
3. **Automatic** - No need to update the replacement code when adding new properties
4. **Error-safe** - If a property doesn't exist, the placeholder is left unchanged
5. **Simplified syntax** - Shorter placeholders without the 'g.' prefix
6. **Language Separation** - Each language has its own directory for easier translation
7. **Independent Translation** - Different translators can work on different languages without conflicts

### Example Dialog

See `public/game/scenes/en/test_variables.json` and `public/game/scenes/ru/test_variables.json` for complete examples of how to use this feature.