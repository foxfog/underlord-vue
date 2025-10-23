# Changelog

## [Unreleased]

### Added
- Explicit `id`, `type`, and `tags` fields to all tile definitions in [tiles.json](file:///d:/projects/underlord/src/renderer/components/game/tiles/tiles.json)
- Explicit `id` field to all object definitions in [objects.json](file:///d:/projects/underlord/src/renderer/components/game/tiles/objects.json)
- New utility functions in [tileLoader.js](file:///d:/projects/underlord/src/renderer/utils/tileLoader.js) to access tile type and tags
- New utility functions in [objectLoader.js](file:///d:/projects/underlord/src/renderer/utils/objectLoader.js) to access object type and tags
- Data attributes (`data-id`, `data-type`, `data-tags`) to tile and object elements in LocationIso.vue for CSS manipulation
- CSS classes for type and tags in LocationIso.vue for easier styling
- Documentation files: [README.md](file:///d:/projects/underlord/README.md) in the tiles directory and updates to the main [README.md](file:///d:/projects/underlord/README.md)

### Changed
- Modified [LocationIso.vue](file:///d:/projects/underlord/src/renderer/components/game/LocationIso.vue) to use the new data structure and expose ID, type, and tags for CSS manipulation
- Updated [tileLoader.js](file:///d:/projects/underlord/src/renderer/utils/tileLoader.js) and [objectLoader.js](file:///d:/projects/underlord/src/renderer/utils/objectLoader.js) to work with the new data structure
- Enhanced the main [README.md](file:///d:/projects/underlord/README.md) to document the new data structure

### Fixed
- Improved data consistency by ensuring all tile and object definitions include explicit ID fields
- Enabled better CSS manipulation capabilities through data attributes and CSS classes