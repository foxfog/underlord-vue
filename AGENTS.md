# Underlord-Vue Agent Guide

Follow these rules and read the linked system doc before changing that system. System docs are the source of detail; this file is a short index.

## Layout

The game canvas is 1920x1080 and scales through `--size`.
- Use `em` for layout, spacing, typography, radius, shadows, and positioning. Never use `rem`.
- `px` is allowed only for thin `1px`/`2px` borders.
- Do not use `position: fixed` for game scenes or overlays. Use `position: absolute` inside the game canvas.
- Do not use `vw`/`vh` inside the game canvas; use `em` or `%`.

## Architecture

- Canonical game data: `src/renderer/public/data/` (`@data` in code, `/data/...` at runtime). Do not create `src/renderer/data/`.
- Audio level: `commonVolume * categoryVolume / 10000`.
- Register modals in `useModalStack.js` so they close on `Esc`.

## System Docs

- World: [Maps](docs/systems/MapSystem.md), [Scene hotspots](docs/systems/SceneHotspots.md), [Calendar](docs/systems/TimeCalendar.md), [NPC schedules](docs/systems/NPCScheduleSystem.md).
- Story and UI: [Story architecture](docs/systems/StoryArchitecture.md), [Storyline editor](docs/systems/StorylineEditorSystem.md), [UI controls](docs/ui/UIControl.md), [Dialogue](docs/ui/DialogueSystem.md).
- Characters: [Body and equipment](docs/characters/BodyStructure.md), [Rig studio](docs/characters/CharacterRigStudio.md), [Stats](docs/systems/CharacterStatsSystem.md).
- Gameplay: [Combat](docs/systems/CombatSystem.md), [Crafting](docs/systems/CraftingSystem.md), [Skills](docs/systems/SkillTreeSystem.md), [Mobs](docs/systems/MobSystem.md), [Quests](src/renderer/composables/useQuests.js), [Inventory](docs/systems/Inventory.md), [Encyclopedia](docs/systems/EncyclopediaSystem.md).
- Tools and persistence: [Data editor](docs/systems/DataEditorSystem.md), [Save system](docs/systems/SaveSystem.md), [Isometric maps](docs/systems/IsometricSystem.md), [Hex maps](docs/systems/HexMapSystem.md).

## Quality

- Run only checks relevant to the change. For CSS/Vue styles, run `npm run lint:styles`.
- When changing a mechanic or data format, update its doc, `docs/README.md`, and this index when needed.