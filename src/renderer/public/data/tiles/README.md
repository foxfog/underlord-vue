# Tile and Object Data Structure

This directory contains the tile and object definitions used in the game.

## Tiles ([tiles.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/tiles.json))

The [tiles.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/tiles.json) file contains definitions for all floor tiles in the game. Each tile is identified by a numeric ID and contains the following properties:

- `id`: The numeric ID of the tile (explicitly included for consistency)
- `type`: The type of the tile (currently all tiles are of type "tile")
- `tags`: An array of tags describing the tile's properties (e.g., "floor", "indoor", "stone")
- `name`: A human-readable name for the tile
- `image`: Image information for the tile:
  - `url`: Path to the tile image
  - `width`: Width of the image (optional, defaults to "100%")
  - `height`: Height of the image (optional, defaults to "auto")
  - `top`: Top position offset (optional, defaults to "0")

## Objects ([objects.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/objects.json))

The [objects.json](file:///d:/projects/underlord/src/renderer/public/data/tiles/objects.json) file contains definitions for all objects that can be placed on tiles. Each object is identified by a string ID and contains the following properties:

- `id`: The string ID of the object (explicitly included for consistency)
- `type`: The type of the object (e.g., "wall", "door", "furniture", "item")
- `tags`: An array of tags describing the object's properties (e.g., "blocking", "stone", "indoor")
- `name`: A human-readable name for the object
- `image`: Image information for the object:
  - `url`: Path to the object image

## Data Access

Tile and object data can be accessed through the utility functions in:
- [tileLoader.js](file:///d:/projects/underlord/src/renderer/utils/tileLoader.js)
- [objectLoader.js](file:///d:/projects/underlord/src/renderer/utils/objectLoader.js)

These utilities provide functions to:
- Get tile/object data by ID
- Get tile/object data by type or tag
- Get image URLs for tiles/objects
- Get type and tags for CSS manipulation

## CSS Manipulation

The LocationIso.vue component uses the ID, type, and tags for CSS manipulation. Each tile and object element in the DOM includes:
- `data-id`: The ID of the tile/object
- `data-type`: The type of the tile/object
- `data-tags`: A space-separated list of tags
- CSS classes for the type and each tag (prefixed with "tag-")

This allows for targeted CSS styling based on tile/object properties.