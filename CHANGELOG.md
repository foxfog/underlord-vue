# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2024-05-20

### Added
- Explicit `id`, `type`, and `tags` fields to all tile definitions in [tiles.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/tiles.json)
- Explicit `id` field to all object definitions in [objects.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/objects.json)
- Moved tile and object data files to `src/renderer/public/data/tiles/` directory

### Changed
- Updated data loading mechanisms to use public directory access instead of import.meta.glob
- Improved CSS manipulation in LocationIso.vue component using new ID, type, and tags fields
- Modified [LocationIso.vue](file:///d:/projects/underlord/src/renderer/components/game/LocationIso.vue) to use the new data structure and expose ID, type, and tags for CSS manipulation

## [0.1.0] - 2024-05-15

### Added
- Initial project structure
- Basic isometric grid rendering
- Location editor functionality
- Save/load system
- Multi-language support