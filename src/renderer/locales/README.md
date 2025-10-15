# Translation System Documentation

## Structure

The translation system is organized into separate directories for better maintainability:

```
locales/
├── translations/
│   ├── en/
│   │   ├── en.json          # Main translation file (minimal)
│   │   ├── ui/
│   │   │   └── common.json  # UI elements (buttons, menus, etc.)
│   │   └── game/
│   │       ├── characters.json  # Character names and properties
│   │       └── common.json      # Game-specific translations
│   └── ru/
│       ├── ru.json          # Main translation file (minimal)
│       ├── ui/
│       │   └── common.json  # UI elements (buttons, menus, etc.)
│       └── game/
│           ├── characters.json  # Character names and properties
│           └── common.json      # Game-specific translations
```

## Organization

### UI Translations
- Located in `ui/common.json`
- Contains common UI elements organized logically:
  - `mainmenu` - Main menu items
  - `ageVerification` - Age verification screen texts
  - `settings` - Settings screen labels
  - `dialog` - Dialog-specific texts (that don't use common words)
  - Common words at root level: `yes`, `no`, `ok`, `cancel`, `next`, `previous`, `confirm`, `apply`, `back`, `close`

### Game Translations
- Located in `game/` directory
- `game/characters.json` contains character names and properties
- `game/common.json` contains game-specific translations

### Character Names
Character names and properties are now organized in a structured way:
```json
{
  "characters": {
    "momonga": {
      "name": "Satoru Suzuki",
      "surname": "Suzuki",
      "title": "Ainz Ooal Gown",
      "nickname": "Momonga"
    }
  }
}
```

This allows for flexible access to different character properties in dialogs:
- `{characters.momonga.name}` - Character's name
- `{characters.momonga.surname}` - Character's surname
- `{characters.momonga.title}` - Character's title
- `{characters.momonga.nickname}` - Character's nickname

## Logical Structure

To avoid duplication and ensure consistency, translations are organized logically:

1. **Common UI Elements at Root Level** - Standard words like "Yes", "No", "OK", "Cancel", "Next", "Back", "Close" are placed at the root level for universal access
2. **Context-Specific Texts** - Page or section specific texts are in their respective sections
3. **Reusable Components** - Commonly used texts are placed in shared sections

For example:
- Age verification screen uses `ageVerification.title` and `ageVerification.message` for its specific texts
- Buttons in the age verification screen use `yes` and `no` from the root level
- Dialog controls use `back` and `close` from the root level
- Sequential dialog progression uses `next` from the root level
- Save buttons use `confirm` from the root level

This structure allows any part of the application to access common UI elements without duplication.

## Benefits

1. **Better Organization**: Related translations are grouped together
2. **Easier Maintenance**: Changes to UI elements don't affect game content
3. **Scalability**: Easy to add new categories of translations
4. **Translator-Friendly**: Different translators can work on different parts
5. **Flexible Character Names**: Access to different character properties in dialogs
6. **Logical Consistency**: No duplication of common elements
7. **Reusability**: Common UI elements can be used across different parts of the application
8. **Universal Access**: Common words are accessible from anywhere in the application